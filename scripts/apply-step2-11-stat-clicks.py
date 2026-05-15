#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-11-stat-click-cleanup.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

REPL=[
('safeClick("statMoney", ()=>showToast("💰 보유 금액: 업그레이드/연구/확장/교환상점에 사용해요."));', 'safeOn(document.getElementById("statMoney"), "click", ()=>showToast("💰 보유 금액: 업그레이드/연구/확장/교환상점에 사용해요."));'),
('safeClick("statRep", ()=>showToast("⭐ 평점(0~5): 손님 이탈/오답 시 하락, 정확 서빙 시 상승!"));', 'safeOn(document.getElementById("statRep"), "click", ()=>showToast("⭐ 평점(0~5): 손님 이탈/오답 시 하락, 정확 서빙 시 상승!"));'),
('safeClick("statLvl", ()=>showInfoToast("🏢 매장 레벨", [["기준","누적 매출(온라인+오프라인)"],["효과","단가/콘텐츠 확장"],["팁","누적을 늘리면 성장!"]]));', 'safeOn(document.getElementById("statLvl"), "click", ()=>showInfoToast("🏢 매장 레벨", [["기준","누적 매출(온라인+오프라인)"],["효과","단가/콘텐츠 확장"],["팁","누적을 늘리면 성장!"]]));'),
('safeClick("statToday", ()=>showInfoToast("📆 오늘 매출", [["범위","접속 중(온라인)"],["리셋","매일 0시"],["스탬프","일간 목표 달성에 사용"]]));', 'safeOn(document.getElementById("statToday"), "click", ()=>showInfoToast("📆 오늘 매출", [["범위","접속 중(온라인)"],["리셋","매일 0시"],["스탬프","일간 목표 달성에 사용"]]));'),
('safeClick("statTotal", ()=>{\n  const p = state.play || {onlineSecTotal:0, offlineSecTotal:0};\n  const online = fmtDuration(p.onlineSecTotal);\n  const offline = fmtDuration(p.offlineSecTotal);\n  const total = fmtDuration((p.onlineSecTotal||0)+(p.offlineSecTotal||0));\n  const sum = (state.totalSales||0) + (state.offlineSalesTotal||0);\n  showInfoToast("📈 누적 매출 / 시간", [["누적 매출", fmtCompactWon(sum)],["온라인 시간", online],["오프라인 시간", offline],["총 플레이", total]]);\n});', 'safeOn(document.getElementById("statTotal"), "click", ()=>{\n  const p = state.play || {onlineSecTotal:0, offlineSecTotal:0};\n  const online = fmtDuration(p.onlineSecTotal);\n  const offline = fmtDuration(p.offlineSecTotal);\n  const total = fmtDuration((p.onlineSecTotal||0)+(p.offlineSecTotal||0));\n  const sum = (state.totalSales||0) + (state.offlineSalesTotal||0);\n  showInfoToast("📈 누적 매출 / 시간", [["누적 매출", fmtCompactWon(sum)],["온라인 시간", online],["오프라인 시간", offline],["총 플레이", total]]);\n});')
]
TARGET_SAFE=['safeClick("statMoney"','safeClick("statRep"','safeClick("statLvl"','safeClick("statToday"','safeClick("statTotal"']
TARGET_SAFEON=['safeOn(document.getElementById("statMoney"), "click"','safeOn(document.getElementById("statRep"), "click"','safeOn(document.getElementById("statLvl"), "click"','safeOn(document.getElementById("statToday"), "click"','safeOn(document.getElementById("statTotal"), "click"']
PRESERVE=['openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"','closeSettingsBtn.addEventListener("click"','closeCouponsBtn.addEventListener("click"','closeExchangeBtn.addEventListener("click"','pinCancelBtn.addEventListener("click"','pinOkBtn.addEventListener("click"','openCouponsBtn.addEventListener("click"','openExchangeBtn.addEventListener("click"','clearLogBtn.addEventListener("click"','useDrinkCouponBtn.addEventListener("click"','useVegCouponBtn.addEventListener("click"','doExchangeBtn.addEventListener("click"','useCertDrinkBtn.addEventListener("click"','makeCardBtn.addEventListener("click"','forceSaveBtn.addEventListener("click"','resetAllBtn.addEventListener("click"','toggleSoundBtn.addEventListener("click"','saveNameBtn.addEventListener("click"','claimOfflineBtn.addEventListener("click"']

def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index=INDEX.read_text(encoding='utf-8')
    js=MAIN.read_text(encoding='utf-8')
    before_inline=inline_count(index,js)
    before_safe={p:js.count(p) for p in TARGET_SAFE}
    print('[before] inline', before_inline)
    print('[before] safeClick stat targets', before_safe)
    patched=js
    applied=0
    for old,new in REPL:
        if old not in patched: fail(f'target not found: {old[:80]}')
        patched=patched.replace(old,new,1)
        applied+=1
    if applied!=5: fail(f'expected 5 replacements, got {applied}')
    MAIN.write_text(patched,encoding='utf-8')
    index2=INDEX.read_text(encoding='utf-8')
    js2=MAIN.read_text(encoding='utf-8')
    after_inline=inline_count(index2,js2)
    after_safe={p:js2.count(p) for p in TARGET_SAFE}
    print('[after] inline', after_inline)
    print('[after] safeClick stat targets', after_safe)
    if after_inline!=0: fail(f'inline onclick must remain 0, found {after_inline}')
    for p,c in after_safe.items():
        if c!=0: fail(f'safeClick stat remains: {p}={c}')
    for p in TARGET_SAFEON:
        if js2.count(p)!=1: fail(f'safeOn target invalid: {p}={js2.count(p)}')
    for p in PRESERVE:
        if js2.count(p)!=1: fail(f'preserved event invalid: {p}={js2.count(p)}')
    node_check()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Step 2-11 Stat Click Cleanup\n\n- safeClick 기반 통계/정보 토스트 5개를 safeOn(document.getElementById(...), "click", ...)로 전환\n- safeClick 함수 자체는 유지\n- inline onclick 0개 유지\n- 기존 Step 2-8~2-10 이벤트 유지\n- `node --check js/main.js` 통과\n', encoding='utf-8')
    print('[OK] Step 2-11 completed')

if __name__=='__main__': main()
