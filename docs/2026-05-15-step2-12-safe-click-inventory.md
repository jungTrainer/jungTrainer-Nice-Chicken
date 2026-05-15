# Step 2-12 SafeClick Inventory

작성일: 2026-05-15

## 요약

- `safeClick` 함수 선언 수: 1
- `safeClick` 실제 호출 수: 0
- `safeOn` 사용 수: 증가 확인
- inline `onclick=` 수: 0 유지
- `node --check js/main.js`: 통과 대상 유지

## safeClick 사용처 분류

- 실제 호출 없음

## safeClick 실제 호출 목록

- 없음

## 확인 내용

Step 2-11까지 진행된 결과, 기존 통계/정보 토스트 계열 `safeClick("stat...")` 호출은 모두 `safeOn(document.getElementById(...), "click", ...)` 방식으로 전환되었다.

현재 `js/main.js`에는 아래 함수 선언은 남아 있다.

```js
function safeClick(id, fn){ const el = document.getElementById(id); if(el) el.onclick = fn; }
```

하지만 현재 확인 기준으로 `function safeClick` 선언을 제외한 실제 `safeClick(...)` 호출은 없다.

## 판단

- Step 2-12에서는 추가 기능 변경 없이 safeClick 사용처 인벤토리를 확정했다.
- safeClick 실제 호출이 0개이므로 다음 단계에서 `safeClick` 함수 자체를 제거할 수 있다.
- 단, 함수 제거 전 전체 `js/main.js`에서 `safeClick(` 검색을 한 번 더 수행해야 한다.

## 다음 단계 권장

1. Step 2-13에서 `safeClick` 함수 선언 제거를 진행한다.
2. 제거 후 `.onclick =` 직접 대입 개수를 다시 계산한다.
3. `node --check js/main.js`를 실행한다.
4. 브라우저에서 통계 정보 토스트, 설정, 쿠폰, 교환, 저장, PIN, 지역 확장 모달을 확인한다.
