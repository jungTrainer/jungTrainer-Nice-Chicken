// Extracted from index.html by scripts/prepare-step2-5-split-main-js.py
// ===== Boot safety net =====
(function(){
  const hideSplash = () => {
    const s = document.getElementById("splashScreen");
    if(s) s.style.display = "none";
  };
  window.addEventListener("error", (ev) => {
    console.error("Global error:", ev.error || ev.message);
    hideSplash();
    // show minimal overlay
    let o = document.getElementById("__err_overlay");
    if(!o){
      o = document.createElement("div");
      o.id = "__err_overlay";
      o.style.position = "fixed";
      o.style.left = "0";
      o.style.top = "0";
      o.style.right = "0";
      o.style.bottom = "0";
      o.style.background = "rgba(0,0,0,.75)";
      o.style.color = "#fff";
      o.style.zIndex = "99999";
      o.style.padding = "16px";
      o.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      o.style.whiteSpace = "pre-wrap";
      document.body.appendChild(o);
    }
    o.textContent = "오류가 발생했지만 게임이 멈추지 않도록 복구를 시도했습니다.\n\n" +
      String(ev.error ? (ev.error.stack || ev.error) : ev.message);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("Unhandled rejection:", ev.reason);
    hideSplash();
  });
  window.__hideSplash = hideSplash;
})();


/* [Boot splash block removed: was duplicated/broken] */

/* =========================================================
   나이스치킨 타이쿤 (최종 통합)
   - 사운드(WebAudio) + 설정 토글
   - 스폰 랜덤 체감(대기열 2x5 그리드) + 선택 손님 중앙 서빙 포인트
   - 문(우측 하단) + leaving 상태로 퇴장 연출
   - 배경: 매장 느낌(카운터/테이블/문)
   - 보스/알바 겹침 해결: 보스 상단, 알바 하단(Y 분리), 크기 소폭 축소
   - 유저 이름(최초 입력): 한글만, 10글자, 빈값 허용 / 헤더&인증서에 그대로 표시
   - 일간 올클 -> 무/양배추 쿠폰(veg) 지급
   - 주간 올클 -> 인증서 발급 가능 / 발급 시 음료 쿠폰(drink) 1장 지급
   - 인증서/쿠폰 사용 -> PIN(0000) + 로그 기록
   - 주간 인증서 "사용 처리" -> PIN 성공 시 주간 초기화 + 로그
   - 5,000만원당 음료쿠폰 1장 교환(상점)
========================================================= */

const SAVE_KEY = "niceChicken_idleServe_vFinal";

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

/* --------------------
   CONFIG
-------------------- */
// [추가] 배달 이동수단 데이터
const VEHICLES = [
  { id: 0, name: "튼튼한 두 다리", emoji: "🏃", speed: 10000, bonus: 0 },
  { id: 1, name: "자전거", emoji: "🚲", speed: 8000, bonus: 500 },
  { id: 2, name: "전동 킥보드", emoji: "🛴", speed: 7000, bonus: 1000 },
  { id: 3, name: "배달 오토바이", emoji: "🛵", speed: 6000, bonus: 1500 },
  { id: 4, name: "경차 (레이)", emoji: "🚗", speed: 5000, bonus: 2000 },
  { id: 5, name: "배달 드론", emoji: "🚁", speed: 4000, bonus: 3000 },
  { id: 6, name: "제트기", emoji: "✈️", speed: 3000, bonus: 5000 },
  { id: 7, name: "로켓 배송", emoji: "🚀", speed: 2000, bonus: 8000 },
  { id: 8, name: "UFO", emoji: "🛸", speed: 1000, bonus: 15000 },
  { id: 9, name: "순간이동 포털", emoji: "🌀", speed: 100, bonus: 50000 },
  { id: 10, name: "차원문 익스프레스", emoji: "🧿", speed: 60, bonus: 80000 }
];

// [전역 변수 추가]
let deliveryTimer = 0;
let onlineTimer = 0;
let visualRiders = []; // 화면에 지나가는 라이더 연출용
let deliveryNextIntervalMs = null; // 다음 배달 간격(ms)
let deliveryVisualAcc = 0;        // 배달 비주얼 누적(초)
let deliveryNextVisualSec = 0;    // 다음 비주얼 라이더 생성 간격(초)

const CONFIG = {
  version: 10,

  baseOrdersPerMin: 10 * 1.50,
  baseAutoServesPerMin: 0.8,

  maxCustomers: 10,
  offlineMaxHours: 8,

  repMax: 5.0,
  repMin: 0.0,
  repGainOnCorrect: 0.03,
  repLossOnWrong: 0.15,
  repLossOnLeave: 0.25,
  repRecoverIdlePerSec: 0.010,
  repDecayCrowdPerSec: 0.010,

  levelUpTotalSales: [0, 120000, 300000, 650000, 1100000, 1700000, 2400000, 3200000, 4100000, 5200000],

  fixedStep: 0.1,
  maxFrameDt: 0.25,
  autosaveSec: 30,

  eventCheckIntervalSec: 1.0,
  eventRollChancePerCheck: 0.015,

  walkSpeedMin: 55,
  walkSpeedMax: 90,

  exchangeUnit: 50000000, // 5,000만원
  pin: "0000",
};

// --- [NEW] Level table auto-generation (up to 50) ---
(function ensureLevelTable(){
  const MAX_LV = 999;

  // Rebuild level table to 0..MAX_LV.
  // Threshold = lifetime sales required to reach that level.
  // Curve: base * exp(a*lv + b*lv^2) tuned so Lv.999 is near 1e70 (still below ending 9.99e70).
  const base = 100000;         // 1e5
  const a = 0.02;
  const b = 0.0001299;

  const arr = new Array(MAX_LV+1).fill(0);
  for(let lv=1; lv<=MAX_LV; lv++){
    const x = (a*lv) + (b*lv*lv);
    const req = Math.floor(base * Math.exp(x));
    arr[lv] = req;
  }
  arr[0] = 0;
  CONFIG.levelUpTotalSales = arr;
  CONFIG.maxLevel = MAX_LV;
})();

/* --------------------
   MENUS (9개)
-------------------- */
/* --- [데이터] 가격 인플레이션 적용 --- */

/* --- [NEW] Regions (fixed order) --- */
/* --- [NEW] Regions (fixed order) --- */
// NOTE: 큰 수(조/경 단위) 때문에 Number 정밀도 한계가 있을 수 있으나, 게임 플레이 목적상 허용한다.
const REGIONS = [
  { id:"changnyeong", name:"창녕 본점",  desc:"시골 감성, 모든 것의 시작.",        icon:"🏡", unlockCost:0,                    priceMul:1.0,         costMul:1.0,      theme:"rural"  },
  { id:"busan",       name:"부산 해운대", desc:"바다 냄새와 관광객, 높은 진입장벽.", icon:"🌊", unlockCost:50_000_000_000,        priceMul:50.0,        costMul:5.0,      theme:"beach"  },
  { id:"seoul",       name:"서울 강남",  desc:"야경과 빌딩숲, 돈도 욕망도 폭발.",    icon:"🏙️", unlockCost:20_000_000_000_000,   priceMul:2_000.0,     costMul:50.0,     theme:"city"   },
  { id:"japan",       name:"일본 도쿄",  desc:"벚꽃 아래 초고속 성장.",              icon:"🌸", unlockCost:10_000_000_000_000_000, priceMul:50_000.0,   costMul:500.0,    theme:"sakura" },
  { id:"usa",         name:"미국 뉴욕",  desc:"자본의 심장, 수익도 물가도 미쳤다.",  icon:"🗽", unlockCost:500_000_000_000_000_000, priceMul:2_000_000.0, costMul:5_000.0, theme:"usa"    },
  { id:"mars",        name:"화성 기지",  desc:"인류 최후의 프랜차이즈.",             icon:"🪐", unlockCost:20_000_000_000_000_000_000, priceMul:100_000_000.0, costMul:100_000.0, theme:"mars" }
];
const REGION_MAP = Object.fromEntries(REGIONS.map(r=>[r.id,r]));
function getRegion(){
  const id = state?.regionId || REGIONS[0].id;
  return REGION_MAP[id] || REGIONS[0];
}
function getRegionIndex(id){
  return REGIONS.findIndex(r=>r.id===id);
}
function getNextRegion(){
  const idx = getRegionIndex(state?.regionId || REGIONS[0].id);
  return REGIONS[Math.min(REGIONS.length-1, idx+1)];
}


/* --------------------
   Branch Manager (Multi-Branch Snapshots)
   - Money is shared (HQ funds)
   - Upgrades/staff/menu/research/missions/sales/etc are per-branch
   - Implemented by swapping snapshots into the existing top-level state fields
-------------------- */
function _branchDefaultData(){
  const d = defaultState();
  // pick "store-local" fields only
  return {
    rep: d.rep,
    level: d.level,
    todaySales: d.todaySales,
    totalSales: d.totalSales,
    offlineSalesToday: d.offlineSalesToday,
    offlineSalesTotal: d.offlineSalesTotal,

    menuLevels: JSON.parse(JSON.stringify(d.menuLevels)),
    menuStats: JSON.parse(JSON.stringify(d.menuStats)),
    contrib: JSON.parse(JSON.stringify(d.contrib)),
    stamps: d.stamps,

    payroll: JSON.parse(JSON.stringify(d.payroll)),

    upgrades: JSON.parse(JSON.stringify(d.upgrades)),
    delivery: JSON.parse(JSON.stringify(d.delivery)),
    online: JSON.parse(JSON.stringify(d.online)),
    research: JSON.parse(JSON.stringify(d.research)),
    missions: JSON.parse(JSON.stringify(d.missions)),

    // runtime-ish, but keep per-branch for UX
    customers: [],
    selectedCustomerId: null,

    event: null,
    _spawnAcc: 0,
    _autoServeAcc: 0,
  };
}
function _branchKeys(){
  return [
    "rep","level","todaySales","totalSales","offlineSalesToday","offlineSalesTotal",
    "menuLevels","menuStats","contrib","stamps",
    "payroll","upgrades","delivery","online","research","missions",
    "customers","selectedCustomerId","event","_spawnAcc","_autoServeAcc"
  ];
}

const BranchManager = {
  bootstrap(){
    // ensure base unlocked
    state.regionUnlocked = state.regionUnlocked || {};
    state.regionUnlocked[REGIONS[0].id] = true;

    // ensure current branch snapshot exists, then load it
    if(!state.branches) state.branches = {};
    const cur = state.regionId || REGIONS[0].id;
    if(!state.branches[cur]){
      state.branches[cur] = { unlocked:true, data:_branchDefaultData() };
      // migrate current top-level store fields into the snapshot once
      this.saveCurrentTo(cur);
    }
    // load snapshot into top-level (so fields are never undefined)
    this.loadFrom(cur, { resetRuntime:false });
  },

  ensure(id){
    if(!state.branches) state.branches = {};
    if(!state.branches[id]){
      state.branches[id] = { unlocked:true, data:_branchDefaultData() };
    }
    return state.branches[id];
  },

  saveCurrent(){
    const cur = state.regionId || REGIONS[0].id;
    this.saveCurrentTo(cur);
  },

  saveCurrentTo(id){
    const b = this.ensure(id);
    b.unlocked = true;
    const keys = _branchKeys();
    b.data = b.data || _branchDefaultData();
    keys.forEach(k=>{
      // deep clone objects to avoid accidental shared refs
      const v = state[k];
      if(v && typeof v === "object"){
        b.data[k] = JSON.parse(JSON.stringify(v));
      }else{
        b.data[k] = v;
      }
    });
    state.branches[id] = b;
  },

  loadFrom(id, { resetRuntime=true } = {}){
    const b = this.ensure(id);
    const keys = _branchKeys();
    b.data = b.data || _branchDefaultData();
    keys.forEach(k=>{
      const v = b.data[k];
      if(v && typeof v === "object"){
        state[k] = JSON.parse(JSON.stringify(v));
      }else{
        state[k] = v;
      }
    });

    if(resetRuntime){
      // do NOT carry over visual selections/float texts etc
      state.customers = [];
      state.selectedCustomerId = null;
      try{ floats = []; }catch(e){}
      try{ selectedId = null; }catch(e){}
    }
  },

  move(id){
    if(!state.regionUnlocked || !state.regionUnlocked[id]){
      showToast("아직 해금되지 않은 지역이에요!");
      return false;
    }
    // save current, then move
    this.saveCurrent();
    state.regionId = id;
    this.ensure(id);
    this.loadFrom(id, { resetRuntime:true });

    // close UI & redraw with new branch data
    closePanels();
    buildMenuGrid();
    updateUI();
    updateStatsUI();
    renderMapUI();

    _saveDirty = true;
    save(true);
    const nm = REGION_MAP[id]?.name || id;
    showToast(`지역 이동: ${nm}`);
    return true;
  },

  unlockNext(){
    const cur = getRegion();
    const next = getNextRegion();
    if(cur.id === next.id){
      showToast("이미 마지막 지역이에요!");
      return false;
    }
    const need = next.unlockCost || 0;
    if(state.money < need){
      showToast(`해금 비용 부족: ${fmtCompact(need)}`);
      return false;
    }
    state.money -= need;

    state.regionUnlocked = state.regionUnlocked || {};
    state.regionUnlocked[next.id] = true;

    this.ensure(next.id); // prepare branch slot
    state.mapSelected = next.id;

    _saveDirty = true;
    save(true);
    updateUI();
    renderMapUI();
    showToast(`${next.name} 해금 완료!`);
    AudioEngine.sfx.confirm();
    return true;
  }
};


const MENUS = [
  // Tier 1: 초반
  { id:"fried", name:"후라이드", price: 15000, emoji:"🍗" },
  { id:"yang", name:"양념치킨", price: 28000, emoji:"🥡" },
  { id:"soy_hot", name:"간장매운맛", price: 45000, emoji:"🌶️" },
  // Tier 2: 중반 (가격 점프)
  { id:"boneless_feet", name:"뼈없는닭발", price: 150000, emoji:"🔥" },
  { id:"roast", name:"바베큐", price: 350000, emoji:"🍖" },
  { id:"garlic_roast", name:"마늘통구이", price: 650000, emoji:"🧄" },
  // Tier 3: 후반 (수백만원~수천만원대)
  { id:"gizzard_s", name:"황금닭똥집", price: 2500000, emoji:"🍟" },
  { id:"doritang", name:"궁중도리탕", price: 8000000, emoji:"🍲" },
  { id:"buldak", name:"지옥불닭", price: 30000000, emoji:"🥵" },
];
const MENU_MAP = Object.fromEntries(MENUS.map(m => [m.id, m]));

/* --- [로직] 가격 계산 (가게확장 + 전체연구 + 메뉴연구) --- */
function getMenuPrice(menuId){
  const base = (MENU_MAP[menuId]?.price) || 0;

  // 1) 가게 확장: 레벨당 +20%
  const expandLvl = state?.upgrades?.expand || 0;
  const expandMult = 1 + (expandLvl * 0.45);

  // 2) 전체 연구(기존 secretSauce 레벨당 +10% 유지)
  const globalBonus = ((state?.research?.levels?.secretSauce) || 0) * 0.10;

  // 3) 메뉴별 연구: 레벨당 +50%
  const menuLvl = (state?.menuLevels?.[menuId]) || 0;
  const menuBonus = menuLvl * 0.50;

  const levelMult = 1 + ((Number(state?.level)||0) * 0.10);
  const regionMul = (typeof getRegion === "function" ? ((getRegion()?.priceMul)||1) : 1);
  const finalPrice = base * expandMult * (1 + globalBonus + menuBonus) * levelMult * regionMul;
  return Math.floor(finalPrice);
}
/* --------------------
   Customers emojis
-------------------- */
const CUSTOMER_EMOJIS = [
  "😀","😄","😎","🥸","🤓",
  "🧑","👩","👨","👧","👦",
  "👴","👵",
  "🧔","👱‍♀️","👱‍♂️",
  "🎅","🤶",
  "👽",
  "👩‍🚀","👨‍🚀",
  "🧙‍♂️","🧙‍♀️",
  "🧟‍♂️","🧟‍♀️"
];

/* --------------------
   Family staff (max 5)
-------------------- */
const STAFF_POOL = [
  { key:"neighbor",  label:"남편", emoji:"👴", grade:"C", baseSpeed:1.0, baseCap:1.0, lines: ["여보~ 치맥 한잔? 🍺", "오늘 기분 째진다! 🎤", "인생 뭐 있어~ 캬!", "안주 죽이네~ 🍗", "노래방 고고? 🎶"] },
  { key:"ato",       label:"아토", emoji:"🐶", grade:"C", baseSpeed:1.2, baseCap:1.0, lines: ["멍멍! 🦴", "왈왈!! 🐾", "크르릉... 🐕", "헥헥! 👅", "낑낑... 💕"] },
  { key:"daughter1", label:"첫째딸", emoji:"👧", grade:"B", baseSpeed:1.1, baseCap:1.1, lines: ["아빠 용돈 좀~ 💸", "나 이거 사줘! 🎁", "아 몰라 귀찮아~ 📱", "배고파 밥 줘! 🍔", "내 옷 어때? 👗"] },
  { key:"daughter2", label:"둘째딸", emoji:"👩", grade:"B", baseSpeed:1.1, baseCap:1.1, lines: ["여보 사랑해~ 💖", "우리 아가 이쁘네 👶", "행복한 우리집 🏡", "고생했어 여보! ✨", "사랑해요~ 💕"] },
  { key:"soninlaw",  label:"둘째사위", emoji:"👦", grade:"A", baseSpeed:1.25, baseCap:1.2, lines: ["장인어른 최고! 👍", "여보 사랑해! 😍", "우리 아들 천재? 🎓", "가족을 위하여! 🍻", "힘이 납니다! 💪"] },
  { key:"grandson",  label:"손자", emoji:"👶", grade:"S", baseSpeed:1.5, baseCap:1.35, lines: ["멍멍! 🐶", "꽥꽥! 🦆", "음메~ 🐄", "딸기! 🍓", "블루베리! 🫐"] }
];

// 👇👇👇 여기서부터 잃어버린 함수 복구 코드! 복사해서 끼워 넣게! 👇👇👇
function ensureStaffStats(){
  if(!state.staffStats) state.staffStats = {};
  for(const s of STAFF_POOL){
    if(!state.staffStats[s.key]){
      state.staffStats[s.key] = { auto:0, tip:0, earned:0 };
    }else{
      const o = state.staffStats[s.key];
      if(o.auto==null) o.auto=0;
      if(o.tip==null) o.tip=0;
      if(o.earned==null) o.earned=0;
    }
  }
  if(!state.contrib) state.contrib = { player:0, staff:0, system:0 };
  if(state._autoStaffIdx==null) state._autoStaffIdx = 0;
}
// ==========================================
// [NEW] 글로벌 이펙트 및 헬퍼 함수
// ==========================================
window._fxState = {
  boss: { lastClick: 0, taps: 0, buffUntil: 0, buffCount: 0, buffDate: "" },
  staffs: {}, 
  speech: { type: null, key: null, msg: "", until: 0 }
};

function isGlobalBuffActive(excludeKey) {
  const now = Date.now();
  if (excludeKey !== 'boss' && window._fxState.boss.buffUntil > now) return true;
  for (const key in window._fxState.staffs) {
      if (key !== excludeKey && window._fxState.staffs[key].buffUntil > now) return true;
  }
  return false;
}

function getClickScale(lastClickTime) {
  const now = Date.now();
  const elapsed = now - lastClickTime;
  // 100ms 내에 20% 축소 -> 200ms까지 10% 확대 -> 300ms 원상복구 (완벽한 텐션!)
  if (elapsed < 100) return 1.0 - (elapsed / 100) * 0.2;
  else if (elapsed < 200) return 0.8 + ((elapsed - 100) / 100) * 0.3;
  else if (elapsed < 300) return 1.1 - ((elapsed - 200) / 100) * 0.1;
  else return 1.0;
}

function staffUpgradeCost(staffKey, kind, cur){
  // kind: 'auto'(서빙 마스터) or 'tip'(서비스 교육)
  const s = STAFF_POOL.find(x=>x.key===staffKey);
  const gradeMul = (s?.grade==="S")?2.2:(s?.grade==="A")?1.8:(s?.grade==="B")?1.4:1.0;

  if(kind==="auto"){
    const base = 80000;
    return Math.floor(base * gradeMul * Math.pow(1.9, cur));
  }else{ // tip
    const base = 100000;
    return Math.floor(base * gradeMul * Math.pow(1.85, cur));
  }
}

function menuUnlockCost(lvl){
  // lvl은 "현재 레벨"이며, 다음 1단계 해금 비용을 반환합니다.
  // 초반 접근성 ↑, 후반 목표감 ↑ (기하급수 상승)
  const table = [
    200000,      // 0 -> 1 : 20만
    800000,      // 1 -> 2 : 80만
    2500000,     // 2 -> 3 : 250만
    8000000,     // 3 -> 4 : 800만
    25000000,    // 4 -> 5 : 2,500만
    80000000,    // 5 -> 6 : 8,000만
    250000000,   // 6 -> 7 : 2.5억
    800000000,   // 7 -> 8 : 8억
    2500000000,  // 8 -> 9 : 25억
    8000000000,  // 9 -> 10: 80억
  ];
  if(lvl < table.length) return table[lvl];
  const last = table[table.length-1];
  return Math.floor(last * Math.pow(3.2, lvl - (table.length-1)));
}

function upStaff(key, kind, cost){
  try{
    ensureStaffStats();
    if(!state.staffStats) state.staffStats = {};
    if(!state.staffStats[key]) state.staffStats[key] = { auto:0, tip:0, earned:0 };
    const st = state.staffStats[key];

    // 비용 재계산(0/NaN 방지)
    const curLvl = (st[kind]||0);
    let c = Number(cost);
    if(!isFinite(c) || c <= 0) c = staffUpgradeCost(key, kind, curLvl);
    c = Math.max(1000, Math.floor(c)); // 최소 1,000원

    if(state.money < c){
      if(typeof toast === "function") toast("돈이 부족해요!");
      else alert("돈이 부족해요!");
      return;
    }
    state.money -= c;
    st[kind] = curLvl + 1;

    if(typeof AudioEngine !== "undefined" && AudioEngine.play) AudioEngine.play("coin");
    saveGame();
    updateUI();
    // 업그레이드 패널이 열려있다면 즉시 갱신
    try{ renderPanel("upg"); }catch(e){}
  }catch(e){
    console.error("[upStaff]", e);
  }
}


function buyStaffUpgrade(staffKey, kind){
  ensureStaffStats();
  if(kind!=="auto" && kind!=="tip") return;
  const st = state.staffStats[staffKey];
  if(!st) return;
  const cur = st[kind]||0;
  if(cur>=10){ showToast("이미 최대 레벨!"); sfxWrong?.(); return; }

  const cost = staffUpgradeCost(staffKey, kind, cur);
  if(state.money < cost){ showToast("돈이 부족해요!"); sfxWrong?.(); return; }

  state.money -= cost;

  // missions: upgrade purchase counter
  state.missions = state.missions || {};
  state.missions._upgBuysToday = (state.missions._upgBuysToday||0) + 1;
  state.missions._weekUpgBuys  = (state.missions._weekUpgBuys||0) + 1;
  st[kind] = cur + 1;
  _saveDirty = true;

  const who = STAFF_POOL.find(s=>s.key===staffKey)?.label||"직원";
  showToast(`${who} ${kind==="auto"?"서빙 마스터":"서비스 교육"} Lv.${st[kind]}!`);
  sfxConfirm?.();

  save(true);
  updateUI();
  renderPanel("upg");
}
// 0~10 level curve: small gains until 4, big gains from 5+
function levelCurve(lv){
  lv = Math.max(0, Math.min(10, lv|0));
  if(lv<=0) return 0;
  if(lv<5) return lv*0.08;
  return (5*0.08) + (lv-5)*0.22;
}

function genericStaffUpgradeCost(lv, mult=1){
  return Math.floor(50000 * mult * Math.pow(2.0, lv));
}


/* --------------------
   Upgrades
-------------------- */
let UPGRADES = [

  { id:"signboard", cat:"마케팅", name:"간판 교체", maxLevel:10, desc:"주문 유입 증가", costFn: l => 20000000 * Math.pow(2.2, l), effect:{ ordersMul:+0.12 } },
  { id:"interior", cat:"시설", name:"인테리어 변경", maxLevel:10, desc:"주문 유입 증가 + 배경 밝아짐", costFn: l => 30000000 * Math.pow(2.1, l), effect:{ ordersMul:+0.10 } },
  { id:"hire", cat:"직원", name:"알바 고용", maxLevel:6, desc:"가족 알바생 추가", costFn: l => 50000 * Math.pow(3, l), effect:{ staffCount:+1 } },
  // NOTE: '동기 부여(motivation_removed)' 삭제됨 — 직원은 개별 육성(속도/서비스 교육)으로 성장
  { id:"menuUnlock", cat:"시설", name:"메뉴 해금", maxLevel:8, desc:"메뉴 1개 해금 (1회당 1개)", costFn: l => { const costs=[10000000,50000000,100000000,500000000,2000000000,8000000000,32000000000,128000000000];
 return costs[Math.min(l,costs.length-1)]; }, effect:{} },
  { id:"expand", cat:"시설", name:"가게 확장", maxLevel:20, desc:"전체 메뉴 가격 +20% (레벨당)", costFn: l => 150000 * Math.pow(1.6, l), effect:{} },
  { id:"promo", cat:"마케팅", name:"전단지 배포", maxLevel:10, desc:"방문 속도 증가", costFn: l => 80000 * Math.pow(1.4, l), effect:{ walkSpeedMul:+0.03 } },

  /* --- [NEW] 배달 시스템 --- */
  { id:"deliRider",   cat:"배달", name:"라이더 고용", maxLevel:10, desc:"배달 자동 수익 +라이더(빈도↑)", costFn: l => 120000 * Math.pow(2.2, l), effect:{} },
  { id:"deliVehicle", cat:"배달", name:"이동수단 업그레이드", maxLevel:10, desc:"배달 수익/속도 보너스", costFn: l => 450000 * Math.pow(2.35, l), effect:{} },

];

/* --------------------
   Research
-------------------- */

