import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join, extname, basename } from 'path'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { spawn, ChildProcess } from 'child_process'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppConfig {
  backendUrl: string
}

interface AppSettings {
  data_dir: string
}

interface CompanionFile {
  path: string
  type: string
}

interface FileGroup {
  masterPath: string
  masterType: string
  companions: CompanionFile[]
}

interface ScanResult {
  groups: FileGroup[]
  totalFiles: number
}

// ─── File extensions ──────────────────────────────────────────────────────────

const MASTER_EXTS: Record<string, string[]> = {
  JPEG: ['.jpg', '.jpeg'],
  PNG: ['.png'],
  TIFF: ['.tif', '.tiff'],
  HEIC: ['.heic', '.heif'],
  RAW: ['.nef', '.cr2', '.cr3', '.arw', '.dng', '.orf', '.rw2', '.pef']
}

const XMP_EXTS = ['.xmp']

function getType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  for (const [type, exts] of Object.entries(MASTER_EXTS)) {
    if (exts.includes(ext)) return type
  }
  if (XMP_EXTS.includes(ext)) return 'XMP'
  return 'UNKNOWN'
}

function allMasterExts(): string[] {
  return Object.values(MASTER_EXTS).flat()
}

// ─── Directory scanning ───────────────────────────────────────────────────────

function getFiles(dirPath: string, recursive: boolean): string[] {
  const results: string[] = []
  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory() && recursive) {
      results.push(...getFiles(fullPath, recursive))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

function scanDirectory(dirPath: string, recursive: boolean): ScanResult {
  const files = getFiles(dirPath, recursive)
  const allKnownExts = [...allMasterExts(), ...XMP_EXTS]

  const relevant = files.filter(f => allKnownExts.includes(extname(f).toLowerCase()))
  const totalFiles = files.length

  // Group by stem (filename without extension, lowercased)
  const byStem = new Map<string, string[]>()
  for (const f of relevant) {
    const stem = basename(f, extname(f)).toLowerCase()
    const existing = byStem.get(stem)
    if (existing) {
      existing.push(f)
    } else {
      byStem.set(stem, [f])
    }
  }

  const groups: FileGroup[] = []

  for (const paths of byStem.values()) {
    const jpegs = paths.filter(p => MASTER_EXTS.JPEG.includes(extname(p).toLowerCase()))
    const raws = paths.filter(p => MASTER_EXTS.RAW.includes(extname(p).toLowerCase()))
    const pngs = paths.filter(p => MASTER_EXTS.PNG.includes(extname(p).toLowerCase()))
    const tiffs = paths.filter(p => MASTER_EXTS.TIFF.includes(extname(p).toLowerCase()))
    const heics = paths.filter(p => MASTER_EXTS.HEIC.includes(extname(p).toLowerCase()))
    const xmps = paths.filter(p => XMP_EXTS.includes(extname(p).toLowerCase()))

    // Priority: JPEG > PNG/TIFF/HEIC > RAW
    const masterCandidates = [...jpegs, ...pngs, ...tiffs, ...heics, ...raws]
    if (masterCandidates.length === 0) continue

    const master = masterCandidates[0]
    const companions: CompanionFile[] = [
      ...masterCandidates.slice(1).map(p => ({ path: p, type: getType(p) })),
      ...xmps.map(p => ({ path: p, type: 'XMP' }))
    ]

    groups.push({
      masterPath: master,
      masterType: getType(master),
      companions
    })
  }

  return { groups, totalFiles }
}

// ─── Backend process ──────────────────────────────────────────────────────────

let backendProcess: ChildProcess | null = null

function startBackend(dataDir: string): void {
  const isDev = !app.isPackaged
  const env = { ...process.env, HOTPREVUE_LOCAL: '1', HOTPREVUE_DATA_DIR: dataDir }

  if (isDev) {
    const backendDir = join(__dirname, '../../../backend')
    backendProcess = spawn('uv', ['run', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
      cwd: backendDir, env, shell: true
    })
  } else {
    const ext = process.platform === 'win32' ? '.exe' : ''
    const backendExe = join(process.resourcesPath, 'backend', `hotprevue${ext}`)
    backendProcess = spawn(backendExe, [], { env })
  }
}

async function waitForBackend(url: string, retries = 30): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${url}/health`)
      if (res.ok) return true
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function configPath(userData: string): string {
  return join(userData, 'config.json')
}

function readConfig(userData: string): AppConfig | null {
  try {
    return JSON.parse(readFileSync(configPath(userData), 'utf8')) as AppConfig
  } catch {
    return null
  }
}

function writeConfig(userData: string, cfg: AppConfig): void {
  writeFileSync(configPath(userData), JSON.stringify(cfg, null, 2))
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function settingsPath(userData: string): string {
  return join(userData, 'settings.json')
}

function readSettings(userData: string): AppSettings | null {
  try {
    return JSON.parse(readFileSync(settingsPath(userData), 'utf8')) as AppSettings
  } catch {
    return null
  }
}

function writeSettings(userData: string, s: AppSettings): void {
  writeFileSync(settingsPath(userData), JSON.stringify(s, null, 2))
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.center()

  // In development, load from Vite dev server
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('select-directory', () =>
  dialog
    .showOpenDialog({ properties: ['openDirectory'] })
    .then(r => (r.canceled ? null : r.filePaths[0]))
)

ipcMain.handle('scan-directory', (_event, dirPath: string, recursive: boolean) =>
  scanDirectory(dirPath, recursive)
)

ipcMain.handle('read-file-bytes', (_event, filePath: string) => {
  const buf = readFileSync(filePath)
  return buf
})

ipcMain.handle('get-config', () => readConfig(app.getPath('userData')))

ipcMain.handle('set-config', (_event, cfg: AppConfig) =>
  writeConfig(app.getPath('userData'), cfg)
)

ipcMain.handle('get-settings', () => readSettings(app.getPath('userData')))

ipcMain.handle('set-settings', (_event, s: AppSettings) =>
  writeSettings(app.getPath('userData'), s)
)

ipcMain.handle('choose-data-dir', () =>
  dialog
    .showOpenDialog({ properties: ['openDirectory'], title: 'Velg datakatalog for Hotprevue' })
    .then(r => (r.canceled ? null : r.filePaths[0]))
)

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const userData = app.getPath('userData')

  let settings = readSettings(userData)
  if (!settings) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Velg datakatalog for Hotprevue',
      buttonLabel: 'Velg katalog'
    })
    const dataDir = result.canceled ? join(userData, 'data') : result.filePaths[0]
    settings = { data_dir: dataDir }
    writeSettings(userData, settings)
  }

  startBackend(settings.data_dir)
  await waitForBackend('http://localhost:8000')

  if (!readConfig(userData)) {
    writeConfig(userData, { backendUrl: 'http://localhost:8000' })
  }

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  backendProcess?.kill()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
