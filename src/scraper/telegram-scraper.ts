import { Page } from 'puppeteer';
import { BrowserManager } from './browser-manager.js';
import { DataParser } from './data-parser.js';
import { ScrapeOptions, ScrapeResult, TelegramPost } from '../types/telegram.types.js';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { MarkdownFormatter } from '../formatters/markdown-formatter.js';
import { CookieManager } from '../auth/cookie-manager.js';

export class TelegramScraper {
  private browserManager: BrowserManager;
  private cookieManager: CookieManager;
  private useAuth: boolean;

  constructor(useAuth: boolean = false) {
    this.browserManager = new BrowserManager();
    this.cookieManager = new CookieManager();
    this.useAuth = useAuth;
  }

  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    logger.info(`Starting scrape for: ${options.url}`);
    
    let page: Page | null = null;
    
    try {
      // Validate URL
      if (!this.isValidTelegramUrl(options.url)) {
        throw new Error('Invalid Telegram URL. Must be a t.me link.');
      }

      // Create page
      page = await this.browserManager.createPage();
      
      // Navigate to channel/group
      await this.navigateToChannel(page, options.url);
      
      // Get channel info BEFORE scrolling
      const channelHtml = await page.content();
      const parser = new DataParser(channelHtml);
      let channel = parser.parseChannelInfo();
      
      // Try to get channel name and username from URL if parsing failed
      const urlMatch = options.url.match(/t\.me\/s?\/([^/?]+)/);
      if (urlMatch && urlMatch[1]) {
        if (channel.username === 'unknown') {
          channel.username = urlMatch[1];
        }
        if (channel.name === 'Unknown Channel') {
          channel.name = urlMatch[1];
        }
      }
      
      // Scroll and collect posts
      const posts = await this.scrollAndCollectPosts(page, options);
      
      // Get total post count from collected posts
      const totalPosts = posts.length;
      
      logger.info(`Scraping complete. Total posts: ${totalPosts}`);
      
      const result = {
        channel,
        posts,
        scrapedAt: new Date(),
        totalPosts
      };
      
      // Save to file
      await this.saveToFile(result, channel.username);
      
      return result;
      
    } catch (error) {
      logger.error('Scraping failed:', error);
      
      // Take screenshot on error
      if (page && config.debug.saveScreenshots) {
        await this.browserManager.screenshot(page, 'error');
      }
      
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
      
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private isValidTelegramUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 't.me' || parsed.hostname === 'telegram.me';
    } catch {
      return false;
    }
  }

  private async navigateToChannel(page: Page, url: string): Promise<void> {
    logger.debug(`Navigating to: ${url}`);
    
    // Extract channel name from URL
    const channelMatch = url.match(/t\.me\/([^/?]+)/);
    const channelName = channelMatch ? channelMatch[1] : '';
    
    // Known channel ID mappings (can be extended)
    const channelIdMap: Record<string, string> = {
      'getrichortech': '-1001751399029',
      // Add more mappings as discovered
    };
    
    // If using authentication, try web.telegram.org first
    if (this.useAuth) {
      try {
        logger.info('Using authenticated mode with Telegram Web');
        
        // Load cookies if available
        const cookiesLoaded = await this.cookieManager.loadCookies(page);
        if (!cookiesLoaded) {
          throw new Error('No authentication cookies found. Please run login first.');
        }
        
        // Try different Telegram Web versions
        const versions = ['a', 'z', 'k'];
        
        for (const version of versions) {
          try {
            logger.debug(`Trying Telegram Web ${version.toUpperCase()} version`);
            await page.goto(`https://web.telegram.org/${version}/`, {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
            
            // Wait for app to load
            await page.waitForSelector('.dialogs-list, .chat-list, #column-left, .chatlist', {
              timeout: 10000
            });
            
            logger.info(`Successfully loaded Telegram Web ${version.toUpperCase()}`);
            break;
          } catch {
            continue;
          }
        }
        
        // Wait a bit for the app to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Use search to find and open the channel
        logger.info(`Searching for channel: ${channelName}`);
        
        // Find and click the search button/input
        // Different selectors for different Telegram Web versions
        const searchSelectors = [
          'input[placeholder*="Search"]',
          'input[placeholder*="search"]',
          '.search-input',
          'input.form-control',
          'input[type="search"]',
          '.input-search input',
          '.search-container input'
        ];
        
        let searchInput = null;
        for (const selector of searchSelectors) {
          try {
            searchInput = await page.$(selector);
            if (searchInput) {
              logger.debug(`Found search input with selector: ${selector}`);
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (!searchInput) {
          // Try clicking search button first
          const searchButtonSelectors = ['.search-button', '.topbar-search', '.header-search'];
          for (const selector of searchButtonSelectors) {
            try {
              await page.click(selector);
              await new Promise(resolve => setTimeout(resolve, 1000));
              break;
            } catch {
              continue;
            }
          }
          
          // Try to find search input again
          for (const selector of searchSelectors) {
            try {
              searchInput = await page.$(selector);
              if (searchInput) break;
            } catch {
              continue;
            }
          }
        }
        
        if (!searchInput) {
          throw new Error('Could not find search input in Telegram Web interface');
        }
        
        // Clear any existing text and type the channel name
        await searchInput.click({ clickCount: 3 });
        if (channelName) {
          await searchInput.type(channelName);
        }
        
        logger.info('Waiting for search results...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Look for the channel in search results and click it
        const channelSelectors = [
          `a[href*="${channelName}"]`,
          `div[data-peer-id="${channelName && channelIdMap[channelName] || ''}"]`,
          `.search-result:has-text("${channelName}")`,
          `.dialog:has-text("${channelName}")`,
          `.chatlist-chat:has-text("${channelName}")`
        ];
        
        let clicked = false;
        for (const selector of channelSelectors) {
          try {
            await page.click(selector);
            clicked = true;
            logger.info(`Clicked on channel using selector: ${selector}`);
            break;
          } catch {
            continue;
          }
        }
        
        if (!clicked) {
          // Try to find and click the first search result
          try {
            await page.click('.search-result:first-child, .dialog:first-child, .chatlist-chat:first-child');
            logger.info('Clicked on first search result');
          } catch {
            throw new Error(`Could not find channel ${channelName} in search results`);
          }
        }
        
        // Wait for messages to load
        logger.info('Waiting for messages to load...');
        await page.waitForSelector('.message, .messages-container, .bubbles, .bubble', {
          timeout: 20000
        });
        
        // Wait a bit more for messages to fully render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to scroll to load some messages
        await page.evaluate(() => {
          const container = document.querySelector('.bubbles-inner, .messages-container');
          if (container) {
            container.scrollTop = container.scrollHeight / 2;
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        logger.info('Successfully loaded channel in authenticated mode');
        return;
        
      } catch (error) {
        logger.error('Authenticated mode failed:', error);
        if (this.useAuth) {
          throw new Error('Authentication required but failed. Please run telegram login first.');
        }
        logger.warn('Falling back to unauthenticated mode...');
      }
    }
    
    // Define URL formats to try for unauthenticated mode
    const urlFormats = [
      {
        name: 'embedded',
        url: url.replace('t.me/', 't.me/s/'),
        selectors: ['.tgme_page_title', '.tgme_channel_info', '.tgme_channel_history']
      },
      {
        name: 'widget',
        url: `https://t.me/${channelName}?embed=1`,
        selectors: ['.tgme_page_title', '.tgme_channel_info']
      },
      {
        name: 'preview',
        url: `https://t.me/${channelName}?preview=1`,
        selectors: ['.tgme_page_title', '.tgme_channel_info']
      }
    ];
    
    let navigationSuccessful = false;
    
    // Try each URL format
    for (const format of urlFormats) {
      try {
        logger.info(`Trying ${format.name} format: ${format.url}`);
        
        await page.goto(format.url, {
          waitUntil: 'networkidle2',
          timeout: config.browser.timeout
        });
        
        // Wait for any of the expected selectors
        await page.waitForSelector(format.selectors.join(', '), {
          timeout: config.scraping.waitForSelector
        });
        
        // Check if we have message content
        const hasMessages = await page.evaluate(() => {
          const messages = document.querySelectorAll('.tgme_widget_message, .message, .tgme_channel_history');
          return messages.length > 0;
        });
        
        if (hasMessages) {
          logger.info(`Successfully loaded with ${format.name} format`);
          navigationSuccessful = true;
          break;
        } else {
          logger.warn(`${format.name} format loaded but no messages found`);
        }
        
      } catch (error) {
        logger.warn(`Failed to load with ${format.name} format:`, error);
      }
    }
    
    if (!navigationSuccessful) {
      // Fall back to original embedded URL as last resort
      logger.warn('All URL formats failed, using original embedded URL');
      const embedUrl = url.replace('t.me/', 't.me/s/');
      await page.goto(embedUrl, {
        waitUntil: 'networkidle2',
        timeout: config.browser.timeout
      });
    }
    
    // Wait a bit for initial posts to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.debug('Navigation complete');
  }

  private async scrollAndCollectPosts(page: Page, options: ScrapeOptions): Promise<TelegramPost[]> {
    logger.info('Starting to scroll and collect posts');
    
    const posts: Map<string, TelegramPost> = new Map();
    let scrollAttempts = 0;
    let lastPostCount = 0;
    let noNewPostsCount = 0;
    let lastScrollPosition = -1;
    let restrictedPostsCount = 0;
    
    while (scrollAttempts < config.scraping.maxScrollAttempts) {
      // Parse current posts
      const html = await page.content();
      const parser = new DataParser(html);
      const currentPosts = parser.parsePosts();
      
      // Add new posts to map (deduplication)
      for (const post of currentPosts) {
        if (!posts.has(post.id)) {
          // Check if post is restricted
          if (post.content.includes('[Restricted content:')) {
            restrictedPostsCount++;
            logger.warn(`Found restricted post ${post.id}: ${post.content}`);
          }
          
          // Log every 50th post to track progress
          if (posts.size % 50 === 0) {
            logger.info(`Found ${posts.size} posts so far. Latest: ${post.date.toISOString()}`);
          }
          
          // Only filter by date if explicitly set
          if (options.dateFrom && post.date < options.dateFrom) {
            logger.info(`Reached dateFrom limit at ${post.date.toISOString()}`);
            continue; // Don't return early, just skip this post
          }
          
          if (options.dateTo && post.date > options.dateTo) {
            logger.info(`Skipping post newer than dateTo: ${post.date.toISOString()}`);
            continue; // Skip posts newer than dateTo
          }
          
          posts.set(post.id, post);
        }
      }
      
      // Check if we've reached max posts (but ignore if maxPosts is 0 or very high)
      if (options.maxPosts && options.maxPosts > 0 && options.maxPosts < 10000 && posts.size >= options.maxPosts) {
        logger.info(`Reached maxPosts limit: ${options.maxPosts}`);
        break;
      }
      
      // Check if we're getting new posts
      if (posts.size === lastPostCount) {
        noNewPostsCount++;
        if (noNewPostsCount >= 3) {
          logger.info('No new posts found after 3 attempts, stopping');
          break;
        }
      } else {
        noNewPostsCount = 0;
        lastPostCount = posts.size;
      }
      
      // Get current scroll position
      const currentScrollPosition = await page.evaluate(() => window.pageYOffset);
      
      // Check if we've reached the top (first post)
      if (currentScrollPosition === 0 && lastScrollPosition === 0 && scrollAttempts > 5) {
        logger.info('Reached the top of the channel');
        break;
      }
      
      lastScrollPosition = currentScrollPosition;
      
      // Scroll up to load older posts
      await this.scrollDown(page);
      
      // Wait for new content
      await new Promise(resolve => setTimeout(resolve, config.scraping.scrollDelay));
      
      scrollAttempts++;
      
      if (scrollAttempts % 10 === 0) {
        logger.debug(`Scroll attempt ${scrollAttempts}, posts collected: ${posts.size}`);
        
        // Check memory usage to avoid crashes
        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        logger.debug(`Memory usage: ${memMB} MB`);
        
        // If using too much memory, stop scrolling
        if (memMB > 1500) {
          logger.warn(`Memory usage high (${memMB} MB), stopping scroll`);
          break;
        }
      }
    }
    
    logger.info(`Scrolling complete. Total posts collected: ${posts.size}`);
    if (restrictedPostsCount > 0) {
      logger.warn(`Found ${restrictedPostsCount} restricted posts that require Telegram login to view`);
    }
    
    // Sort posts by date (newest first)
    return Array.from(posts.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private async scrollDown(page: Page): Promise<void> {
    // Check if this is authenticated view
    const isAuthenticatedView = await page.evaluate(() => {
      return document.querySelector('.bubbles, .messages-container') !== null;
    });
    
    if (isAuthenticatedView) {
      // For authenticated Telegram Web, scroll within the messages container
      await page.evaluate(() => {
        const container = document.querySelector('.bubbles-inner, .messages-container, .bubbles');
        if (container) {
          // Scroll to top of the container to load older messages
          container.scrollTop = 0;
        } else {
          // Fallback to window scroll
          window.scrollTo(0, 0);
        }
      });
    } else {
      // For embedded view, scroll the window
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
    }
  }


  private async saveToFile(result: ScrapeResult, channelName: string): Promise<void> {
    try {
      const formatter = new MarkdownFormatter();
      const markdown = formatter.format(result);
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `${channelName}_${timestamp}_full.md`;
      
      // Use Claude's AppData directory where Claude has access
      const basePath = 'C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data';
      const filepath = join(basePath, filename);
      
      // Create directory if it doesn't exist
      const { mkdir } = await import('fs/promises');
      await mkdir(basePath, { recursive: true });
      
      // Write file
      await writeFile(filepath, markdown, 'utf8');
      logger.info(`Saved full scrape to: ${filepath}`);
      
      // Also save a JSON version for processing
      const jsonFilename = `${channelName}_${timestamp}_full.json`;
      const jsonFilepath = join(basePath, jsonFilename);
      await writeFile(jsonFilepath, JSON.stringify(result, null, 2), 'utf8');
      logger.info(`Saved JSON data to: ${jsonFilepath}`);
      
    } catch (error) {
      logger.error('Failed to save to file:', error);
    }
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }
}