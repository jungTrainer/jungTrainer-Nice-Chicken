#!/usr/bin/env python3
"""
Step 3-3F: Repair utils split partial state.

Classic script mode is preserved. No ES module import/export is introduced.
This script supports partial states:
- js/core/utils.js may already exist.
- js/core/audio.js may still contain a temporary document.write utils loader.
- index.html may still load audio.js -> main.js without explicit utils.js.
- js/main.js may contain all, some, or none of the utility function declarations.
"""
from pathlib import Path
import re
import subprocess
import sys

MAIN = Path("js/main.js")
INDEX = Path("index.html")
UTILS = Path("js/core/utils.js")
AUDIO = Path("js/core/audio.js")
REPORT = Path("docs/2026-05-15-step3-3-utils-split.md")

UTILS_SCRIPT = '<script src="./js/core/utils.js"></script>'
AUDIO_SCRIPT = '<script src="./js/core/audio.js"></script>'
MAIN_SCRIPT = '<script src="./js/main.js"></script>'

UTIL_FUNCTIONS = [
    "fmtKoreanUnits",
    "fmtWon",
    "fmtNoWon",
    "fmtCompactWon",
    "fmtCompact",
    "clamp",
    "clampInt",
    "dayKey",
    "nowK",
    "isHangulOnly",
    "safeOn",
    "_bindSafe",
]

AUDIO_TEMP_LOADER_RE = re.compile(
    r"// Step 3-3E: load utility helpers before js/main.js without changing classic script mode\.\n"
    r"// This keeps utils available before main.js even when index.html still lists audio.js first\.\n"
    r"\(function loadUtilityHelpersBeforeMain\(\)\{.*?\}\)\(\);\n\n",
    re.S,
)


def fail(msg):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def actual_safe_click_count(js):
    return sum(1 for line in js.splitlines() if "safeClick(" in line and not line.strip().startswith("function safeClick"))


def direct_onclick_count(js):
    return len(re.findall(r"\.onclick\s*=", js))


def inline_onclick_count(index_html, js):
    return len(re.findall(r"\sonclick\s*=", index_html + "\n" + js, flags=re.I))


def assert_event_invariants(index_html, js):
    if inline_onclick_count(index_html, js) != 0:
        fail(f"inline onclick must remain 0, found {inline_onclick_count(index_html, js)}")
    if direct_onclick_count(js) != 0:
        fail(f".onclick assignments must remain 0, found {direct_onclick_count(js)}")
    if js.count("function safeClick") != 0:
        fail(f"function safeClick must remain 0, found {js.count('function safeClick')}")
    if actual_safe_click_count(js) != 0:
        fail(f"safeClick actual calls must remain 0, found {actual_safe_click_count(js)}")


def find_function_block(js, name):
    marker = f"function {name}"
    start = js.find(marker)
    if start < 0:
        return None
    brace = js.find("{", start)
    if brace < 0:
        fail(f"opening brace not found for {name}")
    depth = 0
    i = brace
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
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(js) and js[end] == ";": end += 1
                if end < len(js) and js[end] == "\n": end += 1
                return start, end, js[start:end].rstrip() + "\n"
        i += 1
    fail(f"function block not closed for {name}")


def remove_blocks(js, blocks):
    patched = js
    for start, end, _block in sorted(blocks, key=lambda x: x[0], reverse=True):
        patched = patched[:start] + patched[end:]
    return patched


def ensure_script_order(index_html):
    if index_html.count(UTILS_SCRIPT) > 1:
        fail(f"utils script tag appears too many times: {index_html.count(UTILS_SCRIPT)}")
    if index_html.count(AUDIO_SCRIPT) != 1:
        fail(f"expected audio script tag exactly 1, found {index_html.count(AUDIO_SCRIPT)}")
    if index_html.count(MAIN_SCRIPT) != 1:
        fail(f"expected main script tag exactly 1, found {index_html.count(MAIN_SCRIPT)}")
    if UTILS_SCRIPT not in index_html:
        index_html = index_html.replace(AUDIO_SCRIPT, UTILS_SCRIPT + "\n" + AUDIO_SCRIPT, 1)
    if not (index_html.find(UTILS_SCRIPT) < index_html.find(AUDIO_SCRIPT) < index_html.find(MAIN_SCRIPT)):
        fail("script order must be utils.js -> audio.js -> main.js")
    return index_html


