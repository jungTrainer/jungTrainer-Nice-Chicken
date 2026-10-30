/* Recovery-Structure-1: canonical effects definitions; game state, input and persistence keep their existing owners. */
window._fxState = {
  boss: { taps: 0, buffUntil: 0, lastClick: 0, buffCount: 0, buffDate: "" },
  staffs: {},
  speech: { type: null, key: null, msg: "", until: 0 },
};

let floats = [];
let bossParticles = [];
let bossFlash = 0; // screen flash alpha (0~1)

let _bossAnim = {
  t0:
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now(),
  msg: null,
  msgUntil: 0,
  shakeUntil: 0,
};

function isGlobalBuffActive(excludeKey) {
  const now = Date.now();
  if (excludeKey !== "boss" && window._fxState.boss.buffUntil > now)
    return true;
  for (const key in window._fxState.staffs) {
    if (key !== excludeKey && window._fxState.staffs[key].buffUntil > now)
      return true;
  }
  return false;
}

function getClickScale(lastClickTime) {
  const now = Date.now();
  const elapsed = now - lastClickTime;
  // 100ms 내에 20% 축소 -> 200ms까지 10% 확대 -> 300ms 원상복구 (완벽한 텐션!)
  if (elapsed < 100) return 1.0 - (elapsed / 100) * 0.2;
  else if (elapsed < 200) return 0.8 + ((elapsed - 100) / 100) * 0.3;
  else if (elapsed < 300) return 1.1 - ((elapsed - 200) / 100) * 0.1;
  else return 1.0;
}

function bossBurst(x, y, n = 22) {
  try {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 180 + Math.random() * 380;
      bossParticles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (120 + Math.random() * 180),
        life: 0.65 + Math.random() * 0.35,
        r: 2 + Math.random() * 3.5,
        hue: Math.floor(Math.random() * 360),
      });
    }
    bossFlash = Math.min(0.35, bossFlash + 0.22);
  } catch (e) {}
}

function updateBossParticles(dt) {
  if (bossFlash > 0) bossFlash = Math.max(0, bossFlash - dt * 1.8);
  if (!bossParticles.length) return;
  const g = 980; // gravity px/s^2

  for (let i = bossParticles.length - 1; i >= 0; i--) {
    const p = bossParticles[i];
    p.vy += g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 1 - dt * 2.2;
    p.vy *= 1 - dt * 1.2;

    // 수명이 다한 파티클 즉시 제거 (filter 대체)
    if (p.life <= 0) {
      bossParticles.splice(i, 1);
    }
  }
}

function drawBossParticles() {
  if (!ctx || !canvas) return;
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } catch (e) {}
  for (const p of bossParticles) {
    const a = clamp(p.life, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = `hsl(${p.hue} 90% 60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBossFlash() {
  if (!ctx || !canvas) return;
  if (bossFlash <= 0) return;
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } catch (e) {}
  ctx.globalAlpha = bossFlash;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function floatText(text, x, y, color) {
  floats.push({ text, x, y, color, life: 0.95, vy: -55 });
}

function showFloatingText(x, y, text) {
  floatText(text, x, y, "#fff");
}

function applyElementFX(el) {
  if (!el) return;
  el.classList.remove("fx-pop");
  void el.offsetWidth;
  el.classList.add("fx-pop");
}

function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.y += f.vy * dt;
    f.life -= dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

function bossSpeak(msg, durSec = 1.6, shake = false) {
  try {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    _bossAnim.msg = String(msg || "");
    _bossAnim.msgUntil = now + Math.max(0.6, durSec) * 1000;
    _bossAnim.shakeUntil = shake ? now + 420 : 0;
  } catch (e) {}
}

function updateBoss(dt) {
  // future-proof hook; keep lightweight
  if (!_bossAnim) return;
  // clear msg when expired
  try {
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (_bossAnim.msg && _bossAnim.msgUntil && now > _bossAnim.msgUntil) {
      _bossAnim.msg = null;
      _bossAnim.msgUntil = 0;
    }
  } catch (e) {}
}

function drawFloats() {
  if (!ctx) return;
  for (const f of floats) {
    ctx.save();
    // Hard reset in case previous layers leaked state
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } catch (e) {}
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.font = "bold 22px Jua";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.fillStyle = f.color || "#fff";
    const y = f.y + (1 - f.life) * -18;
    try {
      ctx.strokeText(f.text, f.x, y);
      ctx.fillText(f.text, f.x, y);
    } catch (e) {}
    ctx.restore();
  }
}
