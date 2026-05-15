# Step 2-5 main.js 분리 보고서

작성일: 2026-05-15

## 결과

- `index.html`의 핵심 애플리케이션 JavaScript를 `js/main.js`로 분리했다.
- 첫 분리에서는 `type=module`을 사용하지 않았다.
- 첫 분리에서는 `defer`를 추가하지 않았다. 기존 script 위치에서 실행 순서를 유지했다.
- splash auto-hide script는 부팅 안전망 성격이라 inline으로 유지했다.
- service-worker disabled placeholder script는 작은 inline script로 유지했다.

## 검증

- `node --check js/main.js` 통과
- `index.html`에 `<script src="./js/main.js"></script>` 1개 생성
- 핵심 main application inline script block 제거

## 브라우저 확인 필요

1. 게임 부팅
2. 스플래시 자동 제거
3. 캔버스 렌더링
4. 손님 선택/서빙
5. 지역 확장 모달 열기/닫기
6. mapGo/mapUnlock 동작
7. 저장/불러오기
