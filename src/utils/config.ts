import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Browser settings
  browser: {
    headless: process.env.BROWSER_HEADLESS !== 'false',
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1280'),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '720')
    },
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
    executablePath: process.env.CHROME_EXECUTABLE_PATH
  },
  
  // Scraping settings
  scraping: {
    scrollDelay: parseInt(process.env.SCROLL_DELAY || '1000'),
    maxScrollAttempts: parseInt(process.env.MAX_SCROLL_ATTEMPTS || '50'),
    defaultMaxPosts: parseInt(process.env.DEFAULT_MAX_POSTS || '100'),
    waitForSelector: parseInt(process.env.WAIT_FOR_SELECTOR || '5000')
  },
  
  // Server settings
  server: {
    name: process.env.SERVER_NAME || 'telegram-mcp-server',
    version: process.env.SERVER_VERSION || '0.2.0'
  },
  
  // Debug settings
  debug: {
    logLevel: process.env.LOG_LEVEL || 'INFO',
    saveScreenshots: process.env.SAVE_SCREENSHOTS === 'true',
    screenshotPath: process.env.SCREENSHOT_PATH || './screenshots'
  }
};