import { Page, Browser } from 'puppeteer';
import { BrowserManager } from './browser-manager.js';
import { DataParser } from './data-parser.js';
import { ScrapeOptions, ScrapeResult } from '../types/telegram.types.js';
import { logger } from '../utils/logger.js';
import { CookieManager } from '../auth/cookie-manager.js';

export class ManualTelegramScraper {
  private browserManager: BrowserManager;
  private cookieManager: CookieManager;

  constructor() {
    this.browserManager = new BrowserManager();
    this.cookieManager = new CookieManager();
  }

  async loginAndWaitForChannel(): Promise<{ browser: Browser; page: Page }> {
    logger.info('Opening browser for manual login and navigation...');
    
    // Launch browser in non-headless mode
    const browser = await this.browserManager.launch(false);
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Load cookies if available
    await this.cookieManager.loadCookies(page);
    
    // Navigate to Telegram Web
    logger.info('Navigating to Telegram Web...');
    await page.goto('https://web.telegram.org/a/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Instructions for user
    logger.info('='.repeat(60));
    logger.info('MANUAL NAVIGATION REQUIRED');
    logger.info('1. Log in to Telegram if needed');
    logger.info('2. Navigate to the channel you want to scrape');
    logger.info('3. Make sure the channel messages are visible');
    logger.info('4. Press Enter here when ready to start scraping');
    logger.info('='.repeat(60));
    
    // Wait for user to press Enter
    await new Promise<void>(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
    
    // Save cookies for future use
    await this.cookieManager.saveCookies(page);
    
    return { browser, page };
  }

  async scrapeCurrentChannel(page: Page, options: Partial<ScrapeOptions> = {}): Promise<ScrapeResult> {
    logger.info('Starting to scrape current channel...');
    
    try {
      // Get current URL to extract channel info
      const currentUrl = page.url();
      logger.info(`Current URL: ${currentUrl}`);
      
      // Get channel info from the page
      const channelHtml = await page.content();
      const parser = new DataParser(channelHtml);
      let channel = parser.parseChannelInfo();
      
      // Try to extract channel name from URL or page title
      if (channel.name === 'Unknown Channel') {
        const pageTitle = await page.title();
        if (pageTitle && pageTitle !== 'Telegram') {
          channel.name = pageTitle;
        }
      }
      
      // Extract username from URL if possible
      const urlMatch = currentUrl.match(/#@?([^/?]+)$/);
      if (urlMatch && urlMatch[1] && channel.username === 'unknown') {
        channel.username = urlMatch[1].replace('-', '');
      }
      
      logger.info(`Scraping channel: ${channel.name} (@${channel.username})`);
      
      // Scroll and collect posts
      const posts = await this.scrollAndCollectPosts(page, options);
      
      logger.info(`Scraping complete. Total posts: ${posts.length}`);
      
      return {
        channel,
        posts,
        scrapedAt: new Date(),
        totalPosts: posts.length
      };
      
    } catch (error) {
      logger.error('Scraping failed:', error);
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

  private async scrollAndCollectPosts(page: Page, options: Partial<ScrapeOptions>): Promise<any[]> {
    logger.info('Starting to scroll and collect posts');
    
    const posts: Map<string, any> = new Map();
    let scrollAttempts = 0;
    let lastPostCount = 0;
    let noNewPostsCount = 0;
    const maxScrollAttempts = options.maxPosts ? Math.min(50, Math.ceil(options.maxPosts / 20)) : 50;
    
    while (scrollAttempts < maxScrollAttempts) {
      // Parse current posts
      const html = await page.content();
      const parser = new DataParser(html);
      const currentPosts = parser.parsePosts();
      
      // Add new posts to map (deduplication)
      for (const post of currentPosts) {
        if (!posts.has(post.id)) {
          posts.set(post.id, post);
          
          // Log progress
          if (posts.size % 20 === 0) {
            logger.info(`Collected ${posts.size} posts so far...`);
          }
        }
      }
      
      // Check if we've reached max posts
      if (options.maxPosts && posts.size >= options.maxPosts) {
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
      
      // Scroll to load more messages
      await this.scrollUp(page);
      
      // Wait for new content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      scrollAttempts++;
    }
    
    logger.info(`Scrolling complete. Total posts collected: ${posts.size}`);
    
    // Sort posts by date (newest first) and limit if needed
    let sortedPosts = Array.from(posts.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
    
    if (options.maxPosts && sortedPosts.length > options.maxPosts) {
      sortedPosts = sortedPosts.slice(0, options.maxPosts);
    }
    
    return sortedPosts;
  }

  private async scrollUp(page: Page): Promise<void> {
    // Scroll within the messages container to load older messages
    await page.evaluate(() => {
      const container = document.querySelector('.bubbles-inner, .messages-container, .bubbles, .im_history_scrollable');
      if (container) {
        // Scroll to top of the container to load older messages
        container.scrollTop = 0;
      } else {
        // Try to find any scrollable container
        const scrollables = document.querySelectorAll('[class*="scroll"], [class*="messages"], [class*="chat"]');
        for (let i = 0; i < scrollables.length; i++) {
          const el = scrollables[i] as HTMLElement;
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop = 0;
            break;
          }
        }
      }
    });
  }

  async close(browser: Browser): Promise<void> {
    await browser.close();
  }
}