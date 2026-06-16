# Council Playbook — Shared Methodology Reference

All council agents MUST read this file to understand the standard tools, evidence requirements, and compilation standards.

## IDA Pro MCP Commands Reference

| Command | When to Use |
|---|---|
| `lookup_funcs()` | Find routines by name or address |
| `list_funcs()` | List all functions in the binary |
| `search_structs()`, `read_struct()`, `infer_types()` | Evaluate memory layouts and state objects |
| `find_bytes()` | Locate magic bytes, crypto constants, API strings |
| `find_regex()` | Pattern-based search for obfuscated strings |
| `get_bytes()` | Raw memory inspection of data segments |
| `basic_blocks()`, `callees()`, `callgraph()` | Complete execution flow tracing |
| `patch_asm()` | Byte-level profiling simulation |
| `set_comments()`, `rename()` | Document findings in the IDB |
| `int_convert()` | Number base conversions |

## PE Header Analysis Checklist

- `IMAGE_DLLCHARACTERISTICS_DYNAMIC_BASE` → ASLR enabled?
- `IMAGE_DLLCHARACTERISTICS_NX_COMPAT` → DEP enabled?
- `IMAGE_DLLCHARACTERISTICS_GUARD_CF` → CFG enabled?
- Xref `__security_cookie` → Stack cookies present?
- Check for `IsDebuggerPresent`, `NtQueryInformationProcess` → Anti-debug?

## MSYS64 Compilation Standard

All C executables MUST compile via `C:\msys64` using the MinGW-w64 toolchain:

```bash
# Standard compilation
gcc harness.c -o harness.exe

# With Windows API support
gcc harness.c -o harness.exe -lkernel32 -luser32 -lpsapi

# GUI patcher with resources (icon embedding)
windres patcher.rc -o patcher_res.o
gcc patcher.c patcher_res.o -o patcher.exe -mwindows -lcomctl32 -lgdi32

# Keygen
gcc keygen.c -o keygen.exe -mwindows -lgdi32

# Debug build
gcc -g -O0 harness.c -o harness_debug.exe
```

## POC Validation Standards (ZERO-DAY Pipeline)

### MANDATORY 100% Proof Requirement

Every vulnerability claim in the ZERO-DAY pipeline MUST have a validated proof-of-concept (POC). **NO EXCEPTIONS. NO THEORETICAL VULNERABILITIES.**

### POC Validation is NOT Optional
- ❌ You cannot report a vulnerability without a working POC
- ❌ You cannot proceed to Phase 3 (exploit development) without validated POCs
- ✅ Every vulnerability MUST be proven real through testing

### Strict Validation Criteria (ALL Required)

**1. Reproducibility (MUST PASS)**
- Minimum 3 successful test runs
- Success rate: 3/3 (100%)
- No partial validations allowed

**2. Observability (MUST DEMONSTRATE)**
- Target binary shows measurable behavior change
- Evidence: crash logs, register dumps, memory corruption
- Must be observable and recordable

**3. Control Proof (MUST SHOW)**
- Demonstrate influence over execution flow OR data corruption
- Cannot be speculation or "might work"
- Must be provable through testing

**4. Documentation (MUST INCLUDE)**
- Complete test execution logs with timestamps
- Before/after behavior comparison
- Crash dumps or memory state evidence
- Step-by-step trigger mechanism explanation

### POC Status Values

| Status | Definition | Can Proceed? |
|--------|-----------|--------------|
| **VALIDATED** | 3/3 successful runs, full evidence | ✅ YES |
| **PARTIAL** | 1-2/3 runs successful | ❌ NO |
| **FAILED** | 0/3 runs successful | ❌ NO |
| **THEORETICAL** | No working POC | ❌ NO |

### Gate Decision Rules

**Before Phase 3 (Exploit Development)**:
1. Read `phases.2.6_poc_validation.poc_summary`
2. Check `ready_for_exploit` — MUST be `true`
3. Check `poc_successful` count — MUST be > 0
4. Verify each vulnerability status is "VALIDATED"

**GATE OUTCOMES**:
- ✅ **ALL VALIDATED**: Proceed to Phase 3 with validated vulnerabilities only
- ❌ **ANY FAILED**: Mark as "THEORETICAL ONLY", exclude from Phase 3
- ❌ **NONE VALIDATED**: Skip to Phase 5, report "No proven vulnerabilities"

