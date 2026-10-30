/* Recovery-Structure-1: canonical characters definitions; game state, input and persistence keep their existing owners. */
function drawStaffSpeechBubble(x, y, text, isBoss) {
  ctx.save();
  ctx.font = "16px 'Jua', sans-serif";
  const metrics = ctx.measureText(text);
  const w = metrics.width + 20;
  const h = 34;
  const r = 10;

  // 화면 밖으로 나가지 않도록 x좌표 보정
  const safeX = Math.max(w / 2 + 10, Math.min(x, canvas.width - w / 2 - 10));

  ctx.fillStyle = isBoss ? "white" : "#fff9c4";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;

  // 말풍선 본체
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(safeX - w / 2, y - h / 2, w, h, r);
  else ctx.rect(safeX - w / 2, y - h / 2, w, h);
  ctx.fill();
  ctx.stroke();

  // 꼬리
  ctx.beginPath();
  ctx.moveTo(safeX, y + h / 2);
  ctx.lineTo(x, y + h / 2 + 8);
  ctx.lineTo(safeX + (x > safeX ? 5 : -5), y + h / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 0;
  ctx.fillText(text, safeX, y + 2);
  ctx.restore();
}

function drawBoss(charY) {
  if (!ctx || !canvas) return;

  // [수정 핵심 1] performance.now()를 빼고 무조건 Date.now()로 통일!
  const now = Date.now();
  const h = canvas.height;
  const w = canvas.width;
  const floorH = Math.max(70, Math.floor(h * 0.12));
  const floorY = h - floorH;

  const baseX = Math.floor(w * 0.5);
  const baseY = Math.floor(isFinite(charY) ? charY : floorY - 58);

  const bob = Math.sin(now / 260) * 4;
  const bossX = baseX;
  const bossY = baseY + bob;

  const fx = window._fxState?.boss || {};

  // 남은 시간 계산 (이제 정상적으로 줄어듦)
  const bossBuffRemaining = Math.max(0, (fx.buffUntil || 0) - now);
  const isBossBuff = bossBuffRemaining > 0;

  let bossBaseScale = 1.0;
  if (isBossBuff) {
    bossBaseScale = 2.0 + Math.sin(now * 0.02) * 0.1;
  }

  const bossClickScale = getClickScale(fx.lastClick || 0);
  const bossFinalScale = bossBaseScale * bossClickScale;

  ctx.save();
  ctx.translate(bossX, bossY);
  ctx.scale(bossFinalScale, bossFinalScale);
  ctx.font = "60px 'Jua', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!ImageAssets.draw(ctx, "character.boss", -30, -50, 60, 60)) ctx.fillText("👩‍🍳", 0, -20);

  if (isBossBuff) {
    ctx.font = "20px sans-serif";
    ctx.fillText("🔥", -40, -10);
    ctx.fillText("🔥", 40, -10);
  }

  ctx.font = "16px 'Jua', sans-serif";
  ctx.fillStyle = isBossBuff ? "#FF5252" : "white";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
  ctx.fillText(isBossBuff ? "극대노!" : "사장님", 0, 20);
  ctx.restore();

  if (isBossBuff) {
    const barW = 120;
    const barH = 10;
    const barX = bossX - barW / 2;
    const barY = bossY - 140;

    ctx.save();
    ctx.translate(bossX, barY - 25 + Math.sin(now * 0.01) * 5);
    ctx.font = "bold 24px 'Jua', sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "#FF0000";
    ctx.shadowBlur = 10;
    ctx.textAlign = "center";
    ctx.fillText("💸 매출 2배 💸", 0, 0);
    ctx.restore();

    // [수정 핵심 2] 사장님 버프는 10초(10000ms)이므로 10000으로 나누고 최대 1을 넘지 못하게 잠금!
    const ratio = Math.min(1, bossBuffRemaining / 10000);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 5);
    else ctx.rect(barX, barY, barW, barH);
    ctx.fill();

    let barColor = "#76FF03";
    if (ratio < 0.6) barColor = "#FFEB3B";
    if (ratio < 0.3) barColor = "#FF1744";

    ctx.fillStyle = barColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, barW * ratio, barH, 5);
    else ctx.rect(barX, barY, barW * ratio, barH);
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  const speech = window._fxState?.speech || {};
  if (speech.type === "boss" && speech.until > now) {
    const bubbleY = isBossBuff ? bossY - 230 : bossY - 85;
    drawStaffSpeechBubble(bossX, bubbleY, speech.msg, true);
  }
}

