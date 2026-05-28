# Step 2-23U Local Browser Verification

작성일: 2026-05-28

## 현재 상태

Step 2-23U는 로컬 또는 Codespaces 환경에서 실제 코드 검증 명령과 브라우저 저장 테스트를 수행하는 단계다.

현재까지 적용된 저장 안정화 작업은 다음과 같다.

1. Step 2-23R: branch snapshot save stabilization hotfix
2. Step 2-23S: important save action audit hotfix
3. Step 2-23T: 브라우저 테스트 미실행 상태 및 로컬 검증 지침 문서화

이번 Step 2-23U에서는 현재 작업 환경에서 실제 브라우저 조작과 로컬 `node --check` 실행을 완료할 수 없었다. 따라서 로컬/Codespaces 실행 대기 상태로 문서화한다.

## 실행한 코드 검증 명령

아래 명령은 로컬 또는 Codespaces에서 실행해야 한다.

```bash
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js
```

현재 환경에서는 직접 실행하지 못했다.

## 검색 검증 명령

아래 명령도 로컬 또는 Codespaces에서 실행해야 한다.

```bash
grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

기대 결과:

- inline `onclick=` 0개
- `.onclick =` 직접 대입 0개
- `function safeClick` 0개
- `safeClick(` 실제 호출 0개

## 브라우저 테스트 항목별 결과

| 번호 | 테스트 항목 | 결과 |
|---|---|---|
| 1 | 돈 획득 후 5초 내 새로고침 | 미실행 |
| 2 | 업그레이드 구매 직후 새로고침 | 미실행 |
| 3 | 연구 진행 직후 새로고침 | 미실행 |
| 4 | 지역 이동 후 플레이하고 새로고침 | 미실행 |
| 5 | 다른 지역으로 이동 후 기존 지역 복귀 | 미실행 |
| 6 | 모바일 브라우저 홈 화면 전환 후 재진입 | 미실행 |
| 7 | `[save-stability]` 또는 `[save-audit]` warning 반복 여부 | 미실행 |

## 실패한 테스트

브라우저 테스트가 아직 실행되지 않았으므로 실패 항목은 확정할 수 없다.

## 실패 시 원인 분석 기준

테스트 실패 시 아래 연결 관계를 기준으로 원인을 좁힌다.

| 실패 항목 | 우선 확인 함수 |
|---|---|
| 돈 획득 저장 실패 | `serveByMenu`, `processDelivery`, `updateOnlineAuto` |
| 업그레이드 저장 실패 | `buyUpgrade` |
| 연구 저장 실패 | `researchMenu` 또는 연구 관련 함수 |
| 지역 이동 저장 실패 | `BranchManager.move`, `BranchManager.unlockNext` |
| 쿠폰/인증서 저장 실패 | `useCoupon`, `generateWeeklyCertificate`, `startNewWeek` |
| 재접속 시 지점 데이터 되돌아감 | `BranchManager.saveCurrent`, `BranchManager.bootstrap`, Step 2-23R wrapper |
| 자동 수익만 저장 지연 | `_saveDirty`, autosave loop, Step 2-23S dirty wrapper |

## 수정한 파일

이번 단계에서 코드 파일은 수정하지 않았다.

추가한 문서:

- `docs/2026-05-28-step2-23u-local-browser-verification.md`

## 수정 내용

- Step 2-23U 로컬 검증 대기 상태 문서화
- 실행해야 할 코드 검증 명령 정리
- 실행해야 할 브라우저 테스트 항목 정리
- 테스트 실패 시 확인할 함수 연결표 정리

## 남은 리스크

- 실제 로컬/Codespaces `node --check` 미실행
- 실제 브라우저 저장 테스트 미실행
- 모바일 브라우저 백그라운드 전환 테스트 미실행
- Step 2-23S wrapper가 전역 함수에 적용되지 않는 경우 일부 저장 보강이 동작하지 않을 수 있음
- 장기적으로는 wrapper hotfix 대신 `main.js` 내부 명시적 저장 helper로 정리해야 함

## 다음 스텝 제안

Step 2-23V: Explicit Save Patch를 준비한다.

조건:

1. Step 2-23U 로컬/브라우저 테스트를 실제 실행한다.
2. 실패 항목이 있으면 실패한 액션 함수에 직접 `_saveDirty = true` 또는 `save(true)`를 추가한다.
3. 자동 반복 수익 함수는 `_saveDirty = true` 중심으로 처리한다.
4. 구매, 연구, 지역 이동, 쿠폰, 인증서처럼 손실 체감이 큰 액션은 `save(true)`까지 허용한다.

## 다음 진행 프롬프트

```text
Step 2-23V: Explicit Save Patch를 진행하라.

전제:
Step 2-23U에서 로컬/Codespaces 코드 검증과 브라우저 저장 테스트를 수행한다.
테스트 실패 항목이 있으면 해당 액션 함수에 직접 최소 범위 저장 처리를 추가한다.

작업 목표:
1. Step 2-23U 테스트 결과를 기준으로 실패한 저장 케이스를 확정한다.
2. 실패한 테스트와 연결되는 함수만 수정한다.
3. wrapper hotfix에만 의존하지 않고, 해당 함수 내부에 명시적으로 `_saveDirty = true` 또는 `save(true)`를 추가한다.

우선 확인 함수:
- 돈 획득: `serveByMenu`, `processDelivery`, `updateOnlineAuto`
- 업그레이드: `buyUpgrade`
- 연구: `researchMenu` 또는 연구 관련 함수
- 지역 이동: `BranchManager.move`, `BranchManager.unlockNext`
- 쿠폰/인증서: `useCoupon`, `generateWeeklyCertificate`, `startNewWeek`

수정 기준:
- 자동 반복 수익 함수는 `_saveDirty = true` 중심으로 처리한다.
- 구매/연구/지역 이동/쿠폰/인증서처럼 사용자가 즉시 손실을 크게 느끼는 액션은 `save(true)`까지 허용한다.
- 상태 변경 직후에만 추가한다.
- 단순 UI 변경, 모달 열기/닫기에는 저장을 추가하지 않는다.

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

검증 명령:
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js

완료 후 문서 추가:
`docs/2026-05-28-step2-23v-explicit-save-patch.md`

보고 형식:
- 현재 상태
- Step 2-23U 테스트 결과
- 실패한 테스트
- 원인 판단
- 변경한 파일
- 변경 내용
- 검증 결과
- 브라우저 재테스트 결과
- 깨질 수 있는 부분
- 남은 리스크
- 다음 스텝 제안
- 다음 진행 프롬프트
```
