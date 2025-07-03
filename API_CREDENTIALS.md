# Setting Up Telegram API Credentials

To use the API features in version 0.3.0, you need to set up your Telegram API credentials.

## Environment Variables

Add these to your `.env` file:

```env
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
```

## Getting Your API Credentials

1. Go to https://my.telegram.org
2. Log in with your phone number
3. Click on "API development tools"
4. Create a new application if you haven't already
5. Copy your `api_id` and `api_hash`

## Using the API Tools

Once you have your credentials set up, you can use the new API tools in Claude:

1. **telegram_api_login** - Authenticate with Telegram API
2. **api_scrape_channel** - Fast channel scraping
3. **api_search_channel** - Search within channels
4. **api_get_channel_info** - Get channel details
5. **api_logout** - Disconnect from API

The API method is much faster and more reliable than web scraping!