# Step 2-3B GitHub 반영 차단 보고

작성일: 2026-05-15
대상 레포: `jungTrainer/jungTrainer-Nice-Chicken`

## 현재 상태

Step 2-3B 패치본은 첨부된 `index1.txt` 기준으로 생성 및 검증 완료되었다.

패치본 검증 결과:

- `onclick="closeExpansionModal()"`: 0개
- `id="closeExpansionModalBtn"`: 1개
- `closeExpansionModalBtn` click 이벤트 바인딩: 1개
- `function closeExpansionModal`: 1개
- script 추출 후 `node --check`: 통과

그러나 GitHub `main`의 `index.html`에는 아직 inline onclick이 남아 있다.

현재 main SHA:

```text
495e3767f20f0a2e3b5b1443f1ec8cbcd216c8a7
```

## 반영 시도 결과

GitHub `update_file` 도구는 전체 UTF-8 문자열을 요구한다. 현재 환경에서는 `/mnt/data/index1.step2-3b.patched.html` 파일 경로를 그대로 업로드하는 방식이 지원되지 않는다.

또한 대형 `index.html` 전체를 수동으로 재구성해 도구에 전달하는 것은 다음 위험이 크다.

- 파일 일부 누락
- 한글/이모지 깨짐
- script 손상
- 기존 게임 로직 유실

추가로 자동 패치 워크플로우를 새로 생성해 재시도하려 했으나, 해당 도구 요청이 안전 검사에서 차단되었다.

## 현재 판정

Step 2-3B는 다음 상태다.

- 패치본 생성 완료
- 패치본 검증 완료
- GitHub main 직접 반영 미완료
- 직접 반영 차단 사유 문서화 완료

## 안전한 다음 실행 경로

1. GitHub Codespaces 또는 로컬 git 환경에서 레포를 연다.
2. `index1.step2-3b.patched.html` 내용을 `index.html`로 교체한다.
3. 아래 검증을 실행한다.

```bash
grep -n 'onclick="closeExpansionModal()"' index.html || true
grep -n 'id="closeExpansionModalBtn"' index.html
grep -n 'closeExpansionModalBtn.addEventListener("click"' index.html
python3 - <<'PY'
from pathlib import Path
import re
text = Path('index.html').read_text(encoding='utf-8')
scripts = re.findall(r'<script[^>]*>(.*?)</script>', text, flags=re.S|re.I)
Path('/tmp/index-extracted.js').write_text('\n'.join(scripts), encoding='utf-8')
PY
node --check /tmp/index-extracted.js
```

4. 검증 통과 시 커밋한다.

```bash
git add index.html
git commit -m "Remove expansion close inline onclick"
git push
```

## 다음 작업

GitHub main에 Step 2-3B가 반영되면 다음은 Step 2-3C로 진행한다.

Step 2-3C 목표:

- 지역 카드 내부의 `moveBranch`, `unlockBranch` 버튼 생성 로직 추적
- inline onclick 제거 여부 확인
- `data-action`, `data-region-id` 이벤트 위임 구조로 전환 준비