// [NEW] 인테리어(벽지/바닥) 팔레트 (브랜치별 deco가 있으면 drawBackground에서 우선 적용)
const DECOS = [
  { id:"bg_basic",   name:"기본",        color:"#5D4037" },
  { id:"bg_wood",    name:"우드",        color:"#6D4C41" },
  { id:"bg_pink",    name:"러블리 핑크", color:"#F8BBD0" },
  { id:"bg_mint",    name:"민트",        color:"#C8E6C9" },
  { id:"bg_sky",     name:"스카이",      color:"#BBDEFB" },
  { id:"bg_lemon",   name:"레몬",        color:"#FFF9C4" },
  { id:"bg_lavender",name:"라벤더",      color:"#D1C4E9" },
  { id:"bg_gray",    name:"모던 그레이", color:"#E0E0E0" }
];
const RESEARCH = [
  // 기존 연구(10단계 강화형)
  { id:"secretSauce", name:"비법 소스", baseMin:6, timeScale:1.35, maxLevel:10,
    desc:"전체 매출 증가",
    effectPerLevel:{ earningMul:+0.06 } }, // Lv10 = +60%
  { id:"crispy", name:"바삭함 강화", baseMin:5, timeScale:1.32, maxLevel:10,
    desc:"손님 이탈 평점 하락 감소",
    effectPerLevel:{ leaveRepLossAdd:-0.008 } }, // Lv10 = -0.08
  { id:"training", name:"직원 교육", baseMin:6, timeScale:1.33, maxLevel:10,
    desc:"알바/가족 속도 증가",
    effectPerLevel:{ staffSpeedMul:+0.03 } }, // Lv10 = +30%
  { id:"menuBoard", name:"메뉴판 개선", baseMin:5, timeScale:1.30, maxLevel:10,
    desc:"주문 유입 증가",
    effectPerLevel:{ ordersMul:+0.025 } }, // Lv10 = +25%
  { id:"freshOil", name:"기름 관리", baseMin:5, timeScale:1.31, maxLevel:10,
    desc:"오답 패널티 완화(인내심 감소 완화)",
    effectPerLevel:{ wrongPatiencePenaltyMul:-0.02 } }, // Lv10 = -20%
  { id:"prep", name:"사전 준비", baseMin:5, timeScale:1.34, maxLevel:10,
    desc:"기본 자동 운영 증가",
    effectPerLevel:{ baseAutoAdd:+0.15 } }, // Lv10 = +1.5/min
  { id:"rushHour", name:"피크타임 대응", baseMin:7, timeScale:1.34, maxLevel:10,
    desc:"이벤트 중 자동 운영 감소 완화",
    effectPerLevel:{ eventAutoResist:+0.03 } }, // Lv10 = +30%
  { id:"talk", name:"친절 멘트", baseMin:4, timeScale:1.28, maxLevel:10,
    desc:"손님 인내심 증가",
    effectPerLevel:{ patienceBonus:+0.35 } }, // Lv10 = +3.5

  // 신규 연구 5종
  { id:"deliveryOps", name:"배달 동선 최적화", baseMin:6, timeScale:1.36, maxLevel:10,
    desc:"배달 빈도/수익 동시 강화",
    effectPerLevel:{ deliveryFreqMul:+0.04, deliveryEarningMul:+0.05 } }, // Lv10: 빈도+40%, 수익+50%
  { id:"onlineAlgo", name:"온라인 알고리즘 공략", baseMin:6, timeScale:1.35, maxLevel:10,
    desc:"온라인 주문 오토 강화",
    effectPerLevel:{ onlineFreqMul:+0.05, onlineEarningMul:+0.04 } },
  { id:"kitchenAuto", name:"주방 자동화", baseMin:7, timeScale:1.35, maxLevel:10,
    desc:"자동서빙 효율 강화",
    effectPerLevel:{ autoServeMul:+0.05 } },
  { id:"vipCare", name:"VIP 대기 관리", baseMin:6, timeScale:1.33, maxLevel:10,
    desc:"손님 체류/이탈 방어 강화",
    effectPerLevel:{ patienceMul:+0.03 } },
  { id:"packPremium", name:"프리미엄 포장", baseMin:6, timeScale:1.34, maxLevel:10,
    desc:"포장/배달/온라인 시너지 강화",
    effectPerLevel:{ deliveryEarningMul:+0.03, onlineEarningMul:+0.03 } },
];

/* --------------------
   Events
-------------------- */
const EVENTS = [
  { id:"rain", name:"☔ 비 오는 날", durationSec:35, desc:"주문 +35%, 인내심 -10%", mod:{ ordersMul:+0.35, patienceMul:-0.10 } },
  { id:"match", name:"⚽ 경기 있는 날", durationSec:30, desc:"주문 +55%", mod:{ ordersMul:+0.55 } },
  { id:"supply", name:"🚚 재료 수급 이슈", durationSec:25, desc:"자동 서빙 -25%", mod:{ autoServeMul:-0.25 } },
  { id:"holiday", name:"🧧 명절 특수", durationSec:35, desc:"주문 +60%, 인내심 -15%", mod:{ ordersMul:+0.60, patienceMul:-0.15 } },
  { id:"weekend",  name:"🌙 주말 야식 피크", durationSec:40, desc:"주문 +60%", mod:{ ordersMul:+0.60 } },
  { id:"school",   name:"🏫 하교/학원 러시", durationSec:30, desc:"주문 +60%, 인내심 -10%", mod:{ ordersMul:+0.60, patienceMul:-0.10 } },
  { id:"extreme",  name:"🥶 한파/폭염", durationSec:35, desc:"주문 +55%, 자동 서빙 -15%", mod:{ ordersMul:+0.55, autoServeMul:-0.15 } },
  { id:"festival", name:"🎤 지역 축제/장날", durationSec:35, desc:"주문 +90%, 인내심 +10%", mod:{ ordersMul:+0.90, patienceMul:+0.10 } },

];

/* --------------------
   State
-------------------- */
const defaultState = () => ({
  version: CONFIG.version,

  profile: { name: "" },

  soundOn: true,

  money: 0,
  rep: 5.0,
  level: 1,


  // [BRANCH/REGION] business expansion (multi-branch)
  regionId: "changnyeong",
  // unlocked flags by regionId
  regionUnlocked: { changnyeong: true },
  // per-branch snapshots (regionId -> branchData)
  branches: {},
  // map UI selected node
  mapSelected: "changnyeong",


  todaySales: 0,     // 온라인 매출만
  totalSales: 0,     // 온라인 매출만

  offlineSalesToday: 0,
  offlineSalesTotal: 0,



  // [NEW] 메뉴별 연구/통계
  menuLevels: {}, // { fried: 0, ... }
  menuStats: {},  // { fried: {count:0, earned:0}, ... }

  // [NEW] 매출 기여도
  contrib: { player:0, staff:0, system:0 },
  stamps: 0,

  payroll: {
    lastDayKey: "",
    dailyWage: 80000,
  },

  coupons: { drink: 0, veg: 0 }, // 음료/무양배추
  benefitsLog: [],

  cert: {
    issuedAt: 0,
    // 주간 올클 이후 7일 유효(원문 규칙 유지)
    validUntil: 0,
    // 사용 처리(본사 사용) 여부
    usedAt: 0,
    // 이 주간에 인증서 발급했는지(중복 발급 방지)
    issuedThisWeek: false,
  },

  customers: [],
  selectedCustomerId: null,

  upgrades: {},

  // [추가] 배달/온라인 주문 데이터
  delivery: { level: 0, riders: 0 },
  online: { level: 0 },

  research: {
    slots: 1,
    running: [],
    // 레벨형 연구: id -> level(0~10)
    levels: {},
    // 구버전 호환(미사용)
    completed: [],
  },

  missions: {
    dailyKey: "",
    dailyList: [],
    dailyCompletedToday: false,
    dailyStamps: 0,        // 0~3

    weekStartAt: 0,
    weekEndAt: 0,
    weeklyList: [],
    weeklyStamps: 0,       // 0~7

    weeklyCompletedAt: 0,  // 주간 올클 시각
    _weekStartTotalSales: 0,
  },

  event: null,
  lastSeenAt: Date.now(),

  _spawnAcc: 0,
  _autoServeAcc: 0,
  _saveAcc: 0,
  _eventCheckAcc: 0,
});

/* --------------------
   DOM refs
-------------------- */
let state = defaultState();

/* --------------------
   DOM refs (Variables)
-------------------- */
// UI Elements
let elMoney, elRep, elLvl, elToday, elTotal, elSelected, elUserName;
let toast, menuGrid;
let modalOffline, offlineEarn, offlineTime;
let upgList, resList, dailyList, weeklyList, weeklyStampRow, dailyStampRow, misGuide, weeklyNote;
let eventBanner, eventMsg, eventTimer;
let resStatus, resBar;
let uiDrinkCoupons2, uiVegCoupons2, benefitLogList, uiMoney2, uiExchangeCnt, certStatus;

// Modals
let modalProfile, modalSettings, modalPin, modalCoupons, modalExchange;
let nameInput, pinInput;

// Share / download (optional UI)
let sharePreview, downloadLink;

// Buttons
let toggleSoundBtn, saveNameBtn, claimOfflineBtn, openCouponsBtn, closeCouponsBtn, useDrinkCouponBtn, useVegCouponBtn, useCertDrinkBtn;
let openExchangeBtn, closeExchangeBtn, doExchangeBtn, makeCardBtn, clearLogBtn, pinOkBtn, pinCancelBtn;
let forceSaveBtn, resetAllBtn, closeSettingsBtn;

/* --------------------
   initDOMRefs: 모든 HTML 요소 연결 및 버튼 기능 설정
-------------------- */
function initDOMRefs(){
  // 1. 기본 UI 연결
  elMoney = document.getElementById("uiMoney");
  elRep = document.getElementById("uiRep");
  elLvl = document.getElementById("uiLvl");
  window.uiXpFill = document.getElementById("uiXpFill");
  const lvlPill = document.getElementById("lvlPill");
  if(lvlPill) lvlPill.onclick = ()=>{ const mul = (1 + ((Number(state.level)||0)*0.10)); showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`); };
  elToday = document.getElementById("uiToday");
  elTotal = document.getElementById("uiTotal");
  elSelected = document.getElementById("uiSelected");
  elUserName = document.getElementById("uiUserName");

  // Mission summary UI (top)
  uiVegCoupons = document.getElementById("uiVegCoupons");
  uiDrinkCoupons = document.getElementById("uiDrinkCoupons");
  uiDailyStampText = document.getElementById("uiDailyStampText");
  uiWeeklyStampText = document.getElementById("uiWeeklyStampText");

  // Stamp summary UI (panels)
  stampCountText = document.getElementById("stampCountText");
  stampRow = document.getElementById("stampRow");

  toast = document.getElementById("toast");
  menuGrid = document.getElementById("menuGrid");

  // 2. 모달 및 패널 연결
  modalOffline = document.getElementById("modalOffline");
  offlineEarn = document.getElementById("offlineEarn");
  offlineTime = document.getElementById("offlineTime");

  modalProfile = document.getElementById("modalProfile");
  modalSettings = document.getElementById("modalSettings");
  modalPin = document.getElementById("modalPin");
  modalCoupons = document.getElementById("modalCoupons");
  modalExchange = document.getElementById("modalExchange");

  nameInput = document.getElementById("nameInput");
  pinInput = document.getElementById("pinInput");

  upgList = document.getElementById("upgList");
  resList = document.getElementById("resList");
  dailyList = document.getElementById("dailyList");
  weeklyList = document.getElementById("weeklyList");
  dailyStampRow = document.getElementById("dailyStampRow");
  weeklyStampRow = document.getElementById("weeklyStampRow");
  weeklyNote = document.getElementById("weeklyNote");
  misGuide = document.querySelector("#panel-mis .note");

  eventBanner = document.getElementById("eventBanner");
  eventMsg = document.getElementById("eventMsg");
  eventTimer = document.getElementById("eventTimer");

  resStatus = document.getElementById("resStatus");
  resBar = document.getElementById("resBar");

  uiDrinkCoupons2 = document.getElementById("uiDrinkCoupons2");
  uiVegCoupons2 = document.getElementById("uiVegCoupons2");
  benefitLogList = document.getElementById("benefitLogList");
  uiMoney2 = document.getElementById("uiMoney2");
  uiExchangeCnt = document.getElementById("uiExchangeCnt");
  certStatus = document.getElementById("certStatus");

  // Optional share UI
  sharePreview = document.getElementById("sharePreview");
  downloadLink = document.getElementById("downloadLink");

  // 3. 버튼 연결
  toggleSoundBtn = document.getElementById("toggleSound");
  saveNameBtn = document.getElementById("saveName");
  claimOfflineBtn = document.getElementById("claimOffline");

  openCouponsBtn = document.getElementById("openCoupons");
  closeCouponsBtn = document.getElementById("closeCoupons");
  useDrinkCouponBtn = document.getElementById("useDrinkCoupon");
  useVegCouponBtn = document.getElementById("useVegCoupon");
  useCertDrinkBtn = document.getElementById("useCertDrink");

  openExchangeBtn = document.getElementById("openExchange");
  closeExchangeBtn = document.getElementById("closeExchange");
  doExchangeBtn = document.getElementById("doExchange");

  makeCardBtn = document.getElementById("makeCard");
  clearLogBtn = document.getElementById("clearLog");
  pinOkBtn = document.getElementById("pinOk");
  pinCancelBtn = document.getElementById("pinCancel");

  forceSaveBtn = document.getElementById("forceSave");
  resetAllBtn = document.getElementById("resetAll");
  closeSettingsBtn = document.getElementById("closeSettings");

  // 4. 이벤트 리스너 연결 (변수가 연결된 후 실행되어야 안전함)
  if(closeSettingsBtn){
    closeSettingsBtn.addEventListener("click", ()=> modalSettings && modalSettings.classList.remove("on"));
  }

  if(forceSaveBtn) forceSaveBtn.onclick = ()=>{ save(true); showToast("저장 완료"); };

  if(resetAllBtn) resetAllBtn.onclick = ()=>{
    if(confirm("정말 초기화할까요? (저장 데이터 삭제)")){
      localStorage.removeItem(SAVE_KEY);
      stopBGM();
      state = defaultState();
      initAfterLoad(true);
      if(modalSettings) modalSettings.classList.remove("on");
      showToast("초기화 완료");
    }
  };

  if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
    unlockAudioOnce();
    const next = !state.soundOn;
    state.soundOn = next;
    setSoundEnabled(next);
    toggleSoundBtn.textContent = next ? "ON" : "OFF";
    sfxTick();
    if(_saveDirty) save(true);
  };

  if(openCouponsBtn){
    openCouponsBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      if(modalCoupons) modalCoupons.classList.add("on");
      renderCoupons();
    });
  }

  if(openExchangeBtn){
    openExchangeBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      if(modalExchange) modalExchange.classList.add("on");
      renderExchange();
    });
  }

  if(closeCouponsBtn){
    closeCouponsBtn.addEventListener("click", ()=> modalCoupons && modalCoupons.classList.remove("on"));
  }
  if(closeExchangeBtn){
    closeExchangeBtn.addEventListener("click", ()=> modalExchange && modalExchange.classList.remove("on"));
  }

  if(clearLogBtn){
    clearLogBtn.addEventListener("click", ()=>{
      if(confirm("혜택 내역을 정리할까요? (로그만 삭제)")){
        state.benefitsLog = [];
        if(_saveDirty) save(true);
        renderCoupons();
        showToast("기록 정리 완료");
      }
    });
  }

  // PIN 입력 관련
  if(pinCancelBtn){
    pinCancelBtn.addEventListener("click", ()=>{
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(false); pinResolver = null; }
    });
  }
  if(pinOkBtn){
    pinOkBtn.addEventListener("click", ()=>{
      const ok = (pinInput && pinInput.value === CONFIG.pin);
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(ok); pinResolver = null; }
    });
  }
  if(pinInput) pinInput.addEventListener("keydown",(e)=>{
    if(e.key==="Enter" && pinOkBtn) pinOkBtn.click();
  });

  // 이름 저장
  if(saveNameBtn) saveNameBtn.onclick = ()=>{
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
  };

  // 오프라인 수익 수령
  if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
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
  };

  // 인증서 및 쿠폰 사용
  if(makeCardBtn){
    makeCardBtn.addEventListener("click", ()=>{
      unlockAudioOnce(); startBGM();
      generateWeeklyCertificate();
    });
  }
  if(useCertDrinkBtn){
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
      if(!confirm("음료 서비스 사용 처리(본사 사용)하시겠어요?\nPIN CODE 입력이 필요합니다.")){
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
  }

  if(useDrinkCouponBtn){
    useDrinkCouponBtn.addEventListener("click", ()=>{ unlockAudioOnce(); startBGM(); useCoupon("drink"); });
  }
  if(useVegCouponBtn){
    useVegCouponBtn.addEventListener("click", ()=>{ unlockAudioOnce(); startBGM(); useCoupon("veg"); });
  }

  if(doExchangeBtn){
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
  }





  const openMapBtn = document.getElementById("openMap");
  const modalExpansionEl = document.getElementById("modalExpansion");
  if(openMapBtn){
    openMapBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      if(modalExpansionEl) modalExpansionEl.classList.add("on");
      renderMapUI();
    });
  }

  const mapGoBtn = document.getElementById("mapGo");
  if(mapGoBtn){
    mapGoBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      const id = state.mapSelected || state.regionId;
      if(typeof BranchManager !== "undefined" && BranchManager.move) BranchManager.move(id);
    });
  }

  const mapUnlockBtn = document.getElementById("mapUnlock");
  if(mapUnlockBtn){
    mapUnlockBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      if(typeof BranchManager !== "undefined" && BranchManager.unlockNext) BranchManager.unlockNext();
    });
  }

  const mapWrapEl = document.getElementById("mapWrap");
  if(mapWrapEl){
    mapWrapEl.addEventListener("click", (e)=>{
      const node = e.target.closest('.map-node[data-action="select-region"]');
      if(!node || !mapWrapEl.contains(node)) return;
      const id = node.dataset.regionId;
      if(!id) return;
      state.mapSelected = id;
      renderMapUI();
    });
  }


  const expansionActionModalEl = document.getElementById("modalExpansion");
  if(expansionActionModalEl){
    expansionActionModalEl.addEventListener("click", (e)=>{
      const btn = e.target.closest('[data-action="move-branch"], [data-action="unlock-branch"]');
      if(!btn || !expansionActionModalEl.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.regionId;
      if(!id) return;
      if(btn.dataset.action === "move-branch") moveBranch(id);
      else if(btn.dataset.action === "unlock-branch") unlockBranch(id);
    });
  }

  const closeExpansionModalBtn = document.getElementById("closeExpansionModalBtn");
  if(closeExpansionModalBtn){
    closeExpansionModalBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(typeof closeExpansionModal === "function") closeExpansionModal();
      else document.getElementById("modalExpansion")?.classList.remove("on");
    }, {passive:false});
  }

  // 5. Canvas 설정
  
  // --- Stats modal close (ensure X works on mobile) ---
  const modalStats = document.getElementById("modalStats");
  const closeStatsBtn = document.getElementById("closeStats");
  if(closeStatsBtn){
    closeStatsBtn.style.pointerEvents = "auto";
    closeStatsBtn.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      modalStats?.classList.remove("on");
    }, {passive:false});
  }
  if(modalStats){
    modalStats.addEventListener("click",(e)=>{
      if(e.target === modalStats) modalStats.classList.remove("on");
    });
  }
canvas = document.getElementById("stage");
  if(!canvas) throw new Error("stage canvas not found");
  ctx = canvas.getContext("2d");
  // Bind canvas input AFTER canvas exists (prevents boot crash)
  safeOn(canvas, "mousedown", onCanvasDown);
  safeOn(canvas, "touchstart", onCanvasDown, {passive:false});
  if(!ctx) throw new Error("2d context not available");
  window.__lastCtx = ctx;
}
/* --------------------
   Canvas
-------------------- */
let canvas, ctx;
function resizeCanvas(){
  // Defensive: on some mobile browsers resize/orientation events can fire before initDOMRefs()
  const wrap = document.getElementById("stageWrap");
  if(!wrap) return;

  // Ensure canvas/context exist
  if(!canvas){
    canvas = document.getElementById("stage");
    if(!canvas) return;
  }
  if(!ctx){
    ctx = canvas.getContext("2d");
    if(!ctx) return;
  }

  const rect = wrap.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width || 1));
  const h = Math.max(1, Math.floor(rect.height || 1));
  canvas.width = w;
  canvas.height = h;
}

// Register once; safe even if resize fires early thanks to guards above
window.addEventListener("resize", resizeCanvas, { passive:true });

/* --------------------
   Helpers
-------------------- */
let toastTimer = null;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("on"), 1200);
}
function fmtKoreanUnits(n, addWon=true){
  if (n === null || n === undefined) return addWon ? "0원" : "0";
  let val;
  try{
    if (typeof n === "number"){
      if (!isFinite(n)) return "무한";
      if (Math.abs(n) < 10000) return (Math.floor(n).toLocaleString("ko-KR") + (addWon ? "원" : ""));
      val = BigInt(Math.floor(n));
    } else {
      val = BigInt(n);
      if (val < 10000n) return (val.toString() + (addWon ? "원" : ""));
    }
  }catch(e){
    return addWon ? "0원" : "0";
  }

  if (val <= 0n) return addWon ? "0원" : "0";

  const units = [
    {v: 10000n, s: "만"}, {v: 100000000n, s: "억"}, {v: 1000000000000n, s: "조"},
    {v: 10000000000000000n, s: "경"}, {v: 100000000000000000000n, s: "해"},
    {v: 1000000000000000000000000n, s: "자"}, {v: 10000000000000000000000000000n, s: "양"},
    {v: 100000000000000000000000000000000n, s: "구"}, {v: 1000000000000000000000000000000000000n, s: "간"},
    {v: 10000000000000000000000000000000000000000n, s: "정"}, {v: 100000000000000000000000000000000000000000000n, s: "재"},
    {v: 1000000000000000000000000000000000000000000000000n, s: "극"},
    {v: 10000000000000000000000000000000000000000000000000000n, s: "항하사"},
    {v: 100000000000000000000000000000000000000000000000000000000n, s: "아승기"},
    {v: 1000000000000000000000000000000000000000000000000000000000000n, s: "나유타"},
    {v: 10000000000000000000000000000000000000000000000000000000000000000n, s: "불가사의"},
    {v: 100000000000000000000000000000000000000000000000000000000000000000000n, s: "무량대수"}
  ];

  for (let i = units.length - 1; i >= 0; i--){
    const u = units[i];
    if (val >= u.v){
      const intPart = val / u.v;
      const decPart = (val % u.v) * 100n / u.v; // 소수 2자리
      let str = intPart.toString();
      if (decPart > 0n){
        str += "." + decPart.toString().padStart(2, "0").replace(/0+$/, "");
      }
      return str + u.s + (addWon ? "원" : "");
    }
  }
  return val.toString() + (addWon ? "원" : "");
}

function fmtWon(n){ return fmtKoreanUnits(n, true); }     // 기본: "…원" 포함
function fmtNoWon(n){ return fmtKoreanUnits(n, false); }  // "…만/억/조" 까지만
function fmtCompactWon(n){ return fmtNoWon(n); }          // 기존 호환
function fmtCompact(n){ return fmtNoWon(n); }             // 기존 호환

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function clampInt(v,min,max){ return Math.max(min, Math.min(max, Math.floor(v))); }
function dayKey(ts=Date.now()){
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowK(){
  return new Date().toLocaleString("ko-KR");
}
function isHangulOnly(s){
  if(s === "") return true; // 빈값 허용
  return /^[가-힣]{1,10}$/.test(s);
}

function processPayroll(){
  // 하루 1번(날짜 바뀔 때) 알바 임금 지급: 1인당 80,000원
  const today = dayKey();
  if(!state.payroll) state.payroll = { lastDayKey:"", dailyWage:80000 };
  if(state.payroll.lastDayKey === "") state.payroll.lastDayKey = today;
  if(state.payroll.lastDayKey === today) return;

  const hireLvl = clampInt(state.upgrades.hire||0, 0, 6);
  const staffCount = hireLvl;
  if(staffCount > 0){
    const wage = staffCount * (state.payroll.dailyWage || 80000);
    state.money -= wage;
    showToast(`💸 알바 임금 지급: -${fmtWon(wage)} (${staffCount}명)`);
    sfxTick();
  }
  state.payroll.lastDayKey = today;
  if(_saveDirty) save(true);
}

function logBenefit({type, qty=1, source="", note=""}){
  state.benefitsLog = state.benefitsLog || [];
  state.benefitsLog.unshift({
    ts: Date.now(),
    at: nowK(),
    type, qty, source, note
  });
  // 너무 길어지면 상위 80개만
  if(state.benefitsLog.length > 80) state.benefitsLog.length = 80;
}

/* --------------------
   Panels / Nav
-------------------- */
const navBtns = [...document.querySelectorAll(".navBtn")];
const panels = {
  upg: document.getElementById("panel-upg"),
  res: document.getElementById("panel-res"),
  mis: document.getElementById("panel-mis"),
  shr: document.getElementById("panel-shr"),
};
function closePanels(){
  Object.values(panels).forEach(p=>p.classList.remove("on"));
  navBtns.forEach(b=>b.classList.remove("active"));
}
function openPanel(key){
  const panel = panels[key];
  if(!panel) return;
  const isOn = panel.classList.contains("on");
  closePanels();
  if(!isOn){
    sanitizeState();
  try{ applyRobotGrandson(); }catch(_){ }
  try{ bindEndingUI(); }catch(_){ }
    panel.classList.add("on");
    const btn = navBtns.find(b=>b.dataset.panel===key);
    if(btn) btn.classList.add("active");
    renderPanel(key);
  }
}
navBtns.forEach(btn=> btn.addEventListener("click", ()=>{
  unlockAudioOnce();
  startBGM();
  openPanel(btn.dataset.panel);
}));

document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click", closePanels));

/* --------------------
   Settings modal
-------------------- */
safeClick("openSettings", ()=>{
  unlockAudioOnce(); startBGM();
  modalSettings?.classList.add("on");
});

/* --------------------
   [NEW] Stats modal (Management report)
-------------------- */
function updateStatsUI(){
  try{
  // Null-safe: 리포트가 열릴 때 데이터가 비어 있어도 절대 에러로 멈추지 않게 함
  state.menuStats ||= {};
  state.menuLevels ||= {};
  state.contrib ||= { player:0, staff:0, system:0 };
  state.todaySales ||= 0;
  state.offlineSalesToday ||= 0;
  state.totalSales ||= 0;
  state.offlineSalesTotal ||= 0;
  const online = state?.todaySales || 0;
  const offline = state?.offlineSalesToday || 0;
  const totalAll = (state?.totalSales || 0) + (state?.offlineSalesTotal || 0);

  const el = (id)=>document.getElementById(id);

  if(el("rptOnline")) el("rptOnline").innerText = fmtWon(online);
  if(el("rptOffline")) el("rptOffline").innerText = fmtWon(offline);
  if(el("rptTodayTotal")) el("rptTodayTotal").innerText = fmtWon(online + offline);
  if(el("rptTotalAll")) el("rptTotalAll").innerText = fmtWon(totalAll);

  const contrib = state?.contrib || {player:0, staff:0, system:0};
  if(el("rptContribPlayer")) el("rptContribPlayer").innerText = fmtWon(contrib.player||0);
  if(el("rptContribStaff"))  el("rptContribStaff").innerText  = fmtWon(contrib.staff||0);
  if(el("rptContribSys"))    el("rptContribSys").innerText    = fmtWon(contrib.system||0);

  const tbody = el("menuRankBody");
  if(tbody){
    tbody.innerHTML = "";
    const sorted = [...MENUS].sort((a,b)=>(state?.menuStats?.[b.id]?.count||0)-(state?.menuStats?.[a.id]?.count||0));
    let hasData = false;
    for(const m of sorted){
      const st = state?.menuStats?.[m.id];
      if(st && st.count>0){
        hasData = true;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${m.emoji} ${m.name}</td><td style="text-align:right;">${fmtWon(st.count)}</td><td style="text-align:right;">${fmtWon(st.earned||0)}</td>`;
        tbody.appendChild(tr);
      }
    }
    if(!hasData){
      tbody.innerHTML = "<tr><td colspan='3' style='text-align:center; padding:20px; color:#999;'>판매 기록 없음</td></tr>";
    }
  }

  // R&D 탭은 기존 로직 유지(있으면)
  try{ if(typeof renderRndList === "function") renderRndList(); }catch(e){}

  }catch(e){ console.error("[updateStatsUI]", e); }
}

function renderRndList(){
  const list = document.getElementById("rndList");
  if(!list) return;
  list.innerHTML = "";

  const openCount = getOpenMenuCount(); 

  MENUS.slice(0, openCount).forEach(m=>{
    const lvl = state.menuLevels?.[m.id] || 0;
    const cost = Math.floor(100000 * Math.pow(1.8, lvl)); 

    const div = document.createElement("div");
    div.className = "rnd-item";
    div.innerHTML = `
      <div class="rnd-info">
        <span class="rnd-name">${m.emoji} ${m.name}</span>
        <span class="rnd-lvl">Lv.${lvl} (가격 x${(1 + (lvl*0.5)).toFixed(1)})</span>
      </div>
      <button class="rnd-btn" style="pointer-events: auto !important; position: relative; z-index: 2001;">연구 (${fmtNoWon(cost)})</button>
    `;
    
    const btn = div.querySelector("button");
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); 
      if(state.money < cost){
        showToast("연구비가 부족해요!");
        if(typeof sfxWrong === "function") sfxWrong();
        return;
      }
      state.money -= cost;
      state.menuLevels[m.id] = lvl + 1;
      _saveDirty = true;
      save(true);
      showToast(`${m.name} 연구 완료!`);
      if(typeof sfxConfirm === "function") sfxConfirm();
      updateUI();
      updateStatsUI(); 
      // 메뉴판 가격 즉시 반영
      if(typeof buildMenuGrid === 'function') buildMenuGrid();
      // 연구 탭 비용/레벨 갱신
      if(typeof renderRndList === 'function') renderRndList();
    };
    list.appendChild(div);
  });
}


