# Step 2-22 저장/불러오기 구조 진단

작성일: 2026-05-15

## 목적

Step 2 이벤트 리팩터링 이후 실제 게임 저장 방식이 일반적인 방치형/타이쿤 게임 기준으로 충분히 안정적인지 점검한다.

이번 단계에서는 기능 코드를 변경하지 않는다. 현재 저장 구조, 문제점, 개선 방향만 문서화한다.

## 일반적인 웹 방치형/타이쿤 게임 저장 방식

웹 기반 방치형 게임은 보통 다음 저장 방식을 조합한다.

| 방식 | 설명 | 장점 | 한계 |
|---|---|---|---|
| localStorage 자동 저장 | 브라우저에 JSON 문자열로 저장 | 구현 간단, 서버 불필요 | 브라우저/기기별 저장, 삭제 위험 |
| 주기적 autosave | 일정 시간마다 변경사항 저장 | 갑작스러운 종료 손실 완화 | 너무 자주 쓰면 렉 가능 |
| 중요 액션 즉시 저장 | 구매/연구/지역 이동 같은 상태 변경 직후 저장 | 핵심 진행 손실 방지 | 쓰기 빈도 관리 필요 |
| pagehide/beforeunload 저장 | 탭 닫기/새로고침 직전에 저장 | 마지막 진행 손실 완화 | 모바일/브라우저별 불완전 |
| export/import 저장 | 저장 데이터를 파일/문자열로 백업 | 유저 백업 가능 | 사용자가 직접 관리해야 함 |
| 클라우드 저장 | 서버/로그인 기반 저장 | 기기 간 동기화 가능 | 서버/계정/보안 필요 |

이 프로젝트는 현재 서버 없는 웹 게임이므로, 현실적인 1차 목표는 `localStorage + 자동 저장 + 중요 액션 즉시 저장 + 종료 직전 저장 + 수동 백업` 조합이다.

## 현재 저장 구조

### 저장 키

현재 저장 키는 다음과 같다.

```js
const SAVE_KEY = "niceChicken_idleServe_vFinal";
```

이 키로 `localStorage`에 전체 `state`를 JSON 문자열로 저장한다.

### 기본 상태

`defaultState()`가 전체 게임 상태의 기본값을 생성한다. 포함되는 주요 상태는 다음과 같다.

- 프로필 이름
- 사운드 설정
- 돈, 평판, 레벨
- 지역/브랜치 상태
- 오늘/누적 매출
- 메뉴 레벨/통계
- 직원/업그레이드 상태
- 쿠폰/인증서/혜택 로그
- 손님 상태
- 연구 상태
- 미션 상태
- 이벤트 상태
- `lastSeenAt`
- 자동 저장 누적값

### 저장 함수

현재 저장 함수는 다음 구조다.

```js
let _saveDirty = false;
let _lastSaveWriteAt = 0;
function save(force=false){
  // localStorage는 동기식이라 자주 쓰면 렉 유발.
  // force=false는 '저장 필요'만 표시하고 실제 write는 autosave/종료 시에만 수행.
  if(!force){ _saveDirty = true; return; }
  state.lastSeenAt = Date.now();
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
  _saveDirty = false;
  _lastSaveWriteAt = Date.now();
}
```

특징:

- `save(false)` 또는 `save()`는 실제 저장을 하지 않고 `_saveDirty = true`만 설정한다.
- `save(true)`만 실제로 `localStorage.setItem()`을 실행한다.
- 저장 직전에 `state.lastSeenAt`을 현재 시각으로 갱신한다.
- 저장 실패는 `catch(e){}`로 조용히 무시한다.

### 호환 alias

```js
function saveGame(){
  return save(true);
}
```

기존 코드가 `saveGame()`을 호출해도 실제 저장되도록 alias가 있다.

### 불러오기 함수

`load()`는 `localStorage.getItem(SAVE_KEY)`를 읽고 JSON 파싱 후 `defaultState()`와 병합한다.

주요 특징:

