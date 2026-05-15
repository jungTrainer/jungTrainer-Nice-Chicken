# Step 2-14 onclick 직접 대입 인벤토리

작성일: 2026-05-15

## 결론

최신 `main`의 `js/main.js` 원문을 직접 확인한 결과, `.onclick =` 직접 대입은 총 7개 남아 있다.

이번 단계에서는 워크플로우가 실행되지 않아 자동 스크립트 결과를 기다리지 않고, 최신 `js/main.js` blob 기준으로 직접 인벤토리를 작성했다.

## 현재 안전 상태

- inline `onclick=`: 0개 유지
- `function safeClick`: 0개 유지
- 실제 `safeClick(...)` 호출: 0개 유지
- `safeOn` 유지
- `_bindSafe` 유지
- 남은 `.onclick =` 직접 대입: 7개

## 남은 `.onclick =` 전체 목록

### 1. `lvlPill.onclick`

```js
if(lvlPill) lvlPill.onclick = ()=>{ const mul = (1 + ((Number(state.level)||0)*0.10)); showToast(`매장 레벨 효과: 전체 매출 x${mul.toFixed(2)}`); };
```

- 위치/기능: 상단 레벨 표시 pill 클릭 시 정보 토스트
- 분류: 정보성 UI
- 위험도: 낮음
- 판단: 다음 단계에서 `lvlPill.addEventListener("click", ...)`로 전환 가능

### 2. `btn.onclick` — 메뉴 연구 버튼

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

- 위치/기능: `renderRndList()` 내부 동적 생성 연구 버튼
- 분류: 동적 생성 버튼 / 상태 변경
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 버튼이 동적 렌더링마다 새로 생성되며, 전환 시 중복 바인딩/렌더링 갱신 흐름 확인 필요

### 3. `btn.onclick` — 메뉴 서빙 버튼

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

- 위치/기능: `buildMenuGrid()` 내부 동적 메뉴 버튼
- 분류: 게임 핵심 액션 / 동적 생성 버튼
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 핵심 서빙 기능이며 실제 브라우저 클릭 테스트 없이 수정하면 게임 플레이가 깨질 수 있음

### 4. `div.querySelector("button").onclick` — 업그레이드 구매 버튼

```js
div.querySelector("button").onclick = () => {
  unlockAudioOnce();
  if(typeof startBGM === "function") startBGM();
  buyUpgrade(u.id);
};
```

- 위치/기능: `renderPanel("upg")` 내부 업그레이드 구매 버튼
- 분류: 동적 생성 버튼 / 상태 변경
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 업그레이드 구매는 상태/금액/패널 재렌더링과 연결되어 있어 실제 테스트 필요

### 5. `card.querySelector(`#btn-auto-${s.key}`).onclick` — 직원 속도 업그레이드

```js
card.querySelector(`#btn-auto-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'auto');
```

- 위치/기능: 직원 개별 속도 업그레이드
- 분류: 동적 생성 버튼 / 상태 변경
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 동적 ID, 직원 수, 패널 재렌더링과 연결되어 있어 이벤트 위임 방식 검토 필요

### 6. `card.querySelector(`#btn-tip-${s.key}`).onclick` — 직원 매력 업그레이드

```js
card.querySelector(`#btn-tip-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'tip');
```

- 위치/기능: 직원 개별 매력/팁 업그레이드
- 분류: 동적 생성 버튼 / 상태 변경
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 동적 ID, 직원 수, 패널 재렌더링과 연결되어 있어 이벤트 위임 방식 검토 필요

### 7. `btn.onclick` — 연구 시작 버튼

```js
btn.onclick = ()=>{ unlockAudioOnce(); if(typeof startBGM === "function") startBGM(); startResearch(r.id); };
```

- 위치/기능: `renderPanel("res")` 내부 연구 시작 버튼
- 분류: 동적 생성 버튼 / 상태 변경
- 위험도: 높음
- 판단: 즉시 전환 보류
- 보류 사유: 연구 상태, 슬롯, 패널 재렌더링과 연결되어 있어 실제 테스트 필요

## 기능별/위험도별 요약

| 분류 | 개수 | 위험도 | 판단 |
|---|---:|---|---|
| 정보성 UI | 1 | 낮음 | 다음 단계에서 전환 가능 |
| 동적 생성 연구/메뉴 버튼 | 3 | 높음 | 이벤트 위임 설계 후 전환 |
| 업그레이드/직원 상태 변경 버튼 | 3 | 높음 | 이벤트 위임 설계 후 전환 |

## 이번 단계에서 전환하지 않은 이유

남은 7개 중 6개는 동적으로 생성되는 버튼이며, 상태 변경과 패널 재렌더링이 얽혀 있다. 특히 메뉴 서빙, 업그레이드 구매, 직원 업그레이드, 연구 시작은 게임 핵심 액션이므로 브라우저 테스트 없이 `.onclick`을 `addEventListener`로 단순 치환하면 중복 바인딩, 이벤트 누락, 렌더링 후 핸들러 유실 가능성이 있다.

따라서 Step 2-14에서는 인벤토리와 위험도 분류를 완료하고, 실제 전환은 Step 2-15에서 저위험 항목부터 별도 처리한다.

## 다음 단계 제안

### Step 2-15A

`lvlPill.onclick` 1개를 `addEventListener("click")`로 전환한다.

### Step 2-15B

`renderPanel("upg")`, `renderPanel("res")`, `buildMenuGrid()`, `renderRndList()` 내부 동적 버튼 구조를 이벤트 위임 방식으로 설계한다.

권장 방향:

- 동적 버튼에 `data-action` / `data-id` 부여
- 상위 컨테이너에 이벤트 위임 1회 바인딩
- 패널 재렌더링 시 중복 바인딩 방지

## 브라우저 테스트 필요 항목

1. 레벨 pill 클릭 토스트
2. 메뉴 버튼 서빙
3. 메뉴 연구 버튼
4. 업그레이드 구매
5. 직원 속도/매력 업그레이드
6. 연구 시작
7. 기존 쿠폰/교환/PIN/설정/통계/지역 확장 이벤트
