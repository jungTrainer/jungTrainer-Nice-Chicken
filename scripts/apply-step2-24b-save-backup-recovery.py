#!/usr/bin/env python3
"""
Step 2-24B backup key/save recovery patch script.

This script is designed to run only AFTER Step 2-23 save stability phase1.
It refuses to modify js/main.js unless Step 2-23 markers are present.

Target changes after preflight:
1. Add SAVE_BACKUP_KEY near SAVE_KEY.
2. Update save(true) to preserve previous primary save into backup before writing primary.
3. Add readSavePayload() helper for primary/backup JSON parsing.
4. Update load() to restore from backup when primary is missing/corrupted.
5. Generate docs/2026-05-15-step2-24b-save-backup-recovery.md.
"""
from pathlib import Path
import re
import subprocess
import sys

MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-24b-save-backup-recovery.md")

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

SAVE_KEY_LINE = 'const SAVE_KEY = "niceChicken_idleServe_vFinal";'
SAVE_BACKUP_LINE = 'const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";'

OLD_SAVE_CORE = '''  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    return true;
  }catch(e){
    console.error("[save] failed", e);
    return false;
  }'''

NEW_SAVE_CORE = '''  try{
    const prevSave = localStorage.getItem(SAVE_KEY);
    if(prevSave){
      try{
        localStorage.setItem(SAVE_BACKUP_KEY, prevSave);
      }catch(backupError){
        console.warn("[save] backup failed", backupError);
      }
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    return true;
  }catch(e){
    console.error("[save] failed", e);
    return false;
  }'''

READ_HELPER = '''
function readSavePayload(){
  const primaryRaw = localStorage.getItem(SAVE_KEY);
  const backupRaw = localStorage.getItem(SAVE_BACKUP_KEY);

  if(primaryRaw){
    try{
      return { data: JSON.parse(primaryRaw), source: "primary" };
    }catch(e){
      console.error("[load] primary save corrupted", e);
    }
  }

  if(backupRaw){
    try{
      console.warn("[load] restored from backup save");
      return { data: JSON.parse(backupRaw), source: "backup" };
    }catch(e){
      console.error("[load] backup save corrupted", e);
    }
  }

  return null;
}
'''

LOAD_START_RE = re.compile(r'''function\s+load\s*\(\s*\)\s*\{\s*\n\s*try\s*\{\s*\n\s*const\s+raw\s*=\s*localStorage\.getItem\(SAVE_KEY\);\s*\n\s*if\s*\(\s*raw\s*\)\s*\{\s*\n\s*const\s+saved\s*=\s*JSON\.parse\(raw\);''', re.M)

NEW_LOAD_START = '''function load(){
  try{
    const payload = readSavePayload();
    if(payload && payload.data){
      const saved = payload.data;'''


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


def count_inline_onclick(index_text: str, js: str) -> int:
    return len(re.findall(r"\sonclick\s*=", index_text + "\n" + js, flags=re.I))


def preflight_step_2_23(js: str) -> dict:
    counts = {name: js.count(marker) for name, marker in REQUIRED_STEP_2_23_MARKERS.items()}
    counts["direct_onclick"] = count_direct_onclick(js)
    counts["function_safeClick"] = js.count("function safeClick")
    counts["safeClick_actual"] = count_actual_safe_click(js)
    return counts


def verify_preflight(counts: dict) -> None:
    expected_one = list(REQUIRED_STEP_2_23_MARKERS.keys())
    missing = [name for name in expected_one if counts.get(name) != 1]
    if missing:
        fail(
            "Step 2-23 preflight failed; Step 2-24B patch is blocked. "
            f"Invalid marker counts: {', '.join(f'{m}={counts.get(m)}' for m in missing)}"
        )
    if counts["direct_onclick"] != 0:
        fail(f"Step 2 event refactor invariant failed: .onclick assignments={counts['direct_onclick']}")
    if counts["function_safeClick"] != 0:
        fail(f"Step 2 event refactor invariant failed: function safeClick={counts['function_safeClick']}")
    if counts["safeClick_actual"] != 0:
        fail(f"Step 2 event refactor invariant failed: safeClick calls={counts['safeClick_actual']}")


