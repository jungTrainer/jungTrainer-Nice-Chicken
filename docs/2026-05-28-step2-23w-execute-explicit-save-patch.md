# Step 2-23W Execute Explicit Save Patch

작성일: 2026-05-28

## 현재 상태

GitHub Actions에서 `scripts/apply-step2-23v-explicit-save-patch.py`를 실행해 `js/main.js`에 명시적 저장 패치를 적용했다.

## 실행한 명령

```bash
python3 scripts/apply-step2-23v-explicit-save-patch.py
node --check js/core/utils.js
node --check js/core/audio.js
node --check js/core/config.js
node --check js/main.js
grep -n "onclick=" index.html js/main.js
grep -n "\.onclick =" js/main.js
grep -n "function safeClick" js/main.js
grep -n "safeClick(" js/main.js
```

## 스크립트 실행 결과

GitHub Actions 로그를 기준으로 확인한다.

성공 기준:

- `[OK] Step 2-23V explicit save patch applied`
- node syntax check 4개 파일 통과
- inline onclick 없음
- `.onclick =` 없음
- `function safeClick` 없음
- `safeClick(` 호출 없음

## 변경한 파일

- `js/main.js`
- `docs/2026-05-28-step2-23v-explicit-save-patch.md`
- `docs/2026-05-28-step2-23w-execute-explicit-save-patch.md`

## 변경 내용

핵심 상태 변경 함수 내부에 `_saveDirty = true`를 명시적으로 추가했다.

자동 반복 수익 함수는 즉시 저장이 아니라 dirty 표시 중심으로 처리했다.

## 브라우저 테스트 결과

GitHub Actions는 브라우저 UI 테스트를 수행하지 않는다.

아래 항목은 로컬/실기기에서 별도 확인해야 한다.

1. 돈 획득 후 5초 내 새로고침
2. 업그레이드 구매 직후 새로고침
3. 연구 진행 직후 새로고침
4. 지역 이동 후 플레이하고 새로고침
5. 다른 지역으로 이동 후 기존 지역 복귀
6. 모바일 브라우저에서 홈 화면 전환 후 재진입
7. 콘솔 warning 반복 여부 확인

## 남은 리스크

- 실제 브라우저 저장 테스트는 별도 필요하다.
- 모바일 브라우저 백그라운드 전환 테스트는 별도 필요하다.
- 장기적으로 wrapper hotfix를 줄이고 `main.js` 내부 저장 helper로 정리하는 것이 좋다.

## 다음 스텝 제안

Step 2-23X: Browser Retest and Hotfix Cleanup을 진행한다.
