# Step 2-11 Stat Click Cleanup

- safeClick 기반 통계/정보 토스트 5개를 safeOn(document.getElementById(...), "click", ...)로 전환
- safeClick 함수 자체는 유지
- inline onclick 0개 유지
- 기존 Step 2-8~2-10 이벤트 유지
- `node --check js/main.js` 통과
