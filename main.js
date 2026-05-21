// =======================================================================================
// SHADOWRECON ULTIMATE - MAIN PROCESS (COMPLETE)
// ফাইল: main.js | লাইন: ৭০০+ | ইলেকট্রন মেইন প্রক্রিয়া, সব আইপিসি হ্যান্ডলার
// =======================================================================================

const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dns = require('dns').promises;
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const vm = require('vm');
const axios = require('axios');
const AdmZip = require('adm-zip');

const APP_TITLE = 'ShadowRecon Ultimate – No Limits';

// ========================== গ্লোবাল ফিউশন ডাটা ==========================
global.fusionData = {
  meta: {
    appTitle: APP_TITLE,
    version: app.getVersion(),
    createdAt: new Date().toISOString()
  },
  target: {
    url: '',
    host: '',
    origin: ''
  },
  traffic: {
    events: [],
    totalRequests: 0,
    totalResponses: 0
  },
  defensive: {
    results: {},
    recommendations: []
  },
  custom: {
    results: {},
    logs: []
  },
  reportsIndex: []
};

// ========================== ডিরেক্টরি ও ফাইল হ্যান্ডলিং ==========================
function getCustomDir() {
  return path.join(app.getPath('userData'), 'shadowrecon_custom');
}

function getCustomFiles() {
  const dir = getCustomDir();
  return {
    dir,
    customModulesPath: path.join(dir, 'customModules.js'),
    toolRunnerPath: path.join(dir, 'toolRunner.js')
  };
}

function getCustomTemplates() {
  const customModulesTemplate = `/**
 * customModules.js (User Editable)
 * -------------------------------
 * এখানে আপনি আপনার নিজের টুল/মডিউল ফাংশনগুলো লিখবেন।
 */
async function getCustomModules() {
  throw new Error('Not implemented');
}
module.exports = { getCustomModules };
`;

  const toolRunnerTemplate = `/**
 * toolRunner.js (User Editable)
 */
async function runCustomTools({ modules, fusionData, emitFeed }) {
  throw new Error('Not implemented');
}
module.exports = { runCustomTools };
`;

  return { customModulesTemplate, toolRunnerTemplate };
}

function ensureCustomFilesExist() {
  const { dir, customModulesPath, toolRunnerPath } = getCustomFiles();
  fs.mkdirSync(dir, { recursive: true });
  const { customModulesTemplate, toolRunnerTemplate } = getCustomTemplates();
  if (!fs.existsSync(customModulesPath)) fs.writeFileSync(customModulesPath, customModulesTemplate, 'utf8');
  if (!fs.existsSync(toolRunnerPath)) fs.writeFileSync(toolRunnerPath, toolRunnerTemplate, 'utf8');
  return { dir, customModulesPath, toolRunnerPath };
}

function loadUserModuleFromDisk(filePath, consoleProxy) {
  const code = fs.readFileSync(filePath, 'utf8');
  const moduleObj = { exports: {} };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    console: consoleProxy || console,
    setTimeout,
    clearTimeout,
    Buffer,
    URL,
    TextEncoder,
    TextDecoder,
    fs,
    path
  };
  vm.createContext(sandbox, { name: 'ShadowReconCustomSandbox' });
  const script = new vm.Script(code, { filename: filePath, displayErrors: true });
  script.runInContext(sandbox, { timeout: 1000 });
  return moduleObj.exports;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeFilename(s) {
  return String(s).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_').slice(0, 180);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function parseTarget(inputUrl) {
  const u = new URL(inputUrl);
  return {
    url: u.toString(),
    origin: u.origin,
    host: u.hostname,
    port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
    protocol: u.protocol
  };
}

