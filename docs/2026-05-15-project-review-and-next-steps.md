# 나이스치킨 타이쿤 프로젝트 점검 및 다음 작업 계획

작성일: 2026-05-15
대상 레포: `jungTrainer/jungTrainer-Nice-Chicken`

## 1. 현재 프로젝트 상태

현재 프로젝트는 GitHub Pages 루트 배포를 전제로 한 단일 `index.html` 기반 정적 웹 게임이다. HTML, CSS, JavaScript, 게임 데이터, 상태 저장, UI 렌더링, 캔버스 로직이 모두 한 파일에 포함되어 있다.

핵심 게임 구조는 다음과 같다.

- 모바일 중심 치킨집 타이쿤 게임
- 손님 선택 후 3x3 메뉴판에서 정답 메뉴를 눌러 서빙
- 방치 수익, 오프라인 수익, 자동 서빙, 배달/온라인 주문 수익 포함
- 업그레이드, 연구, 일간/주간 미션, 쿠폰, 인증서, 지역 확장 기능 포함
- 데이터 저장은 서버가 아닌 브라우저 `localStorage` 기반

## 2. 즉시 수정해야 할 핵심 이슈

### 이슈 A. `staffUpgradeCost` 함수명 중복

현재 코드 안에 `staffUpgradeCost` 함수가 서로 다른 목적과 시그니처로 두 번 선언되어 있다.

문제 구조:

```js
function staffUpgradeCost(staffKey, kind, cur){
  // 직원별 자동서빙/팁 교육 비용 계산
}

function staffUpgradeCost(lv, mult=1){
  // 일반 직원 비용 계산
}
```

JavaScript에서는 뒤쪽 선언이 앞쪽 선언을 덮어쓴다. 따라서 `buyStaffUpgrade(staffKey, kind)`에서 직원별 비용 계산이 정상적으로 동작하지 않을 가능성이 높다.

권장 수정:

```js
function staffPersonalUpgradeCost(staffKey, kind, cur){
  const s = STAFF_POOL.find(x => x.key === staffKey);
  const gradeMul = (s?.grade === "S") ? 2.2 :
                   (s?.grade === "A") ? 1.8 :
                   (s?.grade === "B") ? 1.4 : 1.0;

  if(kind === "auto"){
    const base = 80000;
    return Math.floor(base * gradeMul * Math.pow(1.9, cur));
  }

  const base = 100000;
  return Math.floor(base * gradeMul * Math.pow(1.85, cur));
}

function staffGenericUpgradeCost(lv, mult = 1){
  return Math.floor(50000 * mult * Math.pow(2.0, lv));
}
```

그리고 `buyStaffUpgrade()` 내부의 비용 계산은 다음처럼 바꾼다.

```js
const cost = staffPersonalUpgradeCost(staffKey, kind, cur);
```

### 이슈 B. 단일 파일 누적 개발 구조

현재 `index.html` 하나에 모든 코드가 누적되어 있어 다음 문제가 있다.

- 동일 함수명 중복 발생 가능성 증가
- 기능 수정 시 다른 기능을 건드릴 위험 증가
- AI 코딩툴에게 부분 수정 지시가 어려움
- 테스트 범위가 불명확함
- GitHub API나 간단한 패치 도구로 안전하게 수정하기 어려움

## 3. 1차 리팩터링 방향

대규모 기능 변경 없이 파일만 분리하는 것을 1차 목표로 한다.

권장 구조:

```text
/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ config.js
│  ├─ state.js
│  ├─ utils.js
│  ├─ audio.js
│  ├─ canvas.js
│  ├─ game-loop.js
│  ├─ ui.js
│  ├─ missions.js
│  ├─ upgrades.js
│  ├─ research.js
│  ├─ regions.js
│  └─ main.js
├─ docs/
│  ├─ 2026-05-15-project-review-and-next-steps.md
│  └─ manual-test-checklist.md
└─ README.md
```

분리 우선순위:

1. CSS 분리: `<style>` 내부를 `css/style.css`로 이동
2. 설정/데이터 분리: `CONFIG`, `MENUS`, `REGIONS`, `STAFF_POOL`, `RESEARCH`, `EVENTS`
3. 유틸 함수 분리: `fmtWon`, `clamp`, `dayKey`, `showToast` 등
4. 상태 저장 분리: `defaultState`, `save`, `load`, `sanitizeState`
5. UI 렌더링 분리: 메뉴판, 패널, 모달, 리포트
6. 게임 루프 분리: 손님 생성, 이동, 서빙, 자동 서빙, 배달, 온라인 주문

## 4. 테스트 기준

리팩터링 또는 버그 수정 후 최소한 아래 흐름은 직접 확인해야 한다.

- 첫 실행 시 스플래시가 사라지고 게임 화면이 표시되는가
- 손님을 선택할 수 있는가
- 정답 메뉴 서빙 시 돈과 평점이 정상 반영되는가
- 오답 메뉴 서빙 시 평점/인내심 패널티가 정상 반영되는가
- 메뉴 해금 업그레이드 후 메뉴판이 갱신되는가
- 알바 고용 후 직원 업그레이드 비용이 숫자로 정상 표시되는가
- 직원 자동서빙이 동작하는가
- 연구 시작/완료가 동작하는가
- 일간/주간 미션 진행도가 갱신되는가
- 인증서 발급 버튼이 조건에 맞게 동작하는가
- 쿠폰 사용 시 PIN 검증이 동작하는가
- 지역 확장/이동 후 저장 데이터가 유지되는가
- 새로고침 후 LocalStorage 데이터가 복원되는가

## 5. 다음 스텝 제안

### Step 1. 안전 핫픽스

`staffUpgradeCost` 중복을 제거하고 직원 업그레이드 비용 계산을 정상화한다.

### Step 2. 기능 변경 없는 파일 분리

게임 동작은 그대로 유지하면서 CSS와 JS를 분리한다. 이 단계에서는 신규 기능을 추가하지 않는다.

### Step 3. 수동 QA

모바일 Chrome 기준으로 핵심 게임 루프를 점검한다.

### Step 4. 밸런스 조정

직원 성장, 배달 수익, 지역 확장 비용, 메뉴 가격 배율을 플레이 타임 기준으로 조정한다.

### Step 5. PWA 복구 여부 결정

현재 manifest 연결이 제거되어 있으므로, 실제 설치형 앱처럼 운영할 것인지 단순 웹게임으로 운영할 것인지 결정한다.

## 6. 개발 원칙

- 기능 추가보다 먼저 기존 기능 안정화
- 한 번에 대규모 수정하지 말고 작은 커밋 단위로 진행
- LocalStorage 구조가 바뀌면 반드시 마이그레이션 함수 작성
- 모바일 터치/모달/스크롤을 우선 테스트
- AI 코딩툴에게 작업시 항상 `수정 후 실행 명령어`, `테스트 체크리스트`, `변경 파일 목록`을 요구
