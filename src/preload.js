// src/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileDialog: (defaultPath) => ipcRenderer.invoke('save-file-dialog', defaultPath),
  saveAndWriteFile: (defaultPath, data) => ipcRenderer.invoke('save-and-write-file', defaultPath, data),
  logMessage: (message) => ipcRenderer.send('log-message', message)
});
