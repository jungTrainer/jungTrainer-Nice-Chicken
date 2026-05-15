# Step 2-15B 동적 onclick 전환 설계

작성일: 2026-05-15

## 결론

Step 2-15A 이후 `js/main.js`에 남아 있는 `.onclick =` 직접 대입은 6개다.

6개 모두 동적 생성 버튼 또는 게임 상태 변경 버튼이다. 단순 치환으로 `addEventListener`를 붙이면 렌더링 반복, 동적 ID, 중복 바인딩, 상태 갱신 누락 가능성이 있어 이번 단계에서는 코드 전환을 강행하지 않고 이벤트 위임 설계를 먼저 확정한다.

## 현재 안전 상태

- inline `onclick=`: 0개 유지
- `function safeClick`: 0개 유지
- 실제 `safeClick(...)` 호출: 0개 유지
- `safeOn`: 유지
- `_bindSafe`: 유지
- `.onclick =` 직접 대입: 6개
- Step 2-15B 코드 변경: 없음

## 남은 `.onclick =` 6개 목록

### 1. `renderRndList()` 내부 메뉴 연구 버튼

```js
btn.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudioOnce();
  if(state.money < cost){
    showToast("연구비가 부족해요!");
    if(typeof sfxWrong === "function") sfxWrong();
    return;
  }
  state.money -= cost;
  state.menuLevels[m.id] = lvl + 1;
  _saveDirty = true;
  save(true);
  showToast(`${m.name} 연구 완료!`);
  if(typeof sfxConfirm === "function") sfxConfirm();
  updateUI();
  updateStatsUI();
  if(typeof buildMenuGrid === 'function') buildMenuGrid();
  if(typeof renderRndList === 'function') renderRndList();
};
```

- 기능: 통계/리포트 모달의 메뉴별 연구 버튼
- 컨테이너 후보: `#rndList`
- 권장 구조:
  - 버튼에 `data-action="research-menu"`
  - 버튼에 `data-menu-id="..."`
  - `#rndList`에 click 이벤트 위임 1회
- 위험도: 중간~높음
- 이유: 클릭 후 `renderRndList()`를 다시 호출하므로, 직접 addEventListener 방식보다 이벤트 위임이 적합함
- 추천 단계: Step 2-15C

### 2. `buildMenuGrid()` 내부 메뉴 서빙 버튼

```js
btn.onclick = () => {
  applyElementFX(btn);
  unlockAudioOnce(); startBGM();
  sfxTick();
  if (locked) {
    showToast("아직 잠긴 메뉴예요! (업그레이드: 메뉴 확장)");
    return;
  }
  serveByMenu(m.id);
};
```

- 기능: 핵심 메뉴 서빙 버튼
- 컨테이너 후보: `#menuGrid`
- 권장 구조:
  - 버튼에 `data-action="serve-menu"`
  - 버튼에 `data-menu-id="..."`
  - 잠금 버튼은 `disabled` 유지
  - `#menuGrid`에 click 이벤트 위임 1회
- 위험도: 높음
- 이유: 게임 핵심 액션이며, `applyElementFX(btn)`가 실제 클릭된 버튼 객체를 필요로 함
- 추천 단계: Step 2-16 또는 브라우저 테스트 준비 후 전환

### 3. `renderPanel("upg")` 내부 업그레이드 구매 버튼

```js
div.querySelector("button").onclick = () => {
  unlockAudioOnce();
  if(typeof startBGM === "function") startBGM();
  buyUpgrade(u.id);
};
```

- 기능: 업그레이드 구매
- 컨테이너 후보: `#upgList`
- 권장 구조:
  - 버튼에 `data-action="buy-upgrade"`
  - 버튼에 `data-upgrade-id="..."`
  - `#upgList`에 click 이벤트 위임 1회
- 위험도: 높음
- 이유: 구매 후 `renderPanel("upg")`가 다시 호출되며, 같은 컨테이너에 직원 업그레이드 버튼도 공존함
- 추천 단계: 직원 업그레이드와 함께 컨테이너 이벤트 위임 설계 후 전환

### 4. 직원 속도 업그레이드 버튼

```js
card.querySelector(`#btn-auto-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'auto');
```

- 기능: 직원 개별 속도 업그레이드
- 컨테이너 후보: `#upgList`
- 권장 구조:
  - 버튼에 `data-action="buy-staff-upgrade"`
  - 버튼에 `data-staff-key="..."`
  - 버튼에 `data-kind="auto"`
  - `#upgList` 이벤트 위임에서 업그레이드 구매와 분기
- 위험도: 높음
- 이유: 동적 ID와 직원 수, 패널 재렌더링에 의존함
- 추천 단계: 업그레이드 구매 버튼과 묶어서 전환

### 5. 직원 매력 업그레이드 버튼

