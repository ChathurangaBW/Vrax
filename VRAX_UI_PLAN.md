# VRAX UI Plan — Agentic RE Workstation
**Date:** 2026-06-13  
**Inspired by:** Penligent autonomous pentest console · Linear · Vercel · Datadog · Wiz.io  
**Design principle:** Mission control for an AI swarm — not a chat interface

---

## 1. Design Philosophy

VRAX is a **reverse-engineering operations center**. Every screen either:
- Shows what the AI swarm is doing right now
- Shows what the AI swarm has found so far
- Lets the operator control the swarm

**Penligent's key lessons:**
- The UI is a **war room**, not a document editor
- Information density is a feature — analysts can read fast
- Color is status, not decoration
- Streaming output from agents must be front and center
- Everything reacts in real time — no manual refresh

---

## 2. Design Tokens

```
BACKGROUNDS (darkest to brightest):
  --bg-void:        #070A0E    modal backdrops, absolute darkest
  --bg-chrome:      #0A0C10    titlebar, left nav chrome
  --bg-base:        #0D1117    main workspace background
  --bg-raised:      #111722    cards, panels, floating surfaces
  --bg-card:        #172030    raised cards, hover targets
  --bg-interactive: #1E2A3A    focused inputs, active rows

BORDERS:
  --border-subtle:  rgba(255,255,255,0.05)   section dividers
  --border-base:    rgba(255,255,255,0.08)   card edges
  --border-focus:   rgba(79,124,255,0.45)    focused inputs

TEXT:
  --text-high:      #F0F2F5    primary text, headings
  --text-base:      #D1D9E3    body text
  --text-dim:       #8892A0    labels, secondary
  --text-ghost:     #4A5668    placeholders, very muted
  --text-mono:      #9DB8D2    monospace values (addresses, hashes)

SEVERITY (CVSS-aligned):
  --sev-critical:   #FF4444    bg: rgba(255,68,68,0.10)
  --sev-high:       #F97316    bg: rgba(249,115,22,0.10)
  --sev-medium:     #F59E0B    bg: rgba(245,158,11,0.10)
  --sev-low:        #22C55E    bg: rgba(34,197,94,0.10)
  --sev-info:       #3B82F6    bg: rgba(59,130,246,0.10)

PROCESS STATE:
  --state-running:  #4F7CFF    blue — agent is active
  --state-pending:  #F59E0B    amber — queued
  --state-passed:   #22C55E    green — phase complete
  --state-failed:   #FF4444    red — agent failed
  --state-skipped:  #4A5668    gray — skipped

ACCENT:
  --accent:         #4F7CFF    primary blue
  --accent-tint:    rgba(79,124,255,0.10)
  --accent-border:  rgba(79,124,255,0.25)
  --accent-glow:    rgba(79,124,255,0.15)

PHEROMONE BAR (blackboard signal strength):
  --pheromone-high: #4F7CFF    0.80–1.00
  --pheromone-mid:  #F59E0B    0.40–0.79
  --pheromone-low:  #4A5668    0.00–0.39

TYPOGRAPHY:
  --font-ui:        'Inter', system-ui, sans-serif
  --font-mono:      'JetBrains Mono', 'Fira Code', monospace
  --size-label:     10px   uppercase tracking labels
  --size-body:      12px   standard body
  --size-data:      13px   data values, table cells
  --size-title:     15px   page titles
  --size-hero:      20px   empty state headlines

SPACING:
  --gap-xs:   4px
  --gap-sm:   8px
  --gap-md:   12px
  --gap-lg:   16px
  --gap-xl:   24px
  --gap-2xl:  32px

ANIMATION:
  --anim-fast:   100ms ease
  --anim-base:   200ms ease
  --anim-pulse:  1.6s ease-in-out infinite
```

---

## 3. Global Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  TITLEBAR   [← →]  [DEV]                                     [─][□][×]   │  32px  #0A0C10
├────────────────────────────────────────────────────────────────────────────┤
│  TOPBAR                                                                    │  38px  #0A0C10
│  ▲ VRAX │ PolyMLP.exe  PE EXE · x64 · 53 KB · 01652e88… │ MALWARE ◎ │ ⚙ │
├──────────┬─────────────────────────────────────────────────┬───────────────┤
│          │                                                 │               │
│   LEFT   │              WORKSPACE                         │   OPERATOR    │
│    NAV   │          (changes per nav item)                │   CONSOLE     │
│          │                                                 │               │
│   180px  │              flex, min 0                        │     320px     │
│          │                                                 │               │
├──────────┴─────────────────────────────────────────────────┴───────────────┤
│  (no bottom bar — Electron handles OS chrome)                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Zone sizing:**
- Titlebar: 32px — native Electron with drag region
- TopBar: 38px — brand + target identity + pipeline state
- LeftNav: 180px fixed — nav rail with section headers
- Workspace: flex 1 — all page content lives here
- OperatorConsole: 320px fixed — mission control always visible

---

## 4. TopBar Detail

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ▲ VRAX  │  PolyMLP.exe   PE EXE · x64 · 53.0 KB · 01652e88…  │  MALWARE  ◎  Phase 2/5  │  ⚙  │
│  ══════════════════════════════════════════════════════════════════════════│
│  [brand] [divider]  [filename] [sep] [format · arch · size · sha-prefix]   [divider] [mode badge] [dot] [phase] [settings]
└────────────────────────────────────────────────────────────────────────────┘

Brand section (left, fixed):
  ▲  — accent blue #4F7CFF, 13px
  VRAX — #F0F2F5, bold, 13px, letter-spacing 0.06em
  right border divider

