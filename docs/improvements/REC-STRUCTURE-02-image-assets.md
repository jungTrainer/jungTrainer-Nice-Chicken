# 복구-구조-2 · 이미지 교체 기반

2026-10-30(한국 시간). 기준은 origin/recovery-structure-1의 `0274d0e0e107c63128f18f6b489f9c4780728d61`, 작업 브랜치는 `recovery-structure-2`다. 기존 작업 경로 `/workspace/nice-chicken-recovery-structure-1`에서 브랜치만 전환했다. 실제 새 그래픽·음원 교체, main 병합·배포·실제 혜택 사용/운영 변경은 하지 않는다.

## 변경 방법

| 파일 | 역할 |
| --- | --- |
| assets/images/catalog.json | 표시 ID·후보 파일·fit/anchor·이모지 별칭을 편집하는 단일 목록 |
| scripts/image-catalog.cjs | 빌드 입력/경로·크기·별칭 검사, 해시/MIME·브라우저 목록 생성 |
| js/media/catalog.js | pwa:build 생성 불변 목록, 직접 편집하지 않음 |
| js/media/images.js | 공통 fetch/검증/디코드 캐시·Canvas 표시·늦은 메뉴 mount 차단 |
| scene/signboard/background/characters.js, main.js | 기존 그림/배치와 공통 목록 사이의 표시 어댑터 |

core/services 뒤·scene 앞에 목록/로더를 정의한다. 설치 중 DOM/state/네트워크/미디어를 읽거나 새 입력/게임 loop를 설치하지 않는다. 기본 sources가 모두 비어 있어 새 그림을 요청하지 않고 기존 화면을 유지한다. 실제 색상 SVG는 임시 검사 fixture에만 만들고 앱에는 등록하지 않았다. [편집 방법/ID](../../assets/images/README.md), [정의/호출/소유권](../runtime-architecture.md).

캐시 key는 path+hash이며 같은 파일을 장면/메뉴가 한 번 디코드해 공유한다. 파일8MiB·디코드16M픽셀 제한, same-origin/MIME/SHA-256 검사, fetch/전체decode 각10초 deadline을 적용한다. 성공 Image와 실패/null을 메모리 캐시에만 보관하고 Blob URL과 timeout handle은 정리한다. 실패 후 프레임/조회마다 재요청하지 않는다. 새 문서 또는 명시 retry로 복구하며 이미 끝난 메뉴 mount는 다시 mount한다.

메뉴의 원래 emoji 텍스트는 정상 흐름에 남고 장식 canvas만 겹친다. pointer-events:none/aria-hidden이므로 실제 버튼·크기·포커스·터치 영역은 유지한다. isConnected/WeakMap token으로 지점 이동/import/reset 후 옛 노드·이전 mount의 늦은 응답을 무시한다. 배경은 기존 그림을 먼저 채우고 이미지를 덧그려 투명/contain 여백에 이전 프레임이 남지 않게 한다. 이미지 callback에는 상태·dirty/저장·수익/보상·서비스/연구 갱신이 없다.

main48함수·scene39함수와 core21파일, CSS/음원/manifest는 동일하다. 메뉴1함수·scene9함수의 표시만 수정했고, 기존 구조 검사는 그9개 어댑터만 별도 hash로 고정했다. 단일 정의와 나머지 원문/버퍼 검사는 유지했다. [비교 기록](verification/REC-STRUCTURE-02-equivalence.json). 저장 schema와 정산/쿠폰/paid/이력·직원/지점·타이머·입력·엔딩·단일 작성자/복구 규칙은 바꾸지 않았다.

## PWA와 실패

필수 catalog/loader2개를 추가해 외부 scripts30/필수35, 기본 선택6이다. 등록한 그림만 중복 제거해 선택 목록에 더한다. 누락 파일은 hash:null로 고정하고 해당 버전에서 임의의 미래 파일을 받지 않는다. 같은 파일명 교체도 목록/SRI/SW 버전을 바꾼다. 목록 JSON은 빌드 원본이며 런타임이 새 JSON을 따로 받아 섞지 않는다.

필수 JS 누락은 기존 셸을 유지하며 업데이트를 거절한다. 선택 그림의404/잘못된 해시/디코드 실패는 셸 설치·운영을 막지 않고 기존 그림을 사용한다. PWA 대기/명시 적용·저장 성공 후 reload·살아 있는 문서 버전 보존과 구 셸/저장 정리 정책은 그대로다.

## 검증

[최종 검증 요약](verification/REC-STRUCTURE-02-results.json)에 결과를 기록한다. **기존439개＋새 자산25개, 전체464개 통과, 실패/취소/건너뜀0**이다. 약396초이며 `pwa:build`·`doctor`·`check`(문법51개/생성물 일치)도 통과했다. production PWA 버전은 `imp12-5f37a8a1c1abe2f85609`다. Node24.19.0·Playwright1.62.1·Chromium151.0.7922.34를 사용했다.

