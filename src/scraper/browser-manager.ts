import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class BrowserManager {
  private browser: Browser | null = null;

  async launch(headless?: boolean): Promise<Browser> {
    try {
      logger.info('Launching browser...');
      
      const launchOptions: any = {
        headless: headless !== undefined ? headless : config.browser.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

      if (config.browser.executablePath) {
        launchOptions.executablePath = config.browser.executablePath;
      }

      this.browser = await puppeteer.launch(launchOptions);
      logger.info('Browser launched successfully');
      
      return this.browser;
    } catch (error) {
      logger.error('Failed to launch browser:', error);
      throw new Error(`Browser launch failed: ${error}`);
    }
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launch();
    }

    const page = await this.browser!.newPage();
    
    // Set user agent
    await page.setUserAgent(config.browser.userAgent);
    
    // Set viewport
    await page.setViewport(config.browser.viewport);
    
    // Set default timeout
    page.setDefaultTimeout(config.browser.timeout);
    
    logger.debug('New page created');
    return page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  async screenshot(page: Page, name: string): Promise<void> {
    if (config.debug.saveScreenshots) {
      const path = `${config.debug.screenshotPath}/${name}-${Date.now()}.png` as const;
      await page.screenshot({ path, fullPage: true });
      logger.debug(`Screenshot saved: ${path}`);
    }
  }
}