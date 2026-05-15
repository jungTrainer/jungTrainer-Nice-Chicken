# 다음 프로젝트 지시 프롬프트

작성일: 2026-05-15
대상 레포: `jungTrainer/jungTrainer-Nice-Chicken`
현재 목표: 나이스치킨 타이쿤 리팩터링 안정화 및 JS 분리 준비

---

## 1. 현재까지 완료된 작업

다음 작업은 이미 완료되었으므로 중복 수행하지 않는다.

### 완료 1. 직원 업그레이드 함수 충돌 수정

- 기존 문제: `staffUpgradeCost`가 서로 다른 용도로 2번 선언되어 뒤쪽 함수가 앞쪽 직원 비용 계산 함수를 덮어썼음
- 조치: 뒤쪽 일반 비용 계산 함수를 `genericStaffUpgradeCost`로 변경
- 결과: 직원 업그레이드 비용 계산의 `NaN` 가능성 제거

### 완료 2. 리팩터링 사전 진단

- 문서: `docs/2026-05-15-refactor-pre-diagnosis.md`
- 결론: CSS 분리는 안전, JS 분리는 inline 이벤트/전역 함수/중복 바인딩 정리 후 진행해야 함

### 완료 3. 저장/엔딩 안정화

- `saveGame()` alias 추가
- 엔딩 미리보기 버튼 기본 숨김
- `?debug=1`일 때만 엔딩 미리보기 버튼 표시

### 완료 4. CSS 외부 파일 분리

- `css/style.css` 생성
- `index.html`에 `<link rel="stylesheet" href="./css/style.css">` 추가
- 기존 CSS 내용과 순서는 변경하지 않음

### 완료 5. `onCanvasDown()` 진단

- 문서: `docs/2026-05-15-oncanvasdown-diagnosis.md`
- 현재 유지 대상은 `getCanvasPoint(e)` 바로 아래 최신 `onCanvasDown(e)` 함수
- 이 함수는 사장님 터치, 알바 터치, 손님 선택, 모바일 좌표 보정을 포함함

---

## 2. 현재 미완료/주의 작업

### 미완료 1. Step 2-3B inline onclick 제거 실제 반영

현재 남아 있는 명확한 inline 이벤트:

```html
<button class="closeBtn" onclick="closeExpansionModal()">✕</button>
```

목표 변경:

```html
<button class="closeBtn" id="closeExpansionModalBtn" type="button">✕</button>
```

그리고 `initDOMRefs()` 내부 또는 DOM 초기화가 보장되는 위치에 다음 바인딩을 추가한다.

```js
const closeExpansionModalBtn = document.getElementById("closeExpansionModalBtn");
if(closeExpansionModalBtn){
  closeExpansionModalBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    if(typeof closeExpansionModal === "function") closeExpansionModal();
    else document.getElementById("modalExpansion")?.classList.remove("on");
  }, {passive:false});
}
```

주의:
- `index.html`은 큰 단일 파일이므로 전체 덮어쓰기 방식으로 수정하면 코드 유실 위험이 큼
- 반드시 전체 원본 확보 후 자동 패치 방식으로 수정할 것
- 수정 후 `onclick="closeExpansionModal()"`가 0개인지 확인할 것

### 미완료 2. 지역 카드 내부 `moveBranch`, `unlockBranch` 이벤트 추적

아직 정확한 생성 위치를 완전히 확인하지 못했다.

목표:
- 지역 카드의 inline 또는 문자열 이벤트 호출이 있다면 제거
- `data-action`, `data-region-id` 기반 이벤트 위임으로 변경

권장 구조:

```html
<button class="btn alt loc-btn" data-action="move-branch" data-region-id="tokyo">이동하기 🚀</button>
<button class="btn loc-btn" data-action="unlock-branch" data-region-id="tokyo">오픈 🔓</button>
```

권장 이벤트 위임:

```js
const expansionList = document.getElementById("expansionList");
if(expansionList){
  expansionList.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-action]");
    if(!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.regionId;

    if(action === "move-branch") moveBranch(id);
    if(action === "unlock-branch") unlockBranch(id);
  });
}
```

---

## 3. 다음 작업을 지시할 때 사용할 프롬프트

아래 프롬프트를 그대로 사용한다.

