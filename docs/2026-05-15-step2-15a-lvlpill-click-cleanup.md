# Step 2-15A lvlPill onclick 전환 보고

작성일: 2026-05-15

## 변경 내용

- `lvlPill.onclick` 1개를 `lvlPill.addEventListener("click", ...)` 방식으로 전환했다.
- 레벨 pill 클릭 시 매장 레벨 효과 토스트를 보여주는 기존 기능은 유지했다.

## 검증 결과

- 전환 전 `.onclick =` 직접 대입 수: 7
- 전환 후 `.onclick =` 직접 대입 수: 6
- `lvlPill.onclick`: 0
- `lvlPill.addEventListener("click"`: 1
- inline onclick: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- 기존 Step 2-8~2-13B 이벤트 유지
- node --check js/main.js 통과

## 남은 리스크

- `.onclick =` 직접 대입은 6개 남아 있다.
- 남은 6개는 동적 생성 버튼/게임 액션이므로 이벤트 위임 설계 후 전환해야 한다.
- 브라우저에서 레벨 pill 토스트 표시를 실제 확인해야 한다.