- 선별42개(새24+기존장면17+생성물1) 통과 후, 배경 보완과 새1개를 더한 런타임/기존장면23개도 통과했다. 전체 집계는 최종 검사만 사용한다.
- Node/VM: 경로/별칭/후보/fit/anchor·symlink 탈출·8MiB 제한, 같은 이름 교체의 버전 변경·read-only check, MIME/중복 제거·누락 hash:null, DOM/상태 없는 설치·기본 mount 불변, 멈춘 Image.decode의 deadline/실패 cache/URL 해제.
- 실제 Chromium: 공유 디코드·실패/명시 retry·후보 순서, 실제 이미지 픽셀/투명 여백 잔상, 360/390px 지연 메뉴의 크기/포커스/터치·state/원 저장/backup/dirty/서비스·배치 불변, 실제 지점 이동/재접속·백업/import/reset 후 늦은 응답 차단.
- 실제 SW: 같은 이름의 A 빨강/B 파랑이 오프라인/대기 중에는 A로 유지되고 명시 적용 뒤 B로 바뀜, 선택 이미지404/해시/디코드 실패에도 셸 운영, 필수 catalog/images 각각 누락→거절/수리. 실제0274d0e 셸에서 필수33→35로 적용하고 오프라인 재접속한 별도1건도 통과했다. [기록](verification/REC-STRUCTURE-02-pwa-upgrade.json). B에는 검사 표식이 있어 production 해시와 다르다.
- 기본 목록 전후32쌍/64 PNG·DOM·배치 모두 같고 캡처 전후 상태/본 저장/backup/dirty/서비스 캐시도 같았다. [캡처](../screenshots/recovery-structure-2/README.md). 캡처8건과 이전→신규1건은 전체464개에 합산하지 않는다.
- 별도 실제 투명 SVG1건에서도 불투명 픽셀 대체·투명 부분의 기본 배경 복원·이전 녹색 픽셀 제거와 state/저장/서비스 불변을 확인했다. [픽셀 기록](verification/REC-STRUCTURE-02-transparency.json), [재현 probe](verification/REC-STRUCTURE-02-transparency-probe.cjs). `node --test docs/improvements/verification/REC-STRUCTURE-02-transparency-probe.cjs`로 재현하며 전체464개에는 합산하지 않는다.
- 기존 검사 변경은 스크립트/필수 개수28/33→30/35, 이미지 어댑터9개 hash 고정과 테스트 fixture의 assets 복사·MIME·선택적 root/prepare hook이다. 기존 동작 assertion은 제거/완화하지 않았다.

## 보관과 남은 문제

연결 중단 전의 구현/42개 통과 기록을 실제 파일로 확인해 이어갔다. 진행본 patch도 만들었으며 경로에 파일이 있다는 이유로 외부 백업 완료라고 주장하지 않는다. 코드 커밋 `82db7632f9f51b72be4fef3aca9a5ad72208091b`을 [origin/recovery-structure-2](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/tree/recovery-structure-2)에 push하고 원격 SHA 일치를 확인했다. 원격 main은 `c66d96f` 그대로다. 이후 문서 커밋으로 브랜치 HEAD가 전진할 수 있으며 최종 SHA는 완료 응답에 기록한다.

실기기·스크린리더·Firefox/WebKit·실제 제작 이미지의 총 메모리/DPR/크롭 품질·사람의 음질은 미검증이다. 캐시는 문서 수명 동안 유지하고 자동 온라인 재시도/전체 메모리 LRU는 아직 없다. 실패는 기존 표시로 계속 운영하며 reload/명시 retry로 재시도한다. SVG 내용 정화기는 아니므로 신뢰하는 정적 자산을 등록한다. 기준에는 실제 구 간판 후보 파일이 없었고, config의 옛 SIGN_IMAGES/candidates 바인딩은 호환상 남지만 자동 파일 탐색/활성 캐시로 쓰지 않는다.

이미지의 실제 교체·UI/연구/통계/인증서/엔딩 그림·오디오 개편·패널/지도/HUD 분리는 후속이다. 다음은 기존 기본 소리와 호출을 유지한 음원 목록·로더/재생 창구다.

## 복구-구조-3 시작 프롬프트

```text
origin/recovery-structure-2의 완료 커밋을 기준으로
docs/runtime-architecture.md, docs/improvements/REC-STRUCTURE-02-image-assets.md,
js/core/audio.js와 js/core/ending.js를 읽고
‘복구-구조-3 사운드 교체 기반’을 구현해줘.

효과음·BGM·엔딩 음악의 재생/중지·음소거·페이드·취소 경로부터 분석해줘.
음원 목록·공통 로더/캐시·단일 재생 창구를 도입하되 기존 호출과 기본 소리를 유지해줘.
실제 새 음원 교체는 분리하고 실패/오프라인이 게임·엔딩을 막지 않게 해줘.
음원/재생 핸들은 저장하지 말고 soundOn·단일 BGM·입력 해제·취소 규칙을 보존해줘.
정산·저장/복구·쿠폰/paid/이력·직원/지점·서비스/연구·이미지 캐시·단일 작성자·PWA를 유지해줘.
기존464개와 새 오디오 검사, Chromium 입력·음소거·숨김/복귀·재접속·엔딩 취소·
PWA 오프라인/업데이트, pwa:build·doctor·check·test를 검증해줘.
사람의 음질 평가는 자동 검사와 구분해줘.
별도 recovery-structure-3 브랜치에 커밋하고 해당 브랜치만 origin에 push해줘.
push 실패 시 bundle/필요 patch를 다운로드 산출물로 제공해줘.
완료보고·보관 결과·남은 문제·다음 프롬프트를 남겨줘.
main 병합·배포·실제 혜택 사용·운영 변경은 하지 마.
```
