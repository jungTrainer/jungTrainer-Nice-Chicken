# Step 2-23T Browser Save QA

작성일: 2026-05-28

## 현재 상태

Step 2-23R과 Step 2-23S 이후 저장 안정화 상태를 점검했다.

적용된 내용:

1. `js/core/utils.js`에 branch snapshot save stabilization hotfix 적용
2. `js/core/utils.js`에 important save action audit hotfix 적용
3. 기존 `SAVE_KEY` 유지
4. 기존 localStorage 전체 state 저장 구조 유지
5. ES module 전환 없음
6. `createSavePayload()` 도입 없음

## 실행한 검증

이 환경에서는 실제 브라우저 UI 조작과 모바일 앱 전환 테스트를 직접 수행할 수 없다.

또한 컨테이너에서 GitHub 레포를 직접 clone해 `node --check`를 실행하려 했으나, 실행 환경에서 `github.com` DNS 해석이 실패하여 로컬 node 검증은 수행하지 못했다.

대신 GitHub 커넥터로 현재 파일 상태와 코드 구조를 확인했다.

## 코드 기반 확인 결과

### 1. Step 2-23R 적용 확인

`js/core/utils.js`에 저장 직전 branch snapshot 동기화 로직이 존재한다.

확인된 동작:

- `save(true)` 실행 전 `BranchManager.saveCurrent()` 호출
- `saveGame()`이 감싼 `save(true)` 흐름을 사용
- `BranchManager.bootstrap()` 직전 snapshot sync 시도
- 실패 시 `[save-stability] branch snapshot sync failed` warning 출력

### 2. Step 2-23S 적용 확인

`js/core/utils.js`에 important save action audit hotfix가 존재한다.

확인된 동작:

- 주요 저장 필드 snapshot 생성
- 핵심 함수 실행 전후 snapshot 비교
- 상태 변화 시 `_saveDirty = true` 표시
- 즉시 저장 대상 함수는 상태 변화 시 `save(true)` 호출
- 자동/반복 수익 함수는 dirty 표시 중심으로 처리
- 3초 주기 상태 변화 감지 후 dirty 표시

### 3. 직접 확인한 저장 누락 패턴

`buyUpgrade()` 등 일부 함수에는 상태 변경 후 `if(_saveDirty) save(true)` 패턴이 있다.

이 패턴은 함수 내부에서 `_saveDirty = true`가 먼저 설정되지 않는 분기에서는 저장이 생략될 수 있다.

Step 2-23S hotfix는 이 문제를 wrapper 방식으로 보완한다.

## 브라우저 테스트 결과

아래 항목은 아직 실제 브라우저에서 수행되지 않았다.

| 번호 | 테스트 항목 | 현재 결과 |
|---|---|---|
| 1 | 돈 획득 후 5초 내 새로고침 | 미실행 |
| 2 | 업그레이드 구매 직후 새로고침 | 미실행 |
| 3 | 연구 진행 직후 새로고침 | 미실행 |
| 4 | 지역 이동 후 플레이하고 새로고침 | 미실행 |
| 5 | 다른 지역으로 이동 후 기존 지역 복귀 | 미실행 |
| 6 | 모바일 브라우저 홈 화면 전환 후 재진입 | 미실행 |
| 7 | 콘솔 warning 반복 발생 여부 확인 | 미실행 |

## 실패한 테스트

아직 실제 브라우저 테스트를 수행하지 않았으므로 실패 항목은 확정할 수 없다.

## 원인 판단

현재까지의 객관적 원인 후보는 다음이다.

1. `save(false)`는 실제 저장이 아니라 dirty flag 표시다.
2. 일부 상태 변경 함수가 `_saveDirty = true` 없이 `if(_saveDirty) save(true)`만 호출할 수 있다.
3. 지점별 snapshot이 최신 top-level state와 동기화되지 않으면 재접속 시 오래된 branch data가 top-level state를 덮을 수 있다.
4. 자동 수익 계열은 즉시 저장하지 않고 autosave에 의존한다.

Step 2-23R과 Step 2-23S는 2번과 3번 리스크를 줄이기 위한 hotfix다.

## 변경한 파일

이번 Step 2-23T에서는 코드 파일을 추가 수정하지 않았다.

추가한 문서:

- `docs/2026-05-28-step2-23t-browser-save-qa.md`

## 변경 내용

- Step 2-23T 검증 상태 문서화
- 브라우저 테스트 미실행 항목 명확화
- 코드 기반 확인 결과 정리
- 다음 실제 브라우저 테스트 지침 정리

## 깨질 수 있는 부분

- Step 2-23S wrapper는 전역 함수에 적용되는 방식이다. 함수가 전역 `window`에 붙지 않는 경우 일부 wrapper가 적용되지 않을 수 있다.
- 3초 주기 snapshot 비교가 있으므로 극히 작은 런타임 비용이 추가된다.
- 즉시 저장 wrapper 대상 함수에서 상태가 바뀌면 localStorage write가 즉시 발생한다.

## 남은 리스크

- 실제 브라우저 테스트 미완료
- 모바일 브라우저 백그라운드 전환 테스트 미완료
- `node --check` 로컬 실행 미완료
- 장기적으로는 wrapper hotfix가 아니라 `main.js` 내부 명시적 저장 helper로 정리하는 것이 바람직함
- 저장 payload 최소화와 schema 기반 migration은 후속 작업

## 다음 스텝 제안

Step 2-23U: Local Browser Verification을 진행한다.

사용자 또는 Codespaces/로컬 환경에서 아래 명령을 실행한다.

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

이후 브라우저에서 아래 테스트를 수행한다.

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔에 `[save-stability] branch snapshot sync failed` 또는 `[save-audit]` warning 반복 발생 여부 확인

테스트 실패 항목이 있으면 해당 액션 함수에 직접 `_saveDirty = true` 또는 `save(true)`를 명시적으로 추가한다.
