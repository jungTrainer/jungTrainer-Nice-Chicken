/* IMP-06: UI-only surface ownership, focus and viewport adaptation. */
document.addEventListener(
  "DOMContentLoaded",
  () => {
    document.querySelectorAll("[data-game-guide]").forEach(container => {
      container.append(document.getElementById("gameGuideTemplate").content.cloneNode(true));
    });
    const app = document.getElementById("app"),
      nav = app.querySelector("nav");
    const surfaces = [
      ...document.querySelectorAll(".dim,.panel"),
      endingEls().popup,
      endingEls().overlay,
    ];
    const opened = [],
      returnFocus = new WeakMap();
    let top = null,
      lastTrigger = null;
    const visible = (surface) =>
      surface.matches(".dim,.panel")
        ? surface.classList.contains("on")
        : surface.style.display === "flex";
    const panel = (surface) => surface?.classList.contains("panel");
    function close(surface) {
      if (surface.id === "modalPin") {
        document.getElementById("pinCancel").click();
        return;
      }
      if (surface.id === "endingOverlay") {
        cancelEndingRuntime();
        restoreEndingUI();
      } else if (surface.id === "endingConditionPopup") closeEndingPopup();
      else if (panel(surface)) closePanels();
      else surface.classList.remove("on");
      sync();
    }
    function controls(surface) {
      const roots = panel(surface) ? [surface, nav] : [surface];
      return roots
        .flatMap((root) => [
          ...root.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ])
        .filter(
          (e) =>
            !e.inert &&
            e.getClientRects().length &&
            getComputedStyle(e).visibility !== "hidden",
        );
    }
    function owned(target) {
      return (
        !!target.closest?.("#sessionControls") || !top || top.contains(target) || (panel(top) && nav.contains(target))
      );
    }
    function sync() {
      const previous = top;
      for (const surface of surfaces) {
        const index = opened.indexOf(surface);
        if (visible(surface) && index < 0) {
          opened.push(surface);
          returnFocus.set(surface, lastTrigger || document.activeElement);
        }
        if (!visible(surface) && index >= 0) opened.splice(index, 1);
      }
      top = visible(endingEls().overlay)
        ? endingEls().overlay
        : visible(endingEls().popup)
          ? endingEls().popup
          : opened.filter((s) => s.classList.contains("dim")).at(-1) ||
            opened.at(-1) ||
            null;
      for (const [i, surface] of opened.entries()) {
        if (surface.classList.contains("dim")) {
          const z = String(4000 + i);
          if (surface.style.zIndex !== z) surface.style.zIndex = z;
        }
      }
      for (const surface of surfaces) {
        surface.inert = surface !== top;
        surface.setAttribute(
          "aria-hidden",
          String(!visible(surface) || surface !== top),
        );
        if (surface === top) surface.setAttribute("aria-modal", "true");
        else surface.removeAttribute("aria-modal");
      }
      for (const root of [
        app.querySelector("header"),
        document.getElementById("stageWrap"),
        document.getElementById("menuBar"),
        nav,
        endingEls().replay,
        document.getElementById("endingPreviewBtn"),
      ])
        root.inert = !!top && !(panel(top) && root === nav);
      if (previous !== top) {
        const restore =
          previous && !visible(previous) ? returnFocus.get(previous) : null;
        if (
          restore?.isConnected &&
          !restore.closest("[inert]") &&
          owned(restore)
        ) {
          restore.focus({ preventScroll: true });
        } else if (top) {
          const focus = top.querySelector("input") || controls(top)[0] || top;
          focus.focus({ preventScroll: true });
        }
      }
    }
    for (const surface of surfaces) {
      surface.setAttribute("role", "dialog");
      surface.tabIndex = -1;
      const title = surface.querySelector("h3");
      if (title) {
        title.id ||= surface.id + "Title";
        surface.setAttribute("aria-labelledby", title.id);
      } else
        surface.setAttribute(
          "aria-label",
          surface.id === "endingOverlay" ? "가족 이야기" : "엔딩 안내",
        );
      if (panel(surface)) continue;
      const content = surface.querySelector(
        ".modal,.endingPopupInner,.endingViewport",
      );
      if (!content) continue;
      let head = content.querySelector(".pHead");
      if (!head && surface.id === "modalExpansion")
        head = content.firstElementChild;
      if (!head) {
        head = document.createElement("div");
        head.className = "ui-modal-head";
        if (title) head.append(title);
        content.prepend(head);
      }
      head.classList.add("ui-modal-head");
      if (!head.querySelector("button")) {
        const button = document.createElement("button");
        button.className = "closeBtn";
        button.type = "button";
        button.textContent = "✕";
        button.dataset.uiClose = surface.id;
        button.setAttribute("aria-label", "닫기");
        button.addEventListener("click", () => close(surface));
        head.append(button);
      }
      surface.addEventListener("click", (event) => {
        if (event.target === surface && surface.id !== "endingOverlay")
          close(surface);
      });
    }
    document
      .querySelectorAll(".closeBtn")
      .forEach((button) => button.setAttribute("aria-label", "닫기"));
    document
      .querySelectorAll(".iconBtn")
      .forEach((button) => button.setAttribute("aria-label", button.title));
    document.querySelectorAll(".scroll").forEach((scroll) => {
      scroll.tabIndex = 0;
      scroll.setAttribute("aria-label", "목록 스크롤");
    });
    const pendingButton = document.createElement("button");
    pendingButton.id = "openOfflineReward";
    pendingButton.className = "btn alt";
    pendingButton.type = "button";
    pendingButton.textContent = "미수령 수익 보기";
    pendingButton.addEventListener("click", () => {
      if (state.offlineReward.amount > 0) renderOfflineReward();
      else showToast("미수령 수익이 없습니다.");
    });
    const pendingRow = document.createElement("div");
    pendingRow.className = "row";
    pendingRow.append(pendingButton);
    document.querySelector("#modalSettings .ui-modal-head").after(pendingRow);
    const wrap = endingEls().wrap;
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "button");
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        nextEndingStep();
      }
    });
    document.getElementById("mapWrap").addEventListener("keydown", (event) => {
      const node = event.target.closest(".map-node");
      if (node && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        const id = node.dataset.regionId;
        node.click();
        document.querySelector(`.map-node[data-region-id="${id}"]`)?.focus();
      }
    });
    function guard(event) {
      sync();
      const surface = event.target.closest?.(
        ".dim,.panel,#endingOverlay,#endingConditionPopup",
      );
      if (!owned(event.target) || (surface && !visible(surface))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.type === "click")
        lastTrigger =
          event.target.closest?.("button") || document.activeElement;
    }
    for (const type of ["click", "pointerdown", "mousedown", "touchstart"])
      window.addEventListener(type, guard, { capture: true, passive: false });
    window.addEventListener(
      "keydown",
      (event) => {
        sync();
        if (!top) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          close(top);
          return;
        }
        if (event.key === "Tab") {
          const list = controls(top),
            index = list.indexOf(document.activeElement);
          if (!list.length) {
            event.preventDefault();
            top.focus();
            return;
          }
          if (
            index < 0 ||
            (!event.shiftKey && index === list.length - 1) ||
            (event.shiftKey && index === 0)
          ) {
            event.preventDefault();
            list[event.shiftKey ? list.length - 1 : 0].focus();
          }
        } else if (!owned(event.target)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener("focusin", (event) => {
      if (top && !owned(event.target))
        (controls(top)[0] || top).focus({ preventScroll: true });
    });
    const observer = new MutationObserver(sync);
    surfaces.forEach((surface) =>
      observer.observe(surface, {
        attributes: true,
        attributeFilter: ["class", "style"],
      }),
    );
    function viewport() {
      const view = window.visualViewport,
        root = document.documentElement;
      for (const [name, value] of Object.entries({
        "--viewport-height": view?.height || innerHeight,
        "--viewport-width": view?.width || innerWidth,
        "--viewport-top": view?.offsetTop || 0,
        "--viewport-left": view?.offsetLeft || 0,
        "--header-height": app.querySelector("header").getBoundingClientRect()
          .height,
        "--nav-height": nav.getBoundingClientRect().height,
      })) {
        const next = value + "px";
        if (root.style.getPropertyValue(name) !== next)
          root.style.setProperty(name, next);
      }
      resizeCanvas();
    }
    window.addEventListener("resize", viewport);
    window.visualViewport?.addEventListener("resize", viewport);
    window.visualViewport?.addEventListener("scroll", viewport);
    const resize = new ResizeObserver(viewport);
    resize.observe(app.querySelector("header"));
    resize.observe(nav);
    viewport();
    sync();
  },
  { once: true },
);
