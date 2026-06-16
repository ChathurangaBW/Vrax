'use strict';
/*
 * VRAX dispatcher — REAL agent execution via the opencode backend.
 *
 * Mirrors the reference overlay/dispatcher.py: builds a prompt with the real
 * parsed binary as context, spawns `opencode run --format json`, and streams
 * the LLM's JSON event response back token-by-token.
 *
 * No fabrication: the model actually runs, the tokens/cost are real telemetry
 * from opencode's own accounting, and the response text is the model's actual
 * output. The Operator Console renders exactly what comes back.
 */
const { spawn } = require('child_process');
const os = require('os');

function opencodeBin() {
  // npm-installed opencode puts .cmd on PATH; spawn via shell on win32
  return process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
}

// Build a real, concise context block from the parsed binary state.
// This is what the agent actually "sees" — the binary's true metadata.
function buildContext(state) {
  if (!state || !state.target) return '(no binary loaded)';
  const t = state.target;
  const c = state.counts || {};
  let ctx = `TARGET BINARY (parsed from bytes on disk, not assumed):
- filename: ${t.filename}
- format: ${t.format}
- arch: ${t.arch}
- entry point: ${t.entryPoint}
- image base: ${t.imageBase}
- subsystem: ${t.subsystem}
- file size: ${t.fileSize} bytes
- sha256: ${t.sha256}
- security: ASLR=${t.security.aslr} DEP=${t.security.dep} CFG=${t.security.cfg} HighEntropyVA=${t.security.highEntropyVA}
- ${c.sections} sections, ${c.imports} imports, ${c.exports} exports`;
  if (state.binary && state.binary.sections) {
    ctx += '\n\nSections:\n' + state.binary.sections.slice(0, 20).map(function(s) {
      return '  ' + s.name + ' @ ' + s.virtAddr + ' (' + s.perms + ', entropy ' + s.entropy + ')';
    }).join('\n');
  }
  if (state.binary && state.binary.imports && state.binary.imports.length) {
    ctx += '\n\nNotable imports (first 40):\n' + state.binary.imports.slice(0, 40).map(function(i) {
      return '  ' + i.dll + '!' + i.function;
    }).join('\n');
  }
  if (state.binary && state.binary.exports && state.binary.exports.length) {
    ctx += '\n\nExports (first 20):\n' + state.binary.exports.slice(0, 20).map(function(e) {
      return '  #' + e.ordinal + ' ' + e.name + ' @ ' + e.rva;
    }).join('\n');
  }
  return ctx;
}

function buildPrompt(state, userPrompt, mode) {
  const ctx = buildContext(state);
  return 'You are VRAX, an autonomous binary reverse-engineering analyst operating in '
    + (mode || 'CRASH') + ' mode. You are given the REAL parsed metadata of a target binary '
    + '(extracted locally from its bytes — these facts are ground truth, do not contradict them).\n\n'
    + ctx + '\n\n'
    + 'Operator request:\n' + userPrompt + '\n\n'
    + 'Respond as a reverse-engineering analyst. Be concrete and reference the real addresses/symbols '
    + 'above where relevant. If you need disassembly or decompilation that requires an MCP tool (IDA/Ghidra/'
    + 'Binary Ninja) that is not connected, say so explicitly rather than inventing output.';
}

// Dispatch a prompt. onEvent({type, ...}) is called for each parsed JSON line.
// Returns the spawned child process (caller may kill it).
function dispatch(opts) {
  const state = opts.state;
  const prompt = buildPrompt(state, opts.prompt, opts.mode || (state && state.pipeline_mode));
  const cwd = opts.cwd || (state && state.target ? require('path').dirname(state.target.path) : process.cwd());
  const model = opts.model; // optional override

  const args = ['run', '--format', 'json'];
  if (model) { args.push('-m', model); }
  args.push(prompt);

  const env = Object.assign({}, process.env);
  // CRITICAL: opencode-ai spawns Electron-based tooling internally; the harness
  // sets ELECTRON_RUN_AS_NODE=1 at user level which breaks that. Strip it.
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(opencodeBin(), args, {
    cwd,
    env,
    shell: process.platform === 'win32', // need .cmd resolution on win
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // opencode waits for stdin in some spawn contexts; close it so the run is
  // purely non-interactive (message passed as a positional arg).
  try { child.stdin.end(); } catch {}

  let buffer = '';
  let totalTokens = 0, totalCost = 0, sessionId = null;
  let fullText = '';

  function emit(ev) { if (typeof opts.onEvent === 'function') opts.onEvent(ev); }

  child.stdout.on('data', function(chunk) {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; } // skip non-JSON
      handleEvent(ev);
    }
  });

  child.stderr.on('data', function(chunk) {
    const s = chunk.toString();
    // opencode prints progress/logs to stderr; surface only real errors
    if (/error|cannot|fail|unauthor/i.test(s)) {
      emit({ type: 'log', level: 'stderr', text: s.trim() });
    }
  });

  function handleEvent(ev) {
    if (ev.sessionID && !sessionId) { sessionId = ev.sessionID; emit({ type: 'session', sessionId }); }
    if (ev.type === 'text' && ev.part && ev.part.text) {
      fullText += ev.part.text;
      emit({ type: 'text', text: ev.part.text });
    } else if (ev.type === 'reasoning' && ev.part && ev.part.text) {
      emit({ type: 'reasoning', text: ev.part.text });
    } else if (ev.type === 'tool_start') {
      emit({ type: 'tool', name: (ev.part && ev.part.tool) || 'tool', state: 'start' });
    } else if (ev.type === 'tool_end') {
      emit({ type: 'tool', name: (ev.part && ev.part.tool) || 'tool', state: 'end' });
    } else if (ev.type === 'step_finish' && ev.part && ev.part.tokens) {
      const tk = ev.part.tokens;
      if (tk.total) totalTokens = tk.total;
      totalCost += ev.part.cost || 0;
      emit({ type: 'usage', tokens: tk, cost: ev.part.cost || 0,
             tokensTotal: totalTokens, costTotal: totalCost });
    } else if (ev.type === 'error') {
      emit({ type: 'error', text: (ev.part && (ev.part.message || ev.part.error)) || 'opencode error' });
    } else if (ev.type === 'finish') {
      emit({ type: 'finish', reason: (ev.part && ev.part.reason) || 'stop' });
    }
  }

  child.on('error', function(err) {
    emit({ type: 'error', text: 'Failed to spawn opencode: ' + err.message
      + '. Is opencode installed and authenticated?' });
  });
  child.on('exit', function(code) {
    emit({ type: 'done', code, sessionId, tokensTotal: totalTokens,
           costTotal: totalCost, textLength: fullText.length });
  });

  return child;
}

module.exports = { dispatch, buildContext, buildPrompt };
