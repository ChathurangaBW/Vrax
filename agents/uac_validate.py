#!/usr/bin/env python3
"""
Validate UAC bypass discovery deliverables (VRAX @uac-bypass-discovery).
Exit 0 = PASS, 1 = FAIL. No garbage reports.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

TAXONOMY_PATH = Path(__file__).with_name("uac_coverage_taxonomy.json")
REQUIRED_UACME_MIN = 40
REQUIRED_SURFACES: list[str] = []
NON_UACME_MIN = 5

REQUIRED_ROW_FIELDS = {
    "id",
    "name",
    "attack_surface",
    "verification_level",
    "status",
    "evidence_sources",
    "uacme_id",
    "works_from",
    "fixed_in",
    "ida_analysis_notes",
    "detection_summary",
    "mitigation_summary",
}

VERIFIED_LEVELS = {
    "HYPOTHESIS",
    "THEORETICAL",
    "VERIFIED_ACTIVE",
    "VERIFIED_PATCHED",
    "VERIFIED_REMOVED",
    "UNVERIFIED",
    "BOUNTY_VALIDATED",
}

BOUNTY_LEVELS = {"BOUNTY_VALIDATED"}


def load_taxonomy() -> dict:
    data = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    global REQUIRED_SURFACES, NON_UACME_MIN
    REQUIRED_SURFACES = list(data["attack_surfaces"])
    NON_UACME_MIN = int(data.get("non_uacme_minimum", 5))
    return data


def fail(errors: list[str]) -> int:
    report = {
        "verdict": "FAIL",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "errors": errors,
        "gates": {
            "schema": False,
            "completeness": False,
            "evidence": False,
            "tooling": False,
        },
    }
    out = Path(args.workspace) / "validation_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("VALIDATION FAIL")
    for e in errors:
        print(f"  - {e}")
    print(f"Wrote {out}")
    return 1


def pass_report(
    workspace: Path,
    uacme_count: int,
    surface_counts: dict[str, int],
    non_uacme_count: int,
) -> int:
    report = {
        "verdict": "PASS",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uacme_count": uacme_count,
        "taxonomy_coverage": surface_counts,
        "non_uacme_count": non_uacme_count,
        "gates": {
            "schema": True,
            "completeness": True,
            "evidence": True,
            "tooling": True,
        },
    }
    out = workspace / "validation_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("VALIDATION PASS")
    print(f"  UACME rows: {uacme_count}")
    print(f"  Non-UACME: {non_uacme_count}")
    print(f"  Surfaces covered: {len(surface_counts)}/{len(REQUIRED_SURFACES)}")
    print(f"Wrote {out}")
    return 0


def validate_master(path: Path) -> tuple[dict | None, list[str]]:
    errors: list[str] = []
    if not path.is_file():
        return None, [f"Missing {path.name}"]

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return None, [f"Invalid JSON: {e}"]

    for key in ("schema_version", "generated_at", "uacme_methods", "non_uacme_primitives"):
        if key not in data:
            errors.append(f"Missing top-level key: {key}")

    if errors:
        return data, errors

    uacme = data.get("uacme_methods") or []
    non_uacme = data.get("non_uacme_primitives") or []

    if len(uacme) < REQUIRED_UACME_MIN:
        errors.append(f"uacme_methods: need >={REQUIRED_UACME_MIN}, got {len(uacme)}")

    uacme_ids = set()
    for i, row in enumerate(uacme):
        missing = REQUIRED_ROW_FIELDS - set(row.keys())
        if missing:
            errors.append(f"uacme_methods[{i}]: missing fields {sorted(missing)}")
            continue
        if row["verification_level"] not in VERIFIED_LEVELS:
            errors.append(f"uacme_methods[{i}]: bad verification_level")
        if row["verification_level"].startswith("VERIFIED_") and not row.get("evidence_sources"):
            errors.append(f"uacme_methods[{i}]: VERIFIED_* requires evidence_sources")
        uid = row.get("uacme_id")
        if uid is not None:
            try:
                n = int(uid)
                if n < 43 or n > 82:
                    errors.append(f"uacme_methods[{i}]: uacme_id {n} outside active range 43-82")
                if n in uacme_ids:
                    errors.append(f"Duplicate uacme_id {n}")
                uacme_ids.add(n)
            except (TypeError, ValueError):
                errors.append(f"uacme_methods[{i}]: invalid uacme_id")
        if row.get("host_binary") and not str(row.get("ida_analysis_notes", "")).strip():
            errors.append(f"uacme_methods[{i}]: host_binary set but ida_analysis_notes empty")

    if len(non_uacme) < NON_UACME_MIN:
        errors.append(f"non_uacme_primitives: need >={NON_UACME_MIN}, got {len(non_uacme)}")

    surface_counts: dict[str, int] = {s: 0 for s in REQUIRED_SURFACES}
    for row in uacme:
        s = row.get("attack_surface", "")
        if s in surface_counts:
            surface_counts[s] += 1
    for row in non_uacme:
        s = row.get("attack_surface", "")
        if s in surface_counts:
            surface_counts[s] += 1

    for s in REQUIRED_SURFACES:
        if surface_counts[s] < 1:
            errors.append(f"attack_surface '{s}' has zero techniques")

    missing_ids = set(range(43, 83)) - uacme_ids
    if missing_ids:
        errors.append(
            f"Missing UACME IDs ({len(missing_ids)}): {sorted(missing_ids)[:15]}..."
        )

    return data, errors, surface_counts, len(non_uacme), len(uacme)


def check_bounty_rows(workspace: Path, data: dict, errors: list[str]) -> None:
    poc_path = workspace / "uac_poc_results.json"
    poc_data = None
    if poc_path.is_file():
        poc_data = json.loads(poc_path.read_text(encoding="utf-8"))
    validated_ids = set()
    if poc_data:
        for r in poc_data.get("results") or []:
            if r.get("status") == "VALIDATED":
                validated_ids.add(r.get("technique_id"))

    for section in ("uacme_methods", "non_uacme_primitives"):
        for i, row in enumerate(data.get(section) or []):
            if row.get("verification_level") not in BOUNTY_LEVELS:
                continue
            tid = row.get("id") or row.get("technique_id")
            if tid not in validated_ids:
                errors.append(
                    f"{section}[{i}]: BOUNTY_VALIDATED requires matching VALIDATED in uac_poc_results.json ({tid})"
                )
            if row.get("poc_status") != "PASS_3_3":
                errors.append(f"{section}[{i}]: BOUNTY_VALIDATED requires poc_status PASS_3_3")


def main() -> int:
    global args
    import subprocess

    parser = argparse.ArgumentParser(description="Validate UAC bypass discovery output")
    parser.add_argument("--workspace", default=".", help="Workspace directory")
    parser.add_argument(
        "--mode",
        choices=("catalog", "bounty", "both"),
        default="bounty",
        help="catalog=UACME table schema; bounty=PoC proof required; both=both",
    )
    args = parser.parse_args()
    load_taxonomy()
    workspace = Path(args.workspace).resolve()
    master_path = workspace / "uac_master_list.json"
    errors: list[str] = []
    uacme_count = 0
    non_uacme_count = 0
    surface_counts: dict[str, int] = {}

    if args.mode in ("catalog", "both"):
        if not master_path.is_file():
            errors.append("Missing uac_master_list.json (catalog mode)")
        else:
            result = validate_master(master_path)
            if len(result) == 2:
                return fail(result[1])
            data, cat_errors, surface_counts, non_uacme_count, uacme_count = result
            errors.extend(cat_errors)
            if args.mode in ("bounty", "both"):
                check_bounty_rows(workspace, data, errors)

    if args.mode in ("bounty", "both"):
        poc_script = Path(__file__).with_name("uac_poc_validate.py")
        r = subprocess.run(
            [sys.executable, str(poc_script), "--workspace", str(workspace)],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            msg = (r.stdout or "") + (r.stderr or "")
            errors.append(f"uac_poc_validate.py failed: {msg.strip() or 'exit ' + str(r.returncode)}")

    if errors:
        return fail(errors)

    if master_path.is_file():
        return pass_report(workspace, uacme_count, surface_counts, non_uacme_count)

    # bounty-only pass with poc results but no master list yet
    (workspace / "validation_report.json").write_text(
        json.dumps(
            {
                "verdict": "PASS",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "mode": args.mode,
                "note": "poc_validation only",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("VALIDATION PASS (poc-only)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
