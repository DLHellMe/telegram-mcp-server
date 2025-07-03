import { Page, Browser } from 'puppeteer';
import { BrowserManager } from '../scraper/browser-manager.js';
import { CookieManager } from './cookie-manager.js';
import { logger } from '../utils/logger.js';

export class TelegramAuth {
  private browserManager: BrowserManager;
  private cookieManager: CookieManager;

  constructor() {
    this.browserManager = new BrowserManager();
    this.cookieManager = new CookieManager();
  }

  async login(phoneNumber?: string): Promise<boolean> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      logger.info('Starting Telegram Web authentication...');

      // Launch browser in non-headless mode for login
      browser = await this.browserManager.launch(false);
      page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Set longer default timeout for login process
      page.setDefaultTimeout(120000); // 2 minutes

      // Navigate to Telegram Web - try different URLs
      logger.info('Navigating to Telegram Web...');
      
      // Try the regular version first (might use cookies)
      try {
        await page.goto('https://web.telegram.org/a/', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        logger.info('Loaded Telegram Web A version');
      } catch {
        // Fallback to Z version
        try {
          logger.info('Trying Telegram Web Z version...');
          await page.goto('https://web.telegram.org/z/', {
            waitUntil: 'networkidle2',
            timeout: 60000
          });
          logger.info('Loaded Telegram Web Z version');
        } catch {
          // Final fallback to K version
          logger.info('Trying Telegram Web K version...');
          await page.goto('https://web.telegram.org/k/', {
            waitUntil: 'networkidle2',
            timeout: 60000
          });
          logger.info('Loaded Telegram Web K version');
        }
      }

      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if already logged in
      const isLoggedIn = await this.checkIfLoggedIn(page);
      if (isLoggedIn) {
        logger.info('Already logged in! Saving cookies...');
        await this.cookieManager.saveCookies(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
      }

      // Wait for login form with more specific selectors
      logger.info('Waiting for login form...');
      try {
        await page.waitForSelector('canvas#qr-canvas, .input-wrapper, .login-container, .qr-container', {
          timeout: 30000
        });
        logger.info('Login form found');
      } catch {
        logger.warn('Could not find login form selectors, continuing anyway...');
      }

      // Handle phone number input
      if (phoneNumber) {
        logger.info('Entering phone number...');
        await this.enterPhoneNumber(page, phoneNumber);
      } else {
        logger.info('='.repeat(60));
        logger.info('MANUAL LOGIN REQUIRED');
        logger.info('Please complete login in the browser window:');
        logger.info('1. Scan the QR code with your mobile Telegram app');
        logger.info('2. OR click "Log in by phone number" and enter your details');
        logger.info('3. Complete any verification steps');
        logger.info('='.repeat(60));
      }

      // Wait for successful login with periodic checks
      logger.info('Waiting for login completion (this may take a few minutes)...');
      const loginSuccess = await this.waitForLoginWithProgress(page);

      if (loginSuccess) {
        logger.info('Login detected! Waiting for page to fully load...');
        
        // Give more time for all resources to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to navigate to a channel to ensure session is established
        try {
          logger.info('Testing session by navigating to a channel...');
          const currentUrl = page.url();
          
          // Determine which version we're using and navigate accordingly
          if (currentUrl.includes('/a/')) {
            await page.goto('https://web.telegram.org/a/#@durov', {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
          } else if (currentUrl.includes('/z/')) {
            await page.goto('https://web.telegram.org/z/#@durov', {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
          } else {
            await page.goto('https://web.telegram.org/k/#@durov', {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Navigate back to main page
          await page.goto(currentUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch {
          logger.warn('Could not navigate to test channel, continuing anyway...');
        }
        
        logger.info('Saving authentication data...');
        await this.cookieManager.saveCookies(page);
        
        // For Telegram Web K, we can't rely on traditional cookie verification
        // The auth is stored in IndexedDB which we can't easily access
        logger.info('✅ Authentication data saved!');
        logger.info('Note: Telegram Web K uses IndexedDB for auth, not cookies.');
        logger.info('The authentication should work even if no cookies were found.');
        
        // Keep browser open a bit longer
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return true;
      } else {
        logger.error('Login timeout - no login detected within time limit');
        return false;
      }

    } catch (error) {
      logger.error('Authentication error:', error);
      // Log more details about the error
      if (error instanceof Error) {
        logger.error('Error details:', error.message);
        logger.error('Stack trace:', error.stack);
      }
      return false;
    } finally {
      // Don't close immediately - give user time to see any errors
      if (page || browser) {
        logger.info('Closing browser in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  private async checkIfLoggedIn(page: Page): Promise<boolean> {
    try {
      // Check for elements that indicate logged in state
      const loggedInSelectors = [
        // K version selectors
        '.chat-list',
        '.chatlist',
        '.dialogs',
        '#column-left',
        '.sidebar-left',
        
        // Regular version selectors
        '.dialogs-list',
        '.im_dialogs_wrap',
        '.im_page_wrap',
        
        // Common selectors
        '[data-testid="chat-list"]',
        '.messages-container',
        '.chats-container'
      ];

      for (const selector of loggedInSelectors) {
        const element = await page.$(selector);
        if (element) {
          logger.debug(`Found logged in indicator: ${selector}`);
          return true;
        }
      }

      // Also check if we can find any chat elements
      const hasChatElements = await page.evaluate(() => {
        return document.querySelector('[class*="chat"]') !== null ||
               document.querySelector('[class*="dialog"]') !== null ||
               document.querySelector('[class*="message"]') !== null;
      });

      if (hasChatElements) {
        logger.debug('Found chat-related elements, likely logged in');
        return true;
      }

      return false;
    } catch (error) {
      logger.debug('Error checking login state:', error);
      return false;
    }
  }

  private async enterPhoneNumber(page: Page, phoneNumber: string): Promise<void> {
    // Click "Log in by phone Number" if QR code is shown
    const phoneLoginButton = await page.$('button[ng-click*="phoneLogin"]');
    if (phoneLoginButton) {
      await phoneLoginButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Enter phone number
    const phoneInput = await page.waitForSelector('input[name="phone_number"], .input-field-phone input', {
      timeout: 10000
    });

    if (phoneInput) {
      await phoneInput.click({ clickCount: 3 }); // Select all
      await phoneInput.type(phoneNumber);
      
      // Submit
      const nextButton = await page.$('button[type="submit"], .btn-primary');
      if (nextButton) {
        await nextButton.click();
      }

      // Wait for code input
      logger.info('Phone number submitted. You will receive a code via Telegram.');
    }
  }


  private async waitForLoginWithProgress(page: Page, timeout: number = 300000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    let lastCheck = 0;
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if logged in
        const isLoggedIn = await this.checkIfLoggedIn(page);
        
        if (isLoggedIn) {
          logger.info('✅ Login successful!');
          return true;
        }
        
        // Log progress every 30 seconds
        const elapsed = Date.now() - startTime;
        if (elapsed - lastCheck > 30000) {
          lastCheck = elapsed;
          const remaining = Math.ceil((timeout - elapsed) / 1000);
          logger.info(`Still waiting for login... (${remaining}s remaining)`);
        }
        
        // Check for common error states
        const errorElement = await page.$('.error-message, .alert-error');
        if (errorElement) {
          const errorText = await errorElement.evaluate(el => el.textContent);
          logger.error(`Login error detected: ${errorText}`);
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
      } catch (error) {
        logger.debug('Error during login check:', error);
        // Continue checking
      }
    }
    
    return false;
  }

  async logout(): Promise<void> {
    await this.cookieManager.clearCookies();
    logger.info('Logged out (cookies cleared)');
  }

  async isAuthenticated(): Promise<boolean> {
    // For Telegram Web K, we just check if auth data exists
    // The actual verification happens when we try to use it
    const hasCookies = await this.cookieManager.hasCookies();
    
    if (hasCookies) {
      logger.debug('Authentication data found');
      return true;
    }
    
    return false;
  }

  async getCookieManager(): Promise<CookieManager> {
    return this.cookieManager;
  }
}