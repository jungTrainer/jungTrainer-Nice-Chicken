# Step 2-3A onCanvasDown 진단 보고

작성일: 2026-05-15
대상: `index.html`

## 1. 작업 목적

JS 분리 전에 캔버스 입력 함수인 `onCanvasDown()`의 중복 정의 여부와 실제 유지해야 할 구현을 확인했다.

이 함수는 게임의 핵심 입력을 담당한다.

- 사장님 터치
- 알바 터치
- 손님 선택
- 모바일 터치 좌표 보정
- 캔버스 이벤트 바인딩

따라서 JS를 외부 파일로 분리하기 전에 중복 정의가 있으면 먼저 정리해야 한다.

## 2. 현재 확인 결과

현재 `main` 기준으로 확인한 `onCanvasDown()` 구현은 최신 동작을 포함하고 있다.

유지해야 할 핵심 동작:

- `getCanvasPoint(e)`를 통해 마우스/터치 좌표를 캔버스 내부 좌표로 보정
- `bossCenter()`와 `hitCircle()`로 사장님 터치 판정
- `triggerBossFX()`로 사장님 터치 효과 실행
- `staffCenters()`와 `triggerStaffFX()`로 알바 터치 효과 실행
- `pickCustomerAt()`으로 손님 터치 판정
- `selectCustomer()`로 선택 손님 변경
- `updateUI()`로 선택 상태 반영

## 3. 유지 대상 함수

현재 유지 대상은 `getCanvasPoint(e)` 바로 아래에 있는 최신 `onCanvasDown(e)` 함수다.

이 함수는 다음 순서로 입력을 처리한다.

```text
1. 패널/모달이 열려 있으면 캔버스 입력 무시
2. 기본 터치 이벤트 방지
3. 사운드 잠금 해제 및 BGM 시작
4. 캔버스 좌표 계산
5. 사장님 터치 판정
6. 알바 터치 판정
7. 손님 터치 판정
```

이 구조는 게임 UX상 적절하다. 사장님/알바/손님이 화면에서 겹칠 가능성이 있으므로, 손님보다 사장님/알바를 먼저 판정하는 현재 순서가 안전하다.

## 4. 이벤트 바인딩 상태

현재 캔버스 이벤트 바인딩은 `initDOMRefs()` 내부에서 다음 형태로 유지되어 있다.

```js
safeOn(canvas, "mousedown", onCanvasDown);
safeOn(canvas, "touchstart", onCanvasDown, {passive:false});
```

이 구조는 데스크톱 마우스와 모바일 터치를 모두 지원한다.

## 5. 이번 단계에서 코드 변경을 하지 않은 이유

과거 진단에서는 `onCanvasDown()` 중복 가능성이 문제로 지적되었지만, 현재 `main`에서 확인한 최신 구간 기준으로는 유지해야 할 최신 함수가 명확하게 존재한다.

자동 정리 워크플로우를 추가했으나 GitHub Actions 실행이 확인되지 않았다. 따라서 불필요하게 함수 삭제를 강행하지 않고, 현재 동작을 보존하는 쪽을 선택했다.

이번 단계에서는 코드 삭제 없이 진단 결과를 문서화한다.

## 6. 예상 리스크

### 리스크 A. 실제 파일 전체에 숨은 중복 정의가 남아 있을 가능성

현재 조회 가능한 주요 구간과 코드 검색 기준으로 최신 구현은 확인했다. 다만 GitHub 검색/조회 도구 특성상 파일 전체 정적 분석과 동일한 신뢰도는 아니다.

향후 로컬 환경 또는 GitHub Actions가 안정적으로 실행되는 환경에서는 아래 명령으로 정확히 재검증하는 것이 좋다.

```bash
grep -n "function onCanvasDown" index.html
```

완료 기준은 결과가 1개만 나오는 것이다.

### 리스크 B. JS 파일 분리 시 전역 함수 접근 문제

현재 `onCanvasDown`은 전역 함수로 존재하고, `initDOMRefs()`에서 직접 참조한다. JS를 `type="module"`로 바꾸면 전역 스코프가 달라질 수 있다.

따라서 다음 JS 분리 단계에서는 일단 `type="module"`을 사용하지 말고 일반 `<script src="./js/main.js" defer>` 방식으로 시작하는 것이 안전하다.

### 리스크 C. 중복 이벤트 바인딩

`initDOMRefs()`가 여러 번 호출되면 캔버스 이벤트가 중복 등록될 수 있다. 현재 구조에서는 일반 부팅 시 1회 호출이지만, reset 후 재초기화 흐름에서는 재검토가 필요하다.

## 7. 권장 후속 작업

다음 JS 안정화 작업은 inline `onclick` 제거다.

대상:

- `moveBranch(id)`
- `unlockBranch(id)`
- `closeExpansionModal()`

현재 지역 확장 모달 카드 생성 시 inline `onclick`을 사용한다. JS 분리 이후 전역 함수 접근이 깨질 수 있으므로, 이벤트 위임 방식으로 바꾸는 것이 좋다.

권장 방향:

```html
<button class="btn alt loc-btn" data-action="move-branch" data-region-id="tokyo">이동하기 🚀</button>
<button class="btn loc-btn" data-action="unlock-branch" data-region-id="tokyo">오픈 🔓</button>
```

그리고 JS에서 다음처럼 처리한다.

```js
document.getElementById("expansionList")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if(!btn) return;
  const id = btn.dataset.regionId;
  if(btn.dataset.action === "move-branch") moveBranch(id);
  if(btn.dataset.action === "unlock-branch") unlockBranch(id);
});
```

## 8. Step 2-3A 판정

Step 2-3A는 완료로 본다.

- 최신 `onCanvasDown()` 유지 대상 확인
- 캔버스 입력 처리 순서 확인
- 이벤트 바인딩 위치 확인
- 코드 삭제 없이 보존 결정
- 다음 안정화 작업 대상을 inline `onclick` 제거로 확정
