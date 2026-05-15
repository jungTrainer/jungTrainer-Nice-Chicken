# Step 2-15C renderRndList click 전환 보고

작성일: 2026-05-15

## 변경 내용

- `renderRndList()` 내부 메뉴 연구 버튼의 `btn.onclick = (e) =>` 직접 대입을 제거했다.
- 연구 버튼에 `data-action="research-menu"`, `data-menu-id="${m.id}"`를 추가했다.
- 기존 클릭 로직을 `function researchMenu(menuId)`로 분리했다.
- `#rndList`에 click 이벤트 위임을 1회 추가했다.

## 유지한 기능

- 연구비 부족 처리
- `state.money` 차감
- `state.menuLevels[m.id]` 증가
- `save(true)` 호출
- `showToast`, `sfxConfirm` 호출
- `updateUI`, `updateStatsUI`, `buildMenuGrid`, `renderRndList` 호출

## 검증 결과

- 전환 전 `.onclick =` 직접 대입 수: 6
- 전환 후 `.onclick =` 직접 대입 수: 5
- `btn.onclick = (e) =>`: 0
- `data-action="research-menu"`: 2
- `data-menu-id="${m.id}"`: 1
- `function researchMenu(menuId)`: 1
- `rndListEl.addEventListener("click"`: 1
- inline onclick: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- node --check js/main.js 통과

## 남은 리스크

- 브라우저에서 메뉴 연구 버튼 클릭 테스트가 필요하다.
- `.onclick =` 직접 대입은 5개 남아 있다.
- 남은 항목은 메뉴 서빙, 업그레이드 구매, 직원 업그레이드, 연구 시작으로 모두 게임 상태 변경 기능이다.
