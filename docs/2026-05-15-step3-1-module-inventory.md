# Step 3-1 js/main.js 모듈 분리 Inventory

작성일: 2026-05-15

## 0. 저장 안정화 미완료 리스크

Step 2 이벤트 리팩터링은 완료됐지만 저장 안정화 실제 반영은 아직 완료되지 않았다.

- Step 2-23 저장 안정화 1차 실제 반영 미완료
- Step 2-24B backup key/save recovery 실제 반영 미완료
- Step 2-25 export/import 실제 구현 미완료
- Step 2-26 저장 QA 실검증 미수행

따라서 이번 단계에서는 `js/main.js`와 `index.html`을 수정하지 않고 inventory 문서만 작성한다.

## 1. Inventory 목적

`js/main.js` 내부의 주요 함수/상수/전역 의존성을 분류하고, Step 3 실제 모듈 분리 전 이동 후보와 위험도를 정리한다.

## 2. 주요 상수 그룹

### 저장/설정

- `SAVE_KEY`
- `CONFIG`
- `CONFIG.levelUpTotalSales`
- `CONFIG.maxLevel`

권장 모듈:

- `js/core/config.js`
- `js/core/save.js`

주의: `SAVE_KEY`는 Step 2-23/2-24B 완료 전 이동 금지.

### 오디오

- `SOUND`
- `AudioEngine`

관련 함수:

- `ensureAudio()`
- `unlockAudioOnce()`
- `beep()`
- `sfxTick()`
- `sfxDing()`
- `sfxWrong()`
- `sfxFanfare()`
- `sfxConfirm()`
- `startBGM()`
- `stopBGM()`
- `setSoundEnabled()`

권장 모듈: `js/core/audio.js`

### 지역/브랜치

- `REGIONS`
- `REGION_MAP`
- `BranchManager`

관련 함수:

- `getRegion()`
- `getRegionIndex(id)`
- `getNextRegion()`
- `_branchDefaultData()`
- `_branchKeys()`

권장 모듈: `js/features/branch.js`

주의: branch는 저장 스냅샷과 연결되어 있으므로 저장 안정화 후 분리.

### 메뉴/업그레이드/연구/직원

- `MENUS`
- `MENU_MAP`
- `UPGRADES`
- `RESEARCH`
- `STAFF_POOL`
- `DECOS`
- `SIGN_STAGES_MAX`
- `SIGN_IMAGE_CANDIDATES`
- `SIGN_IMAGES`

권장 모듈:

- `js/features/menu.js`
- `js/features/upgrade.js`
- `js/features/research.js`
- `js/features/staff.js`
- `js/render/canvas.js`

## 3. 상태/state 함수 그룹

주요 후보:

- `state`
- `defaultState()`
- `sanitizeState()`
- `ensureStaffStats()`
- `processPayroll()`
- `sumEffects()`
- `computeRates()`
- `getOpenMenuCount()`
- `pickMenuByRule()`

권장 모듈:

- `js/core/state.js`
- 일부는 `js/features/menu.js`, `js/features/staff.js` 후보

분리 난이도: 높음

주의: 대부분의 기능이 `state`를 직접 참조한다. 초기에는 단일 mutable state export가 안전하다.

## 4. 저장 관련 함수 그룹

주요 후보:

- `save(force=false)`
- `saveGame()`
- `load()`
- `_saveDirty`
- `_lastSaveWriteAt`
- autosave 흐름
- legacy `beforeunload` 훅
- 향후 `bindSaveLifecycleEvents()`
- 향후 `readSavePayload()`
- 향후 `SAVE_BACKUP_KEY`

권장 모듈: `js/core/save.js`

분리 난이도: 매우 높음

분리 전 필수 조건:

1. Step 2-23 실제 반영
2. Step 2-24B 실제 반영
3. 저장 QA 통과
4. Chrome 새로고침 복구 확인
5. 모바일 백그라운드 저장 확인

현재 판단: 저장 모듈 분리는 Step 3 후반으로 보류.

## 5. 기능 함수 그룹

### 메뉴

- `getMenuPrice(menuId)`
- `getOpenMenuCount()`
- `pickMenuByRule()`
- `buildMenuGrid()`
- `handleMenuGridServe(btn)`
- `serveByMenu(menuId)`
- `researchMenu(menuId)`
- `renderRndList()`

권장 모듈: `js/features/menu.js`

주요 의존성: `state`, `MENUS`, `MENU_MAP`, `CONFIG`, `getRegion()`, `save()`, `showToast()`, `updateUI()`, `updateStatsUI()`, 오디오 함수.

### 업그레이드