// 탭 전환 (위임)
document.addEventListener("click", (e)=>{
  const btn = e.target?.closest?.(".tab-btn");
  if(!btn) return;
  const wrap = btn.closest("#modalStats");
  if(!wrap) return;

  wrap.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  wrap.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));

  btn.classList.add("active");
  const target = document.getElementById(`tab-${btn.dataset.tab}`);
  if(target) target.classList.add("active");
});

// 모달 열고 닫기
safeClick("openStats", ()=>{
  unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  const modal = document.getElementById("modalStats");
  if(modal) {
    modal.classList.add("on");
    updateStatsUI(); // 👈 여기서 한 번만 호출!
  }
});
safeClick("closeStats", ()=>{
  document.getElementById("modalStats")?.classList.remove("on");
});
// [NEW] Region map
// Step 2-7: openMap is handled by openMapBtn.addEventListener in initDOMRefs().


// ------------------------------
// Expansion (Branch) modal - Angry Birds style cards
function openExpansionModal(){
  unlockAudioOnce(); startBGM();
  const m = document.getElementById("modalExpansion");
  if(!m) return;
  m.classList.add("on");
  renderMapUI();
}

function closeExpansionModal(){
  const m = document.getElementById("modalExpansion");
  if(m) m.classList.remove("on");
}

// thin wrappers so inline onclick works safely
function moveBranch(id){
  BranchManager.move(id);
  closeExpansionModal();
}
function unlockBranch(id){
  // Only allow unlocking in order (previous region must be unlocked)
  const idx = REGIONS.findIndex(r=>r.id===id);
  if(idx < 0) return;
  if(state.regionUnlocked && state.regionUnlocked[id]){ showToast("이미 오픈한 지역입니다!"); return; }
  const prev = REGIONS[idx-1];
  if(prev && !(state.regionUnlocked && state.regionUnlocked[prev.id])){
    showToast("이전 지역을 먼저 해금하세요!");
    return;
  }
  const loc = REGIONS[idx];
  const need = loc.unlockCost || 0;
  if(state.money < need){
    showToast("자금이 부족합니다!");
    sfxWrong();
    return;
  }
  unlockAudioOnce(); startBGM();
  state.money -= need;
  state.regionUnlocked = state.regionUnlocked || {};
  state.regionUnlocked[id] = true;

  BranchManager.ensure(id); // allocate branch slot
  _saveDirty = true;
  save(true);
  updateUI();
  renderMapUI();
  showToast(`${loc.name} 오픈을 축하합니다! 🎉`);
  sfxConfirm();
}

function renderExpansionCards(){
  const container = document.getElementById("expansionList");
  if(!container) return;
  container.innerHTML = "";

  REGIONS.forEach((loc, idx)=>{
    const isUnlocked = !!(state.regionUnlocked && state.regionUnlocked[loc.id]);
    const isCurrent = (state.regionId === loc.id);
    const prev = REGIONS[idx-1];
    const isNext = !isUnlocked && (!prev || (state.regionUnlocked && state.regionUnlocked[prev.id]));

    const card = document.createElement("div");
    card.className = `loc-card ${!isUnlocked ? "locked" : ""} ${isCurrent ? "current" : ""}`;

    const emoji = loc.icon || ["🏡","🌊","🏙️","🌸","🗽","🏰","🪐"][idx] || "🚩";

    let badgeHtml = "";
    if(isCurrent) badgeHtml = `<div class="loc-badge" style="background:var(--primary);">영업중</div>`;
    else if(isUnlocked) badgeHtml = `<div class="loc-badge" style="background:#2EC4B6;">보유중</div>`;
    else badgeHtml = `<div class="loc-badge">잠김</div>`;

    let btnHtml = "";
    if(isCurrent){
      btnHtml = `<button class="btn gray loc-btn" disabled>현재 위치</button>`;
    }else if(isUnlocked){
      btnHtml = `<button class="btn alt loc-btn" data-action="move-branch" data-region-id="${loc.id}" type="button">이동하기 🚀</button>`;
    }else{
      if(isNext){
        const canAfford = state.money >= (loc.unlockCost||0);
        const costText = fmtWon(loc.unlockCost||0);
        btnHtml = `<button class="btn loc-btn" ${canAfford ? "" : "disabled"} data-action="unlock-branch" data-region-id="${loc.id}" type="button">${costText} 오픈 🔓</button>`;
      }else{
        btnHtml = `<button class="btn gray loc-btn" disabled>이전 지역 필요 🔒</button>`;
      }
    }

    card.innerHTML = `
      ${badgeHtml}
      <div class="loc-emoji">${emoji}</div>
      <div class="loc-name">${loc.name}</div>
      <div class="loc-desc">
        수익 배율: <b style="color:#d35400">x${(loc.priceMul||1).toFixed ? (loc.priceMul||1).toFixed(1).replace(/\.0$/,"") : (loc.priceMul||1)}</b><br>
        ${isUnlocked ? "인테리어/직원 별도 관리" : "새로운 시작, 더 큰 수익!"}
      </div>
      ${btnHtml}
    `;
    container.appendChild(card);
  });
}

// stats 모달 배경 클릭 시 닫기(✕ 버튼이 레이어에 가려져도 안전)
safeOn(document.getElementById("modalStats"), "click", (e)=>{
  const dim = document.getElementById("modalStats");
  if(e.target === dim){
    dim.classList.remove("on");
  }
});
// ------------------------------
// Safety binder (prevents crashes if an element is missing in some layout)
function safeOn(el, evt, fn, opts){
  if(el && typeof el.addEventListener === "function") el.addEventListener(evt, fn, opts);
}
function _bindSafe(el, evt, fn, opts){ return safeOn(el, evt, fn, opts); }
function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }

safeOn(document.getElementById("closeSettings"), "click", ()=> modalSettings && modalSettings.classList.remove("on"));
safeClick("forceSave", ()=>{ save(true); showToast("저장 완료"); });
safeClick("resetAll", ()=>{
  if(confirm("정말 초기화할까요? (저장 데이터 삭제)")){
    localStorage.removeItem(SAVE_KEY);
    stopBGM();
    state = defaultState();
    initAfterLoad(true);
    modalSettings.classList.remove("on");
    showToast("초기화 완료");
  }
});
if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
  unlockAudioOnce();
  const next = !state.soundOn;
  state.soundOn = next;
  setSoundEnabled(next);
  toggleSoundBtn.textContent = next ? "ON" : "OFF";
  sfxTick();
  if(_saveDirty) save(true);
};
// Step 2-9: openCouponsBtn handled once in initDOMRefs().
// Step 2-9: openExchangeBtn handled once in initDOMRefs().
// Step 2-8A: closeCouponsBtn handled once in initDOMRefs().
// Step 2-8A: closeExchangeBtn handled once in initDOMRefs().
// Step 2-9: clearLogBtn handled once in initDOMRefs().

/* --------------------
   Icon explanations
-------------------- */
safeClick("statMoney", ()=>showToast("💰 보유 금액: 업그레이드/연구/확장/교환상점에 사용해요."));
safeClick("statRep", ()=>showToast("⭐ 평점(0~5): 손님 이탈/오답 시 하락, 정확 서빙 시 상승!"));
let __infoTimer = 0;
function showInfoToast(title, rows){
  const el = document.getElementById("infoToast");
  if(!el) return;
  if(__infoTimer) clearTimeout(__infoTimer);

  const rowHtml = (rows||[]).map(r=>`<div style="opacity:.85;">${r[0]}</div><div style="text-align:right; font-weight:700;">${r[1]}</div>`).join("");
  el.innerHTML = `<div style="font-weight:800; margin-bottom:4px;">${title}</div><div class="grid">${rowHtml}</div>`;
  el.classList.add("on");
  __infoTimer = setTimeout(()=>{ el.classList.remove("on"); }, 3000);
}

safeClick("statLvl", ()=>showInfoToast("🏢 매장 레벨", [["기준","누적 매출(온라인+오프라인)"],["효과","단가/콘텐츠 확장"],["팁","누적을 늘리면 성장!"]]));
safeClick("statToday", ()=>showInfoToast("📆 오늘 매출", [["범위","접속 중(온라인)"],["리셋","매일 0시"],["스탬프","일간 목표 달성에 사용"]]));
safeClick("statTotal", ()=>{
  const p = state.play || {onlineSecTotal:0, offlineSecTotal:0};
  const online = fmtDuration(p.onlineSecTotal);
  const offline = fmtDuration(p.offlineSecTotal);
  const total = fmtDuration((p.onlineSecTotal||0)+(p.offlineSecTotal||0));
  const sum = (state.totalSales||0) + (state.offlineSalesTotal||0);
  showInfoToast("📈 누적 매출 / 시간", [["누적 매출", fmtCompactWon(sum)],["온라인 시간", online],["오프라인 시간", offline],["총 플레이", total]]);
});

/* --------------------
   PIN modal helper
-------------------- */
let pinResolver = null;
function askPIN(){
  return new Promise((resolve)=>{
    pinResolver = resolve;
    pinInput.value = "";
    modalPin.classList.add("on");
    pinInput.focus();
  });
}
// Step 2-8B: pinCancelBtn handled once in initDOMRefs().
// Step 2-8B: pinOkBtn handled once in initDOMRefs().
safeOn(pinInput, "keydown", (e)=>{
  if(e.key==="Enter" && pinOkBtn) pinOkBtn.click();
});
/* --------------------
   Profile name (first run)
-------------------- */
function maybeAskName(){
  if(state.profile && typeof state.profile.name === "string"){
    // 최초 1회만 강제: namePrompted flag 없이 "name이 undefined/null"일 때만 띄움.
    // 단, 빈값도 저장 가능 -> 빈값이면 다시 띄우지 않음.
    return;
  }
}
if(saveNameBtn) saveNameBtn.onclick = ()=>{
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
};

/* --------------------
   Effects aggregation
-------------------- */
function sumEffects(){
  const eff = {
    ordersMul: 0,
    autoServeMul: 0,
    baseAutoAdd: 0,

    staffCount: 0,
    staffSpeedMul: 0,
    priceBonus: 0,

    earningMul: 0,

    // 배달/온라인(방치) 성장
    deliveryMul: 0,
    deliveryFreqMul: 0,
    deliveryEarningMul: 0,
    onlineMul: 0,
    onlineFreqMul: 0,
    onlineEarningMul: 0,

    patienceBonus: 0,
    wrongPatiencePenaltyMul: 0,
    leaveRepLossAdd: 0,
    repGainAdd: 0,

    researchSlots: 0,
    eventAutoResist: 0,
    patienceMul: 0,
  };

  for(const u of UPGRADES){
    let lvl = state.upgrades[u.id] || 0;
        // [특수] 배달 업그레이드 상태는 별도 스토리지
        if(u.id==="deliVehicle") lvl = state.delivery.level || 0;
        if(u.id==="deliRider") lvl = state.delivery.riders || 0;
    if(lvl<=0) continue;
    for(const k in (u.effect||{})){
      eff[k] = (eff[k]||0) + u.effect[k]*lvl;
    }
  }

  // 연구(레벨형) 효과 합산
  for(const rid in (state.research.levels||{})){
    const lvl = state.research.levels[rid]||0;
    if(lvl<=0) continue;
    const r = RESEARCH.find(x=>x.id===rid);
    if(!r) continue;
    for(const k in (r.effectPerLevel||{})){
      eff[k] = (eff[k]||0) + r.effectPerLevel[k]*lvl;
    }
  }

  if(state.event){
    for(const k in state.event.mod){
      eff[k] = (eff[k]||0) + state.event.mod[k];
    }
  }

  return eff;
}

/* --------------------
   Rates
-------------------- */
function computeRates(){
  const eff = sumEffects();

  // 메뉴가 확장될수록 유입 증가(3개 기준, 최대 9개)
  const openCount = getOpenMenuCount();
  const menuDemandMul = 1 + Math.max(0, openCount-3) * 0.06;

  let ordersPerMin = (CONFIG.baseOrdersPerMin * (1 + (eff.ordersMul||0))) * menuDemandMul;
  ordersPerMin = Math.max(1, ordersPerMin);

  // [추가] 온라인 주문(자동 수익): 마케팅-온라인 레벨 + 포장 트레이 효과
  const onlineLvl = clampInt(state.upgrades.sns||0, 0, 50);
  const onlineBasePerMin = 0.2 + onlineLvl * 0.25; // 레벨당 +0.25/min
  let onlineOrdersPerMin = onlineBasePerMin * (1 + (eff.onlineMul||0)) * (1 + (eff.onlineFreqMul||0));
  onlineOrdersPerMin = Math.max(0, onlineOrdersPerMin);


  const patienceBase = (state.level <= 2) ? 22 : (state.level <= 6 ? 16 : 12);
  let patience = patienceBase + (eff.patienceBonus||0);
  if(eff.patienceMul) patience *= (1 + eff.patienceMul);
  patience = Math.max(7, patience);

  const hireLvl = clampInt(state.upgrades.hire||0, 0, 6);
  const staffCount = clampInt(hireLvl, 0, 6);

  // 직원 육성(각 직원별 2개 업그레이드)
  ensureStaffStats();
  const hired = STAFF_POOL.slice(0, staffCount);
  let staffAutoSum = 0;
  let tipChance = 0.05;
  let tipMul = 0.08;

  const gradeAuto = {C:1.00, B:1.05, A:1.12, S:1.22};
  const gradeTip  = {C:1.00, B:1.08, A:1.16, S:1.28};

  for(const s of hired){
    const st = state.staffStats?.[s.key] || {auto:0, tip:0};
    const aLvl = clampInt(st.auto||0, 0, 10);
    const tLvl = clampInt(st.tip||0, 0, 10);

    // 서빙 마스터: 자동 서빙 기여도(속도)
    const speedMul = (s.baseSpeed||1) * (1 + aLvl*0.18) * (gradeAuto[s.grade]||1);
    staffAutoSum += 1.4 * speedMul; // stronger per-staff contribution // serves/min contribution

    // 서비스 교육: 팁 확률/금액 증가
    tipChance += (0.012 * tLvl) * (gradeTip[s.grade]||1);
    tipMul    += (0.035 * tLvl) * (gradeTip[s.grade]||1);
  }

  tipChance = Math.min(0.40, tipChance);
  tipMul = Math.min(0.55, tipMul);

  let autoServesPerMin = CONFIG.baseAutoServesPerMin + (eff.baseAutoAdd||0);
  autoServesPerMin += staffAutoSum;

  let autoMul = 1 + (eff.autoServeMul||0);
  if(state.event && state.event.id === "supply"){
    const resist = (eff.eventAutoResist||0);
    autoMul = 1 + Math.min(0, (eff.autoServeMul||0) + resist);
  }
  autoServesPerMin *= autoMul;
  autoServesPerMin = Math.max(0, autoServesPerMin);

  return {
    ordersPerMin,
    onlineOrdersPerMin,
    patienceSec:patience,
    autoServesPerMin,
    staffCount,
    tipChance,
    tipMul,
    staffSpeedMul:1,
    eff
  };
}

/* --------------------
   Menu unlock count
-------------------- */
function getOpenMenuCount(){
  return 1 + (state.upgrades.menuUnlock || 0);
}

/* --------------------
   pickMenuByRule
   - 해금된 메뉴만 주문
   - 동일 확률
-------------------- */
function pickMenuByRule(){
  const openCount = getOpenMenuCount();
  const unlocked = MENUS.slice(0, openCount);
  if(unlocked.length === 0) return MENUS[0];
  return unlocked[Math.floor(Math.random() * unlocked.length)];
}

/* --------------------
   Menu grid (3x3)
-------------------- */
function buildMenuGrid(){
  menuGrid.innerHTML = "";

  const openCount = getOpenMenuCount();

  MENUS.forEach((m, idx) => {
    const locked = idx >= openCount;

    const btn = document.createElement("button");
    btn.className = "menuBtn";
    btn.disabled = locked;

    const emoji = locked ? "🔒" : m.emoji;
    const nameText = locked ? "잠김" : m.name;
    const shownPrice = getMenuPrice(m.id);
    const priceText = locked ? "업그레이드로 해금" : ` ${fmtWon(shownPrice)}`;

    btn.innerHTML = `
      <div class="top">
        <div class="emoji">${emoji}</div>
        <div class="name">${nameText}</div>
      </div>
      <div class="price">${priceText}</div>
    `;

    btn.onclick = () => {
      applyElementFX(btn);
      unlockAudioOnce(); startBGM();
      sfxTick();
      if (locked) {
        showToast("아직 잠긴 메뉴예요! (업그레이드: 메뉴 확장)");
        return;
      }
      serveByMenu(m.id);
    };

    menuGrid.appendChild(btn);
  });
}

/* --------------------
   Stage layout helpers
-------------------- */
function doorRect(){
  // 우측 출구 문: 바닥(floor) 상단에 맞춰 정렬
  const w = 64, h = 92;
  const x = canvas.width - w - 14;

  const H = canvas.height;
  const floorH = Math.max(70, Math.floor(H * 0.12));
  const floorY = H - floorH;

  // 문 바닥은 floorY 근처에 닿도록
  const y = floorY - h + 10;
  return {x,y,w,h, cx:x+w/2, cy:y+h/2};
}
function serveSpot(){
  // 선택 손님이 오는 중앙 서빙 포인트(중앙 하단)
  return { x: canvas.width/2, y: canvas.height - 220 };
}
function waitingSlots(){
  // 하단 전체 2행×5열 그리드
  const cols = 5, rows = 2;
  const marginX = 44;
  const topY = canvas.height - 300; // 배달 레인(2개) 위로 올려 겹침 방지
  const rowGap = 70;
  const colW = (canvas.width - marginX*2) / (cols-1);
  const slots = [];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      slots.push({
        x: marginX + c*colW,
        y: topY + r*rowGap
      });
    }
  }
  return slots;
}

/* --------------------
   Customers spawn + move
-------------------- */
function spawnCustomer(){
  const rates = computeRates();
  if(state.customers.length >= CONFIG.maxCustomers) return;

  const menu = pickMenuByRule();
  const id = "c_" + Math.random().toString(36).slice(2, 10);

  // 상단에서 아래로 내려오는 랜덤 체감 (좌우 폭을 넓게)
  const spawnX = Math.random()*(canvas.width-60)+30;
  const spawnY = -40;

  const speed = CONFIG.walkSpeedMin + Math.random()*(CONFIG.walkSpeedMax-CONFIG.walkSpeedMin);

  state.customers.push({
    id,
    menuId: menu.id,
    menuName: menu.name,
    emoji: CUSTOMER_EMOJIS[Math.floor(Math.random()*CUSTOMER_EMOJIS.length)],

    patience: rates.patienceSec,
    patienceMax: rates.patienceSec,
    enteredAt: Date.now(),

    state: "waiting", // waiting | leaving
    x: spawnX, y: spawnY,
    tx: spawnX, ty: spawnY,
    r: 30,
    speed,
  });

  if(!state.selectedCustomerId){
    state.selectedCustomerId = id;
  }
}

function layoutTargets(){
  const slots = waitingSlots();
  const selId = state.selectedCustomerId;
  let slotIdx = 0;

  for(const c of state.customers){
    if(c.state === "leaving"){
      const d = doorRect();
      c.tx = d.cx;
      c.ty = d.cy;
      continue;
    }
    if(c.id === selId){
      const sp = serveSpot();
      c.tx = sp.x;
      c.ty = sp.y;
      continue;
    }
    const s = slots[slotIdx % slots.length];
    slotIdx++;
    c.tx = s.x;
    c.ty = s.y;
  }
}

function moveCustomers(dt){
  layoutTargets();
  for(let i=state.customers.length-1;i>=0;i--){
    const c = state.customers[i];
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if(dist < 2){
      c.x = c.tx;
      c.y = c.ty;
      if(c.state === "leaving"){
        // 문에 도착하면 제거
        state.customers.splice(i,1);
        if(state.selectedCustomerId === c.id){
          state.selectedCustomerId = state.customers[0]?.id || null;
        }
      }
      continue;
    }
    const step = c.speed * dt;
    const t = Math.min(1, step / dist);
    c.x += dx * t;
    c.y += dy * t;
  }
}

function pickCustomerAt(px, py){
  for(let i=state.customers.length-1;i>=0;i--){
    const c = state.customers[i];
    const dx = px - c.x, dy = py - c.y;
    if(dx*dx + dy*dy <= c.r*c.r) return c;
  }
  return null;
}
function selectCustomer(id){
  state.selectedCustomerId = id;
}

/* --------------------
   Serve logic
-------------------- */
let floats = [];
let bossParticles = [];
let bossFlash = 0; // screen flash alpha (0~1)

function bossBurst(x,y,n=22){
  try{
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = 180 + Math.random()*380;
      bossParticles.push({
        x, y,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp - (120+Math.random()*180),
        life: 0.65 + Math.random()*0.35,
        r: 2 + Math.random()*3.5,
        hue: Math.floor(Math.random()*360)
      });
    }
    bossFlash = Math.min(0.35, bossFlash + 0.22);
  }catch(e){}
}

// 2. updateBossParticles 함수 교체
function updateBossParticles(dt){
  if(bossFlash>0) bossFlash = Math.max(0, bossFlash - dt*1.8);
  if(!bossParticles.length) return;
  const g = 980; // gravity px/s^2
  
  for(let i = bossParticles.length - 1; i >= 0; i--){
    const p = bossParticles[i];
    p.vy += g*dt;
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    p.life -= dt;
    p.vx *= (1 - dt*2.2);
    p.vy *= (1 - dt*1.2);
    
    // 수명이 다한 파티클 즉시 제거 (filter 대체)
    if(p.life <= 0){
      bossParticles.splice(i, 1);
    }
  }
}

