import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { TelegramScraper } from './scraper/telegram-scraper.js';
import { MarkdownFormatter } from './formatters/markdown-formatter.js';
import { ScrapeOptions } from './types/telegram.types.js';
import { logger, LogLevel } from './utils/logger.js';
import { config } from './utils/config.js';
import { parseISO } from 'date-fns';
import { TelegramAuth } from './auth/telegram-auth.js';
import { apiHandlers } from './server-api-handlers.js';

export class TelegramMCPServer {
  private server: Server;
  private scraper: TelegramScraper;
  private authScraper: TelegramScraper;
  private formatter: MarkdownFormatter;
  private auth: TelegramAuth;

  constructor() {
    this.server = new Server(
      {
        name: config.server.name,
        version: config.server.version
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.scraper = new TelegramScraper(false); // Unauthenticated scraper
    this.authScraper = new TelegramScraper(true); // Authenticated scraper
    this.formatter = new MarkdownFormatter();
    this.auth = new TelegramAuth();

    this.setupHandlers();
    this.setupLogLevel();
  }

  private setupLogLevel(): void {
    const level = config.debug.logLevel.toUpperCase();
    if (level in LogLevel) {
      logger.setLevel(LogLevel[level as keyof typeof LogLevel]);
    }
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools()
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'scrape_channel':
            return await this.handleScrapeChannel(args);
          
          case 'scrape_channel_full':
            return await this.handleScrapeChannelFull(args);
          
          case 'scrape_group':
            return await this.handleScrapeGroup(args);
          
          case 'get_channel_info':
            return await this.handleGetChannelInfo(args);
          
          case 'scrape_date_range':
            return await this.handleScrapeDateRange(args);
          
          case 'telegram_login':
            return await this.handleTelegramLogin(args);
          
          case 'telegram_logout':
            return await this.handleTelegramLogout();
          
          case 'telegram_auth_status':
            return await this.handleAuthStatus();
          
          case 'scrape_channel_authenticated':
            return await this.handleScrapeChannelAuthenticated(args);
          
          case 'scrape_manual':
            return await this.handleManualScrape(args);
          
          case 'telegram_api_login':
            return await this.handleApiLogin(args);
          
          case 'api_scrape_channel':
            return await this.handleApiScrapeChannel(args);
          
          case 'api_search_channel':
            return await this.handleApiSearchChannel(args);
          
          case 'api_get_channel_info':
            return await this.handleApiGetChannelInfo(args);
          
          case 'api_logout':
            return await this.handleApiLogout();
          
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, error);
        throw error;
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'scrape_channel',
        description: 'Scrape a Telegram channel and return posts in markdown format. Uses authenticated session if logged in.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL (e.g., https://t.me/channelname)'
            },
            max_posts: {
              type: 'number',
              description: 'Maximum number of posts to scrape (default: 100)',
              default: 100
            },
            include_reactions: {
              type: 'boolean',
              description: 'Include reaction data in the output',
              default: true
            }
          },
          required: ['url']
        }
      },
      {
        name: 'scrape_channel_full',
        description: 'Scrape ALL posts from a Telegram channel and save to file. Uses authenticated session if logged in. Returns file location.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL (e.g., https://t.me/channelname)'
            },
            save_to_file: {
              type: 'boolean',
              description: 'Save results to MD and JSON files',
              default: true
            }
          },
          required: ['url']
        }
      },
      {
        name: 'scrape_group',
        description: 'Scrape a Telegram group and return posts in markdown format. Uses authenticated session if logged in.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram group URL (e.g., https://t.me/groupname)'
            },
            max_posts: {
              type: 'number',
              description: 'Maximum number of posts to scrape (default: 100)',
              default: 100
            }
          },
          required: ['url']
        }
      },
      {
        name: 'get_channel_info',
        description: 'Get only the channel/group information without scraping posts. Uses authenticated session if logged in.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel/group URL'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'scrape_date_range',
        description: 'Scrape posts within a specific date range. Uses authenticated session if logged in.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel/group URL'
            },
            date_from: {
              type: 'string',
              description: 'Start date in ISO format (e.g., 2024-01-01)'
            },
            date_to: {
              type: 'string',
              description: 'End date in ISO format (e.g., 2024-01-31)'
            }
          },
          required: ['url', 'date_from']
        }
      },
      {
        name: 'telegram_login',
        description: 'Authenticate with Telegram Web to access restricted content',
        inputSchema: {
          type: 'object',
          properties: {
            phone_number: {
              type: 'string',
              description: 'Phone number in international format (optional, for automated login)'
            }
          },
          required: []
        }
      },
      {
        name: 'telegram_logout',
        description: 'Clear Telegram authentication cookies',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'telegram_auth_status',
        description: 'Check if authenticated with Telegram',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'scrape_channel_authenticated',
        description: 'Scrape a Telegram channel using authenticated session (can access restricted content)',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL (e.g., https://t.me/channelname)'
            },
            max_posts: {
              type: 'number',
              description: 'Maximum number of posts to scrape (default: 100)',
              default: 100
            }
          },
          required: ['url']
        }
      },
      {
        name: 'scrape_manual',
        description: 'Manual scraping mode: Opens browser for you to login and navigate to any channel, then scrapes it',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of posts to scrape (optional)'
            },
            save_to_file: {
              type: 'boolean',
              description: 'Save results to MD and JSON files',
              default: true
            }
          },
          required: []
        }
      },
      {
        name: 'telegram_api_login',
        description: 'Login to Telegram using API credentials for fast, efficient scraping',
        inputSchema: {
          type: 'object',
          properties: {
            api_id: {
              type: 'string',
              description: 'Your Telegram API ID (get from https://my.telegram.org)'
            },
            api_hash: {
              type: 'string',
              description: 'Your Telegram API Hash'
            }
          },
          required: []
        }
      },
      {
        name: 'api_scrape_channel',
        description: 'Scrape a Telegram channel using the API (fast and efficient)',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL (e.g., https://t.me/channelname)'
            },
            max_posts: {
              type: 'number',
              description: 'Maximum number of posts to scrape (0 for unlimited)',
              default: 0
            },
            date_from: {
              type: 'string',
              description: 'Start date in ISO format (optional)'
            },
            date_to: {
              type: 'string',
              description: 'End date in ISO format (optional)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'api_search_channel',
        description: 'Search for messages within a Telegram channel',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL'
            },
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 50
            }
          },
          required: ['url', 'query']
        }
      },
      {
        name: 'api_get_channel_info',
        description: 'Get detailed information about a Telegram channel using the API',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The Telegram channel URL'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'api_logout',
        description: 'Disconnect from Telegram API',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  private async handleScrapeChannel(args: any): Promise<any> {
    // Check if authenticated and use authenticated scraper by default
    const isAuthenticated = await this.auth.isAuthenticated();
    const scraperToUse = isAuthenticated ? this.authScraper : this.scraper;
    
    if (isAuthenticated) {
      logger.info('Using authenticated scraper (logged in)');
    } else {
      logger.info('Using unauthenticated scraper (not logged in)');
    }

    const options: ScrapeOptions = {
      url: args.url,
      maxPosts: args.max_posts === undefined ? 0 : args.max_posts, // 0 means no limit
      includeReactions: args.include_reactions !== false
    };

    const result = await scraperToUse.scrape(options);
    const markdown = this.formatter.format(result);

    return {
      content: [
        {
          type: 'text',
          text: isAuthenticated 
            ? `${markdown}\n\n✅ *Scraped using authenticated session*`
            : markdown
        }
      ]
    };
  }

  private async handleScrapeGroup(args: any): Promise<any> {
    // Groups are handled the same way as channels
    return this.handleScrapeChannel(args);
  }

  private async handleGetChannelInfo(args: any): Promise<any> {
    // Check if authenticated and use authenticated scraper by default
    const isAuthenticated = await this.auth.isAuthenticated();
    const scraperToUse = isAuthenticated ? this.authScraper : this.scraper;

    const options: ScrapeOptions = {
      url: args.url,
      maxPosts: 0 // Don't scrape posts
    };

    const result = await scraperToUse.scrape(options);
    
    const info = `# Channel Information

**Name:** ${result.channel.name}${result.channel.verified ? ' ✓' : ''}
**Username:** @${result.channel.username}
${result.channel.description ? `**Description:** ${result.channel.description}` : ''}
${result.channel.subscriberCount ? `**Subscribers:** ${result.channel.subscriberCount.toLocaleString()}` : ''}

*Scraped at: ${result.scrapedAt.toISOString()}*`;

    return {
      content: [
        {
          type: 'text',
          text: info
        }
      ]
    };
  }

  private async handleScrapeDateRange(args: any): Promise<any> {
    // Check if authenticated and use authenticated scraper by default
    const isAuthenticated = await this.auth.isAuthenticated();
    const scraperToUse = isAuthenticated ? this.authScraper : this.scraper;

    const options: ScrapeOptions = {
      url: args.url,
      dateFrom: parseISO(args.date_from),
      dateTo: args.date_to ? parseISO(args.date_to) : new Date(),
      includeReactions: true
    };

    const result = await scraperToUse.scrape(options);
    const markdown = this.formatter.format(result);

    return {
      content: [
        {
          type: 'text',
          text: markdown
        }
      ]
    };
  }

  private async handleScrapeChannelFull(args: any): Promise<any> {
    // Check if authenticated and use authenticated scraper by default
    const isAuthenticated = await this.auth.isAuthenticated();
    const scraperToUse = isAuthenticated ? this.authScraper : this.scraper;
    
    if (isAuthenticated) {
      logger.info('Using authenticated scraper for full channel scrape (logged in)');
    } else {
      logger.info('Using unauthenticated scraper for full channel scrape (not logged in)');
    }

    const options: ScrapeOptions = {
      url: args.url,
      maxPosts: 0, // No limit - get ALL posts
      includeReactions: true
    };

    const result = await scraperToUse.scrape(options);
    
    // The scraper already saves to file, so we just need to inform about it
    const channelName = result.channel.username;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const windowsPath = `C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data\\${channelName}_${timestamp}_full.md`;
    
    // Also return a sample of the content for immediate analysis
    const samplePosts = result.posts.slice(0, 5); // First 5 posts as sample
    const sampleResult = { ...result, posts: samplePosts };
    const sampleMarkdown = this.formatter.format(sampleResult);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully scraped ${result.totalPosts} posts from @${channelName}

Files saved to:
- Markdown: ${windowsPath}
- JSON: ${windowsPath.replace('.md', '.json')}

Total posts: ${result.totalPosts}
Date range: ${result.posts.length > 0 ? `${result.posts[result.posts.length - 1]?.date.toISOString().split('T')[0]} to ${result.posts[0]?.date.toISOString().split('T')[0]}` : 'N/A'}

The full channel history has been saved. Here's a sample of the first 5 posts:

${sampleMarkdown}

To analyze all ${result.totalPosts} posts, open the saved markdown file and copy its contents to Claude.

${isAuthenticated ? '✅ Scraped using authenticated session - all content including restricted posts should be accessible.' : '⚠️ Scraped without authentication - some restricted content may not be accessible.'}`
        }
      ]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Telegram MCP Server started');
  }

  async shutdown(): Promise<void> {
    await this.scraper.close();
    await this.authScraper.close();
    logger.info('Server shutdown complete');
  }

  private async handleTelegramLogin(args: any): Promise<any> {
    const phoneNumber = args.phone_number;
    
    try {
      const success = await this.auth.login(phoneNumber);
      
      if (success) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Successfully authenticated with Telegram!

You can now use the authenticated scraping tools to access restricted content.

Use 'scrape_channel_authenticated' to scrape channels with full access.`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Authentication failed. Please try again.

Make sure to:
1. Complete the login process in the browser window
2. Enter the verification code if prompted
3. Allow sufficient time for the login to complete`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}

Please check:
- Chrome is installed and accessible
- You have a stable internet connection
- The phone number is in international format (if provided)`
          }
        ]
      };
    }
  }

  private async handleTelegramLogout(): Promise<any> {
    await this.auth.logout();
    
    return {
      content: [
        {
          type: 'text',
          text: '✅ Successfully logged out from Telegram. Authentication cookies have been cleared.'
        }
      ]
    };
  }

  private async handleAuthStatus(): Promise<any> {
    const isAuthenticated = await this.auth.isAuthenticated();
    
    return {
      content: [
        {
          type: 'text',
          text: isAuthenticated 
            ? '✅ Authenticated with Telegram. You can access restricted content.'
            : '❌ Not authenticated. Use telegram_login to authenticate.'
        }
      ]
    };
  }

  private async handleScrapeChannelAuthenticated(args: any): Promise<any> {
    // Check authentication first
    const isAuthenticated = await this.auth.isAuthenticated();
    if (!isAuthenticated) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Not authenticated. Please use telegram_login first to access restricted content.'
          }
        ]
      };
    }

    const options: ScrapeOptions = {
      url: args.url,
      maxPosts: args.max_posts || 100,
      includeReactions: true
    };

    try {
      const result = await this.authScraper.scrape(options);
      const markdown = this.formatter.format(result);

      return {
        content: [
          {
            type: 'text',
            text: `# Authenticated Scrape Results

${markdown}

✅ Scraped using authenticated session - restricted content should be accessible.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Authenticated scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}

This might happen if:
- The authentication session expired
- The channel requires additional permissions
- There was a network error

Try running telegram_login again if the problem persists.`
          }
        ]
      };
    }
  }

  private async handleManualScrape(args: any): Promise<any> {
    try {
      logger.info('Starting manual scrape mode...');
      
      // Import manual scraper and required modules
      const { ManualTelegramScraper } = await import('./scraper/manual-scraper.js');
      const { join } = await import('path');
      const { writeFile, mkdir } = await import('fs/promises');
      
      const manualScraper = new ManualTelegramScraper();
      
      // Open browser and wait for user to navigate
      const { browser, page } = await manualScraper.loginAndWaitForChannel();
      
      // Scrape the current channel
      const options = {
        maxPosts: args.limit || args.max_posts || 0
      };
      
      const result = await manualScraper.scrapeCurrentChannel(page, options);
      
      // Save to file
      if (args.save_to_file !== false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `${result.channel.username}_${timestamp}_manual.md`;
        
        const formatter = new MarkdownFormatter();
        const markdown = formatter.format(result);
        
        const basePath = 'C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data';
        const filepath = join(basePath, filename);
        
        await mkdir(basePath, { recursive: true });
        await writeFile(filepath, markdown, 'utf8');
        
        // Also save JSON
        const jsonFilename = `${result.channel.username}_${timestamp}_manual.json`;
        const jsonFilepath = join(basePath, jsonFilename);
        await writeFile(jsonFilepath, JSON.stringify(result, null, 2), 'utf8');
        
        logger.info(`Saved to: ${filepath}`);
      }
      
      // Close browser
      await manualScraper.close(browser);
      
      // Format response
      const summary = result.posts.slice(0, 5).map(post => ({
        date: post.date.toISOString(),
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        views: post.views
      }));
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully scraped ${result.posts.length} posts from ${result.channel.name}

Channel: @${result.channel.username}
Total posts scraped: ${result.posts.length}

${args.save_to_file !== false ? `Files saved to:
- Markdown: C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data\\${result.channel.username}_*_manual.md
- JSON: C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data\\${result.channel.username}_*_manual.json

` : ''}Sample of first 5 posts:
${summary.map(post => `\n📅 ${post.date}\n${post.content}\n👁 ${post.views} views`).join('\n---\n')}`
          }
        ]
      };
      
    } catch (error) {
      logger.error('Manual scrape failed:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Manual scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ]
      };
    }
  }
  // Bind API handlers
  private handleApiLogin = apiHandlers.handleApiLogin.bind(this);
  private handleApiScrapeChannel = apiHandlers.handleApiScrapeChannel.bind(this);
  private handleApiSearchChannel = apiHandlers.handleApiSearchChannel.bind(this);
  private handleApiGetChannelInfo = apiHandlers.handleApiGetChannelInfo.bind(this);
  private handleApiLogout = apiHandlers.handleApiLogout.bind(this);
}