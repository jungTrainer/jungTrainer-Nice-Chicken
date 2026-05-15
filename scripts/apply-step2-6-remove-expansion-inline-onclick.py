#!/usr/bin/env python3
"""
Step 2-6: remove remaining renderExpansionCards inline onclick strings from js/main.js.

Goal:
- Replace moveBranch/unlockBranch inline onclick template strings with data-action attributes.
- Add one delegated click handler on #modalExpansion.
- Keep moveBranch(id), unlockBranch(id), renderExpansionCards(), and mapWrap/renderMapUI flows.
- Validate with node --check js/main.js before writing final success.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-6-expansion-inline-onclick-cleanup.md")

OLD_MOVE = """btnHtml = `<button class=\"btn alt loc-btn\" onclick=\"moveBranch('${loc.id}')\">이동하기 🚀</button>`;"""
NEW_MOVE = """btnHtml = `<button class=\"btn alt loc-btn\" data-action=\"move-branch\" data-region-id=\"${loc.id}\" type=\"button\">이동하기 🚀</button>`;"""

OLD_UNLOCK = """btnHtml = `<button class=\"btn loc-btn\" ${canAfford ? \"\" : \"disabled\"} onclick=\"unlockBranch('${loc.id}')\">${costText} 오픈 🔓</button>`;"""
NEW_UNLOCK = """btnHtml = `<button class=\"btn loc-btn\" ${canAfford ? \"\" : \"disabled\"} data-action=\"unlock-branch\" data-region-id=\"${loc.id}\" type=\"button\">${costText} 오픈 🔓</button>`;"""

ANCHOR = """  const closeExpansionModalBtn = document.getElementById(\"closeExpansionModalBtn\");\n"""
BINDING = """
  const expansionActionModalEl = document.getElementById("modalExpansion");
  if(expansionActionModalEl){
    expansionActionModalEl.addEventListener("click", (e)=>{
      const btn = e.target.closest('[data-action="move-branch"], [data-action="unlock-branch"]');
      if(!btn || !expansionActionModalEl.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.regionId;
      if(!id) return;
      if(btn.dataset.action === "move-branch") moveBranch(id);
      else if(btn.dataset.action === "unlock-branch") unlockBranch(id);
    });
  }
"""


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def read_all() -> tuple[str, str]:
    if not INDEX.exists():
        fail("index.html not found")
    if not MAIN.exists():
        fail("js/main.js not found")
    return INDEX.read_text(encoding="utf-8"), MAIN.read_text(encoding="utf-8")


def counts(index_text: str, js_text: str) -> dict:
    combined = index_text + "\n" + js_text
    return {
        "inline_onclick": len(re.findall(r"\sonclick\s*=", combined, flags=re.I)),
        "move_data": js_text.count('data-action="move-branch"'),
        "unlock_data": js_text.count('data-action="unlock-branch"'),
        "delegation": js_text.count('expansionActionModalEl.addEventListener("click"'),
        "move_func": js_text.count("function moveBranch(id)"),
        "unlock_func": js_text.count("function unlockBranch(id)"),
        "render_cards": js_text.count("function renderExpansionCards()"),
        "open_map": js_text.count('openMapBtn.addEventListener("click"'),
        "map_go": js_text.count('mapGoBtn.addEventListener("click"'),
        "map_unlock": js_text.count('mapUnlockBtn.addEventListener("click"'),
        "close_expansion": js_text.count('closeExpansionModalBtn.addEventListener("click"'),
    }


def print_counts(label: str, c: dict) -> None:
    for k, v in c.items():
        print(f"[{label}] {k}: {v}")


def node_check() -> None:
    subprocess.run(["node", "--check", str(MAIN)], check=True)
    ok("node --check js/main.js passed")


def validate(index_text: str, js_text: str) -> None:
    c = counts(index_text, js_text)
    if c["inline_onclick"] != 0:
        fail(f"Expected zero inline onclick in index.html + js/main.js, found {c['inline_onclick']}")
    if c["move_data"] < 1:
        fail("move-branch data-action missing")
    if c["unlock_data"] < 1:
        fail("unlock-branch data-action missing")
    if c["delegation"] != 1:
        fail(f"Expected one expansion delegation binding, found {c['delegation']}")
    if c["move_func"] != 1:
        fail(f"Expected one moveBranch function, found {c['move_func']}")
    if c["unlock_func"] != 1:
        fail(f"Expected one unlockBranch function, found {c['unlock_func']}")
    if c["render_cards"] != 1:
        fail(f"Expected one renderExpansionCards function, found {c['render_cards']}")
    if c["open_map"] != 1 or c["map_go"] != 1 or c["map_unlock"] != 1 or c["close_expansion"] != 1:
        fail("Existing map/close event bindings were not preserved")
    node_check()


def main() -> None:
    index_text, js_text = read_all()
    before = counts(index_text, js_text)
    print_counts("before", before)

    patched = js_text

    if OLD_MOVE in patched:
        patched = patched.replace(OLD_MOVE, NEW_MOVE, 1)
    elif 'data-action="move-branch"' in patched:
        ok("move-branch data-action already exists")
    else:
        fail("Could not find moveBranch inline onclick template")

    if OLD_UNLOCK in patched:
        patched = patched.replace(OLD_UNLOCK, NEW_UNLOCK, 1)
    elif 'data-action="unlock-branch"' in patched:
        ok("unlock-branch data-action already exists")
    else:
        fail("Could not find unlockBranch inline onclick template")

    if 'expansionActionModalEl.addEventListener("click"' not in patched:
        if ANCHOR not in patched:
            fail("Could not find closeExpansionModalBtn anchor for delegation insertion")
        patched = patched.replace(ANCHOR, BINDING + "\n" + ANCHOR, 1)

    MAIN.write_text(patched, encoding="utf-8")
    index_text2, js_text2 = read_all()
    after = counts(index_text2, js_text2)
    print_counts("after", after)
    validate(index_text2, js_text2)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-6 Expansion Inline Onclick Cleanup\n\n"
        "작성일: 2026-05-15\n\n"
        "## 결과\n\n"
        "- `renderExpansionCards()` 내부의 `moveBranch` / `unlockBranch` inline onclick 문자열을 제거했다.\n"
        "- 버튼은 `data-action` / `data-region-id` 구조로 변경했다.\n"
        "- `#modalExpansion`에 이벤트 위임을 1회 추가했다.\n"
        "- `moveBranch(id)`와 `unlockBranch(id)` 함수는 유지했다.\n\n"
        "## 검증\n\n"
        "- `index.html + js/main.js` inline onclick 0개\n"
        "- `data-action=\"move-branch\"` 존재\n"
        "- `data-action=\"unlock-branch\"` 존재\n"
        "- `node --check js/main.js` 통과\n\n"
        "## 브라우저 확인 필요\n\n"
        "1. 세계 정복 모달 열기\n"
        "2. 구형 카드 UI가 표시되는 경우 이동/해금 버튼 클릭\n"
        "3. mapWrap 기반 신형 지도 UI와 충돌 여부 확인\n",
        encoding="utf-8",
    )
    ok(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
