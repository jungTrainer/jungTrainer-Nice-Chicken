# Step 2-19 이벤트 리팩터링 최종 종합 검증

작성일: 2026-05-15

## 결론

Step 2 이벤트 리팩터링의 핵심 목표는 완료되었다.

- inline `onclick=`: 0개
- `.onclick =` 직접 대입: 0개
- `function safeClick`: 0개
- 실제 `safeClick(...)` 호출: 0개
- `node --check js/main.js`: 통과 기록 확인

Step 2-18 보고서 기준으로 마지막 `.onclick =` 직접 대입이 제거되었고, 이벤트 구조상 inline onclick, safeClick, 직접 onclick 제거 목표가 완료되었다.

## 기준 커밋/파일

- Step 2-18 완료 커밋: `99c79b162b8fee5d29f1656db5f07c70ff1ba38b`
- 현재 `js/main.js` SHA: `9cf64cc83aa5fe79e6d0d59a38937b606680f5e9`
- Step 2-18 보고서: `docs/2026-05-15-step2-18-reslist-click-cleanup.md`

## 최종 이벤트 구조 진단

### 제거 완료 항목

| 항목 | 상태 |
|---|---:|
| inline `onclick=` | 0개 |
| `.onclick =` 직접 대입 | 0개 |
| `function safeClick` 선언 | 0개 |
| 실제 `safeClick(...)` 호출 | 0개 |
| `node --check js/main.js` | 통과 |

### 주요 이벤트 위임 유지 항목

다음 이벤트 위임 구조가 현재 리팩터링 완료 기준의 핵심이다.

| 기능 | 위임 구조 | 목적 |
|---|---|---|
| 메뉴 연구 | `rndListEl.addEventListener("click")` | `data-action="research-menu"` 버튼 처리 |
| 메뉴 서빙 | `menuGridEl.addEventListener("click")` | `data-action="serve-menu"` 버튼 처리 |
| 업그레이드/직원 업그레이드 | `upgListEl.addEventListener("click")` | `data-action="buy-upgrade"`, `data-action="buy-staff-upgrade"` 처리 |
| 연구 시작 | `resListEl.addEventListener("click")` | `data-action="start-research"` 처리 |
| 지역 노드 선택 | `mapWrapEl.addEventListener("click")` | `data-action="select-region"` 처리 |
| 지역 확장 카드 | `modalExpansion` 이벤트 위임 | `move-branch`, `unlock-branch` 처리 |

### 주요 단일 버튼 addEventListener 유지 항목

다음 버튼 바인딩은 직접 onclick이 아니라 addEventListener 기반으로 전환된 상태여야 한다.

- `openMapBtn.addEventListener("click")`
- `mapGoBtn.addEventListener("click")`
- `mapUnlockBtn.addEventListener("click")`
- `closeExpansionModalBtn.addEventListener("click")`
- `closeSettingsBtn.addEventListener("click")`
- `pinCancelBtn.addEventListener("click")`
- `pinOkBtn.addEventListener("click")`
- `closeCouponsBtn.addEventListener("click")`
- `closeExchangeBtn.addEventListener("click")`

## 브라우저 수동 테스트 체크리스트

다음 항목은 코드 문법 검사가 아니라 실제 브라우저 런타임에서 확인해야 한다.

### 1. 기본 실행

- [ ] 페이지 로드 시 콘솔 에러가 없는가?
- [ ] 스플래시 화면이 정상 종료되는가?
- [ ] 게임 시작 후 기본 UI가 정상 렌더링되는가?
- [ ] `js/main.js` 로드 실패가 없는가?

### 2. 손님/메뉴 서빙

- [ ] 손님이 정상 등장하는가?
- [ ] 손님 선택/타깃 처리 흐름이 정상인가?
- [ ] 메뉴 버튼 클릭 시 `serveByMenu(menuId)`가 정상 호출되는가?
- [ ] 잠긴 메뉴 클릭/비활성 상태가 기존과 동일하게 동작하는가?
- [ ] 메뉴 서빙 후 돈/평판/통계가 갱신되는가?

### 3. 메뉴 연구

- [ ] 메뉴 연구 버튼이 정상 표시되는가?
- [ ] 연구비가 부족할 때 토스트와 효과음이 정상인가?
- [ ] 연구 성공 시 돈이 차감되는가?
- [ ] `state.menuLevels`가 증가하는가?
- [ ] 메뉴판 가격/연구 탭이 즉시 갱신되는가?

### 4. 업그레이드/직원 업그레이드

- [ ] 업그레이드 구매 버튼 클릭 시 `buyUpgrade(upgradeId)`가 정상 호출되는가?
- [ ] 구매 가능/불가능 상태가 기존과 동일한가?
- [ ] 직원 속도 업그레이드 버튼이 정상 동작하는가?
- [ ] 직원 매력/팁 업그레이드 버튼이 정상 동작하는가?
- [ ] 업그레이드 후 UI와 저장 상태가 정상 갱신되는가?

### 5. 연구 시작

- [ ] 연구 시작 버튼 클릭 시 `startResearch(researchId)`가 정상 호출되는가?
- [ ] 연구 슬롯/진행 상태가 정상 반영되는가?
- [ ] 연구 완료/보상 흐름이 기존과 동일한가?

### 6. 지역 확장 모달

- [ ] 우측 상단 지도/openMap 버튼 클릭 시 모달이 열리는가?
- [ ] `renderMapUI()`가 호출되어 지역 노드가 보이는가?
- [ ] 지역 노드 선택 시 active 상태가 반영되는가?
- [ ] 잠긴 지역은 locked 상태로 보이는가?
- [ ] `mapGo` 클릭 시 이동 흐름이 정상인가?
- [ ] `mapUnlock` 클릭 시 해금 흐름이 정상인가?
- [ ] 닫기 버튼이 정상 동작하는가?

