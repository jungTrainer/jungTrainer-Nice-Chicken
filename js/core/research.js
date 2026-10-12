/* REC-03: apply training to staff only and refresh in-flight delivery rates. */
const legacyComputeRates = computeRates;
computeRates = function () {
  const result = legacyComputeRates(),
    eff = result.eff;
  const multiplier = Math.max(0, 1 + (eff.staffSpeedMul || 0));
  const grades = { C: 1, B: 1.05, A: 1.12, S: 1.22 };
  const staff = STAFF_POOL.slice(0, result.staffCount).reduce(
    (n, s) =>
      n +
      1.4 *
        (s.baseSpeed || 1) *
        (1 + clampInt(state.staffStats[s.key]?.auto || 0, 0, 10) * 0.18) *
        (grades[s.grade] || 1),
    0,
  );
  const autoMul =
    state.event?.id === "supply"
      ? 1 + Math.min(0, (eff.autoServeMul || 0) + (eff.eventAutoResist || 0))
      : 1 + (eff.autoServeMul || 0);
  result.autoServesPerMin = Math.max(
    0,
    result.autoServesPerMin + staff * (multiplier - 1) * autoMul,
  );
  result.staffSpeedMul = multiplier;
  return result;
};
function migrateLegacyResearch() {
  const r = state.research;
  if (r.completed?.length && !Object.keys(r.levels || {}).length) {
    r.levels = Object.fromEntries(
      r.completed.map((id) => [
        id,
        RESEARCH.find((v) => v.id === id)?.maxLevel || 10,
      ]),
    );
    _saveDirty = true;
  }
}
const researchSanitize = sanitizeState;
sanitizeState = function () {
  researchSanitize();
  migrateLegacyResearch();
};
const researchLoadBranch = BranchManager.loadFrom;
BranchManager.loadFrom = function (...args) {
  researchLoadBranch.apply(this, args);
  migrateLegacyResearch();
};
let researchDeliveryOwner = null,
  researchDeliverySignature = "";
const legacyUpdateDelivery = updateDelivery;
updateDelivery = function (dt, now) {
  if (!state.delivery?.riders) {
    deliveryTimer = 0;
    deliveryNextIntervalMs = null;
    researchDeliveryOwner = null;
    researchDeliverySignature = "";
    return;
  }
  const vehicle = VEHICLES[clampInt(state.delivery.level, 0, 9)],
    eff = sumEffects();
  const signature = JSON.stringify([
    state.regionId,
    vehicle.id,
    state.delivery.riders,
    eff.deliveryMul,
    eff.deliveryFreqMul,
    Date.now() < (state.buffEndTime || 0),
  ]);
  if (researchDeliveryOwner !== state.delivery) {
    deliveryTimer = 0;
    deliveryNextIntervalMs = null;
    researchDeliverySignature = "";
  }
  if (signature !== researchDeliverySignature) {
    const ratio =
      deliveryNextIntervalMs > 0 ? deliveryTimer / deliveryNextIntervalMs : 0;
    deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle);
    deliveryTimer = ratio * deliveryNextIntervalMs;
    researchDeliverySignature = signature;
    researchDeliveryOwner = state.delivery;
  }
  legacyUpdateDelivery(dt, now);
};
