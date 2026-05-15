#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

INDEX=Path('index.html')
MAIN=Path('js/main.js')
REPORT=Path('docs/2026-05-15-step2-10-profile-save-click-cleanup.md')

def fail(msg):
    print('[FAIL]', msg, file=sys.stderr)
    sys.exit(1)

def inline_count(index, js):
    return len(re.findall(r'\sonclick\s*=', index+'\n'+js, flags=re.I))

def direct_count(js):
    return len(re.findall(r'\.onclick\s*=', js))

def node_check():
    subprocess.run(['node','--check',str(MAIN)], check=True)

old_force='if(forceSaveBtn) forceSaveBtn.onclick = ()=>{ save(true); showToast("저장 완료"); };'
new_force='''if(forceSaveBtn){
    forceSaveBtn.addEventListener("click", ()=>{ save(true); showToast("저장 완료"); });
  }'''
old_reset='''if(resetAllBtn) resetAllBtn.onclick = ()=>{
    if(confirm("정말 초기화할까요? (저장 데이터 삭제)")){
      localStorage.removeItem(SAVE_KEY);
      stopBGM();
      state = defaultState();
      initAfterLoad(true);
      if(modalSettings) modalSettings.classList.remove("on");
      showToast("초기화 완료");
    }
  };'''
new_reset='''if(resetAllBtn){
    resetAllBtn.addEventListener("click", ()=>{
      if(confirm("정말 초기화할까요? (저장 데이터 삭제)")){
        localStorage.removeItem(SAVE_KEY);
        stopBGM();
        state = defaultState();
        initAfterLoad(true);
        if(modalSettings) modalSettings.classList.remove("on");
        showToast("초기화 완료");
      }
    });
  }'''
old_toggle='''if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
    unlockAudioOnce();
    const next = !state.soundOn;
    state.soundOn = next;
    setSoundEnabled(next);
    toggleSoundBtn.textContent = next ? "ON" : "OFF";
    sfxTick();
    if(_saveDirty) save(true);
  };'''
new_toggle='''if(toggleSoundBtn){
    toggleSoundBtn.addEventListener("click", ()=>{
      unlockAudioOnce();
      const next = !state.soundOn;
      state.soundOn = next;
      setSoundEnabled(next);
      toggleSoundBtn.textContent = next ? "ON" : "OFF";
      sfxTick();
      if(_saveDirty) save(true);
    });
  }'''
old_save='''if(saveNameBtn) saveNameBtn.onclick = ()=>{
    unlockAudioOnce(); startBGM();
    const v = ((nameInput && nameInput.value) || "").trim();
    if(!isHangulOnly(v)){
      showToast("한글만, 최대 10글자까지 가능해요.");
      sfxWrong();
      return;
    }
    state.profile = state.profile || {};
    state.profile.name = v;
    if(modalProfile) modalProfile.classList.remove("on");
    _saveDirty = true;
    updateUI();
    showToast("이름 저장 완료");
    sfxConfirm();
  };'''
new_save='''if(saveNameBtn){
    saveNameBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      const v = ((nameInput && nameInput.value) || "").trim();
      if(!isHangulOnly(v)){
        showToast("한글만, 최대 10글자까지 가능해요.");
        sfxWrong();
        return;
      }
      state.profile = state.profile || {};
      state.profile.name = v;
      if(modalProfile) modalProfile.classList.remove("on");
      _saveDirty = true;
      updateUI();
      showToast("이름 저장 완료");
      sfxConfirm();
    });
  }'''
old_claim='''if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
    unlockAudioOnce(); startBGM();
    if(modalOffline) modalOffline.classList.remove("on");
    if(offlinePending > 0){
      state.money += offlinePending;
      state.offlineSalesToday = (state.offlineSalesToday || 0) + offlinePending;
      state.offlineSalesTotal = (state.offlineSalesTotal || 0) + offlinePending;
      offlinePending = 0;
      if(_saveDirty) save(true);
      updateUI();
      showToast("오프라인 수익 수령!");
      sfxConfirm();
    }
  };'''
new_claim='''if(claimOfflineBtn){
    claimOfflineBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      if(modalOffline) modalOffline.classList.remove("on");
      if(offlinePending > 0){
        state.money += offlinePending;
        state.offlineSalesToday = (state.offlineSalesToday || 0) + offlinePending;
        state.offlineSalesTotal = (state.offlineSalesTotal || 0) + offlinePending;
        offlinePending = 0;
        if(_saveDirty) save(true);
        updateUI();
        showToast("오프라인 수익 수령!");
        sfxConfirm();
      }
    });
  }'''

