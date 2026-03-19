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

  startProcess: (config) =>
    ipcRenderer.invoke('process:start', config),

  onLog: (callback) =>
    ipcRenderer.on('log', (_, msg) => callback(msg)),

  onDone: (callback) =>
    ipcRenderer.on('process:done', (_, result) => callback(result))
});