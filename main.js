import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

app.whenReady().then(() => {
    createWindow();
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700, 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        icon: path.join(__dirname, 'assets', 'icon.ico')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

}

// 选择文件
ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.filePaths;
});

// 选择目录
ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// 处理开始按钮
ipcMain.handle('process:start', async (event, config) => {
    const { docxPath, avatarFiles, outputDir } = config;

    let processorPath;

    if (app.isPackaged) {
        processorPath = path.join(app.getAppPath(), 'src', 'processor.js');
    } else {
        processorPath = path.join(__dirname, 'src', 'processor.js');
    }
    const processorUrl = pathToFileURL(processorPath).href;
    const { processAnimePreview } = await import(processorUrl);

    const sendLog = (msg) => {
        event.sender.send('log', msg);
    };

    try {
        const result = await processAnimePreview({
            docxPath,
            avatarFiles,
            outputDir
        }, sendLog);
        event.sender.send('process:done', result);
        return { success: true };
    } catch (err) {
        sendLog(`错误: ${err.message}`);
        return { success: false, error: err.message };
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});