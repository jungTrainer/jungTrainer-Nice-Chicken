#!/usr/bin/env python3
"""
Step 2-7: stabilize runtime after js/main.js split.

Scope:
- Diagnose .onclick = assignments by rough feature area.
- Remove/neutralize duplicate openMap flow caused by safeClick("openMap", ()=> openExpansionModal()).
- Make openExpansionModal() use renderMapUI() instead of legacy renderExpansionCards().
- Keep legacy renderExpansionCards(), moveBranch(), unlockBranch() for compatibility, but stop routing openMap to missing expansionList.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-7-runtime-stabilization.md")

OLD_SAFECLICK = 'safeClick("openMap", ()=>{ openExpansionModal(); });'
NEW_SAFECLICK = '// Step 2-7: openMap is handled by openMapBtn.addEventListener in initDOMRefs().'

OLD_OPEN = '''function openExpansionModal(){
  unlockAudioOnce(); startBGM();
  const m = document.getElementById("modalExpansion");
  if(!m) return;
  m.classList.add("on");
  renderExpansionCards();
}
'''

NEW_OPEN = '''function openExpansionModal(){
  unlockAudioOnce(); startBGM();
  const m = document.getElementById("modalExpansion");
  if(!m) return;
  m.classList.add("on");
  renderMapUI();
}
'''

OLD_UNLOCK_RENDER = '  renderExpansionCards();\n  showToast(`${loc.name} 오픈을 축하합니다! 🎉`);'
NEW_UNLOCK_RENDER = '  renderMapUI();\n  showToast(`${loc.name} 오픈을 축하합니다! 🎉`);'


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def classify_onclick(line: str) -> str:
    lower = line.lower()
    if "coupon" in lower or "exchange" in lower or "cert" in lower or "benefit" in lower:
        return "benefit/coupon/exchange"
    if "modal" in lower or "settings" in lower or "pin" in lower:
        return "modal/settings/pin"
    if "map" in lower or "branch" in lower or "expansion" in lower or "region" in lower:
        return "region/expansion"
    if "save" in lower or "reset" in lower or "profile" in lower or "name" in lower:
        return "save/profile"
    if "canvas" in lower or "lvl" in lower or "panel" in lower:
        return "ui/panel/canvas"
    return "other"


def count_state(index_text: str, js_text: str) -> dict:
    combined = index_text + "\n" + js_text
    onclick_assignments = re.findall(r"^.*\.onclick\s*=.*$", js_text, flags=re.M)
    groups = {}
    for line in onclick_assignments:
        groups[classify_onclick(line)] = groups.get(classify_onclick(line), 0) + 1
    return {
        "inline_onclick": len(re.findall(r"\sonclick\s*=", combined, flags=re.I)),
        "direct_onclick": len(onclick_assignments),
        "add_event": len(re.findall(r"\.addEventListener\s*\(", js_text)),
        "safe_open_map": js_text.count(OLD_SAFECLICK),
        "open_map_binding": js_text.count('openMapBtn.addEventListener("click"'),
        "open_expansion_func": js_text.count("function openExpansionModal()"),
        "open_render_cards": js_text.count("renderExpansionCards();"),
        "open_render_map": js_text.count("renderMapUI();"),
        "expansion_list_get": js_text.count('document.getElementById("expansionList")'),
        "map_wrap_id": index_text.count('id="mapWrap"'),
        "expansion_list_id": index_text.count('id="expansionList"'),
        "map_go": js_text.count('mapGoBtn.addEventListener("click"'),
        "map_unlock": js_text.count('mapUnlockBtn.addEventListener("click"'),
        "close_expansion": js_text.count('closeExpansionModalBtn.addEventListener("click"'),
        "groups": groups,
        "onclick_samples": onclick_assignments[:80],
    }


def print_state(label: str, s: dict) -> None:
    for key, value in s.items():
        if key in {"groups", "onclick_samples"}:
            continue
        print(f"[{label}] {key}: {value}")
    print(f"[{label}] onclick groups: {s['groups']}")


def node_check() -> None:
    subprocess.run(["node", "--check", str(MAIN)], check=True)
    ok("node --check js/main.js passed")


def validate(index_text: str, js_text: str) -> None:
    s = count_state(index_text, js_text)
    if s["inline_onclick"] != 0:
        fail(f"inline onclick should remain 0, found {s['inline_onclick']}")
    if s["safe_open_map"] != 0:
        fail("duplicate safeClick openMap flow still remains")
    if s["open_map_binding"] != 1:
        fail(f"expected one openMap addEventListener, found {s['open_map_binding']}")
    if s["open_expansion_func"] != 1:
        fail(f"expected one openExpansionModal, found {s['open_expansion_func']}")
    if s["expansion_list_id"] != 0:
        fail(f"index.html should not contain expansionList id, found {s['expansion_list_id']}")
    if s["map_wrap_id"] != 1:
        fail(f"index.html should contain one mapWrap id, found {s['map_wrap_id']}")
    if "function openExpansionModal(){" not in js_text or "renderMapUI();" not in js_text[js_text.find("function openExpansionModal(){"):js_text.find("function closeExpansionModal(){")]:
        fail("openExpansionModal does not call renderMapUI")
    if s["map_go"] != 1 or s["map_unlock"] != 1 or s["close_expansion"] != 1:
        fail("critical map/close event bindings not preserved")
    node_check()


def main() -> None:
    if not INDEX.exists() or not MAIN.exists():
        fail("index.html or js/main.js missing")

    index_text = INDEX.read_text(encoding="utf-8")
    js_text = MAIN.read_text(encoding="utf-8")
    before = count_state(index_text, js_text)
    print_state("before", before)

    patched = js_text
    if OLD_SAFECLICK in patched:
        patched = patched.replace(OLD_SAFECLICK, NEW_SAFECLICK, 1)
    elif NEW_SAFECLICK in patched:
        ok("openMap safeClick already neutralized")
    else:
        fail("Could not find openMap safeClick flow to neutralize")

    if OLD_OPEN in patched:
        patched = patched.replace(OLD_OPEN, NEW_OPEN, 1)
    elif "function openExpansionModal(){" in patched and "renderMapUI();" in patched[patched.find("function openExpansionModal(){"):patched.find("function closeExpansionModal(){")]:
        ok("openExpansionModal already uses renderMapUI")
    else:
        fail("Could not update openExpansionModal to renderMapUI")

    if OLD_UNLOCK_RENDER in patched:
        patched = patched.replace(OLD_UNLOCK_RENDER, NEW_UNLOCK_RENDER, 1)
    else:
        ok("unlockBranch legacy renderExpansionCards call not found or already replaced")

    MAIN.write_text(patched, encoding="utf-8")
    index_text2 = INDEX.read_text(encoding="utf-8")
    js_text2 = MAIN.read_text(encoding="utf-8")
    after = count_state(index_text2, js_text2)
    print_state("after", after)
    validate(index_text2, js_text2)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    group_lines = "\n".join(f"- {name}: {count}" for name, count in sorted(before["groups"].items()))
    sample_lines = "\n".join(f"```js\n{line.strip()}\n```" for line in before["onclick_samples"][:25])
    REPORT.write_text(
        "# Step 2-7 Runtime Stabilization Report\n\n"
        "작성일: 2026-05-15\n\n"
        "## 완료 내용\n\n"
        "- `safeClick(\"openMap\", ()=>{ openExpansionModal(); })` 중복 흐름을 비활성화했다.\n"
        "- `openExpansionModal()`이 구형 `renderExpansionCards()` 대신 신형 `renderMapUI()`를 호출하도록 정리했다.\n"
        "- `unlockBranch(id)` 후 갱신 흐름도 `renderMapUI()`로 정렬했다.\n"
        "- `renderExpansionCards()` / `moveBranch(id)` / `unlockBranch(id)` 함수 자체는 호환성 차원에서 유지했다.\n\n"
        "## .onclick = 직접 대입 분류\n\n"
        f"- 총 개수: {before['direct_onclick']}\n"
        f"{group_lines}\n\n"
        "## 대표 샘플\n\n"
        f"{sample_lines}\n\n"
        "## 검증\n\n"
        "- inline onclick= 0개 유지\n"
        "- openMap 중복 safeClick 제거\n"
        "- openExpansionModal → renderMapUI 정렬\n"
        "- mapGo / mapUnlock / closeExpansionModalBtn 이벤트 유지\n"
        "- node --check js/main.js 통과\n\n"
        "## 다음 단계\n\n"
        "1. 모달/설정/PIN 계열 `.onclick =`를 우선 addEventListener로 전환한다.\n"
        "2. 쿠폰/교환 계열 `.onclick =`를 두 번째 묶음으로 정리한다.\n"
        "3. `renderExpansionCards()`가 더 이상 실제 UI에서 쓰이지 않으면 별도 단계에서 제거 후보로 판단한다.\n",
        encoding="utf-8",
    )
    ok(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
