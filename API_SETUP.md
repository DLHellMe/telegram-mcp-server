# Telegram API Setup Guide for Version 0.3.0

This guide will help you set up the Telegram API credentials needed for the new API-based scraping in version 0.3.0.

## Why Use the Telegram API?

Version 0.3.0 uses the official Telegram API instead of web scraping, which provides:
- ✅ Much faster and more reliable data access
- ✅ Access to all message metadata (views, reactions, edits, etc.)
- ✅ No browser automation needed
- ✅ Better handling of large channels
- ✅ Search functionality
- ✅ Access to private channels you're a member of

## Getting Your API Credentials

### Step 1: Get Your API ID and Hash

1. Go to https://my.telegram.org
2. Log in with your phone number
3. Click on "API development tools"
4. Fill in the form:
   - **App title**: Telegram MCP Server (or any name you prefer)
   - **Short name**: tgmcp (or any short name)
   - **Platform**: Desktop
   - **Description**: MCP server for Telegram data access
5. Click "Create application"
6. You'll receive:
   - **App api_id**: A number (e.g., 12345678)
   - **App api_hash**: A string (e.g., 0123456789abcdef0123456789abcdef)

### Step 2: Configure the MCP Server

1. Create a `.env` file in the project root:
```bash
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
```

2. Or set environment variables:
```bash
export TELEGRAM_API_ID=your_api_id_here
export TELEGRAM_API_HASH=your_api_hash_here
```

### Step 3: First Time Authentication

When you first use the API tools, you'll be prompted to:
1. Enter your phone number (with country code, e.g., +1234567890)
2. Enter the verification code sent to your Telegram app
3. Enter your 2FA password if you have it enabled

The session will be saved and you won't need to authenticate again.

## Using the API Tools

### New Tools in Version 0.3.0

1. **telegram_api_login** - Authenticate with Telegram API
   ```
   Use telegram_api_login to authenticate with the Telegram API
   ```

2. **api_scrape_channel** - Scrape channel using API
   ```
   Use api_scrape_channel to scrape @channelname
   ```

3. **api_search_channel** - Search in a channel
   ```
   Use api_search_channel to search for "keyword" in @channelname
   ```

4. **api_get_channel_info** - Get detailed channel information
   ```
   Use api_get_channel_info for @channelname
   ```

## Important Notes

- **Rate Limits**: The Telegram API has rate limits. Be respectful and don't scrape too aggressively.
- **Privacy**: Only access channels you have permission to access.
- **API Credentials**: Keep your API ID and Hash secure. Don't share them.
- **Session Security**: The session file contains your authentication. Keep it secure.

## Troubleshooting

### "Invalid API ID or Hash"
- Double-check your credentials from my.telegram.org
- Ensure there are no extra spaces or characters

### "Phone number invalid"
- Include the country code (e.g., +1 for US)
- Don't include spaces or dashes

### "Session expired"
- Delete the session file and authenticate again
- Session file location: `C:\Users\User\AppData\Roaming\Claude\telegram_scraped_data\telegram_session.txt`

### Rate Limit Errors
- Wait a few minutes before trying again
- Reduce the number of messages you're fetching at once