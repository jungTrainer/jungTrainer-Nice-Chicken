#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-17-upglist-click-cleanup.md')

# The upgrade button block has changed spacing/indentation a few times.
# Match the semantic block instead of relying on one exact multi-line string.
UPG_RE = re.compile(
    r'''(?P<indent>^[ \t]*)div\.querySelector\(["']button["']\)\.onclick\s*=\s*\(\)\s*=>\s*\{\s*\n'''
    r'''(?P<body>.*?)'''
    r'''^[ \t]*\};''',
    re.M | re.S,
)

NEW_UPG = '''const upgBtn = div.querySelector("button");
    if(upgBtn){
      upgBtn.dataset.action = "buy-upgrade";
      upgBtn.dataset.upgradeId = u.id;
    }'''

OLD_AUTO = '''card.querySelector(`#btn-auto-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'auto');'''
NEW_AUTO = '''const autoBtn = card.querySelector(`#btn-auto-${s.key}`);
      if(autoBtn){
        autoBtn.dataset.action = "buy-staff-upgrade";
        autoBtn.dataset.staffKey = s.key;
        autoBtn.dataset.kind = "auto";
      }'''

OLD_TIP = '''card.querySelector(`#btn-tip-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'tip');'''
NEW_TIP = '''const tipBtn = card.querySelector(`#btn-tip-${s.key}`);
      if(tipBtn){
        tipBtn.dataset.action = "buy-staff-upgrade";
        tipBtn.dataset.staffKey = s.key;
        tipBtn.dataset.kind = "tip";
      }'''

INSERT_DELEGATE_BEFORE = '''const menuGridEl = document.getElementById("menuGrid");
if(menuGridEl){
  menuGridEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="serve-menu"]');
    if(!btn || !menuGridEl.contains(btn)) return;
    e.preventDefault();
    handleMenuGridServe(btn);
  });
}

'''
DELEGATE = '''const upgListEl = document.getElementById("upgList");
if(upgListEl){
  upgListEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action]');
    if(!btn || !upgListEl.contains(btn)) return;
    const action = btn.dataset.action;
    if(action === "buy-upgrade"){
      e.preventDefault();
      const upgradeId = btn.dataset.upgradeId;
      if(!upgradeId) return;
      unlockAudioOnce();
      if(typeof startBGM === "function") startBGM();
      buyUpgrade(upgradeId);
      return;
    }
    if(action === "buy-staff-upgrade"){
      e.preventDefault();
      const staffKey = btn.dataset.staffKey;
      const kind = btn.dataset.kind;
      if(!staffKey || !kind) return;
      buyStaffUpgrade(staffKey, kind);
    }
  });
}

'''

PRESERVE = [
  'function safeOn',
  'function _bindSafe',
  'function researchMenu(menuId)',
  'function handleMenuGridServe(btn)',
  'rndListEl.addEventListener("click"',
  'menuGridEl.addEventListener("click"',
]


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))


