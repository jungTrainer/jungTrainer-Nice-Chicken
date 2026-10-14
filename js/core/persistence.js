/* IMP-08: explicit dirty ownership; write batching only during initial boot. */
let deferRecoveryWrites = false;
let lastStateChangeReason = "";
function markStateChanged(reason, effectsChanged = true) {
  if (!SessionOwner.canMutate()) return;
  _saveDirty = true;
  lastStateChangeReason = reason;
  if (effectsChanged) invalidateDerivedEffects();
}
const SAVE_KEY = "niceChicken_idleServe_vFinal";
const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";
let _saveDirty = false;
let _lastSaveWriteAt = 0;

function save(force = false) {
  if (!SessionOwner.canMutate()) return false;
  // localStorage는 동기식이라 자주 쓰면 렉 유발.
  // force=false는 '저장 필요'만 표시하고 실제 write는 autosave/종료 시에만 수행.
  if (!force) {
    markStateChanged("deferred-save");
    return true;
  }
  markStateChanged("save-request", false);
  if (deferRecoveryWrites) return true;
  try {
    const prevSave = localStorage.getItem(SAVE_KEY);
    if (
      !SessionOwner.verify(prevSave) ||
      !SaveRecovery.checkBeforeWrite(prevSave)
    )
      return false;
    BranchManager.saveCurrent();
    state.lastSeenAt = Date.now();
    if (prevSave && SaveRecovery.inspect().primary.eligible) {
      try {
        localStorage.setItem(SAVE_BACKUP_KEY, prevSave);
      } catch (backupError) {
        console.warn("[save] backup failed", backupError);
        SaveRecovery.note(
          "백업 저장 실패. 본 저장 결과를 확인해 주세요. " +
            backupError.message,
        );
      }
    }
    const priorMeta = state._saveRecovery;
    state._saveRecovery = SaveRecovery.metadata();
    let nextSave;
    try {
      nextSave = JSON.stringify(state);
      localStorage.setItem(SAVE_KEY, nextSave);
    } catch (error) {
      if (priorMeta === undefined) delete state._saveRecovery;
      else state._saveRecovery = priorMeta;
      throw error;
    }
    SessionOwner.committed(nextSave);
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    SaveRecovery.committed();
    return true;
  } catch (e) {
    console.error("[save] failed", e);
    SaveRecovery.note(
      "본 저장 실패. 이 창의 진행과 dirty를 유지합니다. " + e.message,
    );
    return false;
  }
}

function saveGame() {
  return save(true);
}

