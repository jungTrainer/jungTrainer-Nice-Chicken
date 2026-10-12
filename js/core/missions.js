/* REC-02: eight latched objectives, with compatible reward guards. */
function missionList(weekly) {
  const types = weekly
    ? ["stamp", "sales", "rep", "tip", "menu", "upg", "sign", "expand"]
    : ["serve", "earn", "rep", "tip", "menu", "upg", "sign", "expand"];
  const targets = weekly
    ? [7, 900000, 1, 20, 30, 15, 3, 3]
    : [6, 40000, 1, 3, 2, 2, 1, 1];
  const labels = {
    stamp: "일간 올클",
    sales: "주간 매출",
    serve: "정확 서빙",
    earn: "오늘 매출",
    rep: weekly ? "평점 4.4 이상" : "평점 4.2 이상",
    tip: "팁 받기",
    menu: "메뉴 판매",
    upg: "업그레이드 구매",
    sign: "간판 강화",
    expand: "가게 확장",
  };
  const mid = MENUS[clampInt(getOpenMenuCount() - 1, 0, MENUS.length - 1)].id;
  return types.map((type, i) => ({
    id: (weekly ? "w_" : "d_") + type,
    type,
    title: labels[type] + (type === "rep" ? "" : ` ${targets[i]}`),
    target: targets[i],
    current: 0,
    done: false,
    ...(type === "menu" ? { menuId: mid } : {}),
  }));
}
function missionBaselines(weekly) {
  const m = state.missions,
    prefix = weekly ? "_weekStart" : "_dayStart";
  m[prefix + "MenuCounts"] = Object.fromEntries(
    MENUS.map((menu) => [menu.id, state.menuStats[menu.id]?.count || 0]),
  );
  m[prefix + "Sign"] = state.upgrades.signboard || 0;
  m[prefix + "Expand"] = state.upgrades.expand || 0;
  if (weekly) {
    m._weekTip = 0;
    m._weekUpgBuys = 0;
    m._weekServe = 0;
    m._weekStartTotalSales = state.totalSales;
  } else {
    m._tipToday = 0;
    m._upgBuysToday = 0;
    m._serveToday = 0;
  }
}
function repairMissionGoals() {
  const m = state.missions;
  const buys =
    UPGRADES.reduce(
      (n, u) =>
        n + Math.max(0, (u.maxLevel || 0) - (state.upgrades[u.id] || 0)),
      0,
    ) +
    STAFF_POOL.slice(0, 5).reduce(
      (n, s) =>
        n +
        ["auto", "tip"].reduce(
          (a, k) => a + Math.max(0, 10 - (state.staffStats?.[s.key]?.[k] || 0)),
          0,
        ),
      0,
    );
  for (const weekly of [false, true])
    for (const goal of m[weekly ? "weeklyList" : "dailyList"] || []) {
      if (goal.done) continue;
      const current = goal.current || 0;
      const left =
        goal.type === "upg"
          ? buys
          : goal.type === "sign"
            ? 10 - (state.upgrades.signboard || 0)
            : goal.type === "expand"
              ? 20 - (state.upgrades.expand || 0)
              : Infinity;
      if (left < goal.target - current) {
        goal.originalType = goal.type;
        goal.type = "serve";
        goal.target = Math.max(6, goal.target * 2);
        goal.title = `반복 서빙 ${goal.target}회`;
        goal.serveBaseline = (weekly ? m._weekServe : m._serveToday) || 0;
        goal.carried = current;
      }
    }
}
startNewWeek = function () {
  const m = state.missions;
  m.weekStartAt = Date.now();
  m.weekEndAt = Date.now() + 7 * 86400000;
  m.weeklyStamps = 0;
  m.weeklyCompletedAt = 0;
  m.weeklyList = missionList(true);
  missionBaselines(true);
  Object.assign(state.cert, {
    issuedThisWeek: false,
    issuedAt: 0,
    validUntil: 0,
    usedAt: 0,
  });
  _saveDirty = true;
};
ensureMissionReset = function () {
  const m = state.missions;
  const end = m.weeklyCompletedAt
    ? state.cert.validUntil || m.weekEndAt
    : m.weekEndAt;
  if (!m.weekStartAt || (end && Date.now() >= end)) startNewWeek();
  if (m.dailyKey !== dayKey()) {
    m.dailyKey = dayKey();
    m.dailyList = missionList(false);
    m.dailyCompletedToday = false;
    m.dailyStamps = 0;
    missionBaselines(false);
    state.todaySales = 0;
    state.offlineSalesToday = 0;
    _saveDirty = true;
  }
  if (!Number.isFinite(m._serveToday)) {
    m._serveToday = Math.max(
      0,
      ...m.dailyList
        .filter((g) => g.type === "serve" && !g.originalType)
        .map((g) => g.current || 0),
    );
  }
  repairMissionGoals();
};
onServeOneOnline = function () {
  state.missions._serveToday = (state.missions._serveToday || 0) + 1;
  state.missions._weekServe = (state.missions._weekServe || 0) + 1;
  updateMissionsOnlineOnly();
};
updateMissionsOnlineOnly = function () {
  ensureMissionReset();
  const m = state.missions;
  function update(weekly) {
    for (const goal of m[weekly ? "weeklyList" : "dailyList"]) {
      if (goal.done) continue;
      let value = goal.current || 0;
      const prefix = weekly ? "_weekStart" : "_dayStart";
      if (goal.type === "serve")
        value =
          (goal.carried || 0) +
          Math.max(
            0,
            ((weekly ? m._weekServe : m._serveToday) || 0) -
              (goal.serveBaseline || 0),
          );
      if (goal.type === "stamp") value = m.weeklyStamps || 0;
      if (goal.type === "earn") value = state.todaySales;
      if (goal.type === "sales")
        value = state.totalSales - (m._weekStartTotalSales || 0);
      if (goal.type === "rep")
        value = state.rep >= (weekly ? 4.4 : 4.2) ? 1 : 0;
      if (goal.type === "tip") value = (weekly ? m._weekTip : m._tipToday) || 0;
      if (goal.type === "upg")
        value = (weekly ? m._weekUpgBuys : m._upgBuysToday) || 0;
      if (goal.type === "menu")
        value =
          (state.menuStats[goal.menuId || MENUS[0].id]?.count || 0) -
          (m[prefix + "MenuCounts"]?.[goal.menuId || MENUS[0].id] || 0);
      if (goal.type === "sign")
        value = (state.upgrades.signboard || 0) - (m[prefix + "Sign"] || 0);
      if (goal.type === "expand")
        value = (state.upgrades.expand || 0) - (m[prefix + "Expand"] || 0);
      goal.current = Math.max(goal.current || 0, 0, value);
      goal.done = goal.current >= goal.target;
    }
  }
  update(false);
  m.dailyStamps = m.dailyList.filter((g) => g.done).length;
  if (
    m.dailyList.length &&
    m.dailyList.every((g) => g.done) &&
    !m.dailyCompletedToday
  ) {
    const previous = {
      missions: structuredClone(m),
      coupons: { ...state.coupons },
      benefitsLog: structuredClone(state.benefitsLog),
    };
    m.dailyCompletedToday = true;
    state.coupons.veg++;
    m.weeklyStamps = Math.min(7, (m.weeklyStamps || 0) + 1);
    logBenefit({ type: "veg", source: "daily", note: "일간 올클" });
    _saveDirty = true;
    if (!save(true)) {
      Object.assign(state, previous);
      BranchManager.saveCurrent();
      return;
    }
  }
  update(true);
  if (
    m.weeklyList.length &&
    m.weeklyList.every((g) => g.done) &&
    !m.weeklyCompletedAt
  ) {
    m.weeklyCompletedAt = Date.now();
    _saveDirty = true;
    save(true);
  }
};
const legacyCertificate = generateWeeklyCertificate;
generateWeeklyCertificate = function () {
  ensureMissionReset();
  if (state.cert.issuedThisWeek) return legacyCertificate();
  if (!certStatusText().okIssue) return;
  const previous = {
    cert: { ...state.cert },
    coupons: { ...state.coupons },
    benefitsLog: structuredClone(state.benefitsLog),
  };
  Object.assign(state.cert, {
    issuedThisWeek: true,
    issuedAt: Date.now(),
    validUntil: Date.now() + 7 * 86400000,
  });
  state.coupons.drink++;
  logBenefit({ type: "drink", source: "weekly_cert", note: "주간 인증서" });
  _saveDirty = true;
  if (!save(true)) {
    Object.assign(state, previous);
    BranchManager.saveCurrent();
    showToast("저장 실패. 다시 발급해 주세요.");
    return;
  }
  return legacyCertificate();
};
