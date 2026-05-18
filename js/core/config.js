// Step 3-4: extracted static config/data declarations from js/main.js.
// Classic script globals; no ES module export/import.

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

const REGIONS = [
  { id:"changnyeong", name:"창녕 본점",  desc:"시골 감성, 모든 것의 시작.",        icon:"🏡", unlockCost:0,                    priceMul:1.0,         costMul:1.0,      theme:"rural"  },
  { id:"busan",       name:"부산 해운대", desc:"바다 냄새와 관광객, 높은 진입장벽.", icon:"🌊", unlockCost:50_000_000_000,        priceMul:50.0,        costMul:5.0,      theme:"beach"  },
  { id:"seoul",       name:"서울 강남",  desc:"야경과 빌딩숲, 돈도 욕망도 폭발.",    icon:"🏙️", unlockCost:20_000_000_000_000,   priceMul:2_000.0,     costMul:50.0,     theme:"city"   },
  { id:"japan",       name:"일본 도쿄",  desc:"벚꽃 아래 초고속 성장.",              icon:"🌸", unlockCost:10_000_000_000_000_000, priceMul:50_000.0,   costMul:500.0,    theme:"sakura" },
  { id:"usa",         name:"미국 뉴욕",  desc:"자본의 심장, 수익도 물가도 미쳤다.",  icon:"🗽", unlockCost:500_000_000_000_000_000, priceMul:2_000_000.0, costMul:5_000.0, theme:"usa"    },
  { id:"mars",        name:"화성 기지",  desc:"인류 최후의 프랜차이즈.",             icon:"🪐", unlockCost:20_000_000_000_000_000_000, priceMul:100_000_000.0, costMul:100_000.0, theme:"mars" }
];

const REGION_MAP = Object.fromEntries(REGIONS.map(r=>[r.id,r]));

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

const STAFF_POOL = [
  { key:"neighbor",  label:"남편", emoji:"👴", grade:"C", baseSpeed:1.0, baseCap:1.0, lines: ["여보~ 치맥 한잔? 🍺", "오늘 기분 째진다! 🎤", "인생 뭐 있어~ 캬!", "안주 죽이네~ 🍗", "노래방 고고? 🎶"] },
  { key:"ato",       label:"아토", emoji:"🐶", grade:"C", baseSpeed:1.2, baseCap:1.0, lines: ["멍멍! 🦴", "왈왈!! 🐾", "크르릉... 🐕", "헥헥! 👅", "낑낑... 💕"] },
  { key:"daughter1", label:"첫째딸", emoji:"👧", grade:"B", baseSpeed:1.1, baseCap:1.1, lines: ["아빠 용돈 좀~ 💸", "나 이거 사줘! 🎁", "아 몰라 귀찮아~ 📱", "배고파 밥 줘! 🍔", "내 옷 어때? 👗"] },
  { key:"daughter2", label:"둘째딸", emoji:"👩", grade:"B", baseSpeed:1.1, baseCap:1.1, lines: ["여보 사랑해~ 💖", "우리 아가 이쁘네 👶", "행복한 우리집 🏡", "고생했어 여보! ✨", "사랑해요~ 💕"] },
  { key:"soninlaw",  label:"둘째사위", emoji:"👦", grade:"A", baseSpeed:1.25, baseCap:1.2, lines: ["장인어른 최고! 👍", "여보 사랑해! 😍", "우리 아들 천재? 🎓", "가족을 위하여! 🍻", "힘이 납니다! 💪"] },
  { key:"grandson",  label:"손자", emoji:"👶", grade:"S", baseSpeed:1.5, baseCap:1.35, lines: ["멍멍! 🐶", "꽥꽥! 🦆", "음메~ 🐄", "딸기! 🍓", "블루베리! 🫐"] }
];

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

const SIGN_STAGES_MAX = 6;

const SIGN_IMAGE_CANDIDATES = Array.from({length:SIGN_STAGES_MAX}, (_,i)=> ([
  `assets/sign_${i}.png`,
  `assets/sign_${i}.jpg`,
  `sign_${i}.png`,
  `sign_${i}.jpg`,
]));

const SIGN_IMAGES = Array.from({length:SIGN_STAGES_MAX}, ()=>({ img:null, ok:false, tried:false, idx:0 }));

