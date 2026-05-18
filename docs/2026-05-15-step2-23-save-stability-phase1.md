# Step 2-23 저장 안정화 1차 보고

작성일: 2026-05-15

## 변경 내용

- `save(force=false)`가 boolean을 반환하도록 보강했다.
- `save(false)`는 `_saveDirty = true` 설정 후 `true`를 반환한다.
- `save(true)`는 localStorage 저장 성공 시 `true`, 실패 시 `false`를 반환한다.
- 저장 실패 시 `console.error("[save] failed", e)`를 남긴다.
- 강제 저장 버튼은 `save(true)` 결과에 따라 성공/실패 토스트를 다르게 표시한다.
- `pagehide`, `visibilitychange`, `beforeunload` 저장 훅을 추가했다.
- 저장 훅은 `bindSaveLifecycleEvents()`에서 1회만 바인딩된다.
- 기존 legacy beforeunload 훅 제거 여부: True

## 유지한 내용

- 기존 `save(false)` dirty flag 구조 유지
- 기존 autosave 흐름 유지
- 기존 `saveGame()` alias 유지
- 기존 `load()` 흐름 유지
- 백업 키/export/import는 이번 단계에서 추가하지 않음

## 검증 결과

- `function save(force=false)`: 1
- `save(false)` true 반환 흐름: 1
- 저장 실패 `console.error`: 1
- `function saveGame()`: 1
- `function bindSaveLifecycleEvents()`: 1
- `window.addEventListener("pagehide"`: 1
- `document.addEventListener("visibilitychange"`: 1
- `window.addEventListener("beforeunload"`: 1
- 강제 저장 결과 분기: 1
- inline onclick: 0
- `.onclick =` 직접 대입: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- node --check js/main.js 통과

## 남은 리스크

- 브라우저에서 탭 닫기/백그라운드 전환 저장 동작 확인이 필요하다.
- localStorage 용량 초과 상황은 실제 브라우저에서 강제 재현 테스트가 필요하다.
- 백업 저장 키와 export/import는 아직 없다.
- 다음 단계에서 backup key와 복구 흐름을 추가하는 것이 좋다.
