# Step 2-13B safeClick helper 제거 보고

작성일: 2026-05-15

## 변경 내용

- 전체 `safeClick(` 실제 호출이 0개임을 재확인했다.
- `function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }` 선언 한 줄만 제거했다.
- `safeOn`과 `_bindSafe`는 유지했다.

## 검증 결과

- 제거 전 `function safeClick` 선언 수: 1
- 제거 후 `function safeClick` 선언 수: 0
- 제거 전 실제 `safeClick(...)` 호출 수: 0
- 제거 후 실제 `safeClick(...)` 호출 수: 0
- inline onclick: 0
- `.onclick =` 직접 대입 수: 8 → 7
- 기존 Step 2-8~2-13A 이벤트 유지
- `node --check js/main.js` 통과

## 브라우저 확인 필요

1. 설정 열기/닫기
2. 통계 모달 열기/닫기
3. 쿠폰/교환/PIN/저장/사운드/오프라인 수익 이벤트
4. 지역 확장 모달 이벤트
