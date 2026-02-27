import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('select-directory'),

  scanDirectory: (dirPath: string, recursive: boolean): Promise<unknown> =>
    ipcRenderer.invoke('scan-directory', dirPath, recursive),

  readFileBytes: (filePath: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('read-file-bytes', filePath),

  getConfig: (): Promise<unknown> =>
    ipcRenderer.invoke('get-config'),

  setConfig: (cfg: unknown): Promise<void> =>
    ipcRenderer.invoke('set-config', cfg)
})
