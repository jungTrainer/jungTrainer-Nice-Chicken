# Step 2-23X Browser Retest and Hotfix Cleanup

작성일: 2026-05-28

## 현재 상태

Step 2-23W-Check에서 `Apply explicit save dirty markers` 커밋이 확인됐다.

확인된 커밋:

```text
c61e34b6099afb80d0c0ce957f5389e57c1b66a7
```

해당 커밋으로 `js/main.js`의 주요 상태 변경 함수에 `_saveDirty = true`가 명시적으로 추가됐다.

확인된 주요 반영 함수:

- `processPayroll`
- `serveByMenu`
- `ensureMissionReset`
- `startNewWeek`
- `updateMissionsOnlineOnly`
- `startResearch`
- `updateResearch`
- `buyUpgrade`
- `maybeTriggerEvent`
- `updateEvent`
- `processDelivery`
- `updateOnlineAuto`

## 실행한 코드 검증 명령

이 단계의 목표 명령은 다음이다.

```bash
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

현재 대화 실행 환경에서는 로컬/Codespaces 명령과 실제 브라우저 조작을 직접 수행할 수 없다.

따라서 이번 Step 2-23X에서는 코드 구조 확인과 wrapper 유지/정리 판단만 수행했다.

## 코드 검증 결과

직접 `node --check` 로그는 아직 확보하지 못했다.

다만 GitHub 커넥터로 다음 구조는 확인했다.

1. Step 2-23R branch snapshot save stabilization wrapper가 `js/core/utils.js`에 남아 있다.
2. Step 2-23S important save action audit wrapper가 `js/core/utils.js`에 남아 있다.
3. Step 2-23W explicit dirty marker가 `js/main.js`에 반영되어 있다.

## 브라우저 테스트 결과

실제 브라우저 테스트는 아직 수행되지 않았다.

| 번호 | 테스트 항목 | 결과 |
|---|---|---|
| 1 | 돈 획득 후 5초 내 새로고침 | 미실행 |
| 2 | 업그레이드 구매 직후 새로고침 | 미실행 |
| 3 | 연구 시작 직후 새로고침 | 미실행 |
| 4 | 연구 완료 직후 새로고침 | 미실행 |
| 5 | 일간 미션 올클 보상 후 새로고침 | 미실행 |
| 6 | 주간 미션 완료 후 새로고침 | 미실행 |
| 7 | 배달/온라인 자동 수익 발생 후 5초 내 새로고침 | 미실행 |
| 8 | 지역 이동 후 플레이하고 새로고침 | 미실행 |
| 9 | 다른 지역으로 이동 후 기존 지역 복귀 | 미실행 |
| 10 | 모바일 브라우저 홈 화면 전환 후 재진입 | 미실행 |
| 11 | `[save-stability]` 또는 `[save-audit]` warning 반복 여부 | 미실행 |

## 실패한 테스트

브라우저 테스트가 아직 실행되지 않았으므로 실패 항목은 확정할 수 없다.

## 원인 판단

현재 저장 안정화는 세 겹으로 구성되어 있다.

1. `js/main.js`의 기존 `save(true)`/autosave/lifecycle save 구조
2. Step 2-23R의 branch snapshot save stabilization wrapper
3. Step 2-23S의 important save action audit wrapper
4. Step 2-23W의 explicit `_saveDirty = true` 패치

Step 2-23W로 주요 상태 변경 함수에 명시 dirty 처리가 추가되었기 때문에, Step 2-23S wrapper의 필요성은 줄어들었다.

하지만 실제 브라우저 저장 테스트가 아직 없으므로 Step 2-23S wrapper를 지금 제거하면 저장 안정성 회귀를 확인할 수 없다.

## 변경한 파일

이번 단계에서는 코드 파일을 수정하지 않았다.

추가한 문서:

- `docs/2026-05-28-step2-23x-browser-retest-hotfix-cleanup.md`

## 변경 내용

- Step 2-23X 상태 문서화
- 브라우저 테스트 미실행 상태 기록
- Step 2-23R/2-23S wrapper 유지 여부 판단 기록
- 다음 단계 지침 작성

## wrapper hotfix 유지/정리 판단

### Step 2-23R branch snapshot wrapper

유지한다.

이유:

- 지역/지점별 snapshot이 오래된 상태로 저장되면 재접속 시 top-level state가 되돌아갈 수 있다.
- 저장 직전 `BranchManager.saveCurrent()`를 호출하는 역할은 여전히 필요하다.
- 명시 dirty 패치와 역할이 겹치지 않는다.

### Step 2-23S important save action audit wrapper

현재는 유지한다.

이유:

- Step 2-23W로 주요 함수에 명시 dirty가 추가됐지만, 브라우저 저장 테스트가 아직 없다.
- 일부 상태 변경 함수가 전수 확인되지 않았을 가능성이 있다.
- 3초 주기 snapshot 비교와 wrapper는 과도한 안전망일 수 있으나, 테스트 전 제거는 위험하다.

정리 조건:

- 브라우저 테스트 11개 항목 통과
- 콘솔에 `[save-audit]` warning 반복 없음
- `js/main.js` 내부 명시 dirty가 충분하다고 확인
- 이후 Step 2-23Y에서 Step 2-23S wrapper 제거 또는 축소 검토

## 깨질 수 있는 부분

- Step 2-23S wrapper와 Step 2-23W explicit dirty가 중복으로 dirty를 표시할 수 있다.
- `importantSnapshot()` 3초 비교는 아주 작은 런타임 비용을 만든다.
- wrapper 대상 함수가 전역 `window`에 없으면 일부 wrapper는 적용되지 않을 수 있다.
- 반대로 전역 함수 wrapping이 실제 함수 호출 경로와 겹치면 즉시 저장이 중복될 수 있다.

## 남은 리스크

- 실제 브라우저 저장 테스트 미완료
- 모바일 백그라운드 전환 테스트 미완료
- `node --check` 로컬 실행 로그 미확보
- onclick/safeClick 회귀 검증 로그 미확보
- Step 2-23S wrapper cleanup 미완료
- 장기적으로 `markDirty(reason)` 또는 `saveImportant(reason)` helper 도입 필요

## 다음 스텝 제안

Step 2-23Y: Save Audit Wrapper Cleanup Decision을 진행한다.

전제:

1. Step 2-23X 브라우저 테스트 11개 항목을 실제 로컬/실기기에서 수행한다.
2. 저장 유지가 확인되면 Step 2-23S wrapper 제거 또는 축소를 판단한다.
3. 실패 항목이 있으면 wrapper 제거 대신 해당 함수에 직접 명시 저장을 추가한다.

## 다음 진행 프롬프트

```text
Step 2-23Y: Save Audit Wrapper Cleanup Decision을 진행하라.

