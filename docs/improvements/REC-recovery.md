# REC-01~05 복구 보고서

2026-10-12. 사용자 승인에 따라 현재 main 기준에서 이전 요구를 재구현했다. 이전 클라우드의 미커밋 작업본과 96개 검사 파일은 현재 체크아웃·전체 참조·reflog·unreachable 객체·원격 브랜치에 없었다. 원격 main도 `6b602e5`였다. 유실된 파일을 그대로 복원했다고 주장하지 않는다.

## 단계와 기록

| 단계 | 초기 커밋 | 구현과 검사 |
| --- | --- | --- |
| REC-01 | `a3e9257` | [미수령 보상](REC-01-offline.md), 최초 5개 검사 통과 |
| REC-02 | `f652964` | [미션](REC-02-missions.md), 누적 10개 검사 통과 |
| REC-03 | `af222f6` | [연구](REC-03-research.md), 전용 5개 검사 통과 |
| REC-04 | `32e758b` | [정산](REC-04-economy.md), 전용 10개 검사 통과 |
| REC-05 | `e9bd25b` | [엔딩](IMP-05-ending-lifecycle.md), 기반 전체 32개 검사 통과 |

이후 IMP-06 입력 소유권에 맞게 검사를 실제 열린 화면 입력으로 보강했다. 추가로 백업·과거 진행도·서울 날짜 전환·실제 직원 처리량을 검증했으며 최종 검사 수는 58개다. 0·1·10레벨 직원 자동 서빙은 동일 조건의 120초 실제 함수 실행에서 18·19·23회로 증가했다.

## 저장·구조 정책

저장 키·버전을 유지한다. 선택 필드 `offlineReward.menus`, `menuStats.offlineCount`, `unattributedSales`를 추가했다. 저장된 대기 금액과 지급 완료 미션/인증서/쿠폰을 유지하며 과거 기록 누락분은 추측해 추가하지 않는다. 연구 절대 완료 시각을 다시 당기지 않는다. 엔딩의 기존 네 플래그와 매출/유입 +50% 효과, 목표액 `9.99e70`을 유지했다.

현재 클래식 스크립트 호환성을 보존하기 위해 `offline → missions → research → economy → ending → ui` 순서로 기능을 설치한다. 일부 기존 전역 함수를 교체하거나 감싸며 기존 저장 감시 래퍼도 유지한다. 이 설치 순서와 남아 있는 main.js의 이전 함수 정의는 IMP-08의 정리 대상이다. 복구 도중 전체 애플리케이션 구조를 다시 쓰지 않았다.

## 복구 파일

최종 전체 패치: `/workspace/nice-chicken-recovery-imp06.patch`.
커밋 묶음: `/workspace/nice-chicken-recovery-imp06.bundle`.

패치는 기준 커밋에서 최종 상태까지 코드·검사·문서·검증 이미지를 포함한다. 원본 기준 트리에서 `git apply --check`를 수행하고 번들도 `git bundle verify`로 확인한다. 새 체크아웃에서 적용할 때 기존 변경을 먼저 보관해야 한다.

```bash
# 현재 HEAD가 6b602e5인 깨끗한 체크아웃에서
git apply /path/to/nice-chicken-recovery-imp06.patch
npm ci --cache /tmp/nice-chicken-npm-cache
npm run check
npm test
```

번들은 기준 커밋을 prerequisite으로 삼아 새 커밋과 변경 객체를 보관한다. 공개 원격 브랜치에도 보관할 수 있지만 main 병합·배포는 별도 작업이다.
