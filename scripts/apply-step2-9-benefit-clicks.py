#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-9-benefit-click-cleanup.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

old_open_coupons='''if(openCouponsBtn) openCouponsBtn.onclick = ()=>{
    unlockAudioOnce(); startBGM();
    if(modalCoupons) modalCoupons.classList.add("on");
    renderCoupons();
  };'''
new_open_coupons='''if(openCouponsBtn){
    openCouponsBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      if(modalCoupons) modalCoupons.classList.add("on");
      renderCoupons();
    });
  }'''
old_open_exchange='''if(openExchangeBtn) openExchangeBtn.onclick = ()=>{
    unlockAudioOnce(); startBGM();
    if(modalExchange) modalExchange.classList.add("on");
    renderExchange();
  };'''
new_open_exchange='''if(openExchangeBtn){
    openExchangeBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      if(modalExchange) modalExchange.classList.add("on");
      renderExchange();
    });
  }'''
old_clear='''if(clearLogBtn) clearLogBtn.onclick = ()=>{
    if(confirm("혜택 내역을 정리할까요? (로그만 삭제)")){
      state.benefitsLog = [];
      if(_saveDirty) save(true);
      renderCoupons();
      showToast("기록 정리 완료");
    }
  };'''
new_clear='''if(clearLogBtn){
    clearLogBtn.addEventListener("click", ()=>{
      if(confirm("혜택 내역을 정리할까요? (로그만 삭제)")){
        state.benefitsLog = [];
        if(_saveDirty) save(true);
        renderCoupons();
        showToast("기록 정리 완료");
      }
    });
  }'''
old_make='''if(makeCardBtn) makeCardBtn.onclick = ()=> {
    unlockAudioOnce(); startBGM();
    generateWeeklyCertificate();
  };'''
new_make='''if(makeCardBtn){
    makeCardBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      generateWeeklyCertificate();
    });
  }'''
old_cert='''if(useCertDrinkBtn) useCertDrinkBtn.onclick = async ()=>{
    unlockAudioOnce(); startBGM();
    if(!state.cert.issuedThisWeek){
      showToast("먼저 인증서를 발급하세요!");
      sfxWrong();
      return;
    }
    if(state.coupons.drink <= 0){
      showToast("사용 가능한 음료 쿠폰이 없어요.");
      sfxWrong();
      return;
    }
    if(!confirm("음료 서비스 사용 처리(본사 사용)하시겠어요?\\nPIN CODE 입력이 필요합니다.")){
      return;
    }
    const ok = await askPIN();
    if(!ok){
      showToast("PIN이 올바르지 않아요.");
      sfxWrong();
      return;
    }
    state.coupons.drink -= 1;
    state.cert.usedAt = Date.now();
    logBenefit({type:"drink", qty:1, source:"cert_use", note:"인증서(본사 사용 처리)로 사용"});
    startNewWeek();
    showToast("✅ 사용되었습니다. 주간 미션이 초기화되었습니다.");
    sfxConfirm();
    if(_saveDirty) save(true);
    updateUI();
    renderCoupons();
    renderPanel("mis");
    renderPanel("shr");
  };'''
new_cert='''if(useCertDrinkBtn){
    useCertDrinkBtn.addEventListener("click", async ()=>{
      unlockAudioOnce(); startBGM();
      if(!state.cert.issuedThisWeek){
        showToast("먼저 인증서를 발급하세요!");
        sfxWrong();
        return;
      }
      if(state.coupons.drink <= 0){
        showToast("사용 가능한 음료 쿠폰이 없어요.");
        sfxWrong();
        return;
      }
      if(!confirm("음료 서비스 사용 처리(본사 사용)하시겠어요?\\nPIN CODE 입력이 필요합니다.")){
        return;
      }
      const ok = await askPIN();
      if(!ok){
        showToast("PIN이 올바르지 않아요.");
        sfxWrong();
        return;
      }
      state.coupons.drink -= 1;
      state.cert.usedAt = Date.now();
      logBenefit({type:"drink", qty:1, source:"cert_use", note:"인증서(본사 사용 처리)로 사용"});
      startNewWeek();
      showToast("✅ 사용되었습니다. 주간 미션이 초기화되었습니다.");
      sfxConfirm();
      if(_saveDirty) save(true);
      updateUI();
      renderCoupons();
      renderPanel("mis");
      renderPanel("shr");
    });
  }'''
old_drink='if(useDrinkCouponBtn) useDrinkCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("drink"); };'
new_drink='''if(useDrinkCouponBtn){
    useDrinkCouponBtn.addEventListener("click", ()=>{ unlockAudioOnce(); startBGM(); useCoupon("drink"); });
  }'''
