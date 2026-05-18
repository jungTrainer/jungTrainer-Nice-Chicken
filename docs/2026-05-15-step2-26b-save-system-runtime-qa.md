# Step 2-26B 저장 시스템 브라우저 런타임 QA 체크리스트

작성일: 2026-05-15

## 0. 현재 상태

저장 시스템은 다음 단계까지 실제 코드 반영이 완료됐다.

- Step 2-23 저장 안정화 1차 완료
  - 커밋: `3b99ccc3be7e23fdca62b79e206670528b1c8f98`
- Step 2-24B backup key / save recovery 완료
  - 커밋: `2a1a44f63d93ed68fad1d12813cfb5cb0192f211`
- Step 2-25B manual export/import 완료
  - 커밋: `8178c673485fbf456861a6578673ae939611f055`

현재 기능 코드 변경 없이 브라우저에서 저장 안정성을 확인해야 한다.

## 1. QA 목적

이 문서의 목적은 localStorage 기반 저장 시스템이 실제 브라우저 환경에서 안정적으로 동작하는지 확인하는 것이다.

중점 확인 항목은 다음과 같다.

1. 일반 저장이 정상 동작하는지
2. 강제 저장 버튼이 성공/실패를 올바르게 안내하는지
3. 탭 닫기, 백그라운드 전환, 새로고침 시 저장이 유지되는지
4. primary save가 손상되었을 때 backup save로 복구되는지
5. backup까지 손상되었을 때 안전하게 default fallback 되는지
6. manual export/import가 사용자 백업 수단으로 동작하는지
7. 잘못된 JSON 또는 다른 게임 데이터가 거부되는지
8. 모바일 브라우저에서 복사/붙여넣기 UX가 허용 가능한지

## 2. 테스트 전 준비

### 2.1 최신 main 반영

Codespaces 또는 로컬에서 다음을 확인한다.

```bash
git checkout main
git pull origin main
git log -5 --oneline
```

아래 커밋들이 포함되어 있어야 한다.

```text
8178c67 Add manual save export import
2a1a44f Add save backup recovery flow
3b99ccc Add save lifecycle stability hooks
1840753 Repair utility helpers core split
```

### 2.2 문법 확인

```bash
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/main.js
```

### 2.3 이벤트 리팩터링 유지 확인

```bash
grep -R -n ' onclick=' index.html js/main.js
grep -n '\.onclick[[:space:]]*=' js/main.js
grep -n 'function safeClick' js/main.js
grep -n 'safeClick(' js/main.js
```

정상 기준: 아무 출력이 없어야 한다.

## 3. localStorage 확인 방법

브라우저에서 게임을 연 뒤 개발자도구를 연다.

- Chrome / Edge: `F12` 또는 `Ctrl + Shift + I`
- Application 탭
- Storage > Local Storage
- 현재 사이트 주소 선택

확인할 키:

```text
niceChicken_idleServe_vFinal
niceChicken_idleServe_vFinal_backup
```

콘솔에서 직접 확인할 수도 있다.

```js
localStorage.getItem("niceChicken_idleServe_vFinal")
localStorage.getItem("niceChicken_idleServe_vFinal_backup")
```

## 4. 정상 저장 테스트

| ID | 테스트 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| SAVE-001 | 기본 진행 저장 | 게임에서 돈/레벨/업그레이드 등 상태를 조금 변경 | 화면 상태가 변경됨 | CHECK |
| SAVE-002 | 새로고침 유지 | 상태 변경 후 새로고침 | 변경된 상태가 유지됨 | CHECK |
| SAVE-003 | localStorage primary 생성 | Application 탭에서 `niceChicken_idleServe_vFinal` 확인 | JSON 문자열 존재 | CHECK |
| SAVE-004 | 저장 JSON parse | Console에서 `JSON.parse(localStorage.getItem("niceChicken_idleServe_vFinal"))` 실행 | 에러 없이 객체 출력 | CHECK |

## 5. 강제 저장 버튼 테스트

| ID | 테스트 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| FORCE-001 | 강제 저장 버튼 | 설정 모달 열기 → 저장 버튼 클릭 | `저장 완료` 토스트 표시 | CHECK |
| FORCE-002 | 강제 저장 후 primary 갱신 | 저장 버튼 클릭 후 localStorage primary 확인 | `lastSeenAt` 또는 상태값이 최신화 | CHECK |
| FORCE-003 | 저장 실패 안내 | 저장 공간 실패를 강제 재현하기 어려우면 수동 확인 생략 | 실패 시 `저장 실패! 브라우저 저장 공간을 확인하세요.` 표시 | N/A |

## 6. pagehide / visibilitychange / beforeunload 저장 테스트

