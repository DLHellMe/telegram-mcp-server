# Windows Installation Guide for Telegram MCP Server

## Prerequisites
1. **Node.js 18+** installed on Windows (not WSL)
   - Download from: https://nodejs.org/
2. **Google Chrome** installed
   - Download from: https://www.google.com/chrome/

## Step-by-Step Installation

### Step 1: Open Windows Command Prompt or PowerShell
- Press `Win + R`
- Type `cmd` or `powershell`
- Press Enter

### Step 2: Navigate to the Project Directory
```cmd
cd C:\vibe_m\tgmcp
```

### Step 3: Install Dependencies on Windows
```cmd
npm install
```

### Step 4: Build the Project
```cmd
npm run build
```

### Step 5: Test the Build
```cmd
node dist\index.js
```
(Press Ctrl+C to stop)

### Step 6: Configure Claude Desktop

1. Open File Explorer and navigate to:
   ```
   C:\Users\[YourUsername]\AppData\Roaming\Claude\
   ```
   
2. Create or edit `claude_desktop_config.json`

3. Add this configuration:
   ```json
   {
     "mcpServers": {
       "telegram-scraper": {
         "command": "node",
         "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
         "env": {
           "BROWSER_HEADLESS": "true",
           "LOG_LEVEL": "INFO"
         }
       }
     }
   }
   ```

### Step 7: Create a Windows Batch File (Optional but Recommended)

Create `start-server.bat` in `C:\vibe_m\tgmcp\`:

```batch
@echo off
cd /d C:\vibe_m\tgmcp
node dist\index.js
```

Then update Claude config to use the batch file:
```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "C:\\vibe_m\\tgmcp\\start-server.bat"
    }
  }
}
```

### Step 8: Restart Claude Desktop
1. Right-click Claude icon in system tray
2. Click "Quit" 
3. Start Claude Desktop again

## Troubleshooting Windows-Specific Issues

### Issue: "node is not recognized as an internal or external command"
**Solution**: Add Node.js to your PATH
1. Search "Environment Variables" in Windows
2. Edit System Environment Variables
3. Add Node.js installation path (usually `C:\Program Files\nodejs\`)

### Issue: "Cannot find module"
**Solution**: Rebuild with Windows paths
```cmd
cd C:\vibe_m\tgmcp
rmdir /s /q node_modules
rmdir /s /q dist
npm install
npm run build
```

### Issue: Chrome/Puppeteer errors
**Solution**: Set Chrome path explicitly

1. Find your Chrome installation:
   - Usually: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - Or: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

2. Update Claude config:
   ```json
   {
     "mcpServers": {
       "telegram-scraper": {
         "command": "node",
         "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
         "env": {
           "BROWSER_HEADLESS": "true",
           "LOG_LEVEL": "INFO",
           "CHROME_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
         }
       }
     }
   }
   ```

### Issue: Permission errors
**Solution**: Run as Administrator
1. Right-click Command Prompt
2. Select "Run as administrator"
3. Navigate to project and rebuild

## Quick Test

After installation, create `test.bat` in `C:\vibe_m\tgmcp\`:

```batch
@echo off
echo Testing Telegram MCP Server...
node dist\index.js
pause
```

Run it to see if the server starts without errors.

## Complete Windows Example

Here's the complete Claude Desktop configuration for Windows:

```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "node",
      "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
      "env": {
        "BROWSER_HEADLESS": "true",
        "LOG_LEVEL": "INFO",
        "CHROME_EXECUTABLE_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "SCROLL_DELAY": "1500",
        "MAX_SCROLL_ATTEMPTS": "30",
        "DEFAULT_MAX_POSTS": "50"
      }
    }
  }
}
```

## Verification Steps

1. Check Node.js is installed:
   ```cmd
   node --version
   ```
   Should show v18.0.0 or higher

2. Check project is built:
   ```cmd
   dir C:\vibe_m\tgmcp\dist
   ```
   Should show index.js and other files

3. Test server directly:
   ```cmd
   cd C:\vibe_m\tgmcp
   node dist\index.js
   ```
   Should show no errors (waiting for input)

4. In Claude Desktop, test with:
   ```
   Can you get info about the Telegram channel https://t.me/example?
   ```

## PowerShell Alternative

If using PowerShell, you can also create `start-server.ps1`:

```powershell
Set-Location -Path "C:\vibe_m\tgmcp"
node dist\index.js
```

And use in Claude config:
```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "powershell",
      "args": ["-File", "C:\\vibe_m\\tgmcp\\start-server.ps1"]
    }
  }
}
```

That's all! Your MCP server should now work on Windows.