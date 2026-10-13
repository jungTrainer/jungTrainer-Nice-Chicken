# IMP-13 여러 창의 저장 소유권·인계·복구

2026-10-13 (한국 시간). 기준 `origin/improvement-imp12-20261013`의 `6d878ef21aa3f6278e23693d96cc6dda3e9d782b`. 작업 브랜치 `improvement-imp13-20261013`. main 병합·Pages 배포·실혜택 사용·운영 데이터 변경은 수행하지 않는다. 모든 검사/측정은 localhost 임시 프로필의 합성 저장이다.

## 재현한 문제와 선택 근거

| 실제 Chromium 두 창 재현 | IMP-12 | IMP-13 |
| --- | --- | --- |
| 각각 17원/23원 기록 후 저장 | 10,040원 대신 10,023원, 17원 손실 | 첫 창 17원만 승인, 독자 23원 거절; 승인 수익 손실 0원 |
| 같은 확정 500원 수령 | 두 창 모두 성공 반환 | 작성자만 성공, 한 번 지급 |
| 오래된 창 닫기 | 10,000원/미수령 500원 복원 | 10,500원/미수령 0 유지 |
| 부산 이동 후 오래된 저장 | 창녕으로 역행 | 부산 유지 |
| 두 창 tick | 각 창이 자기 snapshot을 진행 | 독자는 진행 0/저장 거절 |
| 오래된 reset | 최신 수익 삭제 | 독자 reset 거절, 최신 10,017원 유지 |

[이전 측정](verification/IMP-13-concurrency-before.json), [이후 측정](verification/IMP-13-concurrency-after.json), `scripts/measure-concurrency.cjs`에 fixture/실제 반환값을 남겼다. 거부한 수익을 손실로 계산하지 않으며 과거 미기록 수익을 추가하지 않는다. Chrome 151 localhost는 secure context/Web Locks/BroadcastChannel/서비스워커를 제공했다. Web Locks 미지원/거절은 안전한 읽기 전용을 선택했다. LocalStorage lease는 원자적 CAS가 없고 background 정지에 안전하지 않아 사용하지 않았다.

## 변경 방법

1. state 다음에 `session.js`를 정의하고 마지막 boot에서 origin/기존 저장 키 이름의 Web Lock을 획득한다. 세션 id/epoch/역할·원문 기준은 게임 JSON에 저장하지 않는다. 같은 origin Pages 경로와 설치 창도 같은 저장 키의 잠금을 공유한다.
2. 작성자만 load 후 오프라인 확정/서비스/tick·사업 입력·dirty·자동/종료 저장을 실행한다. 독자는 최신 저장본 view/원본 envelope 백업과 운영 요청만 제공한다. 읽기 전용에서는 닫을 수 없는 사업 모달을 숨기고 외부 운영 컨트롤을 사용한다. 닫기/백업/요청은 지급·삭제가 아니다.
3. 주요 경제·구매/연구·미션/인증서·오프라인 수령·콘텐츠 선택·지점·엔딩·입력·타이머 진입점에 명시적 guard를 넣었다. 함수 재할당 wrapper나 drift 감시를 추가하지 않았다. PIN await는 root/region/epoch를 재확인한다.
4. 운영 요청은 브라우저 lock 대기열에 들어간다. 작성자는 엔딩/PIN/다른 모달·패널/백업 입력을 마친 후 성공 저장하고 인계한다. 실패 시 작성자/dirty/미저장 진행을 유지한다. 새 작성자는 최신 저장을 다시 load하고 기존 활성 지점 서비스 타이머/연구 캐시를 bind한다. 오래된 view를 합산하지 않는다.
5. 숨긴 작성자는 lock을 유지하고 tick을 정지한다. 복귀는 기존 활성 지점·8시간 한도 오프라인 계산을 한 번 적용하며 확정 receipt를 재평가하지 않는다. 숨김 상태에서 잠금을 얻어도 tick은 정지한다. 창 종료/죽은 탭 닫기 후 새 작성자는 마지막 성공 저장에서 복구한다.
6. 저장 전에 성공 원문과 실제 본 저장 원문을 비교한다. 구 창/직접 편집의 예상하지 못한 쓰기는 conflict로 중단한다. 최신 저장본과 이 창의 미저장 백업을 따로 제공하고 명시적으로 최신본에서 다시 시작한다. 원문 비교는 LocalStorage CAS/서버 권한이 아니며 구 버전을 먼저 닫아야 한다.
7. 설정의 미사용 셸 정리는 필수 현재 셸/설치·대기 후보 없음/모든 live 문서의 버전 응답과 문서 목록 안정성을 확인한다. 현재 워커/사용 중 버전·v1/다른 앱 캐시·LocalStorage/backup을 유지한다. 응답 없는 문서/중간 업데이트에는 삭제를 거부한다. 업데이트 적용은 기존 단독 창·안전 입력·성공 저장 조건과 작성자 조건을 모두 사용한다.

