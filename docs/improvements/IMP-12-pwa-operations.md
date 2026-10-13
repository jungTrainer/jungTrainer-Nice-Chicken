# IMP-12: PWA 설치·셸·안전한 업데이트·정적 운영

2026-10-13 (한국 시간). 기준 `origin/improvement-imp11-20261013`, `c427ecf7c85a04ed05b6e85b52323031738c43bb`. 보관 브랜치 `improvement-imp12-20261013`, [Draft PR #6](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/pull/6), 리뷰 대상 IMP-11. main 병합·Pages 배포·실제 혜택 사용/운영 데이터 변경은 수행하지 않았다.

## 분석과 구현

기존 HTML은 manifest와 워커 등록을 꺼 두었다. 남은 v1 워커는 HTML/아이콘만 캐시하여 오프라인 JS/CSS가 없고, 고정 버전·전역 캐시 삭제 정책도 있었다. 간판 원본은 없으며 그리기 fallback, 엔딩 이미지/음원은 원본이 있었다. Pages API는 legacy/main/루트/HTTPS와 `errored` 상태를 확인했다. 쿠폰 사용은 공개 PIN `0000`과 LocalStorage였고 사용자도 백엔드/인증/운영 담당자가 없음을 확인했다. [분석 기록](verification/IMP-12-before.json), [PWA 정책](../pwa-operations.md), [서버 조건](../coupon-server-contract.md)을 먼저 작성했다.

- manifest를 연결하고 기존 start_url/scope를 상대 경로로 유지했다. 설치 id는 기존처럼 start_url에서 계산한다. 상대 id가 origin 기준으로 처리되는 Pages 충돌을 피하고 기존 설치 식별자를 보존했다. 설치 prompt가 있을 때만 버튼을 켜며 없는 플랫폼은 브라우저 메뉴/홈 화면을 안내한다.
- `scripts/build-pwa.cjs`와 `npm run pwa:build`가 HTML·JS 19개·CSS·manifest·아이콘의 셸 24종을 콘텐츠 버전/전체 SHA-256으로 고정하고 HTML JS/CSS에 SRI를 넣는다. `npm run check`는 생성물 누락/변경을 읽기 전용으로 거부한다. 문서/검사 변경은 버전을 바꾸지 않는다.
- 워커는 필수 응답의 상태/MIME/해시를 모두 확인한 후 캐시한다. 엔딩 미디어 6종은 별도 선택 경로로 처리하여 404/다운로드/저장 실패가 셸 설치를 막지 않는다. 없는 간판/외부 폰트는 기존 그리기/기본 폰트 fallback을 사용한다. 요청은 10초 제한이다.
- 제어된 navigation·JS/CSS는 동일 워커의 셸에서 반환한다. 필수 캐시가 없으면 503을 반환하며 다른 버전의 네트워크 코드로 대체하지 않는다. 최초 제어 전에도 SRI가 서로 다른 코드의 실행을 막는다. 실패 업데이트는 새 후보만 폐기하고 현재 워커/캐시/게임을 유지한다.
- `PwaRuntime`은 기존 설정 모달에서 설치/현재 버전/업데이트 확인·적용을 관리한다. 워커는 자동 skipWaiting/재로딩을 하지 않는다. 사용자가 엔딩·PIN·다른 표면과 백업 입력을 마치고 같은 scope의 다른 창을 닫은 뒤 강제 저장에 성공해야 적용한다. 직전 조건/창 수/버전을 다시 확인하고, 해당 controllerchange에서 한 번 재접속한다. 적용 중 tick과 입력은 잠시 중단하며 실패/전환 지연에는 해제한다.
- 오프라인 boot는 기존 registration을 사용한다. 초기 설치가 실패하여 Chrome이 등록을 없애면 확인 버튼에서 재등록한다. 설치 버전과 열린 페이지 버전이 다른 초기 실패 복구는 백업 후 창을 닫고 다시 여는 안내를 제공한다. 강제 저장 실패에는 기존 진행/dirty/미수령을 유지하며 다시 적용할 수 있다.
- 쿠폰·인증서·PIN 화면/사용 확인/새 로컬 로그·인증서 그림에 서버/매장 인증이 아니라는 한계를 표시했다. 기존 수량/지급·사용 기록·공개 PIN의 기기 동작은 유지한다. `scripts/coupon-contract.cjs`는 앱에 연결하지 않은 순수 제안 계약 검사다. request/receipt 상관관계·권한/충돌/만료·불명확 결과 정책만 검증하며 네트워크/서버 인증/DB 원자성의 구현이라고 표현하지 않는다.

## 저장·정산·서비스 보존

저장 키·schema/encoding·원 단위 정산 공식과 성장 수치는 그대로다. 캐시/대기 워커/설치 prompt/적용 flag는 사업 상태 밖이다. 기존 `save(true)`가 활성 서비스 진행과 branch snapshot을 저장하며 적용은 그 성공 이후에만 진행한다. 금액·미수령의 확정 내역·지급 완료 미션/인증서·쿠폰·엔딩 1회 효과·직원 6명·본사/지점 소유권·운영/메뉴/담당자/읽음·연구 캐시를 새로 계산하거나 이전시키지 않는다. 과거 수익을 보정하지 않았다.

창 닫기·설치·버전 확인은 수령/추가 보상을 하지 않는다. 설정 안내가 기존 백업 UI의 `.note` 선택에 들어오는 문제를 발견해 직접 자식 note만 삽입 기준으로 선택했다. 새 모달/게임 루프/사업 저장 감시를 설치하지 않는다. boot는 기존 init 성공 후 PWA에 준비를 통지하며 단일 정의/순서를 유지한다. 변경 계약은 [소유권](../data-ownership.md), [실행 구조](../runtime-architecture.md), [개발 명령](../development.md)에 기록했다.

캐시는 scope별 prefix를 사용한다. activation은 구 셸·옛 v1·다른 앱 캐시·LocalStorage/backup을 삭제하지 않는다. 살아 있는 구 문서를 위해 이전 셸을 보존하며 quota에는 새 업데이트를 거부한다. 복구는 백업 후 구 셸 캐시만 정리하거나 해당 워커만 unregister/온라인 재설치하는 절차다. 사이트 데이터 전체 삭제를 복구 방법으로 쓰지 않는다.

## 검증 결과

기준 `npm run test:ci`에서 기존 **148개**와 doctor·문법 27개를 먼저 통과했다. 구현 후 동일 공통 명령의 npm ci → Chromium 설치 → doctor → check → test를 실행하여 **174개**, 실패/cancel/skip 0개와 **문법 31개**(앱 JS 20 + 도구/helper CJS 11), 생성물 일치를 통과했다. Node 24.19.0/Playwright 1.62.1/Chromium 151.0.7922.34다. 기존 lockfile/CI workflow와 148개 assertion·fixture·입력/정산 계약을 유지했다. [로컬 기록](verification/IMP-12-local.json)을 보관한다.

새 검사 **26개**는 실제 워커 브라우저 19개와 순수 7개(셸 검사 2 + 서버 제안 계약 5)다.

- 임시 일반 프로필에서 Chrome 설치 가능 오류 0개, 실제 PWA.install/getOsAppState, 사용자 displayMode 설정과 PWA.launch의 standalone 창을 확인하고 제거했다. localhost의 Pages 하위 경로와 192/512 아이콘을 검증했다. 실제 OS/iOS 런처 UI 검증과 구분한다.
- 온라인→Chrome offline emulation+서버 전달 차단→캐시 HTML/전체 코드 재접속→온라인 복귀를 확인했다. 안전 정수 경계에서 1원을 정산한 원본 ledger/저장을 그대로 복원했다. 캐시되지 않은 네트워크 요청도 실패하는지 별도 확인했다. 브라우저 측 SW 업데이트 fetch가 탭 emulation 밖에서 실행되는 경우를 위해 서버도 503으로 막고 워커 자체의 fetch/cache를 mock하지 않는다.
- 선택 미디어 전체 404에도 설치/오프라인 엔딩 fallback, 새 버전 대기 중 구 HTML/JS 응답 일치와 명시적 적용 후 새 marker/코드, 필수 404/해시/MIME 실패·재시도, 첫 설치 실패·재등록을 확인했다. 필수 캐시 손실은 새로운 서버 JS로 넘어가지 않고 503이었다.
- 저장 quota 실패·다른 앱 탭·미수령 창·실제 엔딩 입력/타이머·백업 입력 중 적용을 막고 저장/엔딩 상태를 유지했다. 창 닫기 뒤에도 확정 receipt/지급 완료·쿠폰/직원 6명/운영 선택을 보존하며 적용·재접속했다.
- 실제 지도 터치와 이동 버튼으로 오프라인 지점을 왕복하고 해당 지점의 receipt·온라인 진행·배달 간격/서명·공용 데이터/선택을 유지했다. 320×568 세로와 568×320 가로에서 설정 스크롤/닫기·백업 입력/import·PIN 취소·초기화/재접속을 확인했다. 성공 case는 page error 0개다.
- 기존 v1/다른 앱 캐시를 유지하고 합성 API POST가 캐시되지 않음을 확인했다. 순수 서버 계약 검사는 receipt 변조/다른 쿠폰·매장·requestId·revision, 401/403/409/410/422/429/503/timeout·같은 키 재시도의 제안 분류를 확인했으며 로컬/실제 서버 데이터를 변경하지 않았다.

구현 `d51267e`의 [push CI](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38326889622)와 [PR CI](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38326912123)는 설치/doctor/생성물/문법 31개/검사 174개를 모두 통과했다. 첫 push의 select가 PR 생성 전에 실행되어 두 이벤트가 각각 전체 검사를 했다. 이후 열린 PR은 push의 중복 검사를 소유한다. 최종 문서·검증 보완 커밋의 같은 HEAD 결과는 별도 보관한다. 원격 CI 결과와 최종 HEAD는 [CI 기록](verification/IMP-12-ci.json) 및 최종 보관 JSON에 기록한다. 성공 검사 화면은 [설치](screenshots/nice-chicken-imp12-install.png), [standalone](screenshots/nice-chicken-imp12-standalone.png), [오프라인](screenshots/nice-chicken-imp12-offline.png), [대기](screenshots/nice-chicken-imp12-waiting.png), [실패](screenshots/nice-chicken-imp12-failed-hash.png), [미수령 중 대기](screenshots/nice-chicken-imp12-pending-waiting.png), [엔딩 중 대기](screenshots/nice-chicken-imp12-ending-waiting.png), [작은 세로](screenshots/nice-chicken-imp12-portrait-update.png), [작은 가로](screenshots/nice-chicken-imp12-landscape-update.png)에 보관한다. 역사 자료는 덮어쓰지 않는다.

## 커밋과 복구

1. `25f9196`: 기존 PWA/Pages/PIN 경로·기준 검사·설치/서버 정책 분석.
2. `47927f1`: 해시 셸/SRI·대기/저장 후 업데이트·manifest/설정·로컬 운영 표시.
3. `d51267e`: 실제 설치/standalone·오프라인/업데이트/입력/지점·서버 제안 26개 검사, 실패 재등록/manifest 호환과 소유권/개발 문서.
4. 최종 검증·화면·완료 보고서·작업 목록·다음 프롬프트와 복구 자료를 보관한다.

전체 `/workspace/nice-chicken-imp12.patch`, 단계별 `/workspace/nice-chicken-imp12-patches/`, `/workspace/nice-chicken-imp12.bundle`, `/workspace/nice-chicken-imp12-artifacts.json`을 남긴다. prerequisite는 위 IMP-11 SHA다. 패치 순차 적용/전체 적용의 최종 Git tree와 bundle을 검증한다. 최종 CI는 `/workspace/nice-chicken-imp12-ci-results.json`의 같은 HEAD 결과다. 처음부터 있던 IMP-10 보고서의 사용자 편집은 수정/커밋하지 않고 `/workspace/imp12-preexisting-user-edit.patch`로 보존한다. 이전 IMP 자료도 유지한다.

## 남은 문제와 다음 작업

- 서버 발급 원본/계정·매장 권한·DB transaction/감사·운영 담당자가 없다. 로컬 PIN/수량을 실제 혜택의 서버 증거로 바꾸지 않는다. 제공/승인 뒤 스테이징에서 연결·경쟁 요청·commit 직후 단절·재시도·취소를 검증해야 한다.
- 여러 게임 창의 LocalStorage 쓰기는 기존 동시 저장 경쟁을 남긴다. 이번 창 수 검사는 업데이트 안전 조건이다. 사업 진행의 전체 단일 작성자를 보장하지 않으므로 다음 IMP-13에서 먼저 재현/정책/구현한다.
- 구 셸은 자동 삭제하지 않아 장기 업데이트가 quota에 닿을 수 있다. 안전한 구 캐시 정리의 추가 UI/정책은 실제 여러 창/worker 생명주기와 함께 검토한다. 저장소 eviction/디스크 실패를 웹앱이 완전히 방지하지 못한다.
- Linux Chromium 설치/standalone/터치 자동 검사를 완료해도 iOS/Android의 실제 홈 화면·실기기 백그라운드·앱 복귀 UI를 대신하지 않는다. 첫 접속이 오프라인이고 설치된 셸이 없으면 실행할 수 없다.
- Pages는 main 루트 legacy/errored 상태이며 개발 브랜치를 배포하지 않았다. main의 이전 자동 패치 workflow도 통합 리뷰가 필요하다. 병합/배포/혜택 운영 변경은 별도 승인 뒤 수행한다.
- IMP-11 성장/선택 모델의 실제 수일 플레이 분포·지역별 추가 수치 콘텐츠와 원본 없는 간판은 이전 남은 범위다. 이번 작업에서 비용/수익/속도·과거 수익을 변경하지 않았다.

## IMP-13 시작 프롬프트

```text
origin/improvement-imp12-20261013 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/economy-policy.md, docs/content-design.md,
docs/pwa-operations.md, docs/coupon-server-contract.md,
docs/improvements/IMP-12-pwa-operations.md를 읽고 IMP-13을 구현해줘.

여러 게임 탭/설치 창의 동시 tick·자동 저장·수령·지점 이동·import/reset과
PWA 대기/적용에서 실제 덮어쓰기·중복·소유권 문제를 먼저 재현하고 측정해줘.
브라우저 지원과 장애 조건을 확인하여 단일 작성자/인계/읽기 전용 정책을 문서화하고 구현해줘.
Web Locks 지원/미지원·숨김/복귀·창 종료/강제 종료·저장 실패의 복구를 검증하고,
다른 창의 진행이나 확정 미수령을 이전 snapshot으로 덮어쓰지 않게 해줘.
구 셸 캐시 정리도 살아 있는 문서의 버전 일치와 저장 보존 조건을 먼저 설계해줘.

정확한 원 단위 정산·기존 저장/백업·확정 미수령·지급 완료 미션/인증서/쿠폰,
직원 6명·본사/지점·운영/메뉴/담당자/읽음·서비스 타이머/연구 캐시·
엔딩 1회·모달 입력·명시적 dirty/저장·PWA 대기/실패 복구를 보존해줘.
과거 수익을 추측 보정하거나 로컬 PIN을 서버 인증이라고 표현하지 마.
백엔드가 없는 상태의 실 혜택 사용·운영 변경과 main 병합·배포는 별도 승인 전 수행하지 마.

실제 Chromium 여러 탭과 설치 창에서 온라인/오프라인·새/실패 업데이트,
소유권 인계·저장 실패·재접속·지점 이동·백업/import/reset·작은 화면을 검증해줘.
현재 174개와 새 동시성/복구 검사, npm run doctor, npm run check, npm test와 CI를 통과시켜줘.
단계별 커밋·패치·번들·작업 목록·완료 보고서·남은 문제·다음 프롬프트를 남겨줘.
```
