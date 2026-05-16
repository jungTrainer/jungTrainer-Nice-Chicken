# Step 2-24 저장 백업/복구 설계 문서

작성일: 2026-05-15

## 1. 목적

이 문서는 나이스치킨 저장 구조의 다음 개선 단계인 백업 저장/복구 구조를 설계하기 위한 문서다.

중요: 이 단계에서는 기능 코드를 변경하지 않는다. Step 2-23 저장 안정화 1차가 실제로 반영된 뒤에만 Step 2-24 실제 코드 적용을 진행한다.

## 2. 현재 저장 방식 요약

현재 저장 방식은 브라우저 `localStorage`에 전체 `state`를 JSON 문자열로 저장하는 구조다.

현재 primary save key는 다음과 같다.

```js
const SAVE_KEY = "niceChicken_idleServe_vFinal";
```

현재 저장 방식은 개념적으로 다음과 같다.

```js
localStorage.setItem(SAVE_KEY, JSON.stringify(state));
```

현재 불러오기 흐름은 다음과 같다.

1. `localStorage.getItem(SAVE_KEY)`로 저장 데이터를 읽는다.
2. JSON parse를 수행한다.
3. `defaultState()`와 저장 데이터를 병합한다.
4. 일부 중첩 객체를 보정한다.
5. `sanitizeState()`로 누락값/비정상 값을 정리한다.

현재 구조의 장점:

- 서버 없이 동작한다.
- 구현이 단순하다.
- `defaultState()`와 `sanitizeState()`가 있어 어느 정도 저장 데이터 호환성이 있다.
- 30초 autosave와 중요 액션 저장 흐름이 존재한다.

현재 구조의 한계:

- 저장 데이터가 단일 key에만 존재한다.
- primary 저장 데이터가 깨지면 복구가 어렵다.
- localStorage quota 초과나 private mode 저장 실패 대응이 약하다.
- export/import 기능은 아직 없다.

## 3. Step 2-23 반영 여부에 따른 분기

Step 2-24 실제 코드 적용은 Step 2-23 반영 여부에 따라 분기해야 한다.

### 3-1. Step 2-23이 반영된 경우

다음 조건을 만족하면 Step 2-24 실제 코드 적용으로 넘어갈 수 있다.

- `function save(force=false)`가 boolean을 반환한다.
- `save(false)`는 `_saveDirty = true` 설정 후 `true`를 반환한다.
- `save(true)`는 성공 시 `true`, 실패 시 `false`를 반환한다.
- 저장 실패 시 `console.error("[save] failed", e)`가 존재한다.
- `bindSaveLifecycleEvents()`가 존재한다.
- `pagehide`, `visibilitychange`, `beforeunload` 저장 훅이 존재한다.
- 강제 저장 버튼이 `save(true)` 결과에 따라 성공/실패 토스트를 분기한다.

이 경우 Step 2-24는 `save(true)` 내부에 backup 저장 흐름을 추가하는 방식이 가장 안전하다.

### 3-2. Step 2-23이 미반영인 경우

현재 상태처럼 Step 2-23 완료 커밋과 보고서가 없으면, Step 2-24 실제 코드 적용은 보류한다.

이유:

- `save(true)` 성공/실패 반환 구조가 아직 안정화되지 않았다.
- 저장 실패를 boolean으로 감지하지 못하면 backup 저장의 성공/실패도 구분하기 어렵다.
- lifecycle save hook이 미반영이면 백업 저장보다 우선순위가 높은 저장 손실 문제가 남는다.

따라서 Step 2-23 미반영 상태에서는 이 문서처럼 설계까지만 진행한다.

## 4. Primary save key 유지 방안

기존 저장 키는 반드시 유지한다.

```js
const SAVE_KEY = "niceChicken_idleServe_vFinal";
```

이유:

- 기존 사용자 저장 데이터와 호환되어야 한다.
- key를 바꾸면 기존 저장이 사라진 것처럼 보일 수 있다.
- migration 없이 key를 바꾸면 가장 큰 저장 손실 리스크가 발생한다.

따라서 Step 2-24에서는 primary key를 바꾸지 않는다.

## 5. Backup save key 추가 방안

새 backup key는 primary key에 suffix를 붙이는 방식을 권장한다.

```js
const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";
```

또는 명시적으로 다음처럼 둘 수도 있다.

```js
const SAVE_BACKUP_KEY = "niceChicken_idleServe_vFinal_backup";
```

권장안은 첫 번째 방식이다.

장점:

- primary key가 바뀌어도 backup key도 자동으로 따라간다.
- 코드 관리가 쉽다.
- backup key의 관계가 명확하다.

## 6. save(true) 성공 시 primary/backup 저장 순서

권장 저장 순서는 다음이다.

1. 현재 primary 저장본을 읽는다.
2. 현재 primary 저장본이 있으면 backup key에 먼저 저장한다.
3. 새 state를 primary key에 저장한다.
4. primary 저장 성공 시 true 반환한다.
5. 실패 시 console.error를 남기고 false 반환한다.

개념 코드:

```js
function save(force=false){
  if(!force){ _saveDirty = true; return true; }
  state.lastSeenAt = Date.now();
  try{
    const prev = localStorage.getItem(SAVE_KEY);
    if(prev) localStorage.setItem(SAVE_BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    _saveDirty = false;
    _lastSaveWriteAt = Date.now();
    return true;
  }catch(e){
    console.error("[save] failed", e);
    return false;
  }
}
```

### 왜 backup을 먼저 쓰는가?

새 primary 저장이 깨지거나 중간 실패가 발생해도, 직전 primary 저장본을 backup에 보존하기 위해서다.

### 주의점

localStorage quota가 거의 찬 상태라면 backup 저장이 먼저 실패할 수 있다. 이 경우 다음 중 하나를 선택해야 한다.

