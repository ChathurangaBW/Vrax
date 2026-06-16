# 12. REALTIME_UPDATE_ARCHITECTURE.md

**Subject:** How the UI goes from static-render-on-file-change to a true live representation of the runtime.

---

## 0. Runtime Status

🟡 VRAX already has a working realtime primitive: `fs.watch` on `council_state.json` → `state-update` IPC → `renderAll()` (`main.js:36-46`, `app.js:538-541`). This genuinely updates the UI live when the file changes. **The mechanism is sound; the problem is the source** — it watches a deprecated file that nothing writes during analysis, and it pushes whole-state blobs rather than targeted events. So today "realtime" works only if a human hand-edits the JSON.

The upgrade path is: keep the Electron IPC transport, replace the trigger (file watch → event stream from the runtime), and replace the payload (whole blob → typed events). This is the one cross-cutting doc where VRAX starts 🟡 rather than 🔴.

---

## 1. Current State (As-Built)

- **Transport:** Electron IPC (`webContents.send`) — reliable, in-process, no network. `preload.js` exposes `onStateUpdate`/`onCampaignsUpdate`.
- **Trigger:** `fs.watch(STATE_FILE)` + 150ms debounce (`main.js:39-44`). Also an initial push on `did-finish-load` (`main.js:67-72`).
- **Payload:** the entire parsed `council_state.json`. Every change re-renders everything (`renderAll`, `app.js:517-525`).
- **Failure modes:** `fs.watch` silently no-ops on error (`main.js:45` `catch{}`); no re-attach; no "stale" indicator; no backpressure (rapid edits → render thrash).

---

## 2. Target Architecture

### 2.1 Hybrid transport: event stream over Electron IPC

Keep Electron IPC for the desktop shell; add a typed event channel:
- `runtime-event` channel carries typed events (EVENT_SYSTEM §2.1) — targeted widget updates.
- `state-snapshot` channel carries the full read-model — sent on (re)connect and on demand (resync).
- The renderer keeps a local store mirroring the read-model; events patch it; snapshots resync it.

### 2.2 Backpressure & coalescing

- Coalesce rapid events (e.g. 50 findings written in a batch) into a single render tick (requestAnimationFrame batching).
- Debounce only for cosmetic updates (pheromone decay ticks), not for structural ones (new finding, node DEAD).
- Cap event queue; on overflow, force a snapshot resync.

### 2.3 Resilience

- Watchdog: if no event in N seconds while a campaign is ACTIVE, show "stale — last event T ago" and offer resync.
- Reconnect: if the runtime process dies, the UI shows the disconnection and offers to reconnect/restart.
- Idempotent applies: events carry version/cursor; out-of-order or duplicate events are reconciled by cursor.

### 2.4 Cursor & replay

Each event has a monotonic cursor (audit_log id). On reconnect, the renderer requests "events since cursor"; if the gap is too large, it requests a fresh snapshot. This gives at-least-once delivery with idempotent reconciliation.

### 2.5 Decay ticks (the one true timer)

Pheromone decay is computed on read (`current_pheromone`), so the UI doesn't need a decay loop — it re-reads/re-renders on a slow tick (e.g. 5s) to animate bars sinking toward their floor. This is cosmetic, not authoritative.

---

## 3. UI Surface Mapping

| Surface | Current | Required |
|---|---|---|
| Transport | IPC ✓ | IPC + typed event channel |
| Update granularity | whole re-render | targeted widget patch per event |
| Reconnect/resync | none | cursor-based replay; snapshot resync |
| Stale indicator | none | "stale since T" + resync action |
| Decay animation | none (static φ) | slow re-render tick animating decay |
| Backpressure | none | coalesce + queue cap + force-resync |

---

## 4. Gap Analysis

| # | Capability | Status | Evidence | Build requirement |
|---|---|---|---|---|
| R1 | IPC transport | 🟢 | `main.js:42` | Keep |
| R2 | File-watch trigger | 🟡 | `fs.watch` works | Replace with runtime event stream |
| R3 | Typed event channel | 🔴 | whole blob | Add `runtime-event` channel |
| R4 | Targeted updates | 🔴 | `renderAll` | Event → widget patch |
| R5 | Cursor/replay | 🔴 | none | Monotonic cursor + replay/snapshot |
| R6 | Resilience | 🔴 | silent catch{} | Watchdog, reconnect, stale indicator |
| R7 | Backpressure | 🔴 | render thrash | Coalesce + queue cap |
| R8 | Decay animation | 🔴 | static φ | Slow re-render tick |

---

## 5. Acceptance Criteria

1. With a campaign running, a new finding written in the runtime appears in the Blackboard view within one render tick without reload — via a typed event, not a whole-state blob.
2. Disconnecting the runtime shows a clear "disconnected/stale" state; reconnecting resyncs via cursor replay (or snapshot if the gap is large) with no duplicate findings.
3. A burst of 50 finding writes coalesces into a single render tick (no UI freeze); queue overflow triggers a clean snapshot resync.
4. Pheromone bars animate toward their floor over time via the decay tick, matching the authoritative `current_pheromone()` value within rounding.
5. The cursor survives a renderer reload: on reload, it resyncs to current state and resumes the event stream without loss.
