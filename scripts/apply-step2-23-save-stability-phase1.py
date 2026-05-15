#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-23-save-stability-phase1.md')

OLD_SAVE = '''let _saveDirty = false;
let _lastSaveWriteAt = 0;
function save(force=false){
  // localStorage는 동기식이라 자주 쓰면 렉 유발.
  // force=false는 '저장 필요'만 표시하고 실제 write는 autosave/종료 시에만 수행.
  if(!force){ _saveDirty = true; return; }
  state.lastSeenAt = Date.now();
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  _saveDirty = false;
  _lastSaveWriteAt = Date.now();
}
function saveGame(){
  return save(true);
}
'''

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

OLD_FORCE = '''  if(forceSaveBtn){
    forceSaveBtn.addEventListener("click", ()=>{ save(true); showToast("저장 완료"); });
  }
'''

NEW_FORCE = '''  if(forceSaveBtn){
    forceSaveBtn.addEventListener("click", ()=>{
      const ok = save(true);
      showToast(ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.");
    });
  }
'''

INIT_ANCHOR = '''  initDOMRefs();
'''
INIT_CALL = '''  bindSaveLifecycleEvents();
'''


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def count_actual_safe_click(js):
    return sum(1 for line in js.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick'))


def count_inline_onclick(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before = {
        'save_fn': js.count('function save(force=false)'),
        'save_game': js.count('function saveGame()'),
        'old_save': js.count(OLD_SAVE),
        'old_force': js.count(OLD_FORCE),
        'pagehide': js.count('window.addEventListener("pagehide"'),
        'visibilitychange': js.count('document.addEventListener("visibilitychange"'),
        'beforeunload': js.count('window.addEventListener("beforeunload"'),
        'bind_lifecycle': js.count('function bindSaveLifecycleEvents()'),
        'init_dom_refs': js.count(INIT_ANCHOR),
        'inline_onclick': count_inline_onclick(index, js),
        'direct_onclick': len(re.findall(r'\.onclick\s*=', js)),
        'safe_click_fn': js.count('function safeClick'),
        'safe_click_actual': count_actual_safe_click(js),
    }

    if before['save_fn'] != 1:
        fail(f'expected one save function before patch, found {before["save_fn"]}')
    if before['save_game'] != 1:
        fail(f'expected saveGame alias once before patch, found {before["save_game"]}')
    if before['old_save'] != 1:
        fail(f'expected old save block exactly 1, found {before["old_save"]}')
    if before['old_force'] != 1:
        fail(f'expected old forceSave handler exactly 1, found {before["old_force"]}')
    if before['pagehide'] != 0 or before['visibilitychange'] != 0 or before['beforeunload'] != 0:
        fail(f'save lifecycle handlers already exist: {before}')
    if before['bind_lifecycle'] != 0:
        fail('bindSaveLifecycleEvents already exists')
    if before['init_dom_refs'] < 1:
        fail('initDOMRefs call anchor not found')
    if before['inline_onclick'] != 0:
        fail(f'inline onclick must remain 0 before patch, found {before["inline_onclick"]}')
    if before['direct_onclick'] != 0:
        fail(f'.onclick direct assignments must remain 0 before patch, found {before["direct_onclick"]}')
    if before['safe_click_fn'] != 0 or before['safe_click_actual'] != 0:
        fail(f'safeClick must remain removed before patch: {before}')

    patched = js.replace(OLD_SAVE, NEW_SAVE, 1)
    patched = patched.replace(OLD_FORCE, NEW_FORCE, 1)
    # Bind lifecycle after DOM refs are initialized in boot flow; insert only at first initDOMRefs call.
    patched = patched.replace(INIT_ANCHOR, INIT_ANCHOR + INIT_CALL, 1)

    MAIN.write_text(patched, encoding='utf-8')
    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')

    after = {
        'save_fn': js2.count('function save(force=false)'),
        'save_return_true_dirty': js2.count('if(!force){ _saveDirty = true; return true; }'),
        'console_error': js2.count('console.error("[save] failed", e);'),
        'save_game': js2.count('function saveGame()'),
        'bind_lifecycle': js2.count('function bindSaveLifecycleEvents()'),
        'pagehide': js2.count('window.addEventListener("pagehide"'),
        'visibilitychange': js2.count('document.addEventListener("visibilitychange"'),
        'beforeunload': js2.count('window.addEventListener("beforeunload"'),
        'bind_call': js2.count('bindSaveLifecycleEvents();'),
        'force_handler': js2.count('const ok = save(true);'),
        'save_failed_toast': js2.count('저장 실패! 브라우저 저장 공간을 확인하세요.'),
        'inline_onclick': count_inline_onclick(index2, js2),
        'direct_onclick': len(re.findall(r'\.onclick\s*=', js2)),
        'safe_click_fn': js2.count('function safeClick'),
        'safe_click_actual': count_actual_safe_click(js2),
    }

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

    subprocess.run(['node', '--check', str(MAIN)], check=True)

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
    print('[OK] Step 2-23 completed')


if __name__ == '__main__':
    main()
