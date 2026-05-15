#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-15a-lvlpill-click-cleanup.md')

OLD = 'if(lvlPill) lvlPill.onclick = ()=>{ const mul = (1 + ((Number(state.level)||0)*0.10)); showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`); };'
NEW = '''if(lvlPill){
    lvlPill.addEventListener("click", ()=>{
      const mul = (1 + ((Number(state.level)||0)*0.10));
      showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`);
    });
  }'''

PRESERVE = [
    'function safeOn',
    'function _bindSafe',
    'safeOn(document.getElementById("openSettings"), "click"',
    'safeOn(document.getElementById("openStats"), "click"',
    'safeOn(document.getElementById("closeStats"), "click"',
    'openMapBtn.addEventListener("click"',
    'mapGoBtn.addEventListener("click"',
    'mapUnlockBtn.addEventListener("click"',
    'closeExpansionModalBtn.addEventListener("click"',
]

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before_direct = direct_count(js)
    before_inline = inline_count(index, js)
    before_old = js.count(OLD)
    before_new = js.count('lvlPill.addEventListener("click"')

    if before_inline != 0:
        fail(f'inline onclick must be 0 before Step 2-15A, found {before_inline}')
    if js.count('function safeClick') != 0:
        fail('function safeClick must stay removed')
    if any('safeClick(' in line and not line.strip().startswith('function safeClick') for line in js.splitlines()):
        fail('safeClick actual call must stay 0')
    if before_old != 1:
        fail(f'expected lvlPill.onclick target exactly 1, found {before_old}')
    if before_new != 0:
        fail(f'lvlPill.addEventListener already exists: {before_new}')

    patched = js.replace(OLD, NEW, 1)
    MAIN.write_text(patched, encoding='utf-8')

    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')
    after_direct = direct_count(js2)
    after_inline = inline_count(index2, js2)
    after_old = js2.count('lvlPill.onclick')
    after_new = js2.count('lvlPill.addEventListener("click"')

    if after_old != 0:
        fail(f'lvlPill.onclick still remains: {after_old}')
    if after_new != 1:
        fail(f'lvlPill.addEventListener count invalid: {after_new}')
    if after_direct != before_direct - 1:
        fail(f'direct .onclick count should decrease by 1, before={before_direct}, after={after_direct}')
    if after_inline != 0:
        fail(f'inline onclick must remain 0, found {after_inline}')
    if js2.count('function safeClick') != 0:
        fail('function safeClick reappeared')
    if any('safeClick(' in line and not line.strip().startswith('function safeClick') for line in js2.splitlines()):
        fail('safeClick actual call reappeared')

    for token in PRESERVE:
        if js2.count(token) != 1:
            fail(f'preserved token invalid: {token}={js2.count(token)}')

    subprocess.run(['node', '--check', str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-15A lvlPill onclick 전환 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `lvlPill.onclick` 1개를 `lvlPill.addEventListener("click", ...)` 방식으로 전환했다.\n'
        '- 레벨 pill 클릭 시 매장 레벨 효과 토스트를 보여주는 기존 기능은 유지했다.\n\n'
        '## 검증 결과\n\n'
        f'- 전환 전 `.onclick =` 직접 대입 수: {before_direct}\n'
        f'- 전환 후 `.onclick =` 직접 대입 수: {after_direct}\n'
        f'- `lvlPill.onclick`: {after_old}\n'
        f'- `lvlPill.addEventListener("click"`: {after_new}\n'
        f'- inline onclick: {after_inline}\n'
        '- function safeClick: 0\n'
        '- safeClick 실제 호출: 0\n'
        '- 기존 Step 2-8~2-13B 이벤트 유지\n'
        '- node --check js/main.js 통과\n\n'
        '## 남은 리스크\n\n'
        '- `.onclick =` 직접 대입은 6개 남아 있다.\n'
        '- 남은 6개는 동적 생성 버튼/게임 액션이므로 이벤트 위임 설계 후 전환해야 한다.\n'
        '- 브라우저에서 레벨 pill 토스트 표시를 실제 확인해야 한다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-15A completed')
    print('before_direct', before_direct)
    print('after_direct', after_direct)

if __name__ == '__main__':
    main()
