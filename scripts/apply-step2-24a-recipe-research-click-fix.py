#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
DOC = ROOT / "docs" / "2026-05-28-step2-24a-recipe-research-click-fix.md"

OLD = '''const rndListEl = document.getElementById("rndList");
if(rndListEl){
  rndListEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="research-menu"]');
    if(!btn || !rndListEl.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const menuId = btn.dataset.menuId;
    if(!menuId) return;
    researchMenu(menuId);
  });
}
'''

NEW = '''function bindRecipeResearchClicks(){
  if(window.__recipeResearchClickBound) return;
  window.__recipeResearchClickBound = true;
  document.addEventListener("click", (e)=>{
    const btn = e.target?.closest?.('[data-action="research-menu"]');
    if(!btn) return;
    const list = document.getElementById("rndList");
    if(list && !list.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    const menuId = btn.dataset.menuId;
    if(!menuId) return;
    unlockAudioOnce();
    if(typeof startBGM === "function") startBGM();
    researchMenu(menuId);
  }, true);
}
bindRecipeResearchClicks();
'''

DOC_TEXT = '''# Step 2-24A Recipe Research Click Fix

작성일: 2026-05-28

## 문제

조리법 연구 버튼이 눌리지 않는 현상이 확인됐다.

## 원인 판단

`renderRndList()`는 `data-action="research-menu"` 버튼을 생성하지만, 기존 클릭 처리는 `#rndList`에 직접 위임되어 있었다. `rndList` 참조가 바인딩 시점에 없거나 모달/탭 렌더링 흐름과 어긋나면 클릭이 `researchMenu(menuId)`까지 도달하지 않을 수 있다.

## 변경 내용

- `rndListEl.addEventListener("click", ...)` 직접 위임을 `bindRecipeResearchClicks()`로 교체
- document capture 단계에서 `[data-action="research-menu"]` 클릭을 안정적으로 감지
- `rndList` 내부 버튼인지 확인
- `unlockAudioOnce()`, `startBGM()`, `researchMenu(menuId)` 호출 유지
- 중복 바인딩 방지 플래그 `window.__recipeResearchClickBound` 추가

## 검증 필요

```bash
node --check js/main.js
```

브라우저에서 관리 리포트 > 조리법 연구 탭을 열고 연구 버튼 클릭 시 돈 차감, 레벨 증가, 토스트, 저장 반영을 확인한다.
'''


def main():
    text = MAIN.read_text(encoding="utf-8")
    if OLD not in text:
        print("[FAIL] rndList click block not found")
        return 1
    text = text.replace(OLD, NEW, 1)
    MAIN.write_text(text, encoding="utf-8")
    DOC.write_text(DOC_TEXT, encoding="utf-8")
    print("[OK] Step 2-24A recipe research click fix applied")
    print("[OK] updated: js/main.js")
    print("[OK] wrote: docs/2026-05-28-step2-24a-recipe-research-click-fix.md")
    return 0

if __name__ == "__main__":
    sys.exit(main())
