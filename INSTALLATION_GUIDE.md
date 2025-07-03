# Claude Desktop Installation Guide for Telegram MCP Server

## Step 1: Locate Claude Desktop Configuration File

### Windows:
```
%APPDATA%\Claude\claude_desktop_config.json
```
Full path: `C:\Users\[YourUsername]\AppData\Roaming\Claude\claude_desktop_config.json`

### macOS:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Linux:
```
~/.config/Claude/claude_desktop_config.json
```

## Step 2: Edit Configuration File

1. Open the configuration file in a text editor (create it if it doesn't exist)

2. Add the Telegram MCP server configuration:

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

**⚠️ IMPORTANT: Adjust the path based on your system:**

### For Windows (your case):
```json
"args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"]
```

### For WSL/Linux:
```json
"args": ["/mnt/c/vibe_m/tgmcp/dist/index.js"]
```

### For macOS:
```json
"args": ["/Users/yourusername/path/to/tgmcp/dist/index.js"]
```

## Step 3: Install Chrome/Chromium (Required)

### Windows:
- Download and install Google Chrome from: https://www.google.com/chrome/
- The MCP server will automatically detect it

### Linux/WSL:
```bash
# For Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y chromium-browser

# Or install Google Chrome:
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install google-chrome-stable
```

### macOS:
```bash
brew install --cask google-chrome
```

## Step 4: Configure Chrome Path (if needed)

If Chrome is not in the default location, add the path to the configuration:

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

## Step 5: Restart Claude Desktop

1. Completely quit Claude Desktop (not just close the window)
2. Start Claude Desktop again
3. The MCP server should now be available

## Step 6: Verify Installation

In Claude, try this command:
```
Can you get information about the Telegram channel https://t.me/example_channel?
```

If working correctly, Claude will use the `get_channel_info` tool from your MCP server.

## Troubleshooting

### "Server not found" error:
- Check the path in args is correct
- Ensure the project is built (`npm run build` in the tgmcp directory)
- Check Claude Desktop logs

### "Chrome not found" error:
- Install Google Chrome or Chromium
- Set CHROME_EXECUTABLE_PATH in the env section

### Permission errors:
- Make sure the dist/index.js file is executable
- On Linux/Mac: `chmod +x /path/to/tgmcp/dist/index.js`

## Complete Example Configuration

Here's a complete example with multiple MCP servers:

```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "node",
      "args": ["C:\\vibe_m\\tgmcp\\dist\\index.js"],
      "env": {
        "BROWSER_HEADLESS": "true",
        "LOG_LEVEL": "INFO",
        "SCROLL_DELAY": "1500",
        "MAX_SCROLL_ATTEMPTS": "30",
        "DEFAULT_MAX_POSTS": "50"
      }
    },
    "other-mcp-server": {
      "command": "node",
      "args": ["path/to/other/server.js"]
    }
  }
}
```

## Quick Checklist

- [ ] Built the project (`npm run build`)
- [ ] Located Claude Desktop config file
- [ ] Added telegram-scraper configuration
- [ ] Adjusted the path to match your system
- [ ] Installed Chrome/Chromium
- [ ] Restarted Claude Desktop
- [ ] Tested with a Telegram channel URL

That's it! Your Telegram MCP server should now be available in Claude Desktop.