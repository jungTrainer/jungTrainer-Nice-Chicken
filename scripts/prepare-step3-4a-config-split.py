#!/usr/bin/env python3
"""
Step 3-4A: Prepare config split with preflight guard.

This script does not split config yet.
It verifies that Step 3-3 utils split has been fully applied before allowing a future config split.
"""
from pathlib import Path
import re
import sys

MAIN = Path("js/main.js")
INDEX = Path("index.html")
UTILS = Path("js/core/utils.js")
AUDIO = Path("js/core/audio.js")
REPORT = Path("docs/2026-05-15-step3-4a-config-split-preflight.md")

UTILS_SCRIPT = '<script src="./js/core/utils.js"></script>'
AUDIO_SCRIPT = '<script src="./js/core/audio.js"></script>'
MAIN_SCRIPT = '<script src="./js/main.js"></script>'

REQUIRED_UTILS = [
    "fmtKoreanUnits", "fmtWon", "fmtNoWon", "fmtCompactWon", "fmtCompact",
    "clamp", "clampInt", "dayKey", "nowK", "isHangulOnly", "safeOn", "_bindSafe"
]
CONFIG_CANDIDATES = [
    "SAVE_KEY", "VEHICLES", "CONFIG", "REGIONS", "REGION_MAP", "MENUS", "MENU_MAP",
    "CUSTOMER_EMOJIS", "STAFF_POOL", "UPGRADES", "RESEARCH", "DECOS",
    "SIGN_STAGES_MAX", "SIGN_IMAGE_CANDIDATES", "SIGN_IMAGES"
]


def fail(msg):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def count_actual_safe_click(js):
    return sum(1 for line in js.splitlines() if "safeClick(" in line and not line.strip().startswith("function safeClick"))


def main():
    for p in [MAIN, INDEX, AUDIO]:
        if not p.exists():
            fail(f"required file missing: {p}")

    js = MAIN.read_text(encoding="utf-8")
    html = INDEX.read_text(encoding="utf-8")

    # Event refactor invariants.
    if len(re.findall(r"\sonclick\s*=", html + "\n" + js, flags=re.I)) != 0:
        fail("inline onclick must remain 0")
    if len(re.findall(r"\.onclick\s*=", js)) != 0:
        fail(".onclick assignments must remain 0")
    if js.count("function safeClick") != 0:
        fail("function safeClick must remain 0")
    if count_actual_safe_click(js) != 0:
        fail("safeClick actual calls must remain 0")

    # Step 3-2A audio split preflight.
    if not AUDIO.exists():
        fail("Step 3-2A audio split is not complete: js/core/audio.js missing")
    audio = AUDIO.read_text(encoding="utf-8")
    for marker in ["const SOUND", "const AudioEngine", "function startBGM", "function unlockAudioOnce"]:
        if audio.count(marker) != 1:
            fail(f"audio marker invalid in js/core/audio.js: {marker}")
        if js.count(marker) != 0:
            fail(f"audio marker still remains in js/main.js: {marker}")

    # Step 3-3 utils split preflight. This is intentionally strict.
    if not UTILS.exists():
        fail("Step 3-3 utils split is not complete: js/core/utils.js missing")
    utils = UTILS.read_text(encoding="utf-8")
    if not (html.find(UTILS_SCRIPT) < html.find(AUDIO_SCRIPT) < html.find(MAIN_SCRIPT)):
        fail("script order must be utils.js -> audio.js -> main.js before config split")
    for fn in REQUIRED_UTILS:
        if utils.count(f"function {fn}") != 1:
            fail(f"utils function missing or duplicated in js/core/utils.js: {fn}")
        if js.count(f"function {fn}") != 0:
            fail(f"utils function still remains in js/main.js: {fn}")

    found = []
    missing = []
    for name in CONFIG_CANDIDATES:
        if re.search(rf"\b(?:const|let|var)\s+{re.escape(name)}\b", js):
            found.append(name)
        else:
            missing.append(name)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 3-4A Config Split Preflight\n\n"
        "작성일: 2026-05-15\n\n"
        "## 목적\n\n"
        "Step 3-4 config.js 실제 분리 전에 Step 3-2A audio split과 Step 3-3 utils split 완료 여부를 검사한다.\n\n"
        "## 결과\n\n"
        "Preflight 통과. 다음 config 후보를 후속 단계에서 분리할 수 있다.\n\n"
        "## Config 후보\n\n"
        + "\n".join(f"- `{x}`" for x in found) + "\n\n"
        "## 누락/보류 후보\n\n"
        + ("\n".join(f"- `{x}`" for x in missing) if missing else "없음") + "\n\n"
        "## 주의\n\n"
        "이 스크립트는 실제 config 분리를 수행하지 않는다.\n"
        "저장 안정화 Step 2-23은 여전히 미완료 리스크다.\n",
        encoding="utf-8"
    )
    print("[OK] Step 3-4A config split preflight passed")


if __name__ == "__main__":
    main()
