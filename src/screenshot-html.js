import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';

export async function takeScreenshots(htmlDir, outputDir, logCallback) {
  await fs.ensureDir(outputDir);
  
  if (!await fs.pathExists(htmlDir)) {
    logCallback(`HTML 目录不存在: ${htmlDir}`);
    return;
  }

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
      args: [
        '--allow-file-access-from-files',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
        '--disable-web-security'
      ],
      defaultViewport: { width: 800, height: 1600 }
    });
  } catch (err) {
    logCallback(`Puppeteer 启动失败: ${err.message}`);
    
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium'
    ];

    let browserFound = false;
    for (const exePath of possiblePaths) {
      if (fs.existsSync(exePath)) {
        try {
          browser = await puppeteer.launch({
            executablePath: exePath,
            headless: 'new',
            args: [
              '--allow-file-access-from-files',
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--font-render-hinting=none',
              '--disable-web-security'
            ],
            defaultViewport: { width: 800, height: 1600 }
          });
          logCallback(`使用系统浏览器: ${path.basename(exePath)}`);
          browserFound = true;
          break;
        } catch (e) {
          logCallback(`尝试 ${path.basename(exePath)} 失败: ${e.message}`);
          continue;
        }
      }
    }

    if (!browserFound) {
      throw new Error('无法启动任何浏览器，请确保已安装 Chrome 或 Edge');
    }
  }

  try {
    for (const file of files) {
      const page = await browser.newPage();
      
      await page.setDefaultNavigationTimeout(60000);
      
      const fullPath = pathToFileURL(path.resolve(htmlDir, file)).href;

      try {
        logCallback(`正在处理: ${file}`);
        
        await page.goto(fullPath, { 
          waitUntil: 'networkidle0', 
          timeout: 60000 
        });

        // 等待字体加载完成
        await page.evaluate(() => {
          return document.fonts.ready;
        });

        // 额外等待字体渲染
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 强制加载自定义字体
        await page.evaluate(() => {
          return Promise.all([
            document.fonts.load('1em label'),
            document.fonts.load('1em title'),
            document.fonts.load('1em footer')
          ]).then(() => document.fonts.ready);
        });

        // 等待所有图片加载完成
        await page.evaluate(() => {
          return Promise.all(
            Array.from(document.images)
              .filter(img => !img.complete)
              .map(img => new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 5000);
              }))
          );
        });

        // 再次等待渲染
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取实际高度
        const height = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          return Math.max(
            body.scrollHeight,
            html.scrollHeight,
            body.offsetHeight,
            html.offsetHeight
          );
        });
        
        await page.setViewport({ width: 800, height: Math.max(height, 100) });

        const outPath = path.join(outputDir, file.replace('.html', '.png'));
        await page.screenshot({ 
          path: outPath, 
          fullPage: true,
          type: 'png'
        });
        logCallback(`截图已保存: ${path.basename(outPath)}`);
        
      } catch (pageErr) {
        logCallback(`截图失败 (${file}): ${pageErr.message}`);
        
        try {
          logCallback(`尝试备用截图方式...`);
          const outPath = path.join(outputDir, file.replace('.html', '.png'));
          await page.screenshot({ 
            path: outPath, 
            fullPage: true,
            type: 'png'
          });
          logCallback(`备用截图已保存: ${path.basename(outPath)}`);
        } catch (fallbackErr) {
          logCallback(`备用截图也失败: ${fallbackErr.message}`);
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  logCallback('所有截图完成');
}