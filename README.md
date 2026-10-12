# 나이스치킨 타이쿤

모바일 중심의 치킨집 타이쿤 웹게임입니다. 손님을 선택하고 메뉴를 서빙하면서 매출, 평점, 직원, 연구, 미션, 쿠폰, 지역 확장을 성장시키는 구조입니다.

## 프로젝트 구조

HTML·CSS·JavaScript로 구성한 정적 웹게임입니다. 빌드 없이 GitHub Pages에서 실행합니다.

```text
/
├─ index.html
├─ css/style.css
├─ js/main.js
├─ js/core/             # 상태·저장·성장·정산·서비스·지점·엔딩·UI·시작 책임
├─ tests/               # Chromium 브라우저 회귀 검사
├─ package.json
├─ README.md
└─ docs/
   ├─ 2026-05-15-project-review-and-next-steps.md
   └─ manual-test-checklist.md
```

## 로컬 실행

정적 웹앱이므로 별도 빌드 없이 로컬 서버로 실행할 수 있습니다.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8000
```

## GitHub Pages 배포

현재 확인한 설정은 legacy / main / 루트 `/`입니다. main 병합·배포는 별도 승인 뒤 진행합니다. 개발 브랜치 CI는 배포를 수행하지 않습니다.

1. GitHub repo > Settings > Pages
2. Build and deployment: `Deploy from a branch`
3. Branch: `main` / `/ (root)` 선택
4. Save
5. 잠시 후 Pages URL이 생성됩니다.

## 모바일 테스트

- Android Chrome에서 Pages URL 접속
- 메뉴(⋮) → `홈 화면에 추가` 또는 `앱 설치`
- 터치 입력, 하단 탭, 모달 스크롤, LocalStorage 저장/복원을 확인합니다.

## 주요 기능

- 손님 선택 후 3x3 메뉴판에서 서빙
- 자동 서빙 및 오프라인 수익
- 배달/온라인 주문 자동 수익
- 업그레이드, 연구, 직원 성장
- 일간/주간 미션
- 쿠폰 및 주간 인증서
- 지역 확장 및 지점별 성장
- LocalStorage 기반 저장/불러오기

## 개발/점검 문서

- `docs/2026-05-15-project-review-and-next-steps.md`: 현재 구조 점검, 핵심 버그, 리팩터링 방향
- `docs/manual-test-checklist.md`: 배포 전 수동 테스트 체크리스트
- [현재 작업 목록](docs/improvement-roadmap.md)
- [복구 과정과 기준](docs/improvements/REC-recovery.md)
- [IMP-06 완료 보고서와 IMP-07 프롬프트](docs/improvements/IMP-06-mobile-ui.md)
- [본사·지점 데이터 규칙](docs/data-ownership.md)
- [IMP-07 완료 보고서와 IMP-08 프롬프트](docs/improvements/IMP-07-staff-branches.md)
- [실행 구조와 상태 변경 계약](docs/runtime-architecture.md)
- [설치·브라우저·CI·실패 진단 안내](docs/development.md)
- [IMP-08 완료 보고서와 IMP-09 프롬프트](docs/improvements/IMP-08-state-modules.md)

## 자동 검사

CI는 Node 24.19.0(`.nvmrc`), Playwright 1.62.1과 고정 Chromium을 사용합니다. 일반 게임 실행에는 npm 설치가 필요하지 않습니다.

```bash
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npm ci
npx playwright install chromium --no-shell
npm run doctor
npm run check
npm test
```

공통 설치·진단·검사는 `npm run test:ci`로 실행합니다. 기본 npm 캐시를 쓸 수 없는 클라우드에서는 `npm_config_cache=/tmp/nice-chicken-npm-cache`를 지정합니다. 시스템 Chromium을 비교하려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`을 지정합니다. 자세한 Linux 의존성·서버 실행·실패 로그와 trace 재현은 개발 안내를 참고하세요.

브라우저 회귀 검사 92개: 오프라인 6개, 미션 7개, 연구 6개, 경제 10개, 엔딩 7개, UI 22개, 직원·지점 19개, 구조·저장 15개. 문법 검사는 앱 JS 17개와 도구/helper CJS 6개, 총 23개입니다. 이전 환경의 96개 검사 파일을 동일하게 복원한 것은 아닙니다.

Game CI는 일반 push/PR에서 같은 명령을 실행하며 열린 PR의 중복 push 검사를 생략합니다. 실패 자료는 Actions artifact에서 14일간 보관합니다. 과거 자동 패치·commit/push 워크플로 7개는 `docs/legacy-workflows/`에 보관했습니다.

## 현재 우선순위

1. REC-01~05 기반 동작 재구현 및 IMP-06 화면·모달 개선: 완료
2. IMP-07 직원 6명과 본사·지점별 데이터 규칙: 완료
3. IMP-08 단일 실행 경로·명시적 저장·측정 기반 반복 작업 개선: 완료
4. IMP-09 개발 문서·지속 검증: 완료
5. IMP-10 성장 밸런스·큰 수: 다음 작업
6. 전체 계획은 작업 목록 참고

다음 작업은 원격 `improvement-imp09-20261012` 브랜치를 기준으로 진행합니다. 직원 교육·개인 누적 수익은 전 지점 공용이고, 고용·매출·기여도·미수령 보상·서비스 진행은 지점별입니다.

## 참고

현재 `index.html`에는 `manifest removed for file:// compatibility` 주석이 있으며, 완전한 PWA 구성을 사용하려면 `manifest.webmanifest`와 service worker 연결을 다시 정리해야 합니다.


성능 측정은 `node scripts/measure-runtime.cjs`로 실행합니다. 고정 날짜·난수의 브라우저에서 DOM·효과 합산·문자열화·저장 연산 수와 참고 시간을 출력합니다. 비교 방법과 측정 원본은 IMP-08 보고서를 참고하세요.
