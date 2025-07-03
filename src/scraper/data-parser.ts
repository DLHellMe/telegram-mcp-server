import * as cheerio from 'cheerio';
import { parseISO } from 'date-fns';
import { TelegramChannel, TelegramPost, TelegramReaction, MediaType } from '../types/telegram.types.js';
import { logger } from '../utils/logger.js';

export class DataParser {
  private $: cheerio.Root;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  parseChannelInfo(): TelegramChannel {
    logger.debug('Parsing channel info');
    
    // Try multiple selectors for embedded view
    let name = this.$('.tgme_page_title').text().trim() || 
               this.$('.tgme_channel_info_header_title').text().trim() ||
               this.$('.tgme_header_title').text().trim() ||
               'Unknown Channel';
    
    const description = this.$('.tgme_page_description').text().trim() ||
                       this.$('.tgme_channel_info_description').text().trim();
    
    const username = this.extractUsername();
    
    // If name is still unknown, use username
    if (name === 'Unknown Channel' && username !== 'unknown') {
      name = username;
    }
    
    const subscriberCount = this.parseSubscriberCount();
    const photoUrl = this.$('.tgme_page_photo_image img').attr('src') ||
                    this.$('.tgme_channel_info_header_photo img').attr('src');
    const verified = this.$('.verified-icon, .tgme_channel_info_header_verified').length > 0;

    return {
      name,
      description,
      username,
      subscriberCount,
      photoUrl,
      verified
    };
  }

  parsePosts(): TelegramPost[] {
    logger.debug('Parsing posts');
    const posts: TelegramPost[] = [];

    // Check if this is authenticated Telegram Web interface
    const isAuthenticatedView = this.$('.bubbles, .messages-container, .bubble').length > 0;
    
    if (isAuthenticatedView) {
      logger.debug('Detected authenticated Telegram Web interface');
      // Parse authenticated Telegram Web messages - be more specific with selectors
      this.$('.message.spoilers-container, .bubble:has(.bubble-content), .message:has(.message-content-wrapper)').each((_, element) => {
        try {
          const post = this.parseAuthenticatedPost(this.$(element));
          if (post && post.content && !this.isUIElement(post.content)) {
            posts.push(post);
          }
        } catch (error) {
          logger.error('Error parsing authenticated post:', error);
        }
      });
    } else {
      // Try both widget and regular message selectors for embedded view
      this.$('.tgme_widget_message, .tgme_channel_history .message').each((_, element) => {
        try {
          const post = this.parsePost(this.$(element));
          if (post) {
            posts.push(post);
          }
        } catch (error) {
          logger.error('Error parsing post:', error);
        }
      });
    }

    return posts;
  }

  private parsePost(element: cheerio.Cheerio): TelegramPost | null {
    // Try to get ID from data-post or href
    let id = element.attr('data-post') || '';
    if (!id) {
      // Try finding link with post number
      const link = element.find('a.tgme_widget_message_date, .js-message_date').attr('href') || 
                   element.find('a[href*="/getrichortech/"]').attr('href') || '';
      const match = link.match(/\/(\d+)$/);
      id = match?.[1] || '';
    }
    
    // If still no ID, try to extract from any element with post number
    if (!id) {
      const postLink = element.find('a[href*="/getrichortech/"]').attr('href') || '';
      const postMatch = postLink.match(/getrichortech\/(\d+)/);
      if (postMatch && postMatch[1]) {
        id = `getrichortech/${postMatch[1]}`;
      }
    }
    
    if (!id) return null;

    // Try multiple date selectors
    let dateStr = element.find('.tgme_widget_message_date time').attr('datetime') || '';
    if (!dateStr) {
      dateStr = element.find('time').attr('datetime') || '';
    }
    const date = dateStr ? parseISO(dateStr) : new Date();
    
    const content = this.extractPostContent(element);
    // Parse views - in embedded view, views are shown with 'K' suffix
    let viewsText = element.find('.tgme_widget_message_info span:contains("K"), .tgme_widget_message_info span:contains("M")').text() ||
                    element.find('.js-message_views').text() ||
                    element.find('.tgme_widget_message_views').text() ||
                    '';
    
    let views = 0;
    if (viewsText) {
      // Handle K (thousands) and M (millions)
      if (viewsText.includes('K')) {
        views = Math.round(parseFloat(viewsText.replace('K', '')) * 1000);
      } else if (viewsText.includes('M')) {
        views = Math.round(parseFloat(viewsText.replace('M', '')) * 1000000);
      } else {
        views = this.parseNumber(viewsText);
      }
    }
    const channelName = element.find('.tgme_widget_message_owner_name').text().trim();
    
    const reactions = this.parseReactions(element);
    const hasMedia = element.find('.tgme_widget_message_photo, .tgme_widget_message_video').length > 0;
    const mediaTypes = this.detectMediaTypes(element);

    return {
      id,
      date,
      content,
      views,
      reactions,
      hasMedia,
      mediaTypes,
      channelName
    };
  }

