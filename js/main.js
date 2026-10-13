/* IMP-08: scene, DOM references, renderers and input handlers. Business definitions live in core. */

/* [Boot splash block removed: was duplicated/broken] */

/* =========================================================
   나이스치킨 타이쿤 (최종 통합)
   - 사운드(WebAudio) + 설정 토글
   - 스폰 랜덤 체감(대기열 2x5 그리드) + 선택 손님 중앙 서빙 포인트
   - 문(우측 하단) + leaving 상태로 퇴장 연출
   - 배경: 매장 느낌(카운터/테이블/문)
   - 보스/알바 겹침 해결: 보스 상단, 알바 하단(Y 분리), 크기 소폭 축소
   - 유저 이름(최초 입력): 한글만, 10글자, 빈값 허용 / 헤더&인증서에 그대로 표시
   - 일간 올클 -> 무/양배추 쿠폰(veg) 지급
   - 주간 올클 -> 인증서 발급 가능 / 발급 시 음료 쿠폰(drink) 1장 지급
   - 인증서/쿠폰 사용 -> PIN(0000) + 로그 기록
   - 주간 인증서 "사용 처리" -> PIN 성공 시 주간 초기화 + 로그
   - 5,000만원당 음료쿠폰 1장 교환(상점)
========================================================= */

/* Step 3-2A: SOUND/WebAudio moved to js/core/audio.js */

/* Step 3-4: static config/data moved to js/core/config.js */
// [추가] 배달 이동수단 데이터

// [전역 변수 추가]

// 화면에 지나가는 라이더 연출용
// 다음 배달 간격(ms)
// 배달 비주얼 누적(초)
// 다음 비주얼 라이더 생성 간격(초)

// --- [NEW] Level table auto-generation (up to 50) ---

/* --- [데이터] 가격 인플레이션 적용 --- */

/* --- [NEW] Regions (fixed order) --- */
/* --- [NEW] Regions (fixed order) --- */
// NOTE: 큰 수(조/경 단위) 때문에 Number 정밀도 한계가 있을 수 있으나, 게임 플레이 목적상 허용한다.

/* --- [로직] 가격 계산 (가게확장 + 전체연구 + 메뉴연구) --- */

/* --------------------
   Family staff: shared training/career income, branch-local hiring.
-------------------- */

// 👇👇👇 여기서부터 잃어버린 함수 복구 코드! 복사해서 끼워 넣게! 👇👇👇

