# Step 2-23C 직접 반영 경로 재검토 보고

작성일: 2026-05-15

## 목적

Step 2-23 저장 안정화 1차가 GitHub Actions 자동 실행 문제로 실제 반영되지 않고 있어, 가능한 직접 반영 경로를 재검토했다.

## 현재 상태

- Step 2-23 전용 스크립트: `scripts/apply-step2-23-save-stability-phase1.py`
- 정규식 기반 보강 완료
- legacy `beforeunload` 훅 대응 완료
- Step 2-23A 직접 적용 가이드 생성 완료
- Step 2-24 백업 저장/복구 설계 문서 생성 완료

아직 없는 산출물:

- `Add save lifecycle stability hooks` 커밋
- `docs/2026-05-15-step2-23-save-stability-phase1.md`
- 실제 `js/main.js` 저장 안정화 반영

## 직접 반영 경로 검토 결과

현재 사용 가능한 GitHub 쓰기 도구는 다음 계열이다.

- `update_file`
- `create_blob`
- `create_tree`
- `create_commit`
- `update_ref`

이 중 `update_file`은 파일 전체 내용을 완성본으로 다시 업로드하는 방식이다.

`js/main.js`는 매우 큰 파일이며, 현재 작업은 저장 함수 일부, 강제 저장 버튼 일부, 초기화 흐름 일부, legacy beforeunload 일부만 바꾸는 작업이다. 따라서 전체 파일을 수동 재구성해 교체하는 방식은 다음 리스크가 크다.

1. 대형 파일 전체 교체 중 누락/잘림 위험
2. 동시 변경 충돌 위험
3. 의도하지 않은 공백/문자/인코딩 변경 위험
4. `node --check`를 GitHub 반영 전에 신뢰성 있게 수행하기 어려움
5. 기존 Step 2 이벤트 리팩터링 결과를 실수로 훼손할 위험

따라서 현재 도구 조건에서는 `js/main.js` 전체를 직접 교체하는 방식은 안전하지 않다고 판단했다.

## 확인한 추가 원인

최신 `js/main.js`에는 이미 legacy 종료 저장 훅이 존재한다.

```js
window.addEventListener("beforeunload", () => { try{ save(true); }catch(e){} });
```

이 때문에 초기 Step 2-23 스크립트는 `beforeunload` 0개를 전제로 실패할 가능성이 있었다.

해당 문제는 `scripts/apply-step2-23-save-stability-phase1.py`에서 보강했다.

보강 내용:

- 기존 `beforeunload` 1개 허용
- legacy beforeunload를 새 lifecycle hook 구조로 통합
- 최종적으로 `pagehide`, `visibilitychange`, `beforeunload` 각각 1개만 남도록 검증

## Step 2-23 적용 목표

Step 2-23이 실제 적용되면 다음이 충족되어야 한다.

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

## 결론

현재 조건에서는 Step 2-23 저장 안정화 1차를 직접 GitHub 파일 업데이트 방식으로 강행하지 않는 것이 안전하다.

가장 안전한 적용 경로는 여전히 다음 중 하나다.

### 1. Codespaces 실행

```bash
python3 scripts/apply-step2-23-save-stability-phase1.py
node --check js/main.js
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

### 2. 로컬 git 실행

```bash
git checkout main
git pull origin main
python3 scripts/apply-step2-23-save-stability-phase1.py
node --check js/main.js
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

### 3. GitHub Actions 수동 실행

```text
Actions
→ Expansion Event Cleanup Steps
→ Run workflow
→ Branch main
→ Run workflow
```

## Step 2-24 상태

Step 2-24 백업 저장/복구는 설계 문서까지만 완료했다.

- 설계 문서: `docs/2026-05-15-step2-24-save-backup-recovery-plan.md`

Step 2-23이 실제 반영되기 전에는 Step 2-24 실제 코드 적용을 보류한다.

## 다음 권장 단계

1. Step 2-23을 Codespaces/로컬/Actions 수동 실행 중 하나로 실제 반영한다.
2. `Add save lifecycle stability hooks` 커밋과 Step 2-23 보고서를 확인한다.
3. 브라우저에서 강제 저장, 탭 닫기, 백그라운드 전환 저장을 확인한다.
4. 이상이 없으면 Step 2-24 backup key/save recovery 실제 적용을 진행한다.
