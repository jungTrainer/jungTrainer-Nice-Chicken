# Step 2-24A 백업 저장/복구 안전 적용 스크립트 계획

작성일: 2026-05-15

## 1. 목적

Step 2-24 backup key/save recovery 실제 적용 전에, Step 2-23 저장 안정화 1차 완료 여부를 검사하는 안전 스크립트 초안을 준비한다.

이번 단계에서는 `js/main.js` 실제 저장 구조를 변경하지 않는다.

## 2. 현재 상태

Step 2-23 저장 안정화 1차는 아직 실제 반영되지 않았다.

미반영 상태:

- `Add save lifecycle stability hooks` 커밋 없음
- `docs/2026-05-15-step2-23-save-stability-phase1.md` 없음
- `js/main.js`에 `bindSaveLifecycleEvents` 없음
- `js/main.js`에 `console.error("[save] failed", e);` 없음
- `js/main.js`에 저장 실패 토스트 없음

따라서 Step 2-24 backup key/save recovery 실제 코드 적용은 아직 보류한다.

## 3. 생성한 스크립트

```text
scripts/apply-step2-24-save-backup-recovery.py
```

이 스크립트는 Step 2-24 실제 적용 스크립트의 초안이다.

현재 단계에서는 실제 patch를 수행하지 않는다. 대신 Step 2-23 완료 여부를 먼저 확인하는 preflight guard만 포함한다.

## 4. preflight guard 조건

스크립트는 실행 즉시 `js/main.js`에서 다음 항목을 검사한다.

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
| `.onclick =` 직접 대입 | 0 |
| `function safeClick` | 0 |
| 실제 `safeClick(` 호출 | 0 |

위 조건 중 하나라도 맞지 않으면 스크립트는 `[FAIL]`을 출력하고 즉시 종료한다.

## 5. 실패 시 파일 미수정 보장

Step 2-24A 스크립트는 `verify_preflight()`를 통과하기 전까지 어떤 파일도 쓰지 않는다.

즉, Step 2-23이 미완료인 현재 상태에서 실행하면 다음과 같이 실패해야 정상이다.

```text
[FAIL] Step 2-23 preflight failed; backup/recovery patch is blocked.
```

이 실패는 오류가 아니라 안전장치다.

## 6. Step 2-24 실제 적용을 보류하는 이유

Step 2-24 backup key/save recovery는 다음 구조를 전제로 한다.

- `save(true)`가 성공/실패 boolean을 반환해야 한다.
- 저장 실패 시 `console.error`가 남아야 한다.
- 강제 저장 버튼이 `save(true)` 결과를 사용해야 한다.
- lifecycle 저장 훅이 최소한 정리되어 있어야 한다.

Step 2-23이 미반영인 상태에서 backup key를 추가하면 다음 문제가 생긴다.

1. backup 저장 성공/실패 판단이 모호하다.
2. primary 저장 실패와 backup 저장 실패를 구분하기 어렵다.
3. 사용자에게 저장 실패를 알릴 수 없다.
4. 이후 저장 문제 발생 시 Step 2-23 미반영 문제인지 Step 2-24 문제인지 구분하기 어렵다.

따라서 Step 2-24 실제 적용은 Step 2-23 완료 이후로 미룬다.

## 7. backup key/save recovery 적용 목표

Step 2-24B 이후 실제 적용 목표는 다음이다.

1. `SAVE_BACKUP_KEY` 추가
2. `save(true)`에서 현재 primary save를 backup key에 보존
3. 새 state를 primary key에 저장
4. primary 저장 실패 시 false 반환 유지
5. backup 저장 실패는 console.warn 또는 console.error로 기록
6. `load()`에서 primary JSON parse 실패 시 backup parse 시도
7. backup 복구 성공 시 console.warn 기록
8. primary/backup 모두 실패 시 `defaultState()` 흐름 유지

## 8. 실제 적용 시 예상 변경 범위

실제 Step 2-24B 적용 시 수정 예상 파일:

```text
js/main.js
docs/2026-05-15-step2-24b-save-backup-recovery.md
```

수정 예상 함수/상수:

- `SAVE_KEY` 인근에 `SAVE_BACKUP_KEY` 추가
- `save(force=false)` 내부 backup 저장 흐름 추가
- `load()` 내부 primary/backup parse fallback 추가

수정하지 않을 것:

- `index.html`
- export/import UI
- cloud save
- save/load 대규모 재설계
- Step 3 모듈 분리

## 9. Step 2-24B 진입 조건

Step 2-24B 실제 적용은 아래 조건이 모두 충족되어야 한다.

1. `Add save lifecycle stability hooks` 커밋 존재
2. `docs/2026-05-15-step2-23-save-stability-phase1.md` 존재
3. `save(true)` 성공/실패 boolean 반환 구조 존재
4. 저장 실패 `console.error("[save] failed", e);` 존재
5. `bindSaveLifecycleEvents()` 존재
6. `pagehide`, `visibilitychange`, `beforeunload` 저장 훅 존재
7. 강제 저장 버튼이 `const ok = save(true);`를 사용
8. `node --check js/main.js` 통과
9. inline `onclick=` 0개 유지
10. `.onclick =` 0개 유지
11. `function safeClick` 0개 유지

## 10. 결론

Step 2-24A는 실제 backup key/save recovery 적용 단계가 아니다.

이번 단계의 결과물은 다음 두 가지다.

1. Step 2-23 완료 여부를 검사하는 guarded script
2. Step 2-24B 실제 적용 전 체크리스트와 계획 문서

현재 Step 2-23이 미완료이므로, `scripts/apply-step2-24-save-backup-recovery.py`는 실행 시 실패해야 정상이다.

Step 2-23이 완료된 뒤에만 Step 2-24B에서 실제 backup/recovery 코드를 적용한다.
