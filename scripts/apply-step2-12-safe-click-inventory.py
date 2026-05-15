#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-12-safe-click-inventory.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

def classify(line):
    low=line.lower()
    if 'stat' in low or 'toast' in low or 'info' in low:
        return 'info/stat/toast'
    if 'modal' in low or 'close' in low or 'settings' in low:
        return 'modal/settings'
    if 'coupon' in low or 'exchange' in low or 'cert' in low:
        return 'benefit/coupon/exchange'
    if 'save' in low or 'reset' in low or 'sound' in low or 'profile' in low or 'offline' in low:
        return 'profile/save/offline/sound'
    return 'other'

def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index=INDEX.read_text(encoding='utf-8')
    js=MAIN.read_text(encoding='utf-8')
    inline=inline_count(index, js)
    # Count safeClick calls excluding function declaration itself.
    safe_call_lines=[]
    for line in js.splitlines():
        stripped=line.strip()
        if 'safeClick(' in stripped and not stripped.startswith('function safeClick'):
            safe_call_lines.append(stripped)
    groups={}
    for line in safe_call_lines:
        key=classify(line)
        groups[key]=groups.get(key,0)+1
    direct_onclick=len(re.findall(r'\.onclick\s*=', js))
    safe_fn_count=js.count('function safeClick')
    safe_on_count=js.count('safeOn(')
    node_check()
    if inline!=0: fail(f'inline onclick must remain 0, found {inline}')
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    group_text='\n'.join(f'- {k}: {v}' for k,v in sorted(groups.items())) or '- 없음'
    lines_text='\n'.join(f'```js\n{line}\n```' for line in safe_call_lines) or '- 없음'
    recommendation='safeClick 사용처가 0개이므로 다음 단계에서 safeClick 함수 제거 여부를 검토할 수 있다.' if len(safe_call_lines)==0 else '잔여 safeClick 사용처는 위험도별로 다음 단계에서 safeOn으로 전환한다.'
    REPORT.write_text(
        '# Step 2-12 SafeClick Inventory\n\n'
        '작성일: 2026-05-15\n\n'
        '## 요약\n\n'
        f'- safeClick 함수 선언 수: {safe_fn_count}\n'
        f'- safeClick 실제 호출 수: {len(safe_call_lines)}\n'
        f'- safeOn 사용 수: {safe_on_count}\n'
        f'- inline onclick 수: {inline}\n'
        f'- `.onclick =` 직접 대입 수: {direct_onclick}\n'
        '- node --check js/main.js: 통과\n\n'
        '## safeClick 사용처 분류\n\n'
        f'{group_text}\n\n'
        '## safeClick 실제 호출 목록\n\n'
        f'{lines_text}\n\n'
        '## 판단\n\n'
        f'- {recommendation}\n\n'
        '## 다음 단계\n\n'
        '1. safeClick 실제 호출이 0개인지 재확인한다.\n'
        '2. 0개라면 `function safeClick(id, fn){...}` 제거를 별도 Step 2-13에서 수행한다.\n'
        '3. `.onclick =` 직접 대입 수는 safeClick 함수 선언부의 내부 대입까지 포함하므로, 함수 제거 후 다시 계산한다.\n',
        encoding='utf-8')
    print('[OK] Step 2-12 inventory completed')
    print('safeClick_calls', len(safe_call_lines))
    print('inline_onclick', inline)
    print('direct_onclick', direct_onclick)

if __name__=='__main__': main()
