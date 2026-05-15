# Step 2-16 menuGrid click 전환 보고

작성일: 2026-05-15

## 변경 내용

- `buildMenuGrid()` 내부 메뉴 서빙 버튼의 `btn.onclick = () =>` 직접 대입을 제거했다.
- 메뉴 버튼에 `data-action="serve-menu"`, `data-menu-id`, `data-locked`를 추가했다.
- 기존 클릭 로직을 `function handleMenuGridServe(btn)`로 분리했다.
- `#menuGrid`에 click 이벤트 위임을 1회 추가했다.

## 유지한 기능

- `applyElementFX(btn)`를 실제 클릭 버튼에 적용
- `unlockAudioOnce()`, `startBGM()`, `sfxTick()` 호출 유지
- 잠긴 메뉴 토스트 처리 유지
- `serveByMenu(menuId)` 호출 유지

## 검증 결과

- 전환 전 `.onclick =` 직접 대입 수: 5
- 전환 후 `.onclick =` 직접 대입 수: 4
- `btn.onclick = () =>`: 0
- `btn.dataset.action = "serve-menu"`: 1
- `btn.dataset.menuId = m.id`: 1
- `function handleMenuGridServe(btn)`: 1
- `menuGridEl.addEventListener("click"`: 1
- inline onclick: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- node --check js/main.js 통과

## 남은 리스크

- 브라우저에서 메뉴 서빙 버튼 클릭 테스트가 필요하다.
- 잠긴 메뉴는 disabled 상태라 실제 click 이벤트가 발생하지 않을 수 있으나 기존 동작과 동일하다.
- `.onclick =` 직접 대입은 4개 남아 있다.
- 남은 항목은 업그레이드 구매, 직원 업그레이드 2개, 연구 시작이다.
