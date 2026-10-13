/* IMP-08: active-branch service engine; progress captured at explicit boundaries. */
let deliveryTimer = 0;
let onlineTimer = 0;
let visualRiders = [];
let deliveryNextIntervalMs = null;
let deliveryVisualAcc = 0;
let deliveryNextVisualSec = 0;

function pickStaffKey() {
  const staffCount = getStaffCount();
  if (staffCount <= 0) return "player";
  ensureStaffStats();
  const hired = STAFF_POOL.slice(0, staffCount);
  if (!state._staffRot) state._staffRot = 0;
  const s = hired[state._staffRot % hired.length];
  state._staffRot = (state._staffRot + 1) % staffCount;
  markStateChanged("staff-rotation", false);
  return s?.key || "player";
}
function computeDeliveryIntervalMs(vehicle) {
  const info = state.delivery;
  const riders = Math.max(1, info.riders | 0);

  // 기본 간격: 이동수단 속도 / 라이더 수
  let interval = vehicle.speed / riders;

  // 마케팅/트레이 등 배달 관련 성장 요소가 "빈도"에도 일부 반영되도록
  const eff = sumEffects();
  const freqMul =
    1 +
    Math.max(0, (eff.deliveryMul || 0) * 0.45) +
    Math.max(0, eff.deliveryFreqMul || 0); // 수익배율의 60%만 빈도에 반영 (밸런스용)
  interval /= freqMul;

  // 버프(매출 2배) 때는 속도도 2배로!
  if (Date.now() < state.buffEndTime) interval /= 2;

  // 불규칙성: 배달마다 간격 랜덤화 (0.65~1.35)
  interval *= 0.65 + Math.random() * 0.7;

  // 가끔은 쉬는 템포 (12% 확률)
  if (Math.random() < 0.12) interval *= 1.6;

  // 너무 빠르면 렉, 너무 느리면 답답 → 하한/상한
  interval = clamp(interval, 600, 60000); // 0.6초 ~ 60초

  return interval;
}
function spawnVisualRider(vehicle, isIdle = false) {
  // 순간이동 포털은 별도 연출
  if (vehicle.id >= 9) {
    if (!isIdle) {
      showFloatingText(canvas.width / 2, canvas.height / 2, "🌀 배달 완료!");
    } else {
      // idle 포털은 과하지 않게 작은 반짝
      showFloatingText(canvas.width / 2, canvas.height / 2, "✨");
    }
    return;
  }

  // 단일 레인: 도로 위쪽으로 달리게
  const roadY = canvas.height - 175;
  const baseY = roadY - 18;
  const y = baseY + (-6 + Math.random() * 12);

  const fxMap = {
    0: "💦",
    1: "💨",
    2: "💨",
    3: "💨",
    4: "✨",
    5: "〰️",
    6: "💨",
    7: "🔥",
    8: "🔦",
  };

  // idle 라이더는 너무 자주/너무 많이 안 나오게 제한
  if (isIdle && visualRiders.length >= 6) return;

  visualRiders.push({
    emoji: vehicle.emoji,
    vehicleId: vehicle.id,
    x: -60,
    y,
    speed: 2.0 + vehicle.id * 0.3 + (isIdle ? 0.0 : 0.2),
    phase: Math.random() * 6.28,
    fx: fxMap[vehicle.id] || null,
    born: performance.now(),
    idle: !!isIdle,
  });
}
function spawnLoop(dt) {
  if (!SessionOwner.canMutate()) return false;
  const rates = computeRates();
  const ordersPerSec = rates.ordersPerMin / 60;
  state._spawnAcc += ordersPerSec * dt;
  markStateChanged("customer-progress", false);
  while (state._spawnAcc >= 1) {
    if (state.customers.length < CONFIG.maxCustomers) spawnCustomer();
    state._spawnAcc -= 1;
  }
}

