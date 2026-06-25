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
          "img-src 'self' data: blob: file:; " +
          "font-src 'self' data: file:; " +
          "style-src 'self' 'unsafe-inline'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' file:;"
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
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      ...options,
      properties: options.properties || ['openFile']
    });
    return result.filePaths;
  } catch (err) {
    console.error('文件选择失败:', err);
    return [];
  }
});

// 选择目录
ipcMain.handle('dialog:openDirectory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.filePaths[0];
  } catch (err) {
    console.error('目录选择失败:', err);
    return '';
  }
});

// 加载 JSON
ipcMain.handle('json:load', async (event, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: '文件路径为空' };
    }
    if (!await fs.pathExists(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    const data = await fs.readJson(filePath);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 保存 JSON
ipcMain.handle('json:save', async (event, data, dir) => {
  try {
    if (!dir) {
      return { success: false, error: '目录路径为空' };
    }
    await fs.ensureDir(dir);
    const jsonPath = path.join(dir, 'project.json');
    await fs.writeJson(jsonPath, data, { spaces: 2 });
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

  let processorPath;
  if (app.isPackaged) {
    processorPath = path.join(process.resourcesPath, 'src', 'processor.js');
    if (!fs.existsSync(processorPath)) {
      processorPath = path.join(app.getAppPath(), 'src', 'processor.js');
    }
  } else {
    processorPath = path.join(__dirname, 'src', 'processor.js');
  }
  
  if (!fs.existsSync(processorPath)) {
    event.sender.send('log', `错误: processor.js 文件不存在: ${processorPath}`);
    return { success: false, error: `processor.js 文件不存在: ${processorPath}` };
  }
  
  const processorUrl = pathToFileURL(processorPath).href;
  
  try {
    const { processAnimePreview } = await import(processorUrl);

    const sendLog = (msg) => {
      event.sender.send('log', msg);
    };

    const result = await processAnimePreview({ data, outputDir }, sendLog);
    event.sender.send('process:done', result);
    return { success: true, outputDir: result.outputDir };
  } catch (err) {
    event.sender.send('log', `错误: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// 预览处理
ipcMain.handle('process:preview', async (event, previewData) => {
  try {
    if (!previewData) {
      return { success: false, error: '预览数据为空' };
    }

    const { generateHtml } = await import('./src/generate-html.js');
    const ejsDir = path.join(__dirname, 'src', 'page.ejs');
    
    if (!await fs.pathExists(ejsDir)) {
      return { success: false, error: `模板文件不存在: ${ejsDir}` };
    }
    
    const tempDir = path.join(app.getPath('temp'), 'anime-preview-' + Date.now());
    await fs.ensureDir(tempDir);
    
    // 创建临时素材目录
    const avatarDir = path.join(tempDir, 'avatar');
    const visualDir = path.join(tempDir, 'visual');
    const fontDir = path.join(tempDir, 'fonts');
    
    await fs.ensureDir(avatarDir);
    await fs.ensureDir(visualDir);
    await fs.ensureDir(fontDir);
    
    // 复制字体文件到临时目录
    const srcFontDir = path.join(__dirname, 'src', 'fonts');
    if (await fs.pathExists(srcFontDir)) {
      try {
        const fontFiles = await fs.readdir(srcFontDir);
        for (const fontFile of fontFiles) {
          const srcPath = path.join(srcFontDir, fontFile);
          if (await fs.pathExists(srcPath)) {
            const ext = path.extname(fontFile).toLowerCase();
            if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) {
              await fs.copy(srcPath, path.join(fontDir, fontFile));
            }
          }
        }
      } catch (fontErr) {
        console.error('字体复制失败:', fontErr);
      }
    }
    
    // 深拷贝预览数据
    const previewDataCopy = JSON.parse(JSON.stringify(previewData));
    
    // 处理视觉图
    if (previewDataCopy.visual) {
      if (previewDataCopy.visual.startsWith('http')) {
        try {
          const { default: axios } = await import('axios');
          const response = await axios.get(previewDataCopy.visual, { 
            responseType: 'arraybuffer',
            timeout: 30000 
          });
          const contentType = response.headers['content-type'] || '';
          let ext = '.jpg';
          if (contentType.includes('png')) ext = '.png';
          else if (contentType.includes('webp')) ext = '.webp';
          
          const visualName = `visual_${Date.now()}${ext}`;
          await fs.writeFile(path.join(visualDir, visualName), response.data);
          previewDataCopy.visual = `visual/${visualName}`;
        } catch (downloadErr) {
          console.error('视觉图下载失败:', downloadErr.message);
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
            const response = await axios.get(comment.avatar, { 
              responseType: 'arraybuffer',
              timeout: 30000 
            });
            const contentType = response.headers['content-type'] || '';
            let ext = '.jpg';
            if (contentType.includes('png')) ext = '.png';
            else if (contentType.includes('webp')) ext = '.webp';
            
            const avatarName = `avatar_${Date.now()}_${i}${ext}`;
            await fs.writeFile(path.join(avatarDir, avatarName), response.data);
            comment.avatar = `avatar/${avatarName}`;
          } catch (downloadErr) {
            console.error('头像下载失败:', downloadErr.message);
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
    await generateHtml([previewDataCopy], ejsDir, tempDir, () => {});
    
    // 读取生成的 HTML
    const files = await fs.readdir(tempDir);
    const htmlFile = files.find(f => f.endsWith('.html'));
    
    if (htmlFile) {
      const htmlPath = path.join(tempDir, htmlFile);
      let htmlContent = await fs.readFile(htmlPath, 'utf-8');
      
      // 嵌入所有资源为 base64
      htmlContent = await embedAllResources(htmlContent, tempDir);
      
      // 清理临时文件
      setTimeout(async () => {
        try {
          await fs.remove(tempDir);
        } catch (e) {
          // 忽略清理错误
        }
      }, 1000);
      
      return { success: true, html: htmlContent };
    } else {
      await fs.remove(tempDir).catch(() => {});
      return { success: false, error: '生成 HTML 失败' };
    }
  } catch (err) {
    console.error('预览处理失败:', err);
    return { success: false, error: err.message };
  }
});

// 嵌入所有资源为 base64
async function embedAllResources(htmlContent, baseDir) {
  let result = htmlContent;
  
  // 处理所有图片标签
  const imgRegex = /<img([^>]*)src="([^"]+)"([^>]*)>/g;
  let match;
  let imgMatches = [];
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    imgMatches.push({
      fullMatch: match[0],
      beforeSrc: match[1],
      src: match[2],
      afterSrc: match[3]
    });
  }

  for (const imgMatch of imgMatches) {
    const { fullMatch, beforeSrc, src, afterSrc } = imgMatch;
    
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      continue;
    }
    
    try {
      let filePath;
      if (src.startsWith('file://')) {
        filePath = decodeURIComponent(src.replace('file:///', '')).replace(/\\/g, '/');
        if (process.platform === 'win32') {
          filePath = filePath.replace(/^\//, '');
        }
      } else {
        const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
        filePath = path.join(baseDir, cleanSrc);
      }
      
      if (await fs.pathExists(filePath)) {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        
        const base64 = buffer.toString('base64');
        const newSrc = `data:${mimeType};base64,${base64}`;
        const newImg = `<img${beforeSrc}src="${newSrc}"${afterSrc}>`;
        result = result.replace(fullMatch, newImg);
      } else {
        // 文件不存在，使用占位图
        const placeholder = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eee"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#999" font-size="12">无图</text></svg>').toString('base64');
        const newImg = `<img${beforeSrc}src="${placeholder}"${afterSrc}>`;
        result = result.replace(fullMatch, newImg);
      }
    } catch (err) {
      console.error('图片嵌入失败:', err);
    }
  }
  
  // 处理字体文件 (@font-face 中的 url)
  const fontRegex = /url\(['"]?([^'")]+\.(ttf|otf|woff|woff2))['"]?\)/gi;
  let fontMatch;
  let fontMatches = [];
  
  while ((fontMatch = fontRegex.exec(result)) !== null) {
    fontMatches.push({
      fullMatch: fontMatch[0],
      fontPath: fontMatch[1]
    });
  }

  for (const fontMatch of fontMatches) {
    const { fullMatch, fontPath } = fontMatch;
    
    if (fontPath.startsWith('data:')) {
      continue;
    }
    
    try {
      let filePath;
      if (fontPath.startsWith('file://')) {
        filePath = decodeURIComponent(fontPath.replace('file:///', '')).replace(/\\/g, '/');
        if (process.platform === 'win32') {
          filePath = filePath.replace(/^\//, '');
        }
      } else {
        const cleanPath = fontPath.replace(/^\.\//, '').replace(/^\//, '');
        filePath = path.join(baseDir, cleanPath);
      }
      
      if (await fs.pathExists(filePath)) {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'font/ttf';
        if (ext === '.otf') mimeType = 'font/otf';
        else if (ext === '.woff') mimeType = 'font/woff';
        else if (ext === '.woff2') mimeType = 'font/woff2';
        
        const base64 = buffer.toString('base64');
        const newUrl = `url('data:${mimeType};base64,${base64}')`;
        result = result.replace(fullMatch, newUrl);
      }
    } catch (err) {
      console.error('字体嵌入失败:', err);
    }
  }
  
  return result;
}

// 读取文件内容（用于渲染进程加载本地文件）
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    if (await fs.pathExists(filePath)) {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.ttf') mimeType = 'font/ttf';
      else if (ext === '.otf') mimeType = 'font/otf';
      
      return {
        success: true,
        data: buffer.toString('base64'),
        mimeType: mimeType
      };
    }
    return { success: false, error: '文件不存在' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 读取字体文件
ipcMain.handle('file:readFont', async (event, fontName) => {
  try {
    const fontPath = path.join(__dirname, 'src', 'fonts', fontName);
    if (await fs.pathExists(fontPath)) {
      const buffer = await fs.readFile(fontPath);
      return {
        success: true,
        data: buffer.toString('base64'),
        fontName: fontName
      };
    }
    return { success: false, error: '字体文件不存在' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 批量读取字体文件
ipcMain.handle('file:readAllFonts', async () => {
  try {
    const fontDir = path.join(__dirname, 'src', 'fonts');
    if (!await fs.pathExists(fontDir)) {
      return { success: false, error: '字体目录不存在' };
    }
    
    const files = await fs.readdir(fontDir);
    const fonts = {};
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
        const filePath = path.join(fontDir, file);
        const buffer = await fs.readFile(filePath);
        fonts[file] = buffer.toString('base64');
      }
    }
    
    return { success: true, fonts };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 清理预览临时文件
ipcMain.handle('preview:cleanup', async (event, tempDir) => {
  try {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 应用退出时清理临时目录
app.on('before-quit', async () => {
  const tempDir = app.getPath('temp');
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      if (file.startsWith('anime-preview-')) {
        try {
          await fs.remove(path.join(tempDir, file));
        } catch (e) {
          // 忽略清理错误
        }
      }
    }
  } catch (e) {
    // 忽略清理错误
  }
});