function drawBossParticles(){
  if(!ctx || !canvas) return;
  ctx.save();
  try{ ctx.setTransform(1,0,0,1,0,0); }catch(e){}
  for(const p of bossParticles){
    const a = clamp(p.life, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = `hsl(${p.hue} 90% 60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBossFlash(){
  if(!ctx || !canvas) return;
  if(bossFlash<=0) return;
  ctx.save();
  try{ ctx.setTransform(1,0,0,1,0,0); }catch(e){}
  ctx.globalAlpha = bossFlash;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}

function floatText(text, x, y, color){
  floats.push({text,x,y,color,life:0.95,vy:-55});
}

// 1) 배달/온라인 주문 텍스트 띄우기
function showFloatingText(x, y, text){
  floatText(text, x, y, "#fff");
}

// 2) 터치 충돌 판정
function hitCircle(tx, ty, cx, cy, r){
  const dx = tx - cx;
  const dy = ty - cy;
  return (dx*dx + dy*dy) < (r*r);
}

// 3) 보스(사장님) 위치 계산
// ==========================================
// 👆 1. 터치 및 이펙트 글로벌 상태 (에러 완벽 차단)
// ==========================================
window._fxState = {
    boss: { taps: 0, buffUntil: 0, lastClick: 0, buffCount: 0, buffDate: "" },
    staffs: {},
    speech: { type: null, key: null, msg: "", until: 0 }
};

// ==========================================
// 🎯 2. 터치 영역(Hitbox) 대폭 확대
// ==========================================
function bossCenter(){
  const h = canvas.height;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  return { 
      x: canvas.width/2, 
      y: floorY, 
      hitY: floorY - 20, // [NEW] 터치 중심점을 이모지 중앙으로 위로 올림
      r: 42              // [NEW] 기존 85에서 딱 절반 수준으로 축소!
  }; 
}

function staffCenters(){
  const list = [];
  const hireLvl = clampInt((state?.upgrades?.hire)||0, 0, STAFF_POOL.length);
  const hired = STAFF_POOL.slice(0, hireLvl);
  if(hired.length === 0) return list;

  const h = canvas.height;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  const staffY = Math.min(h - 26, floorY + floorH - 24);
  
  const padding = 70; 
  const usableW = canvas.width - padding * 2;
  const count = Math.max(1, hired.length);
  
  // [NEW] 기존 70에서 30%를 줄인 반경 49로 설정!
  const r = 49; 

  let gap = 0;
  let startX = canvas.width / 2;

  if (count > 1) {
      const maxPossibleGap = usableW / (count - 1);
      gap = Math.min(210, maxPossibleGap);
      const totalW = (count - 1) * gap;
      startX = (canvas.width - totalW) / 2;
  }

  for(let i=0;i<hired.length;i++){
      list.push({ 
          x: (count === 1) ? startX : startX + i*gap, 
          y: staffY, 
          hitY: staffY - 10, // [NEW] 터치 중심점을 이모지 중앙으로 위로 올림
          r: r, 
          key: hired[i].key, 
          emoji: hired[i].emoji, 
          label: hired[i].label 
      });
  }
  return list;
}

// ==========================================
// 💥 3. 터치 발동 로직 (안전망 적용)
// ==========================================
function triggerBossFX() {
  const now = Date.now();
  
  // 글로벌 버프 체크
  if (isGlobalBuffActive('boss')) {
      showToast("🚫 쉿! 다른 사람이 활약 중이에요!");
      return;
  }

  window._fxState.boss.lastClick = now;

  const today = typeof dayKey === "function" ? dayKey() : new Date().toDateString();
  if(window._fxState.boss.buffDate !== today){
      window._fxState.boss.buffDate = today;
      window._fxState.boss.buffCount = 0; 
  }

  const isBuff = window._fxState.boss.buffUntil > now;
  
  if(!isBuff) {
      window._fxState.boss.taps += 1;
      
      if(window._fxState.boss.taps >= 20) {
          window._fxState.boss.taps = 0;
          if(window._fxState.boss.buffCount < 5){
              window._fxState.boss.buffCount++;
              window._fxState.boss.buffUntil = now + 10000; // 10초간 매출 2배
              showToast(`🔥 사장님 극대노! 10초간 매출 2배! (${window._fxState.boss.buffCount}/5)`);
              floatText("🔥🔥🔥", canvas.width/2, canvas.height/2, "#FF5252");
              if(typeof sfxFanfare === "function") sfxFanfare();
              
              const msg = "다 팔아버려!!! 🔥";
              window._fxState.speech = { type: 'boss', key: 'boss', msg: msg, until: now + 3000 };
          } else {
              showToast("💦 오늘 사장님 체력 방전! (내일 다시 가능)");
          }
      }
  } else {
      const msg = "더 빠르게!!! 🔥";
      window._fxState.speech = { type: 'boss', key: 'boss', msg: msg, until: now + 2000 };
  }
}

function triggerStaffFX(key){
  const now = Date.now();
  if (isGlobalBuffActive(key)) {
      showToast("🚫 쉿! 다른 사람이 활약 중이에요!");
      return;
  }
  if(!window._fxState.staffs[key]) {
      window._fxState.staffs[key] = { lastClick: 0, taps: 0, buffUntil: 0, dailyUses: 0 };
  }
  const sfx = window._fxState.staffs[key];
  const sInfo = STAFF_POOL.find(s => s.key === key);
  sfx.lastClick = now;

  if (sfx.buffUntil > now) return;
  if (now - sfx.lastClick > 2000) sfx.taps = 0;
  sfx.taps += 1;

  if(sfx.taps >= 10){
      sfx.taps = 0;
      sfx.buffUntil = now + 5000; 
      const lines = sInfo.lines || ["화이팅!"];
      const msg = lines[Math.floor(Math.random()*lines.length)];
      window._fxState.speech = { type: 'staff', key: key, msg: msg, until: now + 3000 };
      if(typeof sfxDing === "function") sfxDing();
  }
}

function onCanvasDown(e){
  // 패널이나 모달이 열려있으면 캔버스 클릭 방지
  if(document.querySelector(".panel.on") || document.querySelector(".dim.on")){
      return; 
  }
  e.preventDefault();
  if(typeof unlockAudioOnce === "function") unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  const p = getCanvasPoint(e);

  const b = bossCenter();
  if(hitCircle(p.x, p.y, b.x, b.hitY || b.y, b.r)){
    triggerBossFX();
    try{ if(typeof bossBurst === "function") bossBurst(b.x, b.y-30, 10 + Math.floor(Math.random()*14)); } catch(e){}
    if(typeof sfxTick === "function") sfxTick();
    return;
  }
  
  const staffs = staffCenters();
  for(const s of staffs){
    if(hitCircle(p.x, p.y, s.x, s.hitY || s.y, s.r)){
      triggerStaffFX(s.key);
      floatText("👍", s.x, s.y-60, "#FFD700");
      if(typeof sfxTick === "function") sfxTick();
      return;
    }
  }
  
  const c = pickCustomerAt(p.x, p.y);
  if(c && c.state !== "leaving"){
    selectCustomer(c.id);
    const hintEl = document.getElementById("hint");
    if(hintEl) hintEl.style.display = "none";
    floatText("주문 확인!", c.x, c.y-60, "#2EC4B6");
    if(typeof sfxTick === "function") sfxTick();
    if(typeof updateUI === "function") updateUI();
  }
}

// 6) UI 이펙트
function applyElementFX(el){
  if(!el) return;
  el.classList.remove("fx-pop");
  void el.offsetWidth;
  el.classList.add("fx-pop");
}

function updateFloats(dt){
  for(let i = floats.length - 1; i >= 0; i--){
    const f = floats[i];
    f.y += f.vy * dt;
    f.life -= dt;
    if(f.life <= 0) floats.splice(i, 1);
  }
}


function serveByMenu(menuId, actorKey='player') {
  const sel = state.selectedCustomerId;
  if(!sel){
    showToast("손님을 먼저 선택하세요!");
    sfxWrong();
    return;
  }
  const idx = state.customers.findIndex(c=>c.id===sel);
  if(idx === -1){
    state.selectedCustomerId = state.customers[0]?.id || null;
    showToast("손님을 다시 선택해요!");
    sfxWrong();
    return;
  }
  const c = state.customers[idx];
  if(c.state === "leaving"){
    showToast("이미 나가는 손님이에요!");
    return;
  }

  
  const centerX = c.x;
  const centerY = c.y;
const correct = (c.menuId === menuId);
  const rates = computeRates();
  const eff = rates.eff;

  if(!correct){
    // boss reacts on mistakes
    try{ state._serveStreak = 0; bossSpeak("메뉴 다시 확인!", 1.2, true); }catch(e){}
    state.rep = clamp(state.rep - CONFIG.repLossOnWrong, CONFIG.repMin, CONFIG.repMax);

    const basePenalty = 3;
    const mul = Math.max(0.25, 1 + (eff.wrongPatiencePenaltyMul||0));
    c.patience -= basePenalty * mul;

    floatText("❌ 틀림!", c.x, c.y - 60, "#FF6B6B");
    showToast("메뉴가 달라요!");
    sfxWrong();
    return;
  }

  // correct serve: build streak + occasional boss bonus (cosmetic + tiny rep)
  try{
    const st = (typeof state._serveStreak === "number" && isFinite(state._serveStreak)) ? state._serveStreak : 0;
    state._serveStreak = st + 1;
    if(state._serveStreak === 3) bossSpeak("좋아, 텐션 유지!", 1.4, false);
    if(state._serveStreak > 0 && state._serveStreak % 10 === 0){
      bossSpeak(`연속 ${state._serveStreak}콤보!`, 1.8, false);
      state.rep = clamp(state.rep + 0.15, CONFIG.repMin, CONFIG.repMax);
      floatText("✨ 사장님 칭찬! (평판+)", c.x, c.y - 92, "#FFD166");
    }
  }catch(e){}

  let price = getMenuPrice(menuId);
  price = Math.floor(price * (1 + (eff.earningMul||0)));

  // --- [NEW] 사장님 20단 콤보 버프 적용 (에러 완벽 차단) ---
  if (window._fxState && window._fxState.boss && window._fxState.boss.buffUntil > Date.now()) {
      price *= 2; 
  }

  // 팁(서비스 교육): 확률적으로 추가 수익
  const isStaff = (actorKey && actorKey !== "player");
  const tipRoll = Math.random();
  let tip = 0;
  
  // 👇 아까 실수로 날아갔던 '팁 발생 조건문' 복구!
  if(tipRoll < (rates.tipChance||0)){
    tip = Math.floor(price * (rates.tipMul||0));
    if(tip < 1) tip = 1;
    if(tip > 0){
      state.money += tip;
      state.todaySales = (state.todaySales||0) + tip;
      state.totalSales = (state.totalSales||0) + tip;

      // missions: tip counter
      state.missions = state.missions || {};
      state.missions._tipToday = (state.missions._tipToday||0) + 1;
      state.missions._weekTip  = (state.missions._weekTip||0) + 1;
      if(!state.menuStats[menuId]) state.menuStats[menuId] = { count:0, earned:0 };
      state.menuStats[menuId].earned += tip;
      if(state.contrib){
        if(isStaff) state.contrib.staff = (state.contrib.staff||0) + tip;
        else state.contrib.player = (state.contrib.player||0) + tip;
      }
      // 직원별 누적
      if(isStaff && state.staffStats && state.staffStats[actorKey]){
        state.staffStats[actorKey].earned = (state.staffStats[actorKey].earned||0) + tip;
      }
      floatText("💸 팁!", centerX + 10, centerY - 75, "#2EC4B6");
    }
  }


  // [NEW] 메뉴별 판매 통계
  if(!state.menuStats[menuId]) state.menuStats[menuId] = { count:0, earned:0 };
  state.menuStats[menuId].count += 1;
  state.menuStats[menuId].earned += price;
  
  // 온라인 매출만 todaySales/totalSales 반영
  state.money += price;
  state.todaySales += price;
  state.totalSales += price;
      
  // contribution tracking
  if(actorKey === "player"){
    state.contrib.player += price;
  }else if(actorKey === "system"){
    state.contrib.system += price;
  }else{
    ensureStaffStats();
    state.staffStats[actorKey].earned += price;
    state.contrib.staff += price;
  }
      
  // tips (scaled by tip level) - 기존 팁 로직 2
  let tipLv = 0;
  if(actorKey !== "player" && actorKey !== "system"){
    tipLv = (state.staffStats?.[actorKey]?.tip || 0);
  }
  const tipRate = 0.01 + levelCurve(tipLv) * 0.02; // ~1% to ~4%
  const tip2 = Math.max(0, Math.floor(price * tipRate));
  if(tip2 > 0){
    state.money += tip2;
    state.todaySales += tip2;
    state.totalSales += tip2;
    if(actorKey === "player") state.contrib.player += tip2;
    else if(actorKey === "system") state.contrib.system += tip2;
    else { state.staffStats[actorKey].earned += tip2; state.contrib.staff += tip2; }
    floatText(`+${fmtCompactWon(tip2)} 팁✨`, centerX, centerY-42, "gold");
  }

  const repGain = CONFIG.repGainOnCorrect + (eff.repGainAdd||0);
  state.rep = clamp(state.rep + repGain, CONFIG.repMin, CONFIG.repMax);

  floatText(`✅ +${fmtWon(price)}`, centerX, centerY - 60, "#FFD700");
  if(typeof sfxDing === "function") sfxDing();

  // 성공 시 "문으로 퇴장"
  c.state = "leaving";

  // 다음 선택 갱신(남아있는 waiting 손님 중 첫번째)
  const next = state.customers.find(x=>x.state!=="leaving" && x.id!==c.id) || state.customers.find(x=>x.state!=="leaving");
  state.selectedCustomerId = next ? next.id : null;

  if(typeof onServeOneOnline === "function") onServeOneOnline();
  if(typeof checkLevelUp === "function") checkLevelUp();

  const hintEl = document.getElementById("hint");
  if(hintEl) hintEl.style.display = "none";
  
  if(_saveDirty) save(true);
}

/* --------------------
   Missions (온라인 플레이에서만)
   - 일간 3개 올클 => veg 쿠폰 +1, 주간스탬프 +1 (최대 7)
   - 주간 3개 모두 done => 인증서 발급 가능 상태
-------------------- */
function ensureMissionReset(){
  const today = dayKey();

  // 주간 초기 세팅
  if(!state.missions.weekStartAt){
    startNewWeek();
  }

  // 주간 실패(기간 종료 + 달성 전) => 초기화
  if(Date.now() > state.missions.weekEndAt && !state.missions.weeklyCompletedAt){
    startNewWeek();
    showToast("주간 미션 기간이 끝나 초기화되었습니다!");
  }

  // 주간 달성 후 유효기간(7일) 종료 => 다음 주 시작 (인증서 발급/사용과 별개로)
  if(state.missions.weeklyCompletedAt && state.cert.validUntil && Date.now() > state.cert.validUntil && !state.cert.usedAt){
    // 유효기간 끝났는데 미사용이면 다음 주로 넘김(미사용 쿠폰은 유지하지 않음이 자연스럽지만 요구에 없음)
    // 여기서는 '인증서 유효만 종료' 처리
    state.cert.issuedAt = 0;
    state.cert.validUntil = 0;
    state.cert.issuedThisWeek = false;
    showToast("인증서 유효기간이 종료되었습니다.");
    if(_saveDirty) save(true);
  }

  // 일간 리셋
  if(state.missions.dailyKey !== today){
    state.missions.dailyKey = today;
    state.missions.dailyCompletedToday = false;
    state.missions.dailyStamps = 0;

    state.missions.dailyList = [
      { id:"d1", type:"serve",  title:"정확 서빙 6회", target:6, current:0, done:false },
      { id:"d2", type:"earn",   title:`오늘 매출 ${fmtNoWon(40000)}원`, target:40000, current:0, done:false },
      { id:"d3", type:"rep",    title:"평점 4.2 이상 유지", target:1, current:0, done:false },

      { id:"d4", type:"tip",    title:"팁 3회 받기", target:3, current:0, done:false },
      { id:"d5", type:"menu",   title:"특정 메뉴 2회 판매", target:2, current:0, done:false, menuId:null },
      { id:"d6", type:"upg",    title:"업그레이드 2회", target:2, current:0, done:false },
      { id:"d7", type:"sign",   title:"간판 업그레이드 1회", target:1, current:0, done:false },
      { id:"d8", type:"expand", title:"가게 확장 1회", target:1, current:0, done:false },
    ];

    // daily counters/snapshots
    state.missions._tipToday = 0;
    state.missions._upgBuysToday = 0;
    state.missions._dayStartMenuCounts = {};
    state.missions._dayStartSign = state.upgrades?.signboard || 0;
    state.missions._dayStartExpand = state.upgrades?.expand || 0;

    // snapshot menu counts & pick target menu (highest unlocked)
    try{
      MENUS.forEach(m=>{ state.missions._dayStartMenuCounts[m.id] = state.menuStats?.[m.id]?.count || 0; });
      const open = (typeof getOpenMenuCount==="function") ? getOpenMenuCount() : 1;
      const targetMenu = MENUS[Math.min(open-1, MENUS.length-1)] || MENUS[0];
      const mm = state.missions.dailyList.find(x=>x.type==="menu");
      if(mm){
        mm.menuId = targetMenu.id;
        mm.title = `특정 메뉴 ${mm.target}회 판매`;
        mm.done = false; mm.current = 0;
      }
    }catch(e){}

    state.offlineSalesToday = 0;
    state.todaySales = 0;
  }
}

function startNewWeek(){
  state.missions.weekStartAt = Date.now();
  state.missions.weekEndAt = state.missions.weekStartAt + 7*24*3600*1000;
  state.missions.weeklyStamps = 0;
  state.missions.weeklyCompletedAt = 0;
  state.missions._weekStartTotalSales = state.totalSales;

  state.missions.weeklyList = [
    { id:"w_stamp", type:"stamp", title:"일간 올클 7회 달성", target:7, current:0, done:false },
    { id:"w_sales", type:"sales", title:`7일 누적 매출 ${fmtNoWon(900000)}원`, target:900000, current:0, done:false },
    { id:"w_rep",   type:"rep",   title:"평점 4.4 이상 유지", target:1, current:0, done:false },

    { id:"w_tip",   type:"tip",   title:"팁 20회 받기", target:20, current:0, done:false },
    { id:"w_menu",  type:"menu",  title:"특정 메뉴 30회 판매", target:30, current:0, done:false, menuId:null },
    { id:"w_upg",   type:"upg",   title:"업그레이드 15회", target:15, current:0, done:false },
    { id:"w_sign",  type:"sign",  title:"간판 3단계 올리기", target:3, current:0, done:false },
    { id:"w_expand",type:"expand",title:"가게 확장 3단계", target:3, current:0, done:false },
  ];

  // weekly counters/snapshots
  state.missions._weekTip = 0;
  state.missions._weekUpgBuys = 0;
  state.missions._weekStartMenuCounts = {};
  state.missions._weekStartSign = state.upgrades?.signboard || 0;
  state.missions._weekStartExpand = state.upgrades?.expand || 0;

  try{
    MENUS.forEach(m=>{ state.missions._weekStartMenuCounts[m.id] = state.menuStats?.[m.id]?.count || 0; });
    const open = (typeof getOpenMenuCount==="function") ? getOpenMenuCount() : 1;
    const targetMenu = MENUS[Math.min(open-1, MENUS.length-1)] || MENUS[0];
    const mm = state.missions.weeklyList.find(x=>x.type==="menu");
    if(mm){ mm.menuId = targetMenu.id; }
  }catch(e){}

  // 주간 바뀌면 인증서 발급 플래그/상태 갱신
  state.cert.issuedThisWeek = false;
  state.cert.usedAt = 0;
  // issuedAt/validUntil은 "발급" 시 생성
  state.cert.issuedAt = 0;
  state.cert.validUntil = 0;
}

function onServeOneOnline(){
  const mServe = state.missions.dailyList.find(m=>m.type==="serve");
  if(mServe && !mServe.done) mServe.current += 1;
  try{ updateMissionsOnlineOnly(); }catch(e){ console.error('missions error', e); }
}

function updateMissionsOnlineOnly(){
  ensureMissionReset();
  if(!state.coupons) state.coupons = {drink:0, veg:0};

  // 일간
  for(const m of state.missions.dailyList){
    try{
      if(m.type === "earn") m.current = state.todaySales || 0;
      if(m.type === "rep")  m.current = ((state.rep||0) >= 4.2 ? 1 : 0);

      if(m.type === "tip")  m.current = state.missions._tipToday || 0;

      if(m.type === "menu"){
        const mid = m.menuId || MENUS[0].id;
        const start = state.missions._dayStartMenuCounts?.[mid] || 0;
        const now = state.menuStats?.[mid]?.count || 0;
        m.current = Math.max(0, now - start);
      }

      if(m.type === "upg")  m.current = state.missions._upgBuysToday || 0;

      if(m.type === "sign"){
        const base = state.missions._dayStartSign || 0;
        m.current = Math.max(0, (state.upgrades?.signboard||0) - base);
      }

      if(m.type === "expand"){
        const base = state.missions._dayStartExpand || 0;
        m.current = Math.max(0, (state.upgrades?.expand||0) - base);
      }
    }catch(e){
      m.current = m.current || 0;
    }
    m.done = (m.current >= m.target);
  }
  const dailyDoneCount = state.missions.dailyList.filter(x=>x.done).length;
  state.missions.dailyStamps = dailyDoneCount;

  const dailyAllDone = state.missions.dailyList.every(x=>x.done);
  if(dailyAllDone && !state.missions.dailyCompletedToday){
    state.missions.dailyCompletedToday = true;

    // ✅ 일간 올클 보상: veg 쿠폰 +1
    state.coupons.veg += 1;
    logBenefit({type:"veg", qty:1, source:"daily", note:"일간 올클 보상"});
    state.missions.weeklyStamps = Math.min(7, state.missions.weeklyStamps + 1);

    showToast("✅ 일간 올클! 무/양배추 쿠폰 +1, 주간 스탬프 +1");
    sfxFanfare();
    if(_saveDirty) save(true);
  }

  // 주간
  const wStamp = state.missions.weeklyList.find(x=>x.type==="stamp");
  if(wStamp){
    wStamp.current = state.missions.weeklyStamps;
    wStamp.done = (wStamp.current >= wStamp.target);
  }

  const wSales = state.missions.weeklyList.find(x=>x.type==="sales");
  if(wSales){
    const base = state.missions._weekStartTotalSales || 0;
    wSales.current = Math.max(0, state.totalSales - base);
    wSales.done = (wSales.current >= wSales.target);
  }

  const wRep = state.missions.weeklyList.find(x=>x.type==="rep");
  if(wRep){
    wRep.current = (state.rep >= 4.3 ? 1 : 0);
    wRep.done = (wRep.current >= wRep.target);
  }

  const weeklyAllDone = state.missions.weeklyList.every(x=>x.done);
  if(weeklyAllDone && !state.missions.weeklyCompletedAt){
    state.missions.weeklyCompletedAt = Date.now();
    showToast("🏅 주간 미션 올클! 이제 인증서 발급이 가능해요.");
    sfxFanfare();
    if(_saveDirty) save(true);
  }
}

/* --------------------
   Research
-------------------- */
function ensureResearchSlots(){
  const eff = sumEffects();
  const slots = clampInt(1 + (eff.researchSlots||0), 1, 2);
  state.research.slots = slots;
  while(state.research.running.length < slots){
    state.research.running.push({activeId:null, targetLevel:0, startAt:0, endAt:0});
  }
  if(state.research.running.length > slots){
    state.research.running = state.research.running.slice(0, slots);
  }
}

function startResearch(rid){
  const r = RESEARCH.find(x=>x.id===rid);
  if(!r) return;

  state.research.levels = state.research.levels || {};
  const curLvl = state.research.levels[rid] || 0;
  const maxL = r.maxLevel || 10;
  if(curLvl >= maxL){
    showToast("이미 최고 단계까지 완료된 연구입니다.");
    return;
  }

  ensureResearchSlots();
  ensureStaffStats();

  const slotIdx = state.research.running.findIndex(s=>!s.activeId);
  if(slotIdx === -1){
    showToast("연구 슬롯이 꽉 찼어요!");
    return;
  }

  const nextLvl = curLvl + 1;
  const base = (r.baseMin ?? r.minutes ?? 10);
  const scale = (r.timeScale ?? 1.35);
  const durMs = Math.round(base * Math.pow(scale, (nextLvl-1)) * 60 * 1000);

  const now = Date.now();
  state.research.running[slotIdx] = {activeId: rid, targetLevel: nextLvl, startAt: now, endAt: now + durMs};

  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);
  sfxTick();
  if(_saveDirty) save(true);
  renderPanel("res");
}

function updateResearch(){
  ensureResearchSlots();
  ensureStaffStats();
  let anyActive = false;
  let bestPct = 0;
  let statusText = "없음";

  for(let i=0;i<state.research.running.length;i++){
    const s = state.research.running[i];
    if(!s.activeId) continue;
    anyActive = true;
    const r = RESEARCH.find(x=>x.id===s.activeId);
    const total = s.endAt - s.startAt;
    const left = s.endAt - Date.now();
    const pct = clamp(1 - (left/total), 0, 1);
    bestPct = Math.max(bestPct, pct);

    if(left <= 0){
      const rid = s.activeId;
      const rinfo = RESEARCH.find(x=>x.id===rid);
      const maxL = rinfo?.maxLevel || 10;
      const tgt = s.targetLevel || ((state.research.levels?.[rid]||0)+1);
      state.research.levels = state.research.levels || {};
      state.research.levels[rid] = Math.min(maxL, Math.max(state.research.levels[rid]||0, tgt));

      state.research.running[i] = {activeId:null, targetLevel:0, startAt:0, endAt:0};

      const doneLvl = state.research.levels[rid]||0;
      showToast(`🎓 연구 완료: ${rinfo?.name || rid} Lv.${doneLvl}`);
      sfxFanfare();
      if(_saveDirty) save(true);
      renderPanel("res");
    }else{
      const mm = Math.floor(left/60000);
      const ss = Math.floor((left%60000)/1000);
      statusText = `슬롯${i+1}: ${r?.name || s.activeId} (${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")})`;
    }
  }

  if(anyActive){
    resStatus.textContent = statusText;
    resBar.style.width = `${Math.floor(bestPct*100)}%`;
  }else{
    resStatus.textContent = "없음";
    resBar.style.width = "0%";
  }
}

/* --------------------
   Upgrades purchase
-------------------- */
function buyUpgrade(id){
  const u = UPGRADES.find(x=>x.id===id);
  if(!u) return;
  const cur = state.upgrades[id] || 0;
  const maxL = u.maxLevel ?? 99;
  if(cur >= maxL){
    showToast("최대 레벨입니다!");
    return;
  }
  const regionCostMul = (typeof getRegion==="function" ? ((getRegion()?.costMul)||1) : 1);
  const cost = u.costFn(cur) * regionCostMul;
  if(!isFinite(cost) || cost<=0){
    showToast("구매할 수 없어요!");
    return;
  }
  if(state.money < cost){
    showToast("돈이 부족해요!");
    return;
  }
  state.money -= cost;

  // [특수] 배달 업그레이드
  // UI/코스트/세이브 일관성을 위해 state.upgrades와 state.delivery를 동기화합니다.
  if(id === "deliVehicle"){
    const next = clampInt((state.delivery?.level||0) + 1, 0, 10);
    state.delivery = state.delivery || { level:0, riders:0 };
    state.delivery.level = next;
    state.upgrades[id] = next; // 레벨 동기화
    AudioEngine.sfx.fanfare();
    showToast(`이동수단 진화 완료! (Lv.${next})`);
    if(_saveDirty) save(true);
    updateUI();
    renderPanel("upg");
    return;
  }
  if(id === "deliRider"){
    state.delivery = state.delivery || { level:0, riders:0 };
    const next = clampInt((state.delivery.riders||0) + 1, 0, 999);
    state.delivery.riders = next;
    state.upgrades[id] = next; // 레벨 동기화(고용 인원 = Lv)
    AudioEngine.sfx.coin();
    showToast(`라이더 고용 완료! (총 ${next}명)`);
    if(_saveDirty) save(true);
    updateUI();
    renderPanel("upg");
    return;
  }

  state.upgrades[id] = cur + 1;

  if(id === "menuUnlock"){
    buildMenuGrid();
  }

  showToast(`${u.name} Lv.${state.upgrades[id]} 구매!`);
  sfxTick();
  if(_saveDirty) save(true);
  renderPanel("upg");
  updateUI();
}

/* --------------------
   Events
-------------------- */
function maybeTriggerEvent(){
  if(state.event) return;
  if(Math.random() < CONFIG.eventRollChancePerCheck){
    const evt = EVENTS[Math.floor(Math.random()*EVENTS.length)];
    state.event = {
      id: evt.id, name: evt.name, desc: evt.desc, mod: evt.mod,
      endAt: Date.now() + evt.durationSec*1000
    };
    showToast(`이벤트 시작! ${evt.name}`);
    sfxFanfare();
    if(_saveDirty) save(true);
  }
}
function updateEvent(){
  if(!state.event){
    eventBanner.classList.remove("on");
    return;
  }
  const left = state.event.endAt - Date.now();
  if(left <= 0){
    showToast(`이벤트 종료: ${state.event.name}`);
    state.event = null;
    eventBanner.classList.remove("on");
    if(_saveDirty) save(true);
    return;
  }
  eventMsg.textContent = `${state.event.name} - ${state.event.desc}`;
  eventTimer.textContent = `남은 ${Math.ceil(left/1000)}s`;
  eventBanner.classList.add("on");
}

/* --------------------
   Reputation & leaves
-------------------- */
function updateCustomers(dt){
  const rates = computeRates();
  const eff = rates.eff;

  for(const c of state.customers){
    if(c.state === "leaving") continue;
    c.patience -= dt;
    if(c.patience <= 0){
      // 시간초과 -> 문으로 퇴장
      c.state = "leaving";
      if(state.selectedCustomerId === c.id){
        const next = state.customers.find(x=>x.state!=="leaving" && x.id!==c.id);
        state.selectedCustomerId = next ? next.id : null;
      }
      const leaveLoss = CONFIG.repLossOnLeave + (eff.leaveRepLossAdd||0);
      state.rep = clamp(state.rep - leaveLoss, CONFIG.repMin, CONFIG.repMax);
      floatText("😡 나감!", c.x, c.y - 60, "#FF6B6B");
      sfxWrong();
    }
  }

  const waitingCount = state.customers.filter(c=>c.state!=="leaving").length;

  if(waitingCount === 0){
    state.rep = clamp(state.rep + CONFIG.repRecoverIdlePerSec*dt, CONFIG.repMin, CONFIG.repMax);
  }else if(waitingCount >= Math.floor(CONFIG.maxCustomers*0.8)){
    state.rep = clamp(state.rep - CONFIG.repDecayCrowdPerSec*dt, CONFIG.repMin, CONFIG.repMax);
  }
}

/* --------------------
   Auto serve
-------------------- */
function pickStaffKey(){
  const staffCount = clampInt(state?.upgrades?.hire||0, 0, 5);
  if(staffCount<=0) return "player";
  ensureStaffStats();
  const hired = STAFF_POOL.slice(0, staffCount);
  if(!state._staffRot) state._staffRot = 0;
  const s = hired[state._staffRot % hired.length];
  state._staffRot = (state._staffRot + 1) % 999999;
  return s?.key || "player";
}

function autoServe(dt){
  const rates = computeRates();
  const servesPerSec = (rates.autoServesPerMin / 60) * 2; // 2x faster auto-serve
  state._autoServeAcc += servesPerSec * dt;

  while(state._autoServeAcc >= 1){
    const target = state.selectedCustomerId
      ? (state.customers.find(c=>c.id===state.selectedCustomerId && c.state!=="leaving") || state.customers.find(c=>c.state!=="leaving"))
      : state.customers.find(c=>c.state!=="leaving");
    if(!target) break;
    state.selectedCustomerId = target.id;
    const sk = pickStaffKey(); serveByMenu(target.menuId, sk);
    state._autoServeAcc -= 1;
  }
}

/* --------------------
   Spawn loop
-------------------- */

// [추가] 배달 업데이트 로직 (state.delivery 기반)
function computeDeliveryIntervalMs(vehicle){
  const info = state.delivery;
  const riders = Math.max(1, info.riders|0);

  // 기본 간격: 이동수단 속도 / 라이더 수
  let interval = vehicle.speed / riders;

  // 마케팅/트레이 등 배달 관련 성장 요소가 "빈도"에도 일부 반영되도록
  const eff = sumEffects();
  const freqMul = 1 + Math.max(0, (eff.deliveryMul||0) * 0.45) + Math.max(0,(eff.deliveryFreqMul||0)); // 수익배율의 60%만 빈도에 반영 (밸런스용)
  interval /= freqMul;

  // 버프(매출 2배) 때는 속도도 2배로!
  if(Date.now() < state.buffEndTime) interval /= 2;

  // 불규칙성: 배달마다 간격 랜덤화 (0.65~1.35)
  interval *= (0.65 + Math.random()*0.70);

  // 가끔은 쉬는 템포 (12% 확률)
  if(Math.random() < 0.12) interval *= 1.60;

  // 너무 빠르면 렉, 너무 느리면 답답 → 하한/상한
  interval = clamp(interval, 600, 60000); // 0.6초 ~ 60초

  return interval;
}

// [추가] 배달 업데이트 로직 (state.delivery 기반)
function updateDelivery(dt, now){
  const info = state.delivery;
  if(!info || info.riders <= 0) return;

  const vehicle = VEHICLES[clampInt(info.level,0,9)];

  // 다음 배달 간격이 아직 없거나 NaN이면 생성
  if(deliveryNextIntervalMs == null || !isFinite(deliveryNextIntervalMs)){
    deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle);
    if(!isFinite(deliveryNextIntervalMs)) deliveryNextIntervalMs = 8000;
    deliveryTimer = 0;
  }

  deliveryTimer += dt*1000;

  if(deliveryTimer >= deliveryNextIntervalMs){
    deliveryTimer = 0;
    processDelivery(vehicle);
    deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle); // 다음 배달 간격 재설정
  }

  // [추가] 고용만 해도 '종종' 라이더가 지나가게 (수익과 무관한 비주얼)
  // - 배달이 뜸할 때도 화면이 살아있게 함
  deliveryVisualAcc += dt;
  if(deliveryNextVisualSec <= 0) deliveryNextVisualSec = 2.5 + Math.random()*4.5; // 2.5~7초
  if(deliveryVisualAcc >= deliveryNextVisualSec){
    deliveryVisualAcc = 0;
    deliveryNextVisualSec = 2.5 + Math.random()*4.5;
    // 실제 배달(수익)과 분리된 연출: 55% 확률로만 생성 (과도 방지)
    if(Math.random() < 0.55){
      spawnVisualRider(vehicle, true);
    }
  }

  // 시각 효과 업데이트
  for(let i=visualRiders.length-1;i>=0;i--){
    const r=visualRiders[i];
    r.x += r.speed * (dt*60); // dt가 초 단위라서 보정
    const roadEndX = canvas.width - 140;
    if(r.x > roadEndX + 60) visualRiders.splice(i,1);
  }
}


