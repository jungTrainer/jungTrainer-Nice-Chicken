# Step 3-4 Config Module Split

작성일: 2026-05-15

## 변경 내용

- 정적 config/data 선언을 `js/core/config.js`로 분리했다.
- `index.html` script 순서를 `utils.js` → `audio.js` → `config.js` → `main.js`로 정리했다.
- ES module 전환 없이 classic script 전역 호환성을 유지했다.
- 저장 관련 키/함수는 `js/main.js`에 유지했다.

## 분리한 항목

- `CONFIG`
- `REGIONS`
- `REGION_MAP`
- `MENUS`
- `MENU_MAP`
- `CUSTOMER_EMOJIS`
- `STAFF_POOL`
- `UPGRADES`
- `RESEARCH`
- `DECOS`
- `SIGN_STAGES_MAX`
- `SIGN_IMAGE_CANDIDATES`
- `SIGN_IMAGES`
- `ensureLevelTable IIFE`

## 현재 파일에 없어 분리하지 않은 후보

없음

## 유지한 항목

- `SAVE_KEY`
- `SAVE_BACKUP_KEY`
- `save()` / `load()` / `saveGame()`
- `readSavePayload()`
- `exportSaveData()` / `importSaveData(raw)` / `ensureSaveTransferUI()`
- `_saveDirty` / `_lastSaveWriteAt`

## 검증

- `node --check js/core/config.js`
- `node --check js/core/utils.js`
- `node --check js/core/audio.js`
- `node --check js/main.js`
- inline `onclick=` 0개 유지
- `.onclick =` 0개 유지
- `function safeClick` 0개 유지
- 실제 `safeClick(` 호출 0개 유지

## 브라우저 QA 필요

- 게임 시작/스플래시 종료
- 메뉴 가격/지역/연구/업그레이드 데이터 정상 표시
- 저장 export/import UI 유지
- 콘솔 ReferenceError 없음
