/* global shadowRecon */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  traffic: [],
  maxTrafficRows: 250
};

function setActiveTab(tabId) {
  $$('.tab').forEach((t) => t.classList.remove('active'));
  $$('.tabBtn').forEach((b) => b.classList.remove('active'));
  $(`#${tabId}`).classList.add('active');
  $(`.tabBtn[data-tab="${tabId}"]`).classList.add('active');
}

function normalizeUrl(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.toString();
  } catch (_) {
    try {
      const u2 = new URL(`https://${v}`);
      return u2.toString();
    } catch (e) {
      return '';
    }
  }
}

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
}

function setProgress(current, total, label) {
  const bar = $('#progressBar');
  const text = $('#progressText');
  const pct = total ? Math.round((current / total) * 100) : 0;
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  text.textContent = `${label} (${current}/${total})`;
}

function trafficRow(entry) {
  const tr = document.createElement('tr');
  const td = (v, cls) => {
    const x = document.createElement('td');
    if (cls) x.className = cls;
    x.textContent = v;
    return x;
  };

  const timeStr = new Date(entry.ts || Date.now()).toLocaleTimeString();
  tr.appendChild(td(timeStr, 'mono'));

  const statusStr = entry.status ? String(entry.status) : '';
  tr.appendChild(td(statusStr, 'mono'));

  tr.appendChild(td(entry.method || '', 'mono'));
  tr.appendChild(td(entry.resourceType || '', 'mono'));
  tr.appendChild(td(entry.url || '', 'mono'));
  return tr;
}

function addTraffic(entry) {
  state.traffic.push(entry);
  if (state.traffic.length > 3000) state.traffic.splice(0, state.traffic.length - 3000);

  const body = $('#trafficBody');
  if (!body) return;

  body.appendChild(trafficRow(entry));
  while (body.children.length > state.maxTrafficRows) body.removeChild(body.firstChild);
}

function clearTrafficTable() {
  state.traffic = [];
  const body = $('#trafficBody');
  if (body) body.innerHTML = '';
}

function updateReportsPreview(fusionData) {
  $('#fusionPreview').textContent = JSON.stringify(fusionData, null, 2);
}

async function refreshFusionPreview() {
  try {
    const data = await shadowRecon.getFusionData();
    updateReportsPreview(data);
  } catch (_) {}
}

