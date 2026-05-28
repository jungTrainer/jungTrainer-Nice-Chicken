#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
DOC = ROOT / "docs" / "2026-05-28-step3-5b-save-helper-introduce-plan.md"

HELPER_ANCHOR = "let _saveDirty = false;\nlet _lastSaveWriteAt = 0;\n"
HELPERS = """let _saveDirty = false;\nlet _lastSaveWriteAt = 0;\nfunction markDirty(reason=\"unknown\"){\n  _saveDirty = true;\n  if(typeof window !== \"undefined\") window.__lastSaveDirtyReason = reason;\n  return true;\n}\nfunction saveImportant(reason=\"important\"){\n  markDirty(reason);\n  return save(true);\n}\nfunction saveSoon(reason=\"deferred\"){\n  return markDirty(reason);\n}\n"""

REPLACEMENTS = [
    (
        "processPayroll helper",
        "  state.payroll.lastDayKey = today;\n  _saveDirty = true;\n  if(_saveDirty) save(true);",
        "  state.payroll.lastDayKey = today;\n  saveImportant(\"payroll\");",
    ),
    (
        "checkLevelUp helper",
        "    sfxFanfare();\n    _saveDirty = true;\n  }",
        "    sfxFanfare();\n    saveSoon(\"level-up\");\n  }",
    ),
    (
        "startResearch helper",
        "  state.research.running[slotIdx] = {activeId: rid, targetLevel: nextLvl, startAt: now, endAt: now + durMs};\n  _saveDirty = true;\n\n  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);\n  sfxTick();\n  if(_saveDirty) save(true);",
        "  state.research.running[slotIdx] = {activeId: rid, targetLevel: nextLvl, startAt: now, endAt: now + durMs};\n\n  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);\n  sfxTick();\n  saveImportant(\"research-start\");",
    ),
    (
        "updateResearch helper",
        "      state.research.running[i] = {activeId:null, targetLevel:0, startAt:0, endAt:0};\n      _saveDirty = true;\n\n      const doneLvl = state.research.levels[rid]||0;\n      showToast(`🎓 연구 완료: ${rinfo?.name || rid} Lv.${doneLvl}`);\n      sfxFanfare();\n      if(_saveDirty) save(true);",
        "      state.research.running[i] = {activeId:null, targetLevel:0, startAt:0, endAt:0};\n\n      const doneLvl = state.research.levels[rid]||0;\n      showToast(`🎓 연구 완료: ${rinfo?.name || rid} Lv.${doneLvl}`);\n      sfxFanfare();\n      saveImportant(\"research-complete\");",
    ),
]

DOC_TEXT = """# Step 3-5B Save Helper Introduce Plan

작성일: 2026-05-28

## 현재 상태

`js/main.js` 저장 섹션에 helper 3종을 추가하고 대표 지점만 제한적으로 치환했다.

## 추가한 helper

- `markDirty(reason)`
- `saveImportant(reason)`
- `saveSoon(reason)`

## 치환한 위치

- `processPayroll()` → `saveImportant("payroll")`
- `checkLevelUp()` → `saveSoon("level-up")`
- `startResearch()` → `saveImportant("research-start")`
- `updateResearch()` 연구 완료 분기 → `saveImportant("research-complete")`

## 치환하지 않은 위치

- `buyUpgrade()`는 분기가 많아 이번 단계에서는 유지
- `serveByMenu()`는 손실 체감이 커서 기존 즉시 저장 유지
- `processDelivery()`와 `updateOnlineAuto()`는 자동 반복 수익이라 기존 dirty 중심 유지
- `useCoupon()`, `generateWeeklyCertificate()`, ending 관련 흐름은 후속 점검

## Step 2-23S wrapper 유지 판단

이번 단계에서는 제거하지 않는다. helper 적용 범위가 제한적이므로 다음 단계에서 추가 치환 후 제거를 판단한다.

## Step 2-23R wrapper 유지 판단

유지한다. branch snapshot sync는 저장 helper와 역할이 다르다.

## 검증 필요

```bash
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

## 다음 스텝 제안

Step 3-5C: Save Helper Apply More를 진행한다.
"""


def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 0:
        print(f"[FAIL] missing target: {label}")
        return text, False
    if count > 1:
        print(f"[FAIL] ambiguous target ({count}): {label}")
        return text, False
    return text.replace(old, new, 1), True


def main():
    text = MAIN.read_text(encoding="utf-8")
    ok = True

    if "function markDirty(reason=" not in text:
        text, inserted = replace_once(text, HELPER_ANCHOR, HELPERS, "save helper insert")
        ok = ok and inserted
    else:
        print("[OK] helpers already present")

    for label, old, new in REPLACEMENTS:
        if new in text:
            print(f"[OK] already patched: {label}")
            continue
        text, patched = replace_once(text, old, new, label)
        ok = ok and patched

    if not ok:
        print("[FAIL] Step 3-5B patch aborted")
        return 1

    MAIN.write_text(text, encoding="utf-8")
    DOC.write_text(DOC_TEXT, encoding="utf-8")
    print("[OK] Step 3-5B save helpers introduced")
    print("[OK] updated: js/main.js")
    print("[OK] wrote: docs/2026-05-28-step3-5b-save-helper-introduce-plan.md")
    return 0

if __name__ == "__main__":
    sys.exit(main())
