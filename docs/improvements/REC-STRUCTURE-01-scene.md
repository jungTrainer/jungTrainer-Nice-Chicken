# 복구-구조-1 · 장면 렌더링 분리

2026-10-30(한국 시간). 기준은 출시 main `c66d96ff0837ced8c5fe361af82cdcc47a0cd382`, 작업 브랜치는 `recovery-structure-1`이다. 새 체크아웃 `/workspace/nice-chicken-recovery-structure-1`에서 새로 구현·검증했다. main 병합·배포·실제 혜택/운영 변경은 하지 않는다.

## 변경과 근거

| 파일 | 역할 |
| --- | --- |
| scene/layout.js | 문·서빙/대기열·보스/직원 위치·충돌/도형 helper |
| scene/effects.js | 기존 FX 기본값·일시 텍스트/입자·클릭/보스 연출 |
| scene/signboard.js | 기존 이미지 후보 로딩·fallback·간판 그리기 |
| scene/background.js | 배경/소품·분위기·결정적 난수/기존 캐시 |
| scene/characters.js | 보스/직원/손님·말풍선·라이더 표시 |
| scene/render.js | 기존 레이어 순서와 save/restore 격리 |

함수48개 전체와 버퍼 선언은 원문 그대로 이동했고, main에 남은49함수도 같다. main은 **4,409→2,426줄**이다. 입력/버프 발동·구매·고객 진행·패널/지도/HUD·tick/frame은 main, 사업/저장·서비스/연구·엔딩/오디오는 기존 core가 소유한다. 함수 복사 중복이나 실행 중 교체 래퍼가 없다. [원문 비교](verification/REC-STRUCTURE-01-equivalence.json), [소유권/순서](../runtime-architecture.md).

클래식 script는 services 뒤, main/boot 앞에 정의한다. 설치 시 기존 일시 객체/버퍼만 만들며 DOM/state/미디어를 읽거나 listener/loop를 추가하지 않는다. main의 중복 FX 초기값2개는 실제로 남는 두 번째 객체1개로 정리했다. 두 대입 사이에는 boot/사용자 입력 실행이 없으며 효과 값과 키 순서를 보존한다. _bossAnim.t0의 평가 위치는 앞당겨지지만 현재 읽는 코드가 없는 값이다. 실제 시각/버프·입자/문자 계산은 동일하다.

SIGN_IMAGES/candidates는 config에 남고 boot의 preload 호출·누락 순서·그림 fallback을 유지한다. visualRiders/서비스 타이머·연구 간격 캐시는 services에 남는다. 기존에 활성 호출이 없는 소품 helper도 새로 활성화하지 않았다. CSS·자산·이모지·음원·게임/저장/쿠폰 규칙은 바꾸지 않았다.

## 새 검증

검사 결과는 [검증 요약](verification/REC-STRUCTURE-01-results.json)에 기록한다. 기준 c66d96f를 별도 불변 디렉터리에 추출해 doctor/check와 **기존422개 전부 통과**를 새로 확인했다. 새17개도 개별 통과했다. **최종 전체439개 통과, 실패/취소/건너뜀0**이며 약392초다. `pwa:build`·`doctor`·`check`(문법47개/생성물 일치)도 통과했다. production PWA 버전은 `imp12-4c50bc713a5b972f47f9`다. 과거505/520개나 예전 캡처를 이번 결과로 간주하지 않는다.

