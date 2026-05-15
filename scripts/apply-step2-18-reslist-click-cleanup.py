#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-18-reslist-click-cleanup.md')

# Last remaining .onclick is the research start button in renderPanel("res").
TARGET_RE = re.compile(
    r'''(?P<indent>^[ \t]*)btn\.onclick\s*=\s*\(\)\s*=>\s*\{\s*unlockAudioOnce\(\);\s*if\(typeof startBGM === ["']function["']\) startBGM\(\);\s*startResearch\(r\.id\);\s*\};''',
    re.M,
)

DELEGATE_ANCHOR = '''const upgListEl = document.getElementById("upgList");
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

DELEGATE = '''const resListEl = document.getElementById("resList");
if(resListEl){
  resListEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="start-research"]');
    if(!btn || !resListEl.contains(btn)) return;
    e.preventDefault();
    const researchId = btn.dataset.researchId;
    if(!researchId) return;
    unlockAudioOnce();
    if(typeof startBGM === "function") startBGM();
    startResearch(researchId);
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
  'upgListEl.addEventListener("click"',
]


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))


def safe_click_actual_count(js):
    return sum(1 for line in js.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick'))


def replacement(match):
    indent = match.group('indent')
    return (
        f'{indent}btn.dataset.action = "start-research";\n'
        f'{indent}btn.dataset.researchId = r.id;'
    )


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before_direct = direct_count(js)
    before_inline = inline_count(index, js)
    before_targets = list(TARGET_RE.finditer(js))

    if before_inline != 0:
        fail(f'inline onclick must be 0 before Step 2-18, found {before_inline}')
    if js.count('function safeClick') != 0:
        fail('function safeClick must stay removed')
    if safe_click_actual_count(js) != 0:
        fail('safeClick actual call must stay 0')
    if before_direct != 1:
        fail(f'expected 1 direct .onclick assignment before Step 2-18, found {before_direct}')
    if len(before_targets) != 1:
        fail(f'expected startResearch onclick target exactly 1, found {len(before_targets)}')
    if js.count('resListEl.addEventListener("click"') != 0:
        fail('resList delegated handler already exists')
    if DELEGATE_ANCHOR not in js:
        fail('upgList delegate anchor not found')

    patched = TARGET_RE.sub(replacement, js, count=1)
    patched = patched.replace(DELEGATE_ANCHOR, DELEGATE_ANCHOR + DELEGATE, 1)
    MAIN.write_text(patched, encoding='utf-8')

    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')

    after_direct = direct_count(js2)
    after_inline = inline_count(index2, js2)
    checks = {
        'target_direct': len(TARGET_RE.findall(js2)),
        'start_action': js2.count('btn.dataset.action = "start-research"'),
        'research_id': js2.count('btn.dataset.researchId = r.id'),
        'res_delegate': js2.count('resListEl.addEventListener("click"'),
        'function_safeClick': js2.count('function safeClick'),
        'safeClick_actual': safe_click_actual_count(js2),
    }

    if checks['target_direct'] != 0:
        fail(f'startResearch onclick still remains: {checks}')
    if checks['start_action'] != 1:
        fail(f'start-research action invalid: {checks}')
    if checks['research_id'] != 1:
        fail(f'research id dataset invalid: {checks}')
    if checks['res_delegate'] != 1:
        fail(f'resList delegate invalid: {checks}')
    if after_direct != 0:
        fail(f'direct .onclick count should become 0, after={after_direct}')
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
        '# Step 2-18 resList click 전환 보고\n\n'
        '작성일: 2026-05-15\n\n'
        '## 변경 내용\n\n'
        '- `renderPanel("res")` 내부 연구 시작 버튼의 마지막 직접 `.onclick`을 제거했다.\n'
        '- 연구 시작 버튼에 `data-action="start-research"`, `data-research-id`를 부여했다.\n'
        '- `#resList`에 click 이벤트 위임을 1회 추가했다.\n\n'
        '## 유지한 기능\n\n'
        '- `unlockAudioOnce()` 호출 유지\n'
        '- `startBGM()` 호출 유지\n'
        '- `startResearch(researchId)` 호출 유지\n\n'
        '## 검증 결과\n\n'
        f'- 전환 전 `.onclick =` 직접 대입 수: {before_direct}\n'
        f'- 전환 후 `.onclick =` 직접 대입 수: {after_direct}\n'
        f'- `btn.onclick ... startResearch(r.id)`: {checks["target_direct"]}\n'
        f'- `btn.dataset.action = "start-research"`: {checks["start_action"]}\n'
        f'- `btn.dataset.researchId = r.id`: {checks["research_id"]}\n'
        f'- `resListEl.addEventListener("click"`: {checks["res_delegate"]}\n'
        f'- inline onclick: {after_inline}\n'
        '- function safeClick: 0\n'
        '- safeClick 실제 호출: 0\n'
        '- node --check js/main.js 통과\n\n'
        '## 남은 리스크\n\n'
        '- 브라우저에서 연구 시작 버튼 클릭 테스트가 필요하다.\n'
        '- `.onclick =` 직접 대입은 0개가 되었다.\n'
        '- 이벤트 구조상 inline onclick, safeClick, 직접 onclick 제거 목표는 완료되었다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-18 completed')
    print('before_direct', before_direct)
    print('after_direct', after_direct)


if __name__ == '__main__':
    main()
