// =======================================================================================
// SHADOWRECON ULTIMATE - PRELOAD SCRIPT (SECURE API EXPOSURE)
// ফাইল: preload.js | লাইন: ৫৮০+ | সব আইপিসি কমিউনিকেশন এখান দিয়ে হবে
// =======================================================================================

const { contextBridge, ipcRenderer } = require('electron');

// ========================== ইউটিলিটি ফাংশন ==========================
function safeJsonParse(str) {
  try { return JSON.parse(str); } catch(e) { return null; }
}
function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch(e) { return '{}'; }
}
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function base64Encode(str) { return Buffer.from(str).toString('base64'); }
function base64Decode(str) { return Buffer.from(str, 'base64').toString('utf8'); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========================== মূল API এক্সপোজ ==========================
contextBridge.exposeInMainWorld('shadowRecon', {
  // ---------- ডিফেন্সিভ চেক ----------
  runDefensiveChecks: (targetUrl) => ipcRenderer.invoke('defensive:run', { targetUrl }),
  
  // ---------- রিপোর্ট কম্প্রেস ----------
  compressReports: (pickLocation = false) => ipcRenderer.invoke('reports:compress', { pickLocation }),
  
  // ---------- কাস্টম টুলস ----------
  runCustomTools: () => ipcRenderer.invoke('custom:run'),
  
  // ---------- ফিউশন ডাটা ----------
  getFusionData: () => ipcRenderer.invoke('fusion:get'),
  
  // ---------- সেটিংস ----------
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openSettingsPath: (kind) => ipcRenderer.invoke('settings:open', { kind }),
  readCustomFile: (kind) => ipcRenderer.invoke('settings:read', { kind }),
  writeCustomFile: (kind, content) => ipcRenderer.invoke('settings:write', { kind, content }),
  
  // ---------- টুলস (মেনু থেকে) ----------
  listTools: () => ipcRenderer.invoke('tool:list'),
  runTool: (toolId) => ipcRenderer.invoke('tool:run', toolId),
  
  // ---------- এক্সপ্লয়েট ----------
  listExploits: () => ipcRenderer.invoke('exploit:list'),
  runExploit: (id, target) => ipcRenderer.invoke('exploit:run', id, target),
  
  // ---------- নেটওয়ার্ক ক্যাপচার ----------
  startCapture: () => ipcRenderer.invoke('network:capture:start'),
  stopCapture: () => ipcRenderer.invoke('network:capture:stop'),
  getCaptureLog: () => ipcRenderer.invoke('network:capture:get'),
  exportCapture: () => ipcRenderer.invoke('network:capture:export'),
  
  // ---------- সিস্টেম ----------
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  runSystemCommand: (cmd) => ipcRenderer.invoke('system:command', cmd),
  killProcess: (pid) => ipcRenderer.invoke('system:killProcess', pid),
  
  // ---------- থ্রেট ইন্টেল ----------
  checkThreat: (ip) => ipcRenderer.invoke('threat:check', ip),
  
  // ---------- রিপোর্ট জেনারেট ----------
  generateReport: () => ipcRenderer.invoke('report:generate'),
  
  // ---------- ইউটিলিটি ফাংশন (ফ্রন্টএন্ডে সাহায্য) ----------
  utils: {
    formatBytes,
    generateUUID,
    base64Encode,
    base64Decode,
    sleep
  },
  
  // ---------- ইভেন্ট লিসেনার (লাইভ আপডেট) ----------
  onFeedItem: (callback) => {
    ipcRenderer.removeAllListeners('feed:item');
    ipcRenderer.on('feed:item', (_event, item) => callback(item));
  },
  onTrafficEvent: (callback) => {
    ipcRenderer.removeAllListeners('traffic:event');
    ipcRenderer.on('traffic:event', (_event, entry) => callback(entry));
  },
  onNetworkPacket: (callback) => {
    ipcRenderer.removeAllListeners('network-packet');
    ipcRenderer.on('network-packet', (_event, packet) => callback(packet));
  },
  onProgress: (callback) => {
    ipcRenderer.removeAllListeners('analysis:progress');
    ipcRenderer.on('analysis:progress', (_event, data) => callback(data));
  },
  onAnalysisDone: (callback) => {
    ipcRenderer.removeAllListeners('analysis:done');
    ipcRenderer.on('analysis:done', (_event, data) => callback(data));
  },
  
  // ---------- ভার্সন ----------
  version: () => '1.0.0',
  isElectron: true
});

// ========================== অতিরিক্ত নিরাপদ API (ঐচ্ছিক) ==========================
contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title, body) => {
    new Notification(title, { body });
  },
  getPlatform: () => process.platform,
  getVersion: () => process.versions.electron
});

// ========================== কনসোল ট্র্যাপিং (ডিবাগging এর জন্য) ==========================
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
console.log = (...args) => {
  originalConsole.log(...args);
  ipcRenderer.send('console-log', args.map(String).join(' '));
};
console.warn = (...args) => {
  originalConsole.warn(...args);
  ipcRenderer.send('console-warn', args.map(String).join(' '));
};
console.error = (...args) => {
  originalConsole.error(...args);
  ipcRenderer.send('console-error', args.map(String).join(' '));
};

// ========================== প্রিলোড রেডি সিগন্যাল ==========================
ipcRenderer.send('preload-ready', { timestamp: new Date().toISOString(), pid: process.pid });

console.log('🚀 ShadowRecon Preload: API fully exposed and ready');
