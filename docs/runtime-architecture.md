# 실행 구조와 상태 변경 계약

적용: IMP-08/10/11, 2026-10-13. 데이터 범위는 [본사·지점 규칙](data-ownership.md), 금액은 [성장·금액 정책](economy-policy.md)을 따른다. 모듈 분리는 [IMP-08 보고서](improvements/IMP-08-state-modules.md)에 기록했다.

## 정의와 시작 순서

`index.html`은 아래 순서로 클래식 스크립트를 불러온다. 함수는 한 곳에서 정의하며 설치 과정에서 교체하거나 감싸지 않는다. 기존 브라우저 API를 보존하기 위해 ES module로 전환하지 않았다. 전체 전역 함수 246개와 최상위 변수의 소유 파일은 [전역 목록](runtime-globals.json)에 기록했다. 목록에는 UI 콜백 안의 지역 함수와 객체 메서드는 제외했다.

| 순서 | 파일 | 소유하는 정의·데이터 | 호출 시 의존성 |
| --- | --- | --- | --- |
| 1 | `money.js` | 정수 원 표현·연산·비용·명시적 금액 migration | 연산은 독립적; migration 호출 시 상태/오프라인/dirty 정의 필요 |
| 2–4 | `utils.js`, `audio.js`, `config.js` | 표시/날짜/입력 도우미, 오디오 런타임, 설정·정확한 레벨 앵커 | 금액 모듈, 브라우저 API; 설정은 데이터 생성만 실행 |
| 5 | `content.js` | 지역/직원 콘텐츠·운영/메뉴 선택·정규화·명시적 저장/읽기·리포트 UI | 설정, 호출 시 상태/성장/정산/저장/DOM |
| 6 | `state.js` | `defaultState`, `state`; 호환 schema와 moneyEncoding | 설정/금액 encoding |
| 7 | `persistence.js` | dirty·저장·로드·내보내기·가져오기·초기화·sanitize | 본사/지점 상태, 금액 migration, BranchManager, 미션/연구, 엔딩/화면 복원 |
| 8–9 | `growth.js`, `research.js` | 효과 합산·처리량, 고용/교육/업그레이드·연구·레벨, 구 연구 migration | 설정/상태, 정확한 비용/비교, 저장, 패널 렌더링 |
| 10–11 | `offline.js`, `missions.js` | 미수령 확정/수령, 목표/진행/보상, 인증서 지급과 미리보기 | 처리량/가격/정확한 공통 수익 기록, 저장, 지점 snapshot |
| 12 | `economy.js` | `getMenuPrice`, `upgradeCost`, `recordIncome`, 서빙/팁/배달 지급·급여·쿠폰, 수익 화면 갱신 | 정확한 원 연산, 성장 효과, 미션, 저장, 서비스 연출, DOM refs |
| 13 | `ending.js` | 정확한 목표 비교/재생/완료, 취소 가능한 음원·타이핑·페이드·완료 타이머 | 금액/상태/저장, STAFF_POOL 원본, UI |
| 14–15 | `branches.js`, `services.js` | snapshot 교체, ServiceRuntime 소유권, 온라인/배달/자동/생성 진행 | sanitize·연구 slots, 성장/정산, 장면/연출 |
| 16 | `main.js` | DOM refs와 입력, 고객·장면·패널·통계 렌더링, `tick`/`frame` | 위 단일 사업 함수들 |
| 17 | `ui.js` | 모달/패널의 포커스·닫기·배경 입력·안전 영역 | 장면·엔딩 함수, DOM |
| 18 | `boot.js` | `init`/`initAfterLoad`, 오류 복구와 watchdog | 모든 정의가 로드된 뒤 시작 |

이 표의 core 파일은 `js/core/`에 있다. 실행 시 상호 호출은 남아 있으나 이전 함수의 캡처·재할당 체인은 없다. `main.js`의 DOM 입력 delegation은 평가 시 연결되고, `ui.js`는 DOMContentLoaded에서 입력 소유권을 구성한다. 마지막 `boot.js`의 DOMContentLoaded가 DOM refs·저장 lifecycle을 연결한 뒤 load → sanitize/bootstrap → 오프라인 확정 → 엔딩 UI 복원 → 단일 rAF를 시작한다. 이벤트 연결 guard와 엔딩 WeakSet은 버튼을 여러 번 연결하지 않는다.

## 상태 변경과 저장