Target identity (flex, center):
  PolyMLP.exe — #D1D9E3, 13px, font-weight 500, max-width 200px, ellipsis
  ·  — dim separator
  PE EXE — mono, 11px, #8892A0
  ·  x64 (64-bit) — mono, 11px, #8892A0
  ·  53.0 KB — mono, 11px, #8892A0
  ·  01652e88… — mono, 10px, #4A5668 (sha truncated)
  → all omitted / "No target" gray when nothing loaded

Pipeline state (right, fixed when council running):
  [MALWARE] badge — bg rgba(245,158,11,0.12), color #F59E0B, 10px bold, 2px 6px padding, 3px radius
  ●  — green pulse dot when running, static when idle
  Phase 2/5 — mono, 11px, #8892A0

Settings button (far right):
  ⚙ — 14px, rgba(255,255,255,0.28), hover to rgba(255,255,255,0.70) + bg rgba(255,255,255,0.06)
```

**Mode badge colors:**

| Mode | Badge color | Bg tint |
|---|---|---|
| MALWARE | `#F59E0B` amber | `rgba(245,158,11,0.12)` |
| CTF | `#4F7CFF` blue | `rgba(79,124,255,0.12)` |
| CRASH | `#FF4444` red | `rgba(255,68,68,0.12)` |
| ZERO-DAY | `#A855F7` purple | `rgba(168,85,247,0.12)` |
| PATCH | `#22C55E` green | `rgba(34,197,94,0.12)` |
| UAC-BYPASS | `#F97316` orange | `rgba(249,115,22,0.12)` |

---

## 5. Left Navigation Rail

```
┌──────────────────────────┐
│  WORKSPACE               │  ← section header: 10px, rgba(255,255,255,0.22), uppercase, tracking 0.07em
│                          │
│  ◎  Targets              │  ← nav item: 28px height, 8px left pad, icon 12px + label 12px
│  ▦  Campaigns            │
│                          │
│  ANALYSIS                │
│                          │
│  ◈  Overview             │  ← ACTIVE: left 2px border #4F7CFF, bg rgba(79,124,255,0.09)
│  ≡  Sections             │
│  ↓  Imports              │
│  ↑  Exports              │
│                          │
│  EXECUTION               │
│                          │
│  ⋯  Pipeline             │  ← has phase badge when council running
│  ⬡  Swarm               │  ← has agent count badge when active
│                          │
│  INTEL                   │
│                          │
│  ◉  Evidence             │  ← has finding count badge (severity colored)
│  ▪  Blackboard           │
│                          │
│  OUTPUTS                 │
│                          │
│  ▤  Reports              │
│                          │
│  SYSTEM                  │
│                          │
│  ⊕  MCP Hub             │
└──────────────────────────┘

Nav item anatomy:
  height: 28px
  padding: 0 8px 0 12px
  display: flex, align-items: center, gap: 8px
  icon: 12px, rgba(255,255,255,0.38)
  label: 12px, rgba(255,255,255,0.55)
  hover: bg rgba(255,255,255,0.04), label color rgba(255,255,255,0.80)
  active: left border 2px solid #4F7CFF, bg rgba(79,124,255,0.09), icon #4F7CFF, label #F0F2F5

Badge (right side of nav item):
  Pipeline: "3/5" — gray pill when pending, amber when running, green when done
  Swarm: "4" — blue pill showing active agent count
  Evidence: "3" — red pill when critical findings exist
```

---

## 6. Screen 1 — Targets Page (Landing)

**State A: No target loaded**

```
┌─────────────────────────────────────────────────────────┬───────────────────┐
│                                                         │  OPERATOR         │
│                                                         │  ● idle           │
│                                                         │  ─────────────────│
│                                                         │  QUICK DISPATCH   │
│  ┌────────────────────────────┐  │  ┌─────────────────┐│  ✦ Analyze bin re │
│  │                            │  │  │  CAMPAIGN        ││  ✦ CTF solve   cf │
│  │     ⬡                     │  │  │  WORKSPACE       ││  ✦ Find crash  cr │
│  │                            │  │  │                  ││  ✦ Zero-day    zd │
│  │   SELECT A TARGET          │  │  │  Open a folder   ││  ─────────────────│
│  │                            │  │  │  containing      ││                   │
│  │   Pick any binary to begin │  │  │  campaign JSON   ││  Open a target    │
│  │   reverse-engineering.     │  │  │  files.          ││  to enable the    │
│  │   No workspace required.   │  │  │                  ││  council.         │
│  │                            │  │  │  ┌─────────────┐ ││  ─────────────────│
│  │  ┌──────────────────────┐  │  │  │  │ Open Folder │ ││ ┌───────────────┐ │
│  │  │  + Browse Binary…    │  │  │  │  └─────────────┘ ││ │ Ask anything… │ │
│  │  └──────────────────────┘  │  │  │                  ││ │          [Send]│ │
│  │                            │  │  │  Recent:         ││ └───────────────┘ │
│  └────────────────────────────┘  │  │  /cracked/PolyM… ││                   │
│                                  │  │  /cracked/srv32…  ││                   │
│         1px divider              │  └─────────────────┘│                   │
│                                                         │                   │
└─────────────────────────────────────────────────────────┴───────────────────┘

BinaryPicker card: bg #172030, border #1E2A3A, border-radius 10px, pad 32px
  Icon ⬡: 32px, opacity 0.35
  Title: 14px, #D1D9E3, font-weight 600
  Body: 13px, #8892A0, line-height 1.6
  Button: full width, bg #4F7CFF, color white, 13px bold, 10px 24px, radius 8px
  Loading state: bg #2A3A50, "Analyzing…" text, not-allowed cursor

CampaignBrowser card: same styling
  Recent list: 12px mono #8892A0, hover bg #111722
```

**State B: Binary loaded — Mode Selector**