def build_utils_from_main(main_js):
    """Extract whatever util function declarations still remain in main.js.

    Partial states are allowed. For example, fmtCompact may already have been removed
    while safeOn still remains. The missing declarations are not an error when
    js/core/utils.js already exists and validates.
    """
    blocks = []
    for name in UTIL_FUNCTIONS:
        block = find_function_block(main_js, name)
        if block is not None:
            blocks.append(block)
    if not blocks:
        return None, main_js

    extracted = "// Step 3-3: extracted from js/main.js.\n"
    extracted += "// Loaded before js/core/audio.js and js/main.js as a classic script.\n\n"
    for name in UTIL_FUNCTIONS:
        block = next((b for b in blocks if b[2].lstrip().startswith(f"function {name}")), None)
        if block is not None:
            extracted += block[2] + "\n"

    patched_main = remove_blocks(main_js, blocks)
    patched_main = patched_main.replace(
        "/* --------------------\n   Helpers\n-------------------- */\nlet toastTimer = null;",
        "/* --------------------\n   Helpers\n-------------------- */\n/* Step 3-3: pure utility helpers moved to js/core/utils.js */\nlet toastTimer = null;",
        1,
    )
    return extracted, patched_main


def validate_utils_file(utils_text):
    for name in UTIL_FUNCTIONS:
        if utils_text.count(f"function {name}") != 1:
            fail(f"function {name} must exist exactly once in js/core/utils.js, found {utils_text.count(f'function {name}')}" )


def main():
    if not MAIN.exists(): fail("js/main.js not found")
    if not INDEX.exists(): fail("index.html not found")
    if not AUDIO.exists(): fail("js/core/audio.js not found; Step 3-2A must be complete first")

    main_js = MAIN.read_text(encoding="utf-8")
    index_html = INDEX.read_text(encoding="utf-8")
    audio_js = AUDIO.read_text(encoding="utf-8")
    assert_event_invariants(index_html, main_js)

    extracted_utils, patched_main = build_utils_from_main(main_js)
    if UTILS.exists():
        utils_text = UTILS.read_text(encoding="utf-8")
        validate_utils_file(utils_text)
        final_utils = utils_text
    else:
        if extracted_utils is None:
            fail("utils.js missing and util function blocks not found in main.js")
        final_utils = extracted_utils
        validate_utils_file(final_utils)

    if extracted_utils is not None:
        final_main = patched_main
    else:
        final_main = main_js

    for name in UTIL_FUNCTIONS:
        if f"function {name}" in final_main:
            fail(f"function {name} still remains in js/main.js after repair")

    final_index = ensure_script_order(index_html)
    final_audio, _replaced = AUDIO_TEMP_LOADER_RE.subn("", audio_js, count=1)
    if "loadUtilityHelpersBeforeMain" in final_audio or "document.write('<script src=\"./js/core/utils.js\"" in final_audio:
        fail("temporary utils loader still remains in js/core/audio.js")

    assert_event_invariants(final_index, final_main)

    UTILS.parent.mkdir(parents=True, exist_ok=True)
    UTILS.write_text(final_utils, encoding="utf-8")
    MAIN.write_text(final_main, encoding="utf-8")
    INDEX.write_text(final_index, encoding="utf-8")
    AUDIO.write_text(final_audio, encoding="utf-8")

    subprocess.run(["node", "--check", str(UTILS)], check=True)
    subprocess.run(["node", "--check", str(AUDIO)], check=True)
    subprocess.run(["node", "--check", str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 3-3 Utils Module Split\n\n"
        "작성일: 2026-05-15\n\n"
        "## 변경 내용\n\n"
        "- 순수 유틸/호환 helper를 `js/core/utils.js`로 분리했다.\n"
        "- `index.html` script 순서를 `utils.js` → `audio.js` → `main.js`로 정리했다.\n"
        "- `js/core/audio.js`의 임시 `document.write()` loader를 제거했다.\n"
        "- ES module 전환 없이 classic script/global 호출 호환성을 유지했다.\n\n"
        "## 분리된 함수\n\n"
        + "\n".join(f"- `{name}()`" for name in UTIL_FUNCTIONS) + "\n\n"
        "## 검증\n\n"
        "- `node --check js/core/utils.js`\n"
        "- `node --check js/core/audio.js`\n"
        "- `node --check js/main.js`\n"
        "- inline `onclick=` 0개 유지\n"
        "- `.onclick =` 0개 유지\n"
        "- `function safeClick` 0개 유지\n"
        "- 실제 `safeClick(` 호출 0개 유지\n\n"
        "## 남은 리스크\n\n"
        "- 브라우저에서 포맷 표시, 메뉴/미션/지도 화면의 금액 표기 확인 필요.\n"
        "- canvas click/touch에서 `safeOn`, `clamp`, `clampInt` 전역 참조 정상 동작 확인 필요.\n"
        "- Step 2-23 저장 안정화는 여전히 미완료 상태.\n",
        encoding="utf-8",
    )
    print("[OK] Step 3-3 utils split repaired")


if __name__ == "__main__":
    main()
