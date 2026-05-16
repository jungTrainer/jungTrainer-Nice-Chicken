# Step 2-24B 백업 저장/복구 적용 스크립트 보고

작성일: 2026-05-15

## 1. 목적

Step 2-23 저장 안정화 1차가 아직 실제 반영 확인되지 않은 상태지만, 다음 단계 진행 속도를 위해 Step 2-24 backup key/save recovery 실제 적용용 스크립트를 준비했다.

단, 이 스크립트는 Step 2-23 완료 조건이 충족되지 않으면 실행 즉시 실패하며, `js/main.js`를 수정하지 않는다.

## 2. 생성 파일

```text
scripts/apply-step2-24b-save-backup-recovery.py
```

## 3. 핵심 원칙

- Step 2-23 완료 전에는 backup/recovery 패치를 적용하지 않는다.
- `js/main.js` 전체를 임의 재작성하지 않는다.
- `index.html`은 수정하지 않는다.
- `SAVE_KEY`는 유지한다.
- `SAVE_BACKUP_KEY`는 `SAVE_KEY + "_backup"` 방식으로 추가한다.
- export/import는 이번 단계에서 제외한다.
- cloud save는 이번 단계에서 제외한다.

## 4. preflight guard 조건

스크립트는 실행 직후 아래 Step 2-23 marker를 검사한다.

| 조건 | 기대 개수 |
|---|---:|
| `function save(force=false)` | 1 |
| `if(!force){ _saveDirty = true; return true; }` | 1 |
| `console.error("[save] failed", e);` | 1 |
| `function bindSaveLifecycleEvents()` | 1 |
| `window.addEventListener("pagehide"` | 1 |
| `document.addEventListener("visibilitychange"` | 1 |
| `window.addEventListener("beforeunload"` | 1 |
| `const ok = save(true);` | 1 |
| `.onclick =` | 0 |
| `function safeClick` | 0 |
| 실제 `safeClick(` 호출 | 0 |

위 조건이 하나라도 맞지 않으면 `[FAIL]`을 출력하고 종료한다.

## 5. 실제 적용 목표

preflight 통과 후에는 다음을 적용하도록 설계했다.

### 5-1. 백업 저장 키 추가

```js
const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";
```

### 5-2. save(true) 백업 저장 흐름 추가

현재 primary 저장본을 먼저 읽고, 존재하면 backup key에 보존한 뒤 새 primary를 저장한다.

```js
const prevSave = localStorage.getItem(SAVE_KEY);
if(prevSave){
  try{
    localStorage.setItem(SAVE_BACKUP_KEY, prevSave);
  }catch(backupError){
    console.warn("[save] backup failed", backupError);
  }
}
localStorage.setItem(SAVE_KEY, JSON.stringify(state));
```

### 5-3. readSavePayload() 추가

primary 저장 데이터를 먼저 읽고, primary가 없거나 JSON parse에 실패하면 backup 저장 데이터를 시도한다.

복구 성공 시:

```js
console.warn("[load] restored from backup save");
```

primary 손상 시:

```js
console.error("[load] primary save corrupted", e);
```

backup 손상 시:

```js
console.error("[load] backup save corrupted", e);
```

## 6. 예상 변경 파일

스크립트가 실제 적용될 경우 예상 변경 파일은 다음이다.

```text
js/main.js
docs/2026-05-15-step2-24b-save-backup-recovery.md
```

## 7. 현재 상태에서의 실행 결과

현재 Step 2-23이 아직 미반영이므로, 이 스크립트는 실행하면 실패해야 정상이다.

예상 실패:

```text
[FAIL] Step 2-23 preflight failed; Step 2-24B patch is blocked.
```

이는 오류가 아니라 안전장치다.

## 8. Step 2-24B 실제 적용 조건

실제 적용은 아래가 확인된 후에만 진행한다.

1. `Add save lifecycle stability hooks` 커밋 존재
2. `docs/2026-05-15-step2-23-save-stability-phase1.md` 존재
3. Step 2-23 marker가 모두 `js/main.js`에 존재
4. `node --check js/main.js` 통과
5. inline `onclick=` 0개 유지
6. `.onclick =` 0개 유지
7. `function safeClick` 0개 유지

## 9. 남은 리스크

- Step 2-23이 미완료이면 Step 2-24B는 적용할 수 없다.
- backup 저장은 localStorage quota 초과 시 실패할 수 있다.
- export/import 수동 백업은 아직 없다.
- 실제 브라우저에서 primary 손상/backup 복구 테스트가 필요하다.

## 10. 다음 단계

1. Step 2-23 실제 반영
2. Step 2-23 검증
3. Step 2-24B 스크립트 실행
4. Step 2-24B 결과 검증
5. Step 2-25 export/import 수동 백업 기능 설계
