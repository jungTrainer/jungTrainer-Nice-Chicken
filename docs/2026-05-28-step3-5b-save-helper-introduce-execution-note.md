# Step 3-5B Save Helper Introduce Execution Note

작성일: 2026-05-28

## 현재 상태

`Step 3-5B: Save Helper Introduce Plan` 적용을 위한 스크립트를 추가했다.

추가 파일:

- `scripts/apply-step3-5b-save-helper-introduce.py`

## 스크립트 역할

스크립트는 `js/main.js` 저장 섹션에 다음 helper를 추가한다.

- `markDirty(reason)`
- `saveImportant(reason)`
- `saveSoon(reason)`

그리고 대표 지점만 제한적으로 치환한다.

치환 대상:

- `processPayroll()`
- `checkLevelUp()`
- `startResearch()`
- `updateResearch()` 연구 완료 분기

## 아직 미적용인 이유

워크플로 추가 시도가 도구 안전 검사에 차단되어, 이번 단계에서는 `main.js`에 직접 적용하지 못했다.

따라서 로컬 또는 Codespaces에서 아래 명령을 실행해야 실제 반영된다.

```bash
python3 scripts/apply-step3-5b-save-helper-introduce.py
```

## 검증 명령

```bash
node --check js/main.js

grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

## 다음 스텝

스크립트 실행 후 결과를 확인하는 `Step 3-5B-Check`를 진행한다.
