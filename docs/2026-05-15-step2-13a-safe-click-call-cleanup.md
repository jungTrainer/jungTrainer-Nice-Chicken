# Step 2-13A safeClick 호출 전환 보고

작성일: 2026-05-15

## 변경 내용

- `safeClick("openSettings", ...)`를 `safeOn(document.getElementById("openSettings"), "click", ...)`로 전환했다.
- `safeClick("openStats", ...)`를 `safeOn(document.getElementById("openStats"), "click", ...)`로 전환했다.
- `safeClick("closeStats", ...)`를 `safeOn(document.getElementById("closeStats"), "click", ...)`로 전환했다.
- `function safeClick` 선언은 Step 2-13A에서는 유지했다.

## 전환 전

- safeClick("openSettings": 1
- safeClick("openStats": 1
- safeClick("closeStats": 1
- function safeClick 선언: 1
- inline onclick: 0

## 전환 후

- safeClick("openSettings": 0
- safeClick("openStats": 0
- safeClick("closeStats": 0
- safeOn openSettings: 1
- safeOn openStats: 1
- safeOn closeStats: 1
- function safeClick 선언: 1
- inline onclick: 0
- node --check js/main.js 통과

## 다음 단계

Step 2-13B에서 전체 `safeClick(` 실제 호출이 0개인지 재확인한 뒤 `function safeClick` 선언을 제거한다.
