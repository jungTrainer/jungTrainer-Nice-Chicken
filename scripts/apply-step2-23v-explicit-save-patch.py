#!/usr/bin/env python3
"""Step 2-23V: Explicit Save Patch

This script applies minimal explicit save/dirty handling to high-impact gameplay
state changes in js/main.js. It keeps the classic script/global structure and
avoids SAVE_KEY/schema/UI changes.
"""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "js" / "main.js"
DOC = ROOT / "docs" / "2026-05-28-step2-23v-explicit-save-patch.md"


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    count = text.count(old)
    if count == 0:
        print(f"[FAIL] missing target: {label}")
        return text, False
    if count > 1:
        print(f"[FAIL] ambiguous target ({count} matches): {label}")
        return text, False
    return text.replace(old, new, 1), True


def main() -> int:
    if not MAIN.exists():
        print(f"[FAIL] missing file: {MAIN}")
        return 1

    text = MAIN.read_text(encoding="utf-8")
    original = text
    ok = True

    replacements = [
        (
            "buyUpgrade mark dirty after money spend",
            "  state.money -= cost;\n\n  // [특수] 배달 업그레이드",
            "  state.money -= cost;\n  _saveDirty = true;\n\n  // [특수] 배달 업그레이드",
        ),
        (
            "serveByMenu mark dirty before conditional save",
            "  if(typeof onServeOneOnline === \"function\") onServeOneOnline();\n  if(typeof checkLevelUp === \"function\") checkLevelUp();\n\n  const hintEl = document.getElementById(\"hint\");",
            "  if(typeof onServeOneOnline === \"function\") onServeOneOnline();\n  if(typeof checkLevelUp === \"function\") checkLevelUp();\n  _saveDirty = true;\n\n  const hintEl = document.getElementById(\"hint\");",
        ),
        (
            "daily certificate expiry mark dirty",
            "    state.cert.issuedThisWeek = false;\n    showToast(\"인증서 유효기간이 종료되었습니다.\");\n    if(_saveDirty) save(true);",
            "    state.cert.issuedThisWeek = false;\n    _saveDirty = true;\n    showToast(\"인증서 유효기간이 종료되었습니다.\");\n    if(_saveDirty) save(true);",
        ),
        (
            "daily reset mark dirty",
            "    state.offlineSalesToday = 0;\n    state.todaySales = 0;\n  }\n}",
            "    state.offlineSalesToday = 0;\n    state.todaySales = 0;\n    _saveDirty = true;\n  }\n}",
        ),
        (
            "startNewWeek mark dirty",
            "  state.cert.issuedAt = 0;\n  state.cert.validUntil = 0;\n}",
            "  state.cert.issuedAt = 0;\n  state.cert.validUntil = 0;\n  _saveDirty = true;\n}",
        ),
        (
            "daily all done immediate save",
            "    state.missions.weeklyStamps = Math.min(7, state.missions.weeklyStamps + 1);\n\n    showToast(\"✅ 일간 올클! 무/양배추 쿠폰 +1, 주간 스탬프 +1\");",
            "    state.missions.weeklyStamps = Math.min(7, state.missions.weeklyStamps + 1);\n    _saveDirty = true;\n\n    showToast(\"✅ 일간 올클! 무/양배추 쿠폰 +1, 주간 스탬프 +1\");",
        ),
        (
            "weekly all done immediate save",
            "    state.missions.weeklyCompletedAt = Date.now();\n    showToast(\"🏅 주간 미션 올클! 이제 인증서 발급이 가능해요.\");",
            "    state.missions.weeklyCompletedAt = Date.now();\n    _saveDirty = true;\n    showToast(\"🏅 주간 미션 올클! 이제 인증서 발급이 가능해요.\");",
        ),
        (
            "startResearch immediate save",
            "  state.research.running[slotIdx] = {activeId: rid, targetLevel: nextLvl, startAt: now, endAt: now + durMs};\n\n  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);",
            "  state.research.running[slotIdx] = {activeId: rid, targetLevel: nextLvl, startAt: now, endAt: now + durMs};\n  _saveDirty = true;\n\n  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);",
        ),
        (
            "research complete immediate save",
            "      state.research.running[i] = {activeId:null, targetLevel:0, startAt:0, endAt:0};\n\n      const doneLvl = state.research.levels[rid]||0;",
            "      state.research.running[i] = {activeId:null, targetLevel:0, startAt:0, endAt:0};\n      _saveDirty = true;\n\n      const doneLvl = state.research.levels[rid]||0;",
        ),
        (
            "processDelivery dirty after earnings",
            "    state.contrib.system = (state.contrib.system||0) + earnings;\n\n    // 연출",
            "    state.contrib.system = (state.contrib.system||0) + earnings;\n    _saveDirty = true;\n\n    // 연출",
        ),
        (
            "updateOnlineAuto dirty after earnings",
            "    state.money += earnings;\n    state.contrib.system = (state.contrib.system||0) + earnings;\n\n    if(Math.random() < 0.08) AudioEngine.sfx.coin();",
            "    state.money += earnings;\n    state.contrib.system = (state.contrib.system||0) + earnings;\n    _saveDirty = true;\n\n    if(Math.random() < 0.08) AudioEngine.sfx.coin();",
        ),
        (
            "event start dirty",
            "    showToast(`이벤트 시작! ${evt.name}`);\n    sfxFanfare();\n    if(_saveDirty) save(true);",
            "    _saveDirty = true;\n    showToast(`이벤트 시작! ${evt.name}`);\n    sfxFanfare();\n    if(_saveDirty) save(true);",
        ),
        (
            "event end dirty",
            "    state.event = null;\n    eventBanner.classList.remove(\"on\");\n    if(_saveDirty) save(true);",
            "    state.event = null;\n    _saveDirty = true;\n    eventBanner.classList.remove(\"on\");\n    if(_saveDirty) save(true);",
        ),
        (
            "payroll dirty",
            "  state.payroll.lastDayKey = today;\n  if(_saveDirty) save(true);",
            "  state.payroll.lastDayKey = today;\n  _saveDirty = true;\n  if(_saveDirty) save(true);",
        ),
    ]

    for label, old, new in replacements:
        text, replaced = replace_once(text, old, new, label)
        ok = ok and replaced

    if not ok:
        print("[FAIL] explicit save patch aborted; js/main.js was not modified")
        return 1

    if text == original:
        print("[FAIL] no changes produced")
        return 1

    MAIN.write_text(text, encoding="utf-8")

    doc = """# Step 2-23V Explicit Save Patch

작성일: 2026-05-28

## 현재 상태

Step 2-23R/2-23S wrapper hotfix 이후, 핵심 액션 함수 내부에 명시적인 `_saveDirty = true`를 추가하는 패치를 적용했다.

## 변경한 파일

- `js/main.js`
- `docs/2026-05-28-step2-23v-explicit-save-patch.md`

## 변경 내용

명시 저장/dirty 처리를 추가한 영역:

- `buyUpgrade`
- `serveByMenu`
- `ensureMissionReset`
- `startNewWeek`
- `updateMissionsOnlineOnly`
- `startResearch`
- `updateResearch`
- `processDelivery`
- `updateOnlineAuto`
- `maybeTriggerEvent`
- `updateEvent`
- `processPayroll`

## 의도

- 구매/연구/미션/이벤트처럼 손실 체감이 큰 액션은 상태 변경 직후 dirty를 명시한다.
- 자동 수익 함수는 즉시 저장이 아니라 dirty 표시 중심으로 처리한다.
- 기존 저장 구조, `SAVE_KEY`, classic script 구조는 유지한다.

## 검증 필요

```bash
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

## 브라우저 재테스트 필요

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔 warning 반복 여부 확인

## 남은 리스크

- 실제 브라우저 테스트가 필요하다.
- 자동 수익은 localStorage write 과다를 피하기 위해 dirty 중심으로 처리했다.
- 장기적으로는 저장 helper를 `main.js`에 명시적으로 도입해 wrapper hotfix를 줄이는 것이 좋다.
"""
    DOC.write_text(doc, encoding="utf-8")

    print("[OK] Step 2-23V explicit save patch applied")
    print(f"[OK] updated: {MAIN.relative_to(ROOT)}")
    print(f"[OK] wrote: {DOC.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
