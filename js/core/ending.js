let endingPhase = "idle",
  endingRun = 0,
  endingFrame = null,
  endingFadeResolve = null,
  endingFinishTimer = null,
  endingFinishResolve = null;

const endingBindings = new WeakSet();

const originalGrandson = structuredClone(
  STAFF_POOL.find((s) => s.key === "grandson"),
);

function cancelEndingFade() {
  if (endingFrame !== null) cancelAnimationFrame(endingFrame);
  endingFrame = null;
  if (endingFadeResolve) endingFadeResolve(false);
  endingFadeResolve = null;
}

function cancelEndingRuntime() {
  endingRun++;
  endingPhase = "idle";
  clearEndingTyping();
  cancelEndingFade();
  clearTimeout(endingFinishTimer);
  endingFinishTimer = null;
  if (endingFinishResolve) endingFinishResolve(false);
  endingFinishResolve = null;
  if (__endingAudio) {
    __endingAudio.pause();
    __endingAudio.volume = 0;
    try {
      __endingAudio.currentTime = 0;
    } catch (_) {}
  }
  __endingStep = 0;
  closeEndingPopup();
  const el = endingEls();
  el.overlay.classList.remove("active");
  el.overlay.style.display = "none";
  el.overlay.setAttribute("aria-hidden", "true");
  el.text.textContent = "";
  el.miss.style.display = "none";
}

function applyRobotGrandson() {
  const staff = STAFF_POOL.find((s) => s.key === "grandson");
  Object.assign(staff, structuredClone(originalGrandson));
  if (state.robotGrandson)
    Object.assign(staff, {
      label: "로봇손주",
      emoji: "🤖",
      lines: ["할머니, 제가 도울게요 🤖", "매출은 제가 책임질게요!"],
    });
}

function restoreEndingUI() {
  if (state.endingPrompted || state.endingSeen || state.robotGrandson)
    state.endingUnlocked = true;
  if (state.endingSeen || state.robotGrandson) state.endingPrompted = true;
  applyRobotGrandson();
  bindEndingUI();
  const el = endingEls();
  el.replay.style.display = state.endingUnlocked ? "block" : "none";
  el.replay.disabled = endingPhase !== "idle";
  el.yes.disabled = endingPhase !== "idle";
}

function fadeAudioTo(target, ms) {
  cancelEndingFade();
  const a = ensureEndingAudio(),
    volume = a.volume,
    start = performance.now();
  if (volume === target) return Promise.resolve(true);
  return new Promise((resolve) => {
    endingFadeResolve = resolve;
    const frame = (t) => {
      const progress = Math.min(1, (t - start) / ms);
      a.volume = volume + (target - volume) * progress;
      if (progress === 1) {
        endingFrame = null;
        endingFadeResolve = null;
        resolve(true);
      } else endingFrame = requestAnimationFrame(frame);
    };
    endingFrame = requestAnimationFrame(frame);
  });
}

async function playEndingLoop(run) {
  if (!state.soundOn) return;
  const a = ensureEndingAudio();
  try {
    await a.play();
    if (run !== endingRun || endingPhase !== "playing") {
      if (endingPhase === "idle") a.pause();
      return;
    }
    await fadeAudioTo(0.85, 900);
  } catch (_) {}
}

async function stopEndingLoopFade(run) {
  if (!__endingAudio) return;
  await fadeAudioTo(0, 900);
  if (run !== endingRun) return;
  __endingAudio.pause();
  __endingAudio.currentTime = 0;
}

async function startEndingSequence() {
  if (!SessionOwner.canMutate()) return false;
  if (!state.endingUnlocked || endingPhase !== "idle") return false;
  endingPhase = "playing";
  const run = ++endingRun;
  closeEndingPopup();
  restoreEndingUI();
  const el = endingEls();
  el.overlay.style.display = "flex";
  el.overlay.setAttribute("aria-hidden", "false");
  el.overlay.classList.add("active");
  __endingStep = 0;
  renderEndingStep();
  await playEndingLoop(run);
  return run === endingRun;
}

