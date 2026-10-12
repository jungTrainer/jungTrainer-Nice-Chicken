/* IMP-08: growth and scoped derived effects; no installed function replacements. */
let effectBatchDepth = 0,
  effectBatchCache = null;
function beginEffectBatch() {
  if (effectBatchDepth++ === 0) effectBatchCache = null;
}
function endEffectBatch() {
  if (--effectBatchDepth === 0) effectBatchCache = null;
}
function invalidateDerivedEffects() {
  effectBatchCache = null;
}
function sumEffects() {
  if (!effectBatchDepth) return aggregateEffects();
  return (effectBatchCache ||= aggregateEffects());
}

function aggregateEffects() {
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

  for (const u of UPGRADES) {
    let lvl = state.upgrades[u.id] || 0;
    // [특수] 배달 업그레이드 상태는 별도 스토리지
    if (u.id === "deliVehicle") lvl = state.delivery.level || 0;
    if (u.id === "deliRider") lvl = state.delivery.riders || 0;
    if (lvl <= 0) continue;
    for (const k in u.effect || {}) {
      eff[k] = (eff[k] || 0) + u.effect[k] * lvl;
    }
  }

  // 연구(레벨형) 효과 합산
  for (const rid in state.research.levels || {}) {
    const lvl = state.research.levels[rid] || 0;
    if (lvl <= 0) continue;
    const r = RESEARCH.find((x) => x.id === rid);
    if (!r) continue;
    for (const k in r.effectPerLevel || {}) {
      eff[k] = (eff[k] || 0) + r.effectPerLevel[k] * lvl;
    }
  }

  if (state.event) {
    for (const k in state.event.mod) {
      eff[k] = (eff[k] || 0) + state.event.mod[k];
    }
  }

  if (state.robotGrandson) {
    eff.earningMul += 0.5;
    eff.ordersMul += 0.5;
  }
  return eff;
}
function computeRates() {
  const eff = sumEffects();

  // 메뉴가 확장될수록 유입 증가(3개 기준, 최대 9개)
  const openCount = getOpenMenuCount();
  const menuDemandMul = 1 + Math.max(0, openCount - 3) * 0.06;

  let ordersPerMin =
    CONFIG.baseOrdersPerMin * (1 + (eff.ordersMul || 0)) * menuDemandMul;
  ordersPerMin = Math.max(1, ordersPerMin);

  // [추가] 온라인 주문(자동 수익): 마케팅-온라인 레벨 + 포장 트레이 효과
  const onlineLvl = clampInt(state.upgrades.sns || 0, 0, 50);
  const onlineBasePerMin = 0.2 + onlineLvl * 0.25; // 레벨당 +0.25/min
  let onlineOrdersPerMin =
    onlineBasePerMin *
    (1 + (eff.onlineMul || 0)) *
    (1 + (eff.onlineFreqMul || 0));
  onlineOrdersPerMin = Math.max(0, onlineOrdersPerMin);

  const patienceBase = state.level <= 2 ? 22 : state.level <= 6 ? 16 : 12;
  let patience = patienceBase + (eff.patienceBonus || 0);
  if (eff.patienceMul) patience *= 1 + eff.patienceMul;
  patience = Math.max(7, patience);

  const staffCount = getStaffCount();

  // 직원 육성(각 직원별 2개 업그레이드)
  ensureStaffStats();
  const hired = STAFF_POOL.slice(0, staffCount);
  let staffAutoSum = 0;
  let tipChance = 0.05;
  let tipMul = 0.08;

  const gradeAuto = { C: 1.0, B: 1.05, A: 1.12, S: 1.22 };
  const gradeTip = { C: 1.0, B: 1.08, A: 1.16, S: 1.28 };

  for (const s of hired) {
    const st = state.staffStats?.[s.key] || { auto: 0, tip: 0 };
    const aLvl = clampInt(st.auto || 0, 0, 10);
    const tLvl = clampInt(st.tip || 0, 0, 10);

    // 서빙 마스터: 자동 서빙 기여도(속도)
    const speedMul =
      (s.baseSpeed || 1) * (1 + aLvl * 0.18) * (gradeAuto[s.grade] || 1);
    staffAutoSum += 1.4 * speedMul; // stronger per-staff contribution // serves/min contribution

    // 서비스 교육: 팁 확률/금액 증가
    tipChance += 0.012 * tLvl * (gradeTip[s.grade] || 1);
    tipMul += 0.035 * tLvl * (gradeTip[s.grade] || 1);
  }

  tipChance = Math.min(0.4, tipChance);
  tipMul = Math.min(0.55, tipMul);

  let autoServesPerMin = CONFIG.baseAutoServesPerMin + (eff.baseAutoAdd || 0);
  const staffSpeedMul = Math.max(0, 1 + (eff.staffSpeedMul || 0));
  autoServesPerMin += staffAutoSum * staffSpeedMul;

  let autoMul = 1 + (eff.autoServeMul || 0);
  if (state.event && state.event.id === "supply") {
    const resist = eff.eventAutoResist || 0;
    autoMul = 1 + Math.min(0, (eff.autoServeMul || 0) + resist);
  }
  autoServesPerMin *= autoMul;
  autoServesPerMin = Math.max(0, autoServesPerMin);

  return {
    ordersPerMin,
    onlineOrdersPerMin,
    patienceSec: patience,
    autoServesPerMin,
    staffCount,
    tipChance,
    tipMul,
    staffSpeedMul,
    eff,
  };
}