```
┌─────────────────────────────────────────────────────────┬───────────────────┐
│                                                         │  OPERATOR         │
│  PolyMLP.exe loaded                                     │  ● ready          │
│  PE EXE · x64 (64-bit) · 53.0 KB · Compiled 2026-03-02 │  ─────────────────│
│  ───────────────────────────────────────────────────    │  QUICK DISPATCH   │
│                                                         │  ✦ Analyze bin re │
│  SELECT ANALYSIS MODE                                   │  ✦ CTF solve   cf │
│                                                         │  ✦ Find crash  cr │
│  ┌──────────┐  ┌──────┐  ┌───────┐  ┌──────────┐       │  ✦ Zero-day    zd │
│  │ MALWARE  │  │ CTF  │  │ CRASH │  │ ZERO-DAY │       │  ─────────────────│
│  │          │  │      │  │       │  │          │       │  ┌───────────────┐ │
│  │ Unpack   │  │Solve │  │ Find  │  │  Novel   │       │  │ Ask anything… │ │
│  │ extract  │  │crack │  │ crash │  │  vulns   │       │  │          [Send]│ │
│  │ C2 + IOC │  │me    │  │ surface│  │  0day    │       │  └───────────────┘ │
│  └──────────┘  └──────┘  └───────┘  └──────────┘       │                   │
│                                                         │                   │
│  ┌───────┐  ┌────────────┐                              │                   │
│  │ PATCH │  │ UAC-BYPASS │                              │                   │
│  │       │  │            │                              │                   │
│  │ Find  │  │ Elevation  │                              │                   │
│  │ keygen│  │ bypass     │                              │                   │
│  │ logic │  │ vectors    │                              │                   │
│  └───────┘  └────────────┘                              │                   │
│                                                         │                   │
│  ──────────────────────────────────────────────         │                   │
│                                                         │                   │
│  Optional system prompt override:                       │                   │
│  ┌────────────────────────────────────────────────┐    │                   │
│  │  Focus on C2 beacon interval and key exchange… │    │                   │
│  └────────────────────────────────────────────────┘    │                   │
│                                                         │                   │
│  [  LAUNCH COUNCIL  ]        [Manual — go to Overview]  │                   │
│                                                         │                   │
└─────────────────────────────────────────────────────────┴───────────────────┘

Mode cards:
  default: bg #111722, border rgba(255,255,255,0.07), radius 8px, pad 16px, cursor pointer
  hover: border rgba(79,124,255,0.30), bg rgba(79,124,255,0.05)
  selected: border #4F7CFF, bg rgba(79,124,255,0.10), left pip 3px solid #4F7CFF
  label: 12px, #D1D9E3, bold
  body: 11px, #8892A0, line-height 1.5

LAUNCH button:
  bg: #4F7CFF, color white, 14px bold, 12px 32px, radius 8px, full attention
  disabled (no mode): bg #1E2A3A, color #4A5668, cursor default
```

---

## 7. Screen 2 — Pipeline Page (Live Council Tracker)

**State A: Council running**

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  PIPELINE          Mode: [MALWARE]   ◎ Phase 2 of 5   │ OPERATOR           │
│  ────────────────────────────────────────────────────  │ ● running          │
│                                                        │ ────────────────── │
│  PHASES                                                │ static-agent        │
│                                                        │ ────────────────── │
│  ✓  RECON         recon-agent   2m 14s   PASSED        │ > ida: disasm      │
│     "PE64, packed, entry 0x401000, UPX stub"           │   0x401A20…        │
│                                                        │                    │
│  ◎  STATIC        static-agent  4m 02s   RUNNING       │ > ida: xrefs_to    │
│     [████████░░░░░░░░░░░░░░░░░░░░░░░] 35%              │   3 callers found  │
│                                                        │                    │
│  ○  MALWARE       —             pending                │ ✦ ANTI_DEBUG       │
│  ○  SYNTHESIS     —             pending                │   HIGH · 0.87      │
│  ○  REPORT        —             pending                │                    │
│                                                        │ > ida: callgraph   │
│  ──────────────────────────────────────────────────    │   building…  ▌     │
│                                                        │ ────────────────── │
│  ACTIVE PHASE — STATIC                                 │       [ABORT]      │
│  ┌──────────────────────────────────────────────────┐  │                    │
│  │  Agent:    static-agent                          │  │                    │
│  │  Started:  14:22:03   Running: 4m 02s            │  │                    │
│  │  Progress: [████████░░░░░░░░░░░░░░░░░░░░░░] 35% │  │                    │
│  │  Summary:  Analyzing .text for anti-debug and    │  │                    │
│  │            crypto routines. 6 findings so far.   │  │                    │
│  └──────────────────────────────────────────────────┘  │                    │
│                                                        │                    │
│  CONSENSUS                                             │                    │
│  ┌──────────────────────────────────────────────────┐  │                    │
│  │  Confidence  [████████████░░░░░░░░░░░░░░░] 52%  │  │                    │
│  │                                                  │  │                    │
│  │  recon-agent   ✓ voted  — packed dropper         │  │                    │
│  │  static-agent  ◎ active — pending vote           │  │                    │
│  │  malware-agent ○ waiting                         │  │                    │
│  │                                                  │  │                    │
│  │  Current: Likely packed dropper with C2 comms    │  │                    │
│  └──────────────────────────────────────────────────┘  │                    │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Phase row anatomy (height 40px):
  status icon: 14px (✓ green, ◎ blue spinning, ○ gray, ✕ red)
  phase name: 12px #D1D9E3 bold uppercase
  agent name: 12px mono #8892A0
  duration: 12px mono #8892A0
  status badge: "PASSED" / "RUNNING" / "PENDING" / "FAILED"
  summary line: 11px #4A5668 italic, only for completed phases

