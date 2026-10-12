# IMP-09: 개발 문서와 지속 검증

완료일: 2026-10-12. 기준: `origin/improvement-imp08-20261012`, `7c0494455b2126419a8375c507e419568d4f36bf`.
보관 브랜치: `improvement-imp09-20261012`. [Draft PR #3](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/pull/3)의 대상은 IMP-08 브랜치다. main 병합·배포는 수행하지 않았다.

## 구현

기존 활성 YAML 7개를 먼저 확인했다. 모두 contents write와 패치/자동 commit/push를 사용했으며 Expansion Event Cleanup Steps는 모든 push에서 과거 함수/설치 순서를 요구했다. IMP-08 원격 push에서도 이 작업의 실패가 남아 있었다. 원본을 `docs/legacy-workflows`로 그대로 보관하고 `.github/workflows/ci.yml` 하나로 일반 검증을 구성했다.

- 모든 브랜치 push·PR·workflow_dispatch를 정의했다. default branch push는 항상 검사하고, 열린 PR이 있는 브랜치의 push는 select에서 중복 전체 검사를 생략한다. PR 조회 오류는 실패로 전달한다. 같은 이벤트/ref의 이전 실행은 concurrency로 취소한다. workflow_dispatch UI는 default branch 반영 뒤 사용할 수 있다.
- 검사 job 권한은 contents read, select의 추가 pull-requests read는 중복 판정용이다. checkout credential은 유지하지 않으며 자동 commit/push/merge/deploy는 없다.
- `.nvmrc`에 Node 24.19.0을 명시하고 lockfile의 Playwright 1.62.1, Chromium 1234/151.0.7922.34를 실제 설치했다. 기본 실행 파일은 고정 bundled Chrome이고 시스템 비교는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 명시한다. doctor는 실제 launch/DOM과 버전을 확인한다.
- 원격에서 구 Actions 런타임의 Node 20 폐기 경고를 확인해 Node 24를 사용하는 checkout 7.0.1, setup-node 7.1.0, github-script 9.0.0, upload-artifact 7.0.2의 확인된 commit SHA로 고정했다.
- `scripts/ci-checks.sh`는 로컬/Actions 공통 설치→브라우저→doctor→문법→검사를 실행한다. Linux OS 의존성은 GitHub runner에서 추가 설치하며 이 클라우드는 이미 설치된 라이브러리를 실제 launch로 확인했다. tee를 사용해도 원래 실패 코드를 보존한다.
- helper는 실패한 context의 PNG·오류 JSON·trace를 보관하고 원래 오류를 다시 throw한다. CI는 실패 시 logs/자료를 14일 artifact로 보관한다. 일반 screenshot은 test-results로 이동하여 이전 보고서 이미지를 덮어쓰지 않는다.
- [개발 안내](../development.md), [수동 점검표](../manual-test-checklist.md), README·실행 계약에 실제 명령/캐시·실행 파일·실패 진단·배포 설정을 반영했다.

## 보존 범위

앱의 `js/`, `index.html`, `css/`, `sw.js`와 package-lock은 IMP-08 기준과 동일하다. package.json은 doctor/test:ci 명령만 추가했다. 92개 검사 assertion·fixture·날짜·live/rAF 정책은 유지하고 브라우저 선택/진단 helper와 screenshot 출력 위치를 정리했다. 본사/지점 소유권·직원 6명·저장 키/버전·미수령·지급 완료 보상/쿠폰·정산/연구·엔딩·모달 입력과 밸런스는 변경하지 않았다.

## 검증 결과

- 로컬 공통 `npm ci`, Chromium 설치, doctor, `npm run check`, `npm test`: **문법 23개(앱 JS 17 + CJS 6), 회귀 92개 통과**, 실패/skip 0개.
- cloud의 기본 npm cache 경로가 쓰기 불가능해 ENOENT/tarball 재시도 경고가 발생했다. 쓰기 가능한 `npm_config_cache=/tmp/nice-chicken-npm-cache`로 정상 설치했고 integrity/TLS 검증을 유지했다.
- actionlint 1.7.12, YAML event/권한 확인, Bash 문법·diff check 통과. linter는 공식 checksum으로 확인한 바이너리를 사용했다. event select의 push/default·push/PR 없음·push/PR 있음·PR·수동 5개 mock과 API 실패 전달도 확인했다.
- 별도 `/tmp`의 의도적 실패 probe는 **종료 1**을 유지하며 `page.png`, `failure.json`, `trace.zip`을 만들었다. JSON의 원래 오류·캡처 오류 0·PNG·zip의 trace 항목을 확인했다. 정상 92개 검사에 이 실패 case를 포함하지 않았다.
- Python 정적 서버의 HTML/boot JS/CSS HTTP 200, 실제 Chrome의 이름 저장·고객 생성·canvas/입력 연결·page error 0을 확인하고 [화면](screenshots/nice-chicken-imp09-static-smoke.png)을 남겼다. 서버·브라우저는 종료했다. 기존 간판 asset 404/fallback은 별도 콘텐츠 문제로 기록했다.

원격 결과:

| 이벤트/커밋 | 결과 |
| --- | --- |
| PR 없는 push `58cdbbe` | [Game CI 성공](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38214006281), 설치/검사 전체 실행 |
| PR #3 `a86d2e0` | PR 전체 성공, 같은 push의 checks는 skipped |
| Node 24 Actions의 PR `9d7266b` | [92개·문법 23개 성공](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38215336313) |
| 같은 `9d7266b` push | [select 성공·중복 checks skipped](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38215332206) |

[검증 기록 JSON](verification/IMP-09-ci.json)에 실제 SHA·job 결론·버전·집계를 저장했다. 새 커밋으로 취소된 이전 PR run은 통과로 기록하지 않는다. 성공 run의 artifact step은 의도적으로 skipped이며 실제 원격 실패 업로드는 발생시키지 않았다. 자료 생성/실패 보존은 로컬 probe로 검증했다. 마지막 문서 커밋의 실행 결과는 브랜치의 Actions 및 최종 보관 파일에서 확인한다.

## 환경과 배포

Pages API의 실제 설정은 legacy/main/루트 `/`이며 현재 URL은 `https://jungtrainer.github.io/jungTrainer-Nice-Chicken/`이다. 설정을 변경하거나 main에 push하지 않았다. main 반영은 기존 Pages 배포를 유발할 수 있으므로 별도 승인 뒤 진행한다.

환경 설정 스킬로 실제 설치/doctor/문법 명령을 검증하고 `install_script`·`start_skill` 초안을 저장했다. npm/browser cache는 쓰기 가능한 경로를 사용하고 기존 격리 checkout을 재사용한다. 초안 저장은 현재 실행의 검증과 별개이며 새 환경 적용은 환경 설정에서 검토·저장 후 Publish가 필요하다.

## 커밋과 보관

1. `58cdbbe`: 일반 CI·기존 workflow 보관·실패 진단과 고정 브라우저 선택.
2. `a86d2e0`: 재현 가능한 설치/진단/수동 점검 문서.
3. `9d7266b`: 원격 로그 근거로 Node 24 Actions runtime 갱신.
4. 완료 보고서·검증 JSON·작업 목록·IMP-10 프롬프트는 마지막 커밋에 보관한다. SHA는 보관 브랜치/단계별 패치에 기록된다.

전체 패치 `/workspace/nice-chicken-imp09.patch`, 단계별 `/workspace/nice-chicken-imp09-patches/`, 번들 `/workspace/nice-chicken-imp09.bundle`을 남긴다. 마지막 SHA의 CI 결과는 `/workspace/nice-chicken-imp09-ci-results.json`에 별도로 남긴다. 패치·번들은 위 IMP-08 commit을 prerequisite로 사용한다.

## 남은 문제

- CI/기록은 개발 브랜치와 draft PR에 있다. main에는 과거 자동 패치 YAML이 남아 있고 Pages는 main을 배포한다. main 반영·배포와 필요한 branch protection의 required check 설정은 승인 뒤 별도 진행한다.
- 실기기·스크린리더·실제 스피커와 macOS/Windows CI matrix는 검증하지 않았다. 원격 실패 artifact의 실제 업로드는 아직 실행되지 않았다.
- 여러 탭의 LocalStorage 충돌·다중 키 원자성·미존재 asset·PWA/캐시 업데이트와 서버 쿠폰 인증은 해결하지 않았다. 후자는 IMP-12다.
- 큰 수 정밀도·작은 수익 소실/overflow·지역 비용/레벨/엔딩 도달 시간은 IMP-10이다. 기록 없는 과거 수익을 추측 복원하지 않는다.

## IMP-10 시작 프롬프트

```text
origin/improvement-imp09-20261012 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/improvements/IMP-09-ci-docs.md를 읽고 IMP-10을 구현해줘.

현재 레벨·업그레이드·지점 해금·엔딩 목표의 성장 곡선과 실제 도달 시간을 측정하고,
Number 안전 정수 밖의 작은 수익 소실·정밀도·overflow 문제를 재현해줘.
개선할 밸런스와 큰 수 표현/정산/저장 정책의 근거·가정을 문서화한 뒤 구현해줘.
보유금·가격/구매 비용·매출·메뉴 통계·기여도·확정 미수령 내역의 단위를 일치시키고,
표시 값과 실제 정산이 달라지거나 이미 확정한 보상을 재평가하지 않게 해줘.

기존 Number 저장·백업·가져오기를 보존하는 마이그레이션을 마련하고,
원본 없는 과거 수익과 정밀도 손실을 임의로 추가/보정하지 마.
직원 6명·본사/지점 데이터·서비스 타이머/연구 캐시·지급 완료 미션/쿠폰·
엔딩 1회 효과·모달 입력과 명시적 dirty/저장 계약을 보존해줘.

일반 금액·안전 정수 경계·매우 큰 금액·목표액 근처의 수익/지출/수령을 검증하고,
재접속·지점 이동·백업·가져오기·초기화를 브라우저로 검증해줘.
현재 92개 검사와 새 경계/마이그레이션 검사, npm run doctor,
npm run check, npm test 및 push/PR CI를 통과시켜줘.
main 병합·배포는 별도 승인 전 수행하지 마.
단계별 커밋·패치·번들, 작업 목록·완료 보고서·변경 전후 도달 시간·남은 문제와
IMP-11 시작 프롬프트를 남겨줘.
```
