# Step 2-7 Runtime Stabilization Report

작성일: 2026-05-15

## 완료 내용

- `safeClick("openMap", ()=>{ openExpansionModal(); })` 중복 흐름을 비활성화했다.
- `openExpansionModal()`이 구형 `renderExpansionCards()` 대신 신형 `renderMapUI()`를 호출하도록 정리했다.
- `unlockBranch(id)` 후 갱신 흐름도 `renderMapUI()`로 정렬했다.
- `renderExpansionCards()` / `moveBranch(id)` / `unlockBranch(id)` 함수 자체는 호환성 차원에서 유지했다.

## .onclick = 직접 대입 분류

- 총 개수: 41
- benefit/coupon/exchange: 16
- modal/settings/pin: 5
- other: 15
- save/profile: 4
- ui/panel/canvas: 1

## 대표 샘플

```js
if(lvlPill) lvlPill.onclick = ()=>{ const mul = (1 + ((Number(state.level)||0)*0.10)); showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`); };
```
```js
if(closeSettingsBtn) closeSettingsBtn.onclick = ()=> modalSettings && modalSettings.classList.remove("on");
```
```js
if(forceSaveBtn) forceSaveBtn.onclick = ()=>{ save(true); showToast("저장 완료"); };
```
```js
if(resetAllBtn) resetAllBtn.onclick = ()=>{
```
```js
if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
```
```js
if(openCouponsBtn) openCouponsBtn.onclick = ()=>{
```
```js
if(openExchangeBtn) openExchangeBtn.onclick = ()=>{
```
```js
if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons && modalCoupons.classList.remove("on");
```
```js
if(closeExchangeBtn) closeExchangeBtn.onclick = ()=> modalExchange && modalExchange.classList.remove("on");
```
```js
if(clearLogBtn) clearLogBtn.onclick = ()=>{
```
```js
if(pinCancelBtn) pinCancelBtn.onclick = ()=>{
```
```js
if(pinOkBtn) pinOkBtn.onclick = ()=>{
```
```js
if(saveNameBtn) saveNameBtn.onclick = ()=>{
```
```js
if(claimOfflineBtn) claimOfflineBtn.onclick = ()=>{
```
```js
if(makeCardBtn) makeCardBtn.onclick = ()=> {
```
```js
if(useCertDrinkBtn) useCertDrinkBtn.onclick = async ()=>{
```
```js
if(useDrinkCouponBtn) useDrinkCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("drink"); };
```
```js
if(useVegCouponBtn) useVegCouponBtn.onclick = ()=>{ unlockAudioOnce(); startBGM(); useCoupon("veg"); };
```
```js
if(doExchangeBtn) doExchangeBtn.onclick = ()=>{
```
```js
btn.onclick = (e) => {
```
```js
function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }
```
```js
if(toggleSoundBtn) toggleSoundBtn.onclick = ()=>{
```
```js
if(openCouponsBtn) openCouponsBtn.onclick = ()=>{
```
```js
if(openExchangeBtn) openExchangeBtn.onclick = ()=>{
```
```js
if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons.classList.remove("on");
```

## 검증

- inline onclick= 0개 유지
- openMap 중복 safeClick 제거
- openExpansionModal → renderMapUI 정렬
- mapGo / mapUnlock / closeExpansionModalBtn 이벤트 유지
- node --check js/main.js 통과

## 다음 단계

1. 모달/설정/PIN 계열 `.onclick =`를 우선 addEventListener로 전환한다.
2. 쿠폰/교환 계열 `.onclick =`를 두 번째 묶음으로 정리한다.
3. `renderExpansionCards()`가 더 이상 실제 UI에서 쓰이지 않으면 별도 단계에서 제거 후보로 판단한다.
