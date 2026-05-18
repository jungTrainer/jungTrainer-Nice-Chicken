# Step 3-3 Utils Module Split

작성일: 2026-05-15

## 변경 내용

- 순수 유틸/호환 helper를 `js/core/utils.js`로 분리했다.
- `index.html` script 순서를 `utils.js` → `audio.js` → `main.js`로 정리했다.
- `js/core/audio.js`의 임시 `document.write()` loader를 제거했다.
- ES module 전환 없이 classic script/global 호출 호환성을 유지했다.

## 분리된 함수

- `fmtKoreanUnits()`
- `fmtWon()`
- `fmtNoWon()`
- `fmtCompactWon()`
- `fmtCompact()`
- `clamp()`
- `clampInt()`
- `dayKey()`
- `nowK()`
- `isHangulOnly()`
- `safeOn()`
- `_bindSafe()`

## 검증

- `node --check js/core/utils.js`
- `node --check js/core/audio.js`
- `node --check js/main.js`
- inline `onclick=` 0개 유지
- `.onclick =` 0개 유지
- `function safeClick` 0개 유지
- 실제 `safeClick(` 호출 0개 유지

## 남은 리스크

- 브라우저에서 포맷 표시, 메뉴/미션/지도 화면의 금액 표기 확인 필요.
- canvas click/touch에서 `safeOn`, `clamp`, `clampInt` 전역 참조 정상 동작 확인 필요.
- Step 2-23 저장 안정화는 여전히 미완료 상태.
