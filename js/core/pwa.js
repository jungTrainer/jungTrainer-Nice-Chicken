/* IMP-12: UI/browser lifecycle only. No save schema or economic side effects. */
const PwaRuntime = (() => {
  const version = document.querySelector('meta[name="app-version"]').content;
  let registration = null,
    waiting = null,
    targetVersion = null,
    installPrompt = null;
  let bootReady = false,
    applying = false,
    reloadStarted = false,
    failure = "";
  let applyTimer = null;
  const el = (id) => document.getElementById(id);
  function message(worker, type, release = version) {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(Error("worker unavailable"));
        return;
      }
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(Error("worker timeout"));
      }, 5000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(data);
      };
      worker.postMessage({ type, version: release }, [channel.port2]);
    });
  }
  function render() {
    if (!el("pwaStatus")) return;
    el("pwaStatus").textContent =
      `앱 ${version} · ${navigator.onLine ? "온라인" : "오프라인"} · ` +
      (navigator.serviceWorker?.controller
        ? "오프라인 셸 준비"
        : "온라인 설치 필요") +
      (waiting ? " · 새 버전 대기" : "") +
      (failure ? ` · ${failure}` : "");
    el("applyPwaUpdate").disabled = applying || !waiting;
    el("checkPwaUpdate").disabled = applying || !registration;
    el("installPwa").disabled = !installPrompt || applying;
    el("pwaInstallHelp").textContent = matchMedia("(display-mode: standalone)")
      .matches
      ? "설치된 앱으로 실행 중입니다."
      : installPrompt
        ? "설치 버튼으로 앱을 추가할 수 있습니다."
        : "브라우저 메뉴의 앱 설치/홈 화면 추가를 사용하세요. HTTPS 또는 localhost가 필요합니다.";
  }
  function safeReason() {
    if (!bootReady || deferRecoveryWrites)
      return "앱 초기화가 끝난 뒤 다시 시도하세요.";
    if (
      endingPhase !== "idle" ||
      endingEls().popup.style.display === "flex" ||
      endingEls().overlay.style.display === "flex"
    )
      return "엔딩을 마치거나 닫은 뒤 업데이트하세요.";
    if (
      pinResolver ||
      [...document.querySelectorAll(".dim.on,.panel.on")].some(
        (surface) => surface.id !== "modalSettings",
      )
    )
      return "미수령·입력·패널 창을 닫은 뒤 설정에서 적용하세요. 닫아도 보상은 유지됩니다.";
    if (!el("modalSettings").classList.contains("on"))
      return "설정에서 새 버전을 적용하세요.";
    if (el("saveTransferText")?.value.trim())
      return "백업/가져오기 작업을 마친 뒤 입력란을 비워 주세요.";
    return "";
  }
  async function apply() {
    if (applying || !waiting) return false;
    let reason = safeReason();
    if (reason) {
      failure = reason;
      render();
      return false;
    }
    const worker = waiting;
    try {
      const status = await message(worker, "STATUS");
      const permit = await message(worker, "CHECK_APPLY", status.version);
      if (!permit.ok) throw Error(permit.reason);
      reason = safeReason();
      if (reason) {
        failure = reason;
        render();
        return false;
      }
      if (registration.waiting !== worker) throw Error("version-changed");
      applying = true;
      targetVersion = status.version;
      failure = "저장 후 새 버전을 적용하는 중입니다.";
      render();
      if (!save(true)) throw Error("save-failed");
      applyTimer = setTimeout(() => {
        if (!reloadStarted) {
          applying = false;
          failure =
            "버전 전환이 지연되고 있습니다. 백업 후 앱 창을 닫고 다시 열어 주세요.";
          render();
        }
      }, 10000);
      const result = await message(worker, "APPLY", status.version);
      if (!result.ok) throw Error(result.reason);
      return true;
    } catch (error) {
      if (reloadStarted) return true;
      clearTimeout(applyTimer);
      applying = false;
      targetVersion = null;
      failure =
        error.message === "other-windows"
          ? "다른 앱 탭/창을 닫은 뒤 다시 적용하세요."
          : error.message === "save-failed"
            ? "저장에 실패했습니다. 진행을 보존한 채 업데이트를 중단했습니다. 백업 후 다시 시도하세요."
            : "업데이트를 적용하지 못했습니다. 기존 앱을 유지합니다. 온라인에서 다시 확인하세요.";
      render();
      return false;
    }
  }
  function observeWorker(worker) {
    worker?.addEventListener("statechange", () => {
      waiting = registration.waiting;
      if (worker.state === "redundant")
        failure =
          "새 셸 설치 실패. 기존 버전을 유지합니다. 온라인에서 다시 확인하세요.";
      render();
    });
  }
  async function check() {
    if (!registration || applying) return false;
    failure = "";
    try {
      await registration.update();
      return true;
    } catch (_) {
      failure = "업데이트 확인 실패. 온라인에서 다시 시도하세요.";
      return false;
    } finally {
      waiting = registration.waiting;
      render();
    }
  }
  async function setup() {
    render();
    if (
      !isSecureContext ||
      !navigator.serviceWorker ||
      !/^https?:$/.test(location.protocol)
    ) {
      failure = "이 주소에서는 오프라인 설치를 지원하지 않습니다.";
      render();
      return;
    }
    try {
      registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
        updateViaCache: "none",
      });
      waiting = registration.waiting;
      observeWorker(registration.installing);
      registration.addEventListener("updatefound", () =>
        observeWorker(registration.installing),
      );
      render();
      const ready = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller && !ready.waiting) {
        const status = await message(ready.active, "STATUS");
        if (status.version === version) await message(ready.active, "CLAIM");
      }
      render();
    } catch (_) {
      failure =
        "셸 설치 실패. 게임 저장은 유지됩니다. 온라인에서 다시 확인하세요.";
      render();
    }
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    render();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    render();
  });
  for (const type of ["online", "offline"])
    window.addEventListener(type, render);
  navigator.serviceWorker?.addEventListener("controllerchange", async () => {
    try {
      const status = await message(
        navigator.serviceWorker.controller,
        "STATUS",
      );
      if (applying && status.version === targetVersion && !reloadStarted) {
        reloadStarted = true;
        clearTimeout(applyTimer);
        location.reload();
        return;
      }
      if (status.version !== version)
        failure =
          "제어 버전이 바뀌었습니다. 백업 후 앱 창을 닫고 다시 열어 주세요.";
      render();
    } catch (_) {
      failure =
        "셸 버전을 확인하지 못했습니다. 백업 후 온라인에서 다시 열어 주세요.";
      render();
    }
  });
  for (const type of ["click", "pointerdown", "touchstart", "keydown"])
    window.addEventListener(
      type,
      (event) => {
        if (applying) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true, passive: false },
    );
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      el("checkPwaUpdate").addEventListener("click", check);
      el("applyPwaUpdate").addEventListener("click", apply);
      el("installPwa").addEventListener("click", async () => {
        const prompt = installPrompt;
        if (!prompt) return;
        installPrompt = null;
        render();
        try {
          await prompt.prompt();
          await prompt.userChoice;
        } catch (_) {
          failure = "설치 창을 열지 못했습니다. 브라우저 메뉴를 사용하세요.";
        }
        render();
      });
      setup();
    },
    { once: true },
  );
  return {
    get applying() {
      return applying;
    },
    get version() {
      return version;
    },
    ready() {
      bootReady = true;
    },
  };
})();
