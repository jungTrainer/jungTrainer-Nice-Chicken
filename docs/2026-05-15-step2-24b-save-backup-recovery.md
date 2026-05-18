# Step 2-24B 저장 백업/복구 적용 보고

작성일: 2026-05-15

## 변경 내용

- `SAVE_BACKUP_KEY = SAVE_KEY + "_backup"`를 추가했다.
- `save(true)`에서 기존 primary 저장본을 backup key에 먼저 보존하도록 했다.
- backup 저장 실패 시 `console.warn("[save] backup failed", backupError)`를 남기도록 했다.
- `readSavePayload()`를 추가해 primary/backup 저장 데이터를 순차적으로 읽도록 했다.
- primary JSON parse 실패 시 backup parse를 시도하도록 했다.
- backup 복구 성공 시 `console.warn("[load] restored from backup save")`를 남기도록 했다.
- primary/backup 모두 실패하면 기존 default flow가 유지된다.

## 유지한 내용

- 기존 `SAVE_KEY` 유지
- 기존 `defaultState()` / `sanitizeState()` 흐름 유지
- export/import UI는 아직 추가하지 않음
- cloud save는 추가하지 않음
- index.html은 수정하지 않음

## 검증 기준

- `SAVE_BACKUP_KEY` 1개
- backup 저장 흐름 1개
- `readSavePayload()` 1개
- primary corrupted log 1개
- backup restore warning 1개
- backup corrupted log 1개
- Step 2-23 저장 안정화 marker 유지
- `.onclick =` 0개 유지
- `function safeClick` 0개 유지
- `node --check js/main.js` 통과

## 남은 리스크

- 브라우저 실제 복구 테스트가 필요하다.
- localStorage quota 초과 시 backup 저장 실패가 발생할 수 있다.
- export/import 수동 백업 기능은 아직 없다.
