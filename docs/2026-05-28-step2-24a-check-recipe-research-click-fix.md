# Step 2-24A-Check Recipe Research Click Fix Verification

작성일: 2026-05-28

## 현재 상태

조리법 연구 버튼 미작동 문제에 대해 `Fix recipe research click binding` 커밋이 생성되었고, `js/main.js` 반영을 확인했다.

확인 커밋:

```text
6a4a19fbbf7842a731a1dfc0b446e7da76ccad2d
```

## 확인한 workflow

- `.github/workflows/step2-24a-recipe-research-click-fix.yml`

이 workflow는 다음을 수행하도록 구성되어 있다.

- `python3 scripts/apply-step2-24a-recipe-research-click-fix.py`
- `node --check js/main.js`
- inline onclick / `.onclick =` / safeClick 회귀 검사
- 성공 시 `Fix recipe research click binding` 커밋 생성

## Actions 실행 결과

`Fix recipe research click binding` 커밋이 생성된 것을 확인했다.

따라서 패치 스크립트 실행과 커밋 단계는 완료된 것으로 판단한다.

## 변경한 파일

- `js/main.js`
- `docs/2026-05-28-step2-24a-recipe-research-click-fix.md`
- `docs/2026-05-28-step2-24a-check-recipe-research-click-fix.md`

## 변경 내용

기존 구조:

```js
const rndListEl = document.getElementById("rndList");
if(rndListEl){
  rndListEl.addEventListener("click", ...)
}
```

변경 구조:

```js
function bindRecipeResearchClicks(){
  if(window.__recipeResearchClickBound) return;
  window.__recipeResearchClickBound = true;
  document.addEventListener("click", ..., true);
}
bindRecipeResearchClicks();
```

핵심 효과:

- `#rndList` 직접 참조에만 의존하지 않음
- document capture 단계에서 `[data-action="research-menu"]` 버튼 클릭을 감지
- `rndList` 내부 버튼인지 확인
- `unlockAudioOnce()`, `startBGM()`, `researchMenu(menuId)` 호출 유지
- 중복 바인딩 방지 플래그 추가

## 코드 검증 결과

커밋 diff 기준으로 다음을 확인했다.

- `function bindRecipeResearchClicks()` 추가
- `window.__recipeResearchClickBound` 추가
- document capture listener 추가
- `researchMenu(menuId)` 호출 유지
- `unlockAudioOnce()` 호출 유지
- `startBGM()` 호출 유지
- 기존 `rndListEl.addEventListener("click", ...)` 블록 제거

workflow에 `node --check js/main.js`와 회귀 검사가 포함되어 있으나, job 로그 원문은 이 환경에서 직접 확인하지 못했다.

## 브라우저 테스트 결과

아직 실제 브라우저 테스트는 별도 필요하다.

확인해야 할 항목:

1. 관리 리포트 열기
2. 조리법 연구 탭 이동
3. 연구 버튼 클릭
4. 돈 차감 확인
5. 조리법 레벨 증가 확인
6. `연구 완료` 토스트 확인
7. 새로고침 후 연구 레벨 유지 확인
8. 돈 부족 시 `연구비가 부족해요!` 표시 확인

## 실패한 테스트

아직 실제 브라우저 재테스트 결과가 없으므로 실패 항목은 확정할 수 없다.

## 원인 판단

기존 `#rndList` 직접 이벤트 위임은 DOM 바인딩 시점과 렌더링 흐름에 취약했다.

새 구조는 document capture 단계에서 클릭을 감지하므로 모달/탭 렌더링 후 생성된 조리법 연구 버튼도 더 안정적으로 처리할 수 있다.

## 깨질 수 있는 부분

- capture 단계에서 먼저 클릭을 잡으므로 다른 핸들러보다 먼저 실행된다.
- 대상은 `[data-action="research-menu"]`에 한정되어 있어 영향 범위는 제한적이다.
- `researchMenu(menuId)` 내부 로직이 실패하는 경우에는 별도 원인 분석이 필요하다.

## 남은 리스크

- 실제 브라우저 클릭 테스트 필요
- 돈 부족/돈 충분 두 조건 모두 테스트 필요
- `useCoupon`, `generateWeeklyCertificate`의 저장 dirty 처리 후속 점검 필요

## 다음 스텝 제안

Step 2-24B: Recipe Research Browser Retest를 진행한다.

브라우저에서 직접 조리법 연구 버튼을 눌러 돈 차감, 레벨 증가, 토스트, 저장 유지 여부를 확인한다.
