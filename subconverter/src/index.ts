import { Hono } from 'hono';
import { corsHeaders } from './utils/response';
import * as subscriptions from './api/subscriptions';
import * as nodes from './api/nodes';
import * as profiles from './api/profiles';
import * as exportApi from './api/export';

const app = new Hono();

// CORS preflight
app.options('*', (c) => {
  return new Response(null, { status: 204, headers: corsHeaders() });
});

// ==================== Subscription Routes ====================
app.get('/api/subscriptions', subscriptions.listSubscriptions);
app.get('/api/subscriptions/:id', subscriptions.getSubscription);
app.post('/api/subscriptions', subscriptions.createSubscription);
app.put('/api/subscriptions/:id', subscriptions.updateSubscription);
app.delete('/api/subscriptions/:id', subscriptions.deleteSubscription);
app.post('/api/subscriptions/:id/sync', subscriptions.syncSubscription);
app.post('/api/subscriptions/batch-import', subscriptions.batchImport);

// ==================== Node Routes ====================
app.get('/api/nodes', nodes.listNodes);
app.get('/api/nodes/:id', nodes.getNode);
app.post('/api/nodes', nodes.createNode);
app.put('/api/nodes/:id', nodes.updateNode);
app.delete('/api/nodes/:id', nodes.deleteNode);
app.post('/api/nodes/batch-import', nodes.batchImportNodes);
app.post('/api/nodes/auto-sort', nodes.autoSortNodes);

// ==================== Profile Routes ====================
app.get('/api/profiles', profiles.listProfiles);
app.get('/api/profiles/:id', profiles.getProfile);
app.post('/api/profiles', profiles.createProfile);
app.put('/api/profiles/:id', profiles.updateProfile);
app.delete('/api/profiles/:id', profiles.deleteProfile);

// Profile <-> Subscription relations
app.post('/api/profiles/:id/subscriptions', profiles.addProfileSubscription);
app.delete('/api/profiles/:id/subscriptions/:subId', profiles.removeProfileSubscription);

// Profile <-> Node relations
app.post('/api/profiles/:id/nodes', profiles.addProfileNode);
app.delete('/api/profiles/:id/nodes/:nodeId', profiles.removeProfileNode);

// Operator Chains
app.get('/api/profiles/:id/chains', profiles.listChains);
app.post('/api/profiles/:id/chains', profiles.addChain);
app.put('/api/chains/:id', profiles.updateChain);
app.delete('/api/chains/:id', profiles.deleteChain);
app.post('/api/chains/reorder', profiles.reorderChains);

// ==================== Export Routes ====================
app.get('/export/:slug', exportApi.exportProfile);
app.get('/api/export/preview', exportApi.previewExport);
app.get('/api/clients', exportApi.listClients);

