const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shadowRecon', {
  runDefensiveChecks: async (targetUrl) => ipcRenderer.invoke('defensive:run', { targetUrl }),
  compressReports: async (pickLocation = false) => ipcRenderer.invoke('reports:compress', { pickLocation }),
  runCustomTools: async () => ipcRenderer.invoke('custom:run'),
  getFusionData: async () => ipcRenderer.invoke('fusion:get'),
  getSettings: async () => ipcRenderer.invoke('settings:get'),
  openSettingsPath: async (kind) => ipcRenderer.invoke('settings:open', { kind }),
  readCustomFile: async (kind) => ipcRenderer.invoke('settings:read', { kind }),
  writeCustomFile: async (kind, content) => ipcRenderer.invoke('settings:write', { kind, content }),
  onFeedItem: (handler) => {
    ipcRenderer.removeAllListeners('feed:item');
    ipcRenderer.on('feed:item', (_evt, item) => handler(item));
  },
  onTrafficEvent: (handler) => {
    ipcRenderer.removeAllListeners('traffic:event');
    ipcRenderer.on('traffic:event', (_evt, item) => handler(item));
  },
  onProgress: (handler) => {
    ipcRenderer.removeAllListeners('analysis:progress');
    ipcRenderer.on('analysis:progress', (_evt, data) => handler(data));
  },
  onAnalysisDone: (handler) => {
    ipcRenderer.removeAllListeners('analysis:done');
    ipcRenderer.on('analysis:done', (_evt, data) => handler(data));
  }
});