function drawStaff(y) {
  if (!ctx || !canvas) return;
  // [수정] 알바생도 무조건 Date.now()로 통일!
  const now = Date.now();
  ctx.save();

  const staffs = staffCenters();
  if (staffs.length === 0) {
    ctx.restore();
    return;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < staffs.length; i++) {
    const s = staffs[i];
    const sFx = window._fxState?.staffs[s.key] || {
      lastClick: 0,
      buffUntil: 0,
      dailyUses: 0,
    };

    const buffRemaining = Math.max(0, (sFx.buffUntil || 0) - now);
    const isBuffed = buffRemaining > 0;
    const isExhausted = (sFx.dailyUses || 0) >= 5;

    let baseScale = 1.0;
    if (isBuffed) {
      baseScale = 1.3 + Math.sin(now * 0.015) * 0.05;
    }
    const clickScale = getClickScale(sFx.lastClick || 0);
    const finalScale = baseScale * clickScale;

    const bob = Math.sin(now / 300 + i) * 3;
    let cy = s.y + bob;

    ctx.save();
    ctx.translate(s.x, cy);
    ctx.scale(finalScale, finalScale);

    ctx.font = "50px 'Jua', sans-serif";
    ctx.fillStyle = "#000";
    const imageId = "staff." + s.key + (s.key === "grandson" && s.emoji === "🤖" ? ".robot" : "");
    if (!ImageAssets.draw(ctx, imageId, -25, -35, 50, 50)) ctx.fillText(s.emoji, 0, -10);

    ctx.font = "14px 'Jua', sans-serif";
    ctx.fillStyle = isBuffed ? "#FFD700" : isExhausted ? "#bbb" : "#eee";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(s.label, 0, 25);

    ctx.font = "10px sans-serif";
    ctx.shadowBlur = 0;
    if (!isExhausted) {
      ctx.fillStyle = "#fff";
      ctx.fillText(`${sFx.dailyUses || 0}/5`, 0, 40);
    } else {
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText("End", 0, 40);
    }
    ctx.restore();

    if (isBuffed) {
      const barW = 80;
      const barH = 8;
      const barX = s.x - barW / 2;
      const barY = cy - 90;
      // [수정] 알바생 이펙트는 5초(5000ms) 기준이므로 5000으로 나누기
      const ratio = Math.min(1, buffRemaining / 5000);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 4);
      else ctx.rect(barX, barY, barW, barH);
      ctx.fill();

      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW * ratio, barH, 4);
      else ctx.rect(barX, barY, barW * ratio, barH);
      ctx.fill();

      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#FF5252";
      ctx.textAlign = "center";
      ctx.fillText("x2", s.x, barY - 5);
    }

    const speech = window._fxState?.speech || {};
    if (speech.type === "staff" && speech.key === s.key && speech.until > now) {
      const bubbleY = isBuffed ? cy - 150 : cy - 85;
      drawStaffSpeechBubble(s.x, bubbleY, speech.msg, false);
    }
  }
  ctx.restore();
}

function drawSpeechBubble(x, y, text, scale = 1.0, isSelected = false) {
  // 둥실둥실 애니메이션 (선택 손님은 더 활발)
  const now = performance.now();
  const floatDist = isSelected ? 4 : 2;
  const bobbing = Math.sin((now / 300) * (isSelected ? 1.5 : 1)) * floatDist;

  const finalY = y - 10 + bobbing;

  ctx.save();

  ctx.font = `bold ${Math.round(15 * scale)}px 'Jua', sans-serif`;
  const padX = 12 * scale;
  const padY = 8 * scale;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 16 * scale;

  const w = textWidth + padX * 2;
  const h = textHeight + padY * 2;

  const bx = x - w / 2;
  const by = finalY - h;

  // 그림자
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  // 둥근 말풍선 + 꼬리 (roundRect 의존성 제거)
  const r = 10 * scale;
  const tailW = 8 * scale;
  const tailH = 8 * scale;

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + w - r, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
  ctx.lineTo(bx + w, by + h - r);
  ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);

  // 꼬리
  ctx.lineTo(bx + w / 2 + tailW, by + h);
  ctx.lineTo(bx + w / 2, by + h + tailH);
  ctx.lineTo(bx + w / 2 - tailW, by + h);

  ctx.lineTo(bx + r, by + h);
  ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();

  if (isSelected) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#FF9F1C";
    ctx.lineWidth = 2.5;
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
  }

  ctx.fill();

  // 테두리는 그림자 끄고
  ctx.shadowColor = "transparent";
  ctx.stroke();

  // 텍스트
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isSelected ? "#000" : "#333";
  ctx.fillText(text, bx + w / 2, by + h / 2 + 1);

  ctx.restore();
}

