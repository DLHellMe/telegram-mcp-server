import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

async function scrapeSimple() {
  console.log('Scraping https://t.me/getrichortech using simple HTTP fetch...\n');
  
  try {
    const url = 'https://t.me/s/getrichortech';
    console.log(`Fetching ${url}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Page fetched, parsing HTML...');
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Extract channel info
    const channelName = document.querySelector('.tgme_page_title span')?.textContent?.trim() || 'Unknown';
    const channelUsername = document.querySelector('.tgme_page_extra')?.textContent?.replace('@', '').trim() || 'unknown';
    const channelDescription = document.querySelector('.tgme_page_description')?.textContent?.trim() || '';
    
    console.log('Channel info:');
    console.log(`- Name: ${channelName}`);
    console.log(`- Username: @${channelUsername}`);
    console.log(`- Description: ${channelDescription}`);
    
    // Extract posts
    const postElements = document.querySelectorAll('.tgme_widget_message');
    const posts = [];
    
    postElements.forEach(post => {
      const contentEl = post.querySelector('.tgme_widget_message_text');
      const dateEl = post.querySelector('.tgme_widget_message_date time');
      const viewsEl = post.querySelector('.tgme_widget_message_views');
      const linkEl = post.querySelector('.tgme_widget_message_date');
      
      if (contentEl || post.querySelector('.tgme_widget_message_photo')) {
        const content = contentEl?.textContent?.trim() || '';
        const dateStr = dateEl?.getAttribute('datetime') || '';
        const views = viewsEl?.textContent?.trim() || '0';
        const link = linkEl?.getAttribute('href') || '';
        
        posts.push({
          content: content,
          date: dateStr ? new Date(dateStr) : new Date(),
          views: parseInt(views.replace(/[^\d]/g, '')) || 0,
          link: link,
          hasMedia: !!post.querySelector('.tgme_widget_message_photo, .tgme_widget_message_video')
        });
      }
    });
    
    console.log(`\nFound ${posts.length} posts`);
    
    // Note: This simple approach only gets the most recent posts visible on the page
    // For ALL posts, we would need to use the full scraper with browser automation
    
    // Create result object
    const result = {
      channel: {
        name: channelName,
        username: channelUsername,
        description: channelDescription,
        subscriberCount: null,
        verified: false
      },
      posts: posts,
      totalPosts: posts.length,
      scrapedAt: new Date()
    };
    
    // Create markdown
    let markdown = `# Telegram Channel: ${channelName}\n\n`;
    markdown += `**Username:** @${channelUsername}\n`;
    markdown += `**Description:** ${channelDescription}\n`;
    markdown += `**Posts scraped:** ${posts.length}\n`;
    markdown += `**Scraped at:** ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;
    
    posts.forEach((post, index) => {
      markdown += `## Post ${index + 1}\n\n`;
      markdown += `**Date:** ${post.date.toISOString()}\n`;
      markdown += `**Views:** ${post.views.toLocaleString()}\n`;
      markdown += `**Link:** ${post.link}\n`;
      markdown += `**Has Media:** ${post.hasMedia ? 'Yes' : 'No'}\n\n`;
      markdown += `${post.content}\n\n`;
      markdown += `---\n\n`;
    });
    
    // Save files
    const dataDir = path.join(process.cwd(), 'scraped_data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const mdFilename = path.join(dataDir, `getrichortech_${timestamp}_partial.md`);
    const jsonFilename = path.join(dataDir, `getrichortech_${timestamp}_partial.json`);
    
    await fs.writeFile(mdFilename, markdown);
    await fs.writeFile(jsonFilename, JSON.stringify(result, null, 2));
    
    console.log(`\nScraping completed!`);
    console.log(`Files saved:`);
    console.log(`- ${mdFilename}`);
    console.log(`- ${jsonFilename}`);
    
    console.log(`\nNOTE: This simple scraper only gets the most recent posts visible on the page.`);
    console.log(`To get ALL posts, you would need to use the full browser-based scraper.`);
    
    return { mdFilename, jsonFilename, totalPosts: posts.length };
    
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  }
}

// Run the scraper
scrapeSimple()
  .then(result => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFailed:', error);
    process.exit(1);
  });