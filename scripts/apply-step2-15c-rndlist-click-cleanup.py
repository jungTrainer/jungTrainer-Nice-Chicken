#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-15c-rndlist-click-cleanup.md')

OLD_BUTTON = '<button class="rnd-btn" style="pointer-events: auto !important; position: relative; z-index: 2001;">연구 (${fmtNoWon(cost)})</button>'
NEW_BUTTON = '<button class="rnd-btn" data-action="research-menu" data-menu-id="${m.id}" style="pointer-events: auto !important; position: relative; z-index: 2001;">연구 (${fmtNoWon(cost)})</button>'

OLD_ONCLICK = '''    const btn = div.querySelector("button");
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); 
      if(state.money < cost){
        showToast("연구비가 부족해요!");
        if(typeof sfxWrong === "function") sfxWrong();
        return;
      }
      state.money -= cost;
      state.menuLevels[m.id] = lvl + 1;
      _saveDirty = true;
      save(true);
      showToast(`${m.name} 연구 완료!`);
      if(typeof sfxConfirm === "function") sfxConfirm();
      updateUI();
      updateStatsUI(); 
      // 메뉴판 가격 즉시 반영
      if(typeof buildMenuGrid === 'function') buildMenuGrid();
      // 연구 탭 비용/레벨 갱신
      if(typeof renderRndList === 'function') renderRndList();
    };
    list.appendChild(div);'''
NEW_APPEND = '''    list.appendChild(div);'''

INSERT_AFTER = '''function renderRndList(){
  const list = document.getElementById("rndList");
  if(!list) return;
  list.innerHTML = "";

  const openCount = getOpenMenuCount(); 
'''
RESEARCH_FUNC = '''function researchMenu(menuId){
  const m = MENUS.find(x=>x.id === menuId);
  if(!m) return;
  state.menuLevels = state.menuLevels || {};
  const lvl = state.menuLevels?.[m.id] || 0;
  const cost = Math.floor(100000 * Math.pow(1.8, lvl));
  unlockAudioOnce();
  if(state.money < cost){
    showToast("연구비가 부족해요!");
    if(typeof sfxWrong === "function") sfxWrong();
    return;
  }
  state.money -= cost;
  state.menuLevels[m.id] = lvl + 1;
  _saveDirty = true;
  save(true);
  showToast(`${m.name} 연구 완료!`);
  if(typeof sfxConfirm === "function") sfxConfirm();
  updateUI();
  updateStatsUI();
  if(typeof buildMenuGrid === "function") buildMenuGrid();
  if(typeof renderRndList === "function") renderRndList();
}

'''

INSERT_DELEGATE_BEFORE = '''// 탭 전환 (위임)
document.addEventListener("click", (e)=>{'''
DELEGATE = '''const rndListEl = document.getElementById("rndList");
if(rndListEl){
  rndListEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="research-menu"]');
    if(!btn || !rndListEl.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const menuId = btn.dataset.menuId;
    if(!menuId) return;
    researchMenu(menuId);
  });
}

'''

