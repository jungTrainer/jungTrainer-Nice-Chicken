/* IMP-08: compatible state schema; active branch fields are a view. */
const defaultState = () => ({
  version: CONFIG.version,
  moneyEncoding: MONEY_ENCODING,

  profile: { name: "" },
  endingUnlocked: false,
  endingPrompted: false,
  endingSeen: false,
  robotGrandson: false,

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

  todaySales: 0, // 온라인 매출만
  totalSales: 0, // 온라인 매출만

  offlineSalesToday: 0,
  offlineSalesTotal: 0,
  offlineReward: { amount: 0, seconds: 0 },
  unattributedSales: 0,
  serviceTimers: {
    onlineOrders: 0,
    deliveryMs: 0,
    deliveryIntervalMs: null,
    deliverySignature: "",
  },
  _staffRot: 0,
  buffEndTime: 0,

  // [NEW] 메뉴별 연구/통계
  management: defaultManagement(),
  menuLevels: {}, // { fried: 0, ... }
  menuStats: {}, // { fried: {count:0, earned:0}, ... }

  // [NEW] 매출 기여도
  contrib: { player: 0, staff: 0, system: 0 },
  stamps: 0,

  payroll: {
    lastDayKey: "",
    dailyWage: 80000,
  },

  coupons: { drink: 0, veg: 0 }, // 음료/무양배추
  benefitsLog: [],
  serviceVisit: null, // HQ local visit context, independent of game challenge

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
    dailyStamps: 0, // 0~3

    weekStartAt: 0,
    weekEndAt: 0,
    weeklyList: [],
    weeklyStamps: 0, // 0~7

    weeklyCompletedAt: 0, // 주간 올클 시각
    _weekStartTotalSales: 0,
  },

  event: null,
  lastSeenAt: Date.now(),

  _spawnAcc: 0,
  _autoServeAcc: 0,
  _saveAcc: 0,
  _eventCheckAcc: 0,
});
let state = defaultState();
