function normalizeOfflineReward(reward) {
  const amount = normalizeMoney(reward?.amount, 0, true);
  const seconds =
    moneyCompare(amount, 0) > 0 && Number.isFinite(reward?.seconds)
      ? Math.max(0, reward.seconds)
      : 0;
  const result = { amount, seconds },
    menus = {};
  let total = 0n;
  for (const [id, s] of Object.entries(reward?.menus || {})) {
    if (!MENU_MAP[id] || !isMoney(s?.earned) || moneyCompare(s.earned, 0) <= 0)
      continue;
    menus[id] = {
      earned: normalizeMoney(s.earned, 0, true),
      count: Number.isFinite(s.count) ? Math.max(0, Math.floor(s.count)) : 0,
    };
    total += moneyInt(menus[id].earned);
  }
  if (total > 0n && total <= moneyInt(amount)) result.menus = menus;
  return result;
}

function renderOfflineReward() {
  state.offlineReward = normalizeOfflineReward(state.offlineReward);
  if (!modalOffline) return;
  offlineEarn.textContent = fmtWon(state.offlineReward.amount);
  offlineTime.textContent = `오프라인 ${Math.floor(state.offlineReward.seconds / 60)}분 동안 가족 알바 자동 운영`;
  modalOffline.classList.toggle("on", state.offlineReward.amount > 0);
}

function applyOfflineProgress() {
  const now = Date.now(),
    usedSec =
      Math.min(
        Math.max(0, now - (state.lastSeenAt || now)),
        CONFIG.offlineMaxHours * 3600000,
      ) / 1000;
  state.offlineReward = normalizeOfflineReward(state.offlineReward);
  if (usedSec >= 60) {
    const reward = structuredClone(state.offlineReward);
    const rates = computeRates(),
      served = Math.floor((rates.autoServesPerMin / 60) * usedSec);
    const menus = MENUS.slice(0, clampInt(getOpenMenuCount(), 1, MENUS.length));
    try {
      for (let i = 0; i < menus.length; i++) {
        const count =
          Math.floor(served / menus.length) +
          (i < served % menus.length ? 1 : 0);
        const earned = moneyScale(
          getMenuPrice(menus[i].id),
          count,
          0.85 + (state.rep / 5) * 0.2,
        );
        if (moneyCompare(earned, 0) <= 0) continue;
        reward.amount = moneyAdd(reward.amount, earned);
        const stats = ((reward.menus ||= {})[menus[i].id] ||= {
          count: 0,
          earned: 0,
        });
        stats.count += count;
        stats.earned = moneyAdd(stats.earned, earned);
      }
      if (served > 0) reward.seconds += usedSec;
      state.offlineReward = reward;
      state.play.offlineSecTotal = (state.play.offlineSecTotal || 0) + usedSec;
      markStateChanged("offline");
    } catch (error) {
      console.error(
        "[offline] amount limit; confirmed receipt unchanged",
        error,
      );
      showToast("금액 범위를 확인해 주세요. 기존 미수령 수익을 보존했습니다.");
    }
  }
  state.lastSeenAt = now;
  renderOfflineReward();
}

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
  {
    let allocated = 0;
    for (const [menuId, s] of Object.entries(reward.menus || {})) {
      if (!recordIncome(s.earned, { menuId, count: s.count, offline: true })) {
        Object.assign(state, previous);
        showToast("금액 범위를 확인해 주세요. 미수령 수익을 보존했습니다.");
        return false;
      }
      allocated = moneyAdd(allocated, s.earned);
    }
    if (
      moneyCompare(reward.amount, allocated) > 0 &&
      !recordIncome(moneySub(reward.amount, allocated), { offline: true })
    ) {
      Object.assign(state, previous);
      showToast("금액 범위를 확인해 주세요. 미수령 수익을 보존했습니다.");
      return false;
    }
  }
  state.offlineReward = { amount: 0, seconds: 0 };
  markStateChanged("offline");
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