function spawnVisualRider(vehicle, isIdle=false){
  // 순간이동 포털은 별도 연출
  if(vehicle.id >= 9){
    if(!isIdle){
      showFloatingText(canvas.width/2, canvas.height/2, "🌀 배달 완료!");
    }else{
      // idle 포털은 과하지 않게 작은 반짝
      showFloatingText(canvas.width/2, canvas.height/2, "✨");
    }
    return;
  }

  // 단일 레인: 도로 위쪽으로 달리게
  const roadY = canvas.height - 175;
  const baseY = roadY - 18;
  const y = baseY + (-6 + Math.random()*12);

  const fxMap = {
    0: '💦',
    1: '💨',
    2: '💨',
    3: '💨',
    4: '✨',
    5: '〰️',
    6: '💨',
    7: '🔥',
    8: '🔦'
  };

  // idle 라이더는 너무 자주/너무 많이 안 나오게 제한
  if(isIdle && visualRiders.length >= 6) return;

  visualRiders.push({
    emoji: vehicle.emoji,
    vehicleId: vehicle.id,
    x: -60,
    y,
    speed: 2.0 + (vehicle.id * 0.30) + (isIdle ? 0.0 : 0.2),
    phase: Math.random()*6.28,
    fx: fxMap[vehicle.id] || null,
    born: performance.now(),
    idle: !!isIdle
  });
}

function processDelivery(vehicle){
  // 배달 수익 = "현재 열린 메뉴 가격" 기준 (고정 19,000원 제거)
  try{
    const eff = sumEffects();
    const openCount = getOpenMenuCount ? getOpenMenuCount() : Math.min(MENUS.length, 3);
    const pool = MENUS.slice(0, Math.max(1, Math.min(MENUS.length, openCount)));
    const pick = pool[Math.floor(Math.random()*pool.length)];
    const menuId = pick?.id || MENUS[0].id;
    const basePrice = (typeof getMenuPrice === "function") ? getMenuPrice(menuId) : (pick?.price||19000);

    // "그대로" 메뉴가격을 받되, 배달 수익 업그레이드는 보너스 배율로만 반영(원가 자체는 메뉴가격 기반)
    let earnings = basePrice; // 메뉴 가격 그대로

    // 버프 적용
    if(Date.now() < (state.buffEndTime||0)) earnings *= 2;

    earnings = Math.floor(earnings);

    state.money += earnings;
    state.todaySales = (state.todaySales||0) + earnings;
    state.totalSales = (state.totalSales||0) + earnings;

    // 기여도(시스템/배달)
    state.contrib = state.contrib || { player:0, staff:0, system:0 };
    state.contrib.system = (state.contrib.system||0) + earnings;

    // 연출
    if(Math.random() < 0.25) AudioEngine.sfx.coin();
    spawnVisualRider(vehicle, false);
    showFloatingText(canvas.width - 110, canvas.height - 210, `+${fmtCompact(earnings)}`);
  }catch(e){
    // fail-safe: never crash the loop
    // console.error("[processDelivery]", e);
  }
}

// [추가] 온라인 주문(자동) 수익
function updateOnlineAuto(dt){
  const rates = computeRates();
  const ordersPerSec = rates.onlineOrdersPerMin / 60;
  if(ordersPerSec <= 0) return;

  onlineTimer += ordersPerSec * dt;
  while(onlineTimer >= 1){
    onlineTimer -= 1;

    // 온라인 주문은 자동 정산 (손님 생성 없이)
    const eff = sumEffects();
    const avgPrice = 18000;
    let earnings = avgPrice * (1 + (eff.priceBonus||0)/avgPrice);

    // 온라인 수익 배율(마케팅/트레이/연구)
    earnings *= (1 + (eff.onlineMul||0)) * (1 + (eff.onlineEarningMul||0));
    if(Date.now() < state.buffEndTime) earnings *= 2;

    state.money += earnings;
    state.contrib.system = (state.contrib.system||0) + earnings;

    if(Math.random() < 0.08) AudioEngine.sfx.coin();
    // 과도한 텍스트는 줄이기 위해 확률 표시
    if(Math.random() < 0.22) showFloatingText(canvas.width - 150, canvas.height - 190, `🛒 +${Math.floor(earnings).toLocaleString()}`);
  }
}

function spawnLoop(dt){
  const rates = computeRates();
  const ordersPerSec = rates.ordersPerMin / 60;
  state._spawnAcc += ordersPerSec * dt;
  while(state._spawnAcc >= 1){
    if(state.customers.length < CONFIG.maxCustomers) spawnCustomer();
    state._spawnAcc -= 1;
  }
}

/* --------------------
   Level up
-------------------- */

function getLifetimeSales(){
  return (state.totalSales||0) + (state.offlineSalesTotal||0);
}
function fmtDuration(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if(h>0) return `${h}시간 ${m}분`;
  if(m>0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function checkLevelUp(){
  const thresholds = CONFIG.levelUpTotalSales || [0];
  const maxLv = CONFIG.maxLevel || (thresholds.length ? thresholds.length-1 : 50);
  const sales = getLifetimeSales();
  let newLv = 1;
  for(let lv=1; lv<=maxLv; lv++){
    if(sales >= (thresholds[lv]||0)) newLv = lv;
  }
  newLv = Math.max(1, Math.min(newLv, maxLv));
  if(newLv > state.level){
    state.level = newLv;
    showToast(`🏢 레벨 업! Lv.${state.level}`);
    sfxFanfare();
    _saveDirty = true;
  }
}

/* --------------------
   Save/Load + Offline
-------------------- */
let _saveDirty = false;
let _lastSaveWriteAt = 0;
function save(force=false){
  // localStorage는 동기식이라 자주 쓰면 렉 유발. 
  // force=false는 '저장 필요'만 표시하고 실제 write는 autosave/종료 시에만 수행.
  if(!force){ _saveDirty = true; return; }
  state.lastSeenAt = Date.now();
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  _saveDirty = false;
  _lastSaveWriteAt = Date.now();
}

// Compatibility alias for older patched code paths.
function saveGame(){
  return save(true);
}


function load(){
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== "object") return false;
    state = { ...defaultState(), ...parsed };

    // deep patches
    state.profile = { ...defaultState().profile, ...(parsed.profile||{}) };
    state.coupons = { ...defaultState().coupons, ...(parsed.coupons||{}) };
    state.cert = { ...defaultState().cert, ...(parsed.cert||{}) };

    // [추가] 배달/온라인 초기화(세이브 데이터 호환)
    state.delivery = { ...defaultState().delivery, ...(parsed.delivery||{}) };
    state.online = { ...defaultState().online, ...(parsed.online||{}) };

    state.upgrades = parsed.upgrades || {};
    state.customers = parsed.customers || [];
    state.research = { ...defaultState().research, ...(parsed.research||{}) };

    // 연구 마이그레이션: 구버전 completed[] -> levels[id]=maxLevel
    if(Array.isArray(state.research.completed) && (!state.research.levels || Object.keys(state.research.levels).length===0)){
      state.research.levels = state.research.levels || {};
      for(const rid of state.research.completed){
        const r = RESEARCH.find(x=>x.id===rid);
        state.research.levels[rid] = r ? (r.maxLevel||10) : 10;
      }
    }

    state.missions = { ...defaultState().missions, ...(parsed.missions||{}) };

    // sound
    state.soundOn = (typeof parsed.soundOn === "boolean") ? parsed.soundOn : true;

    // benefits log
    state.benefitsLog = parsed.benefitsLog || [];

    sanitizeState();

    return true;
  }catch(e){ return false; }
}

function sanitizeState(){
  // [ending flags]
  if(typeof state.endingUnlocked !== 'boolean') state.endingUnlocked = false;
  if(typeof state.endingPrompted !== 'boolean') state.endingPrompted = false;
  if(typeof state.endingSeen !== 'boolean') state.endingSeen = false;
  if(typeof state.robotGrandson !== 'boolean') state.robotGrandson = false;

  const d = defaultState();

  // shallow merge critical top-level objects
  if(!state || typeof state !== "object") state = d;
  if(!state.profile) state.profile = d.profile;
  if(typeof state.soundOn !== "boolean") state.soundOn = d.soundOn;

  // money/rep/level
  const normNum = (v, fallback=0)=>{
    if(typeof v !== "number") return fallback;
    if(!isFinite(v) || isNaN(v)) return fallback;
    return v;
  };
  state.money = normNum(state.money, d.money);
  state.rep   = normNum(state.rep, d.rep);
  state.level = Math.max(1, Math.floor(normNum(state.level, d.level)));


  // [BRANCH/REGION] ensure region state exists (v84 -> v85 migration)
  if(typeof state.regionId !== "string" || !REGION_MAP[state.regionId]) state.regionId = REGIONS[0].id;
  if(!state.regionUnlocked || typeof state.regionUnlocked !== "object") state.regionUnlocked = {};
  if(state.regionUnlocked[REGIONS[0].id] !== true) state.regionUnlocked[REGIONS[0].id] = true;
  if(typeof state.mapSelected !== "string") state.mapSelected = state.regionId;

  // branches container
  if(!state.branches || typeof state.branches !== "object") state.branches = {};



  // [마이그레이션] 구버전: hire 업그레이드만 있고 직원 개별 데이터가 없으면 기본값 생성
  const hireLvl = clampInt(state?.upgrades?.hire||0, 0, 5);
  if(hireLvl > 0 && (!state.staffStats || Object.keys(state.staffStats).length === 0)){
    state.staffStats = {};
    for(let i=0;i<hireLvl;i++){
      const s = STAFF_POOL[i];
      if(!s) break;
      state.staffStats[s.key] = { auto:0, tip:0, earned:0 };
    }
  }

  if(typeof state.todaySales !== "number") state.todaySales = 0;
  if(typeof state.totalSales !== "number") state.totalSales = 0;
  if(typeof state.offlineSalesToday !== "number") state.offlineSalesToday = 0;
  if(typeof state.offlineSalesTotal !== "number") state.offlineSalesTotal = 0;

  // payroll / coupons / cert
  if(!state.payroll || typeof state.payroll !== "object") state.payroll = JSON.parse(JSON.stringify(d.payroll));
  if(typeof state.payroll.dailyWage !== "number") state.payroll.dailyWage = d.payroll.dailyWage;
  if(typeof state.payroll.lastDayKey !== "string") state.payroll.lastDayKey = d.payroll.lastDayKey;

  if(!state.coupons || typeof state.coupons !== "object") state.coupons = JSON.parse(JSON.stringify(d.coupons));
  if(typeof state.coupons.drink !== "number") state.coupons.drink = 0;
  if(typeof state.coupons.veg !== "number") state.coupons.veg = 0;

  if(!state.cert || typeof state.cert !== "object") state.cert = JSON.parse(JSON.stringify(d.cert));
  for(const k of ["issuedAt","validUntil","usedAt"]){
    if(typeof state.cert[k] !== "number") state.cert[k] = 0;
  }
  if(typeof state.cert.issuedThisWeek !== "boolean") state.cert.issuedThisWeek = false;

  if(!Array.isArray(state.benefitsLog)) state.benefitsLog = [];

  // upgrades
  if(!state.upgrades || typeof state.upgrades !== "object") state.upgrades = {};
  // delivery / online
  if(!state.delivery || typeof state.delivery !== "object") state.delivery = JSON.parse(JSON.stringify(d.delivery));
  if(typeof state.delivery.level !== "number") state.delivery.level = 0;
  if(typeof state.delivery.riders !== "number") state.delivery.riders = 0;

  if(!state.online || typeof state.online !== "object") state.online = JSON.parse(JSON.stringify(d.online));
  if(typeof state.online.level !== "number") state.online.level = 0;

  // customers
  if(!Array.isArray(state.customers)) state.customers = [];
  if(state.selectedCustomerId === undefined) state.selectedCustomerId = null;

  // research
  if(!state.research || typeof state.research !== "object") state.research = JSON.parse(JSON.stringify(d.research));
  if(typeof state.research.slots !== "number") state.research.slots = 1;
  if(!Array.isArray(state.research.running)) state.research.running = [];
  if(!state.research.levels || typeof state.research.levels !== "object") state.research.levels = {};
  if(!Array.isArray(state.research.completed)) state.research.completed = [];

  // missions
  if(!state.missions || typeof state.missions !== "object") state.missions = JSON.parse(JSON.stringify(d.missions));
  if(!Array.isArray(state.missions.dailyList)) state.missions.dailyList = [];
  if(!Array.isArray(state.missions.weeklyList)) state.missions.weeklyList = [];
  ensureMissionReset();

  // staff stats (per-staff earnings)
  ensureStaffStats();

  // playtime
  if(!state.play || typeof state.play !== "object"){
    state.play = { onlineSecTotal:0, offlineSecTotal:0, sessionStartAt:Date.now() };
  }else{
    if(typeof state.play.onlineSecTotal !== "number") state.play.onlineSecTotal = 0;
    if(typeof state.play.offlineSecTotal !== "number") state.play.offlineSecTotal = 0;
    if(typeof state.play.sessionStartAt !== "number") state.play.sessionStartAt = Date.now();
  }
}

let offlinePending = 0;
function avgPrice(){
  return MENUS.reduce((s,m)=>s+m.price,0)/MENUS.length;
}
  // boss/mission helpers
  if(typeof state._serveStreak !== 'number' || !isFinite(state._serveStreak)) state._serveStreak = 0;


function applyOfflineProgress(){
  const now = Date.now();
  const then = state.lastSeenAt || now;
  const diffMs = Math.max(0, now-then);
  const capMs = CONFIG.offlineMaxHours * 3600 * 1000;
  const usedMs = Math.min(diffMs, capMs);
  if(usedMs < 60*1000) return;

  const usedSec = usedMs/1000;
  state.play = state.play || {onlineSecTotal:0, offlineSecTotal:0, sessionStartAt:Date.now()};
  state.play.offlineSecTotal = (state.play.offlineSecTotal||0) + usedSec;
  const rates = computeRates();
  const eff = rates.eff;

  const served = Math.floor((rates.autoServesPerMin/60) * usedSec);

  let earned = served * (avgPrice() + (eff.priceBonus||0));
  earned *= (1 + (eff.earningMul||0));
  earned *= (0.85 + (state.rep/5)*0.2);
  earned = Math.floor(earned);

  // 연구 오프라인 진행은 유지(원하면 여기 막으면 됨)
  if(state.research?.running?.length){
    for(const s of state.research.running){
      if(s.activeId){
        s.startAt -= usedMs;
        s.endAt -= usedMs;
      }
    }
  }

  offlinePending = earned;
  // If offline modal elements are missing (or blocked), apply directly to money to prevent a hard crash.
  if(!modalOffline || !offlineEarn || !offlineTime){
    state.money += earned;
    return;
  }
  offlineEarn.textContent = `${fmtWon(earned)}`;
  offlineTime.textContent = `오프라인 ${Math.floor(usedSec/60)}분 동안 가족 알바 자동 운영`;
  modalOffline.classList.add("on");
}

if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
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
};

/* --------------------
   Certificate status + actions
-------------------- */
function certStatusText(){
  if(!state.missions.weeklyCompletedAt){
    return { okIssue:false, okUse:false, msg:"주간 미션을 아직 올클하지 않았어요." };
  }
  if(state.cert.usedAt){
    return { okIssue:false, okUse:false, msg:"이 인증서는 이미 사용 처리되었습니다. (주간이 초기화되어야 새로 발급 가능)" };
  }
  if(state.cert.issuedThisWeek){
    const leftDays = state.cert.validUntil ? Math.ceil((state.cert.validUntil - Date.now())/86400000) : 0;
    if(state.cert.validUntil && Date.now() > state.cert.validUntil){
      return { okIssue:false, okUse:false, msg:"인증서 유효기간이 만료됐어요. (새 주간을 진행해 주세요)" };
    }
    return { okIssue:false, okUse: state.coupons.drink>0, msg:`인증서 발급 완료 ✅ (유효 ${Math.max(0,leftDays)}일)` };
  }
  return { okIssue:true, okUse:false, msg:"주간 올클! 인증서 발급 가능 ✅" };
}

// Step 2-9: makeCardBtn handled once in initDOMRefs().

// Step 2-9: useCertDrinkBtn handled once in initDOMRefs().

function generateWeeklyCertificate(){
  const st = certStatusText();
  if(!st.okIssue && !state.cert.issuedThisWeek){
    showToast("인증서 발급 조건이 부족해요.");
    sfxWrong();
    return;
  }
  // 이미 발급된 주간이면 재생성(미리보기/다운로드)만 가능하게 허용
  if(!state.cert.issuedThisWeek){
    // 발급 처리
    state.cert.issuedThisWeek = true;
    state.cert.issuedAt = Date.now();
    state.cert.validUntil = state.cert.issuedAt + 7*24*3600*1000;

    // 발급 시 음료 쿠폰 1장 지급
    state.coupons.drink += 1;
    logBenefit({type:"drink", qty:1, source:"weekly_cert", note:"주간 올클 인증서 발급 보상"});
    showToast("🎫 인증서 발급 완료! 음료 쿠폰 +1");
    sfxFanfare();
    if(_saveDirty) save(true);
  }

  const c = document.getElementById("shareCanvas");
  const x = c.getContext("2d");

  x.fillStyle = "#FF9F1C";
  x.fillRect(0,0,1080,1920);
  x.fillStyle = "#FFF";
  x.fillRect(60, 80, 960, 1760);

  x.fillStyle = "#222";
  x.textAlign = "center";
  x.font = "bold 86px sans-serif";
  x.fillText("나이스치킨", 540, 250);
  x.font = "42px sans-serif";
  x.fillStyle = "#555";
  x.fillText("경남 창녕군 계성면", 540, 315);

  // 이름 표시(입력한 내용만 그대로)
  const uname = (state.profile?.name || "").trim();
  if(uname){
    x.fillStyle = "#222";
    x.font = "bold 44px sans-serif";
    x.fillText(uname, 540, 380);
  }

  x.fillStyle = "#2EC4B6";
  roundRect2(x, 250, 430, 580, 90, 24);
  x.fill();
  x.fillStyle = "#fff";
  x.font = "bold 44px sans-serif";
  x.fillText("주간 인증서", 540, 492);

  const issuedAt = new Date(state.cert.issuedAt || Date.now());
  const validUntil = new Date(state.cert.validUntil || Date.now());
  const wStart = new Date(state.missions.weekStartAt).toLocaleDateString("ko-KR");
  const wEnd = new Date(state.missions.weekEndAt).toLocaleDateString("ko-KR");

  const lines = [
    ["주간 시작", wStart],
    ["주간 종료", wEnd],
    ["발급일", issuedAt.toLocaleDateString("ko-KR")],
    ["유효기한", validUntil.toLocaleDateString("ko-KR")],
    ["현재 레벨", `Lv.${state.level}`],
    ["평점", `${state.rep.toFixed(1)} / 5.0`],
    ["온라인 누적 매출", `${fmtWon(state.totalSales)}`],
    ["온라인 오늘 매출", `${fmtWon(state.todaySales)}`],
  ];

  let y = 640;
  x.textAlign = "left";
  x.font = "bold 48px sans-serif";
  x.fillStyle = "#222";
  x.fillText("주간 성과", 140, y);
  y += 60;

  x.font = "40px sans-serif";
  for(const [k,v] of lines){
    x.fillStyle = "#777";
    x.fillText(k, 160, y);
    x.fillStyle = "#222";
    x.fillText(v, 520, y);
    y += 78;
  }

  x.fillStyle = "#333";
  x.textAlign = "center";
  x.font = "34px sans-serif";
  x.fillText("※ 인증서 사용 처리는 PIN CODE 확인 후 처리됩니다.", 540, 1710);

  const dataUrl = c.toDataURL("image/png");
  sharePreview.src = dataUrl;
  sharePreview.style.display = "block";
  downloadLink.href = dataUrl;
  downloadLink.download = `nicechicken_cert_${Date.now()}.png`;
  downloadLink.textContent = "이미지 다운로드";
  downloadLink.style.display = "inline-block";

  updateUI();
}

function roundRect2(ctx2, x, y, w, h, r){
  ctx2.beginPath();
  ctx2.moveTo(x+r, y);
  ctx2.arcTo(x+w, y, x+w, y+h, r);
  ctx2.arcTo(x+w, y+h, x, y+h, r);
  ctx2.arcTo(x, y+h, x, y, r);
  ctx2.arcTo(x, y, x+w, y, r);
  ctx2.closePath();
}

/* --------------------
   Coupons / exchange
-------------------- */
async function useCoupon(type){
  if(state.coupons[type] <= 0){
    showToast("보유 쿠폰이 없어요.");
    sfxWrong();
    return;
  }
  if(!confirm("쿠폰을 사용 처리할까요?\nPIN CODE 입력이 필요합니다.")){
    return;
  }
  const ok = await askPIN();
  if(!ok){
    showToast("PIN이 올바르지 않아요.");
    sfxWrong();
    return;
  }
  state.coupons[type] -= 1;
  logBenefit({type, qty:1, source:"coupon_use", note:"쿠폰함에서 사용 처리"});
  showToast("✅ 사용되었습니다.");
  sfxConfirm();
  if(_saveDirty) save(true);
  updateUI();
  renderCoupons();
}

// Step 2-9: useDrinkCouponBtn handled once in initDOMRefs().
// Step 2-9: useVegCouponBtn handled once in initDOMRefs().

function renderCoupons(){
  uiDrinkCoupons2.textContent = state.coupons.drink;
  uiVegCoupons2.textContent = state.coupons.veg;

  benefitLogList.innerHTML = "";
  const logs = state.benefitsLog || [];
  if(logs.length === 0){
    benefitLogList.textContent = "기록이 없어요.";
    return;
  }
  const lines = logs.slice(0, 30).map(l=>{
    const label = (l.type==="drink") ? "음료" : "무/양배추";
    return `• [${l.at}] ${label} x${l.qty} (${l.source}) ${l.note ? "- " + l.note : ""}`;
  });
  benefitLogList.innerHTML = lines.join("<br>");
}

function renderExchange(){
  uiMoney2.textContent = fmtWon(state.money);
  const cnt = Math.floor(state.money / CONFIG.exchangeUnit);
  uiExchangeCnt.textContent = cnt;
  doExchangeBtn.disabled = cnt <= 0;
}

// Step 2-9: doExchangeBtn handled once in initDOMRefs().

/* --------------------
   Rendering: background / sign / door / tables / staff / customers
-------------------- */
// [Signboard Image Loader]
// Put optional square(1:1) sign images next to this html (or in ./assets/).
// Naming convention (recommended):
//   assets/sign_0.png, assets/sign_1.png, ... assets/sign_5.png
// You can also use .jpg instead of .png.
// If an image file is missing, the game falls back to the default drawn signboard.
const SIGN_STAGES_MAX = 6;
const SIGN_IMAGE_CANDIDATES = Array.from({length:SIGN_STAGES_MAX}, (_,i)=> ([
  `assets/sign_${i}.png`,
  `assets/sign_${i}.jpg`,
  `sign_${i}.png`,
  `sign_${i}.jpg`,
]));
const SIGN_IMAGES = Array.from({length:SIGN_STAGES_MAX}, ()=>({ img:null, ok:false, tried:false, idx:0 }));

function preloadSignImages(){
  for(let i=0;i<SIGN_STAGES_MAX;i++){
    tryLoadSignImage(i);
  }
}
function tryLoadSignImage(stage){
  const slot = SIGN_IMAGES[stage];
  if(slot.tried && slot.ok) return;
  const candidates = SIGN_IMAGE_CANDIDATES[stage];
  if(!candidates || slot.idx >= candidates.length){
    slot.tried = true; slot.ok = false; slot.img = null;
    return;
  }
  const src = candidates[slot.idx++];
  const img = new Image();
  img.onload = ()=>{ slot.img = img; slot.ok = true; slot.tried = true; };
  img.onerror = ()=>{ tryLoadSignImage(stage); };
  img.src = src;
}
function getSignImage(stage){
  const slot = SIGN_IMAGES[stage];
  return (slot && slot.ok && slot.img) ? slot.img : null;
}

