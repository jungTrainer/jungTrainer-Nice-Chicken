# IMP-15 반복 미션·방문용 서비스 쿠폰

기준 `origin/improvement-imp14-20261013`의 `a9913960a18c91fe531ce15e2e98ad96ee12b651`. 보관 브랜치 `improvement-imp15-20261013`, [Draft PR #9](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/pull/9), 리뷰 기준 IMP-14. main 병합·배포·실제 혜택 사용/매장 운영 데이터 변경·백엔드/계정/서버 인증을 수행하지 않는다.

## 분석·측정

[이전](verification/IMP-15-missions-before.json)/[이후](verification/IMP-15-missions-after.json)는 실제 Chromium151의 localhost 합성 profile이다. `scripts/measure-missions.cjs [정적 비교 트리]`로 재현한다.

| 경로 | 측정과 판단 |
| --- | --- |
| 현재 미션 | 일간/주간 각각8종. 최대 성장에서는 구매/간판/확장3종이 같은 서빙 목표로 바뀐다. |
| 대표 메뉴 | 불닭 지정 목표인데 주문 후보는 후라이드만인 조합을 재현했다. 새 반복은 실제 메뉴 판매 어느 것이든 센다. |
| 수동 기회 | 자동 진행10을 보유한 최대 성장에서 손님은 0.05초 tick에 퇴장했다. 도전은 직접/자동 정확 서빙을 모두 인정한다. 자동 속도/회전/캐시를 바꾸지 않는다. |
| 방문 길이 | 초반15주문/분에서 5주문의 공급 추정20초. 최대65.28주문/분·자동31.1408서빙/분(실제2배)은 이전/이후 동일하다. 장면/인내심/사용자 입력을 포함한 사람의 플레이 시간 보장은 아니다. |
| 발급 | 기존 지점별 일간 veg1장·주간 스탬프1(하루1번), 스탬프7 포함 주간 올클→인증서/음료1장 유지. 기기 전체 일간 한도가 아니다. |
| 교환 | 5,000만원당1장 유지. 100해 보유금은 산술상200조장 교환 가능하여 성장/난이도와 실물 발급의 분리가 필요하다. 새로운 한도는 미적용 검토안이다. |
| 사용 저장 실패 | 이전 메모리4장/디스크5장·사용 로그 생성. 이후 둘 다5장·추가 로그없음, 게임의 이전 dirty는 보존한다. |

정산/가격/비용/자동 처리량/엔딩 목표는 이번 단계에서 바꾸지 않았다. IMP-10 연속 운영98.5시간 모델을 새 밸런스 결과처럼 재사용하지 않는다. 실제 엔딩/이지·노말 재측정은 IMP-16이다. 오래된 원 Number의 잃은 원/기록 없는 과거 매출을 복원하지 않았다.

## 변경 방법

기존 현재 목록·진행·done·dailyCompletedToday와 인증서/쿠폰은 유지한다. 다음 일간과 다음 주간이 **각각** 시작할 때 policy2를 생성한다. 기존 지정 메뉴는 현재 기간에 유지하고 실제 메뉴 이름·운영 전환 안내를 표시한다. 기존 최대 성장의 목표 수리도 유지한다.

v2는 구매3종을 추가 서빙/전체 메뉴 판매/접속 시간으로 대체하고 지정 메뉴를 모든 실제 판매로 바꾼다. 일간은12회/6회/60초, 주간60회/60회/300초다. 기존 매출/평점/팁/스탬프·기간/발급 수량은 유지한다. 잠긴 메뉴/불가능 구매/배달·온라인 채널은 필수가 아니다. 접속 시간은 기존 writer tick에서 지점별 누적하고 독자/오프라인 wall clock을 채우지 않는다. 새 타이머가 없다.

성장 업적은 실제 고용/해금/연구/확장/엔딩 조건을 표시한다. 별도 돈/쿠폰을 지급하지 않는다. 지점별 방문 게임 도전은 명시적 시작→정확 서빙5회→게임 기념 완료다. 직접/자동을 인정하고 다시 도전/재열기/닫기는 새 실물 보상이 아니다. 완료 목표와 서비스 테이블 방문은 독립적이다.

쿠폰함에 테이블·새 식사 방문·직원에게 보여주기·제공 전/후·쿠폰 잔량을 표시한다. 보여주기/닫기는 사용이 아니다. 음료는 새 방문을 기록하고 직원의 실제 제공 확인 안내→공개 로컬 PIN→성공 primary 저장 뒤 사용 기록을 남긴다. 같은 기기 현재 방문의 음료 재확인을 막고 실제 테이블의 다른 기기 합계는 직원이 확인한다고 명시한다. 양배추/무는 기존 통합 veg 수량을 유지하며 양/추가 횟수를 임의 확정하지 않는다.

쿠폰 사용/교환/새 방문/로그 정리는 영향을 준 필드와 현재 진행을 commit 앞에 보관하고 저장 실패 때 되돌린다. PIN await의 root/region/epoch에 방문 id 검사와 중복 요청 차단을 추가했다. 새 로그에는 잔량 before/after·테이블·방문 id를 추가하고 옛 로그는 있는 그대로 표시한다. 최근80개/명시적 정리 규칙은 유지하며 로그 정리로 음료 제공 상태를 지우지 않는다. 사용자 문자열은 textContent로 표시한다.

열린 미션 카드가 진행1회를 상태에 반영하면서 화면0/6으로 남는 기존 문제를 별도 검사로 재현했다. updateUI에서 같은 카드/캐시한 참조의 텍스트만 갱신하고 포커스/스크롤을 유지한다. 조회에서 목표/paid/dirty를 변경하지 않는다.

HQ `serviceVisit`, 지점별 `missions.visitChallenge`·policy/접속 카운터의 규칙은 [소유권](../data-ownership.md)/[런타임](../runtime-architecture.md), 발급 이행/운영 검토안은 [미션·서비스 정책](../missions-service-policy.md)에 있다. 복구는 새 기록 타입/알 수 없는 policy를 검사하며 원문 보관·명시적 snapshot 선택·세대/초기화 fence를 유지한다. 새로운 백업은 IMP-15 이후 셸에서 사용한다. 구 셸은 새 목표/방문 확인을 이해하지 못하므로 rollback 지원이라고 주장하지 않는다.

## 검증 결과

| 검증 | 실제 결과 |
| --- | --- |
| 로컬 공통 `npm run test:ci` | **254 pass / 0 fail / 0 skip**, 418.6초. npm ci→고정 Chromium→doctor→check→test 실제 실행 |
| doctor/check | Node24.19.0/Playwright1.62.1/Chromium151, DOM·native hide/resume, **38개 문법**·생성물 일치 |
| 기존 회귀 | **223개 유지**. 현재 기간 fixture는 v1 snapshot을 명시하고 원래 assertion을 삭제하지 않음 |
| 새 목표/방문/저장/UI | **28개**. 현재/다음 기간·최대 성장·직접/자동·paid/재열기·실패/재시도·원/방문 전후·지점·복구·인계·실제 작은 화면 입력/스크롤/포커스·열린 진행 표시 |
| 새 실제 PWA | **3개**. 실제 SW 오프라인 셸·대기/실패 업데이트와 PIN/저장 거절·설치 standalone reader→종료 후 최신본 상속 |
| 구현 SHA `2900b0d1b8857a04c4117ec2f80d5c8a27839dd2` PR CI | [38347879879](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38347879879), success, **254개/doctor/38개 문법**, 294.2초 test |
| 같은 SHA push | [38347875567](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38347875567), select success; 실제 회귀는 PR이 소유 |

최종 문서 head에서도 CI를 다시 실행하고 PR checks/`nice-chicken-imp15-ci-results.json`에 실제 head SHA와 검사 실행 결과를 별도로 보관한다. skip/select 성공을 회귀 통과로 합산하지 않는다. 최종 문서 커밋은 테스트한 런타임/생성물을 바꾸지 않는다.

범위별 기존57개와 신규27개, 추가 최대 자동성장/방문 실패/실패 인계/열린 카드4개도 각각 통과했다. 중간 전체 실행은 열린 카드 표시 문제 확인 뒤 종료했고 통과로 기록하지 않는다. 초기 새 검사에서 서비스 진행의 정규화 범위를 벗어난 fixture와 재로딩 중 이전 문서 조회를 수정했다. assertion/실패를 제거하거나 skip으로 바꾸지 않았다.

[세로 도전](screenshots/nice-chicken-imp15-portrait-missions.png) · [세로 제공 전](screenshots/nice-chicken-imp15-portrait-staff-before.png) · [세로 제공 후](screenshots/nice-chicken-imp15-portrait-staff-after.png) · [가로 도전](screenshots/nice-chicken-imp15-landscape-missions.png) · [가로 제공 전](screenshots/nice-chicken-imp15-landscape-staff-before.png) · [가로 제공 후](screenshots/nice-chicken-imp15-landscape-staff-after.png) · [오프라인](screenshots/nice-chicken-imp15-offline.png) · [실제 설치 창](screenshots/nice-chicken-imp15-installed.png).

## 남은 문제·운영 경계

- 방문 도전 자체는 실물 미발급이다. 5회 완료 뒤 기기당 하루veg1장·방문3일 뒤 주1회drink1장으로 기존 발급과 통합하는 검토안을 마련했으나 승인 전 활성화하지 않는다. 기존5,000만원 교환도 유지하므로 후반 발급 가속은 남아 있다. 양배추·무1회량/추가 제공 횟수와 통합 한도는 매장 검토가 필요하다.
- 기존 주간의7일 올클 기준은 유지했다. 짧은 방문 보상/기기 전체 정량 발급으로 바꾸는 것은 운영 정책 검토와 별도 적용 시점을 정한 뒤 진행한다. 기존 쿠폰/paid를 소급 삭제/추가 지급하지 않는다.
- 기기 간 테이블 제공 횟수는 공유되지 않고 공개 PIN은 인증이 아니다. 새 방문/로컬 기록을 사용자가 편집하거나 이전 백업으로 돌아가면 실제 제공 이력의 완전한 증명이 되지 않는다. 직원 확인이 필요하다.
- 사라진 최신 지급/사용 이력은 오래된 backup에서 증명하지 못한다. IMP-14의 명시적 snapshot 교체/원문 보관·초기화 세대 한계 그대로이며 합산/추측 지급을 하지 않는다.
- Chromium/Linux 임시 설치 창 검증과 실제 매장 사람의 조작·모바일 OS/스크린리더·터치 키보드 검증은 다르다. Firefox/WebKit 전체/실기기 이번254개를 통과했다고 표현하지 않는다.
- 지역 엔딩/이지·노말·광고·헬은 구현하지 않았다. 현재100해/98.5시간 계획 모델은 매장용 목표보다 길어 IMP-16에서 다시 측정한다.

## 커밋·복구 자료

분석/측정·정책48a5c15 → 구현217d18a → 새 검사/PWA/증거f619aa5 → 열린 진행 표시2900b0d → 완료 보고서를 별도 커밋한다. 기준a991396부터 전체 binary patch·순서 format-patch·완전 history bundle·SHA256/tree 검증과 최종 SHA CI JSON을 `/workspace/nice-chicken-imp15-*`에 보관한다. 사용자 기존 IMP-10 오타 편집은 수정/커밋/개선 patch에 포함하지 않는다.

## IMP-16 시작 프롬프트

```text
origin/improvement-imp15-20261013 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/economy-policy.md, docs/content-design.md,
docs/missions-service-policy.md, docs/product-direction.md,
docs/save-recovery-policy.md, docs/session-ownership.md,
docs/pwa-operations.md, docs/improvements/IMP-15-missions-coupons.md를 읽고
IMP-16 지역 엔딩·이지/노말을 구현해줘.

현재100해 최종 엔딩·지점 해금·능동/자동/오프라인 성장 시간을 먼저 측정해줘.
이지 첫 지역5~10분/전체1~2시간, 노말 첫15~25분/전체5~8시간은
설계 목표이며 실제 같은 성장 모델로 도달 가능성을 비교하고 근거를 문서화해줘.
한 앱 안의 모드와 지역별 이야기/엔딩을 단계적으로 구현해줘.
지역 해금·재생·완료/1회 게임 효과를 분리하고 반복 재생으로 보상을 늘리지 마.
기존 저장의 모드 이행은 명시적으로 선택하며 진행/해금/paid/가족 엔딩1회 효과를 보존해줘.
확정 미수령을 새 가격/모드로 재평가하거나 과거 수익을 추측 보정하지 마.

비용·수익·속도·지점/엔딩 목표를 정확한 원 API로 계산하고 동일 모델로 재측정해줘.
게임 성장 재화/난이도와 실물 혜택 발급은 구분해줘.
기존 쿠폰/사용 이력·지점별 일간/주간 paid와 5,000만원 교환을 소급 수정하지 마.
IMP-15 새 방문 발급/통합 한도·양배추/무 제공량은 미적용 검토안이다.
결정되지 않은 운영 값이나 실제 서비스 발급 정책을 임의 활성화하지 마.
음료는 테이블의 한 방문에 한 병이고 기기 간 횟수 공유/서버 인증은 없다.
백엔드/계정/서버 쿠폰·광고·헬 모드는 이번 작업에 넣지 마.

직원6명·HQ/지점·운영/메뉴/담당자/읽음·방문 도전/서비스 기록·
서비스 타이머/연구 캐시·모달 입력·dirty/저장·단일 작성자/인계·
PWA 대기/실패·명시적 복구/원문/초기화 세대 규칙을 보존해줘.
지역/모드/엔딩/기간 경계·재접속·지점/다중 탭·저장 실패/복구·
오프라인·백업/import/reset·작은 세로/가로 화면을
실제 Chromium 입력/스크린샷으로 검증해줘.
현재254개와 새 모드/지역 엔딩/이행 검사·doctor/check/test·최종 SHA CI를 통과시켜줘.
앱 변경 뒤 pwa:build를 갱신하고 단계별 커밋·patch/bundle·작업 목록·
완료 보고서·남은 문제와 다음 프롬프트를 남겨줘.
main 병합·배포·실제 혜택 사용·매장 운영 변경은 수행하지 마.
```
