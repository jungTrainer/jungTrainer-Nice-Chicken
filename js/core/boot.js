/* IMP-08: boot, error recovery and loop watchdog after all definitions load. */
(function () {
  const hideSplash = () => {
    const s = document.getElementById("splashScreen");
    if (s) s.style.display = "none";
  };
  window.addEventListener("error", (ev) => {
    console.error("Global error:", ev.error || ev.message);
    hideSplash();
    // show minimal overlay
    let o = document.getElementById("__err_overlay");
    if (!o) {
      o = document.createElement("div");
      o.id = "__err_overlay";
      o.style.position = "fixed";
      o.style.left = "0";
      o.style.top = "0";
      o.style.right = "0";
      o.style.bottom = "0";
      o.style.background = "rgba(0,0,0,.75)";
      o.style.color = "#fff";
      o.style.zIndex = "99999";
      o.style.padding = "16px";
      o.style.fontFamily =
        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      o.style.whiteSpace = "pre-wrap";
      document.body.appendChild(o);
    }
    o.textContent =
      "오류가 발생했지만 게임이 멈추지 않도록 복구를 시도했습니다.\n\n" +
      String(ev.error ? ev.error.stack || ev.error : ev.message);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("Unhandled rejection:", ev.reason);
    hideSplash();
  });
  window.__hideSplash = hideSplash;
})();
let _crashToastAt = 0;
let _errorCount = 0;
window.addEventListener("error", () => {
  try {
    const now = Date.now();
    // 2초 내에 에러가 3번 이상 발생하면 재시작 포기 (무한 루프 방지)
    if (now - _crashToastAt < 2000) {
      _errorCount++;
      if (_errorCount > 3) return;
    } else {
      _errorCount = 1;
      _crashToastAt = now;
      if (typeof showToast === "function") showToast("⚠️ 오류 복구중…");
    }

    if (typeof startGameLoop === "function") startGameLoop();
  } catch (_e) {}
});
window.addEventListener("unhandledrejection", () => {
  try {
    const now = Date.now();
    if (now - _crashToastAt < 2000) {
      _errorCount++;
      if (_errorCount > 3) return;
    } else {
      _errorCount = 1;
      _crashToastAt = now;
      if (typeof showToast === "function") showToast("⚠️ 오류 복구중…");
    }

    if (typeof startGameLoop === "function") startGameLoop();
  } catch (_e) {}
});
window.addEventListener("error", (e) => {
  try {
    console.error("runtime error", e);
  } catch (_) {}
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    console.error("promise rejection", e);
  } catch (_) {}
});
function initAfterLoad(fromReset = false) {
  cancelEndingRuntime();
  sanitizeState();
  try {
    BranchManager.bootstrap();
  } catch (e) {}
  resizeCanvas();
  buildMenuGrid();
  ensureMissionReset();
  ensureResearchSlots();
  ensureStaffStats();
  updateUI();
  closePanels();

  // sound state
  setSoundEnabled(state.soundOn);
  if (toggleSoundBtn) toggleSoundBtn.textContent = state.soundOn ? "ON" : "OFF";

  // first run name prompt: profile.name가 undefined였던 데이터는 modal 띄움
  if (!state.profile || typeof state.profile.name !== "string") {
    state.profile = { name: "" };
  }
  // "최초 실행 후 접속하면" 요구: name이 한번도 세팅된 적이 없을 때만 띄우는 대신,
  // 현재는 "저장된 데이터가 없거나 reset 직후"에만 띄우도록 처리
  if (!localStorage.getItem(SAVE_KEY) || fromReset) {
    modalProfile.classList.add("on");
    nameInput.value = state.profile.name || "";
  }

  applyOfflineProgress();
  restoreEndingUI();

  startGameLoop();

  // kickstart: 첫 손님이 너무 늦게 뜨는 현상 방지
  const bootState = state,
    bootRegion = state.regionId;
  setTimeout(() => {
    try {
      if (
        state === bootState &&
        state.regionId === bootRegion &&
        Array.isArray(state.customers) &&
        state.customers.length === 0
      ) {
        spawnCustomer();
      }
    } catch (e) {}
  }, 700);
}
function init() {
  deferRecoveryWrites = true;
  try {
    load();
    initAfterLoad(false);
  } finally {
    deferRecoveryWrites = false;
  }
  if (_saveDirty) save(true);
}

// Boot after DOM is ready (prevents null refs)
document.addEventListener("DOMContentLoaded", () => {
  try {
    initDOMRefs();
    bindSaveLifecycleEvents();
    ensureSaveTransferUI();
    preloadSignImages();
    init();
    PwaRuntime.ready();
  } catch (e) {
    console.error("boot error", e);
  } finally {
    // Absolute failsafe: even if UI init crashed, keep the game loop alive.
    try {
      startGameLoop();
    } catch (_e) {}
  }
});

/* --------------------
   Loop watchdog (failsafe)
-------------------- */
setInterval(() => {
  // if rAF stalled > 2s, restart
  const lastAt = state._lastFrameAt || 0;
  if (lastAt && Date.now() - lastAt > 2200) {
    console.warn("rAF stalled, restarting...");
    try {
      startGameLoop();
      state._lastFrameAt = Date.now();
    } catch (e) {}
  }
}, 1200);
