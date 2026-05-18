#!/usr/bin/env python3
"""
Step 3-4: Split static config/data declarations into js/core/config.js.

Classic script mode is preserved. No ES module import/export is introduced.
Storage-related keys/functions are intentionally excluded.
"""
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
MAIN = Path("js/main.js")
CONFIG_FILE = Path("js/core/config.js")
REPORT = Path("docs/2026-05-15-step3-4-config-split.md")

UTILS_SCRIPT = '<script src="./js/core/utils.js"></script>'
AUDIO_SCRIPT = '<script src="./js/core/audio.js"></script>'
CONFIG_SCRIPT = '<script src="./js/core/config.js"></script>'
MAIN_SCRIPT = '<script src="./js/main.js"></script>'

TARGETS = [
    "CONFIG",
    "REGIONS",
    "REGION_MAP",
    "MENUS",
    "MENU_MAP",
    "CUSTOMER_EMOJIS",
    "STAFF_POOL",
    "UPGRADES",
    "RESEARCH",
    "DECOS",
    "SIGN_STAGES_MAX",
    "SIGN_IMAGE_CANDIDATES",
    "SIGN_IMAGES",
]

# Move this with CONFIG so CONFIG.levelUpTotalSales/maxLevel is initialized before main.js uses defaultState().
ENSURE_LEVEL_MARKER = "(function ensureLevelTable(){"


def fail(msg):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def decl_count(text, name):
    return len(re.findall(rf"\b(?:const|let|var)\s+{re.escape(name)}\b", text))


def func_decl_count(text, name):
    return len(re.findall(rf"\bfunction\s+{re.escape(name)}\s*\(", text))


def find_decl_block(js, name):
    m = re.search(rf"\b(?:const|let|var)\s+{re.escape(name)}\b", js)
    if not m:
        return None
    start = m.start()
    i = m.end()
    depth_curly = 0
    depth_square = 0
    depth_paren = 0
    in_str = None
    esc = False
    in_line_comment = False
    in_block_comment = False
    while i < len(js):
        ch = js[i]
        nxt = js[i+1] if i + 1 < len(js) else ""
        if in_line_comment:
            if ch == "\n": in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_str:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == in_str: in_str = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue
        if ch in ('"', "'", "`"):
            in_str = ch
            i += 1
            continue
        if ch == "{": depth_curly += 1
        elif ch == "}": depth_curly -= 1
        elif ch == "[": depth_square += 1
        elif ch == "]": depth_square -= 1
        elif ch == "(": depth_paren += 1
        elif ch == ")": depth_paren -= 1
        elif ch == ";" and depth_curly == 0 and depth_square == 0 and depth_paren == 0:
            end = i + 1
            if end < len(js) and js[end] == "\n": end += 1
            return start, end, js[start:end].rstrip() + "\n"
        i += 1
    fail(f"declaration block not closed for {name}")


def find_iife_block(js, marker):
    start = js.find(marker)
    if start < 0:
        return None
    # Include leading comments if immediately above marker? Keep simple and move only IIFE.
    semi = js.find("})();", start)
    if semi < 0:
        fail("ensureLevelTable IIFE end not found")
    end = semi + len("})();")
    if end < len(js) and js[end] == "\n": end += 1
    return start, end, js[start:end].rstrip() + "\n"


def remove_blocks(js, blocks):
    out = js
    for start, end, _text in sorted(blocks, key=lambda x: x[0], reverse=True):
        out = out[:start] + out[end:]
    return out


def ensure_script_order(index):
    for script in [UTILS_SCRIPT, AUDIO_SCRIPT, MAIN_SCRIPT]:
        if index.count(script) != 1:
            fail(f"expected script tag exactly 1: {script}, found {index.count(script)}")
    if index.count(CONFIG_SCRIPT) > 1:
        fail(f"config script tag appears too many times: {index.count(CONFIG_SCRIPT)}")
    if CONFIG_SCRIPT not in index:
        index = index.replace(MAIN_SCRIPT, CONFIG_SCRIPT + "\n" + MAIN_SCRIPT, 1)
    if not (index.find(UTILS_SCRIPT) < index.find(AUDIO_SCRIPT) < index.find(CONFIG_SCRIPT) < index.find(MAIN_SCRIPT)):
        fail("script order must be utils.js -> audio.js -> config.js -> main.js")
    return index


def actual_safe_click_count(js):
    return sum(1 for line in js.splitlines() if "safeClick(" in line and not line.strip().startswith("function safeClick"))


def verify_event_invariants(index, js):
    inline = len(re.findall(r"\sonclick\s*=", index + "\n" + js, flags=re.I))
    direct = len(re.findall(r"\.onclick\s*=", js))
    safe_fn = func_decl_count(js, "safeClick")
    safe_calls = actual_safe_click_count(js)
    if inline != 0: fail(f"inline onclick must remain 0, found {inline}")
    if direct != 0: fail(f".onclick assignments must remain 0, found {direct}")
    if safe_fn != 0: fail(f"function safeClick must remain 0, found {safe_fn}")
    if safe_calls != 0: fail(f"safeClick actual calls must remain 0, found {safe_calls}")


