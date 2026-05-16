#!/usr/bin/env python3
"""
Step 2-24A backup key/save recovery guarded script.

This script intentionally does NOT modify js/main.js yet.
It first verifies that Step 2-23 save stability phase1 has been applied.
If Step 2-23 is missing, it fails before writing any file.

Actual backup/recovery patching is reserved for Step 2-24B.
"""
from pathlib import Path
import re
import sys

MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-24a-backup-recovery-script-plan.md")

REQUIRED_STEP_2_23_MARKERS = {
    "function save(force=false)": "function save(force=false)",
    "save_false_returns_true": "if(!force){ _saveDirty = true; return true; }",
    "save_failure_console_error": "console.error(\"[save] failed\", e);",
    "function bindSaveLifecycleEvents()": "function bindSaveLifecycleEvents()",
    "pagehide_save_hook": "window.addEventListener(\"pagehide\"",
    "visibilitychange_save_hook": "document.addEventListener(\"visibilitychange\"",
    "beforeunload_save_hook": "window.addEventListener(\"beforeunload\"",
    "force_save_result_branch": "const ok = save(true);",
}


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def count_actual_safe_click(js: str) -> int:
    return sum(
        1
        for line in js.splitlines()
        if "safeClick(" in line and not line.strip().startswith("function safeClick")
    )


def count_direct_onclick(js: str) -> int:
    return len(re.findall(r"\.onclick\s*=", js))


def preflight_step_2_23(js: str) -> dict:
    counts = {name: js.count(marker) for name, marker in REQUIRED_STEP_2_23_MARKERS.items()}
    counts["direct_onclick"] = count_direct_onclick(js)
    counts["function_safeClick"] = js.count("function safeClick")
    counts["safeClick_actual"] = count_actual_safe_click(js)
    return counts


def verify_preflight(counts: dict) -> None:
    expected_one = [
        "function save(force=false)",
        "save_false_returns_true",
        "save_failure_console_error",
        "function bindSaveLifecycleEvents()",
        "pagehide_save_hook",
        "visibilitychange_save_hook",
        "beforeunload_save_hook",
        "force_save_result_branch",
    ]
    missing = [name for name in expected_one if counts.get(name) != 1]
    if missing:
        fail(
            "Step 2-23 preflight failed; backup/recovery patch is blocked. "
            f"Invalid marker counts: {', '.join(f'{m}={counts.get(m)}' for m in missing)}"
        )
    if counts["direct_onclick"] != 0:
        fail(f"Step 2 event refactor invariant failed: .onclick assignments={counts['direct_onclick']}")
    if counts["function_safeClick"] != 0:
        fail(f"Step 2 event refactor invariant failed: function safeClick={counts['function_safeClick']}")
    if counts["safeClick_actual"] != 0:
        fail(f"Step 2 event refactor invariant failed: safeClick calls={counts['safeClick_actual']}")


def main() -> None:
    if not MAIN.exists():
        fail("js/main.js not found")

    original = MAIN.read_text(encoding="utf-8")
    counts = preflight_step_2_23(original)

    # This intentionally exits before any write if Step 2-23 is incomplete.
    verify_preflight(counts)

    # Step 2-24B will implement the actual patch. Step 2-24A only prepares the guard.
    print("[OK] Step 2-23 preflight passed")
    print("[BLOCKED] Step 2-24 backup/recovery patch is intentionally not applied in Step 2-24A")
    print("[NEXT] Implement actual backup/recovery patch in Step 2-24B")


if __name__ == "__main__":
    main()
