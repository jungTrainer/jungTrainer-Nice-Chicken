/* IMP-11: optional branch decisions and stories. Reading never allocates rewards. */
const MANAGEMENT_FOCUS = [
  {
    id: "balanced",
    label: "균형 운영",
    description: "현재 속도와 정산을 유지합니다.",
    effect: {},
  },
  {
    id: "service",
    label: "매장 중심",
    description: "자동 서빙 +4% · 배달/온라인 수익 -4%",
    effect: {
      autoServeMul: 0.04,
      deliveryEarningMul: -0.04,
      onlineEarningMul: -0.04,
    },
  },
  {
    id: "dispatch",
    label: "포장 중심",
    description: "배달/온라인 수익 +4% · 자동 서빙 -4%",
    effect: {
      deliveryEarningMul: 0.04,
      onlineEarningMul: 0.04,
      autoServeMul: -0.04,
    },
  },
];
const STAFF_ROLES = {
  neighbor: {
    label: "서빙 조율",
    description: "직원 자동 서빙 속도 +4%",
    effect: { staffSpeedMul: 0.04 },
    story:
      "남편은 주문표를 나란히 놓았다. 빠른 손보다 서로의 순서를 아는 일이 먼저였다.",
  },
  ato: {
    label: "배달 길잡이",
    description: "배달 빈도 +4%",
    effect: { deliveryFreqMul: 0.04 },
    story:
      "아토가 골목 입구에 앉았다. 가족은 그곳에서 배달 가방과 오늘의 안부를 함께 건넸다.",
  },
  daughter1: {
    label: "온라인 창구",
    description: "온라인 주문 빈도 +4%",
    effect: { onlineFreqMul: 0.04 },
    story:
      "첫째딸은 휴대폰을 내려놓지 않았다. 이번에는 손님이 기다리는 답장을 쓰고 있었다.",
  },
  daughter2: {
    label: "대기 안내",
    description: "새 손님 인내 시간 +1초",
    effect: { patienceAfterAdd: 1 },
    story:
      "둘째딸은 기다리는 손님에게 이름을 물었다. 번호가 아닌 이름으로 불리자 표정이 누그러졌다.",
  },
  soninlaw: {
    label: "포장 품질",
    description: "배달 수익 +4%",
    effect: { deliveryEarningMul: 0.04 },
    story:
      "사위는 포장끈을 다시 묶었다. 먼 길에서도 처음의 온기를 전하고 싶었다.",
  },
  grandson: {
    label: "메뉴 기록",
    description: "전체 메뉴 수익 +2%",
    effect: { earningMul: 0.02 },
    story:
      "손주는 할머니 옆에서 메뉴 이름을 적었다. 숫자 사이에는 가족이 함께 보낸 날들이 남았다.",
  },
};
const REGION_CONTENT = {
  changnyeong: {
    title: "골목에서 시작한 한 끼",
    arrival:
      "할머니가 첫 간판을 닦았다. 작은 창녕 골목에서 오늘의 손님 한 명을 기억하는 가게가 시작됐다.",
    growth:
      "단골이 친구를 데려왔다. 간판은 그대로였지만 가족이 함께 지켜 온 식탁은 조금 더 넓어졌다.",
    service: "동네 단골 식당",
    dispatch: "골목 포장 창구",
  },
  busan: {
    title: "파도 소리와 저녁 주문",
    arrival:
      "바다에서 돌아온 손님이 저녁을 찾았다. 부산 지점은 여행의 마지막 한 끼를 맡게 됐다.",
    growth:
      "관광객이 떠난 뒤에도 이웃은 남았다. 가족은 창가의 자리와 포장 가방 사이에서 부산의 하루를 배웠다.",
    service: "해변 저녁 식탁",
    dispatch: "숙소 포장 주문",
  },
  seoul: {
    title: "늦은 퇴근길의 불빛",
    arrival:
      "서울의 불은 쉽게 꺼지지 않았다. 가족은 바쁜 손님에게 짧은 휴식 한 끼를 건네기로 했다.",
    growth:
      "점심 손님과 야근 손님이 서로 다른 시간에 찾아왔다. 가게는 빠른 주문과 편한 자리 중 무엇을 먼저 챙길지 배웠다.",
    service: "퇴근길 쉼터",
    dispatch: "사무실 포장 주문",
  },
  japan: {
    title: "낯선 거리, 익숙한 온기",
    arrival:
      "도쿄의 낯선 간판 사이에 가족의 메뉴가 걸렸다. 말이 달라도 정성껏 건넨 한 끼는 알아볼 수 있었다.",
    growth:
      "손님이 메뉴 이름을 천천히 따라 읽었다. 가족은 익숙한 맛을 지키면서 새로운 동네의 속도에 귀를 기울였다.",
    service: "거리의 작은 식당",
    dispatch: "기차역 포장 주문",
  },
  usa: {
    title: "서로 다른 하루가 만나는 곳",
    arrival:
      "뉴욕에서는 각자의 점심시간이 달랐다. 가족은 다양한 하루가 만나는 작은 식탁을 펼쳤다.",
    growth:
      "서로 다른 언어로 같은 메뉴를 주문했다. 가족은 더 크게 외치는 대신 정확히 듣고 포장하는 방법을 배웠다.",
    service: "이웃의 점심 식탁",
    dispatch: "도심 포장 주문",
  },
  mars: {
    title: "붉은 별의 식탁",
    arrival:
      "화성 기지의 문이 열렸다. 먼 별에서도 가족이 가장 먼저 꺼낸 것은 계산기가 아닌 식탁이었다.",
    growth:
      "기지의 긴 하루가 끝나면 사람들이 모였다. 가장 먼 지점까지 왔어도 서로를 기다리는 마음은 창녕의 골목과 같았다.",
    service: "기지 공동 식탁",
    dispatch: "탐사팀 포장 주문",
  },
};

