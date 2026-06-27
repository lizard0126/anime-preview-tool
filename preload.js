import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  selectFiles: (options) => ipcRenderer.invoke('dialog:openFile', { ...options, properties: ['openFile', 'multiSelections'] }),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options), // 新增
  loadJson: (path) => ipcRenderer.invoke('json:load', path),
  saveJson: (data, path) => ipcRenderer.invoke('json:save', data, path),
  fetchAnimeList: (season) => ipcRenderer.invoke('anime:fetch', season),
  startProcess: (config) => ipcRenderer.invoke('process:start', config),
  generatePreview: (data) => ipcRenderer.invoke('process:preview', data),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  readAllFonts: () => ipcRenderer.invoke('file:readAllFonts'),
  onLog: (callback) => ipcRenderer.on('log', (_, msg) => callback(msg)),
  onDone: (callback) => ipcRenderer.on('process:done', (_, result) => callback(result)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});