```text
너는 이 레포의 프로그래밍 기획/개발 리팩터링 담당자다.
repo: jungTrainer/jungTrainer-Nice-Chicken

작업 목표:
나이스치킨 타이쿤 프로젝트의 JS 분리 전 안정화 작업을 이어서 진행하라.
현재 단계는 Step 2-3B: 지역 확장 모달 inline onclick 제거다.

중요한 현재 상태:
1. 직원 업그레이드 함수 충돌 수정 완료.
2. saveGame alias 추가 완료.
3. 엔딩 미리보기 버튼은 ?debug=1에서만 보이도록 수정 완료.
4. CSS는 css/style.css로 분리 완료.
5. onCanvasDown 진단 문서화 완료.
6. GitHub Actions 일부 워크플로우가 자동 실행되지 않는 문제가 있었다.
7. index.html은 큰 단일 파일이므로 전체 덮어쓰기 방식은 코드 유실 위험이 크다.

반드시 지켜야 할 원칙:
- 먼저 현재 main의 index.html 최신 상태를 확인하라.
- 절대 추측으로 수정하지 마라.
- 큰 파일 전체를 덮어쓰지 말고, 전체 원본을 안전하게 확보할 수 있을 때만 자동 패치하라.
- 수정 전후에 변경 대상 문자열 개수를 확인하라.
- JS 문법 검사를 반드시 수행하라.
- 한 번에 여러 기능을 바꾸지 마라.
- 이번 단계에서는 지역 확장 모달의 inline onclick 제거만 처리하라.

이번 작업의 1차 목표:
아래 코드를 제거한다.

<button class="closeBtn" onclick="closeExpansionModal()">✕</button>

아래 코드로 변경한다.

<button class="closeBtn" id="closeExpansionModalBtn" type="button">✕</button>

그리고 DOM 초기화 위치에 아래 이벤트 바인딩을 추가한다.

const closeExpansionModalBtn = document.getElementById("closeExpansionModalBtn");
if(closeExpansionModalBtn){
  closeExpansionModalBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    if(typeof closeExpansionModal === "function") closeExpansionModal();
    else document.getElementById("modalExpansion")?.classList.remove("on");
  }, {passive:false});
}

검증 기준:
1. index.html에 onclick="closeExpansionModal()"가 0개여야 한다.
2. id="closeExpansionModalBtn"가 정확히 1개여야 한다.
3. closeExpansionModalBtn 이벤트 바인딩이 정확히 1개여야 한다.
4. closeExpansionModal 함수 자체는 유지되어야 한다.
5. modalExpansion 닫기 동작이 유지되어야 한다.
6. script 블록을 추출해서 node --check 문법 검사를 통과해야 한다.
7. 변경 파일과 변경 이유를 보고해야 한다.
8. 위험하거나 불확실하면 강행하지 말고 무엇이 불확실한지 보고해야 한다.

완료 후 보고 형식:
- 현재 상태
- 변경한 파일
- 변경 내용
- 검증 결과
- 남은 리스크
- 다음 스텝 제안
```

---

## 4. 객관성 검토 체크리스트

작업자가 스스로 객관적이지 못할 가능성을 줄이기 위해, 다음 질문에 답한 뒤 커밋한다.

### 수정 전 질문

- 정말 현재 파일에 해당 inline onclick이 존재하는가?
- 정확히 몇 개 존재하는가?
- 같은 문자열이 다른 용도로 쓰이고 있지는 않은가?
- 이벤트 바인딩을 추가할 위치가 DOM 로드 이후 실행되는 곳인가?
- 이미 같은 바인딩이 존재하지 않는가?

### 수정 후 질문

- inline onclick은 제거되었는가?
- 닫기 버튼은 여전히 클릭 가능한가?
- `closeExpansionModal()` 함수는 삭제하지 않았는가?
- fallback으로 `modalExpansion.classList.remove("on")`가 작동 가능한가?
- JS 문법 검사는 통과했는가?
- 이번 작업 범위를 넘어 다른 기능을 건드리지 않았는가?

---

## 5. 다음 단계 로드맵

Step 2-3B가 완료되면 다음 순서로 진행한다.

1. Step 2-3C: 지역 카드 `moveBranch`, `unlockBranch` 이벤트 생성 로직 추적
2. Step 2-3D: 지역 카드 버튼을 `data-action` 이벤트 위임 방식으로 정리
3. Step 2-4: 이벤트 바인딩 중복 정리
4. Step 2-5: JS 단일 외부 파일 분리 준비
5. Step 2-6: `index.html`의 메인 script를 `js/main.js`로 이동
6. Step 2-7: `defer` 기반 외부 JS 로드 검증

---

## 6. 현재 리스크

### 낮음

- 직원 업그레이드 비용 계산 오류
- saveGame 미정의 오류
- 엔딩 미리보기 버튼 노출
- CSS 분리 경로

### 중간

- GitHub Pages CSS 캐시
- 지역 확장 모달 inline onclick 잔존
- 지역 카드 버튼 이벤트 위치 미확정
- GitHub Actions 일부 워크플로우 자동 실행 실패

### 높음

- 큰 `index.html` 전체 덮어쓰기
- inline 이벤트가 남은 상태에서 JS 외부 파일 분리
- `type="module"`로 즉시 전환

현재 권장:
JS 분리보다 inline 이벤트와 이벤트 바인딩 안정화가 먼저다.
