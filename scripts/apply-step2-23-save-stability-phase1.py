#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-23-save-stability-phase1.md')

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

NEW_FORCE = '''  if(forceSaveBtn){
    forceSaveBtn.addEventListener("click", ()=>{
      const ok = save(true);
      showToast(ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.");
    });
  }'''

LEGACY_BEFOREUNLOAD_RE = re.compile(
    r'''\n// Force-save on exit\s*\nwindow\.addEventListener\("beforeunload",\s*\(\)\s*=>\s*\{\s*try\{\s*save\(true\);\s*\}catch\(e\)\{\}\s*\}\);\s*\n'''
)
INIT_ANCHOR_RE = re.compile(r'''(^[ \t]*initDOMRefs\(\);\s*$)''', re.M)


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def func_decl_count(text, name):
    return len(re.findall(rf'\bfunction\s+{re.escape(name)}\s*\(', text))


def find_function_block(js, name):
    m = re.search(rf'\bfunction\s+{re.escape(name)}\s*\(', js)
    if not m:
        return None
    start = m.start()
    brace = js.find('{', m.end())
    if brace < 0:
        fail(f'opening brace not found for {name}')
    depth = 0
    i = brace
    in_str = None
    esc = False
    in_line_comment = False
    in_block_comment = False
    while i < len(js):
        ch = js[i]
        nxt = js[i+1] if i + 1 < len(js) else ''
        if in_line_comment:
            if ch == '\n': in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if ch == '*' and nxt == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_str:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == in_str: in_str = None
            i += 1
            continue
        if ch == '/' and nxt == '/':
            in_line_comment = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            in_block_comment = True
            i += 2
            continue
        if ch in ('"', "'", '`'):
            in_str = ch
            i += 1
            continue
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(js) and js[end] == ';': end += 1
                if end < len(js) and js[end] == '\n': end += 1
                return start, end, js[start:end]
        i += 1
    fail(f'function block not closed for {name}')