- `UPGRADES`
- `buyUpgrade(id)`
- `renderPanel("upg")` 내부 렌더링
- `upgListEl.addEventListener("click")`

권장 모듈: `js/features/upgrade.js`

### 직원

- `STAFF_POOL`
- `ensureStaffStats()`
- `staffUpgradeCost(staffKey, kind, cur)`
- `buyStaffUpgrade(staffKey, kind)`
- `upStaff(key, kind, cost)`
- `levelCurve(lv)`
- `genericStaffUpgradeCost(lv, mult)`
- `staffCenters()`
- `drawStaff(y)`

권장 모듈: `js/features/staff.js`, 일부 draw는 `js/render/canvas.js` 후보.

### 연구

- `RESEARCH`
- `startResearch(r.id)`
- `renderPanel("res")` 연구 렌더링
- `resListEl.addEventListener("click")`

권장 모듈: `js/features/research.js`

### 지역/브랜치

- `REGIONS`
- `REGION_MAP`
- `BranchManager`
- `openExpansionModal()`
- `closeExpansionModal()`
- `moveBranch(id)`
- `unlockBranch(id)`
- `renderExpansionCards()`
- `renderMapUI()`

권장 모듈: `js/features/branch.js`

분리 난이도: 높음. 저장 스냅샷 의존이 있어 Step 2-23/2-24B 완료 전 분리 금지.

## 6. 렌더링/UI 함수 그룹

### DOM/UI

- `initDOMRefs()`
- `showToast(msg)`
- `showInfoToast(title, rows)`
- `updateUI()`
- `updateStatsUI()`
- `renderPanel(key)`
- `renderCoupons()`
- `renderExchange()`
- `renderMapUI()`
- `renderExpansionCards()`
- `maybeAskName()`
- `generateWeeklyCertificate()`

권장 모듈: `js/render/ui.js`

분리 난이도: 매우 높음. DOM refs와 bootstrap 의존성이 크므로 후반 분리 권장.

### Canvas

- `resizeCanvas()`
- `doorRect()`
- `serveSpot()`
- `waitingSlots()`
- `drawBackground()`
- `drawSignboard()`
- `drawBoss()`
- `drawStaff(y)`
- `drawStaffSpeechBubble(x, y, text, isBoss)`
- `drawBossParticles()`
- `drawBossFlash()`
- `drawSkyGradient()`
- `drawCloud()`
- `drawCelestial()`
- `drawHill()`
- `drawStatueOfLiberty()`
- `drawEiffelTower()`
- `drawFireworks()`
- `roundRectPath()`
- `roundRect2()`

권장 모듈: `js/render/canvas.js`

분리 난이도: 매우 높음. `ctx`, `canvas`, `state`, 지역/업그레이드 상태 의존이 강하다.

## 7. 이벤트 바인딩/이벤트 위임 그룹

### initDOMRefs 내부 직접 바인딩

- `closeSettingsBtn.addEventListener("click")`
- `forceSaveBtn.addEventListener("click")`
- `resetAllBtn.addEventListener("click")`
- `toggleSoundBtn.addEventListener("click")`
- `openCouponsBtn.addEventListener("click")`
- `openExchangeBtn.addEventListener("click")`
- `closeCouponsBtn.addEventListener("click")`
- `closeExchangeBtn.addEventListener("click")`
- `clearLogBtn.addEventListener("click")`
- `pinCancelBtn.addEventListener("click")`
- `pinOkBtn.addEventListener("click")`
- `saveNameBtn.addEventListener("click")`
- `claimOfflineBtn.addEventListener("click")`
- `makeCardBtn.addEventListener("click")`
- `useCertDrinkBtn.addEventListener("click")`
- `useDrinkCouponBtn.addEventListener("click")`
- `useVegCouponBtn.addEventListener("click")`
- `doExchangeBtn.addEventListener("click")`
- `openMapBtn.addEventListener("click")`
- `mapGoBtn.addEventListener("click")`
- `mapUnlockBtn.addEventListener("click")`
- `mapWrapEl.addEventListener("click")`
- `closeExpansionModalBtn.addEventListener("click")`

### 이벤트 위임

- `rndListEl.addEventListener("click")`
- `menuGridEl.addEventListener("click")`
- `upgListEl.addEventListener("click")`
- `resListEl.addEventListener("click")`
- `modalExpansion` 이벤트 위임
- document tab click delegation

분리 원칙:

- 이벤트 중복 바인딩 방지 guard 필요
- 1차 분리에서는 이벤트 바인딩을 `main.js` bootstrap에 남기는 것이 안전
- feature 모듈은 handler 함수만 제공하는 구조 권장

