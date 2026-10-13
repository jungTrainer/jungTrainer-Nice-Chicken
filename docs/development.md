# 개발·검사·CI 실행 안내

기준: IMP-09/10/11/12/13, 2026-10-13. 게임은 정적 HTML/CSS/JS이며 일반 실행에는 npm 설치·빌드·백엔드가 필요 없다. 브라우저 검사에는 Node와 Playwright/Chromium을 설치한다. [데이터 규칙](data-ownership.md)과 [실행 계약](runtime-architecture.md)을 함께 따른다.

## 설치와 브라우저 선택

CI는 Ubuntu 24.04, `.nvmrc`의 Node **24.19.0**, lockfile의 Playwright **1.62.1**과 Chromium revision **1234**, Chrome **151.0.7922.34**를 사용한다. Node 20 이상으로 도구를 실행할 수 있지만 비교 검증은 `.nvmrc` 버전을 권장한다. 시스템 Chromium은 버전이 자동 갱신될 수 있어 기본 검사는 Playwright의 고정 브라우저를 사용한다.

아래 명령은 저장소 루트에서 Bash로 실행한다. nvm이 설치되어 있다면 먼저 `nvm install && nvm use`를 실행한다.

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npm ci
npx playwright install chromium --no-shell
npm run doctor
npm run check
npm test
```

`doctor`는 실행 파일 존재·권한, 실제 headless DOM과 기본 포커스 에뮬레이션 없는 headed 탭 숨김/복귀를 확인하고 Node·Playwright·Chromium 버전을 출력한다. 브라우저 경로를 설치 명령과 검사 명령에 같은 값으로 전달한다. `.cache/ms-playwright`와 `test-results`는 Git에 포함하지 않는다.

Linux 라이브러리가 없는 새 머신에서는 `npx playwright install-deps chromium`을 추가로 실행한다. 이 명령은 관리자 권한이 필요하며 GitHub 호스팅 runner에서는 공통 스크립트가 실행한다. 이 클라우드 머신의 기존 라이브러리는 `doctor`로 검증했다. macOS/Windows는 OS별 Playwright 설치 안내를 따르고, Bash가 없는 환경에서는 공통 Bash 스크립트 대신 위 개별 npm 명령을 실행한다.

이미 설치한 시스템 브라우저를 비교하려면 실행 파일을 명시한다.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run doctor
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test
```

환경 변수가 없으면 `scripts/browser-options.cjs`가 `chromium.executablePath()`를 선택한다. `chromium --no-shell` 설치에 맞춰 전체 Chrome 실행 파일을 명시하므로 별도 headless-shell 설치는 요구하지 않는다. `measure-runtime.cjs`도 같은 브라우저 선택을 사용한다.

