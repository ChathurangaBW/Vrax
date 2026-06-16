'use strict';

/*
 * VRAX renderer â€” REAL data only.
 *
 * - Overview / Sections / Imports / Exports render from state.target + state.binary,
 *   which are produced by parsing the actual loaded binary (see binary-parser.js).
 * - Swarm / Pipeline / Blackboard / Evidence / Reports / MCP render HONEST states:
 *     â€¢ if state.runtime_status === 'analysis_ready' â†’ "binary parsed, runtime not connected"
 *     â€¢ if a future runtime backend populates these â†’ it renders that real data
 * - NOTHING is fabricated. No hardcoded agents, no fake pheromone, no "3/3" MCP.
 */

var currentState = null;
var currentCampaigns = [];
var currentPage = 'blackboard';

/* â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function navigate(page) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.ni').forEach(function(n)   { n.classList.remove('active'); });
  var pe = document.getElementById('page-' + page);
  var ne = document.getElementById('ni-'   + page);
  if (pe) pe.classList.add('active');
  if (ne) ne.classList.add('active');
  currentPage = page;
  // re-render the target page (some need fresh data when shown)
  if (currentState) renderPage(page, currentState);
}

function toggleFC(id) { var el = document.getElementById('fc-' + id); if (el) el.classList.toggle('open'); }
function toggleMcp(btn) {
  var row = btn.closest('.mcp-row');
  if (!row) return;
  var dot = row.querySelector('.mcp-dot');
  var isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn); btn.classList.toggle('off', isOn);
  if (dot) { dot.classList.toggle('on', !isOn); dot.classList.toggle('off', isOn); }
}
function filterBB(chip, sev) {
  document.querySelectorAll('.filter-row .fchip').forEach(function(c) { c.classList.remove('sel'); });
  chip.classList.add('sel');
  document.querySelectorAll('#bb-list .fc').forEach(function(c) {
    if (!sev) { c.style.display = ''; return; }
    c.style.display = c.classList.contains('fc-' + sev) ? '' : 'none';
  });
}
function openSettings() { var m = document.getElementById('settings-modal'); if (m) m.classList.remove('hidden'); }
function closeSettings() { var m = document.getElementById('settings-modal'); if (m) m.classList.add('hidden'); }

function bindWinControls() {
  var close = document.getElementById('btn-close'), min = document.getElementById('btn-min'), max = document.getElementById('btn-max');
  if (close) close.addEventListener('click', function() { if (window.vrax) window.vrax.close(); });
  if (min)   min.addEventListener('click',   function() { if (window.vrax) window.vrax.minimize(); });
  if (max)   max.addEventListener('click',   function() { if (window.vrax) window.vrax.maximize(); });
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSettings(); });

/* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtBytes(n) {
  if (n == null) return '--';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  return (n/1048576).toFixed(2) + ' MB';
}
function sevChip(b) { // b = severity class already computed
  return b;
}
function runtimeNotConnectedBox(label) {
  return '<div class="pg-empty">'
    + '<div style="font-size:26px;opacity:0.18;margin-bottom:6px;">&#9888;</div>'
    + '<div>' + esc(label) + ' â€” runtime backend not connected</div>'
    + '<div style="font-size:10.5px;margin-top:6px;max-width:420px;">Binary metadata is real (parsed on load). Agent execution, blackboard, MCP, and reports require the VRAX orchestrator backend to be running.</div>'
    + '</div>';
}
function noBinaryBox(msg) {
  return '<div class="pg-empty"><div style="font-size:28px;opacity:0.15;">&#9632;</div><div>'
    + esc(msg || 'No binary loaded') + '</div><div style="font-size:10.5px;margin-top:4px;">Open the Targets page to load a binary</div></div>';
}

/* â”€â”€ TARGETS page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function browseFiles() {
  if (!window.vrax) return;
  var filePath = await window.vrax.openFile();
  if (!filePath) return;
  // REAL: send to main which parses the binary and creates a campaign
  var modeSel = document.getElementById('tg-mode');
  var mode = modeSel ? modeSel.value : 'CRASH';
  var btn = document.getElementById('tg-load-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Parsing binaryâ€¦'; }
  var res = await window.vrax.loadBinary(filePath, mode);
  if (btn) { btn.disabled = false; btn.textContent = 'Browse files'; }
  if (!res || !res.ok) {
    var reason = (res && res.error) ? res.error : 'unknown error';
    document.getElementById('targets-state').innerHTML =
      '<span style="color:var(--red);">Load failed: ' + esc(reason) + '</span>';
    return;
  }
  // state-update IPC will re-render everything; jump to overview to show real data
  navigate('overview');
}

/* â”€â”€ OVERVIEW page (REAL parsed metadata) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderOverview(state) {
  var el = document.getElementById('overview-content');
  if (!el) return;
  var t = state.target;
  if (!t) { el.innerHTML = noBinaryBox(); return; }

  var sec = t.security || {};
  function secCell(v, invert) {
    // invert=true means "present is BAD" (none here currently); default present=green
    if (v === null || v === undefined) return { val: 'unknown', color: 'var(--t4)' };
    var good = invert ? !v : v;
    return { val: v ? 'Present' : 'ABSENT', color: good ? 'var(--green)' : 'var(--red)' };
  }
  var sc = secCell(sec.aslr), dc = secCell(sec.dep), cc = secCell(sec.cfg),
      hc = secCell(sec.highEntropyVA), gs = secCell(sec.stack_cookies);

  var rows = [
    { lbl: 'Filename',      val: t.filename },
    { lbl: 'Format',        val: t.format },
    { lbl: 'Architecture',  val: t.arch },
    { lbl: 'Entry point',   val: t.entryPoint, mn: true },
    { lbl: 'Image base',    val: t.imageBase, mn: true },
    { lbl: 'Subsystem',     val: t.subsystem },
    { lbl: 'File size',     val: fmtBytes(t.fileSize) },
    { lbl: 'Entropy',       val: (t.overallEntropy != null ? (t.overallEntropy + ' / 8.00') : '--'),
                             color: (t.overallEntropy >= 7.2 ? 'var(--amber)' : '') },
    { lbl: 'ASLR',          val: sc.val, color: sc.color },
    { lbl: 'DEP / NX',      val: dc.val, color: dc.color },
    { lbl: 'CFG',           val: cc.val, color: cc.color },
    { lbl: 'High-Entropy VA', val: hc.val, color: hc.color },
    { lbl: 'Stack cookies', val: gs.val, color: gs.color },
    { lbl: 'SHA-256',       val: t.sha256, mn: true, small: true },
    { lbl: 'MD5',           val: t.md5, mn: true, small: true },
    { lbl: 'Sections',      val: String(state.counts.sections) },
    { lbl: 'Imports',       val: String(state.counts.imports) },
    { lbl: 'Exports',       val: String(state.counts.exports) },
  ];
  el.innerHTML = '<div class="ov-grid">' + rows.map(function(r) {
    var fs = r.small ? ';font-size:9px;' : '';
    return '<div class="ov-card"><div class="ov-lbl">' + esc(r.lbl) + '</div>'
      + '<div class="ov-val' + (r.mn ? ' mn' : '') + '"' + (r.color || fs ? ' style="' + (r.color ? 'color:' + r.color : '') + fs + '"' : '') + '>'
      + esc(r.val) + '</div></div>';
  }).join('') + '</div>';
}

/* â”€â”€ SECTIONS page (REAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderSections(state) {
  var el = document.querySelector('#page-sections .pg-content');
  if (!el) return;
  var secs = state.binary && state.binary.sections;
  if (!secs || secs.length === 0) { el.innerHTML = noBinaryBox(); return; }
  var rows = secs.map(function(s) {
    var entColor = s.entropy >= 7.2 ? 'var(--red)' : s.entropy >= 6.5 ? 'var(--amber)' : '';
    return '<tr>'
      + '<td class="mn ac">' + esc(s.name) + '</td>'
      + '<td class="mn dm">' + esc(s.virtAddr) + '</td>'
      + '<td class="mn">' + fmtBytes(s.virtSize) + '</td>'
      + '<td class="mn">' + fmtBytes(s.rawSize) + '</td>'
      + '<td>' + esc(s.perms) + '</td>'
      + '<td class="mn"' + (entColor ? ' style="color:' + entColor + ';"' : '') + '>' + s.entropy.toFixed(2) + '</td>'
      + '<td class="dm">' + esc(s.note) + '</td>'
      + '</tr>';
  }).join('');
  el.innerHTML = '<table class="dt"><thead><tr>'
    + '<th>Name</th><th>VirtAddr</th><th>VirtSize</th><th>RawSize</th><th>Perms</th><th>Entropy</th><th>Note</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>';
}

/* â”€â”€ IMPORTS page (REAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderImports(state) {
  var el = document.querySelector('#page-imports .pg-content');
  if (!el) return;
  var imps = state.binary && state.binary.imports;
  if (!imps || imps.length === 0) { el.innerHTML = noBinaryBox('No imports'); return; }
  var dlls = {};
  imps.forEach(function(i) { dlls[i.dll] = (dlls[i.dll] || 0) + 1; });
  var dllCount = Object.keys(dlls).length;
  document.querySelector('#page-imports .pg-sub').textContent = 'Â· ' + dllCount + ' DLLs Â· ' + imps.length + ' functions';
  var rows = imps.map(function(i) {
    var danger = /memcpy|strcpy|sprintf|scanf|gets|system|exec|WinExec|CreateProcess|VirtualAlloc|WriteProcessMemory|recv/i.test(i.function);
    return '<tr>'
      + '<td class="mn dm2">' + esc(i.dll) + '</td>'
      + '<td class="mn">' + esc(i.function) + '</td>'
      + '<td class="mn dm">' + esc(i.rva) + '</td>'
      + '<td' + (danger ? ' style="color:var(--amber);"' : ' class="dm"') + '>' + (danger ? '[!] risk API' : 'import') + '</td>'
      + '</tr>';
  }).join('');
  el.innerHTML = '<table class="dt"><thead><tr><th>DLL</th><th>Function</th><th>RVA</th><th>Note</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

/* â”€â”€ EXPORTS page (REAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderExports(state) {
  var el = document.querySelector('#page-exports .pg-content');
  if (!el) return;
  var exps = state.binary && state.binary.exports;
  if (!exps || exps.length === 0) {
    el.innerHTML = noBinaryBox(state.target ? 'This binary has no exports (typical for EXE)' : 'No binary loaded');
    return;
  }
  var rows = exps.map(function(e) {
    return '<tr><td class="mn dm">' + esc(e.ordinal) + '</td>'
      + '<td class="mn">' + esc(e.name) + '</td>'
      + '<td class="mn dm">' + esc(e.rva) + '</td>'
      + '<td class="dm">export</td></tr>';
  }).join('');
  el.innerHTML = '<table class="dt"><thead><tr><th>Ordinal</th><th>Name</th><th>RVA</th><th>Note</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

/* â”€â”€ EXECUTION surfaces (honest: requires runtime) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function runtimeReady(state) {
  // A future backend sets runtime_status === 'running' and fills these arrays.
  return state && state.runtime_status === 'running';
}

function renderBlackboard(state) {
  var el = document.getElementById('bb-list');
  var sub = document.getElementById('bb-sub');
  var ts = document.getElementById('bb-ts');
  if (!el) return;
  var finds = (state.blackboard && state.blackboard.findings) || [];
  if (sub) sub.textContent = finds.length ? 'Â· ' + finds.length + ' findings' : '';
  if (ts) ts.textContent = state.updated_at ? state.updated_at : '';

  ['cnt-crit','cnt-high','cnt-med'].forEach(function(id) {
    var n = document.getElementById(id); if (n) n.textContent = 0;
  });

  if (!state.target) { el.innerHTML = noBinaryBox(); return; }
  if (finds.length === 0) {
    el.innerHTML = runtimeNotConnectedBox('Blackboard');
    return;
  }
  // Real findings (when backend present) â€” render with whatever fields exist.
  el.innerHTML = finds.map(function(f, i) {
    return '<div class="fc fc-' + (f.sev || 'med') + '" id="fc-' + i + '">'
      + '<div class="fc-top" onclick="toggleFC(\'' + i + '\')"><div class="fc-row1">'
      + '<span class="fname">' + esc(f.type || f.name) + '</span>'
      + '<span class="conf">' + esc(f.status || '') + '</span></div>'
      + '<div class="fdesc">' + esc(f.desc || '') + '</div></div>'
      + '<div class="fc-foot"><span class="f-expand" onclick="toggleFC(\'' + i + '\')">&#9660; expand</span></div>'
      + '<div class="fc-body"><div class="term"><span class="t-p">' + esc(f.produced_by || '') + '</span></div></div>'
      + '</div>';
  }).join('');
}

function renderPipeline(state) {
  var el = document.getElementById('pipeline-content');
  if (!el) return;
  if (!state.target) { el.innerHTML = noBinaryBox(); return; }
  var nodes = (state.pipeline && state.pipeline.nodes) || [];
  if (nodes.length === 0) { el.innerHTML = runtimeNotConnectedBox('Pipeline'); return; }
  // Real HP-TSA nodes (when backend present)
  el.innerHTML = nodes.map(function(n) {
    return '<div class="list-card"><div style="flex:1;">'
      + '<div style="font-size:12px;font-weight:600;color:var(--t1);">' + esc(n.objective) + '</div>'
      + '<div style="font-size:10px;color:var(--t4);font-family:var(--mono);">' + esc(n.state || n.status) + '</div>'
      + '</div></div>';
  }).join('');
}

function renderSwarm(state) {
  var el = document.getElementById('swarm-content');
  var sub = document.getElementById('swarm-sub');
  if (!el) return;
  if (sub) sub.textContent = '';
  if (!state.target) { el.innerHTML = noBinaryBox(); return; }
  var agents = (state.swarm && state.swarm.agents) || [];
  if (agents.length === 0) { el.innerHTML = runtimeNotConnectedBox('Swarm'); return; }
  if (sub) sub.textContent = 'Â· ' + agents.length + ' agents Â· ' + (state.swarm.active || 0) + ' active';
  el.innerHTML = agents.map(function(a) {
    return '<div class="list-card"><div style="flex:1;">'
      + '<div style="font-size:12px;font-weight:700;font-family:var(--mono);">' + esc(a.name) + '</div>'
      + '<div style="font-size:10px;color:var(--t4);">' + esc(a.task || a.status) + '</div>'
      + '</div></div>';
  }).join('');
}

function renderEvidence(state) {
  var el = document.getElementById('evidence-list');
  if (!el) return;
  if (!state.target) { el.innerHTML = noBinaryBox(); return; }
  var ev = state.evidence || [];
  if (ev.length === 0) { el.innerHTML = runtimeNotConnectedBox('Evidence'); return; }
  el.innerHTML = ev.map(function(e) {
    return '<div class="fc fc-med"><div class="fc-top"><div class="fc-row1"><span class="fname">' + esc(e.kind) + '</span></div>'
      + '<div class="fdesc">' + esc(e.summary) + '</div></div></div>';
  }).join('');
}

function renderReports(state) {
  var el = document.querySelector('#page-reports .pg-content');
  if (!el) return;
  if (!state.target) { el.innerHTML = noBinaryBox(); return; }
  var reps = state.reports || [];
  if (reps.length === 0) { el.innerHTML = runtimeNotConnectedBox('Reports'); return; }
  el.innerHTML = reps.map(function(r) {
    return '<div class="list-card"><div style="flex:1;">'
      + '<div style="font-size:12px;font-weight:600;font-family:var(--mono);">' + esc(r.name) + '</div>'
      + '</div></div>';
  }).join('');
}

function renderCampaigns(campaigns) {
  var el = document.getElementById('campaigns-list');
  if (!el) return;
  currentCampaigns = campaigns || [];
  if (currentCampaigns.length === 0) {
    el.innerHTML = '<div class="pg-empty">No campaigns yet â€” load a binary to start</div>';
    return;
  }
  el.innerHTML = currentCampaigns.map(function(c) {
    var s = c.state || {};
    var t = s.target || {};
    var active = (currentState && currentState.campaign_id === s.campaign_id);
    return '<div class="list-card" style="cursor:pointer;margin-bottom:6px;" onclick="switchCampaign(\'' + esc(c.name) + '\')">'
      + '<div style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + (active ? 'var(--green)' : 'rgba(255,255,255,0.18)') + ';"></div>'
      + '<div style="flex:1;margin-left:8px;">'
      + '<div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--t1);">' + esc(t.filename || c.name) + '</div>'
      + '<div style="font-size:10px;color:var(--t4);font-family:var(--mono);margin-top:2px;">' + esc(t.format || '') + ' Â· ' + fmtBytes(t.fileSize) + ' Â· ' + esc(s.pipeline_mode || '') + '</div>'
      + '</div><span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;background:rgba(79,124,255,0.15);color:var(--accent);">' + (active ? 'ACTIVE' : 'IDLE') + '</span>'
      + '</div>';
  }).join('');
}

async function switchCampaign(name) {
  if (!window.vrax) return;
  // main will reload active + push state
  window.vrax.getCampaign(name); // ensure exists; real switching via state file
  // simplest: set active by re-loading the campaign's binary not available here;
  // instead rely on main pushState when active.json changes. For now navigate.
  navigate('overview');
}

/* â”€â”€ MCP panel (honest) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderMcp(state) {
  var cnt = document.getElementById('mcp-cnt');
  var list = document.getElementById('mcp-list');
  if (!list) return;
  var servers = (state.mcp && state.mcp.servers) || [];
  if (cnt) cnt.textContent = servers.length + '/' + servers.length;
  if (servers.length === 0) {
    list.innerHTML = '<div class="mcp-row" style="padding:8px 12px;"><span class="mcp-dot off"></span>'
      + '<span class="mcp-name" style="color:var(--t4);">no MCP backend connected</span></div>';
    return;
  }
  list.innerHTML = servers.map(function(s) {
    return '<div class="mcp-row"><span class="mcp-dot ' + (s.ready ? 'on' : 'off') + '"></span>'
      + '<span class="mcp-name">' + esc(s.name) + '</span>'
      + '<span class="badge ' + (s.primary ? 'badge-pri' : 'badge-sec') + '">' + (s.primary ? 'PRI' : 'SEC') + '</span>'
      + '</div>';
  }).join('');
}

/* â”€â”€ Operator Console â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderOpc(state) {
  var bin = document.getElementById('opc-cur-binary');
  var phase = document.getElementById('opc-cur-phase');
  var finds = document.getElementById('opc-cur-findings');
  var dot = document.getElementById('opc-status-dot');
  var txt = document.getElementById('opc-status-txt');
  var campPath = document.getElementById('camp-path');

  if (!state || !state.target) {
    if (bin) bin.textContent = 'No target loaded';
    if (phase) phase.textContent = '--';
    if (finds) finds.textContent = '0 findings';
    if (dot) dot.className = 'opc-dot idle';
    if (txt) txt.textContent = 'idle';
    if (campPath) campPath.textContent = 'no campaign loaded';
    return;
  }
  if (bin) bin.textContent = state.target.filename + ' Â· ' + state.target.format;
  if (phase) phase.textContent = runtimeReady(state) ? ('Phase ' + (state.orchestrator && state.orchestrator.phase || 1)) : 'parsed â€” runtime not connected';
  if (finds) finds.textContent = (state.counts.findings || 0) + ' findings';
  if (dot) dot.className = 'opc-dot ' + (runtimeReady(state) ? 'run' : 'idle');
  if (txt) txt.textContent = runtimeReady(state) ? 'running' : 'idle';
  if (campPath) campPath.textContent = 'campaigns / ' + state.target.filename + ' / ' + (state.pipeline_mode || '');

  // Operator console swarm + pipeline rails â€” honest state
  var swRows = document.getElementById('opc-swarm-rows');
  var pipeRows = document.getElementById('opc-pipe-rows');
  if (swRows) {
    var agents = (state.swarm && state.swarm.agents) || [];
    if (agents.length === 0) {
      swRows.innerHTML = '<div class="sw-row"><span class="sw-name" style="color:var(--t4);">runtime backend not connected</span></div>';
    } else {
      swRows.innerHTML = agents.map(function(a) {
        return '<div class="sw-row"><span class="sw-dot ' + (a.status === 'running' ? 'run' : a.status === 'done' ? 'done' : 'idle') + '"></span>'
          + '<span class="sw-name">' + esc(a.name) + '</span>'
          + '<span class="sw-state">' + esc(a.status || 'idle') + '</span></div>';
      }).join('');
    }
  }
  if (pipeRows) {
    var nodes = (state.pipeline && state.pipeline.nodes) || [];
    if (nodes.length === 0) {
      pipeRows.innerHTML = 'â€” requires orchestrator backend â€”';
    } else {
      pipeRows.innerHTML = nodes.map(function(n) {
        return '<div class="ph-item"><div class="ph-cb ' + (n.state === 'SATISFIED' ? 'done' : n.state === 'ACTIVE' ? 'run' : 'q') + '"></div>'
          + '<div class="ph-info"><div class="ph-name">' + esc(n.objective) + '</div></div></div>';
      }).join('');
    }
  }
}

/* â”€â”€ master render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderPage(page, state) {
  switch (page) {
    case 'overview':  renderOverview(state); break;
    case 'sections':  renderSections(state); break;
    case 'imports':   renderImports(state); break;
    case 'exports':   renderExports(state); break;
    case 'blackboard':renderBlackboard(state); break;
    case 'pipeline':  renderPipeline(state); break;
    case 'swarm':     renderSwarm(state); break;
    case 'evidence':  renderEvidence(state); break;
    case 'reports':   renderReports(state); break;
  }
}

function renderAll(state) {
  currentState = state;
  ['overview','sections','imports','exports','blackboard','pipeline','swarm','evidence','reports'].forEach(function(p) {
    renderPage(p, state);
  });
  renderCampaigns(currentCampaigns);
  renderMcp(state);
  renderOpc(state);
}

/* â”€â”€ IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
if (window.vrax) {
  window.vrax.onStateUpdate(function(state) { renderAll(state); });
  window.vrax.onCampaignsUpdate(function(campaigns) { renderCampaigns(campaigns); });
}

bindWinControls();
navigate('blackboard');

/* -- Operator Console dispatch -- REAL LLM via opencode backend ------------- */
var dispatching = false;
var feedEl = null, feedStatus = null, feedCost = null;
var costTotal = 0;

