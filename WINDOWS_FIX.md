# Fixing Telegram MCP Server on Windows

## The Problem
The server is running but Chrome/Puppeteer isn't launching properly. Here's how to fix it:

## Solution 1: Check Chrome Installation

1. **Verify Chrome is installed:**
   - Open Windows Explorer
   - Check if Chrome exists at:
     - `C:\Program Files\Google\Chrome\Application\chrome.exe`
     - OR `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

2. **Update Claude config with Chrome path:**
   ```json
   {
     "mcpServers": {
       "telegram-scraper": {
         "command": "node",
         "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
         "env": {
           "BROWSER_HEADLESS": "false",
           "LOG_LEVEL": "DEBUG",
           "CHROME_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
         }
       }
     }
   }
   ```

## Solution 2: Create Debug Configuration

1. **Create `.env` file in `C:\vibe_m\tgmcp\`:**
   ```
   BROWSER_HEADLESS=false
   LOG_LEVEL=DEBUG
   CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
   SAVE_SCREENSHOTS=true
   SCREENSHOT_PATH=C:\vibe_m\tgmcp\screenshots
   ```

2. **Create screenshots directory:**
   ```cmd
   cd C:\vibe_m\tgmcp
   mkdir screenshots
   ```

## Solution 3: Test Puppeteer Directly

1. **Create test file `C:\vibe_m\tgmcp\test-windows.js`:**
   ```javascript
   const puppeteer = require('puppeteer');
   
   async function test() {
     console.log('Testing Puppeteer on Windows...');
     try {
       const browser = await puppeteer.launch({
         headless: false,
         executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
         args: ['--no-sandbox', '--disable-setuid-sandbox']
       });
       console.log('Browser launched successfully!');
       
       const page = await browser.newPage();
       await page.goto('https://t.me/s/getrichortech');
       console.log('Navigated to Telegram channel');
       
       await page.screenshot({ path: 'test.png' });
       console.log('Screenshot saved');
       
       await browser.close();
     } catch (error) {
       console.error('Error:', error);
     }
   }
   
   test();
   ```

2. **Run the test:**
   ```cmd
   cd C:\vibe_m\tgmcp
   node test-windows.js
   ```

## Solution 4: Use Embedded View URL

The issue might be the URL format. Update the scraper to use the embedded view:

1. **Edit `C:\vibe_m\tgmcp\src\scraper\telegram-scraper.ts`**
   
   Change line ~81:
   ```typescript
   // OLD:
   const embedUrl = url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`;
   
   // NEW:
   const embedUrl = url.replace('t.me/', 't.me/s/');
   ```

2. **Rebuild:**
   ```cmd
   cd C:\vibe_m\tgmcp
   npm run build
   ```

## Solution 5: Windows-Specific Puppeteer Fix

1. **Create `C:\vibe_m\tgmcp\windows-fix.js`:**
   ```javascript
   // Fix for Windows paths
   const path = require('path');
   process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
   process.env.PUPPETEER_EXECUTABLE_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
   ```

2. **Update package.json scripts:**
   ```json
   "scripts": {
     "start:windows": "node -r ./windows-fix.js dist/index.js"
   }
   ```

3. **Update Claude config:**
   ```json
   {
     "mcpServers": {
       "telegram-scraper": {
         "command": "npm",
         "args": ["run", "start:windows"],
         "cwd": "C:\\vibe_m\\tgmcp"
       }
     }
   }
   ```

## Quick Diagnostic Steps

1. **Check if Chrome launches manually:**
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-sandbox https://t.me/s/getrichortech
   ```

2. **Check Claude logs:**
   - Look in `%APPDATA%\Claude\logs\`
   - Check for error messages

3. **Enable verbose logging in Claude config:**
   ```json
   {
     "mcpServers": {
       "telegram-scraper": {
         "command": "node",
         "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
         "env": {
           "BROWSER_HEADLESS": "false",
           "LOG_LEVEL": "DEBUG",
           "CHROME_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
           "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "true"
         }
       }
     }
   }
   ```

## Most Common Fix

Usually, the issue is Chrome path. Try this simplified config:

```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "node",
      "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
      "cwd": "C:\\vibe_m\\tgmcp",
      "env": {
        "PUPPETEER_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      }
    }
  }
}
```

Then restart Claude Desktop and try again.