## CI와 같은 명령 실행

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npm run test:ci
```

`scripts/ci-checks.sh`는 `npm ci` → 고정 Chromium 설치 → `npm run doctor` → `npm run check` → `npm test` 순서로 실행한다. `GITHUB_ACTIONS=true`인 호스팅 runner에서만 Linux OS 라이브러리 설치를 추가한다. `set -euo pipefail`로 tee에 로그를 남겨도 실패를 성공으로 바꾸지 않는다. 의존성 설치·검사 실패 후에는 다음 검사를 실행하지 않는다.

기본 npm 캐시를 쓸 수 없는 클라우드에서는 현재 검증한 경로를 지정한다.

```bash
npm_config_cache=/tmp/nice-chicken-npm-cache \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" \
npm run test:ci
```

현재 앱 JS 21개와 도구/검사 helper CJS 13개, 총 **34개 문법 검사**, **197개 회귀 검사**를 실행한다. 기존 174개 assertion/fixture를 유지하고 동시성/복구 23개를 추가했다. 범위별 재현은 `node --test tests/branches.test.cjs`, `node --test tests/refactor.test.cjs`, `node --test tests/money.test.cjs`, `node --test tests/content.test.cjs` 등을 사용한다. 범위별 통과가 전체 통과를 대신하지 않는다.

검사 helper는 각 검사 파일의 HTTP 서버를 임의 포트에 열고 브라우저/context를 정리한다. 자동 검사를 위해 아래 수동 서버를 따로 실행할 필요는 없다. 날짜 fixture·Asia/Seoul·기본 rAF 정지와 필요한 live 검사를 유지한다. Google Fonts 요청은 자동 검사에서 차단하고 기본 폰트를 사용한다.

## 정적 앱 실행과 확인

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

별도 터미널에서 HTTP 확인을 하고 브라우저로 루트 페이지를 연다. Python 서버는 저장소 루트에서 시작한다. 종료는 서버 터미널의 Ctrl+C다.

```bash
curl --fail --head http://127.0.0.1:8000/
curl --fail --head http://127.0.0.1:8000/js/core/boot.js
curl --fail --head http://127.0.0.1:8000/css/style.css
```

HTTP 200 외에 이름 입력·고객 생성·캔버스·메뉴/패널과 콘솔 page error도 확인한다. IMP-09에서는 이 서버에 실제 Chromium으로 접속해 이름 저장·고객 생성과 JS 오류 0개를 확인했다. [검증 화면](improvements/screenshots/nice-chicken-imp09-static-smoke.png)을 남겼다. `file://` 실행은 저장/리소스/권한이 달라 공식 검사 경로로 사용하지 않는다.

## 실패 자료

공통 스크립트의 `test-results/logs/`에는 설치, Linux 의존성(해당 runner만), 브라우저 설치, 환경/버전, 문법, 검사 로그가 있다. CI 실패 시 **14일** 보관하는 Actions artifact로 `test-results/`를 업로드한다. 성공 시 artifact step은 건너뛰고 Actions 실행 로그에 결과가 남는다.

브라우저 검사 실패는 `test-results/failures/<검사파일>-<pid>-<case>/`에 다음 자료를 남기고 원래 오류를 다시 throw한다.

- `failure.json`: 검사 파일/번호, browser 버전·viewport·live 여부, 오류 stack, page error, 최근 console 100개, 진단 캡처 오류.
- `page.png`: 실패 직전 화면.
- `trace.zip`: 해당 context의 스크린샷·DOM snapshot·소스 trace. 다른 검사 context와 저장은 섞이지 않는다.

같은 파일에서 정확한 실패 이름/줄은 Node 로그와 stack을 확인한다. 소스 자체가 파싱되지 않거나 브라우저 실행 전 실패하면 PNG/trace는 만들 수 없으며 명령 로그를 사용한다. 일반 검증 스크린샷은 `test-results/screenshots/`에 저장하므로 역사 보고서의 PNG를 덮어쓰지 않는다.

```bash
npx playwright show-trace test-results/failures/<폴더>/trace.zip
```

CI artifact는 합성 fixture의 검사 자료다. 실제 사용자 백업을 진단용으로 공개 업로드하지 않는다. 이 안내의 진단 경로는 수익 지급·저장 형식이나 게임 동작을 바꾸지 않는다.

## 실패 진단