- backup 실패 시 primary 저장도 중단한다.
- backup 실패를 warning으로 남기고 primary 저장은 시도한다.

초기 구현에서는 “backup 실패 시에도 primary 저장은 시도”하는 쪽이 더 사용자 친화적이다. 단, backup 실패 로그는 남겨야 한다.

## 7. load()에서 primary 실패 시 backup 복구 흐름

권장 load 흐름은 다음이다.

1. primary key를 읽는다.
2. primary가 없으면 backup key를 읽는다.
3. primary가 있으면 JSON parse를 시도한다.
4. primary parse가 실패하면 backup parse를 시도한다.
5. backup parse가 성공하면 backup 데이터를 state에 적용한다.
6. backup 복구 성공 시 toast 또는 console.warn을 남긴다.
7. primary/backup 모두 실패하면 `defaultState()`로 시작한다.

개념 흐름:

```js
function readSaveData(){
  const primary = localStorage.getItem(SAVE_KEY);
  const backup = localStorage.getItem(SAVE_BACKUP_KEY);

  try{
    if(primary) return { data: JSON.parse(primary), source: "primary" };
  }catch(e){
    console.error("[load] primary save corrupted", e);
  }

  try{
    if(backup) return { data: JSON.parse(backup), source: "backup" };
  }catch(e){
    console.error("[load] backup save corrupted", e);
  }

  return null;
}
```

그리고 기존 `load()`는 `readSaveData()` 결과를 받아 기존 병합/보정 흐름으로 넘긴다.

## 8. Corrupted JSON 대응

저장 데이터가 깨지는 경우는 다음과 같다.

- localStorage 값이 수동으로 수정됨
- 저장 중 브라우저가 종료됨
- 구버전/신버전 데이터 형태가 예상과 다름
- 외부 스크립트/확장 프로그램 영향

대응 원칙:

1. JSON parse를 반드시 try/catch로 감싼다.
2. primary parse 실패 시 backup parse를 시도한다.
3. backup도 실패하면 기본 상태로 시작한다.
4. 복구 성공/실패는 console에 남긴다.
5. 사용자에게 너무 기술적인 에러를 보여주지 않는다.

권장 로그:

```js
console.error("[load] primary save corrupted", e);
console.warn("[load] restored from backup save");
console.error("[load] backup save corrupted", e);
```

## 9. localStorage quota 실패 대응

localStorage는 보통 5MB 내외 제한이 있다. 브라우저와 환경에 따라 다르며, private mode에서는 더 제한적일 수 있다.

대응 원칙:

1. `localStorage.setItem()`은 항상 try/catch로 감싼다.
2. backup 저장 실패와 primary 저장 실패를 구분해서 로그를 남긴다.
3. primary 저장 실패 시 `save(true)`는 false를 반환한다.
4. 강제 저장 버튼에서는 실패 토스트를 표시한다.

권장 메시지:

```text
저장 실패! 브라우저 저장 공간을 확인하세요.
```

추가로 나중에 export/import 기능이 들어가면, 저장 실패 시 export를 안내할 수 있다.

## 10. 사용자 export/import는 이번 단계에서 제외

Step 2-24에서는 export/import를 하지 않는다.

제외 이유:

- 설정 모달 UI 변경이 필요하다.
- 파일 다운로드/업로드 또는 텍스트 복사 UI가 필요하다.
- 저장 안정화 1차와 backup 복구 구조가 먼저 안정화되어야 한다.

export/import는 Step 2-25 또는 별도 Step 3 이전 안정화 단계로 분리하는 것이 좋다.

## 11. Step 2-24 실제 적용 전 체크리스트

Step 2-24 코드 적용 전에 아래를 확인한다.

| 체크 | 기준 |
|---|---|
| Step 2-23 반영 | `Add save lifecycle stability hooks` 커밋 존재 |
| Step 2-23 보고서 | `docs/2026-05-15-step2-23-save-stability-phase1.md` 존재 |
| save boolean 반환 | `save(true)` 성공/실패 반환 구조 존재 |
| 저장 실패 로그 | `console.error("[save] failed", e)` 존재 |
| lifecycle save hook | pagehide/visibilitychange/beforeunload 존재 |
| 강제 저장 실패 토스트 | 저장 실패 토스트 존재 |
| 이벤트 리팩터링 유지 | inline onclick=0, .onclick=0, safeClick=0 |
| JS 문법 검사 | `node --check js/main.js` 통과 |

위 조건이 충족되지 않으면 Step 2-24 실제 코드 적용은 보류한다.

## 12. Step 2-24 실제 적용 범위 제안

실제 코드 적용 시에는 다음만 한다.

1. `SAVE_BACKUP_KEY` 추가
2. `save(true)`에서 기존 primary를 backup으로 저장
3. primary 저장 실패 시 false 반환 유지
4. `load()`에서 primary parse 실패 시 backup parse 시도
5. backup 복구 성공 시 console.warn 기록
6. 보고서 생성

하지 말아야 할 것:

- export/import UI 추가
- cloud save 추가
- save data schema 대규모 변경
- `defaultState()` 구조 대규모 변경
- index.html 전체 수정

## 13. 결론

Step 2-23이 미반영인 현재 상태에서는 Step 2-24 실제 코드 적용을 진행하지 않는 것이 안전하다.

현재 권장 순서는 다음이다.

1. Step 2-23 직접 실행 또는 Actions 수동 실행으로 저장 안정화 1차 반영
2. Step 2-23 검증 완료
3. Step 2-24 backup key/save recovery 실제 적용
4. Step 2-25 export/import 수동 백업 기능 검토

이 문서는 Step 2-24 실제 적용 전 설계 기준으로 사용한다.
