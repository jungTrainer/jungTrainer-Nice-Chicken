# Step 2-20 브라우저 런타임 테스트 체크리스트

작성일: 2026-05-15

## 목적

Step 2 이벤트 리팩터링 완료 후 실제 브라우저에서 핵심 기능이 정상 동작하는지 확인하기 위한 테스트 기록 문서다.

이번 단계에서는 기능 코드를 변경하지 않는다. 테스트 항목과 기록 양식만 정의한다.

## 기준 상태

- Step 2-19 완료
- 보고서: `docs/2026-05-15-step2-19-event-refactor-final-check.md`
- 커밋: `a6333b1f994b37e34dd76baedc8addb33ac70f98`
- inline `onclick=`: 0개
- `.onclick =` 직접 대입: 0개
- `function safeClick`: 0개
- 실제 `safeClick(...)` 호출: 0개
- `node --check js/main.js`: Step 2-18 기준 통과

## 테스트 결과 표기 규칙

| 상태 | 의미 |
|---|---|
| PASS | 정상 동작 확인 |
| FAIL | 오류 또는 기능 불일치 확인 |
| CHECK | 추가 확인 필요 |
| N/A | 현재 조건에서 테스트 불가 |

## 우선 테스트 그룹

이벤트 위임으로 전환된 기능을 먼저 확인한다.

1. 메뉴 연구: `#rndList` 이벤트 위임
2. 메뉴 서빙: `#menuGrid` 이벤트 위임
3. 업그레이드/직원 업그레이드: `#upgList` 이벤트 위임
4. 연구 시작: `#resList` 이벤트 위임
5. 지역 선택/이동/해금: `#mapWrap`, `#modalExpansion` 이벤트 위임

## 브라우저 수동 테스트 체크리스트

| 번호 | 테스트 항목 | 테스트 절차 | 기대 결과 | 상태 | 메모 |
|---:|---|---|---|---|---|
| 1 | 페이지 로드 및 콘솔 에러 | 브라우저에서 `index.html` 또는 배포 URL을 연 뒤 DevTools Console 확인 | 로드 에러와 JS 예외가 없어야 함 | CHECK |  |
| 2 | 스플래시 종료 | 페이지 진입 후 스플래시가 자동 또는 클릭 후 사라지는지 확인 | 메인 게임 UI가 표시되어야 함 | CHECK |  |
| 3 | 손님 선택 | 손님이 표시된 상태에서 손님 또는 관련 UI를 클릭 | 선택 상태 또는 서빙 가능 상태가 정상 반영되어야 함 | CHECK |  |
| 4 | 메뉴 서빙 버튼 | 메뉴 버튼을 클릭 | `serveByMenu(menuId)` 흐름이 동작하고 돈/평판/통계가 갱신되어야 함 | CHECK | 이벤트 위임: `menuGridEl.addEventListener("click")` |
| 5 | 잠긴 메뉴 버튼 | 잠긴 메뉴가 있는 경우 클릭 또는 비활성 상태 확인 | 기존처럼 클릭 불가 또는 잠김 안내가 유지되어야 함 | CHECK |  |
| 6 | 메뉴 연구 버튼 | 연구/통계 영역에서 메뉴 연구 버튼 클릭 | 연구비 차감, 메뉴 레벨 증가, 메뉴판/연구 UI 갱신 | CHECK | 이벤트 위임: `rndListEl.addEventListener("click")` |
| 7 | 연구비 부족 처리 | 돈이 부족한 상태에서 메뉴 연구 시도 | “연구비가 부족해요!” 토스트와 실패 효과가 표시되어야 함 | CHECK |  |
| 8 | 업그레이드 구매 버튼 | 업그레이드 탭에서 구매 버튼 클릭 | `buyUpgrade(upgradeId)` 흐름이 동작해야 함 | CHECK | 이벤트 위임: `upgListEl.addEventListener("click")` |
| 9 | 직원 속도 업그레이드 | 직원 속도 업그레이드 버튼 클릭 | `buyStaffUpgrade(staffKey, "auto")` 흐름이 동작해야 함 | CHECK |  |
| 10 | 직원 매력 업그레이드 | 직원 매력/팁 업그레이드 버튼 클릭 | `buyStaffUpgrade(staffKey, "tip")` 흐름이 동작해야 함 | CHECK |  |
| 11 | 연구 시작 버튼 | 연구 탭에서 연구 시작 버튼 클릭 | `startResearch(researchId)`가 동작하고 연구 진행 상태가 표시되어야 함 | CHECK | 이벤트 위임: `resListEl.addEventListener("click")` |
| 12 | 연구 진행/완료 | 연구 시작 후 진행 및 완료 흐름 확인 | 진행 상태, 완료 보상, UI 갱신이 정상이어야 함 | CHECK |  |
| 13 | 지역 확장 모달 열기 | 우측 상단 지도/openMap 버튼 클릭 | 지역 확장 모달이 열리고 `renderMapUI()` 결과가 보여야 함 | CHECK |  |
| 14 | 지역 확장 모달 닫기 | 닫기 버튼 클릭 | 모달이 정상 닫혀야 함 | CHECK | `closeExpansionModalBtn` |
| 15 | 지역 선택 | 지역 노드 클릭 | 선택 지역 active 상태가 반영되어야 함 | CHECK | 이벤트 위임: `mapWrapEl.addEventListener("click")` |
| 16 | 지역 이동 | 이동 가능한 지역 선택 후 이동 버튼 클릭 | `BranchManager.move` 흐름이 정상 동작해야 함 | CHECK | `mapGoBtn` |
| 17 | 지역 해금 | 해금 가능한 지역에서 해금 버튼 클릭 | `BranchManager.unlockNext` 흐름과 저장/UI 갱신이 정상이어야 함 | CHECK | `mapUnlockBtn` |
| 18 | 설정 모달 | 설정 버튼 클릭 후 닫기 | 모달 열기/닫기 정상 | CHECK | `closeSettingsBtn` |
| 19 | PIN 모달 확인/취소 | PIN이 필요한 기능에서 확인/취소 클릭 | `pinOkBtn`, `pinCancelBtn` 흐름 정상 | CHECK |  |
| 20 | 쿠폰 모달 | 쿠폰 모달 열기/닫기 및 쿠폰 사용 | 쿠폰 수량/효과/UI 갱신 정상 | CHECK |  |
| 21 | 교환 모달 | 교환 모달 열기/닫기 및 교환 실행 | 교환 조건/결과/UI 갱신 정상 | CHECK |  |
| 22 | 저장/불러오기 | 저장 후 새로고침 | 돈, 레벨, 업그레이드, 연구, 지역 상태가 복원되어야 함 | CHECK | localStorage 확인 |
| 23 | 오프라인 보상 | 일정 시간 후 재진입 또는 보상 버튼 확인 | 오프라인 보상 계산/수령 정상 | CHECK |  |
| 24 | 모바일 터치 | 모바일 화면 또는 DevTools 모바일 모드에서 주요 버튼 터치 | 클릭 이벤트와 동일하게 동작해야 함 | CHECK |  |
| 25 | 캔버스 클릭/터치 | 캔버스 영역 클릭/터치 | 기존 onCanvasDown 관련 동작이 깨지지 않아야 함 | CHECK |  |
| 26 | 반복 클릭 중복 실행 | 메뉴/업그레이드/연구/모달 버튼을 반복 클릭 | 이벤트가 중복 실행되지 않아야 함 | CHECK | 금액 중복 차감 여부 확인 |
| 27 | 브라우저 콘솔 에러 | 전체 테스트 후 Console 확인 | Uncaught error가 없어야 함 | CHECK |  |
| 28 | localStorage 저장 상태 | DevTools Application > localStorage 확인 | 저장 키와 값이 정상적으로 유지되어야 함 | CHECK |  |
| 29 | 새로고침 후 이벤트 유지 | 새로고침 후 메뉴/연구/업그레이드 버튼 재클릭 | 이벤트 위임이 정상 유지되어야 함 | CHECK |  |
| 30 | 기본 게임 루프 | 3~5분간 플레이 | 렌더링/상태 갱신/성능 저하가 없어야 함 | CHECK |  |

