function missionList(weekly, { legacy = false } = {}) {
  if (!legacy) return RepeatMissions.list(weekly);
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
    m._weekActiveSec = 0;
    m._weekTip = 0;
    m._weekUpgBuys = 0;
    m._weekServe = 0;
    m._weekStartTotalSales = state.totalSales;
  } else {
    m._dayActiveSec = 0;
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
    STAFF_POOL.reduce(
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
        markStateChanged("mission-retarget", false);
        goal.originalType = goal.type;
        goal.type = "serve";
        goal.target = Math.max(6, goal.target * 2);
        goal.title = `반복 서빙 ${goal.target}회`;
        goal.serveBaseline = (weekly ? m._weekServe : m._serveToday) || 0;
        goal.carried = current;
      }
    }
}

function startNewWeek({ resetCertificate = true } = {}) {
  if (!SessionOwner.canMutate()) return false;
  const m = state.missions;
  m.weekStartAt = Date.now();
  m.weekEndAt = Date.now() + 7 * 86400000;
  m.weeklyStamps = 0;
  m.weeklyCompletedAt = 0;
  m.weeklyList = missionList(true);
  m.weeklyPolicy = 2;
  m.weeklyRewardPolicy = CouponPolicy.period(true);
  m.weeklyRewardPaid = false;
  missionBaselines(true);
  // Passive branch/week initialization must not revoke an HQ certificate.
  if (
    resetCertificate ||
    (state.cert.validUntil > 0 && Date.now() >= state.cert.validUntil)
  ) {
    Object.assign(state.cert, {
      issuedThisWeek: false,
      issuedAt: 0,
      validUntil: 0,
      usedAt: 0,
    });
  }
  markStateChanged("missions");
}

function ensureMissionReset() {
  if (!SessionOwner.canMutate()) return false;
  const m = state.missions;
  const end = m.weeklyCompletedAt
    ? state.cert.validUntil || m.weekEndAt
    : m.weekEndAt;
  if (!m.weekStartAt || (end && Date.now() >= end))
    startNewWeek({ resetCertificate: false });
  const dailyKey = CouponPolicy.period() === 2 ? CouponPolicy.day() : dayKey();
  if (m.dailyKey !== dailyKey) {
    m.dailyKey = dailyKey;
    m.dailyList = missionList(false);
    m.dailyPolicy = 2;
    m.dailyRewardPolicy = CouponPolicy.period();
    m.dailyCompletedToday = false;
    m.dailyStamps = 0;
    missionBaselines(false);
    state.todaySales = 0;
    state.offlineSalesToday = 0;
    markStateChanged("missions");
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
}

function onServeOneOnline(actorKey = "player") {
  if (!SessionOwner.canMutate()) return false;
  ensureMissionReset();
  markStateChanged("serve-mission", false);
  state.missions._serveToday = (state.missions._serveToday || 0) + 1;
  state.missions._weekServe = (state.missions._weekServe || 0) + 1;
  RepeatMissions.onServe(actorKey);
  updateMissionsOnlineOnly();
}

function updateMissionsOnlineOnly() {
  if (!SessionOwner.canMutate()) return false;
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
      if (goal.type === "service") value = (weekly ? m._weekServe : m._serveToday) || 0;
      if (goal.type === "active") value = (weekly ? m._weekActiveSec : m._dayActiveSec) || 0;
      if (goal.type === "orders" || (goal.type === "menu" && !goal.menuId))
        value = MENUS.reduce((n, item) => n + Math.max(0, (state.menuStats[item.id]?.count || 0) - (m[prefix + "MenuCounts"]?.[item.id] || 0)), 0);
      if (goal.type === "stamp") value = m.weeklyStamps || 0;
      if (goal.type === "earn") value = state.todaySales;
      if (goal.type === "sales")
        value = moneySub(state.totalSales, m._weekStartTotalSales || 0);
      if (goal.type === "rep")
        value = state.rep >= (weekly ? 4.4 : 4.2) ? 1 : 0;
      if (goal.type === "tip") value = (weekly ? m._weekTip : m._tipToday) || 0;
      if (goal.type === "upg")
        value = (weekly ? m._weekUpgBuys : m._upgBuysToday) || 0;
      if (goal.type === "menu" && goal.menuId)
        value =
          (state.menuStats[goal.menuId || MENUS[0].id]?.count || 0) -
          (m[prefix + "MenuCounts"]?.[goal.menuId || MENUS[0].id] || 0);
      if (goal.type === "sign")
        value = (state.upgrades.signboard || 0) - (m[prefix + "Sign"] || 0);
      if (goal.type === "expand")
        value = (state.upgrades.expand || 0) - (m[prefix + "Expand"] || 0);
      const previous = goal.current,
        previousDone = goal.done;
      goal.current = moneyMax(moneyMax(goal.current || 0, 0), value);
      goal.done = moneyCompare(goal.current, goal.target) >= 0;
      if (goal.current !== previous || goal.done !== previousDone)
        markStateChanged("mission-progress", false);
    }
  }
  update(false);
  m.dailyStamps = m.dailyList.filter((g) => g.done).length;
  if (
    m.dailyList.length &&
    m.dailyList.every((g) => g.done) &&
    !m.dailyCompletedToday
  ) {
    const committed = BenefitService.commit(() => {
      m.dailyCompletedToday = true;
      if (m.dailyRewardPolicy === 2) CouponPolicy.dailyReward();
      else {
        state.coupons.veg++;
        logBenefit({ type: "veg", source: "daily", note: "이행 전 일간 올클" });
      }
      m.weeklyStamps = Math.min(RepeatMissions.weeklyStampTarget(), (m.weeklyStamps || 0) + 1);
    });
    if (!committed) return;
  }
  update(true);
  if (
    m.weeklyList.length &&
    m.weeklyList.every((g) => g.done) &&
    (!m.weeklyCompletedAt || (m.weeklyRewardPolicy === 2 && !m.weeklyRewardPaid))
  ) {
    BenefitService.commit(() => {
      m.weeklyCompletedAt ||= Date.now();
      if (m.weeklyRewardPolicy === 2) {
        CouponPolicy.weeklyReward(m.weeklyCompletedAt);
        m.weeklyRewardPaid = true;
      }
    });
  }
}