function getStaffCount() {
  return clampInt(state?.upgrades?.hire || 0, 0, STAFF_POOL.length);
}

function getHiredStaff() {
  return STAFF_POOL.slice(0, getStaffCount());
}

function ensureStaffStats() {
  if (!state.staffStats) state.staffStats = {};
  for (const s of STAFF_POOL) {
    if (!state.staffStats[s.key]) {
      state.staffStats[s.key] = { auto: 0, tip: 0, earned: 0 };
    } else {
      const o = state.staffStats[s.key];
      if (o.auto == null) o.auto = 0;
      if (o.tip == null) o.tip = 0;
      if (o.earned == null) o.earned = 0;
    }
  }
  if (!state.contrib) state.contrib = { player: 0, staff: 0, system: 0 };
  if (state._autoStaffIdx == null) state._autoStaffIdx = 0;
}

function staffUpgradeCost(staffKey, kind, cur) {
  // kind: 'auto'(서빙 마스터) or 'tip'(서비스 교육)
  const s = STAFF_POOL.find((x) => x.key === staffKey);
  const gradeMul =
    s?.grade === "S"
      ? 2.2
      : s?.grade === "A"
        ? 1.8
        : s?.grade === "B"
          ? 1.4
          : 1.0;

  if (kind === "auto") {
    const base = 80000;
    return moneyGeometricCost(base, 1.9, cur, gradeMul);
  } else {
    // tip
    const base = 100000;
    return moneyGeometricCost(base, 1.85, cur, gradeMul);
  }
}

function buyStaffUpgrade(staffKey, kind) {
  ensureMissionReset();
  ensureStaffStats();
  if (kind !== "auto" && kind !== "tip") return;
  if (!getHiredStaff().some((staff) => staff.key === staffKey)) {
    showToast("현재 지점에서 먼저 고용하세요.");
    return;
  }
  const st = state.staffStats[staffKey];
  if (!st) return;
  const cur = st[kind] || 0;
  if (cur >= 10) {
    showToast("이미 최대 레벨!");
    sfxWrong?.();
    return;
  }

  const cost = staffUpgradeCost(staffKey, kind, cur);
  if (moneyCompare(state.money, cost) < 0) {
    showToast("돈이 부족해요!");
    sfxWrong?.();
    return;
  }

  state.money = moneySub(state.money, cost);

  // missions: upgrade purchase counter
  state.missions = state.missions || {};
  state.missions._upgBuysToday = (state.missions._upgBuysToday || 0) + 1;
  state.missions._weekUpgBuys = (state.missions._weekUpgBuys || 0) + 1;
  st[kind] = cur + 1;
  markStateChanged("growth");

  const who = STAFF_POOL.find((s) => s.key === staffKey)?.label || "직원";
  showToast(
    `${who} ${kind === "auto" ? "서빙 마스터" : "서비스 교육"} Lv.${st[kind]}!`,
  );
  sfxConfirm?.();

  save(true);
  updateUI();
  renderPanel("upg");
}