## 이벤트 리팩터링 회귀 테스트 포인트

### 메뉴 연구

- 버튼에 `data-action="research-menu"`가 붙은 상태에서 클릭이 동작해야 한다.
- 연구 후 `renderRndList()`가 다시 호출되어도 이벤트가 유지되어야 한다.
- 이벤트가 중복 바인딩되어 연구비가 두 번 차감되면 실패다.

### 메뉴 서빙

- 버튼에 `data-action="serve-menu"`, `data-menu-id`가 있어야 한다.
- 실제 클릭된 버튼에 `applyElementFX(btn)`가 적용되어야 한다.
- 잠긴 메뉴 처리와 열린 메뉴 처리의 동작이 분리되어야 한다.

### 업그레이드/직원 업그레이드

- 업그레이드 구매 버튼은 `data-action="buy-upgrade"`로 처리되어야 한다.
- 직원 업그레이드 버튼은 `data-action="buy-staff-upgrade"`, `data-staff-key`, `data-kind`로 처리되어야 한다.
- 업그레이드 후 패널이 다시 렌더링되어도 이벤트가 유지되어야 한다.

### 연구 시작

- 연구 시작 버튼은 `data-action="start-research"`, `data-research-id`로 처리되어야 한다.
- 연구 시작 후 진행 상태가 UI에 반영되어야 한다.
- 연구 탭 재렌더링 후에도 버튼 이벤트가 유지되어야 한다.

### 지역 확장

- `openMap` 클릭으로 모달이 열려야 한다.
- `renderMapUI()`가 실제 `mapWrap`에 렌더링해야 한다.
- 지역 노드 선택, 이동, 해금이 이벤트 위임 기반으로 유지되어야 한다.

## 테스트 결과 기록 양식

테스트 수행 후 아래 형식으로 요약한다.

```text
테스트 환경:
- 브라우저:
- OS:
- 화면 크기:
- 테스트 URL/파일:
- 테스트 일시:

요약:
- PASS:
- FAIL:
- CHECK:
- N/A:

주요 실패:
1.
2.
3.

콘솔 에러:
- 없음 / 있음:
- 에러 메시지:

다음 조치:
-
```

## 다음 단계 제안

브라우저 런타임 테스트에서 치명 오류가 없으면 Step 3으로 이동한다.

### Step 3-1 추천: `js/core/utils.js` 분리 준비

- 숫자 포맷 함수
- DOM 헬퍼
- 공통 안전 호출 함수
- 토스트 보조 함수 후보

단, Step 3-1 전에는 이 문서의 테스트 항목 중 최소 다음 항목은 PASS가 필요하다.

- 메뉴 서빙
- 메뉴 연구
- 업그레이드 구매
- 직원 업그레이드
- 연구 시작
- 지역 확장 모달
- 저장/불러오기
- 콘솔 에러 없음