// Cyber-dragon animation: A scary, autonomous roaming dragon.
function startDragon() {
  const canvas = $('#dragonCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let w = 0, h = 0;

  const mouse = { x: -1000, y: -1000 };
  // Dragon segments for a longer, snake-like "scary" body
  const segments = [];
  const segmentCount = 25;
  for (let i = 0; i < segmentCount; i++) {
    segments.push({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  const dragon = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    angle: 0,
    speed: 3,
    targetX: Math.random() * window.innerWidth,
    targetY: Math.random() * window.innerHeight,
    t: 0
  };

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  resize();

  function drawSegment(x, y, radius, color, isHead = false) {
    const g = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (isHead) {
      // Glow effect for eyes
      ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff0000';
      ctx.beginPath();
      ctx.arc(x - 5, y - 5, 3, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function frame() {
    dragon.t += 0.05;

    // Autonomous Roaming Logic
    const dx = dragon.targetX - dragon.x;
    const dy = dragon.targetY - dragon.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 50) {
      dragon.targetX = Math.random() * w;
      dragon.targetY = Math.random() * h;
    }

    // React to mouse if close
    const mdx = mouse.x - dragon.x;
    const mdy = mouse.y - dragon.y;
    const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
    
    let moveX, moveY;
    if (mDist < 200) {
      // Follow mouse aggressively
      moveX = mdx / mDist;
      moveY = mdy / mDist;
      dragon.speed = 6;
    } else {
      // Roam slowly
      moveX = dx / dist;
      moveY = dy / dist;
      dragon.speed = 3;
    }

    dragon.x += moveX * dragon.speed;
    dragon.y += moveY * dragon.speed;
    dragon.angle = Math.atan2(moveY, moveX);

    // Update segments
    segments[0].x = dragon.x;
    segments[0].y = dragon.y;
    for (let i = 1; i < segmentCount; i++) {
      const s = segments[i];
      const prev = segments[i - 1];
      s.x += (prev.x - s.x) * 0.3;
      s.y += (prev.y - s.y) * 0.3;
    }

    ctx.clearRect(0, 0, w, h);

    // Draw the "Fearful" Dragon
    for (let i = segmentCount - 1; i >= 0; i--) {
      const s = segments[i];
      const p = i / segmentCount;
      const radius = isHead => isHead ? 25 : 20 * (1 - p) + 5;
      const color = i === 0 ? 'rgba(255, 59, 212, 0.8)' : `rgba(64, 230, 255, ${0.6 * (1 - p)})`;
      drawSegment(s.x, s.y, radius(i === 0), color, i === 0);
    }

    // Wings/Flicker effect
    const wingX = dragon.x;
    const wingY = dragon.y;
    ctx.strokeStyle = 'rgba(32, 255, 179, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wingX, wingY);
    ctx.lineTo(wingX + Math.cos(dragon.angle + Math.PI/2) * 50, wingY + Math.sin(dragon.angle + Math.PI/2) * 50);
    ctx.moveTo(wingX, wingY);
    ctx.lineTo(wingX + Math.cos(dragon.angle - Math.PI/2) * 50, wingY + Math.sin(dragon.angle - Math.PI/2) * 50);
    ctx.stroke();

    requestAnimationFrame(frame);
  }

  frame();
}

  function frame() {
    dragon.t += 0.016;
    // spring-follow motion
    const ax = (mouse.x - dragon.x) * 0.018;
    const ay = (mouse.y - dragon.y) * 0.018;
    dragon.vx = (dragon.vx + ax) * 0.86;
    dragon.vy = (dragon.vy + ay) * 0.86;
    dragon.x += dragon.vx;
    dragon.y += dragon.vy;

    const angle = Math.atan2(dragon.vy, dragon.vx);

    ctx.clearRect(0, 0, w, h);
    drawDragonGlow(dragon.x, dragon.y, angle, dragon.t);

    requestAnimationFrame(frame);
  }

  frame();
}

async function runDefensiveWorkflow() {
  const webview = $('#webview');
  const input = $('#targetInput');
  const urlFromInput = normalizeUrl(input.value);
  const current = webview.getURL ? webview.getURL() : '';
  const target = urlFromInput || normalizeUrl(current);

  if (!target) {
    appendFeedItem({ ts: new Date().toISOString(), level: 'warn', message: 'একটি বৈধ Target URL দিন (https://example.com)।' });
    return;
  }

  setActiveTab('tabChecks');
  setProgress(0, 12, 'Starting');
  appendFeedItem({ ts: new Date().toISOString(), level: 'info', message: `Defensive checks শুরু হচ্ছে: ${target}` });

  const res = await shadowRecon.runDefensiveChecks(target);
  if (!res.ok) {
    appendFeedItem({ ts: new Date().toISOString(), level: 'error', message: `Defensive checks ব্যর্থ: ${res.error || 'unknown'}` });
    return;
  }
  $('#lastRun').textContent = JSON.stringify(res.artifacts, null, 2);
  await refreshFusionPreview();
  setActiveTab('tabReports');
}

async function runCustomTools() {
  setActiveTab('tabChecks');
  appendFeedItem({ ts: new Date().toISOString(), level: 'info', message: 'Custom tools রান করার চেষ্টা করা হচ্ছে…' });
  const res = await shadowRecon.runCustomTools();
  if (!res.ok) {
    appendFeedItem({ ts: new Date().toISOString(), level: 'warn', message: res.message || 'Custom tools not implemented.' });
    return;
  }
  await refreshFusionPreview();
  setActiveTab('tabReports');
}

async function loadEditors() {
  try {
    const cm = await shadowRecon.readCustomFile('customModules');
    const tr = await shadowRecon.readCustomFile('toolRunner');
    if (cm.ok) $('#editorCustomModules').value = cm.content;
    if (tr.ok) $('#editorToolRunner').value = tr.content;
    $('#statusCustomModules').textContent = cm.ok ? 'Loaded.' : `Load failed: ${cm.error || ''}`;
    $('#statusToolRunner').textContent = tr.ok ? 'Loaded.' : `Load failed: ${tr.error || ''}`;
  } catch (e) {
    $('#statusCustomModules').textContent = `Load failed: ${String(e.message || e)}`;
    $('#statusToolRunner').textContent = `Load failed: ${String(e.message || e)}`;
  }
}

function showSaveStatus(el, ok, warnings = [], error = null) {
  const msg = ok
    ? (warnings && warnings.length ? `Saved (warnings): ${warnings.join(' | ')}` : 'Saved.')
    : `Save failed: ${error || 'unknown error'}`;
  el.textContent = msg;
  el.style.color = ok ? 'rgba(32,255,179,0.95)' : 'rgba(255,77,109,0.95)';
  setTimeout(() => { el.style.color = ''; }, 1800);
}

async function saveEditor(kind) {
  if (kind === 'customModules') {
    const text = $('#editorCustomModules').value;
    const res = await shadowRecon.writeCustomFile('customModules', text);
    showSaveStatus($('#statusCustomModules'), res.ok, res.warnings, res.error || res.message);
    return res;
  }
  if (kind === 'toolRunner') {
    const text = $('#editorToolRunner').value;
    const res = await shadowRecon.writeCustomFile('toolRunner', text);
    showSaveStatus($('#statusToolRunner'), res.ok, res.warnings, res.error || res.message);
    return res;
  }
  return { ok: false };
}

async function compressReports() {
  appendFeedItem({ ts: new Date().toISOString(), level: 'info', message: 'ZIP তৈরি হচ্ছে…' });
  const res = await shadowRecon.compressReports(false);
  if (!res.ok) {
    appendFeedItem({ ts: new Date().toISOString(), level: 'error', message: `ZIP export ব্যর্থ: ${res.error || 'unknown'}` });
    return;
  }
  appendFeedItem({ ts: new Date().toISOString(), level: 'success', message: 'ZIP export সম্পন্ন। Downloads ফোল্ডারে সেভ হয়েছে।' });
}

function wireUI() {
  $$('.tabBtn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  const webview = $('#webview');
  const input = $('#targetInput');

  $('#goBtn').addEventListener('click', () => {
    const u = normalizeUrl(input.value);
    if (!u) {
      appendFeedItem({ ts: new Date().toISOString(), level: 'warn', message: 'বৈধ URL দিন।' });
      return;
    }
    webview.src = u;
    setActiveTab('tabBrowser');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#goBtn').click();
  });

  $('#runDefensiveBtn').addEventListener('click', runDefensiveWorkflow);
  $('#runCustomBtn').addEventListener('click', runCustomTools);
  $('#compressBtn').addEventListener('click', compressReports);
  $('#clearTrafficBtn').addEventListener('click', clearTrafficTable);

  // Settings tab actions
  const openCustomDirBtn = $('#openCustomDirBtn');
  if (openCustomDirBtn) openCustomDirBtn.addEventListener('click', () => shadowRecon.openSettingsPath('dir'));
  const openCustomModulesBtn = $('#openCustomModulesBtn');
  if (openCustomModulesBtn) openCustomModulesBtn.addEventListener('click', () => shadowRecon.openSettingsPath('customModules'));
  const openToolRunnerBtn = $('#openToolRunnerBtn');
  if (openToolRunnerBtn) openToolRunnerBtn.addEventListener('click', () => shadowRecon.openSettingsPath('toolRunner'));
  const reloadEditorsBtn = $('#reloadEditorsBtn');
  if (reloadEditorsBtn) reloadEditorsBtn.addEventListener('click', loadEditors);

  const saveCustomModulesBtn = $('#saveCustomModulesBtn');
  if (saveCustomModulesBtn) saveCustomModulesBtn.addEventListener('click', () => saveEditor('customModules'));
  const saveToolRunnerBtn = $('#saveToolRunnerBtn');
  if (saveToolRunnerBtn) saveToolRunnerBtn.addEventListener('click', () => saveEditor('toolRunner'));
  const runCustomFromSettingsBtn = $('#runCustomFromSettingsBtn');
  if (runCustomFromSettingsBtn) runCustomFromSettingsBtn.addEventListener('click', async () => {
    // Ensure latest code is saved before running (non-blocking if already saved)
    await saveEditor('customModules');
    await saveEditor('toolRunner');
    await runCustomTools();
  });

  // Keep input synced with the currently browsed origin when possible
  webview.addEventListener('did-navigate', (e) => {
    if (e && e.url) input.value = e.url;
  });
  webview.addEventListener('did-navigate-in-page', (e) => {
    if (e && e.url) input.value = e.url;
  });
}

function wireIPC() {
  shadowRecon.onFeedItem((item) => appendFeedItem(item));
  shadowRecon.onTrafficEvent((entry) => addTraffic(entry));
  shadowRecon.onProgress((p) => setProgress(p.current, p.total, p.label));
  shadowRecon.onAnalysisDone(async () => {
    await refreshFusionPreview();
  });
}

async function init() {
  wireUI();
  wireIPC();
  startDragon();
  await loadEditors();
  await refreshFusionPreview();
  appendFeedItem({ ts: new Date().toISOString(), level: 'info', message: 'Ready. WebView ব্রাউজ করুন অথবা Defensive checks চালান।' });
}

init();
