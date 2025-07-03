// Test script to verify scraper handles restricted content
import { TelegramScraper } from './dist/scraper/telegram-scraper.js';

async function testScraper() {
  const scraper = new TelegramScraper();
  
  try {
    console.log('Starting test scrape of getrichortech channel...');
    
    const result = await scraper.scrape({
      url: 'https://t.me/getrichortech',
      maxPosts: 20, // Just get first 20 posts for testing
      includeReactions: true
    });
    
    console.log('\n=== SCRAPE RESULTS ===');
    console.log(`Channel: ${result.channel.name} (@${result.channel.username})`);
    console.log(`Total posts found: ${result.posts.length}`);
    
    // Check for restricted content
    const restrictedPosts = result.posts.filter(post => 
      post.content.includes('[Restricted content:')
    );
    
    console.log(`\nRestricted posts found: ${restrictedPosts.length}`);
    
    if (restrictedPosts.length > 0) {
      console.log('\nRestricted post examples:');
      restrictedPosts.slice(0, 3).forEach(post => {
        console.log(`- Post ${post.id}: ${post.content}`);
      });
    }
    
    // Check for empty posts
    const emptyPosts = result.posts.filter(post => 
      post.content.includes('[Empty post]') || 
      post.content.includes('[No text content]')
    );
    
    console.log(`\nEmpty posts found: ${emptyPosts.length}`);
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await scraper.close();
  }
}

testScraper();