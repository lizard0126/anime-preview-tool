import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  selectFiles: (options) =>
    ipcRenderer.invoke('dialog:openFile', {
      ...options,
      properties: ['openFile', 'multiSelections']
    }),

  selectDirectory: () =>
    ipcRenderer.invoke('dialog:openDirectory'),

  loadJson: (path) => ipcRenderer.invoke('json:load', path),

  saveJson: (data, dir) => ipcRenderer.invoke('json:save', data, dir),

  fetchAnimeList: (season) => ipcRenderer.invoke('anime:fetch', season),

  startProcess: (config) =>
    ipcRenderer.invoke('process:start', config),

  generatePreview: (data) =>
    ipcRenderer.invoke('process:preview', data),

  cleanupPreview: (tempDir) =>
    ipcRenderer.invoke('preview:cleanup', tempDir),

  readFile: (filePath) =>
    ipcRenderer.invoke('file:read', filePath),

  readFont: (fontName) =>
    ipcRenderer.invoke('file:readFont', fontName),

  readAllFonts: () =>
    ipcRenderer.invoke('file:readAllFonts'),

  onLog: (callback) =>
    ipcRenderer.on('log', (_, msg) => callback(msg)),

  onDone: (callback) =>
    ipcRenderer.on('process:done', (_, result) => callback(result)),

  onPreview: (callback) =>
    ipcRenderer.on('preview:done', (_, html) => callback(html)),

  removeAllListeners: (channel) =>
    ipcRenderer.removeAllListeners(channel)
});