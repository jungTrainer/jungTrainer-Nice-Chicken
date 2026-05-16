# Step 3-0 모듈 분리 설계 문서

작성일: 2026-05-15

## 0. 중요 저장 안정화 미완료 리스크

Step 2 이벤트 리팩터링은 완료됐지만, 저장 안정화 관련 실제 코드 반영은 아직 완료되지 않았다.

현재 미완료 리스크:

- Step 2-23 저장 안정화 1차 실제 반영 미완료
- Step 2-24B backup key/save recovery 실제 반영 미완료
- Step 2-25 export/import 실제 구현 미완료
- Step 2-26 저장 QA 체크리스트만 완료, 실제 브라우저 QA 미수행

따라서 이 문서는 Step 3 실제 모듈 분리를 시작하기 위한 실행 문서가 아니라, 향후 분리를 안전하게 진행하기 위한 설계 문서다.

현재 단계에서는 `js/main.js`와 `index.html`을 수정하지 않는다.

## 1. Step 3 목적

Step 3의 목적은 현재 `js/main.js`에 집중되어 있는 설정, 상태, 저장, 오디오, 게임 기능, 렌더링 코드를 기능별 모듈로 분리하는 것이다.

궁극적인 목표:

1. 코드 가독성 향상
2. 기능별 수정 범위 축소
3. 저장/메뉴/업그레이드/연구/지역/직원 로직 분리
4. 브라우저 런타임 회귀 추적 용이성 확보
5. 향후 테스트 자동화와 기능 확장 기반 마련

단, 저장 안정화가 완료되지 않은 상태에서 실제 분리를 진행하면 저장 회귀 추적이 어려워질 수 있으므로, 이번 단계에서는 설계만 진행한다.

## 2. Step 3 실제 착수 보류 사유

Step 3 실제 모듈 분리는 아직 보류한다.

보류 사유:

1. Step 2-23 저장 안정화 1차가 실제 반영되지 않았다.
2. `save(true)` 성공/실패 반환 구조가 아직 실제 코드에 없다.
3. 저장 실패 console/error 및 실패 토스트가 아직 실제 코드에 없다.
4. `pagehide`, `visibilitychange` 저장 훅이 아직 실제 코드에 없다.
5. Step 2-24B backup/recovery가 아직 적용되지 않았다.
6. 저장 QA가 문서 단계에 머물러 있다.
7. 모듈 분리 후 저장 문제가 발생하면 원인 범위가 커진다.

따라서 Step 3 실제 착수 전에는 저장 안정화 완료 여부를 다시 확인해야 한다.

## 3. 현재 js/main.js 분리 후보 영역

현재 `js/main.js`는 다음 성격의 코드가 혼재되어 있다.

### 3-1. 설정/상수 영역

분리 후보:

- 게임 설정값
- 메뉴/업그레이드/연구/지역/직원 정의 데이터
- 저장 키
- 밸런스 상수

권장 위치:

```text
js/core/config.js
```

### 3-2. 상태 관리 영역

분리 후보:

- `state`
- `defaultState()`
- `sanitizeState()`
- 상태 보정 로직
- 상태 초기화 흐름

권장 위치:

```text
js/core/state.js
```

### 3-3. 저장 영역

분리 후보:

- `SAVE_KEY`
- `save()`
- `saveGame()`
- `load()`
- autosave
- lifecycle save hook
- backup/recovery
- 향후 export/import

권장 위치:

```text
js/core/save.js
```

주의:

- 저장 안정화 Step 2-23/2-24B가 완료된 뒤 분리해야 한다.
- 가장 먼저 분리하면 리스크가 크다.

### 3-4. 오디오 영역

분리 후보:

- BGM
- 효과음
- `unlockAudioOnce()`
- `startBGM()`
- `sfxTick()`
- `sfxConfirm()`
- `sfxWrong()`

권장 위치:

```text
js/core/audio.js
```

### 3-5. 유틸리티 영역

분리 후보:

- 숫자 포맷
- DOM 안전 바인딩
- toast
- 공통 helper
- 확률/계산 helper

권장 위치:

```text
js/core/utils.js
```

### 3-6. 메뉴 기능 영역

분리 후보:

- 메뉴 정의 접근
- 메뉴 서빙
- 메뉴 연구
- `buildMenuGrid()`
- `renderRndList()`
- `serveByMenu()`
- `researchMenu()`

권장 위치:

```text
js/features/menu.js
```

### 3-7. 업그레이드 기능 영역

분리 후보:

- 업그레이드 목록
- `buyUpgrade()`
- 업그레이드 패널 렌더링
- 업그레이드 이벤트 위임

