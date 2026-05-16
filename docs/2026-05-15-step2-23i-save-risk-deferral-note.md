# Step 2-23I 저장 안정화 미실행 리스크 보류 각주

작성일: 2026-05-15

## 1. 현재 판단

Step 2-23 저장 안정화 1차는 아직 실제 코드에 반영되지 않았다.

확인 결과:

- `Add save lifecycle stability hooks` 커밋 없음
- `docs/2026-05-15-step2-23-save-stability-phase1.md` 없음
- `js/main.js`에 `bindSaveLifecycleEvents` 없음
- `js/main.js`에 `console.error("[save] failed", e);` 없음
- `js/main.js`에 저장 실패 토스트 없음

다만 사용자가 현재 GitHub Actions / Codespaces / 로컬 실행을 진행할 수 없는 상황이므로, Step 2-23은 **최우선 미완료 리스크**로 남기고 다음 준비 단계로 이동한다.

## 2. 현재 저장 구조 요약

현 단계 게임 저장은 기본적으로 `localStorage` 기반이다.

현재 가능한 것:

- 기본 저장 가능
- autosave 존재
- 강제 저장 버튼 존재
- legacy `beforeunload` 저장 훅 일부 존재

현재 부족한 것:

- `save(true)` 성공/실패 boolean 반환 없음
- localStorage 저장 실패 감지 없음
- 저장 실패 시 사용자 알림 없음
- `pagehide` 저장 훅 없음
- `visibilitychange` 저장 훅 없음
- backup save key 없음
- export/import 없음

## 3. 실행 확인 없이 넘어갈 때의 문제

Step 2-23을 실제 실행하지 않고 다음 단계로 넘어가면 다음 문제가 남는다.

### 3-1. 저장 실패를 감지하지 못함[^1]

현재 `localStorage.setItem()` 실패 시 catch가 비어 있다. 브라우저 저장 공간 부족, private mode 제한, localStorage 접근 실패가 발생해도 사용자는 알 수 없다.

### 3-2. 강제 저장 버튼 신뢰도가 낮음[^2]

강제 저장 버튼이 `save(true)` 실패 여부를 확인하지 못하면, 실제 저장이 실패했는데도 사용자는 저장이 완료됐다고 오해할 수 있다.

### 3-3. 모바일 백그라운드 전환 저장이 불안정함[^3]

현재 `visibilitychange` 저장 훅이 없기 때문에 모바일 브라우저에서 앱 전환, 화면 잠금, 브라우저 백그라운드 전환 시 마지막 진행 데이터가 저장되지 않을 수 있다.

### 3-4. page lifecycle 저장이 부족함[^4]

`pagehide` 저장 훅이 없으면 브라우저 page cache, 모바일 사파리, 탭 전환 환경에서 종료 직전 저장이 누락될 수 있다.

### 3-5. 백업 저장을 적용하기 전에 기반 save 함수가 불안정함[^5]

Step 2-24 backup key/save recovery는 `save(true)` 성공/실패 반환을 전제로 설계되어 있다. Step 2-23이 미반영이면 backup 저장 실패/성공 판단이 모호하다.

### 3-6. 테스트 결과 해석이 어려워짐[^6]

Step 3 모듈 분리나 Step 2-24 실제 적용 이후 저장 문제가 발생하면, 원인이 기존 저장 구조인지 새 변경인지 구분하기 어려워진다.

## 4. 보류 각주

[^1]: 저장 실패 감지 미반영. localStorage quota 초과, private mode, 브라우저 정책 제한 시 저장 실패를 감지하지 못한다.
[^2]: 강제 저장 버튼 신뢰도 문제. 저장 실패 상황에서도 성공 토스트가 표시될 수 있다.
[^3]: 모바일 백그라운드 전환 리스크. `visibilitychange` 훅이 없어 앱 전환/화면 잠금 시 저장 누락 가능성이 있다.
[^4]: page lifecycle 리스크. `pagehide` 훅이 없어 일부 브라우저 종료/이탈 흐름에서 저장이 누락될 수 있다.
[^5]: Step 2-24 선행 조건 미충족. backup key/save recovery 실제 적용 전 `save(true)` boolean 반환 구조가 필요하다.
[^6]: 회귀 분석 난이도 증가. 저장 안정화 전 다른 구조 변경을 진행하면 저장 손실 원인 추적이 어려워진다.

## 5. 다음 단계 진행 원칙

Step 2-23이 미반영인 상태에서 다음 단계로 이동하되, 실제 저장 코드 변경은 신중히 제한한다.

허용:

- Step 2-24 적용 스크립트 초안 작성
- Step 2-24 검증 시나리오 작성
- Step 2-24 실행 전 체크리스트 작성
- 브라우저 저장 QA 문서 보강

보류:

- Step 2-24 실제 js/main.js 코드 적용
- Step 3 모듈 분리
- export/import UI 추가
- save/load 대규모 개편

## 6. 다음 진행 방향

다음 단계는 `Step 2-24A`로 정의한다.

목표:

- backup key/save recovery 실제 적용 전 준비 단계
- `scripts/apply-step2-24-save-backup-recovery.py` 초안 작성
- 단, Step 2-23 미반영 상태에서는 실행하지 않도록 preflight guard를 둔다.
- Step 2-23 완료 여부를 먼저 검사하고, 미완료면 실패하도록 한다.

즉, Step 2-24A는 실제 저장 구조 변경이 아니라 **안전 적용 스크립트 준비 단계**다.

## 7. 결론

Step 2-23 미반영 상태는 최상위 리스크로 유지한다.

사용자가 현재 실행할 수 없는 상황이므로, 다음 단계는 실제 저장 구조 변경이 아니라 Step 2-24 backup/recovery 적용 준비로 제한한다.

Step 2-23 실제 반영 전까지 Step 2-24 스크립트는 실행되어서는 안 된다.
