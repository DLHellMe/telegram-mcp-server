#!/usr/bin/env node

import { readFile, access } from 'fs/promises';
import { join } from 'path';

async function checkAuthStatus() {
  const cookieFilePath = join('C:\\Users\\User\\AppData\\Roaming\\Claude\\telegram_scraped_data', 'telegram_cookies.json');
  
  try {
    // Check if cookie file exists
    await access(cookieFilePath);
    
    // Read cookies from file
    const cookieData = await readFile(cookieFilePath, 'utf8');
    const cookies = JSON.parse(cookieData);
    
    if (Array.isArray(cookies) && cookies.length > 0) {
      console.log('✅ Authenticated with Telegram');
      console.log(`Found ${cookies.length} cookies`);
      
      // Show some cookie info (without sensitive data)
      const domains = [...new Set(cookies.map(c => c.domain))];
      console.log('Cookie domains:', domains.join(', '));
      
      // Check for specific Telegram auth cookies
      const authCookies = cookies.filter(c => 
        c.name.includes('stel_') || 
        c.name.includes('auth') || 
        c.name.includes('dc')
      );
      
      if (authCookies.length > 0) {
        console.log(`Found ${authCookies.length} authentication-related cookies`);
      }
    } else {
      console.log('❌ Not authenticated - No valid cookies found');
    }
  } catch (error) {
    console.log('❌ Not authenticated - No cookie file found');
    console.log('Cookie file location:', cookieFilePath);
  }
}

checkAuthStatus().catch(console.error);