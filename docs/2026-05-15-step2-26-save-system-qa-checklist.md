# Step 2-26 저장 시스템 QA 체크리스트 및 테스트 기록표

작성일: 2026-05-15

## 0. 중요 저장 리스크

현재 Step 2-23, Step 2-24B, Step 2-25는 실제 코드 적용 전이거나 설계/스크립트 준비 단계다.

따라서 이 문서는 현재 코드가 이미 모든 저장 안정화 기능을 제공한다는 의미가 아니다. 이후 저장 안정화/백업/수동 export-import 기능이 실제 반영된 뒤 사용할 QA 기준과 기록표다.

현재 미반영 리스크:

- Step 2-23 저장 안정화 1차 실제 반영 미완료
- Step 2-24B backup key/save recovery 실제 반영 미완료
- Step 2-25 export/import 실제 구현 미완료
- 저장 실패 감지와 사용자 안내 미완료
- backup save key 미반영
- 수동 백업/복원 기능 미구현

## 1. 저장 QA 목적

저장 QA의 목적은 사용자의 플레이 진행 데이터가 다양한 브라우저/기기/종료 상황에서도 가능한 한 안전하게 보존되는지 확인하는 것이다.

특히 idle/incremental 계열 게임은 사용자가 장시간 누적한 데이터가 핵심 가치이므로, 저장 실패는 단순 버그가 아니라 신뢰도 손상으로 이어진다.

QA 목표:

1. 정상 저장 확인
2. 저장 실패 감지 확인
3. 종료/백그라운드 전환 저장 확인
4. primary 저장 손상 시 backup 복구 확인
5. export/import 수동 백업 확인
6. 브라우저별 저장 동작 차이 확인
7. 저장 실패/복구 실패 시 사용자 안내 확인

## 2. 테스트 상태 표기 기준

| 상태 | 의미 |
|---|---|
| PASS | 기대 결과와 일치 |
| FAIL | 기대 결과와 다름 |
| CHECK | 추가 확인 필요 |
| N/A | 현재 단계에서 적용 대상 아님 |

## 3. Step 2-23 저장 안정화 1차 QA 항목

Step 2-23 적용 후 확인한다.

| ID | 항목 | 테스트 방법 | 기대 결과 | 상태 | 비고 |
|---|---|---|---|---|---|
| S23-01 | `save(true)` 성공 반환 | 콘솔/코드에서 `save(true)` 실행 | 저장 성공 시 `true` 반환 | CHECK | |
| S23-02 | `save(false)` dirty flag | `save(false)` 호출 | `_saveDirty = true`, 반환값 `true` | CHECK | |
| S23-03 | 저장 실패 console.error | localStorage setItem 실패를 mock 또는 quota 초과로 유도 | `console.error("[save] failed", e)` 출력 | CHECK | |
| S23-04 | 강제 저장 성공 토스트 | 저장 버튼 클릭 | `저장 완료` 표시 | CHECK | |
| S23-05 | 강제 저장 실패 토스트 | 저장 실패 유도 후 저장 버튼 클릭 | `저장 실패! 브라우저 저장 공간을 확인하세요.` 표시 | CHECK | |
| S23-06 | pagehide 저장 | 페이지 이탈/모바일 앱 전환 유사 상황 | `save(true)` 호출 | CHECK | |
| S23-07 | visibilitychange 저장 | 탭 백그라운드 전환 | hidden 상태에서 `save(true)` 호출 | CHECK | |
| S23-08 | beforeunload 저장 | 새로고침/탭 닫기 | `save(true)` 호출 | CHECK | |
| S23-09 | legacy beforeunload 중복 없음 | 코드 검색 | beforeunload 저장 훅 1개 | CHECK | |
| S23-10 | node 문법 검사 | `node --check js/main.js` | 통과 | CHECK | |

## 4. Step 2-24B backup key/save recovery QA 항목

Step 2-24B 적용 후 확인한다.

