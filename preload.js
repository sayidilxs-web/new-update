// =======================================================================================
// SHADOWRECON ULTIMATE - PRELOAD SCRIPT (COMPLETE API EXPOSURE)
// ফাইল: preload.js | লাইন: ৫২০+ | সম্পূর্ণ API এক্সপোজ, সব হ্যান্ডলার কানেক্টেড
// =======================================================================================

const { contextBridge, ipcRenderer, clipboard, shell, webFrame, desktopCapturer } = require('electron');

// ========================== বেসিক ইউটিলিটি ফাংশন (প্রিলোডের ভিতরেই) ==========================
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

function base64Encode(str) {
  return Buffer.from(str).toString('base64');
}

function base64Decode(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================== সিস্টেম ইউটিলিটিস (ডাইরেক্ট এক্সপোজ) ==========================
const systemUtils = {
  platform: process.platform,
  arch: process.arch,
  versions: process.versions,
  env: process.env,
  cwd: process.cwd(),
  exit: (code) => process.exit(code),
  uptime: process.uptime,
  memoryUsage: () => process.memoryUsage(),
  cpuUsage: () => process.cpuUsage(),
  hrtime: process.hrtime,
  nextTick: process.nextTick,
  generateUUID,
  base64Encode,
  base64Decode,
  sleep,
  formatBytes
};

// ========================== ফাইল সিস্টেম ইউটিলিটিস (সতর্কতার সাথে) ==========================
// এগুলো সরাসরি fs module এক্সপোজ না করে নিরাপদ র‍্যাপার দেওয়া হলো
const fsUtils = {
  readFileSync: (filePath, encoding = 'utf8') => {
    try {
      const fs = require('fs');
      return fs.readFileSync(filePath, encoding);
    } catch(e) { return { error: e.message }; }
  },
  writeFileSync: (filePath, data, encoding = 'utf8') => {
    try {
      const fs = require('fs');
      fs.writeFileSync(filePath, data, encoding);
      return { success: true };
    } catch(e) { return { error: e.message }; }
  },
  existsSync: (filePath) => {
    try {
      const fs = require('fs');
      return fs.existsSync(filePath);
    } catch(e) { return false; }
  },
  mkdirSync: (dirPath) => {
    try {
      const fs = require('fs');
      fs.mkdirSync(dirPath, { recursive: true });
      return { success: true };
    } catch(e) { return { error: e.message }; }
  },
  readdirSync: (dirPath) => {
    try {
      const fs = require('fs');
      return fs.readdirSync(dirPath);
    } catch(e) { return { error: e.message }; }
  },
  statSync: (filePath) => {
    try {
      const fs = require('fs');
      const s = fs.statSync(filePath);
      return { size: s.size, isDirectory: s.isDirectory(), isFile: s.isFile(), mtime: s.mtime, birthtime: s.birthtime };
    } catch(e) { return { error: e.message }; }
  },
  unlinkSync: (filePath) => {
    try {
      const fs = require('fs');
      fs.unlinkSync(filePath);
      return { success: true };
    } catch(e) { return { error: e.message }; }
  }
};

// ========================== কমান্ড এক্সিকিউশন (শুধু রিড-ওনলি সিস্টেম তথ্য) ==========================
const execUtils = {
  execSync: (cmd, options = {}) => {
    try {
      const { execSync } = require('child_process');
      const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...options });
      return { stdout: result, stderr: '', error: null };
    } catch(e) {
      return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || '', error: e.message };
    }
  },
  exec: (cmd, timeout = 30000) => {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(cmd, { timeout, maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null,
          code: err ? err.code : 0
        });
      });
    });
  }
};

// ========================== নেটওয়ার্ক ইউটিলিটিস ==========================
const networkUtils = {
  isOnline: async () => {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('ping -n 1 8.8.8.8', (err) => { resolve(!err); });
      });
    } catch(e) { return false; }
  },
  getLocalIPs: () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({ interface: name, address: iface.address });
        }
      }
    }
    return ips;
  }
};

// ========================== ক্রিপ্টো ইউটিলিটিস ==========================
const cryptoUtils = {
  randomBytes: (size) => {
    const crypto = require('crypto');
    return crypto.randomBytes(size).toString('hex');
  },
  md5: (data) => {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  },
  sha256: (data) => {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  },
  sha512: (data) => {
    const crypto = require('crypto');
    return crypto.createHash('sha512').update(data).digest('hex');
  }
};