function defaultManagement() {
  return {
    focus: "balanced",
    leadStaff: null,
    menuPolicy: "all",
    featuredMenu: "fried",
    readStories: [],
  };
}
function normalizeManagement(value, upgrades = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = { ...defaultManagement(), ...source };
  if (!MANAGEMENT_FOCUS.some((x) => x.id === result.focus))
    result.focus = "balanced";
  if (!Object.hasOwn(STAFF_ROLES, result.leadStaff)) result.leadStaff = null;
  const open = MENUS.slice(
    0,
    clampInt(1 + (upgrades.menuUnlock || 0), 1, MENUS.length),
  );
  if (!open.some((m) => m.id === result.featuredMenu))
    result.featuredMenu = open[0].id;
  if (
    !["all", "signature"].includes(result.menuPolicy) ||
    !open.some((m) => m.id === source.featuredMenu)
  )
    result.menuPolicy = "all";
  result.readStories = [
    ...new Set(
      (Array.isArray(source.readStories) ? source.readStories : []).filter(
        (id) => typeof id === "string" && id.length <= 80,
      ),
    ),
  ];
  return result;
}
function ensureManagementState() {
  const normalize = (data) => {
    const previous = data.management;
    const next = normalizeManagement(previous, data.upgrades);
    const changed =
      !previous ||
      next.focus !== previous.focus ||
      next.leadStaff !== previous.leadStaff ||
      next.menuPolicy !== previous.menuPolicy ||
      next.featuredMenu !== previous.featuredMenu ||
      !Array.isArray(previous.readStories) ||
      next.readStories.length !== previous.readStories.length ||
      next.readStories.some((id, i) => id !== previous.readStories[i]);
    data.management = next;
    return changed;
  };
  let changed = normalize(state);
  for (const branch of Object.values(state.branches || {}))
    if (branch?.data && typeof branch.data === "object")
      changed = normalize(branch.data) || changed;
  if (changed) markStateChanged("management-migration");
}
function getManagementEffects() {
  const management = state.management || defaultManagement();
  const focus =
    MANAGEMENT_FOCUS.find((x) => x.id === management.focus) ||
    MANAGEMENT_FOCUS[0];
  const effect = { ...focus.effect };
  const hired = STAFF_POOL.slice(0, getStaffCount()).some(
    (s) => s.key === management.leadStaff,
  );
  if (hired)
    for (const [key, value] of Object.entries(
      STAFF_ROLES[management.leadStaff]?.effect || {},
    ))
      effect[key] =
        key === "patienceAfterAdd"
          ? (effect[key] || 0) + value
          : (1 + (effect[key] || 0)) * (1 + value) - 1;
  return effect;
}
function getOrderMenuPool(management = state.management) {
  const open = MENUS.slice(0, clampInt(getOpenMenuCount(), 1, MENUS.length));
  if (management?.menuPolicy === "signature") {
    const selected = open.find((m) => m.id === management.featuredMenu);
    if (selected) return [selected];
  }
  return open;
}
function getMenuOfferSummary() {
  const eff = sumEffects(),
    all = MENUS.slice(0, clampInt(getOpenMenuCount(), 1, MENUS.length));
  const prices = all.map((m) => ({
    ...m,
    settledPrice: getMenuPrice(m.id, eff),
  }));
  const pool = getOrderMenuPool();
  const mean = (rows) =>
    moneyValue(
      rows.reduce((sum, m) => sum + moneyInt(m.settledPrice), 0n) /
        BigInt(rows.length),
    );
  return {
    prices,
    average: mean(prices.filter((m) => pool.some((p) => p.id === m.id))),
    allAverage: mean(prices),
    best: prices.reduce((best, m) =>
      moneyCompare(m.settledPrice, best.settledPrice) > 0 ? m : best,
    ),
  };
}
function getBranchStories() {
  const region = REGION_CONTENT[state.regionId] || REGION_CONTENT.changnyeong;
  return [
    {
      id: "arrival",
      title: region.title,
      requirement: "지점에 도착",
      unlocked: true,
      text: region.arrival,
    },
    {
      id: "family",
      title: "가족의 첫 근무",
      requirement: "직원 1명 고용",
      unlocked: getStaffCount() >= 1,
      text: "첫 직원이 앞치마를 둘렀다. 혼자 벌던 숫자보다 함께 문을 여는 아침이 더 든든했다.",
    },
    {
      id: "recipe",
      title: "우리 가게의 대표 메뉴",
      requirement: "메뉴 2종 해금",
      unlocked: getOpenMenuCount() >= 2,
      text: "새 메뉴를 적기 전에 가족은 물었다. 모두를 고르게 소개할까, 자신 있는 한 접시를 먼저 내놓을까? 대표 메뉴는 다음 주문부터 선택할 수 있다.",
    },
    {
      id: "research",
      title: "작은 배움의 기록",
      requirement: "연구 1단계 완료",
      unlocked: Object.values(state.research.levels || {}).some(
        (lv) => lv >= 1,
      ),
      text: "연구 노트에 첫 줄이 생겼다. 같은 일을 반복하더라도 어제와 다른 방법을 함께 찾아보기로 했다.",
    },
    {
      id: "growth",
      title: "이 동네의 하루",
      requirement: "현재 지점 Lv.10",
      unlocked: state.level >= 10,
      text: region.growth,
    },
    {
      id: "team",
      title: "여섯 자리의 식탁",
      requirement: "직원 6명 고용",
      unlocked: getStaffCount() === STAFF_POOL.length,
      text: "여섯 식구가 일을 마치고 둘러앉았다. 담당자는 한 명이지만 모든 직원의 서빙과 교육은 계속된다. 서로 다른 역할이 같은 식탁을 지킨다.",
    },
    {
      id: "ending",
      title: "다시 문을 여는 가족",
      requirement: "엔딩 감상 완료",
      unlocked: state.endingSeen === true,
      text: "이야기가 끝나도 가게의 하루는 이어졌다. 새로운 손님에게 전할 온기를 준비하며 가족은 다시 문을 열었다.",
    },
  ];
}
function commitManagementChange(next, effectsChanged = true) {
  if (!SessionOwner.canMutate()) return false;
  const previous = state.management,
    lastSeen = state.lastSeenAt,
    dirty = _saveDirty;
  state.management = next;
  markStateChanged("management-choice", effectsChanged);
  if (!save(true)) {
    state.management = previous;
    state.lastSeenAt = lastSeen;
    BranchManager.saveCurrent();
    invalidateDerivedEffects();
    _saveDirty = dirty;
    showToast("저장 실패. 이전 운영 선택을 유지합니다.");
    renderManagementContent();
    return false;
  }
  updateUI();
  renderManagementContent();
  return true;
}
function chooseManagement(kind, value) {
  if (!SessionOwner.canMutate()) return false;
  if (!["focus", "leadStaff", "menu"].includes(kind)) return false;
  const next = structuredClone(state.management || defaultManagement());
  if (kind === "focus") {
    if (!MANAGEMENT_FOCUS.some((f) => f.id === value)) return false;
    if (next.focus === value) return true;
    next.focus = value;
  } else if (kind === "leadStaff") {
    if (value !== "none" && !getHiredStaff().some((s) => s.key === value))
      return false;
    const key = value === "none" ? null : value;
    if (next.leadStaff === key) return true;
    next.leadStaff = key;
  } else {
    if (
      value !== "all" &&
      !MENUS.slice(0, getOpenMenuCount()).some((m) => m.id === value)
    )
      return false;
    if (value === "all") {
      if (next.menuPolicy === "all") return true;
      next.menuPolicy = "all";
    } else {
      if (next.menuPolicy === "signature" && next.featuredMenu === value)
        return true;
      next.menuPolicy = "signature";
      next.featuredMenu = value;
    }
  }
  return commitManagementChange(next);
}
function readBranchStory(id) {
  if (!SessionOwner.canMutate()) return false;
  const story = getBranchStories().find((s) => s.id === id);
  if (!story?.unlocked) return false;
  const previous = state.management || defaultManagement();
  if (previous.readStories.includes(id)) return true;
  return commitManagementChange(
    { ...previous, readStories: [...previous.readStories, id] },
    false,
  );
}

