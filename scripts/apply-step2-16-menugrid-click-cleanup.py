#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-16-menugrid-click-cleanup.md')

OLD_SETUP = '''    const btn = document.createElement("button");
    btn.className = "menuBtn";
    btn.disabled = locked;
'''
NEW_SETUP = '''    const btn = document.createElement("button");
    btn.className = "menuBtn";
    btn.disabled = locked;
    btn.dataset.action = "serve-menu";
    btn.dataset.menuId = m.id;
    btn.dataset.locked = locked ? "1" : "0";
'''

OLD_ONCLICK = '''    btn.onclick = () => {
      applyElementFX(btn);
      unlockAudioOnce(); startBGM();
      sfxTick();
      if (locked) {
        showToast("아직 잠긴 메뉴예요! (업그레이드: 메뉴 확장)");
        return;
      }
      serveByMenu(m.id);
    };

    menuGrid.appendChild(btn);'''
NEW_APPEND = '''    menuGrid.appendChild(btn);'''

INSERT_AFTER = '''function buildMenuGrid(){
  menuGrid.innerHTML = "";

  const openCount = getOpenMenuCount();
'''
SERVE_FUNC = '''function handleMenuGridServe(btn){
  if(!btn) return;
  applyElementFX(btn);
  unlockAudioOnce(); startBGM();
  sfxTick();
  if(btn.dataset.locked === "1" || btn.disabled){
    showToast("아직 잠긴 메뉴예요! (업그레이드: 메뉴 확장)");
    return;
  }
  const menuId = btn.dataset.menuId;
  if(!menuId) return;
  serveByMenu(menuId);
}

'''

INSERT_DELEGATE_BEFORE = '''/* --------------------
   Stage layout helpers
-------------------- */'''
DELEGATE = '''const menuGridEl = document.getElementById("menuGrid");
if(menuGridEl){
  menuGridEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="serve-menu"]');
    if(!btn || !menuGridEl.contains(btn)) return;
    e.preventDefault();
    handleMenuGridServe(btn);
  });
}

'''

PRESERVE = [
  'function safeOn',
  'function _bindSafe',
  'function researchMenu(menuId)',
  'rndListEl.addEventListener("click"',
  'lvlPill.addEventListener("click"',
]

def fail(msg):
  print('[FAIL]', msg, file=sys.stderr)
  sys.exit(1)

def inline_count(index, js):
  return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))

def direct_count(js):
  return len(re.findall(r'\.onclick\s*=', js))

