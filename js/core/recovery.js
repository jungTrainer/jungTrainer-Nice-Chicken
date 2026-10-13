/* IMP-14: inspect raw candidates before normalization or writes. No server calls. */
const SaveRecovery = (() => {
  const key = "niceChicken_idleServe_vFinal",
    backupKey = key + "_backup",
    fenceKey = key + "_resetFence",
    archiveKey = key + "_recoveryArchive";
  let interactive = false;
  let blocked = false,
    visible = false,
    inspection = null,
    failure = "",
    authorised = null;
  const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const uuid = () => crypto.randomUUID();
  // Accidental-change identifier only; not a cryptographic signature/authentication.
  function identity(raw) {
    if (raw === null) return "absent";
    let a = 2166136261,
      b = 3339675911;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      a = Math.imul(a ^ c, 16777619);
      b = Math.imul(b ^ c, 2246822519);
    }
    return (
      raw.length + ":" + (a >>> 0).toString(16) + ":" + (b >>> 0).toString(16)
    );
  }
  function validate(data, root = true) {
    if (!object(data)) return "게임 객체가 아닙니다.";
    const legacyPartial =
      data.version === undefined &&
      object(data.profile) &&
      typeof data.profile.name === "string" &&
      object(data.coupons) &&
      object(data.offlineReward);
    if (
      root &&
      (!isMoney(data.money) ||
        !Number.isFinite(data.level) ||
        data.level < 1 ||
        !object(data.upgrades) ||
        (!object(data.research) &&
          !(legacyPartial && data.research === undefined)) ||
        (!object(data.menuStats) &&
          !(legacyPartial && data.menuStats === undefined)))
    )
      return "필수 금액·레벨·성장 데이터가 올바르지 않습니다.";
    if (
      root &&
      data.version !== undefined &&
      (!Number.isSafeInteger(data.version) || data.version > CONFIG.version)
    )
      return "지원하지 않는 저장 버전입니다.";
    if (
      data.moneyEncoding !== undefined &&
      data.moneyEncoding !== MONEY_ENCODING
    )
      return "지원하지 않는 금액 형식입니다.";
    for (const name of [
      "profile",
      "coupons",
      "cert",
      "upgrades",
      "research",
      "menuStats",
      "staffStats",
      "missions",
      "offlineReward",
      "serviceTimers",
      "management",
      "branches",
      "regionUnlocked",
    ])
      if (data[name] !== undefined && !object(data[name]))
        return name + " 구조가 올바르지 않습니다.";
    for (const name of ["customers", "benefitsLog"])
      if (data[name] !== undefined && !Array.isArray(data[name]))
        return name + " 목록이 올바르지 않습니다.";
    for (const name of [
      "endingSeen",
      "endingUnlocked",
      "endingPrompted",
      "robotGrandson",
    ])
      if (data[name] !== undefined && typeof data[name] !== "boolean")
        return "엔딩 지급 상태가 올바르지 않습니다.";
    if (data.coupons)
      for (const n of ["drink", "veg"])
        if (
          data.coupons[n] !== undefined &&
          (!Number.isSafeInteger(data.coupons[n]) || data.coupons[n] < 0)
        )
          return "쿠폰 수량이 올바르지 않습니다.";
    if (data.cert) {
      for (const n of ["issuedAt", "validUntil", "usedAt"])
        if (
          data.cert[n] !== undefined &&
          (!Number.isFinite(data.cert[n]) || data.cert[n] < 0)
        )
          return "인증서 시각이 올바르지 않습니다.";
      if (
        data.cert.issuedThisWeek !== undefined &&
        typeof data.cert.issuedThisWeek !== "boolean"
      )
        return "인증서 지급 상태가 올바르지 않습니다.";
    }
    if (
      data.offlineReward &&
      data.offlineReward.amount !== undefined &&
      (!isMoney(data.offlineReward.amount) ||
        moneyCompare(data.offlineReward.amount, 0) < 0)
    )
      return "확정 미수령 금액이 올바르지 않습니다.";
    if (data.research) {
      if (
        data.research.running !== undefined &&
        !Array.isArray(data.research.running)
      )
        return "연구 목록이 올바르지 않습니다.";
      if (data.research.levels !== undefined && !object(data.research.levels))
        return "연구 레벨이 올바르지 않습니다.";
    }
    if (data.missions) {
      if (
        data.missions.dailyCompletedToday !== undefined &&
        typeof data.missions.dailyCompletedToday !== "boolean"
      )
        return "미션 지급 상태가 올바르지 않습니다.";
      for (const n of ["dailyList", "weeklyList"])
        if (
          data.missions[n] !== undefined &&
          (!Array.isArray(data.missions[n]) ||
            data.missions[n].some(
              (g) =>
                !object(g) ||
                (g.done !== undefined && typeof g.done !== "boolean"),
            ))
        )
          return "미션 목표/완료 상태가 올바르지 않습니다.";
    }
    const meta = data._saveRecovery;
    if (
      meta !== undefined &&
      (!object(meta) ||
        meta.version !== 1 ||
        typeof meta.generation !== "string" ||
        !meta.generation ||
        typeof meta.commit !== "string" ||
        !meta.commit)
    )
      return "지원하지 않는 복구 metadata입니다.";
    if (root && data.branches)
      for (const branch of Object.values(data.branches)) {
        if (
          !object(branch) ||
          (branch.data !== undefined && !object(branch.data))
        )
          return "지점 snapshot이 올바르지 않습니다.";
        if (branch.data) {
          const reason = validate(branch.data, false);
          if (reason) return "지점: " + reason;
        }
      }
    return "";
  }
  function candidate(raw, source, error = "") {
    const c = {
      source,
      raw,
      data: null,
      valid: false,
      eligible: false,
      reason: error || "",
      status: error ? "read-error" : raw === null ? "missing" : "invalid",
    };
    if (error || raw === null) return c;
    try {
      if (raw.length > 8 * 1024 * 1024)
        throw Error("저장 크기가 지원 범위를 초과합니다.");
      c.data = JSON.parse(raw);
      c.reason = validate(c.data);
      if (c.reason) return c;
      c.valid = true;
      c.eligible = true;
      c.status = "valid";
    } catch (e) {
      c.reason = e.message || "JSON을 읽을 수 없습니다.";
    }
    return c;
  }
  function readItem(k) {
    try {
      return { raw: localStorage.getItem(k), error: "" };
    } catch (e) {
      return { raw: null, error: "저장 읽기 권한/오류: " + e.message };
    }
  }
  function inspect() {
    const p = readItem(key),
      b = readItem(backupKey),
      f = readItem(fenceKey);
    const primary = candidate(p.raw, "primary", p.error),
      backup = candidate(b.raw, "backup", b.error);
    let fence = null,
      fenceError = f.error;
    if (f.raw !== null && !f.error)
      try {
        fence = JSON.parse(f.raw);
        if (
          !object(fence) ||
          fence.version !== 1 ||
          typeof fence.generation !== "string" ||
          typeof fence.previous !== "string"
        )
          throw Error("초기화 세대 표시가 올바르지 않습니다.");
      } catch (e) {
        fenceError = e.message;
      }
    if (fenceError) {
      primary.eligible = false;
      backup.eligible = false;
    } else if (fence) {
      backup.eligible =
        backup.valid &&
        backup.data._saveRecovery?.generation === fence.generation;
      if (backup.valid && !backup.eligible) {
        backup.status = "reset-excluded";
        backup.reason = "초기화 준비/완료 이전 세대입니다. 복구할 수 없습니다.";
      }
      primary.eligible =
        primary.valid &&
        (primary.data._saveRecovery?.generation === fence.generation ||
          identity(p.raw) === fence.previous);
      if (primary.valid && !primary.eligible) {
        primary.reason = "초기화 세대를 확인할 수 없습니다.";
        primary.status = "reset-excluded";
      }
    }
    const fresh =
      p.raw === null &&
      b.raw === null &&
      f.raw === null &&
      !p.error &&
      !b.error &&
      !f.error;
    const result = {
      primary,
      backup,
      fence,
      fenceRaw: f.raw,
      fenceError,
      fresh,
    };
    result.blocked =
      !!p.error || !!b.error || !!fenceError || (!fresh && !primary.eligible);
    result.status = fresh
      ? "new"
      : result.blocked
        ? "recovery-required"
        : "ready";
    return result;
  }
  function observe(result) {
    inspection = result;
    blocked =
      result.blocked ||
      (blocked &&
        typeof SessionOwner !== "undefined" &&
        SessionOwner.ownsLock() &&
        SessionOwner.mode === "writer");
    if (blocked) visible = true;
    render();
    return result;
  }
  function read() {
    const s = observe(inspect());
    const c = s.primary.eligible
      ? s.primary
      : s.backup.eligible
        ? s.backup
        : null;
    return c
      ? { data: c.data, source: c.source, raw: c.raw, preview: s.blocked }
      : null;
  }
  function checkBeforeWrite(raw) {
    const s = inspect();
    if (
      authorised &&
      raw === authorised.primary.raw &&
      s.backup.raw === authorised.backup.raw &&
      s.fenceRaw === authorised.fenceRaw
    )
      return true;
    if (s.blocked) {
      observe(s);
      failure = "정상 본 저장을 확인할 수 없어 쓰기를 멈췄습니다.";
      SessionOwner.refresh();
      return false;
    }
    inspection = s;
    return true;
  }
  function metadata() {
    const s = authorised || inspection || inspect();
    return {
      version: 1,
      generation:
        s.fence?.generation || state._saveRecovery?.generation || uuid(),
      commit: uuid(),
    };
  }
  function prepareReset(raw) {
    const s = inspect();
    if (s.blocked || s.primary.raw !== raw) {
      observe(s);
      return false;
    }
    try {
      const f = {
        version: 1,
        generation: uuid(),
        previous: identity(raw),
        preparedAt: Date.now(),
      };
      localStorage.setItem(fenceKey, JSON.stringify(f));
      inspection = inspect();
      return true;
    } catch (e) {
      note("초기화 준비 저장 실패. 현재 진행을 유지합니다. " + e.message);
      return false;
    }
  }
  function note(message) {
    failure = message;
    if (blocked) visible = true;
    render();
    SessionOwner.refresh();
  }
  function committed() {
    authorised = null;
    inspection = inspect();
    blocked = inspection.blocked;
    render();
    SessionOwner.refresh();
  }
  function open() {
    interactive = true;
    visible = true;
    observe(inspect());
    SessionOwner.refresh();
    document.getElementById("recoveryRefresh")?.focus();
  }
  function refresh() {
    observe(inspect());
    SessionOwner.refresh();
  }
  function rawArchive() {
    const s = inspection || inspect();
    return JSON.stringify(
      {
        app: "niceChicken",
        type: "recovery-raw-archive",
        version: 1,
        capturedAt: Date.now(),
        unsaved:
          _saveDirty && SessionOwner.ownsLock() ? JSON.stringify(state) : null,
        originals: {
          primary: s.primary.raw,
          backup: s.backup.raw,
          resetFence: s.fenceRaw,
        },
        readErrors: {
          primary: s.primary.reason,
          backup: s.backup.reason,
          fence: s.fenceError,
        },
      },
      null,
      2,
    );
  }
  function download(raw, name) {
    const text = document.getElementById("recoveryRawText");
    text.value = raw;
    text.hidden = false;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    a.download = name;
    document.getElementById("recoveryPanel").append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportRaw() {
    interactive = true;
    refresh();
    download(rawArchive(), "nice-chicken-originals.json");
  }
  function exportDraft() {
    BranchManager.saveCurrent();
    download(
      JSON.stringify(
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
      ),
      "nice-chicken-unsaved.json",
    );
  }
  function restore(source, external = null) {
    if (
      !SessionOwner.ownsLock() ||
      !["writer", "conflict"].includes(SessionOwner.mode)
    )
      return false;
    const current = inspect(),
      seen = inspection;
    if (
      !seen ||
      current.primary.raw !== seen.primary.raw ||
      current.backup.raw !== seen.backup.raw ||
      current.fenceRaw !== seen.fenceRaw
    ) {
      observe(current);
      note("저장본이 바뀌었습니다. 다시 확인하고 선택해 주세요.");
      return false;
    }
    if (
      current.primary.status === "read-error" ||
      current.backup.status === "read-error"
    ) {
      note("저장 읽기 권한을 먼저 복구해 주세요.");
      return false;
    }
    let selected = external ? candidate(external, "manual") : current[source];
    if (!selected?.eligible) {
      note(selected?.reason || "이 후보로 복구할 수 없습니다.");
      return false;
    }
    if (
      !confirm(
        "선택한 " +
          (external
            ? "외부 백업"
            : source === "backup"
              ? "이전 백업"
              : "본 저장") +
          "으로 진행을 교체할까요?\n이전 후보의 최신성/지급 이력은 보장하지 않습니다. 자동 합산·과거 수익 추가 없이 원문을 보관합니다.",
      )
    )
      return false;
    const original = state,
      wasDirty = _saveDirty,
      fx = structuredClone(window._fxState);
    try {
      localStorage.setItem(archiveKey, rawArchive());
      // External import deliberately starts a new generation; never use a damaged fence.
      if (external) {
        localStorage.setItem(
          fenceKey,
          JSON.stringify({
            version: 1,
            generation: uuid(),
            previous: identity(current.primary.raw),
            preparedAt: Date.now(),
          }),
        );
        current.fenceRaw = localStorage.getItem(fenceKey);
        current.fence = JSON.parse(current.fenceRaw);
      }
      if (!SessionOwner.recoveryAccess(current.primary.raw)) return false;
      authorised = current;
      blocked = false;
      if (!load({ data: structuredClone(selected.data) }))
        throw Error("선택 후보를 정규화하지 못했습니다.");
      state.lastSeenAt = Date.now();
      if (!save(true)) throw Error("본 저장 commit 실패");
      cancelEndingRuntime();
      initAfterLoad(false);
      failure =
        "선택한 저장본으로 복구했습니다. 과거 수익은 추가하지 않았습니다.";
      visible = true;
      render();
      SessionOwner.refresh();
      return true;
    } catch (e) {
      state = original;
      bindBranchServiceTimers();
      window._fxState = fx;
      invalidateDerivedEffects();
      _saveDirty = wasDirty;
      authorised = null;
      observe(inspect());
      blocked = true;
      note("복구 실패. 원본과 미수령을 유지합니다. " + e.message);
      return false;
    }
  }
  function importRaw() {
    let parsed;
    try {
      parsed = JSON.parse(document.getElementById("recoveryImportText").value);
    } catch (e) {
      note("백업 JSON 형식이 올바르지 않습니다.");
      return false;
    }
    if (parsed?.app === "niceChicken") {
      if (parsed.type !== "manual-save-export" || parsed.version !== 1) {
        note(
          "지원하지 않는 백업 파일입니다. 원문 보관 파일은 자동 가져오기 대상이 아닙니다.",
        );
        return false;
      }
      parsed = parsed.data;
    }
    return restore("manual", JSON.stringify(parsed));
  }
  function render() {
    const notice = document.getElementById("savePersistenceNotice");
    if (notice) {
      notice.textContent = failure;
      notice.hidden = !failure;
    }
    const panel = document.getElementById("recoveryPanel");
    if (!panel) return;
    panel.hidden = !visible;
    const s = inspection;
    document.getElementById("recoveryStatus").textContent =
      (blocked ? "저장 확인이 필요해 운영을 멈췄습니다. " : "") +
      failure +
      (s?.fenceError ? " " + s.fenceError : "");
    if (s)
      for (const n of ["primary", "backup"]) {
        const c = s[n],
          d = c.data;
        let summary = c.status === "missing" ? "없음" : c.reason || "검사 통과";
        if (c.valid)
          summary +=
            " · " +
            (d.regionId || "구 저장") +
            " · " +
            fmtWon(d.money) +
            " · 미수령 " +
            fmtWon(d.offlineReward?.amount || 0) +
            " · " +
            (Number.isFinite(d.lastSeenAt)
              ? new Date(d.lastSeenAt).toLocaleString("ko-KR")
              : "시각 없음");
        document.getElementById(
          "recovery" + (n === "primary" ? "Primary" : "Backup") + "Info",
        ).textContent = summary;
      }
    const owner =
      typeof SessionOwner !== "undefined" &&
      SessionOwner.ownsLock() &&
      ["writer", "conflict"].includes(SessionOwner.mode);
    document.getElementById("recoverPrimary").disabled =
      !owner || !s?.primary.eligible;
    document.getElementById("recoverBackup").disabled =
      !owner || !s?.backup.eligible;
    document.getElementById("recoveryImport").disabled = !owner;
    document.getElementById("recoveryDraft").hidden = !owner || !_saveDirty;
    document.getElementById("recoveryRetry").disabled =
      !SessionOwner.canMutate();
  }
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      document.getElementById("openRecovery").addEventListener("click", open);
      document
        .getElementById("openRecoverySettings")
        .addEventListener("click", open);
      document
        .getElementById("recoveryRefresh")
        .addEventListener("click", refresh);
      document
        .getElementById("recoveryExport")
        .addEventListener("click", exportRaw);
      document
        .getElementById("recoveryDraft")
        .addEventListener("click", exportDraft);
      document
        .getElementById("recoverPrimary")
        .addEventListener("click", () => restore("primary"));
      document
        .getElementById("recoverBackup")
        .addEventListener("click", () => restore("backup"));
      document
        .getElementById("recoveryImport")
        .addEventListener("click", importRaw);
      document.getElementById("recoveryRetry").addEventListener("click", () => {
        if (save(true)) {
          failure = "현재 진행을 저장했습니다.";
          render();
        }
      });
      document.getElementById("recoveryClose").addEventListener("click", () => {
        visible = false;
        interactive = false;
        SessionOwner.refresh();
        if (SessionOwner.canMutate())
          document.getElementById("openRecoverySettings")?.focus();
        else document.getElementById("openRecovery")?.focus();
      });
    },
    { once: true },
  );
  return {
    inspect,
    read,
    validate,
    checkBeforeWrite,
    metadata,
    prepareReset,
    note,
    committed,
    open,
    refresh,
    restore,
    render,
    identity,
    get busy() {
      return (
        blocked ||
        (visible &&
          (interactive ||
            !!document.getElementById("recoveryImportText")?.value.trim()))
      );
    },
    get blocked() {
      return blocked;
    },
    get visible() {
      return visible;
    },
    get status() {
      return blocked
        ? "recovery-required"
        : inspection?.status || "uninspected";
    },
    get canOperate() {
      return !blocked;
    },
  };
})();