현재 상태:
1. Step 2-23R branch snapshot save stabilization wrapper는 유지 중이다.
2. Step 2-23S important save action audit wrapper는 유지 중이다.
3. Step 2-23W explicit dirty marker가 `js/main.js`에 반영됐다.
4. Step 2-23X에서는 브라우저 테스트가 아직 미실행이라 wrapper를 제거하지 않았다.
5. `docs/2026-05-28-step2-23x-browser-retest-hotfix-cleanup.md`가 추가됐다.

작업 목표:
1. Step 2-23X 브라우저 테스트 결과를 기준으로 Step 2-23S wrapper 유지/축소/제거 여부를 결정한다.
2. 브라우저 저장 테스트가 모두 통과했다면 Step 2-23S wrapper 제거 또는 최소화 가능성을 검토한다.
3. 하나라도 실패했다면 wrapper 제거를 보류하고 실패 함수에 직접 명시 저장을 추가한다.
4. Step 2-23R branch snapshot wrapper는 지역/지점 snapshot 안정화를 위해 유지한다.

필수 코드 검증:
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js

브라우저 테스트:
1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 시작 직후 새로고침
4. 연구 완료 직후 새로고침
5. 일간 미션 올클 보상 후 새로고침
6. 주간 미션 완료 후 새로고침
7. 배달/온라인 자동 수익 발생 후 5초 내 새로고침
8. 지역 이동 후 플레이하고 새로고침
9. 다른 지역으로 이동 후 기존 지역 복귀
10. 모바일 브라우저 홈 화면 전환 후 재진입
11. 콘솔에 `[save-stability]` 또는 `[save-audit]` warning 반복 발생 여부 확인

판단 기준:
- 모든 테스트 통과 + warning 반복 없음: Step 2-23S wrapper 제거 또는 축소 검토
- 일부 테스트 실패: 실패 함수에 직접 `_saveDirty = true` 또는 `save(true)` 추가
- 지역/지점 데이터 되돌아감: Step 2-23R wrapper 유지 및 BranchManager 저장 구조 추가 분석
- warning 반복 발생: warning 원인 기준으로 wrapper 수정 또는 제거

금지사항:
- ES module 전환 금지
- `SAVE_KEY` 변경 금지
- inline onclick 재도입 금지
- `.onclick =` 직접 대입 금지
- `safeClick` 재도입 금지
- 게임 밸런스 변경 금지
- 저장 구조 대수술 금지
- `createSavePayload()` 도입 금지
- UI 대규모 변경 금지

완료 후 문서 추가:
`docs/2026-05-28-step2-23y-save-audit-wrapper-cleanup-decision.md`

보고 형식:
- 현재 상태
- 코드 검증 결과
- 브라우저 테스트 결과
- 실패한 테스트
- 원인 판단
- 변경한 파일
- 변경 내용
- Step 2-23S wrapper 유지/축소/제거 판단
- Step 2-23R wrapper 유지 판단
- 깨질 수 있는 부분
- 남은 리스크
- 다음 스텝 제안
- 다음 진행 프롬프트
```