- 사업 데이터가 바뀌면 해당 코드가 `markStateChanged(reason)`을 호출한다. 효과 합산에 영향을 주지 않는 수익·진행·미션 카운터에는 두 번째 인자 `false`를 사용할 수 있다.
- `save(false)`는 dirty만 표시한다. `save(true)`는 서비스 진행 capture → 활성 지점 snapshot 동기화 → `lastSeenAt` 갱신 → 이전 본 저장을 backup → 새 본 저장 순서다. 본 저장 성공 시에만 dirty를 해제한다. 실패 시 재시도가 가능하다.
- 구매·수령·쿠폰/인증서·엔딩·지점 이동·이름/음량 등 중요한 사용자 동작은 필요한 변경 뒤 직접 `save(true)`를 호출한다. tick은 진행을 dirty로 표시하고 기존 주기의 autosave가 쓴다. 저장·닫기 lifecycle도 같은 함수를 호출한다.
- 최초 boot만 쓰기를 미룬다. load 중 정규화와 오프라인 확정/현재 시각의 저장을 중간 상태로 덮어쓰지 않고 초기화 끝에서 한 번 쓴다. 이후 수령/지점 이동의 성공 반환값은 실제 본 저장 성공을 뜻한다.
- 전체 상태를 비교하는 즉시 구매 래퍼, 3초 drift 감시, force-save/branch-bootstrap 래퍼는 없다. 앞으로 추가하는 상태 변경도 소유 코드에서 dirty/저장을 명시해야 한다.
- `exportSaveData()`는 현재 지점과 서비스 진행을 동기화해서 내보낸다. LocalStorage write나 보상 지급은 하지 않는다.
- `replaceGameState()`는 가져오기/초기화 후보를 정규화하고 저장한다. 실패 시 원래 root 객체·서비스 소유권·클릭 효과와 dirty 상태를 복구한다. 성공 뒤에만 기존 엔딩 실행을 취소하고 화면을 복원한다.
- 성공한 초기화는 새 상태를 즉시 저장하고 이전 backup을 삭제한다. 실패하면 진행을 지우지 않는다. 브라우저가 backup 삭제까지 거부하는 경우에는 console 경고를 남긴다; 다중 키 LocalStorage는 하나의 원자적 트랜잭션이 아니다.

## 서비스와 파생값

`ServiceRuntime`은 활성 `state` 객체·region, 배달 데이터 객체·서명·서명 입력 캐시를 한 곳에서 소유한다. `bindBranchServiceTimers()`는 sanitize에서 상태 소유자가 바뀔 때, 지점 load/rollback에서 직접 호출한다. 기존 `onlineTimer`/`deliveryTimer`/`deliveryNextIntervalMs`는 엔진의 활성 지점 값이며 저장 원본은 `state.serviceTimers`다. 온라인·배달 처리의 `finally`, snapshot/내보내기/저장에서 capture한다. 자동 진행·회전·손님 생성은 지점별 state 필드에 직접 기록한다. 서빙 직전 자동 진행을 차감하여 서빙 저장에 차감 전 값이 남지 않는다.

배달 효과 입력이 그대로이면 저장된 JSON 서명과 추첨 간격을 재사용한다. 다른 지점/상태로 bind할 때 입력 캐시만 비우며 저장 서명은 유지한다. 연구·라이더·이동수단·버프 만료가 바뀌면 기존 REC-03 규칙대로 진행 비율을 유지해 간격을 갱신한다. 비활성 지점의 미완료 진행은 정지한다.

`aggregateEffects()`에는 업그레이드·연구·이벤트·로봇 효과가 각각 한 번 포함된다. `sumEffects()`는 tick 또는 UI 한 번의 동기 처리 범위에서만 공유한다. 중첩 범위는 depth로 관리하고 `finally`에서 종료한다. 효과를 바꾸는 상태 변경은 캐시를 무효화한다. 범위 밖에서는 매번 새로 계산하므로 디버그/기존 API의 직접 상태 변경을 다음 호출까지 캐시하지 않는다.

스탬프 DOM은 표시 값이 바뀔 때만 만들고 텍스트는 값이 달라질 때 쓴다. 업그레이드 버튼 참조는 패널 재생성 시 갱신한다. 메뉴 수익 표도 표시 값이 달라질 때 한 번 그린다. 메뉴 가격은 기존 정산 함수로 갱신한다. 장면 전체 렌더링과 rAF/fixed-step 주기는 유지했다.

## 변경 시 검증