### 7. 설정/PIN/쿠폰/교환 모달

- [ ] 설정 모달 열기/닫기 정상
- [ ] PIN 확인/취소 정상
- [ ] 쿠폰 모달 열기/닫기 정상
- [ ] 음료/채소 쿠폰 사용 정상
- [ ] 교환 모달 열기/닫기 정상
- [ ] 교환 실행 정상

### 8. 저장/불러오기/오프라인 보상

- [ ] 강제 저장 버튼 정상
- [ ] 자동 저장 흐름 정상
- [ ] 새로고침 후 상태 복원 정상
- [ ] 오프라인 보상 수령 정상
- [ ] 전체 초기화 버튼 정상

### 9. 모바일/터치/캔버스

- [ ] 모바일 화면에서 주요 버튼 터치 정상
- [ ] 캔버스 클릭/터치가 기존처럼 작동하는가?
- [ ] onCanvasDown 관련 오작동이 없는가?
- [ ] 화면 크기 변경 시 UI가 깨지지 않는가?

### 10. 콘솔/성능

- [ ] 브라우저 콘솔 에러 0개
- [ ] 반복 클릭 시 이벤트 중복 실행 없음
- [ ] 모달을 반복 열고 닫아도 이벤트가 중복 바인딩되지 않음
- [ ] 게임 루프/렌더링 성능 저하 없음

## 다음 JS 모듈 분리 계획

이번 단계에서는 실제 대규모 모듈 분리를 하지 않는다. 다음 단계에서 아래 순서로 안전하게 분리하는 것을 권장한다.

### 원칙

1. 첫 모듈 분리는 ES module 전환 없이 진행한다.
2. 기존 전역 함수 구조를 유지한다.
3. `<script>` 로드 순서로 의존성을 보존한다.
4. 한 번에 하나의 기능군만 분리한다.
5. 각 분리 단계마다 `node --check`와 브라우저 런타임 테스트를 수행한다.
6. 되돌리기 쉽도록 단계별 스크립트/보고서를 남긴다.

### 권장 파일 구조

```text
js/core/config.js
js/core/state.js
js/core/save.js
js/core/audio.js
js/core/utils.js

js/features/menu.js
js/features/upgrade.js
js/features/research.js
js/features/branch.js
js/features/staff.js
js/features/coupon.js
js/features/exchange.js
js/features/stats.js
js/features/mission.js
js/features/ending.js

js/render/canvas.js
js/render/background.js
js/render/ui.js

js/main.js
```

### 분리 우선순위

#### Step 3-1: 순수 유틸 분리

- `fmt`, `fmtNoWon`, 숫자 포맷, DOM 헬퍼, 공통 토스트 헬퍼 후보
- 리스크 낮음
- 가장 먼저 분리 권장

#### Step 3-2: 설정/상수 분리

- `CONFIG`, 메뉴/업그레이드/연구/지역 정의 상수
- 상태 변경 로직과 분리 필요
- 전역 참조 유지 필요

#### Step 3-3: 저장/로드 분리

- `save`, `saveGame`, load 관련 함수
- localStorage 키와 마이그레이션 흐름 보존 필요
- 브라우저 테스트 필수

#### Step 3-4: 오디오 분리

- `unlockAudioOnce`, `startBGM`, sfx 계열
- 사용자 제스처 기반 재생 제한 때문에 실제 브라우저 테스트 필수

#### Step 3-5: 메뉴/서빙 분리

- `buildMenuGrid`, `handleMenuGridServe`, `serveByMenu`
- 게임 핵심 루프와 연결되어 있어 테스트 필수

#### Step 3-6: 업그레이드/직원 분리

- `buyUpgrade`, `buyStaffUpgrade`, `renderPanel("upg")` 관련
- Step 2-17 이벤트 위임 구조 유지 필요

#### Step 3-7: 연구 분리

- `startResearch`, `renderPanel("res")`, `resList` 이벤트 위임
- Step 2-18 이벤트 위임 구조 유지 필요

#### Step 3-8: 지역/브랜치 분리

- `BranchManager`, `renderMapUI`, `openExpansionModal`, `mapGo`, `mapUnlock`
- 지역 확장 모달 흐름 테스트 필수

#### Step 3-9: 렌더링/캔버스 분리

- canvas draw/update, 배경, UI 렌더링
- onCanvasDown/터치 이벤트와 충돌 가능성이 있어 후순위 권장

#### Step 3-10: main.js 부트스트랩 정리

최종적으로 `js/main.js`는 다음 역할만 남기는 것을 목표로 한다.

- 초기 상태 로드
- DOM 참조 초기화
- 이벤트 바인딩 초기화
- 게임 루프 시작
- 첫 UI 렌더링 호출

## 남은 리스크

- 브라우저 수동 테스트가 아직 완료되지 않았다.
- 이벤트 구조는 정리됐지만 실제 런타임에서 버튼 클릭/상태 갱신/저장 흐름을 확인해야 한다.
- `js/main.js`는 여전히 큰 파일이므로, 다음 모듈 분리 전까지 대규모 수동 수정은 피해야 한다.
- 기능별 파일 분리 시 전역 의존성 순서 문제가 발생할 수 있다.

## 다음 단계 제안

### Step 2-20

브라우저 수동 테스트 결과를 기록하는 런타임 검증 보고서를 만든다.

권장 파일:

`docs/2026-05-15-step2-20-browser-runtime-test.md`

### Step 3-1

브라우저 핵심 기능이 정상임을 확인한 뒤, `js/core/utils.js`부터 분리한다.

처음부터 ES module로 전환하지 말고, 기존 전역 함수 방식을 유지한 채 `<script>` 순서 기반 분리를 권장한다.