권장 위치:

```text
js/features/upgrade.js
```

### 3-8. 연구 기능 영역

분리 후보:

- 연구 목록
- `startResearch()`
- 연구 패널 렌더링
- 연구 이벤트 위임

권장 위치:

```text
js/features/research.js
```

### 3-9. 지역/지점 기능 영역

분리 후보:

- `BranchManager`
- 지역 이동
- 지역 해금
- 지역 확장 모달
- `renderMapUI()`
- `moveBranch()`
- `unlockBranch()`

권장 위치:

```text
js/features/branch.js
```

### 3-10. 직원 기능 영역

분리 후보:

- 직원 목록
- 직원 업그레이드
- 직원 자동화
- `buyStaffUpgrade()`

권장 위치:

```text
js/features/staff.js
```

### 3-11. 캔버스 렌더링 영역

분리 후보:

- canvas setup
- 게임 루프 렌더링
- 고객/캐릭터/매장 시각 요소
- 터치/클릭 좌표 처리

권장 위치:

```text
js/render/canvas.js
```

### 3-12. UI 렌더링 영역

분리 후보:

- `updateUI()`
- `updateStatsUI()`
- 모달 업데이트
- 패널 렌더링
- 쿠폰/교환 UI
- 설정 UI

권장 위치:

```text
js/render/ui.js
```

### 3-13. 부트스트랩 영역

최종 `js/main.js`는 다음 역할만 담당하도록 축소한다.

- 모듈 import
- DOMContentLoaded 진입점
- 초기 DOM refs 확보
- load/init/render 순서 실행
- 이벤트 초기 바인딩 호출
- game loop 시작

권장 위치:

```text
js/main.js
```

## 4. 권장 모듈 구조

최종 목표 구조:

```text
js/
  main.js
  core/
    config.js
    state.js
    save.js
    audio.js
    utils.js
  features/
    menu.js
    upgrade.js
    research.js
    branch.js
    staff.js
  render/
    canvas.js
    ui.js
```

## 5. 의존성 분리 순서

권장 순서:

### 5-1. 1단계: 순수 유틸 분리

대상:

```text
js/core/utils.js
```

이유:

- 상태 의존이 적다.
- 회귀 위험이 낮다.
- 다른 모듈이 공통으로 사용할 수 있다.

주의:

- 전역 함수가 필요한 경우 `window` 노출 여부를 명확히 결정해야 한다.

### 5-2. 2단계: config 분리

대상:

```text
js/core/config.js
```

이유:

- 상수/데이터 중심이라 비교적 안전하다.
- 기능 코드와 데이터 정의를 분리할 수 있다.

주의:

- 기존 코드에서 직접 참조하는 상수명이 많으므로 import 경로 설계가 필요하다.

### 5-3. 3단계: state 분리

대상:

```text
js/core/state.js
```

이유:

- `defaultState()`와 `sanitizeState()`를 분리하면 저장 로직도 정리하기 쉬워진다.

주의:

- `state`를 단일 mutable object로 유지할지, getter/setter로 감쌀지 결정해야 한다.
- 초기에는 단일 mutable export가 안전하다.

### 5-4. 4단계: audio 분리

대상:

```text
js/core/audio.js
```

이유:

- 오디오 로직은 기능 로직과 분리 가능하다.
- 사용자 gesture unlock 흐름만 주의하면 된다.

### 5-5. 5단계: 저장 분리

대상:

```text
js/core/save.js
```

조건:

- Step 2-23 완료
- Step 2-24B 완료
- 저장 QA 1차 통과

주의:

- 저장 로직은 가장 민감하므로 너무 이른 분리는 금지한다.

### 5-6. 6단계: 기능별 분리

권장 순서:

```text
1. menu.js
2. upgrade.js
3. staff.js
4. research.js
5. branch.js
```

이유:

- 메뉴/업그레이드/직원/연구/지역은 이벤트 위임 구조가 이미 정리되어 있어 분리 대상이 명확하다.

### 5-7. 7단계: render 분리

대상:

```text
js/render/ui.js
js/render/canvas.js
```

주의:

- UI는 거의 모든 기능과 연결되어 있어 가장 나중에 분리한다.
- canvas loop는 상태 참조가 많을 수 있으므로 별도 QA가 필요하다.

## 6. 전역으로 남겨야 할 후보

초기 모듈 분리 단계에서는 모든 것을 즉시 완전 module import/export로 바꾸지 않는 것이 안전하다.

임시 전역 유지 후보:

- `state`
- `CONFIG`
- `MENU`
- `MENU_MAP`
- `UPGRADES`
- `RESEARCH`
- `STAFF`
- `BranchManager`
- `save`
- `saveGame`
- `load`
- `updateUI`
- `updateStatsUI`
- `showToast`
- `unlockAudioOnce`
- `startBGM`
- `sfxTick`
- `sfxConfirm`
- `sfxWrong`

원칙:

- 1차 분리에서는 기존 전역 참조를 깨지 않는 방식으로 진행한다.
- 이후 단계에서 전역을 줄인다.
- 전역 제거는 별도 단계로 분리한다.

## 7. 분리 전 선행 조건

필수 선행 조건:

1. Step 2-23 저장 안정화 1차 실제 반영
2. Step 2-24B backup key/save recovery 실제 반영
3. `node --check js/main.js` 통과
4. 저장 QA 최소 1차 수행
5. inline `onclick=` 0개 유지
6. `.onclick =` 0개 유지
7. `function safeClick` 0개 유지
8. 주요 이벤트 위임 유지 확인
9. 브라우저 콘솔 에러 없음

권장 선행 조건:

1. Step 2-25 export/import 실제 구현 또는 구현 범위 확정
2. Chrome desktop 저장 QA 통과
3. 모바일 브라우저 1종 백그라운드 저장 QA 통과
4. primary 손상/backup 복구 QA 통과

## 8. 파일 분리 단계별 계획

### Step 3-1: module split inventory

목표:

- `js/main.js` 내부 함수/상수 목록 추출
- 분리 후보별 dependency map 작성
- 실제 코드 변경 없음

산출물:

```text
docs/2026-05-15-step3-1-module-inventory.md
```

### Step 3-2: utils/config extraction script 준비

목표:

- `utils.js`, `config.js` 분리 스크립트 초안 작성
- 실제 실행은 보류 가능
- preflight guard 포함

### Step 3-3: utils.js 1차 분리

조건:

- 저장 안정화 완료
- Step 3-1 inventory 완료

목표:

- 상태 의존 없는 helper만 분리

### Step 3-4: config.js 1차 분리

목표:

- 정적 상수/데이터 정의 분리

### Step 3-5: state.js 분리

목표:

- `defaultState()`, `sanitizeState()`, state 초기화 분리

### Step 3-6: audio.js 분리

목표:

- 오디오 관련 함수 분리

### Step 3-7: save.js 분리

조건:

- Step 2-23/2-24B 완료
- 저장 QA 통과

목표:

- 저장 로직 분리

### Step 3-8 이후: feature/render 분리

순서:

```text
menu.js
upgrade.js
staff.js
research.js
branch.js
ui.js
canvas.js
```

## 9. node --check / 브라우저 QA 기준

각 분리 단계마다 최소 기준:

```bash
node --check js/main.js
```

분리된 파일도 CommonJS가 아니라 browser module이라면 단순 `node --check`가 제한적일 수 있다. 초기에는 문법 검사 가능한 형태를 유지하거나, 별도 임시 check 스크립트를 사용한다.

브라우저 QA 공통 항목:

1. 페이지 로드
2. 콘솔 에러 없음
3. 게임 시작
4. 메뉴 서빙
5. 메뉴 연구
6. 업그레이드 구매
7. 직원 업그레이드
8. 연구 시작
9. 지역 확장 모달
10. 저장/불러오기
11. 강제 저장
12. 새로고침 복구
13. 모바일 터치

## 10. Step 3-1 진입 조건

Step 3-1은 실제 코드 변경이 없는 inventory 단계이므로, 저장 안정화가 미완료여도 제한적으로 진행 가능하다.

단, 조건:

- `js/main.js` 수정 없음
- `index.html` 수정 없음
- 실제 모듈 분리 없음
- 저장 미완료 리스크를 문서 상단에 명시

Step 3-1에서 할 수 있는 것:

- 함수/상수 목록화
- dependency map 작성
- 분리 난이도 분류
- 분리 순서 확정

Step 3-1에서 하지 말아야 할 것:

- import/export 적용
- script type module 전환
- 파일 실제 분리
- 저장 로직 이동

## 11. 최종 판단

현재 판단:

```text
Step 3 실제 모듈 분리: 보류
Step 3-1 inventory 문서 작성: 가능
Step 2-23 실제 반영: 최우선
Step 2-24B 실제 반영: Step 2-23 완료 후 가능
```

따라서 다음 단계는 둘 중 하나다.

1. 안정성 우선: Step 2-23 실제 반영
2. 속도 우선: Step 3-1 inventory 문서 작성

실제 코드 분리는 아직 시작하지 않는다.
