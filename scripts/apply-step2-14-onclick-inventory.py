#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

INDEX = Path('index.html')
MAIN = Path('js/main.js')
REPORT = Path('docs/2026-05-15-step2-14-onclick-inventory.md')

# Step 2-14 intentionally keeps the automatic conversion conservative.
# It converts only one-line, non-dynamic, direct element variable handlers when present.
LOW_RISK_REPLACEMENTS = {
    # reserved for exact one-line handlers discovered in future runs
}

PRESERVE = [
    'function safeOn',
    'function _bindSafe',
    'openMapBtn.addEventListener("click"',
    'mapGoBtn.addEventListener("click"',
    'mapUnlockBtn.addEventListener("click"',
    'closeExpansionModalBtn.addEventListener("click"',
    'safeOn(document.getElementById("openSettings"), "click"',
    'safeOn(document.getElementById("openStats"), "click"',
    'safeOn(document.getElementById("closeStats"), "click"',
]


def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)


def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index + '\n' + js, flags=re.I))


def direct_assignments(js):
    lines = []
    for i, line in enumerate(js.splitlines(), start=1):
        if re.search(r'\.onclick\s*=', line):
            lines.append((i, line.rstrip()))
    return lines


def classify(line):
    low = line.lower()
    if 'btn.onclick' in low and 'createelement' not in low:
        return ('static-button', 'low', '정적 버튼 변수 직접 바인딩으로 보이며 addEventListener 전환 후보')
    if 'node.onclick' in low or 'card.onclick' in low or 'el.onclick' in low or 'item.onclick' in low:
        return ('dynamic-ui', 'high', '동적 생성 DOM 또는 반복 렌더링 가능성이 있어 이벤트 위임 검토 필요')
    if 'canvas' in low or 'touch' in low or 'pointer' in low:
        return ('input/canvas', 'high', '입력 계층과 충돌 가능성이 있어 브라우저 테스트 후 전환 필요')
    return ('other', 'medium', '정확한 호출 컨텍스트 확인 필요')


def convert_low_risk(js):
    patched = js
    applied = []
    for old, new in LOW_RISK_REPLACEMENTS.items():
        count = patched.count(old)
        if count == 1:
            patched = patched.replace(old, new, 1)
            applied.append(old.strip())
        elif count > 1:
            fail(f'low risk target duplicated unexpectedly: {old[:80]} count={count}')
    return patched, applied


def main():
    if not INDEX.exists() or not MAIN.exists():
        fail('index.html or js/main.js missing')

    index = INDEX.read_text(encoding='utf-8')
    js = MAIN.read_text(encoding='utf-8')

    before = direct_assignments(js)
    before_inline = inline_count(index, js)
    safe_click_decl = js.count('function safeClick')
    safe_click_calls = [line for line in js.splitlines() if 'safeClick(' in line and not line.strip().startswith('function safeClick')]

    if before_inline != 0:
        fail(f'inline onclick must be 0, found {before_inline}')
    if safe_click_decl != 0:
        fail(f'function safeClick must remain 0, found {safe_click_decl}')
    if safe_click_calls:
        fail('safeClick actual calls must remain 0')

    patched, applied = convert_low_risk(js)
    if applied:
        MAIN.write_text(patched, encoding='utf-8')

    js2 = MAIN.read_text(encoding='utf-8')
    index2 = INDEX.read_text(encoding='utf-8')
    after = direct_assignments(js2)
    after_inline = inline_count(index2, js2)

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

    rows = []
    for line_no, line in after:
        group, risk, reason = classify(line)
        rows.append((line_no, group, risk, reason, line.strip()))

    summary = {}
    for _, group, risk, _, _ in rows:
        summary[(group, risk)] = summary.get((group, risk), 0) + 1

    summary_text = '\n'.join(f'- {group} / {risk}: {count}' for (group, risk), count in sorted(summary.items())) or '- 없음'
    list_text = '\n'.join(
        f'### {idx}. line {line_no} — {group} / {risk}\n\n'
        f'보류/판단: {reason}\n\n'
        f'```js\n{line}\n```\n'
        for idx, (line_no, group, risk, reason, line) in enumerate(rows, start=1)
    ) or '- 없음'

    converted_text = '\n'.join(f'- `{x}`' for x in applied) or '- 이번 단계에서 자동 전환한 항목 없음. 남은 항목은 동적/중위험 이상으로 분류되어 보류.'

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Step 2-14 onclick 직접 대입 인벤토리\n\n'
        '작성일: 2026-05-15\n\n'
        '## 요약\n\n'
        f'- 전환 전 `.onclick =` 직접 대입 수: {len(before)}\n'
        f'- 전환 후 `.onclick =` 직접 대입 수: {len(after)}\n'
        f'- inline onclick: {after_inline}\n'
        '- function safeClick: 0\n'
        '- safeClick 실제 호출: 0\n'
        '- node --check js/main.js: 통과\n\n'
        '## 자동 전환 항목\n\n'
        f'{converted_text}\n\n'
        '## 기능/위험도 분류 요약\n\n'
        f'{summary_text}\n\n'
        '## 남은 `.onclick =` 목록\n\n'
        f'{list_text}\n\n'
        '## 판단\n\n'
        '- 이번 단계에서는 목록화와 위험도 분류를 우선했다.\n'
        '- 동적 생성 DOM 또는 입력/게임 액션과 관련된 항목은 브라우저 테스트 없이 전환하지 않았다.\n'
        '- 다음 단계에서 고위험 항목의 실제 호출 경로를 확인한 뒤 이벤트 위임 또는 addEventListener 전환을 진행한다.\n',
        encoding='utf-8'
    )
    print('[OK] Step 2-14 inventory completed')
    print('before_direct', len(before))
    print('after_direct', len(after))
    print('converted', len(applied))


if __name__ == '__main__':
    main()