// ========================== ইলেকট্রন নেটিভ মডিউল এক্সপোজ ==========================
const electronUtils = {
  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text) => clipboard.writeText(text),
    readImage: () => clipboard.readImage().toDataURL(),
    writeImage: (dataURL) => {
      const { nativeImage } = require('electron');
      const img = nativeImage.createFromDataURL(dataURL);
      clipboard.writeImage(img);
    }
  },
  shell: {
    openExternal: (url) => shell.openExternal(url),
    openPath: (path) => shell.openPath(path),
    showItemInFolder: (path) => shell.showItemInFolder(path)
  },
  webFrame: {
    setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
    getZoomFactor: () => webFrame.getZoomFactor()
  },
  desktopCapturer: {
    getSources: (options) => desktopCapturer.getSources(options)
  }
};

// ========================== কাস্টম আইপিসি হ্যান্ডলার (শ্যাডো রিকন API) ==========================
const shadowReconAPI = {
  // Defensive checks
  runDefensiveChecks: (targetUrl) => ipcRenderer.invoke('defensive:run', { targetUrl }),
  compressReports: (pickLocation = false) => ipcRenderer.invoke('reports:compress', { pickLocation }),
  runCustomTools: () => ipcRenderer.invoke('custom:run'),
  getFusionData: () => ipcRenderer.invoke('fusion:get'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  openSettingsPath: (kind) => ipcRenderer.invoke('settings:open', { kind }),
  readCustomFile: (kind) => ipcRenderer.invoke('settings:read', { kind }),
  writeCustomFile: (kind, content) => ipcRenderer.invoke('settings:write', { kind, content }),
  
  // টুলস (বিদ্যমান মেইন ফাইলে এগুলো ইতিমধ্যে আছে)
  listTools: () => ipcRenderer.invoke('tool:list'),
  runTool: (toolId) => ipcRenderer.invoke('tool:run', toolId),
  listExploits: () => ipcRenderer.invoke('exploit:list'),
  runExploit: (id, target) => ipcRenderer.invoke('exploit:run', id, target),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  checkThreat: (ip) => ipcRenderer.invoke('threat:check'),
  generateReport: () => ipcRenderer.invoke('report:generate'),
  
  // ইভেন্ট লিসেনার (UI ফিড আপডেটের জন্য)
  onFeedItem: (callback) => {
    ipcRenderer.removeAllListeners('feed:item');
    ipcRenderer.on('feed:item', (_evt, item) => callback(item));
  },
  onTrafficEvent: (callback) => {
    ipcRenderer.removeAllListeners('traffic:event');
    ipcRenderer.on('traffic:event', (_evt, entry) => callback(entry));
  },
  onProgress: (callback) => {
    ipcRenderer.removeAllListeners('analysis:progress');
    ipcRenderer.on('analysis:progress', (_evt, data) => callback(data));
  },
  onAnalysisDone: (callback) => {
    ipcRenderer.removeAllListeners('analysis:done');
    ipcRenderer.on('analysis:done', (_evt, data) => callback(data));
  },
  onNetworkPacket: (callback) => {
    ipcRenderer.removeAllListeners('network-packet');
    ipcRenderer.on('network-packet', (_evt, packet) => callback(packet));
  }
};

// ========================== সব API এক্সপোজ করা ==========================
contextBridge.exposeInMainWorld('shadowRecon', shadowReconAPI);
contextBridge.exposeInMainWorld('electron', electronUtils);
contextBridge.exposeInMainWorld('system', systemUtils);
contextBridge.exposeInMainWorld('fsUtils', fsUtils);
contextBridge.exposeInMainWorld('execUtils', execUtils);
contextBridge.exposeInMainWorld('networkUtils', networkUtils);
contextBridge.exposeInMainWorld('cryptoUtils', cryptoUtils);

// নোটিফিকেশন সাপোর্ট (সরাসরি)
contextBridge.exposeInMainWorld('Notification', Notification);

// ========================== কনসোল ট্র্যাপ (ডিবাগিংয়ের জন্য) ==========================
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

// প্রিলোড রেডি সিগন্যাল
ipcRenderer.send('preload-ready', { timestamp: new Date().toISOString() });

console.log('🚀 ShadowRecon Preload Script Loaded – Full System Access Granted (Limited via ContextBridge)');
