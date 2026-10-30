/* Recovery-Structure-1: canonical render definitions; game state, input and persistence keep their existing owners. */
function render() {
  if (!ctx || !canvas) return;

  // Frame-level hard reset: stop state leaks from accumulating
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  } catch (e) {}

  const h = canvas.height;
  const w = canvas.width;

  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH; // 벽지/바닥 경계선(Wall Bottom)

  const bossY = floorY;
  const staffY = Math.min(h - 24, floorY + floorH - 24);

  function safeLayer(fn, label) {
    try {
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
      } catch (_e) {}
      fn();
    } catch (e) {
      console.error(label, e);
    } finally {
      try {
        ctx.restore();
      } catch (_e) {}
    }
  }

  // 👇 레이어 그리기 순서 변경 (간판을 손님보다 먼저 그리도록 위로 배치!)
  safeLayer(() => drawBackground(), "[drawBackground]");

  // Signboard: 배경을 그린 직후, 손님보다 아래 레이어에 깔리도록 여기에 배치하네
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  } catch (e) {}
  safeLayer(() => drawSignboard(), "[drawSignboard]");

  safeLayer(() => drawBoss(bossY), "[drawBoss]");
  safeLayer(() => drawStaff(staffY), "[drawStaff]");
  safeLayer(() => drawDeliveryLayer(performance.now()), "[drawDeliveryLayer]");
  safeLayer(() => drawCustomers(), "[drawCustomers]"); // 이제 손님이 간판 위를 걷게 됨!
  safeLayer(() => drawFloats(), "[drawFloats]");
  safeLayer(() => drawBossParticles(), "[drawBossParticles]");
  safeLayer(() => drawBossFlash(), "[drawBossFlash]");
}