function autoServe(dt) {
  if (!SessionOwner.canMutate()) return false;
  ensureBranchServiceOwner();
  const rates = computeRates();
  const servesPerSec = (rates.autoServesPerMin / 60) * 2; // 2x faster auto-serve
  state._autoServeAcc += servesPerSec * dt;
  markStateChanged("auto-service-progress", false);

  while (state._autoServeAcc >= 1) {
    const target = state.selectedCustomerId
      ? state.customers.find(
          (c) => c.id === state.selectedCustomerId && c.state !== "leaving",
        ) || state.customers.find((c) => c.state !== "leaving")
      : state.customers.find((c) => c.state !== "leaving");
    if (!target) break;
    state.selectedCustomerId = target.id;
    state._autoServeAcc -= 1;
    const sk = pickStaffKey();
    serveByMenu(target.menuId, sk);
  }
}
function updateDelivery(dt, now) {
  if (!SessionOwner.canMutate()) return false;
  ensureBranchServiceOwner();
  try {
    if (!state.delivery?.riders) {
      deliveryTimer = 0;
      deliveryNextIntervalMs = null;
      ServiceRuntime.deliveryOwner = null;
      ServiceRuntime.deliverySignature = "";
      ServiceRuntime.deliveryInputs = null;
      return;
    }
    const vehicle = VEHICLES[clampInt(state.delivery.level, 0, 9)],
      eff = sumEffects();
    const inputs = [
      state.regionId,
      vehicle.id,
      state.delivery.riders,
      eff.deliveryMul,
      eff.deliveryFreqMul,
      Date.now() < (state.buffEndTime || 0),
    ];
    const previousInputs = ServiceRuntime.deliveryInputs;
    const signature =
      previousInputs && inputs.every((v, i) => v === previousInputs[i])
        ? ServiceRuntime.deliverySignature
        : JSON.stringify(inputs);
    ServiceRuntime.deliveryInputs = inputs;
    if (ServiceRuntime.deliveryOwner !== state.delivery) {
      deliveryTimer = 0;
      deliveryNextIntervalMs = null;
      ServiceRuntime.deliverySignature = "";
    }
    if (signature !== ServiceRuntime.deliverySignature) {
      const ratio =
        deliveryNextIntervalMs > 0 ? deliveryTimer / deliveryNextIntervalMs : 0;
      deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle);
      deliveryTimer = ratio * deliveryNextIntervalMs;
      ServiceRuntime.deliverySignature = signature;
      ServiceRuntime.deliveryOwner = state.delivery;
    }

    const info = state.delivery;
    if (!info || info.riders <= 0) return;

    // 다음 배달 간격이 아직 없거나 NaN이면 생성
    if (deliveryNextIntervalMs == null || !isFinite(deliveryNextIntervalMs)) {
      deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle);
      if (!isFinite(deliveryNextIntervalMs)) deliveryNextIntervalMs = 8000;
      deliveryTimer = 0;
    }

    deliveryTimer += dt * 1000;

    if (deliveryTimer >= deliveryNextIntervalMs) {
      deliveryTimer = 0;
      processDelivery(vehicle);
      deliveryNextIntervalMs = computeDeliveryIntervalMs(vehicle); // 다음 배달 간격 재설정
    }

    // [추가] 고용만 해도 '종종' 라이더가 지나가게 (수익과 무관한 비주얼)
    // - 배달이 뜸할 때도 화면이 살아있게 함
    deliveryVisualAcc += dt;
    if (deliveryNextVisualSec <= 0)
      deliveryNextVisualSec = 2.5 + Math.random() * 4.5; // 2.5~7초
    if (deliveryVisualAcc >= deliveryNextVisualSec) {
      deliveryVisualAcc = 0;
      deliveryNextVisualSec = 2.5 + Math.random() * 4.5;
      // 실제 배달(수익)과 분리된 연출: 55% 확률로만 생성 (과도 방지)
      if (Math.random() < 0.55) {
        spawnVisualRider(vehicle, true);
      }
    }

    // 시각 효과 업데이트
    for (let i = visualRiders.length - 1; i >= 0; i--) {
      const r = visualRiders[i];
      r.x += r.speed * (dt * 60); // dt가 초 단위라서 보정
      const roadEndX = canvas.width - 140;
      if (r.x > roadEndX + 60) visualRiders.splice(i, 1);
    }
  } finally {
    captureBranchServiceTimers();
  }
}
function updateOnlineAuto(dt) {
  if (!SessionOwner.canMutate()) return false;
  ensureBranchServiceOwner();
  try {
    onlineTimer += (computeRates().onlineOrdersPerMin / 60) * dt;
    while (onlineTimer >= 1) {
      onlineTimer--;
      const eff = sumEffects(),
        pool = getOrderMenuPool(),
        menu = pool[Math.floor(Math.random() * pool.length)];
      recordIncome(
        moneyScale(getMenuPrice(menu.id, eff),
          1 + (eff.onlineMul || 0),
          1 + (eff.onlineEarningMul || 0),
          Date.now() < (state.buffEndTime || 0) ? 2 : 1),
        { menuId: menu.id, count: 1 },
      );
    }
    updateMissionsOnlineOnly();
  } finally {
    captureBranchServiceTimers();
  }
}
