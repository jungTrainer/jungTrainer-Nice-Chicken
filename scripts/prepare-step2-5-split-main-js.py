#!/usr/bin/env python3
"""
Prepare Step 2-5: split inline JavaScript from index.html into js/main.js.

This script performs the split when executed, but it is designed to be used in the
next step after reviewing Step 2-4 diagnostics.

Strategy:
- Keep script execution order by replacing inline script blocks with external script tags
  at the same original positions.
- If an inline script is only the disabled service-worker placeholder, keep it inline.
- Combine substantial inline script blocks into js/main.js.
- Do not use type="module".
- Do not add defer in the first split.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
MAIN_JS = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-5-main-js-split.md")

PLACEHOLDER_MARKER = "service worker disabled in this build"


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def node_check(path: Path) -> None:
    subprocess.run(["node", "--check", str(path)], check=True)
    ok(f"node --check passed: {path}")


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run from repository root.")

    text = INDEX.read_text(encoding="utf-8")
    pattern = re.compile(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", re.S | re.I)
    matches = list(pattern.finditer(text))

    if not matches:
        ok("No inline script blocks found. Nothing to split.")
        return

    substantial = []
    for idx, match in enumerate(matches, start=1):
        body = match.group(2)
        stripped = body.strip()
        if not stripped:
            continue
        if PLACEHOLDER_MARKER in stripped and len(stripped) < 200:
            continue
        substantial.append((idx, match, stripped))

    if len(substantial) != 1:
        fail(f"Expected exactly one substantial inline script block to split, found {len(substantial)}")

    idx, target, body = substantial[0]
    MAIN_JS.parent.mkdir(parents=True, exist_ok=True)

    banner = "// Extracted from index.html by scripts/prepare-step2-5-split-main-js.py\n"
    MAIN_JS.write_text(banner + body + "\n", encoding="utf-8")
    node_check(MAIN_JS)

    new_text = text[:target.start()] + '<script src="./js/main.js"></script>' + text[target.end():]

    remaining_substantial = []
    for m in pattern.finditer(new_text):
        stripped = m.group(2).strip()
        if stripped and not (PLACEHOLDER_MARKER in stripped and len(stripped) < 200):
            remaining_substantial.append(stripped[:80])

    if remaining_substantial:
        fail(f"Substantial inline script blocks remain: {len(remaining_substantial)}")

    if new_text.count('<script src="./js/main.js"></script>') != 1:
        fail("Expected exactly one js/main.js script tag")

    INDEX.write_text(new_text, encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-5 main.js 분리 보고서\n\n"
        "작성일: 2026-05-15\n\n"
        "## 결과\n\n"
        "- `index.html`의 핵심 inline JavaScript를 `js/main.js`로 분리했다.\n"
        "- 첫 분리에서는 `type=module`을 사용하지 않았다.\n"
        "- 첫 분리에서는 `defer`를 추가하지 않았다. 기존 script 위치에서 실행 순서를 유지했다.\n"
        "- service-worker disabled placeholder script는 작은 inline script로 유지했다.\n\n"
        "## 검증\n\n"
        "- `node --check js/main.js` 통과\n"
        "- `index.html`에 `<script src=\"./js/main.js\"></script>` 1개 생성\n"
        "- 핵심 inline script block은 제거\n\n"
        "## 브라우저 확인 필요\n\n"
        "1. 게임 부팅\n"
        "2. 캔버스 렌더링\n"
        "3. 손님 선택/서빙\n"
        "4. 지역 확장 모달 열기/닫기\n"
        "5. mapGo/mapUnlock 동작\n"
        "6. 저장/불러오기\n",
        encoding="utf-8",
    )

    ok("Prepared js/main.js split")
    ok(f"Wrote {MAIN_JS}")
    ok(f"Wrote {REPORT}")


if __name__ == "__main__":
    main()
