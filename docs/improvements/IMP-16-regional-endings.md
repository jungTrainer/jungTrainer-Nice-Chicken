# IMP-16 지역 엔딩·이지/노말

작업 기준: `origin/improvement-imp15-20261013`의 `491e4aa438c7808e867f77e94839dfe93eba173c`. 작업 브랜치 [`improvement-imp16-20261013`](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/tree/improvement-imp16-20261013), [Draft PR #10](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/pull/10)의 base는 IMP-15다. main 병합·배포·실제 혜택 사용·매장 운영 변경을 수행하지 않는다.

## 변경 방법

기존 100해 가족 엔딩의 시간이 길어 한 앱 안에서 게임 진행을 보존하는 세 가지 선택을 제공했다. **기존 운영**은 기존 목표/비용을 유지한다. **이지/노말**은 설정에서 명시적으로 확인하고 저장에 성공한 뒤 미래 지점 비용·지역 이야기 매출·가족 보유금 목표만 바꾼다. 수익/가격/연구/일반 구매/속도에 새 배율을 중복 적용하지 않는다. 초기 이름 입력을 새 모드 팝업으로 가리지 않으며 모드 미지정 구 저장/신규 기본은 기존 운영이다.

6지역의 기존 도착·성장 이야기와 새 마무리를 연결했다. 해당 지점에서 실제 기록된 totalSales+offlineSalesTotal이 목표에 이르면 이야기 해금이 dirty로 기록된다. 지점별 미수령/다른 지점 수익/공용 보유금은 지역 기록 매출로 합산하지 않는다. 이미 열린 지역은 다시 잠그지 않고 새 지점만 이전 지역 이야기와 비용을 요구한다.

**해금 → 보기/닫기 → 첫 완료 저장 → 다시보기**를 구분한다. 첫 성공 완료는 지역 기념 칭호를 한 번 보관하는 게임 표시 효과다. 돈/수익 배율/실물 쿠폰은 지급하지 않는다. 가족 엔딩은 새 모드에서 6지역 이야기 해금+정확한 보유금으로 열리며 기존 해금·완료·로봇손주 1회 효과는 그대로다. 지역 이야기 중 가족 자동 팝업이 끼어들지 않는다. 모드를 낮추거나 다시 올려도 기록된 해금/완료를 취소·재지급하지 않는다.

`CAMPAIGN_MODES`에서 정책을 읽고 `getRegionUnlockCost`가 지도 표시/활성 조건/차감을 통일한다. 두 옛 해금 경로는 `BranchManager.unlock` 단일 commit으로 위임했다. 정확한 원 비교·차감과 성공 저장을 사용하며 실패는 돈/오픈/지점/선택/시각/dirty를 복원한다. 모드/첫 완료도 영향 필드만 복구하여 실패 중 다른 진행을 과거 snapshot으로 덮어쓰지 않는다.

HQ `campaign` archive만 추가하고 기존 지점 snapshot·서비스 타이머·연구 서명/캐시 소유권·본/backup 키·원 encoding·reset 세대는 유지한다. 지역 view는 root/region/epoch token을 검사한다. 기존 모달 입력/스크롤/포커스 owner와 PWA/인계 안전 검사 아래에 놓고 성공 import/reset/새 writer init에서만 이전 view를 취소한다. reader는 모드/완료/dirty를 변경하지 않는다. unknown extension은 남기며 future version/알 수 없는 모드/잘못된 완료는 복구 후보 검사에서 중단한다. 새 campaign 백업은 IMP-16 이후 셸에서 사용한다.

## 성장 시간 측정과 근거

[모드 정책](../campaign-policy.md)에 정확한 목표6종과 가정을 기록했다. 앱의 실제 비용/정산/속도 함수와 동일한 분 단위 탐욕적 구매·연구 모델을 사용했고 9채널을 비교했다. 아래 시간은 구매 빈도/완벽한 능동 서빙 가정의 **계획 수치**이며 사람의90분/312분 완주 검증이나 보장이 아니다. 모델 평균율/시간 적분은 Number 근사이고 실제 게임 잔액/비용/목표는 정확한 원 API다.

| 모드·채널 | 첫 지역 엔딩 해금 | 부산 오픈 | 가족 엔딩 |
| --- | ---: | ---: | ---: |
| 기존·능동 | 없음 | 95분 | 6175분(102.9시간) |
| 기존·자동 | 없음 | 95분 | 5911분(98.5시간) |
| 기존·오프라인 | 없음 | 1920분 | 30일 안 미도달 |
| 이지·능동 | 5분 | 5분 | 90분 |
| 이지·자동 | 10분 | 10분 | 92분 |
| 이지·오프라인 | 960분 | 960분 | 6240분(4일8시간) |
| 노말·능동 | 18분 | 18분 | 312분(5시간12분) |
| 노말·자동 | 22분 | 22분 | 299분(4시간59분) |
| 노말·오프라인 | 1440분 | 1440분 | 7680분(5일8시간) |

이지 능동5/90분과 노말 능동18/312분은 설계 목표 안이다. 노말 자동은5시간보다1분 짧다. 기존 능동이 자동보다 느린 것은 동일한 탐욕적 구매가 다른 선택 순서를 택해서이며 능동 최적 전략이라고 주장하지 않는다. 오프라인은8시간마다 복귀·확정 수령·구매·연구 진행을 하고 부재 중 새 구매/연구 시작을 하지 않는다. 기존30일 미도달은 관찰 구간이 끝난 것으로 불가능을 증명하지 않는다.

능동 지역 해금은 이지5/10/26/48/66/90분, 노말18/23/56/96/127/170분이다. 노말의 지역 이후142분 보유금 구간은 사람 검증에서 피로도를 다시 확인할 지점이다. 전체15분에 끝나거나 마지막 지역만7시간 걸리는 초안7종을 폐기한 과정도 보관했다. 최대 화성 실제0.1초 step 10분 샘플은 모든 모드에서 서빙703/배달1000/온라인2·매출11438834002598400000000원으로 같다. 신규 배율을 넣지 않았다는 고정 조건 확인이다.

검증 JSON: [기존 자동](verification/IMP-16-economy-before.json), [기존 능동](verification/IMP-16-legacy-active.json), [기존 오프라인](verification/IMP-16-legacy-offline.json), [초안 비교](verification/IMP-16-design-iterations.json), [이지 능동](verification/IMP-16-easy-active.json)/[자동](verification/IMP-16-easy-auto.json)/[오프라인](verification/IMP-16-easy-offline.json), [노말 능동](verification/IMP-16-normal-active.json)/[자동](verification/IMP-16-normal-auto.json)/[오프라인](verification/IMP-16-normal-offline.json).

## 검증 결과

| 확인 | 실제 결과 |
| --- | --- |
| 로컬 CI 공통 명령 | npm ci → 고정 Chromium 설치 → doctor → check → test, exit0 |
| doctor | Node24.19.0/Playwright1.62.1/Chromium151.0.7922.34, DOM·native headed hide/resume OK |
| check | 앱JS22+CJS17=39개 문법, scripts21/필수셸26·PWA/SRI 생성물 일치 |
| 전체 회귀 | **280개 실행·280pass·0fail·0cancelled·0skip**, 486280.320395ms |
| 새 범위 | 모드/지역23개, 실제SW/설치3개 각각 통과; 기존254개 유지 |
| 최종 원격 | 최종 head의 PR Game CI 결과는 PR checks/보관 JSON으로 확인 |

로컬 재현 명령은 `npm_config_cache=/tmp/nice-chicken-npm-cache PLAYWRIGHT_XVFB_EXECUTABLE=/workspace/.cache/nice-chicken-gui/root/usr/bin/Xvfb PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:ci`였다. 현재 클라우드의 권한 내 설치 Xvfb 경로이며 일반 runner의 기본 Xvfb와 구분한다. `/workspace/imp16-full-ci.log`와 표준 test-results/logs를 보관했다.

기존254개 assertion을 삭제/skip하지 않고 새26개를 추가했다. 모드/지역23개는 native 확인 취소·저장 실패/재시도·1원 경계·지도 실제 비용·6지역 조건·첫 완료/재생·다른 지점 기록·기간·재접속·백업/import/reset·explicit 손상 복구·writer/reader/인계·작은 화면 터치/Tab/Escape/스크롤·배경 입력 차단을 포함한다. 실제 SW3개는 오프라인 셸의 모드/완료·실패 hash/대기 업데이트·열린 지역/저장 실패 중 적용 거절·새 셸에서 archive/paid/receipt 보존·Chromium CDP 설치 standalone reader→writer 종료 후 최신 archive 상속이다.

초기 신규 실행에서 잘못된 `REGION_STORIES` 참조를 실제 `REGION_CONTENT`로 수정했다. 지도 검사는 실제 `mapUnlock` 입력/표시/차감을 사용하도록 수정했다. 가족 팝업 fixture는 준비 중 이미 자동 해금되지 않도록 목표1원 아래에서 시작해 지역 창을 연 뒤1원을 추가하여 같은 보호 assertion을 검증했다. 초기 실패/종료한 runner는 통과로 세지 않았다. 마지막 전체 검사는 런타임/SRI를 고정하고 진행했다. 도구의 기본 브라우저 경로에서 실행 파일을 찾지 못한 측정은 실패로 기록하고 설치된 고정 경로로 다시 실행한 JSON만 사용했다.

[세로 이야기](screenshots/nice-chicken-imp16-portrait-story.png) · [세로 모드](screenshots/nice-chicken-imp16-portrait-modes.png) · [가로 이야기](screenshots/nice-chicken-imp16-landscape-story.png) · [가로 모드](screenshots/nice-chicken-imp16-landscape-modes.png) · [실제 오프라인](screenshots/nice-chicken-imp16-offline.png) · [실제 설치 창](screenshots/nice-chicken-imp16-installed.png).

최종 문서 head에서도 같은 Game CI를 실행하고 **실제 final SHA/PR checks/280개·39개·doctor 결과**를 `/workspace/nice-chicken-imp16-ci-results.json`에 별도로 보관한다. head hash를 자체 문서에 쓰기 위한 추가 커밋은 만들지 않는다. select/skip·취소는 전체 회귀 통과가 아니다. PR checks와 JSON의 head를 일치시켜 확인한다. 실패 로그/PNG/trace의 CI 보관은 기존14일 정책이다.

## 운영 경계와 남은 문제

- 게임 모드/지역 기념은 실물 신규 발급 기준이 아니다. 기존 쿠폰 수량/사용 이력·지점 일간/주간 paid·인증서·5,000만원 교환을 소급 바꾸지 않았다. 미래 지역에 더 빨리 가면 기존 교환이 가속될 수 있으므로 실제 운영 전 미적용 통합 한도안을 검토해야 한다. 이번 개발에서 그 안을 활성화하지 않았다.
- 음료는 테이블의 한 방문에 한 병이다. 기기 간 제공 횟수가 공유되지 않고 공개 PIN은 서버 인증이 아니다. 양배추·무 제공량/추가 횟수·새 방문 발급은 IMP-15 검토안 그대로다. 백엔드/계정/서버 쿠폰·광고·헬을 추가하지 않았다.
- 사람의 손님 선택 실패/대기/읽기/구매 빈도·지역 운영/메뉴 선택은 모델과 다르다. 신규 사용자의 실제 first5~10분/15~25분과 전체 피로도·노말 후반 보유금 구간을 검증할 필요가 있다. 능동 설계 범위는 달성 가능 모델이지 실기기 사람 재현 결과가 아니다.
- 모드 선택은 설정에 있으며 신규 기본은 기존 운영이다. 처음 이용자에게 선택 위치/매출 조건/기념 효과·잠긴 지역을 더 쉽게 안내하는 UX가 후속 범위다. 명시적 선택과 기존 기록 보존을 희생하지 않는다.
- 상위 모드로 옮겨도 기존 해금/기념/가족 플래그는 유지한다. 정식 난이도 경쟁 기록/리더보드 인증이 아니며 모드 전환으로 최초 지급을 다시 만들지 않는다.
- 오래된 백업은 사라진 최신 paid/제공 이력을 증명하지 못한다. IMP-14 원문/세대/명시적 snapshot 교체 한계를 유지하며 자동 합산·과거 수익/지급 추측을 하지 않는다. 구 IMP-15 셸로 새 모드 저장을 운영하지 않는다.
- 이번 전체280개는 Chromium/Linux다. 실제 Android/iOS/OS 설치·화면 키보드·스크린리더·Firefox/WebKit 전체 회귀를 통과했다고 표시하지 않는다. 기존 지원 프로브 결과와 별도다. 자동 캡처는 합성 localhost 데이터만 사용했다.

## 커밋·복구 자료

측정/설계 `4f786af` → 모드/지역 구현 `75447fa` → 실제 입력/PWA 검사·수정/증거 `562a1e9` → 완료 보고서를 별도 커밋했다. 앱 변경 뒤 `npm run pwa:build`를 실행해 index SRI/worker 생성물을 갱신했으며 문서 커밋은 런타임을 바꾸지 않는다.

`/workspace/nice-chicken-imp16.patch`, `nice-chicken-imp16-patches/`, `nice-chicken-imp16.bundle`, `nice-chicken-imp16-artifacts.json`, `nice-chicken-imp16-ci-results.json`, `nice-chicken-imp16-recovery.md`, `nice-chicken-imp16-logs/`에 전체/단계 patch·완전 history·SHA256/동일 tree·CI·복구 명령을 남겼다. 사용자 기존 IMP-10 오타 편집은 수정/커밋/개선 patch에 포함하지 않았다. main의 원격 SHA는 변경하지 않았다.

## IMP-17 시작 프롬프트

```text
origin/improvement-imp16-20261013 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/economy-policy.md, docs/content-design.md,
docs/campaign-policy.md, docs/missions-service-policy.md,
docs/product-direction.md, docs/save-recovery-policy.md,
docs/session-ownership.md, docs/pwa-operations.md,
docs/improvements/IMP-16-regional-endings.md를 읽고
IMP-17 첫 방문 안내·접근성·실기기 검증을 구현해줘.

신규/기존 사용자의 모드 선택 위치, 지점별 매출/다음 해금 비용,
지역 기념/가족 목표, 성장 업적/반복 미션/실물 혜택 구분을 먼저 분석해줘.
처음 선택과 잠긴 지역·엔딩 상태를 이해하기 쉬운 안내로 개선하되
강제 모드 이행·조회 보상·기존 paid/쿠폰 초기화를 하지 마.
가능한 실제 모바일 OS/설치 창·키보드·스크린리더·작은 화면에서
터치/포커스/닫기/스크롤/배경 입력/업데이트를 검증하고
미지원·미검증·자동 Chromium과 실제 사람 결과를 구분해 기록해줘.
동일 모델90분/312분과 실제 첫 지역·후반 피로도를 비교해줘.
사람 테스트가 없으면 완료나 보장된 시간을 주장하지 말고 모집/기록 계획을 남겨줘.

정확한 원 API·기존/모드 선택·6지역 archive·기념/가족1회·
기존 저장/확정 미수령/paid/쿠폰/인증서·50,000,000원 교환·직원6명·
HQ/지점/메뉴/담당자/읽음/방문 도전/서비스 방문·서비스/연구 캐시·
모달 입력·dirty/저장·단일 작성자/인계·PWA·원문/명시적 복구/세대를 보존해줘.
과거 수익이나 지급 이력을 추측 보정하지 마.
새 방문 발급/통합 한도·양배추/무 제공량은 미적용 검토안이다.
음료는 테이블 방문당1병·기기 간 공유/서버 인증 없음 표시를 유지하고
실제 서비스 정책/발급 조건을 임의 활성화하지 마.
백엔드/계정/서버 쿠폰·광고/헬·실제 혜택 사용/운영 변경을 개발/수행하지 마.

현재280개와 새 안내/접근성 검사, doctor/check/test·final SHA CI를 통과시켜줘.
앱 변경 후 pwa:build를 갱신하고 단계별 커밋·patch/bundle·실제 검증 자료·
작업 목록·완료 보고서·남은 문제·다음 프롬프트를 남겨줘.
main 병합·배포는 수행하지 마.
```
