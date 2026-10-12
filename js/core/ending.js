/* REC-05: cancellable runtime, idempotent input, durable one-time ending. */
let endingPhase='idle',endingRun=0,endingFrame=null,endingFadeResolve=null,endingFinishTimer=null,endingFinishResolve=null;
const endingBindings=new WeakSet();
const originalGrandson=structuredClone(STAFF_POOL.find(s=>s.key==='grandson'));
function cancelEndingFade(){
  if(endingFrame!==null)cancelAnimationFrame(endingFrame);endingFrame=null;
  if(endingFadeResolve)endingFadeResolve(false);endingFadeResolve=null;
}
function cancelEndingRuntime(){
  endingRun++;endingPhase='idle';clearEndingTyping();cancelEndingFade();
  clearTimeout(endingFinishTimer);endingFinishTimer=null;
  if(endingFinishResolve)endingFinishResolve(false);endingFinishResolve=null;
  if(__endingAudio){__endingAudio.pause();__endingAudio.volume=0;try{__endingAudio.currentTime=0;}catch(_){}}
  __endingStep=0;closeEndingPopup();const el=endingEls();
  el.overlay.classList.remove('active');el.overlay.style.display='none';el.overlay.setAttribute('aria-hidden','true');el.text.textContent='';el.miss.style.display='none';
}
applyRobotGrandson=function(){
  const staff=STAFF_POOL.find(s=>s.key==='grandson');
  Object.assign(staff,structuredClone(originalGrandson));
  if(state.robotGrandson)Object.assign(staff,{label:'로봇손주',emoji:'🤖',lines:['할머니, 제가 도울게요 🤖','매출은 제가 책임질게요!']});
};
function restoreEndingUI(){
  if(state.endingPrompted||state.endingSeen||state.robotGrandson)state.endingUnlocked=true;
  if(state.endingSeen||state.robotGrandson)state.endingPrompted=true;
  applyRobotGrandson();bindEndingUI();const el=endingEls();
  el.replay.style.display=state.endingUnlocked?'block':'none';el.replay.disabled=endingPhase!=='idle';el.yes.disabled=endingPhase!=='idle';
}
fadeAudioTo=function(target,ms){
  cancelEndingFade();const a=ensureEndingAudio(),volume=a.volume,start=performance.now();
  if(volume===target)return Promise.resolve(true);
  return new Promise(resolve=>{endingFadeResolve=resolve;const frame=t=>{
    const progress=Math.min(1,(t-start)/ms);a.volume=volume+(target-volume)*progress;
    if(progress===1){endingFrame=null;endingFadeResolve=null;resolve(true);}else endingFrame=requestAnimationFrame(frame);
  };endingFrame=requestAnimationFrame(frame);});
};
playEndingLoop=async function(run){
  if(!state.soundOn)return;const a=ensureEndingAudio();
  try{await a.play();if(run!==endingRun||endingPhase!=='playing'){if(endingPhase==='idle')a.pause();return;}await fadeAudioTo(.85,900);}catch(_){}
};
stopEndingLoopFade=async function(run){
  if(!__endingAudio)return;await fadeAudioTo(0,900);if(run!==endingRun)return;__endingAudio.pause();__endingAudio.currentTime=0;
};
const legacyNextEnding=nextEndingStep;
nextEndingStep=function(){if(endingPhase==='playing')legacyNextEnding();};
startEndingSequence=async function(){
  if(!state.endingUnlocked||endingPhase!=='idle')return false;
  endingPhase='playing';const run=++endingRun;closeEndingPopup();restoreEndingUI();
  const el=endingEls();el.overlay.style.display='flex';el.overlay.setAttribute('aria-hidden','false');el.overlay.classList.add('active');
  __endingStep=0;renderEndingStep();await playEndingLoop(run);return run===endingRun;
};
finishEndingSequence=async function(){
  if(endingPhase!=='playing'||__endingStep<endingStoryData.length)return false;
  endingPhase='finishing';const run=endingRun;clearEndingTyping();
  if(!state.endingSeen){
    const robot=state.robotGrandson;state.endingSeen=true;state.robotGrandson=true;_saveDirty=true;
    if(!save(true)){state.endingSeen=false;state.robotGrandson=robot;endingPhase='playing';__endingStep=endingStoryData.length-1;renderEndingStep();showToast('저장 실패. 마지막 장면을 다시 진행해 주세요.');return false;}
  }
  restoreEndingUI();updateUI();endingEls().overlay.classList.remove('active');
  await Promise.all([stopEndingLoopFade(run),new Promise(resolve=>{endingFinishResolve=resolve;endingFinishTimer=setTimeout(()=>{endingFinishTimer=null;endingFinishResolve=null;resolve(true);},950);})]);
  if(run!==endingRun)return false;
  endingPhase='idle';endingEls().overlay.style.display='none';endingEls().overlay.setAttribute('aria-hidden','true');restoreEndingUI();return true;
};
checkEndingCondition=function(){
  if(state.endingPrompted||endingPhase!=='idle')return;
  if(state.endingUnlocked||(Number.isFinite(state.money)&&state.money>=ENDING_MONEY)){
    state.endingUnlocked=true;state.endingPrompted=true;_saveDirty=true;save(true);restoreEndingUI();openEndingPopup();
  }
};
bindEndingUI=function(){
  const el=endingEls();
  const bind=(element,fn)=>{if(!element||endingBindings.has(element))return;element.addEventListener('click',fn);endingBindings.add(element);};
  bind(el.yes,()=>startEndingSequence());bind(el.replay,()=>startEndingSequence());bind(el.wrap,()=>nextEndingStep());
  bind(el.no,()=>{if(state.endingUnlocked&&endingPhase==='idle')closeEndingPopup();});
  bind(el.popup,e=>{if(e.target===el.popup)closeEndingPopup();});
  const preview=document.getElementById('endingPreviewBtn');preview.style.display=new URLSearchParams(location.search).get('debug')==='1'?'block':'none';
  bind(preview,()=>{if(endingPhase==='idle'){state.endingUnlocked=true;checkEndingCondition();}});
  for(let i=1;i<=5;i++){
    const img=document.getElementById('imgCut'+i);if(endingBindings.has(img))continue;
    const refresh=()=>{if(endingPhase==='playing'&&img.classList.contains('current'))updateEndingImage(endingStoryData[__endingStep]);};
    img.addEventListener('load',refresh);img.addEventListener('error',refresh);endingBindings.add(img);
  }
};
const endingInitAfterLoad=initAfterLoad;
initAfterLoad=function(...args){cancelEndingRuntime();const result=endingInitAfterLoad(...args);restoreEndingUI();return result;};