def main():
  if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
  index = INDEX.read_text(encoding='utf-8')
  js = MAIN.read_text(encoding='utf-8')

  before_direct = direct_count(js)
  before_inline = inline_count(index, js)
  before_target = js.count('btn.onclick = () => {')

  if before_inline != 0: fail(f'inline onclick must be 0 before Step 2-16, found {before_inline}')
  if js.count('function safeClick') != 0: fail('function safeClick must stay removed')
  if any('safeClick(' in line and not line.strip().startswith('function safeClick') for line in js.splitlines()): fail('safeClick actual call must stay 0')
  if before_direct != 5: fail(f'expected 5 direct .onclick assignments before Step 2-16, found {before_direct}')
  if before_target != 1: fail(f'expected buildMenuGrid btn.onclick target exactly 1, found {before_target}')
  if OLD_SETUP not in js: fail('menu button setup block not found')
  if OLD_ONCLICK not in js: fail('menu button onclick block not found')
  if js.count('function handleMenuGridServe(btn)') != 0: fail('handleMenuGridServe already exists')
  if js.count('menuGridEl.addEventListener("click"') != 0: fail('menuGrid delegated handler already exists')

  patched = js
  patched = patched.replace(INSERT_AFTER, SERVE_FUNC + INSERT_AFTER, 1)
  patched = patched.replace(OLD_SETUP, NEW_SETUP, 1)
  patched = patched.replace(OLD_ONCLICK, NEW_APPEND, 1)
  patched = patched.replace(INSERT_DELEGATE_BEFORE, DELEGATE + INSERT_DELEGATE_BEFORE, 1)
  MAIN.write_text(patched, encoding='utf-8')

  js2 = MAIN.read_text(encoding='utf-8')
  index2 = INDEX.read_text(encoding='utf-8')
  after_direct = direct_count(js2)
  after_inline = inline_count(index2, js2)
  checks = {
    'btn_onclick_plain': js2.count('btn.onclick = () => {'),
    'data_action_serve_menu': js2.count('btn.dataset.action = "serve-menu"'),
    'data_menu_id': js2.count('btn.dataset.menuId = m.id'),
    'handleMenuGridServe': js2.count('function handleMenuGridServe(btn)'),
    'menuGrid_delegate': js2.count('menuGridEl.addEventListener("click"'),
    'function_safeClick': js2.count('function safeClick'),
    'safeClick_actual': sum(1 for line in js2.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick')),
  }

  if checks['btn_onclick_plain'] != 0: fail(f'menuGrid btn.onclick remains: {checks}')
  if checks['data_action_serve_menu'] != 1: fail(f'serve-menu data action invalid: {checks}')
  if checks['data_menu_id'] != 1: fail(f'menu id dataset invalid: {checks}')
  if checks['handleMenuGridServe'] != 1: fail(f'handleMenuGridServe count invalid: {checks}')
  if checks['menuGrid_delegate'] != 1: fail(f'menuGrid delegated handler count invalid: {checks}')
  if after_direct != before_direct - 1: fail(f'direct .onclick count should decrease by 1, before={before_direct}, after={after_direct}')
  if after_inline != 0: fail(f'inline onclick must remain 0, found {after_inline}')
  if checks['function_safeClick'] != 0 or checks['safeClick_actual'] != 0: fail(f'safeClick must remain removed: {checks}')
  for token in PRESERVE:
    if js2.count(token) != 1: fail(f'preserved token invalid: {token}={js2.count(token)}')

  subprocess.run(['node', '--check', str(MAIN)], check=True)

  REPORT.parent.mkdir(parents=True, exist_ok=True)
  REPORT.write_text(
    '# Step 2-16 menuGrid click 전환 보고\n\n'
    '작성일: 2026-05-15\n\n'
    '## 변경 내용\n\n'
    '- `buildMenuGrid()` 내부 메뉴 서빙 버튼의 `btn.onclick = () =>` 직접 대입을 제거했다.\n'
    '- 메뉴 버튼에 `data-action="serve-menu"`, `data-menu-id`, `data-locked`를 추가했다.\n'
    '- 기존 클릭 로직을 `function handleMenuGridServe(btn)`로 분리했다.\n'
    '- `#menuGrid`에 click 이벤트 위임을 1회 추가했다.\n\n'
    '## 유지한 기능\n\n'
    '- `applyElementFX(btn)`를 실제 클릭 버튼에 적용\n'
    '- `unlockAudioOnce()`, `startBGM()`, `sfxTick()` 호출 유지\n'
    '- 잠긴 메뉴 토스트 처리 유지\n'
    '- `serveByMenu(menuId)` 호출 유지\n\n'
    '## 검증 결과\n\n'
    f'- 전환 전 `.onclick =` 직접 대입 수: {before_direct}\n'
    f'- 전환 후 `.onclick =` 직접 대입 수: {after_direct}\n'
    f'- `btn.onclick = () =>`: {checks["btn_onclick_plain"]}\n'
    f'- `btn.dataset.action = "serve-menu"`: {checks["data_action_serve_menu"]}\n'
    f'- `btn.dataset.menuId = m.id`: {checks["data_menu_id"]}\n'
    f'- `function handleMenuGridServe(btn)`: {checks["handleMenuGridServe"]}\n'
    f'- `menuGridEl.addEventListener("click"`: {checks["menuGrid_delegate"]}\n'
    f'- inline onclick: {after_inline}\n'
    '- function safeClick: 0\n'
    '- safeClick 실제 호출: 0\n'
    '- node --check js/main.js 통과\n\n'
    '## 남은 리스크\n\n'
    '- 브라우저에서 메뉴 서빙 버튼 클릭 테스트가 필요하다.\n'
    '- 잠긴 메뉴는 disabled 상태라 실제 click 이벤트가 발생하지 않을 수 있으나 기존 동작과 동일하다.\n'
    '- `.onclick =` 직접 대입은 4개 남아 있다.\n'
    '- 남은 항목은 업그레이드 구매, 직원 업그레이드 2개, 연구 시작이다.\n',
    encoding='utf-8'
  )
  print('[OK] Step 2-16 completed')
  print('before_direct', before_direct)
  print('after_direct', after_direct)

if __name__ == '__main__': main()
