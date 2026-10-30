/* Recovery-Structure-1: canonical signboard definitions; game state, input and persistence keep their existing owners. */
function preloadSignImages() {
  for (let i = 0; i <= 9; i++) tryLoadSignImage(i);
}

function tryLoadSignImage(stage) {
  return ImageAssets.load("signboard." + stage);
}

function getSignImage(stage) {
  return ImageAssets.image("signboard." + stage);
}

function signStage() {
  return clampInt(state.upgrades.sign || 0, 0, 5);
}

function signStageName(lvl) {
  const l = clampInt(lvl, 0, 5);
  return [
    "A4 간판",
    "현수막",
    "입간판",
    "부착형 간판",
    "대형 간판",
    "네온사인",
  ][l];
}

function drawSignboard() {
  if (!ctx || !canvas) return;

  // 지점(지역)별 간판 레벨: 업그레이드 "signboard" 레벨을 사용 (0~9)
  const lvl = clampInt(state?.upgrades?.signboard || 0, 0, 9);

  const cx = canvas.width / 2;
  const topY = 64 + canvas.height * 0.12;
  const name = "나이스 치킨";

  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  } catch (_e) {}

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 공통: 모든 간판에 둥둥 떠다니는 효과 적용 (레벨별로 위상차)
  const floatOffset = Math.sin(Date.now() / 800 + lvl) * 5;
  const y = topY + floatOffset;
  const imageWidth = Math.min(canvas.width - 30, 340);
  if (ImageAssets.draw(ctx, "signboard." + lvl, cx-imageWidth/2, y-40, imageWidth, 120)) {
    ctx.restore();
    return;
  }

  // 공통 외곽선 스타일 설정
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";

  switch (lvl) {
    case 0: // 골판지
      ctx.fillStyle = "#8D6E63";
      ctx.beginPath();
      ctx.moveTo(cx - 100, y - 30);
      ctx.lineTo(cx + 100, y - 35);
      ctx.lineTo(cx + 95, y + 35);
      ctx.lineTo(cx - 105, y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // 외곽선 추가

      ctx.font = "20px 'Jua', sans-serif";
      ctx.fillStyle = "#3E2723";
      ctx.fillText(name + " 🐣", cx, y);
      break;

    case 1: // A4 용지
      ctx.fillStyle = "#FFF";
      ctx.fillRect(cx - 90, y - 30, 180, 60);
      ctx.strokeRect(cx - 90, y - 30, 180, 60); // 외곽선 추가

      // 테이프
      ctx.fillStyle = "rgba(200,200,200,0.5)";
      ctx.fillRect(cx - 80, y - 35, 20, 10);
      ctx.fillRect(cx + 60, y - 35, 20, 10);

      ctx.font = "22px 'Jua', sans-serif";
      ctx.fillStyle = "#000";
      ctx.fillText("🐔 " + name, cx, y);
      break;

    case 2: // 나무
      ctx.fillStyle = "#5D4037";
      roundRectPath(cx - 120, y - 35, 240, 70, 5);
      ctx.fill();
      ctx.stroke(); // 외곽선 추가

      // 나무결
      ctx.strokeStyle = "#4E342E";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 100, y - 10);
      ctx.lineTo(cx + 100, y - 10);
      ctx.stroke();

      // 끈
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 80, y - 35);
      ctx.lineTo(cx - 80, y - 60);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 80, y - 35);
      ctx.lineTo(cx + 80, y - 60);
      ctx.stroke();

      ctx.font = "24px 'Jua', sans-serif";
      ctx.fillStyle = "#EFEBE9";
      ctx.fillText("🍗 " + name + " 🍗", cx, y);
      break;

    case 3: // 현수막
      // 끈
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 130, y - 40);
      ctx.lineTo(cx - 130, y - 60);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 130, y - 40);
      ctx.lineTo(cx + 130, y - 60);
      ctx.stroke();

      ctx.fillStyle = "#FFECB3";
      ctx.beginPath();
      ctx.moveTo(cx - 140, y - 40);
      ctx.quadraticCurveTo(cx, y - 30, cx + 140, y - 40);
      ctx.lineTo(cx + 140, y + 30);
      ctx.quadraticCurveTo(cx, y + 40, cx - 140, y + 30);
      ctx.closePath();
      ctx.fill();

      // 현수막 외곽선
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "26px 'Jua', sans-serif";
      ctx.fillStyle = "#D84315";
      ctx.fillText("🔥 " + name + " 🔥", cx, y);
      break;

    case 4: // 천막(어닝)
      ctx.save();
      // 어닝 그림자
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(cx - 120, y + 20, 240, 10);

      // 스트라이프 어닝
      for (let i = -3; i < 3; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#D32F2F" : "#FFF";
        ctx.fillRect(cx + i * 40, y - 45, 40, 50);
      }

      // 전체 어닝 외곽선
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 120, y - 45, 240, 50);

      // 간판 베이스
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - 120, y + 5, 240, 40);
      ctx.strokeRect(cx - 120, y + 5, 240, 40); // 베이스 외곽선

      ctx.font = "24px 'Jua', sans-serif";
      ctx.fillStyle = "#333";
      ctx.fillText("🏠 " + name + " 호프", cx, y + 25);
      ctx.restore();
      break;

    case 5: // 아크릴
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = "#FF9800";
      roundRectPath(cx - 130, y - 35, 260, 70, 15);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke(); // 외곽선

      // 광택
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(cx - 100, y - 15, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "28px 'Jua', sans-serif";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
      ctx.fillText("✨ " + name + " 치킨", cx, y);
      ctx.shadowBlur = 0;
      break;

    case 6: // 네온
      // 배경
      ctx.fillStyle = "rgba(20,20,20,0.9)";
      roundRectPath(cx - 140, y - 40, 280, 80, 20);
      ctx.fill();

      // 배경 외곽선 (흰색으로 구분)
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 네온 프레임
      ctx.shadowColor = "#F50057";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "#FF4081";
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 130, y - 30, 260, 60);

      // 네온 글자
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#E0F7FA";
      ctx.font = "30px 'Jua', sans-serif";
      ctx.fillText("🍻 " + name, cx, y);

      // 깜빡임 효과
      if (Math.random() > 0.95) {
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 0;
        ctx.fillText("🍻 " + name, cx, y);
        ctx.globalAlpha = 1.0;
      }
      ctx.shadowBlur = 0;
      break;

    case 7: // LED 전광판
      // 외관 프레임
      ctx.fillStyle = "#111";
      roundRectPath(cx - 155, y - 40, 310, 80, 5);
      ctx.fill();
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 3;
      ctx.stroke(); // 프레임 외곽선

      // LED 화면
      ctx.fillStyle = "#000";
      ctx.fillRect(cx - 150, y - 35, 300, 70);

      ctx.fillStyle = "rgba(20,20,20,1)";
      for (let x = cx - 150; x < cx + 150; x += 10)
        ctx.fillRect(x, y - 35, 1, 70);

      // 글자
      ctx.shadowColor = "#76FF03";
      ctx.shadowBlur = 10;
      ctx.font = "28px 'Jua', sans-serif";
      ctx.fillStyle = "#76FF03";

      const offset = Math.sin(Date.now() / 500) * 5;
      ctx.fillText("◀ 🛵 " + name + " 🛵 ▶", cx + offset, y);

      ctx.shadowBlur = 0;
      break;

    case 8: // 순금
      const grd = ctx.createLinearGradient(cx - 150, y - 40, cx + 150, y + 40);
      grd.addColorStop(0, "#FDB931");
      grd.addColorStop(0.3, "#FFFFE0");
      grd.addColorStop(0.5, "#D4AF37");
      grd.addColorStop(0.8, "#FDB931");
      grd.addColorStop(1, "#8D6E63");

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = grd;
      roundRectPath(cx - 160, y - 40, 320, 80, 10);
      ctx.fill();
      ctx.restore();

      // 순금 외곽선 (반짝이는 느낌 강조)
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 내부 음각 라인
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      roundRectPath(cx - 150, y - 30, 300, 60, 5);
      ctx.stroke();

      ctx.font = "34px 'Jua', sans-serif";
      ctx.fillStyle = "#5D4037";
      ctx.fillText("👑 " + name + " 👑", cx, y);

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText("👑 " + name + " 👑", cx - 1, y - 1);
      break;

    case 9: // 홀로그램
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.85;

      ctx.fillStyle = "rgba(0,255,255,0.15)";
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 160, y - 30);
      ctx.lineTo(cx + 160, y - 30);
      ctx.lineTo(cx + 140, y + 40);
      ctx.lineTo(cx - 140, y + 40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 홀로그램 외곽 글로우 효과
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(0,255,255,0.1)";
      for (let i = y - 30; i < y + 40; i += 4) {
        ctx.fillRect(cx - 140, i, 280, 1);
      }

      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#E0F7FA";
      ctx.font = "32px 'Jua', sans-serif";
      ctx.fillText("🪐 " + name + " 🛸", cx, y);

      ctx.beginPath();
      ctx.moveTo(cx, topY + 60 + floatOffset); // 빔 시작점도 같이 이동
      ctx.lineTo(cx - 100, y + 40);
      ctx.lineTo(cx + 100, y + 40);

      const beamGrd = ctx.createLinearGradient(
        cx,
        topY + 60 + floatOffset,
        cx,
        y + 40,
      );
      beamGrd.addColorStop(0, "rgba(0,255,255,0)");
      beamGrd.addColorStop(1, "rgba(0,255,255,0.1)");
      ctx.fillStyle = beamGrd;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";
      break;
  }

  ctx.restore();
}
