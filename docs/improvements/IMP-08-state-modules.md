# IMP-08: 단일 실행 경로와 명시적 저장

완료일: 2026-10-12. 기준: `origin/improvement-imp07-20261012`, `bf18a396b8fd97f4bad4e7a9fed8829f85e32bf6`.
보관 브랜치: `improvement-imp08-20261012`. main 병합·배포는 수행하지 않았다.

## 변경 방법

기준 77개 검사를 먼저 통과시키고 같은 Chromium 시나리오에서 DOM·효과 합산·문자열화·LocalStorage 작업을 계측했다. 처음에는 상태 변경/저장 경로를 만든 뒤 저장 감시를 제거했고, 다음 단계에서 core의 최종 동작과 필요한 이전 구현을 한 함수로 합쳤다.

1. `markStateChanged(reason, effectsChanged)`와 직접 저장 호출을 구매·수익·미션·연구·레벨·이벤트·입력·서비스 진행에 배치했다. 틀린 서빙, 깨끗한 상태에서 음량/이름 변경, 교환·로그 정리도 감시 없이 저장될 수 있게 했다. 수령/인증서/엔딩/지점 이동의 기존 실패 복구는 유지한다.
2. utils의 branch snapshot/bootstrap/save 래퍼와 중요 상태 비교·3초 감시를 제거했다. `save(true)`가 직접 활성 지점과 진행을 동기화하며 성공 시에만 dirty를 해제한다. 초기에만 쓰기를 미루고 초기화 완료 시 최종 상태를 저장한다. 내보내기도 최신 snapshot을 포함한다.
3. 가격·온라인·배달·오프라인·미션·직원 연구·엔딩·메뉴 연구의 이전 정의와 함수 재할당 체인을 제거했다. 직원 연구는 최종 처리량에서 직원 기여도에 한 번 적용하고, 로봇 효과도 합산 원본에 한 번 포함한다. 인증서는 지급과 이미지 렌더링을 분리했다. `onCanvasDown`의 앞선 중복 정의도 삭제했다.
4. `state.js`, `persistence.js`, `growth.js`, `services.js`, `boot.js`로 상태/저장/성장/서비스/시작 책임을 나눴다. `main.js`는 입력·고객·장면·DOM 렌더링과 루프를 맡는다. 전역 함수 217개의 소유 파일·변수 목록과 실제 호출 의존성을 [실행 구조](../runtime-architecture.md), [전체 전역 목록](../runtime-globals.json)에 정리했다. `ui.js`의 지도 함수 교체도 지도 렌더링 안의 접근성 속성으로 통합했다.
5. 지점 `saveCurrentTo`/`loadFrom`/sanitize/서비스에서 필요한 소유권 호출을 직접 연결했다. `ServiceRuntime`은 지점/상태와 배달 캐시 소유자를 관리한다. 기존 JSON 배달 서명을 보존하고 입력이 바뀔 때만 문자열화한다. 재접속만으로 간격을 재추첨하지 않는다. 자동 서빙 진행은 정산 저장 전에 차감한다.
6. 효과 캐시는 tick/UI 한 번의 동기 범위에서만 공유하고 효과 변경 시 무효화한다. 스탬프·메뉴 수익 표를 같은 값으로 다시 만들지 않으며 버튼 참조를 소유 DOM 재생성 시 갱신한다. branch clone도 필드마다 JSON 변환하던 작업을 한 번의 구조 복제로 바꿨다. legacy branch 안의 알 수 없는 필드는 보관한다.
7. 가져오기/초기화는 새 상태를 먼저 저장한 뒤 기존 실행을 취소한다. 저장 실패 시 원래 root 객체·미수령·쿠폰·진행·클릭 효과와 진행 중 엔딩을 보존한다. 성공한 초기화는 새 저장을 남기고 오래된 backup을 제거해 진행이 되살아나지 않게 했다.

## 호환과 유지한 규칙

저장 키·버전·기존 직원 6명·본사 교육/개인 수익·지점 고용/매출/기여도·미수령 금액을 유지했다. 지급 완료 미션과 쿠폰·인증서 플래그를 과거 수익으로 보정하거나 재지급하지 않는다. 알 수 없는 legacy 지점 필드를 합산하지 않는다. 가격·연구 배율·정산 원장과 엔딩 해금 목표/1회 효과를 유지했다. 모달 닫기는 수령/삭제를 하지 않으며 입력 소유권·안전 영역·포커스 규칙도 유지한다. 밸런스·큰 수는 IMP-10이다.

## 성능 측정

Node 24.19.0, Debian Chromium 151.0.7922.173, 390×844, Asia/Seoul, 고정 날짜/난수와 rAF 정지 상태. 각 작업을 5회 실행하고 연산 수는 3번째 표본, 시간은 중앙값을 기록했다. 9종 메뉴에 판매 내역을 넣은 동일 시나리오다.

[기준 원본](measurements/IMP-08-before.json) · [변경 원본](measurements/IMP-08-after.json).

| 작업 | 비교한 연산 | 이전 → 변경 |
| --- | --- | --- |
| UI 200회 | querySelectorAll / createElement | 400 / 3,600 → 0 / 0 |
| 통계 20회 | createElement | 920 → 20 |
| tick 200회(10초) | JSON.stringify / 효과 합산 | 1,241 / 1,404 → 1 / 201 |
| tick 200회 | querySelectorAll / createElement | 400 / 3,600 → 0 / 8 |
| 업그레이드 1회 | JSON.stringify / Storage.setItem | 28 / 4 → 1 / 2 |

