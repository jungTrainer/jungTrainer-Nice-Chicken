function getMenuPrice(id, eff = sumEffects()) {
  const base = MENU_MAP[id]?.price || 0;
  if (!base) return 0;
  return moneyCalculate(base, [
    1 + (state.upgrades.expand || 0) * 0.45,
    1 + (state.menuLevels[id] || 0) * 0.5,
    1 + state.level * 0.1,
    getRegion()?.priceMul || 1,
  ], eff.priceBonus || 0, Math.max(0, 1 + (eff.earningMul || 0)));
}

function upgradeCost(id, level = state.upgrades[id] || 0) {
  const upgrade = UPGRADES.find(u => u.id === id);
  if (!upgrade || !Number.isSafeInteger(level) || level < 0) return null;
  const multiplier = getRegion()?.costMul || 1;
  if (upgrade.costGrowth) return moneyGeometricCost(...upgrade.costGrowth, level, multiplier);
  return moneyScale(upgrade.costFn(level), multiplier);
}

function recordIncome(
  amount,
  { menuId = null, actorKey = "system", count = 0, offline = false } = {},
) {
  if (!SessionOwner.canMutate()) return false;
  if (!isMoney(amount) || moneyCompare(amount, 0) <= 0) return false;
  amount = normalizeMoney(amount);
  ensureMissionReset();
  ensureStaffStats();
  const today = offline ? "offlineSalesToday" : "todaySales",
    total = offline ? "offlineSalesTotal" : "totalSales";
  const owner = actorKey === "player" ? "player" :
    actorKey === "system" || !state.staffStats[actorKey] ? "system" : "staff";
  const stats = MENU_MAP[menuId] ? (state.menuStats[menuId] || { count: 0, earned: 0 }) : null;
  // Calculate every new ledger value before mutating any one of them.
  let balances;
  try {
    balances = [state.money, state[today] || 0, state[total] || 0,
      state.contrib[owner] || 0,
      owner === "staff" ? state.staffStats[actorKey].earned : 0,
      stats ? stats.earned || 0 : state.unattributedSales || 0
    ].map(value => moneyAdd(value, amount));
  } catch (error) {
    console.error("[income] amount limit; ledgers unchanged", error);
    return false;
  }
  [state.money, state[today], state[total], state.contrib[owner]] = balances;
  if (owner === "staff") state.staffStats[actorKey].earned = balances[4];
  if (stats) {
    state.menuStats[menuId] = stats;
    stats.earned = balances[5];
    const key = offline ? "offlineCount" : "count";
    stats[key] = (stats[key] || 0) + count;
  } else state.unattributedSales = balances[5];
  markStateChanged("income", false);
  return true;
}

function processDelivery(vehicle) {
  if (!SessionOwner.canMutate()) return false;
  const eff = sumEffects(),
    pool = getOrderMenuPool(),
    menu = pool[Math.floor(Math.random() * pool.length)];
  const earnings = moneyScale(getMenuPrice(menu.id, eff),
    Math.max(0, 1 + (eff.deliveryEarningMul || 0)),
    Date.now() < (state.buffEndTime || 0) ? 2 : 1);
  recordIncome(earnings, { menuId: menu.id, count: 1 });
  updateMissionsOnlineOnly();
  spawnVisualRider(vehicle, false);
  showFloatingText(
    canvas.width - 110,
    canvas.height - 210,
    `+${fmtCompact(earnings)}`,
  );
}

function menuUnlockCost(level) {
  return upgradeCost("menuUnlock", level);
}
function upStaff(key, kind) {
  return buyStaffUpgrade(key, kind);
}

