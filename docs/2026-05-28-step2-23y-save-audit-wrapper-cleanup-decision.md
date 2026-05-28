# Step 2-23Y Save Wrapper Cleanup Decision

작성일: 2026-05-28

## 현재 상태

브라우저 테스트가 통과했다는 전제로 판단했다.

현재 저장 안정화 상태:

1. Step 2-23R branch snapshot save stabilization wrapper 유지
2. Step 2-23S important save action audit wrapper 유지 중
3. Step 2-23W explicit dirty marker가 `js/main.js`에 반영됨

## 브라우저 테스트 결과

사용자 지시에 따라 브라우저 테스트가 통과했다는 전제로 진행했다.

전제한 통과 항목:

- 돈 획득 후 새로고침 저장 유지
- 업그레이드 구매 후 저장 유지
- 연구 시작/완료 후 저장 유지
- 일간/주간 미션 보상 저장 유지
- 배달/온라인 자동 수익 저장 유지
- 지역 이동 및 지역별 데이터 저장 유지
- 모바일 브라우저 재진입 저장 유지
- `[save-stability]` 또는 `[save-audit]` warning 반복 없음

## Step 2-23S wrapper 판단

Step 2-23S wrapper는 제거 또는 최소화 대상이다.

근거:

- Step 2-23W에서 `js/main.js` 주요 상태 변경 함수에 `_saveDirty = true`가 명시적으로 추가됨
- 브라우저 테스트 통과 전제라면 Step 2-23S의 함수 wrapping과 3초 snapshot polling은 중복 안전망임
- 중복 wrapper는 디버깅 복잡도와 런타임 비용을 늘릴 수 있음

다만 이번 도구 환경에서는 `js/core/utils.js` 직접 수정과 cleanup script 추가가 안전 검사에서 차단되어 코드 제거는 적용하지 못했다.

## Step 2-23R wrapper 판단

Step 2-23R branch snapshot wrapper는 유지한다.

근거:

- 지역/지점 snapshot 저장 안정화는 explicit dirty marker와 역할이 다름
- 저장 직전 `BranchManager.saveCurrent()` 호출은 재접속 시 오래된 branch data가 top-level state를 덮는 문제를 방지함

## 변경한 파일

- `docs/2026-05-28-step2-23y-save-audit-wrapper-cleanup-decision.md`

## 변경 내용

- 브라우저 테스트 통과 전제 기록
- Step 2-23S wrapper 제거/최소화 판단 기록
- Step 2-23R wrapper 유지 판단 기록
- 코드 cleanup 미적용 사유 기록

## 남은 리스크

- Step 2-23S wrapper가 아직 코드에 남아 있음
- node/grep 검증 로그는 아직 별도 확보 필요
- 실제 코드 cleanup은 로컬/Codespaces 또는 별도 패치 환경에서 수행 필요
- `useCoupon`, `generateWeeklyCertificate`, ending 관련 저장 흐름은 후속 점검 필요

## 다음 스텝 제안

Step 2-23Z: Save Helper Consolidation Prep을 진행한다.

목표:

1. Step 2-23S wrapper 제거 패치를 로컬/Codespaces에서 적용한다.
2. `_saveDirty = true` 직접 대입을 `markDirty(reason)` helper로 정리할 준비를 한다.
3. 중요한 즉시 저장은 `saveImportant(reason)` helper로 정리할지 검토한다.
