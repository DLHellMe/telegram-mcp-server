export interface TelegramChannel {
  name: string;
  description?: string;
  username: string;
  subscriberCount?: number;
  photoUrl?: string;
  verified?: boolean;
}

export interface TelegramPost {
  id: string;
  date: Date;
  content: string;
  views?: number;
  forwards?: number;
  reactions?: TelegramReaction[];
  hasMedia?: boolean;
  mediaTypes?: MediaType[];
  replyCount?: number;
  editedDate?: Date;
  channelName: string;
}

export interface TelegramReaction {
  emoji: string;
  count: number;
}

export type MediaType = 'photo' | 'video' | 'audio' | 'document' | 'poll' | 'location';

export interface ScrapeOptions {
  url: string;
  dateFrom?: Date;
  dateTo?: Date;
  maxPosts?: number;
  includeReactions?: boolean;
  includeComments?: boolean;
  headless?: boolean;
}

export interface ScrapeResult {
  channel: TelegramChannel;
  posts: TelegramPost[];
  scrapedAt: Date;
  totalPosts: number;
  error?: string;
}