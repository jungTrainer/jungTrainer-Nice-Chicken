# Step 2-23S Save QA and Immediate Action Audit

작성일: 2026-05-28

## 현재 상태

Step 2-23R에서 branch snapshot 저장 안정화 hotfix가 `js/core/utils.js`에 적용된 상태에서, 핵심 액션의 저장 누락 가능성을 추가 점검했다.

## 확인한 문제 패턴

일부 상태 변경 함수는 실제로 `state.money`, `state.upgrades`, `state.research`, `state.coupons` 등을 변경한 뒤 `if(_saveDirty) save(true)`만 호출한다.

이 경우 함수 내부에서 `_saveDirty = true`를 먼저 설정하지 않는 분기라면 실제 저장이 실행되지 않을 수 있다.

예상 영향:

- 업그레이드 구매 직후 저장 누락
- 쿠폰/인증서 처리 후 저장 누락
- 연구/이벤트/급여/자동 수익 변경 후 dirty 표시 누락
- 자동 수익은 다음 autosave 시점에 저장되지 않을 수 있음

## 변경한 파일

- `js/core/utils.js`

## 변경 내용

`Step 2-23S: Important save action audit hotfix` 블록을 추가했다.

핵심 동작:

1. 중요한 저장 필드만 골라 snapshot을 만든다.
2. 핵심 즉시 저장 함수 실행 전후 snapshot을 비교한다.
3. 변화가 있으면 `_saveDirty = true`를 설정하고 `save(true)`를 호출한다.
4. 자동/반복성 함수는 변화 감지 시 dirty만 표시한다.
5. 3초 주기로 주요 상태 변화가 감지되면 dirty를 표시한다.

## 즉시 저장 wrapper 대상

- `buyUpgrade`
- `researchMenu`
- `useCoupon`
- `generateWeeklyCertificate`
- `startNewWeek`
- `startEndingSequence`
- `finishEndingSequence`

## dirty 표시 wrapper 대상

- `serveByMenu`
- `processDelivery`
- `updateOnlineAuto`
- `checkLevelUp`
- `maybeTriggerEvent`
- `updateEvent`
- `processPayroll`

## 유지한 제약

- ES module 전환 없음
- `SAVE_KEY` 변경 없음
- inline onclick 재도입 없음
- `.onclick =` 직접 대입 없음
- `safeClick` 재도입 없음
- 저장 구조 대수술 없음
- `createSavePayload()` 도입 없음
- 게임 밸런스 변경 없음

## 브라우저 테스트 필요 항목

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔에 `[save-stability] branch snapshot sync failed` 또는 `[save-audit]` warning이 반복 발생하는지 확인

## 깨질 수 있는 부분

- wrapper 방식이므로 일부 함수가 전역 `window`에 붙어 있지 않으면 감싸지지 않을 수 있다.
- 3초 주기 snapshot 비교가 추가되어 아주 약간의 비용이 생긴다.
- 즉시 저장 대상 함수에서 상태가 바뀌면 localStorage write가 즉시 발생한다.

## 남은 리스크

- 실제 브라우저에서 수동 테스트가 필요하다.
- 함수 전역 노출 여부에 따라 일부 wrapper가 적용되지 않을 수 있다.
- 장기적으로는 `main.js` 내부에서 명시적으로 `markDirty` 또는 `save(true)`를 호출하도록 정리하는 것이 더 좋다.
- 저장 payload 최소화와 export/import UX 개선은 후속 작업이다.

## 다음 스텝 제안

Step 2-23T로 실제 브라우저 테스트 결과를 수집한다.

테스트에서 저장 유지가 확인되면 다음 단계에서 hotfix wrapper를 `main.js`의 명시적 저장 helper로 정리한다.