| 증상 | 확인·수정 |
| --- | --- |
| npm 캐시의 ENOENT/EACCES; tarball 재시도 경고 | 먼저 로그의 실제 mkdir/permission 오류를 확인한다. 쓰기 가능한 `npm_config_cache=/tmp/nice-chicken-npm-cache`로 재실행한다. 이 클라우드에서 확인한 원인이다. |
| `EINTEGRITY` checksum 불일치 | 잠금 파일과 실제 registry/cache 출처를 확인하고 `npm cache verify` 또는 새 캐시 경로를 사용한다. 잠금 integrity나 TLS 검증을 제거하지 않는다. |
| `Executable doesn't exist`, 실행 파일 접근 실패 | `npm ci` 후 같은 `PLAYWRIGHT_BROWSERS_PATH`로 브라우저를 설치한다. override 경로와 `npm run doctor` 출력을 확인한다. |
| Chromium missing shared library | Linux에서 `npx playwright install-deps chromium` 후 doctor를 다시 실행한다. |
| 브라우저/CDN 다운로드 실패 | 명령 로그와 네트워크/CA 설정을 확인한다. `registry.npmjs.org`, `cdn.playwright.dev` 및 실제 redirect 대상이 필요하다. TLS 검증을 끄지 않는다. |
| HTTP 404 또는 JS MIME 오류 | 서버의 cwd·HTML 참조를 확인한다. JS/CSS 실패는 고친다. 기존 `sign_*.png/jpg`는 원본 asset이 없어 404 뒤 그리기 fallback을 사용하며 별도 콘텐츠 문제다. |
| Node assertion 실패 | 실패 파일을 단독 재현하고 JSON/PNG/trace를 확인한다. fixture/날짜·지점·보상·엔딩 계약을 고친다. assertion 삭제나 skip으로 통과시키지 않는다. |
| quota 저장 실패 메시지인데 검사 통과 | 실패 복구를 검증하는 합성 case는 의도적으로 저장 오류를 발생시킨다. 최종 Node의 pass/fail/skip 집계를 기준으로 판단한다. |
| Actions의 checks가 skipped | 열린 PR이 해당 브랜치의 검사를 소유하는 push인지 select 로그와 PR run을 확인한다. PR run의 성공이 있어야 한다. |
| Actions 취소 | 새 커밋이 이전 실행을 취소한 경우다. 취소를 통과로 기록하지 않고 새 SHA의 결과를 확인한다. |

## GitHub 이벤트와 배포

현재 활성 파일은 `.github/workflows/ci.yml` 하나다. 모든 브랜치 push, PR의 기본 opened/synchronize/reopened, workflow_dispatch를 정의한다. 수동 실행 UI는 이 파일이 default branch에 반영된 뒤 사용할 수 있다. 현재 개발 브랜치는 push/PR로 검증한다. default branch push는 항상 검사한다. 다른 브랜치에 열린 PR이 있으면 push의 select job만 실행하고 무거운 checks는 PR 이벤트에서 실행한다. API 조회 실패를 건너뛰기/성공으로 숨기지 않는다. 같은 이벤트/ref의 오래된 run은 concurrency로 취소한다. 서로 다른 이벤트의 run 목록은 두 개 보일 수 있지만 같은 업데이트의 전체 검사는 한 번이다.

검사 job은 `contents: read`만 사용한다. select job의 `pull-requests: read`는 중복 검사 판단에만 필요하다. checkout은 `persist-credentials: false`, Actions 버전은 commit SHA 고정이다. 자동 커밋·push·merge·Pages deploy job은 없다. fork PR은 `pull_request`로 검사하며 `pull_request_target`이나 사용자 secret을 쓰지 않는다.

과거 7개 워크플로는 `contents: write`로 패치 적용/자동 커밋·push를 했고 그중 `remove-expansion-inline-onclick-step2-3b.yml`은 모든 push에서 오래된 기준을 검사했다. [원본 보관 폴더](legacy-workflows/README.md)로 옮겼다. 현재 브랜치 밖의 main에는 아직 그 파일들이 남아 있으므로 main 반영은 별도 검토가 필요하다.

GitHub Pages API에서 확인한 설정은 **legacy / main / 루트 `/`**, URL은 `https://jungtrainer.github.io/jungTrainer-Nice-Chicken/`이다. 이번 CI는 해당 배포 설정을 변경하지 않는다. main으로 반영하면 기존 Pages 자동 배포가 발생할 수 있으므로 main 병합·배포는 별도 승인 뒤 진행한다. CI 성공은 개발 브랜치가 배포되었다는 뜻이 아니다. 승인 후 배포 점검은 [수동 체크리스트](manual-test-checklist.md)를 따른다.

성능은 `node scripts/measure-runtime.cjs [기준 트리 디렉터리]`로 참고 측정한다. 동일 브라우저/fixture/부하에서 작업 수를 비교하며 실행 시간을 CI 통과 임계값으로 사용하지 않는다. 원본 측정과 기존 보존 계약은 IMP-08 보고서에 있다.

