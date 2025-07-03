import { TelegramApiClient } from './telegram-client.js';
import { TelegramApiConfig } from './telegram-config.js';
import { ScrapeOptions, ScrapeResult, TelegramPost, TelegramChannel } from '../types/telegram.types.js';
import { logger } from '../utils/logger.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { MarkdownFormatter } from '../formatters/markdown-formatter.js';

export class TelegramApiScraper {
  private client: TelegramApiClient;
  private formatter: MarkdownFormatter;

  constructor(config: TelegramApiConfig) {
    this.client = new TelegramApiClient(config);
    this.formatter = new MarkdownFormatter();
  }

  async initialize(): Promise<void> {
    await this.client.initialize();
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    logger.info(`Starting API scrape for: ${options.url}`);
    
    try {
      // Extract channel username from URL
      const channelUsername = this.extractUsername(options.url);
      if (!channelUsername) {
        throw new Error('Invalid Telegram URL');
      }

      // Get channel info
      const channelInfo = await this.client.getChannelInfo(channelUsername);
      const channel: TelegramChannel = {
        name: channelInfo.title,
        username: channelInfo.username,
        description: channelInfo.about || '',
        subscriberCount: channelInfo.participantsCount,
        photoUrl: channelInfo.photo,
        verified: false // API doesn't provide this directly
      };

      // Get messages
      let messages;
      if (options.maxPosts === 0) {
        // Get all messages
        messages = await this.client.getAllChannelMessages(channelUsername);
      } else {
        // Get limited messages
        messages = await this.client.getChannelMessages(channelUsername, options.maxPosts || 100);
      }

      // Convert to our post format
      const posts: TelegramPost[] = messages
        .filter(msg => msg.message) // Only posts with text
        .map(msg => ({
          id: msg.id.toString(),
          date: new Date(msg.date * 1000), // Convert Unix timestamp
          content: msg.message,
          views: msg.views,
          reactions: msg.reactions || [],
          hasMedia: !!msg.mediaType,
          mediaTypes: msg.mediaType ? [msg.mediaType] : [],
          channelName: channel.name
        }));

      // Filter by date if specified
      let filteredPosts = posts;
      if (options.dateFrom) {
        filteredPosts = filteredPosts.filter(post => post.date >= options.dateFrom!);
      }
      if (options.dateTo) {
        filteredPosts = filteredPosts.filter(post => post.date <= options.dateTo!);
      }

      // Sort by date (newest first)
      filteredPosts.sort((a, b) => b.date.getTime() - a.date.getTime());

      const result: ScrapeResult = {
        channel,
        posts: filteredPosts,
        scrapedAt: new Date(),
        totalPosts: filteredPosts.length
      };

      // Save to file
      await this.saveToFile(result, channel.username);

      logger.info(`API scraping complete. Total posts: ${result.totalPosts}`);
      return result;
      
    } catch (error) {
      logger.error('API scraping failed:', error);
      return {
        channel: {
          name: 'Unknown',
          username: 'unknown',
          description: ''
        },
        posts: [],
        scrapedAt: new Date(),
        totalPosts: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async search(channelUrl: string, query: string, limit: number = 100): Promise<ScrapeResult> {
    try {
      const channelUsername = this.extractUsername(channelUrl);
      if (!channelUsername) {
        throw new Error('Invalid Telegram URL');
      }

      // Get channel info
      const channelInfo = await this.client.getChannelInfo(channelUsername);
      const channel: TelegramChannel = {
        name: channelInfo.title,
        username: channelInfo.username,
        description: channelInfo.about || '',
        subscriberCount: channelInfo.participantsCount,
        photoUrl: channelInfo.photo,
        verified: false
      };

      // Search messages
      const messages = await this.client.searchInChannel(channelUsername, query, limit);

      // Convert to our post format
      const posts: TelegramPost[] = messages.map(msg => ({
        id: msg.id.toString(),
        date: new Date(msg.date * 1000),
        content: msg.message,
        views: msg.views,
        reactions: [],
        hasMedia: !!msg.mediaType,
        mediaTypes: msg.mediaType ? [msg.mediaType] : [],
        channelName: channel.name
      }));

      return {
        channel,
        posts,
        scrapedAt: new Date(),
        totalPosts: posts.length
      };
      
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  private extractUsername(url: string): string | null {
    // Handle various URL formats
    const patterns = [
      /t\.me\/([^/?]+)/,
      /telegram\.me\/([^/?]+)/,
      /^@?([a-zA-Z0-9_]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async saveToFile(result: ScrapeResult, channelName: string): Promise<void> {
    try {
      const markdown = this.formatter.format(result);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${channelName}_${timestamp}_api.md`;
      
      // Use Claude's AppData directory
      const basePath = '/mnt/c/Users/User/AppData/Roaming/Claude/telegram_scraped_data';
      const filepath = join(basePath, filename);
      
      // Create directory if it doesn't exist
      await mkdir(basePath, { recursive: true });
      
      // Write file
      await writeFile(filepath, markdown, 'utf8');
      logger.info(`Saved to: ${filepath}`);
      
      // Also save JSON version
      const jsonFilename = `${channelName}_${timestamp}_api.json`;
      const jsonFilepath = join(basePath, jsonFilename);
      await writeFile(jsonFilepath, JSON.stringify(result, null, 2), 'utf8');
      
    } catch (error) {
      logger.error('Failed to save to file:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }
}