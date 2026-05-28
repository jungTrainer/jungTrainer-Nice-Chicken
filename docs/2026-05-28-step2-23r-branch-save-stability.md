# Step 2-23R Branch Save Stability Hotfix

작성일: 2026-05-28

## 목적

게임 재접속 시 진행 상태가 이전 값으로 돌아가는 저장 문제를 줄이기 위한 1차 hotfix를 적용했다.

## 원인 판단

현재 게임은 지점별 데이터를 `state.branches[regionId].data`에 보관한다.

플레이 중에는 top-level `state`가 먼저 변경되지만, 현재 지점 snapshot이 최신 상태로 동기화되지 않으면 다음 접속 때 `BranchManager.bootstrap()` 과정에서 오래된 snapshot이 다시 top-level state를 덮을 수 있다.

이 경우 localStorage 저장은 수행됐더라도 사용자는 저장이 되지 않은 것처럼 느낄 수 있다.

## 변경한 파일

- `js/core/utils.js`

## 변경 내용

`js/core/utils.js`에 `Step 2-23R: Branch snapshot save stabilization` 블록을 추가했다.

핵심 동작:

1. `DOMContentLoaded` 시점에 1회만 설치한다.
2. `save(true)` 실행 직전에 `BranchManager.saveCurrent()`를 호출한다.
3. `saveGame()`도 감싼 `save(true)` 흐름을 사용하도록 연결한다.
4. `BranchManager.bootstrap()` 실행 직전에도 현재 지점 snapshot 동기화를 시도한다.
5. 동기화 실패 시 앱 실행을 막지 않고 warning만 출력한다.

## 유지한 내용

- 기존 `SAVE_KEY` 유지
- 기존 `SAVE_BACKUP_KEY` 유지
- 기존 전체 state 저장 방식 유지
- ES module 전환 없음
- inline onclick 재도입 없음
- `.onclick =` 직접 대입 없음
- `safeClick` 재도입 없음

## 확인한 구조

현재 `index.html` script 순서는 다음과 같다.

```html
<script src="./js/core/utils.js"></script>
<script src="./js/core/audio.js"></script>
<script src="./js/core/config.js"></script>
<script src="./js/main.js"></script>
```

따라서 `utils.js` hotfix는 `DOMContentLoaded` 시점에 `main.js`의 `save`, `saveGame`, `BranchManager`를 감쌀 수 있다.

## 브라우저 테스트 필요 항목

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔에 `[save-stability] branch snapshot sync failed` 경고가 뜨는지 확인

## 남은 리스크

- 저장 payload 최소화는 아직 하지 않았다.
- 핵심 액션별 즉시 저장 전수 점검은 후속 작업이다.
- 실제 브라우저 수동 테스트가 필요하다.
- export/import 안내 UX는 후속으로 개선할 수 있다.

## 다음 스텝 제안

다음 단계는 `Step 2-23S: Save QA and Immediate Action Audit`로 진행한다.

목표:

1. 돈, 업그레이드, 연구, 미션, 쿠폰, 지역 이동 등 핵심 액션의 저장 호출을 전수 점검한다.
2. `_saveDirty = true` 또는 `save(true)` 누락 위치를 찾는다.
3. 브라우저 수동 테스트 결과를 문서화한다.
