#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-13b-remove-safe-click-helper.md')
SAFE_DECL = 'function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }\n'

PRESERVE = [
    'function safeOn',
    'function _bindSafe',
    'openMapBtn.addEventListener("click"',
    'mapGoBtn.addEventListener("click"',
    'mapUnlockBtn.addEventListener("click"',
    'closeExpansionModalBtn.addEventListener("click"',
    'closeSettingsBtn.addEventListener("click"',
    'closeCouponsBtn.addEventListener("click"',
    'closeExchangeBtn.addEventListener("click"',
    'pinCancelBtn.addEventListener("click"',
    'pinOkBtn.addEventListener("click"',
    'openCouponsBtn.addEventListener("click"',
    'openExchangeBtn.addEventListener("click"',
    'clearLogBtn.addEventListener("click"',
    'useDrinkCouponBtn.addEventListener("click"',
    'useVegCouponBtn.addEventListener("click"',
    'doExchangeBtn.addEventListener("click"',
    'useCertDrinkBtn.addEventListener("click"',
    'makeCardBtn.addEventListener("click"',
    'forceSaveBtn.addEventListener("click"',
    'resetAllBtn.addEventListener("click"',
    'toggleSoundBtn.addEventListener("click"',
    'saveNameBtn.addEventListener("click"',
    'claimOfflineBtn.addEventListener("click"',
    'safeOn(document.getElementById("statMoney"), "click"',
    'safeOn(document.getElementById("statRep"), "click"',
    'safeOn(document.getElementById("statLvl"), "click"',
    'safeOn(document.getElementById("statToday"), "click"',
    'safeOn(document.getElementById("statTotal"), "click"',
    'safeOn(document.getElementById("openSettings"), "click"',
    'safeOn(document.getElementById("openStats"), "click"',
    'safeOn(document.getElementById("closeStats"), "click"',
]


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def count_inline(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def count_direct(js):
    return len(re.findall(r'\.onclick\s*=', js))


def actual_safe_click_calls(js):
    calls = []
    for line in js.splitlines():
        stripped = line.strip()
        if 'safeClick(' in stripped and not stripped.startswith('function safeClick'):
            calls.append(stripped)
    return calls


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before_decl = js.count('function safeClick')
    before_calls = actual_safe_click_calls(js)
    before_inline = count_inline(index, js)
    before_direct = count_direct(js)

    print('[before] function safeClick', before_decl)
    print('[before] safeClick actual calls', len(before_calls))
    print('[before] inline onclick', before_inline)
    print('[before] direct .onclick', before_direct)

    if before_calls:
        fail('safeClick actual calls remain: ' + repr(before_calls[:10]))
    if before_decl != 1:
        fail(f'expected one function safeClick declaration, found {before_decl}')
    if SAFE_DECL not in js:
        fail('safeClick declaration block did not match expected one-line form')
    if before_inline != 0:
        fail(f'inline onclick must be 0 before removal, found {before_inline}')

    patched = js.replace(SAFE_DECL, '', 1)
    MAIN.write_text(patched, encoding='utf-8')

    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')

    after_decl = js2.count('function safeClick')
    after_calls = actual_safe_click_calls(js2)
    after_inline = count_inline(index2, js2)
    after_direct = count_direct(js2)

    print('[after] function safeClick', after_decl)
    print('[after] safeClick actual calls', len(after_calls))
    print('[after] inline onclick', after_inline)
    print('[after] direct .onclick', after_direct)

    if after_decl != 0:
        fail(f'function safeClick still remains: {after_decl}')
    if after_calls:
        fail('safeClick actual calls remain after removal: ' + repr(after_calls[:10]))
    if after_inline != 0:
        fail(f'inline onclick must remain 0, found {after_inline}')
    if after_direct != before_direct - 1:
        fail(f'direct .onclick count should decrease by 1, before={before_direct}, after={after_direct}')

    for token in PRESERVE:
        count = js2.count(token)
        if count != 1:
            fail(f'preserved event/function count invalid: {token}={count}')

    subprocess.run(['node', '--check', str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-13B safeClick helper 제거 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- 전체 `safeClick(` 실제 호출이 0개임을 재확인했다.\n'
        '- `function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }` 선언 한 줄만 제거했다.\n'
        '- `safeOn`과 `_bindSafe`는 유지했다.\n\n'
        '## 검증 결과\n\n'
        f'- 제거 전 `function safeClick` 선언 수: {before_decl}\n'
        f'- 제거 후 `function safeClick` 선언 수: {after_decl}\n'
        f'- 제거 전 실제 `safeClick(...)` 호출 수: {len(before_calls)}\n'
        f'- 제거 후 실제 `safeClick(...)` 호출 수: {len(after_calls)}\n'
        f'- inline onclick: {after_inline}\n'
        f'- `.onclick =` 직접 대입 수: {before_direct} → {after_direct}\n'
        '- 기존 Step 2-8~2-13A 이벤트 유지\n'
        '- `node --check js/main.js` 통과\n\n'
        '## 브라우저 확인 필요\n\n'
        '1. 설정 열기/닫기\n'
        '2. 통계 모달 열기/닫기\n'
        '3. 쿠폰/교환/PIN/저장/사운드/오프라인 수익 이벤트\n'
        '4. 지역 확장 모달 이벤트\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-13B completed')


if __name__ == '__main__':
    main()