def count_actual_safe_click(js):
    return sum(1 for line in js.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick'))


def count_inline_onclick(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def count_direct_onclick(js):
    return len(re.findall(r'\.onclick\s*=', js))


def collect(js, index):
    return {
        'save_fn': func_decl_count(js, 'save'),
        'save_return_true_dirty': js.count('if(!force){ _saveDirty = true; return true; }'),
        'console_error': js.count('console.error("[save] failed", e);'),
        'save_game': func_decl_count(js, 'saveGame'),
        'bind_lifecycle': func_decl_count(js, 'bindSaveLifecycleEvents'),
        'pagehide': js.count('window.addEventListener("pagehide"'),
        'visibilitychange': js.count('document.addEventListener("visibilitychange"'),
        'beforeunload': js.count('window.addEventListener("beforeunload"'),
        'bind_call': js.count('bindSaveLifecycleEvents();'),
        'force_handler': js.count('const ok = save(true);'),
        'save_failed_toast': js.count('저장 실패! 브라우저 저장 공간을 확인하세요.'),
        'inline_onclick': count_inline_onclick(index, js),
        'direct_onclick': count_direct_onclick(js),
        'safe_click_fn': func_decl_count(js, 'safeClick'),
        'safe_click_actual': count_actual_safe_click(js),
    }


def verify(after):
    if after['save_fn'] != 1: fail(f'save function count invalid: {after}')
    if after['save_return_true_dirty'] != 1: fail(f'save(false) true return missing: {after}')
    if after['console_error'] != 1: fail(f'save failure console.error missing: {after}')
    if after['save_game'] != 1: fail(f'saveGame alias invalid: {after}')
    if after['bind_lifecycle'] != 1: fail(f'bindSaveLifecycleEvents invalid: {after}')
    if after['pagehide'] != 1 or after['visibilitychange'] != 1 or after['beforeunload'] != 1:
        fail(f'lifecycle handler counts invalid: {after}')
    if after['bind_call'] != 1: fail(f'bindSaveLifecycleEvents call invalid: {after}')
    if after['force_handler'] != 1 or after['save_failed_toast'] != 1:
        fail(f'force save handler not updated: {after}')
    if after['inline_onclick'] != 0: fail(f'inline onclick must remain 0, found {after["inline_onclick"]}')
    if after['direct_onclick'] != 0: fail(f'.onclick direct assignments must remain 0, found {after["direct_onclick"]}')
    if after['safe_click_fn'] != 0 or after['safe_click_actual'] != 0:
        fail(f'safeClick must remain removed: {after}')


def already_applied(js):
    return (
        func_decl_count(js, 'save') == 1 and
        js.count('if(!force){ _saveDirty = true; return true; }') == 1 and
        js.count('console.error("[save] failed", e);') == 1 and
        func_decl_count(js, 'bindSaveLifecycleEvents') == 1 and
        js.count('window.addEventListener("pagehide"') == 1 and
        js.count('document.addEventListener("visibilitychange"') == 1 and
        js.count('window.addEventListener("beforeunload"') == 1 and
        js.count('const ok = save(true);') == 1 and
        js.count('저장 실패! 브라우저 저장 공간을 확인하세요.') == 1
    )


def find_force_block(js):
    needle = 'if(forceSaveBtn){'
    start = js.find(needle)
    if start < 0:
        return None
    # Find block by brace matching from if opening brace.
    brace = js.find('{', start)
    depth = 0
    i = brace
    while i < len(js):
        if js[i] == '{': depth += 1
        elif js[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(js) and js[end] == '\n': end += 1
                block = js[start:end]
                if 'forceSaveBtn.addEventListener("click"' in block and 'save(true)' in block:
                    return start, end, block
                return None
        i += 1
    return None


def find_save_region(js):
    dirty = re.search(r'\blet\s+_saveDirty\s*=\s*false\s*;\s*\n\s*let\s+_lastSaveWriteAt\s*=\s*0\s*;\s*\n', js)
    if not dirty:
        fail('save dirty variable block not found')
    save_block = find_function_block(js, 'save')
    save_game_block = find_function_block(js, 'saveGame')
    if not save_block or not save_game_block:
        fail('save or saveGame function block not found')
    if not (dirty.start() <= save_block[0] < save_game_block[0]):
        fail('unexpected save/saveGame order')
    if 'localStorage.setItem(SAVE_KEY, JSON.stringify(state))' not in save_block[2]:
        fail('save function does not contain expected localStorage.setItem')
    return dirty.start(), save_game_block[1]


def write_report(after, legacy_removed):
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
        '- 저장 훅은 `bindSaveLifecycleEvents()`에서 1회만 바인딩된다.\n'
        f'- 기존 legacy beforeunload 훅 제거 여부: {legacy_removed}\n\n'
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


def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')
    before = collect(js, index)

    if before['inline_onclick'] != 0: fail(f'inline onclick must remain 0 before patch, found {before["inline_onclick"]}')
    if before['direct_onclick'] != 0: fail(f'.onclick direct assignments must remain 0 before patch, found {before["direct_onclick"]}')
    if before['safe_click_fn'] != 0 or before['safe_click_actual'] != 0: fail(f'safeClick must remain removed before patch: {before}')

    if already_applied(js):
        after = collect(js, index)
        verify(after)
        subprocess.run(['node', '--check', str(MAIN)], check=True)
        write_report(after, legacy_removed='already applied')
        print('[OK] Step 2-23 already applied')
        return

    if before['save_fn'] != 1: fail(f'expected one save function before patch, found {before["save_fn"]}')
    if before['save_game'] != 1: fail(f'expected saveGame alias once before patch, found {before["save_game"]}')
    if before['bind_lifecycle'] != 0: fail('bindSaveLifecycleEvents already exists but full patch not detected')
    if before['pagehide'] != 0 or before['visibilitychange'] != 0: fail(f'unexpected pagehide/visibilitychange handlers before patch: {before}')
    if before['beforeunload'] not in (0, 1): fail(f'unexpected beforeunload handler count before patch: {before}')

    legacy_beforeunload_removed = False
    if before['beforeunload'] == 1:
        js2, removed = LEGACY_BEFOREUNLOAD_RE.subn('\n', js, count=1)
        if removed != 1: fail('legacy beforeunload exists but could not be removed safely')
        js = js2
        legacy_beforeunload_removed = True

    save_start, save_end = find_save_region(js)
    force_block = find_force_block(js)
    if not force_block: fail('expected old forceSave handler exactly 1, found 0')
    init_matches = list(INIT_ANCHOR_RE.finditer(js))
    if len(init_matches) < 1: fail('initDOMRefs call anchor not found')

    patched = js[:save_start] + NEW_SAVE + js[save_end:]
    force_block = find_force_block(patched)
    if not force_block: fail('forceSave handler not found after save patch')
    patched = patched[:force_block[0]] + NEW_FORCE + patched[force_block[1]:]
    patched = INIT_ANCHOR_RE.sub(lambda m: m.group(1) + '\n' + '  bindSaveLifecycleEvents();', patched, count=1)

    MAIN.write_text(patched, encoding='utf-8')
    js_after = MAIN.read_text(encoding='utf-8')
    index_after = INDEX.read_text(encoding='utf-8')
    after = collect(js_after, index_after)
    verify(after)
    subprocess.run(['node', '--check', str(MAIN)], check=True)
    write_report(after, legacy_removed=str(legacy_beforeunload_removed))
    print('[OK] Step 2-23 completed')


if __name__ == '__main__':
    main()
