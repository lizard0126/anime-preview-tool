import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

app.whenReady().then(() => {
  createWindow();
});

// 获取字体目录（兼容开发环境和打包环境）
function getFontDir() {
  // 开发环境
  const devFontDir = path.join(__dirname, 'src', 'fonts');
  if (fs.existsSync(devFontDir)) {
    return devFontDir;
  }

  // 打包环境 - 检查多个可能路径
  const possiblePaths = [
    path.join(process.resourcesPath, 'fonts'),
    path.join(process.resourcesPath, 'src', 'fonts'),
    path.join(__dirname, '..', 'resources', 'fonts'),
    path.join(app.getAppPath(), 'src', 'fonts'),
    path.join(process.cwd(), 'src', 'fonts')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // 如果都不存在，列出 resourcesPath 内容
  try {
    const items = fs.readdirSync(process.resourcesPath);
    items.forEach(item => console.log('  ', item));
  } catch (e) {
    console.log(e.message);
  }

  return devFontDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  // 设置 Content-Security-Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "img-src 'self' data: blob:; " +
          "font-src 'self' data:; " +
          "style-src 'self' 'unsafe-inline'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "connect-src 'self';"
        ]
      }
    });
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

// 选择文件
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options || {});
  return result.filePaths;
});

// 选择目录
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.filePaths[0] || '';
});

// 保存文件对话框
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options || {});
  return result.filePath || '';
});

