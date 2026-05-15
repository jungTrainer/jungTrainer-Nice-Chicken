# 리팩터링 사전 진단 보고서

작성일: 2026-05-15
대상: `index.html`
목적: CSS/JS 파일 분리 전 구조, 위험 요소, 예상 오류, UX 이슈, 향후 발전 방향 점검

## 1. 요약 결론

현재 프로젝트는 단일 `index.html` 안에 HTML, CSS, JavaScript, 게임 데이터, 상태 저장, 캔버스 렌더링, UI 렌더링, 이벤트 바인딩, 엔딩 시스템이 모두 포함된 구조다.

리팩터링 우선순위는 다음과 같다.

1. CSS 단순 분리
2. 전역 함수/중복 함수 안전 정리
3. inline `onclick` 제거
4. JS를 기능별 파일로 단계적 분리
5. 테스트 자동화/수동 QA 체계 추가

현재 바로 JS를 모듈화하면 함수 선언 순서, 전역 참조, inline 이벤트, 중복 이벤트 바인딩 때문에 작동 불능이 발생할 가능성이 높다. 따라서 1차 작업은 CSS만 `css/style.css`로 분리하고, 동작 변화가 없는 상태를 먼저 확보해야 한다.

## 2. 현재 파일 구조

`index.html`은 약 7,171줄 규모의 단일 파일이다.

구성:

- `<style>` 1개: 전체 CSS 포함
- 본문 HTML: 게임 화면, 패널, 모달, 엔딩 UI 포함
- `<script>` 여러 개: 스플래시, 메인 게임 로직, 서비스워커 비활성 스크립트 포함
- 후반부에 경영 리포트/지역 확장/엔딩 UI가 메인 스크립트 뒤에 배치됨

## 3. CSS 진단

### 확인 내용

CSS는 기본 스타일 이후 여러 PATCH/TWEAK/HOTFIX가 누적되어 있다.

대표 예시:

- `PATCH v39`
- `PATCH v40`
- 메뉴판 정렬 HOTFIX
- 헤더 버튼 터치 HOTFIX
- 직원 카드 TWEAK
- 경영 리포트 모달 스타일
- 지역 확장 카드 스타일
- 엔딩 오버레이 스타일

### 위험 요소

- 같은 선택자가 여러 번 정의된다.
- `!important`가 다수 사용된다.
- 과거 패치와 최신 패치가 공존한다.
- CSS 정리와 분리를 동시에 하면 UI가 깨질 가능성이 높다.

### 판단

CSS는 먼저 정리하지 말고 그대로 외부 파일로 분리하는 것이 안전하다.

1차 CSS 분리 원칙:

- CSS 내용 수정 금지
- 순서 유지
- `<style>` 내용을 그대로 `css/style.css`로 이동
- `<link rel="stylesheet" href="./css/style.css">` 추가
- 기존 `<style>`은 제거

## 4. JS 진단

### 확인 내용

JS는 기능별 구획 주석은 있으나 실제로는 전역 함수와 전역 상태에 강하게 의존한다.

주요 영역:

- SOUND
- CONFIG
- MENUS / REGIONS / STAFF_POOL / RESEARCH / EVENTS
- BranchManager
- state/defaultState/load/save/sanitizeState
- DOM refs/initDOMRefs
- 패널/모달 이벤트
- 캔버스 렌더링
- 손님/서빙/자동서빙/배달/온라인 주문
- 미션/쿠폰/인증서
- 엔딩 시스템
- 루프/watchdog/error guard

### 위험 요소 A. `saveGame()` 참조 가능성

일부 엔딩/직원 코드에서 `saveGame()`을 호출한다. 현재 저장 함수는 `save(force=false)`로 정의되어 있으므로, `saveGame` alias가 없으면 특정 기능 실행 시 런타임 오류가 발생할 수 있다.

권장 조치:

```js
function saveGame(){
  return save(true);
}
```

또는 `saveGame()` 호출부를 모두 `save(true)`로 통일한다.

### 위험 요소 B. `onCanvasDown()` 중복 정의

`onCanvasDown()`이 서로 다른 위치에 2번 정의되어 있다. JavaScript에서는 뒤쪽 정의가 앞쪽 정의를 덮어쓴다.