| ID | 항목 | 테스트 방법 | 기대 결과 | 상태 | 비고 |
|---|---|---|---|---|---|
| S24-01 | `SAVE_BACKUP_KEY` 생성 | 코드 검색 | `SAVE_BACKUP_KEY = SAVE_KEY + "_backup"` 존재 | CHECK | |
| S24-02 | primary 저장 전 backup 보존 | 기존 저장 후 새 저장 실행 | 이전 primary가 backup key에 저장 | CHECK | |
| S24-03 | backup 저장 실패 로그 | backup setItem 실패 유도 | `[save] backup failed` warning 출력 | CHECK | |
| S24-04 | primary 정상 load | 정상 primary 저장 후 새로고침 | primary 데이터로 복구 | CHECK | |
| S24-05 | primary JSON 손상 | localStorage primary 값을 깨진 JSON으로 수정 | backup 복구 시도 | CHECK | |
| S24-06 | backup 복구 성공 | primary 손상, backup 정상 | backup 데이터로 복구 및 warning 출력 | CHECK | |
| S24-07 | backup도 손상 | primary/backup 모두 깨진 JSON | defaultState fallback | CHECK | |
| S24-08 | backup key 없음 | primary 손상, backup 없음 | defaultState fallback 또는 안전 시작 | CHECK | |
| S24-09 | 기존 sanitize 유지 | 누락 필드가 있는 저장 데이터 load | 기본값 보정 | CHECK | |
| S24-10 | node 문법 검사 | `node --check js/main.js` | 통과 | CHECK | |

## 5. Step 2-25 export/import QA 항목

export/import 실제 구현 후 확인한다.

| ID | 항목 | 테스트 방법 | 기대 결과 | 상태 | 비고 |
|---|---|---|---|---|---|
| S25-01 | export JSON 생성 | 저장 내보내기 실행 | JSON 생성 | CHECK | |
| S25-02 | export wrapper 확인 | export JSON 확인 | `game`, `schema`, `version`, `state` 포함 | CHECK | |
| S25-03 | export 복사 | 복사 버튼 클릭 | 클립보드 복사 또는 수동 복사 안내 | CHECK | |
| S25-04 | 정상 import | 정상 export JSON 붙여넣기 | state 복구 | CHECK | |
| S25-05 | import 후 저장 | import 완료 후 새로고침 | 가져온 상태 유지 | CHECK | |
| S25-06 | 잘못된 JSON 거부 | `{ broken json` 입력 | 기존 state 유지, 오류 안내 | CHECK | |
| S25-07 | 다른 게임 데이터 거부 | `game: other-game` 입력 | import 중단 | CHECK | |
| S25-08 | 구버전 데이터 처리 | version 낮은 데이터 입력 | 경고/보정 처리 | CHECK | |
| S25-09 | import 취소 | 확인 팝업에서 취소 | 기존 state 유지 | CHECK | |
| S25-10 | import 전 백업 안내 | import 전 확인 | 현재 저장 백업 권장 문구 표시 | CHECK | |
| S25-11 | 모바일 붙여넣기 | 모바일에서 textarea 입력 | 화면 깨짐 없이 붙여넣기 가능 | CHECK | |
| S25-12 | 긴 JSON 스크롤 | 긴 export 데이터 표시 | textarea 또는 영역 스크롤 가능 | CHECK | |

## 6. 브라우저별 테스트 매트릭스

| 브라우저/환경 | 페이지 로드 | 저장 버튼 | 새로고침 복구 | 탭 닫기 복구 | 백그라운드 복구 | backup 복구 | export/import | 콘솔 에러 |
|---|---|---|---|---|---|---|---|---|
| Chrome desktop | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK |
| Edge desktop | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK |
| Safari iOS | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK |
| Android Chrome | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK | CHECK |

## 7. localStorage 테스트 방법

Chrome/Edge 기준:

1. DevTools 열기
2. Application 탭 이동
3. Storage > Local Storage 선택
4. 배포 URL 선택
5. `niceChicken_idleServe_vFinal` 확인
6. Step 2-24B 이후 `niceChicken_idleServe_vFinal_backup` 확인

테스트 명령 예시:

```js
localStorage.getItem("niceChicken_idleServe_vFinal")
localStorage.getItem("niceChicken_idleServe_vFinal_backup")
```

primary 손상 테스트:

```js
localStorage.setItem("niceChicken_idleServe_vFinal", "{ broken json")
location.reload()
```

backup 손상 테스트:

```js
localStorage.setItem("niceChicken_idleServe_vFinal_backup", "{ broken backup")
location.reload()
```

주의:

- 실제 사용자 저장이 있는 환경에서 손상 테스트를 하면 데이터가 손실될 수 있다.
- 테스트 전 export 또는 localStorage 복사로 백업해야 한다.

## 8. 강제 종료/백그라운드 전환 테스트 방법

### 8-1. 새로고침 테스트

