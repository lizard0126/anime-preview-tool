import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const OUTPUT_DIR = './output';
const SCREENSHOT_DIR = './screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR);
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME_PATH,
  defaultViewport: { width: 800, height: 1600 }
});

const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html'));

for (const file of files) {
  const page = await browser.newPage();
  const fullPath = 'file://' + path.resolve(OUTPUT_DIR, file);

  await page.goto(fullPath, { waitUntil: 'networkidle0' });

  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewport({ width: 800, height });

  const outPath = path.join(SCREENSHOT_DIR, file.replace('.html', '.png'));
  await page.screenshot({ path: outPath });
  console.log(`已截图：${outPath}`);
  await page.close();
}

await browser.close();
