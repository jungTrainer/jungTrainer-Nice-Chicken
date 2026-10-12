/* IMP-08: branch snapshots and explicit service-runtime ownership. */
function getRegion() {
  const id = state?.regionId || REGIONS[0].id;
  return REGION_MAP[id] || REGIONS[0];
}
function getRegionIndex(id) {
  return REGIONS.findIndex((r) => r.id === id);
}
function getNextRegion() {
  const idx = getRegionIndex(state?.regionId || REGIONS[0].id);
  return REGIONS[Math.min(REGIONS.length - 1, idx + 1)];
}
function _branchDefaultData() {
  const d = defaultState();
  // pick "store-local" fields only
  return {
    rep: d.rep,
    level: d.level,
    todaySales: d.todaySales,
    totalSales: d.totalSales,
    offlineSalesToday: d.offlineSalesToday,
    offlineSalesTotal: d.offlineSalesTotal,
    offlineReward: d.offlineReward,
    unattributedSales: 0,

    menuLevels: structuredClone(d.menuLevels),
    menuStats: structuredClone(d.menuStats),
    contrib: structuredClone(d.contrib),
    stamps: d.stamps,

    payroll: structuredClone(d.payroll),

    upgrades: structuredClone(d.upgrades),
    delivery: structuredClone(d.delivery),
    online: structuredClone(d.online),
    research: structuredClone(d.research),
    missions: structuredClone(d.missions),

    // runtime-ish, but keep per-branch for UX
    customers: [],
    selectedCustomerId: null,

    event: null,
    _spawnAcc: 0,
    _autoServeAcc: 0,
    _eventCheckAcc: 0,
    _staffRot: 0,
    serviceTimers: structuredClone(d.serviceTimers),
    buffEndTime: 0,
  };
}
function _branchKeys() {
  return [
    "rep",
    "level",
    "todaySales",
    "totalSales",
    "offlineSalesToday",
    "offlineSalesTotal",
    "offlineReward",
    "unattributedSales",
    "menuLevels",
    "menuStats",
    "contrib",
    "stamps",
    "payroll",
    "upgrades",
    "delivery",
    "online",
    "research",
    "missions",
    "customers",
    "selectedCustomerId",
    "event",
    "_spawnAcc",
    "_autoServeAcc",
    "_eventCheckAcc",
    "_staffRot",
    "serviceTimers",
    "buffEndTime",
  ];
}
const BranchManager = {
  bootstrap() {
    this.saveCurrent();
    // ensure base unlocked
    state.regionUnlocked = state.regionUnlocked || {};
    state.regionUnlocked[REGIONS[0].id] = true;

    // ensure current branch snapshot exists, then load it
    if (!state.branches) state.branches = {};
    const cur = state.regionId || REGIONS[0].id;
    if (!state.branches[cur]) {
      state.branches[cur] = { unlocked: true, data: _branchDefaultData() };
      // migrate current top-level store fields into the snapshot once
      this.saveCurrentTo(cur);
    }
    // load snapshot into top-level (so fields are never undefined)
    this.loadFrom(cur, { resetRuntime: false });
  },

  ensure(id) {
    if (!state.branches) state.branches = {};
    if (!state.branches[id]) {
      state.branches[id] = { unlocked: true, data: _branchDefaultData() };
    }
    return state.branches[id];
  },

  saveCurrent() {
    const cur = state.regionId || REGIONS[0].id;
    this.saveCurrentTo(cur);
  },

  saveCurrentTo(id) {
    captureBranchServiceTimers();
    const b = this.ensure(id);
    b.unlocked = true;
    const keys = _branchKeys();
    b.data = b.data || _branchDefaultData();
    const local = Object.fromEntries(keys.map((k) => [k, state[k]]));
    Object.assign(b.data, structuredClone(local));
    state.branches[id] = b;
  },

  loadFrom(id, { resetRuntime = true } = {}) {
    const b = this.ensure(id);
    const keys = _branchKeys();
    b.data = { ..._branchDefaultData(), ...(b.data || {}) };
    const local = structuredClone(b.data);
    for (const k of keys) state[k] = local[k];

    if (resetRuntime) {
      // do NOT carry over visual selections/float texts etc
      state.customers = [];
      state.selectedCustomerId = null;
      try {
        floats = [];
      } catch (e) {}
      try {
        selectedId = null;
      } catch (e) {}
    }
    state.offlineReward = normalizeOfflineReward(state.offlineReward);
    state.unattributedSales = state.unattributedSales || 0;
    sanitizeState();
    ensureResearchSlots();
    bindBranchServiceTimers();
    renderOfflineReward();
  },

  move(id) {
    if (!REGION_MAP[id] || !state.regionUnlocked || !state.regionUnlocked[id]) {
      showToast("아직 해금되지 않은 지역이에요!");
      return false;
    }
    if (id === state.regionId) return true;
    // save current, then move
    captureBranchServiceTimers();
    const previous = structuredClone(state);
    const previousEffects = structuredClone(window._fxState);
    this.saveCurrent();
    state.regionId = id;
    this.ensure(id);
    this.loadFrom(id, { resetRuntime: true });

    markStateChanged("branches");
    if (!save(true)) {
      Object.assign(state, previous);
      bindBranchServiceTimers();
      window._fxState = previousEffects;
      this.saveCurrent();
      renderOfflineReward();
      buildMenuGrid();
      updateUI();
      updateStatsUI();
      renderMapUI();
      showToast("저장 실패. 현재 지점에 남아 있습니다.");
      return false;
    }

    // close UI & redraw with new branch data
    closePanels();
    buildMenuGrid();
    updateUI();
    updateStatsUI();
    renderMapUI();

    const nm = REGION_MAP[id]?.name || id;
    showToast(`지역 이동: ${nm}`);
    return true;
  },

  unlockNext() {
    const cur = getRegion();
    const next = getNextRegion();
    if (cur.id === next.id) {
      showToast("이미 마지막 지역이에요!");
      return false;
    }
    const need = next.unlockCost || 0;
    if (moneyCompare(state.money, need) < 0) {
      showToast(`해금 비용 부족: ${fmtCompact(need)}`);
      return false;
    }
    state.money = moneySub(state.money, need);

    state.regionUnlocked = state.regionUnlocked || {};
    state.regionUnlocked[next.id] = true;

    this.ensure(next.id); // prepare branch slot
    state.mapSelected = next.id;

    markStateChanged("branches");
    save(true);
    updateUI();
    renderMapUI();
    showToast(`${next.name} 해금 완료!`);
    AudioEngine.sfx.confirm();
    return true;
  },
};
const ServiceRuntime = {
  ownerState: null,
  ownerRegion: null,
  deliveryOwner: null,
  deliverySignature: "",
  deliveryInputs: null,
};

