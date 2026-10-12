/* Whole won only. State/JSON use safe Numbers or canonical decimal strings;
   BigInt stays inside arithmetic. Never reconstruct income lost by old saves. */
const MONEY_ENCODING = "won-integer-v1";
const MONEY_MAX_DIGITS = 4096;
const MENU_RESEARCH_LIMIT = 10000;
const geometricMoneyCache = new Map();

function isMoney(value) {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" &&
      value.length <= MONEY_MAX_DIGITS + 1 &&
      /^-?(0|[1-9]\d*)$/.test(value) &&
      value.replace(/^-/, "").length <= MONEY_MAX_DIGITS)
  );
}
function moneyInt(value) {
  if (!isMoney(value)) throw new TypeError("Invalid whole-won amount");
  // Preserve the integer actually represented by an old Number, not its intended value.
  return typeof value === "number" ? BigInt(Math.floor(value)) : BigInt(value);
}
function moneyValue(value) {
  if (value >= -9007199254740991n && value <= 9007199254740991n)
    return Number(value);
  const result = value.toString();
  if (result.replace(/^-/, "").length > MONEY_MAX_DIGITS)
    throw new RangeError("Money representation limit");
  return result;
}
function normalizeMoney(value, fallback = 0, nonnegative = false) {
  if (!isMoney(value)) return fallback;
  const n = moneyInt(value);
  return moneyValue(nonnegative && n < 0n ? 0n : n);
}
function moneyAdd(a, b) {
  return moneyValue(moneyInt(a) + moneyInt(b));
}
function moneySub(a, b) {
  return moneyValue(moneyInt(a) - moneyInt(b));
}
function moneyCompare(a, b) {
  const x = moneyInt(a),
    y = moneyInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
function moneyMax(a, b) {
  return moneyCompare(a, b) >= 0 ? a : b;
}
function moneyQuotient(a, b) {
  const x = moneyInt(a),
    y = moneyInt(b);
  if (y <= 0n) throw new RangeError("Positive divisor required");
  return moneyValue(x >= 0n ? x / y : (x - y + 1n) / y);
}
function moneyRatio(a, b) {
  const x = moneyInt(a),
    y = moneyInt(b);
  if (y <= 0n || x <= 0n) return 0;
  if (x >= y) return 1;
  return Number((x * 1000000n) / y) / 1000000;
}
function moneyExactText(value) {
  return moneyInt(value).toLocaleString("ko-KR");
}

// Effects are dimensionless Numbers, rounded to twelve decimal places to remove
// binary accumulation noise. All factors multiply before one downward won rounding.
function moneyFactor(value) {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e21)
    throw new RangeError("Invalid money factor");
  const text = value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
  const parts = text.split(".");
  return [BigInt(parts.join("")), 10n ** BigInt(parts[1]?.length || 0)];
}
function moneyCalculate(base, factors = [], bonus = 0, finalFactor = 1) {
  let numerator = moneyInt(base),
    denominator = 1n;
  for (const factor of factors) {
    const [p, q] = moneyFactor(factor);
    numerator *= p;
    denominator *= q;
  }
  numerator += moneyInt(bonus) * denominator;
  const [p, q] = moneyFactor(finalFactor);
  numerator *= p;
  denominator *= q;
  return moneyValue(
    numerator >= 0n
      ? numerator / denominator
      : (numerator - denominator + 1n) / denominator,
  );
}
function moneyScale(base, ...factors) {
  return moneyCalculate(base, factors);
}
function moneyGeometricCost(base, ratio, level, multiplier = 1) {
  if (!Number.isSafeInteger(level) || level < 0 || level > MENU_RESEARCH_LIMIT)
    return null;
  const key = [base, ratio, level, multiplier].join("|");
  if (geometricMoneyCache.has(key)) return geometricMoneyCache.get(key);
  const [p, q] = moneyFactor(ratio),
    [mp, mq] = moneyFactor(multiplier);
  const cost = moneyValue(
    (moneyInt(base) * p ** BigInt(level) * mp) / (q ** BigInt(level) * mq),
  );
  if (geometricMoneyCache.size >= 256) geometricMoneyCache.clear();
  geometricMoneyCache.set(key, cost);
  return cost;
}
function menuResearchCost(level) {
  return level >= MENU_RESEARCH_LIMIT
    ? null
    : moneyGeometricCost(100000, 1.8, level);
}

// Explicit schema traversal: never touch counts, timestamps, unknown extensions,
// paid mission/coupon flags, or orphan branch staff career values.
function normalizeBranchMoney(data) {
  let changed = false;
  const assign = (object, key, fallback = 0) => {
    const value = normalizeMoney(object[key], fallback, true);
    if (object[key] !== value) changed = true;
    object[key] = value;
  };
  for (const key of [
    "todaySales",
    "totalSales",
    "offlineSalesToday",
    "offlineSalesTotal",
    "unattributedSales",
  ])
    assign(data, key);
  for (const row of Object.values(data.menuStats || {}))
    if (row && typeof row === "object") assign(row, "earned");
  for (const key of ["player", "staff", "system"])
    if (data.contrib) assign(data.contrib, key);
  if (data.missions) {
    assign(data.missions, "_weekStartTotalSales");
    for (const goal of [
      ...(data.missions.dailyList || []),
      ...(data.missions.weeklyList || []),
    ])
      if (["earn", "sales"].includes(goal.type)) {
        assign(goal, "current");
        assign(goal, "target");
      }
  }
  if (data.payroll) assign(data.payroll, "dailyWage", 80000);
  const previous = data.offlineReward;
  data.offlineReward = normalizeOfflineReward(previous);
  if (previous?.amount !== data.offlineReward.amount) changed = true;
  for (const [id, row] of Object.entries(data.offlineReward.menus || {}))
    if (previous?.menus?.[id]?.earned !== row.earned) changed = true;
  return changed;
}
function migrateMoneyState() {
  const previous = state.money;
  state.money = normalizeMoney(state.money);
  let changed =
    normalizeBranchMoney(state) ||
    previous !== state.money ||
    state.moneyEncoding !== MONEY_ENCODING;
  for (const branch of Object.values(state.branches || {}))
    if (branch?.data && typeof branch.data === "object")
      changed = normalizeBranchMoney(branch.data) || changed;
  for (const row of Object.values(state.staffStats || {}))
    if (row && typeof row === "object") {
      const earned = normalizeMoney(row.earned, 0, true);
      if (earned !== row.earned) changed = true;
      row.earned = earned;
    }
  state.moneyEncoding = MONEY_ENCODING;
  if (changed) markStateChanged("money-migration", false);
}