Status badges:
  PASSED: bg rgba(34,197,94,0.10), color #22C55E, 10px, radius 3px, pad 1px 6px
  RUNNING: bg rgba(79,124,255,0.10), color #4F7CFF
  PENDING: bg rgba(255,255,255,0.04), color #4A5668
  FAILED: bg rgba(255,68,68,0.10), color #FF4444

Progress bar:
  track: rgba(255,255,255,0.06), height 3px, radius 2px
  fill: #4F7CFF, animated, smooth width transition

Consensus bar:
  < 50%: amber #F59E0B
  50-70%: blue #4F7CFF
  > 70%: green #22C55E
```

---

## 8. Screen 3 — Swarm Page (Agent Status)

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  SWARM        Iteration 2 / 5     4 active  1 done     │ OPERATOR           │
│  ──────────────────────────────────────────────────    │ ● running          │
│                                                        │ ────────────────── │
│  AGENTS                                                │ static-agent        │
│                                                        │ ────────────────── │
│  ┌──────────────────┐  ┌──────────────────┐           │ > tool calls…      │
│  │ ◎ recon-agent    │  │ ◎ static-agent   │           │                    │
│  │ ACTIVE           │  │ ACTIVE           │           │                    │
│  │ ──────────────── │  │ ──────────────── │           │                    │
│  │ Findings:  4     │  │ Findings:  6     │           │                    │
│  │ Signal:   0.87   │  │ Signal:   0.78   │           │                    │
│  │ Phase:    RECON  │  │ Phase:    STATIC │           │                    │
│  │ Last:     2m ago │  │ Last:     30s ago│           │                    │
│  └──────────────────┘  └──────────────────┘           │                    │
│                                                        │                    │
│  ┌──────────────────┐  ┌──────────────────┐           │                    │
│  │ ○ malware-agent  │  │ ✓ synthesis-agent │           │                    │
│  │ PENDING          │  │ DONE             │           │                    │
│  │ ──────────────── │  │ ──────────────── │           │                    │
│  │ Waiting for      │  │ Findings:  0     │           │                    │
│  │ STATIC phase     │  │ Verdict:   68%   │           │                    │
│  └──────────────────┘  └──────────────────┘           │                    │
│                                                        │                    │
│  ──────────────────────────────────────────────────    │                    │
│  ACTIVITY FEED                              [pause]    │                    │
│                                                        │                    │
│  30s  static-agent   ✦ ANTI_DEBUG      ████  0.87  HIGH   │              │
│  2m   recon-agent    ✦ PACKED_SECTION  ███░  0.71  HIGH   │              │
│  4m   static-agent   ✦ CRYPTO_ROUTINE  ███░  0.66  MED    │              │
│  6m   recon-agent    ✦ SUSPICIOUS_IMP  ██░░  0.54  MED    │              │
│  9m   recon-agent    ✦ STRING_ARTIFACT █░░░  0.41  INFO   │              │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Agent card:
  bg: #111722, border rgba(255,255,255,0.07), radius 8px, pad 14px
  width: calc(50% - 6px), 2-column grid with 12px gap
  header: status icon + name (12px bold #D1D9E3)
  status chip: same as phase badges
  data rows: 11px, label #4A5668, value mono #8892A0, flex space-between

Activity feed row (height 28px):
  timestamp: 10px mono #4A5668, width 32px, flex-shrink 0
  agent: 10px #4A5668, width 80px
  ✦ icon: 9px #4F7CFF
  type: 12px #D1D9E3
  pheromone bar: 40px, 4px tall, color by value (blue/amber/gray)
  score: 10px mono #8892A0
  severity badge: 10px colored

Pheromone bar in activity feed:
  ████  = 4 filled = 0.80-1.00  color: #4F7CFF
  ███░  = 3 filled = 0.60-0.79  color: #4F7CFF fading
  ██░░  = 2 filled = 0.40-0.59  color: #F59E0B
  █░░░  = 1 filled = 0.20-0.39  color: #F59E0B dim
  ░░░░  = 0 filled = 0.00-0.19  color: #4A5668
```

---

## 9. Screen 4 — Evidence Page (Blackboard Grid)

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  EVIDENCE                      14 findings   [🔍 …]   │                    │
│  ──────────────────────────────────────────────────    │  FINDING DETAIL    │
│                                                        │  ────────────────  │
│  ALL  CRIT 3  HIGH 4  MED 5  LOW 2  INFO 0             │  ANTI_DEBUG        │
│  ──────────────────────────────────────────────────    │  ────────────────  │
│                                                        │  Severity  HIGH    │
│  ┌──────────────────────────────────────────────────┐  │  Pheromone 0.87   │
│  │ NETWORK_CALLBACK               ████  0.92  CRIT  │  │  Author  static   │
│  │ C2 beacon 185.220.x.x:4444, 30s interval         │  │  Created 4m ago   │
│  │ static-agent · 2m ago                    ✕  [→]  │  │  ────────────────  │
│  └──────────────────────────────────────────────────┘  │  IsDebuggerPresent │
│                                                        │  via PEB walk at   │
│  ┌──────────────────────────────────────────────────┐  │  0x401A20. Exits   │
│  │ ANTI_DEBUG        ← SELECTED  ████  0.87  HIGH   │  │  if debugger.      │
│  │ IsDebuggerPresent + PEB walk at 0x401A20         │  │  ────────────────  │
│  │ static-agent · 4m ago                    ✕  [→]  │  │  PAYLOAD           │
│  └──────────────────────────────────────────────────┘  │  addr: 0x401A20   │
│                                                        │  tech: PEB_NtGlobal│
│  ┌──────────────────────────────────────────────────┐  │  confidence: 0.91  │
│  │ PACKED_SECTION                 ███░  0.71  HIGH  │  │  ────────────────  │
│  │ .text entropy 7.84, UPX stub at entry             │  │  TRIGGERED         │
│  │ recon-agent · 8m ago                     ✕  [→]  │  │  → synthesis-agent │
│  └──────────────────────────────────────────────────┘  │  ────────────────  │
│                                                        │  [Investigate →]   │
│  ┌──────────────────────────────────────────────────┐  │  [YARA Rule →]     │
│  │ REGISTRY_PERSISTENCE           ██░░  0.54  HIGH  │  │  [IOC Entry →]     │
│  │ HKLM\Run key write detected                      │  │                    │
│  │ malware-agent · 12m ago                  ✕  [→]  │                    │
│  └──────────────────────────────────────────────────┘  │                    │
│                                                        │                    │
│  ─ MEDIUM (5) ────────────────────────────────────     │                    │
│  [show 5 medium findings]                              │                    │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Severity filter tabs:
  tab: 11px, pad 3px 10px, radius 4px, color #8892A0
  active tab: bg severity-tint, color severity-color
  count badge: 10px, inline