function updateEconomyUI() {
  for (const button of menuGrid.querySelectorAll('[data-action="serve-menu"]')) {
    if (button.disabled) continue;
    const price = getMenuPrice(button.dataset.menuId);
    if (button.dataset.price !== String(price)) {
      button.dataset.price = price;
      button.title = moneyExactText(price) + "원";
      button.querySelector(".price").textContent = fmtWon(price);
    }
  }
  for (const b of upgradeButtons) {
    const u = UPGRADES.find((u) => u.id === b.dataset.upgradeId);
    b.disabled =
      (state.upgrades[u.id] || 0) >= (u.maxLevel || 99) ||
      moneyCompare(state.money, upgradeCost(u.id)) < 0;
  }
}

function renderMenuStats() {
  const body = document.getElementById("menuRankBody");
  if (!body) return;
  const renderKey = [
    state.unattributedSales,
    ...MENUS.flatMap((menu) => {
      const stats = state.menuStats[menu.id];
      return [stats?.earned || 0, stats?.count || 0, stats?.offlineCount || 0];
    }),
  ].join("|");
  if (body.dataset.renderKey === renderKey) return;
  body.dataset.renderKey = renderKey;
  body.replaceChildren();
  for (const menu of MENUS) {
    const stats = state.menuStats[menu.id];
    if (!stats || !stats.earned) continue;
    const row = document.createElement("tr");
    for (const text of [
      menu.emoji + " " + menu.name,
      ((stats.count || 0) + (stats.offlineCount || 0)).toLocaleString("ko-KR"),
      fmtWon(stats.earned),
    ]) {
      const td = document.createElement("td");
      td.textContent = text;
      row.append(td);
    }
    body.append(row);
  }
  if (state.unattributedSales) {
    const row = document.createElement("tr");
    for (const text of ["메뉴 미분류", "-", fmtWon(state.unattributedSales)]) {
      const td = document.createElement("td");
      td.textContent = text;
      row.append(td);
    }
    body.append(row);
  }
}