function signStage(){
  return clampInt(state.upgrades.sign||0, 0, 5);
}
function signStageName(lvl){
  const l = clampInt(lvl,0,5);
  return ["A4 간판","현수막","입간판","부착형 간판","대형 간판","네온사인"][l];
}
function roundRectPath(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawSignboard(){
  if(!ctx || !canvas) return;

  // 지점(지역)별 간판 레벨: 업그레이드 "signboard" 레벨을 사용 (0~9)
  const lvl = clampInt(state?.upgrades?.signboard || 0, 0, 9);

  const cx = canvas.width/2;
  const topY = 64 + canvas.height * 0.12;
  const name = "나이스 치킨";

  ctx.save();
  try{ ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }catch(_e){}

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 공통: 모든 간판에 둥둥 떠다니는 효과 적용 (레벨별로 위상차)
  const floatOffset = Math.sin(Date.now() / 800 + lvl) * 5;
  const y = topY + floatOffset;

  // 공통 외곽선 스타일 설정
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";

  switch(lvl) {
      case 0: // 골판지
          ctx.fillStyle = "#8D6E63";
          ctx.beginPath();
          ctx.moveTo(cx-100, y-30); ctx.lineTo(cx+100, y-35);
          ctx.lineTo(cx+95, y+35);  ctx.lineTo(cx-105, y+30);
          ctx.closePath(); 
          ctx.fill();
          ctx.stroke(); // 외곽선 추가

          ctx.font = "20px 'Jua', sans-serif"; ctx.fillStyle = "#3E2723"; 
          ctx.fillText(name + " 🐣", cx, y);
          break;

      case 1: // A4 용지
          ctx.fillStyle = "#FFF"; 
          ctx.fillRect(cx-90, y-30, 180, 60);
          ctx.strokeRect(cx-90, y-30, 180, 60); // 외곽선 추가
          
          // 테이프
          ctx.fillStyle = "rgba(200,200,200,0.5)";
          ctx.fillRect(cx-80, y-35, 20, 10); ctx.fillRect(cx+60, y-35, 20, 10);
          
          ctx.font = "22px 'Jua', sans-serif"; ctx.fillStyle = "#000"; 
          ctx.fillText("🐔 " + name, cx, y);
          break;

      case 2: // 나무
          ctx.fillStyle = "#5D4037"; 
          roundRectPath(cx-120, y-35, 240, 70, 5); 
          ctx.fill();
          ctx.stroke(); // 외곽선 추가
          
          // 나무결
          ctx.strokeStyle = "#4E342E"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(cx-100, y-10); ctx.lineTo(cx+100, y-10); ctx.stroke();
          
          // 끈
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(cx-80, y-35); ctx.lineTo(cx-80, y-60); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx+80, y-35); ctx.lineTo(cx+80, y-60); ctx.stroke();

          ctx.font = "24px 'Jua', sans-serif"; ctx.fillStyle = "#EFEBE9"; 
          ctx.fillText("🍗 " + name + " 🍗", cx, y);
          break;

      case 3: // 현수막
          // 끈
          ctx.strokeStyle="#ddd"; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(cx-130,y-40); ctx.lineTo(cx-130,y-60); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx+130,y-40); ctx.lineTo(cx+130,y-60); ctx.stroke();
          
          ctx.fillStyle = "#FFECB3";
          ctx.beginPath();
          ctx.moveTo(cx-140,y-40); ctx.quadraticCurveTo(cx,y-30,cx+140,y-40);
          ctx.lineTo(cx+140,y+30); ctx.quadraticCurveTo(cx,y+40,cx-140,y+30);
          ctx.closePath(); 
          ctx.fill();
          
          // 현수막 외곽선
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
          
          ctx.font = "26px 'Jua', sans-serif"; ctx.fillStyle = "#D84315"; 
          ctx.fillText("🔥 " + name + " 🔥", cx, y);
          break;

      case 4: // 천막(어닝)
          ctx.save();
          // 어닝 그림자
          ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(cx-120, y+20, 240, 10);

          // 스트라이프 어닝
          for(let i=-3; i<3; i++){
              ctx.fillStyle = (i%2===0) ? "#D32F2F" : "#FFF";
              ctx.fillRect(cx+i*40, y-45, 40, 50);
          }
          
          // 전체 어닝 외곽선
          ctx.strokeStyle = "white"; ctx.lineWidth = 3;
          ctx.strokeRect(cx-120, y-45, 240, 50);

          // 간판 베이스
          ctx.fillStyle = "#fff";
          ctx.fillRect(cx-120, y+5, 240, 40);
          ctx.strokeRect(cx-120, y+5, 240, 40); // 베이스 외곽선
          
          ctx.font = "24px 'Jua', sans-serif"; ctx.fillStyle = "#333"; 
          ctx.fillText("🏠 " + name + " 호프", cx, y+25);
          ctx.restore();
          break;

      case 5: // 아크릴
          ctx.save();
          ctx.shadowColor="rgba(0,0,0,0.3)"; ctx.shadowBlur=10; ctx.shadowOffsetY=5;
          ctx.fillStyle = "#FF9800"; 
          roundRectPath(cx-130, y-35, 260, 70, 15); 
          ctx.fill();
          ctx.restore();
          
          ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.stroke(); // 외곽선

          // 광택
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.beginPath(); ctx.arc(cx-100, y-15, 20, 0, Math.PI*2); ctx.fill();

          ctx.font = "28px 'Jua', sans-serif"; ctx.fillStyle = "#fff"; 
          ctx.shadowColor="rgba(0,0,0,0.3)"; ctx.shadowBlur=4;
          ctx.fillText("✨ " + name + " 치킨", cx, y);
          ctx.shadowBlur=0;
          break;

      case 6: // 네온
          // 배경
          ctx.fillStyle = "rgba(20,20,20,0.9)"; 
          roundRectPath(cx-140, y-40, 280, 80, 20); 
          ctx.fill();
          
          // 배경 외곽선 (흰색으로 구분)
          ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.stroke();

          // 네온 프레임
          ctx.shadowColor="#F50057"; ctx.shadowBlur=20; ctx.strokeStyle="#FF4081"; ctx.lineWidth=3;
          ctx.strokeRect(cx-130, y-30, 260, 60);
          
          // 네온 글자
          ctx.shadowColor="#00E5FF"; ctx.shadowBlur=20; ctx.fillStyle="#E0F7FA"; 
          ctx.font = "30px 'Jua', sans-serif"; 
          ctx.fillText("🍻 " + name, cx, y);
          
          // 깜빡임 효과
          if(Math.random() > 0.95) {
              ctx.globalAlpha = 0.5;
              ctx.shadowBlur = 0;
              ctx.fillText("🍻 " + name, cx, y);
              ctx.globalAlpha = 1.0;
          }
          ctx.shadowBlur=0;
          break;

      case 7: // LED 전광판
          // 외관 프레임
          ctx.fillStyle = "#111"; 
          roundRectPath(cx-155, y-40, 310, 80, 5); 
          ctx.fill();
          ctx.strokeStyle = "#888"; ctx.lineWidth=3; ctx.stroke(); // 프레임 외곽선
          
          // LED 화면
          ctx.fillStyle = "#000"; ctx.fillRect(cx-150, y-35, 300, 70);
          
          ctx.fillStyle = "rgba(20,20,20,1)";
          for(let x=cx-150; x<cx+150; x+=10) ctx.fillRect(x, y-35, 1, 70);

          // 글자
          ctx.shadowColor = "#76FF03"; ctx.shadowBlur = 10;
          ctx.font = "28px 'Jua', sans-serif"; ctx.fillStyle = "#76FF03"; 
          
          const offset = Math.sin(Date.now() / 500) * 5;
          ctx.fillText("◀ 🛵 " + name + " 🛵 ▶", cx + offset, y);
          
          ctx.shadowBlur = 0;
          break;

      case 8: // 순금
          const grd = ctx.createLinearGradient(cx-150, y-40, cx+150, y+40);
          grd.addColorStop(0, "#FDB931"); 
          grd.addColorStop(0.3, "#FFFFE0");
          grd.addColorStop(0.5, "#D4AF37"); 
          grd.addColorStop(0.8, "#FDB931"); 
          grd.addColorStop(1, "#8D6E63");
          
          ctx.save();
          ctx.shadowColor="rgba(0,0,0,0.4)"; ctx.shadowBlur=10; ctx.shadowOffsetY=5;
          ctx.fillStyle = grd; 
          roundRectPath(cx-160, y-40, 320, 80, 10); 
          ctx.fill();
          ctx.restore();

          // 순금 외곽선 (반짝이는 느낌 강조)
          ctx.strokeStyle = "#FFF"; ctx.lineWidth = 2; ctx.stroke(); 
          
          // 내부 음각 라인
          ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth=2;
          roundRectPath(cx-150, y-30, 300, 60, 5); ctx.stroke();

          ctx.font = "34px 'Jua', sans-serif"; 
          ctx.fillStyle = "#5D4037"; 
          ctx.fillText("👑 " + name + " 👑", cx, y);
          
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillText("👑 " + name + " 👑", cx-1, y-1);
          break;

      case 9: // 홀로그램
          ctx.globalCompositeOperation = "screen"; 
          ctx.globalAlpha = 0.85;
          
          ctx.fillStyle = "rgba(0,255,255,0.15)";
          ctx.strokeStyle="#00E5FF"; ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(cx-160, y-30); ctx.lineTo(cx+160, y-30);
          ctx.lineTo(cx+140, y+40); ctx.lineTo(cx-140, y+40);
          ctx.closePath(); 
          ctx.fill(); 
          ctx.stroke();
          
          // 홀로그램 외곽 글로우 효과
          ctx.shadowColor = "#00E5FF"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;

          ctx.fillStyle = "rgba(0,255,255,0.1)";
          for(let i=y-30; i<y+40; i+=4) {
              ctx.fillRect(cx-140, i, 280, 1);
          }

          ctx.shadowColor="#00E5FF"; ctx.shadowBlur=20; ctx.fillStyle="#E0F7FA"; 
          ctx.font = "32px 'Jua', sans-serif"; 
          ctx.fillText("🪐 " + name + " 🛸", cx, y);
          
          ctx.beginPath();
          ctx.moveTo(cx, topY+60 + floatOffset); // 빔 시작점도 같이 이동
          ctx.lineTo(cx-100, y+40);
          ctx.lineTo(cx+100, y+40);
          
          const beamGrd = ctx.createLinearGradient(cx, topY+60+floatOffset, cx, y+40);
          beamGrd.addColorStop(0, "rgba(0,255,255,0)");
          beamGrd.addColorStop(1, "rgba(0,255,255,0.1)");
          ctx.fillStyle = beamGrd;
          ctx.fill();

          ctx.shadowBlur=0;
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = "source-over";
          break;
  }

  ctx.restore();
}

// ==========================================
// [NEW] 사장님 & 알바생 전용 고퀄리티 말풍선 (손님용과 분리)
// ==========================================
function drawStaffSpeechBubble(x, y, text, isBoss) {
  ctx.save();
  ctx.font = "16px 'Jua', sans-serif";
  const metrics = ctx.measureText(text);
  const w = metrics.width + 20;
  const h = 34;
  const r = 10;
  
  // 화면 밖으로 나가지 않도록 x좌표 보정
  const safeX = Math.max(w/2 + 10, Math.min(x, canvas.width - w/2 - 10));

  ctx.fillStyle = isBoss ? "white" : "#fff9c4";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  
  // 말풍선 본체
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(safeX - w/2, y - h/2, w, h, r);
  else ctx.rect(safeX - w/2, y - h/2, w, h);
  ctx.fill();
  ctx.stroke();
  
  // 꼬리
  ctx.beginPath();
  ctx.moveTo(safeX, y + h/2); 
  ctx.lineTo(x, y + h/2 + 8); 
  ctx.lineTo(safeX + (x > safeX ? 5 : -5), y + h/2); 
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 0; 
  ctx.fillText(text, safeX, y + 2);
  ctx.restore();
}

function drawBoss(charY){
  if(!ctx || !canvas) return;
  
  // [수정 핵심 1] performance.now()를 빼고 무조건 Date.now()로 통일!
  const now = Date.now(); 
  const h = canvas.height;
  const w = canvas.width;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  
  const baseX = Math.floor(w * 0.5);
  const baseY = Math.floor(isFinite(charY) ? charY : (floorY - 58));

  const bob = Math.sin(now / 260) * 4;
  const bossX = baseX;
  const bossY = baseY + bob; 

  const fx = window._fxState?.boss || {};
  
  // 남은 시간 계산 (이제 정상적으로 줄어듦)
  const bossBuffRemaining = Math.max(0, (fx.buffUntil || 0) - now);
  const isBossBuff = bossBuffRemaining > 0;

  let bossBaseScale = 1.0;
  if(isBossBuff) {
      bossBaseScale = 2.0 + Math.sin(now * 0.02) * 0.1; 
  }

  const bossClickScale = getClickScale(fx.lastClick || 0);
  const bossFinalScale = bossBaseScale * bossClickScale;

  ctx.save();
  ctx.translate(bossX, bossY);
  ctx.scale(bossFinalScale, bossFinalScale); 
  ctx.font = "60px 'Jua', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👩‍🍳", 0, -20);
  
  if(isBossBuff) {
      ctx.font = "20px sans-serif";
      ctx.fillText("🔥", -40, -10);
      ctx.fillText("🔥", 40, -10);
  }

  ctx.font = "16px 'Jua', sans-serif";
  ctx.fillStyle = isBossBuff ? "#FF5252" : "white";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
  ctx.fillText(isBossBuff ? "극대노!" : "사장님", 0, 20);
  ctx.restore();

  if (isBossBuff) {
      const barW = 120;
      const barH = 10;
      const barX = bossX - barW/2;
      const barY = bossY - 140; 
      
      ctx.save();
      ctx.translate(bossX, barY - 25 + Math.sin(now*0.01)*5);
      ctx.font = "bold 24px 'Jua', sans-serif";
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FF0000";
      ctx.shadowBlur = 10;
      ctx.textAlign = "center";
      ctx.fillText("💸 매출 2배 💸", 0, 0); 
      ctx.restore();

      // [수정 핵심 2] 사장님 버프는 10초(10000ms)이므로 10000으로 나누고 최대 1을 넘지 못하게 잠금!
      const ratio = Math.min(1, bossBuffRemaining / 10000); 
      
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); 
      if(ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 5); else ctx.rect(barX, barY, barW, barH);
      ctx.fill();
      
      let barColor = "#76FF03";
      if(ratio < 0.6) barColor = "#FFEB3B";
      if(ratio < 0.3) barColor = "#FF1744";
      
      ctx.fillStyle = barColor;
      ctx.beginPath(); 
      if(ctx.roundRect) ctx.roundRect(barX, barY, barW * ratio, barH, 5); else ctx.rect(barX, barY, barW * ratio, barH);
      ctx.fill();
      
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);
  }

  const speech = window._fxState?.speech || {};
  if (speech.type === 'boss' && speech.until > now) {
      const bubbleY = isBossBuff ? bossY - 230 : bossY - 85;
      drawStaffSpeechBubble(bossX, bubbleY, speech.msg, true);
  }
}

function drawStaff(y){
  if(!ctx || !canvas) return;
  // [수정] 알바생도 무조건 Date.now()로 통일!
  const now = Date.now();
  ctx.save();
  
  const staffs = staffCenters();
  if(staffs.length === 0){ ctx.restore(); return; }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for(let i=0; i<staffs.length; i++){
      const s = staffs[i];
      const sFx = window._fxState?.staffs[s.key] || { lastClick: 0, buffUntil: 0, dailyUses: 0 };
      
      const buffRemaining = Math.max(0, (sFx.buffUntil || 0) - now);
      const isBuffed = buffRemaining > 0;
      const isExhausted = (sFx.dailyUses || 0) >= 5;

      let baseScale = 1.0;
      if(isBuffed) {
          baseScale = 1.3 + Math.sin(now * 0.015) * 0.05; 
      }
      const clickScale = getClickScale(sFx.lastClick || 0);
      const finalScale = baseScale * clickScale;

      const bob = Math.sin(now / 300 + i) * 3;
      let cy = s.y + bob;

      ctx.save();
      ctx.translate(s.x, cy);
      ctx.scale(finalScale, finalScale); 

      ctx.font = "50px 'Jua', sans-serif";
      ctx.fillStyle = "#000";
      ctx.fillText(s.emoji, 0, -10);

      ctx.font = "14px 'Jua', sans-serif";
      ctx.fillStyle = isBuffed ? "#FFD700" : (isExhausted ? "#bbb" : "#eee"); 
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.fillText(s.label, 0, 25);
      
      ctx.font = "10px sans-serif";
      ctx.shadowBlur = 0;
      if(!isExhausted) {
          ctx.fillStyle = "#fff";
          ctx.fillText(`${sFx.dailyUses || 0}/5`, 0, 40);
      } else {
          ctx.fillStyle = "#ff6b6b";
          ctx.fillText("End", 0, 40);
      }
      ctx.restore();
      
      if(isBuffed) {
          const barW = 80; 
          const barH = 8;
          const barX = s.x - barW/2;
          const barY = cy - 90; 
          // [수정] 알바생 이펙트는 5초(5000ms) 기준이므로 5000으로 나누기
          const ratio = Math.min(1, buffRemaining / 5000);

          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath(); 
          if(ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 4); else ctx.rect(barX, barY, barW, barH);
          ctx.fill();
          
          ctx.fillStyle = "#FFD700";
          ctx.beginPath(); 
          if(ctx.roundRect) ctx.roundRect(barX, barY, barW * ratio, barH, 4); else ctx.rect(barX, barY, barW * ratio, barH);
          ctx.fill();
          
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#FF5252";
          ctx.textAlign = "center";
          ctx.fillText("x2", s.x, barY - 5);
      }

      const speech = window._fxState?.speech || {};
      if (speech.type === 'staff' && speech.key === s.key && speech.until > now) {
          const bubbleY = isBuffed ? cy - 150 : cy - 85;
          drawStaffSpeechBubble(s.x, bubbleY, speech.msg, false); 
      }
  }
  ctx.restore();
}

function drawDoor(){
  const d = doorRect();
  ctx.save();
  // frame
  ctx.fillStyle = "rgba(0,0,0,.35)";
  roundRectPath(d.x-6, d.y-6, d.w+12, d.h+12, 14);
  ctx.fill();

  // door
  ctx.fillStyle = "rgba(255,255,255,.12)";
  roundRectPath(d.x, d.y, d.w, d.h, 12);
  ctx.fill();

  // inner
  ctx.fillStyle = "rgba(0,0,0,.28)";
  roundRectPath(d.x+10, d.y+12, d.w-20, d.h-22, 10);
  ctx.fill();

  // handle
  ctx.fillStyle = "rgba(255,215,0,.85)";
  ctx.beginPath();
  ctx.arc(d.x + d.w - 16, d.y + d.h/2, 4, 0, Math.PI*2);
  ctx.fill();

  ctx.font = "14px Jua";
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("출구", d.cx, d.y + d.h + 6);
  ctx.restore();
}

function drawTables(){
  // simple tables in middle area (reduced to half size)
  const midY = canvas.height*0.46;
  const s = 0.5;
  const tW = 96*s, tH = 58*s;
  const t1 = {x: canvas.width*0.28, y: midY,     w: tW, h: tH};
  const t2 = {x: canvas.width*0.72, y: midY+18,  w: tW, h: tH};

  const drawTable = (t)=>{
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.16)";
    roundRectPath(t.x - t.w/2, t.y - t.h/2 + 6*s, t.w, t.h, 14*s);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    roundRectPath(t.x - t.w/2, t.y - t.h/2, t.w, t.h, 14*s);
    ctx.fill();

    // plates
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.beginPath(); ctx.arc(t.x-18*s, t.y-6*s, 10*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(t.x+20*s, t.y+8*s, 8*s, 0, Math.PI*2); ctx.fill();

    // chairs
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.arc(t.x - t.w/2 + 10*s, t.y - 4*s, 10*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(t.x + t.w/2 - 10*s, t.y + 6*s, 10*s, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  };
  drawTable(t1); drawTable(t2);
}


function drawCounter(){
  // kitchen/counter area
  const y = canvas.height - 140;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(0, y+8, canvas.width, 92);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(0, y, canvas.width, 88);

  ctx.fillStyle = "rgba(255,159,28,.35)";
  ctx.fillRect(0, y, canvas.width, 10);

  // 카운터 텍스트 제거 (가독성)
  ctx.restore();
}

const _BG_CACHE = { key:null, data:null };
function _bgSeededRand(seed){
  // LCG
  let s = seed >>> 0;
  return function(){
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ==========================================
// 🎨 아트 배경 스튜디오 (그래픽 헬퍼 함수)
// ==========================================
function getAtmosphere(level) {
    if (level === 0) return { desc: "새벽", skyColors: [{stop:0, color:"#2b32b2"}, {stop:1, color:"#1488cc"}], filter: null, skyType: 'dawn', starOpacity: 0.2 };
    if (level === 1) return { desc: "이른 아침", skyColors: [{stop:0, color:"#1c92d2"}, {stop:1, color:"#f2fcfe"}], filter: null, skyType: 'day', starOpacity: 0 };
    if (level === 2) return { desc: "정오", skyColors: [{stop:0, color:"#2980B9"}, {stop:1, color:"#6DD5FA"}], filter: null, skyType: 'day', starOpacity: 0 };
    if (level === 3) return { desc: "오후", skyColors: [{stop:0, color:"#005bea"}, {stop:1, color:"#00c6fb"}], filter: null, skyType: 'day', starOpacity: 0 };
    if (level === 4) return { desc: "늦은 오후", skyColors: [{stop:0, color:"#3a7bd5"}, {stop:1, color:"#ffd194"}], filter: {mode:'overlay', color:'rgba(255, 200, 100, 0.1)'}, skyType: 'day', starOpacity: 0 };
    if (level === 5) return { desc: "골든 아워", skyColors: [{stop:0, color:"#ff9966"}, {stop:1, color:"#ff5e62"}], filter: {mode:'overlay', color:'rgba(255, 160, 0, 0.2)'}, skyType: 'sunset', starOpacity: 0 };
    if (level === 6) return { desc: "노을", skyColors: [{stop:0, color:"#AA076B"}, {stop:1, color:"#61045F"}], filter: {mode:'overlay', color:'rgba(200, 50, 50, 0.2)'}, skyType: 'sunset', starOpacity: 0.1 };
    if (level === 7) return { desc: "초저녁", skyColors: [{stop:0, color:"#200122"}, {stop:1, color:"#6f0000"}], filter: {mode:'multiply', color:'rgba(50, 0, 100, 0.3)'}, skyType: 'night', starOpacity: 0.4 };
    if (level === 8) return { desc: "도시의 밤", skyColors: [{stop:0, color:"#0f0c29"}, {stop:0.5, color:"#302b63"}, {stop:1, color:"#24243e"}], filter: {mode:'multiply', color:'rgba(0, 0, 50, 0.4)'}, skyType: 'night', starOpacity: 0.8 };
    if (level === 9) return { desc: "심야", skyColors: [{stop:0, color:"#000000"}, {stop:1, color:"#0f0c29"}], filter: {mode:'multiply', color:'rgba(0, 0, 0, 0.6)'}, skyType: 'night', starOpacity: 1.0 };
    return { desc: "축제", skyColors: [{stop:0, color:"#141E30"}, {stop:1, color:"#243B55"}], filter: {mode:'color-dodge', color:'rgba(100, 50, 255, 0.1)'}, skyType: 'special', starOpacity: 1.0 };
}

function drawSkyGradient(ctx, w, h, colors) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach(c => grd.addColorStop(c.stop, c.color));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
}

function drawCloud(ctx, cx, cy, scale, opacity = 0.8) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.arc(25, -10, 35, 0, Math.PI * 2);
    ctx.arc(50, 0, 30, 0, Math.PI * 2);
    ctx.arc(25, 10, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawCelestial(ctx, x, y, r, color, glowColor) {
    ctx.save();
    const grd = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    grd.addColorStop(0, color);
    grd.addColorStop(0.3, glowColor);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawHill(ctx, w, yBase, amplitude, frequency, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= w; x += 10) {
        const y = yBase - Math.sin(x * frequency) * amplitude - Math.cos(x * frequency * 0.5) * (amplitude * 0.5);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill();
}

function drawStatueOfLiberty(ctx, x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = color;
    ctx.fillRect(-15, 0, 30, 40); // Base
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-12, -60); ctx.lineTo(8, -60); ctx.lineTo(10, 0); ctx.fill(); // Body
    ctx.beginPath(); ctx.arc(0, -65, 6, 0, Math.PI*2); ctx.fill(); // Head
    ctx.strokeStyle = color; ctx.lineWidth = 1; // Crown
    for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.moveTo(0, -70);
        const angle = (Math.PI/6) * (i-2) - Math.PI/2;
        ctx.lineTo(Math.cos(angle)*10, -70 + Math.sin(angle)*10); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(8, -55); ctx.lineTo(18, -85); ctx.lineTo(20, -85); ctx.lineTo(12, -55); ctx.fill(); // Right Arm
    ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(19, -90, 4, 0, Math.PI*2); ctx.fill(); // Torch Flame
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-10, -55); ctx.lineTo(-18, -45); ctx.lineTo(-12, -40); ctx.fill(); // Left Arm
    ctx.restore();
}

function drawEiffelTower(ctx, x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-10, -40, -2, -100); ctx.lineTo(2, -100); ctx.quadraticCurveTo(10, -40, 20, 0); ctx.fill();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, -35); ctx.lineTo(12, -35); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -70); ctx.lineTo(6, -70); ctx.stroke();
    ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-5, -35); ctx.moveTo(-5, 0); ctx.lineTo(-10, -35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -100); ctx.lineTo(0, -110); ctx.stroke();
    ctx.restore();
}

function drawFireworks(ctx, w, h, count, randFunc, now) {
    // 시간에 따라 폭죽이 터지고 사라지는 애니메이션 적용
    const phase = Math.floor(now / 1500); 
    for(let i=0; i<count; i++) {
        const fwSeed = phase + i*10;
        let s = fwSeed; 
        const r = () => { s = Math.sin(s)*10000; return s - Math.floor(s); };
        
        const cx = r() * w;
        const cy = h * 0.1 + r() * h * 0.4;
        const color = `hsl(${r()*360}, 100%, 70%)`;
        
        const age = (now % 1500) / 1500; // 0 to 1
        if (age > 0.8) continue; // 끝물엔 사라짐
        
        const radius = (20 + r() * 30) * Math.sin(age * Math.PI / 2);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * (1 - age);
        ctx.globalAlpha = 1 - Math.pow(age, 2);
        
        const particles = 12;
        for(let j=0; j<particles; j++) {
            const angle = (Math.PI*2 / particles) * j;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle)*(radius*0.2), cy + Math.sin(angle)*(radius*0.2));
            ctx.lineTo(cx + Math.cos(angle)*radius, cy + Math.sin(angle)*radius);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }
}