Finding card:
  bg: #111722, border rgba(255,255,255,0.06), radius 6px, pad 10px 12px
  hover: bg #172030, border rgba(255,255,255,0.10)
  selected: border #4F7CFF (left 2px), bg rgba(79,124,255,0.05)

  Left: finding type (12px bold #D1D9E3) + description (11px #8892A0)
  Right: pheromone bar (40px, 3px tall) + score (10px mono) + severity badge

  Bottom row: agent (10px #4A5668) + time (10px #4A5668)
  Actions (hover): ✕ dismiss + [→] open detail

Pheromone bar on finding card:
  Color = severity color
  Width = pheromone * 40px

Severity badge styles:
  CRIT: bg rgba(255,68,68,0.12), color #FF4444
  HIGH: bg rgba(249,115,22,0.12), color #F97316
  MED:  bg rgba(245,158,11,0.12), color #F59E0B
  LOW:  bg rgba(34,197,94,0.12), color #22C55E
  INFO: bg rgba(59,130,246,0.12), color #3B82F6
  all: 10px bold, pad 1px 6px, radius 3px, letter-spacing 0.03em

Detail panel (320px, right):
  header: finding type (13px bold), severity badge
  data rows: label (10px #4A5668 uppercase) + value (12px mono #D1D9E3)
  payload: mono JSON display, 11px, bg #0D1117, radius 4px, pad 8px
  triggered agents: 11px #8892A0
  action buttons: full width, outlined style
```

---

## 10. Screen 5 — Operator Console (Mission Control — 3 Modes)

### Mode 1: Idle

```
┌─────────────────────────────────────────┐
│  OPERATOR                      ● idle   │  38px header
│  ─────────────────────────────────────  │
│  LAUNCH COUNCIL                         │  section label 10px uppercase
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ ▪ MALWARE    Unpack · C2 · YARA  ↗ ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ▪ CTF        Solve crackme/flag  ↗  ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ▪ CRASH      Find crash surface  ↗  ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ▪ ZERO-DAY   Novel vuln hunt     ↗  ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ ▪ PATCH      Keygen / license    ↗  ││
│  └─────────────────────────────────────┘│
│  ─────────────────────────────────────  │
│  Open a target binary in Targets        │  12px #8892A0
│  then select a mode to launch           │
│  the agent council.                     │
│  ─────────────────────────────────────  │
│  ┌─────────────────────────────────────┐│
│  │ Optional prompt override…           ││
│  │                                     ││
│  │                           [LAUNCH]  ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘

Mode dispatch buttons:
  height: 34px, bg #111722, border rgba(255,255,255,0.06), radius 6px
  ▪ icon: 8px, mode color
  label: 12px #D1D9E3 bold
  description: 11px #4A5668
  ↗ arrow: 10px #4A5668, hover shows
  hover: bg #172030, border rgba(255,255,255,0.10)
```

### Mode 2: Council Running

```
┌─────────────────────────────────────────┐
│  OPERATOR                  ● running    │
│  ─────────────────────────────────────  │
│  static-agent    STATIC phase           │  agent label + phase
│  ─────────────────────────────────────  │
│                                         │
│  > ida-pro: disasm(0x401A20)            │  12px mono, tool calls #4A5668
│    → 14 instructions, JMP chain         │  result indent 2 spaces, #8892A0
│                                         │
│  > ida-pro: xrefs_to(0x401A20)          │
│    → 3 callers: 0x4019A0, 0x401B20,     │
│      0x401C40                           │
│                                         │
│  ╔══════════════════════════════════╗   │  finding deposit: highlighted box
│  ║ ✦ ANTI_DEBUG deposited           ║   │  bg rgba(79,124,255,0.07)
│  ║   HIGH · 0.87 pheromone          ║   │  border-left 2px #4F7CFF
│  ║   IsDebuggerPresent via PEB walk  ║   │  12px #D1D9E3
│  ╚══════════════════════════════════╝   │
│                                         │
│  > ida-pro: callgraph()                 │
│    building…  ▌                         │  cursor blink on active line
│                                         │
│  ─────────────────────────────────────  │
│                          [ABORT]        │  right-aligned, red outline btn
└─────────────────────────────────────────┘

Stream line types:
  Tool call:    "  > toolname: method(args)"  10px mono #4A5668
  Tool result:  "    → result text"           11px #8892A0, 2 space indent
  Finding:      boxed deposit card (see above)
  Phase change: "  ◎ MALWARE phase starting"  11px #4F7CFF
  Error:        "  ✕ error message"           11px #FF4444

Cursor blink on active line:
  ▌ character, animate opacity 0→1 at 700ms interval
```

### Mode 3: HITL Gate

```
┌─────────────────────────────────────────┐
│  OPERATOR          ⚠ APPROVAL NEEDED    │  amber header accent
│  ─────────────────────────────────────  │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  synthesis-agent paused             ││  bg rgba(245,158,11,0.07)
│  │  ─────────────────────────────────  ││  border #F59E0B, radius 8px
│  │                                     ││
│  │  "Confidence 61% — below 70%        ││  13px #D1D9E3
│  │   threshold. Run another DYNAMIC    ││
│  │   iteration for deeper analysis?"   ││
│  │                                     ││
│  │  Council state:                     ││
│  │  Findings so far:  8                ││  11px #8892A0
│  │  Consensus:        61%  ███████░░░  ││
│  │  Top finding:      ANTI_DEBUG 0.87  ││
│  │                                     ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌──────────────┐  ┌───────────────────┐│
│  │ YES          │  │ NO — PROCEED      ││  two buttons, full row
│  │ Re-run DYNAMIC  PROCEED to SYNTH   ││
│  └──────────────┘  └───────────────────┘│
└─────────────────────────────────────────┘

Gate card:
  bg: rgba(245,158,11,0.07), border: 1px solid rgba(245,158,11,0.25), radius 8px
  header: ⚠ amber, 11px uppercase "APPROVAL NEEDED"
  question: 13px #D1D9E3, line-height 1.6
  context data: 11px label/value pairs #8892A0

YES button: bg #4F7CFF, white, 13px bold, full row height 38px, radius 6px
NO button: bg transparent, border rgba(255,255,255,0.12), #D1D9E3, same sizing
```

---

## 11. Screen 6 — MCP Hub

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  MCP HUB                              [+ Add Server]   │  OPERATOR          │
│  ──────────────────────────────────────────────────    │  ● ready           │
│                                                        │  ────────────────  │
│  ┌──────────────────────┐  ┌──────────────────────┐   │  ✦ List IDA funcs  │
│  │ ida-pro-mcp          │  │ ghidra-mcp           │   │  ✦ Decompile main  │
│  │ ● Connected          │  │ ● Connected          │   │  ✦ List imports    │
│  │ 32 tools available   │  │ 18 tools available   │   │  ────────────────  │
│  │ ──────────────────── │  │ ──────────────────── │   │                    │
│  │ decompile         ▸  │  │ decompile         ▸  │   │                    │
│  │ disasm            ▸  │  │ list_functions    ▸  │   │                    │
│  │ list_funcs        ▸  │  │ xrefs_to          ▸  │   │                    │
│  │ rename            ▸  │  │ get_string        ▸  │   │                    │
│  │ set_type          ▸  │  │ + 14 more…           │   │                    │
│  │ patch_asm         ▸  │  └──────────────────────┘   │                    │
│  │ + 26 more…           │                              │                    │
│  └──────────────────────┘  ┌──────────────────────┐   │                    │
│                             │ binary-ninja-mcp     │   │                    │
│  ┌──────────────────────┐  │ ● Connected          │   │                    │
│  │ zap                  │  │ 22 tools available   │   │                    │
│  │ ● Connected          │  └──────────────────────┘   │                    │
│  │ 8 tools              │                              │                    │
│  └──────────────────────┘                              │                    │
│                                                        │                    │
│  ──────────────────────────────────────────────────    │                    │
│  HOW TO USE                                            │                    │
│  IDA Pro + Ghidra are connected. Open a campaign,      │                    │
│  launch a council, and agents will call MCP tools      │                    │
│  automatically. Or dispatch a manual prompt above.     │                    │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Server card:
  bg: #111722, border rgba(255,255,255,0.07), radius 8px, pad 14px 16px
  width: calc(50% - 6px), 2-column grid
  status dot: 6px, green #22C55E (connected), red (failed), gray (disabled)
  name: 13px bold #D1D9E3
  tool count: 11px #8892A0
  tool list: 12px mono #4A5668, hover → #8892A0
  ▸ arrow: 9px, shows on hover
```

---

## 12. Screen 7 — Reports Page

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  REPORT     PolyMLP.exe · Malware Analysis · 2026-06-13│  OPERATOR          │
│  ──────────────────────────────────────────────────    │  ● done            │
│                                                        │  ────────────────  │
│  [Export PDF]  [Export YARA]  [Export IOCs]  [Copy ↓]  │  ✦ Exec summary    │
│  ──────────────────────────────────────────────────    │  ✦ Technical RPT   │
│                                                        │  ✦ Export YARA     │
│  EXECUTIVE SUMMARY                                     │  ✦ Export IOCs     │
│                                                        │                    │
│  PolyMLP.exe is a packed dropper with active C2        │                    │
│  beacon capabilities. Static and malware analysis      │                    │
│  identified 3 critical and 4 high-severity findings.   │                    │
│  Confidence: 89%. Classification: MALWARE/DROPPER.     │                    │
│                                                        │                    │
│  CRITICAL FINDINGS                                     │                    │
│  ● NETWORK_CALLBACK — C2 beacon to 185.220.x.x:4444   │                    │
│  ● ANTI_DEBUG — PEB walk + NtQueryInformationProcess   │                    │
│  ● REGISTRY_PERSISTENCE — HKLM\Run write detected      │                    │
│                                                        │                    │
│  YARA RULE                                             │                    │
│  ┌──────────────────────────────────────────────────┐  │                    │
│  │ rule PolyMLP_Dropper_C2 {                        │  │                    │
│  │   meta:                                          │  │                    │
│  │     description = "PolyMLP packed dropper"       │  │                    │
│  │   strings:                                       │  │                    │
│  │     $c2 = { B9 20 03 00 00 }                    │  │                    │
│  │   condition: $c2                                 │  │                    │
│  │ }                                                │  │                    │
│  └──────────────────────────────────────────────────┘  │                    │
│                                                        │                    │
│  IOC LIST                                              │                    │
│  185.220.100.1:4444  — C2 server                      │                    │
│  svchost32.exe       — dropped payload name           │                    │
│  HKLM\...\Run\Updater — persistence key               │                    │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Report content:
  bg: #0D1117, single column, max-width 760px, centered, pad 24px
  h1: 15px bold #F0F2F5
  h2: 12px uppercase bold #4A5668, letter-spacing 0.08em, margin-top 24px
  body: 13px #D1D9E3, line-height 1.7
  bullet: ● 12px, severity color, label #D1D9E3
  code block: bg #111722, border #1E2A3A, radius 6px, mono 12px, pad 12px
  export bar: bg #111722, border-bottom #1E2A3A, pad 8px 16px, sticky top
```

---

## 13. Screen 8 — Overview / Binary Identity (Analysis)

```
┌────────────────────────────────────────────────────────┬────────────────────┐
│  PolyMLP.exe   PE EXE                                  │  OPERATOR          │
│  ──────────────────────────────────────────────────    │  ● ready           │
│                                                        │  ────────────────  │
│  ┌────────────────────────────┐  ┌──────────────────┐  │  ✦ Decompile entry │
│  │ IDENTITY                   │  │ HASHES           │  │  ✦ Find susp sects │
│  │ ─────────────────────────  │  │ ───────────────  │  │  ✦ Analyze imports │
│  │ Name        PolyMLP.exe   │  │ MD5              │  │  ✦ Check timestamp  │
│  │ Format      PE EXE        │  │ 371366E94F…      │  │  ────────────────  │
│  │ Architecture x64 (64-bit) │  │          [copy]  │  │  ┌──────────────┐  │
│  │ Subsystem    Win Console   │  │                  │  │  │ Ask anything… │  │
│  │ Size         53.0 KB       │  │ SHA256           │  │  │      [Send]   │  │
│  │ Compiled     2026-03-02    │  │ 01652E8B03E2…    │  │  └──────────────┘  │
│  │ Entry Point  0x00008430    │  │          [copy]  │  │                    │
│  │ ImageBase    0x140000000   │  └──────────────────┘  │                    │
│  │             [CONSOLE]      │                         │                    │
│  └────────────────────────────┘                         │                    │
│                                                        │                    │
│  SECTIONS                                              │                    │
│  ──────────────────────────────────────────────────    │                    │
│  Name    VirtAddr       VirtSize  RawSize  Flags       │                    │
│  ──────────────────────────────────────────────────    │                    │
│  .text   0x00001000     34,107    34,304   CODE EXEC   │                    │
│  .rdata  0x0000A000     14,728    14,848   IDATA READ  │                    │
│  .data   0x0000E000      2,424     1,024   IDATA WRITE │                    │
│  .pdata  0x0000F000      1,848     2,048   IDATA READ  │                    │
│  .rsrc   0x00010000        480       512   IDATA READ  │                    │
│  .reloc  0x00011000        148       512   IDATA READ  │                    │
│                                                        │                    │
└────────────────────────────────────────────────────────┴────────────────────┘

Identity card + Hash card:
  same card style as before (bg #111722, border, radius 10px)
  label col: 11px #4A5668
  value col: 12px mono #D1D9E3 or #9DB8D2 for addresses
  subsystem badge: bg rgba(79,124,255,0.12), color #4F7CFF

Sections table:
  header: 10px uppercase #4A5668, letter-spacing 0.07em
  row: 28px height, 12px mono
  Name col: #D1D9E3
  address cols: #9DB8D2 (blue-gray mono for hex)
  sizes: #8892A0
  flags: colored — CODE=blue, EXEC=amber, WRITE=red-tint, READ=gray
  hover: bg rgba(255,255,255,0.03)
  stripe: alternating rgba(255,255,255,0.015)
```

---

## 14. Component Library

### Status Dot + Label

```
● running    = 6px dot #4F7CFF (pulse) + 11px "running" #8892A0
● ready      = 6px dot #22C55E + 11px "ready" rgba(255,255,255,0.35)
● idle       = 6px dot rgba(255,255,255,0.18) + 11px "idle"
● session    = 6px dot #F59E0B + 11px "session"

Pulse animation (running only):
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.45 } }
  animation: 1.6s ease-in-out infinite
```

### Pheromone Bar

```
[████░░░░]  — 40px total, 4px height, radius 2px
             fill: pheromone * 40px
             color: >0.70 = #4F7CFF, >0.40 = #F59E0B, else #4A5668
             track: rgba(255,255,255,0.06)
```

### Phase Badge

```
PASSED    bg rgba(34,197,94,0.10)   color #22C55E
RUNNING   bg rgba(79,124,255,0.10)  color #4F7CFF
PENDING   bg rgba(255,255,255,0.04) color #4A5668
FAILED    bg rgba(255,68,68,0.10)   color #FF4444
SKIPPED   bg rgba(255,255,255,0.04) color #4A5668

all: 10px bold, pad 1px 6px, radius 3px, letter-spacing 0.04em, uppercase
```

### Quick Action Row

```
┌─ QUICK ACTIONS ─────────────────────────┐
│  ✦ Decompile entry point           dc   │
│  ✦ Find suspicious sections        ss   │
└─────────────────────────────────────────┘

row height: 26px, pad 0 14px
✦: 9px #4F7CFF, flex-shrink 0
label: 12px rgba(255,255,255,0.38)
hint: 9px mono rgba(255,255,255,0.15), margin-left auto
hover: bg rgba(255,255,255,0.04), label rgba(255,255,255,0.70)
```

### Finding Deposit Notification (in stream)

```
╔════════════════════════════════════╗
║  ✦ NETWORK_CALLBACK deposited     ║   border-left: 2px solid #4F7CFF
║     CRITICAL · 0.92 pheromone     ║   bg: rgba(79,124,255,0.07)
║     C2 beacon 185.220.x.x:4444    ║   pad: 8px 12px, margin: 6px 0
╚════════════════════════════════════╝   radius: 4px

CRITICAL → left border #FF4444, bg rgba(255,68,68,0.07)
HIGH     → left border #F97316, bg rgba(249,115,22,0.07)
MEDIUM   → left border #F59E0B, bg rgba(245,158,11,0.07)
✦ icon:  severity color
type:    12px bold #D1D9E3
sev·phi: 11px #8892A0
desc:    11px #8892A0
```

### Agent Stream Lines

```
  >  tool_call     10px mono, color: #4A5668
     → result      11px, color: #8892A0, 4-space indent
                   new result lines: brief green flash rgba(34,197,94,0.15) → transparent 600ms

  ◎  phase_start   11px #4F7CFF  "◎ MALWARE phase starting"
  ✓  phase_done    11px #22C55E  "✓ STATIC phase passed (8m 14s)"
  ✕  error         11px #FF4444  "✕ IDA connection failed"
  ▌  cursor        blinking at end of last line, opacity animation 700ms
```

---

## 15. Interaction Patterns

**Empty states — all consistent:**
```
     [icon 24px, opacity 0.25]
     Title (14px, #D1D9E3)
     Body (12px, #8892A0)
     [CTA Button — only if there's an action]
```

**Loading skeleton:**
```
bg: rgba(255,255,255,0.05), animated shimmer left-to-right
height matches content (rows = 28px bars, cards = 80px)
```

**Hover states:**
- Cards: background lightens by one step + border brightens
- Nav items: bg rgba(255,255,255,0.04), label brightens
- Table rows: bg rgba(255,255,255,0.03)
- Buttons: 10% lighter bg, no other change

**Focus states:**
- Inputs: border-color rgba(79,124,255,0.45), box-shadow 0 0 0 2px rgba(79,124,255,0.15)
- Buttons: outline 2px #4F7CFF offset 2px

**Transitions:**
- All bg/color: 100ms ease
- Border: 150ms ease
- Height (accordion): 200ms ease
- Progress bars: 300ms ease

---

## 16. Screen Hierarchy (Nav → Page → Sections)

```
Targets
  ├── No target: BinaryPicker + CampaignBrowser
  └── Target loaded: ModeSelector + LaunchCouncil

Pipeline              ← primary view during council run
  ├── Phase list (always)
  ├── Active phase detail (when running)
  └── Consensus meter (always)

Swarm
  ├── Agent cards grid (2-col)
  └── Activity feed (chronological)

Evidence
  ├── Severity tab filter
  ├── Finding cards list (sorted by pheromone desc)
  └── Detail panel (right, 320px)

Blackboard
  └── Raw JSON viewer (for debugging)

Overview
  ├── Identity card
  ├── Hash card
  └── Sections table

Sections / Imports / Exports
  └── Data tables (when PE parser complete)

Reports
  └── AI-generated markdown report with export actions

MCP Hub
  ├── Connected server cards (2-col grid)
  └── How-to-use guide
```

---

## 17. Animation Specifications

**Running state dot pulse:**
```css
@keyframes vrax-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
.running-dot { animation: vrax-pulse 1.6s ease-in-out infinite; }
```

**Phase spinner (active phase icon):**
```css
@keyframes vrax-spin {
  to { transform: rotate(360deg); }
}
.phase-running { animation: vrax-spin 2s linear infinite; }
```

**Finding deposit flash:**
```css
@keyframes deposit-flash {
  0%   { background: rgba(79,124,255,0.18); }
  100% { background: rgba(79,124,255,0.07); }
}
.finding-deposit { animation: deposit-flash 600ms ease-out forwards; }
```

**Stream line appear:**
```css
@keyframes line-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.stream-line { animation: line-in 80ms ease-out; }
```

**Progress bar fill:**
```css
.progress-fill { transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1); }
```

---

## 18. Responsive Behavior (All within Electron window)

Minimum window width: **1280px**
- Below 1280: LeftNav collapses to icon-only (24px wide), labels hidden
- Optimal: 1440px+ — all panels comfortable
- Wide (1920px+): Workspace gets extra breathing room, evidence detail always visible

OperatorConsole: never collapses — always 320px, always visible  
LeftNav: never hidden — collapses to icons at minimum  
TopBar: target identity truncates with ellipsis at small widths

---

## 19. Penligent vs VRAX — Key Differences

| Penligent | VRAX |
|---|---|
| Web app, pentest focus | Electron desktop, RE focus |
| Network/exploit phases | Binary analysis phases (RECON/STATIC/DYNAMIC) |
| Attack-chain diagram | Pheromone-weighted blackboard grid |
| CVE knowledge base | PE parser + MCP tool results |
| One agent stream | Multiple parallel agent streams |
| Findings = vulnerabilities | Findings = binary artifacts (ANTI_DEBUG, PACKED_SECTION, C2_INDICATOR…) |
| Severity = CVSS | Severity = CRITICAL/HIGH/MED/LOW + pheromone score |
| Pipeline = sequential | Pipeline = sequential with HITL gate + re-run loops |
| Operator console = chat | Operator console = mission control (3 modes) |

VRAX takes Penligent's **war-room aesthetic** — dark, dense, real-time, severity-colored — and applies it to **reverse engineering**, with the blackboard/pheromone system replacing a CVE database.