| ID | 테스트 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| LIFE-001 | 새로고침 저장 | 상태 변경 → 즉시 새로고침 | 상태 유지 | CHECK |
| LIFE-002 | 탭 닫기 저장 | 상태 변경 → 탭 닫기 → 다시 접속 | 상태 유지 | CHECK |
| LIFE-003 | 백그라운드 전환 저장 | 모바일/PC에서 다른 탭으로 전환 후 복귀 | 상태 유지 | CHECK |
| LIFE-004 | beforeunload 저장 | 상태 변경 직후 브라우저 새로고침 | 상태 유지 | CHECK |

주의: 일부 모바일 브라우저는 `beforeunload`를 보장하지 않는다. 이 때문에 `pagehide`와 `visibilitychange`도 함께 확인한다.

## 7. primary save corrupt 테스트

테스트 전 기존 저장을 export로 백업한다.

### 절차

1. 설정 모달에서 백업 만들기 실행
2. 생성된 JSON을 별도 메모장에 복사
3. DevTools Console에서 primary 저장값을 고의로 손상

```js
localStorage.setItem("niceChicken_idleServe_vFinal", "{ broken json")
location.reload()
```

### 기대 결과

- 콘솔에 `[load] primary save corrupted` 로그가 출력된다.
- backup key가 정상이라면 backup에서 복구된다.
- 게임이 완전히 멈추거나 흰 화면이 되면 실패다.

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| CORRUPT-001 | primary JSON 손상 | primary parse 실패 로그 | CHECK |
| CORRUPT-002 | primary 손상 후 로드 | backup 복구 시도 | CHECK |
| CORRUPT-003 | 화면 안정성 | 흰 화면/치명 에러 없음 | CHECK |

## 8. backup recovery 테스트

### 절차

1. 정상 상태에서 강제 저장
2. localStorage에 backup key가 있는지 확인
3. primary key를 손상
4. 새로고침

```js
localStorage.setItem("niceChicken_idleServe_vFinal", "{ broken json")
location.reload()
```

### 기대 결과

- backup이 정상 JSON이면 게임 상태가 복구된다.
- 콘솔에 `[load] restored from backup save` warning이 출력된다.

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| BACKUP-001 | backup key 존재 | `_backup` key 존재 | CHECK |
| BACKUP-002 | backup 복구 | primary 손상 후 backup으로 로드 | CHECK |
| BACKUP-003 | 복구 로그 | `[load] restored from backup save` 확인 | CHECK |

## 9. backup도 corrupt인 경우 fallback 테스트

테스트 전 export JSON을 반드시 별도 보관한다.

### 절차

```js
localStorage.setItem("niceChicken_idleServe_vFinal", "{ broken primary")
localStorage.setItem("niceChicken_idleServe_vFinal_backup", "{ broken backup")
location.reload()
```

### 기대 결과

- primary corrupted 로그 출력
- backup corrupted 로그 출력
- 게임은 defaultState 기반으로 시작되거나 안전하게 초기화된다.
- 흰 화면/무한 에러가 없어야 한다.

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| FALLBACK-001 | primary + backup 손상 | 양쪽 parse 실패 로그 | CHECK |
| FALLBACK-002 | fallback | 게임이 안전하게 기본 상태로 진입 | CHECK |
| FALLBACK-003 | 복구 가능성 | export JSON으로 다시 import 가능 | CHECK |

## 10. manual export 테스트

| ID | 테스트 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| EXPORT-001 | UI 표시 | 설정 모달 열기 | `수동 백업 / 불러오기` 카드 표시 | CHECK |
| EXPORT-002 | 백업 만들기 | `백업 만들기` 클릭 | textarea에 JSON 생성 | CHECK |
| EXPORT-003 | JSON 구조 | 생성 JSON 확인 | `app`, `type`, `version`, `saveKey`, `exportedAt`, `data` 포함 | CHECK |
| EXPORT-004 | JSON parse | textarea 내용을 Console에서 JSON.parse | 에러 없음 | CHECK |
| EXPORT-005 | 복사 버튼 | `복사` 클릭 | 복사 성공 토스트 또는 직접 복사 안내 | CHECK |

## 11. manual import 테스트

### 정상 import 절차

1. 설정 모달 열기
2. 백업 만들기
3. textarea 전체 복사
4. 내용 지우기
5. 복사한 JSON 다시 붙여넣기
6. 백업 불러오기 클릭
7. confirm 확인

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| IMPORT-001 | 정상 JSON import | confirm 표시 | CHECK |
| IMPORT-002 | import 성공 | `백업 불러오기 완료` 토스트 | CHECK |
| IMPORT-003 | UI 갱신 | 돈/레벨/업그레이드 상태 갱신 | CHECK |
| IMPORT-004 | 저장 확인 | 새로고침 후 import 상태 유지 | CHECK |

