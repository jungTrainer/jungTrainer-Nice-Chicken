# Step 2-27 저장 리팩터링/안정화 준비 현황 종합 정리

작성일: 2026-05-15

## 0. 중요 저장 리스크

Step 2 이벤트 리팩터링은 완료됐지만, 저장 안정화 실제 코드 반영은 아직 완료되지 않았다.

현재 가장 큰 미완료 리스크는 다음이다.

- Step 2-23 저장 안정화 1차 실제 반영 미완료
- Step 2-24B backup key/save recovery 실제 반영 미완료
- Step 2-25 export/import 실제 구현 미완료
- 저장 QA 실제 브라우저 검증 미수행

따라서 Step 3 모듈 분리는 아직 시작하지 않는 것이 안전하다.

## 1. Step 2 전체 진행 요약

Step 2는 크게 두 축으로 진행됐다.

1. 이벤트 구조 리팩터링
2. 저장 안정화 준비

이벤트 구조 리팩터링은 실제 코드 반영까지 완료됐다.

저장 안정화는 설계/스크립트/QA 문서 준비는 진행됐지만, 핵심 실제 코드 반영은 아직 완료되지 않았다.

## 2. 실제 코드 반영 완료 항목

### 2-1. JavaScript 분리

- 핵심 메인 JavaScript가 `js/main.js`로 분리됐다.
- `index.html`은 외부 script 참조 구조를 갖게 됐다.
- splash auto-hide script와 service-worker placeholder script는 inline 유지됐다.

### 2-2. 지역 확장 모달 이벤트 정리

완료된 흐름:

- `openMap` 클릭
- `modalExpansion` 열기
- `renderMapUI()` 호출
- `mapWrap` 렌더링
- 지역 선택
- `mapGo` 이동
- `mapUnlock` 해금
- 닫기 버튼 처리

주요 완료 항목:

- `closeExpansionModalBtn.addEventListener("click")`
- `openMapBtn.addEventListener("click")`
- `mapGoBtn.addEventListener("click")`
- `mapUnlockBtn.addEventListener("click")`
- `mapWrapEl.addEventListener("click")`
- `modalExpansion` 이벤트 위임

### 2-3. inline onclick 제거

완료 상태:

- `inline onclick=` 0개
- `renderExpansionCards()` 내부 inline onclick 제거
- 카드 버튼은 `data-action` / `data-region-id` 구조로 정리

### 2-4. `.onclick =` 직접 대입 제거

완료 상태:

- `.onclick =` 직접 대입 0개
- modal/settings/PIN 계열 전환 완료
- benefit/coupon/exchange 계열 전환 완료
- profile/offline/save/reset/sound 계열 전환 완료
- 통계 safeClick 계열 전환 완료
- 동적 버튼 이벤트 위임 완료

동적 이벤트 위임 완료 항목:

- `rndListEl.addEventListener("click")`
- `menuGridEl.addEventListener("click")`
- `upgListEl.addEventListener("click")`
- `resListEl.addEventListener("click")`

### 2-5. safeClick 제거

완료 상태:

- `function safeClick` 0개
- 실제 `safeClick(` 호출 0개
- `safeOn`과 `_bindSafe`는 유지

## 3. 준비만 된 항목

아래 항목은 실제 코드 적용이 아니라 스크립트/설계/QA 준비 단계다.

### 3-1. Step 2-23 저장 안정화 1차

준비된 파일:

- `scripts/apply-step2-23-save-stability-phase1.py`
- `docs/2026-05-15-step2-23a-direct-apply-guide.md`
- `docs/2026-05-15-step2-23c-direct-apply-review.md`
- `docs/2026-05-15-step2-23f-save-stability-execution-decision.md`
- `docs/2026-05-15-step2-23i-save-risk-deferral-note.md`

목표는 다음이지만 아직 실제 반영되지 않았다.