정확한 원 단위 정산·성장/비용 공식과 저장 schema는 유지했다. 기존 백업·확정 미수령·paid 미션/인증서/쿠폰·직원 6명/공용 경력·지점 운영/메뉴/담당자/읽음·서비스 부분 진행/배달 서명·연구·엔딩 1회 규칙을 보존한다. 브라우저 PIN은 공개 로컬 확인이며 서버 인증이라고 표현하지 않는다. 백엔드/인증/운영 주체는 여전히 없다.

## 검증

최종 로컬 공통 명령은 **197개 pass / 0 fail / 0 skip**, doctor(headless DOM + native hide/resume), **문법 34개** 및 생성물 일치를 통과했다. 새 23개는 실제 두 탭의 lock/차단/한 번 수령·1원/정확한 큰 수·최신 백업·paid/직원/관리/부분 타이머 인계·quota 재시도·정상 종료/renderer crash·Locks 미지원/거절·BroadcastChannel 없음·구 창 충돌/두 백업·import/reset·늦은 PIN·작은 화면 tap/스크린샷·safe/waiting/unknown/old-live 셸 정리·실제 숨김/복귀·실제 설치 standalone·엔딩/PWA/미수령을 검사한다.

- 공통 명령: `npm run test:ci` = npm ci → 고정 Chromium 설치 → doctor → check → npm test. CI는 Ubuntu 24.04/.nvmrc Node 24.19.0/Playwright 1.62.1, full Chrome 151 revision 1234다.
- Linux visibility는 Xvfb와 native Chromium을 실행해 `connectOverCDP({noDefaults:true})`로 연결한다. 일반 Playwright의 포커스 에뮬레이션/별도 CDP 해제로는 hidden이 바뀌지 않는 것을 재현했다. 실제 탭 활성화로 숨김/복귀·숨김 인계 확인, document.hidden 재정의 없음. doctor도 같은 경로를 확인한다.
- async predicate는 page.evaluate를 await하는 bounded loop로 확인한다. Promise를 truthy로 판단하는 waitForFunction 착시를 피하고 실제 candidate 버전/installed/cache를 확인한다.
- Page.crash는 실제 crash 이벤트와 죽은 탭 close를 확인한다. 죽은 renderer가 살아 있는 탭 wrapper에 남을 때의 브라우저 release 시점을 timeout-steal로 바꾸지 않았다. 강제 종료 직전 미저장 23원을 임의 복구하지 않았다.
- 성공 PNG와 측정 JSON은 이 문서 옆에 보관한다. 실패 자료는 test-results/logs·failures(JSON/PNG/trace)에 남기며 CI 실패 artifact 보관 14일을 유지한다. native display 준비 실패도 doctor/CI 실패이며 skip하지 않는다.

[세로 화면](screenshots/nice-chicken-imp13-portrait.png), [가로 화면](screenshots/nice-chicken-imp13-landscape.png), [설치 창](screenshots/nice-chicken-imp13-standalone-reader.png), [실제 복귀](screenshots/nice-chicken-imp13-native-resume.png).

### 실제 실행 결과

