# Step 2-23A 직접 적용 가이드

작성일: 2026-05-15

## 1. 목적

Step 2-23 저장 안정화 1차 패치를 GitHub Actions 자동 실행에만 의존하지 않고, Codespaces 또는 로컬 git 환경에서 직접 적용할 수 있도록 실행 절차를 정리한다.

이번 단계는 기능 코드 대규모 변경 단계가 아니다. 기존에 준비된 스크립트 `scripts/apply-step2-23-save-stability-phase1.py`를 안전하게 실행하는 절차를 문서화한다.

## 2. 현재 Step 2-23이 막힌 이유

현재 저장 안정화 1차 패치를 적용하기 위한 스크립트와 workflow 설정은 준비되어 있다.

- 스크립트: `scripts/apply-step2-23-save-stability-phase1.py`
- 정규식 기반 매칭 보강 완료
- 기존 legacy `beforeunload` 훅 대응 보강 완료

그러나 GitHub Actions 자동 실행이 안정적으로 잡히지 않아, 다음 산출물이 아직 생성되지 않았다.

- 완료 커밋: `Add save lifecycle stability hooks`
- 보고서: `docs/2026-05-15-step2-23-save-stability-phase1.md`

따라서 Step 2-23A에서는 Actions 반복 실행이 아니라, 직접 실행 가능한 절차를 제공한다.

## 3. 현재 준비된 스크립트 경로

```bash
scripts/apply-step2-23-save-stability-phase1.py
```

이 스크립트가 수행하는 작업은 다음과 같다.

1. `save(force=false)`가 boolean을 반환하도록 보강
2. `save(false)`는 `_saveDirty = true` 설정 후 `true` 반환
3. `save(true)`는 localStorage 저장 성공 시 `true`, 실패 시 `false` 반환
4. 저장 실패 시 `console.error("[save] failed", e)` 출력
5. 강제 저장 버튼에서 `save(true)` 결과에 따라 성공/실패 토스트 분기
6. `pagehide`, `visibilitychange`, `beforeunload` 저장 훅 추가
7. 기존 legacy `beforeunload` 훅을 새 lifecycle 구조로 통합
8. `docs/2026-05-15-step2-23-save-stability-phase1.md` 보고서 생성
9. `node --check js/main.js` 검증

## 4. Codespaces에서 실행하는 방법

GitHub 웹에서 실행하는 경우:

1. Repository 접속
2. `Code` 버튼 클릭
3. `Codespaces` 탭 선택
4. `Create codespace on main` 클릭
5. 터미널에서 아래 명령 실행

```bash
python3 scripts/apply-step2-23-save-stability-phase1.py
```

성공하면 다음 메시지가 출력되어야 한다.

```bash
[OK] Step 2-23 completed
```

이미 적용된 상태에서 다시 실행하면 다음 메시지가 나올 수 있다.

```bash
[OK] Step 2-23 already applied
```

둘 다 정상이다.

## 5. 로컬 git에서 실행하는 방법

로컬 개발 환경에서 실행하는 경우:

```bash
git checkout main
git pull origin main
python3 scripts/apply-step2-23-save-stability-phase1.py
```

스크립트 실행 후 변경 파일을 확인한다.

```bash
git status
```

예상 변경 파일:

```text
js/main.js
docs/2026-05-15-step2-23-save-stability-phase1.md
```

## 6. 실행 후 검증 명령

아래 명령으로 저장 안정화 항목을 확인한다.

```bash
grep -n 'function save(force=false)' js/main.js
grep -n 'return true' js/main.js
grep -n 'console.error("\[save\] failed", e);' js/main.js
grep -n 'function bindSaveLifecycleEvents()' js/main.js
grep -n 'window.addEventListener("pagehide"' js/main.js
grep -n 'document.addEventListener("visibilitychange"' js/main.js
grep -n 'window.addEventListener("beforeunload"' js/main.js
grep -n 'const ok = save(true);' js/main.js
grep -n '저장 실패! 브라우저 저장 공간을 확인하세요.' js/main.js
node --check js/main.js
```

추가로 기존 이벤트 리팩터링 결과가 유지되는지 확인한다.

```bash
grep -Rni 'onclick=' index.html js/main.js || true
grep -n '\.onclick\s*=' js/main.js || true
grep -n 'function safeClick' js/main.js || true
grep -n 'safeClick(' js/main.js || true
```

정상 기준:

- `inline onclick=`: 0개
- `.onclick =`: 0개
- `function safeClick`: 0개
- `safeClick(` 실제 호출: 0개
- `node --check js/main.js`: 통과

## 7. 성공 시 커밋 명령

검증이 끝나면 아래 명령으로 커밋한다.