PRESERVE = [
    'function safeOn',
    'function _bindSafe',
    'function renderRndList',
    'safeOn(document.getElementById("openStats"), "click"',
    'safeOn(document.getElementById("closeStats"), "click"',
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
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')
    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before_direct = direct_count(js)
    before_inline = inline_count(index, js)
    before_target = js.count('btn.onclick = (e) =>')

    if before_inline != 0:
        fail(f'inline onclick must be 0 before Step 2-15C, found {before_inline}')
    if js.count('function safeClick') != 0:
        fail('function safeClick must stay removed')
    if any('safeClick(' in line and not line.strip().startswith('function safeClick') for line in js.splitlines()):
        fail('safeClick actual call must stay 0')
    if before_direct != 6:
        fail(f'expected 6 direct .onclick assignments before Step 2-15C, found {before_direct}')
    if before_target != 1:
        fail(f'expected renderRndList btn.onclick target exactly 1, found {before_target}')
    if OLD_BUTTON not in js:
        fail('target rnd button HTML not found')
    if OLD_ONCLICK not in js:
        fail('target rnd onclick block not found')
    if js.count('function researchMenu(menuId)') != 0:
        fail('researchMenu already exists')
    if js.count('rndListEl.addEventListener("click"') != 0:
        fail('rndList delegated click handler already exists')

    patched = js
    patched = patched.replace(INSERT_AFTER, RESEARCH_FUNC + INSERT_AFTER, 1)
    patched = patched.replace(OLD_BUTTON, NEW_BUTTON, 1)
    patched = patched.replace(OLD_ONCLICK, NEW_APPEND, 1)
    patched = patched.replace(INSERT_DELEGATE_BEFORE, DELEGATE + INSERT_DELEGATE_BEFORE, 1)

    MAIN.write_text(patched, encoding='utf-8')
    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')

    after_direct = direct_count(js2)
    after_inline = inline_count(index2, js2)

    checks = {
        'btn_onclick_e': js2.count('btn.onclick = (e) =>'),
        'data_action_research_menu': js2.count('data-action="research-menu"'),
        'data_menu_id': js2.count('data-menu-id="${m.id}"'),
        'researchMenu': js2.count('function researchMenu(menuId)'),
        'rndList_delegate': js2.count('rndListEl.addEventListener("click"'),
        'function_safeClick': js2.count('function safeClick'),
        'safeClick_actual': sum(1 for line in js2.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick')),
    }

    if checks['btn_onclick_e'] != 0:
        fail(f'renderRndList btn.onclick remains: {checks}')
    if checks['data_action_research_menu'] < 1:
        fail('data-action research-menu missing')
    if checks['data_menu_id'] != 1:
        fail(f'data-menu-id count invalid: {checks["data_menu_id"]}')
    if checks['researchMenu'] != 1:
        fail(f'researchMenu count invalid: {checks["researchMenu"]}')
    if checks['rndList_delegate'] != 1:
        fail(f'rndList delegate count invalid: {checks["rndList_delegate"]}')
    if after_direct != before_direct - 1:
        fail(f'direct .onclick count should decrease by 1, before={before_direct}, after={after_direct}')
    if after_inline != 0:
        fail(f'inline onclick must remain 0, found {after_inline}')
    if checks['function_safeClick'] != 0 or checks['safeClick_actual'] != 0:
        fail(f'safeClick must remain removed: {checks}')
    for token in PRESERVE:
        if js2.count(token) != 1:
            fail(f'preserved token invalid: {token}={js2.count(token)}')

    subprocess.run(['node', '--check', str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-15C renderRndList click 전환 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `renderRndList()` 내부 메뉴 연구 버튼의 `btn.onclick = (e) =>` 직접 대입을 제거했다.\n'
        '- 연구 버튼에 `data-action="research-menu"`, `data-menu-id="${m.id}"`를 추가했다.\n'
        '- 기존 클릭 로직을 `function researchMenu(menuId)`로 분리했다.\n'
        '- `#rndList`에 click 이벤트 위임을 1회 추가했다.\n\n'
        '## 유지한 기능\n\n'
        '- 연구비 부족 처리\n'
        '- `state.money` 차감\n'
        '- `state.menuLevels[m.id]` 증가\n'
        '- `save(true)` 호출\n'
        '- `showToast`, `sfxConfirm` 호출\n'
        '- `updateUI`, `updateStatsUI`, `buildMenuGrid`, `renderRndList` 호출\n\n'
        '## 검증 결과\n\n'
        f'- 전환 전 `.onclick =` 직접 대입 수: {before_direct}\n'
        f'- 전환 후 `.onclick =` 직접 대입 수: {after_direct}\n'
        f'- `btn.onclick = (e) =>`: {checks["btn_onclick_e"]}\n'
        f'- `data-action="research-menu"`: {checks["data_action_research_menu"]}\n'
        f'- `data-menu-id="${{m.id}}"`: {checks["data_menu_id"]}\n'
        f'- `function researchMenu(menuId)`: {checks["researchMenu"]}\n'
        f'- `rndListEl.addEventListener("click"`: {checks["rndList_delegate"]}\n'
        f'- inline onclick: {after_inline}\n'
        '- function safeClick: 0\n'
        '- safeClick 실제 호출: 0\n'
        '- node --check js/main.js 통과\n\n'
        '## 남은 리스크\n\n'
        '- 브라우저에서 메뉴 연구 버튼 클릭 테스트가 필요하다.\n'
        '- `.onclick =` 직접 대입은 5개 남아 있다.\n'
        '- 남은 항목은 메뉴 서빙, 업그레이드 구매, 직원 업그레이드, 연구 시작으로 모두 게임 상태 변경 기능이다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-15C completed')
    print('before_direct', before_direct)
    print('after_direct', after_direct)


if __name__ == '__main__':
    main()