// ==========================================
// [NEW] 글로벌 이펙트 및 헬퍼 함수
// ==========================================
window._fxState = {
  boss: { lastClick: 0, taps: 0, buffUntil: 0, buffCount: 0, buffDate: "" },
  staffs: {},
  speech: { type: null, key: null, msg: "", until: 0 },
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

// 0~10 level curve: small gains until 4, big gains from 5+

/* --------------------
   Research
-------------------- */

// [NEW] 인테리어(벽지/바닥) 팔레트 (브랜치별 deco가 있으면 drawBackground에서 우선 적용)

/* --------------------
   DOM refs (Variables)
-------------------- */
// UI Elements
let elMoney, elRep, elLvl, elToday, elTotal, elSelected, elUserName;
let toast, menuGrid;
let modalOffline, offlineEarn, offlineTime;
let upgList,
  resList,
  dailyList,
  weeklyList,
  weeklyStampRow,
  dailyStampRow,
  misGuide,
  weeklyNote;
let eventBanner, eventMsg, eventTimer;
let resStatus, resBar;
let uiDrinkCoupons2,
  uiVegCoupons2,
  benefitLogList,
  uiMoney2,
  uiExchangeCnt,
  certStatus;

// Modals
let modalProfile, modalSettings, modalPin, modalCoupons, modalExchange;
let nameInput, pinInput;

// Share / download (optional UI)
let sharePreview, downloadLink;

// Buttons
let toggleSoundBtn,
  saveNameBtn,
  claimOfflineBtn,
  openCouponsBtn,
  closeCouponsBtn,
  useDrinkCouponBtn,
  useVegCouponBtn,
  useCertDrinkBtn;
let openExchangeBtn,
  closeExchangeBtn,
  doExchangeBtn,
  makeCardBtn,
  clearLogBtn,
  pinOkBtn,
  pinCancelBtn;
let forceSaveBtn, resetAllBtn, closeSettingsBtn;

/* --------------------
   initDOMRefs: 모든 HTML 요소 연결 및 버튼 기능 설정
-------------------- */
function initDOMRefs() {
  if (window.gameInputsBound) return;
  window.gameInputsBound = true;
  // 1. 기본 UI 연결
  elMoney = document.getElementById("uiMoney");
  elRep = document.getElementById("uiRep");
  elLvl = document.getElementById("uiLvl");
  window.uiXpFill = document.getElementById("uiXpFill");
  const lvlPill = document.getElementById("lvlPill");
  if (lvlPill) {
    lvlPill.addEventListener("click", () => {
      const mul = 1 + (Number(state.level) || 0) * 0.1;
      showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`);
    });
  }
  elToday = document.getElementById("uiToday");
  elTotal = document.getElementById("uiTotal");
  elSelected = document.getElementById("uiSelected");
  elUserName = document.getElementById("uiUserName");

  // Mission summary UI (top)
  uiVegCoupons = document.getElementById("uiVegCoupons");
  uiDrinkCoupons = document.getElementById("uiDrinkCoupons");
  uiDailyStampText = document.getElementById("uiDailyStampText");
  uiWeeklyStampText = document.getElementById("uiWeeklyStampText");

  // Stamp summary UI (panels)
  stampCountText = document.getElementById("stampCountText");
  stampRow = document.getElementById("stampRow");

  toast = document.getElementById("toast");
  menuGrid = document.getElementById("menuGrid");

  // 2. 모달 및 패널 연결
  modalOffline = document.getElementById("modalOffline");
  offlineEarn = document.getElementById("offlineEarn");
  offlineTime = document.getElementById("offlineTime");

  modalProfile = document.getElementById("modalProfile");
  modalSettings = document.getElementById("modalSettings");
  modalPin = document.getElementById("modalPin");
  modalCoupons = document.getElementById("modalCoupons");
  modalExchange = document.getElementById("modalExchange");

  nameInput = document.getElementById("nameInput");
  pinInput = document.getElementById("pinInput");

  upgList = document.getElementById("upgList");
  resList = document.getElementById("resList");
  dailyList = document.getElementById("dailyList");
  weeklyList = document.getElementById("weeklyList");
  dailyStampRow = document.getElementById("dailyStampRow");
  weeklyStampRow = document.getElementById("weeklyStampRow");
  weeklyNote = document.getElementById("weeklyNote");
  misGuide = document.querySelector("#panel-mis .note");

  eventBanner = document.getElementById("eventBanner");
  eventMsg = document.getElementById("eventMsg");
  eventTimer = document.getElementById("eventTimer");

  resStatus = document.getElementById("resStatus");
  resBar = document.getElementById("resBar");

  uiDrinkCoupons2 = document.getElementById("uiDrinkCoupons2");
  uiVegCoupons2 = document.getElementById("uiVegCoupons2");
  benefitLogList = document.getElementById("benefitLogList");
  uiMoney2 = document.getElementById("uiMoney2");
  uiExchangeCnt = document.getElementById("uiExchangeCnt");
  certStatus = document.getElementById("certStatus");

  // Optional share UI
  sharePreview = document.getElementById("sharePreview");
  downloadLink = document.getElementById("downloadLink");

  // 3. 버튼 연결
  toggleSoundBtn = document.getElementById("toggleSound");
  saveNameBtn = document.getElementById("saveName");
  claimOfflineBtn = document.getElementById("claimOffline");

  openCouponsBtn = document.getElementById("openCoupons");
  closeCouponsBtn = document.getElementById("closeCoupons");
  useDrinkCouponBtn = document.getElementById("useDrinkCoupon");
  useVegCouponBtn = document.getElementById("useVegCoupon");
  useCertDrinkBtn = document.getElementById("useCertDrink");

  openExchangeBtn = document.getElementById("openExchange");
  closeExchangeBtn = document.getElementById("closeExchange");
  doExchangeBtn = document.getElementById("doExchange");

  makeCardBtn = document.getElementById("makeCard");
  clearLogBtn = document.getElementById("clearLog");
  pinOkBtn = document.getElementById("pinOk");
  pinCancelBtn = document.getElementById("pinCancel");

  forceSaveBtn = document.getElementById("forceSave");
  resetAllBtn = document.getElementById("resetAll");
  closeSettingsBtn = document.getElementById("closeSettings");

  // 4. 이벤트 리스너 연결 (변수가 연결된 후 실행되어야 안전함)
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener(
      "click",
      () => modalSettings && modalSettings.classList.remove("on"),
    );
  }

  if (forceSaveBtn) {
    forceSaveBtn.addEventListener("click", () => {
      const ok = save(true);
      showToast(
        ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.",
      );
    });
  }
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      if (confirm("정말 초기화할까요? (저장 데이터 삭제)")) {
        resetGame();
      }
    });
  }

  if (toggleSoundBtn) {
    toggleSoundBtn.addEventListener("click", () => {
      unlockAudioOnce();
      const next = !state.soundOn;
      state.soundOn = next;
      setSoundEnabled(next);
      toggleSoundBtn.textContent = next ? "ON" : "OFF";
      sfxTick();
      markStateChanged("input-action");
      save(true);
    });
  }

  if (openCouponsBtn) {
    openCouponsBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      if (modalCoupons) modalCoupons.classList.add("on");
      renderCoupons();
    });
  }

  if (openExchangeBtn) {
    openExchangeBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      if (modalExchange) modalExchange.classList.add("on");
      renderExchange();
    });
  }

  if (closeCouponsBtn) {
    closeCouponsBtn.addEventListener(
      "click",
      () => modalCoupons && modalCoupons.classList.remove("on"),
    );
  }
  if (closeExchangeBtn) {
    closeExchangeBtn.addEventListener(
      "click",
      () => modalExchange && modalExchange.classList.remove("on"),
    );
  }

  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      if (confirm("혜택 내역을 정리할까요? (로그만 삭제)")) {
        state.benefitsLog = [];
        markStateChanged("input-action");
        save(true);
        renderCoupons();
        showToast("기록 정리 완료");
      }
    });
  }

  // PIN 입력 관련
  if (pinCancelBtn) {
    pinCancelBtn.addEventListener("click", () => {
      if (modalPin) modalPin.classList.remove("on");
      if (pinResolver) {
        pinResolver(false);
        pinResolver = null;
      }
    });
  }
  if (pinOkBtn) {
    pinOkBtn.addEventListener("click", () => {
      const ok = pinInput && pinInput.value === CONFIG.pin;
      if (modalPin) modalPin.classList.remove("on");
      if (pinResolver) {
        pinResolver(ok);
        pinResolver = null;
      }
    });
  }
  if (pinInput)
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && pinOkBtn) pinOkBtn.click();
    });

  // 이름 저장
  if (saveNameBtn) {
    saveNameBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      const v = ((nameInput && nameInput.value) || "").trim();
      if (!isHangulOnly(v)) {
        showToast("한글만, 최대 10글자까지 가능해요.");
        sfxWrong();
        return;
      }
      state.profile = state.profile || {};
      state.profile.name = v;
      if (modalProfile) modalProfile.classList.remove("on");
      markStateChanged("profile-name");
      save(true);
      updateUI();
      showToast("이름 저장 완료");
      sfxConfirm();
    });
  }

  // 오프라인 수익 수령
  if (claimOfflineBtn) {
    claimOfflineBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      claimOfflineReward();
    });
  }

  // 인증서 및 쿠폰 사용
  if (makeCardBtn) {
    makeCardBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      generateWeeklyCertificate();
    });
  }
  if (useCertDrinkBtn) {
    useCertDrinkBtn.addEventListener("click", async () => {
      unlockAudioOnce();
      startBGM();
      if (!state.cert.issuedThisWeek) {
        showToast("먼저 인증서를 발급하세요!");
        sfxWrong();
        return;
      }
      if (state.coupons.drink <= 0) {
        showToast("사용 가능한 음료 쿠폰이 없어요.");
        sfxWrong();
        return;
      }
      if (
        !confirm(
          "기기 내부 음료 사용 기록을 남길까요?\n공개 로컬 PIN 확인이며 서버/매장 승인이 아닙니다.",
        )
      ) {
        return;
      }
      const ownership = SessionOwner.token();
      const ok = await askPIN();
      if (!SessionOwner.matches(ownership)) return;
      if (!ok) {
        showToast("PIN이 올바르지 않아요.");
        sfxWrong();
        return;
      }
      state.coupons.drink -= 1;
      state.cert.usedAt = Date.now();
      logBenefit({
        type: "drink",
        qty: 1,
        source: "cert_use",
        note: "인증서 로컬 사용 기록 (서버 승인 없음)",
      });
      startNewWeek();
      showToast("✅ 사용되었습니다. 주간 미션이 초기화되었습니다.");
      sfxConfirm();
      markStateChanged("input-action");
      save(true);
      updateUI();
      renderCoupons();
      renderPanel("mis");
      renderPanel("shr");
    });
  }

  if (useDrinkCouponBtn) {
    useDrinkCouponBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      useCoupon("drink");
    });
  }
  if (useVegCouponBtn) {
    useVegCouponBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      useCoupon("veg");
    });
  }

  if (doExchangeBtn) {
    doExchangeBtn.addEventListener("click", () => {
      unlockAudioOnce();
      startBGM();
      const cnt = moneyQuotient(state.money, CONFIG.exchangeUnit);
      if (cnt <= 0) {
        showToast("교환할 돈이 부족해요.");
        sfxWrong();
        return;
      }
      state.money = moneySub(state.money, CONFIG.exchangeUnit);
      state.coupons.drink += 1;
      logBenefit({
        type: "drink",
        qty: 1,
        source: "exchange",
        note: "5,000만원 교환",
      });
      showToast("교환 완료! 음료 쿠폰 +1");
      sfxConfirm();
      markStateChanged("input-action");
      save(true);
      updateUI();
      renderExchange();
      renderCoupons();
    });
  }

  const openMapBtn = document.getElementById("openMap");
  const modalExpansionEl = document.getElementById("modalExpansion");
  if (openMapBtn) {
    openMapBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce();
      startBGM();
      if (modalExpansionEl) modalExpansionEl.classList.add("on");
      renderMapUI();
    });
  }

  const mapGoBtn = document.getElementById("mapGo");
  if (mapGoBtn) {
    mapGoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce();
      startBGM();
      const id = state.mapSelected || state.regionId;
      if (typeof BranchManager !== "undefined" && BranchManager.move)
        BranchManager.move(id);
    });
  }

  const mapUnlockBtn = document.getElementById("mapUnlock");
  if (mapUnlockBtn) {
    mapUnlockBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce();
      startBGM();
      if (typeof BranchManager !== "undefined" && BranchManager.unlockNext)
        BranchManager.unlockNext();
    });
  }

  const mapWrapEl = document.getElementById("mapWrap");
  if (mapWrapEl) {
    mapWrapEl.addEventListener("click", (e) => {
      const node = e.target.closest('.map-node[data-action="select-region"]');
      if (!node || !mapWrapEl.contains(node)) return;
      const id = node.dataset.regionId;
      if (!id) return;
      state.mapSelected = id;
      markStateChanged("map-selection");
      renderMapUI();
    });
  }

  const expansionActionModalEl = document.getElementById("modalExpansion");
  if (expansionActionModalEl) {
    expansionActionModalEl.addEventListener("click", (e) => {
      const btn = e.target.closest(
        '[data-action="move-branch"], [data-action="unlock-branch"]',
      );
      if (!btn || !expansionActionModalEl.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.regionId;
      if (!id) return;
      if (btn.dataset.action === "move-branch") moveBranch(id);
      else if (btn.dataset.action === "unlock-branch") unlockBranch(id);
    });
  }

  const closeExpansionModalBtn = document.getElementById(
    "closeExpansionModalBtn",
  );
  if (closeExpansionModalBtn) {
    closeExpansionModalBtn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof closeExpansionModal === "function") closeExpansionModal();
        else document.getElementById("modalExpansion")?.classList.remove("on");
      },
      { passive: false },
    );
  }

  // 5. Canvas 설정

  // --- Stats modal close (ensure X works on mobile) ---
  const modalStats = document.getElementById("modalStats");
  const closeStatsBtn = document.getElementById("closeStats");
  if (closeStatsBtn) {
    closeStatsBtn.style.pointerEvents = "auto";
    closeStatsBtn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        modalStats?.classList.remove("on");
      },
      { passive: false },
    );
  }
  if (modalStats) {
    modalStats.addEventListener("click", (e) => {
      if (e.target === modalStats) modalStats.classList.remove("on");
    });
  }
  canvas = document.getElementById("stage");
  if (!canvas) throw new Error("stage canvas not found");
  ctx = canvas.getContext("2d");
  // Bind canvas input AFTER canvas exists (prevents boot crash)
  safeOn(canvas, "mousedown", onCanvasDown);
  safeOn(canvas, "touchstart", onCanvasDown, { passive: false });
  if (!ctx) throw new Error("2d context not available");
  window.__lastCtx = ctx;
}
/* --------------------
   Canvas
-------------------- */
let canvas, ctx;
function resizeCanvas() {
  // Defensive: on some mobile browsers resize/orientation events can fire before initDOMRefs()
  const wrap = document.getElementById("stageWrap");
  if (!wrap) return;

  // Ensure canvas/context exist
  if (!canvas) {
    canvas = document.getElementById("stage");
    if (!canvas) return;
  }
  if (!ctx) {
    ctx = canvas.getContext("2d");
    if (!ctx) return;
  }

  const rect = wrap.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width || 1));
  const h = Math.max(1, Math.floor(rect.height || 1));
  canvas.width = w;
  canvas.height = h;
}

// Register once; safe even if resize fires early thanks to guards above
window.addEventListener("resize", resizeCanvas, { passive: true });

/* Step 3-3: pure utility helpers moved to js/core/utils.js */
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("on"), 1200);
}

// 기본: "…원" 포함
// "…만/억/조" 까지만
// 기존 호환
// 기존 호환

/* --------------------
   Panels / Nav
-------------------- */
const navBtns = [...document.querySelectorAll(".navBtn")];
const panels = {
  upg: document.getElementById("panel-upg"),
  res: document.getElementById("panel-res"),
  mis: document.getElementById("panel-mis"),
  shr: document.getElementById("panel-shr"),
};
function closePanels() {
  Object.values(panels).forEach((p) => p.classList.remove("on"));
  navBtns.forEach((b) => b.classList.remove("active"));
}
function openPanel(key) {
  const panel = panels[key];
  if (!panel) return;
  const isOn = panel.classList.contains("on");
  closePanels();
  if (!isOn) {
    sanitizeState();
    panel.classList.add("on");
    const btn = navBtns.find((b) => b.dataset.panel === key);
    if (btn) btn.classList.add("active");
    renderPanel(key);
  }
}
navBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    unlockAudioOnce();
    startBGM();
    openPanel(btn.dataset.panel);
  }),
);

document
  .querySelectorAll("[data-close]")
  .forEach((b) => b.addEventListener("click", closePanels));

/* --------------------
   Settings modal
-------------------- */
safeOn(document.getElementById("openSettings"), "click", () => {
  unlockAudioOnce();
  startBGM();
  modalSettings?.classList.add("on");
});

/* --------------------
   [NEW] Stats modal (Management report)
-------------------- */

function renderRndList() {
  const list = document.getElementById("rndList");
  if (!list) return;
  list.innerHTML = "";

  const openCount = getOpenMenuCount();

  MENUS.slice(0, openCount).forEach((m) => {
    const lvl = state.menuLevels?.[m.id] || 0;
    const cost = menuResearchCost(lvl);

    const div = document.createElement("div");
    div.className = "rnd-item";
    div.innerHTML = `
      <div class="rnd-info">
        <span class="rnd-name">${m.emoji} ${m.name}</span>
        <span class="rnd-lvl">Lv.${lvl} (가격 x${(1 + lvl * 0.5).toFixed(1)})</span>
      </div>
      <button class="rnd-btn" data-action="research-menu" data-menu-id="${m.id}" ${cost === null ? "disabled" : ""} style="pointer-events: auto !important; position: relative; z-index: 2001;">${cost === null ? "최대 단계" : `연구 (${fmtNoWon(cost)})`}</button>
    `;

    const button = div.querySelector(".rnd-btn");
    if (cost !== null) { button.dataset.cost = cost; button.title = moneyExactText(cost) + "원"; }
    list.appendChild(div);
  });
}

function bindRecipeResearchClicks() {
  if (window.__recipeResearchClickBound) return;
  window.__recipeResearchClickBound = true;
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target?.closest?.('[data-action="research-menu"]');
      if (!btn) return;
      const list = document.getElementById("rndList");
      if (list && !list.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function")
        e.stopImmediatePropagation();
      const menuId = btn.dataset.menuId;
      if (!menuId) return;
      unlockAudioOnce();
      if (typeof startBGM === "function") startBGM();
      researchMenu(menuId);
    },
    true,
  );
}
bindRecipeResearchClicks();

// 탭 전환 (위임)
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.(".tab-btn");
  if (!btn) return;
  const wrap = btn.closest("#modalStats");
  if (!wrap) return;

  wrap
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  wrap
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));

  btn.classList.add("active");
  const target = document.getElementById(`tab-${btn.dataset.tab}`);
  if (target) target.classList.add("active");
  if (btn.dataset.tab === "stat-management") renderManagementContent();
});

// 모달 열고 닫기
safeOn(document.getElementById("openStats"), "click", () => {
  unlockAudioOnce();
  if (typeof startBGM === "function") startBGM();
  const modal = document.getElementById("modalStats");
  if (modal) {
    modal.classList.add("on");
    updateStatsUI(); // 👈 여기서 한 번만 호출!
  }
});
safeOn(document.getElementById("closeStats"), "click", () => {
  document.getElementById("modalStats")?.classList.remove("on");
});
// [NEW] Region map
// Step 2-7: openMap is handled by openMapBtn.addEventListener in initDOMRefs().

// ------------------------------
// Expansion (Branch) modal - Angry Birds style cards
function openExpansionModal() {
  unlockAudioOnce();
  startBGM();
  const m = document.getElementById("modalExpansion");
  if (!m) return;
  m.classList.add("on");
  renderMapUI();
}

function closeExpansionModal() {
  const m = document.getElementById("modalExpansion");
  if (m) m.classList.remove("on");
}

// thin wrappers so inline onclick works safely
function moveBranch(id) {
  BranchManager.move(id);
  closeExpansionModal();
}
function unlockBranch(id) {
  // Only allow unlocking in order (previous region must be unlocked)
  const idx = REGIONS.findIndex((r) => r.id === id);
  if (idx < 0) return;
  if (state.regionUnlocked && state.regionUnlocked[id]) {
    showToast("이미 오픈한 지역입니다!");
    return;
  }
  const prev = REGIONS[idx - 1];
  if (prev && !(state.regionUnlocked && state.regionUnlocked[prev.id])) {
    showToast("이전 지역을 먼저 해금하세요!");
    return;
  }
  const loc = REGIONS[idx];
  const need = loc.unlockCost || 0;
  if (moneyCompare(state.money, need) < 0) {
    showToast("자금이 부족합니다!");
    sfxWrong();
    return;
  }
  unlockAudioOnce();
  startBGM();
  state.money = moneySub(state.money, need);
  state.regionUnlocked = state.regionUnlocked || {};
  state.regionUnlocked[id] = true;

  BranchManager.ensure(id); // allocate branch slot
  markStateChanged("main");
  save(true);
  updateUI();
  renderMapUI();
  showToast(`${loc.name} 오픈을 축하합니다! 🎉`);
  sfxConfirm();
}

function renderExpansionCards() {
  const container = document.getElementById("expansionList");
  if (!container) return;
  container.innerHTML = "";

  REGIONS.forEach((loc, idx) => {
    const isUnlocked = !!(state.regionUnlocked && state.regionUnlocked[loc.id]);
    const isCurrent = state.regionId === loc.id;
    const prev = REGIONS[idx - 1];
    const isNext =
      !isUnlocked &&
      (!prev || (state.regionUnlocked && state.regionUnlocked[prev.id]));

    const card = document.createElement("div");
    card.className = `loc-card ${!isUnlocked ? "locked" : ""} ${isCurrent ? "current" : ""}`;

    const emoji =
      loc.icon || ["🏡", "🌊", "🏙️", "🌸", "🗽", "🏰", "🪐"][idx] || "🚩";

    let badgeHtml = "";
    if (isCurrent)
      badgeHtml = `<div class="loc-badge" style="background:var(--primary);">영업중</div>`;
    else if (isUnlocked)
      badgeHtml = `<div class="loc-badge" style="background:#2EC4B6;">보유중</div>`;
    else badgeHtml = `<div class="loc-badge">잠김</div>`;

    let btnHtml = "";
    if (isCurrent) {
      btnHtml = `<button class="btn gray loc-btn" disabled>현재 위치</button>`;
    } else if (isUnlocked) {
      btnHtml = `<button class="btn alt loc-btn" data-action="move-branch" data-region-id="${loc.id}" type="button">이동하기 🚀</button>`;
    } else {
      if (isNext) {
        const canAfford = moneyCompare(state.money, loc.unlockCost || 0) >= 0;
        const costText = fmtWon(loc.unlockCost || 0);
        btnHtml = `<button class="btn loc-btn" ${canAfford ? "" : "disabled"} data-action="unlock-branch" data-region-id="${loc.id}" type="button">${costText} 오픈 🔓</button>`;
      } else {
        btnHtml = `<button class="btn gray loc-btn" disabled>이전 지역 필요 🔒</button>`;
      }
    }

    card.innerHTML = `
      ${badgeHtml}
      <div class="loc-emoji">${emoji}</div>
      <div class="loc-name">${loc.name}</div>
      <div class="loc-desc">
        수익 배율: <b style="color:#d35400">x${(loc.priceMul || 1).toFixed ? (loc.priceMul || 1).toFixed(1).replace(/\.0$/, "") : loc.priceMul || 1}</b><br>
        ${isUnlocked ? "인테리어/직원 별도 관리" : "새로운 시작, 더 큰 수익!"}
      </div>
      ${btnHtml}
    `;
    container.appendChild(card);
  });
}

// stats 모달 배경 클릭 시 닫기(✕ 버튼이 레이어에 가려져도 안전)
safeOn(document.getElementById("modalStats"), "click", (e) => {
  const dim = document.getElementById("modalStats");
  if (e.target === dim) {
    dim.classList.remove("on");
  }
});
// ------------------------------
// Safety binder (prevents crashes if an element is missing in some layout)

safeOn(
  document.getElementById("closeSettings"),
  "click",
  () => modalSettings && modalSettings.classList.remove("on"),
);
// Step 2-10: forceSaveBtn handled once in initDOMRefs().
// Step 2-10: resetAllBtn handled once in initDOMRefs().
// Step 2-10: toggleSoundBtn handled once in initDOMRefs().
// Step 2-9: openCouponsBtn handled once in initDOMRefs().
// Step 2-9: openExchangeBtn handled once in initDOMRefs().
// Step 2-8A: closeCouponsBtn handled once in initDOMRefs().
// Step 2-8A: closeExchangeBtn handled once in initDOMRefs().
// Step 2-9: clearLogBtn handled once in initDOMRefs().

/* --------------------
   Icon explanations
-------------------- */
safeOn(document.getElementById("statMoney"), "click", () =>
  showToast("💰 보유 금액: 업그레이드/연구/확장/교환상점에 사용해요."),
);
safeOn(document.getElementById("statRep"), "click", () =>
  showToast("⭐ 평점(0~5): 손님 이탈/오답 시 하락, 정확 서빙 시 상승!"),
);
let __infoTimer = 0;
function showInfoToast(title, rows) {
  const el = document.getElementById("infoToast");
  if (!el) return;
  if (__infoTimer) clearTimeout(__infoTimer);

  const rowHtml = (rows || [])
    .map(
      (r) =>
        `<div style="opacity:.85;">${r[0]}</div><div style="text-align:right; font-weight:700;">${r[1]}</div>`,
    )
    .join("");
  el.innerHTML = `<div style="font-weight:800; margin-bottom:4px;">${title}</div><div class="grid">${rowHtml}</div>`;
  el.classList.add("on");
  __infoTimer = setTimeout(() => {
    el.classList.remove("on");
  }, 3000);
}

safeOn(document.getElementById("statLvl"), "click", () =>
  showInfoToast("🏢 매장 레벨", [
    ["기준", "누적 매출(온라인+오프라인)"],
    ["효과", "단가/콘텐츠 확장"],
    ["팁", "누적을 늘리면 성장!"],
  ]),
);
safeOn(document.getElementById("statToday"), "click", () =>
  showInfoToast("📆 오늘 매출", [
    ["범위", "접속 중(온라인)"],
    ["리셋", "매일 0시"],
    ["스탬프", "일간 목표 달성에 사용"],
  ]),
);
safeOn(document.getElementById("statTotal"), "click", () => {
  const p = state.play || { onlineSecTotal: 0, offlineSecTotal: 0 };
  const online = fmtDuration(p.onlineSecTotal);
  const offline = fmtDuration(p.offlineSecTotal);
  const total = fmtDuration((p.onlineSecTotal || 0) + (p.offlineSecTotal || 0));
  const sum = getLifetimeSales();
  showInfoToast("📈 누적 매출 / 시간", [
    ["누적 매출", fmtCompactWon(sum)],
    ["온라인 시간", online],
    ["오프라인 시간", offline],
    ["총 플레이", total],
  ]);
});

/* --------------------
   PIN modal helper
-------------------- */
let pinResolver = null;
function askPIN() {
  if (!SessionOwner.canMutate()) return false;
  return new Promise((resolve) => {
    pinResolver = resolve;
    pinInput.value = "";
    modalPin.classList.add("on");
    pinInput.focus();
  });
}
// Step 2-8B: pinCancelBtn handled once in initDOMRefs().
// Step 2-8B: pinOkBtn handled once in initDOMRefs().
safeOn(pinInput, "keydown", (e) => {
  if (e.key === "Enter" && pinOkBtn) pinOkBtn.click();
});
/* --------------------
   Profile name (first run)
-------------------- */
function maybeAskName() {
  if (state.profile && typeof state.profile.name === "string") {
    // 최초 1회만 강제: namePrompted flag 없이 "name이 undefined/null"일 때만 띄움.
    // 단, 빈값도 저장 가능 -> 빈값이면 다시 띄우지 않음.
    return;
  }
}
// Step 2-10: saveNameBtn handled once in initDOMRefs().

/* --------------------
   pickMenuByRule
   - 해금된 메뉴만 주문
   - 동일 확률
-------------------- */
function pickMenuByRule() {
  const unlocked = getOrderMenuPool();
  return unlocked[Math.floor(Math.random() * unlocked.length)];
}

/* --------------------
   Menu grid (3x3)
-------------------- */
function handleMenuGridServe(btn) {
  if (!btn) return;
  applyElementFX(btn);
  unlockAudioOnce();
  startBGM();
  sfxTick();
  if (btn.dataset.locked === "1" || btn.disabled) {
    showToast("아직 잠긴 메뉴예요! (업그레이드: 메뉴 확장)");
    return;
  }
  const menuId = btn.dataset.menuId;
  if (!menuId) return;
  serveByMenu(menuId);
}

function buildMenuGrid() {
  menuGrid.innerHTML = "";

  const openCount = getOpenMenuCount();

  MENUS.forEach((m, idx) => {
    const locked = idx >= openCount;

    const btn = document.createElement("button");
    btn.className = "menuBtn";
    btn.disabled = locked;
    btn.dataset.action = "serve-menu";
    btn.dataset.menuId = m.id;
    btn.dataset.locked = locked ? "1" : "0";

    const emoji = locked ? "🔒" : m.emoji;
    const nameText = locked ? "잠김" : m.name;
    const shownPrice = getMenuPrice(m.id);
    const priceText = locked ? "업그레이드로 해금" : ` ${fmtWon(shownPrice)}`;

    btn.innerHTML = `
      <div class="top">
        <div class="emoji">${emoji}</div>
        <div class="name">${nameText}</div>
      </div>
      <div class="price">${priceText}</div>
    `;

    menuGrid.appendChild(btn);
  });
}

const menuGridEl = document.getElementById("menuGrid");
if (menuGridEl) {
  menuGridEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="serve-menu"]');
    if (!btn || !menuGridEl.contains(btn)) return;
    e.preventDefault();
    handleMenuGridServe(btn);
  });
}

const upgListEl = document.getElementById("upgList");
if (upgListEl) {
  upgListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || !upgListEl.contains(btn)) return;
    const action = btn.dataset.action;
    if (action === "buy-upgrade") {
      e.preventDefault();
      const upgradeId = btn.dataset.upgradeId;
      if (!upgradeId) return;
      unlockAudioOnce();
      if (typeof startBGM === "function") startBGM();
      buyUpgrade(upgradeId);
      return;
    }
    if (action === "buy-staff-upgrade") {
      e.preventDefault();
      const staffKey = btn.dataset.staffKey;
      const kind = btn.dataset.kind;
      if (!staffKey || !kind) return;
      buyStaffUpgrade(staffKey, kind);
    }
  });
}

const resListEl = document.getElementById("resList");
if (resListEl) {
  resListEl.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="start-research"]');
    if (!btn || !resListEl.contains(btn)) return;
    e.preventDefault();
    const researchId = btn.dataset.researchId;
    if (!researchId) return;
    unlockAudioOnce();
    if (typeof startBGM === "function") startBGM();
    startResearch(researchId);
  });
}

/* --------------------
   Stage layout helpers
-------------------- */
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

/* --------------------
   Customers spawn + move
-------------------- */
function spawnCustomer() {
  if (!SessionOwner.canMutate()) return false;
  const rates = computeRates();
  if (state.customers.length >= CONFIG.maxCustomers) return;

  const menu = pickMenuByRule();
  const id = "c_" + Math.random().toString(36).slice(2, 10);

  // 상단에서 아래로 내려오는 랜덤 체감 (좌우 폭을 넓게)
  const spawnX = Math.random() * (canvas.width - 60) + 30;
  const spawnY = -40;

  const speed =
    CONFIG.walkSpeedMin +
    Math.random() * (CONFIG.walkSpeedMax - CONFIG.walkSpeedMin);

  state.customers.push({
    id,
    menuId: menu.id,
    menuName: menu.name,
    emoji: CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)],

    patience: rates.patienceSec,
    patienceMax: rates.patienceSec,
    enteredAt: Date.now(),

    state: "waiting", // waiting | leaving
    x: spawnX,
    y: spawnY,
    tx: spawnX,
    ty: spawnY,
    r: 30,
    speed,
  });

  if (!state.selectedCustomerId) {
    state.selectedCustomerId = id;
  }
}

function layoutTargets() {
  const slots = waitingSlots();
  const selId = state.selectedCustomerId;
  let slotIdx = 0;

  for (const c of state.customers) {
    if (c.state === "leaving") {
      const d = doorRect();
      c.tx = d.cx;
      c.ty = d.cy;
      continue;
    }
    if (c.id === selId) {
      const sp = serveSpot();
      c.tx = sp.x;
      c.ty = sp.y;
      continue;
    }
    const s = slots[slotIdx % slots.length];
    slotIdx++;
    c.tx = s.x;
    c.ty = s.y;
  }
}

function moveCustomers(dt) {
  layoutTargets();
  for (let i = state.customers.length - 1; i >= 0; i--) {
    const c = state.customers[i];
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      c.x = c.tx;
      c.y = c.ty;
      if (c.state === "leaving") {
        // 문에 도착하면 제거
        state.customers.splice(i, 1);
        if (state.selectedCustomerId === c.id) {
          state.selectedCustomerId = state.customers[0]?.id || null;
        }
      }
      continue;
    }
    const step = c.speed * dt;
    const t = Math.min(1, step / dist);
    c.x += dx * t;
    c.y += dy * t;
  }
}

function pickCustomerAt(px, py) {
  for (let i = state.customers.length - 1; i >= 0; i--) {
    const c = state.customers[i];
    const dx = px - c.x,
      dy = py - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) return c;
  }
  return null;
}
function selectCustomer(id) {
  state.selectedCustomerId = id;
}

/* --------------------
   Serve logic
-------------------- */
let floats = [];
let bossParticles = [];
let bossFlash = 0; // screen flash alpha (0~1)

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

// 2. updateBossParticles 함수 교체
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

// 1) 배달/온라인 주문 텍스트 띄우기
function showFloatingText(x, y, text) {
  floatText(text, x, y, "#fff");
}

// 2) 터치 충돌 판정
function hitCircle(tx, ty, cx, cy, r) {
  const dx = tx - cx;
  const dy = ty - cy;
  return dx * dx + dy * dy < r * r;
}

// 3) 보스(사장님) 위치 계산
// ==========================================
// 👆 1. 터치 및 이펙트 글로벌 상태 (에러 완벽 차단)
// ==========================================
window._fxState = {
  boss: { taps: 0, buffUntil: 0, lastClick: 0, buffCount: 0, buffDate: "" },
  staffs: {},
  speech: { type: null, key: null, msg: "", until: 0 },
};

// ==========================================
// 🎯 2. 터치 영역(Hitbox) 대폭 확대
// ==========================================
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

// ==========================================
// 💥 3. 터치 발동 로직 (안전망 적용)
// ==========================================
function triggerBossFX() {
  const now = Date.now();

  // 글로벌 버프 체크
  if (isGlobalBuffActive("boss")) {
    showToast("🚫 쉿! 다른 사람이 활약 중이에요!");
    return;
  }

  window._fxState.boss.lastClick = now;

  const today =
    typeof dayKey === "function" ? dayKey() : new Date().toDateString();
  if (window._fxState.boss.buffDate !== today) {
    window._fxState.boss.buffDate = today;
    window._fxState.boss.buffCount = 0;
  }

  const isBuff = window._fxState.boss.buffUntil > now;

  if (!isBuff) {
    window._fxState.boss.taps += 1;

    if (window._fxState.boss.taps >= 20) {
      window._fxState.boss.taps = 0;
      if (window._fxState.boss.buffCount < 5) {
        window._fxState.boss.buffCount++;
        window._fxState.boss.buffUntil = now + 10000; // 10초간 매출 2배
        showToast(
          `🔥 사장님 극대노! 10초간 매출 2배! (${window._fxState.boss.buffCount}/5)`,
        );
        floatText("🔥🔥🔥", canvas.width / 2, canvas.height / 2, "#FF5252");
        if (typeof sfxFanfare === "function") sfxFanfare();

        const msg = "다 팔아버려!!! 🔥";
        window._fxState.speech = {
          type: "boss",
          key: "boss",
          msg: msg,
          until: now + 3000,
        };
      } else {
        showToast("💦 오늘 사장님 체력 방전! (내일 다시 가능)");
      }
    }
  } else {
    const msg = "더 빠르게!!! 🔥";
    window._fxState.speech = {
      type: "boss",
      key: "boss",
      msg: msg,
      until: now + 2000,
    };
  }
}

function triggerStaffFX(key) {
  const now = Date.now();
  if (isGlobalBuffActive(key)) {
    showToast("🚫 쉿! 다른 사람이 활약 중이에요!");
    return;
  }
  if (!window._fxState.staffs[key]) {
    window._fxState.staffs[key] = {
      lastClick: 0,
      taps: 0,
      buffUntil: 0,
      dailyUses: 0,
    };
  }
  const sfx = window._fxState.staffs[key];
  const sInfo = STAFF_POOL.find((s) => s.key === key);
  sfx.lastClick = now;

  if (sfx.buffUntil > now) return;
  if (now - sfx.lastClick > 2000) sfx.taps = 0;
  sfx.taps += 1;

  if (sfx.taps >= 10) {
    sfx.taps = 0;
    sfx.buffUntil = now + 5000;
    const lines = sInfo.lines || ["화이팅!"];
    const msg = lines[Math.floor(Math.random() * lines.length)];
    window._fxState.speech = {
      type: "staff",
      key: key,
      msg: msg,
      until: now + 3000,
    };
    if (typeof sfxDing === "function") sfxDing();
  }
}

// 6) UI 이펙트
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

/* --------------------
   Events
-------------------- */
function maybeTriggerEvent() {
  if (state.event) return;
  if (Math.random() < CONFIG.eventRollChancePerCheck) {
    const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    state.event = {
      id: evt.id,
      name: evt.name,
      desc: evt.desc,
      mod: evt.mod,
      endAt: Date.now() + evt.durationSec * 1000,
    };
    markStateChanged("main");
    showToast(`이벤트 시작! ${evt.name}`);
    sfxFanfare();
    if (_saveDirty) save(true);
  }
}
function updateEvent() {
  if (!state.event) {
    eventBanner.classList.remove("on");
    return;
  }
  const left = state.event.endAt - Date.now();
  if (left <= 0) {
    showToast(`이벤트 종료: ${state.event.name}`);
    state.event = null;
    markStateChanged("main");
    eventBanner.classList.remove("on");
    if (_saveDirty) save(true);
    return;
  }
  eventMsg.textContent = `${state.event.name} - ${state.event.desc}`;
  eventTimer.textContent = `남은 ${Math.ceil(left / 1000)}s`;
  eventBanner.classList.add("on");
}

/* --------------------
   Reputation & leaves
-------------------- */
function updateCustomers(dt) {
  markStateChanged("customer-reputation", false);
  const rates = computeRates();
  const eff = rates.eff;

  for (const c of state.customers) {
    if (c.state === "leaving") continue;
    c.patience -= dt;
    if (c.patience <= 0) {
      // 시간초과 -> 문으로 퇴장
      c.state = "leaving";
      if (state.selectedCustomerId === c.id) {
        const next = state.customers.find(
          (x) => x.state !== "leaving" && x.id !== c.id,
        );
        state.selectedCustomerId = next ? next.id : null;
      }
      const leaveLoss = CONFIG.repLossOnLeave + (eff.leaveRepLossAdd || 0);
      state.rep = clamp(state.rep - leaveLoss, CONFIG.repMin, CONFIG.repMax);
      floatText("😡 나감!", c.x, c.y - 60, "#FF6B6B");
      sfxWrong();
    }
  }

  const waitingCount = state.customers.filter(
    (c) => c.state !== "leaving",
  ).length;

  if (waitingCount === 0) {
    state.rep = clamp(
      state.rep + CONFIG.repRecoverIdlePerSec * dt,
      CONFIG.repMin,
      CONFIG.repMax,
    );
  } else if (waitingCount >= Math.floor(CONFIG.maxCustomers * 0.8)) {
    state.rep = clamp(
      state.rep - CONFIG.repDecayCrowdPerSec * dt,
      CONFIG.repMin,
      CONFIG.repMax,
    );
  }
}

/* --------------------
   Spawn loop
-------------------- */

// [추가] 배달 업데이트 로직 (state.delivery 기반)

// [추가] 배달 업데이트 로직 (state.delivery 기반)

// [추가] 온라인 주문(자동) 수익

/* --------------------
   Level up
-------------------- */

function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

/* --------------------
   Save/Load + Offline
-------------------- */

function ensureSaveTransferUI() {
  const modal = document.getElementById("modalSettings");
  const box = modal ? modal.querySelector(".modal") : null;
  if (!box || document.getElementById("saveTransferBox")) return;

  const card = document.createElement("div");
  card.className = "card";
  card.id = "saveTransferBox";
  card.style.cssText =
    "margin:10px 0; flex-direction:column; align-items:stretch; gap:8px;";
  card.innerHTML = `
    <div class="info" style="width:100%;">
      <h4 style="margin:0;">💾 수동 백업 / 불러오기</h4>
      <p style="margin-top:5px;">저장 데이터를 복사해 보관하거나, 백업 JSON을 붙여넣어 복구합니다.</p>
    </div>
    <textarea id="saveTransferText" rows="5" placeholder="백업 JSON이 여기에 표시되거나, 불러올 JSON을 붙여넣으세요." style="width:100%; box-sizing:border-box; resize:vertical; font-size:12px;"></textarea>
    <div class="row">
      <button class="btn alt" id="exportSaveBtn">백업 만들기</button>
      <button class="btn gray" id="copySaveBtn">복사</button>
    </div>
    <div class="row">
      <button class="btn" id="importSaveBtn">백업 불러오기</button>
      <button class="btn gray" id="clearSaveTransferBtn">내용 지우기</button>
    </div>
    <div class="note">※ 다른 기기/브라우저로 옮길 때는 백업 만들기 → 복사 → 별도 메모장에 보관하세요.</div>
  `;

  const note = box.querySelector(":scope > .note");
  if (note) box.insertBefore(card, note);
  else box.appendChild(card);

  const text = card.querySelector("#saveTransferText");
  const exportBtn = card.querySelector("#exportSaveBtn");
  const copyBtn = card.querySelector("#copySaveBtn");
  const importBtn = card.querySelector("#importSaveBtn");
  const clearBtn = card.querySelector("#clearSaveTransferBtn");
  const bind = (el, evt, fn) => {
    if (typeof safeOn === "function") safeOn(el, evt, fn);
    else if (el && typeof el.addEventListener === "function")
      el.addEventListener(evt, fn);
  };

  bind(exportBtn, "click", () => {
    const raw = exportSaveData();
    if (!raw) {
      showToast("백업 생성에 실패했어요.");
      return;
    }
    text.value = raw;
    text.focus();
    text.select();
    showToast("백업 JSON을 만들었어요.");
  });

  bind(copyBtn, "click", async () => {
    if (!text.value.trim()) {
      text.value = exportSaveData();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text.value);
      } else {
        text.focus();
        text.select();
        document.execCommand("copy");
      }
      showToast("백업 JSON을 복사했어요.");
    } catch (e) {
      console.error("[save-export] clipboard failed", e);
      text.focus();
      text.select();
      showToast("복사 실패! 직접 전체 선택 후 복사해 주세요.");
    }
  });

  bind(importBtn, "click", () => {
    importSaveData(text.value);
  });

  bind(clearBtn, "click", () => {
    text.value = "";
    showToast("백업 입력창을 비웠어요.");
  });
}

// Step 2-10: claimOfflineBtn handled once in initDOMRefs().

/* --------------------
   Certificate status + actions
-------------------- */
function certStatusText() {
  if (!state.missions.weeklyCompletedAt) {
    return {
      okIssue: false,
      okUse: false,
      msg: "주간 미션을 아직 올클하지 않았어요.",
    };
  }
  if (state.cert.usedAt) {
    return {
      okIssue: false,
      okUse: false,
      msg: "이 인증서는 이미 사용 처리되었습니다. (주간이 초기화되어야 새로 발급 가능)",
    };
  }
  if (state.cert.issuedThisWeek) {
    const leftDays = state.cert.validUntil
      ? Math.ceil((state.cert.validUntil - Date.now()) / 86400000)
      : 0;
    if (state.cert.validUntil && Date.now() > state.cert.validUntil) {
      return {
        okIssue: false,
        okUse: false,
        msg: "인증서 유효기간이 만료됐어요. (새 주간을 진행해 주세요)",
      };
    }
    return {
      okIssue: false,
      okUse: state.coupons.drink > 0,
      msg: `인증서 발급 완료 ✅ (유효 ${Math.max(0, leftDays)}일)`,
    };
  }
  return { okIssue: true, okUse: false, msg: "주간 올클! 인증서 발급 가능 ✅" };
}

// Step 2-9: makeCardBtn handled once in initDOMRefs().

// Step 2-9: useCertDrinkBtn handled once in initDOMRefs().

function roundRect2(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.arcTo(x + w, y, x + w, y + h, r);
  ctx2.arcTo(x + w, y + h, x, y + h, r);
  ctx2.arcTo(x, y + h, x, y, r);
  ctx2.arcTo(x, y, x + w, y, r);
  ctx2.closePath();
}

/* --------------------
   Coupons / exchange
-------------------- */

// Step 2-9: useDrinkCouponBtn handled once in initDOMRefs().
// Step 2-9: useVegCouponBtn handled once in initDOMRefs().

function renderCoupons() {
  uiDrinkCoupons2.textContent = state.coupons.drink;
  uiVegCoupons2.textContent = state.coupons.veg;

  benefitLogList.innerHTML = "";
  const logs = state.benefitsLog || [];
  if (logs.length === 0) {
    benefitLogList.textContent = "기록이 없어요.";
    return;
  }
  const lines = logs.slice(0, 30).map((l) => {
    const label = l.type === "drink" ? "음료" : "무/양배추";
    return `• [${l.at}] ${label} x${l.qty} (${l.source}) ${l.note ? "- " + l.note : ""}`;
  });
  benefitLogList.innerHTML = lines.join("<br>");
}

function renderExchange() {
  uiMoney2.textContent = fmtWon(state.money);
  const cnt = moneyQuotient(state.money, CONFIG.exchangeUnit);
  uiExchangeCnt.textContent = cnt;
  doExchangeBtn.disabled = cnt <= 0;
}

// Step 2-9: doExchangeBtn handled once in initDOMRefs().

/* --------------------
   Rendering: background / sign / door / tables / staff / customers
-------------------- */
// [Signboard Image Loader]
// Put optional square(1:1) sign images next to this html (or in ./assets/).
// Naming convention (recommended):
//   assets/sign_0.png, assets/sign_1.png, ... assets/sign_5.png
// You can also use .jpg instead of .png.
// If an image file is missing, the game falls back to the default drawn signboard.

function preloadSignImages() {
  for (let i = 0; i < SIGN_STAGES_MAX; i++) {
    tryLoadSignImage(i);
  }
}
function tryLoadSignImage(stage) {
  const slot = SIGN_IMAGES[stage];
  if (slot.tried && slot.ok) return;
  const candidates = SIGN_IMAGE_CANDIDATES[stage];
  if (!candidates || slot.idx >= candidates.length) {
    slot.tried = true;
    slot.ok = false;
    slot.img = null;
    return;
  }
  const src = candidates[slot.idx++];
  const img = new Image();
  img.onload = () => {
    slot.img = img;
    slot.ok = true;
    slot.tried = true;
  };
  img.onerror = () => {
    tryLoadSignImage(stage);
  };
  img.src = src;
}
function getSignImage(stage) {
  const slot = SIGN_IMAGES[stage];
  return slot && slot.ok && slot.img ? slot.img : null;
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
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

// ==========================================
// [NEW] 사장님 & 알바생 전용 고퀄리티 말풍선 (손님용과 분리)
// ==========================================
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
  ctx.fillText("👩‍🍳", 0, -20);

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
    ctx.fillText(s.emoji, 0, -10);

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

const _BG_CACHE = { key: null, data: null };
function _bgSeededRand(seed) {
  // LCG
  let s = seed >>> 0;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ==========================================
// 🎨 아트 배경 스튜디오 (그래픽 헬퍼 함수)
// ==========================================
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
      ctx.fillText(c.emoji || "🙂", c.x, c.y);
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
    ctx.fillText(c.emoji || "🙂", c.x, c.y);
    ctx.restore();

    // speech bubble (selected should be drawn LAST in whole scene)
    const bubbleScale = isSelected ? 1.25 : 1.0; // selected bubble a bit bigger
    drawSpeechBubble(c.x, c.y - 52, `(${c.menuName})`, bubbleScale, isSelected);

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

    ctx.fillText(r.emoji, r.x, r.y + jitter);
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

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX =
    e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clientY =
    e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

  // [핵심] 화면 크기와 캔버스 내부 해상도의 비율 차이를 계산해서 터치 좌표 보정
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function onCanvasDown(e) {
  if (!SessionOwner.canMutate()) return false;
  if (
    document.querySelector(".panel.on") ||
    document.querySelector(".dim.on")
  ) {
    return;
  }

  e.preventDefault();
  // 사운드 잠금 해제 및 BGM 시작 (사용자 경험 보장)
  if (typeof unlockAudioOnce === "function") unlockAudioOnce();
  if (typeof startBGM === "function") startBGM();

  const p = getCanvasPoint(e);

  // 1. 사장님 판정 (hitY 기준)
  const b = bossCenter();
  if (hitCircle(p.x, p.y, b.x, b.hitY || b.y, b.r)) {
    triggerBossFX();
    try {
      if (typeof bossBurst === "function")
        bossBurst(b.x, b.y - 30, 10 + Math.floor(Math.random() * 14));
    } catch (e) {}
    if (typeof sfxTick === "function") sfxTick();
    return; // 사장님 눌렸으면 여기서 종료
  }

  // 2. 알바생 판정 (반복문으로 모든 알바생 검사)
  const staffs = staffCenters();
  for (const s of staffs) {
    if (hitCircle(p.x, p.y, s.x, s.hitY || s.y, s.r)) {
      triggerStaffFX(s.key);
      // 알바생 터치 텍스트 효과 (💥 이모지 대신 텍스트로 변경 가능)
      floatText("👍", s.x, s.y - 60, "#FFD700");
      if (typeof sfxTick === "function") sfxTick();
      return; // 알바생 눌렸으면 여기서 종료
    }
  }

  // 3. 손님 판정 (캐릭터들이 안 눌렸을 때만 실행)
  const c = pickCustomerAt(p.x, p.y);
  if (c && c.state !== "leaving") {
    selectCustomer(c.id);
    const hintEl = document.getElementById("hint");
    if (hintEl) hintEl.style.display = "none";
    floatText("주문 확인!", c.x, c.y - 60, "#2EC4B6");
    if (typeof sfxTick === "function") sfxTick();
    if (typeof updateUI === "function") updateUI();
  }
}
/* --------------------
   UI update + panels
-------------------- */

// ==========================================
// 🛠️ 패널 렌더링 통합 함수 (renderPanel)
// ==========================================
/// ==========================================
// 🛠️ 패널 렌더링 통합 관리 (renderPanel) - 완전체 버전
// ==========================================
let upgradeButtons = [];
function renderPanel(key) {
  sanitizeState();
  const upgList = document.getElementById("upgList");
  const resList = document.getElementById("resList"); // 연구 리스트용 별도 ID 대응
  if (!upgList) return;

  // 패널을 새로 그릴 때 기존 내용을 깨끗이 비움
  upgList.innerHTML = "";
  upgradeButtons = [];

  // --- [1] 업그레이드 패널 (upg) ---
  if (key === "upg") {
    const groups = {};
    for (const u of UPGRADES) (groups[u.cat] ||= []).push(u);

    for (const cat of Object.keys(groups)) {
      const h = document.createElement("div");
      h.style.margin = "8px 2px 10px";
      h.style.color = "#555";
      h.style.fontSize = "0.95rem";
      h.textContent = `— ${cat} —`;
      upgList.appendChild(h);

      for (const u of groups[cat]) {
        const lvl = state.upgrades[u.id] || 0;
        const maxL = u.maxLevel ?? 99;
        const cost = upgradeCost(u.id, lvl);
        const can = lvl < maxL && moneyCompare(state.money, cost) >= 0;

        const div = document.createElement("div");
        div.className = "card";
        div.innerHTML = `
          <div class="info">
            <h4>${u.name} <span style="color:var(--primary);">Lv.${lvl}/${maxL}</span></h4>
            <p>${u.desc}</p>
            <div class="cost">${lvl >= maxL ? "최대 레벨" : fmtWon(cost)}</div>
          </div>
          <button class="btn" ${can ? "" : "disabled"}>${lvl >= maxL ? "완료" : "구매"}</button>
        `;
        const upgBtn = div.querySelector("button");
        if (upgBtn) {
          upgradeButtons.push(upgBtn);
          upgBtn.dataset.action = "buy-upgrade";
          upgBtn.dataset.upgradeId = u.id;
          upgBtn.dataset.cost = cost;
          upgBtn.title = moneyExactText(cost) + "원";
        }
        upgList.appendChild(div);
      }
    }

    // 알바생 개별 관리 UI (업그레이드 탭 하단)
    const hireCount = getStaffCount();
    if (hireCount > 0) {
      const staffHeader = document.createElement("div");
      staffHeader.className = "note";
      staffHeader.style.cssText =
        "margin: 20px 0 10px; font-size: 1.1rem; font-weight: bold; color: #333;";
      staffHeader.innerHTML = `👥 알바 관리 <span style="font-size:0.9rem; color:#666;">(${hireCount}명)</span>`;
      upgList.appendChild(staffHeader);
      const scopeNote = document.createElement("div");
      scopeNote.className = "note";
      scopeNote.textContent =
        "고용은 지점별 · 교육과 직원 누적 수익은 전체 지점 공용";
      scopeNote.style.marginBottom = "12px";
      upgList.appendChild(scopeNote);

      ensureStaffStats();
      STAFF_POOL.slice(0, hireCount).forEach((s) => {
        const st = state.staffStats[s.key] || { auto: 0, tip: 0, earned: 0 };
        const card = document.createElement("div");
        card.className = "card";
        card.style.flexDirection = "column";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:10px;">
            <div style="font-weight:bold;">${s.emoji} ${s.label}</div>
            <div style="font-size:0.85rem; color:#666;">전체 지점 누적: ${fmtWon(st.earned)}</div>
          </div>
          <div style="display:flex; gap:8px; width:100%;">
            <button class="btn" id="btn-auto-${s.key}" style="flex:1; background:#fff; color:#333; border:1px solid #ddd;">👟속도 Lv.${st.auto}</button>
            <button class="btn" id="btn-tip-${s.key}" style="flex:1; background:#fff; color:#333; border:1px solid #ddd;">💖매력 Lv.${st.tip}</button>
          </div>
        `;
        upgList.appendChild(card);
        const autoBtn = card.querySelector(`#btn-auto-${s.key}`);
        if (autoBtn) {
          autoBtn.dataset.action = "buy-staff-upgrade";
          autoBtn.dataset.staffKey = s.key;
          autoBtn.dataset.kind = "auto";
        }
        const tipBtn = card.querySelector(`#btn-tip-${s.key}`);
        if (tipBtn) {
          tipBtn.dataset.action = "buy-staff-upgrade";
          tipBtn.dataset.staffKey = s.key;
          tipBtn.dataset.kind = "tip";
        }
        for (const [kind, button] of [
          ["auto", autoBtn],
          ["tip", tipBtn],
        ]) {
          const cost = staffUpgradeCost(s.key, kind, st[kind]);
          button.dataset.cost = cost;
          button.title = moneyExactText(cost) + "원";
          button.appendChild(document.createElement("br"));
          button.appendChild(document.createTextNode(fmtWon(cost)));
          button.disabled = st[kind] >= 10 || moneyCompare(state.money, cost) < 0;
        }
      });
    }
  }

  // --- [2] 연구 패널 (res) ---
  else if (key === "res") {
    // 연구 패널 전용 리스트 초기화 (resList가 있으면 거길 비우고, 없으면 upgList 사용)
    const targetList = resList || upgList;
    targetList.innerHTML = "";

    for (const r of RESEARCH) {
      const lvl =
        state.research.levels && state.research.levels[r.id]
          ? state.research.levels[r.id]
          : 0;
      const maxL = r.maxLevel || 10;
      const done = lvl >= maxL;
      const runningSlot = state.research.running.find(
        (s) => s.activeId === r.id,
      );
      const running = !!runningSlot;

      const nextLvl = Math.min(maxL, lvl + 1);
      const base = r.baseMin ?? r.minutes ?? 10;
      const scale = r.timeScale ?? 1.35;
      const nextMin = Math.round(base * Math.pow(scale, nextLvl - 1));

      const EFFECT_LABEL = {
        earningMul: "전체 매출",
        leaveRepLossAdd: "평점 하락 방어",
        staffSpeedMul: "직원 속도",
        ordersMul: "주문 유입",
        patienceMul: "손님 인내심",
        onlineMul: "온라인 매출",
        deliveryMul: "배달 매출",
        wrongPatiencePenaltyMul: "오답 패널티 완화",
        baseAutoAdd: "기본 자동 운영",
        eventAutoResist: "이벤트 자동운영 방어",
        talkRepAdd: "친절 평점",
      };

      const effTxt = Object.keys(r.effectPerLevel || {})
        .map((k) => {
          const v = r.effectPerLevel[k];
          const label = EFFECT_LABEL[k] || "효과";
          const sign = v >= 0 ? "+" : "";
          return Math.abs(v) < 1
            ? `${label} ${sign}${Math.round(v * 100)}%`
            : `${label} ${sign}${v}`;
        })
        .slice(0, 3)
        .join(" · ");

      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="info">
          <h4>${r.name} <span style="color:#666;">Lv.${lvl}/${maxL}</span> ${done ? '<span style="color:#999;">(완료)</span>' : ""}</h4>
          <p>${r.desc}</p>
          <div class="cost">⏱ 다음 Lv.${nextLvl}: ${nextMin}분 ${effTxt ? `<span style="color:#999;">(${effTxt})</span>` : ""}</div>
        </div>
        <button class="btn alt">${done ? "완료됨" : running ? "진행중" : "연구 시작"}</button>
      `;
      const btn = div.querySelector("button");
      btn.disabled = done || running;
      btn.dataset.action = "start-research";
      btn.dataset.researchId = r.id;
      targetList.appendChild(div);
    }

    const s = document.createElement("div");
    s.className = "note";
    s.style.marginTop = "8px";
    s.textContent = `현재 연구 슬롯: ${state.research.slots}개 (업그레이드 ‘연구대 확장’으로 2개까지)`;
    targetList.appendChild(s);
  }

  // --- [3] 미션 패널 (mis) ---
  else if (key === "mis") {
    misGuide.innerHTML = `
      <b>📌 스탬프 받는 방법</b><br>
      1) <b>일간 미션 8개</b>를 모두 완료하면 <b>주간 스탬프 +1</b> (하루 1회)<br>
      2) <b>주간 스탬프 7/7</b> + <b>주간 미션 올클</b> 시 인증서 발급 가능<br>
      <span style="color:#666;">※ 미션 진행은 접속 중(온라인 플레이)에서만 반영됩니다.</span>
    `;
    dailyList.innerHTML = "";
    for (const m of state.missions.dailyList)
      dailyList.appendChild(missionRow(m));

    weeklyList.innerHTML = "";
    for (const m of state.missions.weeklyList)
      weeklyList.appendChild(weeklyRow(m));

    const st = certStatusText();
    weeklyNote.innerHTML = `주간 올클 시 인증서 발급이 가능해요.<br><span style="color:#555;">현재: ${st.msg}</span>`;
  }

  // --- [4] 인증서 패널 (shr) ---
  else if (key === "shr") {
    const st = certStatusText();
    certStatus.textContent = st.msg;
    makeCardBtn.disabled = !st.okIssue && !state.cert.issuedThisWeek;
    useCertDrinkBtn.disabled = !(
      state.cert.issuedThisWeek &&
      state.coupons.drink > 0 &&
      !state.cert.usedAt
    );
  }
} // 👈 여기서 모든 로직이 안전하게 종료됨!

function missionValueLabel(m, v) {
  // 돈 관련 미션은 한글 단위로 표시
  if (m.type === "earn" || m.type === "sales") return fmtWon(v);
  // 나머지는 숫자
  return String(v);
}
function missionProgressLine(m) {
  const cur = m.current ?? m.progress ?? 0;
  const target = m.target ?? 0;
  return `진행: ${missionValueLabel(m, cur)} / ${missionValueLabel(m, target)}`;
}

function missionRow(m) {
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="info">
      <h4>${m.title}</h4>
      <p>${missionProgressLine(m)}</p>
      <div class="cost">올클 보상: 무/양배추 쿠폰 1장 (하루 1번)</div>
    </div>
    <button class="btn" disabled>${m.done ? "완료" : "진행중"}</button>
  `;
  return wrap;
}

