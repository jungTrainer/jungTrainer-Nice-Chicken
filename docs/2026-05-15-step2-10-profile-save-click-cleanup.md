# Step 2-10 Profile/Save Click Cleanup

- profile/offline/save/reset/sound 계열 `.onclick =` 직접 대입 제거
- 대상 5개를 `addEventListener("click")` 1회 바인딩으로 전환
- 구형 중복 블록은 주석 처리
- inline onclick 0개 유지
- 기존 지역 확장 및 Step 2-8/2-9 이벤트 유지
- `node --check js/main.js` 통과
