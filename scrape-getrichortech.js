import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

async function scrapeGetRichOrTech() {
  console.log('🚀 Starting to scrape ALL posts from https://t.me/getrichortech');
  console.log('⏳ This may take a while depending on the channel size...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/scrape/channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://t.me/getrichortech',
        max_posts: 0  // 0 means get ALL posts
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error);
      return;
    }
    
    if (data.posts && data.posts.length > 0) {
      console.log(`✅ Successfully scraped ${data.posts.length} posts!`);
      
      // Sort posts by ID to find the range
      const sortedPosts = [...data.posts].sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idA - idB;
      });
      
      const firstPost = sortedPosts[0];
      const lastPost = sortedPosts[sortedPosts.length - 1];
      
      console.log(`\n📊 Channel Statistics:`);
      console.log(`- Channel: ${data.channel_name || 'getrichortech'}`);
      console.log(`- Total posts: ${data.posts.length}`);
      console.log(`- Post ID range: #${firstPost.id} to #${lastPost.id}`);
      console.log(`- Date range: ${new Date(firstPost.date).toLocaleDateString()} to ${new Date(lastPost.date).toLocaleDateString()}`);
      
      // Calculate engagement metrics
      const totalViews = data.posts.reduce((sum, post) => sum + (post.views || 0), 0);
      const avgViews = Math.round(totalViews / data.posts.length);
      console.log(`- Total views: ${totalViews.toLocaleString()}`);
      console.log(`- Average views per post: ${avgViews.toLocaleString()}`);
      
      // Save the data
      const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
      const filename = `getrichortech_${timestamp}_all_posts.json`;
      const filepath = path.join('scraped_data', filename);
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`\n💾 Data saved to: ${filepath}`);
      
      // Also save a summary for quick analysis
      const summary = {
        channel: 'getrichortech',
        scraped_at: new Date().toISOString(),
        total_posts: data.posts.length,
        post_id_range: {
          first: firstPost.id,
          last: lastPost.id
        },
        date_range: {
          first: firstPost.date,
          last: lastPost.date
        },
        total_views: totalViews,
        average_views: avgViews,
        posts_with_media: data.posts.filter(p => p.hasMedia).length,
        data_file: filename
      };
      
      const summaryFile = path.join('scraped_data', `getrichortech_${timestamp}_summary.json`);
      await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
      console.log(`📄 Summary saved to: ${summaryFile}`);
      
    } else {
      console.log('❌ No posts found or empty response');
      console.log('Response:', data);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('1. Make sure the server is running: npm start');
    console.log('2. Check if you are logged in to Telegram');
    console.log('3. Verify the channel URL is correct');
  }
}

// Run the scraper
console.log('📡 Telegram Channel Scraper - Get Rich or Tech');
console.log('='.repeat(50));
scrapeGetRichOrTech();