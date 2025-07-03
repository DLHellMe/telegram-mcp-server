import * as cheerio from 'cheerio';
import { TelegramChannel, TelegramPost, TelegramReaction, MediaType } from '../types/telegram.types.js';
import { logger } from '../utils/logger.js';

export class AuthDataParser {
  constructor() {}

  // Parse messages from Telegram Web authenticated session
  parseWebMessages(html: string): TelegramPost[] {
    const $ = cheerio.load(html);
    const posts: TelegramPost[] = [];

    // Telegram Web uses different selectors
    const messageSelectors = [
      '.message',
      '.bubbles-group-item',
      '[data-mid]',
      '.bubble'
    ];

    for (const selector of messageSelectors) {
      $(selector).each((_, element) => {
        try {
          const post = this.parseWebMessage($, $(element));
          if (post) {
            posts.push(post);
          }
        } catch (error) {
          logger.error('Error parsing web message:', error);
        }
      });

      if (posts.length > 0) break;
    }

    return posts;
  }

  private parseWebMessage($: cheerio.Root, element: cheerio.Cheerio): TelegramPost | null {
    // Extract message ID
    const idAttr = element.attr('data-mid') || 
                   element.attr('data-message-id') || 
                   element.find('[data-mid]').attr('data-mid');
    
    let id = idAttr ?? '';
    
    if (!id) {
      // Try to extract from message timestamp link
      const timestampLink = element.find('.time, .message-time').attr('href') || '';
      const match = timestampLink.match(/\/(\d+)$/);
      id = (match && match[1]) || "";
    }

    if (!id) return null;

    // Extract date
    const timeElement = element.find('.time, .message-time, time');
    const dateStr = timeElement.attr('datetime') || 
                   timeElement.attr('title') || 
                   timeElement.text() || '';
    const date = dateStr ? new Date(dateStr) : new Date();

    // Extract content
    const content = this.extractWebContent($, element);

    // Extract views
    const viewsText = element.find('.views, .post-views').text() || '0';
    const views = this.parseNumber(viewsText);

    // Extract reactions
    const reactions = this.parseWebReactions($, element);

    // Detect media
    const hasMedia = element.find('img, video, .media, .document').length > 0;
    const mediaTypes = this.detectWebMediaTypes($, element);

    return {
      id,
      date,
      content,
      views,
      reactions,
      hasMedia,
      mediaTypes,
      channelName: ''
    };
  }

  private extractWebContent($: cheerio.Root, element: cheerio.Cheerio): string {
    // Try different selectors for message text
    const textSelectors = [
      '.message-text',
      '.text-content',
      '.bubble-content',
      '.message',
      '.text'
    ];

    for (const selector of textSelectors) {
      const textElement = element.find(selector);
      if (textElement.length > 0) {
        // Clone to avoid modifying original
        const cloned = textElement.clone();
        
        // Convert br to newlines
        cloned.find('br').replaceWith('\n');
        
        // Handle code blocks
        cloned.find('pre').each((_, pre) => {
          const code = $(pre).text();
          $(pre).replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n`);
        });
        
        // Get text
        let content = cloned.text().trim();
        
        // Preserve links
        textElement.find('a').each((_, link) => {
          const href = $(link).attr('href');
          const text = $(link).text();
          if (href && text) {
            content = content.replace(text, `[${text}](${href})`);
          }
        });
        
        if (content) return content;
      }
    }

    // Check for media caption
    const caption = element.find('.caption, .media-caption').text().trim();
    if (caption) return caption;

    // Check if it's a forwarded message
    const forwarded = element.find('.forwarded, .forward-from').text().trim();
    if (forwarded) return `[Forwarded from ${forwarded}]`;

    // Check for media only
    if (element.find('img, video, .media').length > 0) {
      const mediaTypes = this.detectWebMediaTypes($, element);
      return `[Media: ${mediaTypes.join(', ')}]`;
    }

    return '[No content]';
  }

  private parseWebReactions($: cheerio.Root, element: cheerio.Cheerio): TelegramReaction[] {
    const reactions: TelegramReaction[] = [];

    element.find('.reaction, .reactions-item').each((_, item) => {
      const emoji = $(item).find('.reaction-emoji').text().trim();
      const countText = $(item).find('.reaction-count').text().trim();
      const count = this.parseNumber(countText);

      if (emoji && count > 0) {
        reactions.push({ emoji, count });
      }
    });

    return reactions;
  }

  private detectWebMediaTypes(_$: cheerio.Root, element: cheerio.Cheerio): MediaType[] {
    const types: MediaType[] = [];

    if (element.find('img:not(.emoji)').length > 0) types.push('photo');
    if (element.find('video').length > 0) types.push('video');
    if (element.find('audio, .audio').length > 0) types.push('audio');
    if (element.find('.document, .file').length > 0) types.push('document');
    if (element.find('.poll').length > 0) types.push('poll');
    if (element.find('.location, .geo').length > 0) types.push('location');

    return types;
  }

  parseChannelInfo(html: string): TelegramChannel {
    const $ = cheerio.load(html);
    
    // Try to extract from different possible locations
    const name = $('.chat-info-name').text().trim() ||
                $('.peer-title').text().trim() ||
                $('.chatlist-chat-title').text().trim() ||
                $('h1').first().text().trim() ||
                'Unknown Channel';

    const description = $('.chat-info-description').text().trim() ||
                       $('.peer-description').text().trim() ||
                       '';

    // Extract username from URL or page
    const urlMatch = html.match(/@([a-zA-Z0-9_]+)/);
    const username = (urlMatch && urlMatch[1]) || "unknown";

    // Try to get subscriber count
    let subscriberCount: number | undefined;
    const subscriberText = $('.chat-info-subscribers').text() ||
                          $('.peer-subscribers').text() ||
                          '';
    if (subscriberText) {
      subscriberCount = this.parseNumber(subscriberText);
    }

    return {
      name,
      description,
      username,
      subscriberCount,
      verified: $('.verified').length > 0,
      photoUrl: undefined as string | undefined
    };
  }

  private parseNumber(text: string): number {
    // Remove all non-numeric characters except K, M
    const cleaned = text.replace(/[^\d.KM]/gi, '');
    
    if (cleaned.includes('K')) {
      return Math.round(parseFloat(cleaned.replace('K', '')) * 1000);
    } else if (cleaned.includes('M')) {
      return Math.round(parseFloat(cleaned.replace('M', '')) * 1000000);
    }
    
    return parseInt(cleaned) || 0;
  }
}