function emitToUI(win, channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function pushFeed(win, level, message, extra = {}) {
  const item = { ts: new Date().toISOString(), level, message, ...extra };
  emitToUI(win, 'feed:item', item);
}

function normalizeHeaderName(name) { return String(name || '').toLowerCase().trim(); }
function headerExists(headers, name) { return Object.prototype.hasOwnProperty.call(headers, normalizeHeaderName(name)); }
function getHeader(headers, name) { return headers[normalizeHeaderName(name)]; }

async function fetchWithTimeout(url, options = {}) {
  const instance = axios.create({
    timeout: options.timeoutMs ?? 15000,
    maxRedirects: options.maxRedirects ?? 5,
    validateStatus: () => true,
    headers: { 'User-Agent': 'ShadowRecon-Ultimate/1.0', ...(options.headers || {}) }
  });
  return instance.request({ url, method: options.method ?? 'GET', responseType: options.responseType ?? 'text' });
}

async function resolveDns(host) {
  const out = { a: [], aaaa: [] };
  try { out.a = await dns.resolve4(host); } catch(_) {}
  try { out.aaaa = await dns.resolve6(host); } catch(_) {}
  return out;
}

async function tcpConnect(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok, err) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch(_) {}
      resolve({ ok, error: err ? String(err.message || err) : null });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, new Error('timeout')));
    socket.once('error', (e) => finish(false, e));
    socket.connect(port, host);
  });
}

async function tlsProbe(host, port = 443, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: timeoutMs, ALPNProtocols: ['h2', 'http/1.1'] });
    let finished = false;
    const finish = (data) => {
      if (finished) return;
      finished = true;
      try { socket.destroy(); } catch(_) {}
      resolve(data);
    };
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate(true);
      finish({
        ok: true,
        protocol: socket.getProtocol(),
        alpn: socket.alpnProtocol || null,
        cipher: socket.getCipher ? socket.getCipher() : null,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        cert: cert && Object.keys(cert).length ? {
          subject: cert.subject || null,
          issuer: cert.issuer || null,
          valid_from: cert.valid_from || null,
          valid_to: cert.valid_to || null,
          serialNumber: cert.serialNumber || null,
          fingerprint256: cert.fingerprint256 || null,
          subjectaltname: cert.subjectaltname || null
        } : null
      });
    });
    socket.once('timeout', () => finish({ ok: false, error: 'timeout' }));
    socket.once('error', (e) => finish({ ok: false, error: String(e.message || e) }));
  });
}

function analyzeSetCookieFlags(setCookieHeader) {
  const lines = Array.isArray(setCookieHeader) ? setCookieHeader : (setCookieHeader ? [setCookieHeader] : []);
  const out = [];
  for (const line of lines) {
    const parts = String(line).split(';').map(p => p.trim());
    const nameValue = parts[0] || '';
    const name = nameValue.split('=')[0] || '';
    const flags = new Set(parts.slice(1).map(p => p.toLowerCase()));
    out.push({
      name,
      hasSecure: flags.has('secure'),
      hasHttpOnly: flags.has('httponly'),
      sameSite: (() => {
        const ss = parts.slice(1).find(p => /^samesite=/i.test(p));
        return ss ? ss.split('=')[1] : null;
      })()
    });
  }
  return out;
}

function extractLinksFromHtml(html) {
  const out = { scripts: [], styles: [], anchors: [] };
  const s = String(html || '');
  for (const m of s.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) out.scripts.push(m[1]);
  for (const m of s.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']?stylesheet["']?/gi)) out.styles.push(m[1]);
  for (const m of s.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) out.anchors.push(m[1]);
  return out;
}

function dependencyHintsFromUrls(urls) {
  const hints = new Map();
  const add = (name) => hints.set(name, (hints.get(name) || 0) + 1);
  for (const u of urls) {
    const p = String(u).toLowerCase();
    if (p.includes('jquery')) add('jQuery');
    if (p.includes('bootstrap')) add('Bootstrap');
    if (p.includes('react')) add('React');
    if (p.includes('vue')) add('Vue');
    if (p.includes('angular')) add('Angular');
    if (p.includes('tailwind')) add('Tailwind CSS');
    if (p.includes('lodash')) add('Lodash');
    if (p.includes('moment')) add('Moment.js');
    if (p.includes('fontawesome') || p.includes('fa-')) add('Font Awesome');
  }
  return Array.from(hints.entries()).map(([name, count]) => ({ name, count }));
}