- `save(true)` 성공/실패 boolean 반환
- 저장 실패 시 `console.error("[save] failed", e)`
- 강제 저장 버튼 성공/실패 토스트 분기
- `pagehide` 저장 훅
- `visibilitychange` 저장 훅
- `beforeunload` 저장 훅 통합
- Step 2-23 보고서 생성

### 3-2. Step 2-24A guarded script

준비된 파일:

- `scripts/apply-step2-24-save-backup-recovery.py`
- `docs/2026-05-15-step2-24a-backup-recovery-script-plan.md`

내용:

- Step 2-23 완료 marker를 검사하는 preflight guard 준비
- Step 2-23 미완료 시 실패하고 파일 미수정

### 3-3. Step 2-24B backup/recovery 적용 스크립트

준비된 파일:

- `scripts/apply-step2-24b-save-backup-recovery.py`
- `docs/2026-05-15-step2-24b-save-backup-recovery-script.md`

목표:

- `SAVE_BACKUP_KEY = SAVE_KEY + "_backup"` 추가
- primary 저장 전 기존 저장본을 backup으로 보존
- primary 손상 시 backup 복구
- backup 손상 시 default fallback

현재 상태:

- Step 2-23 marker가 없으면 실행 중단되도록 설계됨
- 실제 `js/main.js`에는 아직 반영하지 않음

### 3-4. Step 2-25 export/import 설계

준비된 파일:

- `docs/2026-05-15-step2-25-save-export-import-plan.md`

내용:

- export/import 필요성
- export 대상 데이터 구조
- import 검증 기준
- 잘못된 JSON 대응
- 다른 게임 데이터 거부
- 구버전 데이터 처리
- 모바일 복사/붙여넣기 UX
- 설정 모달 UI 초안

현재 상태:

- 실제 기능 구현은 하지 않음

### 3-5. Step 2-26 저장 QA 체크리스트

준비된 파일:

- `docs/2026-05-15-step2-26-save-system-qa-checklist.md`

내용:

- Step 2-23 QA 항목
- Step 2-24B QA 항목
- Step 2-25 QA 항목
- 브라우저별 테스트 매트릭스
- localStorage 테스트 방법
- 강제 종료/백그라운드 전환 테스트 방법
- PASS / FAIL / CHECK / N/A 기록표

현재 상태:

- QA 문서는 준비됐지만 실제 브라우저 테스트는 아직 필요

## 4. 저장 관련 미완료 리스크

| 리스크 | 수준 | 설명 |
|---|---|---|
| Step 2-23 미반영 | 높음 | 저장 실패 감지와 lifecycle save hook이 실제 코드에 없음 |
| `save(true)` 반환값 없음 | 높음 | 저장 성공/실패를 호출부에서 판단할 수 없음 |
| 저장 실패 catch 비어 있음 | 높음 | localStorage 실패가 사용자/개발자에게 드러나지 않음 |
| 강제 저장 버튼 신뢰도 낮음 | 높음 | 실패해도 저장 완료처럼 보일 수 있음 |
| `pagehide` 없음 | 높음 | 모바일/브라우저 page lifecycle에서 저장 누락 가능 |
| `visibilitychange` 없음 | 높음 | 백그라운드 전환 시 저장 누락 가능 |
| backup key 미적용 | 높음 | primary 저장 손상 시 복구 어려움 |
| export/import 미구현 | 중간 | 사용자가 직접 백업/복원할 방법 없음 |
| 실제 브라우저 QA 미수행 | 높음 | 저장 안정성 검증 미완료 |

## 5. Step 3 모듈 분리 진입 가능 여부

현재 판단: **진입 비추천**

이유:

1. 저장 안정화 핵심 코드가 아직 실제 반영되지 않았다.
2. 저장 실패 감지와 lifecycle 저장 훅이 없다.
3. backup/recovery도 실제 적용 전이다.
4. export/import는 설계만 있고 구현 전이다.
5. Step 3 모듈 분리 중 저장 문제가 발생하면 원인 추적이 어려워진다.
6. `js/main.js` 구조를 모듈로 나누기 전에 저장 안정성 기준을 먼저 고정해야 한다.

