/* Recovery-Structure-1: DOM/input, gameplay control and panels. Scene definitions live in js/scene; business rules remain in core. */

/* [Boot splash block removed: was duplicated/broken] */

/* =========================================================
   나이스치킨 타이쿤 (최종 통합)
   - 사운드(WebAudio) + 설정 토글
   - 스폰 랜덤 체감(대기열 2x5 그리드) + 선택 손님 중앙 서빙 포인트
   - 문(우측 하단) + leaving 상태로 퇴장 연출
   - 배경: 매장 느낌(카운터/테이블/문)
   - 보스/알바 겹침 해결: 보스 상단, 알바 하단(Y 분리), 크기 소폭 축소
   - 유저 이름(최초 입력): 한글만, 10글자, 빈값 허용 / 헤더&인증서에 그대로 표시
   - 현재 기간 보상 v1 보존; 새 기간의 공용 스탬프/날짜형 혜택은 CouponPolicy 소유
   - 새 주간 올클 스탬프/veg와 인증서 중복 지급 방지
   - 인증서/쿠폰 사용 -> PIN(0000) + 로그 기록
   - 주간 인증서 "사용 처리" -> PIN 성공 시 주간 초기화 + 로그
   - 이행 전 주간은 기존 교환, 이후 정확한 자동 수익 기반 스탬프 구매
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
      if (ok) CouponPolicy.maybeSettle(true);
      showToast(
        ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.",
      );
    });
  }
  if (resetAllBtn) {
    resetAllBtn.addEventListener("click", () => {
      if (confirm("게임 진행과 기존 무기한 쿠폰을 초기화할까요? 새 정책의 날짜형 쿠폰·스탬프·발급/사용 한도는 보존합니다.")) {
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
      CouponPolicy.presentation.mount(true);
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
        const committed = BenefitService.commit(() => { state.benefitsLog = []; });
        renderCoupons();
        showToast(committed ? "기록 정리 완료. 방문 제공 상태는 보존됩니다." : "저장 실패. 기록을 보존했습니다.");
      }
    });
  }

  document.getElementById("startVisitChallenge")?.addEventListener("click", () => RepeatMissions.startChallenge());
  document.getElementById("startServiceVisit")?.addEventListener("click", () => BenefitService.startVisit());
  document.getElementById("showStaffCoupon")?.addEventListener("click", () => {
    document.getElementById("staffCouponView").hidden = false;
    document.getElementById("couponHistory").open = true;
    BenefitService.render();
    document.getElementById("staffCouponView").focus();
  });
  document.getElementById("hideStaffCoupon")?.addEventListener("click", () => {
    document.getElementById("staffCouponView").hidden = true;
    document.getElementById("showStaffCoupon").focus();
  });

  document.getElementById("openGameGuide")?.addEventListener("click", () => {
    document.getElementById("modalGameGuide").classList.add("on");
  });

  for (const mode of Object.keys(CAMPAIGN_MODES))
    document.getElementById("chooseMode-" + mode)?.addEventListener("click", () => Campaign.choose(mode));
  document.getElementById("campaignRegions")?.addEventListener("click", event => {
    const button = event.target.closest("[data-campaign-region]");
    if (button) Campaign.showRegion(button.dataset.campaignRegion);
  });
  document.getElementById("completeRegionEnding")?.addEventListener("click", () => Campaign.complete());
  document.getElementById("closeRegionEnding")?.addEventListener("click", () => Campaign.close());

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
      const committed = BenefitService.commit(() => {
        state.profile.name = v;
        CouponPolicy.completeWelcome();
      });
      if (!committed) { showToast("저장 실패. 안내와 웰컴 지급 상태를 유지합니다. 다시 시도해 주세요."); return; }
      if (modalProfile) modalProfile.classList.remove("on");
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
    useCertDrinkBtn.addEventListener("click", () => useCoupon("drink", { certificate: true }));
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
      CouponPolicy.exchange(doExchangeBtn.dataset.cost);
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
      const command = e.target.closest("[data-map-command]");
      if (command?.disabled) return;
      state.mapSelected = id;
      markStateChanged("map-selection");
      renderMapUI();
      if (command) {
        e.preventDefault();
        e.stopPropagation();
        // Reuse the existing toolbar handlers; selecting a card alone never buys or moves.
        if (command.dataset.mapCommand === "move") document.getElementById("mapGo").click();
        else if (id === getNextRegion().id) document.getElementById("mapUnlock").click();
        if (modalExpansionEl.classList.contains("on")) {
          const selected = mapWrapEl.querySelector(`.map-node[data-region-id="${id}"]`);
          const action = selected?.querySelector("button:not(:disabled)");
          (action || selected)?.focus({ preventScroll: true });
        }
      }
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
    if (key !== "shr") sanitizeState();
    if (key === "shr") CouponPolicy.presentation.mount();
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
  Campaign.render();
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
  return BranchManager.unlock(id);
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
        const canAfford = Campaign.canUnlockRegion(loc.id) && moneyCompare(state.money, getRegionUnlockCost(loc.id)) >= 0;
        const costText = fmtWon(getRegionUnlockCost(loc.id));
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
        수익 배율: <b style="color:#984000">x${(loc.priceMul || 1).toFixed ? (loc.priceMul || 1).toFixed(1).replace(/\.0$/, "") : loc.priceMul || 1}</b><br>
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
   Menu grid: unlocked choices and one next-menu preview
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

  MENUS.slice(0, openCount).forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "menuBtn";
    btn.dataset.action = "serve-menu";
    btn.dataset.menuId = m.id;
    btn.dataset.locked = "0";

    const shownPrice = getMenuPrice(m.id);

    btn.innerHTML = `
      <div class="top">
        <div class="emoji">${m.emoji}</div>
        <div class="name">${m.name}</div>
      </div>
      <div class="price">${fmtWon(shownPrice)}</div>
    `;

    menuGrid.appendChild(btn);
    ImageAssets.mount(btn.querySelector(".emoji"), "menu." + m.id, m.emoji);
  });
  const next = MENUS[openCount];
  if (next) {
    const cost = menuUnlockCost(state.upgrades.menuUnlock || 0);
    const preview = document.createElement("div");
    preview.className = "menuNext";
    preview.dataset.menuId = next.id;
    preview.dataset.cost = String(cost);
    preview.title = `업그레이드 → 메뉴 해금 · ${moneyExactText(cost)}원`;
    const name = document.createElement("div"), price = document.createElement("div");
    name.textContent = `다음 메뉴: ${next.name}`;
    price.textContent = `해금 ${fmtWon(cost)}`;
    preview.append(name, price);
    menuGrid.appendChild(preview);
  }
  resizeCanvas();
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


// 2. updateBossParticles 함수 교체




// 1) 배달/온라인 주문 텍스트 띄우기

// 2) 터치 충돌 판정

// 3) 보스(사장님) 위치 계산
// ==========================================
// 👆 1. 터치 및 이펙트 글로벌 상태 (에러 완벽 차단)
// ==========================================

// ==========================================
// 🎯 2. 터치 영역(Hitbox) 대폭 확대
// ==========================================


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
      <p style="margin-top:5px;">진행을 따로 보관하고 필요할 때 다시 불러올 수 있어요.</p>
    </div>
    <textarea id="saveTransferText" rows="5" placeholder="백업 내용을 복사하거나 붙여넣으세요." style="width:100%; box-sizing:border-box; resize:vertical; font-size:16px;"></textarea>
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
      msg: "주간 미션을 모두 채우면 인증서를 받을 수 있어요.",
    };
  }
  if (state.cert.usedAt) {
    return {
      okIssue: false,
      okUse: false,
      msg: "이번 인증서 사용을 마쳤어요. 다음 주에 새 인증서를 모아보세요.",
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
        msg: "새 주간 미션에 도전하고 인증서를 모아보세요.",
      };
    }
    return {
      okIssue: false,
      okUse: CouponPolicy.canUse("drink"),
      msg: `인증서 발급 완료 ✅ (유효 ${Math.max(0, leftDays)}일)`,
    };
  }
  return { okIssue: true, okUse: false, msg: "주간 미션 완료! 인증서를 받을 수 있어요 ✅" };
}

// Step 2-9: makeCardBtn handled once in initDOMRefs().

// Step 2-9: useCertDrinkBtn handled once in initDOMRefs().


/* --------------------
   Coupons / exchange
-------------------- */