## 12. 잘못된 JSON 거부 테스트

textarea에 아래를 입력하고 백업 불러오기를 누른다.

```text
{ broken json
```

기대 결과:

- `백업 JSON 형식이 올바르지 않아요.` 토스트
- 기존 state 유지
- 콘솔에 `[save-import] invalid json`

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| BADJSON-001 | 잘못된 JSON 입력 | 거부 토스트 표시 | CHECK |
| BADJSON-002 | 기존 상태 유지 | 돈/레벨 변동 없음 | CHECK |

## 13. 다른 게임 데이터 거부 테스트

textarea에 아래 JSON을 입력한다.

```json
{"app":"otherGame","data":{"coin":999}}
```

기대 결과:

- `나이스치킨 저장 데이터가 아닌 것 같아요.` 토스트
- 기존 state 유지

| ID | 테스트 | 기대 결과 | 결과 |
|---|---|---|---|
| OTHER-001 | 타 게임 JSON 입력 | 거부 토스트 표시 | CHECK |
| OTHER-002 | 기존 상태 유지 | 기존 저장 유지 | CHECK |

## 14. 모바일 clipboard 테스트

대상 브라우저:

- iOS Safari
- Android Chrome

| ID | 테스트 | 절차 | 기대 결과 | 결과 |
|---|---|---|---|---|
| MOBILE-001 | 모바일 export | 백업 만들기 | textarea에 JSON 생성 | CHECK |
| MOBILE-002 | 모바일 복사 | 복사 버튼 클릭 | 복사 성공 또는 직접 선택 안내 | CHECK |
| MOBILE-003 | 모바일 붙여넣기 | textarea에 붙여넣기 | JSON 입력 가능 | CHECK |
| MOBILE-004 | 모바일 import | 백업 불러오기 | confirm 후 복구 | CHECK |

## 15. PASS / FAIL / CHECK / N/A 기록표

| 상태 | 의미 |
|---|---|
| PASS | 실제 테스트 완료, 기대 결과와 일치 |
| FAIL | 실제 테스트 완료, 기대 결과와 다름 |
| CHECK | 아직 테스트 전 또는 확인 필요 |
| N/A | 현재 환경에서 테스트 불가 |

## 16. 전체 테스트 기록표

| 구분 | ID | 상태 | 테스트자 | 브라우저/기기 | 메모 |
|---|---|---|---|---|---|
| 정상 저장 | SAVE-001 | CHECK |  |  |  |
| 정상 저장 | SAVE-002 | CHECK |  |  |  |
| 강제 저장 | FORCE-001 | CHECK |  |  |  |
| lifecycle | LIFE-001 | CHECK |  |  |  |
| lifecycle | LIFE-002 | CHECK |  |  |  |
| primary corrupt | CORRUPT-001 | CHECK |  |  |  |
| backup recovery | BACKUP-001 | CHECK |  |  |  |
| fallback | FALLBACK-001 | CHECK |  |  |  |
| export | EXPORT-001 | CHECK |  |  |  |
| export | EXPORT-002 | CHECK |  |  |  |
| import | IMPORT-001 | CHECK |  |  |  |
| bad JSON | BADJSON-001 | CHECK |  |  |  |
| other data | OTHER-001 | CHECK |  |  |  |
| mobile | MOBILE-001 | CHECK |  |  |  |

## 17. 버그 발생 시 기록 양식

```text
버그 ID:
발견 일시:
테스트 항목 ID:
브라우저/기기:
재현 절차:
기대 결과:
실제 결과:
콘솔 에러:
localStorage 상태:
스크린샷/메모:
심각도: 높음 / 중간 / 낮음
```

## 18. Step 3-4 config.js 분리 진입 조건

Step 3-4 config.js 분리는 다음 조건을 만족하면 진행한다.

1. `node --check js/main.js` 통과
2. 설정 모달 export/import UI가 표시됨
3. 백업 만들기 기능 PASS
4. 잘못된 JSON 거부 PASS
5. 정상 import PASS
6. primary corrupt 후 backup recovery 최소 1회 PASS
7. inline `onclick=` 0개 유지
8. `.onclick =` 직접 대입 0개 유지
9. `function safeClick` 0개 유지
10. 브라우저 콘솔에 치명 에러 없음

## 19. 결론

저장 안정화, backup recovery, manual export/import가 모두 코드에 반영된 상태다.
다음 단계는 실제 브라우저 QA이며, PASS 결과가 충분하면 Step 3-4 config.js 분리로 진입할 수 있다.
