import argparse
import datetime as _dt
import hashlib
import json
import os
import sqlite3
from typing import Any, Dict


def _ensure_schema(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.executescript(
        """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_path TEXT NOT NULL,
            target_hash TEXT,
            UNIQUE(target_path, target_hash)
        );

        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            session_id TEXT,
            pipeline_mode TEXT,
            started_at TEXT,
            finished_at TEXT,
            report_path TEXT,
            verdict TEXT,
            FOREIGN KEY (target_id) REFERENCES targets(id)
        );

        CREATE TABLE IF NOT EXISTS verification_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            iteration INTEGER,
            verdict TEXT,
            mode TEXT,
            rip_expected TEXT,
            rip_actual TEXT,
            exception_code TEXT,
            notes TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        );

        CREATE TABLE IF NOT EXISTS crash_offsets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            name TEXT,
            value TEXT,
            bad_chars TEXT,
            padding_length INTEGER,
            notes TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        );

        CREATE TABLE IF NOT EXISTS patches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            address TEXT,
            before_bytes TEXT,
            after_bytes TEXT,
            description TEXT,
            FOREIGN KEY (run_id) REFERENCES runs(id)
        );
        """
    )
    conn.commit()


def _hash_target(path: str) -> str:
    if not path or not os.path.exists(path):
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_state(state_path: str) -> Dict[str, Any]:
    with open(state_path, "r", encoding="utf-8") as f:
        return json.load(f)


def record_run(state_path: str, db_path: str) -> None:
    state = _load_state(state_path)

    target_binary = state.get("target_binary", "")
    pipeline_mode = state.get("pipeline_mode", "")
    session_id = state.get("session_id", "")
    phases = state.get("phases", {})
    ver = phases.get("4_verification", {}) if isinstance(phases, dict) else {}
    report = phases.get("5_report", {}) if isinstance(phases, dict) else {}

    target_hash = _hash_target(target_binary)
    now = _dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    conn = sqlite3.connect(db_path)
    try:
        _ensure_schema(conn)
        cur = conn.cursor()

        # Upsert target row
        cur.execute(
            """
            INSERT OR IGNORE INTO targets (target_path, target_hash)
            VALUES (?, ?)
            """,
            (target_binary, target_hash),
        )
        cur.execute(
            """
            SELECT id FROM targets
            WHERE target_path = ? AND target_hash IS ?
            """,
            (target_binary, target_hash or None),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("Failed to resolve target row in council_history.db")
        target_id = row[0]

        # Insert run row
        cur.execute(
            """
            INSERT INTO runs (
                target_id, session_id, pipeline_mode,
                started_at, finished_at, report_path, verdict
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                target_id,
                session_id,
                pipeline_mode,
                now,
                now,
                report.get("report_path", ""),
                ver.get("verdict", ""),
            ),
        )
        run_id = cur.lastrowid

        # Verification stats (single snapshot per run for now)
        cur.execute(
            """
            INSERT INTO verification_stats (
                run_id, iteration, verdict, mode,
                rip_expected, rip_actual, exception_code, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                ver.get("iteration", 0),
                ver.get("verdict", ""),
                pipeline_mode,
                ver.get("rip_expected", ""),
                ver.get("rip_actual", ""),
                ver.get("exception_code", ""),
                ver.get("notes", ""),
            ),
        )

        # Crash offsets (crash pipeline only)
        if pipeline_mode == "crash" and isinstance(phases.get("2_vulnerability"), dict):
            vuln = phases["2_vulnerability"]
            offsets = vuln.get("offsets") or {}
            bad_chars = vuln.get("bad_chars") or []
            padding_length = vuln.get("padding_length", 0)
            for name, value in offsets.items():
                cur.execute(
                    """
                    INSERT INTO crash_offsets (
                        run_id, name, value, bad_chars, padding_length, notes
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        str(name),
                        str(value),
                        "".join(f"\\x{ord(c):02x}" if isinstance(c, str) else str(c) for c in bad_chars),
                        padding_length,
                        vuln.get("notes", ""),
                    ),
                )

        # Patch metadata (patch pipeline only)
        if pipeline_mode == "patch" and isinstance(phases.get("3_patcher"), dict):
            patch_phase = phases["3_patcher"]
            for entry in patch_phase.get("patches_applied", []):
                if not isinstance(entry, dict):
                    continue
                cur.execute(
                    """
                    INSERT INTO patches (
                        run_id, address, before_bytes, after_bytes, description
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        str(entry.get("address", "")),
                        str(entry.get("before", "")),
                        str(entry.get("after", "")),
                        entry.get("description", "") or patch_phase.get("notes", ""),
                    ),
                )

        conn.commit()
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update or query council_history.db from a council_state.json file."
    )
    parser.add_argument(
        "--state",
        required=True,
        help="Path to council_state.json for a completed run.",
    )
    parser.add_argument(
        "--db",
        default="council_history.db",
        help="Path to the SQLite history database (default: ./council_history.db).",
    )
    args = parser.parse_args()

    record_run(args.state, args.db)


if __name__ == "__main__":
    main()

