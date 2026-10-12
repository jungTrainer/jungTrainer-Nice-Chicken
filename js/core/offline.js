/* REC-01: compatible pending receipts; installed before DOMContentLoaded. */
let deferRecoveryWrites = false;
const legacySave = save;
save = function (force = false) {
  if (deferRecoveryWrites) {
    _saveDirty = true;
    return true;
  }
  return legacySave(force);
};
const legacyInit = init;
init = function () {
  deferRecoveryWrites = true;
  try {
    legacyInit();
  } finally {
    deferRecoveryWrites = false;
  }
  if (_saveDirty) save(true);
};
function normalizeOfflineReward(reward) {
  const amount = Number.isFinite(reward?.amount)
    ? Math.max(0, Math.floor(reward.amount))
    : 0;
  const seconds =
    amount > 0 && Number.isFinite(reward?.seconds)
      ? Math.max(0, reward.seconds)
      : 0;
  const result = { amount, seconds },
    menus = {};
  let total = 0;
  for (const [id, s] of Object.entries(reward?.menus || {})) {
    if (!MENU_MAP[id] || !Number.isFinite(s?.earned) || s.earned <= 0) continue;
    menus[id] = {
      earned: Math.floor(s.earned),
      count: Number.isFinite(s.count) ? Math.max(0, Math.floor(s.count)) : 0,
    };
    total += menus[id].earned;
  }
  if (total > 0 && total <= amount) result.menus = menus;
  return result;
}
function renderOfflineReward() {
  state.offlineReward = normalizeOfflineReward(state.offlineReward);
  if (!modalOffline) return;
  offlineEarn.textContent = fmtWon(state.offlineReward.amount);
  offlineTime.textContent = `오프라인 ${Math.floor(state.offlineReward.seconds / 60)}분 동안 가족 알바 자동 운영`;
  modalOffline.classList.toggle("on", state.offlineReward.amount > 0);
}
applyOfflineProgress = function () {
  const now = Date.now(),
    usedSec =
      Math.min(
        Math.max(0, now - (state.lastSeenAt || now)),
        CONFIG.offlineMaxHours * 3600000,
      ) / 1000;
  state.offlineReward = normalizeOfflineReward(state.offlineReward);
  if (usedSec >= 60) {
    state.play.offlineSecTotal = (state.play.offlineSecTotal || 0) + usedSec;
    const rates = computeRates(),
      served = Math.floor((rates.autoServesPerMin / 60) * usedSec);
    const menus = MENUS.slice(0, clampInt(getOpenMenuCount(), 1, MENUS.length));
    for (let i = 0; i < menus.length; i++) {
      const count =
        Math.floor(served / menus.length) + (i < served % menus.length ? 1 : 0);
      const earned = Math.floor(
        count * getMenuPrice(menus[i].id) * (0.85 + (state.rep / 5) * 0.2),
      );
      if (!Number.isFinite(earned) || earned <= 0) continue;
      state.offlineReward.amount += earned;
      const stats = ((state.offlineReward.menus ||= {})[menus[i].id] ||= {
        count: 0,
        earned: 0,
      });
      stats.count += count;
      stats.earned += earned;
    }
    if (served > 0) state.offlineReward.seconds += usedSec;
    _saveDirty = true;
  }
  state.lastSeenAt = now;
  renderOfflineReward();
};
function claimOfflineReward() {
  const reward = normalizeOfflineReward(state.offlineReward);
  if (!reward.amount) {
    renderOfflineReward();
    return false;
  }
  ensureMissionReset();
  const previous = Object.fromEntries(
    [
      "money",
      "offlineSalesToday",
      "offlineSalesTotal",
      "menuStats",
      "contrib",
      "unattributedSales",
    ].map((k) => [k, structuredClone(state[k])]),
  );
  previous.offlineReward = reward;
  if (typeof recordIncome === "function") {
    let allocated = 0;
    for (const [menuId, s] of Object.entries(reward.menus || {})) {
      recordIncome(s.earned, { menuId, count: s.count, offline: true });
      allocated += s.earned;
    }
    if (reward.amount > allocated)
      recordIncome(reward.amount - allocated, { offline: true });
  } else {
    state.money += reward.amount;
    state.offlineSalesToday += reward.amount;
    state.offlineSalesTotal += reward.amount;
  }
  state.offlineReward = { amount: 0, seconds: 0 };
  _saveDirty = true;
  if (!save(true)) {
    Object.assign(state, previous);
    BranchManager.saveCurrent();
    renderOfflineReward();
    showToast("저장 실패. 수익을 다시 받아 주세요.");
    return false;
  }
  renderOfflineReward();
  updateUI();
  return true;
}