old_veg='if(useVegCouponBtn) useVegCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("veg"); };'
new_veg='''if(useVegCouponBtn){
    useVegCouponBtn.addEventListener("click", ()=>{ unlockAudioOnce(); startBGM(); useCoupon("veg"); });
  }'''
old_exchange='''if(doExchangeBtn) doExchangeBtn.onclick = ()=>{
    unlockAudioOnce(); startBGM();
    const cnt = Math.floor(state.money / CONFIG.exchangeUnit);
    if(cnt <= 0){
      showToast("교환할 돈이 부족해요.");
      sfxWrong();
      return;
    }
    state.money -= CONFIG.exchangeUnit;
    state.coupons.drink += 1;
    logBenefit({type:"drink", qty:1, source:"exchange", note:"5,000만원 교환"});
    showToast("교환 완료! 음료 쿠폰 +1");
    sfxConfirm();
    if(_saveDirty) save(true);
    updateUI();
    renderExchange();
    renderCoupons();
  };'''
new_exchange='''if(doExchangeBtn){
    doExchangeBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      const cnt = Math.floor(state.money / CONFIG.exchangeUnit);
      if(cnt <= 0){
        showToast("교환할 돈이 부족해요.");
        sfxWrong();
        return;
      }
      state.money -= CONFIG.exchangeUnit;
      state.coupons.drink += 1;
      logBenefit({type:"drink", qty:1, source:"exchange", note:"5,000만원 교환"});
      showToast("교환 완료! 음료 쿠폰 +1");
      sfxConfirm();
      if(_saveDirty) save(true);
      updateUI();
      renderExchange();
      renderCoupons();
    });
  }'''

LEGACY_REPLACEMENTS = [
('''if(openCouponsBtn) openCouponsBtn.onclick = ()=>{
  unlockAudioOnce(); startBGM();
  modalCoupons.classList.add("on");
  renderCoupons();
};''','// Step 2-9: openCouponsBtn handled once in initDOMRefs().'),
('''if(openExchangeBtn) openExchangeBtn.onclick = ()=>{
  unlockAudioOnce(); startBGM();
  modalExchange.classList.add("on");
  renderExchange();
};''','// Step 2-9: openExchangeBtn handled once in initDOMRefs().'),
('''if(clearLogBtn) clearLogBtn.onclick = ()=>{
  if(confirm("혜택 내역을 정리할까요? (로그만 삭제)")){
    state.benefitsLog = [];
    if(_saveDirty) save(true);
    renderCoupons();
    showToast("기록 정리 완료");
  }
};''','// Step 2-9: clearLogBtn handled once in initDOMRefs().'),
('''if(makeCardBtn) makeCardBtn.onclick = ()=> {
  unlockAudioOnce(); startBGM();
  generateWeeklyCertificate();
};''','// Step 2-9: makeCardBtn handled once in initDOMRefs().'),
('''if(useCertDrinkBtn) useCertDrinkBtn.onclick = async ()=>{
  unlockAudioOnce(); startBGM();
  const st = certStatusText();
  if(!state.cert.issuedThisWeek){
    showToast("먼저 인증서를 발급하세요!");
    sfxWrong();
    return;
  }
  if(state.coupons.drink <= 0){
    showToast("사용 가능한 음료 쿠폰이 없어요.");
    sfxWrong();
    return;
  }
  if(!confirm("음료 서비스 사용 처리(본사 사용)하시겠어요?\\nPIN CODE 입력이 필요합니다.")){
    return;
  }
  const ok = await askPIN();
  if(!ok){
    showToast("PIN이 올바르지 않아요.");
    sfxWrong();
    return;
  }

  // 사용 처리
  state.coupons.drink -= 1;
  state.cert.usedAt = Date.now();
  logBenefit({type:"drink", qty:1, source:"cert_use", note:"인증서(본사 사용 처리)로 사용"});

  // 주간 초기화
  startNewWeek();
  showToast("✅ 사용되었습니다. 주간 미션이 초기화되었습니다.");
  sfxConfirm();
  if(_saveDirty) save(true);
  updateUI();
  renderCoupons();
  renderPanel("mis");
  renderPanel("shr");
};''','// Step 2-9: useCertDrinkBtn handled once in initDOMRefs().'),
('if(useDrinkCouponBtn) useDrinkCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("drink"); };','// Step 2-9: useDrinkCouponBtn handled once in initDOMRefs().'),
('if(useVegCouponBtn) useVegCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("veg"); };','// Step 2-9: useVegCouponBtn handled once in initDOMRefs().'),
('''if(doExchangeBtn) doExchangeBtn.onclick = ()=>{
  unlockAudioOnce(); startBGM();
  const cnt = Math.floor(state.money / CONFIG.exchangeUnit);
  if(cnt <= 0){
    showToast("교환할 돈이 부족해요.");
    sfxWrong();
    return;
  }
  // 1회 교환
  state.money -= CONFIG.exchangeUnit;
  state.coupons.drink += 1;
  logBenefit({type:"drink", qty:1, source:"exchange", note:"5,000만원 교환"});
  showToast("교환 완료! 음료 쿠폰 +1");
  sfxConfirm();
  if(_saveDirty) save(true);
  updateUI();
  renderExchange();
  renderCoupons();
};''','// Step 2-9: doExchangeBtn handled once in initDOMRefs().'),
]

