#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-23-save-stability-phase1.md')

SAVE_BLOCK_RE = re.compile(
    r'''let\s+_saveDirty\s*=\s*false;\s*\n'''
    r'''let\s+_lastSaveWriteAt\s*=\s*0;\s*\n'''
    r'''function\s+save\s*\(\s*force\s*=\s*false\s*\)\s*\{(?P<body>.*?)\n\}\s*\n'''
    r'''function\s+saveGame\s*\(\s*\)\s*\{\s*\n\s*return\s+save\s*\(\s*true\s*\)\s*;\s*\n\}\s*\n''',
    re.S,
)

NEW_SAVE = '''let _saveDirty = false;
let _lastSaveWriteAt = 0;
function save(force=false){
  // localStorage는 동기식이라 자주 쓰면 렉 유발.
  // force=false는 '저장 필요'만 표시하고 실제 write는 autosave/종료 시에만 수행.
  if(!force){ _saveDirty = true; return true; }
  state.lastSeenAt = Date.now();
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    return true;
  }catch(e){
    console.error("[save] failed", e);
    return false;
  }
}
function saveGame(){
  return save(true);
}

function bindSaveLifecycleEvents(){
  if(window.__saveLifecycleEventsBound) return;
  window.__saveLifecycleEventsBound = true;
  window.addEventListener("pagehide", ()=>{ save(true); });
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "hidden") save(true);
  });
  window.addEventListener("beforeunload", ()=>{ save(true); });
}
'''

FORCE_RE = re.compile(
    r'''(?P<indent>^[ \t]*)if\s*\(\s*forceSaveBtn\s*\)\s*\{\s*\n'''
    r'''(?P<body>.*?)'''
    r'''^[ \t]*\}\s*''',
    re.M | re.S,
)

NEW_FORCE = '''  if(forceSaveBtn){
    forceSaveBtn.addEventListener("click", ()=>{
      const ok = save(true);
      showToast(ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.");
    });
  }'''