```bash
git add js/main.js docs/2026-05-15-step2-23-save-stability-phase1.md
git commit -m "Add save lifecycle stability hooks"
git push origin main
```

커밋 후 GitHub에서 다음 항목을 확인한다.

```text
Add save lifecycle stability hooks
```

그리고 아래 보고서가 생성되어 있어야 한다.

```text
docs/2026-05-15-step2-23-save-stability-phase1.md
```

## 8. 실패 시 확인해야 할 로그

스크립트 실패 시 `[FAIL]` 문구를 먼저 확인한다.

주요 실패 후보는 다음과 같다.

```text
[FAIL] expected old save block exactly 1, found 0
[FAIL] expected old forceSave handler exactly 1, found 0
[FAIL] initDOMRefs call anchor not found
[FAIL] save function count invalid
[FAIL] lifecycle handler counts invalid
```

### 8-1. old save block 매칭 실패

의미:

- 현재 `function save(force=false)` 구조가 스크립트가 예상한 구조와 달라졌다.

확인 명령:

```bash
grep -n 'function save(force=false)' -A 25 js/main.js
```

대응:

- `save(false)` dirty flag 구조는 유지해야 한다.
- `save(true)` 성공/실패 boolean 반환 구조만 추가해야 한다.
- `load()` 전체 구조는 건드리지 않는다.

### 8-2. forceSaveBtn 매칭 실패

의미:

- 현재 강제 저장 버튼 이벤트 구조가 스크립트 예상과 다르다.

확인 명령:

```bash
grep -n 'forceSaveBtn' -A 12 -B 4 js/main.js
```

대응:

- `save(true); showToast("저장 완료");` 구조를 찾는다.
- 아래 형태로 바꿔야 한다.

```js
const ok = save(true);
showToast(ok ? "저장 완료" : "저장 실패! 브라우저 저장 공간을 확인하세요.");
```

### 8-3. initDOMRefs anchor 실패

의미:

- `initDOMRefs();` 호출 위치를 찾지 못했다.

확인 명령:

```bash
grep -n 'initDOMRefs();' js/main.js
```

대응:

- `DOMContentLoaded` 초기화 흐름 안에서 `initDOMRefs();` 바로 다음에 `bindSaveLifecycleEvents();`를 1회 호출해야 한다.
- 적절한 위치가 불확실하면 코드 변경을 중단하고 보고한다.

## 9. 반영 후 기대 결과

Step 2-23 적용 후 기대되는 결과는 다음과 같다.

```text
function save(force=false): 1개
save(false) true 반환 흐름: 1개
console.error("[save] failed", e): 1개
function bindSaveLifecycleEvents(): 1개
window.addEventListener("pagehide": 1개
document.addEventListener("visibilitychange": 1개
window.addEventListener("beforeunload": 1개
const ok = save(true);: 1개
저장 실패 토스트: 1개
function saveGame(): 유지
inline onclick=: 0개 유지
.onclick =: 0개 유지
function safeClick: 0개 유지
safeClick 실제 호출: 0개 유지
node --check js/main.js: 통과
```

## 10. 브라우저 수동 테스트 항목

적용 후 브라우저에서 다음을 확인한다.

| 항목 | 기대 결과 |
|---|---|
| 강제 저장 버튼 클릭 | 저장 성공 시 `저장 완료` 토스트 |
| 저장 실패 상황 | 실패 토스트 및 console.error 출력 |
| 탭 닫기 | `beforeunload`에서 저장 시도 |
| 탭 백그라운드 전환 | `visibilitychange` hidden에서 저장 시도 |
| 페이지 이탈/모바일 앱 전환 | `pagehide`에서 저장 시도 |
| 재접속 | 저장된 상태 복원 |
| 콘솔 에러 | 신규 저장 훅 관련 에러 없어야 함 |

## 11. 다음 단계: Step 2-24

Step 2-23이 반영되면 다음 단계는 `Step 2-24 backup key/save recovery`이다.

권장 목표:

1. 기본 저장 키 유지
2. 백업 저장 키 추가
3. 저장 성공 시 primary + backup 이중 저장
4. primary load 실패 시 backup 복구
5. 저장 데이터 version/migration 점검
6. 사용자가 직접 백업/복원할 수 있는 export/import는 이후 단계로 분리

## 12. 현재 결론

Step 2-23 스크립트는 이미 준비되어 있으며, 자동 Actions 실행이 불안정한 상태다. 따라서 가장 안전한 진행 방식은 Codespaces 또는 로컬 환경에서 아래 명령을 직접 실행하는 것이다.

```bash
python3 scripts/apply-step2-23-save-stability-phase1.py
```

성공 후 아래 커밋을 생성하면 Step 2-23은 완료된다.

```bash
git commit -m "Add save lifecycle stability hooks"
```
