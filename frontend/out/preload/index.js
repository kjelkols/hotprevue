"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
  scanDirectory: (dirPath, recursive) => electron.ipcRenderer.invoke("scan-directory", dirPath, recursive),
  readFileBytes: (filePath) => electron.ipcRenderer.invoke("read-file-bytes", filePath),
  getConfig: () => electron.ipcRenderer.invoke("get-config"),
  setConfig: (cfg) => electron.ipcRenderer.invoke("set-config", cfg)
});