### NO BYPASS POLICY

- You CANNOT skip POC validation
- You CANNOT proceed with unvalidated vulnerabilities
- You CANNOT report theoretical findings as real
- **Every claim must be proven with 100% certainty**

---

## Evidence Standards

Every finding MUST include:
1. **Exact hex addresses** for all identified points
2. **Before/after byte comparisons** in hex
3. **Disassembly snippets** showing the relevant code
4. **Functional impact** description of each finding

### DO NOT write:
> "This could cause overflow."

### DO write:
> "At `0x4012A3`, a 32-bit add instruction (`add eax, ecx`) performs size addition. The result is stored in `eax` and passed directly to `malloc`. No carry or overflow flag check follows before allocation."

## State File Protocol

All agents MUST follow this protocol for `council_state.json`:

1. **On entry**: Read the state file from the workspace directory
2. **During work**: Update your phase's status to `"in_progress"`
3. **On completion**: Write your results to the appropriate phase fields and set status to `"done"`
4. **On failure**: Set status to `"failed"` and write the failure reason to `notes`

## Visual Demo Requirement

Any executable that interacts with the target binary MUST:
- Use `CreateProcessA` or equivalent to spawn the REAL target as a VISIBLE window
- The user must be able to see the application on screen
- No headless execution, no fake UI windows, no child stubs
- Embed JSON telemetry export in crash harnesses

## Debugger Attachment Rules

- **NEVER** run `cdb` without parameters (defaults to kernel debug via COM1)
- **ALWAYS** use `-p <PID>` or `-pn <ProcessName.exe>` for user-mode debugging
- Prefer `gflags.exe /p /enable <target>` for heap pageheap instrumentation
- Use `AppVerifier` with Basics and Heaps checks for additional coverage

## Behavioral Tracing (Native CLI)

- **NEVER** use GUI tools like ProcMon. The environment is strictly CLI.
- Use **Windows Performance Recorder (`wpr.exe`)** for native behavioral tracing.
  - Record File/Registry I/O: `wpr.exe -start FileIO -start Registry -filemode`
  - Stop and save: `wpr.exe -stop OutTrace.etl`
- Use **`wpaexporter.exe`** to dump the `.etl` trace to CSV for text-based parsing without GUI.

---

## Patching Methodology (Patch Pipeline Only)

### Common Patch Byte Patterns

| Purpose | Original | Patched | Notes |
|---|---|---|---|
| Force unconditional jump | `74 xx` (JE) | `EB xx` (JMP) | Skip license check |
| Force unconditional jump | `75 xx` (JNE) | `EB xx` (JMP) | Skip validation |
| NOP out a call | `E8 xx xx xx xx` (CALL) | `90 90 90 90 90` (NOP×5) | Disable phone-home |
| Force return true | `xor eax, eax` (31 C0) | `mov al, 1` (B0 01) + `90` | Force validation pass |
| Force return true | `mov al, 0` (B0 00) | `mov al, 1` (B0 01) | Force flag set |
| Skip integrity check | `call CheckIntegrity` | `NOP×5` | Must do BEFORE other patches |

### License Algorithm Reversing Checklist

1. Find the validation function entry (xref from "invalid serial" string)
2. Trace input: where is the user-entered serial read? (`GetDlgItemTextA`, `GetWindowTextA`)
3. Trace transform: what operations are applied? (XOR, rotate, add, modular arithmetic)
4. Trace compare: what is the expected result compared against? (hardcoded, HWID-derived, registry-stored)
5. Reverse the transform to build the keygen

### Self-Integrity Check Disabling Strategy

**Order matters!** Always disable integrity checks FIRST:
1. Identify all integrity check routines (CRC32, MD5, SHA on `.text` section)
2. NOP out the integrity check calls
3. THEN apply feature-unlock patches
4. If integrity check reads the file at runtime, patch the comparison (`jnz` → `jmp`)

### GUI Patcher Template

Standard patcher window specs:
- Window class: `"SnifferPatcher"`
- Size: 320×200, centered (`CW_USEDEFAULT` or calculated from `GetSystemMetrics`)
- Font: MS Shell Dlg, 9pt
- Buttons: "Patch" (ID 101), "Restore" (ID 102)
- Static text: Status area (ID 201)
- Branding: "Developed By: Sniffer" label
- Icon: Extract from target app directory, embed via `.rc` resource file
