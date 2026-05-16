// Step 3-2A: extracted from js/main.js.
// Loaded before js/main.js as a classic script, so existing global calls remain compatible.

/* --------------------
   SOUND (WebAudio)
-------------------- */
const SOUND = {
  enabled: true,
  ctx: null,
  bgmTimer: null,
  unlocked: false,
};
function ensureAudio(){
  if(!SOUND.enabled) return;
  if(SOUND.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return;
  SOUND.ctx = new AC();
}
function unlockAudioOnce(){
  if(SOUND.unlocked) return;
  ensureAudio();
  if(!SOUND.ctx) return;
  // mobile unlock
  const osc = SOUND.ctx.createOscillator();
  const gain = SOUND.ctx.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(SOUND.ctx.destination);
  osc.start();
  osc.stop(SOUND.ctx.currentTime + 0.01);
  SOUND.unlocked = true;
}
function beep({type="square", freq=440, dur=0.08, vol=0.08, sweep=0}){
  if(!SOUND.enabled) return;
  ensureAudio(); if(!SOUND.ctx) return;
  const t0 = SOUND.ctx.currentTime;
  const osc = SOUND.ctx.createOscillator();
  const gain = SOUND.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if(sweep){
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(SOUND.ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function sfxTick(){ beep({freq:760, dur:0.05, vol:0.06}); }
function sfxDing(){ beep({freq:880, dur:0.08, vol:0.09}); beep({freq:1320, dur:0.06, vol:0.07}); }
function sfxWrong(){ beep({freq:180, dur:0.12, vol:0.10, type:"sawtooth"}); }
function sfxFanfare(){ beep({freq:660, dur:0.08, vol:0.08}); beep({freq:880, dur:0.08, vol:0.08}); beep({freq:1180, dur:0.10, vol:0.09}); }
function sfxConfirm(){ beep({freq:980, dur:0.06, vol:0.08}); beep({freq:1480, dur:0.06, vol:0.07}); }

// [호환] 기존 코드에서 AudioEngine.sfx.* 호출을 쓰는 부분이 있어 래퍼를 둡니다.
const AudioEngine = {
  sfx: {
    coin: () => sfxDing(),
    fanfare: () => sfxFanfare(),
    wrong: () => sfxWrong(),
    tick: () => sfxTick(),
    confirm: () => sfxConfirm(),
  }
};

function startBGM(){
  if(!SOUND.enabled) return;
  ensureAudio(); if(!SOUND.ctx) return;
  stopBGM();

  // 리듬감 있는 2-바 루프 (킥/스네어/하이햇 + 베이스)
  // - 너무 반복적이지 않게 2마디마다 코드/베이스를 살짝 바꿉니다.
  const stepMs = 110; // 템포(약 136bpm 느낌)
  let step = 0;

  const kick = () => beep({freq:110, dur:0.05, vol:0.055, type:"sine"});
  const snare = () => beep({freq:220, dur:0.045, vol:0.035, type:"sawtooth"});
  const hat = () => beep({freq:2200, dur:0.02, vol:0.015, type:"square"});
  const bass = (f) => beep({freq:f, dur:0.08, vol:0.028, type:"square"});

  // 32-step(2마디) 패턴
  const kickSteps = new Set([0, 6, 8, 14, 16, 22, 24, 30]);
  const snareSteps = new Set([4, 12, 20, 28]);
  const hatSteps = new Set(Array.from({length:32}, (_,i)=>i).filter(i => i%2===0));

  // 베이스 진행(2마디)
  const bassA = [98,98,110,98,  87,87,98,87];   // G2/A2 느낌
  const bassB = [110,110,123,110, 98,98,110,98]; // 조금 상승

  SOUND.bgmTimer = setInterval(()=>{
    if(!SOUND.enabled || !SOUND.ctx) return;

    const s = step % 32;

    // 드럼
    if(kickSteps.has(s)) kick();
    if(snareSteps.has(s)) snare();
    if(hatSteps.has(s)) hat();

    // 베이스 (4스텝마다)
    if(s % 4 === 0){
      const bar = Math.floor(s/16); // 0 or 1
      const idx = Math.floor((s%16)/2) % 8;
      const f = (bar===0 ? bassA[idx] : bassB[idx]);
      bass(f);
    }

    step++;
  }, stepMs);
}
function stopBGM(){
  if(SOUND.bgmTimer){
    clearInterval(SOUND.bgmTimer);
    SOUND.bgmTimer = null;
  }
}
function setSoundEnabled(v){
  SOUND.enabled = !!v;
  if(!SOUND.enabled){
    stopBGM();
  }else{
    unlockAudioOnce();
    startBGM();
  }
}