function serveByMenu(menuId, actorKey = "player") {
  if (!SessionOwner.canMutate()) return false;
  ensureMissionReset();
  const sel = state.selectedCustomerId;
  if (!sel) {
    showToast("손님을 먼저 선택하세요!");
    sfxWrong();
    return;
  }
  const idx = state.customers.findIndex((c) => c.id === sel);
  if (idx === -1) {
    state.selectedCustomerId = state.customers[0]?.id || null;
    showToast("손님을 다시 선택해요!");
    sfxWrong();
    return;
  }
  const c = state.customers[idx];
  if (c.state === "leaving") {
    showToast("이미 나가는 손님이에요!");
    return;
  }

  const centerX = c.x;
  const centerY = c.y;
  const correct = c.menuId === menuId;
  const rates = computeRates();
  const eff = rates.eff;

  if (!correct) {
    // boss reacts on mistakes
    try {
      state._serveStreak = 0;
      bossSpeak("메뉴 다시 확인!", 1.2, true);
    } catch (e) {}
    state.rep = clamp(
      state.rep - CONFIG.repLossOnWrong,
      CONFIG.repMin,
      CONFIG.repMax,
    );

    const basePenalty = 3;
    const mul = Math.max(0.25, 1 + (eff.wrongPatiencePenaltyMul || 0));
    c.patience -= basePenalty * mul;

    floatText("❌ 틀림!", c.x, c.y - 60, "#FF6B6B");
    showToast("메뉴가 달라요!");
    sfxWrong();
    markStateChanged("incorrect-serve");
    return;
  }

  // correct serve: build streak + occasional boss bonus (cosmetic + tiny rep)
  try {
    const st =
      typeof state._serveStreak === "number" && isFinite(state._serveStreak)
        ? state._serveStreak
        : 0;
    state._serveStreak = st + 1;
    if (state._serveStreak === 3) bossSpeak("좋아, 텐션 유지!", 1.4, false);
    if (state._serveStreak > 0 && state._serveStreak % 10 === 0) {
      bossSpeak(`연속 ${state._serveStreak}콤보!`, 1.8, false);
      state.rep = clamp(state.rep + 0.15, CONFIG.repMin, CONFIG.repMax);
      floatText("✨ 사장님 칭찬! (평판+)", c.x, c.y - 92, "#FFD166");
    }
  } catch (e) {}

  let price = getMenuPrice(menuId);

  // --- [NEW] 사장님 20단 콤보 버프 적용 (에러 완벽 차단) ---
  if (
    window._fxState &&
    window._fxState.boss &&
    window._fxState.boss.buffUntil > Date.now()
  ) {
    price = moneyScale(price, 2);
  }

  // 팁(서비스 교육): 확률적으로 추가 수익
  const isStaff = actorKey && actorKey !== "player";
  const tipRoll = Math.random();
  let tip = 0;

  // 👇 아까 실수로 날아갔던 '팁 발생 조건문' 복구!
  if (tipRoll < (rates.tipChance || 0)) {
    tip = moneyScale(price, rates.tipMul || 0);
    if (tip < 1) tip = 1;
    if (tip > 0) {
      floatText("💸 팁!", centerX + 10, centerY - 75, "#2EC4B6");
    }
  }

  // tips (scaled by tip level) - 기존 팁 로직 2
  let tipLv = 0;
  if (actorKey !== "player" && actorKey !== "system") {
    tipLv = state.staffStats?.[actorKey]?.tip || 0;
  }
  const tipRate = 0.01 + levelCurve(tipLv) * 0.02; // ~1% to ~4%
  const tip2 = moneyMax(0, moneyScale(price, tipRate));
  if (tip > 0 || tip2 > 0) {
    state.missions._tipToday = (state.missions._tipToday || 0) + 1;
    state.missions._weekTip = (state.missions._weekTip || 0) + 1;
  }
  if (tip2 > 0) {
    floatText(`+${fmtCompactWon(tip2)} 팁✨`, centerX, centerY - 42, "gold");
  }
  recordIncome(moneyAdd(moneyAdd(price, tip), tip2), { menuId, actorKey, count: 1 });

  const repGain = CONFIG.repGainOnCorrect + (eff.repGainAdd || 0);
  state.rep = clamp(state.rep + repGain, CONFIG.repMin, CONFIG.repMax);

  floatText(`✅ +${fmtWon(price)}`, centerX, centerY - 60, "#FFD700");
  if (typeof sfxDing === "function") sfxDing();

  // 성공 시 "문으로 퇴장"
  c.state = "leaving";

  // 다음 선택 갱신(남아있는 waiting 손님 중 첫번째)
  const next =
    state.customers.find((x) => x.state !== "leaving" && x.id !== c.id) ||
    state.customers.find((x) => x.state !== "leaving");
  state.selectedCustomerId = next ? next.id : null;

  if (typeof onServeOneOnline === "function") onServeOneOnline(actorKey);
  if (typeof checkLevelUp === "function") checkLevelUp();
  markStateChanged("economy");

  // Presentation notification only: a display-storage failure cannot interrupt settlement.
  try { window.dispatchEvent(new Event("nice-chicken:served")); } catch (_e) {}

  if (_saveDirty) save(true);
}

function processPayroll() {
  if (!SessionOwner.canMutate()) return false;
  // 하루 1번(날짜 바뀔 때) 알바 임금 지급: 1인당 80,000원
  const today = dayKey();
  if (!state.payroll) state.payroll = { lastDayKey: "", dailyWage: 80000 };
  if (state.payroll.lastDayKey === "") state.payroll.lastDayKey = today;
  if (state.payroll.lastDayKey === today) return;

  const hireLvl = getStaffCount();
  const staffCount = hireLvl;
  if (staffCount > 0) {
    const wage = moneyScale(state.payroll.dailyWage || 80000, staffCount);
    state.money = moneySub(state.money, wage);
    showToast(`💸 알바 임금 지급: -${fmtWon(wage)} (${staffCount}명)`);
    sfxTick();
  }
  state.payroll.lastDayKey = today;
  markStateChanged("economy");
  if (_saveDirty) save(true);
}