  private extractPostContent(element: cheerio.Cheerio): string {
    // Try multiple selectors for message text
    let textElement = element.find('.tgme_widget_message_text');
    if (!textElement.length) {
      textElement = element.find('.js-message_text');
    }
    if (!textElement.length) {
      textElement = element.find('.message_text');
    }
    
    // If still no text element, check if it's a media-only post
    if (!textElement.length) {
      // Check for restricted content
      const restrictedText = element.find('.tgme_widget_message_error').text().trim();
      if (restrictedText && restrictedText.includes('Telegram')) {
        // This is a restricted post
        const mediaTypes = this.detectMediaTypes(element);
        if (mediaTypes.length > 0) {
          return `[Restricted content: ${mediaTypes.join(', ')} - Please open Telegram to view]`;
        } else {
          return `[Restricted content: Please open Telegram to view this post]`;
        }
      }
      
      // Check for sensitive content warning
      const sensitiveWarning = element.find('.tgme_widget_message_sensitive').text().trim();
      if (sensitiveWarning) {
        return `[Sensitive content: ${sensitiveWarning}]`;
      }
      
      // Check for media captions
      textElement = element.find('.tgme_widget_message_photo_caption, .tgme_widget_message_video_caption');
      
      if (!textElement.length) {
        // It might be a forwarded message or special type
        const forwardedFrom = element.find('.tgme_widget_message_forwarded_from').text().trim();
        const mediaTypes = this.detectMediaTypes(element);
        
        if (forwardedFrom) {
          return `[Forwarded from ${forwardedFrom}]`;
        } else if (mediaTypes.length > 0) {
          return `[Media only: ${mediaTypes.join(', ')}]`;
        } else {
          // Try to get any text content from the message bubble
          const anyText = element.find('.tgme_widget_message_bubble').text().trim();
          return anyText || '[Empty post]';
        }
      }
    }
    
    // Clone the element to avoid modifying the original
    const clonedElement = textElement.clone();
    
    // Convert br tags to newlines
    clonedElement.find('br').replaceWith('\n');
    
    // Handle code blocks
    clonedElement.find('pre').each((_, pre) => {
      const code = this.$(pre).text();
      this.$(pre).replaceWith(`\n\`\`\`\n${code}\n\`\`\`\n`);
    });
    
    // Handle inline code
    clonedElement.find('code').each((_, code) => {
      const text = this.$(code).text();
      this.$(code).replaceWith(`\`${text}\``);
    });
    
    // Extract text content
    let content = clonedElement.text().trim();
    
    // Preserve links with markdown format
    textElement.find('a').each((_, link) => {
      const href = this.$(link).attr('href');
      const text = this.$(link).text().trim();
      if (href && text && content.includes(text)) {
        // Only replace if it's not already a markdown link
        if (!content.includes(`[${text}](${href})`)) {
          content = content.replace(text, `[${text}](${href})`);
        }
      }
    });
    
    // Handle emojis and special characters properly
    content = content.replace(/\u00A0/g, ' '); // Replace non-breaking spaces
    
    return content || '[No text content]';
  }