async function finishEndingSequence() {
  if (!SessionOwner.canMutate()) return false;
  if (endingPhase !== "playing" || __endingStep < endingStoryData.length)
    return false;
  endingPhase = "finishing";
  const run = endingRun;
  clearEndingTyping();
  if (!state.endingSeen) {
    const robot = state.robotGrandson;
    state.endingSeen = true;
    state.robotGrandson = true;
    markStateChanged("ending");
    if (!save(true)) {
      state.endingSeen = false;
      state.robotGrandson = robot;
      endingPhase = "playing";
      __endingStep = endingStoryData.length - 1;
      renderEndingStep();
      showToast("저장 실패. 마지막 장면을 다시 진행해 주세요.");
      return false;
    }
  }
  restoreEndingUI();
  updateUI();
  endingEls().overlay.classList.remove("active");
  await Promise.all([
    stopEndingLoopFade(run),
    new Promise((resolve) => {
      endingFinishResolve = resolve;
      endingFinishTimer = setTimeout(() => {
        endingFinishTimer = null;
        endingFinishResolve = null;
        resolve(true);
      }, 950);
    }),
  ]);
  if (run !== endingRun) return false;
  endingPhase = "idle";
  endingEls().overlay.style.display = "none";
  endingEls().overlay.setAttribute("aria-hidden", "true");
  restoreEndingUI();
  return true;
}

function checkEndingCondition() {
  if (!SessionOwner.canMutate()) return false;
  if (state.endingPrompted || endingPhase !== "idle" || document.getElementById("modalRegionEnding")?.classList.contains("on")) return;
  if (
    state.endingUnlocked ||
    (Campaign.familyReady() && isMoney(state.money) && moneyCompare(state.money, Campaign.rules().ending) >= 0)
  ) {
    state.endingUnlocked = true;
    state.endingPrompted = true;
    markStateChanged("ending");
    save(true);
    restoreEndingUI();
    openEndingPopup();
  }
}

function bindEndingUI() {
  const el = endingEls();
  const bind = (element, fn) => {
    if (!element || endingBindings.has(element)) return;
    element.addEventListener("click", fn);
    endingBindings.add(element);
  };
  bind(el.yes, () => startEndingSequence());
  bind(el.replay, () => startEndingSequence());
  bind(el.wrap, () => nextEndingStep());
  bind(el.no, () => {
    if (state.endingUnlocked && endingPhase === "idle") closeEndingPopup();
  });
  bind(el.popup, (e) => {
    if (e.target === el.popup) closeEndingPopup();
  });
  const preview = document.getElementById("endingPreviewBtn");
  preview.style.display =
    new URLSearchParams(location.search).get("debug") === "1"
      ? "block"
      : "none";
  bind(preview, () => {
    if (endingPhase === "idle") {
      state.endingUnlocked = true;
      checkEndingCondition();
    }
  });
  for (let i = 1; i <= 5; i++) {
    const img = document.getElementById("imgCut" + i);
    if (endingBindings.has(img)) continue;
    const refresh = () => {
      if (endingPhase === "playing" && img.classList.contains("current"))
        updateEndingImage(endingStoryData[__endingStep]);
    };
    img.addEventListener("load", refresh);
    img.addEventListener("error", refresh);
    endingBindings.add(img);
  }
}

function nextEndingStep() {
  if (!SessionOwner.canMutate()) return false;
  if (endingPhase !== "playing") return;
  const el = endingEls();
  if (__endingTypingTimer) {
    clearEndingTyping();
    const step = endingStoryData[__endingStep];
    el.text.textContent = step.text;
    return;
  }
  __endingStep++;
  renderEndingStep();
}

const ENDING_MONEY = "10000000000000000000000"; // 100해, measured multi-day growth target

const ENDING_SOUND_FILES = ["END_SOUND.mp3", "END_SOUND.ogg", "END_SOUND.wav"];

let __endingAudio = null;

let __endingTypingTimer = null;

let __endingStep = 0;