// 加载 JSON
ipcMain.handle('json:load', async (event, filePath) => {
  try {
    const data = await fs.readJson(filePath);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 保存 JSON（支持指定文件路径）
ipcMain.handle('json:save', async (event, data, filePath) => {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data, { spaces: 2 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 抓取动画列表
ipcMain.handle('anime:fetch', async (event, season) => {
  try {
    const { fetchAnimeList } = await import('./src/fetchAnimeList.js');
    const animeList = await fetchAnimeList(season);
    event.sender.send('log', `成功抓取 ${animeList.length} 部动画`);
    return { success: true, data: animeList };
  } catch (err) {
    event.sender.send('log', `抓取失败: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// 处理开始按钮
ipcMain.handle('process:start', async (event, config) => {
  const { data, outputDir } = config;
  const processorPath = path.join(__dirname, 'src', 'processor.js');

  try {
    const { processAnimePreview } = await import(pathToFileURL(processorPath).href);
    const sendLog = (msg) => event.sender.send('log', msg);
    const result = await processAnimePreview({ data, outputDir }, sendLog);
    event.sender.send('process:done', result);
    return result;
  } catch (err) {
    event.sender.send('log', `错误: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// 预览处理 - 将所有资源嵌入为 base64
ipcMain.handle('process:preview', async (event, previewData) => {
  try {
    const { generateHtml } = await import('./src/generate-html.js');
    const ejsDir = path.join(__dirname, 'src', 'page.ejs');

    const tempDir = path.join(app.getPath('temp'), 'anime-preview-' + Date.now());
    await fs.ensureDir(tempDir);

    // 创建临时素材目录
    const avatarDir = path.join(tempDir, 'avatar');
    const visualDir = path.join(tempDir, 'visual');
    const fontDir = path.join(tempDir, 'fonts');
    await fs.ensureDir(avatarDir);
    await fs.ensureDir(visualDir);
    await fs.ensureDir(fontDir);

    // 复制字体文件到临时目录 - 使用 getFontDir()
    const srcFontDir = getFontDir();

    if (await fs.pathExists(srcFontDir)) {
      const fontFiles = await fs.readdir(srcFontDir);
      for (const fontFile of fontFiles) {
        const srcPath = path.join(srcFontDir, fontFile);
        if (['.ttf', '.otf', '.woff', '.woff2'].includes(path.extname(fontFile))) {
          await fs.copy(srcPath, path.join(fontDir, fontFile));
        }
      }
    }

    // 深拷贝并处理预览数据
    const previewDataCopy = JSON.parse(JSON.stringify(previewData));

    // 处理视觉图
    if (previewDataCopy.visual) {
      if (previewDataCopy.visual.startsWith('http')) {
        try {
          const { default: axios } = await import('axios');
          const response = await axios.get(previewDataCopy.visual, { responseType: 'arraybuffer', timeout: 30000 });
          const ext = response.headers['content-type'].includes('png') ? '.png' : '.jpg';
          const visualName = `visual_${Date.now()}${ext}`;
          await fs.writeFile(path.join(visualDir, visualName), response.data);
          previewDataCopy.visual = `visual/${visualName}`;
        } catch {
          previewDataCopy.visual = '';
        }
      } else if (await fs.pathExists(previewDataCopy.visual)) {
        const visualName = path.basename(previewDataCopy.visual);
        await fs.copy(previewDataCopy.visual, path.join(visualDir, visualName));
        previewDataCopy.visual = `visual/${visualName}`;
      } else {
        previewDataCopy.visual = '';
      }
    }

    // 处理头像
    const comments = previewDataCopy.comments || [];
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      if (comment.avatar) {
        if (comment.avatar.startsWith('http')) {
          try {
            const { default: axios } = await import('axios');
            const response = await axios.get(comment.avatar, { responseType: 'arraybuffer', timeout: 30000 });
            const ext = response.headers['content-type'].includes('png') ? '.png' : '.jpg';
            const avatarName = `avatar_${Date.now()}_${i}${ext}`;
            await fs.writeFile(path.join(avatarDir, avatarName), response.data);
            comment.avatar = `avatar/${avatarName}`;
          } catch {
            comment.avatar = '';
          }
        } else if (await fs.pathExists(comment.avatar)) {
          const avatarName = path.basename(comment.avatar);
          await fs.copy(comment.avatar, path.join(avatarDir, avatarName));
          comment.avatar = `avatar/${avatarName}`;
        } else {
          comment.avatar = '';
        }
      }
    }

    // 生成 HTML
    await generateHtml([previewDataCopy], ejsDir, tempDir, () => { });

    // 读取并嵌入资源
    const files = await fs.readdir(tempDir);
    const htmlFile = files.find(f => f.endsWith('.html'));

    if (htmlFile) {
      let htmlContent = await fs.readFile(path.join(tempDir, htmlFile), 'utf-8');
      htmlContent = await embedResources(htmlContent, tempDir);

      setTimeout(() => fs.remove(tempDir).catch(() => { }), 1000);
      return { success: true, html: htmlContent };
    }

    await fs.remove(tempDir).catch(() => { });
    return { success: false, error: '生成 HTML 失败' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 嵌入资源为 base64
async function embedResources(htmlContent, baseDir) {
  let result = htmlContent;

  // 处理图片标签
  const imgRegex = /<img([^>]*)src="([^"]+)"([^>]*)>/g;
  const imgMatches = [];
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    imgMatches.push(match);
  }

  for (const m of imgMatches) {
    const [full, before, src, after] = m;
    if (src.startsWith('data:') || src.startsWith('http')) continue;

    try {
      const cleanSrc = src.replace(/^\.\//, '');
      const filePath = path.join(baseDir, cleanSrc);
      if (await fs.pathExists(filePath)) {
        const buffer = await fs.readFile(filePath);
        const extMap = { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
        const mime = extMap[path.extname(filePath)] || 'image/jpeg';
        const newSrc = `data:${mime};base64,${buffer.toString('base64')}`;
        result = result.replace(full, `<img${before}src="${newSrc}"${after}>`);
      }
    } catch { }
  }

  // 处理字体
  const fontRegex = /url\(['"]?([^'")]+\.(ttf|otf|woff|woff2))['"]?\)/gi;
  const fontMatches = [];
  while ((match = fontRegex.exec(result)) !== null) {
    fontMatches.push(match);
  }

  for (const m of fontMatches) {
    const [full, fontPath] = m;
    if (fontPath.startsWith('data:')) continue;

    try {
      const cleanPath = fontPath.replace(/^\.\//, '');
      const filePath = path.join(baseDir, cleanPath);
      if (await fs.pathExists(filePath)) {
        const buffer = await fs.readFile(filePath);
        const extMap = { '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
        const mime = extMap[path.extname(filePath)] || 'font/ttf';
        const newUrl = `url('data:${mime};base64,${buffer.toString('base64')}')`;
        result = result.replace(full, newUrl);
      }
    } catch { }
  }

  return result;
}

// 批量读取字体文件（修复打包路径）
ipcMain.handle('file:readAllFonts', async () => {
  try {
    const fontDir = getFontDir();

    const fonts = {};
    if (await fs.pathExists(fontDir)) {
      const files = await fs.readdir(fontDir);

      for (const file of files) {
        if (['.ttf', '.otf', '.woff', '.woff2'].includes(path.extname(file))) {
          const filePath = path.join(fontDir, file);
          const buffer = await fs.readFile(filePath);
          fonts[file] = buffer.toString('base64');
        }
      }
    }

    return { success: true, fonts };
  } catch (err) {
    console.error('字体加载错误:', err);
    return { success: false, error: err.message, fonts: {} };
  }
});

// 读取文件
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    if (await fs.pathExists(filePath)) {
      const buffer = await fs.readFile(filePath);
      const extMap = { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf' };
      const mime = extMap[path.extname(filePath)] || 'image/jpeg';
      return { success: true, data: buffer.toString('base64'), mimeType: mime };
    }
    return { success: false, error: '文件不存在' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  const tempDirBase = app.getPath('temp');
  try {
    const files = await fs.readdir(tempDirBase);
    for (const file of files) {
      if (file.startsWith('anime-preview-')) {
        await fs.remove(path.join(tempDirBase, file)).catch(() => { });
      }
    }
  } catch { }
});