// Step 2-9: useDrinkCouponBtn handled once in initDOMRefs().
// Step 2-9: useVegCouponBtn handled once in initDOMRefs().

function renderCoupons() {
  uiDrinkCoupons2.textContent = CouponPolicy.available("drink");
  uiVegCoupons2.textContent = CouponPolicy.available("veg");

  BenefitService.render();
  benefitLogList.textContent = "";
  const logs = state.benefitsLog || [];
  if (logs.length === 0) {
    benefitLogList.textContent = "기록이 없어요.";
    return;
  }
  const lines = logs.slice(0, 30).map((l) => {
    const label = l.type === "stamp" ? "음료 스탬프" : l.type === "drink" ? "음료" : "무/양배추";
    return `• [${l.at}] ${label} x${l.qty} (${l.source}) ${(l.note || "").replace(/로컬 PIN/g, "직원 확인").replace(/서버 인증|서버 승인/g, "제공 확인").replace(/로컬/g, "기기").replace(/미수령/g, "받을 수익")}${l.before !== undefined ? ` · 잔량 ${l.before} → ${l.after}` : " · 기존 기록(전후 수량 없음)"}${l.table ? ` · 방문 번호 ${l.table} · 기록 ${l.visitId || "미기록"}` : ""}`;
  });
  benefitLogList.textContent = lines.join("\n");
}

