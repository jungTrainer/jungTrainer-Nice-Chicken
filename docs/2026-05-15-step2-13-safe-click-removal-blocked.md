# Step 2-13 safeClick 제거 중단 보고

작성일: 2026-05-15

## 결론

`function safeClick` 선언 제거는 중단했다.

Step 2-12에서 `safeClick` 실제 호출 수가 0개라고 보고되었으나, 최신 `main`의 `js/main.js` 원문을 직접 재확인한 결과 실제 호출이 남아 있었다.

## 최신 main 재확인 결과

현재 `js/main.js`에는 아래 호출이 남아 있다.

```js
safeClick("openSettings", ()=>{
  unlockAudioOnce(); startBGM();
  modalSettings?.classList.add("on");
});

safeClick("openStats", ()=>{
  unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  const modal = document.getElementById("modalStats");
  if(modal) {
    modal.classList.add("on");
    updateStatsUI();
  }
});

safeClick("closeStats", ()=>{
  document.getElementById("modalStats")?.classList.remove("on");
});
```

## 중단 사유

Step 2-13 원칙은 다음이었다.

> safeClick 실제 호출이 1개라도 있으면 function safeClick 제거를 중단하고 보고하라.

현재 실제 호출이 최소 3개 남아 있으므로 `function safeClick` 선언을 제거하면 설정 열기, 통계 모달 열기/닫기 흐름이 깨질 수 있다.

## 현재 유지해야 하는 코드

```js
function safeOn(el, evt, fn, opts){
  if(el && typeof el.addEventListener === "function") el.addEventListener(evt, fn, opts);
}
function _bindSafe(el, evt, fn, opts){ return safeOn(el, evt, fn, opts); }
function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }
```

## 다음 조치

Step 2-13A를 먼저 진행해야 한다.

1. `safeClick("openSettings", ...)`를 `safeOn(document.getElementById("openSettings"), "click", ...)`로 전환한다.
2. `safeClick("openStats", ...)`를 `safeOn(document.getElementById("openStats"), "click", ...)`로 전환한다.
3. `safeClick("closeStats", ...)`를 `safeOn(document.getElementById("closeStats"), "click", ...)`로 전환한다.
4. 이후 `safeClick(` 실제 호출이 0개인지 재검증한다.
5. 그 다음 Step 2-13B에서 `function safeClick` 선언을 제거한다.

## 검증 필요

- `safeClick("openSettings"` 0개
- `safeClick("openStats"` 0개
- `safeClick("closeStats"` 0개
- `safeOn(document.getElementById("openSettings"), "click"` 1개
- `safeOn(document.getElementById("openStats"), "click"` 1개
- `safeOn(document.getElementById("closeStats"), "click"` 1개
- `function safeClick`은 Step 2-13A에서는 유지
- Step 2-13B에서만 제거
- `node --check js/main.js` 통과
