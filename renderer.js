/* global shadowRecon */

// =======================================================================================
// SHADOWRECON ULTIMATE - RENDERER PROCESS (COMPLETE UI & LOGIC)
// ফাইল: renderer.js | লাইন: ৬৫০+ | সম্পূর্ণ UI, ড্রাগন, টুলস, এক্সপ্লয়েট, ট্রাফিক লগ
// =======================================================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ========================== গ্লোবাল স্টেট ==========================
const state = {
  traffic: [],
  maxTrafficRows: 350,
  tools: [],
  exploits: [],
  isScanning: false,
  currentTarget: '',
  systemInfo: null,
  threatIntel: new Map()
};

// ========================== ইউটিলিটি ফাংশন ==========================
function normalizeUrl(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  try { return new URL(v).toString(); }
  catch (_) {
    try { return new URL(`https://${v}`).toString(); }
    catch (e) { return ''; }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

// ========================== ট্যাব কন্ট্রোল ==========================
function setActiveTab(tabId) {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $$('.tabBtn').forEach(b => b.classList.remove('active'));
  $(`#${tabId}`).classList.add('active');
  $(`.tabBtn[data-tab="${tabId}"]`).classList.add('active');
}

// ========================== ফিড মেসেজ (লাইভ লগ) ==========================
function appendFeedItem(item) {
  const feed = $('#feed');
  if (!feed) return;
  const wrap = document.createElement('div');
  wrap.className = 'feedItem';
  const pill = document.createElement('div');
  pill.className = `pill ${item.level || 'info'}`;
  pill.textContent = String(item.level || 'info').toUpperCase();
  const body = document.createElement('div');
  body.style.flex = '1';
  const msg = document.createElement('div');
  msg.className = 'feedMsg';
  msg.textContent = item.message || '';
  const ts = document.createElement('div');
  ts.className = 'feedTs';
  ts.textContent = new Date(item.ts || Date.now()).toLocaleString();
  body.appendChild(msg);
  body.appendChild(ts);
  wrap.appendChild(pill);
  wrap.appendChild(body);
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 200) feed.removeChild(feed.firstChild);
}

// ========================== প্রোগ্রেস বার ==========================
function setProgress(current, total, label) {
  const bar = $('#progressBar');
  const text = $('#progressText');
  const pct = total ? Math.round((current / total) * 100) : 0;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (text) text.textContent = `${label} (${current}/${total})`;
}

// ========================== ট্রাফিক টেবিল ==========================
function trafficRow(entry) {
  const tr = document.createElement('tr');
  const td = (v, cls) => {
    const x = document.createElement('td');
    if (cls) x.className = cls;
    x.textContent = v == null ? '' : String(v);
    return x;
  };
  const timeStr = new Date(entry.ts || Date.now()).toLocaleTimeString();
  tr.appendChild(td(timeStr, 'mono'));
  const statusStr = entry.status ? String(entry.status) : (entry.type === 'request' ? '→' : '');
  tr.appendChild(td(statusStr, 'mono'));
  tr.appendChild(td(entry.method || '', 'mono'));
  tr.appendChild(td(entry.resourceType || entry.type || '', 'mono'));
  const urlCell = td(entry.url || '', 'mono');
  urlCell.style.maxWidth = '400px';
  urlCell.style.overflow = 'hidden';
  urlCell.style.textOverflow = 'ellipsis';
  tr.appendChild(urlCell);
  return tr;
}

function addTraffic(entry) {
  state.traffic.push(entry);
  if (state.traffic.length > 5000) state.traffic.splice(0, state.traffic.length - 5000);
  const body = $('#trafficBody');
  if (!body) return;
  body.appendChild(trafficRow(entry));
  while (body.children.length > state.maxTrafficRows) body.removeChild(body.firstChild);
}

function clearTrafficTable() {
  state.traffic = [];
  const body = $('#trafficBody');
  if (body) body.innerHTML = '';
  appendFeedItem({ level: 'info', message: 'ট্রাফিক লগ মুছে ফেলা হয়েছে।' });
}

// ========================== রিপোর্ট প্রিভিউ ==========================
function updateReportsPreview(fusionData) {
  const preview = $('#fusionPreview');
  if (preview) preview.textContent = JSON.stringify(fusionData, null, 2);
}

async function refreshFusionPreview() {
  try {
    const data = await shadowRecon.getFusionData();
    updateReportsPreview(data);
  } catch(e) { console.error('Fusion preview error', e); }
}

// ========================== টুলস ও এক্সপ্লয়েট বাটন জেনারেশন ==========================
async function loadToolsAndExploits() {
  try {
    // টুলস লোড
    const tools = await shadowRecon.listTools();
    state.tools = tools;
    const toolsContainer = $('#toolsContainer');
    if (toolsContainer) {
      toolsContainer.innerHTML = '';
      tools.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.innerHTML = `${tool.name}`;
        btn.title = `${tool.category} - Click to run`;
        btn.onclick = async () => {
          appendFeedItem({ level: 'info', message: `🛠️ ${tool.name} চালানো হচ্ছে...` });
          try {
            const result = await shadowRecon.runTool(tool.id);
            if (result.error) appendFeedItem({ level: 'error', message: `${tool.name} ব্যর্থ: ${result.error}` });
            else appendFeedItem({ level: 'success', message: `${tool.name} সম্পন্ন। আউটপুট: ${result.output.substring(0,200)}` });
          } catch(e) {
            appendFeedItem({ level: 'error', message: `${tool.name} চালাতে ব্যর্থ: ${e.message}` });
          }
        };
        toolsContainer.appendChild(btn);
      });
    }
    
    // এক্সপ্লয়েট লোড
    const exploits = await shadowRecon.listExploits();
    state.exploits = exploits;
    const exploitContainer = $('#exploitContainer');
    if (exploitContainer) {
      exploitContainer.innerHTML = '';
      exploits.slice(0,100).forEach(exp => {
        const btn = document.createElement('button');
        btn.className = 'exploit-btn';
        btn.innerHTML = `💣 ${exp.name}`;
        btn.title = `${exp.cve} | ${exp.risk} risk`;
        btn.onclick = async () => {
          const target = $('#targetInput').value;
          if (!target) {
            appendFeedItem({ level: 'warn', message: 'টার্গেট URL দিন।' });
            return;
          }
          appendFeedItem({ level: 'info', message: `💥 এক্সপ্লয়েট ${exp.name} চালানো হচ্ছে ${target} এ...` });
          try {
            const result = await shadowRecon.runExploit(exp.id, target);
            if (result.error) appendFeedItem({ level: 'error', message: `এক্সপ্লয়েট ব্যর্থ: ${result.error}` });
            else appendFeedItem({ level: result.risk === 'Critical' ? 'error' : 'warn', message: result.output });
          } catch(e) {
            appendFeedItem({ level: 'error', message: `এক্সপ্লয়েট চালাতে ব্যর্থ: ${e.message}` });
          }
        };
        exploitContainer.appendChild(btn);
      });
    }
  } catch(e) {
    console.error(e);
    appendFeedItem({ level: 'error', message: `টুলস লোড করতে ব্যর্থ: ${e.message}` });
  }
}