function feedScrollBottom() { if (feedEl) feedEl.scrollTop = feedEl.scrollHeight; }
function feedAdd(html, cls) {
  if (!feedEl) return;
  var line = document.createElement('div');
  line.className = 'cf-line' + (cls ? ' ' + cls : '');
  line.innerHTML = html;
  feedEl.appendChild(line);
  while (feedEl.childNodes.length > 200) feedEl.removeChild(feedEl.firstChild);
  feedScrollBottom();
}
function feedReset() {
  if (feedEl) feedEl.innerHTML = '';
  costTotal = 0;
  if (feedCost) feedCost.textContent = '';
}

async function sendPrompt() {
  if (dispatching || !window.vrax) return;
  var inp = document.getElementById('op-prompt');
  var prompt = inp ? inp.value.trim() : '';
  if (!prompt) return;
  if (!currentState || !currentState.target) {
    feedAdd('<span class="cf-msg crit">Load a binary first (Targets page).</span>');
    return;
  }
  var model = '';
  var sm = document.getElementById('set-model');
  if (sm) model = sm.value;

  feedReset();
  dispatching = true;
  var sendBtn = document.getElementById('op-send');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '...'; }
  if (feedStatus) feedStatus.textContent = 'dispatching';
  feedAdd('<span class="cf-ag co">you</span> <span class="t-d">&gt;</span> <span class="cf-msg">' + esc(prompt) + '</span>');

  var res = await window.vrax.dispatch(prompt, model);
  if (!res || !res.ok) {
    dispatching = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'SEND'; }
    if (feedStatus) feedStatus.textContent = 'error';
    feedAdd('<span class="cf-msg crit">Dispatch failed: ' + esc(res ? res.error : 'unknown') + '</span>');
    return;
  }
  if (feedStatus) feedStatus.textContent = 'running';
  inp.value = '';
}