// ==================== Template Presets ====================
app.get('/api/templates', async (c) => {
  const db = (c.env as any).DB;
  const { results } = await db.prepare('SELECT * FROM template_presets ORDER BY client_type, name').all();
  return new Response(JSON.stringify({ success: true, data: results }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
});

app.post('/api/templates', async (c) => {
  const db = (c.env as any).DB;
  const body = await c.req.json();
  const { generateId, nowISO } = await import('./utils/uuid');
  const id = generateId();
  const now = nowISO();
  
  await db.prepare(
    'INSERT INTO template_presets (id, name, client_type, description, config, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.client_type, body.description || '', JSON.stringify(body.config || {}), 0, now, now).run();
  
  const preset = await db.prepare('SELECT * FROM template_presets WHERE id = ?').bind(id).first();
  return new Response(JSON.stringify({ success: true, data: preset }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
});

// ==================== Protocol list ====================
app.get('/api/protocols', (c) => {
  const protocols = [
    { id: 'ss', name: 'Shadowsocks' },
    { id: 'ss2022', name: 'Shadowsocks 2022' },
    { id: 'vmess', name: 'VMess' },
    { id: 'vless', name: 'VLESS' },
    { id: 'trojan', name: 'Trojan' },
    { id: 'hysteria2', name: 'Hysteria2' },
    { id: 'tuic', name: 'TUIC' },
    { id: 'snell', name: 'Snell' },
    { id: 'wireguard', name: 'WireGuard' },
    { id: 'anytls', name: 'AnyTLS' },
    { id: 'http', name: 'HTTP/HTTPS' },
    { id: 'socks5', name: 'SOCKS5 / SOCKS5-TLS' },
  ];
  return new Response(JSON.stringify({ success: true, data: protocols }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
});

// ==================== Static Frontend ====================
app.get('/', serveHTML);
app.get('/admin', serveHTML);
app.get('/admin/*', serveHTML);

function serveHTML(c: any) {
  const html = getFrontendHTML();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
  });
}

function getFrontendHTML(): string {
  return FRONTEND_HTML;
}

// Inline frontend HTML (will be replaced with actual content)
const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Subconverter - 订阅节点管理器</title>
<style>
:root {
  --bg: #f0f2f5;
  --bg-card: rgba(255,255,255,0.8);
  --bg-card-hover: rgba(255,255,255,0.95);
  --bg-input: rgba(255,255,255,0.9);
  --text: #1a1a2e;
  --text-secondary: #636e8a;
  --border: rgba(0,0,0,0.08);
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --shadow: 0 4px 24px rgba(0,0,0,0.06);
  --radius: 14px;
  --radius-sm: 10px;
  --blur: blur(20px);
  --glass-bg: rgba(255,255,255,0.65);
}
[data-theme="dark"] {
  --bg: #0f0f1a;
  --bg-card: rgba(20,20,40,0.8);
  --bg-card-hover: rgba(30,30,55,0.95);
  --bg-input: rgba(20,20,40,0.8);
  --text: #e8e8f0;
  --text-secondary: #8e8ea0;
  --border: rgba(255,255,255,0.08);
  --shadow: 0 4px 24px rgba(0,0,0,0.3);
  --glass-bg: rgba(20,20,40,0.65);
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  background-image: radial-gradient(ellipse at top, rgba(99,102,241,0.08), transparent 60%), radial-gradient(ellipse at bottom right, rgba(139,92,246,0.06), transparent 50%);
  transition: background 0.3s, color 0.3s;
}
.container { max-width: 1400px; margin: 0 auto; padding: 24px; }
header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 18px 28px;
  background: var(--glass-bg);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 100;
}
header h1 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.5px; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.theme-toggle {
  width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border);
  background: var(--bg-card); cursor: pointer; font-size: 1.2rem;
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
}
.theme-toggle:hover { background: var(--bg-card-hover); transform: scale(1.05); }
.btn {
  padding: 8px 18px; border-radius: var(--radius-sm); border: none;
  cursor: pointer; font-size: 0.875rem; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.2s; font-family: inherit;
}
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: #dc2626; }
.btn-success { background: var(--success); color: #fff; }
.btn-outline {
  background: transparent; border: 1px solid var(--border); color: var(--text);
}
.btn-outline:hover { background: var(--bg-card-hover); }
.btn-sm { padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; }
.tabs { display: flex; gap: 0; margin-bottom: 24px; background: var(--glass-bg); backdrop-filter: var(--blur); border-radius: var(--radius); padding: 4px; border: 1px solid var(--border); }
.tab {
  padding: 10px 20px; cursor: pointer; border-radius: calc(var(--radius) - 4px);
  font-size: 0.875rem; font-weight: 500; color: var(--text-secondary);
  transition: all 0.2s; border: none; background: transparent; font-family: inherit;
}
.tab:hover { color: var(--text); }
.tab.active { background: var(--primary); color: #fff; }
.card {
  background: var(--bg-card); backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; box-shadow: var(--shadow);
  transition: all 0.25s;
}
.card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
.section-title {
  font-size: 1.05rem; font-weight: 600; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between;
}
.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.grid-3 { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.item-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border-radius: var(--radius-sm); border: 1px solid var(--border);
  background: var(--bg-card); transition: all 0.2s;
  cursor: pointer; margin-bottom: 8px;
}
.item-row:hover { background: var(--bg-card-hover); border-color: var(--primary); transform: translateX(4px); }
.item-row.selected { border-color: var(--primary); background: rgba(99,102,241,0.08); }
.item-checkbox { width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer; }
.item-info { flex: 1; min-width: 0; }
.item-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-meta { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }
.item-badge {
  padding: 2px 10px; border-radius: 20px; font-size: 0.7rem;
  font-weight: 600; text-transform: uppercase; white-space: nowrap;
}
.badge-remote { background: rgba(99,102,241,0.12); color: var(--primary); }
.badge-manual { background: rgba(34,197,94,0.12); color: var(--success); }
.badge-ss { background: rgba(245,158,11,0.12); color: var(--warning); }
.badge-vmess { background: rgba(99,102,241,0.12); color: var(--primary); }
.badge-vless { background: rgba(139,92,246,0.12); color: #8b5cf6; }
.badge-trojan { background: rgba(239,68,68,0.12); color: var(--danger); }
.badge-hysteria { background: rgba(34,197,94,0.12); color: var(--success); }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; backdrop-filter: blur(4px);
}
.modal {
  background: var(--bg-card); backdrop-filter: var(--blur);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 28px; max-width: 520px; width: 90%; max-height: 80vh;
  overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.modal h3 { font-size: 1.15rem; margin-bottom: 20px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary); }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 10px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-input);
  color: var(--text); font-size: 0.875rem; font-family: inherit;
  transition: border-color 0.2s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
  outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
.empty-state {
  text-align: center; padding: 48px 20px; color: var(--text-secondary);
}
.empty-state .icon { font-size: 3rem; margin-bottom: 12px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.status-online { background: var(--success); }
.status-offline { background: var(--text-secondary); }
.profile-link-box {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--bg-input); border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 0.8rem; font-family: monospace;
  overflow: hidden;
}
.profile-link-box span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn { cursor: pointer; padding: 4px 8px; border: none; background: var(--primary); color: #fff; border-radius: 4px; font-size: 0.7rem; }
.client-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.client-tag {
  padding: 4px 12px; border-radius: 20px; font-size: 0.75rem;
  border: 1px solid var(--border); background: var(--bg-card);
  cursor: pointer; transition: all 0.2s;
}
.client-tag:hover, .client-tag.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.toast {
  position: fixed; bottom: 24px; right: 24px; z-index: 2000;
  padding: 12px 24px; border-radius: var(--radius-sm);
  background: var(--primary); color: #fff; font-weight: 500;
  box-shadow: 0 8px 24px rgba(99,102,241,0.4);
  animation: slideIn 0.3s ease;
}
@keyframes slideIn { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.chain-pipeline {
  display: flex; flex-direction: column; gap: 8px;
}
.chain-step {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg-card);
}
.chain-step-number { width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
textarea.import-area { width: 100%; height: 200px; font-family: monospace; font-size: 0.8rem; resize: vertical; }
@media (max-width: 768px) {
  .container { padding: 12px; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  header { padding: 12px 16px; }
  header h1 { font-size: 1.1rem; }
  .tabs { overflow-x: auto; }
}
.loading-dots::after {
  content: ''; animation: dots 1.5s steps(3, end) infinite;
}
@keyframes dots { 0% { content: ''; } 33% { content: '.'; } 66% { content: '..'; } 100% { content: '...'; } }
</style>
</head>
<body>
<header>
  <h1>Subconverter</h1>
  <div class="header-actions">
    <button class="btn btn-outline btn-sm" onclick="location.reload()">🔄 刷新</button>
    <button class="theme-toggle" onclick="toggleTheme()" id="themeBtn">🌙</button>
  </div>
</header>

<div class="container">
  <div class="tabs">
    <button class="tab active" onclick="switchTab('profiles')">🗂️ 订阅分组</button>
    <button class="tab" onclick="switchTab('subscriptions')">📥 机场订阅</button>
    <button class="tab" onclick="switchTab('nodes')">🔗 节点列表</button>
    <button class="tab" onclick="switchTab('export')">📤 导出</button>
  </div>

  <!-- Profiles Tab -->
  <div id="tab-profiles" class="tab-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2 class="section-title" style="margin-bottom:0;">🗂️ 订阅分组</h2>
      <button class="btn btn-primary" onclick="openProfileModal()">+ 新建分组</button>
    </div>
    <div id="profiles-list" class="grid grid-2"></div>
  </div>

  <!-- Subscriptions Tab -->
  <div id="tab-subscriptions" class="tab-content" style="display:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 class="section-title" style="margin-bottom:0;">📥 机场订阅</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="openImportModal()">📋 批量导入</button>
        <button class="btn btn-primary" onclick="openSubscriptionModal()">+ 添加订阅</button>
      </div>
    </div>
    <div id="subscriptions-list"></div>
  </div>

  <!-- Nodes Tab -->
  <div id="tab-nodes" class="tab-content" style="display:none;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <h2 class="section-title" style="margin-bottom:0;">🔗 节点列表</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="node-filter-sub" onchange="loadNodes()" style="padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:inherit;font-size:0.8rem;">
          <option value="">全部订阅</option>
        </select>
        <select id="node-filter-proto" onchange="loadNodes()" style="padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:inherit;font-size:0.8rem;">
          <option value="">全部协议</option>
          <option value="ss">SS</option>
          <option value="vmess">VMess</option>
          <option value="vless">VLESS</option>
          <option value="trojan">Trojan</option>
          <option value="hysteria2">Hysteria2</option>
          <option value="tuic">TUIC</option>
          <option value="snell">Snell</option>
          <option value="wireguard">WireGuard</option>
          <option value="http">HTTP</option>
          <option value="socks5">SOCKS5</option>
        </select>
        <button class="btn btn-outline btn-sm" onclick="autoSortNodes()">🔤 按地区排序</button>
        <button class="btn btn-primary btn-sm" onclick="openNodeModal()">+ 添加节点</button>
      </div>
    </div>
    <div id="nodes-list"></div>
  </div>

  <!-- Export Tab -->
  <div id="tab-export" class="tab-content" style="display:none;">
    <div class="grid grid-2" style="margin-bottom:24px;">
      <div class="card">
        <div class="section-title">📥 选择订阅源</div>
        <div id="export-subs-list"></div>
      </div>
      <div class="card">
        <div class="section-title">🔗 选择手动节点</div>
        <div id="export-nodes-list"></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div class="section-title">📱 选择客户端</div>
      <div class="client-grid" id="client-grid">
        <span class="client-tag active" data-client="clash">Clash / Clash Meta</span>
        <span class="client-tag" data-client="sing-box">Sing-Box</span>
        <span class="client-tag" data-client="surge">Surge</span>
        <span class="client-tag" data-client="shadowrocket">Shadowrocket</span>
        <span class="client-tag" data-client="v2ray">V2RayN / V2RayNG</span>
        <span class="client-tag" data-client="qx">Quantumult X</span>
        <span class="client-tag" data-client="loon">Loon</span>
      </div>
    </div>
    <button class="btn btn-primary" onclick="previewExport()" style="margin-bottom:10px;">🔄 预览导出</button>
    <pre id="export-preview" style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);padding:16px;overflow:auto;max-height:500px;font-size:0.8rem;font-family:monospace;white-space:pre-wrap;display:none;"></pre>
  </div>
</div>

<div id="modal-container"></div>
<div id="toast-container"></div>

<script>
// ========== State ==========
const API = '';
let subscriptions = [], nodes = [], profiles = [];
let selectedNavTab = 'profiles';

// ========== Theme ==========
function initTheme() {
  const saved = localStorage.getItem('subconverter-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').textContent = '☀️';
  }
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('subconverter-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '🌙' : '☀️';
}
initTheme();

// ========== Toast ==========
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ========== Tab Switching ==========
function switchTab(name) {
  selectedNavTab = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.querySelector(\`.tabs .tab:nth-child(\${['profiles','subscriptions','nodes','export'].indexOf(name)+1})\`).classList.add('active');
  document.getElementById(\`tab-\${name}\`).style.display = 'block';
  if (name === 'profiles') loadProfiles();
  if (name === 'subscriptions') loadSubscriptions();
  if (name === 'nodes') loadNodes();
  if (name === 'export') loadExportTab();
}

// ========== API Helpers ==========
async function apiGet(path) {
  const res = await fetch(API + path);
  const json = await res.json();
  return json.data || json;
}
async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json;
}
async function apiPut(path, body) {
  const res = await fetch(API + path, {
    method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json;
}
async function apiDelete(path) {
  const res = await fetch(API + path, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Delete failed');
  return json;
}

// ========== Load Data ==========
async function loadSubscriptions() {
  try {
    subscriptions = await apiGet('/api/subscriptions');
    renderSubscriptions();
  } catch (e) { toast('加载订阅失败: ' + e.message); }
}
async function loadNodes(subId, proto) {
  try {
    const subParam = subId || document.getElementById('node-filter-sub')?.value || '';
    const protoParam = proto || document.getElementById('node-filter-proto')?.value || '';
    let params = [];
    if (subParam) params.push('subscription_id=' + subParam);
    if (protoParam) params.push('protocol=' + protoParam);
    nodes = await apiGet('/api/nodes' + (params.length ? '?' + params.join('&') : ''));
    renderNodes();
    // Also refresh sub filter dropdown
    const subs = await apiGet('/api/subscriptions');
    const select = document.getElementById('node-filter-sub');
    if (select) {
      select.innerHTML = '<option value="">全部订阅</option>' + subs.map(s => \`<option value="\${s.id}">\${s.name} (\${s.node_count || 0}节点)</option>\`).join('');
    }
  } catch (e) { toast('加载节点失败: ' + e.message); }
}
async function loadProfiles() {
  try {
    profiles = await apiGet('/api/profiles');
    renderProfiles();
  } catch (e) { toast('加载分组失败: ' + e.message); }
}
async function loadExportTab() {
  try {
    const subs = await apiGet('/api/subscriptions');
    const allNodes = await apiGet('/api/nodes');
    renderExportSubs(subs);
    renderExportNodes(allNodes);
  } catch (e) { toast('加载导出数据失败: ' + e.message); }
}

// ========== Render ==========
function renderSubscriptions() {
  const list = document.getElementById('subscriptions-list');
  if (!subscriptions.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无订阅</p><p style="font-size:0.8rem;">添加机场订阅或手动导入节点</p></div>';
    return;
  }
  list.innerHTML = subscriptions.map(s => \`
    <div class="item-row">
      <div class="item-info">
        <div class="item-name">\${s.name}</div>
        <div class="item-meta">
          <span class="status-dot \${s.enabled?'status-online':'status-offline'}"></span>
          \${s.type === 'remote' ? s.url ? s.url.slice(0,50)+'...' : '无URL' : '手动导入'}
          · \${s.node_count || 0} 个节点
          \${s.last_synced_at ? ' · 上次同步: '+new Date(s.last_synced_at).toLocaleString() : ' · 未同步'}
        </div>
      </div>
      <span class="item-badge badge-\${s.type === 'remote' ? 'remote' : 'manual'}">\${s.type === 'remote' ? '远程' : '手动'}</span>
      \${s.type === 'remote' ? \`<button class="btn btn-outline btn-sm" onclick="syncSubscription('\${s.id}')">🔄 同步</button>\` : ''}
      <button class="btn btn-outline btn-sm" onclick="openSubscriptionModal('\${s.id}')">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSubscription('\${s.id}')">🗑️</button>
    </div>
  \`).join('');
}

function renderNodes() {
  const list = document.getElementById('nodes-list');
  if (!nodes.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🔗</div><p>暂无节点</p></div>';
    return;
  }
  list.innerHTML = nodes.map(n => {
    const protoClass = ['ss','ss2022'].includes(n.protocol) ? 'ss' : n.protocol;
    return \`
    <div class="item-row" draggable="true" data-id="\${n.id}">
      <div class="item-info">
        <div class="item-name">\${n.name || n.address + ':' + n.port}</div>
        <div class="item-meta">\${n.address}:\${n.port} · \${n.region || '未分类'}</div>
      </div>
      <span class="item-badge badge-\${protoClass}">\${n.protocol.toUpperCase()}</span>
      <span class="status-dot \${n.enabled?'status-online':'status-offline'}"></span>
      <button class="btn btn-outline btn-sm" onclick="openNodeModal('\${n.id}')">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteNode('\${n.id}')">🗑️</button>
    </div>
  \`}).join('');
}

function renderProfiles() {
  const list = document.getElementById('profiles-list');
  if (!profiles.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🗂️</div><p>暂无分组</p><p style="font-size:0.8rem;">创建订阅分组来管理节点和生成订阅链接</p></div>';
    return;
  }
  list.innerHTML = profiles.map(p => {
    const baseUrl = window.location.origin;
    const links = ['clash','sing-box','surge','shadowrocket','v2ray','qx','loon'].map(c => {
      const url = \`\${baseUrl}/export/\${p.slug}?client=\${c}\`;
      return \`<div class="profile-link-box"><span>\${c}: \${url}</span><button class="copy-btn" onclick="copyToClipboard('\${url}')">复制</button></div>\`;
    }).join('<br>');
    return \`
    <div class="card">
      <div class="section-title" style="justify-content:space-between;">
        <span>\${p.name}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="openProfileModal('\${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProfile('\${p.id}')">🗑️</button>
        </div>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">
        🐌 \${p.slug} · \${p.subscription_count || 0} 个订阅 · \${p.node_count || 0} 个手动节点 · 默认客户端: \${p.default_client}
      </p>
      <div style="font-size:0.75rem;color:var(--text-secondary);">
        <strong>📤 订阅链接：</strong><br>
        \${links}
      </div>
    </div>
  \`}).join('');
}

function renderExportSubs(subs) {
  const list = document.getElementById('export-subs-list');
  if (!subs.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无订阅</p></div>';
    return;
  }
  list.innerHTML = subs.map(s => \`
    <div class="item-row" onclick="this.classList.toggle('selected'); this.querySelector('input').checked = !this.querySelector('input').checked">
      <input type="checkbox" class="item-checkbox" value="\${s.id}" onclick="event.stopPropagation()">
      <span>\${s.name} (\${s.node_count || 0}节点)</span>
      <span class="item-badge badge-\${s.type==='remote'?'remote':'manual'}">\${s.type==='remote'?'远程':'手动'}</span>
    </div>
  \`).join('');
}

function renderExportNodes(nodes) {
  const list = document.getElementById('export-nodes-list');
  if (!nodes.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🔗</div><p>暂无节点</p></div>';
    return;
  }
  list.innerHTML = nodes.map(n => \`
    <div class="item-row" onclick="this.classList.toggle('selected'); this.querySelector('input').checked = !this.querySelector('input').checked">
      <input type="checkbox" class="item-checkbox" value="\${n.id}" onclick="event.stopPropagation()">
      <span>\${n.name || n.address+':'+n.port}</span>
      <span class="item-badge badge-\${n.protocol}">\${n.protocol.toUpperCase()}</span>
    </div>
  \`).join('');
}

// ========== Actions ==========
async function syncSubscription(id) {
  try {
    toast('正在同步...');
    const result = await apiPost('/api/subscriptions/' + id + '/sync');
    toast(result.message || '同步完成');
    loadSubscriptions();
  } catch (e) { toast('同步失败: ' + e.message); }
}

async function deleteSubscription(id) {
  if (!confirm('确定删除此订阅？相关节点也会被删除。')) return;
  try {
    await apiDelete('/api/subscriptions/' + id);
    toast('订阅已删除');
    loadSubscriptions();
  } catch (e) { toast('删除失败: ' + e.message); }
}

async function deleteNode(id) {
  if (!confirm('确定删除此节点？')) return;
  try {
    await apiDelete('/api/nodes/' + id);
    toast('节点已删除');
    loadNodes();
  } catch (e) { toast('删除失败: ' + e.message); }
}

async function deleteProfile(id) {
  if (!confirm('确定删除此分组？')) return;
  try {
    await apiDelete('/api/profiles/' + id);
    toast('分组已删除');
    loadProfiles();
  } catch (e) { toast('删除失败: ' + e.message); }
}

async function autoSortNodes() {
  const subId = document.getElementById('node-filter-sub')?.value || '';
  try {
    const result = await apiPost('/api/nodes/auto-sort', { subscription_id: subId || undefined, sort_by: 'region' });
    toast('已排序 ' + result.data.sorted + ' 个节点');
    loadNodes();
  } catch (e) { toast('排序失败: ' + e.message); }
}

async function previewExport() {
  const selectedSubs = Array.from(document.querySelectorAll('#export-subs-list input:checked')).map(c => c.value);
  const selectedNodes = Array.from(document.querySelectorAll('#export-nodes-list input:checked')).map(c => c.value);
  const client = document.querySelector('.client-tag.active')?.dataset?.client || 'clash';
  
  if (!selectedSubs.length && !selectedNodes.length) {
    toast('请至少选择一个订阅或节点');
    return;
  }
  
  try {
    const params = new URLSearchParams();
    params.set('client', client);
    if (selectedSubs.length) params.set('subscription_ids', selectedSubs.join(','));
    if (selectedNodes.length) params.set('node_ids', selectedNodes.join(','));
    
    const res = await fetch(API + '/api/export/preview?' + params.toString());
    const text = await res.text();
    const pre = document.getElementById('export-preview');
    pre.style.display = 'block';
    pre.textContent = text;
    pre.scrollIntoView({ behavior: 'smooth' });
    toast('预览已生成');
  } catch (e) { toast('预览失败: ' + e.message); }
}

document.getElementById('client-grid').addEventListener('click', (e) => {
  if (e.target.classList.contains('client-tag')) {
    document.querySelectorAll('.client-tag').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// ========== Modals ==========
function openSubscriptionModal(id) {
  const sub = id ? subscriptions.find(s => s.id === id) : null;
  const html = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>\${sub ? '编辑订阅' : '添加订阅'}</h3>
        <div class="form-group">
          <label>名称</label>
          <input id="sub-name" value="\${sub?.name || ''}" placeholder="我的机场">
        </div>
        <div class="form-group">
          <label>订阅URL</label>
          <input id="sub-url" value="\${sub?.url || ''}" placeholder="https://example.com/sub">
        </div>
        <div class="form-group">
          <label>类型</label>
          <select id="sub-type">
            <option value="remote" \${sub?.type === 'remote' ? 'selected' : ''}>远程订阅</option>
            <option value="manual" \${sub?.type === 'manual' ? 'selected' : ''}>手动导入</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <input id="sub-notes" value="\${sub?.notes || ''}">
        </div>
        <div class="form-actions">
          <button class="btn btn-outline" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="saveSubscription('\${sub?.id || ''}')">保存</button>
        </div>
      </div>
    </div>
  \`;
  document.getElementById('modal-container').innerHTML = html;
}

async function saveSubscription(id) {
  const data = {
    name: document.getElementById('sub-name').value,
    url: document.getElementById('sub-url').value,
    type: document.getElementById('sub-type').value,
    notes: document.getElementById('sub-notes').value,
  };
  try {
    if (id) await apiPut('/api/subscriptions/' + id, data);
    else await apiPost('/api/subscriptions', data);
    closeModal();
    loadSubscriptions();
    toast(id ? '订阅已更新' : '订阅已创建');
  } catch (e) { toast('保存失败: ' + e.message); }
}

function openNodeModal(id) {
  const node = id ? nodes.find(n => n.id === id) : null;
  const cfg = node?.config ? (typeof node.config === 'string' ? node.config : JSON.stringify(node.config)) : '';
  const html = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>\${node ? '编辑节点' : '添加节点'}</h3>
        <div class="form-group">
          <label>名称</label>
          <input id="node-name" value="\${node?.name || ''}" placeholder="节点名称">
        </div>
        <div class="form-group">
          <label>协议</label>
          <select id="node-protocol">
            <option value="ss" \${node?.protocol === 'ss' ? 'selected' : ''}>Shadowsocks</option>
            <option value="ss2022" \${node?.protocol === 'ss2022' ? 'selected' : ''}>Shadowsocks 2022</option>
            <option value="vmess" \${node?.protocol === 'vmess' ? 'selected' : ''}>VMess</option>
            <option value="vless" \${node?.protocol === 'vless' ? 'selected' : ''}>VLESS</option>
            <option value="trojan" \${node?.protocol === 'trojan' ? 'selected' : ''}>Trojan</option>
            <option value="hysteria2" \${node?.protocol === 'hysteria2' ? 'selected' : ''}>Hysteria2</option>
            <option value="tuic" \${node?.protocol === 'tuic' ? 'selected' : ''}>TUIC</option>
            <option value="snell" \${node?.protocol === 'snell' ? 'selected' : ''}>Snell</option>
            <option value="wireguard" \${node?.protocol === 'wireguard' ? 'selected' : ''}>WireGuard</option>
            <option value="http" \${node?.protocol === 'http' ? 'selected' : ''}>HTTP/HTTPS</option>
            <option value="socks5" \${node?.protocol === 'socks5' ? 'selected' : ''}>SOCKS5</option>
            <option value="anytls" \${node?.protocol === 'anytls' ? 'selected' : ''}>AnyTLS</option>
          </select>
        </div>
        <div class="form-group">
          <label>地址</label>
          <input id="node-address" value="\${node?.address || ''}" placeholder="server.example.com">
        </div>
        <div class="form-group">
          <label>端口</label>
          <input id="node-port" type="number" value="\${node?.port || ''}" placeholder="443">
        </div>
        <div class="form-group">
          <label>密码/UUID</label>
          <input id="node-password" value="\${node?.password || node?.uuid || ''}">
        </div>
        <div class="form-group">
          <label>SNI</label>
          <input id="node-sni" value="\${node?.sni || ''}">
        </div>
        <div class="form-group">
          <label>传输协议</label>
          <select id="node-network">
            <option value="tcp" \${node?.network === 'tcp' ? 'selected' : ''}>TCP</option>
            <option value="ws" \${node?.network === 'ws' ? 'selected' : ''}>WebSocket</option>
            <option value="grpc" \${node?.network === 'grpc' ? 'selected' : ''}>gRPC</option>
            <option value="http" \${node?.network === 'http' ? 'selected' : ''}>HTTP</option>
            <option value="quic" \${node?.network === 'quic' ? 'selected' : ''}>QUIC</option>
          </select>
        </div>
        <div class="form-group">
          <label>地区</label>
          <input id="node-region" value="\${node?.region || ''}" placeholder="🇭🇰 香港">
        </div>
        <div class="form-group">
          <label>TLS</label>
          <select id="node-tls">
            <option value="0" \${!node?.tls ? 'selected' : ''}>关闭</option>
            <option value="1" \${node?.tls ? 'selected' : ''}>开启</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="btn btn-outline" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="saveNode('\${node?.id || ''}')">保存</button>
        </div>
      </div>
    </div>
  \`;
  document.getElementById('modal-container').innerHTML = html;
}

async function saveNode(id) {
  const data = {
    name: document.getElementById('node-name').value,
    protocol: document.getElementById('node-protocol').value,
    address: document.getElementById('node-address').value,
    port: parseInt(document.getElementById('node-port').value) || 0,
    password: document.getElementById('node-password').value,
    uuid: document.getElementById('node-password').value,
    sni: document.getElementById('node-sni').value,
    network: document.getElementById('node-network').value,
    region: document.getElementById('node-region').value,
    tls: parseInt(document.getElementById('node-tls').value),
  };
  try {
    if (id) await apiPut('/api/nodes/' + id, data);
    else await apiPost('/api/nodes', data);
    closeModal();
    loadNodes();
    toast(id ? '节点已更新' : '节点已创建');
  } catch (e) { toast('保存失败: ' + e.message); }
}

function openProfileModal(id) {
  const profile = id ? profiles.find(p => p.id === id) : null;
  const html = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>\${profile ? '编辑分组' : '新建分组'}</h3>
        <div class="form-group">
          <label>分组名称</label>
          <input id="profile-name" value="\${profile?.name || ''}" placeholder="我的专属配置">
        </div>
        <div class="form-group">
          <label>Slug (访问链接)</label>
          <input id="profile-slug" value="\${profile?.slug || ''}" placeholder="my-config">
        </div>
        <div class="form-group">
          <label>描述</label>
          <input id="profile-desc" value="\${profile?.description || ''}">
        </div>
        <div class="form-group">
          <label>默认客户端</label>
          <select id="profile-client">
            <option value="clash" \${profile?.default_client === 'clash' ? 'selected' : ''}>Clash</option>
            <option value="sing-box" \${profile?.default_client === 'sing-box' ? 'selected' : ''}>Sing-Box</option>
            <option value="surge" \${profile?.default_client === 'surge' ? 'selected' : ''}>Surge</option>
            <option value="shadowrocket" \${profile?.default_client === 'shadowrocket' ? 'selected' : ''}>Shadowrocket</option>
            <option value="v2ray" \${profile?.default_client === 'v2ray' ? 'selected' : ''}>V2Ray</option>
            <option value="qx" \${profile?.default_client === 'qx' ? 'selected' : ''}>Quantumult X</option>
            <option value="loon" \${profile?.default_client === 'loon' ? 'selected' : ''}>Loon</option>
          </select>
        </div>
        \${profile ? \`
        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px;">
          <h4 style="font-size:0.85rem;margin-bottom:8px;">操作符链 (Operator Chain)</h4>
          <div class="chain-pipeline" id="chain-list"></div>
          <button class="btn btn-outline btn-sm" onclick="addChainStep('\${profile.id}')" style="margin-top:8px;">+ 添加操作</button>
        </div>
        \` : ''}
        <div class="form-actions">
          <button class="btn btn-outline" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="saveProfile('\${profile?.id || ''}')">保存</button>
        </div>
      </div>
    </div>
  \`;
  document.getElementById('modal-container').innerHTML = html;
  
  if (profile) {
    loadChains(profile.id);
  }
}

async function loadChains(profileId) {
  try {
    const chains = await apiGet('/api/profiles/' + profileId + '/chains');
    const list = document.getElementById('chain-list');
    if (!list) return;
    list.innerHTML = chains.map((c, i) => \`
      <div class="chain-step">
        <div class="chain-step-number">\${i + 1}</div>
        <select onchange="updateChain('\${c.id}', 'op_type', this.value)" style="padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:inherit;">
          <option value="filter" \${c.op_type === 'filter' ? 'selected' : ''}>🔍 过滤 (Filter)</option>
          <option value="rename" \${c.op_type === 'rename' ? 'selected' : ''}>✏️ 重命名 (Rename)</option>
          <option value="sort" \${c.op_type === 'sort' ? 'selected' : ''}>↕️ 排序 (Sort)</option>
          <option value="dedup" \${c.op_type === 'dedup' ? 'selected' : ''}>♊ 去重 (Dedup)</option>
          <option value="script" \${c.op_type === 'script' ? 'selected' : ''}>📜 脚本 (Script)</option>
        </select>
        <input value="\${typeof c.op_config === 'string' ? c.op_config : JSON.stringify(c.op_config)}" 
               onblur="updateChain('\${c.id}', 'op_config', this.value)" 
               placeholder='配置 JSON'
               style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-family:monospace;font-size:0.75rem;">
        <button class="btn btn-danger btn-sm" onclick="deleteChain('\${c.id}')">×</button>
      </div>
    \`).join('');
    if (!chains.length) list.innerHTML = '<p style="color:var(--text-secondary);font-size:0.8rem;">暂无操作符，节点将直接导出。</p>';
  } catch(e) {}
}

async function addChainStep(profileId) {
  try {
    await apiPost('/api/profiles/' + profileId + '/chains', { op_type: 'filter', op_config: { mode: 'include', protocols: ['ss'] }, sort_order: 0 });
    loadChains(profileId);
    toast('操作已添加');
  } catch(e) { toast('添加失败'); }
}

async function updateChain(id, field, value) {
  try {
    let config = value;
    if (field === 'op_config') {
      try { config = JSON.parse(value); } catch { config = value; }
    }
    const body = {};
    body[field] = config;
    await apiPut('/api/chains/' + id, body);
  } catch(e) {}
}

async function deleteChain(id) {
  try { await apiDelete('/api/chains/' + id); toast('已删除'); }
  catch(e) { toast('删除失败'); }
  
  // Reload current profile chains
  const modal = document.getElementById('modal-container');
  const chainList = modal?.querySelector('#chain-list');
  if (chainList) {
    // Find profile ID from existing chains
    loadProfiles(); // Simple refresh
    closeModal();
  }
}

async function saveProfile(id) {
  const data = {
    name: document.getElementById('profile-name').value,
    slug: document.getElementById('profile-slug').value,
    description: document.getElementById('profile-desc').value,
    default_client: document.getElementById('profile-client').value,
  };
  try {
    if (id) await apiPut('/api/profiles/' + id, data);
    else await apiPost('/api/profiles', data);
    closeModal();
    loadProfiles();
    toast(id ? '分组已更新' : '分组已创建');
  } catch (e) { toast('保存失败: ' + e.message); }
}

function openImportModal() {
  const html = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="max-width:600px;">
        <h3>📋 批量导入节点</h3>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;">
          粘贴订阅链接内容 (支持 SS/VMess/VLESS/Trojan/Hysteria2/TUIC 等协议的URI)
        </p>
        <textarea id="import-content" class="import-area" placeholder="ss://YWVzLTI1Ni1nY206dGVzdA==@1.2.3.4:8388#Example
vmess://ewogICJ2IjogI..."
></textarea>
        <div class="form-group">
          <label>导入名称</label>
          <input id="import-name" value="" placeholder="手动导入">
        </div>
        <div class="form-actions">
          <button class="btn btn-outline" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="doBatchImport()">导入</button>
        </div>
      </div>
    </div>
  \`;
  document.getElementById('modal-container').innerHTML = html;
}

async function doBatchImport() {
  const content = document.getElementById('import-content').value;
  const name = document.getElementById('import-name').value || ('手动导入 ' + new Date().toLocaleDateString());
  if (!content.trim()) { toast('请粘贴节点内容'); return; }
  try {
    const result = await apiPost('/api/subscriptions/batch-import', { content, name });
    toast('导入完成: ' + result.data.nodes_imported + ' 个节点');
    closeModal();
    loadSubscriptions();
  } catch (e) { toast('导入失败: ' + e.message); }
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板'));
}

// ========== Initial load ==========
loadProfiles();
</script>
</body>
</html>`;

export default app;
