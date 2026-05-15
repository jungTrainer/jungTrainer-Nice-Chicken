# Step 2-6 Expansion Inline Onclick Cleanup

작성일: 2026-05-15

## 결과

- `renderExpansionCards()` 내부의 `moveBranch` / `unlockBranch` inline onclick 문자열을 제거했다.
- 버튼은 `data-action` / `data-region-id` 구조로 변경했다.
- `#modalExpansion`에 이벤트 위임을 1회 추가했다.
- `moveBranch(id)`와 `unlockBranch(id)` 함수는 유지했다.

## 검증

- `index.html + js/main.js` inline onclick 0개
- `data-action="move-branch"` 존재
- `data-action="unlock-branch"` 존재
- `node --check js/main.js` 통과

## 브라우저 확인 필요

1. 세계 정복 모달 열기
2. 구형 카드 UI가 표시되는 경우 이동/해금 버튼 클릭
3. mapWrap 기반 신형 지도 UI와 충돌 여부 확인
