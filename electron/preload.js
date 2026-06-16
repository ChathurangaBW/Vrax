const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vrax', {
  // window
  minimize:      () => ipcRenderer.send('window-minimize'),
  maximize:      () => ipcRenderer.send('window-maximize'),
  close:         () => ipcRenderer.send('window-close'),

  // binary loading — REAL: parses the file and creates a campaign
  openFile:      () => ipcRenderer.invoke('open-file'),
  openFolder:    () => ipcRenderer.invoke('open-folder'),
  loadBinary:    (filePath, mode) => ipcRenderer.invoke('load-binary', filePath, mode),

  // state — read-only against real campaign state
  getState:      () => ipcRenderer.invoke('get-state'),
  getCampaigns:  () => ipcRenderer.invoke('get-campaigns'),
  getCampaign:   (name) => ipcRenderer.invoke('get-campaign', name),

  // live updates
  onStateUpdate:    (cb) => ipcRenderer.on('state-update',    (_, data) => cb(data)),
  onCampaignsUpdate:(cb) => ipcRenderer.on('campaigns-update',(_, data) => cb(data)),

  // Operator Console dispatch — REAL LLM via opencode backend
  dispatch:       (prompt, model) => ipcRenderer.invoke('dispatch', { prompt, model }),
  dispatchCancel: () => ipcRenderer.invoke('dispatch-cancel'),
  onDispatchEvent:(cb) => ipcRenderer.on('dispatch-event', (_, ev) => cb(ev)),
});
