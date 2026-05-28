# Step 2-24B Recipe Research Browser Retest

작성일: 2026-05-28

## 현재 상태

조리법 연구 버튼 미작동 문제에 대해 `Fix recipe research click binding` 커밋이 생성되었고, `js/main.js`에 `bindRecipeResearchClicks()`가 반영된 상태다.

확인 커밋:

```text
6a4a19fbbf7842a731a1dfc0b446e7da76ccad2d
```

## 코드 검증 결과

GitHub 커넥터로 확인한 결과:

- 기존 `rndListEl.addEventListener("click", ...)` 기반 클릭 블록은 제거됨
- `function bindRecipeResearchClicks()` 추가됨
- `window.__recipeResearchClickBound` 중복 바인딩 방지 플래그 추가됨
- document capture 단계에서 `[data-action="research-menu"]` 클릭을 감지함
- `unlockAudioOnce()`, `startBGM()`, `researchMenu(menuId)` 호출 유지됨

이 환경에서는 실제 `node --check js/main.js` 명령을 직접 실행하지 못했다. 다만 해당 명령은 Step 2-24A workflow에 포함되어 있다.

## 브라우저 테스트 결과

실제 브라우저 클릭 테스트는 아직 이 환경에서 직접 수행할 수 없다.

아래 항목은 로컬/실기기 브라우저에서 확인해야 한다.

| 번호 | 테스트 항목 | 결과 |
|---|---|---|
| 1 | 게임 접속 | 미실행 |
| 2 | 관리 리포트 열기 | 미실행 |
| 3 | 조리법 연구 탭 이동 | 미실행 |
| 4 | 연구 버튼 클릭 | 미실행 |
| 5 | 돈 차감 확인 | 미실행 |
| 6 | 조리법 레벨 증가 확인 | 미실행 |
| 7 | `연구 완료` 토스트 확인 | 미실행 |
| 8 | 새로고침 후 연구 레벨 유지 확인 | 미실행 |
| 9 | 돈 부족 상태에서 `연구비가 부족해요!` 표시 확인 | 미실행 |

## 실패한 테스트

브라우저 테스트가 아직 실행되지 않았으므로 실패 항목은 확정할 수 없다.

## 원인 판단

기존 구조는 `#rndList` 직접 이벤트 위임에 의존했다.

조리법 연구 버튼은 `renderRndList()`에서 동적으로 생성되므로, 바인딩 시점이나 모달/탭 렌더링 흐름이 어긋나면 클릭이 `researchMenu(menuId)`까지 도달하지 않을 수 있었다.

새 구조는 document capture 단계에서 `[data-action="research-menu"]` 클릭을 감지하므로 동적 렌더링 버튼에도 더 안정적이다.

## 변경한 파일

이번 Step 2-24B에서 코드 파일은 추가 수정하지 않았다.

추가한 문서:

- `docs/2026-05-28-step2-24b-recipe-research-browser-retest.md`

## 변경 내용

- Step 2-24A 적용 상태 정리
- 브라우저 재테스트 항목 정리
- 실패 시 원인 분기 기준 정리

## 실패 시 확인 기준

브라우저에서 여전히 작동하지 않으면 다음 순서로 확인한다.

1. `[data-action="research-menu"]` 버튼이 실제 DOM에 있는지 확인
2. `data-menu-id` 값이 정상인지 확인
3. `bindRecipeResearchClicks()`가 호출됐는지 확인
4. document capture handler가 버튼 클릭을 잡는지 확인
5. `researchMenu(menuId)`가 호출되는지 확인
6. `MENUS.find(x=>x.id === menuId)`가 정상 반환되는지 확인
7. `state.menuLevels`가 정상 초기화되어 있는지 확인
8. 돈 부족 조건이 아닌지 확인

## 깨질 수 있는 부분

- capture 단계에서 먼저 클릭을 잡기 때문에 다른 클릭 핸들러보다 먼저 실행된다.
- 대상은 `[data-action="research-menu"]`에 한정되어 있어 영향 범위는 제한적이다.
- `researchMenu(menuId)` 내부 로직이 실패하는 경우 클릭 핸들러가 아닌 내부 상태 문제로 분리해야 한다.

## 남은 리스크

- 실제 브라우저 클릭 테스트 필요
- 돈 충분/돈 부족 두 조건 모두 확인 필요
- 새로고침 후 연구 레벨 저장 유지 확인 필요
- `useCoupon`, `generateWeeklyCertificate` 저장 dirty 처리 후속 점검 필요

## 다음 스텝 제안

Step 2-24C: Recipe Research Runtime Debug를 준비한다.

브라우저 테스트에서 여전히 실패하면 임시 디버그 로그를 추가해 클릭 핸들러 도달 여부와 `researchMenu(menuId)` 내부 분기를 분리한다.
