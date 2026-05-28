# Step 3-5A Save Helper Naming Cleanup

작성일: 2026-05-28

## 현재 상태

현재 모듈 분해는 classic script/global 구조를 유지한 상태에서 진행 중이다.

분리 완료 파일:

- `js/core/utils.js`
- `js/core/audio.js`
- `js/core/config.js`

`index.html` 로드 순서:

```html
<script src="./js/core/utils.js"></script>
<script src="./js/core/audio.js"></script>
<script src="./js/core/config.js"></script>
<script src="./js/main.js"></script>
```

저장 안정화는 다음 구조로 되어 있다.

1. `js/main.js`의 기존 `save(force=false)` / `saveGame()` / `bindSaveLifecycleEvents()`
2. Step 2-23R branch snapshot save stabilization wrapper
3. Step 2-23S important save action audit wrapper
4. Step 2-23W explicit `_saveDirty = true` marker

## 조사한 파일

- `js/main.js`
- `js/core/utils.js`
- `docs/2026-05-28-step2-23w-execute-explicit-save-patch.md`
- `docs/2026-05-28-step2-23y-save-audit-wrapper-cleanup-decision.md`

## `_saveDirty = true` 직접 대입 목록

확인된 주요 위치:

### 즉시 저장에 가까운 상태 변경

- `processPayroll()`
  - 알바 임금 지급 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `serveByMenu()`
  - 온라인 서빙 수익, 팁, 평판, 메뉴 통계 변경 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `updateMissionsOnlineOnly()`
  - 일간 올클 보상 지급 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `startResearch()`
  - 연구 슬롯 시작 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `updateResearch()`
  - 연구 완료 처리 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `buyUpgrade()`
  - 구매 비용 차감 후 `_saveDirty = true`
  - 이후 각 분기에서 `save(true)` 호출

- `maybeTriggerEvent()`
  - 이벤트 시작 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

- `updateEvent()`
  - 이벤트 종료 후 `_saveDirty = true`
  - 이후 `save(true)` 호출

### 지연 저장 또는 autosave 의존 가능 상태 변경

- `checkLevelUp()`
  - 레벨 상승 시 `_saveDirty = true`
  - 즉시 저장은 하지 않음

- `ensureMissionReset()`
  - 일간 리셋 후 `_saveDirty = true`
  - 인증서 만료 분기에서는 `save(true)` 호출

- `processDelivery()`
  - 배달 수익 반영 후 `_saveDirty = true`
  - 자동 반복 수익이므로 즉시 저장보다 autosave 대상

- `updateOnlineAuto()`
  - 온라인 자동 수익 반영 후 `_saveDirty = true`
  - 자동 반복 수익이므로 즉시 저장보다 autosave 대상

### 추가 점검 필요

- `useCoupon()`
- `generateWeeklyCertificate()`
- ending 관련 함수
- 지역 이동 관련 `BranchManager.move`, `BranchManager.unlockNext`
- 교환 버튼 핸들러

일부는 Step 2-23S wrapper가 즉시 저장 안전망으로 감싸고 있으나, 장기적으로는 함수 내부에 명시적 helper 호출이 필요하다.

## `save(true)` 직접 호출 목록

확인된 유형:

### 즉시 저장

- `processPayroll()`
- `serveByMenu()`
- `updateMissionsOnlineOnly()` 일간 올클 보상
- `startResearch()`
- `updateResearch()`
- `buyUpgrade()`
- `maybeTriggerEvent()`
- `updateEvent()`
- 인증서 만료 분기
- import save 완료 후

### lifecycle 저장

- `bindSaveLifecycleEvents()` 내부
  - `pagehide`
  - `visibilitychange:hidden`
  - `beforeunload`

### 수동 저장/호환

- `saveGame()`
- 강제 저장 버튼 또는 export/import 관련 UI

## `saveGame()` 호출 목록

확인된 구조:

```js
function saveGame(){
  return save(true);
}
```

Step 2-23R wrapper는 `saveGame()`도 감싼 `save(true)` 흐름을 사용하도록 재연결한다.

## helper 도입 제안

이번 단계에서는 실제 치환을 하지 않고 다음 helper 후보만 설계한다.

### `markDirty(reason)`

목적:

- `_saveDirty = true` 직접 대입을 대체
- 저장 필요 상태를 명확하게 기록
- 디버깅 시 마지막 dirty reason 확인 가능

예상 형태:

```js
function markDirty(reason="unknown"){
  _saveDirty = true;
  window.__lastSaveDirtyReason = reason;
  return true;
}
```

### `saveImportant(reason)`

목적:

- 사용자가 즉시 손실을 크게 느끼는 액션에 사용
- 내부에서 `markDirty(reason)` 후 `save(true)` 호출

예상 형태:

```js
function saveImportant(reason="important"){
  markDirty(reason);
  return save(true);
}
```

### `saveSoon(reason)` 또는 `markDirtyAndSaveSoon(reason)`

목적:

- 자동 반복 수익처럼 즉시 localStorage write를 피해야 하는 영역에 사용
- autosave 또는 lifecycle save에 맡김

예상 형태:

```js
function saveSoon(reason="deferred"){
  return markDirty(reason);
}
```

## 즉시 저장 대상

`saveImportant(reason)` 후보:

- 업그레이드 구매
- 연구 시작
- 연구 완료
- 쿠폰 사용
- 인증서 발급
- 인증서 사용/만료
- 주간/일간 올클 보상
- 지역 해금
- 지역 이동
- 수동 백업 import
- 엔딩 상태 변경

## 지연 저장 대상

`saveSoon(reason)` 후보:

- 서빙 1회 수익
- 자동 배달 수익
- 온라인 자동 수익
- 평판 자연 회복/감소
- 손님 이탈로 인한 평판 변화
- 레벨업 감지
- 일간 통계 누적

단, 현재 `serveByMenu()`는 사용자가 바로 새로고침하는 테스트에서 손실 체감이 커서 당분간 즉시 저장 유지가 안전하다. 이후 저장 빈도 최적화 단계에서 지연 저장으로 조정할 수 있다.

## Step 2-23S wrapper 정리 판단

Step 2-23S wrapper는 제거 또는 최소화 대상이다.

근거:

- Step 2-23W에서 `js/main.js` 주요 상태 변경 함수에 `_saveDirty = true`가 반영됨
- 브라우저 테스트 통과가 확인됨
- wrapper와 3초 snapshot polling은 중복 안전망이 됨
- 장기적으로 디버깅 복잡도와 런타임 비용을 늘림

다만 helper 도입 전까지는 한 번에 제거하지 말고 다음 순서가 안전하다.

1. `markDirty`, `saveImportant`, `saveSoon` helper 도입
2. 누락 함수에 helper 적용
3. 브라우저 테스트
4. Step 2-23S wrapper 제거

## Step 2-23R wrapper 유지 판단

Step 2-23R wrapper는 유지한다.

근거:

- branch snapshot 저장 안정화는 dirty marker와 역할이 다름
- 저장 직전 `BranchManager.saveCurrent()` 호출은 재접속 시 지점 데이터 되돌림 문제를 방지함
- 장기적으로는 `save(true)` 내부 또는 `save.js`로 흡수하는 것이 좋음

## 다음 분리 후보

우선순위:

1. `js/core/save.js`
   - `SAVE_KEY`, `SAVE_BACKUP_KEY`, `save`, `saveGame`, `load`, lifecycle save, export/import

2. `js/core/ui-bindings.js`
   - 버튼/탭/모달/지도/조리법 연구 클릭 바인딩

3. `js/features/management-report.js`
   - `updateStatsUI`, `renderRndList`, `researchMenu`

4. `js/features/branches.js`
   - `BranchManager`, 지역 이동/해금, 지도 UI

## 깨질 수 있는 부분

- `_saveDirty = true`를 helper로 바꾸는 과정에서 한 군데라도 누락되면 저장 손실이 재발할 수 있음
- `saveImportant()`를 자동 반복 수익에 잘못 적용하면 localStorage write가 과도해질 수 있음
- Step 2-23S wrapper 제거 시 아직 helper가 적용되지 않은 함수가 드러날 수 있음
- Step 2-23R wrapper를 잘못 제거하면 지역/지점 저장 되돌림 문제가 재발할 수 있음

## 남은 리스크

- Step 2-23S wrapper가 아직 `utils.js`에 남아 있음
- `_saveDirty = true` 직접 대입이 여러 곳에 분산되어 있음
- `useCoupon`, `generateWeeklyCertificate`, ending 관련 저장 흐름은 추가 점검 필요
- `save.js` 분리 전에는 저장 계층과 게임 로직의 경계가 불명확함

## 다음 스텝 제안

Step 3-5B: Save Helper Introduce Plan을 진행한다.

목표:

1. `markDirty(reason)`, `saveImportant(reason)`, `saveSoon(reason)` helper를 `main.js` 저장 섹션에 추가한다.
2. 우선 3~5개 대표 지점만 안전하게 helper로 치환한다.
3. 자동 반복 수익과 즉시 저장 대상을 혼동하지 않도록 한다.
4. Step 2-23S wrapper는 helper 적용 후 제거한다.