function logBenefit({ type, qty = 1, source = "", note = "", ...details }) {
  if (!SessionOwner.canMutate()) return false;
  state.benefitsLog = state.benefitsLog || [];
  state.benefitsLog.unshift({
    ts: Date.now(),
    at: nowK(),
    type,
    qty,
    source,
    note,
    ...details,
  });
  // 너무 길어지면 상위 80개만
  if (state.benefitsLog.length > 80) state.benefitsLog.length = 80;
}

async function useCoupon(type, { certificate = false } = {}) {
  if (!SessionOwner.canMutate() || BenefitService.pending) return false;
  if (!["drink", "veg"].includes(type) || CouponPolicy.available(type) <= 0) {
    showToast("보유 쿠폰이 없어요."); return false;
  }
  if (certificate && (!state.cert.issuedThisWeek || state.cert.usedAt || (state.cert.validUntil && Date.now() >= state.cert.validUntil))) return false;
  if (type === "drink" && !CouponPolicy.canUse(type)) { showToast("오늘 사용함: 같은 기기 하루 음료 한 장입니다."); return false; }
  if (type === "drink" && !state.serviceVisit) {
    showToast("쿠폰함에서 테이블과 새 방문을 먼저 기록해 주세요."); return false;
  }
  if (type === "drink" && state.serviceVisit.drinkConfirmedAt) {
    showToast("이 기기의 현재 방문은 음료 제공을 이미 기록했습니다. 테이블당 한 병입니다."); return false;
  }
  if (!confirm("직원이 실제 제공 여부를 확인한 뒤 로컬 사용 기록을 남깁니다.\n음료는 테이블 방문당 한 병이며 다른 기기 기록은 공유되지 않습니다.\n공개 PIN은 서버 인증/매장 승인이 아닙니다. 계속할까요?")) return false;
  BenefitService.pending = true;
  const ownership = SessionOwner.token(), visitId = state.serviceVisit?.id;
  try {
    const ok = await askPIN();
    if (!SessionOwner.matches(ownership) || state.serviceVisit?.id !== visitId) return false;
    if (!ok) { showToast("취소 또는 PIN 불일치. 쿠폰은 그대로입니다."); return false; }
    if (certificate && (!state.cert.issuedThisWeek || state.cert.usedAt || (state.cert.validUntil && Date.now() >= state.cert.validUntil))) return false;
    if (!CouponPolicy.canUse(type) || (type === "drink" && state.serviceVisit.drinkConfirmedAt)) return false;
    const committed = BenefitService.commit(() => {
      const consumption = CouponPolicy.consume(type);
      if (state.serviceVisit) {
        if (type === "drink") state.serviceVisit.drinkConfirmedAt = Date.now();
        else state.serviceVisit.vegConfirmed = (state.serviceVisit.vegConfirmed || 0) + 1;
      }
      logBenefit({ type, source: certificate ? "cert_use" : "coupon_use", note: "직원 제공 확인 후 로컬 기록 (서버 승인 없음)", ...consumption, visitId: visitId || "", table: state.serviceVisit?.table || "기존 방식: 테이블 미기록" });
      if (certificate) { state.cert.usedAt = Date.now(); startNewWeek(); }
    });
    showToast(committed ? "로컬 사용 기록 저장 완료. 실제 테이블 제공은 직원이 확인합니다." : "저장 실패. 쿠폰 차감/사용 기록을 취소했습니다. 저장 재시도 후 다시 확인하세요.");
    updateUI(); renderCoupons();
    if (certificate && committed) { renderPanel("mis"); renderPanel("shr"); }
    return committed;
  } finally { BenefitService.pending = false; }
}

function getLifetimeSales() {
  return moneyAdd(state.totalSales || 0, state.offlineSalesTotal || 0);
}

