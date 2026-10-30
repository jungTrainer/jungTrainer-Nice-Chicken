# 표시 이미지 교체 목록

편집 원본은 `assets/images/catalog.json` 한 곳이다. 이번 기본 목록의 sources는 모두 비어 있어 기존 이모지·절차적 그림을 사용한다. 실제 새 그래픽은 등록하지 않았다.

예: 파일을 `assets/images/menu/fried.png`에 넣고 해당 항목을 다음처럼 편집한다.

```json
"menu.fried": {
  "sources": ["assets/images/menu/fried.png"],
  "fit": "contain",
  "anchor": [0.5, 0.5]
}
```

`npm run pwa:build` 후 `npm run check`와 자산/브라우저 검사를 실행하고, JSON·그림·생성된 `js/media/catalog.js`·`index.html`·`sw.js`를 함께 커밋한다. 생성된 JS는 직접 편집하지 않는다. 같은 파일명으로 그림을 교체해도 해시/PWA 버전이 바뀐다.

| 표시 ID | 연결 범위 |
| --- | --- |
| character.boss | 사장님 그림 |
| staff.<직원 key>, staff.grandson.robot | 직원6명·가족 엔딩 로봇 표시 |
| menu.<메뉴 id> | 해금된 메뉴 버튼의 장식 이미지 |
| customer.<별칭>, customer.default | 저장된 손님 이모지의 표시용 별칭/기본값 |
| vehicle.0~10 | 기존 이동수단/이모지의 표시용 별칭 |
| signboard.0~9 | 현재 간판 단계 전체 그림 |
| background.<지역 id> | 지역 배경, 기본 fit은 cover |

PNG/JPG/JPEG/WebP/SVG를 지원한다. 경로는 assets/images 아래의 상대 경로만 허용하며 URL·query·경로 탈출을 허용하지 않는다. 후보는 최대4개, fit은 contain/cover, anchor는0~1의 두 값이다. 원본8MiB·디코드16M픽셀 이내이고 fetch/디코드에는 각각10초 제한이 있다. 디코드 예산은 파일별이며 전체 캐시의 총 메모리 예산은 아니다.

비어 있거나 누락된 후보·404·오프라인·잘못된 MIME/해시·디코드 실패에는 원래 그림을 사용한다. 파일이 없는 빌드는 hash:null인 선택 자산으로 고정하고 해당 버전에서는 임의로 새 파일을 받지 않는다. 파일 추가 뒤 반드시 다시 빌드한다. 이미지 실패가 필수 앱 셸 설치를 실패시키지 않는다.

캐시는 문서별 path+hash를 공유한다. 실패는 프레임마다 재요청하지 않는다. 새로고침이나 개발자의 `ImageAssets.retry(id)`로 재시도하며, 이미 실패한 메뉴 mount는 다시 mount해야 한다. 자동 온라인 감시·재시도 loop는 없다. 메뉴는 원래 글자를 정상 흐름에 남기고 pointer-events:none인 장식 canvas만 겹친다. 지점 이동/import/reset으로 분리된 노드와 이전 mount token에는 늦은 그림을 붙이지 않는다.

배경은 매 프레임 기존 배경을 먼저 그려 투명/contain 여백에 이전 프레임이 남지 않게 한다. 캐릭터/간판은 준비된 그림이 있을 때 해당 그림 영역을 대체한다. 파일의 자연 크기로 터치 영역이나 배치를 바꾸지 않는다.

기준 커밋에 실제 구 간판 후보 파일은 없었다. config의 SIGN_IMAGES/candidates 이름은 호환상 남지만 활성 로더/캐시는 공통 창구 하나다. 구 후보 경로를 자동 탐색하지 않으며 새 그림은 이 목록에 등록한다. UI 아이콘·연구/통계·인증서·엔딩 PNG와 오디오는 아직 연결하지 않았다. 외부 참조 없는 정적 그림을 사용하고 실제 그래픽 도입 시 메모리/DPR·크롭·접근성/음질을 별도로 점검한다.