  private parseReactions(element: cheerio.Cheerio): TelegramReaction[] {
    const reactions: TelegramReaction[] = [];
    
    // In embedded view, reactions are in a different format
    element.find('.js-message_reaction, .tgme_widget_message_reaction').each((_, item) => {
      const reactionElement = this.$(item);
      const fullText = reactionElement.text().trim();
      
      // Extract emoji and count from format like "🔥 234"
      const match = fullText.match(/^([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|.)\s*(\d+(?:\.\d+)?[KM]?)?/u);
      
      if (match) {
        const emoji = match[1];
        let count = 0;
        
        if (match[2]) {
          const countText = match[2];
          if (countText.includes('K')) {
            count = Math.round(parseFloat(countText.replace('K', '')) * 1000);
          } else if (countText.includes('M')) {
            count = Math.round(parseFloat(countText.replace('M', '')) * 1000000);
          } else {
            count = parseInt(countText) || 0;
          }
        }
        
        if (emoji && count > 0) {
          reactions.push({ emoji, count });
        }
      }
    });

    return reactions;
  }

  private detectMediaTypes(element: cheerio.Cheerio): MediaType[] {
    const types: MediaType[] = [];
    
    if (element.find('.tgme_widget_message_photo').length > 0) types.push('photo');
    if (element.find('.tgme_widget_message_video').length > 0) types.push('video');
    if (element.find('.tgme_widget_message_voice').length > 0) types.push('audio');
    if (element.find('.tgme_widget_message_document').length > 0) types.push('document');
    if (element.find('.tgme_widget_message_poll').length > 0) types.push('poll');
    if (element.find('.tgme_widget_message_location').length > 0) types.push('location');
    
    return types;
  }

  private parseSubscriberCount(): number | undefined {
    // Try multiple selectors
    let text = this.$('.tgme_page_extra').text() ||
               this.$('.tgme_channel_info_counters').text() ||
               this.$('.tgme_header_counter').text();
    
    // Look for patterns like "1.2K subscribers" or "5M members"
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KM])?\s*(subscribers?|members?|участник)/i);
    
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      const multiplier = match[2];
      
      if (multiplier === 'K') {
        return Math.round(num * 1000);
      } else if (multiplier === 'M') {
        return Math.round(num * 1000000);
      } else {
        return Math.round(num);
      }
    }
    
    return undefined;
  }

  private parseNumber(text: string | undefined): number {
    if (!text) return 0;
    const cleaned = text.replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  }

  private extractUsername(): string {
    // Try multiple methods to extract username
    
    // Method 1: From og:url meta tag
    const ogUrl = this.$('meta[property="og:url"]').attr('content') || '';
    let match = ogUrl.match(/t\.me\/s?\/([^/?]+)/);
    if (match?.[1]) {
      return match[1];
    }
    
    // Method 2: From page URL in window location (if available)
    const scripts = this.$('script').text();
    const urlMatch = scripts.match(/window\.location\.href.*?t\.me\/s?\/([^/?'"]+)/);
    if (urlMatch?.[1]) {
      return urlMatch[1];
    }
    
    // Method 3: From any link containing the channel URL
    const channelLinks = this.$('a[href*="t.me"]');
    for (let i = 0; i < channelLinks.length; i++) {
      const href = this.$(channelLinks[i]).attr('href') || '';
      const linkMatch = href.match(/t\.me\/s?\/([^/?]+)/);
      if (linkMatch?.[1] && linkMatch[1] !== 's') {
        return linkMatch[1];
      }
    }
    
    // Method 4: From channel header link
    const headerLink = this.$('.tgme_channel_info_header_username').text().trim();
    if (headerLink && headerLink.startsWith('@')) {
      return headerLink.substring(1);
    }
    
    return 'unknown';
  }

  private isUIElement(content: string): boolean {
    // Filter out common UI elements
    const uiPatterns = [
      /^Mark all as read$/i,
      /^New Channel.*New Group.*New Message$/i,
      /^All Chats.*Private Chats.*Group Chats.*Channels$/i,
      /Add Account.*Saved Messages.*Contacts/i,
      /Telegram Web.*Version/i,
      /^Popular.*Emoji.*Add\+/i,
      /Install App.*Switch to.*Version/i,
      /Night Mode.*animations.*Telegram Features/i,
      /^[A-Z]{3,}[A-Z]{3,}/  // Long sequences of uppercase letters (UI codes)
    ];
    
    return uiPatterns.some(pattern => pattern.test(content));
  }

  private parseAuthenticatedPost(element: cheerio.Cheerio): TelegramPost | null {
    // Parse messages from authenticated Telegram Web interface
    // Try multiple attributes for message ID
    const msgId = element.attr('data-msg-id') || 
                  element.attr('data-message-id') || 
                  element.attr('data-mid') ||
                  element.find('.message').attr('data-mid') ||
                  '';
    
    const msgTimestamp = element.attr('data-timestamp') || element.find('.message').attr('data-timestamp');
    
    // Generate ID if not found
    let id = msgId;
    if (!id) {
      // Generate a unique ID
      id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Extract message content - Telegram Web uses different structure
    let content = '';
    
    // Try multiple selectors for message text, being more specific
    const textSelectors = [
      '.message-content-wrapper .text-content',
      '.bubble-content .message',
      '.bubble-content-wrapper .text',
      '.message-content .text',
      '.spoilers-container .text-content',
      '.bubble-content > span',
      '.message-text'
    ];
    
    for (const selector of textSelectors) {
      const textElement = element.find(selector);
      if (textElement.length > 0) {
        // Get the actual text, not including nested UI elements
        const text = textElement.clone().children().remove().end().text().trim();
        if (text && text.length > 0) {
          content = text;
          break;
        }
      }
    }
    
    // If still no content, try to get from data attributes or specific message elements
    if (!content) {
      const messageText = element.find('[data-message-text]').text().trim();
      if (messageText) {
        content = messageText;
      }
    }
    
    if (!content) {
      // Skip elements that are likely UI components
      return null;
    }
    
    // Parse date from timestamp or time element
    let date: Date;
    if (msgTimestamp) {
      date = new Date(parseInt(msgTimestamp) * 1000);
    } else {
      const timeElement = element.find('.time, .message-time, .bubble-time');
      const dateStr = timeElement.attr('datetime') || timeElement.attr('title') || timeElement.text();
      date = dateStr ? new Date(dateStr) : new Date();
    }
    
    // Views are typically shown in channel messages
    const viewsElement = element.find('.views, .message-views, .post-views');
    const viewsText = viewsElement.text().trim();
    let views = 0;
    if (viewsText) {
      if (viewsText.includes('K')) {
        views = Math.round(parseFloat(viewsText.replace('K', '')) * 1000);
      } else if (viewsText.includes('M')) {
        views = Math.round(parseFloat(viewsText.replace('M', '')) * 1000000);
      } else {
        views = this.parseNumber(viewsText);
      }
    }
    
    // Parse reactions from authenticated view
    const reactions: TelegramReaction[] = [];
    element.find('.reaction, .reactions-item, .message-reaction').each((_, item) => {
      const reactionEl = this.$(item);
      const emoji = reactionEl.find('.reaction-emoji, .emoji').text().trim() || 
                   reactionEl.text().match(/^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u)?.[0];
      const countText = reactionEl.find('.reaction-count, .count').text() || reactionEl.text();
      const count = this.parseNumber(countText);
      if (emoji && count > 0) {
        reactions.push({ emoji, count });
      }
    });
    
    // Detect media
    const hasMedia = element.find('.media, .photo, .video, .document, .attachment').length > 0;
    const mediaTypes: MediaType[] = [];
    if (element.find('.photo, .media-photo, img.media').length > 0) mediaTypes.push('photo');
    if (element.find('.video, .media-video, video').length > 0) mediaTypes.push('video');
    if (element.find('.document, .media-document, .file').length > 0) mediaTypes.push('document');
    if (element.find('.audio, .voice').length > 0) mediaTypes.push('audio');
    
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
}