function weeklyRow(m) {
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="info">
      <h4>${m.title}</h4>
      <p>${missionProgressLine(m)}</p>
      <div class="cost">올클 시: 인증서 발급 가능</div>
    </div>
    <button class="btn" disabled>${m.done ? "완료" : "진행중"}</button>
  `;
  return wrap;
}

/* --------------------
   Tick/Loop
-------------------- */
let acc = 0;
let last = performance.now();
let rAF_ID = null; // prevent loop duplication
/* --------------------
   Boss FX / Pattern (Step 4-1)
   - Purely additive: never blocks gameplay
-------------------- */
let _bossAnim = {
  t0:
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now(),
  msg: null,
  msgUntil: 0,
  shakeUntil: 0,
};

// short speech bubble helper (non-fatal)
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

function startGameLoop() {
  if (rAF_ID) cancelAnimationFrame(rAF_ID);
  acc = 0;
  last = performance.now();
  try {
    checkEndingCondition();
  } catch (e) {}
  rAF_ID = requestAnimationFrame(frame);
}
/* --------------------
   Global crash guard (no user-facing stack traces)
-------------------- */

// 연속 에러 카운터 추가

function frame(now) {
  const dt = Math.min(CONFIG.maxFrameDt, (now - last) / 1000);
  last = now;
  acc += dt;

  while (acc >= CONFIG.fixedStep) {
    try {
      tick(CONFIG.fixedStep);
      updateFloats(CONFIG.fixedStep);
      updateBossParticles(CONFIG.fixedStep);
    } catch (e) {
      console.error("tick error", e);
      if (
        !window.__lastTickErrAt ||
        Date.now() - window.__lastTickErrAt > 1500
      ) {
        window.__lastTickErrAt = Date.now();
        try {
          showToast("⚠️ 오류로 루프가 잠시 복구되었습니다. (콘솔 확인)");
        } catch (_) {}
      }
    }
    acc -= CONFIG.fixedStep;
  }
  try {
    render();
  } catch (e) {
    console.error("render error", e);
  }
  if (SessionOwner.canMutate()) state._lastFrameAt = Date.now();
  rAF_ID = requestAnimationFrame(frame);
}
// boss fx tick (never throws)
try {
  updateBoss(dt);
} catch (e) {}

/* ==========================================================
   ENDING (손주) 시스템
   - 조건: money >= ENDING_MONEY (100해)
   - 팝업: "나이스 치킨 게임의 엔딩 조건에 도달하였습니다. 엔딩을 보시겠습니까?"
   - 엔딩 사운드: END_SOUND.* 루핑, 엔딩 종료 시 페이드아웃
   - 엔딩 완료 보상: 로봇 손주(🤖) + 매출 50% + 손님 유입 50%
========================================================== */
// 999 무량대수(근사)

// condition check: called each frame

// bind buttons after DOM ready

/* --------------------
   Close settings
-------------------- */
// Splash (fast greeting)

/* --- [NEW] Map UI (Angry Birds unlock feel) --- */
function renderMapUI() {
  const wrap = document.getElementById("mapWrap");
  const hint = document.getElementById("mapHint");
  const btnGo = document.getElementById("mapGo");
  const btnUn = document.getElementById("mapUnlock");
  if (!wrap) return;

  state.regionUnlocked = state.regionUnlocked || { changnyeong: true };
  if (!state.regionUnlocked.changnyeong)
    state.regionUnlocked.changnyeong = true;
  if (!state.regionId) state.regionId = "changnyeong";
  if (!state.mapSelected) state.mapSelected = state.regionId;

  wrap.innerHTML = "";
  const curId = state.regionId;
  const selId = state.mapSelected;

  REGIONS.forEach((r, idx) => {
    const unlocked = !!state.regionUnlocked[r.id];
    const node = document.createElement("div");
    node.className =
      "map-node" +
      (unlocked ? "" : " locked") +
      (r.id === selId ? " active" : "");
    node.dataset.action = "select-region";
    node.dataset.regionId = r.id;
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-pressed", String(r.id === selId));

    const left = document.createElement("div");
    left.className = "map-left";
    left.innerHTML = `
      <div class="map-badge">${r.icon}</div>
      <div>
        <div class="map-title">${idx + 1}. ${r.name}</div>
        <div class="map-sub">${unlocked ? (r.id === curId ? "현재 영업중" : "이동 가능") : "잠금"}</div>
      </div>
    `;

    const right = document.createElement("div");
    right.className = "map-cost";
    if (unlocked) {
      right.textContent = `x${r.priceMul.toFixed(1)}`;
    } else {
      right.textContent = `해금 ${fmtCompact(r.unlockCost || 0)}`;
    }

    node.appendChild(left);
    node.appendChild(right);
    wrap.appendChild(node);
  });

  // Buttons state
  const curIdx = getRegionIndex(curId);
  const next = getNextRegion();
  const nextLocked = !state.regionUnlocked[next.id];

  if (btnGo) {
    btnGo.disabled = !state.regionUnlocked[selId];
    btnGo.style.opacity = btnGo.disabled ? 0.6 : 1;
  }
  if (btnUn) {
    btnUn.disabled = !nextLocked || curId === next.id;
    btnUn.style.opacity = btnUn.disabled ? 0.6 : 1;
  }

  if (hint) {
    if (curId === REGIONS[REGIONS.length - 1].id) {
      hint.textContent = "최종 지역에 도달했습니다. 🚀";
    } else {
      hint.textContent = `다음 해금: ${next.name} (비용 ${fmtCompact(next.unlockCost || 0)})`;
    }
  }
}

function updateUI() {
  beginEffectBatch();
  // Defensive UI update: missing DOM refs should NOT stop the game
  try {
    const setText = setTextIfChanged;

    setText(elMoney, fmtCompact(state.money));
    if (elMoney) elMoney.title = moneyExactText(state.money) + "원";
    setText(elRep, state.rep.toFixed(1));
    setText(elLvl, state.level);
    // XP bar (based on lifetime sales threshold)
    try {
      const total = getLifetimeSales();
      const lvl = Math.max(1, Number(state.level) || 1);
      const arr = CONFIG.levelUpTotalSales || [];
      const curReq = arr[lvl] ?? 0;
      const nextReq = arr[lvl + 1] ?? curReq;
      const pct =
        lvl >= CONFIG.maxLevel ? 1 : moneyCompare(nextReq, curReq) > 0
          ? moneyRatio(moneySub(total, curReq), moneySub(nextReq, curReq))
          : 0;
      if (window.uiXpFill)
        window.uiXpFill.style.width = (pct * 100).toFixed(1) + "%";
    } catch (e) {}

    setText(elToday, fmtWon(state.todaySales));
    setText(elTotal, fmtWon(getLifetimeSales()));
    setText(elSelected, state.selectedCustomerId ? "있음" : "없음");

    // 이름 표시: 입력한 내용만 그대로, 빈값이면 공백
    const uname = (state.profile?.name || "").trim();
    setText(elUserName, uname ? `👤 ${uname}` : "");

    setText(uiVegCoupons, state.coupons?.veg ?? 0);
    setText(uiDrinkCoupons, state.coupons?.drink ?? 0);

    if (toggleSoundBtn)
      if (toggleSoundBtn)
        toggleSoundBtn.textContent = state.soundOn ? "ON" : "OFF";

    setText(stampCountText, state.stamps ?? 0);
    renderStampRow(
      stampRow,
      3,
      (state.stamps ?? 0) % 3,
      "★",
      "rgba(255,107,107,.95)",
    );
    renderStampRow(
      dailyStampRow,
      state.missions.dailyList.length,
      state.missions.dailyStamps ?? 0,
      "🐔",
      "rgba(255,107,107,.95)",
    );
    renderStampRow(
      weeklyStampRow,
      7,
      state.missions.weeklyStamps ?? 0,
      "🐔",
      "rgba(255,159,28,.95)",
    );

    // cert status + buttons
    if (typeof certStatusText === "function") {
      const st = certStatusText();
      if (certStatus) certStatus.textContent = st.msg;
      if (makeCardBtn)
        makeCardBtn.disabled = !st.okIssue && !state.cert?.issuedThisWeek;
      if (useCertDrinkBtn)
        useCertDrinkBtn.disabled = !(
          state.cert?.issuedThisWeek &&
          (state.coupons?.drink ?? 0) > 0 &&
          !state.cert?.usedAt
        );
    }

    updateEconomyUI();
    renderManagementContent();

    // coupons modal quick sync
    setText(uiDrinkCoupons2, state.coupons?.drink ?? 0);
    setText(uiVegCoupons2, state.coupons?.veg ?? 0);
  } catch (e) {
    console.error("updateUI error", e);
  } finally {
    endEffectBatch();
  }
}

function updateStatsUI() {
  try {
    // Null-safe: 리포트가 열릴 때 데이터가 비어 있어도 절대 에러로 멈추지 않게 함
    state.menuStats ||= {};
    state.menuLevels ||= {};
    state.contrib ||= { player: 0, staff: 0, system: 0 };
    state.todaySales ||= 0;
    state.offlineSalesToday ||= 0;
    state.totalSales ||= 0;
    state.offlineSalesTotal ||= 0;
    const online = state?.todaySales || 0;
    const offline = state?.offlineSalesToday || 0;
    const totalAll = getLifetimeSales();

    const el = (id) => document.getElementById(id);

    if (el("rptOnline")) el("rptOnline").innerText = fmtWon(online);
    if (el("rptOffline")) el("rptOffline").innerText = fmtWon(offline);
    if (el("rptTodayTotal"))
      el("rptTodayTotal").innerText = fmtWon(moneyAdd(online, offline));
    if (el("rptTotalAll")) el("rptTotalAll").innerText = fmtWon(totalAll);

    const contrib = state?.contrib || { player: 0, staff: 0, system: 0 };
    if (el("rptContribPlayer"))
      el("rptContribPlayer").innerText = fmtWon(contrib.player || 0);
    if (el("rptContribStaff"))
      el("rptContribStaff").innerText = fmtWon(contrib.staff || 0);
    if (el("rptContribSys"))
      el("rptContribSys").innerText = fmtWon(contrib.system || 0);

    renderMenuStats();
    renderManagementContent();

    // R&D 탭은 기존 로직 유지(있으면)
    try {
      if (typeof renderRndList === "function") renderRndList();
    } catch (e) {}
  } catch (e) {
    console.error("[updateStatsUI]", e);
  }
}

function tick(dt) {
  if (!SessionOwner.canTick()) return;
  if (PwaRuntime.applying) return;
  markStateChanged("active-branch-tick");
  beginEffectBatch();
  try {
    // failsafe: prevent NaN accumulators
    if (!isFinite(state._spawnAcc)) state._spawnAcc = 0;
    if (!isFinite(state._autoServeAcc)) state._autoServeAcc = 0;
    if (!isFinite(state._saveAcc)) state._saveAcc = 0;
    if (!isFinite(state._eventCheckAcc)) state._eventCheckAcc = 0;
    // Valid decimal amounts survive every tick. Invalid external values cannot poison ledgers.
    for (const key of ["money", "todaySales", "totalSales"])
      if (!isMoney(state[key])) state[key] = 0;
    // online playtime accumulation
    if (state.play && typeof state.play.onlineSecTotal === "number")
      state.play.onlineSecTotal += dt;
    ensureMissionReset();
    processPayroll();
    ensureResearchSlots();
    ensureStaffStats();

    state._eventCheckAcc += dt;
    if (state._eventCheckAcc >= CONFIG.eventCheckIntervalSec) {
      state._eventCheckAcc = 0;
      maybeTriggerEvent();
    }
    updateEvent();

    try {
      spawnLoop(dt);
    } catch (e) {
      console.error("spawn error", e);
    }
    updateOnlineAuto(dt);
    try {
      updateDelivery(dt, Date.now());
    } catch (e) {
      console.error("delivery error", e); /* 방치형 루프 중단 방지 */
    }
    try {
      moveCustomers(dt);
    } catch (e) {
      console.error("move error", e);
    }

    try {
      updateCustomers(dt);
    } catch (e) {
      console.error("customers error", e);
    }
    try {
      autoServe(dt);
    } catch (e) {
      console.error("autoserve error", e);
    }

    try {
      updateMissionsOnlineOnly();
    } catch (e) {
      console.error("missions error", e);
    }
    try {
      updateResearch();
    } catch (e) {
      console.error("research error", e);
    }
    checkEndingCondition();

    state._saveAcc += dt;
    if (state._saveAcc >= CONFIG.autosaveSec) {
      state._saveAcc = 0;
      if (_saveDirty) save(true);
    }

    updateUI();
  } finally {
    endEffectBatch();
  }
}

const stampRowKeys = new WeakMap();
function setTextIfChanged(element, value) {
  const text = String(value ?? "");
  if (element && element.textContent !== text) element.textContent = text;
}
function renderStampRow(element, count, filled, symbol, color) {
  if (!element) return;
  const key = [count, filled, symbol, color].join("|");
  if (stampRowKeys.get(element) === key) return;
  element.replaceChildren();
  for (let i = 0; i < count; i++) {
    const cell = document.createElement("div");
    cell.style.cssText =
      "height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;border:1px solid #eee";
    cell.style.background = i < filled ? color : "#f3f3f3";
    cell.style.color = i < filled ? "#fff" : "#aaa";
    cell.textContent = i < filled ? symbol : i + 1;
    element.append(cell);
  }
  stampRowKeys.set(element, key);
}