def find_upgrade_blocks(js):
    matches = []
    for m in UPG_RE.finditer(js):
        block = m.group(0)
        body = m.group('body')
        if 'buyUpgrade(u.id)' in body:
            matches.append((m, block))
    return matches


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before_direct = direct_count(js)
    before_inline = inline_count(index, js)

    if before_inline != 0:
        fail(f'inline onclick must be 0 before Step 2-17, found {before_inline}')
    if js.count('function safeClick') != 0:
        fail('function safeClick must stay removed')
    if any('safeClick(' in line and not line.strip().startswith('function safeClick') for line in js.splitlines()):
        fail('safeClick actual call must stay 0')
    if before_direct != 4:
        fail(f'expected 4 direct .onclick assignments before Step 2-17, found {before_direct}')

    upg_matches = find_upgrade_blocks(js)
    if len(upg_matches) != 1:
        fail(f'expected upgrade target exactly 1, found {len(upg_matches)}')

    for label, old in [('auto', OLD_AUTO), ('tip', OLD_TIP)]:
        count = js.count(old)
        if count != 1:
            fail(f'expected {label} target exactly 1, found {count}')
    if js.count('upgListEl.addEventListener("click"') != 0:
        fail('upgList delegated handler already exists')
    if INSERT_DELEGATE_BEFORE not in js:
        fail('menuGrid delegate anchor not found')

    patched = js
    patched = patched.replace(upg_matches[0][1], NEW_UPG, 1)
    patched = patched.replace(OLD_AUTO, NEW_AUTO, 1)
    patched = patched.replace(OLD_TIP, NEW_TIP, 1)
    patched = patched.replace(INSERT_DELEGATE_BEFORE, INSERT_DELEGATE_BEFORE + DELEGATE, 1)

    MAIN.write_text(patched, encoding='utf-8')
    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')

    after_direct = direct_count(js2)
    after_inline = inline_count(index2, js2)

    checks = {
        'upg_direct': js2.count('div.querySelector("button").onclick') + js2.count("div.querySelector('button').onclick"),
        'auto_direct': js2.count('card.querySelector(`#btn-auto-${s.key}`).onclick'),
        'tip_direct': js2.count('card.querySelector(`#btn-tip-${s.key}`).onclick'),
        'buy_upgrade_action': js2.count('dataset.action = "buy-upgrade"'),
        'buy_staff_action': js2.count('dataset.action = "buy-staff-upgrade"'),
        'upgrade_id': js2.count('dataset.upgradeId = u.id'),
        'staff_key': js2.count('dataset.staffKey = s.key'),
        'kind_auto': js2.count('dataset.kind = "auto"'),
        'kind_tip': js2.count('dataset.kind = "tip"'),
        'upg_delegate': js2.count('upgListEl.addEventListener("click"'),
        'function_safeClick': js2.count('function safeClick'),
        'safeClick_actual': sum(1 for line in js2.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick')),
    }

    if checks['upg_direct'] != 0 or checks['auto_direct'] != 0 or checks['tip_direct'] != 0:
        fail(f'direct upg onclick remains: {checks}')
    if checks['buy_upgrade_action'] != 1:
        fail(f'buy-upgrade action invalid: {checks}')
    if checks['buy_staff_action'] != 2:
        fail(f'buy-staff-upgrade action invalid: {checks}')
    if checks['upgrade_id'] != 1 or checks['staff_key'] != 2 or checks['kind_auto'] != 1 or checks['kind_tip'] != 1:
        fail(f'dataset counts invalid: {checks}')
    if checks['upg_delegate'] != 1:
        fail(f'upgList delegate count invalid: {checks}')
    if after_direct != before_direct - 3:
        fail(f'direct .onclick count should decrease by 3, before={before_direct}, after={after_direct}')
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
        '# Step 2-17 upgList click 전환 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `renderPanel("upg")` 내부 업그레이드 구매 버튼의 직접 `.onclick`을 제거했다.\n'
        '- 직원 속도 업그레이드 버튼의 직접 `.onclick`을 제거했다.\n'
        '- 직원 매력 업그레이드 버튼의 직접 `.onclick`을 제거했다.\n'
        '- 각 버튼에 `data-action`, `data-upgrade-id`, `data-staff-key`, `data-kind`를 부여했다.\n'
        '- `#upgList`에 click 이벤트 위임을 1회 추가했다.\n\n'
        '## 유지한 기능\n\n'
        '- `buyUpgrade(upgradeId)` 호출 유지\n'
        '- `buyStaffUpgrade(staffKey, kind)` 호출 유지\n'
        '- 업그레이드 구매 시 `unlockAudioOnce()` 및 `startBGM()` 호출 유지\n\n'
        '## 검증 결과\n\n'
        f'- 전환 전 `.onclick =` 직접 대입 수: {before_direct}\n'
        f'- 전환 후 `.onclick =` 직접 대입 수: {after_direct}\n'
        f'- `div.querySelector("button").onclick`: {checks["upg_direct"]}\n'
        f'- `card.querySelector(`#btn-auto-${{s.key}}`).onclick`: {checks["auto_direct"]}\n'
        f'- `card.querySelector(`#btn-tip-${{s.key}}`).onclick`: {checks["tip_direct"]}\n'
        f'- `dataset.action = "buy-upgrade"`: {checks["buy_upgrade_action"]}\n'
        f'- `dataset.action = "buy-staff-upgrade"`: {checks["buy_staff_action"]}\n'
        f'- `upgListEl.addEventListener("click"`: {checks["upg_delegate"]}\n'
        f'- inline onclick: {after_inline}\n'
        '- function safeClick: 0\n'
        '- safeClick 실제 호출: 0\n'
        '- node --check js/main.js 통과\n\n'
        '## 남은 리스크\n\n'
        '- 브라우저에서 업그레이드 구매와 직원 업그레이드 클릭 테스트가 필요하다.\n'
        '- `.onclick =` 직접 대입은 1개 남아 있다.\n'
        '- 남은 항목은 `renderPanel("res")` 내부 연구 시작 버튼이다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-17 completed')
    print('before_direct', before_direct)
    print('after_direct', after_direct)


if __name__ == '__main__':
    main()