function bindSaveLifecycleEvents() {
  if (window.__saveLifecycleEventsBound) return;
  window.__saveLifecycleEventsBound = true;
  window.addEventListener("pagehide", () => {
    save(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save(true);
  });
  window.addEventListener("beforeunload", () => {
    save(true);
  });
}

function readSavePayload() {
  return SaveRecovery.read();
}

function exportSaveData() {
  try {
    if (!SessionOwner.canMutate()) {
      const payload = readSavePayload();
      return payload
        ? JSON.stringify(
            {
              app: "niceChicken",
              type: "manual-save-export",
              version: 1,
              saveKey: SAVE_KEY,
              exportedAt: Date.now(),
              data: payload.data,
            },
            null,
            2,
          )
        : "";
    }
    BranchManager.saveCurrent();
    const payload = {
      app: "niceChicken",
      type: "manual-save-export",
      version: 1,
      saveKey: SAVE_KEY,
      exportedAt: Date.now(),
      data: state,
    };
    return JSON.stringify(payload, null, 2);
  } catch (e) {
    console.error("[save-export] failed", e);
    return "";
  }
}

function isLikelyNiceChickenState(data) {
  return !SaveRecovery.validate(data);
}

function importSaveData(raw) {
  if (!SessionOwner.canMutate()) return false;
  if (!raw || !String(raw).trim()) {
    showToast("불러올 백업 JSON을 붙여넣어 주세요.");
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (e) {
    console.error("[save-import] invalid json", e);
    showToast("백업 JSON 형식이 올바르지 않아요.");
    return false;
  }

  if (
    parsed?.app === "niceChicken" &&
    (parsed.type !== "manual-save-export" || parsed.version !== 1)
  ) {
    showToast("지원하지 않는 백업 파일입니다.");
    return false;
  }
  const imported =
    parsed && parsed.app === "niceChicken" && parsed.data
      ? parsed.data
      : parsed;
  if (!isLikelyNiceChickenState(imported)) {
    showToast("나이스치킨 저장 데이터가 아닌 것 같아요.");
    return false;
  }

  if (
    !confirm(
      "게임 진행을 백업으로 교체할까요?\n이 기기의 새 쿠폰·스탬프·월 발급/사용 한도는 현재 원장을 유지하며 가져온 백업에서 추가하지 않습니다. 기존 무기한 쿠폰은 백업 규칙을 따릅니다.",
    )
  ) {
    return false;
  }

  if (
    !replaceGameState({
      ...defaultState(),
      ...CouponPolicy.protectImported(imported),
      moneyEncoding: imported.moneyEncoding,
    })
  ) {
    showToast("저장 실패. 기존 진행을 유지합니다.");
    return false;
  }
  cancelEndingRuntime();
  Campaign.restore();
  restoreEndingUI();
  renderOfflineReward();
  buildMenuGrid();
  updateUI();
  updateStatsUI();
  renderPanel("upg");
  showToast("백업 불러오기 완료");
  return true;
}

function load(selected = null) {
  const payload = selected || readSavePayload();
  if (!payload || !payload.data) return false;
  try {
    const parsed = payload.data;
    if (!parsed || typeof parsed !== "object") return false;
    state = {
      ...defaultState(),
      ...parsed,
      moneyEncoding: parsed.moneyEncoding,
    };

    // deep patches
    state.profile = { ...defaultState().profile, ...(parsed.profile || {}) };
    state.campaign = { ...defaultState().campaign, ...(parsed.campaign || {}) };
    state.coupons = { ...defaultState().coupons, ...(parsed.coupons || {}) };
    state.cert = { ...defaultState().cert, ...(parsed.cert || {}) };

    // [추가] 배달/온라인 초기화(세이브 데이터 호환)
    state.delivery = { ...defaultState().delivery, ...(parsed.delivery || {}) };
    state.online = { ...defaultState().online, ...(parsed.online || {}) };

    state.upgrades = parsed.upgrades || {};
    state.customers = parsed.customers || [];
    state.research = { ...defaultState().research, ...(parsed.research || {}) };

    state.missions = { ...defaultState().missions, ...(parsed.missions || {}) };

    // sound
    state.soundOn = typeof parsed.soundOn === "boolean" ? parsed.soundOn : true;

    // benefits log
    state.benefitsLog = parsed.benefitsLog || [];

    sanitizeState();
    SessionOwner.observed(localStorage.getItem(SAVE_KEY));

    return true;
  } catch (e) {
    return false;
  }
}

function sanitizeState() {
  // [ending flags]
  if (typeof state.endingUnlocked !== "boolean") state.endingUnlocked = false;
  if (typeof state.endingPrompted !== "boolean") state.endingPrompted = false;
  if (typeof state.endingSeen !== "boolean") state.endingSeen = false;
  if (typeof state.robotGrandson !== "boolean") state.robotGrandson = false;

  const d = defaultState();

  // shallow merge critical top-level objects
  if (!state || typeof state !== "object") state = d;
  if (!state.profile) state.profile = d.profile;
  if (!state.campaign) state.campaign = d.campaign;
  if (typeof state.soundOn !== "boolean") state.soundOn = d.soundOn;

  // money/rep/level
  const normNum = (v, fallback = 0) => {
    if (typeof v !== "number") return fallback;
    if (!isFinite(v) || isNaN(v)) return fallback;
    return v;
  };
  state.rep = normNum(state.rep, d.rep);
  state.level = Math.max(1, Math.floor(normNum(state.level, d.level)));

  // [BRANCH/REGION] ensure region state exists (v84 -> v85 migration)
  if (typeof state.regionId !== "string" || !REGION_MAP[state.regionId])
    state.regionId = REGIONS[0].id;
  if (!state.regionUnlocked || typeof state.regionUnlocked !== "object")
    state.regionUnlocked = {};
  if (state.regionUnlocked[REGIONS[0].id] !== true)
    state.regionUnlocked[REGIONS[0].id] = true;
  if (typeof state.mapSelected !== "string") state.mapSelected = state.regionId;

  // branches container
  if (!state.branches || typeof state.branches !== "object")
    state.branches = {};

  // [마이그레이션] 구버전: hire 업그레이드만 있고 직원 개별 데이터가 없으면 기본값 생성
  const hireLvl = getStaffCount();
  if (
    hireLvl > 0 &&
    (!state.staffStats || Object.keys(state.staffStats).length === 0)
  ) {
    state.staffStats = {};
    for (let i = 0; i < hireLvl; i++) {
      const s = STAFF_POOL[i];
      if (!s) break;
      state.staffStats[s.key] = { auto: 0, tip: 0, earned: 0 };
    }
  }

  // payroll / coupons / cert
  if (!state.payroll || typeof state.payroll !== "object")
    state.payroll = JSON.parse(JSON.stringify(d.payroll));
  if (!isMoney(state.payroll.dailyWage))
    state.payroll.dailyWage = d.payroll.dailyWage;
  if (typeof state.payroll.lastDayKey !== "string")
    state.payroll.lastDayKey = d.payroll.lastDayKey;

  if (!state.coupons || typeof state.coupons !== "object")
    state.coupons = JSON.parse(JSON.stringify(d.coupons));
  if (typeof state.coupons.drink !== "number") state.coupons.drink = 0;
  if (typeof state.coupons.veg !== "number") state.coupons.veg = 0;

  if (!state.cert || typeof state.cert !== "object")
    state.cert = JSON.parse(JSON.stringify(d.cert));
  for (const k of ["issuedAt", "validUntil", "usedAt"]) {
    if (typeof state.cert[k] !== "number") state.cert[k] = 0;
  }
  if (typeof state.cert.issuedThisWeek !== "boolean")
    state.cert.issuedThisWeek = false;

  if (!Array.isArray(state.benefitsLog)) state.benefitsLog = [];

  // upgrades
  if (!state.upgrades || typeof state.upgrades !== "object")
    state.upgrades = {};
  // delivery / online
  if (!state.delivery || typeof state.delivery !== "object")
    state.delivery = JSON.parse(JSON.stringify(d.delivery));
  if (typeof state.delivery.level !== "number") state.delivery.level = 0;
  if (typeof state.delivery.riders !== "number") state.delivery.riders = 0;

  if (!state.online || typeof state.online !== "object")
    state.online = JSON.parse(JSON.stringify(d.online));
  if (typeof state.online.level !== "number") state.online.level = 0;

  // customers
  if (!Array.isArray(state.customers)) state.customers = [];
  if (state.selectedCustomerId === undefined) state.selectedCustomerId = null;

  // research
  if (!state.research || typeof state.research !== "object")
    state.research = JSON.parse(JSON.stringify(d.research));
  if (typeof state.research.slots !== "number") state.research.slots = 1;
  if (!Array.isArray(state.research.running)) state.research.running = [];
  if (!state.research.levels || typeof state.research.levels !== "object")
    state.research.levels = {};
  if (!Array.isArray(state.research.completed)) state.research.completed = [];

  // missions
  if (!state.missions || typeof state.missions !== "object")
    state.missions = JSON.parse(JSON.stringify(d.missions));
  if (!Array.isArray(state.missions.dailyList)) state.missions.dailyList = [];
  if (!Array.isArray(state.missions.weeklyList)) state.missions.weeklyList = [];
  CouponPolicy.migrate();
  migrateMoneyState();
  ensureMissionReset();

  // staff stats (per-staff earnings)
  ensureStaffStats();

  // playtime
  if (!state.play || typeof state.play !== "object") {
    state.play = {
      onlineSecTotal: 0,
      offlineSecTotal: 0,
      sessionStartAt: Date.now(),
    };
  } else {
    if (typeof state.play.onlineSecTotal !== "number")
      state.play.onlineSecTotal = 0;
    if (typeof state.play.offlineSecTotal !== "number")
      state.play.offlineSecTotal = 0;
    if (typeof state.play.sessionStartAt !== "number")
      state.play.sessionStartAt = Date.now();
  }
  migrateLegacyResearch();
  ensureManagementState();
  state.serviceTimers = normalizeServiceTimers(state.serviceTimers);
  ensureBranchServiceOwner();
}

// Import/reset replace the state only when its synchronized snapshot is durable.
// The original root is retained on failure, keeping valid delayed callbacks owned.
function replaceGameState(next) {
  if (
    !SessionOwner.canMutate() ||
    !SessionOwner.verify(localStorage.getItem(SAVE_KEY))
  )
    return false;
  captureBranchServiceTimers();
  const previous = state,
    wasDirty = _saveDirty;
  const previousEffects = structuredClone(window._fxState);
  try {
    state = next;
    sanitizeState();
    if (save(true)) return true;
  } catch (error) {
    console.error("[state-replacement] failed", error);
  }
  state = previous;
  bindBranchServiceTimers();
  window._fxState = previousEffects;
  invalidateDerivedEffects();
  _saveDirty = wasDirty;
  return false;
}
function resetGame() {
  if (!SessionOwner.canMutate()) return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!SessionOwner.verify(raw) || !SaveRecovery.prepareReset(raw))
      return false;
  } catch (error) {
    SaveRecovery.note("초기화 준비 실패. 진행을 유지합니다. " + error.message);
    return false;
  }
  const resetState = defaultState();
  resetState.couponLedger = structuredClone(state.couponLedger);
  resetState.couponLedger.welcomeEligible = false;
  if (!replaceGameState(resetState)) {
    showToast("저장 실패. 초기화하지 않았습니다.");
    return false;
  }
  // Never leave the old backup as a recovery source for a completed reset.
  try {
    localStorage.removeItem(SAVE_BACKUP_KEY);
  } catch (error) {
    console.warn("[reset] backup cleanup failed", error);
    SaveRecovery.note(
      "초기화는 저장됐지만 옛 백업 삭제에 실패했습니다. 이전 세대 복원은 차단합니다.",
    );
  }
  stopBGM();
  initAfterLoad(true);
  modalSettings?.classList.remove("on");
  showToast("초기화 완료");
  return true;
}