```js
card.querySelector(`#btn-tip-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'tip');
```

- 기능: 직원 개별 매력/팁 업그레이드
- 컨테이너 후보: `#upgList`
- 권장 구조:
  - 버튼에 `data-action="buy-staff-upgrade"`
  - 버튼에 `data-staff-key="..."`
  - 버튼에 `data-kind="tip"`
  - `#upgList` 이벤트 위임에서 업그레이드 구매와 분기
- 위험도: 높음
- 이유: 직원 속도 업그레이드와 같은 동적 구조이며 함께 처리해야 함
- 추천 단계: 업그레이드 구매 버튼과 묶어서 전환

### 6. `renderPanel("res")` 내부 연구 시작 버튼

```js
btn.onclick = ()=>{ unlockAudioOnce(); if(typeof startBGM === "function") startBGM(); startResearch(r.id); };
```

- 기능: 연구 시작
- 컨테이너 후보: `#resList` 또는 `targetList`
- 권장 구조:
  - 버튼에 `data-action="start-research"`
  - 버튼에 `data-research-id="..."`
  - `#resList`에 click 이벤트 위임 1회
- 위험도: 높음
- 이유: 연구 슬롯, 진행 상태, 완료 상태, 패널 재렌더링과 연결되어 있음
- 추천 단계: Step 2-15D 또는 브라우저 테스트 후 전환

## 권장 전환 순서

### Step 2-15C: `renderRndList()` 메뉴 연구 버튼

가장 먼저 전환할 후보는 `renderRndList()`의 메뉴 연구 버튼이다.

이유:

1. `#rndList`라는 독립 컨테이너가 있다.
2. 버튼 기능이 메뉴 연구에 한정된다.
3. 클릭 후 `renderRndList()`를 다시 호출하므로 이벤트 위임 구조가 적합하다.
4. 핵심 서빙 루프보다 상대적으로 영향 범위가 작다.

권장 변경:

```js
<button class="rnd-btn" data-action="research-menu" data-menu-id="${m.id}" ...>
```

그리고 DOM 초기화 흐름 또는 모달 초기화 흐름에 다음과 같은 위임을 1회 추가한다.

```js
const rndListEl = document.getElementById("rndList");
if(rndListEl){
  rndListEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('[data-action="research-menu"]');
    if(!btn || !rndListEl.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const menuId = btn.dataset.menuId;
    if(!menuId) return;
    researchMenu(menuId);
  });
}
```

단, 현재 `renderRndList()` 내부 로직은 `m`, `lvl`, `cost` 지역 변수에 의존한다. 이벤트 위임으로 바꾸려면 동일 로직을 재사용할 수 있는 별도 함수가 필요하다.

권장 함수:

```js
function researchMenu(menuId){
  const m = MENU_MAP[menuId];
  if(!m) return;
  const lvl = state.menuLevels?.[m.id] || 0;
  const cost = Math.floor(100000 * Math.pow(1.8, lvl));
  // 기존 btn.onclick 내부 로직 이동
}
```

## 이번 단계에서 코드 전환을 보류한 이유

이번 단계에서 남은 6개 중 하나라도 단순 치환으로 바꾸면 다음 문제가 생길 수 있다.

1. 동적 렌더링 후 이벤트 유실
2. 이벤트 중복 바인딩
3. 지역 변수 `m`, `u`, `s`, `r`, `cost`, `lvl` 의존성 손실
4. 구매/연구/서빙 후 UI 재렌더링 누락
5. 게임 핵심 액션 기능 깨짐

따라서 Step 2-15B는 설계 문서 완료 단계로 마무리하고, 실제 전환은 Step 2-15C부터 그룹별로 진행한다.

## 검증 체크리스트

- `.onclick =` 직접 대입 6개 목록 문서화 완료
- 각 항목별 기능/위험도/권장 컨테이너 문서화 완료
- `function safeClick`: 0개 유지
- 실제 `safeClick(...)` 호출: 0개 유지
- inline `onclick=`: 0개 유지
- `safeOn`, `_bindSafe`: 유지
- `js/main.js` 코드 변경 없음
- `node --check js/main.js`: 기존 Step 2-15A 통과 상태 유지. 이번 단계는 문서 추가만 수행

## 다음 단계

Step 2-15C에서 `renderRndList()` 내부 메뉴 연구 버튼 1개 그룹을 먼저 이벤트 위임 구조로 전환한다.

필수 검증:

1. `btn.onclick = (e) =>` 제거
2. `data-action="research-menu"` 추가
3. `data-menu-id` 추가
4. `researchMenu(menuId)` 함수 추가
5. `rndListEl.addEventListener("click"` 1개 추가
6. `.onclick =` 직접 대입 수 6개에서 5개로 감소
7. inline `onclick=` 0개 유지
8. `function safeClick` 0개 유지
9. `node --check js/main.js` 통과
10. 브라우저에서 메뉴 연구 버튼 클릭 테스트 필요