function cancelPrompt() { if (window.vrax) window.vrax.dispatchCancel(); }

function handleDispatchEvent(ev) {
  if (!ev) return;
  if (ev.type === 'session') {
    feedAdd('<span class="cf-msg" style="color:var(--t4);">session ' + esc(String(ev.sessionId).slice(0, 18)) + '...</span>');
  } else if (ev.type === 'text') {
    feedAdd('<span class="cf-ag an">agent</span> <span class="t-d">&gt;</span> <span class="cf-msg ok">' + esc(ev.text) + '</span>');
  } else if (ev.type === 'reasoning') {
    feedAdd('<span class="cf-msg" style="color:var(--t4);font-style:italic;">[thinking] ' + esc(String(ev.text).slice(0, 160)) + '</span>');
  } else if (ev.type === 'tool') {
    var st = ev.state === 'end' ? 'done' : 'run';
    feedAdd('<span class="cf-ag zh">mcp</span> <span class="t-d">&gt;</span> <span class="cf-msg warn">' + esc(ev.name) + ' (' + st + ')</span>');
  } else if (ev.type === 'usage') {
    costTotal = ev.costTotal || costTotal;
    if (feedCost) feedCost.textContent = '$' + costTotal.toFixed(4) + ' / ' + (ev.tokensTotal || 0) + ' tok';
  } else if (ev.type === 'log') {
    feedAdd('<span class="cf-msg" style="color:var(--t4);">[' + esc(ev.level || 'log') + '] ' + esc(ev.text) + '</span>');
  } else if (ev.type === 'error') {
    feedAdd('<span class="cf-msg crit">[error] ' + esc(ev.text) + '</span>');
  } else if (ev.type === 'done') {
    dispatching = false;
    var sendBtn = document.getElementById('op-send');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'SEND'; }
    if (feedStatus) feedStatus.textContent = ev.code === 0 ? 'done' : 'exit ' + ev.code;
    feedAdd('<span class="cf-msg" style="color:var(--t4);">-- complete: $' + (ev.costTotal || 0).toFixed(4) + ' / ' + (ev.tokensTotal || 0) + ' tokens --</span>');
  }
}

function bindConsole() {
  feedEl = document.getElementById('opc-feed');
  feedStatus = document.getElementById('feed-status');
  feedCost = document.getElementById('feed-cost');
  var inp = document.getElementById('op-prompt');
  var sendBtn = document.getElementById('op-send');
  if (sendBtn) sendBtn.addEventListener('click', sendPrompt);
  if (inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendPrompt(); }
      if (e.key === 'Enter' && e.altKey) { e.preventDefault(); cancelPrompt(); }
    });
  }
  var hint = document.getElementById('inp-hint');
  if (hint) hint.textContent = 'Ctrl+Enter dispatch - Alt+Enter cancel';
}

window.addEventListener('load', async function() {
  feedEl = document.getElementById('opc-feed');
  feedStatus = document.getElementById('feed-status');
  feedCost = document.getElementById('feed-cost');
  bindConsole();
  if (!window.vrax) return;
  if (window.vrax.onDispatchEvent) window.vrax.onDispatchEvent(handleDispatchEvent);
  var state = await window.vrax.getState();
  renderAll(state);
  var campaigns = await window.vrax.getCampaigns();
  renderCampaigns(campaigns);
});