- 저장 데이터가 없으면 `false` 반환
- JSON 파싱 실패 시 `false` 반환
- `state = { ...defaultState(), ...parsed }`로 기본값과 저장값을 병합
- `profile`, `coupons`, `cert`, `delivery`, `online`, `research`, `missions` 등 일부 객체는 별도 deep patch 수행
- 구버전 연구 완료 데이터 마이그레이션 처리
- 마지막에 `sanitizeState()`로 누락/비정상 값을 보정

### 자동 저장

게임 루프 `tick(dt)`에서 다음 흐름으로 자동 저장한다.

```js
state._saveAcc += dt;
if(state._saveAcc >= CONFIG.autosaveSec){
  state._saveAcc = 0;
  if(_saveDirty) save(true);
}
```

`CONFIG.autosaveSec`는 30초다.

즉, `_saveDirty`가 true인 상태에서 30초마다 실제 저장한다.

### 강제 저장 버튼

설정 모달의 강제 저장 버튼은 다음 흐름이다.

```js
forceSaveBtn.addEventListener("click", ()=>{ save(true); showToast("저장 완료"); });
```

사용자가 직접 저장을 누르면 즉시 `localStorage`에 저장된다.

### 오프라인 보상 기준

오프라인 보상은 `state.lastSeenAt` 기준으로 계산한다.

```js
const now = Date.now();
const then = state.lastSeenAt || now;
const diffMs = Math.max(0, now-then);
const capMs = CONFIG.offlineMaxHours * 3600 * 1000;
const usedMs = Math.min(diffMs, capMs);
```

따라서 `lastSeenAt`이 마지막 저장 시점으로 잘 갱신되어야 오프라인 보상이 정상 계산된다.

## 현재 구조의 장점

1. 서버 없이 동작한다.
2. localStorage 기반이라 배포가 간단하다.
3. `defaultState()` + `sanitizeState()`가 있어 구버전 저장 데이터 호환에 유리하다.
4. `save(false)`와 `_saveDirty` 구조로 localStorage 과다 쓰기를 피한다.
5. 구매/연구/쿠폰/지역 이동 등 여러 중요 액션에서 `save(true)` 호출이 이미 존재한다.
6. `saveGame()` alias가 있어 기존 패치 코드와 호환된다.

## 현재 구조의 문제점

### 1. 종료 직전 저장이 없다

현재 코드 검색 기준으로 `beforeunload`, `pagehide`, `visibilitychange` 저장 훅이 확인되지 않는다.

문제:

- 사용자가 구매/서빙/연구 후 30초 autosave 전에 탭을 닫으면 일부 진행이 날아갈 수 있다.
- 모바일 브라우저에서 앱 전환/백그라운드 전환 시 손실 가능성이 있다.

### 2. `save(false)` 호출은 실제 저장이 아니다

현재 구조상 `save()` 또는 `save(false)`는 `_saveDirty = true`만 설정한다.

문제:

- 개발자가 `save()`를 실제 저장으로 오해하면 저장 누락이 생긴다.
- 실제 저장은 30초 autosave 또는 `save(true)`까지 지연된다.

### 3. 저장 실패를 조용히 무시한다

```js
try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){}
```

문제:

- 저장 용량 초과, private mode 제한, JSON stringify 오류 등이 발생해도 사용자는 알 수 없다.
- 저장 실패 상태에서도 “저장 완료” 토스트가 뜰 수 있다.

### 4. 저장 데이터가 하나뿐이다

현재는 단일 키 `niceChicken_idleServe_vFinal`만 사용한다.

문제:

- 저장 데이터가 깨지면 복구가 어렵다.
- 이전 정상 저장본 backup 키가 없다.
- 버전별 migration 실패 시 되돌릴 수 없다.

### 5. export/import 백업 기능이 없다

문제:

- 사용자가 브라우저 캐시 삭제, 다른 기기 사용, Pages 도메인 변경 등을 겪으면 저장이 사라질 수 있다.
- 긴 방치형 게임에는 수동 백업 기능이 매우 중요하다.

### 6. 저장 범위가 전체 state라 비대해질 수 있다