현재는 문법 오류는 아니지만, 기능 수정 시 앞쪽 함수를 고쳐도 실제 동작에 반영되지 않는 문제가 생긴다.

권장 조치:

- 뒤쪽 최신 함수를 기준으로 유지
- 앞쪽 정의 제거 또는 이름 변경
- 캔버스 이벤트 바인딩은 한 곳에서만 수행

### 위험 요소 C. 이벤트 바인딩 중복

`initDOMRefs()` 내부와 전역 영역에서 같은 버튼에 이벤트가 다시 바인딩된다.

예:

- `toggleSoundBtn.onclick`
- `openCouponsBtn.onclick`
- `openExchangeBtn.onclick`
- `closeCouponsBtn.onclick`
- `doExchangeBtn.onclick`

현재는 `onclick =` 방식이라 마지막 할당이 이기지만, 추후 `addEventListener`가 섞이면 중복 실행 문제가 발생할 수 있다.

권장 조치:

- 이벤트 바인딩을 `bindUIEvents()`로 통합
- `initDOMRefs()`는 DOM 참조만 수행
- 전역 영역 이벤트 할당 제거

### 위험 요소 D. inline `onclick`

지역 확장 카드에서 inline `onclick="moveBranch(...)"`, `onclick="unlockBranch(...)"`를 사용한다. 또한 확장 모달 닫기 버튼도 inline `onclick="closeExpansionModal()"`를 사용한다.

이 구조는 JS 파일을 `type="module"`로 바꾸면 전역 함수 접근이 깨질 수 있다.

권장 조치:

- `data-region-id` 사용
- 이벤트 위임 방식으로 변경
- inline `onclick` 제거

### 위험 요소 E. 테스트용 엔딩 버튼 노출

`endingPreviewBtn`이 화면 좌상단에 노출되어 있다. 배포용 빌드에서는 사용자에게 테스트 버튼이 보이는 UX 문제가 있다.

권장 조치:

- 기본 `display:none`
- 개발 모드 플래그에서만 노출
- 또는 URL query `?debug=1`일 때만 노출

### 위험 요소 F. 메인 스크립트 뒤에 추가 UI가 있음

경영 리포트, 지역 확장, 엔딩 UI가 메인 스크립트 뒤에 배치되어 있다. 현재는 DOMContentLoaded 후 `initDOMRefs()`가 실행되므로 대부분 안전하지만, 메인 스크립트 내부에서 즉시 DOM을 찾는 코드가 있으면 null 가능성이 있다.

권장 조치:

- HTML 구조는 먼저 유지
- JS 분리 시 초기화 순서를 명확히 정의
- `DOMContentLoaded -> initDOMRefs -> bindUIEvents -> load -> initAfterLoad -> startGameLoop` 순서를 문서화

## 5. 예상되는 문제/오류/작동안됨 가능성

### 높은 위험

1. `saveGame is not defined`
   - 엔딩 시스템 또는 직원 관련 함수 실행 시 발생 가능
   - 조치: alias 추가 또는 호출부 통일

2. JS 모듈화 후 inline onclick 작동 불가
   - `moveBranch`, `unlockBranch`, `closeExpansionModal` 등이 전역에 없으면 클릭 불가
   - 조치: inline onclick 제거 후 이벤트 위임

3. 캔버스 터치 입력 수정 시 실제 함수가 아닌 중복된 이전 함수만 수정할 위험
   - 조치: `onCanvasDown` 단일화

4. 루프가 중복 실행될 가능성
   - `DOMContentLoaded` finally에서 `startGameLoop()`를 다시 호출함
   - 내부에서 기존 rAF를 cancel하고 재시작하므로 방어는 되어 있지만 구조적으로 혼란
   - 조치: boot 성공/실패 분리

### 중간 위험

1. UI 스타일 충돌
   - `.game-header`, `.menuBtn`, `.dim.on`, `.iconBtn` 등 중복 정의
   - 조치: CSS 단순 분리 후 별도 단계에서 정리

2. 직원 수 불일치
   - 주석에는 최대 5명, STAFF_POOL은 6명, hire maxLevel은 6으로 보임
   - 일부 함수는 5명으로 clamp하는 구간이 있음
   - 조치: 실제 의도 확정 필요. 손자 포함 6명인지 최대 5명인지 통일

