# Step 2-23V Explicit Save Patch

작성일: 2026-05-28

## 현재 상태

Step 2-23V는 wrapper hotfix에만 의존하지 않고, 핵심 액션 함수 내부에 명시적인 `_saveDirty = true` 또는 `save(true)`를 추가하는 단계다.

현재 작업 환경에서는 GitHub 레포를 로컬로 clone할 수 없고, `main.js` 전체 파일을 안정적으로 치환하기 어렵다. 따라서 이번 단계에서는 `main.js`를 직접 수정하지 않고, 로컬/Codespaces에서 재현 가능하게 실행할 수 있는 패치 스크립트를 추가했다.

## 추가한 파일

- `scripts/apply-step2-23v-explicit-save-patch.py`
- `docs/2026-05-28-step2-23v-explicit-save-patch.md`

## 패치 스크립트 역할

`scripts/apply-step2-23v-explicit-save-patch.py`는 `js/main.js`에서 다음 상태 변경 지점에 명시적 dirty 처리를 추가한다.

대상 영역:

- `buyUpgrade`
- `serveByMenu`
- `ensureMissionReset`
- `startNewWeek`
- `updateMissionsOnlineOnly`
- `startResearch`
- `updateResearch`
- `processDelivery`
- `updateOnlineAuto`
- `maybeTriggerEvent`
- `updateEvent`
- `processPayroll`

## 의도

- 구매/연구/미션/이벤트처럼 손실 체감이 큰 액션은 상태 변경 직후 dirty를 명시한다.
- 자동 수익 함수는 localStorage write 과다를 피하기 위해 즉시 저장이 아니라 dirty 표시 중심으로 처리한다.
- 기존 `SAVE_KEY`와 저장 구조는 유지한다.
- ES module 전환은 하지 않는다.
- `createSavePayload()`는 도입하지 않는다.

## 실행 방법

로컬 또는 Codespaces에서 아래 명령을 실행한다.

```bash
python3 scripts/apply-step2-23v-explicit-save-patch.py
```

성공 시 기대 로그:

```text
[OK] Step 2-23V explicit save patch applied
[OK] updated: js/main.js
[OK] wrote: docs/2026-05-28-step2-23v-explicit-save-patch.md
```

실패 시 `[FAIL]` 로그에 표시된 target을 기준으로 현재 `main.js` 코드와 스크립트의 탐색 문자열이 어긋난 것이다.

## 검증 명령

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

## 브라우저 재테스트 필요

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔에 `[save-stability] branch snapshot sync failed` 또는 `[save-audit]` warning 반복 발생 여부 확인

## 깨질 수 있는 부분

- 스크립트는 정확한 문자열 치환 방식이다. `main.js`가 이미 바뀐 경우 `[FAIL] missing target` 또는 `[FAIL] ambiguous target`이 발생할 수 있다.
- 자동 수익 함수는 즉시 저장하지 않고 dirty 중심으로만 처리한다.
- 실제 브라우저 테스트가 아직 필요하다.

## 남은 리스크

- 현재 단계에서는 패치 스크립트만 추가되었고, `main.js`에는 아직 직접 반영되지 않았다.
- 로컬/Codespaces에서 스크립트를 실행해야 실제 `main.js`가 수정된다.
- 장기적으로는 wrapper hotfix와 문자열 패치 방식이 아니라 `main.js` 내부에 명시적 저장 helper를 정식 도입하는 것이 좋다.

## 다음 스텝 제안

Step 2-23W: Execute Explicit Save Patch를 진행한다.

로컬/Codespaces에서 패치 스크립트를 실행하고, `node --check` 및 브라우저 저장 테스트를 수행한다.