// ========================== সিস্টেম ইনফো আপডেট ==========================
function updateSystemInfoDisplay(info) {
  const sysDiv = $('#systemInfo');
  if (!sysDiv) return;
  sysDiv.innerHTML = `
    <div>🖥️ ${info.platform} ${info.arch}</div>
    <div>🧠 CPU: ${info.cpus} core(s)</div>
    <div>💾 RAM: ${formatBytes(info.totalMemory * 1024**3)}</div>
    <div>🆓 Free: ${formatBytes(info.freeMemory * 1024**3)}</div>
    <div>🏠 ${info.hostname}</div>
    <div>⏱️ Uptime: ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m</div>
  `;
}

async function refreshSystemInfo() {
  try {
    const info = await shadowRecon.getSystemInfo();
    state.systemInfo = info;
    updateSystemInfoDisplay(info);
  } catch(e) { console.error('System info error', e); }
}

// ========================== থ্রেট ট্র্যাকিং ==========================
async function trackThreatIP() {
  const ipInput = $('#threatIp');
  const ip = ipInput?.value.trim();
  if (!ip) {
    appendFeedItem({ level: 'warn', message: 'একটি IP ঠিকানা দিন।' });
    return;
  }
  appendFeedItem({ level: 'info', message: `থ্রেট চেক করা হচ্ছে ${ip}...` });
  try {
    const result = await shadowRecon.checkThreat(ip);
    state.threatIntel.set(ip, result);
    const levelClass = result.level === 'DANGEROUS' ? 'error' : (result.level === 'SUSPICIOUS' ? 'warn' : 'info');
    appendFeedItem({ level: levelClass, message: `${ip} : ${result.level} (স্কোর: ${result.threatScore.toFixed(1)}) - ${result.activities.join(', ')}` });
    const threatTable = $('#threatTable');
    if (threatTable) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${ip}</td>
        <td class="${levelClass}">${result.level}</td>
        <td>${result.threatScore.toFixed(1)}</td>
        <td>${result.activities.join(', ')}</td>
        <td>${new Date(result.timestamp).toLocaleString()}</td>
      `;
      threatTable.appendChild(row);
      while (threatTable.children.length > 50) threatTable.removeChild(threatTable.firstChild);
    }
  } catch(e) {
    appendFeedItem({ level: 'error', message: `থ্রেট চেক ব্যর্থ: ${e.message}` });
  }
}

// ========================== কাস্টম এডিটর ==========================
async function loadEditors() {
  try {
    const cm = await shadowRecon.readCustomFile('customModules');
    const tr = await shadowRecon.readCustomFile('toolRunner');
    if (cm.content) $('#editorCustomModules').value = cm.content;
    if (tr.content) $('#editorToolRunner').value = tr.content;
    $('#statusCustomModules').textContent = cm.error ? `Load failed: ${cm.error}` : 'Loaded.';
    $('#statusToolRunner').textContent = tr.error ? `Load failed: ${tr.error}` : 'Loaded.';
  } catch(e) {
    $('#statusCustomModules').textContent = `Error: ${e.message}`;
    $('#statusToolRunner').textContent = `Error: ${e.message}`;
  }
}

function showSaveStatus(el, ok, warnings = [], error = null) {
  const msg = ok ? (warnings.length ? `Saved (warnings): ${warnings.join(' | ')}` : 'Saved.') : `Save failed: ${error || 'unknown error'}`;
  el.textContent = msg;
  el.style.color = ok ? '#20ffb3' : '#ff4d6d';
  setTimeout(() => { if (el) el.style.color = ''; }, 3000);
}

async function saveEditor(kind) {
  let text, statusEl;
  if (kind === 'customModules') {
    text = $('#editorCustomModules').value;
    statusEl = $('#statusCustomModules');
  } else {
    text = $('#editorToolRunner').value;
    statusEl = $('#statusToolRunner');
  }
  try {
    const res = await shadowRecon.writeCustomFile(kind, text);
    showSaveStatus(statusEl, res.ok, res.warnings, res.error);
    if (res.ok) appendFeedItem({ level: 'success', message: `${kind}.js সেভ হয়েছে।` });
    else appendFeedItem({ level: 'error', message: `${kind}.js সেভ ব্যর্থ: ${res.error}` });
  } catch(e) {
    showSaveStatus(statusEl, false, [], e.message);
    appendFeedItem({ level: 'error', message: `${kind}.js সেভ ব্যর্থ: ${e.message}` });
  }
}

// ========================== ড্রাগন অ্যানিমেশন (সাপের মতো, মাউস ফলো, লেজ) ==========================
function startDragon() {
  const canvas = $('#dragonCanvas');
  if (!canvas) {
    console.warn('dragonCanvas not found');
    return;
  }
  const ctx = canvas.getContext('2d');
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  let mouse = { x: w/2, y: h/2 };
  const segments = [];
  const SEGMENT_COUNT = 20;
  for (let i = 0; i < SEGMENT_COUNT; i++) segments.push({ x: w/2, y: h/2 });
  let dragon = { x: w/2, y: h/2, vx: 0, vy: 0 };

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function drawSegment(x, y, radius, color, isHead = false) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (isHead) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(x - radius*0.3, y - radius*0.2, radius*0.25, 0, Math.PI*2);
      ctx.arc(x + radius*0.3, y - radius*0.2, radius*0.25, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(x - radius*0.4, y - radius*0.6);
      ctx.lineTo(x - radius*0.1, y - radius*0.9);
      ctx.lineTo(x + radius*0.1, y - radius*0.9);
      ctx.lineTo(x + radius*0.4, y - radius*0.6);
      ctx.fill();
    }
  }

  function animate() {
    const dx = mouse.x - dragon.x;
    const dy = mouse.y - dragon.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const force = Math.min(0.08, 10 / (dist + 1));
    dragon.vx += dx * force;
    dragon.vy += dy * force;
    dragon.vx *= 0.94;
    dragon.vy *= 0.94;
    dragon.x += dragon.vx;
    dragon.y += dragon.vy;
    dragon.x = Math.min(Math.max(dragon.x, 20), w - 20);
    dragon.y = Math.min(Math.max(dragon.y, 20), h - 20);

    segments.unshift({ x: dragon.x, y: dragon.y });
    segments.pop();

    ctx.clearRect(0, 0, w, h);
    for (let i = segments.length - 1; i >= 0; i--) {
      const s = segments[i];
      const progress = i / segments.length;
      const radius = 22 * (1 - progress * 0.5);
      const opacity = 0.7 * (1 - progress * 0.3);
      const color = i === 0 ? `rgba(255, 59, 212, ${opacity})` : `rgba(64, 230, 255, ${opacity * 0.8})`;
      drawSegment(s.x, s.y, radius, color, i === 0);
    }
    requestAnimationFrame(animate);
  }
  animate();
}

// ========================== ডিফেন্সিভ চেক ওয়ার্কফ্লো ==========================
async function runDefensiveWorkflow() {
  const webview = $('#webview');
  const input = $('#targetInput');
  const urlFromInput = normalizeUrl(input.value);
  const current = webview.getURL ? webview.getURL() : '';
  const target = urlFromInput || normalizeUrl(current);
  if (!target) {
    appendFeedItem({ level: 'warn', message: 'একটি বৈধ Target URL দিন (https://example.com)।' });
    return;
  }
  setActiveTab('tabChecks');
  setProgress(0, 12, 'Starting');
  appendFeedItem({ level: 'info', message: `Defensive checks শুরু হচ্ছে: ${target}` });
  try {
    const res = await shadowRecon.runDefensiveChecks(target);
    if (!res.ok) {
      appendFeedItem({ level: 'error', message: `Defensive checks ব্যর্থ: ${res.error || 'unknown'}` });
      return;
    }
    $('#lastRun').textContent = JSON.stringify(res.artifacts, null, 2);
    await refreshFusionPreview();
    setActiveTab('tabReports');
  } catch(e) {
    appendFeedItem({ level: 'error', message: `Defensive checks error: ${e.message}` });
  }
}

async function runCustomTools() {
  setActiveTab('tabChecks');
  appendFeedItem({ level: 'info', message: 'Custom tools রান করা হচ্ছে...' });
  try {
    const res = await shadowRecon.runCustomTools();
    if (!res.ok) {
      appendFeedItem({ level: 'warn', message: res.message || 'Custom tools not implemented.' });
      return;
    }
    await refreshFusionPreview();
    setActiveTab('tabReports');
    appendFeedItem({ level: 'success', message: 'Custom tools সম্পন্ন।' });
  } catch(e) {
    appendFeedItem({ level: 'error', message: `Custom tools error: ${e.message}` });
  }
}

async function compressReports() {
  appendFeedItem({ level: 'info', message: 'ZIP তৈরি হচ্ছে...' });
  try {
    const res = await shadowRecon.compressReports(false);
    if (!res.ok) {
      appendFeedItem({ level: 'error', message: `ZIP export ব্যর্থ: ${res.error || 'unknown'}` });
      return;
    }
    appendFeedItem({ level: 'success', message: 'ZIP export সম্পন্ন। Downloads ফোল্ডারে সেভ হয়েছে।' });
  } catch(e) {
    appendFeedItem({ level: 'error', message: `ZIP error: ${e.message}` });
  }
}

async function generateReport() {
  appendFeedItem({ level: 'info', message: 'রিপোর্ট জেনারেট হচ্ছে...' });
  try {
    const report = await shadowRecon.generateReport();
    appendFeedItem({ level: 'success', message: `রিপোর্ট তৈরি হয়েছে: ${report.baseName}` });
  } catch(e) {
    appendFeedItem({ level: 'error', message: `Report error: ${e.message}` });
  }
}

// ========================== UI ইভেন্ট ওয়্যারিং ==========================
function wireUI() {
  $$('.tabBtn').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

  const webview = $('#webview');
  const input = $('#targetInput');

  $('#goBtn')?.addEventListener('click', () => {
    const u = normalizeUrl(input.value);
    if (!u) {
      appendFeedItem({ level: 'warn', message: 'বৈধ URL দিন।' });
      return;
    }
    webview.src = u;
    setActiveTab('tabBrowser');
    appendFeedItem({ level: 'info', message: `Navigating to ${u}` });
  });

  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#goBtn').click(); });

  $('#runDefensiveBtn')?.addEventListener('click', runDefensiveWorkflow);
  $('#runCustomBtn')?.addEventListener('click', runCustomTools);
  $('#compressBtn')?.addEventListener('click', compressReports);
  $('#clearTrafficBtn')?.addEventListener('click', clearTrafficTable);
  $('#generateReportBtn')?.addEventListener('click', generateReport);
  $('#trackThreatBtn')?.addEventListener('click', trackThreatIP);

  // সেটিংস ট্যাব
  $('#openCustomDirBtn')?.addEventListener('click', () => shadowRecon.openSettingsPath('dir'));
  $('#openCustomModulesBtn')?.addEventListener('click', () => shadowRecon.openSettingsPath('customModules'));
  $('#openToolRunnerBtn')?.addEventListener('click', () => shadowRecon.openSettingsPath('toolRunner'));
  $('#reloadEditorsBtn')?.addEventListener('click', loadEditors);
  $('#saveCustomModulesBtn')?.addEventListener('click', () => saveEditor('customModules'));
  $('#saveToolRunnerBtn')?.addEventListener('click', () => saveEditor('toolRunner'));
  $('#runCustomFromSettingsBtn')?.addEventListener('click', async () => {
    await saveEditor('customModules');
    await saveEditor('toolRunner');
    await runCustomTools();
  });

  // ওয়েবভিউ সিঙ্ক
  webview?.addEventListener('did-navigate', (e) => { if (e && e.url) input.value = e.url; });
  webview?.addEventListener('did-navigate-in-page', (e) => { if (e && e.url) input.value = e.url; });
}

function wireIPC() {
  shadowRecon.onFeedItem(item => appendFeedItem(item));
  shadowRecon.onTrafficEvent(entry => addTraffic(entry));
  shadowRecon.onProgress(p => setProgress(p.current, p.total, p.label));
  shadowRecon.onAnalysisDone(async () => {
    await refreshFusionPreview();
  });
}

// ========================== ইনিশিয়ালাইজেশন ==========================
async function init() {
  wireUI();
  wireIPC();
  startDragon();
  await loadToolsAndExploits();
  await loadEditors();
  await refreshSystemInfo();
  await refreshFusionPreview();
  setInterval(refreshSystemInfo, 10000);
  appendFeedItem({ level: 'info', message: '🚀 ShadowRecon Ultimate প্রস্তুত। ২০০ টুলস, ১০০ এক্সপ্লয়েট, ড্রাগন সক্রিয়।' });
}

init();
