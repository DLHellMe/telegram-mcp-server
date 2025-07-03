import { TelegramScraper } from './dist/scraper/telegram-scraper.js';
import { MarkdownFormatter } from './dist/formatters/markdown-formatter.js';
import fs from 'fs/promises';
import path from 'path';

async function scrapeAllPosts() {
  console.log('Scraping ALL posts from https://t.me/getrichortech\n');
  
  const scraper = new TelegramScraper(false); // Unauthenticated scraper
  const formatter = new MarkdownFormatter();
  
  try {
    // First get channel info
    console.log('Getting channel info...');
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
    
    // Now scrape ALL posts
    console.log('\nScraping ALL posts from the channel...');
    const startTime = Date.now();
    
    const scrapeResult = await scraper.scrape({
      url: 'https://t.me/getrichortech',
      maxPosts: 0, // 0 means no limit - get ALL posts
      includeReactions: true
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\nSuccessfully scraped ${scrapeResult.posts.length} posts in ${duration.toFixed(2)} seconds`);
    
    // Format as markdown
    console.log('\nFormatting posts as markdown...');
    const markdown = formatter.format(scrapeResult);
    
    // Create scraped_data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'scraped_data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const channelName = infoResult.channel.username;
    const mdFilename = path.join(dataDir, `${channelName}_${timestamp}_full.md`);
    const jsonFilename = path.join(dataDir, `${channelName}_${timestamp}_full.json`);
    
    // Save markdown file
    await fs.writeFile(mdFilename, markdown);
    console.log(`\nMarkdown file saved to: ${mdFilename}`);
    
    // Save JSON file with raw data
    await fs.writeFile(jsonFilename, JSON.stringify(scrapeResult, null, 2));
    console.log(`JSON file saved to: ${jsonFilename}`);
    
    // Show summary statistics
    console.log('\nSummary Statistics:');
    console.log(`- Total posts: ${scrapeResult.posts.length}`);
    console.log(`- Total scraped: ${scrapeResult.totalPosts}`);
    
    if (scrapeResult.posts.length > 0) {
      const oldestPost = scrapeResult.posts[scrapeResult.posts.length - 1];
      const newestPost = scrapeResult.posts[0];
      console.log(`- Date range: ${oldestPost.date.toISOString().split('T')[0]} to ${newestPost.date.toISOString().split('T')[0]}`);
      
      // Calculate posts with media
      const postsWithMedia = scrapeResult.posts.filter(p => p.hasMedia).length;
      console.log(`- Posts with media: ${postsWithMedia} (${((postsWithMedia / scrapeResult.posts.length) * 100).toFixed(1)}%)`);
      
      // Calculate total views
      const totalViews = scrapeResult.posts.reduce((sum, post) => sum + (post.views || 0), 0);
      console.log(`- Total views: ${totalViews.toLocaleString()}`);
      
      // Show sample of first and last posts
      console.log('\nFirst post:');
      console.log(`- Date: ${newestPost.date.toISOString()}`);
      console.log(`- Content: ${newestPost.content.substring(0, 100)}...`);
      
      console.log('\nLast post:');
      console.log(`- Date: ${oldestPost.date.toISOString()}`);
      console.log(`- Content: ${oldestPost.content.substring(0, 100)}...`);
    }
    
    return { mdFilename, jsonFilename, totalPosts: scrapeResult.posts.length };
    
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  } finally {
    await scraper.close();
    console.log('\nScraper closed.');
  }
}

// Run the scraper
scrapeAllPosts()
  .then(result => {
    console.log('\nScraping completed successfully!');
    console.log(`Files saved:`);
    console.log(`- ${result.mdFilename}`);
    console.log(`- ${result.jsonFilename}`);
    console.log(`Total posts: ${result.totalPosts}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\nScraping failed with error:', error);
    process.exit(1);
  });