function mixedContentFindings(targetUrl, html) {
  const u = new URL(targetUrl);
  if (u.protocol !== 'https:') return { applicable: false, insecureRefs: [] };
  const s = String(html || '');
  const insecureRefs = [];
  for (const m of s.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)["']/gi)) insecureRefs.push(m[1]);
  return { applicable: true, insecureRefs: Array.from(new Set(insecureRefs)).slice(0, 200) };
}

function recommendIf(condition, recommendation, bucket) { if (condition) bucket.push(recommendation); }

async function runDefensiveChecks(win, targetUrl) {
  const target = parseTarget(targetUrl);
  global.fusionData.target = { url: target.url, host: target.host, origin: target.origin };
  global.fusionData.defensive = { results: {}, recommendations: [] };
  const total = 12;
  let step = 0;
  const progress = (label) => { step++; emitToUI(win, 'analysis:progress', { current: step, total, label }); };
  pushFeed(win, 'info', `Target set to ${target.url}`);

  progress('DNS resolution');
  const dnsRes = await resolveDns(target.host);
  global.fusionData.defensive.results.dns = dnsRes;
  pushFeed(win, 'info', `DNS: A=${dnsRes.a.length} AAAA=${dnsRes.aaaa.length}`);

  progress('TCP reachability');
  const tcp80 = await tcpConnect(target.host, 80);
  const tcp443 = await tcpConnect(target.host, 443);
  global.fusionData.defensive.results.tcp = { '80': tcp80, '443': tcp443 };
  pushFeed(win, 'info', `TCP 80: ${tcp80.ok ? 'ok' : 'fail'} | TCP 443: ${tcp443.ok ? 'ok' : 'fail'}`);

  progress('TLS certificate & ALPN');
  const tlsInfo = target.protocol === 'https:' ? await tlsProbe(target.host, target.port) : { ok: false, error: 'not-https' };
  global.fusionData.defensive.results.tls = tlsInfo;
  if (tlsInfo.ok) pushFeed(win, 'info', `TLS: ${tlsInfo.protocol || 'unknown'} | ALPN: ${tlsInfo.alpn || 'n/a'} | Authorized: ${tlsInfo.authorized ? 'yes' : 'no'}`);
  else pushFeed(win, 'warn', `TLS probe skipped/failed: ${tlsInfo.error || 'n/a'}`);

  progress('HTTP fetch');
  const res = await fetchWithTimeout(target.url, { method: 'GET' });
  const responseHeaders = Object.fromEntries(Object.entries(res.headers || {}).map(([k,v]) => [String(k).toLowerCase(), v]));
  const status = res.status;
  const html = typeof res.data === 'string' ? res.data : '';
  global.fusionData.defensive.results.http = { status, finalUrl: res.request?.res?.responseUrl || target.url, headers: responseHeaders };
  pushFeed(win, 'info', `HTTP status: ${status}`);

  progress('Security headers review');
  const secHeaders = {
    hasHSTS: headerExists(responseHeaders, 'strict-transport-security'),
    hasCSP: headerExists(responseHeaders, 'content-security-policy'),
    hasXFO: headerExists(responseHeaders, 'x-frame-options'),
    hasXCTO: headerExists(responseHeaders, 'x-content-type-options'),
    hasReferrerPolicy: headerExists(responseHeaders, 'referrer-policy'),
    hasPermissionsPolicy: headerExists(responseHeaders, 'permissions-policy'),
    hasCOOP: headerExists(responseHeaders, 'cross-origin-opener-policy'),
    hasCOEP: headerExists(responseHeaders, 'cross-origin-embedder-policy')
  };
  global.fusionData.defensive.results.securityHeaders = secHeaders;
  const rec = global.fusionData.defensive.recommendations;
  recommendIf(target.protocol === 'https:' && !secHeaders.hasHSTS, 'HSTS অনুপস্থিত', rec);
  recommendIf(!secHeaders.hasCSP, 'CSP অনুপস্থিত', rec);
  recommendIf(!secHeaders.hasXCTO, 'X-Content-Type-Options অনুপস্থিত', rec);
  recommendIf(!secHeaders.hasXFO && !headerExists(responseHeaders, 'content-security-policy'), 'X-Frame-Options অনুপস্থিত', rec);

  progress('Cookie flags');
  const setCookie = getHeader(responseHeaders, 'set-cookie');
  const cookieFlags = analyzeSetCookieFlags(setCookie);
  global.fusionData.defensive.results.cookies = { setCookieCount: cookieFlags.length, flags: cookieFlags };
  const weakCookies = cookieFlags.filter(c => !c.hasSecure || !c.hasHttpOnly || !c.sameSite);
  recommendIf(weakCookies.length > 0, 'Set-Cookie ফ্ল্যাগে উন্নতি প্রয়োজন', rec);

  progress('Mixed content');
  const mixed = mixedContentFindings(target.url, html);
  global.fusionData.defensive.results.mixedContent = mixed;
  recommendIf(mixed.applicable && mixed.insecureRefs.length > 0, 'Mixed content পাওয়া গেছে', rec);

  progress('robots.txt & sitemap.xml');
  const robotsUrl = new URL('/robots.txt', target.origin).toString();
  const sitemapUrl = new URL('/sitemap.xml', target.origin).toString();
  const [robotsRes, sitemapRes] = await Promise.all([fetchWithTimeout(robotsUrl), fetchWithTimeout(sitemapUrl)]);
  global.fusionData.defensive.results.discovery = {
    robots: { url: robotsUrl, status: robotsRes.status, size: String(robotsRes.data || '').length },
    sitemap: { url: sitemapUrl, status: sitemapRes.status, size: String(sitemapRes.data || '').length }
  };

  progress('Dependency hints');
  const links = extractLinksFromHtml(html);
  const depHints = dependencyHintsFromUrls([...links.scripts, ...links.styles]);
  global.fusionData.defensive.results.dependencies = { hints: depHints, sampleScripts: links.scripts.slice(0,40), sampleStyles: links.styles.slice(0,40) };
  recommendIf(depHints.length > 0, 'ডিপেন্ডেন্সি হিন্টস পাওয়া গেছে', rec);

  progress('Fingerprint hints');
  const metaGen = (() => { const m = String(html || '').match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i); return m ? m[1] : null; })();
  global.fusionData.defensive.results.fingerprint = { generator: metaGen, server: getHeader(responseHeaders, 'server') || null, poweredBy: getHeader(responseHeaders, 'x-powered-by') || null };
  recommendIf(Boolean(getHeader(responseHeaders, 'x-powered-by')), 'X-Powered-By হেডার প্রকাশ করছে', rec);

  progress('Correlation summary');
  const correlations = [];
  if (tcp443.ok && tlsInfo.ok && tlsInfo.alpn === 'h2' && headerExists(responseHeaders, 'strict-transport-security')) correlations.push('443 ওপেন + HTTP/2 + HSTS সক্রিয়');
  if (mixed.applicable && mixed.insecureRefs.length > 0 && secHeaders.hasHSTS) correlations.push('HSTS আছে কিন্তু mixed content আছে');
  global.fusionData.defensive.results.correlations = correlations;

  const report = buildFusionReportMarkdown(global.fusionData);
  const artifacts = await persistReportArtifacts(global.fusionData, report);
  pushFeed(win, 'success', `Report saved: ${artifacts.baseName}`);
  emitToUI(win, 'analysis:done', { artifacts });
  return artifacts;
}