def verify_storage_untouched(js):
    required = [
        'const SAVE_KEY = "niceChicken_idleServe_vFinal";',
        'const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";',
        'function save(force=false)',
        'function load()',
        'function saveGame()',
        'function readSavePayload()',
        'function exportSaveData()',
        'function importSaveData(raw)',
        'function ensureSaveTransferUI()',
        'let _saveDirty = false;',
        'let _lastSaveWriteAt = 0;',
    ]
    bad = {m: js.count(m) for m in required if js.count(m) != 1}
    if bad:
        fail(f"storage marker invalid after patch: {bad}")


def main():
    if not MAIN.exists() or not INDEX.exists():
        fail("required files missing")
    if CONFIG_FILE.exists():
        fail("js/core/config.js already exists; refusing to reapply")

    js = MAIN.read_text(encoding="utf-8")
    index = INDEX.read_text(encoding="utf-8")

    verify_event_invariants(index, js)
    verify_storage_untouched(js)

    blocks = []
    moved = []
    missing = []
    for name in TARGETS:
        block = find_decl_block(js, name)
        if block:
            blocks.append(block)
            moved.append(name)
        else:
            missing.append(name)

    if "CONFIG" not in moved:
        fail("CONFIG declaration is required for Step 3-4")

    ensure_block = find_iife_block(js, ENSURE_LEVEL_MARKER)
    if ensure_block:
        blocks.append(ensure_block)
        moved.append("ensureLevelTable IIFE")

    config_text = "// Step 3-4: extracted static config/data declarations from js/main.js.\n"
    config_text += "// Classic script globals; no ES module export/import.\n\n"
    for _start, _end, text in sorted(blocks, key=lambda x: x[0]):
        config_text += text + "\n"

    patched_js = remove_blocks(js, blocks)
    patched_js = patched_js.replace(
        "/* --------------------\n   CONFIG\n-------------------- */",
        "/* --------------------\n   CONFIG\n-------------------- */\n/* Step 3-4: static config/data moved to js/core/config.js */",
        1,
    )

    patched_index = ensure_script_order(index)

    # Verification: moved declarations exist in config, not in main.
    for name in moved:
        if name == "ensureLevelTable IIFE":
            if ENSURE_LEVEL_MARKER in patched_js:
                fail("ensureLevelTable IIFE still remains in js/main.js")
            if ENSURE_LEVEL_MARKER not in config_text:
                fail("ensureLevelTable IIFE missing from config.js")
            continue
        if decl_count(config_text, name) != 1:
            fail(f"{name} must exist exactly once in config.js, found {decl_count(config_text, name)}")
        if decl_count(patched_js, name) != 0:
            fail(f"{name} still remains in js/main.js")

    verify_event_invariants(patched_index, patched_js)
    verify_storage_untouched(patched_js)

    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(config_text, encoding="utf-8")
    MAIN.write_text(patched_js, encoding="utf-8")
    INDEX.write_text(patched_index, encoding="utf-8")

    subprocess.run(["node", "--check", str(CONFIG_FILE)], check=True)
    subprocess.run(["node", "--check", "js/core/utils.js"], check=True)
    subprocess.run(["node", "--check", "js/core/audio.js"], check=True)
    subprocess.run(["node", "--check", str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 3-4 Config Module Split\n\n"
        "작성일: 2026-05-15\n\n"
        "## 변경 내용\n\n"
        "- 정적 config/data 선언을 `js/core/config.js`로 분리했다.\n"
        "- `index.html` script 순서를 `utils.js` → `audio.js` → `config.js` → `main.js`로 정리했다.\n"
        "- ES module 전환 없이 classic script 전역 호환성을 유지했다.\n"
        "- 저장 관련 키/함수는 `js/main.js`에 유지했다.\n\n"
        "## 분리한 항목\n\n"
        + "\n".join(f"- `{name}`" for name in moved) + "\n\n"
        "## 현재 파일에 없어 분리하지 않은 후보\n\n"
        + ("\n".join(f"- `{name}`" for name in missing) if missing else "없음") + "\n\n"
        "## 유지한 항목\n\n"
        "- `SAVE_KEY`\n"
        "- `SAVE_BACKUP_KEY`\n"
        "- `save()` / `load()` / `saveGame()`\n"
        "- `readSavePayload()`\n"
        "- `exportSaveData()` / `importSaveData(raw)` / `ensureSaveTransferUI()`\n"
        "- `_saveDirty` / `_lastSaveWriteAt`\n\n"
        "## 검증\n\n"
        "- `node --check js/core/config.js`\n"
        "- `node --check js/core/utils.js`\n"
        "- `node --check js/core/audio.js`\n"
        "- `node --check js/main.js`\n"
        "- inline `onclick=` 0개 유지\n"
        "- `.onclick =` 0개 유지\n"
        "- `function safeClick` 0개 유지\n"
        "- 실제 `safeClick(` 호출 0개 유지\n\n"
        "## 브라우저 QA 필요\n\n"
        "- 게임 시작/스플래시 종료\n"
        "- 메뉴 가격/지역/연구/업그레이드 데이터 정상 표시\n"
        "- 저장 export/import UI 유지\n"
        "- 콘솔 ReferenceError 없음\n",
        encoding="utf-8",
    )
    print("[OK] Step 3-4 config split applied")


if __name__ == "__main__":
    main()
