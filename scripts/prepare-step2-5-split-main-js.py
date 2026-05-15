#!/usr/bin/env python3
"""
Prepare Step 2-5: split the main inline JavaScript from index.html into js/main.js.

Strategy:
- Keep execution order by replacing the target inline script at its original location.
- Keep small utility inline scripts that are safer left in HTML for now:
  1) Splash auto-hide script
  2) service-worker disabled placeholder
- Split only the large application script into js/main.js.
- Do not use type="module" in the first split.
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
SPLASH_MARKER = "Splash auto-hide"
MAIN_MARKER = "나이스치킨 타이쿤 (최종 통합)"


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def should_keep_inline(body: str) -> bool:
    stripped = body.strip()
    if not stripped:
        return True
    if PLACEHOLDER_MARKER in stripped and len(stripped) < 300:
        return True
    if SPLASH_MARKER in stripped and "splashScreen" in stripped:
        return True
    return False


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

    candidates = []
    kept_inline = []
    for idx, match in enumerate(matches, start=1):
        body = match.group(2)
        stripped = body.strip()
        if should_keep_inline(stripped):
            kept_inline.append(idx)
            continue
        candidates.append((idx, match, stripped))

    if len(candidates) != 1:
        details = ", ".join(f"#{idx}: {body[:80].replace(chr(10),' ')}" for idx, _m, body in candidates)
        fail(f"Expected exactly one main inline script block to split, found {len(candidates)}. Candidates: {details}")

    idx, target, body = candidates[0]
    if MAIN_MARKER not in body and "const SAVE_KEY" not in body:
        fail("The selected script block does not look like the main application script.")

    MAIN_JS.parent.mkdir(parents=True, exist_ok=True)

    banner = "// Extracted from index.html by scripts/prepare-step2-5-split-main-js.py\n"
    MAIN_JS.write_text(banner + body + "\n", encoding="utf-8")
    node_check(MAIN_JS)

    new_text = text[:target.start()] + '<script src="./js/main.js"></script>' + text[target.end():]

    if new_text.count('<script src="./js/main.js"></script>') != 1:
        fail("Expected exactly one js/main.js script tag")

    remaining_candidates = []
    for idx2, m in enumerate(pattern.finditer(new_text), start=1):
        stripped = m.group(2).strip()
        if stripped and not should_keep_inline(stripped):
            remaining_candidates.append(stripped[:120])

    if remaining_candidates:
        fail(f"Unexpected substantial inline script blocks remain: {len(remaining_candidates)}")

    INDEX.write_text(new_text, encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-5 main.js 분리 보고서\n\n"
        "작성일: 2026-05-15\n\n"
        "## 결과\n\n"
        "- `index.html`의 핵심 애플리케이션 JavaScript를 `js/main.js`로 분리했다.\n"
        "- 첫 분리에서는 `type=module`을 사용하지 않았다.\n"
        "- 첫 분리에서는 `defer`를 추가하지 않았다. 기존 script 위치에서 실행 순서를 유지했다.\n"
        "- splash auto-hide script는 부팅 안전망 성격이라 inline으로 유지했다.\n"
        "- service-worker disabled placeholder script는 작은 inline script로 유지했다.\n\n"
        "## 검증\n\n"
        "- `node --check js/main.js` 통과\n"
        "- `index.html`에 `<script src=\"./js/main.js\"></script>` 1개 생성\n"
        "- 핵심 main application inline script block 제거\n\n"
        "## 브라우저 확인 필요\n\n"
        "1. 게임 부팅\n"
        "2. 스플래시 자동 제거\n"
        "3. 캔버스 렌더링\n"
        "4. 손님 선택/서빙\n"
        "5. 지역 확장 모달 열기/닫기\n"
        "6. mapGo/mapUnlock 동작\n"
        "7. 저장/불러오기\n",
        encoding="utf-8",
    )

    ok("Prepared js/main.js split")
    ok(f"Split inline script block #{idx}; kept inline blocks: {kept_inline}")
    ok(f"Wrote {MAIN_JS}")
    ok(f"Wrote {REPORT}")


if __name__ == "__main__":
    main()