| 검사 | 결과 |
| --- | --- |
| IMP-12 기준 공통 CI 명령 | 174 pass / 0 fail / 0 skip; doctor·문법 31개 |
| 새 동시성/복구 단독 검사 | 23 pass / 0 fail / 0 skip |
| 최종 로컬 npm run test:ci | 197 pass / 0 fail / 0 skip; 302.2초; doctor·문법 34개 |
| 구현 `b9d680d4212de9106120c4e33283e358b42520ef` PR CI | [38334023169](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38334023169), success, 197개/doctor/check |
| 같은 SHA push | [38334017983](https://github.com/jungTrainer/jungTrainer-Nice-Chicken/actions/runs/38334017983), select success, 무거운 checks skipped; 열린 PR이 검사 소유 |

첫 전체 실행은 197개 동작 assertion을 통과했지만 Playwright의 처리되지 않은 비동기 Assertion error로 검사 파일 1개가 실패했다(전체 집계 198 중 1 fail). 이 실행을 통과로 기록하지 않는다. native Chrome의 초기 창 연결 경로를 보완해 `--no-startup-window`로 시작하고 CDP 연결 뒤 탭을 생성한다. 3개 진단/23개 단독과 최종 전체 재실행에서 비동기 오류 없이 통과했다. 보상/정산 assertion을 삭제하거나 skip·에러 무시로 우회하지 않았다. 로그는 외부 보관 폴더에 원본/최종을 구분한다. 최종 문서 head의 원격 결과는 `/workspace/nice-chicken-imp13-ci-results.json`/artifact manifest에 추가 확인한다.

## 남은 문제

- Web Locks 없는 브라우저는 읽기 전용이다. IndexedDB 기반 비동기 저장 전체 이관/원자적 DB commit은 별도 설계다. 지원을 UA로 추측하지 않는다.
- 협력하지 않는 구 버전·확장 프로그램·직접 저장 편집을 원자적으로 막을 수 없다. 구 창을 닫고 백업 후 새 버전을 사용한다. 충돌 감지/두 백업은 자동 합산의 근거가 아니다.
- 본 저장/backup은 별도 키이며 본 write 전 backup write·reset 뒤 backup 삭제를 하나의 원자적 transaction으로 처리하지 않는다. 손상·다중 키 실패의 보존/출처 진단은 IMP-14에서 먼저 재현한다.
- 강제 종료 직전 미저장 진행·저장소 eviction/디스크 장애/사용자 전체 삭제는 복원 보장 밖이다. 캐시 API와 문서 목록도 단일 DB transaction이 아니므로 사용 중/알 수 없는 문서는 보수적으로 보존한다.
- 실제 Chromebook/Android/iOS/macOS의 설치 UI, 시스템 background freeze/종료와 Firefox/WebKit은 이번 Chromium 검증과 구분한다. 새로운 지원/장애 정책은 실제 브라우저로 확인해야 한다.
- main은 구 자동 패치 워크플로/Pages legacy 배포를 포함한다. 개발 브랜치 CI 성공이 main 반영/배포 승인이 아니다. 실제 혜택/서버 연결은 [서버 조건](../coupon-server-contract.md)을 충족한 별도 작업이다.
- 시작 전의 IMP-10 문서 오타 사용자 변경은 별도 패치로 보존하고 이번 커밋/패치에 포함하지 않는다.

## 단계별 보관과 재현

분석·정책 `520a859` → 작성자/인계/셸 구현 `26d4f34` → Chromium 회귀/증거 `b9d680d` → 문서/완료 기록을 별도 커밋했다. 전체 패치/format-patch/번들과 SHA256·tree 일치 검사·원격 CI 결과를 `/workspace/nice-chicken-imp13-*`에 보관한다. 번들은 기준 IMP-12 커밋과 새 브랜치를 포함한다. 순서 패치/전체 패치를 기준 트리에 적용해 최종 tree와 비교하고 main이 그대로인지 확인한다. 환경 재설정 후에도 원격 개발 브랜치 또는 검증한 bundle/patch로 복구한다.

온보딩의 install_script/start_skill 초안은 signed apt package의 local Xvfb 추출·doctor/check/브라우저 검사와 정적 HTTP 시작을 저장했다. 현재 환경에서 실행 검증했지만 초안 저장은 적용/환경 게시가 아니다. 환경 설정에서 검토·저장 후 게시하면 재사용할 수 있다. 새 태스크 복원은 별도 확인이 필요하다.

## IMP-14 시작 프롬프트

```text
origin/improvement-imp13-20261013 브랜치를 기준으로
docs/improvement-roadmap.md, docs/data-ownership.md,
docs/runtime-architecture.md, docs/development.md,
docs/economy-policy.md, docs/content-design.md,
docs/pwa-operations.md, docs/session-ownership.md,
docs/coupon-server-contract.md,
docs/improvements/IMP-13-session-ownership.md를 읽고 IMP-14를 구현해줘.

본 저장/backup 손상·읽기/쓰기 거절·quota·reset의 다중 키 실패와
실제 지원 브라우저의 잠금·숨김·종료/PWA 경로를 먼저 재현해줘.
저장 복구 출처·검증 오류·미저장/최신 백업을 사용자가 구분하도록 진단과 안내를 개선하고,
지원 브라우저/읽기 전용/복구 가능 범위를 실측 근거로 문서화해줘.
깨진 본 저장을 기본값이나 오래된 backup으로 자동 덮어쓰기 전에
보존·복구 정책을 설계하고 실제 입력에서 검증해줘.
자동 합산·과거 수익 추측 보정·서버 없는 PIN 인증 표현은 하지 마.

원 단위 정산·기존 저장/백업·확정 미수령·paid 미션/인증서/쿠폰,
직원 6명·공용/지점·운영/메뉴/담당자/읽음·서비스/연구 캐시,
엔딩 1회·모달 입력·dirty/저장·단일 작성자/인계·PWA 버전/실패 복구를 보존해줘.
실제 Chromium 다중 창/설치 창과 가능한 Firefox/WebKit에서
손상·저장 실패·잠금 미지원·재접속·인계·이동·백업/import/reset·작은 화면을 검증해줘.
현재 197개와 새 복구/지원 검사, doctor/check/test 및 CI를 통과시켜줘.
실 혜택 사용/운영 데이터 변경과 main 병합/배포는 별도 승인 전 수행하지 마.
단계별 커밋·패치·번들·작업 목록·완료 보고서·남은 문제·다음 프롬프트를 남겨줘.
```