function renderExchange() {
  uiMoney2.textContent = fmtWon(state.money);
  const quote = CouponPolicy.quote();
  uiExchangeCnt.textContent = quote.remaining;
  doExchangeBtn.disabled = !quote.allowed;
  doExchangeBtn.dataset.cost = quote.price === null ? "" : String(quote.price);
  doExchangeBtn.textContent = quote.modern ? `음료 스탬프 +${COUPON_POLICY.exchangeStamps} 구매` : "음료 쿠폰 교환하기";
  const cost = document.getElementById("exchangePrice");
  cost.textContent = quote.price === null ? "금액 표현 한계: 구매 중단" : fmtWon(quote.price);
  cost.title = quote.price === null ? "" : moneyExactText(quote.price) + "원";
  document.getElementById("exchangePolicyInfo").textContent = quote.modern
    ? `이번 주 ${quote.remaining}/${COUPON_POLICY.exchangeWeeklyLimit}회 · 음료 스탬프 +${COUPON_POLICY.exchangeStamps}`
    : "이번 주에는 게임머니로 음료 쿠폰을 교환해요.";
  document.getElementById("exchangePricingDetails").textContent = quote.modern
    ? `이번 주 ${quote.remaining}/${COUPON_POLICY.exchangeWeeklyLimit}회 · 음료 스탬프 +${COUPON_POLICY.exchangeStamps}. 현재 자동 추정 분당 수익 ${quote.minute === null ? "계산 한계" : fmtWon(quote.minute)} × ${COUPON_POLICY.exchangeMinutes}분과 ${fmtWon(COUPON_POLICY.exchangeMinWon)} 중 큰 금액입니다. 수동 서빙·랜덤 변동과 실제 수익은 다를 수 있습니다.`
    : `이번 주에는 ${fmtWon(CONFIG.exchangeUnit)}으로 음료 1장을 교환해요. ${CouponPolicy.dateText(state.couponLedger.weeklyFrom)}부터 음료 스탬프를 구매할 수 있어요.`;
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




// ==========================================
// [NEW] 사장님 & 알바생 전용 고퀄리티 말풍선 (손님용과 분리)
// ==========================================







// ==========================================
// 🎨 아트 배경 스튜디오 (그래픽 헬퍼 함수)
// ==========================================














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
  if (key !== "shr") sanitizeState();
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
        div.className = "card purchase-option";
        div.innerHTML = `
          <div class="info">
            <h4>${u.name} <span style="color:#8a4b00;">Lv.${lvl}/${maxL}</span></h4>
            <p>${u.desc}</p>
            <div class="cost">${lvl >= maxL ? "최대 레벨" : fmtWon(cost)}</div>
            <progress class="ux-progress" max="1" value="0"></progress>
            <p class="purchase-status"></p>
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
            <div style="font-size:14px; color:#666;">전체 지점 누적: ${fmtWon(st.earned)}</div>
          </div>
          <div style="display:flex; gap:8px; width:100%;">
            <div class="purchase-option staff-purchase"><button class="btn" id="btn-auto-${s.key}">👟속도 Lv.${st.auto}</button><progress class="ux-progress" max="1" value="0"></progress><p class="purchase-status"></p></div>
            <div class="purchase-option staff-purchase"><button class="btn" id="btn-tip-${s.key}">💖매력 Lv.${st.tip}</button><progress class="ux-progress" max="1" value="0"></progress><p class="purchase-status"></p></div>
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
          const price = document.createElement("span");
          price.className = "staff-cost";
          price.textContent = fmtWon(cost);
          button.appendChild(price);
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
          <h4>${r.name} <span style="color:#666;">Lv.${lvl}/${maxL}</span> ${done ? '<span style="color:#595959;">(완료)</span>' : ""}</h4>
          <p>${r.desc}</p>
          <div class="cost">⏱ 다음 Lv.${nextLvl}: ${nextMin}분 ${effTxt ? `<span style="color:#595959;">(${effTxt})</span>` : ""}</div>
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
    s.textContent = `현재 연구 슬롯: ${state.research.slots}개 · 완료되면 효과가 적용돼요.`;
    targetList.appendChild(s);
  }

  // --- [3] 미션 패널 (mis) ---
  else if (key === "mis") {
    RepeatMissions.render();
    if (document.querySelector("#panel-mis.on,#panel-shr.on,#modalCoupons.on")) CouponPolicy.render();
    if (modalExchange?.classList.contains("on")) renderExchange();
    misGuide.innerHTML = `일간 미션을 채워 출석 도장을 모아요. 이번 주 목표는 <span data-weekly-stamp-target>${RepeatMissions.weeklyStampTarget()}</span>개예요.`;
    dailyList.innerHTML = "";
    for (const m of state.missions.dailyList)
      dailyList.appendChild(missionRow(m));

    weeklyList.innerHTML = "";
    for (const m of state.missions.weeklyList)
      weeklyList.appendChild(weeklyRow(m));

    const st = certStatusText();
    weeklyNote.innerHTML = `주간 미션을 모두 채우면 인증서를 받아요.<br><span style="color:#555;">${st.msg}</span>`;
  }

  // --- [4] 인증서 패널 (shr) ---
  else if (key === "shr") {
    renderCoupons();
    const st = certStatusText();
    certStatus.textContent = st.msg;
    makeCardBtn.disabled = !st.okIssue && !state.cert.issuedThisWeek;
    useCertDrinkBtn.disabled = !(
      state.cert.issuedThisWeek &&
      CouponPolicy.canUse("drink") &&
      !state.cert.usedAt &&
      (!state.cert.validUntil || Date.now() < state.cert.validUntil)
    );
  }
  updateProgressUI(key);
} // 👈 여기서 모든 로직이 안전하게 종료됨!

// UX-4: display-only projection; never completes research, buys, settles rewards or saves.
function updateProgressUI(key) {
  if (key === "upg") {
    let available = 0;
    for (const button of upgList.querySelectorAll('[data-action="buy-upgrade"],[data-action="buy-staff-upgrade"]')) {
      const staff = button.dataset.action === "buy-staff-upgrade";
      const upgrade = staff ? null : UPGRADES.find(u => u.id === button.dataset.upgradeId);
      const level = staff ? state.staffStats[button.dataset.staffKey]?.[button.dataset.kind] || 0 : state.upgrades[upgrade.id] || 0;
      const maxed = level >= (staff ? 10 : upgrade.maxLevel ?? 99);
      const cost = staff ? staffUpgradeCost(button.dataset.staffKey, button.dataset.kind, level) : upgradeCost(upgrade.id, level);
      const can = !maxed && isMoney(cost) && moneyCompare(state.money, cost) >= 0;
      const ratio = maxed ? 1 : moneyRatio(state.money, cost);
      const option = button.closest(".purchase-option"), bar = option.querySelector("progress");
      button.disabled = !can;
      button.dataset.cost = String(cost);
      button.title = moneyExactText(cost) + "원";
      option.classList.toggle("is-affordable", can);
      bar.hidden = maxed;
      bar.value = ratio;
      bar.setAttribute("aria-label", `${staff ? `${STAFF_POOL.find(s => s.key === button.dataset.staffKey)?.label} ${button.dataset.kind === "auto" ? "속도" : "매력"}` : upgrade.name} 구매까지 보유금`);
      setTextIfChanged(option.querySelector(".purchase-status"), maxed ? "최대 단계" : can ? "살 수 있어요" : `보유금 ${Math.floor(ratio * 100)}%`);
      setTextIfChanged(staff ? button.querySelector(".staff-cost") : option.querySelector(".cost"), maxed ? "최대 레벨" : fmtWon(cost));
      if (can) available++;
    }
    setTextIfChanged(document.getElementById("upgradeSummary"), `지금 살 수 있는 것 ${available}개`);
  } else if (key === "res") {
    const slots = state.research.running.map((slot, index) => ({...slot, index})).filter(slot => slot.activeId);
    const signature = slots.map(s => [s.index,s.activeId,s.targetLevel,s.startAt,s.endAt].join(":")).join("|");
    if (resBar.dataset.slots !== signature) {
      resBar.dataset.slots = signature;
      resBar.replaceChildren();
      for (const slot of slots) {
        const row = document.createElement("div"); row.className = "research-slot";
        const label = document.createElement("p"), bar = document.createElement("progress");
        bar.className = "ux-progress"; bar.max = 1;
        bar.setAttribute("aria-label", `연구 슬롯 ${slot.index + 1} 진행률`);
        row.append(label, bar); resBar.append(row);
      }
    }
    setTextIfChanged(resStatus, slots.length ? `진행 중 ${slots.length}개` : "연구를 시작해요.");
    slots.forEach((slot, index) => {
      const left = Math.max(0, slot.endAt - Date.now()), total = slot.endAt - slot.startAt;
      const ratio = total > 0 ? clamp(1 - left / total, 0, 1) : left === 0 ? 1 : 0;
      const name = RESEARCH.find(r => r.id === slot.activeId)?.name || slot.activeId;
      const row = resBar.children[index]; row.querySelector("progress").value = ratio;
      setTextIfChanged(row.querySelector("p"), `슬롯 ${slot.index + 1} · ${name} Lv.${slot.targetLevel} · ${Math.floor(ratio * 100)}% · ${left > 0 ? `남은 시간 ${fmtDuration(Math.ceil(left / 1000))}` : "완료 확인 중"}`);
    });
  }
}

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
  wrap.className = "card mission-row";
  wrap.dataset.done = m.done ? "1" : "0";
  wrap.innerHTML = `
    <details class="mission-details" ${m.done ? "" : "open"}>
    <summary><h4>${m.title}</h4></summary>
    <div class="info">
      <p>${missionProgressLine(m)}</p>
      <progress class="ux-progress" max="1"></progress>
    </div>
    </details>
    <button class="btn" disabled>${m.done ? "완료" : "진행중"}</button>
  `;
  const bar = wrap.querySelector("progress");
  bar.value = m.done ? 1 : moneyRatio(m.current ?? m.progress ?? 0, m.target || 0);
  bar.setAttribute("aria-label", `${m.title} 진행률`);
  return wrap;
}

function weeklyRow(m) {
  const wrap = missionRow(m);
  wrap.querySelector("h4").textContent = m.type === "stamp" ? `출석 도장 ${m.target}` : m.title;
  const note = document.createElement("div");
  note.className = "cost"; note.textContent = "모두 채우면 인증서를 받아요";
  wrap.querySelector(".info").append(note);
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

// short speech bubble helper (non-fatal)



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

  const curId = state.regionId;
  const selId = state.mapSelected || curId;
  const next = getNextRegion();
  const nextLockedId = REGIONS.find(region => !state.regionUnlocked[region.id])?.id;
  const fullDetails = document.getElementById("mapRegionDetails");
  if (!wrap._mapRows) {
    wrap._mapRows = REGIONS.map((region, index) => {
      const node = document.createElement("div");
      node.className = "map-node"; node.dataset.action = "select-region";
      node.dataset.regionId = region.id; node.tabIndex = 0; node.setAttribute("role", "group");
      const heading = document.createElement("div"); heading.className = "map-heading";
      const title = document.createElement("h4"); title.className = "map-title";
      title.textContent = `${region.icon} ${index + 1}. ${region.name}`;
      const status = document.createElement("span"); status.className = "map-sub";
      heading.append(title, status);
      const target = document.createElement("p"); target.className = "map-details";
      const bar = document.createElement("progress"); bar.max = 1; bar.className = "ux-progress";
      bar.setAttribute("aria-label", `${region.name} 오픈 비용 준비율`);
      const percent = document.createElement("span"); percent.className = "map-progress-label";
      const action = document.createElement("button"); action.className = "btn map-action"; action.type = "button";
      const actionRow = document.createElement("div"); actionRow.className = "map-action-row";
      actionRow.append(percent, action); node.append(heading, target, bar, actionRow); wrap.append(node);
      const detail = document.createElement("section"); detail.dataset.regionDetails = region.id;
      const name = document.createElement("h4"); name.textContent = region.name;
      const text = document.createElement("p"); detail.append(name, text); fullDetails.append(detail);
      return {node, status, target, bar, percent, action, text};
    });
  }
  REGIONS.forEach((r, index) => {
    const row = wrap._mapRows[index], {node, status, target, bar, percent, action} = row;
    const unlocked = !!state.regionUnlocked[r.id];
    const current = r.id === curId, previous = REGIONS[index - 1];
    const cost = getRegionUnlockCost(r.id), summary = Campaign.regionSummary(r.id);
    const shortage = moneyMax(0, moneySub(cost, state.money));
    const canUnlock = Campaign.canUnlockRegion(r.id);
    node.classList.toggle("locked", !unlocked);
    node.classList.toggle("active", r.id === selId);
    node.classList.toggle("current", current);
    if (current) node.setAttribute("aria-current", "location"); else node.removeAttribute("aria-current");
    const stateText = unlocked ? current ? "영업 중" : "이동 가능" : "잠김";
    node.setAttribute("aria-label", `${r.name} · ${stateText} · ${r.id === selId ? "선택됨" : "지점 선택"}`);
    setTextIfChanged(status, stateText);
    let goalText;
    if (!unlocked) {
      goalText = !state.regionUnlocked[previous?.id] ? `먼저 ${previous?.name}을 오픈해요`
        : !canUnlock ? `먼저 ${previous.name} 지역 이야기를 열어요`
        : r.id !== next.id ? "이전 지점으로 이동해 오픈해요"
        : moneyCompare(shortage, 0) > 0 ? `${r.name} 오픈까지 ${fmtWon(shortage)}` : "오픈 비용을 모두 모았어요";
    } else if (state.campaign.regions[r.id]?.unlockedAt) {
      goalText = "지역 이야기가 열렸어요 · 설정에서 볼 수 있어요";
    } else if (summary.goal) {
      const left = moneyMax(0, moneySub(summary.goal, Campaign.sales(r.id)));
      goalText = moneyCompare(left, 0) > 0 ? `지역 이야기까지 매출 ${fmtWon(left)}` : "이야기 목표 달성 · 해금 확인 중";
    } else {
      const destination = current && next.id !== curId ? next : null;
      goalText = destination && !state.regionUnlocked[destination.id]
        ? `${destination.name} 오픈까지 ${fmtWon(moneyMax(0, moneySub(getRegionUnlockCost(destination.id), state.money)))}`
        : "매출을 모으며 자유롭게 운영해요";
    }
    setTextIfChanged(target, goalText);
    target.title = `기록 매출 ${moneyExactText(Campaign.sales(r.id))}원${summary.goal ? ` / 이야기 목표 ${moneyExactText(summary.goal)}원` : ""}`;
    const funding = r.id === nextLockedId, salesGoal = unlocked && !!summary.goal;
    bar.hidden = !funding && !salesGoal; percent.hidden = bar.hidden;
    if (!bar.hidden) {
      bar.dataset.progressKind = funding ? "cost" : "sales";
      bar.value = funding ? moneyRatio(state.money, cost) : summary.ratio;
      bar.setAttribute("aria-label", `${r.name} ${funding ? "오픈 비용 준비율" : "지역 매출 목표"}`);
      setTextIfChanged(percent, `${funding ? "오픈 비용" : "이야기 매출"} ${Math.floor(bar.value * 100)}%`);
    }
    action.dataset.mapCommand = unlocked ? "move" : "unlock";
    action.disabled = unlocked ? current : r.id !== next.id || !canUnlock || moneyCompare(state.money, cost) < 0;
    action.dataset.cost = String(cost); action.title = unlocked ? `${r.name}으로 이동` : `${r.name} 오픈 · ${moneyExactText(cost)}원`;
    setTextIfChanged(action, unlocked ? current ? "영업 중" : "이동" : `오픈 · ${fmtWon(cost)}`);
    action.setAttribute("aria-label", unlocked ? `${r.name} ${current ? "영업 중" : "이동"}` : `${r.name} 오픈 · ${moneyExactText(cost)}원`);
    setTextIfChanged(row.text, `${summary.progress}\n${summary.ending}\n${summary.unlock}`);
  });

  // Buttons state
  const nextLocked = !state.regionUnlocked[next.id];

  if (btnGo) {
    btnGo.disabled = !state.regionUnlocked[selId];
    btnGo.style.opacity = btnGo.disabled ? 0.6 : 1;
  }
  if (btnUn) {
    const cost = getRegionUnlockCost(next.id);
    btnUn.disabled = !nextLocked || curId === next.id || !Campaign.canUnlockRegion(next.id) || moneyCompare(state.money, cost) < 0;
    btnUn.textContent = curId === next.id ? "마지막 지역" : `${fmtWon(cost)} 해금`;
    btnUn.title = moneyExactText(cost);
    btnUn.style.opacity = btnUn.disabled ? 0.6 : 1;
  }

  const mapDetails = document.getElementById("mapPolicyDetails");
  if (mapDetails) mapDetails.textContent = Campaign.familySummary();
  if (hint) {
    const count = REGIONS.filter(r => state.campaign.regions[r.id]?.unlockedAt).length;
    setTextIfChanged(hint, `지역 이야기 ${count}/6 · 가족 목표 ${fmtWon(Campaign.rules().ending)}`);
  }
}

function updateUI() {
  beginEffectBatch();
  // Defensive UI update: missing DOM refs should NOT stop the game
  try {
    const setText = setTextIfChanged;

    const welcomeNotice = document.getElementById("profileWelcomeNotice");
    if (welcomeNotice) welcomeNotice.hidden = !state.couponLedger?.welcomeEligible;
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

    setText(uiVegCoupons, CouponPolicy.available("veg"));
    setText(uiDrinkCoupons, CouponPolicy.available("drink"));

    if (toggleSoundBtn)
      if (toggleSoundBtn)
        toggleSoundBtn.textContent = state.soundOn ? "ON" : "OFF";

    setText(stampCountText, state.stamps ?? 0);
    setText(uiWeeklyStampText, state.missions.weeklyStamps ?? 0);
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
      RepeatMissions.weeklyStampTarget(),
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
          CouponPolicy.canUse("drink") &&
          !state.cert?.usedAt &&
          (!state.cert?.validUntil || Date.now() < state.cert.validUntil)
        );
    }

    CouponPolicy.presentation.refresh();
    updateEconomyUI();
    if (panels.upg.classList.contains("on")) updateProgressUI("upg");
    renderManagementContent();
    Campaign.render();
    if (document.getElementById("modalExpansion").classList.contains("on")) renderMapUI();
    RepeatMissions.render();
    if (modalCoupons?.classList.contains("on") || panels.shr.classList.contains("on")) BenefitService.render();

    // coupons modal quick sync
    setText(uiDrinkCoupons2, CouponPolicy.available("drink"));
    setText(uiVegCoupons2, CouponPolicy.available("veg"));
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
    Campaign.render();
    RepeatMissions.render();
    if (modalCoupons?.classList.contains("on") || panels.shr.classList.contains("on")) BenefitService.render();

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
    CouponPolicy.maybeSettle();
    RepeatMissions.tick(dt);
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
    Campaign.check();
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
    cell.style.color = "#34342e";
    cell.textContent = i < filled ? symbol : i + 1;
    element.append(cell);
  }
  stampRowKeys.set(element, key);
}
