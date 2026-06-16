'use strict';

/* ── Navigation ─────────────────────────────────────────────── */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  var pageEl = document.getElementById('page-' + page);
  var navEl  = document.getElementById('nav-' + page);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');
}

/* ── Finding card expand/collapse ──────────────────────────── */
function toggleCard(id) {
  var el = document.getElementById('fc-' + id);
  if (el) el.classList.toggle('open');
}

/* ── MCP toggle ─────────────────────────────────────────────── */
function toggleMcp(btn) {
  var row = btn.closest('.mcp-row');
  var dot = row.querySelector('.mcp-dot');
  var isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn);
  btn.classList.toggle('off', isOn);
  if (dot) {
    dot.classList.toggle('on', !isOn);
    dot.classList.toggle('off', isOn);
  }
}

/* ── Filter chips (blackboard) ──────────────────────────────── */
function setFilter(chip, section) {
  var bar = chip.closest('.filter-bar');
  if (!bar) return;
  bar.querySelectorAll('.fchip').forEach(function(c) {
    c.classList.remove('act', 'fc-crit', 'fc-high');
  });
  chip.classList.add('act');
}

/* ── Settings modal ─────────────────────────────────────────── */
function openSettings() {
  var m = document.getElementById('settings-modal');
  if (m) m.classList.remove('hidden');
}
function closeSettings() {
  var m = document.getElementById('settings-modal');
  if (m) m.classList.add('hidden');
}

/* ── Win controls ───────────────────────────────────────────── */
function bindWinControls() {
  var close = document.getElementById('btn-close');
  var min   = document.getElementById('btn-min');
  var max   = document.getElementById('btn-max');
  if (close) close.addEventListener('click', function() { if (window.vrax) window.vrax.close(); });
  if (min)   min.addEventListener('click',   function() { if (window.vrax) window.vrax.minimize(); });
  if (max)   max.addEventListener('click',   function() { if (window.vrax) window.vrax.maximize(); });
}

/* ── Key bindings ───────────────────────────────────────────── */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSettings();
});

/* ── Init ───────────────────────────────────────────────────── */
bindWinControls();