따라서 Step 3 모듈 분리는 Step 2-23과 Step 2-24B 실제 적용 후 판단하는 것이 안전하다.

## 6. Step 3 진입 전 필수 조건

Step 3 진입 전 최소 조건:

1. `Add save lifecycle stability hooks` 커밋 생성
2. `docs/2026-05-15-step2-23-save-stability-phase1.md` 생성
3. `save(true)` 성공/실패 반환 구조 반영
4. 저장 실패 `console.error("[save] failed", e)` 반영
5. 강제 저장 실패 토스트 반영
6. `pagehide`, `visibilitychange`, `beforeunload` 저장 훅 반영
7. Step 2-24B backup key/save recovery 실제 적용
8. primary 손상 시 backup 복구 QA 1회 이상 수행
9. Chrome desktop 기준 저장 QA 통과
10. 최소 1개 모바일 브라우저 백그라운드 저장 QA 수행
11. `node --check js/main.js` 통과
12. inline `onclick=` 0개 유지
13. `.onclick =` 0개 유지
14. `function safeClick` 0개 유지

권장 추가 조건:

1. export/import 실제 구현
2. 잘못된 JSON import 거부 QA 통과
3. 다른 게임 데이터 import 거부 QA 통과
4. import 취소 시 기존 state 유지 QA 통과

## 7. 권장 진행 순서

권장 순서:

```text
1. Step 2-23 저장 안정화 1차 실제 반영
2. Step 2-23 QA
3. Step 2-24B backup key/save recovery 실제 적용
4. Step 2-24B QA
5. Step 2-25 export/import 실제 구현 또는 구현 범위 확정
6. Step 2-26 QA 체크리스트 기반 브라우저 테스트
7. Step 3 모듈 분리 착수
```

속도 우선으로 가야 하는 경우:

```text
1. 저장 리스크를 상단에 유지
2. Step 3 실제 코드 분리는 하지 않음
3. Step 3 모듈 분리 설계 문서만 작성
4. 저장 안정화 완료 후 실제 분리 진행
```

## 8. 최종 판단

Step 2 이벤트 리팩터링은 완료됐다.

하지만 저장 안정화는 아직 실제 코드 반영이 완료되지 않았다.

따라서 현재 상태에서 Step 3 모듈 분리를 실제로 시작하는 것은 위험하다.

최종 판단:

```text
Step 3 실제 모듈 분리: 보류
Step 3 설계 문서 작성: 가능
Step 2-23 실제 반영: 최우선
Step 2-24B 실제 반영: Step 2-23 완료 후 가능
Step 2-25 실제 구현: Step 2-23/2-24B 완료 후 가능
```

## 9. 다음 단계 제안

다음 단계는 둘 중 하나다.

### A안: 안정성 우선

Step 2-23 실제 반영을 완료한다.

```bash
python3 scripts/apply-step2-23-save-stability-phase1.py
node --check js/main.js
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

### B안: 속도 우선

Step 3 실제 분리는 보류하고, Step 3 모듈 분리 설계 문서만 작성한다.

권장 문서:

```text
docs/2026-05-15-step3-module-split-plan.md
```

이 경우 문서 상단에 다음을 반드시 명시한다.

```text
저장 안정화 Step 2-23/2-24B 미완료 상태이므로 실제 모듈 분리는 보류한다.
```

## 10. 결론

현재 레포는 이벤트 리팩터링 측면에서는 Step 3 준비도가 높다.

하지만 저장 안정화 측면에서는 아직 Step 3 실제 착수 조건을 만족하지 못했다.

따라서 다음 실제 코드 작업은 저장 안정화 반영이어야 한다. 다만 진행 속도를 위해 Step 3 설계 문서는 작성할 수 있다.
