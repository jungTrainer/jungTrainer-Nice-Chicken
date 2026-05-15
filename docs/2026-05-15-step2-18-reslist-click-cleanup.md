# Step 2-18 resList click 전환 보고

작성일: 2026-05-15

## 변경 내용

- `renderPanel("res")` 내부 연구 시작 버튼의 마지막 직접 `.onclick`을 제거했다.
- 연구 시작 버튼에 `data-action="start-research"`, `data-research-id`를 부여했다.
- `#resList`에 click 이벤트 위임을 1회 추가했다.

## 유지한 기능

- `unlockAudioOnce()` 호출 유지
- `startBGM()` 호출 유지
- `startResearch(researchId)` 호출 유지

## 검증 결과

- 전환 전 `.onclick =` 직접 대입 수: 1
- 전환 후 `.onclick =` 직접 대입 수: 0
- `btn.onclick ... startResearch(r.id)`: 0
- `btn.dataset.action = "start-research"`: 1
- `btn.dataset.researchId = r.id`: 1
- `resListEl.addEventListener("click"`: 1
- inline onclick: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- node --check js/main.js 통과

## 남은 리스크

- 브라우저에서 연구 시작 버튼 클릭 테스트가 필요하다.
- `.onclick =` 직접 대입은 0개가 되었다.
- 이벤트 구조상 inline onclick, safeClick, 직접 onclick 제거 목표는 완료되었다.
