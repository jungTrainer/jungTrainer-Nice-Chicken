# Step 2-17 GitHub Actions 반영 경로 진단

작성일: 2026-05-15

## 결론

Step 2-17 코드 패치 스크립트는 준비되어 있으나, 현재 ChatGPT GitHub 도구만으로는 해당 스크립트를 저장소 내부에서 직접 실행할 수 없다.

또한 GitHub Actions 실행 여부는 현재 도구의 조회 한계 때문에 완전히 판별할 수 없다. 다만 Step 2-17 산출 커밋과 보고서가 생성되지 않았으므로, 실제 반영은 아직 완료되지 않은 상태다.

## 확인한 권한

- 인증 사용자: `jungTrainer`
- 저장소 권한: `admin`, `maintain`, `push`, `pull`, `triage` 모두 가능
- 저장소: `jungTrainer/jungTrainer-Nice-Chicken`
- 기본 브랜치: `main`
- 저장소 공개 상태: `public`

따라서 현재 문제는 일반적인 쓰기 권한 부족이 아니다.

## 확인한 Step 2-17 준비 상태

- Step 2-17 스크립트: `scripts/apply-step2-17-upglist-click-cleanup.py`
- 스크립트 추가 커밋: `5dd39cdf35347b54b69ea5945adbfe7517801527`
- workflow Step 2-17 전환 커밋: `4f54e853e6611cf8b376b4ffce78e3e9702272cb`
- workflow trigger 조건 확장 커밋: `77c154ddf5f2aee58cb609c27a9e53fd4ba1d211`
- 직접 반영 차단 문서: `docs/2026-05-15-step2-17-direct-apply-blocked.md`
- 직접 반영 차단 문서 커밋: `7ac5a0046dc237e9daf6b9d51794a00d6eed4e8a`

## 현재 workflow 구조

현재 workflow는 `push`와 `workflow_dispatch`를 사용한다.

```yaml
on:
  push:
  workflow_dispatch:
```

따라서 paths 조건 때문에 실행이 제한되는 상태는 아니다.

## 도구 한계

현재 사용 가능한 GitHub 도구는 다음을 제공한다.

- 파일 조회/생성/전체 교체
- 커밋 검색
- 커밋 상태 조회
- PR/Issue 조작
- 제한적인 workflow run 조회

하지만 다음이 없다.

- 저장소 안에서 스크립트 실행
- workflow_dispatch 직접 호출
- 일반 push 기반 workflow run 전체 목록 조회
- 부분 파일 패치
- path/tree elements를 지정할 수 있는 create_tree

## 직접 반영이 위험한 이유

`update_file`로 `js/main.js`를 교체하는 것은 가능하지만, 이는 부분 패치가 아니라 대형 파일 전체 교체다.

현재 Step 2-17 변경 대상은 3개 `.onclick` 직접 대입뿐이지만, 전체 파일 교체를 강행하면 모델이 대형 `js/main.js` 전체를 다시 구성해야 한다. 이 과정에서 코드 누락/깨짐/문자열 손상이 발생할 수 있다.

따라서 검증 가능한 자동 치환을 실행할 수 없는 상황에서 대형 파일 전체 교체는 안전하지 않다.

## 남은 Step 2-17 대상

```js
div.querySelector("button").onclick = () => {
  unlockAudioOnce(); 
  if(typeof startBGM === "function") startBGM();
  buyUpgrade(u.id);
};
```

```js
card.querySelector(`#btn-auto-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'auto');
card.querySelector(`#btn-tip-${s.key}`).onclick = () => buyStaffUpgrade(s.key, 'tip');
```

## 현재 코드 상태 요약

- inline `onclick=`: 0개 유지
- `function safeClick`: 0개 유지
- 실제 `safeClick(...)` 호출: 0개 유지
- `.onclick =` 직접 대입: 4개 잔존
- Step 2-17 실제 반영: 미완료

## 원인 판단

가능성이 높은 원인은 다음 중 하나다.

1. GitHub App/API로 생성한 커밋이 workflow push 실행을 유발하지 않는 제한
2. workflow는 실행됐지만 실패했고, 현재 도구가 push workflow run 목록을 조회하지 못함
3. Actions 설정에서 workflow 실행이 제한되어 있음
4. workflow_dispatch는 존재하지만 현재 도구에 직접 호출 기능이 없음

현재 도구만으로는 1~4를 완전히 분리할 수 없다.

## 권장 조치

가장 안전한 해결 방법은 다음 중 하나다.

1. GitHub UI에서 Actions 탭을 열고 `Expansion Event Cleanup Steps` 워크플로우를 수동 실행한다.
2. Codespaces 또는 로컬에서 다음 명령을 실행한다.

```bash
python3 scripts/apply-step2-17-upglist-click-cleanup.py
```

그 후 아래를 확인한다.

```bash
grep -c 'div.querySelector("button").onclick' js/main.js
grep -c 'card.querySelector(`#btn-auto-${s.key}`).onclick' js/main.js
grep -c 'card.querySelector(`#btn-tip-${s.key}`).onclick' js/main.js
grep -c 'upgListEl.addEventListener("click"' js/main.js
grep -c ' onclick=' index.html js/main.js
node --check js/main.js
```

3. ChatGPT GitHub 도구에 `workflow_dispatch` 호출 또는 일반 workflow run 목록 조회 권한/도구가 제공되면, 해당 경로로 재시도한다.

## 다음 단계

Step 2-17 자체 코드는 준비되어 있으므로, 다음 병목은 코드 작성이 아니라 실행 환경이다. Actions 수동 실행 또는 Codespaces/로컬 실행이 가능한 시점에 기존 스크립트를 그대로 실행하는 것이 가장 안전하다.
