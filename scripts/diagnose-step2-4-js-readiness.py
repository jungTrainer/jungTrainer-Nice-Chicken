#!/usr/bin/env python3
"""
Step 2-4: JS split readiness diagnostics.

This script does not modify index.html. It analyzes event bindings, script blocks,
DOMContentLoaded boot flow, and likely global functions before the js/main.js split.
It writes a markdown report under docs/.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
REPORT = Path("docs/2026-05-15-step2-4-js-readiness.md")


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def count_inline_scripts(text: str):
    return re.findall(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", text, flags=re.S | re.I)


def count_external_scripts(text: str):
    return re.findall(r"<script[^>]*\bsrc=[\"'][^\"']+[\"'][^>]*></script>", text, flags=re.S | re.I)


def extract_script_text(text: str) -> str:
    scripts = count_inline_scripts(text)
    return "\n".join(body for _attrs, body in scripts)


def node_check(script_text: str) -> tuple[bool, str]:
    tmp = Path("/tmp/step2-4-inline-check.js")
    tmp.write_text(script_text, encoding="utf-8")
    proc = subprocess.run(["node", "--check", str(tmp)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode == 0, proc.stdout.strip()


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run from repository root.")

    text = INDEX.read_text(encoding="utf-8")
    inline_scripts = count_inline_scripts(text)
    external_scripts = count_external_scripts(text)
    script_text = extract_script_text(text)
    ok_js, js_output = node_check(script_text)

    inline_onclick = len(re.findall(r"\sonclick\s*=", text, flags=re.I))
    direct_onclick = len(re.findall(r"\.onclick\s*=", text))
    add_event = len(re.findall(r"\.addEventListener\s*\(", text))
    dom_ready = len(re.findall(r"DOMContentLoaded", text))
    defer_count = len(re.findall(r"\bdefer\b", text, flags=re.I))
    css_link = len(re.findall(r"<link[^>]+href=[\"']\./css/style\.css[\"']", text, flags=re.I))

    functions = re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", script_text)
    unique_functions = sorted(set(functions))
    likely_globals = [
        name for name in unique_functions
        if name in {
            "initDOMRefs", "initAfterLoad", "init", "renderMapUI", "closeExpansionModal",
            "save", "saveGame", "load", "updateUI", "renderPanel", "buildMenuGrid",
            "onCanvasDown", "resizeCanvas", "startGameLoop", "BranchManager", "defaultState"
        }
    ]

    onclick_samples = re.findall(r".{0,80}\sonclick\s*=.{0,120}", text, flags=re.I)
    direct_onclick_samples = re.findall(r".{0,80}\.onclick\s*=.{0,120}", text)
    add_event_samples = re.findall(r".{0,80}\.addEventListener\s*\(.{0,120}", text)

    split_judgement = "가능"
    split_notes = []
    if not ok_js:
        split_judgement = "보류"
        split_notes.append("현재 inline script 추출본이 node --check를 통과하지 못했다.")
    if len(inline_scripts) == 0:
        split_judgement = "불필요"
        split_notes.append("inline script가 없다.")
    if direct_onclick > 20:
        split_notes.append(".onclick 직접 대입이 많아 분리 후에도 동작은 가능하나 추후 이벤트 정리가 필요하다.")
    if inline_onclick > 0:
        split_notes.append("HTML inline onclick이 남아 있어 js/main.js 분리 후 전역 함수 의존 리스크가 있다.")
    if dom_ready == 0:
        split_notes.append("DOMContentLoaded 초기화 흐름이 보이지 않는다. defer 적용 시 추가 확인이 필요하다.")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-4 JS 분리 전 최종 진단 보고서\n\n"
        "작성일: 2026-05-15\n\n"
        "## 요약\n\n"
        f"- CSS 외부 파일 링크 수: {css_link}\n"
        f"- HTML inline `onclick=` 개수: {inline_onclick}\n"
        f"- JS `.onclick =` 직접 대입 개수: {direct_onclick}\n"
        f"- `addEventListener` 개수: {add_event}\n"
        f"- inline `<script>` 블록 수: {len(inline_scripts)}\n"
        f"- 외부 `<script src>` 블록 수: {len(external_scripts)}\n"
        f"- `DOMContentLoaded` 등장 수: {dom_ready}\n"
        f"- `defer` 등장 수: {defer_count}\n"
        f"- 함수 선언 수: {len(functions)} / 고유 함수 수: {len(unique_functions)}\n"
        f"- inline script `node --check`: {'통과' if ok_js else '실패'}\n"
        f"- js/main.js 분리 판단: **{split_judgement}**\n\n"
        "## 분리 판단 메모\n\n"
        + ("\n".join(f"- {note}" for note in split_notes) if split_notes else "- 현재 기준으로 js/main.js 단순 분리 준비가 가능하다.")
        + "\n\n"
        "## 전역 유지 후보\n\n"
        + "\n".join(f"- `{name}`" for name in likely_globals)
        + "\n\n"
        "## 대표 HTML inline onclick 샘플\n\n"
        + ("\n".join(f"```text\n{s.strip()}\n```" for s in onclick_samples[:10]) if onclick_samples else "- 없음")
        + "\n\n"
        "## 대표 .onclick 직접 대입 샘플\n\n"
        + ("\n".join(f"```text\n{s.strip()}\n```" for s in direct_onclick_samples[:15]) if direct_onclick_samples else "- 없음")
        + "\n\n"
        "## 대표 addEventListener 샘플\n\n"
        + ("\n".join(f"```text\n{s.strip()}\n```" for s in add_event_samples[:15]) if add_event_samples else "- 없음")
        + "\n\n"
        "## JS 문법 검사 출력\n\n"
        f"```text\n{js_output or 'OK'}\n```\n\n"
        "## 다음 단계 권장\n\n"
        "1. `scripts/prepare-step2-5-split-main-js.py`를 사용해 `js/main.js` 분리 패치를 생성한다.\n"
        "2. 기존 inline script 위치는 같은 순서의 외부 script 로드로 대체한다.\n"
        "3. 첫 분리에서는 `type=module`을 사용하지 않는다. 전역 스코프를 유지한다.\n"
        "4. `defer`는 DOMContentLoaded 흐름 확인 후 적용한다. 우선은 원래 script 위치 유지가 더 안전하다.\n"
        "5. 브라우저에서 부팅, 캔버스, 지역 확장 모달, 저장/불러오기를 확인한다.\n",
        encoding="utf-8",
    )

    print(f"inline_onclick={inline_onclick}")
    print(f"direct_onclick={direct_onclick}")
    print(f"addEventListener={add_event}")
    print(f"inline_scripts={len(inline_scripts)}")
    print(f"external_scripts={len(external_scripts)}")
    print(f"DOMContentLoaded={dom_ready}")
    print(f"node_check={'pass' if ok_js else 'fail'}")
    print(f"report={REPORT}")

    if not ok_js:
        fail("Inline script node --check failed. See report for details.")


if __name__ == "__main__":
    main()
