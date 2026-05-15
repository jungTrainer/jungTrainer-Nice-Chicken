# Step 2-17 upgList click 전환 보고

작성일: 2026-05-15

## 변경 내용

- `renderPanel("upg")` 내부 업그레이드 구매 버튼의 직접 `.onclick`을 제거했다.
- 직원 속도 업그레이드 버튼의 직접 `.onclick`을 제거했다.
- 직원 매력 업그레이드 버튼의 직접 `.onclick`을 제거했다.
- 각 버튼에 `data-action`, `data-upgrade-id`, `data-staff-key`, `data-kind`를 부여했다.
- `#upgList`에 click 이벤트 위임을 1회 추가했다.

## 유지한 기능

- `buyUpgrade(upgradeId)` 호출 유지
- `buyStaffUpgrade(staffKey, kind)` 호출 유지
- 업그레이드 구매 시 `unlockAudioOnce()` 및 `startBGM()` 호출 유지

## 검증 결과

- 전환 전 `.onclick =` 직접 대입 수: 4
- 전환 후 `.onclick =` 직접 대입 수: 1
- `div.querySelector("button").onclick`: 0
- `card.querySelector(`#btn-auto-${s.key}`).onclick`: 0
- `card.querySelector(`#btn-tip-${s.key}`).onclick`: 0
- `dataset.action = "buy-upgrade"`: 1
- `dataset.action = "buy-staff-upgrade"`: 2
- `upgListEl.addEventListener("click"`: 1
- inline onclick: 0
- function safeClick: 0
- safeClick 실제 호출: 0
- node --check js/main.js 통과

## 남은 리스크

- 브라우저에서 업그레이드 구매와 직원 업그레이드 클릭 테스트가 필요하다.
- `.onclick =` 직접 대입은 1개 남아 있다.
- 남은 항목은 `renderPanel("res")` 내부 연구 시작 버튼이다.
