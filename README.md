# Telegram MCP Server

A powerful MCP (Model Context Protocol) server that enables Claude to interact with Telegram channels and groups. This server provides both web scraping and direct API access to Telegram content.

## 🚀 Features

### Version 0.3.0 - Dual Mode Operation

#### API Mode (Recommended) ⚡
- **100x faster** than web scraping
- Direct access via Telegram's MTProto protocol
- Search functionality within channels
- Access to private channels you're a member of
- Complete message metadata (views, reactions, forwards)
- Persistent sessions - authenticate once
- No browser automation needed
- **Unlimited post retrieval** by default

#### Web Scraping Mode 🌐
- No API credentials required
- Browser-based scraping with Puppeteer
- Authentication support for restricted content
- Visual media extraction
- Suitable for quick, anonymous access

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- Chrome/Chromium (for web scraping mode)
- Telegram API credentials (for API mode) - [Get them here](https://my.telegram.org)

## 🛠️ Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/telegram-mcp-server.git
cd telegram-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file:
```bash
cp .env.example .env
```

4. Edit `.env` and add your configuration:
   - For API mode: Add your `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`
   - For web scraping: Default settings work out of the box

5. Build the project:
```bash
npm run build
```

## 🔧 Configuration

### Getting Telegram API Credentials

1. Go to [https://my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Click "API development tools"
4. Create a new application
5. Copy your `api_id` and `api_hash` to the `.env` file

### Claude Desktop Configuration

Add this to your Claude Desktop config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "telegram-scraper": {
      "command": "node",
      "args": ["/absolute/path/to/telegram-mcp-server/dist/index.js"],
      "env": {
        "TELEGRAM_API_ID": "your_api_id",
        "TELEGRAM_API_HASH": "your_api_hash"
      }
    }
  }
}
```

## 📖 Usage

After configuration, restart Claude Desktop. The Telegram tools will be available in Claude.

### API Mode Tools

1. **telegram_api_login** - Authenticate with Telegram (first time only)
   ```
   Use telegram_api_login to connect to Telegram
   ```

2. **api_scrape_channel** - Scrape channel posts (unlimited by default)
   ```
   Use api_scrape_channel with url="https://t.me/channelname"
   ```
   
   Or with a limit:
   ```
   Use api_scrape_channel with url="https://t.me/channelname" and max_posts=50
   ```

3. **api_search_channel** - Search within a channel
   ```
   Use api_search_channel with url="https://t.me/channelname" and query="keyword"
   ```

### Web Scraping Tools

1. **scrape_channel** - Scrape public channels
   ```
   Use scrape_channel with url="https://t.me/channelname"
   ```

2. **telegram_login** - Login for restricted content
   ```
   Use telegram_login with phone="+1234567890"
   ```

## 🔒 Data Storage

Session data and cookies are stored in platform-specific directories:

- **Windows**: `%APPDATA%\telegram-mcp-data`
- **macOS**: `~/Library/Application Support/telegram-mcp-data`
- **Linux**: `~/.config/telegram-mcp-data`

You can override this with the `TELEGRAM_DATA_PATH` environment variable.

## 🛡️ Security Notes

- **Never commit your `.env` file** - it contains sensitive API credentials
- API credentials are personal - each user needs their own
- Session files contain authentication data - keep them secure
- Use the `.gitignore` file to prevent accidental commits

## 📝 Development

```bash
# Run in development mode
npm run dev

# Build the project
npm run build

# Watch for changes
npm run watch
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [Model Context Protocol SDK](https://github.com/anthropics/model-context-protocol)
- [GramJS](https://github.com/gram-js/gramjs) - Telegram client library
- [Puppeteer](https://github.com/puppeteer/puppeteer) - Browser automation

## ⚠️ Disclaimer

This tool is for educational and research purposes. Please respect Telegram's Terms of Service and the privacy of channel members. Always obtain permission before scraping private channels.

## 🐛 Troubleshooting

### API Mode Issues

- **"Not connected to Telegram API"**: Run `telegram_api_login` first
- **Phone number format**: Include country code (e.g., +1234567890)
- **2FA errors**: Enter your 2FA password when prompted

### Web Scraping Issues

- **"No Chrome binary found"**: Install Chrome or Chromium
- **Login issues**: Ensure you're using the correct phone format
- **Timeout errors**: Increase `BROWSER_TIMEOUT` in `.env`

## 📞 Support

- Create an issue on GitHub for bugs
- Check existing issues before creating new ones
- Include error messages and logs when reporting issues