INIT_ANCHOR_RE = re.compile(r'''(^[ \t]*initDOMRefs\(\);\s*$)''', re.M)
INIT_CALL = '''  bindSaveLifecycleEvents();'''


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def count_actual_safe_click(js):
    return sum(1 for line in js.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick'))


def count_inline_onclick(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def count_direct_onclick(js):
    return len(re.findall(r'\.onclick\s*=', js))


def is_already_applied(js):
    return (
        js.count('function save(force=false)') == 1
        and js.count('if(!force){ _saveDirty = true; return true; }') == 1
        and js.count('console.error("[save] failed", e);') == 1
        and js.count('function bindSaveLifecycleEvents()') == 1
        and js.count('window.addEventListener("pagehide"') == 1
        and js.count('document.addEventListener("visibilitychange"') == 1
        and js.count('window.addEventListener("beforeunload"') == 1
        and js.count('const ok = save(true);') == 1
        and js.count('저장 실패! 브라우저 저장 공간을 확인하세요.') == 1
    )


def find_force_block(js):
    matches = []
    for m in FORCE_RE.finditer(js):
        body = m.group('body')
        if 'forceSaveBtn.addEventListener("click"' in body and 'save(true)' in body:
            matches.append(m)
    return matches


def write_report(after):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-23 저장 안정화 1차 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `save(force=false)`가 boolean을 반환하도록 보강했다.\n'
        '- `save(false)`는 `_saveDirty = true` 설정 후 `true`를 반환한다.\n'
        '- `save(true)`는 localStorage 저장 성공 시 `true`, 실패 시 `false`를 반환한다.\n'
        '- 저장 실패 시 `console.error("[save] failed", e)`를 남긴다.\n'
        '- 강제 저장 버튼은 `save(true)` 결과에 따라 성공/실패 토스트를 다르게 표시한다.\n'
        '- `pagehide`, `visibilitychange`, `beforeunload` 저장 훅을 추가했다.\n'
        '- 저장 훅은 `bindSaveLifecycleEvents()`에서 1회만 바인딩된다.\n\n'
        '## 유지한 내용\n\n'
        '- 기존 `save(false)` dirty flag 구조 유지\n'
        '- 기존 autosave 흐름 유지\n'
        '- 기존 `saveGame()` alias 유지\n'
        '- 기존 `load()` 흐름 유지\n'
        '- 백업 키/export/import는 이번 단계에서 추가하지 않음\n\n'
        '## 검증 결과\n\n'
        f'- `function save(force=false)`: {after["save_fn"]}\n'
        f'- `save(false)` true 반환 흐름: {after["save_return_true_dirty"]}\n'
        f'- 저장 실패 `console.error`: {after["console_error"]}\n'
        f'- `function saveGame()`: {after["save_game"]}\n'
        f'- `function bindSaveLifecycleEvents()`: {after["bind_lifecycle"]}\n'
        f'- `window.addEventListener("pagehide"`: {after["pagehide"]}\n'
        f'- `document.addEventListener("visibilitychange"`: {after["visibilitychange"]}\n'
        f'- `window.addEventListener("beforeunload"`: {after["beforeunload"]}\n'
        f'- 강제 저장 결과 분기: {after["force_handler"]}\n'
        f'- inline onclick: {after["inline_onclick"]}\n'
        f'- `.onclick =` 직접 대입: {after["direct_onclick"]}\n'
        f'- function safeClick: {after["safe_click_fn"]}\n'
        f'- safeClick 실제 호출: {after["safe_click_actual"]}\n'
        '- node --check js/main.js 통과\n\n'
        '## 남은 리스크\n\n'
        '- 브라우저에서 탭 닫기/백그라운드 전환 저장 동작 확인이 필요하다.\n'
        '- localStorage 용량 초과 상황은 실제 브라우저에서 강제 재현 테스트가 필요하다.\n'
        '- 백업 저장 키와 export/import는 아직 없다.\n'
        '- 다음 단계에서 backup key와 복구 흐름을 추가하는 것이 좋다.\n',
        encoding='utf-8'
    )


def collect_after(js, index):
    return {
        'save_fn': js.count('function save(force=false)'),
        'save_return_true_dirty': js.count('if(!force){ _saveDirty = true; return true; }'),
        'console_error': js.count('console.error("[save] failed", e);'),
        'save_game': js.count('function saveGame()'),
        'bind_lifecycle': js.count('function bindSaveLifecycleEvents()'),
        'pagehide': js.count('window.addEventListener("pagehide"'),
        'visibilitychange': js.count('document.addEventListener("visibilitychange"'),
        'beforeunload': js.count('window.addEventListener("beforeunload"'),
        'bind_call': js.count('bindSaveLifecycleEvents();'),
        'force_handler': js.count('const ok = save(true);'),
        'save_failed_toast': js.count('저장 실패! 브라우저 저장 공간을 확인하세요.'),
        'inline_onclick': count_inline_onclick(index, js),
        'direct_onclick': count_direct_onclick(js),
        'safe_click_fn': js.count('function safeClick'),
        'safe_click_actual': count_actual_safe_click(js),
    }


def verify_after(after):
    if after['save_fn'] != 1:
        fail(f'save function count invalid after patch: {after}')
    if after['save_return_true_dirty'] != 1:
        fail(f'save(false) true return missing: {after}')
    if after['console_error'] != 1:
        fail(f'save failure console.error missing: {after}')
    if after['save_game'] != 1:
        fail(f'saveGame alias invalid: {after}')
    if after['bind_lifecycle'] != 1:
        fail(f'bindSaveLifecycleEvents invalid: {after}')
    if after['pagehide'] != 1 or after['visibilitychange'] != 1 or after['beforeunload'] != 1:
        fail(f'lifecycle handler counts invalid: {after}')
    if after['bind_call'] != 1:
        fail(f'bindSaveLifecycleEvents call invalid: {after}')
    if after['force_handler'] != 1 or after['save_failed_toast'] != 1:
        fail(f'force save handler not updated: {after}')
    if after['inline_onclick'] != 0:
        fail(f'inline onclick must remain 0, found {after["inline_onclick"]}')
    if after['direct_onclick'] != 0:
        fail(f'.onclick direct assignments must remain 0, found {after["direct_onclick"]}')
    if after['safe_click_fn'] != 0 or after['safe_click_actual'] != 0:
        fail(f'safeClick must remain removed: {after}')


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before = {
        'save_fn': js.count('function save(force=false)'),
        'save_game': js.count('function saveGame()'),
        'pagehide': js.count('window.addEventListener("pagehide"'),
        'visibilitychange': js.count('document.addEventListener("visibilitychange"'),
        'beforeunload': js.count('window.addEventListener("beforeunload"'),
        'bind_lifecycle': js.count('function bindSaveLifecycleEvents()'),
        'inline_onclick': count_inline_onclick(index, js),
        'direct_onclick': count_direct_onclick(js),
        'safe_click_fn': js.count('function safeClick'),
        'safe_click_actual': count_actual_safe_click(js),
    }

    if before['inline_onclick'] != 0:
        fail(f'inline onclick must remain 0 before patch, found {before["inline_onclick"]}')
    if before['direct_onclick'] != 0:
        fail(f'.onclick direct assignments must remain 0 before patch, found {before["direct_onclick"]}')
    if before['safe_click_fn'] != 0 or before['safe_click_actual'] != 0:
        fail(f'safeClick must remain removed before patch: {before}')

    if is_already_applied(js):
        after = collect_after(js, index)
        verify_after(after)
        subprocess.run(['node', '--check', str(MAIN)], check=True)
        write_report(after)
        print('[OK] Step 2-23 already applied')
        return

    if before['save_fn'] != 1:
        fail(f'expected one save function before patch, found {before["save_fn"]}')
    if before['save_game'] != 1:
        fail(f'expected saveGame alias once before patch, found {before["save_game"]}')
    if before['pagehide'] != 0 or before['visibilitychange'] != 0 or before['beforeunload'] != 0:
        fail(f'save lifecycle handlers already exist but full patch not detected: {before}')
    if before['bind_lifecycle'] != 0:
        fail('bindSaveLifecycleEvents already exists but full patch not detected')

    save_matches = list(SAVE_BLOCK_RE.finditer(js))
    save_matches = [m for m in save_matches if 'localStorage.setItem(SAVE_KEY, JSON.stringify(state))' in m.group('body')]
    if len(save_matches) != 1:
        fail(f'expected old save block exactly 1, found {len(save_matches)}')

    force_matches = find_force_block(js)
    if len(force_matches) != 1:
        fail(f'expected old forceSave handler exactly 1, found {len(force_matches)}')

    init_matches = list(INIT_ANCHOR_RE.finditer(js))
    if len(init_matches) < 1:
        fail('initDOMRefs call anchor not found')

    patched = js
    patched = patched.replace(save_matches[0].group(0), NEW_SAVE, 1)
    patched = patched.replace(force_matches[0].group(0), NEW_FORCE, 1)
    patched = INIT_ANCHOR_RE.sub(lambda m: m.group(1) + '\n' + INIT_CALL, patched, count=1)

    MAIN.write_text(patched, encoding='utf-8')
    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')
    after = collect_after(js2, index2)

    verify_after(after)
    subprocess.run(['node', '--check', str(MAIN)], check=True)
    write_report(after)
    print('[OK] Step 2-23 completed')


if __name__ == '__main__':
    main()