function generateWeeklyCertificate() {
  if (!SessionOwner.canMutate()) return false;
  ensureMissionReset();
  if (state.cert.issuedThisWeek) return renderWeeklyCertificate();
  if (!certStatusText().okIssue) return;
  const committed = BenefitService.commit(() => {
    Object.assign(state.cert, {
      issuedThisWeek: true, issuedAt: Date.now(), validUntil: Date.now() + 7 * 86400000,
      rewardPolicy: state.missions.weeklyRewardPolicy || 1,
    });
    if (state.cert.rewardPolicy === 1) {
      state.coupons.drink++;
      logBenefit({ type: "drink", source: "weekly_cert", note: "이행 전 주간 인증서" });
    }
  });
  if (!committed) { showToast("저장 실패. 다시 발급해 주세요."); return; }
  return renderWeeklyCertificate();
}

function renderWeeklyCertificate() {
  const c = document.getElementById("shareCanvas");
  const x = c.getContext("2d");

  x.fillStyle = "#FF9F1C";
  x.fillRect(0, 0, 1080, 1920);
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
  if (uname) {
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
  const wStart = new Date(state.missions.weekStartAt).toLocaleDateString(
    "ko-KR",
  );
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
  for (const [k, v] of lines) {
    x.fillStyle = "#777";
    x.fillText(k, 160, y);
    x.fillStyle = "#222";
    x.fillText(v, 520, y);
    y += 78;
  }

  x.fillStyle = "#333";
  x.textAlign = "center";
  x.font = "34px sans-serif";
  x.fillText("※ 로컬 PIN 확인/기기 기록입니다. 서버·매장 인증이 아닙니다.", 540, 1710);

  const dataUrl = c.toDataURL("image/png");
  sharePreview.src = dataUrl;
  sharePreview.style.display = "block";
  downloadLink.href = dataUrl;
  downloadLink.download = `nicechicken_cert_${Date.now()}.png`;
  downloadLink.textContent = "이미지 다운로드";
  downloadLink.style.display = "inline-block";

  updateUI();
}

// v2 goals start at the next period; v1 snapshots remain untouched.
const RepeatMissions = {
  weeklyStampTarget() {
    // Stored period goals own the target, including earlier seven-clear v2 weeks.
    return state.missions.weeklyList.find(goal => goal.type === "stamp")?.target || 7;
  },
  list(weekly) {
    const types = weekly
      ? ["stamp", "sales", "rep", "tip", "menu", "service", "orders", "active"]
      : ["serve", "earn", "rep", "tip", "menu", "service", "orders", "active"];
    const targets = weekly ? [CONFIG.weeklyRepeatDailyClears, 900000, 1, 20, 30, 60, 60, 300] : [6, 40000, 1, 3, 2, 12, 6, 60];
    const labels = {
      stamp: "일간 올클", sales: "주간 매출", serve: "정확 서빙", earn: "오늘 매출",
      rep: weekly ? "평점 4.4 이상" : "평점 4.2 이상", tip: "팁 받기", menu: "현재 운영 메뉴 판매",
      service: "추가 서빙", orders: "전체 메뉴 판매", active: "접속 운영(초)",
    };
    return types.map((type, i) => ({ id: (weekly ? "w_" : "d_") + type, type, title: labels[type] + (type === "rep" ? "" : ` ${targets[i]}`), target: targets[i], current: 0, done: false }));
  },
  tick(dt) {
    if (!SessionOwner.canTick() || !Number.isFinite(dt) || dt <= 0) return;
    const m = state.missions;
    m._dayActiveSec = (m._dayActiveSec || 0) + dt;
    m._weekActiveSec = (m._weekActiveSec || 0) + dt;
    // tick's existing dirty marker owns persistence; never create another timer/save.
  },
  startChallenge() {
    if (!SessionOwner.canMutate()) return false;
    const m = state.missions, previous = m.visitChallenge;
    if (previous && !previous.completedAt && !confirm("진행 중인 게임 도전을 새로 시작할까요? 쿠폰/서비스 방문은 바뀌지 않습니다.")) return false;
    const dirty = _saveDirty;
    m.visitChallenge = { id: crypto.randomUUID(), startedAt: Date.now(), serves: 0, completedAt: 0 };
    markStateChanged("visit-challenge");
    if (!save(true)) {
      if (previous === undefined) delete m.visitChallenge; else m.visitChallenge = previous;
      BranchManager.saveCurrent(); _saveDirty = dirty;
      showToast("저장 실패. 이전 도전을 유지합니다."); return false;
    }
    this.render(); return true;
  },
  onServe(actorKey) {
    const c = state.missions.visitChallenge;
    if (!c || c.completedAt) return;
    c.serves = Math.min(5, c.serves + 1);
    if (c.serves === 5) c.completedAt = Date.now();
    markStateChanged("visit-challenge-progress", false);
  },
  render() {
    const host = document.getElementById("missionExtraStatus");
    if (!host || !document.getElementById("panel-mis")?.classList.contains("on")) return;
    const weeklyTarget = this.weeklyStampTarget();
    for (const node of document.querySelectorAll("[data-weekly-stamp-target]"))
      if (node.textContent !== String(weeklyTarget)) node.textContent = weeklyTarget;
    const stampRow = document.getElementById("weeklyStampRow");
    const columns = `repeat(${weeklyTarget}, 1fr)`;
    if (stampRow.style.gridTemplateColumns !== columns) stampRow.style.gridTemplateColumns = columns;
    for (const [id, goals] of [["dailyList", state.missions.dailyList], ["weeklyList", state.missions.weeklyList]]) {
      const rows = document.getElementById(id).children;
      goals.forEach((goal, index) => {
        const row = rows[index];
        if (!row) return;
        const refs = row._missionRefs || (row._missionRefs = {
          title: row.querySelector("h4"), progress: row.querySelector(".info p"), button: row.querySelector("button"),
        });
        const menu = goal.menuId && MENUS.find(item => item.id === goal.menuId);
        const progress = missionProgressLine(goal) + (menu ? ` · ${menu.name} 판매 (운영에서 전체/해당 대표 메뉴 선택)` : "");
        for (const [node, text] of [[refs.title, goal.title], [refs.progress, progress], [refs.button, goal.done ? "완료" : "진행중"]])
          if (node && node.textContent !== text) node.textContent = text;
      });
    }
    const c = state.missions.visitChallenge;
    const upgrades = state.upgrades;
    const achievements = [
      ["첫 가족 고용", (upgrades.hire || 0) >= 1],
      ["메뉴 2종 해금", getOpenMenuCount() >= 2],
      ["연구 첫 완료", Object.values(state.research.levels).some(x => x > 0)],
      ["첫 가게 확장", (upgrades.expand || 0) >= 1],
      ["가족 6명 고용", (upgrades.hire || 0) >= 6],
      ["가족 엔딩", state.endingSeen],
    ];
    const text = `짧은 방문 도전: ${c ? `${c.serves}/5회 정확 서빙(직접/자동) · ${c.completedAt ? "완료" : "진행 중"}` : "시작 버튼을 눌러 주세요"}\n게임 기념 표시만 제공합니다. 쿠폰 자동 발급/서비스 사용이 아닙니다.\n성장 업적(새 보상 없음): ${achievements.map(([label,done]) => `${done ? "✓" : "○"} ${label}`).join(" · ")}\n일간 v${state.missions.dailyPolicy || 1} / 주간 v${state.missions.weeklyPolicy || 1}. 기존 목표는 현재 기간까지 보존하며 다음 기간부터 반복 v2입니다.`;
    if (host.textContent !== text) host.textContent = text;
  },
};
