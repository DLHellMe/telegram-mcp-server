import { TelegramScraper } from './dist/scraper/telegram-scraper.js';
import { MarkdownFormatter } from './dist/formatters/markdown-formatter.js';

async function testScrape() {
  console.log('Testing Telegram scraper with https://t.me/getrichortech\n');
  
  const scraper = new TelegramScraper();
  const formatter = new MarkdownFormatter();
  
  try {
    // Test get channel info first
    console.log('1. Testing get_channel_info...');
    const infoResult = await scraper.scrape({
      url: 'https://t.me/getrichortech',
      maxPosts: 0 // Just get channel info
    });
    
    console.log('Channel Info:');
    console.log(`- Name: ${infoResult.channel.name}`);
    console.log(`- Username: @${infoResult.channel.username}`);
    console.log(`- Description: ${infoResult.channel.description || 'N/A'}`);
    console.log(`- Subscribers: ${infoResult.channel.subscriberCount || 'N/A'}`);
    console.log(`- Verified: ${infoResult.channel.verified ? 'Yes' : 'No'}`);
    
    // Test scraping a few posts
    console.log('\n2. Testing scrape_channel with 5 posts...');
    const scrapeResult = await scraper.scrape({
      url: 'https://t.me/getrichortech',
      maxPosts: 5,
      includeReactions: true
    });
    
    console.log(`\nScraped ${scrapeResult.posts.length} posts`);
    
    // Format as markdown
    const markdown = formatter.format(scrapeResult);
    
    // Save to file
    const fs = await import('fs/promises');
    await fs.writeFile('test-output.md', markdown);
    console.log('\nMarkdown output saved to test-output.md');
    
    // Show first post as sample
    if (scrapeResult.posts.length > 0) {
      const firstPost = scrapeResult.posts[0];
      console.log('\nFirst post sample:');
      console.log(`- Date: ${firstPost.date}`);
      console.log(`- Content: ${firstPost.content.substring(0, 100)}...`);
      console.log(`- Views: ${firstPost.views || 'N/A'}`);
      console.log(`- Has media: ${firstPost.hasMedia ? 'Yes' : 'No'}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.close();
    console.log('\nTest complete!');
  }
}

testScrape();