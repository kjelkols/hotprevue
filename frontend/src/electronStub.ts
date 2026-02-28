// Stub for running in browser without Electron (dev/preview only).
// Provides enough of the window.electron API to let the UI render.
if (typeof window !== 'undefined' && !window.electron) {
  window.electron = {
    selectDirectory: async () => {
      const path = prompt('Stub: skriv inn katalogsti')
      return path ?? null
    },
    scanDirectory: async (dirPath, _recursive) => {
      console.warn('[stub] scanDirectory', dirPath)
      return { groups: [], totalFiles: 0 }
    },
    readFileBytes: async (filePath) => {
      console.warn('[stub] readFileBytes', filePath)
      return new Uint8Array()
    },
    getConfig: async () => {
      const stored = localStorage.getItem('hotprevue-config')
      return stored ? JSON.parse(stored) : null
    },
    setConfig: async (cfg) => {
      localStorage.setItem('hotprevue-config', JSON.stringify(cfg))
    },
    getSettings: async () => {
      const stored = localStorage.getItem('hotprevue-settings')
      return stored ? JSON.parse(stored) : null
    },
    setSettings: async (s) => {
      localStorage.setItem('hotprevue-settings', JSON.stringify(s))
    },
    chooseDataDir: async () => {
      const path = prompt('Stub: skriv inn datakatalog')
      return path ?? null
    }
  }
}
