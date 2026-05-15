# Step 2-17 직접 반영 중단 보고

작성일: 2026-05-15

## 결론

Step 2-17 실제 반영은 아직 완료되지 않았다.

워크플로우 재트리거를 반복하지 않고 직접 반영 경로를 검토했으나, 현재 사용 가능한 GitHub 도구 조합으로는 안전한 부분 패치가 불가능했다.

## 확인한 사실

- Step 2-17 스크립트는 존재한다.
  - `scripts/apply-step2-17-upglist-click-cleanup.py`
- workflow 전환 커밋도 존재한다.
  - `4f54e853e6611cf8b376b4ffce78e3e9702272cb`
- workflow trigger 조건을 넓힌 커밋도 생성했다.
  - `77c154ddf5f2aee58cb609c27a9e53fd4ba1d211`
- 그러나 `Convert upgList click handlers` 커밋은 아직 생성되지 않았다.
- `docs/2026-05-15-step2-17-upglist-click-cleanup.md`도 아직 생성되지 않았다.

## 직접 반영 경로 검토 결과

사용 가능한 GitHub 도구에는 다음이 있었다.

- `update_file`
- `create_blob`
- `create_tree`
- `create_commit`
- `update_ref`

하지만 `create_tree` 도구가 실제 tree elements/path 지정 인자를 받지 않는 형태라, `js/main.js`와 보고서를 blob으로 만든 뒤 tree에 경로별로 연결하는 직접 커밋 방식은 사용할 수 없었다.

따라서 가능한 직접 반영 방식은 `update_file`로 `js/main.js` 전체 파일을 교체하는 방식뿐이다.

## 중단 사유

`js/main.js`는 대형 파일이다. 현재 도구 환경에서는 저장소 내부에서 Python 스크립트를 실행할 수 없고, 부분 패치 API도 없다.

따라서 `update_file`로 직접 반영하려면 최신 `js/main.js` 전체 원문을 모델이 다시 구성해 업로드해야 한다. 이 방식은 Step 2-17 대상 3개만 바꾸는 것이 아니라 대형 파일 전체를 재작성하는 방식이 되어 코드 유실 위험이 크다.

사용자가 리스크를 감수한다고 했지만, 현재 방식은 검증 가능한 리스크가 아니라 대형 파일 손상 가능성이 큰 반영 방식이므로 강행하지 않았다.

## 현재 남은 대상

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

## 다음 권장 조치

가장 안전한 실제 반영 경로는 다음 중 하나다.

1. GitHub Actions 실행 원인을 해결한 뒤 기존 스크립트 실행
2. Codespaces/로컬에서 `python3 scripts/apply-step2-17-upglist-click-cleanup.py` 실행
3. 부분 패치가 가능한 도구 또는 GitHub API 경로가 확보되면 직접 커밋

## 현재 상태 요약

- inline `onclick=`: 0개 유지
- `function safeClick`: 0개 유지
- 실제 `safeClick(...)` 호출: 0개 유지
- `.onclick =` 직접 대입: 4개 잔존
- Step 2-17 실제 반영: 미완료
