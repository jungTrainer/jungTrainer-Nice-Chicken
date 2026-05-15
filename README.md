# 나이스치킨 타이쿤

모바일 중심의 치킨집 타이쿤 웹게임입니다. 손님을 선택하고 메뉴를 서빙하면서 매출, 평점, 직원, 연구, 미션, 쿠폰, 지역 확장을 성장시키는 구조입니다.

## 프로젝트 구조

현재 버전은 GitHub Pages 배포를 쉽게 하기 위해 `index.html` 단일 파일 중심으로 구성되어 있습니다.

```text
/
├─ index.html
├─ README.md
└─ docs/
   ├─ 2026-05-15-project-review-and-next-steps.md
   └─ manual-test-checklist.md
```

## 로컬 실행

정적 웹앱이므로 별도 빌드 없이 로컬 서버로 실행할 수 있습니다.

```bash
python3 -m http.server 8000
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8000
```

## GitHub Pages 배포

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

## 현재 우선순위

1. `staffUpgradeCost` 중복 함수명 정리
2. CSS/JS 파일 분리
3. 핵심 게임 루프 수동 QA
4. 직원/배달/지역 확장 밸런스 조정
5. PWA manifest/service worker 복구 여부 결정

## 참고

현재 `index.html`에는 `manifest removed for file:// compatibility` 주석이 있으며, 완전한 PWA 구성을 사용하려면 `manifest.webmanifest`와 service worker 연결을 다시 정리해야 합니다.
