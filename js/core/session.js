/* IMP-13: cooperative origin/save-key writer. Ownership is not saved in game JSON. */
const SessionOwner = (() => {
  const key = "niceChicken_idleServe_vFinal",
    lockName = "nice-chicken-writer:" + key;
  const id = [...crypto.getRandomValues(new Uint32Array(4))].join("-");
  let mode = "starting",
    held = false,
    epoch = 0,
    expected = null,
    releaseLock = null;
  let acquiring = false,
    yielded = false,
    hidden = false,
    requested = false,
    refreshPending = false;
  let initializeWriter,
    initializeReader,
    message = "운영 창을 확인합니다.",
    readyResolve;
  const ready = new Promise((resolve) => {
    readyResolve = resolve;
  });
  const channel = (() => {
    try {
      return typeof BroadcastChannel === "function"
        ? new BroadcastChannel(lockName)
        : null;
    } catch (_) {
      return null;
    }
  })();
  function send(type) {
    try {
      channel?.postMessage({ type, id });
    } catch (_) {
      /* advisory only; Web Locks owns exclusion */
    }
  }
  const el = (name) => document.getElementById(name);
  const canMutate = () => held && mode === "writer";
  function render() {
    if (!el("sessionControls")) return;
    document.getElementById("app").inert = !canMutate();
    el("sessionControls").hidden = canMutate() && !requested;
    el("sessionStatus").textContent = message;
    el("sessionRequest").hidden = canMutate();
    el("sessionRequest").disabled =
      acquiring || mode === "unsupported" || mode === "conflict";
    el("sessionYield").hidden = !canMutate();
    el("sessionRecover").hidden = mode !== "conflict";
    el("sessionDraft").hidden = mode !== "conflict";
    el("sessionWriterStatus").textContent = canMutate()
      ? "이 창에서 운영 중입니다."
      : "읽기 전용입니다. 다른 창의 진행을 변경하지 않습니다.";
  }
  function cancelInputs() {
    if (typeof pinResolver === "function") {
      const resolve = pinResolver;
      pinResolver = null;
      resolve(false);
    }
    document
      .querySelectorAll(".dim.on,.panel.on")
      .forEach((s) => s.classList.remove("on"));
    if (typeof cancelEndingRuntime === "function") cancelEndingRuntime();
  }
  function viewLatest() {
    if (canMutate() || mode === "conflict" || !initializeReader) return;
    try {
      initializeReader();
      cancelInputs(); // Reader controls remain usable; no blocked receipt/PIN overlay.
    } catch (error) {
      message =
        "저장본을 읽지 못했습니다. 사이트 데이터를 지우지 말고 저장 권한을 확인하세요.";
      console.error("[session read]", error);
    }
    render();
  }
  function conflict() {
    if (!canMutate()) return;
    mode = "conflict";
    epoch++;
    cancelInputs();
    message =
      "저장본이 다른 곳에서 변경되어 운영을 중단했습니다. 이 창 진행과 최신 저장본을 따로 백업할 수 있습니다.";
    render();
  }
  function verify(raw) {
    if (!canMutate()) return false;
    if (raw !== expected) {
      conflict();
      return false;
    }
    return true;
  }
  function committed(raw) {
    expected = raw;
    send("saved");
  }
  function safeReason() {
    if (!canMutate()) return "현재 운영 창에서만 넘길 수 있습니다.";
    if (PwaRuntime.applying) return "앱 업데이트가 끝난 뒤 넘겨주세요.";
    if (endingPhase !== "idle" || endingEls().popup.style.display === "flex")
      return "엔딩을 마치거나 닫은 뒤 넘겨주세요.";
    if (
      pinResolver ||
      [...document.querySelectorAll(".dim.on,.panel.on")].some(
        (s) => s.id !== "modalSettings",
      )
    )
      return "미수령·입력·패널 창을 닫은 뒤 넘겨주세요. 닫아도 보상은 유지됩니다.";
    if (el("saveTransferText")?.value.trim())
      return "백업 입력을 보관한 뒤 입력란을 비워주세요.";
    return "";
  }
  function yieldWriter() {
    const reason = safeReason();
    if (reason) {
      message = reason;
      requested = true;
      render();
      return false;
    }
    if (!save(true)) {
      message =
        "저장에 실패했습니다. 이 창에서 진행을 보존하며 운영을 넘기지 않습니다.";
      requested = true;
      render();
      return false;
    }
    yielded = true;
    mode = "reader";
    epoch++;
    hidden = false;
    cancelInputs();
    message = "운영을 넘겼습니다. 최신 저장본을 읽기 전용으로 표시합니다.";
    const release = releaseLock;
    releaseLock = null;
    held = false;
    release?.();
    send("released");
    viewLatest();
    render();
    return true;
  }
  async function acquire(queued = false) {
    if (acquiring || held || !initializeWriter || mode === "unsupported")
      return false;
    acquiring = true;
    if (queued)
      message =
        "다른 운영 창에서 저장 후 넘겨주세요. 창을 닫으면 최신 저장본으로 이어갑니다.";
    render();
    return new Promise((resolve) => {
      navigator.locks
        .request(
          lockName,
          queued ? {} : { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              const firstRead = mode !== "reader";
              mode = "reader";
              acquiring = false;
              if (firstRead) viewLatest();
              else render();
              resolve(false);
              return;
            }
            held = true;
            mode = "writer";
            epoch++;
            acquiring = false;
            requested = false;
            yielded = false;
            hidden = document.hidden;
            const hold = new Promise((done) => {
              releaseLock = done;
            });
            try {
              expected = localStorage.getItem(key);
              initializeWriter();
              message = "이 창에서 운영 중입니다. 다른 창은 읽기 전용입니다.";
              send("owner");
              render();
              resolve(true);
              await hold;
            } catch (error) {
              mode = "unsupported";
              held = false;
              releaseLock = null;
              acquiring = false;
              message =
                "안전한 운영을 시작하지 못했습니다. 저장본을 보존한 채 읽기 전용으로 유지합니다.";
              console.error("[session start]", error);
              render();
              resolve(false);
            }
          },
        )
        .catch((error) => {
          acquiring = false;
          mode = "unsupported";
          message =
            "브라우저가 운영 잠금을 제공하지 않아 읽기 전용입니다. 지원 브라우저에서 다시 열어주세요.";
          console.warn("[session lock]", error);
          viewLatest();
          render();
          resolve(false);
        });
    });
  }
  async function start(writer, reader) {
    initializeWriter = writer;
    initializeReader = reader;
    if (!isSecureContext || !navigator.locks?.request) {
      mode = "unsupported";
      message =
        "이 브라우저에서는 안전한 운영 잠금을 사용할 수 없어 읽기 전용입니다. HTTPS/지원 브라우저를 사용하세요.";
      viewLatest();
    } else {
      message = "다른 창이 운영 중이면 읽기 전용으로 기다립니다.";
      await acquire();
    }
    readyResolve();
    render();
  }
  async function request() {
    if (mode === "unsupported" || mode === "conflict" || canMutate())
      return false;
    yielded = false;
    send("request");
    return acquire(true);
  }
  function recover() {
    if (mode !== "conflict" || !held) return false;
    if (
      !confirm(
        "이 창의 미저장 진행은 백업했나요? 최신 저장본으로 다시 시작합니다. 자동 합산하지 않습니다.",
      )
    )
      return false;
    try {
      expected = localStorage.getItem(key);
      mode = "writer";
      epoch++;
      initializeWriter();
      message = "최신 저장본에서 운영을 다시 시작했습니다.";
      render();
      return true;
    } catch (error) {
      mode = "conflict";
      message = "최신 저장본을 읽지 못했습니다. 두 백업을 보존해 주세요.";
      console.error(error);
      render();
      return false;
    }
  }
  function download(localDraft = false) {
    try {
      let raw;
      if (localDraft) {
        BranchManager.saveCurrent();
        raw = JSON.stringify(
          {
            app: "niceChicken",
            type: "manual-save-export",
            version: 1,
            saveKey: key,
            exportedAt: Date.now(),
            data: state,
          },
          null,
          2,
        );
      } else {
        const payload = readSavePayload();
        raw = payload
          ? JSON.stringify(
              {
                app: "niceChicken",
                type: "manual-save-export",
                version: 1,
                saveKey: key,
                exportedAt: Date.now(),
                data: payload.data,
              },
              null,
              2,
            )
          : "";
      }
      el("sessionBackupText").value = raw;
      el("sessionBackupText").hidden = false;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      link.download = localDraft
        ? "nice-chicken-unsaved.json"
        : "nice-chicken-saved.json";
      el("sessionControls").append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      message = "백업을 읽지 못했습니다. 저장 권한을 확인하세요.";
      console.error(error);
      render();
    }
  }
  channel?.addEventListener("message", ({ data }) => {
    if (data?.id === id) return;
    if (data?.type === "request" && canMutate()) {
      requested = true;
      message =
        "다른 창에서 운영을 요청했습니다. 입력을 마치고 저장 후 넘겨주세요.";
      render();
    }
    if (
      data?.type === "released" &&
      !yielded &&
      mode === "reader" &&
      !acquiring &&
      !document.hidden
    )
      acquire();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    if (canMutate()) {
      try {
        verify(localStorage.getItem(key));
      } catch (_) {
        conflict();
      }
    } else if (mode !== "conflict" && !refreshPending) {
      refreshPending = true;
      queueMicrotask(() => {
        refreshPending = false;
        viewLatest();
      });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!canMutate()) return;
    if (document.hidden) hidden = true;
    else if (hidden) {
      hidden = false;
      applyOfflineProgress();
      save(true);
      updateUI();
    }
  });
  for (const type of [
    "click",
    "pointerdown",
    "mousedown",
    "touchstart",
    "keydown",
  ])
    window.addEventListener(
      type,
      (event) => {
        if (!canMutate() && !event.target.closest?.("#sessionControls")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true, passive: false },
    );
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      el("sessionRequest").addEventListener("click", request);
      el("sessionYield").addEventListener("click", yieldWriter);
      el("yieldFromSettings").addEventListener("click", yieldWriter);
      el("sessionRecover").addEventListener("click", recover);
      el("sessionExport").addEventListener("click", () => download(false));
      el("sessionDraft").addEventListener("click", () => download(true));
      render();
      setInterval(() => {
        if (mode === "reader" && !yielded && !acquiring && !document.hidden)
          acquire();
      }, 1000);
    },
    { once: true },
  );
  return {
    ready,
    start,
    request,
    yieldWriter,
    canMutate,
    verify,
    committed,
    observed(raw) {
      if (canMutate()) expected = raw;
    },
    get mode() {
      return mode;
    },
    canTick() {
      return canMutate() && !hidden;
    },
    token() {
      return { epoch, root: state, region: state.regionId };
    },
    matches(token) {
      return (
        canMutate() &&
        token?.epoch === epoch &&
        token.root === state &&
        token.region === state.regionId
      );
    },
  };
})();
