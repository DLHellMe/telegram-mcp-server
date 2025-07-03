import puppeteer from 'puppeteer';
import { MarkdownFormatter } from './dist/formatters/markdown-formatter.js';
import { DataParser } from './dist/scraper/data-parser.js';
import fs from 'fs/promises';
import path from 'path';

async function scrapeWithWindowsChrome() {
  console.log('Scraping https://t.me/getrichortech using Windows Chrome...\n');
  
  let browser;
  
  try {
    // Launch browser using Windows Chrome
    browser = await puppeteer.launch({
      executablePath: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });
    
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');
    
    const url = 'https://t.me/getrichortech';
    console.log(`Navigating to ${url}...`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded');
    
    // Wait for content to load
    await page.waitForSelector('.tgme_widget_message', { timeout: 10000 }).catch(() => {
      console.log('No messages found with standard selector, trying alternative...');
    });
    
    // Scroll to load all posts
    console.log('Scrolling to load all posts...');
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrollAttempts = 0;
    
    while (previousHeight !== currentHeight && scrollAttempts < 50) {
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 2000));
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      scrollAttempts++;
      console.log(`Scroll attempt ${scrollAttempts}: Height ${currentHeight}`);
    }
    
    console.log('Finished scrolling, extracting data...');
    
    // Extract channel info
    const channelInfo = await page.evaluate(() => {
      const nameEl = document.querySelector('.tgme_page_title span');
      const usernameEl = document.querySelector('.tgme_page_extra');
      const descEl = document.querySelector('.tgme_page_description');
      
      return {
        name: nameEl?.textContent?.trim() || 'Unknown',
        username: usernameEl?.textContent?.replace('@', '').trim() || 'unknown',
        description: descEl?.textContent?.trim() || ''
      };
    });
    
    console.log('Channel info:', channelInfo);
    
    // Extract posts
    const posts = await page.evaluate(() => {
      const postElements = document.querySelectorAll('.tgme_widget_message');
      const postsData = [];
      
      postElements.forEach(post => {
        const contentEl = post.querySelector('.tgme_widget_message_text');
        const dateEl = post.querySelector('.tgme_widget_message_date time');
        const viewsEl = post.querySelector('.tgme_widget_message_views');
        const linkEl = post.querySelector('.tgme_widget_message_date');
        
        if (contentEl || post.querySelector('.tgme_widget_message_photo')) {
          postsData.push({
            content: contentEl?.innerHTML || '',
            date: dateEl?.getAttribute('datetime') || '',
            views: viewsEl?.textContent?.trim() || '0',
            link: linkEl?.getAttribute('href') || '',
            hasMedia: !!post.querySelector('.tgme_widget_message_photo, .tgme_widget_message_video')
          });
        }
      });
      
      return postsData;
    });
    
    console.log(`Found ${posts.length} posts`);
    
    // Parse and format the data
    const parser = new DataParser();
    const formatter = new MarkdownFormatter();
    
    // Create proper result object
    const result = {
      channel: {
        name: channelInfo.name,
        username: channelInfo.username,
        description: channelInfo.description,
        subscriberCount: null,
        verified: false
      },
      posts: posts.map(post => ({
        id: '',
        content: post.content.replace(/<[^>]*>/g, ''), // Strip HTML
        date: new Date(post.date),
        views: parseInt(post.views.replace(/[^\d]/g, '')) || 0,
        link: post.link,
        hasMedia: post.hasMedia,
        reactions: []
      })),
      totalPosts: posts.length,
      scrapedAt: new Date()
    };
    
    // Format as markdown
    const markdown = formatter.format(result);
    
    // Save files
    const dataDir = path.join(process.cwd(), 'scraped_data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const mdFilename = path.join(dataDir, `getrichortech_${timestamp}_full.md`);
    const jsonFilename = path.join(dataDir, `getrichortech_${timestamp}_full.json`);
    
    await fs.writeFile(mdFilename, markdown);
    await fs.writeFile(jsonFilename, JSON.stringify(result, null, 2));
    
    console.log(`\nScraping completed successfully!`);
    console.log(`Total posts: ${posts.length}`);
    console.log(`Files saved:`);
    console.log(`- ${mdFilename}`);
    console.log(`- ${jsonFilename}`);
    
    return { mdFilename, jsonFilename, totalPosts: posts.length };
    
  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the scraper
scrapeWithWindowsChrome()
  .then(result => {
    console.log('\nSuccess! Now reading the markdown file to analyze content...');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFailed:', error);
    process.exit(1);
  });