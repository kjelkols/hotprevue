"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const MASTER_EXTS = {
  JPEG: [".jpg", ".jpeg"],
  PNG: [".png"],
  TIFF: [".tif", ".tiff"],
  HEIC: [".heic", ".heif"],
  RAW: [".nef", ".cr2", ".cr3", ".arw", ".dng", ".orf", ".rw2", ".pef"]
};
const XMP_EXTS = [".xmp"];
function getType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  for (const [type, exts] of Object.entries(MASTER_EXTS)) {
    if (exts.includes(ext)) return type;
  }
  if (XMP_EXTS.includes(ext)) return "XMP";
  return "UNKNOWN";
}
function allMasterExts() {
  return Object.values(MASTER_EXTS).flat();
}
function getFiles(dirPath, recursive) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...getFiles(fullPath, recursive));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}
function scanDirectory(dirPath, recursive) {
  const files = getFiles(dirPath, recursive);
  const allKnownExts = [...allMasterExts(), ...XMP_EXTS];
  const relevant = files.filter((f) => allKnownExts.includes(path.extname(f).toLowerCase()));
  const totalFiles = files.length;
  const byStem = /* @__PURE__ */ new Map();
  for (const f of relevant) {
    const stem = path.basename(f, path.extname(f)).toLowerCase();
    const existing = byStem.get(stem);
    if (existing) {
      existing.push(f);
    } else {
      byStem.set(stem, [f]);
    }
  }
  const groups = [];
  for (const paths of byStem.values()) {
    const jpegs = paths.filter((p) => MASTER_EXTS.JPEG.includes(path.extname(p).toLowerCase()));
    const raws = paths.filter((p) => MASTER_EXTS.RAW.includes(path.extname(p).toLowerCase()));
    const pngs = paths.filter((p) => MASTER_EXTS.PNG.includes(path.extname(p).toLowerCase()));
    const tiffs = paths.filter((p) => MASTER_EXTS.TIFF.includes(path.extname(p).toLowerCase()));
    const heics = paths.filter((p) => MASTER_EXTS.HEIC.includes(path.extname(p).toLowerCase()));
    const xmps = paths.filter((p) => XMP_EXTS.includes(path.extname(p).toLowerCase()));
    const masterCandidates = [...jpegs, ...pngs, ...tiffs, ...heics, ...raws];
    if (masterCandidates.length === 0) continue;
    const master = masterCandidates[0];
    const companions = [
      ...masterCandidates.slice(1).map((p) => ({ path: p, type: getType(p) })),
      ...xmps.map((p) => ({ path: p, type: "XMP" }))
    ];
    groups.push({
      masterPath: master,
      masterType: getType(master),
      companions
    });
  }
  return { groups, totalFiles };
}
function configPath(userData) {
  return path.join(userData, "config.json");
}
function readConfig(userData) {
  try {
    return JSON.parse(fs.readFileSync(configPath(userData), "utf8"));
  } catch {
    return null;
  }
}
function writeConfig(userData, cfg) {
  fs.writeFileSync(configPath(userData), JSON.stringify(cfg, null, 2));
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.center();
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.handle(
  "select-directory",
  () => electron.dialog.showOpenDialog({ properties: ["openDirectory"] }).then((r) => r.canceled ? null : r.filePaths[0])
);
electron.ipcMain.handle(
  "scan-directory",
  (_event, dirPath, recursive) => scanDirectory(dirPath, recursive)
);
electron.ipcMain.handle("read-file-bytes", (_event, filePath) => {
  const buf = fs.readFileSync(filePath);
  return buf;
});
electron.ipcMain.handle("get-config", () => readConfig(electron.app.getPath("userData")));
electron.ipcMain.handle(
  "set-config",
  (_event, cfg) => writeConfig(electron.app.getPath("userData"), cfg)
);
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