1. 게임에서 돈/레벨/상태 변경
2. 강제 저장 버튼 클릭
3. 새로고침
4. 상태 유지 확인

### 8-2. 탭 닫기 테스트

1. 상태 변경
2. 강제 저장 버튼을 누르지 않음
3. 탭 닫기
4. 같은 URL 재접속
5. 상태 유지 확인

### 8-3. 모바일 백그라운드 테스트

1. 모바일 브라우저에서 게임 실행
2. 상태 변경
3. 홈 화면으로 이동
4. 10~30초 대기
5. 브라우저 재진입
6. 새로고침 후 상태 확인

### 8-4. 강제 종료 테스트

1. 상태 변경
2. 앱 스위처에서 브라우저 강제 종료
3. 브라우저 재실행
4. 게임 접속
5. 마지막 저장 시점 확인

주의:

- 강제 종료는 브라우저 이벤트가 호출되지 않을 수 있다.
- 마지막 autosave 이후 데이터 손실 가능성이 있다.
- 이 테스트는 PASS/FAIL보다 손실 범위를 기록하는 것이 중요하다.

## 9. 종합 QA 기록표

| 테스트 ID | 기능 영역 | 브라우저 | 사전 조건 | 수행 내용 | 기대 결과 | 실제 결과 | 상태 | 담당자 | 날짜 | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|
| QA-001 | 저장 안정화 | Chrome desktop | Step 2-23 적용 | 강제 저장 | 성공 토스트 |  | CHECK |  |  |  |
| QA-002 | 저장 안정화 | Chrome desktop | Step 2-23 적용 | 저장 실패 유도 | 실패 토스트 |  | CHECK |  |  |  |
| QA-003 | lifecycle | Safari iOS | Step 2-23 적용 | 백그라운드 전환 | 상태 유지 |  | CHECK |  |  |  |
| QA-004 | backup | Chrome desktop | Step 2-24B 적용 | primary 손상 | backup 복구 |  | CHECK |  |  |  |
| QA-005 | export | Chrome desktop | Step 2-25 구현 | 저장 내보내기 | JSON 생성 |  | CHECK |  |  |  |
| QA-006 | import | Chrome desktop | Step 2-25 구현 | 정상 JSON import | 상태 복구 |  | CHECK |  |  |  |
| QA-007 | import | Chrome desktop | Step 2-25 구현 | 잘못된 JSON import | 기존 state 유지 |  | CHECK |  |  |  |
| QA-008 | import | Android Chrome | Step 2-25 구현 | 모바일 붙여넣기 | 정상 import |  | CHECK |  |  |  |

## 10. 버그 발생 시 기록 양식

```text
버그 ID:
발견 날짜:
테스트 환경:
브라우저/OS:
관련 단계: Step 2-23 / Step 2-24B / Step 2-25
사전 조건:
재현 절차:
기대 결과:
실제 결과:
콘솔 로그:
localStorage 상태:
스크린샷/영상:
심각도: Critical / High / Medium / Low
임시 대응:
수정 필요 파일:
비고:
```

## 11. 심각도 기준

| 심각도 | 기준 |
|---|---|
| Critical | 저장 데이터 전체 손실, import 후 복구 불가, 앱 실행 불가 |
| High | 주요 진행 데이터 손실, backup 복구 실패, 저장 실패 미알림 |
| Medium | 특정 브라우저에서만 실패, UX 혼란, 경고 메시지 부족 |
| Low | 문구/레이아웃 문제, 콘솔 warning 수준 |

## 12. Step 2-27 진입 조건

Step 2-27은 저장 시스템 실제 구현 또는 최종 안정화 단계로 정의한다.

진입 조건:

1. Step 2-23 저장 안정화 1차 실제 반영
2. Step 2-24B backup key/save recovery 실제 반영
3. Step 2-25 export/import 실제 구현 또는 구현 범위 확정
4. `node --check js/main.js` 통과
5. Chrome desktop 기본 저장 QA 통과
6. 최소 1개 모바일 브라우저 백그라운드 저장 QA 수행
7. primary 손상/backup 복구 테스트 수행
8. 잘못된 JSON import 거부 테스트 수행

## 13. 결론

저장 시스템 QA는 Step 3 모듈 분리보다 우선순위가 높다.

Step 2-23/2-24B/2-25 실제 구현이 완료되면 이 문서를 기준으로 브라우저별 저장 안정성을 검증한다.

현재 단계에서는 실제 코드 변경 없이 QA 기준과 기록표만 준비했다.