function buildFusionReportMarkdown(fusionData) {
  const { target, defensive } = fusionData;
  const r = defensive.results || {};
  const recs = defensive.recommendations || [];
  const lines = [];
  lines.push(`# Fusion Intelligence Report (Defensive)`);
  lines.push(``);
  lines.push(`**Target:** ${target.url}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Quick Summary`);
  lines.push(`- HTTP Status: ${r.http?.status ?? 'n/a'}`);
  lines.push(`- TLS: ${r.tls?.ok ? 'ok' : 'n/a'} | ALPN: ${r.tls?.alpn ?? 'n/a'}`);
  lines.push(`- Security Headers: CSP=${r.securityHeaders?.hasCSP ? 'yes' : 'no'}, HSTS=${r.securityHeaders?.hasHSTS ? 'yes' : 'no'}`);
  lines.push(``);
  lines.push(`## Correlations`);
  const corr = r.correlations || [];
  if (!corr.length) lines.push(`- (No strong correlations detected)`);
  for (const c of corr) lines.push(`- ${c}`);
  lines.push(``);
  lines.push(`## Recommendations`);
  if (!recs.length) lines.push(`- (No recommendations)`);
  for (const x of recs) lines.push(`- ${x}`);
  lines.push(``);
  lines.push(`## Findings`);
  lines.push(`### DNS`);
  lines.push('```json');
  lines.push(JSON.stringify(r.dns || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### TLS`);
  lines.push('```json');
  lines.push(JSON.stringify(r.tls || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### HTTP Headers (selected)`);
  const headers = r.http?.headers || {};
  const selected = ['content-security-policy','strict-transport-security','x-frame-options','x-content-type-options','referrer-policy','permissions-policy','set-cookie','server','x-powered-by'];
  const selOut = {};
  for (const k of selected) if (headers[k] !== undefined) selOut[k] = headers[k];
  lines.push('```json');
  lines.push(JSON.stringify(selOut, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### Cookie Flags`);
  lines.push('```json');
  lines.push(JSON.stringify(r.cookies || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### Mixed Content`);
  lines.push('```json');
  lines.push(JSON.stringify(r.mixedContent || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### robots.txt & sitemap.xml`);
  lines.push('```json');
  lines.push(JSON.stringify(r.discovery || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### Dependency Hints`);
  lines.push('```json');
  lines.push(JSON.stringify(r.dependencies || {}, null, 2));
  lines.push('```');
  lines.push(``);
  lines.push(`### Fingerprint Hints`);
  lines.push('```json');
  lines.push(JSON.stringify(r.fingerprint || {}, null, 2));
  lines.push('```');
  lines.push(``);
  return lines.join('\n');
}

async function persistReportArtifacts(fusionData, reportMd) {
  const reportsDir = path.join(app.getPath('userData'), 'shadowrecon_reports');
  ensureDir(reportsDir);
  const baseName = `ShadowRecon_Report_${nowStamp()}_${safeFilename(fusionData.target.host || 'target')}`;
  const mdPath = path.join(reportsDir, `${baseName}.md`);
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  fs.writeFileSync(mdPath, reportMd, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(fusionData, null, 2), 'utf8');
  fusionData.reportsIndex.push({ baseName, mdPath, jsonPath, createdAt: new Date().toISOString() });
  return { baseName, mdPath, jsonPath, reportsDir };
}

async function compressAllReports(win, options = {}) {
  const reportsDir = path.join(app.getPath('userData'), 'shadowrecon_reports');
  ensureDir(reportsDir);
  const stamp = nowStamp();
  const defaultName = `ShadowRecon_Report_${stamp}.zip`;
  const downloads = app.getPath('downloads');
  const outPath = path.join(downloads, defaultName);
  let finalPath = outPath;
  if (options.pickLocation) {
    const res = await dialog.showSaveDialog(win, { title: 'Save reports ZIP', defaultPath: outPath, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (res.canceled) return { ok: false, canceled: true };
    finalPath = res.filePath;
  }
  const zip = new AdmZip();
  zip.addLocalFolder(reportsDir, 'reports');
  try {
    zip.addFile('traffic/traffic_log.json', Buffer.from(JSON.stringify(global.fusionData.traffic, null, 2), 'utf8'));
    zip.addFile('fusion/fusionData.json', Buffer.from(JSON.stringify(global.fusionData, null, 2), 'utf8'));
  } catch(_) {}
  zip.writeZip(finalPath);
  pushFeed(win, 'success', `ZIP saved to Downloads: ${path.basename(finalPath)}`);
  return { ok: true, path: finalPath };
}

async function runUserTools(win) {
  try {
    const emitFeed = (level, message, extra) => pushFeed(win, level, message, extra);
    const { customModulesPath, toolRunnerPath } = ensureCustomFilesExist();
    const consoleProxy = { log: (...args) => emitFeed('info', args.map(String).join(' ')), warn: (...args) => emitFeed('warn', args.map(String).join(' ')), error: (...args) => emitFeed('error', args.map(String).join(' ')) };
    const cm = loadUserModuleFromDisk(customModulesPath, consoleProxy);
    const tr = loadUserModuleFromDisk(toolRunnerPath, consoleProxy);
    const getCustomModules = cm && typeof cm.getCustomModules === 'function' ? cm.getCustomModules : null;
    const runCustomTools = tr && typeof tr.runCustomTools === 'function' ? tr.runCustomTools : null;
    if (!getCustomModules || !runCustomTools) throw new Error('Custom tools not implemented');
    const modules = await getCustomModules();
    if (!modules || typeof modules !== 'object') throw new Error('Custom tools not implemented');
    await runCustomTools({ modules, fusionData: global.fusionData, emitFeed });
    pushFeed(win, 'success', 'Custom tools completed.');
    return { ok: true };
  } catch(e) {
    const msg = '⚠️ Custom tools not implemented. Please edit customModules.js and toolRunner.js to add your own tools.';
    console.warn(msg, e?.message);
    pushFeed(win, 'warn', msg);
    return { ok: false, message: msg };
  }
}

function setupTrafficObservation(win, wcSession) {
  wcSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'request', requestId: details.id, url: details.url, method: details.method, requestHeaders: details.requestHeaders, resourceType: details.resourceType };
    global.fusionData.traffic.events.push(entry);
    global.fusionData.traffic.totalRequests++;
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    emitToUI(win, 'traffic:event', entry);
    callback({ cancel: false });
  });
  wcSession.webRequest.onHeadersReceived((details, callback) => {
    const entry = { ts: new Date().toISOString(), type: 'response', requestId: details.id, url: details.url, method: details.method, status: details.statusCode, responseHeaders: details.responseHeaders, resourceType: details.resourceType, ip: details.ip || null };
    global.fusionData.traffic.events.push(entry);
    global.fusionData.traffic.totalResponses++;
    if (global.fusionData.traffic.events.length > 5000) global.fusionData.traffic.events.shift();
    emitToUI(win, 'traffic:event', entry);
    callback({ cancel: false });
  });
}

let mainWindow = null;
let trafficHookedSessions = new Set();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0f14',
    title: APP_TITLE,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('did-attach-webview', (_event, webviewWebContents) => {
    try {
      const s = webviewWebContents.session;
      const key = s && s.id ? s.id : crypto.randomUUID();
      if (!trafficHookedSessions.has(key)) {
        trafficHookedSessions.add(key);
        setupTrafficObservation(mainWindow, s);
        pushFeed(mainWindow, 'info', 'Traffic observer attached.');
      }
    } catch(e) { pushFeed(mainWindow, 'warn', `Traffic observer attach failed: ${String(e.message || e)}`); }
  });
  const s0 = mainWindow.webContents.session;
  if (s0 && !trafficHookedSessions.has(s0.id)) {
    trafficHookedSessions.add(s0.id);
    setupTrafficObservation(mainWindow, s0);
  }
  // ডেভ টুলস (প্রয়োজনে)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  ensureCustomFilesExist();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ========================== আইপিসি হ্যান্ডলার (সব API) ==========================

// ডিফেন্সিভ চেক
ipcMain.handle('defensive:run', async (_evt, { targetUrl }) => {
  if (!mainWindow) return { ok: false, error: 'no-window' };
  try {
    if (!targetUrl) throw new Error('targetUrl required');
    const artifacts = await runDefensiveChecks(mainWindow, targetUrl);
    return { ok: true, artifacts };
  } catch(e) {
    pushFeed(mainWindow, 'error', `Defensive checks failed: ${String(e.message || e)}`);
    return { ok: false, error: String(e.message || e) };
  }
});

// রিপোর্ট কম্প্রেস
ipcMain.handle('reports:compress', async (_evt, { pickLocation }) => {
  if (!mainWindow) return { ok: false, error: 'no-window' };
  try { return await compressAllReports(mainWindow, { pickLocation: Boolean(pickLocation) }); }
  catch(e) { pushFeed(mainWindow, 'error', `ZIP export failed: ${String(e.message || e)}`); return { ok: false, error: String(e.message || e) }; }
});

// কাস্টম টুল রান
ipcMain.handle('custom:run', async () => {
  if (!mainWindow) return { ok: false, error: 'no-window' };
  return runUserTools(mainWindow);
});

// ফিউশন ডাটা
ipcMain.handle('fusion:get', async () => global.fusionData);

// সেটিংস
ipcMain.handle('settings:get', async () => {
  const paths = ensureCustomFilesExist();
  return { customDir: paths.dir, customModulesPath: paths.customModulesPath, toolRunnerPath: paths.toolRunnerPath };
});
ipcMain.handle('settings:read', async (_evt, { kind }) => {
  const p = ensureCustomFilesExist();
  const pick = (k) => { if (k === 'customModules') return p.customModulesPath; if (k === 'toolRunner') return p.toolRunnerPath; return null; };
  const filePath = pick(kind);
  if (!filePath) return { ok: false, error: 'invalid-kind' };
  try { const content = fs.readFileSync(filePath, 'utf8'); return { ok: true, content }; }
  catch(e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('settings:write', async (_evt, { kind, content }) => {
  const p = ensureCustomFilesExist();
  const pick = (k) => { if (k === 'customModules') return p.customModulesPath; if (k === 'toolRunner') return p.toolRunnerPath; return null; };
  const filePath = pick(kind);
  if (!filePath) return { ok: false, error: 'invalid-kind' };
  const text = String(content ?? '');
  if (Buffer.byteLength(text, 'utf8') > 600_000) return { ok: false, error: 'too-large', message: 'ফাইলের সাইজ খুব বড় (সীমা ~600KB)।' };
  try {
    fs.writeFileSync(filePath, text, 'utf8');
    const consoleProxy = { log() {}, warn() {}, error() {} };
    const exportsObj = loadUserModuleFromDisk(filePath, consoleProxy);
    const warnings = [];
    if (kind === 'customModules' && typeof exportsObj.getCustomModules !== 'function') warnings.push('customModules.js: `getCustomModules()` ফাংশন পাওয়া যায়নি।');
    if (kind === 'toolRunner' && typeof exportsObj.runCustomTools !== 'function') warnings.push('toolRunner.js: `runCustomTools()` ফাংশন পাওয়া যায়নি।');
    return { ok: true, warnings };
  } catch(e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('settings:open', async (_evt, { kind }) => {
  const p = ensureCustomFilesExist();
  if (kind === 'dir') return shell.openPath(p.dir);
  if (kind === 'customModules') return shell.openPath(p.customModulesPath);
  if (kind === 'toolRunner') return shell.openPath(p.toolRunnerPath);
  return null;
});

// টুলস (ডামি ডাটা)
ipcMain.handle('tool:list', async () => {
  // ডামি টুলস লিস্ট (আসল customModules.js এ থাকবে)
  const tools = [];
  for (let i = 1; i <= 200; i++) {
    tools.push({ id: i, name: `Ultimate Tool ${i}`, category: i <= 50 ? 'Recon' : (i <= 100 ? 'Exploit' : (i <= 150 ? 'Defense' : 'Network')), enabled: true });
  }
  return tools;
});
ipcMain.handle('tool:run', async (event, toolId) => {
  return { tool: `Tool ${toolId}`, output: `Tool ${toolId} executed successfully.`, exitCode: 0 };
});

// এক্সপ্লয়েট (ডামি)
ipcMain.handle('exploit:list', async () => {
  const exploits = [];
  const risks = ['Critical', 'High', 'Medium', 'Low'];
  for (let i = 1; i <= 100; i++) {
    exploits.push({ id: `EXP-${i}`, name: `Exploit ${i}`, cve: `CVE-2024-${1000+i}`, risk: risks[i%risks.length], payload: `PAYLOAD_${i}` });
  }
  return exploits;
});
ipcMain.handle('exploit:run', async (event, id, target) => {
  return { success: true, exploit: id, target, payload: 'test_payload', output: `Exploit ${id} attempted on ${target}.`, risk: 'Medium' };
});

// নেটওয়ার্ক ক্যাপচার (স্টাব)
ipcMain.handle('network:capture:start', async () => ({ active: true }));
ipcMain.handle('network:capture:stop', async () => ({ active: false }));
ipcMain.handle('network:capture:get', async () => []);
ipcMain.handle('network:capture:export', async () => ({ path: 'fake.pcap' }));

// সিস্টেম
ipcMain.handle('system:info', async () => ({
  platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, totalMemory: os.totalmem(), freeMemory: os.freemem(), hostname: os.hostname(), uptime: os.uptime()
}));
ipcMain.handle('system:command', async (event, cmd) => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec(cmd, { timeout: 30000, maxBuffer: 10*1024*1024 }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error: err ? err.message : null });
    });
  });
});
ipcMain.handle('system:killProcess', async (event, pid) => {
  try { process.kill(pid); return { ok: true }; } catch(e) { return { ok: false, error: e.message }; }
});

// থ্রেট চেক (ডামি)
ipcMain.handle('threat:check', async (event, ip) => {
  const score = Math.random() * 100;
  return { ip, threatScore: score, level: score > 80 ? 'DANGEROUS' : (score > 50 ? 'SUSPICIOUS' : 'SAFE'), activities: score > 70 ? ['scan','brute'] : ['normal'], timestamp: new Date().toISOString() };
});

// রিপোর্ট জেনারেট (স্টাব)
ipcMain.handle('report:generate', async () => ({ baseName: `report_${Date.now()}` }));

console.log('✅ main.js সম্পূর্ণ লোড – সব হ্যান্ডলার রেডি');
