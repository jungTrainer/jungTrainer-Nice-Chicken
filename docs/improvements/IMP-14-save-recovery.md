# IMP-14 저장·백업 복구 강화

2026-10-13. 기준 `origin/improvement-imp13-20261013`의 `c7402dda0b3524492becaba931604ab11d8a71b6`. 보관 브랜치 `improvement-imp14-20261013`, [Draft PR #8](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/pull/8), 리뷰 대상은 IMP-13이다. main 병합·Pages 배포·실제 혜택 사용·운영 변경은 수행하지 않았다.

## 재현한 손실과 해결

| 합성 저장을 실제 Chromium에서 재현 | 이전 | 변경 후 |
| --- | --- | --- |
| 깨진 본 저장 + 정상 backup + 본 write 실패 | 정상 backup이 `{broken`으로 교체됨 | 자동 write 거절, 본/정상 backup 원문 유지 |
| 본/backup 둘 다 손상 | 기본 상태가 본 저장에 자동 저장됨 | 신규와 구분, 운영/저장 중단·원문 보존 |
| JSON은 유효하나 게임 구조가 잘못됨 | 일부 값만 가져와 기본 필드로 저장 | 검증에서 중단, 후보/오류 표시 |
| 읽기 거절 | 시작 실패 상태 | lock 보유·운영 중단, 권한 복구 뒤 명시적 선택 |
| backup write 실패 | console 경고만 있음 | 본 commit과 backup 실패를 구분해 지속 안내 |
| 본 write 실패 | dirty/진행 유지 | 기존 계약 유지, 명시적 백업/재시도 제공 |
| 초기화 본 write 실패 | 기존 root로 rollback | 세대 준비/본 실패를 구분하고 기존 root/진행 유지 |
| 초기화 후 backup 삭제 실패 → 본 손상 | 옛 500원 미수령·쿠폰 복원 | 이전 세대 후보 차단, 손상 원문 그대로 보존 |
| 복구/저장 실패 중 reader 요청 | 일반 동시성 guard만 있음 | 복구 중 지급/쓰기/인계 금지, 성공 선택 뒤 최신본 인계 |

[이전](verification/IMP-14-recovery-before.json)/[이후](verification/IMP-14-recovery-after.json) JSON과 `scripts/measure-recovery.cjs`에 원문·메모리·반환/역할·page error를 기록했다. 대상은 localhost 합성 profile이다. 실제 사용자의 저장/혜택을 건드리지 않았다.

## 변경 방법

`recovery.js`를 state 다음·session 앞에 추가했다. 저장 후보의 JSON/필수 구조·금액 encoding·paid 타입/지원 버전 검사를 sanitize와 실제 write에서 분리한다. 현재 형태 및 식별 가능한 버전 없는 구 최소 저장을 지원하고 알 수 없는 자료는 coercion/덮어쓰기하지 않는다. 모르는 확장 필드와 기존 Number/정수 문자열 정책을 유지한다.

정상 본 저장과 정말 저장이 없는 신규 실행만 운영한다. 유효 backup은 화면 미리보기이고, 명시적 선택 전 tick·dirty·사업 입력·수령·import/reset·PWA/인계를 실행하지 않는다. 읽기 권한이 복구되거나 외부 원문이 바뀌어도 paused writer가 자동 재개하지 않는다. reader는 진단/백업만 가능하다.

복구 UI는 본/이전 backup·출처/시각/지점/미수령·오류를 구분하고 원문 다운로드, 취소/닫기, 후보 선택, 외부 수동 백업, 이 창 미저장 백업과 현재 진행 재시도를 제공한다. 원문 archive를 쓰지 못하면 선택 commit도 거절한다. 원문 보관 성공과 본 commit 성공을 구분하고 본 실패는 root·서비스 owner·연출·dirty를 복원한다. 정상 save는 유효 본 원문만 backup으로 회전한다.

복구는 선택 snapshot으로 명시적으로 돌아가는 동작이다. 그 후보의 확정 receipt와 paid 상태를 유지하고 접속 기준을 현재로 정해 불확실한 과거 부재 구간의 수익을 만들지 않는다. 최신 지급 이력을 증명할 자료가 사라졌으면 그것을 복원했다고 주장하거나 합산하지 않는다.

동기 저장·본/backup 키·평문 게임 루트·수동 export envelope v1은 유지했다. root의 `_saveRecovery`는 version/generation/commit, 별도 `resetFence`는 새 세대·직전 원문 식별자를 본 commit 앞에 준비한다. 준비 write 실패면 reset하지 않는다. 유효 본 원문과 비교해 reset 전/후를 구분하고, 본 손상으로 확정할 수 없는 경우 이전 세대 backup 복원을 차단한다. 후속 정상 save는 기존 진행을 준비 세대에 보존한다. backup 삭제 실패여도 초기화 전 자동 부활은 없다. 전체 IndexedDB 이관은 하지 않았다.

원문 식별자는 길이·두 32-bit hash이며 인증/암호학적 무결성이 아니다. 다중 키를 원자적 transaction이라고 주장하지 않고 중간 상태를 분류해 불확실하면 멈춘다. 자세한 지원/필드/실패 순서는 [복구 정책](../save-recovery-policy.md), [데이터 규칙](../data-ownership.md), [실행 계약](../runtime-architecture.md)에 있다.

건강한 진행의 저장 실패는 설정의 지속 안내로 표시하고 진단을 명시적으로 연다. 자동 큰 패널로 PIN/엔딩/PWA 재시도 입력을 가리지 않는다. 저장 손상/읽기 오류에만 운영을 차단한다. 명시적 진단/원문/입력 작업 중에는 인계·업데이트 적용을 거절한다.

## 검증 결과

| 검사 | 실제 결과 |
| --- | --- |
| 최종 로컬 공통 `npm run test:ci` | **223 pass / 0 fail / 0 skip**, 448.4초 |
| doctor/check | headless DOM·native hide/resume 통과, **37개 문법**·PWA 생성물 일치 |
| 기존 회귀 | 197개 유지. 자동 backup 복구 3개 시나리오에 사용자 선택을 추가하고 모든 기존 보존 assertion 유지 |
| 새 복구 | 23개: 구조/권한/쓰기/삭제 오류·원문 export/취소/선택·archive/primary commit 실패/재시도·fence·인계·작은 화면 |
| 새 실제 SW/PWA | 3개: 오프라인 셸 복구/재접속·대기/실패 업데이트 보호·설치 standalone reader의 명시적 복구 |
| 진단 화면 추가 확인 | 320×568/568×320 실제 입력/스크롤/닫기 2개 통과(전체 223개 중 해당 case 재실행) |
| Firefox 153 / WebKit 26.5 | 실제 실행·Web Locks/BroadcastChannel/SW capability·손상 중단·reader 차단·복구·인계·원 단위/미수령 확인, page errors 0 |
| 구현 `ed706eee56312a8b7db1add8ef34d636b3ad30d1` PR CI | [38343724315](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38343724315), success, 223개/doctor/check |
| 같은 SHA push | [38343714980](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38343714980), select success; 열린 PR이 무거운 검사 소유 |

새 구조는 HTML scripts 21개·필수 셸 26개다. 앱 JS 22개와 scripts/helper CJS 15개를 검사했다. classic 단일 정의·boot 마지막, 직원 6명·HQ/지점·서비스 부분 진행/배달 signature·연구·미션/인증서·쿠폰·엔딩 1회·모달/dirty·정산을 회귀로 확인했다. 새 이미지를 추가해 PWA 선택 자산 설치를 바꾸지 않았다.

초기 전체 실행은 구 최소 seed의 export 거부와 저장 실패 안내가 PWA 재시도 버튼을 가리는 실패 3개를 발견했다. 실행 중 생성물 변경으로 일부 startup이 멈춰 해당 실행은 중단했고 통과로 기록하지 않았다. 구 자료 인식·안내 위치를 수정하고 helper에 20초 startup 확인을 추가한 뒤 코드를 고정해 전체 223개를 재실행했다. skip/무한 대기/에러 무시로 통과시키지 않았다.

Firefox/WebKit은 기본 workspace-write 환경에서 /proc uid/shared-memory·미설치 라이브러리·wrapper 검색 경로 문제를 만났다. signed Debian package를 로컬 cache에 준비하고 vendor 파일은 교체하지 않았다. 자동 검토가 허용한 제한 밖 exec의 임시 profile/localhost probe에서 두 엔진이 통과했다. [결과 JSON](verification/IMP-14-browser-support.json)과 [재현 안내](../development.md)에 버전/상태/한계를 기록했다. 실제 iPhone 설치·OS background/강제 종료나 두 엔진의 전체 223개를 검증한 것으로 표현하지 않는다.

[세로 진단](screenshots/nice-chicken-imp14-portrait-diagnostics.png) · [가로 진단](screenshots/nice-chicken-imp14-landscape-diagnostics.png) · [복구 후 미수령](screenshots/nice-chicken-imp14-portrait.png) · [오프라인](screenshots/nice-chicken-imp14-offline.png) · [설치 창](screenshots/nice-chicken-imp14-installed.png).

## 보존·한계·남은 문제

- 원 단위 정산/목표·확정 미수령·paid·기존 쿠폰·직원/지점/운영·서비스/연구·엔딩·입력 규칙을 유지했다. 서버·계정·실혜택 처리·쿠폰 발급 조건·반복 미션·지역 엔딩·난이도·광고는 구현하지 않았다. 과거 수익을 추측 추가하지 않았다.
- 이전 backup은 최신 진행/지급 이력을 증명하지 못한다. 명시적 snapshot 교체는 진행이 이전 시점으로 돌아갈 수 있으며 사라진 최신 자료의 완전 복구를 보장하지 않는다.
- 원문 archive가 공간을 사용한다. quota에는 복구를 거절하고 수동 원문 내보내기를 제공한다. 입력 한도는 8MiB다. 원문은 자동 로드 대상이 아니며 reset 이전 원문을 사용자 직접 import하는 것은 자동 부활과 구분한다.
- Web Locks 미지원은 읽기 전용이다. 구 앱/직접 LocalStorage 편집/전체 삭제/디스크 장애를 서버 권한처럼 막지 않는다. 구 창을 닫고 호환 셸로 사용한다. 세대 metadata를 모르는 옛 앱은 rollback 후보가 아니다.
- 실기기·스크린리더·터치 키보드/OS freeze/실제 설치 UX는 추가 검증 범위다. 기본 제한 환경의 Firefox 실패를 passed로 덮어쓰지 않았으며 범위를 명시한 별도 probe만 통과로 기록했다.
- 시작 전 IMP-10 사용자 오타 편집은 그대로 남기고 커밋/개선 패치에서 제외한다. 이미 작성된 제품/후속 계획 문서는 내용 그대로 함께 보관한다.

## 커밋·복구 자료

분석/측정·정책 `4d23391` → 구현/기존 시나리오 호환 `a2222ec` → 새 회귀/증거 `ed706ee` → 완료 문서/추가 진단 PNG를 별도 커밋했다. 기준은 c7402dd이며 전체 patch·순서 format-patch·완전 history bundle·SHA256/tree 검증과 실제 CI JSON을 `/workspace/nice-chicken-imp14-*`에 보관한다. 최종 문서 head의 CI 결과는 해당 JSON과 PR checks로 확인한다.

같은 setup script로 dependency/doctor/check를 재검증하고, optional Firefox/WebKit OS 라이브러리/실행 제한 안내를 온보딩 install_script/start_skill 초안에 저장했다. 저장은 환경 적용/게시가 아니다. 환경 설정에서 검토·저장 후 게시하면 재사용할 수 있으며 새 task 복원은 별도 확인이다.

## IMP-15 시작 프롬프트

```text
origin/improvement-imp14-20261013 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/save-recovery-policy.md, docs/session-ownership.md,
docs/economy-policy.md, docs/content-design.md,
docs/pwa-operations.md, docs/product-direction.md,
docs/improvements/IMP-14-save-recovery.md를 읽고 IMP-15를 구현해줘.

현재 일간/주간·성장 미션과 최대 업그레이드 뒤 반복 서빙 전환,
게임머니 교환·인증서/쿠폰·로컬 사용 기록을 먼저 분석/측정해줘.
성장 업적과 최대 성장/엔딩 뒤에도 가능한 반복 미션을 구분하고,
매장 고객이 짧게 즐길 방문용 목표와 기간별 발급 정책을 설계해줘.
잠긴 메뉴/불가능 구매/처리 불가능 채널을 필수 반복 목표로 뽑지 마.
기존 진행/완료/지급 상태를 보존하고 새 목표 적용 시점을 명시해줘.

백엔드·계정·서버 쿠폰 검증은 개발하지 마.
음료 1병은 테이블의 한 방문에 한 번 제공하는 운영 방향이다.
기기 간 테이블 횟수가 공유되지 않음을 명시하고
직원에게 보여주기/제공 확인/사용 전후 기록 UI를 설계해줘.
양배추·무의 추가 제공 횟수나 새 발급 한도는 기존 규칙을 확인하고,
결정되지 않은 운영 값은 실제 적용 전 구체적인 안으로 정리해줘.
게임 성장 재화와 실물 혜택 발급 기준을 구분하되,
기존 쿠폰 수량/사용 이력을 소급 삭제하거나 지급하지 마.
실제 혜택 사용·운영 변경·main 병합/배포는 수행하지 마.

원 단위 정산·기존 저장/백업·확정 미수령·paid 미션/인증서/쿠폰,
직원 6명·HQ/지점·운영/메뉴/담당자/읽음·서비스/연구 캐시,
엔딩 1회·모달 입력·dirty/저장·단일 작성자/인계·PWA·
명시적 복구·원문 보관/초기화 세대를 보존해줘.
과거 미기록 수익을 보정하지 마.
지역 엔딩·난이도·광고는 후속 단계로 분리해줘.

최대 성장·기간 전환·반복 달성/재열기·저장 실패/복구·다중 탭·
지점 이동·오프라인·백업/import/reset·작은 화면을
실제 Chromium 입력/스크린샷으로 검증해줘.
현재 223개와 새 미션/쿠폰 UI 검사·doctor/check/test·최종 SHA CI를 통과시켜줘.
앱 변경 시 pwa:build를 갱신하고 커밋·패치·번들·작업 목록·
보고서·남은 문제·IMP-16 지역 엔딩/이지·노말 프롬프트를 남겨줘.
```
