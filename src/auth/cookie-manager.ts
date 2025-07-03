import { Page, Cookie } from 'puppeteer';
import { writeFile, readFile, access, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export class CookieManager {
  private cookieFilePath: string;

  constructor() {
    // Store cookies in user's data directory
    const dataPath = this.getDataPath();
    this.cookieFilePath = join(dataPath, 'telegram_cookies.json');
  }

  private getDataPath(): string {
    // Check for custom data path from environment
    if (process.env.TELEGRAM_DATA_PATH) {
      return process.env.TELEGRAM_DATA_PATH;
    }
    
    // Use platform-specific default paths
    const platform = process.platform;
    const home = homedir();
    
    if (platform === 'win32') {
      return join(home, 'AppData', 'Roaming', 'telegram-mcp-data');
    } else if (platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'telegram-mcp-data');
    } else {
      return join(home, '.config', 'telegram-mcp-data');
    }
  }

  async saveCookies(page: Page): Promise<void> {
    try {
      // Get cookies from all URLs
      const currentUrl = page.url();
      logger.debug(`Getting cookies from URL: ${currentUrl}`);
      
      // Try to get cookies from multiple sources
      let allCookies: Cookie[] = [];
      
      // Get cookies from current page
      const pageCookies = await page.cookies();
      allCookies = [...pageCookies];
      
      // Try to get cookies from all URLs
      try {
        const cookiesFromAllUrls = await page.cookies('https://web.telegram.org', 'https://telegram.org');
        allCookies = [...allCookies, ...cookiesFromAllUrls];
      } catch {
        // Ignore errors
      }
      
      // Remove duplicates
      const uniqueCookies = Array.from(
        new Map(allCookies.map(c => [`${c.name}-${c.domain}`, c])).values()
      );
      
      logger.info(`Found ${uniqueCookies.length} total cookies`);
      
      // Ensure directory exists
      await mkdir(dirname(this.cookieFilePath), { recursive: true });
      
      // For Telegram Web K, localStorage is more important than cookies
      // Save localStorage data first
      try {
        const authData = await page.evaluate(() => {
          const data: Record<string, any> = {};
          
          // Get all localStorage items
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key);
            }
          }
          
          // Try to get IndexedDB data (Telegram stores auth here)
          data._indexedDB = 'Check browser DevTools for IndexedDB data';
          
          // Get session storage too
          const sessionData: Record<string, string> = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              sessionData[key] = sessionStorage.getItem(key) || '';
            }
          }
          if (Object.keys(sessionData).length > 0) {
            data._sessionStorage = sessionData;
          }
          
          return data;
        });
        
        if (Object.keys(authData).length > 0) {
          // Save as the main auth file for Telegram Web K
          const authPath = this.cookieFilePath.replace('telegram_cookies.json', 'telegram_auth_data.json');
          await writeFile(authPath, JSON.stringify(authData, null, 2), 'utf8');
          logger.info(`✅ Saved auth data with ${Object.keys(authData).length} items to ${authPath}`);
          
          // Also save in the old location for compatibility
          const localStoragePath = this.cookieFilePath.replace('.json', '_localStorage.json');
          await writeFile(localStoragePath, JSON.stringify(authData, null, 2), 'utf8');
        }
      } catch (error) {
        logger.error('Could not save auth data:', error);
      }
      
      // Save cookies anyway (even if empty)
      await writeFile(
        this.cookieFilePath, 
        JSON.stringify(uniqueCookies, null, 2),
        'utf8'
      );
      
      if (uniqueCookies.length === 0) {
        logger.warn('⚠️ No cookies found - Telegram Web K uses localStorage/IndexedDB for auth');
        logger.info('✅ Authentication data has been saved in auth_data.json');
      }
      
    } catch (error) {
      logger.error('Failed to save auth data:', error);
      throw error;
    }
  }

  async loadCookies(page: Page): Promise<boolean> {
    try {
      // Check if cookie file exists
      await access(this.cookieFilePath);
      
      // Read cookies from file
      const cookieData = await readFile(this.cookieFilePath, 'utf8');
      const cookies: Cookie[] = JSON.parse(cookieData);
      
      // Set cookies in page
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (error) {
          logger.debug(`Failed to set cookie ${cookie.name}:`, error);
        }
      }
      
      logger.info(`Loaded ${cookies.length} cookies from ${this.cookieFilePath}`);
      
      // Try to load localStorage data
      try {
        const localStoragePath = this.cookieFilePath.replace('.json', '_localStorage.json');
        await access(localStoragePath);
        
        const localStorageData = await readFile(localStoragePath, 'utf8');
        const localStorage = JSON.parse(localStorageData);
        
        // Inject localStorage data
        await page.evaluate((data) => {
          Object.entries(data).forEach(([key, value]) => {
            try {
              localStorage.setItem(key, value as string);
            } catch (e) {
              console.error('Failed to set localStorage item:', key, e);
            }
          });
        }, localStorage);
        
        logger.info(`Loaded localStorage data with ${Object.keys(localStorage).length} items`);
      } catch {
        logger.debug('No localStorage data found');
      }
      
      return true;
      
    } catch (error) {
      logger.info('No existing cookies found or failed to load');
      return false;
    }
  }

  async clearCookies(): Promise<void> {
    let clearedAny = false;
    
    // Clear main cookie file
    try {
      await access(this.cookieFilePath);
      await writeFile(this.cookieFilePath, '[]', 'utf8');
      clearedAny = true;
    } catch {
      // No cookie file
    }
    
    // Clear auth data file
    const authPath = this.cookieFilePath.replace('telegram_cookies.json', 'telegram_auth_data.json');
    try {
      await access(authPath);
      await writeFile(authPath, '{}', 'utf8');
      clearedAny = true;
    } catch {
      // No auth file
    }
    
    // Clear localStorage file
    const localStoragePath = this.cookieFilePath.replace('.json', '_localStorage.json');
    try {
      await access(localStoragePath);
      await writeFile(localStoragePath, '{}', 'utf8');
      clearedAny = true;
    } catch {
      // No localStorage file
    }
    
    if (clearedAny) {
      logger.info('Cleared stored authentication data');
    } else {
      logger.info('No authentication data to clear');
    }
  }

  async hasCookies(): Promise<boolean> {
    try {
      // Check for auth data file (Telegram Web K)
      const authPath = this.cookieFilePath.replace('telegram_cookies.json', 'telegram_auth_data.json');
      logger.debug(`Checking auth path: ${authPath}`);
      try {
        await access(authPath);
        const authData = await readFile(authPath, 'utf8');
        const auth = JSON.parse(authData);
        if (Object.keys(auth).length > 0) {
          logger.info(`Found auth_data.json with ${Object.keys(auth).length} keys`);
          return true;
        }
      } catch (error) {
        logger.debug(`Auth file check failed: ${error}`);
        // Continue to check cookies
      }
      
      // Check traditional cookies
      await access(this.cookieFilePath);
      const cookieData = await readFile(this.cookieFilePath, 'utf8');
      const cookies = JSON.parse(cookieData);
      
      // Also check localStorage file
      if (Array.isArray(cookies) && cookies.length === 0) {
        const localStoragePath = this.cookieFilePath.replace('.json', '_localStorage.json');
        try {
          await access(localStoragePath);
          const lsData = await readFile(localStoragePath, 'utf8');
          const localStorage = JSON.parse(lsData);
          return Object.keys(localStorage).length > 0;
        } catch {
          // No localStorage file
        }
      }
      
      return Array.isArray(cookies) && cookies.length > 0;
    } catch {
      return false;
    }
  }
}