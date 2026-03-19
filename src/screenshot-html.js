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

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--allow-file-access-from-files'],
      defaultViewport: { width: 800, height: 1600 }
    });
  } catch (err) {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      // 如果用户将浏览器安装在其他位置，可以继续添加常见路径
    ];

    for (const exePath of possiblePaths) {
      if (fs.existsSync(exePath)) {
        try {
          browser = await puppeteer.launch({
            executablePath: exePath,
            headless: 'new',
            args: ['--allow-file-access-from-files'],
            defaultViewport: { width: 800, height: 1600 }
          });
          logCallback(`使用系统浏览器: ${path.basename(exePath)}`);
          break;
        } catch (e) {
        }
      }
    }

    if (!browser) {
      throw new Error('无法启动任何浏览器，请确保已安装 Chrome 或 Edge');
    }
  }

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