let managementRenderOwner = null,
  managementRenderKey = "";
function renderManagementContent() {
  const root = document.getElementById("managementContent");
  if (
    !root ||
    !document.getElementById("modalStats")?.classList.contains("on") ||
    !document
      .getElementById("tab-stat-management")
      ?.classList.contains("active")
  )
    return;
  const active = document.activeElement;
  const focusKey = root.contains(active)
    ? [active.dataset.managementKind, active.dataset.managementValue]
    : null;
  const management = state.management || defaultManagement(),
    region = REGION_CONTENT[state.regionId];
  const summary = getMenuOfferSummary(),
    rates = computeRates(),
    storyEntries = getBranchStories();
  const renderKey = JSON.stringify([
    state.regionId,
    management.focus,
    management.leadStaff,
    management.menuPolicy,
    management.featuredMenu,
    management.readStories,
    getStaffCount(),
    STAFF_POOL.map((s) => s.label),
    summary.prices.map((m) => [m.id, m.settledPrice]),
    rates.autoServesPerMin,
    rates.ordersPerMin,
    rates.onlineOrdersPerMin,
    storyEntries.map((s) => [s.id, s.unlocked]),
  ]);
  if (
    managementRenderOwner === state &&
    managementRenderKey === renderKey &&
    root.childElementCount
  )
    return;
  managementRenderOwner = state;
  managementRenderKey = renderKey;
  const scroll = root.closest(".scroll"),
    previousScroll = scroll?.scrollTop || 0;
  root.replaceChildren();
  const card = (title) => {
    const section = document.createElement("section");
    section.className = "management-card";
    const heading = document.createElement("h4");
    heading.textContent = title;
    section.append(heading);
    root.append(section);
    return section;
  };
  const text = (section, message) => {
    const p = document.createElement("p");
    p.textContent = message;
    section.append(p);
    return p;
  };
  const button = (
    section,
    kind,
    value,
    label,
    selected = false,
    disabled = false,
  ) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "management-choice";
    b.dataset.managementKind = kind;
    b.dataset.managementValue = value;
    b.textContent = label;
    b.disabled = disabled;
    b.setAttribute("aria-pressed", String(selected));
    section.append(b);
    return b;
  };
  const intro = card(getRegion().name + " · 운영과 이야기");
  text(
    intro,
    "선택은 이 지점에 저장됩니다. 선택·이야기 확인에는 비용이나 쿠폰 보상이 없습니다.",
  );
  text(
    intro,
    "진행 중 손님의 주문과 확정 미수령은 유지합니다. 자동 담당자를 바꿔도 여섯 직원은 기존 순서대로 서빙합니다.",
  );
  const direction = card("지점 운영 방향");
  for (const focus of MANAGEMENT_FOCUS) {
    const label =
      focus.id === "service"
        ? region.service
        : focus.id === "dispatch"
          ? region.dispatch
          : focus.label;
    button(
      direction,
      "focus",
      focus.id,
      label + " · " + focus.description,
      management.focus === focus.id,
    );
  }
  const rateText = text(
    direction,
    `자동 서빙 능력 ${(rates.autoServesPerMin * 2).toFixed(2)}건/분 · 방문 ${rates.ordersPerMin.toFixed(2)}건/분 · 온라인 ${rates.onlineOrdersPerMin.toFixed(2)}건/분`,
  );
  rateText.id = "managementRates";
  text(
    direction,
    "표시된 능력은 연구·운영·담당자를 반영합니다. 실제 서빙은 손님 유입/이벤트에, 배달 빈도는 최소 0.6초 간격에 제한됩니다.",
  );
  const menu = card("새 주문의 메뉴 선택");
  text(
    menu,
    "방문·배달·온라인·새 오프라인 추정에 같은 선택을 사용합니다. 메뉴를 해금하면 전체 주문의 평균 가격이 낮아질 수 있습니다. 대표 메뉴로 기존 가격을 유지하거나 높은 메뉴를 소개할 수 있습니다.",
  );
  const avg = text(
    menu,
    `현재 평균 기본 가격: ${fmtWon(summary.average)} · 전체 메뉴 평균: ${fmtWon(summary.allAverage)} (팁·채널 보너스 제외, 원 미만 내림)`,
  );
  avg.id = "managementMenuAverage";
  avg.dataset.amount = summary.average;
  avg.title = moneyExactText(summary.average) + "원";
  button(
    menu,
    "menu",
    "all",
    "전체 해금 메뉴 · 동일 확률",
    management.menuPolicy === "all",
  );
  for (const m of summary.prices) {
    const b = button(
      menu,
      "menu",
      m.id,
      `${m.emoji} ${m.name}만 운영 · ${fmtWon(m.settledPrice)}`,
      management.menuPolicy === "signature" && management.featuredMenu === m.id,
    );
    b.dataset.price = m.settledPrice;
    b.title = moneyExactText(m.settledPrice) + "원";
  }
  text(
    menu,
    "메뉴 지정 미션은 그 메뉴를 판매해야 합니다. 다른 메뉴 미션을 진행하려면 전체 운영이나 해당 대표 메뉴를 선택하세요.",
  );
  const staff = card("이 지점의 담당자 한 명");
  text(
    staff,
    "특기는 선택한 한 명만 적용합니다. 직원별 교육·기본 속도·팁은 기존처럼 모두 적용합니다.",
  );
  button(
    staff,
    "leadStaff",
    "none",
    "담당자 없음 · 기존 효과 유지",
    management.leadStaff === null,
  );
  for (const s of STAFF_POOL) {
    const role = STAFF_ROLES[s.key],
      hired = getHiredStaff().some((x) => x.key === s.key);
    button(
      staff,
      "leadStaff",
      s.key,
      `${s.emoji} ${s.label} · ${role.label} · ${role.description}${hired ? "" : " (현재 지점 고용 필요)"}`,
      management.leadStaff === s.key,
      !hired,
    );
    if (hired) text(staff, role.story);
  }
  const stories = card(
    "이 지점의 성장 이야기 · 읽기는 보상을 지급하지 않습니다",
  );
  for (const story of storyEntries) {
    const section = document.createElement("article");
    section.className = "management-story";
    stories.append(section);
    text(section, story.title + " · " + story.requirement);
    if (story.unlocked) text(section, story.text);
    else text(section, "성장 조건을 달성하면 열립니다.");
    const read = management.readStories.includes(story.id);
    button(
      section,
      "story",
      story.id,
      read ? "읽음" : story.unlocked ? "읽음 표시" : "아직 잠김",
      read,
      read || !story.unlocked,
    );
  }
  if (scroll) scroll.scrollTop = previousScroll;
  if (focusKey) {
    const target =
      [...root.querySelectorAll("button")].find(
        (b) =>
          b.dataset.managementKind === focusKey[0] &&
          b.dataset.managementValue === focusKey[1] &&
          !b.disabled,
      ) || document.querySelector('[data-tab="stat-management"]');
    target?.focus({ preventScroll: true });
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.(
    "#managementContent button[data-management-kind]",
  );
  if (!button || button.disabled || event.defaultPrevented) return;
  if (button.dataset.managementKind === "story")
    readBranchStory(button.dataset.managementValue);
  else
    chooseManagement(
      button.dataset.managementKind,
      button.dataset.managementValue,
    );
});

