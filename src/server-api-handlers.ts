// API handlers for server.ts - add these to your TelegramMCPServer class

import { TelegramApiScraper } from './api/api-scraper.js';
import { TelegramApiConfig } from './api/telegram-config.js';

export const apiHandlers = {
  async handleApiLogin(this: any, args: any): Promise<any> {
    try {
      // Get API credentials from environment or args
      const apiId = parseInt(process.env.TELEGRAM_API_ID || args.api_id || '0');
      const apiHash = process.env.TELEGRAM_API_HASH || args.api_hash || '';
      
      if (!apiId || !apiHash) {
        return {
          content: [{
            type: 'text',
            text: `❌ API credentials not provided.

Please either:
1. Set environment variables TELEGRAM_API_ID and TELEGRAM_API_HASH
2. Pass api_id and api_hash as parameters
3. See API_SETUP.md for instructions on getting your API credentials from https://my.telegram.org`
          }]
        };
      }
      
      const config: TelegramApiConfig = { apiId, apiHash };
      const scraper = new TelegramApiScraper(config);
      
      await scraper.initialize();
      
      // Store the scraper instance for reuse
      this._apiScraper = scraper;
      
      return {
        content: [{
          type: 'text',
          text: `✅ Successfully authenticated with Telegram API!

You can now use the API-based tools:
- api_scrape_channel - Fast channel scraping
- api_search_channel - Search within channels
- api_get_channel_info - Get channel details

Your session has been saved for future use.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ API authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
- Your API credentials are correct
- Your phone number includes country code (e.g., +1234567890)
- You entered the verification code correctly`
        }]
      };
    }
  },

  async handleApiScrapeChannel(this: any, args: any): Promise<any> {
    if (!this._apiScraper || !this._apiScraper.isConnected()) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not connected to Telegram API. Please use telegram_api_login first.'
        }]
      };
    }
    
    try {
      const options = {
        url: args.url || args.channel,
        maxPosts: args.max_posts !== undefined ? args.max_posts : (args.limit !== undefined ? args.limit : 0),
        dateFrom: args.date_from ? new Date(args.date_from) : undefined,
        dateTo: args.date_to ? new Date(args.date_to) : undefined
      };
      
      const result = await this._apiScraper.scrape(options);
      
      if (result.error) {
        return {
          content: [{
            type: 'text',
            text: `❌ Scraping failed: ${result.error}`
          }]
        };
      }
      
      // Check if we have a large amount of data
      const postCount = result.posts?.length || 0;
      const isLargeData = postCount > 50;
      
      if (isLargeData) {
        // Save to file to avoid Claude's limits
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const timestampParts = new Date().toISOString().split('.');
        const timestamp = (timestampParts[0] || '').replace(/:/g, '-');
        const urlParts = (args.url || args.channel || '').split('/');
        const channelName = urlParts.pop() || 'unknown';
        const filename = `${channelName}_${timestamp}_api.json`;
        const filepath = path.join('scraped_data', filename);
        
        await fs.mkdir('scraped_data', { recursive: true });
        await fs.writeFile(filepath, JSON.stringify(result, null, 2));
        
        // Return summary instead of full data
        const summary = {
          channel: result.channel_name,
          total_posts: postCount,
          date_range: postCount > 0 ? {
            first: result.posts[postCount - 1].date,
            last: result.posts[0].date
          } : null,
          saved_to_file: filename,
          sample_posts: result.posts?.slice(0, 5) || []
        };
        
        return {
          content: [{
            type: 'text',
            text: `📊 Channel Summary (${postCount} posts - Full data saved to file)\n\n` +
              `Channel: ${summary.channel}\n` +
              `Total posts: ${summary.total_posts}\n` +
              `Date range: ${summary.date_range ? `${new Date(summary.date_range.first).toLocaleDateString()} - ${new Date(summary.date_range.last).toLocaleDateString()}` : 'N/A'}\n` +
              `\n💾 Full data saved to: scraped_data/${filename}\n\n` +
              `Sample of first 5 posts:\n` +
              summary.sample_posts.map((p: any) => `\n📅 ${new Date(p.date).toLocaleDateString()}\n${p.content?.substring(0, 100)}...\n👁 ${p.views || 0} views`).join('\n---\n') +
              `\n\n✅ To analyze all posts, use the saved JSON file.`
          }]
        };
      } else {
        // Small data - return as usual
        const formatter = new (await import('./formatters/markdown-formatter.js')).MarkdownFormatter();
        const markdown = formatter.format(result);
        
        return {
          content: [{
            type: 'text',
            text: `${markdown}\n\n✅ Scraped using Telegram API - Fast and reliable!`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ API scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  },

  async handleApiSearchChannel(this: any, args: any): Promise<any> {
    if (!this._apiScraper || !this._apiScraper.isConnected()) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not connected to Telegram API. Please use telegram_api_login first.'
        }]
      };
    }
    
    try {
      const channelUrl = args.url || args.channel;
      const query = args.query || args.search || '';
      const limit = args.limit || 1000;
      
      if (!query) {
        return {
          content: [{
            type: 'text',
            text: '❌ Please provide a search query'
          }]
        };
      }
      
      const result = await this._apiScraper.search(channelUrl, query, limit);
      
      const formatter = new (await import('./formatters/markdown-formatter.js')).MarkdownFormatter();
      const markdown = formatter.format(result);
      
      return {
        content: [{
          type: 'text',
          text: `# Search Results for "${query}"\n\n${markdown}\n\n✅ Searched using Telegram API`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  },

  async handleApiGetChannelInfo(this: any, args: any): Promise<any> {
    if (!this._apiScraper || !this._apiScraper.isConnected()) {
      return {
        content: [{
          type: 'text',
          text: '❌ Not connected to Telegram API. Please use telegram_api_login first.'
        }]
      };
    }
    
    try {
      const channelUrl = args.url || args.channel;
      const channelUsername = channelUrl.match(/(?:t\.me\/|@)([^/?]+)/)?.[1];
      
      if (!channelUsername) {
        return {
          content: [{
            type: 'text',
            text: '❌ Invalid channel URL or username'
          }]
        };
      }
      
      const client = (this._apiScraper as any).client;
      const info = await client.getChannelInfo(channelUsername);
      
      return {
        content: [{
          type: 'text',
          text: `# Channel Information

**Name:** ${info.title}
**Username:** @${info.username}
**Type:** ${info.about}
**Members:** ${info.participantsCount?.toLocaleString() || 'N/A'}
**ID:** ${info.id}

✅ Retrieved using Telegram API`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get channel info: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  },

  async handleApiLogout(this: any): Promise<any> {
    if (this._apiScraper) {
      await this._apiScraper.disconnect();
      this._apiScraper = null;
    }
    
    return {
      content: [{
        type: 'text',
        text: '✅ Disconnected from Telegram API'
      }]
    };
  }
};