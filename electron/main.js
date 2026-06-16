const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseFile } = require('./binary-parser');
const { dispatch } = require('./dispatcher');

const ROOT = __dirname;
const CAMPAIGNS_DIR = path.join(ROOT, '..', 'campaigns');
const ACTIVE_FILE = path.join(CAMPAIGNS_DIR, 'active.json'); // pointer to active campaign

let win = null;
let activeWatcher = null;

// ── helpers ──────────────────────────────────────────────────────────────────
function ensureDirs() {
  for (const d of [CAMPAIGNS_DIR, path.join(CAMPAIGNS_DIR, 'config')]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function activeName() {
  return readJson(ACTIVE_FILE, null);
}
function setActiveName(name) {
  writeJson(ACTIVE_FILE, name);
}
function campaignFile(name) { return path.join(CAMPAIGNS_DIR, name, 'state.json'); }

// Read the currently active campaign's state (or null)
function readState() {
  const name = activeName();
  if (!name) return null;
  const f = campaignFile(name);
  if (!fs.existsSync(f)) return null;
  return readJson(f, null);
}

// List all campaigns (each dir under campaigns/ with a state.json), with summary
function readCampaigns() {
  ensureDirs();
  let entries = [];
  try { entries = fs.readdirSync(CAMPAIGNS_DIR, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'config') continue;
    const sf = campaignFile(e.name);
    if (!fs.existsSync(sf)) continue;
    const st = readJson(sf, null);
    out.push({ name: e.name, state: st });
  }
  return out;
}

// ── REAL campaign creation ───────────────────────────────────────────────────
// Parses the actual binary and writes a campaign state with REAL metadata.
// Execution surfaces (pipeline/swarm/blackboard) are honestly "not running"
// because there is no orchestrator backend yet — no faked progress.
function createCampaign(filePath, mode) {
  ensureDirs();
  const info = parseFile(filePath); // throws on parse failure
  const ts = new Date().toISOString();
  const safe = info.filename.replace(/[^a-z0-9._-]/gi, '_').slice(0, 40);
  const shortHash = info.sha256.slice(0, 12);
  const name = `${safe}-${shortHash}`;
  const dir = path.join(CAMPAIGNS_DIR, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Copy the binary into the campaign workspace so the campaign is self-contained
  try {
    const binCopy = path.join(dir, info.filename);
    if (!fs.existsSync(binCopy)) fs.writeFileSync(binCopy, fs.readFileSync(filePath));
  } catch { /* copy optional; metadata already parsed */ }

  const state = {
    schema: 'vrax.campaign.v1',
    campaign_id: crypto.randomUUID(),
    created_at: ts,
    updated_at: ts,
    pipeline_mode: mode || 'CRASH',
    runtime_status: 'analysis_ready', // not 'running' — no orchestrator yet
    runtime_note: 'Binary parsed. Orchestrator/MCP not connected — execution requires runtime backend.',

    target: {
      path: filePath,
      filename: info.filename,
      sha256: info.sha256,
      md5: info.md5,
      fileSize: info.fileSize,
      format: info.format,
      arch: info.arch,
      kind: info.kind,
      entryPoint: info.entryPoint,
      entryPointRVA: info.entryPointRVA,
      imageBase: info.imageBase,
      subsystem: info.subsystem,
      overallEntropy: info.overallEntropy,
      security: info.security,
    },
    binary: {
      sections: info.sections,
      imports: info.imports,
      exports: info.exports,
    },

    // Execution surfaces — HONEST empty states. The UI must show these as
    // "requires runtime backend", never fabricate agent activity.
    orchestrator: { connected: false, phase: null, state_block: null },
    mcp: { connected: false, servers: [] }, // real discovery fills this when backend exists
    blackboard: { findings: [], total: 0 },
    swarm: { agents: [], active: 0 },
    pipeline: { mode: mode || 'CRASH', nodes: [], converged: false },
    evidence: [],
    reports: [],

    counts: {
      sections: info.sections.length,
      imports: info.imports.length,
      exports: info.exports.length,
      findings: 0,
      evidence: 0,
    },
  };

  writeJson(campaignFile(name), state);
  setActiveName(name);
  return { name, state };
}

// ── push updates to renderer ─────────────────────────────────────────────────
function pushState() {
  if (!win) return;
  const st = readState();
  win.webContents.send('state-update', st);
  win.webContents.send('campaigns-update', readCampaigns());
}

function watchActive() {
  if (activeWatcher) { try { activeWatcher.close(); } catch {} activeWatcher = null; }
  const name = activeName();
  if (!name) return;
  const f = campaignFile(name);
  if (!fs.existsSync(f)) return;
  try {
    activeWatcher = fs.watch(f, { persistent: false }, () => {
      setTimeout(pushState, 120);
    });
  } catch {}
}

// ── window ───────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#0D1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
    titleBarStyle: 'hidden', trafficLightPosition: { x: -100, y: -100 },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => { pushState(); });
  watchActive();

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('window-close', () => win.close());

  ipcMain.handle('open-file', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Select Binary Target',
      filters: [
        { name: 'Executables', extensions: ['exe','dll','so','bin','elf','macho','dylib','sys'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('open-folder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Open Folder', properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  // REAL load: parse + create campaign + push
  ipcMain.handle('load-binary', async (_e, filePath, mode) => {
    if (!filePath) return { ok: false, error: 'no path' };
    try {
      const { name, state } = createCampaign(filePath, mode);
      watchActive();
      pushState();
      return { ok: true, name, state };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('get-state', () => readState());
  ipcMain.handle('get-campaigns', () => readCampaigns());
  ipcMain.handle('get-campaign', (_e, name) => {
    const f = campaignFile(name);
    return fs.existsSync(f) ? readJson(f, null) : null;
  });

  // ── Operator Console dispatch — REAL agent execution via opencode ─────────
  // Streams events back to the renderer on the 'dispatch-event' channel.
  let activeDispatch = null;
  ipcMain.handle('dispatch', async (_e, { prompt, model } = {}) => {
    const state = readState();
    if (!state || !state.target) {
      return { ok: false, error: 'No binary loaded. Load a target first.' };
    }
    if (!prompt || !prompt.trim()) {
      return { ok: false, error: 'Empty prompt.' };
    }
    // Cancel any in-flight dispatch
    if (activeDispatch) { try { activeDispatch.kill(); } catch {} activeDispatch = null; }

    try {
      activeDispatch = dispatch({
        state,
        prompt,
        model: model || undefined,
        onEvent: (ev) => {
          if (win && !win.isDestroyed()) win.webContents.send('dispatch-event', ev);
        },
      });
      return { ok: true, pid: activeDispatch.pid };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('dispatch-cancel', async () => {
    if (activeDispatch) { try { activeDispatch.kill(); } catch {} activeDispatch = null; return { ok: true }; }
    return { ok: false, error: 'no active dispatch' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (activeWatcher) { try { activeWatcher.close(); } catch {} }
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
