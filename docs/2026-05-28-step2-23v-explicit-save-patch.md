# Step 2-23V Explicit Save Patch

작성일: 2026-05-28

## 현재 상태

Step 2-23R/2-23S wrapper hotfix 이후, 핵심 액션 함수 내부에 명시적인 `_saveDirty = true`를 추가하는 패치를 적용했다.

## 변경한 파일

- `js/main.js`
- `docs/2026-05-28-step2-23v-explicit-save-patch.md`

## 변경 내용

명시 저장/dirty 처리를 추가한 영역:

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
- 자동 수익 함수는 즉시 저장이 아니라 dirty 표시 중심으로 처리한다.
- 기존 저장 구조, `SAVE_KEY`, classic script 구조는 유지한다.

## 검증 필요

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
7. 콘솔 warning 반복 여부 확인

## 남은 리스크

- 실제 브라우저 테스트가 필요하다.
- 자동 수익은 localStorage write 과다를 피하기 위해 dirty 중심으로 처리했다.
- 장기적으로는 저장 helper를 `main.js`에 명시적으로 도입해 wrapper hotfix를 줄이는 것이 좋다.