LEGACY=[
('safeClick("forceSave", ()=>{ save(true); showToast("저장 완료"); });','// Step 2-10: forceSaveBtn handled once in initDOMRefs().'),
('''safeClick("resetAll", ()=>{
  if(confirm("정말 초기화할까요? (저장 데이터 삭제)")){
    localStorage.removeItem(SAVE_KEY);
    stopBGM();
    state = defaultState();
    initAfterLoad(true);
    modalSettings.classList.remove("on");
    showToast("초기화 완료");
  }
});''','// Step 2-10: resetAllBtn handled once in initDOMRefs().'),
('''if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
  unlockAudioOnce();
  const next = !state.soundOn;
  state.soundOn = next;
  setSoundEnabled(next);
  toggleSoundBtn.textContent = next ? "ON" : "OFF";
  sfxTick();
  if(_saveDirty) save(true);
};''','// Step 2-10: toggleSoundBtn handled once in initDOMRefs().'),
('''if(saveNameBtn) saveNameBtn.onclick = ()=>{
  unlockAudioOnce(); startBGM();
  const v = (nameInput.value || "").trim();
  if(!isHangulOnly(v)){
    showToast("한글만, 최대 10글자까지 가능해요.");
    sfxWrong();
    return;
  }

  // 안전 초기화
  state.profile = state.profile || {};
  state.profile.name = v;

  modalProfile.classList.remove("on");
  _saveDirty = true; // autosave 대상으로만 표시
  updateUI();
  showToast("이름 저장 완료");
  sfxConfirm();
};''','// Step 2-10: saveNameBtn handled once in initDOMRefs().'),
('''if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
  unlockAudioOnce(); startBGM();
  modalOffline.classList.remove("on");
  if(offlinePending > 0){
    state.money += offlinePending;
    state.offlineSalesToday = (state.offlineSalesToday || 0) + offlinePending;
    state.offlineSalesTotal = (state.offlineSalesTotal || 0) + offlinePending;
    offlinePending = 0;
    if(_saveDirty) save(true);
    updateUI();
    showToast("오프라인 수익 수령!");
    sfxConfirm();
  }
};''','// Step 2-10: claimOfflineBtn handled once in initDOMRefs().'),
]
PRIMARY=[(old_force,new_force),(old_reset,new_reset),(old_toggle,new_toggle),(old_save,new_save),(old_claim,new_claim)]
TARGET_ONCLICK=['forceSaveBtn.onclick','resetAllBtn.onclick','toggleSoundBtn.onclick','saveNameBtn.onclick','claimOfflineBtn.onclick']
TARGET_EVENTS=['forceSaveBtn.addEventListener("click"','resetAllBtn.addEventListener("click"','toggleSoundBtn.addEventListener("click"','saveNameBtn.addEventListener("click"','claimOfflineBtn.addEventListener("click"']
PRESERVE=['openMapBtn.addEventListener("click"','mapGoBtn.addEventListener("click"','mapUnlockBtn.addEventListener("click"','closeExpansionModalBtn.addEventListener("click"','closeSettingsBtn.addEventListener("click"','closeCouponsBtn.addEventListener("click"','closeExchangeBtn.addEventListener("click"','pinCancelBtn.addEventListener("click"','pinOkBtn.addEventListener("click"','openCouponsBtn.addEventListener("click"','openExchangeBtn.addEventListener("click"','clearLogBtn.addEventListener("click"','useDrinkCouponBtn.addEventListener("click"','useVegCouponBtn.addEventListener("click"','doExchangeBtn.addEventListener("click"','useCertDrinkBtn.addEventListener("click"','makeCardBtn.addEventListener("click"']

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
    for old,new in PRIMARY:
        c=patched.count(old)
        if c:
            patched=patched.replace(old,new,1); applied+=1
    for old,new in LEGACY:
        c=patched.count(old)
        if c:
            patched=patched.replace(old,new); applied+=c
    if applied < 5: fail(f'not enough Step 2-10 replacements: {applied}')
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
    REPORT.write_text('# Step 2-10 Profile/Save Click Cleanup\n\n- profile/offline/save/reset/sound 계열 `.onclick =` 직접 대입 제거\n- 대상 5개를 `addEventListener("click")` 1회 바인딩으로 전환\n- 구형 중복 블록은 주석 처리\n- inline onclick 0개 유지\n- 기존 지역 확장 및 Step 2-8/2-9 이벤트 유지\n- `node --check js/main.js` 통과\n', encoding='utf-8')
    print('[OK] Step 2-10 completed')

if __name__=='__main__': main()
