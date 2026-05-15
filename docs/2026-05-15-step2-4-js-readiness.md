# Step 2-4 JS 분리 전 최종 진단 보고서

작성일: 2026-05-15

## 요약

- CSS 외부 파일 링크 수: 1
- HTML inline `onclick=` 개수: 2
- JS `.onclick =` 직접 대입 개수: 41
- `addEventListener` 개수: 30
- inline `<script>` 블록 수: 3
- 외부 `<script src>` 블록 수: 0
- `DOMContentLoaded` 등장 수: 2
- `defer` 등장 수: 0
- 함수 선언 수: 185 / 고유 함수 수: 183
- inline script `node --check`: 통과
- js/main.js 분리 판단: **가능**

## 분리 판단 메모

- .onclick 직접 대입이 많아 분리 후에도 동작은 가능하나 추후 이벤트 정리가 필요하다.
- HTML inline onclick이 남아 있어 js/main.js 분리 후 전역 함수 의존 리스크가 있다.

## 전역 유지 후보

- `buildMenuGrid`
- `closeExpansionModal`
- `init`
- `initAfterLoad`
- `initDOMRefs`
- `load`
- `onCanvasDown`
- `renderMapUI`
- `renderPanel`
- `resizeCanvas`
- `save`
- `saveGame`
- `startGameLoop`
- `updateUI`

## 대표 HTML inline onclick 샘플

```text
btnHtml = `<button class="btn alt loc-btn" onclick="moveBranch('${loc.id}')">이동하기 🚀</button>`;
```
```text
btnHtml = `<button class="btn loc-btn" ${canAfford ? "" : "disabled"} onclick="unlockBranch('${loc.id}')">${costText} 오픈 🔓</button>`;
```

## 대표 .onclick 직접 대입 샘플

```text
if(lvlPill) lvlPill.onclick = ()=>{ const mul = (1 + ((Number(state.level)||0)*0.10)); showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`); };
```
```text
if(closeSettingsBtn) closeSettingsBtn.onclick = ()=> modalSettings && modalSettings.classList.remove("on");
```
```text
if(forceSaveBtn) forceSaveBtn.onclick = ()=>{ save(true); showToast("저장 완료"); };
```
```text
if(resetAllBtn) resetAllBtn.onclick = ()=>{
```
```text
if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
```
```text
if(openCouponsBtn) openCouponsBtn.onclick = ()=>{
```
```text
if(openExchangeBtn) openExchangeBtn.onclick = ()=>{
```
```text
if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons && modalCoupons.classList.remove("on");
```
```text
if(closeExchangeBtn) closeExchangeBtn.onclick = ()=> modalExchange && modalExchange.classList.remove("on");
```
```text
if(clearLogBtn) clearLogBtn.onclick = ()=>{
```
```text
if(pinCancelBtn) pinCancelBtn.onclick = ()=>{
```
```text
if(pinOkBtn) pinOkBtn.onclick = ()=>{
```
```text
if(saveNameBtn) saveNameBtn.onclick = ()=>{
```
```text
if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
```
```text
if(makeCardBtn) makeCardBtn.onclick = ()=> {
```

## 대표 addEventListener 샘플

```text
document.addEventListener('DOMContentLoaded', ()=>{
```
```text
window.addEventListener("error", (ev) => {
```
```text
window.addEventListener("unhandledrejection", (ev) => {
```
```text
if(pinInput) pinInput.addEventListener("keydown",(e)=>{
```
```text
openMapBtn.addEventListener("click", (e)=>{
```
```text
mapGoBtn.addEventListener("click", (e)=>{
```
```text
mapUnlockBtn.addEventListener("click", (e)=>{
```
```text
mapWrapEl.addEventListener("click", (e)=>{
```
```text
closeExpansionModalBtn.addEventListener("click", (e)=>{
```
```text
closeStatsBtn.addEventListener("click", (e)=>{
```
```text
modalStats.addEventListener("click",(e)=>{
```
```text
window.addEventListener("resize", resizeCanvas, { passive:true });
```
```text
navBtns.forEach(btn=> btn.addEventListener("click", ()=>{
```
```text
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click", closePanels));
```
```text
document.addEventListener("click", (e)=>{
```

## JS 문법 검사 출력

```text
OK
```

## 다음 단계 권장

1. `scripts/prepare-step2-5-split-main-js.py`를 사용해 `js/main.js` 분리 패치를 생성한다.
2. 기존 inline script 위치는 같은 순서의 외부 script 로드로 대체한다.
3. 첫 분리에서는 `type=module`을 사용하지 않는다. 전역 스코프를 유지한다.
4. `defer`는 DOMContentLoaded 흐름 확인 후 적용한다. 우선은 원래 script 위치 유지가 더 안전하다.
5. 브라우저에서 부팅, 캔버스, 지역 확장 모달, 저장/불러오기를 확인한다.