function normalizeServiceTimers(value) {
  const number = (n, fallback = 0) =>
    Number.isFinite(n) ? Math.max(0, n) : fallback;
  const interval =
    Number.isFinite(value?.deliveryIntervalMs) &&
    value.deliveryIntervalMs >= 600 &&
    value.deliveryIntervalMs <= 60000
      ? value.deliveryIntervalMs
      : null;
  return {
    onlineOrders: Math.min(number(value?.onlineOrders), 1),
    deliveryMs: interval ? Math.min(number(value?.deliveryMs), interval) : 0,
    deliveryIntervalMs: interval,
    deliverySignature:
      typeof value?.deliverySignature === "string"
        ? value.deliverySignature
        : "",
  };
}
function bindBranchServiceTimers() {
  const newState = ServiceRuntime.ownerState !== state;
  const timers = (state.serviceTimers = normalizeServiceTimers(
    state.serviceTimers,
  ));
  onlineTimer = timers.onlineOrders;
  deliveryTimer = timers.deliveryMs;
  deliveryNextIntervalMs = timers.deliveryIntervalMs;
  ServiceRuntime.deliveryOwner = state.delivery;
  ServiceRuntime.deliverySignature = timers.deliverySignature;
  ServiceRuntime.deliveryInputs = null;
  state._staffRot = Number.isFinite(state._staffRot)
    ? Math.max(0, Math.floor(state._staffRot))
    : 0;
  state._autoServeAcc = Number.isFinite(state._autoServeAcc)
    ? Math.max(0, state._autoServeAcc)
    : 0;
  state._eventCheckAcc = Number.isFinite(state._eventCheckAcc)
    ? Math.max(0, state._eventCheckAcc)
    : 0;
  ServiceRuntime.ownerState = state;
  ServiceRuntime.ownerRegion = state.regionId;
  visualRiders = [];
  deliveryVisualAcc = 0;
  deliveryNextVisualSec = 0;
  // Temporary click effects stop on movement; retain their daily-use limits.
  if (window._fxState) {
    if (newState) {
      window._fxState.boss.buffCount = 0;
      window._fxState.boss.buffDate = "";
      window._fxState.staffs = {};
    }
    for (const effect of [
      window._fxState.boss,
      ...Object.values(window._fxState.staffs || {}),
    ]) {
      effect.buffUntil = 0;
      effect.taps = 0;
      effect.lastClick = 0;
    }
    window._fxState.speech = { type: null, key: null, msg: "", until: 0 };
  }
}
function ensureBranchServiceOwner() {
  if (
    ServiceRuntime.ownerState !== state ||
    ServiceRuntime.ownerRegion !== state.regionId
  )
    bindBranchServiceTimers();
}
function captureBranchServiceTimers() {
  if (
    ServiceRuntime.ownerState !== state ||
    ServiceRuntime.ownerRegion !== state.regionId
  )
    return;
  const next = normalizeServiceTimers({
    onlineOrders: onlineTimer,
    deliveryMs: deliveryTimer,
    deliveryIntervalMs: deliveryNextIntervalMs,
    deliverySignature: ServiceRuntime.deliverySignature,
  });
  if (Object.keys(next).some((key) => state.serviceTimers[key] !== next[key])) {
    state.serviceTimers = next;
    markStateChanged("service-progress", false);
  }
}