3. 지역 확장 저장 구조 복잡성
   - BranchManager가 지점별 스냅샷을 저장/로드함
   - LocalStorage 데이터가 꼬이면 지점 이동 시 데이터가 사라져 보일 수 있음
   - 조치: 저장 마이그레이션 테스트 필요

4. 엔딩 리소스 누락
   - `END_01.png ~ END_05.png`, `END_SOUND.*`가 없으면 이미지/사운드가 누락됨
   - 조치: 리소스 파일 존재 확인 또는 graceful fallback 강화

### UX 불편 예상

1. 메뉴판/캔버스/하단 탭이 모바일 높이에 따라 겹칠 가능성
2. 패널 높이 64%가 작은 화면에서 콘텐츠를 많이 가림
3. 지역 확장 모달은 좌우 스크롤 방식이라 안내가 부족하면 사용자가 놓칠 수 있음
4. 경영 리포트 모달 높이가 고정 520px/80vh라 작은 화면에서 답답할 수 있음
5. 테스트용 엔딩 버튼이 사용자에게 노출됨
6. 쿠폰 PIN 기본값이 UI에 노출되어 있어 실제 매장 운영용으로는 보안성이 낮음

## 6. 완료 기준

Step 2-0 리팩터링 사전 진단 완료 기준:

- CSS 분리 가능 여부 판단 완료
- JS 분리 위험 구간 식별 완료
- 즉시 수정해야 할 런타임 위험 요소 식별 완료
- 예상 UX 문제 목록화 완료
- 다음 실제 작업 순서 확정 완료

본 진단 기준으로 Step 2-0은 완료로 본다.

## 7. 다음 스텝 제안

### Step 2-1. 리팩터링 전 안정화 핫픽스

CSS 분리 전에 아래 안정화 핫픽스를 먼저 적용하는 것이 좋다.

1. `saveGame()` alias 추가
2. `endingPreviewBtn` 기본 숨김 처리
3. `onCanvasDown()` 중복 정의 주석/정리 계획 수립
4. 직원 최대 수 5/6 불일치 확인용 Issue 생성

### Step 2-2. CSS 단순 분리

- `css/style.css` 생성
- `<style>` 내부 전체를 그대로 이동
- `index.html`에는 `<link rel="stylesheet" href="./css/style.css">`만 남김
- 스타일 내용은 수정하지 않음

### Step 2-3. JS 분리 준비

- `js/main.js` 단일 파일로 먼저 이동
- `defer`로 로드
- inline onclick 유지 시에는 `window.moveBranch = moveBranch` 형태의 임시 호환 필요

### Step 2-4. JS 기능별 분리

순서:

1. `js/config.js`
2. `js/data.js`
3. `js/state.js`
4. `js/utils.js`
5. `js/audio.js`
6. `js/ui.js`
7. `js/game-loop.js`
8. `js/canvas-render.js`
9. `js/missions.js`
10. `js/ending.js`

## 8. 향후 발전 방향

### 단기

- 핵심 버그 안정화
- CSS/JS 파일 분리
- 모바일 QA 체크리스트 기반 점검
- 테스트 버튼/개발용 UI 정리

### 중기

- 게임 밸런스 데이터 분리
- 지점별 데이터 구조 안정화
- 저장 데이터 마이그레이션 도입
- UI 컴포넌트 정리
- 이벤트/미션/직원 성장 데이터를 JSON 스타일로 관리

### 장기

- PWA 재도입 여부 결정
- 앱 설치형 UX 강화
- 쿠폰/PIN 기능을 실제 매장용으로 쓸 경우 관리자 인증 강화
- 리더보드/랭킹/백업 저장 기능 검토
- 튜토리얼/초반 온보딩 추가
- 배포용/개발용 모드 분리

## 9. 최종 권고

다음 실제 작업은 CSS 분리가 아니라, 그 전에 `saveGame()` alias 추가와 테스트용 엔딩 버튼 숨김을 먼저 처리하는 것을 권장한다.

이유:

- `saveGame()`은 특정 기능에서 런타임 오류를 만들 수 있는 즉시 위험 요소다.
- `endingPreviewBtn`은 배포 UX 문제다.
- 둘 다 변경 범위가 작고, CSS/JS 분리 전에 처리해도 충돌 가능성이 낮다.

따라서 다음 단계는 `Step 2-1: 리팩터링 전 안정화 핫픽스`로 진행한다.