function levelCurve(lv) {
  lv = Math.max(0, Math.min(10, lv | 0));
  if (lv <= 0) return 0;
  if (lv < 5) return lv * 0.08;
  return 5 * 0.08 + (lv - 5) * 0.22;
}

function genericStaffUpgradeCost(lv, mult = 1) {
  return moneyGeometricCost(50000, 2, lv, mult);
}

function getOpenMenuCount() {
  return 1 + (state.upgrades.menuUnlock || 0);
}

function ensureResearchSlots() {
  const eff = sumEffects();
  const slots = clampInt(1 + (eff.researchSlots || 0), 1, 2);
  state.research.slots = slots;
  while (state.research.running.length < slots) {
    state.research.running.push({
      activeId: null,
      targetLevel: 0,
      startAt: 0,
      endAt: 0,
    });
  }
  if (state.research.running.length > slots) {
    state.research.running = state.research.running.slice(0, slots);
  }
}

function startResearch(rid) {
  const r = RESEARCH.find((x) => x.id === rid);
  if (!r) return;

  state.research.levels = state.research.levels || {};
  const curLvl = state.research.levels[rid] || 0;
  const maxL = r.maxLevel || 10;
  if (curLvl >= maxL) {
    showToast("이미 최고 단계까지 완료된 연구입니다.");
    return;
  }

  ensureResearchSlots();
  ensureStaffStats();

  const slotIdx = state.research.running.findIndex((s) => !s.activeId);
  if (slotIdx === -1) {
    showToast("연구 슬롯이 꽉 찼어요!");
    return;
  }

  const nextLvl = curLvl + 1;
  const base = r.baseMin ?? r.minutes ?? 10;
  const scale = r.timeScale ?? 1.35;
  const durMs = Math.round(base * Math.pow(scale, nextLvl - 1) * 60 * 1000);

  const now = Date.now();
  state.research.running[slotIdx] = {
    activeId: rid,
    targetLevel: nextLvl,
    startAt: now,
    endAt: now + durMs,
  };
  markStateChanged("growth");

  showToast(`연구 시작: ${r.name} Lv.${nextLvl}`);
  sfxTick();
  if (_saveDirty) save(true);
  renderPanel("res");
}

function updateResearch() {
  ensureResearchSlots();
  ensureStaffStats();
  let anyActive = false;
  let bestPct = 0;
  let statusText = "없음";

  for (let i = 0; i < state.research.running.length; i++) {
    const s = state.research.running[i];
    if (!s.activeId) continue;
    anyActive = true;
    const r = RESEARCH.find((x) => x.id === s.activeId);
    const total = s.endAt - s.startAt;
    const left = s.endAt - Date.now();
    const pct = clamp(1 - left / total, 0, 1);
    bestPct = Math.max(bestPct, pct);

    if (left <= 0) {
      const rid = s.activeId;
      const rinfo = RESEARCH.find((x) => x.id === rid);
      const maxL = rinfo?.maxLevel || 10;
      const tgt = s.targetLevel || (state.research.levels?.[rid] || 0) + 1;
      state.research.levels = state.research.levels || {};
      state.research.levels[rid] = Math.min(
        maxL,
        Math.max(state.research.levels[rid] || 0, tgt),
      );

      state.research.running[i] = {
        activeId: null,
        targetLevel: 0,
        startAt: 0,
        endAt: 0,
      };
      markStateChanged("growth");

      const doneLvl = state.research.levels[rid] || 0;
      showToast(`🎓 연구 완료: ${rinfo?.name || rid} Lv.${doneLvl}`);
      sfxFanfare();
      markStateChanged("input-action");
      save(true);
      renderPanel("res");
    } else {
      const mm = Math.floor(left / 60000);
      const ss = Math.floor((left % 60000) / 1000);
      statusText = `슬롯${i + 1}: ${r?.name || s.activeId} (${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")})`;
    }
  }

  if (anyActive) {
    resStatus.textContent = statusText;
    resBar.style.width = `${Math.floor(bestPct * 100)}%`;
  } else {
    resStatus.textContent = "없음";
    resBar.style.width = "0%";
  }
}

