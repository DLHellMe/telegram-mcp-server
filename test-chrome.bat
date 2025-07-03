@echo off
echo Testing Chrome launch...
cd /d C:\vibe_m\tgmcp
node -e "const puppeteer = require('puppeteer'); puppeteer.launch({headless: false, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'}).then(b => { console.log('Chrome launched!'); setTimeout(() => b.close(), 3000); }).catch(e => console.error('Error:', e.message));"
pause