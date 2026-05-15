#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-8b-pin-click-cleanup.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

old_cancel='''if(pinCancelBtn) pinCancelBtn.onclick = ()=>{
    if(modalPin) modalPin.classList.remove("on");
    if(pinResolver){ pinResolver(false); pinResolver = null; }
  };'''
new_cancel='''if(pinCancelBtn){
    pinCancelBtn.addEventListener("click", ()=>{
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(false); pinResolver = null; }
    });
  }'''
old_ok='''if(pinOkBtn) pinOkBtn.onclick = ()=>{
    const ok = (pinInput && pinInput.value === CONFIG.pin);
    if(modalPin) modalPin.classList.remove("on");
    if(pinResolver){ pinResolver(ok); pinResolver = null; }
  };'''
new_ok='''if(pinOkBtn){
    pinOkBtn.addEventListener("click", ()=>{
      const ok = (pinInput && pinInput.value === CONFIG.pin);
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(ok); pinResolver = null; }
    });
  }'''

# Legacy global PIN helper block variants later in the file.
legacy_cancel='''if(pinCancelBtn) pinCancelBtn.onclick = ()=>{
  modalPin.classList.remove("on");
  if(pinResolver){ pinResolver(false); pinResolver = null; }
};'''
legacy_ok='''if(pinOkBtn) pinOkBtn.onclick = ()=>{
  const ok = (pinInput.value === CONFIG.pin);
  modalPin.classList.remove("on");
  if(pinResolver){ pinResolver(ok); pinResolver = null; }
};'''

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
    if old_cancel in patched:
        patched=patched.replace(old_cancel,new_cancel,1); applied+=1
    if old_ok in patched:
        patched=patched.replace(old_ok,new_ok,1); applied+=1
    if legacy_cancel in patched:
        patched=patched.replace(legacy_cancel,'// Step 2-8B: pinCancelBtn handled once in initDOMRefs().',1); applied+=1
    if legacy_ok in patched:
        patched=patched.replace(legacy_ok,'// Step 2-8B: pinOkBtn handled once in initDOMRefs().',1); applied+=1
    if applied < 2: fail(f'not enough PIN targets replaced: {applied}')
    MAIN.write_text(patched,encoding='utf-8')
    index2=INDEX.read_text(encoding='utf-8')
    js2=MAIN.read_text(encoding='utf-8')
    after_direct=direct_count(js2)
    after_inline=inline_count(index2, js2)
    print('[after] inline', after_inline)
    print('[after] direct', after_direct)
    if after_inline!=0: fail(f'inline onclick must remain 0, found {after_inline}')
    for p in ['pinCancelBtn.onclick','pinOkBtn.onclick']:
        if p in js2: fail(f'target onclick remains: {p}')
    for p in ['pinCancelBtn.addEventListener("click"','pinOkBtn.addEventListener("click"']:
        if js2.count(p)!=1: fail(f'event binding count invalid: {p}={js2.count(p)}')
    if js2.count('pinInput.addEventListener("keydown"') < 1: fail('pinInput Enter key event missing')
    for p in ['openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"']:
        if js2.count(p)!=1: fail(f'preserved event invalid: {p}={js2.count(p)}')
    node_check()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Step 2-8B PIN Click Cleanup\n\n- pinCancelBtn / pinOkBtn .onclick 제거\n- addEventListener click 1회 바인딩으로 전환\n- pinInput Enter 키 이벤트 유지\n- inline onclick 0개 유지\n- node --check js/main.js 통과\n', encoding='utf-8')
    print('[OK] Step 2-8B completed')

if __name__=='__main__': main()