## 8. Canvas / Game loop 그룹

주요 후보:

- `canvas`
- `ctx`
- `resizeCanvas()`
- `onCanvasDown()`
- `spawnCustomer()`
- `layoutTargets()`
- `moveCustomers(dt)`
- `pickCustomerAt(px, py)`
- `selectCustomer(id)`
- `serveByMenu(menuId)`
- `updateBossParticles(dt)`
- `floatText(text, x, y, color)`
- delivery/online timers
- fixed step update / draw loop

권장 모듈:

- `js/render/canvas.js`
- 향후 `js/core/gameLoop.js` 후보

분리 난이도: 매우 높음. Step 3 초반에는 보류.

## 9. 모듈별 이동 후보 표

| 후보 모듈 | 이동 후보 | 난이도 | 우선순위 | 비고 |
|---|---|---:|---:|---|
| `js/core/utils.js` | 포맷, clamp, 날짜, safeOn | 낮음 | 1 | 상태 의존 낮음 |
| `js/core/config.js` | CONFIG, 정적 데이터 일부 | 중간 | 2 | 전역 참조 많음 |
| `js/core/audio.js` | SOUND, AudioEngine, sfx, BGM | 중간 | 3 | 모바일 QA 필요 |
| `js/core/state.js` | state, defaultState, sanitizeState | 높음 | 4 | 저장과 강결합 |
| `js/core/save.js` | SAVE_KEY, save, load, saveGame | 매우 높음 | 보류 | Step 2-23/24B 후 |
| `js/features/menu.js` | 메뉴 가격/서빙/연구/grid | 중간~높음 | 5 | 이벤트 위임 존재 |
| `js/features/upgrade.js` | 업그레이드 구매/렌더 | 중간~높음 | 6 | renderPanel 의존 |
| `js/features/staff.js` | 직원 stats/업그레이드 | 높음 | 7 | canvas와 결합 |
| `js/features/research.js` | 연구 시작/렌더 | 중간 | 8 | 상대적으로 작음 |
| `js/features/branch.js` | 지역/브랜치/지도 | 높음 | 보류 | 저장 스냅샷 의존 |
| `js/render/ui.js` | UI update/render/modal | 매우 높음 | 후반 | DOM refs 많음 |
| `js/render/canvas.js` | canvas draw/game visuals | 매우 높음 | 최후반 | ctx/state 의존 |

## 10. 분리 난이도 요약

낮음:

- 순수 유틸 함수
- 포맷 함수
- 일부 정적 상수

중간:

- audio
- config 일부
- menu 일부
- research 일부

높음:

- state
- upgrade
- staff
- branch
- UI render

매우 높음:

- save/load
- canvas/game loop
- 전체 DOM bootstrap

## 11. 분리 우선순위

권장 우선순위:

```text
1. utils inventory 보강
2. config 분리 스크립트 준비
3. audio 분리 스크립트 준비
4. state 분리 설계 보강
5. 저장 안정화 완료 후 save.js 분리
6. menu.js 분리
7. research.js 분리
8. upgrade/staff/branch 분리
9. ui/canvas 분리
```

실제 코드 분리 전 가능한 작업:

- dependency map 문서화
- 함수별 참조 관계 정리
- 분리 스크립트 dry-run 작성
- preflight guard 설계

## 12. Step 3-2 진입 조건

Step 3-2는 실제 분리가 아니라 `utils/config/audio` 분리 스크립트 준비 단계로 제한한다.

진입 조건:

1. `docs/2026-05-15-step3-1-module-inventory.md` 생성 완료
2. Step 2 저장 리스크 상단 유지
3. `js/main.js` / `index.html` 수정 없이 진행
4. 실제 import/export 전환 금지
5. 분리 스크립트는 dry-run 또는 blocked mode로 시작
6. node --check 기준 정의
7. 브라우저 QA 기준 정의

Step 3-2에서 가능한 작업:

- `scripts/prepare-step3-2-utils-config-audio-split.py` 초안 작성
- utils/config/audio 후보 추출 목록 작성
- preflight guard 작성
- 실제 파일 이동은 보류

Step 3-2에서 금지할 작업:

- `type="module"` 전환
- `import/export` 실제 추가
- `js/main.js` 실제 분리
- 저장 로직 이동
- canvas/game loop 이동

## 13. 최종 판단

```text
Step 3-1 inventory 문서: 가능
Step 3-2 dry-run 스크립트 준비: 가능
Step 3 실제 코드 분리: 저장 안정화 전까지 보류
Step 2-23 실제 반영: 여전히 최우선
```