def verify_after(js: str) -> None:
    expected = {
        "SAVE_BACKUP_KEY": js.count(SAVE_BACKUP_LINE),
        "backup setItem": js.count("localStorage.setItem(SAVE_BACKUP_KEY, prevSave);"),
        "backup warning": js.count('console.warn("[save] backup failed", backupError);'),
        "readSavePayload": js.count("function readSavePayload()"),
        "primary corrupted log": js.count('console.error("[load] primary save corrupted", e);'),
        "backup restore warning": js.count('console.warn("[load] restored from backup save");'),
        "backup corrupted log": js.count('console.error("[load] backup save corrupted", e);'),
        "payload load": js.count("const payload = readSavePayload();"),
    }
    bad = {k: v for k, v in expected.items() if v != 1}
    if bad:
        fail(f"Step 2-24B verification failed: {bad}")

    # Step 2-23 invariants must remain.
    verify_preflight(preflight_step_2_23(js))


def write_report() -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-24B 저장 백업/복구 적용 보고\n\n"
        "작성일: 2026-05-15\n\n"
        "## 변경 내용\n\n"
        "- `SAVE_BACKUP_KEY = SAVE_KEY + \"_backup\"`를 추가했다.\n"
        "- `save(true)`에서 기존 primary 저장본을 backup key에 먼저 보존하도록 했다.\n"
        "- backup 저장 실패 시 `console.warn(\"[save] backup failed\", backupError)`를 남기도록 했다.\n"
        "- `readSavePayload()`를 추가해 primary/backup 저장 데이터를 순차적으로 읽도록 했다.\n"
        "- primary JSON parse 실패 시 backup parse를 시도하도록 했다.\n"
        "- backup 복구 성공 시 `console.warn(\"[load] restored from backup save\")`를 남기도록 했다.\n"
        "- primary/backup 모두 실패하면 기존 default flow가 유지된다.\n\n"
        "## 유지한 내용\n\n"
        "- 기존 `SAVE_KEY` 유지\n"
        "- 기존 `defaultState()` / `sanitizeState()` 흐름 유지\n"
        "- export/import UI는 아직 추가하지 않음\n"
        "- cloud save는 추가하지 않음\n"
        "- index.html은 수정하지 않음\n\n"
        "## 검증 기준\n\n"
        "- `SAVE_BACKUP_KEY` 1개\n"
        "- backup 저장 흐름 1개\n"
        "- `readSavePayload()` 1개\n"
        "- primary corrupted log 1개\n"
        "- backup restore warning 1개\n"
        "- backup corrupted log 1개\n"
        "- Step 2-23 저장 안정화 marker 유지\n"
        "- `.onclick =` 0개 유지\n"
        "- `function safeClick` 0개 유지\n"
        "- `node --check js/main.js` 통과\n\n"
        "## 남은 리스크\n\n"
        "- 브라우저 실제 복구 테스트가 필요하다.\n"
        "- localStorage quota 초과 시 backup 저장 실패가 발생할 수 있다.\n"
        "- export/import 수동 백업 기능은 아직 없다.\n",
        encoding="utf-8",
    )


def main() -> None:
    if not MAIN.exists():
        fail("js/main.js not found")

    index_path = Path("index.html")
    index_text = index_path.read_text(encoding="utf-8") if index_path.exists() else ""
    js = MAIN.read_text(encoding="utf-8")

    verify_preflight(preflight_step_2_23(js))

    if js.count(SAVE_BACKUP_LINE) > 0:
        fail("SAVE_BACKUP_KEY already exists; refusing to reapply")
    if js.count("function readSavePayload()") > 0:
        fail("readSavePayload already exists; refusing to reapply")
    if js.count(SAVE_KEY_LINE) != 1:
        fail(f"expected SAVE_KEY line exactly 1, found {js.count(SAVE_KEY_LINE)}")
    if js.count(OLD_SAVE_CORE) != 1:
        fail(f"expected Step 2-23 save core exactly 1, found {js.count(OLD_SAVE_CORE)}")

    load_matches = list(LOAD_START_RE.finditer(js))
    if len(load_matches) != 1:
        fail(f"expected old load start exactly 1, found {len(load_matches)}")

    patched = js.replace(SAVE_KEY_LINE, SAVE_KEY_LINE + "\n" + SAVE_BACKUP_LINE, 1)
    patched = patched.replace(OLD_SAVE_CORE, NEW_SAVE_CORE, 1)
    patched = patched.replace("function load(){", READ_HELPER + "\nfunction load(){", 1)
    patched = LOAD_START_RE.sub(NEW_LOAD_START, patched, count=1)

    if count_inline_onclick(index_text, patched) != 0:
        fail("inline onclick must remain 0")

    verify_after(patched)

    MAIN.write_text(patched, encoding="utf-8")
    subprocess.run(["node", "--check", str(MAIN)], check=True)
    write_report()
    print("[OK] Step 2-24B backup/recovery patch applied")


if __name__ == "__main__":
    main()
