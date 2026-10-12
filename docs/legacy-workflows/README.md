# 과거 자동 패치 워크플로 보관

IMP-09에서 `.github/workflows`의 일회성 패치 워크플로 7개를 원본 그대로 옮겼다. 이 폴더의 YAML은 GitHub Actions 실행 대상이 아니다. 기존 Python 패치 스크립트와 과거 보고서는 기록으로 남기며 현재 코드에 자동 실행하지 않는다.

| 파일 | 이전 자동 실행 조건 | 동작 |
| --- | --- | --- |
| `cleanup-oncanvas-step2-3a.yml` | 자체 YAML 변경 push | HTML 입력 함수 정리 후 자동 commit/push |
| `hotfix-staff-upgrade-cost.yml` | 자체 YAML 변경 push | HTML 비용 함수 패치 후 자동 commit/push |
| `split-css-step2-2.yml` | 자체 YAML 변경 push | CSS 분리 후 자동 commit/push |
| `stabilize-step2-1.yml` | 자체 YAML 변경 push | 저장/엔딩 HTML 패치 후 자동 commit/push |
| `remove-expansion-inline-onclick-step2-3b.yml` | 모든 push | 과거 Step 3-3 기준 검증·utils 분리 후 자동 commit/push |
| `step2-23w-execute-explicit-save-patch.yml` | main의 자체 YAML/패치 스크립트 변경 push | 저장 패치 실행 후 자동 commit/push |
| `step2-24a-recipe-research-click-fix.yml` | main의 자체 YAML/패치 스크립트 변경 push | 연구 입력 패치 후 자동 commit/push |

모두 수동 workflow_dispatch와 contents write 권한도 갖고 있었다. 현재 활성 CI는 검사와 실패 자료 보관만 수행한다. 원본의 path/기준 함수는 이미 바뀐 코드에 적용할 수 없으므로 이 파일들을 실행 폴더로 단순 복사하지 않는다. main에 있는 원본은 아직 변경하지 않았다.
