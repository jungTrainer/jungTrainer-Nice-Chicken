# Step 3-3 Trigger

작성일: 2026-05-15

사용자가 빠른 실제 적용을 요청했으므로, `Expansion Event Cleanup Steps` workflow의 push trigger를 유도하기 위해 생성한 문서다.

현재 workflow는 Step 3-3 utils split을 실행하도록 설정되어 있다.

기대 결과:

- `Split utility helpers into core module` 커밋 생성
- `js/core/utils.js` 생성
- `index.html` script 순서가 `utils.js` → `audio.js` → `main.js`로 변경
- `js/main.js`에서 utils 함수 선언 제거
- `docs/2026-05-15-step3-3-utils-split.md` 생성

저장 안정화 Step 2-23은 여전히 미완료 리스크로 유지한다.
