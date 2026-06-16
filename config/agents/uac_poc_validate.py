#!/usr/bin/env python3
"""Validate uac_poc_results.json — mandatory 3/3 elevation proof for bug bounty."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VALID_STATUS = {"VALIDATED", "PARTIAL", "FAILED", "NOT_TESTED", "THEORETICAL"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=".")
    args = parser.parse_args()
    workspace = Path(args.workspace).resolve()
    poc_path = workspace / "uac_poc_results.json"
    out_path = workspace / "poc_validation_report.json"

    errors: list[str] = []
    if not poc_path.is_file():
        errors.append("Missing uac_poc_results.json — @uac-poc-validator must run first")
        _write(out_path, "FAIL", errors, {})
        return 1

    data = json.loads(poc_path.read_text(encoding="utf-8"))
    results = data.get("results") or []
    if not results:
        errors.append("results[] is empty — no techniques tested")

    validated = 0
    for i, row in enumerate(results):
        tid = row.get("technique_id", f"index_{i}")
        status = row.get("status", "")
        if status not in VALID_STATUS:
            errors.append(f"{tid}: invalid status {status!r}")
            continue
        if status == "VALIDATED":
            runs = row.get("runs") or []
            if len(runs) < 3:
                errors.append(f"{tid}: VALIDATED requires >=3 runs, got {len(runs)}")
            passed = sum(1 for r in runs if r.get("pass") is True)
            if passed < 3:
                errors.append(f"{tid}: VALIDATED requires 3/3 pass, got {passed}/3")
            for j, run in enumerate(runs[:3]):
                ev = run.get("evidence_file", "")
                if not ev:
                    errors.append(f"{tid} run{j+1}: missing evidence_file")
                elif not (workspace / ev).is_file() and not Path(ev).is_file():
                    errors.append(f"{tid} run{j+1}: evidence file not found: {ev}")
                if run.get("after_il", "").lower() not in ("high", "high mandatory level", "s-1-16-12288"):
                    errors.append(f"{tid} run{j+1}: after_il must prove High integrity")
            if not str(row.get("impact_summary", "")).strip():
                errors.append(f"{tid}: VALIDATED requires impact_summary")
            if not str(row.get("ida_correlation", "")).strip():
                errors.append(f"{tid}: VALIDATED requires ida_correlation")
            if not errors:
                validated += 1

    summary = data.get("summary") or {}
    if validated == 0 and not errors:
        errors.append("No VALIDATED techniques — nothing bounty-ready")

    verdict = "PASS" if not errors and validated > 0 else "FAIL"
    _write(out_path, verdict, errors, {"validated_count": validated, "total": len(results)})
    print(f"POC VALIDATION {verdict} — validated={validated}/{len(results)}")
    for e in errors:
        print(f"  - {e}")
    return 0 if verdict == "PASS" else 1


def _write(path: Path, verdict: str, errors: list[str], extra: dict) -> None:
    path.write_text(
        json.dumps(
            {
                "verdict": verdict,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "errors": errors,
                **extra,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.exit(main())
