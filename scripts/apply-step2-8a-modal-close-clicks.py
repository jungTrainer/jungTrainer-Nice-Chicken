#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-8a-modal-close-click-cleanup.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

repls=[
('if(closeSettingsBtn) closeSettingsBtn.onclick = ()=> modalSettings && modalSettings.classList.remove("on");', 'if(closeSettingsBtn){\n    closeSettingsBtn.addEventListener("click", ()=> modalSettings && modalSettings.classList.remove("on"));\n  }'),
('safeClick("closeSettings", ()=> modalSettings.classList.remove("on"));', 'safeOn(document.getElementById("closeSettings"), "click", ()=> modalSettings && modalSettings.classList.remove("on"));'),
('if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons && modalCoupons.classList.remove("on");', 'if(closeCouponsBtn){\n    closeCouponsBtn.addEventListener("click", ()=> modalCoupons && modalCoupons.classList.remove("on"));\n  }'),
('if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons.classList.remove("on");', '// Step 2-8A: closeCouponsBtn handled once in initDOMRefs().'),
('if(closeExchangeBtn) closeExchangeBtn.onclick = ()=> modalExchange && modalExchange.classList.remove("on");', 'if(closeExchangeBtn){\n    closeExchangeBtn.addEventListener("click", ()=> modalExchange && modalExchange.classList.remove("on"));\n  }'),
('if(closeExchangeBtn) closeExchangeBtn.onclick = ()=> modalExchange.classList.remove("on");', '// Step 2-8A: closeExchangeBtn handled once in initDOMRefs().')
]

def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index=INDEX.read_text(encoding='utf-8')
    js=MAIN.read_text(encoding='utf-8')
    before_direct=direct_count(js)
    before_inline=inline_count(index, js)
    print('[before] inline', before_inline)
    print('[before] direct', before_direct)
    patched=js
    applied=0
    for old,new in repls:
        c=patched.count(old)
        if c:
            patched=patched.replace(old,new)
            applied+=c
    if applied==0: fail('no Step 2-8A targets replaced')
    MAIN.write_text(patched,encoding='utf-8')
    index2=INDEX.read_text(encoding='utf-8')
    js2=MAIN.read_text(encoding='utf-8')
    after_direct=direct_count(js2)
    after_inline=inline_count(index2, js2)
    print('[after] inline', after_inline)
    print('[after] direct', after_direct)
    if after_inline!=0: fail(f'inline onclick must remain 0, found {after_inline}')
    for p in ['closeSettingsBtn.onclick','closeCouponsBtn.onclick','closeExchangeBtn.onclick']:
        if p in js2: fail(f'target onclick remains: {p}')
    for p in ['closeSettingsBtn.addEventListener("click"','closeCouponsBtn.addEventListener("click"','closeExchangeBtn.addEventListener("click"']:
        if js2.count(p)!=1: fail(f'event binding count invalid: {p}={js2.count(p)}')
    for p in ['openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"']:
        if js2.count(p)!=1: fail(f'preserved event invalid: {p}={js2.count(p)}')
    node_check()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Step 2-8A Modal Close Click Cleanup\n\n- closeSettingsBtn / closeCouponsBtn / closeExchangeBtn .onclick 제거\n- addEventListener click 1회 바인딩으로 전환\n- inline onclick 0개 유지\n- node --check js/main.js 통과\n', encoding='utf-8')
    print('[OK] Step 2-8A completed')

if __name__=='__main__': main()