현재는 전체 `state`를 통째로 저장한다.

문제:

- `customers`, 이벤트 임시값, 렌더링 관련 누적값 등 저장하지 않아도 되는 런타임 상태까지 들어갈 수 있다.
- 장기적으로 저장 용량과 마이그레이션 복잡도가 커진다.

### 7. 오프라인 보상 기준이 마지막 실제 저장 시점에 의존한다

`lastSeenAt`은 `save(true)`에서만 갱신된다.

문제:

- 사용자가 오랜 시간 플레이했지만 마지막 저장이 오래전이면 오프라인 보상 계산이 어긋날 수 있다.
- 반대로 탭을 닫기 직전에 저장이 안 되면 마지막 접속 시간이 정확하지 않을 수 있다.

## 우선 개선 방향

### Step 2-23 권장: 종료/백그라운드 저장 훅 추가

가장 먼저 추가할 것은 다음이다.

```js
window.addEventListener("pagehide", ()=> save(true));
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState === "hidden") save(true);
});
```

`beforeunload`도 추가할 수 있지만 모바일에서는 `pagehide`와 `visibilitychange`가 더 중요하다.

### Step 2-24 권장: 저장 실패 감지 및 토스트 개선

`save(true)`가 성공/실패를 boolean으로 반환하도록 바꾼다.

예:

```js
function save(force=false){
  if(!force){ _saveDirty = true; return true; }
  state.lastSeenAt = Date.now();
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    return true;
  }catch(e){
    console.error("save failed", e);
    return false;
  }
}
```

### Step 2-25 권장: 백업 저장 키 추가

저장 전 기존 저장본을 backup key로 옮긴다.

예:

```js
const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";
const old = localStorage.getItem(SAVE_KEY);
if(old) localStorage.setItem(SAVE_BACKUP_KEY, old);
localStorage.setItem(SAVE_KEY, JSON.stringify(state));
```

### Step 2-26 권장: export/import 저장 기능 추가

설정 모달에 다음 버튼을 추가한다.

- 저장 데이터 내보내기
- 저장 데이터 가져오기
- 저장 데이터 복구

긴 방치형 게임에서는 매우 유용하다.

### Step 3 모듈 분리 전 권장 판단

JS 모듈 분리 전에 저장 안정화는 먼저 하는 것이 좋다.

이유:

- 모듈 분리 중 오류가 생겨도 저장 복구 수단이 있어야 한다.
- 사용자가 실제 플레이를 시작한 상태라면 저장 손실이 가장 큰 리스크다.
- `save.js`로 분리하기 전에 save/load 구조를 먼저 안정화하면 이후 분리도 쉬워진다.

## 결론

현재 저장 방식은 “초기 웹 방치형 게임” 기준으로는 동작 가능한 구조다.

하지만 실제 유저가 오래 플레이하는 게임 기준으로는 아직 부족하다.

가장 큰 문제는 다음 3개다.

1. 탭 닫기/백그라운드 전환 시 즉시 저장 훅이 없다.
2. 저장 실패를 사용자에게 알려주지 않는다.
3. 백업/export/import가 없어 저장 데이터 복구가 어렵다.

따라서 Step 3 모듈 분리로 바로 가기보다, Step 2-23에서 저장 안정화 1차 패치를 먼저 진행하는 것을 권장한다.

## 다음 작업 제안

### Step 2-23: 저장 안정화 1차

- `pagehide` 저장 추가
- `visibilitychange` hidden 저장 추가
- `beforeunload` 보조 저장 추가
- `save(true)` 성공/실패 반환
- 강제 저장 버튼에서 실패 토스트 처리
- node --check 검증
- 보고서 생성

### Step 2-24: 백업 저장

- `SAVE_BACKUP_KEY` 추가
- 저장 전 기존 데이터 backup
- load 실패 시 backup 복구 시도

### Step 2-25: 수동 백업/export/import

- 설정 모달 UI 확장
- JSON 파일 또는 텍스트 기반 저장 데이터 내보내기/가져오기