function drawCustomers() {
  const selId = state.selectedCustomerId;
  const list = Array.isArray(state.customers) ? state.customers : [];

  const drawOne = (c, isSelected) => {
    // leaving이면 반투명
    if (c.state === "leaving") {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.font = "42px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!ImageAssets.draw(ctx, ImageAssets.customerId(c.emoji), c.x-21, c.y-21, 42, 42)) ctx.fillText(c.emoji || "🙂", c.x, c.y);
      ctx.restore();
      return;
    }

    // selected ring (under the avatar, but still visible)
    if (isSelected) {
      const t = performance.now() / 1000;
      const pulse = 1 + 0.1 * Math.sin(t * 6.0);
      const r1 = 40 * pulse;
      const r2 = 32 * pulse;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 215, 0, 0.95)";
      ctx.lineWidth = 10;
      ctx.shadowColor = "rgba(255, 215, 0, 0.85)";
      ctx.shadowBlur = 18;
      ctx.arc(c.x, c.y - 6, r1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 90, 95, 0.9)";
      ctx.lineWidth = 6;
      ctx.arc(c.x, c.y - 6, r2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // avatar
    ctx.save();
    ctx.font = "42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!ImageAssets.draw(ctx, ImageAssets.customerId(c.emoji), c.x-21, c.y-21, 42, 42)) ctx.fillText(c.emoji || "🙂", c.x, c.y);
    ctx.restore();

    // One order label follows the selected customer; other arrivals add no duplicate labels.
    if (isSelected)
      drawSpeechBubble(c.x, c.y - 52, `(${c.menuName})`, 1.25, true);

    // patience bar
    const w = 52,
      h = 7;
    const pct = clamp(c.patience / c.patienceMax, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(c.x - w / 2, c.y + 14, w, h);
    ctx.fillStyle = pct > 0.42 ? "#2EC4B6" : "#FF6B6B";
    ctx.fillRect(c.x - w / 2, c.y + 14, w * pct, h);
  };

  // draw non-selected first
  for (const c of list) {
    if (selId && c.id === selId) continue;
    drawOne(c, false);
  }
  // draw selected last (top layer)
  if (selId) {
    const c = list.find((x) => x.id === selId);
    if (c) drawOne(c, true);
  }
}

function drawDeliveryLayer(now) {
  // 라이더가 없으면 도로/연출 생략
  if (!state.delivery || (state.delivery.riders || 0) <= 0) return;

  const ctx = canvas.getContext("2d");

  // --- 단일 레인(도로) + 라이더는 도로 "위"로 달림 ---
  // 고객/직원/문과 겹침 방지: 카운터 위쪽 구간에 고정
  const roadY = canvas.height - 175; // 도로 기준선(얇은 1줄)
  const riderYBase = roadY - 18; // 라이더는 도로 위쪽으로
  const roadStartX = 0;
  const roadEndX = canvas.width - 140; // 우측 '문' 영역 비우기

  ctx.save();

  // 도로 바닥(아주 얇게)
  ctx.strokeStyle = "rgba(0,0,0,0.20)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(roadStartX + 10, roadY);
  ctx.lineTo(roadEndX, roadY);
  ctx.stroke();

  // 중앙 점선 느낌(가벼운 재미)
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(roadStartX + 10, roadY);
  ctx.lineTo(roadEndX, roadY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 출발/도착 표식
  ctx.font = "18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("🏪", 10, roadY - 14);
  ctx.textAlign = "right";
  ctx.fillText("🏠", roadEndX, roadY - 14);

  // 라이더들 그리기 (이모지 크기: 기존의 절반 수준 유지)
  const fontSize = 22; // 절반
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const r of visualRiders) {
    // 살짝 덜덜거림
    const jitter = Math.sin(now / 60 + (r.phase || 0)) * 1.6;

    // 차량 등급별 이펙트(간단/가독성 우선)
    if (r.fx) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.font = `${Math.max(14, Math.floor(fontSize * 0.75))}px sans-serif`;
      ctx.fillText(r.fx, r.x - 14, r.y + jitter + 2);
      ctx.restore();
    }

    if (!ImageAssets.draw(ctx, ImageAssets.vehicleId(r.emoji, r.vehicleId), r.x-fontSize/2, r.y+jitter-fontSize/2, fontSize, fontSize)) ctx.fillText(r.emoji, r.x, r.y + jitter);
  }

  // 상태 HUD (작고 깔끔)
  const v = VEHICLES[clampInt(state.delivery.level || 0, 0, 9)];
  ctx.save();
  ctx.font = "14px Jua";
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    `${v.emoji} ${v.name} | 라이더 ${state.delivery.riders || 0}명`,
    12,
    roadY - 44,
  );
  ctx.restore();

  ctx.restore();
}
