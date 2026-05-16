# Step 2-23F 저장 안정화 실행 전략 확정 보고

작성일: 2026-05-15

## 1. 목적

Step 2-23 저장 안정화 1차가 아직 실제 코드에 반영되지 않았기 때문에, 현 단계에서 저장 관련 QA 판단과 실행 전략을 확정한다.

저장 안정화는 현재 게임의 최상위 리스크다. 따라서 Step 3 모듈 분리나 Step 2-24 백업 저장/복구 실제 적용보다 먼저 Step 2-23을 완료해야 한다.

## 2. 현재 확인 결과

다음 항목은 아직 없다.

- `Add save lifecycle stability hooks` 커밋
- `docs/2026-05-15-step2-23-save-stability-phase1.md`
- 실제 `js/main.js` 저장 안정화 반영

현재 준비된 항목은 다음과 같다.

- Step 2-23 스크립트: `scripts/apply-step2-23-save-stability-phase1.py`
- 정규식 기반 보강 완료
- legacy `beforeunload` 훅 대응 완료
- 직접 적용 가이드: `docs/2026-05-15-step2-23a-direct-apply-guide.md`
- 직접 반영 경로 검토: `docs/2026-05-15-step2-23c-direct-apply-review.md`
- Step 2-24 설계 문서: `docs/2026-05-15-step2-24-save-backup-recovery-plan.md`

## 3. 저장 QA 판단

현 상태의 저장 구조는 `localStorage` 기반이다.

현재 가능한 저장:

- 일반 플레이 중 autosave
- 강제 저장 버튼
- legacy `beforeunload` 종료 저장 일부

현재 취약한 상황:

| 상황 | 위험도 | 판단 |
|---|---|---|
| 탭 정상 종료 | 중간 | legacy `beforeunload`에 의존 |
| 모바일 백그라운드 전환 | 높음 | `visibilitychange` 저장 훅 필요 |
| 페이지 이탈/page cache | 높음 | `pagehide` 저장 훅 필요 |
| 브라우저 강제 종료 | 높음 | 마지막 실제 저장 이후 진행 손실 가능 |
| 저장 공간 부족 | 높음 | 현재 저장 실패를 감지하지 못함 |
| private mode 제한 | 높음 | 저장 실패해도 사용자에게 알리지 못함 |
| 저장 데이터 손상 | 높음 | backup key 없음 |
| 다른 기기 이동 | 중간 | export/import 없음 |

## 4. 왜 Step 2-23이 최우선인가

현재 `save(true)`는 성공/실패를 반환하지 않고, `localStorage.setItem()` 실패를 빈 catch로 무시한다.

따라서 사용자가 저장 버튼을 눌러도 실제 저장 실패를 알 수 없다.

또한 현재는 `pagehide`와 `visibilitychange` 저장 훅이 없기 때문에 모바일 브라우저나 앱 전환 환경에서 저장 손실 위험이 크다.

이 문제를 해결하지 않고 Step 3 모듈 분리로 넘어가면, 이후 기능 테스트 중 저장 데이터 손실이나 회귀가 발생했을 때 원인 추적이 어려워진다.

## 5. 확정 실행 전략

현재 연결된 도구로는 다음 작업을 직접 수행할 수 없다.

- Codespaces 터미널 실행
- 로컬 git 명령 실행
- GitHub Actions `workflow_dispatch` 직접 실행

또한 `js/main.js`는 대형 파일이므로 현재 도구에서 전체 파일 완성본을 재업로드하는 방식은 안전하지 않다.

따라서 Step 2-23의 최종 실행 경로는 다음 중 하나로 확정한다.

### 5-1. 1순위: Codespaces 실행

```bash
python3 scripts/apply-step2-23-save-stability-phase1.py
node --check js/main.js
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

### 5-2. 2순위: 로컬 git 실행

```bash
git checkout main
git pull origin main
python3 scripts/apply-step2-23-save-stability-phase1.py
node --check js/main.js
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

### 5-3. 3순위: GitHub Actions 수동 실행

```text
Actions
→ Expansion Event Cleanup Steps
→ Run workflow
→ Branch main
→ Run workflow
```

## 6. Step 2-23 완료 기준

Step 2-23이 완료되려면 다음을 만족해야 한다.

- `Add save lifecycle stability hooks` 커밋 생성
- `docs/2026-05-15-step2-23-save-stability-phase1.md` 생성
- `function save(force=false)` 1개
- `if(!force){ _saveDirty = true; return true; }` 1개
- `console.error("[save] failed", e);` 1개
- `function bindSaveLifecycleEvents()` 1개
- `window.addEventListener("pagehide"` 1개
- `document.addEventListener("visibilitychange"` 1개
- `window.addEventListener("beforeunload"` 1개
- `const ok = save(true);` 1개
- 저장 실패 토스트 1개
- `function saveGame()` 1개
- inline `onclick=` 0개 유지
- `.onclick =` 0개 유지
- `function safeClick` 0개 유지
- 실제 `safeClick(` 호출 0개 유지
- `node --check js/main.js` 통과

## 7. Step 2-23 완료 전 금지 사항

Step 2-23 완료 전에는 다음을 진행하지 않는다.

- Step 3 모듈 분리
- Step 2-24 backup key/save recovery 실제 코드 적용
- export/import 기능 추가
- save/load 대규모 개편
- `index.html` 전체 수정
- `js/main.js` 전체 파일 직접 재업로드

## 8. Step 2-23 완료 후 다음 단계

Step 2-23이 완료되면 다음 순서로 진행한다.

1. 브라우저에서 강제 저장 버튼 테스트
2. 새로고침 후 상태 복원 확인
3. 탭 닫기 후 재접속 확인
4. 모바일/브라우저 백그라운드 전환 저장 확인
5. Step 2-24 backup key/save recovery 실제 적용
6. Step 2-25 export/import 수동 백업 검토

## 9. 결론

현 시점에서 저장 관련 문제는 최상위 리스크다.

현재 게임은 기본 저장은 가능하지만, 저장 실패 감지와 백그라운드 저장 안정성이 부족하다.

따라서 다음 실제 개발 작업은 반드시 Step 2-23 저장 안정화 1차 반영이어야 한다.

Step 2-23 완료 전까지 Step 3 모듈 분리와 Step 2-24 실제 적용은 보류한다.