업그레이드의 Storage 2회는 본 저장 1회와 이전 본 저장의 backup 1회다. tick 200회의 저장은 이전과 변경 모두 본 저장/backup 각각 1회로 autosave 주기를 유지한다. 참고 중앙값은 UI 67.6→7.0ms, 통계 9.8→2.4ms, tick 69.1→10.0ms, 구매 1.8→1.5ms였다. 이 시간은 클라우드의 단일 측정 결과이며 실기기 성능 보장은 아니다.

재현:

```bash
mkdir -p /tmp/nice-chicken-imp08-baseline
git archive bf18a396b8fd97f4bad4e7a9fed8829f85e32bf6 | tar -x -C /tmp/nice-chicken-imp08-baseline
node scripts/measure-runtime.cjs /tmp/nice-chicken-imp08-baseline
node scripts/measure-runtime.cjs
```

## 검증 결과

- `npm run check`: main·core 15개·sw, 총 **17개 통과**.
- `npm test`: 기존 **77개**와 refactor **15개**, 총 **92개 통과**. 실패/건너뜀 0개.
- 기존 7개 검사 파일의 assertion이나 fixture를 변경하지 않았다. 지점 이동·연구 0/1/10레벨·실제 자동 서빙·배달·재접속·백업·가져오기·초기화·엔딩·모달 입력의 기존 브라우저 검사를 그대로 실행했다.
- 새 검사는 단일 정의/boot 순서, 구매 1회 저장과 snapshot/backup, tick dirty/무감시, 틀린 서빙 재접속, 캐시 범위/무효화, 메뉴 가격, 같은 DOM 유지, 최신 백업과 legacy 필드, 배달 간격 복원, 실패한 가져오기 중 엔딩 유지, 실패한 초기화, 성공 초기화 후 backup 복구 차단, 저장 재시도, 실제 백업/가져오기 버튼, 이름/음량 즉시 저장을 검증한다.
- [320×568 백업/가져오기 화면](screenshots/nice-chicken-imp08-backup-small.png)을 캡처하고 확인했다. 기존 4개 화면·실제 터치·라이브 rAF 검증도 통과했다.
- `git diff --check`, 기준 트리에서 전체 패치 적용 가능 여부, Git bundle 유효성을 확인한다.

## 보관

단계별 커밋:

1. `6bdb1fa`: 명시적 변경·저장 경로를 만든 뒤 저장 비교 감시 제거. 오프라인·경제·지점 35개 검사 통과.
2. `5b75dff`: 단일 사업 함수·모듈/소유권·성능 개선. 기존 77개, 전체 92개와 문법 검사 통과.
3. refactor 검사·측정 원본·구조 문서·본 보고서/작업 목록을 별도 커밋으로 보관한다. 최종 SHA는 브랜치와 단계별 패치에 기록된다.

전체 패치 `/workspace/nice-chicken-imp08.patch`, 단계별 패치 `/workspace/nice-chicken-imp08-patches/`, 번들 `/workspace/nice-chicken-imp08.bundle`을 남긴다. 전체 패치/번들은 위 IMP-07 기준 커밋을 prerequisite로 사용한다.

## 남은 문제

- 클래식 전역 binding과 DOM refs에 대한 상호 호출은 남아 있다. 이번 작업은 소유 파일과 단일 실행 경로를 명시했다. 추가 기능은 같은 계약을 따르고, ES module 전환은 별도 호환 검증과 함께 진행해야 한다.
- CI가 일반 push/PR에서 검사와 문서를 지속 검증하도록 연결하는 일은 IMP-09다. 설치/실행/배포 문서와 점검표에도 실제 명령·실패 진단을 반영해야 한다.
- 단일 프로세스의 LocalStorage 저장이며 여러 탭 동시 수정과 두 키의 원자적 교체를 해결하지 않았다. snapshot 비용은 지점·고객·로그 수에 비례하고 로그/지점이 더 커지는 시나리오는 추가 측정이 필요하다.
- 실기기·스크린리더·실제 스피커 청취는 미실시다. 전체 장면 canvas의 rAF 렌더링을 줄이는 작업은 수익/입력 변경 없이 별도 측정해야 한다.
- 과거 누락 수익을 복구할 원본이 없다. 큰 수 정밀도·후반 성장·목표액은 IMP-10, PWA/캐시 업데이트와 서버 쿠폰 검증은 IMP-12다.

## IMP-09 시작 프롬프트

```text
origin/improvement-imp08-20261012 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/improvements/IMP-08-state-modules.md를 읽고
IMP-09를 구현해줘.

실제 설치·정적 서버 실행·Chromium 검사 명령과 실패 진단을 개발 문서에 정리하고,
일반 push/PR에서 npm ci, npm run check, npm test를 실행하는 CI를 구성해줘.
현재 워크플로와 배포 방법을 먼저 확인하고 중복 실행·권한 과다·배포 자동 승인을 피하며,
92개 검사와 정의/boot 순서·저장·지점·엔딩·모달 입력 계약을 지속 검증해줘.
브라우저/Node 버전·실행 파일 설정과 실패 로그·스크린샷 보관을 명시하고,
성능 계측은 재현 가능한 참고 자료로 유지해줘.

직원 6명과 본사/지점 데이터, 기존 저장·미수령·지급 완료 보상·쿠폰,
정산·연구·엔딩·입력 규칙을 보존하고 밸런스·큰 수는 IMP-10으로 분리해줘.
CI 명령을 로컬에서도 실행하고 가능한 원격 실행 결과를 확인해줘.
main 병합·배포는 별도 승인 전 수행하지 마.
단계별 커밋·패치·번들과 작업 목록·완료 보고서·남은 문제·IMP-10 프롬프트를 남겨줘.
```