PRIMARY_REPLACEMENTS=[
(old_open_coupons,new_open_coupons),
(old_open_exchange,new_open_exchange),
(old_clear,new_clear),
(old_make,new_make),
(old_cert,new_cert),
(old_drink,new_drink),
(old_veg,new_veg),
(old_exchange,new_exchange),
]

TARGET_ONCLICK=['openCouponsBtn.onclick','openExchangeBtn.onclick','clearLogBtn.onclick','useDrinkCouponBtn.onclick','useVegCouponBtn.onclick','doExchangeBtn.onclick','useCertDrinkBtn.onclick','makeCardBtn.onclick']
TARGET_EVENTS=['openCouponsBtn.addEventListener("click"','openExchangeBtn.addEventListener("click"','clearLogBtn.addEventListener("click"','useDrinkCouponBtn.addEventListener("click"','useVegCouponBtn.addEventListener("click"','doExchangeBtn.addEventListener("click"','useCertDrinkBtn.addEventListener("click"','makeCardBtn.addEventListener("click"']
PRESERVE=['openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"','closeSettingsBtn.addEventListener("click"','closeCouponsBtn.addEventListener("click"','closeExchangeBtn.addEventListener("click"','pinCancelBtn.addEventListener("click"','pinOkBtn.addEventListener("click"']

def main():
    if not INDEX.exists() or not MAIN.exists(): fail('index.html or js/main.js missing')
    index=INDEX.read_text(encoding='utf-8')
    js=MAIN.read_text(encoding='utf-8')
    before_direct=direct_count(js)
    before_inline=inline_count(index, js)
    before_targets={p:js.count(p) for p in TARGET_ONCLICK}
    print('[before] inline', before_inline)
    print('[before] direct', before_direct)
    print('[before] targets', before_targets)
    patched=js
    applied=0
    for old,new in PRIMARY_REPLACEMENTS:
        c=patched.count(old)
        if c:
            patched=patched.replace(old,new,1)
            applied+=1
    for old,new in LEGACY_REPLACEMENTS:
        c=patched.count(old)
        if c:
            patched=patched.replace(old,new)
            applied+=c
    if applied < 8:
        fail(f'not enough Step 2-9 replacements: {applied}')
    MAIN.write_text(patched,encoding='utf-8')
    index2=INDEX.read_text(encoding='utf-8')
    js2=MAIN.read_text(encoding='utf-8')
    after_direct=direct_count(js2)
    after_inline=inline_count(index2, js2)
    after_targets={p:js2.count(p) for p in TARGET_ONCLICK}
    print('[after] inline', after_inline)
    print('[after] direct', after_direct)
    print('[after] targets', after_targets)
    if after_inline!=0: fail(f'inline onclick must remain 0, found {after_inline}')
    for p,c in after_targets.items():
        if c!=0: fail(f'target onclick remains: {p}={c}')
    for p in TARGET_EVENTS:
        if js2.count(p)!=1: fail(f'target event invalid: {p}={js2.count(p)}')
    for p in PRESERVE:
        if js2.count(p)!=1: fail(f'preserved event invalid: {p}={js2.count(p)}')
    node_check()
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Step 2-9 Benefit/Coupon/Exchange Click Cleanup\n\n- benefit/coupon/exchange 계열 `.onclick =` 직접 대입 제거\n- 대상 8개를 `addEventListener("click")` 1회 바인딩으로 전환\n- 구형 중복 블록은 주석 처리\n- inline onclick 0개 유지\n- 기존 지역 확장 및 Step 2-8 이벤트 유지\n- `node --check js/main.js` 통과\n', encoding='utf-8')
    print('[OK] Step 2-9 completed')

if __name__=='__main__': main()