function drawBackground() {
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. 상태 가져오기 (게임 데이터 연동)
    const region = (typeof getRegion === "function" ? getRegion() : null) || { id: "changnyeong" };
    // 게임 내 region id ('japan' 등)를 스튜디오 테마 이름과 매칭
    let theme = region.id || "changnyeong";
    if (theme === "japan") theme = "europe"; // 일본 지역에 에펠탑/유럽 아트 적용!

    // 인테리어 업그레이드 레벨 (0~10)
    const level = clampInt(state?.upgrades?.interior || 0, 0, 10);
    const atmos = getAtmosphere(level);

    // 2. 바닥 높이 계산 (게임 렌더링 기준선)
    const floorH = Math.max(70, Math.floor(h * 0.12));
    const floorY = h - floorH;
    const viewH = floorY; // 배경 풍경이 보일 높이

    // 3. 60FPS 깜빡임 방지용 고정 난수 (프레임마다 동일한 난수 시퀀스 보장)
    let _seed = level * 123 + theme.charCodeAt(0);
    const rand = () => {
        _seed = Math.sin(_seed) * 10000;
        return _seed - Math.floor(_seed);
    };

    // ==========================================
    // 🎨 PART A: 스튜디오 명품 배경 (풍경)
    // ==========================================
    ctx.save();
    // 바닥 아래로는 풍경이 그려지지 않도록 클리핑 마스크 적용
    ctx.beginPath();
    ctx.rect(0, 0, w, viewH);
    ctx.clip();

    // 하늘
    let skyColors = atmos.skyColors;
    if (theme === 'mars') {
        skyColors = [{ stop: 0, color: "#0D0221" }, { stop: 0.7, color: "#2E1437" }, { stop: 1, color: "#590D22" }];
    }
    drawSkyGradient(ctx, w, viewH, skyColors);

    // 뉴욕 성조기 스트라이프
    if (theme === 'usa' && level <= 5) {
        ctx.save(); ctx.globalAlpha = 0.05; ctx.fillStyle = "#fff";
        for (let i = 0; i < viewH; i += 40) ctx.fillRect(0, i, w, 20);
        ctx.restore();
    }

    // 천체
    if (theme === 'mars') {
        ctx.fillStyle = "#FFF";
        for (let i = 0; i < 100; i++) {
            ctx.globalAlpha = rand() * 0.8 + 0.2;
            ctx.beginPath(); ctx.arc(rand() * w, rand() * viewH, rand() * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        drawCelestial(ctx, w * 0.8, viewH * 0.3, 60, "#FF7043", "rgba(255, 87, 34, 0.4)");
    } else {
        if (atmos.skyType === 'night' || atmos.skyType === 'dawn' || atmos.skyType === 'special') {
            ctx.fillStyle = "#FFF";
            for (let i = 0; i < 80; i++) {
                ctx.globalAlpha = rand() * atmos.starOpacity;
                ctx.fillRect(rand() * w, rand() * viewH * 0.6, rand() * 2, rand() * 2);
            }
            ctx.globalAlpha = 1;
            if (atmos.skyType !== 'dawn') drawCelestial(ctx, w * 0.85, viewH * 0.15, 25, "#FFF9C4", "rgba(255,255,255,0.1)");
        } else {
            const sunColor = (atmos.skyType === 'sunset') ? "#FF5252" : "#FFEB3B";
            const sunY = (atmos.skyType === 'sunset') ? viewH * 0.6 : viewH * 0.15;
            drawCelestial(ctx, w * 0.85, sunY, 35, sunColor, "rgba(255, 200, 0, 0.3)");
        }
    }

    // 지역별 드로잉
    ctx.save();
    if (theme === 'usa') {
        const groundY = viewH;
        ctx.fillStyle = (atmos.skyType === 'night') ? "#1A237E" : "#7986CB";
        for (let x = 0; x < w; x += 15) {
            const bh = 50 + rand() * 80; ctx.fillRect(x, groundY - bh, 16, bh);
        }
        ctx.fillStyle = (atmos.skyType === 'night') ? "#0D47A1" : "#3F51B5";
        const buildings = [
            { x: 0.1, h: 200, type: 'box' }, { x: 0.3, h: 280, type: 'needle' },
            { x: 0.5, h: 150, type: 'box' }, { x: 0.6, h: 240, type: 'slope' }, { x: 0.9, h: 180, type: 'box' }
        ];
        buildings.forEach(b => {
            const bx = w * b.x, by = groundY, bw = 50;
            ctx.fillRect(bx, by - b.h, bw, b.h);
            if (b.type === 'needle') {
                ctx.beginPath(); ctx.moveTo(bx, by - b.h); ctx.lineTo(bx + bw / 2, by - b.h - 50); ctx.lineTo(bx + bw, by - b.h); ctx.fill();
                ctx.beginPath(); ctx.moveTo(bx + bw / 2, by - b.h - 50); ctx.lineTo(bx + bw / 2, by - b.h - 70); ctx.stroke();
            } else if (b.type === 'slope') {
                ctx.beginPath(); ctx.moveTo(bx, by - b.h); ctx.lineTo(bx + bw, by - b.h - 20); ctx.lineTo(bx + bw, by - b.h); ctx.fill();
            }
            if (atmos.skyType === 'night' || atmos.skyType === 'special') {
                ctx.fillStyle = (rand() > 0.5) ? "#FFD54F" : "#fff";
                for (let wy = by - b.h + 10; wy < by; wy += 15) {
                    for (let wx = bx + 5; wx < bx + bw - 5; wx += 8) {
                        if (rand() > 0.4) ctx.fillRect(wx, wy, 4, 8);
                    }
                }
                ctx.fillStyle = (atmos.skyType === 'night') ? "#0D47A1" : "#3F51B5";
            }
        });
        let statColor = (atmos.skyType === 'sunset') ? "#00695C" : (atmos.skyType === 'night') ? "#004D40" : "#4DB6AC";
        drawStatueOfLiberty(ctx, w * 0.15, groundY + 20, 2.5, statColor);

    } else if (theme === 'europe') {
        const groundY = viewH;
        ctx.fillStyle = (atmos.skyType === 'night') ? "#3E2723" : "#8D6E63";
        for (let x = 0; x < w; x += 30) {
            const bh = 60 + rand() * 40; ctx.fillRect(x, groundY - bh, 31, bh);
            ctx.beginPath(); ctx.moveTo(x, groundY - bh); ctx.lineTo(x + 15, groundY - bh - 15); ctx.lineTo(x + 31, groundY - bh); ctx.fill();
        }
        ctx.fillStyle = (atmos.skyType === 'night') ? "#263238" : "#5D4037";
        const houses = [{ x: 0.1, h: 100, roof: 'dome' }, { x: 0.35, h: 80, roof: 'flat' }, { x: 0.65, h: 90, roof: 'tri' }, { x: 0.85, h: 110, roof: 'mansard' }];
        houses.forEach(b => {
            const bx = w * b.x, bw = 60; ctx.fillRect(bx, groundY - b.h, bw, b.h);
            if (b.roof === 'dome') {
                ctx.beginPath(); ctx.arc(bx + bw / 2, groundY - b.h, bw / 2, Math.PI, 0); ctx.fill();
                ctx.fillRect(bx + bw / 2 - 2, groundY - b.h - bw / 2 - 10, 4, 10);
            } else if (b.roof === 'tri') {
                ctx.beginPath(); ctx.moveTo(bx, groundY - b.h); ctx.lineTo(bx + bw / 2, groundY - b.h - 30); ctx.lineTo(bx + bw, groundY - b.h); ctx.fill();
            } else if (b.roof === 'mansard') {
                ctx.beginPath(); ctx.moveTo(bx - 5, groundY - b.h); ctx.lineTo(bx + 5, groundY - b.h - 20); ctx.lineTo(bx + bw - 5, groundY - b.h - 20); ctx.lineTo(bx + bw + 5, groundY - b.h); ctx.fill();
            }
            ctx.fillStyle = (atmos.skyType === 'night' && rand() > 0.5) ? "#FFEB3B" : "#3E2723";
            if (atmos.skyType !== 'night') ctx.fillStyle = "#3E2723";
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.arc(bx + 15 + i * 15, groundY - b.h / 2, 5, Math.PI, 0); ctx.fillRect(bx + 10 + i * 15, groundY - b.h / 2, 10, 10); ctx.fill();
            }
            ctx.fillStyle = (atmos.skyType === 'night') ? "#263238" : "#5D4037";
        });
        let towerColor = (atmos.skyType === 'sunset') ? "#3E2723" : (atmos.skyType === 'night') ? "#212121" : "#455A64";
        drawEiffelTower(ctx, w * 0.5, groundY, 3.5, towerColor);
        if (level >= 8) {
            ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(w * 0.5, groundY - 350); ctx.lineTo(w * 0.5 + Math.sin(Date.now()/500)*40, 0); ctx.stroke();
        }

    } else if (theme === 'changnyeong') {
        drawHill(ctx, w, viewH * 0.6, 30, 0.005, (atmos.skyType === 'night') ? "#311B92" : "#9FA8DA");
        drawHill(ctx, w, viewH * 0.7, 40, 0.008, (atmos.skyType === 'night') ? "#4527A0" : "#7986CB");
        const fieldGrd = ctx.createLinearGradient(0, viewH * 0.7, 0, viewH);
        if (atmos.skyType === 'night') { fieldGrd.addColorStop(0, "#311B92"); fieldGrd.addColorStop(1, "#000000"); }
        else { fieldGrd.addColorStop(0, "#BA68C8"); fieldGrd.addColorStop(1, "#6A1B9A"); }
        ctx.fillStyle = fieldGrd;
        ctx.beginPath(); ctx.moveTo(0, viewH * 0.75); ctx.quadraticCurveTo(w / 2, viewH * 0.7, w, viewH); ctx.lineTo(0, viewH); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        for (let x = 0; x < w; x += 8) { ctx.beginPath(); ctx.moveTo(x, viewH * 0.75 + rand() * 50); ctx.lineTo(x, viewH); ctx.stroke(); }

    } else if (theme === 'busan') {
        const horizonY = viewH * 0.6;
        const seaGrd = ctx.createLinearGradient(0, horizonY, 0, viewH);
        if (level <= 3) { seaGrd.addColorStop(0, "#0288D1"); seaGrd.addColorStop(1, "#81D4FA"); }
        else if (level <= 6) { seaGrd.addColorStop(0, "#1A237E"); seaGrd.addColorStop(1, "#F06292"); }
        else { seaGrd.addColorStop(0, "#000000"); seaGrd.addColorStop(1, "#1A237E"); }
        ctx.fillStyle = seaGrd; ctx.fillRect(0, horizonY, w, viewH - horizonY);
        ctx.fillStyle = `rgba(255, 255, 255, ${atmos.skyType === 'night' ? 0.1 : 0.3})`;
        const now = performance.now();
        for (let i = 0; i < 3; i++) {
            const waveY = horizonY + 20 + i * 30;
            ctx.beginPath(); ctx.moveTo(0, waveY);
            for (let x = 0; x <= w; x += 20) ctx.lineTo(x, waveY + Math.sin(x * 0.02 + now * 0.002) * 10);
            ctx.lineTo(w, viewH); ctx.lineTo(0, viewH); ctx.fill();
        }

    } else if (theme === 'seoul') {
        const groundY = viewH;
        drawHill(ctx, w, viewH * 0.6, 40, 0.01, (atmos.skyType === 'night') ? "#102027" : "#37474F");
        ctx.fillStyle = (atmos.skyType === 'night') ? "#000" : "#263238"; const tx = w * 0.5;
        ctx.fillRect(tx - 3, viewH * 0.6, 6, 120); ctx.beginPath(); ctx.arc(tx, viewH * 0.65, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = (atmos.skyType === 'night') ? "#263238" : "#455A64";
        for (let x = 0; x < w; x += 30) {
            const bh = 50 + rand() * 80; ctx.fillRect(x, groundY - bh, 25, bh);
            if (level >= 7 && rand() > 0.5) { ctx.fillStyle = "#FFEB3B"; ctx.fillRect(x + 5, groundY - bh + 10, 5, 5); ctx.fillStyle = (atmos.skyType === 'night') ? "#263238" : "#455A64"; }
        }
    } else if (theme === 'mars') {
        const groundY = viewH * 0.8;
        drawHill(ctx, w, groundY, 40, 0.005, "#D84315");
        drawHill(ctx, w, groundY + 20, 30, 0.01, "#BF360C");
        ctx.fillStyle = "#3E2723"; ctx.fillRect(0, groundY + 40, w, viewH);
    }

    // 공통 구름 (시간에 따라 부드럽게 이동)
    if (theme !== 'mars' && level <= 6) {
        const cloudCount = 3 + Math.floor(rand() * 3);
        const drift = performance.now() * 0.01;
        for (let i = 0; i < cloudCount; i++) {
            const cx = (rand() * w * 2 + drift * (1 + rand())) % (w + 200) - 100;
            drawCloud(ctx, cx, rand() * viewH * 0.4, 0.5 + rand() * 0.5, 0.6);
        }
    }

    // 불꽃놀이 (동적 애니메이션 적용)
    if (level === 10) drawFireworks(ctx, w, viewH, 5, rand, performance.now());

    ctx.restore();

    // 분위기 필터
    if (atmos.filter) {
        ctx.save(); ctx.globalCompositeOperation = atmos.filter.mode;
        ctx.fillStyle = atmos.filter.color; ctx.fillRect(0, 0, w, viewH); ctx.restore();
    }
    // 비네팅 효과
    if (level >= 9) {
        const vignette = ctx.createRadialGradient(w / 2, viewH / 2, viewH * 0.4, w / 2, viewH / 2, viewH);
        vignette.addColorStop(0, "transparent"); vignette.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, viewH);
    }
    ctx.restore(); // Part A 완료 (클리핑 해제)


    // ==========================================
    // 🧱 PART B: 캐릭터가 서있는 실내 마룻바닥
    // ==========================================
    
    // 지역/인테리어에 따른 바닥 기본 색상
    let floorColor = "#5D4037"; // 기본 우드
    if(theme === 'mars') floorColor = "#3E2723";
    else if(level >= 8) floorColor = "#2c2c2c"; // 밤/고급 분위기는 어두운 대리석 톤
    else if(level >= 5) floorColor = "#6D4C41"; 

    ctx.fillStyle = floorColor; 
    ctx.fillRect(0, floorY, w, floorH);
    
    // 마룻바닥 나무 판자 줄무늬 (반투명한 검은색)
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; 
    ctx.lineWidth = 2;
    ctx.beginPath();
    const plankHeight = 25;
    for(let y = floorY + plankHeight; y < h; y += plankHeight){
        ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // 걸레받이/몰딩 (벽과 바닥 경계선)
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(w, floorY);
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; 
    ctx.lineWidth = 6;
    ctx.stroke();
}

function drawSpeechBubble(x, y, text, scale=1.0, isSelected=false){
  // 둥실둥실 애니메이션 (선택 손님은 더 활발)
  const now = performance.now();
  const floatDist = isSelected ? 4 : 2;
  const bobbing = Math.sin(now / 300 * (isSelected ? 1.5 : 1)) * floatDist;

  const finalY = y - 10 + bobbing;

  ctx.save();

  ctx.font = `bold ${Math.round(15 * scale)}px 'Jua', sans-serif`;
  const padX = 12 * scale;
  const padY = 8 * scale;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 16 * scale;

  const w = textWidth + padX * 2;
  const h = textHeight + padY * 2;

  const bx = x - w/2;
  const by = finalY - h;

  // 그림자
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  // 둥근 말풍선 + 꼬리 (roundRect 의존성 제거)
  const r = 10 * scale;
  const tailW = 8 * scale;
  const tailH = 8 * scale;

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + w - r, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
  ctx.lineTo(bx + w, by + h - r);
  ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);

  // 꼬리
  ctx.lineTo(bx + w/2 + tailW, by + h);
  ctx.lineTo(bx + w/2, by + h + tailH);
  ctx.lineTo(bx + w/2 - tailW, by + h);

  ctx.lineTo(bx + r, by + h);
  ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();

  if(isSelected){
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#FF9F1C";
    ctx.lineWidth = 2.5;
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
  }

  ctx.fill();

  // 테두리는 그림자 끄고
  ctx.shadowColor = "transparent";
  ctx.stroke();

  // 텍스트
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isSelected ? "#000" : "#333";
  ctx.fillText(text, bx + w/2, by + h/2 + 1);

  ctx.restore();
}

function drawCustomers(){
  const selId = state.selectedCustomerId;
  const list = Array.isArray(state.customers) ? state.customers : [];

  const drawOne = (c, isSelected) => {
    // leaving이면 반투명
    if(c.state === "leaving"){
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.font = "42px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.emoji || "🙂", c.x, c.y);
      ctx.restore();
      return;
    }

    // selected ring (under the avatar, but still visible)
    if(isSelected){
      const t = performance.now() / 1000;
      const pulse = 1 + 0.10 * Math.sin(t * 6.0);
      const r1 = 40 * pulse;
      const r2 = 32 * pulse;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 215, 0, 0.95)";
      ctx.lineWidth = 10;
      ctx.shadowColor = "rgba(255, 215, 0, 0.85)";
      ctx.shadowBlur = 18;
      ctx.arc(c.x, c.y-6, r1, 0, Math.PI*2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 90, 95, 0.9)";
      ctx.lineWidth = 6;
      ctx.arc(c.x, c.y-6, r2, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // avatar
    ctx.save();
    ctx.font = "42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.emoji || "🙂", c.x, c.y);
    ctx.restore();

    // speech bubble (selected should be drawn LAST in whole scene)
    const bubbleScale = isSelected ? 1.25 : 1.0; // selected bubble a bit bigger
    drawSpeechBubble(c.x, c.y-52, `(${c.menuName})`, bubbleScale, isSelected);

    // patience bar
    const w = 52, h = 7;
    const pct = clamp(c.patience/c.patienceMax, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(c.x - w/2, c.y + 14, w, h);
    ctx.fillStyle = (pct > 0.42) ? "#2EC4B6" : "#FF6B6B";
    ctx.fillRect(c.x - w/2, c.y + 14, w*pct, h);
  };

  // draw non-selected first
  for(const c of list){
    if(selId && c.id === selId) continue;
    drawOne(c, false);
  }
  // draw selected last (top layer)
  if(selId){
    const c = list.find(x=>x.id===selId);
    if(c) drawOne(c, true);
  }
}

function drawFloats(){
  if(!ctx) return;
  for(const f of floats){
    ctx.save();
    // Hard reset in case previous layers leaked state
    try{ ctx.setTransform(1,0,0,1,0,0); }catch(e){}
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = "bold 22px Jua";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.fillStyle = f.color || "#fff";
    const y = f.y + (1-f.life)*-18;
    try{
      ctx.strokeText(f.text, f.x, y);
      ctx.fillText(f.text, f.x, y);
    }catch(e){}
    ctx.restore();
  }
}

function render(){
  if(!ctx || !canvas) return;

  // Frame-level hard reset: stop state leaks from accumulating
  try{ ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }catch(e){}

  const h = canvas.height;
  const w = canvas.width;

  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH; // 벽지/바닥 경계선(Wall Bottom)

  const bossY = floorY;
  const staffY = Math.min(h - 24, floorY + floorH - 24);

  function safeLayer(fn, label){
    try{
      ctx.save();
      try{ ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }catch(_e){}
      fn();
    }catch(e){
      console.error(label, e);
    }finally{
      try{ ctx.restore(); }catch(_e){}
    }
  }

  // 👇 레이어 그리기 순서 변경 (간판을 손님보다 먼저 그리도록 위로 배치!)
  safeLayer(()=>drawBackground(), "[drawBackground]");
  
  // Signboard: 배경을 그린 직후, 손님보다 아래 레이어에 깔리도록 여기에 배치하네
  try{ ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha = 1; }catch(e){}
  safeLayer(()=>drawSignboard(), "[drawSignboard]");

  safeLayer(()=>drawBoss(bossY), "[drawBoss]");
  safeLayer(()=>drawStaff(staffY), "[drawStaff]");
  safeLayer(()=>drawDeliveryLayer(performance.now()), "[drawDeliveryLayer]");
  safeLayer(()=>drawCustomers(), "[drawCustomers]"); // 이제 손님이 간판 위를 걷게 됨!
  safeLayer(()=>drawFloats(), "[drawFloats]");
  safeLayer(()=>drawBossParticles(), "[drawBossParticles]");
  safeLayer(()=>drawBossFlash(), "[drawBossFlash]");
}





function drawDeliveryLayer(now){
  // 라이더가 없으면 도로/연출 생략
  if(!state.delivery || (state.delivery.riders||0) <= 0) return;

  const ctx = canvas.getContext("2d");

  // --- 단일 레인(도로) + 라이더는 도로 "위"로 달림 ---
  // 고객/직원/문과 겹침 방지: 카운터 위쪽 구간에 고정
  const roadY = canvas.height - 175;          // 도로 기준선(얇은 1줄)
  const riderYBase = roadY - 18;              // 라이더는 도로 위쪽으로
  const roadStartX = 0;
  const roadEndX = canvas.width - 140;        // 우측 '문' 영역 비우기

  ctx.save();

  // 도로 바닥(아주 얇게)
  ctx.strokeStyle = "rgba(0,0,0,0.20)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(roadStartX + 10, roadY);
  ctx.lineTo(roadEndX, roadY);
  ctx.stroke();

  // 중앙 점선 느낌(가벼운 재미)
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(roadStartX + 10, roadY);
  ctx.lineTo(roadEndX, roadY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 출발/도착 표식
  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("🏪", 10, roadY - 14);
  ctx.textAlign = "right";
  ctx.fillText("🏠", roadEndX, roadY - 14);

  // 라이더들 그리기 (이모지 크기: 기존의 절반 수준 유지)
  const fontSize = 22; // 절반
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for(const r of visualRiders){
    // 살짝 덜덜거림
    const jitter = Math.sin(now / 60 + (r.phase||0)) * 1.6;

    // 차량 등급별 이펙트(간단/가독성 우선)
    if(r.fx){
      ctx.save();
      ctx.globalAlpha = 0.70;
      ctx.font = `${Math.max(14, Math.floor(fontSize*0.75))}px sans-serif`;
      ctx.fillText(r.fx, r.x - 14, r.y + jitter + 2);
      ctx.restore();
    }

    ctx.fillText(r.emoji, r.x, r.y + jitter);
  }

  // 상태 HUD (작고 깔끔)
  const v = VEHICLES[clampInt(state.delivery.level||0,0,9)];
  ctx.save();
  ctx.font = "14px Jua";
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${v.emoji} ${v.name} | 라이더 ${state.delivery.riders||0}명`, 12, roadY - 44);
  ctx.restore();

  ctx.restore();
}

function getCanvasPoint(e){
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
  
  // [핵심] 화면 크기와 캔버스 내부 해상도의 비율 차이를 계산해서 터치 좌표 보정
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return { 
    x: (clientX - rect.left) * scaleX, 
    y: (clientY - rect.top) * scaleY 
  };
}

function onCanvasDown(e){
  if(document.querySelector(".panel.on") || document.querySelector(".dim.on")){
      return; 
  }

  e.preventDefault();
  // 사운드 잠금 해제 및 BGM 시작 (사용자 경험 보장)
  if(typeof unlockAudioOnce === "function") unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  
  const p = getCanvasPoint(e);

  // 1. 사장님 판정 (hitY 기준)
  const b = bossCenter();
  if(hitCircle(p.x, p.y, b.x, b.hitY || b.y, b.r)){
    triggerBossFX();
    try{ 
      if(typeof bossBurst === "function") bossBurst(b.x, b.y-30, 10 + Math.floor(Math.random()*14)); 
    } catch(e){}
    if(typeof sfxTick === "function") sfxTick();
    return; // 사장님 눌렸으면 여기서 종료
  }
  
  // 2. 알바생 판정 (반복문으로 모든 알바생 검사)
  const staffs = staffCenters();
  for(const s of staffs){
    if(hitCircle(p.x, p.y, s.x, s.hitY || s.y, s.r)){
      triggerStaffFX(s.key);
      // 알바생 터치 텍스트 효과 (💥 이모지 대신 텍스트로 변경 가능)
      floatText("👍", s.x, s.y - 60, "#FFD700");
      if(typeof sfxTick === "function") sfxTick();
      return; // 알바생 눌렸으면 여기서 종료
    }
  }
  
  // 3. 손님 판정 (캐릭터들이 안 눌렸을 때만 실행)
  const c = pickCustomerAt(p.x, p.y);
  if(c && c.state !== "leaving"){
    selectCustomer(c.id);
    const hintEl = document.getElementById("hint");
    if(hintEl) hintEl.style.display = "none";
    floatText("주문 확인!", c.x, c.y - 60, "#2EC4B6");
    if(typeof sfxTick === "function") sfxTick();
    if(typeof updateUI === "function") updateUI();
  }
}
/* --------------------
   UI update + panels
-------------------- */
function updateUI(){
  // Defensive UI update: missing DOM refs should NOT stop the game
  try{
    const setText = (el, v) => { if(el) el.textContent = (v ?? ""); };
    const setHTML = (el, v) => { if(el) el.innerHTML = (v ?? ""); };

    setText(elMoney, fmtCompact(state.money));
    setText(elRep, state.rep.toFixed(1));
    setText(elLvl, state.level);
    // XP bar (based on lifetime sales threshold)
    try{
      const total = getLifetimeSales();
      const lvl = Math.max(1, Number(state.level)||1);
      const arr = CONFIG.levelUpTotalSales || [];
      const curReq = arr[lvl-1] ?? 0;
      const nextReq = arr[lvl] ?? (curReq + Math.max(500000, curReq*0.6));
      const pct = nextReq>curReq ? Math.max(0, Math.min(1, (total-curReq)/(nextReq-curReq))) : 0;
      if(window.uiXpFill) window.uiXpFill.style.width = (pct*100).toFixed(1)+"%";
    }catch(e){}

    setText(elToday, fmtWon(state.todaySales));
    setText(elTotal, fmtWon(getLifetimeSales()));
    setText(elSelected, state.selectedCustomerId ? "있음" : "없음");

    // 이름 표시: 입력한 내용만 그대로, 빈값이면 공백
    const uname = (state.profile?.name || "").trim();
    setText(elUserName, uname ? `👤 ${uname}` : "");

    setText(uiVegCoupons, state.coupons?.veg ?? 0);
    setText(uiDrinkCoupons, state.coupons?.drink ?? 0);

    if(toggleSoundBtn) if(toggleSoundBtn) toggleSoundBtn.textContent = state.soundOn ? "ON" : "OFF";

    // 표시용 스탬프 UI 유지
    if(stampCountText) stampCountText.textContent = (state.stamps ?? 0);
    if(stampRow){
      setHTML(stampRow, "");
      const filled = (state.stamps ?? 0) % 3;
      for(let i=0;i<3;i++){
        const d = document.createElement("div");
        d.style.height = "44px";
        d.style.borderRadius = "14px";
        d.style.display = "flex";
        d.style.alignItems = "center";
        d.style.justifyContent = "center";
        d.style.border = "1px solid #eee";
        d.style.background = (i<filled) ? "rgba(255,107,107,.95)" : "#f3f3f3";
        d.style.color = (i<filled) ? "#fff" : "#aaa";
        d.style.fontSize = "1.15rem";
        d.textContent = (i<filled) ? "★" : (i+1);
        stampRow.appendChild(d);
      }
    }

    // daily / weekly stamp rows
    if(dailyStampRow){
      setHTML(dailyStampRow, "");
      for(let i=0;i<3;i++){
        const d = document.createElement("div");
        d.style.height = "44px";
        d.style.borderRadius = "14px";
        d.style.display = "flex";
        d.style.alignItems = "center";
        d.style.justifyContent = "center";
        d.style.border = "1px solid #eee";
        const filled2 = i < (state.missions?.dailyStamps ?? 0);
        d.style.background = filled2 ? "rgba(255,107,107,.95)" : "#f3f3f3";
        d.style.color = filled2 ? "#fff" : "#aaa";
        d.textContent = filled2 ? "🐔" : (i+1);
        dailyStampRow.appendChild(d);
      }
    }
    if(weeklyStampRow){
      setHTML(weeklyStampRow, "");
      for(let i=0;i<7;i++){
        const d = document.createElement("div");
        d.style.height = "44px";
        d.style.borderRadius = "14px";
        d.style.display = "flex";
        d.style.alignItems = "center";
        d.style.justifyContent = "center";
        d.style.border = "1px solid #eee";
        const filled2 = i < (state.missions?.weeklyStamps ?? 0);
        d.style.background = filled2 ? "rgba(255,159,28,.95)" : "#f3f3f3";
        d.style.color = filled2 ? "#fff" : "#aaa";
        d.textContent = filled2 ? "🐔" : (i+1);
        weeklyStampRow.appendChild(d);
      }
    }

    // cert status + buttons
    if(typeof certStatusText === "function"){
      const st = certStatusText();
      if(certStatus) certStatus.textContent = st.msg;
      if(makeCardBtn) makeCardBtn.disabled = !st.okIssue && !state.cert?.issuedThisWeek;
      if(useCertDrinkBtn) useCertDrinkBtn.disabled = !(state.cert?.issuedThisWeek && (state.coupons?.drink ?? 0) > 0 && !state.cert?.usedAt);
    }

    // coupons modal quick sync
    setText(uiDrinkCoupons2, state.coupons?.drink ?? 0);
    setText(uiVegCoupons2, state.coupons?.veg ?? 0);

  }catch(e){
    console.error("updateUI error", e);
  }
}

// ==========================================
// 🛠️ 패널 렌더링 통합 함수 (renderPanel)
// ==========================================
/// ==========================================
// 🛠️ 패널 렌더링 통합 관리 (renderPanel) - 완전체 버전
// ==========================================
function renderPanel(key){
  sanitizeState();
  const upgList = document.getElementById("upgList");
  const resList = document.getElementById("resList"); // 연구 리스트용 별도 ID 대응
  if(!upgList) return;

  // 패널을 새로 그릴 때 기존 내용을 깨끗이 비움
  upgList.innerHTML = "";

  // --- [1] 업그레이드 패널 (upg) ---
  if(key === "upg"){
    const groups = {};
    for(const u of UPGRADES) (groups[u.cat] ||= []).push(u);

    for(const cat of Object.keys(groups)){
      const h = document.createElement("div");
      h.style.margin = "8px 2px 10px";
      h.style.color = "#555";
      h.style.fontSize = "0.95rem";
      h.textContent = `— ${cat} —`;
      upgList.appendChild(h);

      for(const u of groups[cat]){
        const lvl = state.upgrades[u.id] || 0;
        const maxL = u.maxLevel ?? 99;
        const cost = u.costFn(lvl);
        const can = (lvl < maxL) && state.money >= cost;

        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <div class="info">
            <h4>${u.name} <span style="color:var(--primary);">Lv.${lvl}/${maxL}</span></h4>
            <p>${u.desc}</p>
            <div class="cost">${(lvl >= maxL) ? "최대 레벨" : fmtWon(cost)}</div>
          </div>
          <button class="btn" ${can || lvl >= maxL ? "" : "disabled"}>${lvl >= maxL ? "완료" : "구매"}</button>
        `;
        div.querySelector("button").onclick = () => {
          unlockAudioOnce(); 
          if(typeof startBGM === "function") startBGM();
          buyUpgrade(u.id);
        };
        upgList.appendChild(div);
      }
    }

    // 알바생 개별 관리 UI (업그레이드 탭 하단)
    const hireCount = clampInt(state.upgrades.hire || 0, 0, 5);
    if (hireCount > 0) {
      const staffHeader = document.createElement("div");
      staffHeader.className = "note";
      staffHeader.style.cssText = "margin: 20px 0 10px; font-size: 1.1rem; font-weight: bold; color: #333;";
      staffHeader.innerHTML = `👥 알바 관리 <span style="font-size:0.9rem; color:#666;">(${hireCount}명)</span>`;
      upgList.appendChild(staffHeader);

      ensureStaffStats();
      STAFF_POOL.slice(0, hireCount).forEach(s => {
        const st = state.staffStats[s.key] || { auto: 0, tip: 0, earned: 0 };
        const card = document.createElement("div");
        card.className = "card";
        card.style.flexDirection = "column";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;">
            <div style="font-weight:bold;">${s.emoji} ${s.label}</div>
            <div style="font-size:0.85rem; color:#666;">기여: ${fmtWon(st.earned)}</div>
          </div>
          <div style="display:flex; gap:8px; width:100%;">
            <button class="btn" id="btn-auto-${s.key}" style="flex:1; background:#fff; color:#333; border:1px solid #ddd;">👟속도 Lv.${st.auto}</button>
            <button class="btn" id="btn-tip-${s.key}" style="flex:1; background:#fff; color:#333; border:1px solid #ddd;">💖매력 Lv.${st.tip}</button>
          </div>
        `;
        upgList.appendChild(card);
        card.querySelector(`#btn-auto-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'auto');
        card.querySelector(`#btn-tip-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'tip');
      });
    }
  } 

  // --- [2] 연구 패널 (res) ---
  else if(key === "res"){
    // 연구 패널 전용 리스트 초기화 (resList가 있으면 거길 비우고, 없으면 upgList 사용)
    const targetList = resList || upgList;
    targetList.innerHTML = "";

    for(const r of RESEARCH){
      const lvl = (state.research.levels && state.research.levels[r.id]) ? state.research.levels[r.id] : 0;
      const maxL = r.maxLevel || 10;
      const done = lvl >= maxL;
      const runningSlot = state.research.running.find(s=>s.activeId===r.id);
      const running = !!runningSlot;

      const nextLvl = Math.min(maxL, lvl+1);
      const base = (r.baseMin ?? r.minutes ?? 10);
      const scale = (r.timeScale ?? 1.35);
      const nextMin = Math.round(base * Math.pow(scale, (nextLvl-1)));

      const EFFECT_LABEL = {
        earningMul:"전체 매출", leaveRepLossAdd:"평점 하락 방어", staffSpeedMul:"직원 속도",
        ordersMul:"주문 유입", patienceMul:"손님 인내심", onlineMul:"온라인 매출",
        deliveryMul:"배달 매출", wrongPatiencePenaltyMul:"오답 패널티 완화",
        baseAutoAdd:"기본 자동 운영", eventAutoResist:"이벤트 자동운영 방어", talkRepAdd:"친절 평점"
      };

      const effTxt = Object.keys(r.effectPerLevel||{}).map(k=>{
        const v = r.effectPerLevel[k];
        const label = EFFECT_LABEL[k] || "효과";
        const sign = v>=0?"+":"";
        return Math.abs(v) < 1 ? `${label} ${sign}${Math.round(v*100)}%` : `${label} ${sign}${v}`;
      }).slice(0,3).join(" · ");

      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="info">
          <h4>${r.name} <span style="color:#666;">Lv.${lvl}/${maxL}</span> ${done ? '<span style="color:#999;">(완료)</span>' : ''}</h4>
          <p>${r.desc}</p>
          <div class="cost">⏱ 다음 Lv.${nextLvl}: ${nextMin}분 ${effTxt?`<span style="color:#999;">(${effTxt})</span>`:""}</div>
        </div>
        <button class="btn alt">${done ? "완료됨" : (running ? "진행중" : "연구 시작")}</button>
      `;
      const btn = div.querySelector("button");
      btn.disabled = done || running;
      btn.onclick = ()=>{ unlockAudioOnce(); if(typeof startBGM === "function") startBGM(); startResearch(r.id); };
      targetList.appendChild(div);
    }

    const s = document.createElement("div");
    s.className = "note";
    s.style.marginTop = "8px";
    s.textContent = `현재 연구 슬롯: ${state.research.slots}개 (업그레이드 ‘연구대 확장’으로 2개까지)`;
    targetList.appendChild(s);
  }

  // --- [3] 미션 패널 (mis) ---
  else if(key === "mis"){
    misGuide.innerHTML = `
      <b>📌 스탬프 받는 방법</b><br>
      1) <b>일간 미션 3개</b>를 모두 완료하면 <b>주간 스탬프 +1</b> (하루 1회)<br>
      2) <b>주간 스탬프 7/7</b> + <b>주간 미션 올클</b> 시 인증서 발급 가능<br>
      <span style="color:#666;">※ 미션 진행은 접속 중(온라인 플레이)에서만 반영됩니다.</span>
    `;
    dailyList.innerHTML = "";
    for(const m of state.missions.dailyList) dailyList.appendChild(missionRow(m));

    weeklyList.innerHTML = "";
    for(const m of state.missions.weeklyList) weeklyList.appendChild(weeklyRow(m));

    const st = certStatusText();
    weeklyNote.innerHTML = `주간 올클 시 인증서 발급이 가능해요.<br><span style="color:#555;">현재: ${st.msg}</span>`;
  }

  // --- [4] 인증서 패널 (shr) ---
  else if(key === "shr"){
    const st = certStatusText();
    certStatus.textContent = st.msg;
    makeCardBtn.disabled = !st.okIssue && !state.cert.issuedThisWeek;
    useCertDrinkBtn.disabled = !(state.cert.issuedThisWeek && state.coupons.drink > 0 && !state.cert.usedAt);
  }
} // 👈 여기서 모든 로직이 안전하게 종료됨!


function missionValueLabel(m, v){
  // 돈 관련 미션은 한글 단위로 표시
  if(m.type==="earn" || m.type==="sales") return fmtWon(v);
  // 나머지는 숫자
  return String(v);
}
function missionProgressLine(m){
  const cur = Number(m.current ?? m.progress ?? 0);
  const target = Number(m.target ?? 0);
  return `진행: ${missionValueLabel(m, cur)} / ${missionValueLabel(m, target)}`;
}

function missionRow(m){
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="info">
      <h4>${m.title}</h4>
      <p>${missionProgressLine(m)}</p>
      <div class="cost">올클 보상: 무/양배추 쿠폰 1장 (하루 1번)</div>
    </div>
    <button class="btn" disabled>${m.done ? "완료" : "진행중"}</button>
  `;
  return wrap;
}

function weeklyRow(m){
  const wrap = document.createElement("div");
  wrap.className = "card";
  const cur = Math.min(m.current, m.target);
  wrap.innerHTML = `
    <div class="info">
      <h4>${m.title}</h4>
      <p>${missionProgressLine(m)}</p>
      <div class="cost">올클 시: 인증서 발급 가능</div>
    </div>
    <button class="btn" disabled>${m.done ? "완료" : "진행중"}</button>
  `;
  return wrap;
}

/* --------------------
   Tick/Loop
-------------------- */
let acc = 0;
let last = performance.now();
let rAF_ID = null; // prevent loop duplication
/* --------------------
   Boss FX / Pattern (Step 4-1)
   - Purely additive: never blocks gameplay
-------------------- */
let _bossAnim = {
  t0: (typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now(),
  msg: null,
  msgUntil: 0,
  shakeUntil: 0
};

// short speech bubble helper (non-fatal)
function bossSpeak(msg, durSec=1.6, shake=false){
  try{
    const now = (typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now();
    _bossAnim.msg = String(msg||"");
    _bossAnim.msgUntil = now + Math.max(0.6, durSec)*1000;
    _bossAnim.shakeUntil = shake ? (now + 420) : 0;
  }catch(e){}
}

function updateBoss(dt){
  // future-proof hook; keep lightweight
  if(!_bossAnim) return;
  // clear msg when expired
  try{
    const now = (typeof performance!=="undefined" && performance.now) ? performance.now() : Date.now();
    if(_bossAnim.msg && _bossAnim.msgUntil && now > _bossAnim.msgUntil){
      _bossAnim.msg = null;
      _bossAnim.msgUntil = 0;
    }
  }catch(e){}
}

function roundRect(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r||0, Math.min(w,h)/2));
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}


function startGameLoop(){
  if(rAF_ID) cancelAnimationFrame(rAF_ID);
  acc = 0;
  last = performance.now();
  try{ checkEndingCondition(); }catch(e){}
  rAF_ID = requestAnimationFrame(frame);
}
/* --------------------
   Global crash guard (no user-facing stack traces)
-------------------- */
/* --------------------
   Global crash guard (no user-facing stack traces)
-------------------- */
let _crashToastAt = 0;
let _errorCount = 0; // 연속 에러 카운터 추가

window.addEventListener('error', ()=>{
  try{
    const now = Date.now();
    // 2초 내에 에러가 3번 이상 발생하면 재시작 포기 (무한 루프 방지)
    if(now - _crashToastAt < 2000){
      _errorCount++;
      if(_errorCount > 3) return; 
    } else {
      _errorCount = 1;
      _crashToastAt = now;
      if(typeof showToast === "function") showToast("⚠️ 오류 복구중…");
    }
    
    if(typeof startGameLoop === "function") startGameLoop();
  }catch(_e){}
});

window.addEventListener('unhandledrejection', ()=>{
  try{
    const now = Date.now();
    if(now - _crashToastAt < 2000){
      _errorCount++;
      if(_errorCount > 3) return;
    } else {
      _errorCount = 1;
      _crashToastAt = now;
      if(typeof showToast === "function") showToast("⚠️ 오류 복구중…");
    }
    
    if(typeof startGameLoop === "function") startGameLoop();
  }catch(_e){}
});


function tick(dt){
  // failsafe: prevent NaN accumulators
  if(!isFinite(state._spawnAcc)) state._spawnAcc = 0;
  if(!isFinite(state._autoServeAcc)) state._autoServeAcc = 0;
  if(!isFinite(state._saveAcc)) state._saveAcc = 0;
  if(!isFinite(state._eventCheckAcc)) state._eventCheckAcc = 0;
  // money failsafe
  if(typeof state.money !== 'number' || !isFinite(state.money) || isNaN(state.money)) state.money = 0;
  if(typeof state.todaySales !== 'number' || !isFinite(state.todaySales) || isNaN(state.todaySales)) state.todaySales = 0;
  if(typeof state.totalSales !== 'number' || !isFinite(state.totalSales) || isNaN(state.totalSales)) state.totalSales = 0;
  // online playtime accumulation
  if(state.play && typeof state.play.onlineSecTotal === 'number') state.play.onlineSecTotal += dt;
  ensureMissionReset();
  processPayroll();
  ensureResearchSlots();
  ensureStaffStats();

  state._eventCheckAcc += dt;
  if(state._eventCheckAcc >= CONFIG.eventCheckIntervalSec){
    state._eventCheckAcc = 0;
    maybeTriggerEvent();
  }
  updateEvent();

  try{ spawnLoop(dt); }catch(e){ console.error('spawn error', e); }
  updateOnlineAuto(dt);
  try{ updateDelivery(dt, Date.now()); }catch(e){ console.error("delivery error", e); /* 방치형 루프 중단 방지 */ }
  try{ moveCustomers(dt); }catch(e){ console.error('move error', e); }

  try{ updateCustomers(dt); }catch(e){ console.error('customers error', e); }
  try{ autoServe(dt); }catch(e){ console.error('autoserve error', e); }

  try{ updateMissionsOnlineOnly(); }catch(e){ console.error('missions error', e); }
  try{ updateResearch(); }catch(e){ console.error('research error', e); }

  state._saveAcc += dt;
  if(state._saveAcc >= CONFIG.autosaveSec){
    state._saveAcc = 0;
    if(_saveDirty) save(true);
  }

  updateUI();
}

function frame(now){
  const dt = Math.min(CONFIG.maxFrameDt, (now-last)/1000);
  last = now;
  acc += dt;

  while(acc >= CONFIG.fixedStep){
    try{
      tick(CONFIG.fixedStep);
      updateFloats(CONFIG.fixedStep);
      updateBossParticles(CONFIG.fixedStep);
    }catch(e){
      console.error('tick error', e);
      if(!window.__lastTickErrAt || Date.now()-window.__lastTickErrAt>1500){
        window.__lastTickErrAt = Date.now();
        try{ showToast('⚠️ 오류로 루프가 잠시 복구되었습니다. (콘솔 확인)'); }catch(_){ }
      }
    }
    acc -= CONFIG.fixedStep;
  }
  try{ render(); }catch(e){ console.error('render error', e); }
  state._lastFrameAt = Date.now();
  rAF_ID = requestAnimationFrame(frame);
}
  // boss fx tick (never throws)
  try{ updateBoss(dt); }catch(e){}



/* ==========================================================
   ENDING (손주) 시스템
   - 조건: money >= 9.99e70 (999 무량대수 근사)
   - 팝업: "나이스 치킨 게임의 엔딩 조건에 도달하였습니다. 엔딩을 보시겠습니까?"
   - 엔딩 사운드: END_SOUND.* 루핑, 엔딩 종료 시 페이드아웃
   - 엔딩 완료 보상: 로봇 손주(🤖) + 매출 50% + 손님 유입 50%
========================================================== */
const ENDING_MONEY = 9.99e70; // 999 무량대수(근사)
const ENDING_SOUND_FILES = ["END_SOUND.mp3","END_SOUND.ogg","END_SOUND.wav"];

let __endingAudio = null;
let __endingTypingTimer = null;
let __endingStep = 0;

function ensureEndingAudio(){
  if(__endingAudio) return __endingAudio;
  const a = new Audio();
  a.preload = "auto";
  a.loop = true;
  a.volume = 0;
  for(const f of ENDING_SOUND_FILES){
    const s = document.createElement("source");
    s.src = f;
    a.appendChild(s);
  }
  __endingAudio = a;
  return a;
}

function fadeAudioTo(targetVol, ms){
  const a = ensureEndingAudio();
  const startVol = a.volume;
  const t0 = performance.now();
  return new Promise((resolve) => {
    function tick(t){
      const k = Math.min(1, (t - t0) / ms);
      a.volume = startVol + (targetVol - startVol) * k;
      if(k >= 1) return resolve();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function playEndingLoop(){
  const a = ensureEndingAudio();
  try{
    await a.play(); // requires user gesture
    await fadeAudioTo(0.85, 900);
  }catch(e){
    // If autoplay blocked, silently continue without audio
  }
}

async function stopEndingLoopFade(){
  const a = ensureEndingAudio();
  try{
    await fadeAudioTo(0, 900);
    a.pause();
    a.currentTime = 0;
  }catch(e){}
}

const endingStoryData = [
  { img: 1, speaker: "할머니", text: "할미가 힘들어도 괜찮다.\n우리 손주 웃는 것만 보면 피로가 싹 가시니까." },
  { img: 1, speaker: "나레이션", text: "주방의 열기 속에서\n너는 그렇게 무럭무럭 자랐단다." },
  { img: 2, speaker: "할머니", text: "아이구 우리 귀한 손주…\n할미가 돈 많이 벌어서 맛난 거 다 사줄게." },
  { img: 2, speaker: "나레이션", text: "그 한 조각에\n사랑은 늘, 가득 담겨 있었다." },
  { img: 3, speaker: "할머니", text: "어마나… 세월 참 빠르기도 하지.\n우리 손주가 벌써 이렇게 컸구나." },
  { img: 3, speaker: "손주", text: "할머니, 그동안 정말 고생 많으셨어요.\n이제는 제가 할머니를 제일 행복하게 해드릴게요." },
  { img: 4, speaker: "손주", text: "할머니를 호강시켜 드리려고\n더 넓은 세상 밖으로 나가 보려 해요." },
  { img: 4, speaker: "할머니", text: "그래… 우리 손주 가는 길인데 할미가 응원해야지.\n조심히 다녀오렴." },
  { img: 4, speaker: "손주", text: "금방 돌아올게요. 사랑해요!" },
  { img: 4, speaker: "할머니", text: "그려, 할미는 언제나 우리 손주를 기다리마." },
  { img: 5, speaker: "나레이션", text: "당신의 헌신과 사랑으로\n손주는 세상에서 가장 밝게 빛나는 별이 되었습니다." },
  { img: 5, speaker: "나레이션", text: "하지만 그 별이\n길을 잃지 않았던 건\n언제나 불빛을 켜둔 사람 때문이었습니다." },
  { img: 5, speaker: "나레이션", text: "할머니와 손주의 이야기는 계속됩니다." }
];

function endingEls(){
  return {
    popup: document.getElementById("endingConditionPopup"),
    yes: document.getElementById("endingYesBtn"),
    no: document.getElementById("endingNoBtn"),
    replay: document.getElementById("replayEndingBtn"),
    overlay: document.getElementById("endingOverlay"),
    miss: document.getElementById("endingMissingOverlay"),
    box: document.getElementById("endingDialogBox"),
    tag: document.getElementById("endingNameTag"),
    text: document.getElementById("endingDialogText"),
    wrap: document.getElementById("endingDialogWrapper"),
  };
}

function openEndingPopup(){
  const el = endingEls();
  if(!el.popup) return;
  el.popup.style.display = "flex";
  el.popup.setAttribute("aria-hidden","false");
}

function closeEndingPopup(){
  const el = endingEls();
  if(!el.popup) return;
  el.popup.style.display = "none";
  el.popup.setAttribute("aria-hidden","true");
}

function setEndingSpeakerStyle(speaker){
  const el = endingEls();
  el.box.className = "dialogue-box";
  el.tag.className = "name-tag";
  if(speaker === "할머니"){
    el.tag.classList.add("grandma"); el.box.classList.add("grandma");
  }else if(speaker === "손주"){
    el.tag.classList.add("grandson"); el.box.classList.add("grandson");
  }else{
    el.tag.classList.add("system"); el.box.classList.add("system");
  }
  el.tag.textContent = speaker;
}

function clearEndingTyping(){
  if(__endingTypingTimer){
    clearInterval(__endingTypingTimer);
    __endingTypingTimer = null;
  }
}

function animateEndingText(text){
  const el = endingEls();
  clearEndingTyping();
  el.text.innerHTML = "";
  const lines = text.split("\n");
  const chars = [];
  for(let li=0; li<lines.length; li++){
    if(li>0) chars.push({br:true});
    for(let i=0;i<lines[li].length;i++) chars.push({t:lines[li][i]});
  }
  let idx=0;
  __endingTypingTimer = setInterval(()=>{
    if(idx>=chars.length){ clearEndingTyping(); return; }
    const c=chars[idx++];
    if(c.br){ el.text.appendChild(document.createTextNode("\n")); return; }
    const span=document.createElement("span");
    span.textContent=c.t;
    span.className="char-fade";
    el.text.appendChild(span);
  }, 38);
}

function updateEndingImage(step){
  const el = endingEls();
  for(let i=1;i<=5;i++){
    const img=document.getElementById("imgCut"+i);
    if(!img) continue;
    img.classList.toggle("current", i===step.img);
  }
  const cur=document.getElementById("imgCut"+step.img);
  const ok = cur && cur.complete && cur.naturalWidth>0;
  if(el.miss){
    el.miss.style.display = ok ? "none" : "flex";
  }
}

function renderEndingStep(){
  const step = endingStoryData[__endingStep];
  if(!step){ finishEndingSequence(); return; }
  setEndingSpeakerStyle(step.speaker);
  updateEndingImage(step);
  animateEndingText(step.text);
}

function nextEndingStep(){
  const el = endingEls();
  if(__endingTypingTimer){
    clearEndingTyping();
    const step = endingStoryData[__endingStep];
    el.text.textContent = step.text;
    return;
  }
  __endingStep++;
  renderEndingStep();
}

async function startEndingSequence(){
  // ensure unlocked & replay visible
  state.endingUnlocked = true;
  state.endingPrompted = true;
  saveGame();

  const el = endingEls();
  closeEndingPopup();
  if(el.replay) el.replay.style.display = "block";

  // show overlay
  el.overlay.style.display = "flex";
  el.overlay.setAttribute("aria-hidden","false");
  // force reflow then fade in
  void el.overlay.offsetHeight;
  el.overlay.classList.add("active");

  __endingStep = 0;
  renderEndingStep();

  await playEndingLoop();
}

async function finishEndingSequence(){
  const el = endingEls();
  clearEndingTyping();

  // mark seen + apply rewards (once)
  if(!state.endingSeen){
    state.endingSeen = true;
    state.robotGrandson = true;
    applyRobotGrandson();
    saveGame();
  }

  await Promise.all([
    stopEndingLoopFade(),
    new Promise((resolve)=>{
      el.overlay.classList.remove("active");
      setTimeout(resolve, 950);
    })
  ]);

  el.overlay.style.display = "none";
  el.overlay.setAttribute("aria-hidden","true");
  try{ showToast("엔딩이 완료되었습니다. 게임이 계속 진행됩니다."); }catch(_){}
}

function applyRobotGrandson(){
  if(!state.robotGrandson) return;
  const gs = STAFF_POOL && STAFF_POOL.find ? STAFF_POOL.find(s=>s.key==="grandson") : null;
  if(gs){
    gs.label = "로봇손주";
    gs.emoji = "🤖";
    gs.lines = ["할머니, 제가 도울게요 🤖", "매출은 제가 책임질게요!", "손님 더 불러올게요!", "시스템 최적화 완료!", "오늘도 영업 가즈아!"];
  }
}

// condition check: called each frame
function checkEndingCondition(){
  if(state.endingUnlocked || state.endingPrompted) return;
  const m = Number(state.money);
  if(isFinite(m) && m >= ENDING_MONEY){
    state.endingUnlocked = true;
    state.endingPrompted = true;
    saveGame();
    openEndingPopup();
    const el = endingEls();
    if(el.replay) el.replay.style.display = "block";
  }
}

// hook buffs into effects
(function patchEndingBuffs(){
  const _sumEffects = sumEffects;
  sumEffects = function(){
    const eff = _sumEffects();
    if(state && state.robotGrandson){
      // 매출 +50%, 손님 유입 +50%
      eff.earningMul = (eff.earningMul||0) + 0.5;
      eff.ordersMul = (eff.ordersMul||0) + 0.5;
    }
    return eff;
  }
})();

// bind buttons after DOM ready
function bindEndingUI(){
  const el = endingEls();
  if(!el.popup || !el.overlay) return;

  // preview button for testing
  const preview = document.getElementById("endingPreviewBtn");
  if(preview){
    try{
      const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";
      preview.style.display = debugMode ? "block" : "none";
    }catch(_e){
      preview.style.display = "none";
    }
    preview.addEventListener("click", () => {
      state.endingUnlocked = true;
      state.endingPrompted = true;
      saveGame();
      openEndingPopup();
      if(el.replay) el.replay.style.display = "block";
    });
  }

  el.yes && el.yes.addEventListener("click", startEndingSequence);
  el.no && el.no.addEventListener("click", ()=>{
    closeEndingPopup();
    state.endingUnlocked = true;
    state.endingPrompted = true;
    saveGame();
    if(el.replay) el.replay.style.display = "block";
    try{ showToast("우측 상단 🎬 버튼에서 언제든 엔딩을 볼 수 있어요."); }catch(_){}
  });
  el.replay && el.replay.addEventListener("click", startEndingSequence);
  el.wrap && el.wrap.addEventListener("click", nextEndingStep);

  // click outside popup closes (optional)
  el.popup.addEventListener("click", (e)=>{ if(e.target===el.popup) closeEndingPopup(); });

  // image errors show missing overlay
  for(let i=1;i<=5;i++){
    const img=document.getElementById("imgCut"+i);
    if(!img) continue;
    img.addEventListener("error", ()=>{ if(el.miss) el.miss.style.display="flex"; });
    img.addEventListener("load", ()=>{ if(el.miss) el.miss.style.display="none"; });
  }
}


/* --------------------
   Init
-------------------- */
function initAfterLoad(fromReset=false){
  sanitizeState();
  try{ BranchManager.bootstrap(); }catch(e){}
  resizeCanvas();
  buildMenuGrid();
  ensureMissionReset();
  ensureResearchSlots();
  ensureStaffStats();
  updateUI();
  closePanels();

  // sound state
  setSoundEnabled(state.soundOn);
  if(toggleSoundBtn) toggleSoundBtn.textContent = state.soundOn ? "ON" : "OFF";

  // first run name prompt: profile.name가 undefined였던 데이터는 modal 띄움
  if(!state.profile || typeof state.profile.name !== "string"){
    state.profile = { name: "" };
  }
  // "최초 실행 후 접속하면" 요구: name이 한번도 세팅된 적이 없을 때만 띄우는 대신,
  // 현재는 "저장된 데이터가 없거나 reset 직후"에만 띄우도록 처리
  if(!localStorage.getItem(SAVE_KEY) || fromReset){
    modalProfile.classList.add("on");
    nameInput.value = state.profile.name || "";
  }

  applyOfflineProgress();

  startGameLoop();

  // kickstart: 첫 손님이 너무 늦게 뜨는 현상 방지
  setTimeout(()=>{
    try{
      if(state && Array.isArray(state.customers) && state.customers.length===0){
        spawnCustomer();
      }
    }catch(e){}
  }, 700);

}

function init(){
  load();
  initAfterLoad(false);
}

// Boot after DOM is ready (prevents null refs)
document.addEventListener("DOMContentLoaded", () => {
  try{
    initDOMRefs();
    preloadSignImages();
    init();
  }catch(e){
    console.error("boot error", e);
  }finally{
    // Absolute failsafe: even if UI init crashed, keep the game loop alive.
    try{ startGameLoop(); }catch(_e){}
  }
});

// Force-save on exit
window.addEventListener("beforeunload", () => { try{ save(true); }catch(e){} });

/* --------------------
   Loop watchdog (failsafe)
-------------------- */
setInterval(()=>{
  // if rAF stalled > 2s, restart
  const lastAt = state._lastFrameAt || 0;
  if(lastAt && Date.now()-lastAt > 2200){
    console.warn('rAF stalled, restarting...');
    try{
      startGameLoop();
      state._lastFrameAt = Date.now();
      
    }catch(e){}
  }
}, 1200);


/* --------------------
   Close settings
-------------------- */
// Splash (fast greeting)

/* --------------------
   Error overlay (mobile debug)
-------------------- */
window.addEventListener('error', (e)=>{ try{ console.error('runtime error', e); }catch(_){ } });
window.addEventListener('unhandledrejection', (e)=>{ try{ console.error('promise rejection', e); }catch(_){ } });

/* --- [NEW] Map UI (Angry Birds unlock feel) --- */
function renderMapUI(){
  const wrap = document.getElementById("mapWrap");
  const hint = document.getElementById("mapHint");
  const btnGo = document.getElementById("mapGo");
  const btnUn = document.getElementById("mapUnlock");
  if(!wrap) return;

  state.regionUnlocked = state.regionUnlocked || { changnyeong:true };
  if(!state.regionUnlocked.changnyeong) state.regionUnlocked.changnyeong = true;
  if(!state.regionId) state.regionId = "changnyeong";
  if(!state.mapSelected) state.mapSelected = state.regionId;

  wrap.innerHTML = "";
  const curId = state.regionId;
  const selId = state.mapSelected;

  REGIONS.forEach((r, idx)=>{
    const unlocked = !!state.regionUnlocked[r.id];
    const node = document.createElement("div");
    node.className = "map-node" + (unlocked ? "" : " locked") + (r.id===selId ? " active":"");
    node.dataset.action = "select-region";
    node.dataset.regionId = r.id;

    const left = document.createElement("div");
    left.className="map-left";
    left.innerHTML = `
      <div class="map-badge">${r.icon}</div>
      <div>
        <div class="map-title">${idx+1}. ${r.name}</div>
        <div class="map-sub">${unlocked ? (r.id===curId ? "현재 영업중" : "이동 가능") : "잠금"}</div>
      </div>
    `;

    const right = document.createElement("div");
    right.className="map-cost";
    if(unlocked){
      right.textContent = `x${r.priceMul.toFixed(1)}`;
    }else{
      right.textContent = `해금 ${fmtCompact(r.unlockCost||0)}`;
    }

    node.appendChild(left);
    node.appendChild(right);
    wrap.appendChild(node);
  });

  // Buttons state
  const curIdx = getRegionIndex(curId);
  const next = getNextRegion();
  const nextLocked = !state.regionUnlocked[next.id];

  if(btnGo){
    btnGo.disabled = !state.regionUnlocked[selId];
    btnGo.style.opacity = btnGo.disabled ? 0.6 : 1;
  }
  if(btnUn){
    btnUn.disabled = !nextLocked || (curId===next.id);
    btnUn.style.opacity = btnUn.disabled ? 0.6 : 1;
  }

  if(hint){
    if(curId===REGIONS[REGIONS.length-1].id){
      hint.textContent = "최종 지역에 도달했습니다. 🚀";
    }else{
      hint.textContent = `다음 해금: ${next.name} (비용 ${fmtCompact(next.unlockCost||0)})`;
    }
  }
}
