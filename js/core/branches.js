/* IMP-07: headquarters staff; branch-local service progress and runtime binding. */
let serviceOwnerState = null,
  serviceOwnerRegion = null;

function normalizeServiceTimers(value) {
  const number = (n, fallback = 0) =>
    Number.isFinite(n) ? Math.max(0, n) : fallback;
  const interval =
    Number.isFinite(value?.deliveryIntervalMs) &&
    value.deliveryIntervalMs >= 600 &&
    value.deliveryIntervalMs <= 60000
      ? value.deliveryIntervalMs
      : null;
  return {
    onlineOrders: Math.min(number(value?.onlineOrders), 1),
    deliveryMs: interval ? Math.min(number(value?.deliveryMs), interval) : 0,
    deliveryIntervalMs: interval,
    deliverySignature:
      typeof value?.deliverySignature === "string"
        ? value.deliverySignature
        : "",
  };
}
function bindBranchServiceTimers() {
  const newState = serviceOwnerState !== state;
  const timers = (state.serviceTimers = normalizeServiceTimers(
    state.serviceTimers,
  ));
  onlineTimer = timers.onlineOrders;
  deliveryTimer = timers.deliveryMs;
  deliveryNextIntervalMs = timers.deliveryIntervalMs;
  researchDeliveryOwner = state.delivery;
  researchDeliverySignature = timers.deliverySignature;
  state._staffRot = Number.isFinite(state._staffRot)
    ? Math.max(0, Math.floor(state._staffRot))
    : 0;
  state._autoServeAcc = Number.isFinite(state._autoServeAcc)
    ? Math.max(0, state._autoServeAcc)
    : 0;
  state._eventCheckAcc = Number.isFinite(state._eventCheckAcc)
    ? Math.max(0, state._eventCheckAcc)
    : 0;
  serviceOwnerState = state;
  serviceOwnerRegion = state.regionId;
  visualRiders = [];
  deliveryVisualAcc = 0;
  deliveryNextVisualSec = 0;
  // Temporary click effects stop on movement; retain their daily-use limits.
  if (window._fxState) {
    if (newState) {
      window._fxState.boss.buffCount = 0;
      window._fxState.boss.buffDate = "";
      window._fxState.staffs = {};
    }
    for (const effect of [
      window._fxState.boss,
      ...Object.values(window._fxState.staffs || {}),
    ]) {
      effect.buffUntil = 0;
      effect.taps = 0;
      effect.lastClick = 0;
    }
    window._fxState.speech = { type: null, key: null, msg: "", until: 0 };
  }
}
function ensureBranchServiceOwner() {
  if (serviceOwnerState !== state || serviceOwnerRegion !== state.regionId)
    bindBranchServiceTimers();
}
function captureBranchServiceTimers() {
  if (serviceOwnerState !== state || serviceOwnerRegion !== state.regionId)
    return;
  const next = normalizeServiceTimers({
    onlineOrders: onlineTimer,
    deliveryMs: deliveryTimer,
    deliveryIntervalMs: deliveryNextIntervalMs,
    deliverySignature: researchDeliverySignature,
  });
  if (Object.keys(next).some((key) => state.serviceTimers[key] !== next[key])) {
    state.serviceTimers = next;
    _saveDirty = true;
  }
}
const branchSanitize = sanitizeState;
sanitizeState = function () {
  branchSanitize();
  state.serviceTimers = normalizeServiceTimers(state.serviceTimers);
  ensureBranchServiceOwner();
};
const branchSaveCurrentTo = BranchManager.saveCurrentTo;
BranchManager.saveCurrentTo = function (id) {
  captureBranchServiceTimers();
  return branchSaveCurrentTo.call(this, id);
};
const branchLoadFrom = BranchManager.loadFrom;
BranchManager.loadFrom = function (...args) {
  branchLoadFrom.apply(this, args);
  sanitizeState();
  ensureResearchSlots();
  bindBranchServiceTimers();
};
const branchUpdateOnline = updateOnlineAuto;
updateOnlineAuto = function (...args) {
  ensureBranchServiceOwner();
  try {
    return branchUpdateOnline(...args);
  } finally {
    captureBranchServiceTimers();
  }
};
const branchUpdateDelivery = updateDelivery;
updateDelivery = function (...args) {
  ensureBranchServiceOwner();
  try {
    return branchUpdateDelivery(...args);
  } finally {
    captureBranchServiceTimers();
  }
};
const branchAutoServe = autoServe;
autoServe = function (...args) {
  ensureBranchServiceOwner();
  return branchAutoServe(...args);
};
