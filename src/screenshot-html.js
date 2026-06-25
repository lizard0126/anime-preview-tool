import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';

const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
];

export async function takeScreenshots(htmlDir, outputDir, logCallback) {
  await fs.ensureDir(outputDir);
  const files = (await fs.readdir(htmlDir)).filter(f => f.endsWith('.html'));
  if (!files.length) { logCallback('没有找到 HTML 文件'); return; }

  logCallback(`发现 ${files.length} 个 HTML 文件`);
  const browser = await launchBrowser(logCallback);
  if (!browser) return;

  try {
    for (const file of files) {
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(60000);
      try {
        const url = pathToFileURL(path.resolve(htmlDir, file)).href;
        logCallback(`正在处理: ${file}`);
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(() => Promise.all([
          document.fonts.load('1em label'),
          document.fonts.load('1em title'),
          document.fonts.load('1em footer')
        ]));
        await page.evaluate(() => Promise.all(
          Array.from(document.images).filter(i => !i.complete).map(i => new Promise(r => { i.onload = r; i.onerror = r; setTimeout(r, 5000); }))
        ));
        const h = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
        await page.setViewport({ width: 800, height: Math.max(h, 100) });
        await page.screenshot({ path: path.join(outputDir, file.replace('.html', '.png')), fullPage: true, type: 'png' });
        logCallback(`截图已保存: ${file.replace('.html', '.png')}`);
      } catch (err) { logCallback(`截图失败 (${file}): ${err.message}`); }
      finally { await page.close(); }
    }
  } finally { await browser.close(); }
}

async function launchBrowser(logCallback) {
  try {
    return await puppeteer.launch({
      headless: 'new',
      args: ['--allow-file-access-from-files', '--no-sandbox', '--font-render-hinting=none'],
      defaultViewport: { width: 800, height: 1600 }
    });
  } catch {
    for (const exePath of BROWSER_PATHS) {
      if (fs.existsSync(exePath)) {
        try {
          const browser = await puppeteer.launch({
            executablePath: exePath,
            headless: 'new',
            args: ['--allow-file-access-from-files', '--no-sandbox', '--font-render-hinting=none'],
            defaultViewport: { width: 800, height: 1600 }
          });
          logCallback(`使用系统浏览器: ${path.basename(exePath)}`);
          return browser;
        } catch {}
      }
    }
    logCallback('无法启动任何浏览器');
    return null;
  }
}