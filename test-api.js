// Test the new Telegram API integration
import { TelegramApiScraper } from './dist/api/api-scraper.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testApi() {
  // Check for API credentials
  const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
  const apiHash = process.env.TELEGRAM_API_HASH || '';
  
  if (!apiId || !apiHash) {
    console.error('Please set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables');
    console.error('See API_SETUP.md for instructions');
    process.exit(1);
  }
  
  const scraper = new TelegramApiScraper({ apiId, apiHash });
  
  try {
    console.log('Initializing Telegram API client...');
    await scraper.initialize();
    
    console.log('\nTesting channel info...');
    const channelUrl = 'https://t.me/durov'; // Pavel Durov's channel
    
    console.log(`\nScraping ${channelUrl}...`);
    const result = await scraper.scrape({
      url: channelUrl,
      maxPosts: 10
    });
    
    console.log('\nChannel Info:');
    console.log('Name:', result.channel.name);
    console.log('Username:', result.channel.username);
    console.log('Subscribers:', result.channel.subscriberCount);
    console.log('Total posts scraped:', result.posts.length);
    
    if (result.posts.length > 0) {
      console.log('\nFirst post:');
      console.log('Date:', result.posts[0].date);
      console.log('Content:', result.posts[0].content.substring(0, 200) + '...');
      console.log('Views:', result.posts[0].views);
    }
    
    // Test search
    console.log('\nTesting search...');
    const searchResult = await scraper.search(channelUrl, 'telegram', 5);
    console.log(`Found ${searchResult.posts.length} posts containing "telegram"`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.disconnect();
  }
}

testApi();