/* Recovery-Structure-1: canonical layout definitions; game state, input and persistence keep their existing owners. */
function doorRect() {
  // 우측 출구 문: 바닥(floor) 상단에 맞춰 정렬
  const w = 64,
    h = 92;
  const x = canvas.width - w - 14;

  const H = canvas.height;
  const floorH = Math.max(70, Math.floor(H * 0.12));
  const floorY = H - floorH;

  // 문 바닥은 floorY 근처에 닿도록
  const y = floorY - h + 10;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

function serveSpot() {
  // 선택 손님이 오는 중앙 서빙 포인트(중앙 하단)
  return { x: canvas.width / 2, y: canvas.height - 220 };
}

function waitingSlots() {
  // 하단 전체 2행×5열 그리드
  const cols = 5,
    rows = 2;
  const marginX = 44;
  const topY = canvas.height - 300; // 배달 레인(2개) 위로 올려 겹침 방지
  const rowGap = 70;
  const colW = (canvas.width - marginX * 2) / (cols - 1);
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: marginX + c * colW,
        y: topY + r * rowGap,
      });
    }
  }
  return slots;
}

function hitCircle(tx, ty, cx, cy, r) {
  const dx = tx - cx;
  const dy = ty - cy;
  return dx * dx + dy * dy < r * r;
}

function bossCenter() {
  const h = canvas.height;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  return {
    x: canvas.width / 2,
    y: floorY,
    hitY: floorY - 20, // [NEW] 터치 중심점을 이모지 중앙으로 위로 올림
    r: 42, // [NEW] 기존 85에서 딱 절반 수준으로 축소!
  };
}

function staffCenters() {
  const list = [];
  const hired = getHiredStaff();
  if (hired.length === 0) return list;

  const h = canvas.height;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  const staffY = Math.min(h - 26, floorY + floorH - 24);

  const r = Math.min(49, Math.max(22, canvas.width / (hired.length * 2) - 6));
  const padding = r + 6;
  const usableW = canvas.width - padding * 2;
  const count = Math.max(1, hired.length);

  // Keep six touch centers distinct even on a 320px screen.

  let gap = 0;
  let startX = canvas.width / 2;

  if (count > 1) {
    const maxPossibleGap = usableW / (count - 1);
    gap = Math.min(210, maxPossibleGap);
    const totalW = (count - 1) * gap;
    startX = (canvas.width - totalW) / 2;
  }

  for (let i = 0; i < hired.length; i++) {
    list.push({
      x: count === 1 ? startX : startX + i * gap,
      y: staffY,
      hitY: staffY - 10, // [NEW] 터치 중심점을 이모지 중앙으로 위로 올림
      r: r,
      key: hired[i].key,
      emoji: hired[i].emoji,
      label: hired[i].label,
    });
  }
  return list;
}

function roundRect2(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.arcTo(x + w, y, x + w, y + h, r);
  ctx2.arcTo(x + w, y + h, x, y + h, r);
  ctx2.arcTo(x, y + h, x, y, r);
  ctx2.arcTo(x, y, x + w, y, r);
  ctx2.closePath();
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