## 성장·금액 측정 (IMP-10)

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs /tmp/비교할-기준-트리
```

도구는 브라우저와 정적 서버를 직접 시작/종료한다. 비교 트리는 실제 정적 앱 파일을 포함해야 하며 다른 repo에 설치할 필요는 없다. 1원 경계·지수 비용 overflow·레벨/지점/엔딩 계획 모델·실제 서비스 10분을 JSON으로 출력한다. 모델은 평균 수익의 Number 근사이며 실제 원 단위 정산 테스트와 구분한다. [성장·금액 정책](economy-policy.md)에 모델 가정/한도·새 encoding과 구 저장 호환성을 명시했다. 앱에 측정 래퍼를 설치하지 않고 CI 시간 임계값으로 쓰지 않는다.

## 콘텐츠·선택 측정 (IMP-11)

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-content.cjs
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs . legacy
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs . service-neighbor
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs . dispatch-soninlaw
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node scripts/measure-economy.cjs . signature-fried
```

측정은 자체 HTTP 서버/Chromium을 정리한다. 세 번째 policy 인자만 바꿔 같은 성장/급여/연구/구매 모델로 비교한다. `measure-content`는 연구 0/1/10과 메뉴 해금 수별 가격 희석, 운영/담당자 조합의 실제 계수를 출력한다. 실제 입력/스크린샷/실패 복구는 content.test의 별도 브라우저 문맥으로 검증한다. [콘텐츠 설계](content-design.md)와 [IMP-11 보고서](improvements/IMP-11-content-choices.md)의 가정·한계를 따른다. 다음 PWA/캐시 작업은 현재 정적 서버/저장 계약을 유지하면서 별도로 검증한다.


## PWA 생성·실제 서비스워커 검사 (IMP-12)

앱/manifest/자산 변경 뒤 `npm run pwa:build`를 실행하고 생성된 index.html과 sw.js를 함께 커밋한다. `npm run check`는 읽기 전용 생성물 일치 검사도 실행한다. 자동 생성/배포를 CI에서 수행하지 않으므로 stale release는 실패한다. 문서/fixture만 바뀌면 앱 버전은 바뀌지 않는다.

```bash
npm run pwa:build
npm run check
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node --test tests/pwa.test.cjs tests/pwa-release.test.cjs tests/coupon-contract.test.cjs
```

`tests/helpers/pwa.cjs`는 임시 HTTP 서버의 파일 묶음을 교체하고 **실제 Chromium 워커/CacheStorage**를 사용한다. 임시 일반 프로필에서 CDP PWA.install/getOsAppState/changeAppUserSettings/launch로 설치/독립 창을 검사하고 종료/제거한다. OS 설정은 임시 XDG 디렉터리/프로필에만 기록한다. 나머지 fixture는 각기 독립 context다. 기존 게임 검사 helper/148개 assertion과 고정 날짜/Asia/Seoul은 유지한다. rAF를 멈춘 case의 비동기 조건은 시간 polling으로 확인한다.

온라인→오프라인에는 Chrome offline emulation과 서버의 503 차단을 함께 사용한다. Chrome의 브라우저 측 SW 업데이트 조회가 탭 emulation 밖에서 실행될 수 있어 서버도 전달을 막는다. 워커 응답을 route mock하거나 worker의 fetch/cache 구현을 대체하지 않는다. 기본 셸/저장 동작, 선택 미디어 누락, 대기/실패 업데이트, 작은 화면/실제 터치/입력, 엔딩/미수령·다른 탭·저장 실패, 지점/백업/import/reset을 검사한다. `test-results/verification/IMP-12-install.json`, screenshots/실패 PNG·trace·최근 요청 진단을 보관한다. 실제 OS의 홈 화면/런처 모양·iOS 설치 UI·프로덕션 Pages 배포는 이 Linux 자동 검사의 증명이 아니다.

