#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-13-remove-safe-click.md')
SAFE_DECL='function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }\n'

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def safe_actual_calls(js):
    lines=[]
    for line in js.splitlines():
        s=line.strip()
        if 'safeClick(' in s and not s.startswith('function safeClick'):
            lines.append(s)
    return lines

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

PRESERVE=[
'openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"',
'closeSettingsBtn.addEventListener("click"','closeCouponsBtn.addEventListener("click"','closeExchangeBtn.addEventListener("click"','pinCancelBtn.addEventListener("click"','pinOkBtn.addEventListener("click"',
'openCouponsBtn.addEventListener("click"','openExchangeBtn.addEventListener("click"','clearLogBtn.addEventListener("click"','useDrinkCouponBtn.addEventListener("click"','useVegCouponBtn.addEventListener("click"','doExchangeBtn.addEventListener("click"','useCertDrinkBtn.addEventListener("click"','makeCardBtn.addEventListener("click"',
'forceSaveBtn.addEventListener("click"','resetAllBtn.addEventListener("click"','toggleSoundBtn.addEventListener("click"','saveNameBtn.addEventListener("click"','claimOfflineBtn.addEventListener("click"',
'safeOn(document.getElementById("statMoney"), "click"','safeOn(document.getElementById("statRep"), "click"','safeOn(document.getElementById("statLvl"), "click"','safeOn(document.getElementById("statToday"), "click"','safeOn(document.getElementById("statTotal"), "click"'
]

def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index=INDEX.read_text(encoding='utf-8')
    js=MAIN.read_text(encoding='utf-8')
    before_inline=inline_count(index,js)
    before_direct=direct_count(js)
    before_decl=js.count('function safeClick')
    calls=safe_actual_calls(js)
    print('[before] inline', before_inline)
    print('[before] direct .onclick', before_direct)
    print('[before] safeClick decl', before_decl)
    print('[before] safeClick calls', len(calls))
    if calls:
        fail('safeClick actual calls remain: '+str(calls[:5]))
    if before_decl!=1:
        fail(f'expected exactly one safeClick declaration, found {before_decl}')
    if SAFE_DECL not in js:
        fail('safeClick declaration block did not match expected string')
    patched=js.replace(SAFE_DECL,'',1)
    MAIN.write_text(patched,encoding='utf-8')
    index2=INDEX.read_text(encoding='utf-8')
    js2=MAIN.read_text(encoding='utf-8')
    after_inline=inline_count(index2,js2)
    after_direct=direct_count(js2)
    after_decl=js2.count('function safeClick')
    after_calls=safe_actual_calls(js2)
    print('[after] inline', after_inline)
    print('[after] direct .onclick', after_direct)
    print('[after] safeClick decl', after_decl)
    print('[after] safeClick calls', len(after_calls))
    if after_decl!=0: fail(f'safeClick declaration remains: {after_decl}')
    if after_calls: fail('safeClick actual calls remain after removal')
    if after_inline!=0: fail(f'inline onclick must remain 0, found {after_inline}')
    if after_direct != before_direct-1:
        fail(f'direct .onclick should decrease by 1, before={before_direct}, after={after_direct}')
    for p in PRESERVE:
        if js2.count(p)!=1: fail(f'preserved binding invalid: {p}={js2.count(p)}')
    node_check()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-13 Remove safeClick\n\n'
        '작성일: 2026-05-15\n\n'
        '## 결과\n\n'
        '- 실제 호출이 0개인 `safeClick` 함수 선언을 제거했다.\n'
        '- `safeOn` / `_bindSafe`는 유지했다.\n'
        '- 기존 Step 2-8~2-12 이벤트 바인딩은 유지했다.\n\n'
        '## 검증\n\n'
        f'- 제거 전 `function safeClick` 선언 수: {before_decl}\n'
        f'- 제거 후 `function safeClick` 선언 수: {after_decl}\n'
        f'- 제거 전 실제 `safeClick(...)` 호출 수: {len(calls)}\n'
        f'- 제거 후 실제 `safeClick(...)` 호출 수: {len(after_calls)}\n'
        f'- inline onclick: {after_inline}\n'
        f'- `.onclick =` 직접 대입 수: {before_direct} → {after_direct}\n'
        '- `node --check js/main.js` 통과\n\n'
        '## 브라우저 확인 필요\n\n'
        '1. 통계 정보 토스트 클릭\n'
        '2. 설정/쿠폰/교환/PIN/저장/사운드/오프라인 수익 이벤트\n'
        '3. 지역 확장 모달 이벤트\n',
        encoding='utf-8')
    print('[OK] Step 2-13 completed')

if __name__=='__main__': main()