function buyUpgrade(id) {
  ensureMissionReset();
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return;
  const cur = state.upgrades[id] || 0;
  const maxL = u.maxLevel ?? 99;
  if (cur >= maxL) {
    showToast("최대 레벨입니다!");
    return;
  }
  const cost = upgradeCost(id, cur);
  if (!isMoney(cost) || moneyCompare(cost, 0) <= 0) {
    showToast("구매할 수 없어요!");
    return;
  }
  if (moneyCompare(state.money, cost) < 0) {
    showToast("돈이 부족해요!");
    return;
  }
  state.money = moneySub(state.money, cost);
  markStateChanged("growth");

  // [특수] 배달 업그레이드
  state.missions._upgBuysToday = (state.missions._upgBuysToday || 0) + 1;
  state.missions._weekUpgBuys = (state.missions._weekUpgBuys || 0) + 1;
  // UI/코스트/세이브 일관성을 위해 state.upgrades와 state.delivery를 동기화합니다.
  if (id === "deliVehicle") {
    const next = clampInt((state.delivery?.level || 0) + 1, 0, 10);
    state.delivery = state.delivery || { level: 0, riders: 0 };
    state.delivery.level = next;
    state.upgrades[id] = next; // 레벨 동기화
    AudioEngine.sfx.fanfare();
    showToast(`이동수단 진화 완료! (Lv.${next})`);
    if (_saveDirty) save(true);
    updateUI();
    renderPanel("upg");
    return;
  }
  if (id === "deliRider") {
    state.delivery = state.delivery || { level: 0, riders: 0 };
    const next = clampInt((state.delivery.riders || 0) + 1, 0, 999);
    state.delivery.riders = next;
    state.upgrades[id] = next; // 레벨 동기화(고용 인원 = Lv)
    AudioEngine.sfx.coin();
    showToast(`라이더 고용 완료! (총 ${next}명)`);
    if (_saveDirty) save(true);
    updateUI();
    renderPanel("upg");
    return;
  }

  state.upgrades[id] = cur + 1;

  if (id === "menuUnlock") {
    buildMenuGrid();
  }

  showToast(`${u.name} Lv.${state.upgrades[id]} 구매!`);
  sfxTick();
  if (_saveDirty) save(true);
  renderPanel("upg");
  updateUI();
}

function checkLevelUp() {
  const thresholds = CONFIG.levelUpTotalSales || [0];
  const maxLv =
    CONFIG.maxLevel || (thresholds.length ? thresholds.length - 1 : 50);
  const sales = getLifetimeSales();
  let newLv = 1;
  for (let lv = 1; lv <= maxLv; lv++) {
    if (moneyCompare(sales, thresholds[lv] || 0) >= 0) newLv = lv;
  }
  newLv = Math.max(1, Math.min(newLv, maxLv));
  if (newLv > state.level) {
    state.level = newLv;
    showToast(`🏢 레벨 업! Lv.${state.level}`);
    sfxFanfare();
    markStateChanged("growth");
  }
}

function researchMenu(menuId) {
  if (!MENUS.slice(0, getOpenMenuCount()).some((m) => m.id === menuId)) return;
  const m = MENUS.find((x) => x.id === menuId);
  if (!m) return;
  state.menuLevels = state.menuLevels || {};
  const lvl = state.menuLevels?.[m.id] || 0;
  const cost = menuResearchCost(lvl);
  if (cost === null) { showToast("메뉴 연구 최대 단계입니다."); return; }
  unlockAudioOnce();
  if (moneyCompare(state.money, cost) < 0) {
    showToast("연구비가 부족해요!");
    if (typeof sfxWrong === "function") sfxWrong();
    return;
  }
  state.money = moneySub(state.money, cost);
  state.menuLevels[m.id] = lvl + 1;
  markStateChanged("growth");
  save(true);
  showToast(`${m.name} 연구 완료!`);
  if (typeof sfxConfirm === "function") sfxConfirm();
  updateUI();
  updateStatsUI();
  if (typeof buildMenuGrid === "function") buildMenuGrid();
  if (typeof renderRndList === "function") renderRndList();
}
