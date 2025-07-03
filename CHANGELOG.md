# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2025-06-19

### Added
- **Telegram API Integration**: Direct API access using MTProto protocol
- **New API-based tools**:
  - `telegram_api_login` - Authenticate with Telegram API using your API credentials
  - `api_scrape_channel` - Fast and reliable channel scraping using API
  - `api_search_channel` - Search within channels for specific keywords
  - `api_get_channel_info` - Get detailed channel information
  - `api_logout` - Disconnect from Telegram API
- **API Features**:
  - Much faster data retrieval (100x faster than web scraping)
  - Access to all message metadata (views, reactions, forwards, edits)
  - Search functionality within channels
  - No browser automation needed
  - Session persistence - authenticate once, use forever
  - Access to private channels you're a member of
- **Manual Scraping Mode**: New `scrape_manual` tool for browser-based manual navigation
- **Setup guide**: Comprehensive API_SETUP.md for getting Telegram API credentials

### Changed
- Version bumped to 0.3.0 to reflect major API integration
- Package now includes `telegram` library for MTProto protocol
- Added `input` library for interactive authentication
- Improved data parser to filter out UI elements in authenticated scraping

### Fixed
- Web scraping now properly filters out UI elements
- Better message detection in authenticated Telegram Web
- Improved scrolling mechanism for authenticated views

## [0.2.0] - 2025-06-19

### Added
- **Authentication Support**: Implemented browser automation with cookies for accessing restricted content
  - New `telegram_login` tool for authenticating with Telegram Web
  - New `telegram_logout` tool for clearing authentication cookies
  - New `telegram_auth_status` tool for checking authentication status
  - New `scrape_channel_authenticated` tool for scraping with full access
- **Cookie Management**: Persistent session storage in user's AppData directory
- **Enhanced Content Detection**: Improved detection and labeling of restricted posts
- **Multiple URL Format Support**: Tries embedded, widget, and preview formats
- **Authenticated HTML Parser**: Specialized parser for Telegram Web authenticated sessions

### Changed
- **Authentication is now default**: All scraping tools automatically use authenticated session if logged in
- Improved content extraction with multiple fallback methods
- Enhanced error handling for restricted content
- Better logging for debugging scraping issues
- Upgraded username extraction with multiple detection methods
- Tool descriptions updated to reflect automatic authentication usage

### Fixed
- Fixed username showing as "unknown" in saved files
- Fixed empty posts in markdown output
- Fixed view count parsing for K/M suffixes (1.2K → 1200)
- Fixed reaction parsing with proper emoji detection
- Fixed scrolling direction (now scrolls UP to load older posts)

## [0.1.0] - 2025-06-18

### Initial Release
- Basic Telegram channel/group scraping without API
- Puppeteer-based browser automation
- Markdown and JSON output formats
- Windows compatibility with Claude Desktop
- 5 MCP tools:
  - `scrape_channel` - Limited post scraping
  - `scrape_channel_full` - Complete channel history
  - `scrape_group` - Group scraping
  - `get_channel_info` - Channel metadata only
  - `scrape_date_range` - Date-filtered scraping