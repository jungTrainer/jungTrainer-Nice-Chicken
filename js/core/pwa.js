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
      `${navigator.onLine ? "온라인" : "오프라인"} · ` +
      (navigator.serviceWorker?.controller
        ? "오프라인 플레이 준비됨"
        : "연결 후 앱을 준비해요") +
      (waiting ? " · 새 버전 대기" : "") +
      (failure ? ` · ${failure}` : "");
    el("applyPwaUpdate").disabled = applying || !waiting;
    el("checkPwaUpdate").disabled =
      applying || !isSecureContext || !navigator.serviceWorker;
    el("installPwa").disabled = !installPrompt || applying;
    el("pwaInstallHelp").textContent = matchMedia("(display-mode: standalone)")
      .matches
      ? "설치된 앱으로 실행 중입니다."
      : installPrompt
        ? "설치 버튼으로 앱을 추가할 수 있습니다."
        : "브라우저 메뉴에서 앱 설치 또는 홈 화면 추가를 선택해요.";
  }
  function safeReason() {
    if (SaveRecovery.busy) return "저장 진단/복구 작업을 마친 뒤 적용하세요.";
    if (!SessionOwner.canMutate())
      return "운영 창에서만 새 버전을 적용할 수 있습니다.";
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
      return "수익·입력·패널 창을 닫은 뒤 설정에서 적용하세요. 닫아도 보상은 유지됩니다.";
    if (!el("modalSettings").classList.contains("on"))
      return "설정에서 새 버전을 적용하세요.";
    if (el("saveTransferText")?.value.trim())
      return "백업/가져오기 작업을 마친 뒤 입력란을 비워 주세요.";
    return "";
  }
  async function prune() {
    const reason = safeReason();
    if (reason) {
      failure = reason;
      render();
      return;
    }
    try {
      const result = await message(navigator.serviceWorker.controller, "PRUNE");
      failure = result.ok
        ? `미사용 셸 ${result.deleted}개를 정리했습니다. 저장/보상은 유지됩니다.`
        : "설치·대기 업데이트·응답하지 않는 창이 있어 정리하지 않았습니다. 사용 중인 셸을 보존합니다.";
    } catch (_) {
      failure = "셸 정리를 확인하지 못했습니다. 기존 셸과 저장을 유지합니다.";
    }
    render();
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
      waiting = registration?.waiting || null;
      if (worker.state === "redundant")
        failure =
          "새 버전 설치 실패. 지금 버전으로 즐기며 연결 후 다시 확인해요.";
      render();
    });
  }
  async function check() {
    if (applying) return false;
    failure = "";
    try {
      const current = await navigator.serviceWorker.getRegistration();
      if (!current || !registration) {
        registration = null;
        await setup();
        return !!registration;
      }
      await registration.update();
      return true;
    } catch (_) {
      failure = "업데이트 확인 실패. 온라인에서 다시 시도하세요.";
      return false;
    } finally {
      waiting = registration?.waiting || null;
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
      const existing = await navigator.serviceWorker.getRegistration();
      const scope = new URL("./", location.href).href;
      registration =
        existing?.scope === scope
          ? existing
          : await navigator.serviceWorker.register("./sw.js", {
              scope: "./",
              updateViaCache: "none",
            });
      waiting = registration.waiting;
      observeWorker(registration.installing);
      registration.addEventListener("updatefound", () =>
        observeWorker(registration.installing),
      );
      render();
      if (existing && navigator.onLine) check();
      const ready = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller && !ready.waiting) {
        const status = await message(ready.active, "STATUS");
        if (status.version === version) await message(ready.active, "CLAIM");
        else
          failure =
            "현재 페이지와 설치 버전이 다릅니다. 백업 후 앱 창을 닫고 다시 열어 주세요.";
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
  window.addEventListener("offline", render);
  window.addEventListener("online", () => {
    if (!registration) setup();
    else render();
  });
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
  navigator.serviceWorker?.addEventListener("message", async (event) => {
    if (event.data?.type === "PWA_VERSION_QUERY") {
      const current = await navigator.serviceWorker.getRegistration();
      event.ports[0]?.postMessage({
        protocol: 13,
        version,
        updating: !!current?.installing || !!current?.waiting,
      });
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
      el("prunePwaCaches").addEventListener("click", prune);
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
