import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';

export async function takeScreenshots(htmlDir, outputDir, logCallback) {
  await fs.ensureDir(outputDir);
  const files = (await fs.readdir(htmlDir)).filter(f => f.endsWith('.html'));

  if (files.length === 0) {
    logCallback('没有找到 HTML 文件，跳过截图');
    return;
  }

  logCallback(`发现 ${files.length} 个 HTML 文件`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files'],
    defaultViewport: { width: 800, height: 1600 }
  });

  for (const file of files) {
    const page = await browser.newPage();
    const fullPath = pathToFileURL(path.resolve(htmlDir, file)).href;

    await page.goto(fullPath, { waitUntil: 'networkidle0' });

    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 800, height });

    const outPath = path.join(outputDir, file.replace('.html', '.png'));
    await page.screenshot({ path: outPath, fullPage: true });
    logCallback(`截图已保存: ${outPath}`);
    await page.close();
  }

  await browser.close();
  logCallback('所有截图完成');
}