// HQ narrative archive. Viewing never grants money, coupons or the family ending effect.
const Campaign = {
  activeStory: null,
  uiRows: null,
  rules(mode = state.campaign?.mode || "legacy") {
    const rules = CAMPAIGN_MODES[mode] || CAMPAIGN_MODES.legacy;
    return { ...rules, ending: rules.ending || ENDING_MONEY };
  },
  sales(id) {
    const data = id === state.regionId ? state : state.branches?.[id]?.data;
    return moneyAdd(data?.totalSales || 0, data?.offlineSalesTotal || 0);
  },
  // Presentation only: never unlock, normalize, dirty or save on a view.
  regionSummary(id) {
    const index = REGIONS.findIndex(region => region.id === id);
    const record = state.campaign.regions[id], rules = this.rules();
    const sales = this.sales(id), goal = record?.goalAtUnlock || rules.goals?.[index];
    const opened = !!state.regionUnlocked[id], cost = getRegionUnlockCost(id);
    const previous = REGIONS[index - 1];
    const requirements = previous
      ? `${previous.name} 지점 오픈${state.campaign.mode === "legacy" ? "" : " + 지역 이야기 해금"} · 보유금 ${fmtWon(cost)} 필요`
      : "첫 지점입니다.";
    const shortage = moneyMax(0, moneySub(cost, state.money));
    return {
      goal, ratio: goal ? moneyRatio(sales, goal) : 0,
      progress: `기록 매출 ${fmtWon(sales)}${goal ? ` / 목표 ${fmtWon(goal)}` : " (기존 운영: 지역 목표 없음)"}`,
      ending: record?.unlockedAt
        ? `지역 엔딩: ${record.badgeAwarded ? "기념 완료 · 다시보기 가능" : "해금 · 설정에서 이야기 보기"}`
        : goal
          ? `지역 엔딩: ${opened ? "이 지점의" : "지점 오픈 후 이 지점의"} 기록 매출 ${fmtWon(goal)} 달성`
          : "지역 엔딩: 설정에서 이지/노말을 명시적으로 선택하면 시작",
      unlock: opened ? "지점 오픈 완료 · 해금 비용 재지급 없음"
        : `해금 비용 ${fmtWon(cost)} · ${requirements} · ${this.canUnlockRegion(id) ? "이전 지역 조건 충족" : "이전 지역 조건 미충족"} · ${moneyCompare(shortage, 0) > 0 ? `보유금 ${fmtWon(shortage)} 부족` : "보유금 충족"}`,
    };
  },
  familySummary() {
    const count = REGIONS.filter(region => state.campaign.regions[region.id]?.unlockedAt).length;
    return `가족 목표: 보유금 ${fmtWon(state.money)} / ${fmtWon(this.rules().ending)}${state.campaign.mode === "legacy" ? " (기존 운영)" : ` · 지역 이야기 해금 ${count}/6 필요`}${state.endingUnlocked ? " · 가족 엔딩 해금 완료" : ""}`;
  },
  updateUnlocks() {
    if (!SessionOwner.canMutate() || state.campaign.mode === "legacy") return false;
    let changed = false;
    const goals = this.rules().goals;
    REGIONS.forEach((region, index) => {
      if (!state.regionUnlocked[region.id] || state.campaign.regions[region.id]?.unlockedAt) return;
      if (moneyCompare(this.sales(region.id), goals[index]) < 0) return;
      state.campaign.regions[region.id] = {
        ...state.campaign.regions[region.id], unlockedAt: Date.now(), seenAt: 0, badgeAwarded: false,
        modeAtUnlock: state.campaign.mode, goalAtUnlock: goals[index],
      };
      changed = true;
    });
    return changed;
  },
  check() {
    if (this.updateUnlocks()) markStateChanged("regional-ending-unlock", false);
  },
  canUnlockRegion(id) {
    const index = REGIONS.findIndex(region => region.id === id);
    if (index <= 0 || !state.regionUnlocked[REGIONS[index - 1].id]) return false;
    return state.campaign?.mode === "legacy" || !!state.campaign.regions[REGIONS[index - 1].id]?.unlockedAt;
  },
  familyReady() {
    return state.campaign?.mode === "legacy" || REGIONS.every(region => state.campaign.regions[region.id]?.unlockedAt);
  },
  choose(mode) {
    if (!SessionOwner.canMutate() || !Object.hasOwn(CAMPAIGN_MODES, mode) || mode === state.campaign.mode) return false;
    if (PwaRuntime.applying || SaveRecovery.busy || endingPhase !== "idle" ||
        endingEls().popup.style.display === "flex" || pinResolver ||
        document.querySelector(".dim.on:not(#modalSettings),.panel.on")) {
      showToast("입력/이야기/미수령 창을 닫은 뒤 모드를 선택해 주세요. 닫기는 수령이 아닙니다."); return false;
    }
    if (!confirm(`${CAMPAIGN_MODES[mode].label}로 이어갈까요?\n진행/지점/미수령/쿠폰/지급 이력은 유지합니다. 미래 지점 비용과 이야기/가족 엔딩 목표만 바뀝니다.\n실물 발급 한도는 바꾸지 않으며 기존 5,000만원 교환은 유지됩니다.`)) return false;
    const previous = structuredClone(state.campaign), dirty = _saveDirty, lastSeenAt = state.lastSeenAt;
    state.campaign = { ...state.campaign, mode, selectedAt: Date.now() };
    this.updateUnlocks();
    markStateChanged("campaign-mode", false);
    if (!save(true)) {
      state.campaign = previous; state.lastSeenAt = lastSeenAt; _saveDirty = dirty;
      BranchManager.saveCurrent(); this.render();
      showToast("저장 실패. 기존 모드와 진행을 유지합니다."); return false;
    }
    updateUI(); renderMapUI(); this.render();
    showToast(`${this.rules().label}로 이어갑니다. 새 돈/실물 쿠폰을 지급하지 않습니다.`);
    document.getElementById("campaignStatus")?.focus();
    return true;
  },
  showRegion(id) {
    if (!SessionOwner.canMutate() || !REGION_MAP[id] || !state.campaign.regions[id]?.unlockedAt) return false;
    if (PwaRuntime.applying || endingPhase !== "idle" || endingEls().popup.style.display === "flex" ||
        pinResolver || document.querySelector(".dim.on:not(#modalSettings),.panel.on")) return false;
    this.activeStory = { id, token: SessionOwner.token() };
    const region = REGION_MAP[id], story = REGION_CONTENT[id];
    document.getElementById("regionEndingTitle").textContent = `${region.name} · 지역 엔딩`;
    document.getElementById("regionEndingText").textContent = `${story.arrival}\n\n${story.growth}\n\n${REGION_ENDINGS[id]}`;
    document.getElementById("regionEndingReward").textContent = state.campaign.regions[id].badgeAwarded
      ? "기념 칭호 기록 완료. 재생으로 추가 효과/실물 쿠폰을 지급하지 않습니다."
      : "끝까지 읽고 완료를 기록하면 지역 기념 칭호를 한 번 보관합니다. 돈/실물 쿠폰 보상은 없습니다.";
    document.getElementById("completeRegionEnding").textContent = state.campaign.regions[id].seenAt ? "다시보기 닫기" : "읽음 · 기념 완료 저장";
    document.getElementById("modalRegionEnding").classList.add("on");
    return true;
  },
  complete() {
    const view = this.activeStory;
    if (!view || !document.getElementById("modalRegionEnding").classList.contains("on") || !SessionOwner.matches(view.token)) return false;
    const record = state.campaign.regions[view.id];
    if (!record?.unlockedAt) return false;
    if (!record.seenAt) {
      const previous = structuredClone(record), dirty = _saveDirty, lastSeenAt = state.lastSeenAt;
      record.seenAt = Date.now(); record.badgeAwarded = true;
      markStateChanged("regional-ending-complete", false);
      if (!save(true)) {
        state.campaign.regions[view.id] = previous; state.lastSeenAt = lastSeenAt; _saveDirty = dirty;
        BranchManager.saveCurrent(); showToast("저장 실패. 완료/칭호를 기록하지 않았습니다. 다시 시도해 주세요."); return false;
      }
    }
    this.close(); this.render(); return true;
  },
  close() {
    document.getElementById("modalRegionEnding")?.classList.remove("on");
    this.activeStory = null;
  },
  restore() { this.close(); },
  render() {
    const status = document.getElementById("campaignStatus");
    if (!status) return;
    const rules = this.rules(), count = REGIONS.filter(r => state.campaign.regions[r.id]?.badgeAwarded).length;
    const text = `${rules.label} · 지역 기념 ${count}/6 · ${this.familySummary()}\n기존 기록/미수령/paid는 보존됩니다. 모드는 게임 성장용이며 실물 서비스 한도를 바꾸지 않습니다.`;
    if (status.textContent !== text) status.textContent = text;
    for (const mode of Object.keys(CAMPAIGN_MODES)) {
      const button = document.getElementById("chooseMode-" + mode), disabled = mode === state.campaign.mode;
      if (button.disabled !== disabled) button.disabled = disabled;
    }
    if (!document.getElementById("modalSettings").classList.contains("on")) return;
    if (!this.uiRows) {
      const list = document.getElementById("campaignRegions");
      this.uiRows = REGIONS.map(region => {
        const card = document.createElement("div"); card.className = "card";
        const info = document.createElement("div"); info.className = "info";
        const title = document.createElement("h4"); title.textContent = region.name;
        const p = document.createElement("p"); const button = document.createElement("button");
        button.className = "btn alt"; button.type = "button"; button.dataset.campaignRegion = region.id;
        info.append(title, p); card.append(info, button); list.append(card);
        return { p, button };
      });
    }
    REGIONS.forEach((region, i) => {
      const record = state.campaign.regions[region.id], summary = this.regionSummary(region.id);
      const label = `${summary.progress}\n${summary.ending}\n${summary.unlock}`;
      const row = this.uiRows[i]; if (row.p.textContent !== label) row.p.textContent = label;
      const disabled = !record?.unlockedAt;
      if (row.button.disabled !== disabled) row.button.disabled = disabled;
      const btnText = !record?.unlockedAt ? "이야기 잠김" : record?.seenAt ? "다시보기" : "이야기 보기";
      if (row.button.textContent !== btnText) row.button.textContent = btnText;
    });
  },
};
