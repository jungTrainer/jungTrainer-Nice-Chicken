/* Recovery-Structure-1: canonical background definitions; game state, input and persistence keep their existing owners. */
const _BG_CACHE = { key: null, data: null };

function drawDoor() {
  const d = doorRect();
  ctx.save();
  // frame
  ctx.fillStyle = "rgba(0,0,0,.35)";
  roundRectPath(d.x - 6, d.y - 6, d.w + 12, d.h + 12, 14);
  ctx.fill();

  // door
  ctx.fillStyle = "rgba(255,255,255,.12)";
  roundRectPath(d.x, d.y, d.w, d.h, 12);
  ctx.fill();

  // inner
  ctx.fillStyle = "rgba(0,0,0,.28)";
  roundRectPath(d.x + 10, d.y + 12, d.w - 20, d.h - 22, 10);
  ctx.fill();

  // handle
  ctx.fillStyle = "rgba(255,215,0,.85)";
  ctx.beginPath();
  ctx.arc(d.x + d.w - 16, d.y + d.h / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "14px Jua";
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("출구", d.cx, d.y + d.h + 6);
  ctx.restore();
}

function drawTables() {
  // simple tables in middle area (reduced to half size)
  const midY = canvas.height * 0.46;
  const s = 0.5;
  const tW = 96 * s,
    tH = 58 * s;
  const t1 = { x: canvas.width * 0.28, y: midY, w: tW, h: tH };
  const t2 = { x: canvas.width * 0.72, y: midY + 18, w: tW, h: tH };

  const drawTable = (t) => {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.16)";
    roundRectPath(t.x - t.w / 2, t.y - t.h / 2 + 6 * s, t.w, t.h, 14 * s);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    roundRectPath(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, 14 * s);
    ctx.fill();

    // plates
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.beginPath();
    ctx.arc(t.x - 18 * s, t.y - 6 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(t.x + 20 * s, t.y + 8 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    // chairs
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.arc(t.x - t.w / 2 + 10 * s, t.y - 4 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(t.x + t.w / 2 - 10 * s, t.y + 6 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawTable(t1);
  drawTable(t2);
}

function drawCounter() {
  // kitchen/counter area
  const y = canvas.height - 140;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(0, y + 8, canvas.width, 92);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(0, y, canvas.width, 88);

  ctx.fillStyle = "rgba(255,159,28,.35)";
  ctx.fillRect(0, y, canvas.width, 10);

  // 카운터 텍스트 제거 (가독성)
  ctx.restore();
}

function _bgSeededRand(seed) {
  // LCG
  let s = seed >>> 0;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getAtmosphere(level) {
  if (level === 0)
    return {
      desc: "새벽",
      skyColors: [
        { stop: 0, color: "#2b32b2" },
        { stop: 1, color: "#1488cc" },
      ],
      filter: null,
      skyType: "dawn",
      starOpacity: 0.2,
    };
  if (level === 1)
    return {
      desc: "이른 아침",
      skyColors: [
        { stop: 0, color: "#1c92d2" },
        { stop: 1, color: "#f2fcfe" },
      ],
      filter: null,
      skyType: "day",
      starOpacity: 0,
    };
  if (level === 2)
    return {
      desc: "정오",
      skyColors: [
        { stop: 0, color: "#2980B9" },
        { stop: 1, color: "#6DD5FA" },
      ],
      filter: null,
      skyType: "day",
      starOpacity: 0,
    };
  if (level === 3)
    return {
      desc: "오후",
      skyColors: [
        { stop: 0, color: "#005bea" },
        { stop: 1, color: "#00c6fb" },
      ],
      filter: null,
      skyType: "day",
      starOpacity: 0,
    };
  if (level === 4)
    return {
      desc: "늦은 오후",
      skyColors: [
        { stop: 0, color: "#3a7bd5" },
        { stop: 1, color: "#ffd194" },
      ],
      filter: { mode: "overlay", color: "rgba(255, 200, 100, 0.1)" },
      skyType: "day",
      starOpacity: 0,
    };
  if (level === 5)
    return {
      desc: "골든 아워",
      skyColors: [
        { stop: 0, color: "#ff9966" },
        { stop: 1, color: "#ff5e62" },
      ],
      filter: { mode: "overlay", color: "rgba(255, 160, 0, 0.2)" },
      skyType: "sunset",
      starOpacity: 0,
    };
  if (level === 6)
    return {
      desc: "노을",
      skyColors: [
        { stop: 0, color: "#AA076B" },
        { stop: 1, color: "#61045F" },
      ],
      filter: { mode: "overlay", color: "rgba(200, 50, 50, 0.2)" },
      skyType: "sunset",
      starOpacity: 0.1,
    };
  if (level === 7)
    return {
      desc: "초저녁",
      skyColors: [
        { stop: 0, color: "#200122" },
        { stop: 1, color: "#6f0000" },
      ],
      filter: { mode: "multiply", color: "rgba(50, 0, 100, 0.3)" },
      skyType: "night",
      starOpacity: 0.4,
    };
  if (level === 8)
    return {
      desc: "도시의 밤",
      skyColors: [
        { stop: 0, color: "#0f0c29" },
        { stop: 0.5, color: "#302b63" },
        { stop: 1, color: "#24243e" },
      ],
      filter: { mode: "multiply", color: "rgba(0, 0, 50, 0.4)" },
      skyType: "night",
      starOpacity: 0.8,
    };
  if (level === 9)
    return {
      desc: "심야",
      skyColors: [
        { stop: 0, color: "#000000" },
        { stop: 1, color: "#0f0c29" },
      ],
      filter: { mode: "multiply", color: "rgba(0, 0, 0, 0.6)" },
      skyType: "night",
      starOpacity: 1.0,
    };
  return {
    desc: "축제",
    skyColors: [
      { stop: 0, color: "#141E30" },
      { stop: 1, color: "#243B55" },
    ],
    filter: { mode: "color-dodge", color: "rgba(100, 50, 255, 0.1)" },
    skyType: "special",
    starOpacity: 1.0,
  };
}

function drawSkyGradient(ctx, w, h, colors) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  colors.forEach((c) => grd.addColorStop(c.stop, c.color));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}

function drawCloud(ctx, cx, cy, scale, opacity = 0.8) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.arc(25, -10, 35, 0, Math.PI * 2);
  ctx.arc(50, 0, 30, 0, Math.PI * 2);
  ctx.arc(25, 10, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCelestial(ctx, x, y, r, color, glowColor) {
  ctx.save();
  const grd = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
  grd.addColorStop(0, color);
  grd.addColorStop(0.3, glowColor);
  grd.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHill(ctx, w, yBase, amplitude, frequency, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, yBase);
  for (let x = 0; x <= w; x += 10) {
    const y =
      yBase -
      Math.sin(x * frequency) * amplitude -
      Math.cos(x * frequency * 0.5) * (amplitude * 0.5);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.fill();
}

function drawStatueOfLiberty(ctx, x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fillRect(-15, 0, 30, 40); // Base
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-12, -60);
  ctx.lineTo(8, -60);
  ctx.lineTo(10, 0);
  ctx.fill(); // Body
  ctx.beginPath();
  ctx.arc(0, -65, 6, 0, Math.PI * 2);
  ctx.fill(); // Head
  ctx.strokeStyle = color;
  ctx.lineWidth = 1; // Crown
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, -70);
    const angle = (Math.PI / 6) * (i - 2) - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * 10, -70 + Math.sin(angle) * 10);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(8, -55);
  ctx.lineTo(18, -85);
  ctx.lineTo(20, -85);
  ctx.lineTo(12, -55);
  ctx.fill(); // Right Arm
  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.arc(19, -90, 4, 0, Math.PI * 2);
  ctx.fill(); // Torch Flame
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, -55);
  ctx.lineTo(-18, -45);
  ctx.lineTo(-12, -40);
  ctx.fill(); // Left Arm
  ctx.restore();
}

function drawEiffelTower(ctx, x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(-10, -40, -2, -100);
  ctx.lineTo(2, -100);
  ctx.quadraticCurveTo(10, -40, 20, 0);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -35);
  ctx.lineTo(12, -35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -70);
  ctx.lineTo(6, -70);
  ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-5, -35);
  ctx.moveTo(-5, 0);
  ctx.lineTo(-10, -35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.lineTo(0, -110);
  ctx.stroke();
  ctx.restore();
}

function drawFireworks(ctx, w, h, count, randFunc, now) {
  // 시간에 따라 폭죽이 터지고 사라지는 애니메이션 적용
  const phase = Math.floor(now / 1500);
  for (let i = 0; i < count; i++) {
    const fwSeed = phase + i * 10;
    let s = fwSeed;
    const r = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };

    const cx = r() * w;
    const cy = h * 0.1 + r() * h * 0.4;
    const color = `hsl(${r() * 360}, 100%, 70%)`;

    const age = (now % 1500) / 1500; // 0 to 1
    if (age > 0.8) continue; // 끝물엔 사라짐

    const radius = (20 + r() * 30) * Math.sin((age * Math.PI) / 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * (1 - age);
    ctx.globalAlpha = 1 - Math.pow(age, 2);

    const particles = 12;
    for (let j = 0; j < particles; j++) {
      const angle = ((Math.PI * 2) / particles) * j;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(angle) * (radius * 0.2),
        cy + Math.sin(angle) * (radius * 0.2),
      );
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }
}

function drawBackground() {
  if (!ctx || !canvas) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. 상태 가져오기 (게임 데이터 연동)
  const region = (typeof getRegion === "function" ? getRegion() : null) || {
    id: "changnyeong",
  };
  // 게임 내 region id ('japan' 등)를 스튜디오 테마 이름과 매칭
  let theme = region.id || "changnyeong";
  if (theme === "japan") theme = "europe"; // 일본 지역에 에펠탑/유럽 아트 적용!

  // 인테리어 업그레이드 레벨 (0~10)
  const level = clampInt(state?.upgrades?.interior || 0, 0, 10);
  const atmos = getAtmosphere(level);

  // 2. 바닥 높이 계산 (게임 렌더링 기준선)
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;
  const viewH = floorY; // 배경 풍경이 보일 높이

  // 3. 60FPS 깜빡임 방지용 고정 난수 (프레임마다 동일한 난수 시퀀스 보장)
  let _seed = level * 123 + theme.charCodeAt(0);
  const rand = () => {
    _seed = Math.sin(_seed) * 10000;
    return _seed - Math.floor(_seed);
  };

  // ==========================================
  // 🎨 PART A: 스튜디오 명품 배경 (풍경)
  // ==========================================
  ctx.save();
  // 바닥 아래로는 풍경이 그려지지 않도록 클리핑 마스크 적용
  ctx.beginPath();
  ctx.rect(0, 0, w, viewH);
  ctx.clip();

  // 하늘
  let skyColors = atmos.skyColors;
  if (theme === "mars") {
    skyColors = [
      { stop: 0, color: "#0D0221" },
      { stop: 0.7, color: "#2E1437" },
      { stop: 1, color: "#590D22" },
    ];
  }
  drawSkyGradient(ctx, w, viewH, skyColors);

  // 뉴욕 성조기 스트라이프
  if (theme === "usa" && level <= 5) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < viewH; i += 40) ctx.fillRect(0, i, w, 20);
    ctx.restore();
  }

  // 천체
  if (theme === "mars") {
    ctx.fillStyle = "#FFF";
    for (let i = 0; i < 100; i++) {
      ctx.globalAlpha = rand() * 0.8 + 0.2;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * viewH, rand() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawCelestial(
      ctx,
      w * 0.8,
      viewH * 0.3,
      60,
      "#FF7043",
      "rgba(255, 87, 34, 0.4)",
    );
  } else {
    if (
      atmos.skyType === "night" ||
      atmos.skyType === "dawn" ||
      atmos.skyType === "special"
    ) {
      ctx.fillStyle = "#FFF";
      for (let i = 0; i < 80; i++) {
        ctx.globalAlpha = rand() * atmos.starOpacity;
        ctx.fillRect(rand() * w, rand() * viewH * 0.6, rand() * 2, rand() * 2);
      }
      ctx.globalAlpha = 1;
      if (atmos.skyType !== "dawn")
        drawCelestial(
          ctx,
          w * 0.85,
          viewH * 0.15,
          25,
          "#FFF9C4",
          "rgba(255,255,255,0.1)",
        );
    } else {
      const sunColor = atmos.skyType === "sunset" ? "#FF5252" : "#FFEB3B";
      const sunY = atmos.skyType === "sunset" ? viewH * 0.6 : viewH * 0.15;
      drawCelestial(
        ctx,
        w * 0.85,
        sunY,
        35,
        sunColor,
        "rgba(255, 200, 0, 0.3)",
      );
    }
  }

  // 지역별 드로잉
  ctx.save();
  if (theme === "usa") {
    const groundY = viewH;
    ctx.fillStyle = atmos.skyType === "night" ? "#1A237E" : "#7986CB";
    for (let x = 0; x < w; x += 15) {
      const bh = 50 + rand() * 80;
      ctx.fillRect(x, groundY - bh, 16, bh);
    }
    ctx.fillStyle = atmos.skyType === "night" ? "#0D47A1" : "#3F51B5";
    const buildings = [
      { x: 0.1, h: 200, type: "box" },
      { x: 0.3, h: 280, type: "needle" },
      { x: 0.5, h: 150, type: "box" },
      { x: 0.6, h: 240, type: "slope" },
      { x: 0.9, h: 180, type: "box" },
    ];
    buildings.forEach((b) => {
      const bx = w * b.x,
        by = groundY,
        bw = 50;
      ctx.fillRect(bx, by - b.h, bw, b.h);
      if (b.type === "needle") {
        ctx.beginPath();
        ctx.moveTo(bx, by - b.h);
        ctx.lineTo(bx + bw / 2, by - b.h - 50);
        ctx.lineTo(bx + bw, by - b.h);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by - b.h - 50);
        ctx.lineTo(bx + bw / 2, by - b.h - 70);
        ctx.stroke();
      } else if (b.type === "slope") {
        ctx.beginPath();
        ctx.moveTo(bx, by - b.h);
        ctx.lineTo(bx + bw, by - b.h - 20);
        ctx.lineTo(bx + bw, by - b.h);
        ctx.fill();
      }
      if (atmos.skyType === "night" || atmos.skyType === "special") {
        ctx.fillStyle = rand() > 0.5 ? "#FFD54F" : "#fff";
        for (let wy = by - b.h + 10; wy < by; wy += 15) {
          for (let wx = bx + 5; wx < bx + bw - 5; wx += 8) {
            if (rand() > 0.4) ctx.fillRect(wx, wy, 4, 8);
          }
        }
        ctx.fillStyle = atmos.skyType === "night" ? "#0D47A1" : "#3F51B5";
      }
    });
    let statColor =
      atmos.skyType === "sunset"
        ? "#00695C"
        : atmos.skyType === "night"
          ? "#004D40"
          : "#4DB6AC";
    drawStatueOfLiberty(ctx, w * 0.15, groundY + 20, 2.5, statColor);
  } else if (theme === "europe") {
    const groundY = viewH;
    ctx.fillStyle = atmos.skyType === "night" ? "#3E2723" : "#8D6E63";
    for (let x = 0; x < w; x += 30) {
      const bh = 60 + rand() * 40;
      ctx.fillRect(x, groundY - bh, 31, bh);
      ctx.beginPath();
      ctx.moveTo(x, groundY - bh);
      ctx.lineTo(x + 15, groundY - bh - 15);
      ctx.lineTo(x + 31, groundY - bh);
      ctx.fill();
    }
    ctx.fillStyle = atmos.skyType === "night" ? "#263238" : "#5D4037";
    const houses = [
      { x: 0.1, h: 100, roof: "dome" },
      { x: 0.35, h: 80, roof: "flat" },
      { x: 0.65, h: 90, roof: "tri" },
      { x: 0.85, h: 110, roof: "mansard" },
    ];
    houses.forEach((b) => {
      const bx = w * b.x,
        bw = 60;
      ctx.fillRect(bx, groundY - b.h, bw, b.h);
      if (b.roof === "dome") {
        ctx.beginPath();
        ctx.arc(bx + bw / 2, groundY - b.h, bw / 2, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(bx + bw / 2 - 2, groundY - b.h - bw / 2 - 10, 4, 10);
      } else if (b.roof === "tri") {
        ctx.beginPath();
        ctx.moveTo(bx, groundY - b.h);
        ctx.lineTo(bx + bw / 2, groundY - b.h - 30);
        ctx.lineTo(bx + bw, groundY - b.h);
        ctx.fill();
      } else if (b.roof === "mansard") {
        ctx.beginPath();
        ctx.moveTo(bx - 5, groundY - b.h);
        ctx.lineTo(bx + 5, groundY - b.h - 20);
        ctx.lineTo(bx + bw - 5, groundY - b.h - 20);
        ctx.lineTo(bx + bw + 5, groundY - b.h);
        ctx.fill();
      }
      ctx.fillStyle =
        atmos.skyType === "night" && rand() > 0.5 ? "#FFEB3B" : "#3E2723";
      if (atmos.skyType !== "night") ctx.fillStyle = "#3E2723";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(bx + 15 + i * 15, groundY - b.h / 2, 5, Math.PI, 0);
        ctx.fillRect(bx + 10 + i * 15, groundY - b.h / 2, 10, 10);
        ctx.fill();
      }
      ctx.fillStyle = atmos.skyType === "night" ? "#263238" : "#5D4037";
    });
    let towerColor =
      atmos.skyType === "sunset"
        ? "#3E2723"
        : atmos.skyType === "night"
          ? "#212121"
          : "#455A64";
    drawEiffelTower(ctx, w * 0.5, groundY, 3.5, towerColor);
    if (level >= 8) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, groundY - 350);
      ctx.lineTo(w * 0.5 + Math.sin(Date.now() / 500) * 40, 0);
      ctx.stroke();
    }
  } else if (theme === "changnyeong") {
    drawHill(
      ctx,
      w,
      viewH * 0.6,
      30,
      0.005,
      atmos.skyType === "night" ? "#311B92" : "#9FA8DA",
    );
    drawHill(
      ctx,
      w,
      viewH * 0.7,
      40,
      0.008,
      atmos.skyType === "night" ? "#4527A0" : "#7986CB",
    );
    const fieldGrd = ctx.createLinearGradient(0, viewH * 0.7, 0, viewH);
    if (atmos.skyType === "night") {
      fieldGrd.addColorStop(0, "#311B92");
      fieldGrd.addColorStop(1, "#000000");
    } else {
      fieldGrd.addColorStop(0, "#BA68C8");
      fieldGrd.addColorStop(1, "#6A1B9A");
    }
    ctx.fillStyle = fieldGrd;
    ctx.beginPath();
    ctx.moveTo(0, viewH * 0.75);
    ctx.quadraticCurveTo(w / 2, viewH * 0.7, w, viewH);
    ctx.lineTo(0, viewH);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    for (let x = 0; x < w; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, viewH * 0.75 + rand() * 50);
      ctx.lineTo(x, viewH);
      ctx.stroke();
    }
  } else if (theme === "busan") {
    const horizonY = viewH * 0.6;
    const seaGrd = ctx.createLinearGradient(0, horizonY, 0, viewH);
    if (level <= 3) {
      seaGrd.addColorStop(0, "#0288D1");
      seaGrd.addColorStop(1, "#81D4FA");
    } else if (level <= 6) {
      seaGrd.addColorStop(0, "#1A237E");
      seaGrd.addColorStop(1, "#F06292");
    } else {
      seaGrd.addColorStop(0, "#000000");
      seaGrd.addColorStop(1, "#1A237E");
    }
    ctx.fillStyle = seaGrd;
    ctx.fillRect(0, horizonY, w, viewH - horizonY);
    ctx.fillStyle = `rgba(255, 255, 255, ${atmos.skyType === "night" ? 0.1 : 0.3})`;
    const now = performance.now();
    for (let i = 0; i < 3; i++) {
      const waveY = horizonY + 20 + i * 30;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      for (let x = 0; x <= w; x += 20)
        ctx.lineTo(x, waveY + Math.sin(x * 0.02 + now * 0.002) * 10);
      ctx.lineTo(w, viewH);
      ctx.lineTo(0, viewH);
      ctx.fill();
    }
  } else if (theme === "seoul") {
    const groundY = viewH;
    drawHill(
      ctx,
      w,
      viewH * 0.6,
      40,
      0.01,
      atmos.skyType === "night" ? "#102027" : "#37474F",
    );
    ctx.fillStyle = atmos.skyType === "night" ? "#000" : "#263238";
    const tx = w * 0.5;
    ctx.fillRect(tx - 3, viewH * 0.6, 6, 120);
    ctx.beginPath();
    ctx.arc(tx, viewH * 0.65, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = atmos.skyType === "night" ? "#263238" : "#455A64";
    for (let x = 0; x < w; x += 30) {
      const bh = 50 + rand() * 80;
      ctx.fillRect(x, groundY - bh, 25, bh);
      if (level >= 7 && rand() > 0.5) {
        ctx.fillStyle = "#FFEB3B";
        ctx.fillRect(x + 5, groundY - bh + 10, 5, 5);
        ctx.fillStyle = atmos.skyType === "night" ? "#263238" : "#455A64";
      }
    }
  } else if (theme === "mars") {
    const groundY = viewH * 0.8;
    drawHill(ctx, w, groundY, 40, 0.005, "#D84315");
    drawHill(ctx, w, groundY + 20, 30, 0.01, "#BF360C");
    ctx.fillStyle = "#3E2723";
    ctx.fillRect(0, groundY + 40, w, viewH);
  }

  // 공통 구름 (시간에 따라 부드럽게 이동)
  if (theme !== "mars" && level <= 6) {
    const cloudCount = 3 + Math.floor(rand() * 3);
    const drift = performance.now() * 0.01;
    for (let i = 0; i < cloudCount; i++) {
      const cx = ((rand() * w * 2 + drift * (1 + rand())) % (w + 200)) - 100;
      drawCloud(ctx, cx, rand() * viewH * 0.4, 0.5 + rand() * 0.5, 0.6);
    }
  }

  // 불꽃놀이 (동적 애니메이션 적용)
  if (level === 10) drawFireworks(ctx, w, viewH, 5, rand, performance.now());

  ctx.restore();

  // 분위기 필터
  if (atmos.filter) {
    ctx.save();
    ctx.globalCompositeOperation = atmos.filter.mode;
    ctx.fillStyle = atmos.filter.color;
    ctx.fillRect(0, 0, w, viewH);
    ctx.restore();
  }
  // 비네팅 효과
  if (level >= 9) {
    const vignette = ctx.createRadialGradient(
      w / 2,
      viewH / 2,
      viewH * 0.4,
      w / 2,
      viewH / 2,
      viewH,
    );
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, viewH);
  }
  ctx.restore(); // Part A 완료 (클리핑 해제)

  // ==========================================
  // 🧱 PART B: 캐릭터가 서있는 실내 마룻바닥
  // ==========================================

  // 지역/인테리어에 따른 바닥 기본 색상
  let floorColor = "#5D4037"; // 기본 우드
  if (theme === "mars") floorColor = "#3E2723";
  else if (level >= 8)
    floorColor = "#2c2c2c"; // 밤/고급 분위기는 어두운 대리석 톤
  else if (level >= 5) floorColor = "#6D4C41";

  ctx.fillStyle = floorColor;
  ctx.fillRect(0, floorY, w, floorH);

  // 마룻바닥 나무 판자 줄무늬 (반투명한 검은색)
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const plankHeight = 25;
  for (let y = floorY + plankHeight; y < h; y += plankHeight) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // 걸레받이/몰딩 (벽과 바닥 경계선)
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(w, floorY);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 6;
  ctx.stroke();
  // Fill transparent and letterboxed areas with the original background on every frame.
  ImageAssets.draw(ctx, "background." + state.regionId, 0, 0, canvas.width, canvas.height);
}
