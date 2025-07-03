# System Requirements for Telegram MCP Server

## Chromium Dependencies

Puppeteer requires certain system libraries to run Chromium. If you encounter errors when running Puppeteer, you may need to install these dependencies:

### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libxtst6
```

### Alternative: Using System Chrome

If you have Chrome or Chromium installed on your system, you can configure Puppeteer to use it instead:

```typescript
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', // or '/usr/bin/chromium'
  headless: true
});
```

### Windows

On Windows, Puppeteer should work out of the box as it downloads a compatible Chromium version.

### macOS

On macOS, Puppeteer should work out of the box. If you encounter issues, you may need to install Xcode Command Line Tools:
```bash
xcode-select --install
```

## Node.js Version

This project requires Node.js version 18.0.0 or higher.