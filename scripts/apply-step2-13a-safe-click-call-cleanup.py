#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-13a-safe-click-call-cleanup.md')

REPLACEMENTS = [
    (
'''safeClick("openSettings", ()=>{
  unlockAudioOnce(); startBGM();
  modalSettings?.classList.add("on");
});''',
'''safeOn(document.getElementById("openSettings"), "click", ()=>{
  unlockAudioOnce(); startBGM();
  modalSettings?.classList.add("on");
});'''
    ),
    (
'''safeClick("openStats", ()=>{
  unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  const modal = document.getElementById("modalStats");
  if(modal) {
    modal.classList.add("on");
    updateStatsUI(); // 👈 여기서 한 번만 호출!
  }
});''',
'''safeOn(document.getElementById("openStats"), "click", ()=>{
  unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  const modal = document.getElementById("modalStats");
  if(modal) {
    modal.classList.add("on");
    updateStatsUI(); // 👈 여기서 한 번만 호출!
  }
});'''
    ),
    (
'''safeClick("closeStats", ()=>{
  document.getElementById("modalStats")?.classList.remove("on");
});''',
'''safeOn(document.getElementById("closeStats"), "click", ()=>{
  document.getElementById("modalStats")?.classList.remove("on");
});'''
    ),
]

PRESERVE = [
    'function safeClick',
    'function safeOn',
    'function _bindSafe',
    'openMapBtn.addEventListener("click"',
    'mapGoBtn.addEventListener("click"',
    'mapUnlockBtn.addEventListener("click"',
    'closeExpansionModalBtn.addEventListener("click"',
]

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def count_inline(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))

def main():
    if not MAIN.exists():
        fail('js/main.js missing')
    if not INDEX.exists():
        fail('index.html missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before = {
        'safeClick_openSettings': js.count('safeClick("openSettings"'),
        'safeClick_openStats': js.count('safeClick("openStats"'),
        'safeClick_closeStats': js.count('safeClick("closeStats"'),
        'safeClick_decl': js.count('function safeClick'),
        'inline_onclick': count_inline(index, js),
    }

    if before['safeClick_decl'] != 1:
        fail(f'function safeClick must remain exactly 1 before Step 2-13A, found {before["safeClick_decl"]}')
    if before['inline_onclick'] != 0:
        fail(f'inline onclick must be 0 before Step 2-13A, found {before["inline_onclick"]}')

    patched = js
    for old, new in REPLACEMENTS:
        if patched.count(old) != 1:
            fail('expected replacement block not found exactly once:\n' + old[:120])
        patched = patched.replace(old, new, 1)

    MAIN.write_text(patched, encoding='utf-8')

    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')
    after = {
        'safeClick_openSettings': js2.count('safeClick("openSettings"'),
        'safeClick_openStats': js2.count('safeClick("openStats"'),
        'safeClick_closeStats': js2.count('safeClick("closeStats"'),
        'safeOn_openSettings': js2.count('safeOn(document.getElementById("openSettings"), "click"'),
        'safeOn_openStats': js2.count('safeOn(document.getElementById("openStats"), "click"'),
        'safeOn_closeStats': js2.count('safeOn(document.getElementById("closeStats"), "click"'),
        'safeClick_decl': js2.count('function safeClick'),
        'inline_onclick': count_inline(index2, js2),
    }

    checks = [
        after['safeClick_openSettings'] == 0,
        after['safeClick_openStats'] == 0,
        after['safeClick_closeStats'] == 0,
        after['safeOn_openSettings'] == 1,
        after['safeOn_openStats'] == 1,
        after['safeOn_closeStats'] == 1,
        after['safeClick_decl'] == 1,
        after['inline_onclick'] == 0,
    ]
    if not all(checks):
        fail(f'validation failed: {after}')

    for token in PRESERVE:
        if js2.count(token) < 1:
            fail(f'preserved token missing: {token}')

    subprocess.run(['node', '--check', str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-13A safeClick 호출 전환 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `safeClick("openSettings", ...)`를 `safeOn(document.getElementById("openSettings"), "click", ...)`로 전환했다.\n'
        '- `safeClick("openStats", ...)`를 `safeOn(document.getElementById("openStats"), "click", ...)`로 전환했다.\n'
        '- `safeClick("closeStats", ...)`를 `safeOn(document.getElementById("closeStats"), "click", ...)`로 전환했다.\n'
        '- `function safeClick` 선언은 Step 2-13A에서는 유지했다.\n\n'
        '## 전환 전\n\n'
        f'- safeClick("openSettings": {before["safeClick_openSettings"]}\n'
        f'- safeClick("openStats": {before["safeClick_openStats"]}\n'
        f'- safeClick("closeStats": {before["safeClick_closeStats"]}\n'
        f'- function safeClick 선언: {before["safeClick_decl"]}\n'
        f'- inline onclick: {before["inline_onclick"]}\n\n'
        '## 전환 후\n\n'
        f'- safeClick("openSettings": {after["safeClick_openSettings"]}\n'
        f'- safeClick("openStats": {after["safeClick_openStats"]}\n'
        f'- safeClick("closeStats": {after["safeClick_closeStats"]}\n'
        f'- safeOn openSettings: {after["safeOn_openSettings"]}\n'
        f'- safeOn openStats: {after["safeOn_openStats"]}\n'
        f'- safeOn closeStats: {after["safeOn_closeStats"]}\n'
        f'- function safeClick 선언: {after["safeClick_decl"]}\n'
        f'- inline onclick: {after["inline_onclick"]}\n'
        '- node --check js/main.js 통과\n\n'
        '## 다음 단계\n\n'
        'Step 2-13B에서 전체 `safeClick(` 실제 호출이 0개인지 재확인한 뒤 `function safeClick` 선언을 제거한다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-13A completed')

if __name__ == '__main__':
    main()