`npm run doctor`, `npm run check`, `npm test`를 실행한다. 현재 147개 검사는 IMP-10의 120개와 콘텐츠/선택 27개다. IMP-09부터 고정 Playwright Chromium을 기본으로 사용하고 문법 검사는 앱 JS 19개와 도구/helper CJS 8개, 총 27개를 포함한다. 설치/정의 중복 검사는 `tests/refactor.test.cjs`, 지점/저장 원본의 규칙은 `tests/branches.test.cjs`에 있다. 브라우저 검사는 자체 HTTP 서버와 Chromium을 열고 종료한다.

측정은 `node scripts/measure-runtime.cjs [비교할 정적 웹앱 디렉터리]`를 사용한다. 게임 API를 계측하는 래퍼는 이 별도 브라우저 측정 페이지에만 존재하며 앱에 설치되지 않는다. 연산 수와 표시 정확도를 먼저 비교하고 실행 시간은 동일 기기/부하에서 참고한다. CI의 시간 성능 임계값으로 사용하지 않는다.


## IMP-09 지속 검증

[개발 안내](development.md)에 고정 Node/Chromium, 공통 `scripts/ci-checks.sh`, 로그·PNG·trace와 실제 Pages 설정을 기록했다. 게임의 함수 정의·시작 순서·dirty/정산·저장 형식은 변경하지 않았다. 브라우저 helper의 실행 파일 선택·실패 자료 캡처와 성공 스크린샷 출력 위치만 변경했다. CI는 앱을 패치·커밋·배포하지 않는다. 과거 자동 패치 YAML은 `docs/legacy-workflows`의 원본 기록이며 실행 경로에 포함되지 않는다.

## IMP-10 금액 의존성

`money.js`는 첫 스크립트이며 기본 정수 연산은 상태와 DOM에 의존하지 않는다. `config.js`는 정확한 앵커/비용을 생성하고 `state.js`는 encoding을 포함한다. 모든 스크립트가 로드된 뒤 sanitize가 알려진 본사/지점 금액과 확정 미수령을 변환한다. 변환한 값이나 encoding이 바뀔 때만 `markStateChanged("money-migration", false)`를 호출하고 초기 boot는 기존 write 지연 계약을 따른다. 매출 기록은 ledger 값을 모두 계산한 뒤 대입하며 범위 오류는 부분 지급하지 않는다.

가격·구매·급여·교환·통계 합계·매출 미션·엔딩 비교는 금액 모듈을 호출한다. 효과와 서비스 속도는 기존 Number이며 타이머/연구 캐시 소유권을 바꾸지 않는다. 메뉴 비용 캐시는 상태가 아닌 base/ratio/level/지역 배율 키의 순수 계산 결과 최대 256개다. 이동/import/reset에서 같은 입력은 같은 비용이고 효과 캐시나 추첨 간격과 섞이지 않는다. JSON 원본에는 캐시나 BigInt를 넣지 않는다. 자세한 단위·내림·상한·구 저장 변환과 성장 가정은 [금액 정책](economy-policy.md)을 따른다.

## IMP-11 콘텐츠 의존성

content는 config 다음, state 이전에 정의한다. 등록하는 클릭은 기존 report/tab/input owner 아래의 delegation 한 번이며 새로운 모달/loop/타이머를 설치하지 않는다. `defaultManagement`/`normalizeManagement`는 지점별 알려진 선택만 처리한다. sanitize에서 필요할 때만 migration dirty를 표시한다. 선택/읽기는 no-op guard → 명시적 dirty/force save → 실패 시 이전 management/snapshot/시각/dirty 복구를 따른다.

`getManagementEffects()`는 선택한 고용 직원 한 명과 지점 방향을 반환한다. aggregateEffects는 기존 연구/이벤트/로봇 후 이 계수를 한 번 결합한다. computeRates에서 운영 자동 계수는 기존 이벤트 저항 후, 새 손님 인내 +1초는 기존 평판/연구/이벤트의 인내 계산 후 적용한다. 배달 간격은 기존 ServiceRuntime의 입력/서명/비율 갱신 경로를 그대로 사용한다. 선택 클릭에서 updateDelivery나 정산을 실행하지 않는다.

`getOrderMenuPool()`은 방문/배달/온라인/새 오프라인의 유일한 후보 원본이다. 기존 손님/확정 receipt를 다시 쓰지 않는다. `getMenuOfferSummary`는 실제 가격 함수와 정수 합계를 사용하며 UI 평균은 원 미만 내림이다. 리포트가 열리고 해당 탭이 활성일 때만 콘텐츠 DOM을 만든다. 표시는 경제 상태를 지급하거나 이야기 읽음으로 바꾸지 않는다. [콘텐츠 설계](content-design.md)에 선택·소유권·모델 한계를 기록했다.
