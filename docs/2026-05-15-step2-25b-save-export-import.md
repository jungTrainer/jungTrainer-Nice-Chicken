# Step 2-25B 수동 백업 Export/Import 적용 보고

작성일: 2026-05-15

## 변경 내용

- `exportSaveData()`를 추가했다.
- `importSaveData(raw)`를 추가했다.
- `ensureSaveTransferUI()`를 추가해 설정 모달에 백업/불러오기 UI를 동적으로 삽입한다.
- `index.html`은 수정하지 않았다.
- 이벤트는 `safeOn` 또는 `addEventListener`로만 바인딩한다.
- export는 현재 `state`를 JSON 문자열로 생성한다.
- import는 JSON parse, 나이스치킨 저장 데이터 검증, confirm 확인 후 `state`에 반영한다.
- import 성공 시 `sanitizeState()`, `save(true)`, `updateUI()`, `updateStatsUI()`를 호출한다.

## 유지한 내용

- `SAVE_KEY` 유지
- `SAVE_BACKUP_KEY` 유지
- `readSavePayload()` 유지
- `save()` / `load()` / `saveGame()` 구조 유지
- inline `onclick=` 추가 없음
- `.onclick =` 직접 대입 추가 없음

## 검증

- `exportSaveData()` 1개
- `importSaveData(raw)` 1개
- `ensureSaveTransferUI()` 1개
- 설정 모달 동적 UI 추가
- `node --check js/main.js` 통과

## 남은 리스크

- 브라우저에서 textarea 복사/붙여넣기 UX 확인 필요
- 모바일 Safari clipboard 권한 제한 확인 필요
- 잘못된 JSON/타 게임 JSON/import 취소 시나리오 QA 필요