const endingStoryData = [
  {
    img: 1,
    speaker: "할머니",
    text: "할미가 힘들어도 괜찮다.\n우리 손주 웃는 것만 보면 피로가 싹 가시니까.",
  },
  {
    img: 1,
    speaker: "나레이션",
    text: "주방의 열기 속에서\n너는 그렇게 무럭무럭 자랐단다.",
  },
  {
    img: 2,
    speaker: "할머니",
    text: "아이구 우리 귀한 손주…\n할미가 돈 많이 벌어서 맛난 거 다 사줄게.",
  },
  {
    img: 2,
    speaker: "나레이션",
    text: "그 한 조각에\n사랑은 늘, 가득 담겨 있었다.",
  },
  {
    img: 3,
    speaker: "할머니",
    text: "어마나… 세월 참 빠르기도 하지.\n우리 손주가 벌써 이렇게 컸구나.",
  },
  {
    img: 3,
    speaker: "손주",
    text: "할머니, 그동안 정말 고생 많으셨어요.\n이제는 제가 할머니를 제일 행복하게 해드릴게요.",
  },
  {
    img: 4,
    speaker: "손주",
    text: "할머니를 호강시켜 드리려고\n더 넓은 세상 밖으로 나가 보려 해요.",
  },
  {
    img: 4,
    speaker: "할머니",
    text: "그래… 우리 손주 가는 길인데 할미가 응원해야지.\n조심히 다녀오렴.",
  },
  { img: 4, speaker: "손주", text: "금방 돌아올게요. 사랑해요!" },
  {
    img: 4,
    speaker: "할머니",
    text: "그려, 할미는 언제나 우리 손주를 기다리마.",
  },
  {
    img: 5,
    speaker: "나레이션",
    text: "당신의 헌신과 사랑으로\n손주는 세상에서 가장 밝게 빛나는 별이 되었습니다.",
  },
  {
    img: 5,
    speaker: "나레이션",
    text: "하지만 그 별이\n길을 잃지 않았던 건\n언제나 불빛을 켜둔 사람 때문이었습니다.",
  },
  { img: 5, speaker: "나레이션", text: "할머니와 손주의 이야기는 계속됩니다." },
];

function ensureEndingAudio() {
  if (__endingAudio) return __endingAudio;
  const a = new Audio();
  a.preload = "auto";
  a.loop = true;
  a.volume = 0;
  for (const f of ENDING_SOUND_FILES) {
    const s = document.createElement("source");
    s.src = f;
    a.appendChild(s);
  }
  __endingAudio = a;
  return a;
}

function endingEls() {
  return {
    popup: document.getElementById("endingConditionPopup"),
    yes: document.getElementById("endingYesBtn"),
    no: document.getElementById("endingNoBtn"),
    replay: document.getElementById("replayEndingBtn"),
    overlay: document.getElementById("endingOverlay"),
    miss: document.getElementById("endingMissingOverlay"),
    box: document.getElementById("endingDialogBox"),
    tag: document.getElementById("endingNameTag"),
    text: document.getElementById("endingDialogText"),
    wrap: document.getElementById("endingDialogWrapper"),
  };
}

function openEndingPopup() {
  const el = endingEls();
  if (!el.popup) return;
  el.popup.style.display = "flex";
  el.popup.setAttribute("aria-hidden", "false");
}

function closeEndingPopup() {
  const el = endingEls();
  if (!el.popup) return;
  el.popup.style.display = "none";
  el.popup.setAttribute("aria-hidden", "true");
}

function setEndingSpeakerStyle(speaker) {
  const el = endingEls();
  el.box.className = "dialogue-box";
  el.tag.className = "name-tag";
  if (speaker === "할머니") {
    el.tag.classList.add("grandma");
    el.box.classList.add("grandma");
  } else if (speaker === "손주") {
    el.tag.classList.add("grandson");
    el.box.classList.add("grandson");
  } else {
    el.tag.classList.add("system");
    el.box.classList.add("system");
  }
  el.tag.textContent = speaker;
}

function clearEndingTyping() {
  if (__endingTypingTimer) {
    clearInterval(__endingTypingTimer);
    __endingTypingTimer = null;
  }
}

function animateEndingText(text) {
  const el = endingEls();
  clearEndingTyping();
  el.text.innerHTML = "";
  const lines = text.split("\n");
  const chars = [];
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) chars.push({ br: true });
    for (let i = 0; i < lines[li].length; i++) chars.push({ t: lines[li][i] });
  }
  let idx = 0;
  __endingTypingTimer = setInterval(() => {
    if (idx >= chars.length) {
      clearEndingTyping();
      return;
    }
    const c = chars[idx++];
    if (c.br) {
      el.text.appendChild(document.createTextNode("\n"));
      return;
    }
    const span = document.createElement("span");
    span.textContent = c.t;
    span.className = "char-fade";
    el.text.appendChild(span);
  }, 38);
}

function updateEndingImage(step) {
  const el = endingEls();
  for (let i = 1; i <= 5; i++) {
    const img = document.getElementById("imgCut" + i);
    if (!img) continue;
    img.classList.toggle("current", i === step.img);
  }
  const cur = document.getElementById("imgCut" + step.img);
  const ok = cur && cur.complete && cur.naturalWidth > 0;
  if (el.miss) {
    el.miss.style.display = ok ? "none" : "flex";
  }
}

function renderEndingStep() {
  const step = endingStoryData[__endingStep];
  if (!step) {
    finishEndingSequence();
    return;
  }
  setEndingSpeakerStyle(step.speaker);
  updateEndingImage(step);
  animateEndingText(step.text);
}