서버 계약 순수 검사는 공개 PIN을 인증으로 취급하지 않는다. 네트워크 호출/실혜택/운영 데이터 변경이 없으며 request/receipt 상관관계·불명확/인증/충돌 응답의 제안 계약만 검증한다. 실제 인증/DB 경쟁·audit는 백엔드와 스테이징 제공 뒤 검증한다. [운영/실패 복구](pwa-operations.md), [서버 연결 조건](coupon-server-contract.md)을 참고한다.

## 여러 창과 실제 숨김 검사 (IMP-13)

Linux의 실제 숨김 검사는 **Xvfb 또는 DISPLAY**가 필요하다. GitHub의 `playwright install-deps chromium`이 Xvfb를 포함한다. 로컬 GUI가 없으면 시스템 Xvfb를 설치하거나 검증한 실행 파일을 `PLAYWRIGHT_XVFB_EXECUTABLE`로 지정한다. 현재 Debian 13 클라우드는 서명된 trixie apt metadata/패키지 검증을 유지해 Xvfb를 `/workspace/.cache/nice-chicken-gui/root`에 추출했다. 시스템 패키지·CA·TLS를 변경하지 않았다. Xvfb 패키지 2:21.1.16-1.3+deb13u3, SHA256 `365da2b6c93339f34337c434a9489bb6411a240fa47b9f49693d3091745f28c2`; 의존 라이브러리는 doctor로 실행 확인한다. 새 OS에서는 해당 배포판의 지원 패키지를 사용한다.

```bash
export PLAYWRIGHT_XVFB_EXECUTABLE=/workspace/.cache/nice-chicken-gui/root/usr/bin/Xvfb
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npm run doctor
node --test tests/concurrency.test.cjs
npm_config_cache=/tmp/nice-chicken-npm-cache npm run test:ci
node scripts/measure-concurrency.cjs
```

`scripts/display.cjs`가 임시 display·프로필로 전체 Chromium을 실행하고 `connectOverCDP({noDefaults:true})`로 연결한다. 일반 Playwright 세션은 기본 포커스 에뮬레이션 때문에 document.hidden이 바뀌지 않는다. 별도 CDP 세션에서 에뮬레이션을 끄는 것으로는 원래 세션의 override를 해제할 수 없다. 실제 탭을 활성화해 문서 visibility와 운영 동작을 검증하며 document.hidden을 재정의하지 않는다. GUI 검사용 no-sandbox는 기존 Playwright와 같은 격리된 합성 프로필에서만 사용한다. 프로필/프로세스/display를 종료하고 네트워크 앱/PIN/실혜택을 건드리지 않는다. 기본 headless 전체 검사와 별개로 이 실제 headed case도 필수다.

다중 창 fixture는 실제 Web Locks/LocalStorage/storage 이벤트/서비스워커를 쓴다. 미지원/거절·채널 없음·quota 오류만 해당 case의 capability/스토리지 경로에 합성 실패를 주입한다. Page.crash에서 실제 crash 이벤트를 확인하고 죽은 탭을 닫아 브라우저가 lock을 해제한 뒤 복구한다. 강제 종료 전 미저장 수익은 추측 복원하지 않는다. 작은 화면은 320×568/568×320 실제 tap·백업·인계와 PNG를 남긴다. 설치 창은 CDP PWA.install/standalone launch로 같은 origin 잠금을 확인한다.

async 조건은 bounded loop에서 page.evaluate를 await한다. Playwright 1.62의 waitForFunction에 async predicate를 넣으면 Promise가 먼저 truthy로 판단될 수 있어 대기 워커의 버전/installed/CacheStorage를 실제 값으로 확인해야 한다. 실패 JSON/trace에 release fixture·실제 registration·캐시·요청을 보관한다. Xvfb ENOENT/실행 실패에는 경로·ldd·doctor를 확인하고 skip으로 우회하지 않는다. measure-concurrency는 자체 임시 HTTP/context를 정리하며 합성 이전/이후 JSON을 [검증 폴더](improvements/verification/)에 기록한다.