// Local courtesy-service bookkeeping; not authentication or a shop ledger.
const BenefitService = {
  pending: false,
  commit(change) {
    if (!SessionOwner.canMutate()) return false;
    const fields = ["money", "profile", "coupons", "couponLedger", "benefitsLog", "cert", "missions", "serviceVisit", "lastSeenAt"];
    const previous = Object.fromEntries(fields.map(k => [k, structuredClone(state[k])]));
    const dirty = _saveDirty;
    const displayBefore = CouponPolicy.presentation.capture();
    try {
      change(); markStateChanged("benefit-commit");
      if (save(true)) { CouponPolicy.presentation.committed(displayBefore); return true; }
    } catch (error) { console.error("[benefit] commit failed", error); }
    Object.assign(state, previous); BranchManager.saveCurrent(); _saveDirty = dirty;
    return false;
  },
  async startVisit() {
    if (!SessionOwner.canMutate() || this.pending) return false;
    const input = document.getElementById("serviceTable"), table = (input?.value || "").trim();
    if (!table || table.length > 20) { showToast("테이블 표시를 1~20자로 입력해 주세요."); input?.focus(); return false; }
    if (!confirm("다음 손님/새 식사의 방문 기록을 시작할까요?\n같은 테이블의 현재 식사라면 새 방문을 만들지 마세요.\n다른 기기와 제공 횟수는 공유되지 않으며 직원 확인이 필요합니다.")) return false;
    const ownership = SessionOwner.token(), visitId = state.serviceVisit?.id;
    const modern = CouponPolicy.period() === 2;
    this.pending = true;
    try {
      if (modern && !await askPIN()) { showToast("취소 또는 PIN 불일치. 방문/스탬프를 유지합니다."); return false; }
      if (!SessionOwner.matches(ownership) || state.serviceVisit?.id !== visitId) return false;
      const committed = this.commit(() => {
        state.serviceVisit = { id: crypto.randomUUID(), table, startedAt: Date.now(), drinkConfirmedAt: 0, vegConfirmed: 0 };
        if (modern && CouponPolicy.claim("visit",CouponPolicy.day(),COUPON_POLICY.visitDailyLimit))
          CouponPolicy.addStamps(COUPON_POLICY.visitStamps,"staff_visit");
      });
      showToast(committed ? "새 방문 기록 저장. 화면 확인은 쿠폰 사용이 아닙니다." : "저장 실패. 이전 방문 기록을 보존합니다.");
      this.render(); return committed;
    } finally { this.pending = false; }
  },
  render() {
    const host = document.getElementById("staffCouponStatus");
    if (!host) return;
    const v = state.serviceVisit;
    const text = `${v ? `테이블 ${v.table} · 방문 ${v.id}\n시작 ${new Date(v.startedAt).toLocaleString("ko-KR")}\n음료 ${v.drinkConfirmedAt ? `제공 후: ${new Date(v.drinkConfirmedAt).toLocaleString("ko-KR")}` : "제공 전(직원 확인 필요)"} · 이 방문 무/양배추 기록 ${v.vegConfirmed}회` : "새 방문/테이블 미기록. 음료 사용 전 방문을 기록하세요."}\n사용 가능 음료 ${CouponPolicy.available("drink")}장 · 무/양배추 ${CouponPolicy.available("veg")}장\n${CouponPolicy.usedToday() >= COUPON_POLICY.dailyDrinkUseLimit ? "오늘 사용함" : "오늘 음료 미사용"} (기기 전체 하루 ${COUPON_POLICY.dailyDrinkUseLimit}장)\n음료는 테이블 방문당 한 병. 이 화면은 기기 내부 기록이며 다른 기기 횟수를 공유하지 않습니다. 공개 PIN은 서버 인증이 아닙니다.\n무/양배추 제공량·추가 횟수는 직원에게 확인하세요. 새 한도는 적용하지 않았습니다.`;
    if (host.textContent !== text) host.textContent = text;
    const summary = document.getElementById("serviceVisitSummary");
    CouponPolicy.render();
    if (summary) summary.textContent = v ? `방문 ${v.table} · 음료 ${v.drinkConfirmedAt ? "제공 기록 완료" : "제공 전"}` : "직원과 함께 새 방문을 시작해요.";
  },
};
