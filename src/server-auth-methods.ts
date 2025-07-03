// Additional methods for TelegramMCPServer class
// These should be added to the server.ts file

export const authMethods = `
  private async handleTelegramLogin(args: any): Promise<any> {
    const phoneNumber = args.phone_number;
    
    try {
      const success = await this.auth.login(phoneNumber);
      
      if (success) {
        return {
          content: [
            {
              type: 'text',
              text: \`✅ Successfully authenticated with Telegram!

You can now use the authenticated scraping tools to access restricted content.

Use 'scrape_channel_authenticated' to scrape channels with full access.\`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: \`❌ Authentication failed. Please try again.

Make sure to:
1. Complete the login process in the browser window
2. Enter the verification code if prompted
3. Allow sufficient time for the login to complete\`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: \`❌ Login error: \${error instanceof Error ? error.message : 'Unknown error'}

Please check:
- Chrome is installed and accessible
- You have a stable internet connection
- The phone number is in international format (if provided)\`
          }
        ]
      };
    }
  }

  private async handleTelegramLogout(): Promise<any> {
    await this.auth.logout();
    
    return {
      content: [
        {
          type: 'text',
          text: '✅ Successfully logged out from Telegram. Authentication cookies have been cleared.'
        }
      ]
    };
  }

  private async handleAuthStatus(): Promise<any> {
    const isAuthenticated = await this.auth.isAuthenticated();
    
    return {
      content: [
        {
          type: 'text',
          text: isAuthenticated 
            ? '✅ Authenticated with Telegram. You can access restricted content.'
            : '❌ Not authenticated. Use telegram_login to authenticate.'
        }
      ]
    };
  }

  private async handleScrapeChannelAuthenticated(args: any): Promise<any> {
    // Check authentication first
    const isAuthenticated = await this.auth.isAuthenticated();
    if (!isAuthenticated) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Not authenticated. Please use telegram_login first to access restricted content.'
          }
        ]
      };
    }

    const options: ScrapeOptions = {
      url: args.url,
      maxPosts: args.max_posts || 100,
      includeReactions: true
    };

    try {
      const result = await this.authScraper.scrape(options);
      const markdown = this.formatter.format(result);

      return {
        content: [
          {
            type: 'text',
            text: \`# Authenticated Scrape Results

\${markdown}

✅ Scraped using authenticated session - restricted content should be accessible.\`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: \`❌ Authenticated scrape failed: \${error instanceof Error ? error.message : 'Unknown error'}

This might happen if:
- The authentication session expired
- The channel requires additional permissions
- There was a network error

Try running telegram_login again if the problem persists.\`
          }
        ]
      };
    }
  }
`;

// Also need to update the shutdown method to close authScraper
export const updatedShutdown = `
  async shutdown(): Promise<void> {
    await this.scraper.close();
    await this.authScraper.close();
    logger.info('Server shutdown complete');
  }
`;