- 정적/VM: 단일 정의·소유권/boot 순서·필수 파일/SRI·48함수 원문·버퍼/최종 FX 기본값, DOM/상태 없는 설치.
- 실제 Chromium: 360/390px 6지역 표시/Canvas 격리·직원6명 터치·일시 효과 소멸·손님/메뉴 실제 서빙1회·재접속, 지점 이동·백업/export/import/reset·확정 미수령/쿠폰 보존.
- 실제 SW: 온라인→오프라인 재접속·대기 업데이트 적용, 신규6파일 각각 누락 설치 거절→명시 수리·이전 혜택 보존. c66d96f의 실제 HTML/main/SW에서 필수27→33파일로 적용/오프라인 재접속한 별도1건도 통과했다. [기록](verification/REC-STRUCTURE-01-pwa-upgrade.json). B의 fixture 표식 때문에 production 해시와 다르다.
- 전후32쌍/64 PNG·DOM·배치가 전부 같고 state/본 저장/backup/dirty/서비스 캐시를 유지했다. [캡처](../screenshots/recovery-structure-1/README.md). 캡처8건과 별도 PWA 이행1건은 전체439개에 합산하지 않는다.
- 최초 제한 샌드박스는 브라우저 socket을 거절했다. 허용된 실행 방식에서 동일 브라우저로 재검증했으며 검사를 비활성화하지 않았다. 기본 원격 조회도 proxy 연결을 거절했지만 허용된 실행 방식에서 기존 프록시/인증 그대로 Git 읽기에 성공했다.

## 보관과 한계

현재 환경에서 이전 로컬 구조-1~5 커밋과 구조-6 스테이징도 다시 발견했다. 원본 작업 공간의 상태/패치를 보존·비교하고 별도 bundle/patch로 묶었다. 이번 구현에는 그 작업 트리를 덮어쓰거나 예전 결과를 복사하지 않았다. 원본의 구조-6 완료/전체520개 통과를 새로 주장하지 않는다.

코드 커밋 `04bf0f011a3aec8ede6da0443f9d74039375d436`을 [origin/recovery-structure-1](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/tree/recovery-structure-1)에 push하고 원격 SHA 일치를 확인했다. 원격 main은 `c66d96f` 그대로다. 이후 문서 커밋으로 브랜치 HEAD가 전진할 수 있으며 최종 SHA는 완료 응답에 기록한다. 클라우드 경로에 산출물이 있는 것만으로 외부 백업 완료라 하지 않는다. 실기기·스크린리더·Firefox/WebKit 및 사람의 음질 평가는 미검증이다. 원격 CI 결과는 로컬 검증과 구분한다.

## 다음 작업

메뉴/패널·지도/리포트/HUD·입력/진행은 main에 남는다. 다음은 표시용 이미지 ID 목록·공통 로더/캐시를 도입하고 장면/메뉴와 연결하되, 기존 이모지/그림을 fallback으로 유지하는 단계다. 실제 새 그래픽·오디오 교체는 별도다.

```text
origin/recovery-structure-1의 완료 커밋을 기준으로
 docs/runtime-architecture.md와 docs/improvements/REC-STRUCTURE-01-scene.md를 읽고
‘복구-구조-2 이미지 교체 기반’을 구현해줘.

표시용 이미지 목록·공통 로더/캐시를 도입하고 장면/메뉴가 참조하도록 연결해줘.
기존 이모지·그림을 기본값으로 유지하고 누락/오프라인/디코드 실패에는 fallback해줘.
지연 로딩이 게임 상태·저장/dirty·보상·입력 영역을 바꾸지 않게 해줘.
정산·쿠폰/paid/이력·직원/지점·서비스/연구·타이머·엔딩·모달/단일 작성자·PWA를 보존해줘.
현재439개와 새 자산 검사, 실제 Chromium 전후 화면·입력·재접속·PWA 오프라인/업데이트,
pwa:build·doctor·check·test를 검증해줘. 과거 검사/완료 이력을 추정 복원하지 마.
실제 새 그래픽 교체·오디오 개편·패널/지도/HUD 분리는 후속으로 남겨줘.
별도 recovery-structure-2 브랜치에서 커밋하고 해당 작업 브랜치만 origin에 push해줘.
push 실패 시 검증 가능한 bundle/필요 patch를 다운로드 산출물로 제공해줘.
완료보고·보관 결과·남은 문제·다음 프롬프트를 남겨줘.
main 병합·배포·실제 혜택 사용·운영 변경은 하지 마.
```
