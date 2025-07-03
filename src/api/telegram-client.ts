import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import input from 'input';
import { logger } from '../utils/logger.js';
import { TelegramApiConfig } from './telegram-config.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export class TelegramApiClient {
  private client: TelegramClient | null = null;
  private config: TelegramApiConfig;
  private sessionPath: string;

  constructor(config: TelegramApiConfig) {
    this.config = config;
    // Store session in user's data directory
    const dataPath = this.getDataPath();
    this.sessionPath = join(dataPath, 'telegram_session.txt');
  }

  private getDataPath(): string {
    // Check for custom data path from environment
    if (process.env.TELEGRAM_DATA_PATH) {
      return process.env.TELEGRAM_DATA_PATH;
    }
    
    // Use platform-specific default paths
    const platform = process.platform;
    const home = homedir();
    
    if (platform === 'win32') {
      return join(home, 'AppData', 'Roaming', 'telegram-mcp-data');
    } else if (platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'telegram-mcp-data');
    } else {
      return join(home, '.config', 'telegram-mcp-data');
    }
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = this.getDataPath();
      if (!existsSync(dataDir)) {
        await mkdir(dataDir, { recursive: true });
      }
      
      // Load existing session if available
      let stringSession = '';
      try {
        stringSession = await readFile(this.sessionPath, 'utf8');
        logger.info('Loaded existing Telegram session');
      } catch {
        logger.info('No existing session found, will create new one');
      }

      const session = new StringSession(stringSession);
      
      this.client = new TelegramClient(
        session,
        this.config.apiId,
        this.config.apiHash,
        {
          connectionRetries: 5,
          useWSS: true
        }
      );

      await this.client.start({
        phoneNumber: async () => await input.text('Enter your phone number: '),
        password: async () => await input.text('Enter your password (if 2FA enabled): '),
        phoneCode: async () => await input.text('Enter the code you received: '),
        onError: (err) => logger.error('Telegram auth error:', err),
      });

      logger.info('Successfully connected to Telegram!');
      
      // Save session for future use
      const sessionString = this.client.session.save() as unknown as string;
      await writeFile(this.sessionPath, sessionString, 'utf8');
      logger.info('Session saved for future use');
      
    } catch (error) {
      logger.error('Failed to initialize Telegram client:', error);
      throw error;
    }
  }

  async getChannelInfo(channelUsername: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      // Remove @ if present
      const username = channelUsername.replace('@', '');
      
      // Get the channel entity
      const channel = await this.client.getEntity(username);
      
      if (channel instanceof Api.Channel || channel instanceof Api.Chat) {
        return {
          id: channel.id.toString(),
          title: channel.title,
          username: (channel as Api.Channel).username || username,
          participantsCount: (channel as Api.Channel).participantsCount || 0,
          photo: channel.photo ? await this.downloadPhoto(channel.photo) : null,
          about: (channel as Api.Channel).broadcast ? 'Channel' : 'Group'
        };
      }
      
      throw new Error('Entity is not a channel or group');
    } catch (error) {
      logger.error('Failed to get channel info:', error);
      throw error;
    }
  }

  async getChannelMessages(
    channelUsername: string, 
    limit: number = 100,
    offsetId?: number
  ): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const username = channelUsername.replace('@', '');
      const channel = await this.client.getEntity(username);
      
      // Get messages
      const messages = await this.client.getMessages(channel, {
        limit,
        offsetId,
        reverse: false // Get newest first
      });

      return messages.map(msg => ({
        id: msg.id,
        date: msg.date,
        message: msg.message,
        views: msg.views || 0,
        forwards: msg.forwards || 0,
        replies: msg.replies ? msg.replies.replies : 0,
        editDate: msg.editDate,
        fromId: msg.fromId?.toString(),
        mediaType: this.getMediaType(msg.media),
        reactions: msg.reactions ? this.parseReactions(msg.reactions) : []
      }));
      
    } catch (error) {
      logger.error('Failed to get messages:', error);
      throw error;
    }
  }

  async getAllChannelMessages(channelUsername: string): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const allMessages: any[] = [];

    try {
      const username = channelUsername.replace('@', '');
      const channel = await this.client.getEntity(username);
      
      logger.info(`Starting to fetch all messages from ${channelUsername}`);
      
      // Use iter_messages for efficient iteration
      for await (const message of this.client.iterMessages(channel, {
        limit: undefined, // Get all messages
        reverse: false
      })) {
        allMessages.push({
          id: message.id,
          date: message.date,
          message: message.message,
          views: message.views || 0,
          forwards: message.forwards || 0,
          replies: message.replies ? message.replies.replies : 0,
          editDate: message.editDate,
          fromId: message.fromId?.toString(),
          mediaType: this.getMediaType(message.media),
          reactions: message.reactions ? this.parseReactions(message.reactions) : []
        });

        // Log progress
        if (allMessages.length % 100 === 0) {
          logger.info(`Fetched ${allMessages.length} messages so far...`);
        }
      }

      logger.info(`Completed! Total messages fetched: ${allMessages.length}`);
      return allMessages;
      
    } catch (error) {
      logger.error('Failed to get all messages:', error);
      throw error;
    }
  }

  async searchInChannel(
    channelUsername: string, 
    query: string, 
    limit: number = 100
  ): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const username = channelUsername.replace('@', '');
      const channel = await this.client.getEntity(username);
      
      const messages = await this.client.getMessages(channel, {
        search: query,
        limit
      });

      return messages.map(msg => ({
        id: msg.id,
        date: msg.date,
        message: msg.message,
        views: msg.views || 0,
        mediaType: this.getMediaType(msg.media)
      }));
      
    } catch (error) {
      logger.error('Failed to search messages:', error);
      throw error;
    }
  }

  private getMediaType(media: any): string | null {
    if (!media) return null;
    
    if (media instanceof Api.MessageMediaPhoto) return 'photo';
    if (media instanceof Api.MessageMediaDocument) {
      if (media.document && 'mimeType' in media.document) {
        const mimeType = media.document.mimeType;
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
      }
      return 'document';
    }
    if (media instanceof Api.MessageMediaPoll) return 'poll';
    if (media instanceof Api.MessageMediaGeo) return 'location';
    
    return 'other';
  }

  private parseReactions(reactions: any): Array<{emoji: string, count: number}> {
    if (!reactions || !reactions.results) return [];
    
    return reactions.results.map((r: any) => ({
      emoji: r.reaction.emoticon || r.reaction,
      count: r.count || 0
    }));
  }

  private async downloadPhoto(_photo: any): Promise<string | null> {
    // For now, just return null. In future, we could download and save photos
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.connected === true;
  }
}