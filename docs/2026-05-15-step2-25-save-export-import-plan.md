# Step 2-25 저장 데이터 Export/Import 수동 백업 설계 및 QA 계획

작성일: 2026-05-15

## 0. 중요 저장 리스크

현재 Step 2-23 저장 안정화 1차와 Step 2-24B backup key/save recovery 실제 적용은 아직 완료되지 않았다.

따라서 이 문서는 실제 기능 구현 문서가 아니라, 이후 적용할 export/import 수동 백업 기능의 설계와 QA 기준을 정리하는 문서다.

현재 남아 있는 저장 리스크:

- `save(true)` 성공/실패 boolean 반환 구조 미반영
- localStorage 저장 실패 감지 미흡
- 강제 저장 실패 시 사용자 피드백 미흡
- `pagehide` 저장 훅 미반영
- `visibilitychange` 저장 훅 미반영
- backup save key 미적용
- 저장 데이터 손상 시 자동 복구 미흡
- 수동 export/import 기능 없음

이 문서의 내용은 Step 2-23과 Step 2-24B가 완료된 뒤 실제 구현 단계에서 사용한다.

## 1. 현재 저장 구조 요약

현재 게임은 브라우저 `localStorage` 기반 저장 구조다.

Primary save key:

```js
const SAVE_KEY = "niceChicken_idleServe_vFinal";
```

저장 방식은 전체 `state` 객체를 JSON 문자열로 직렬화해서 저장하는 방식이다.

개념:

```js
localStorage.setItem(SAVE_KEY, JSON.stringify(state));
```

현재 구조의 장점:

- 서버 없이 동작한다.
- 구현이 단순하다.
- 오프라인에서도 저장된다.
- GitHub Pages 정적 배포와 잘 맞는다.

현재 구조의 한계:

- 브라우저/기기 종속 저장이다.
- 브라우저 데이터 삭제 시 저장이 사라진다.
- 다른 기기와 동기화되지 않는다.
- localStorage 손상/삭제에 취약하다.
- 사용자가 직접 저장 파일을 백업할 방법이 없다.

## 2. export/import 기능이 필요한 이유

나이스치킨은 idle/incremental 계열 게임에 가까우므로, 사용자가 장기간 누적한 진행 데이터가 중요하다.

수동 export/import 기능은 다음 문제를 해결한다.

1. 브라우저 저장소 삭제에 대비
2. 다른 브라우저/기기로 저장 이동
3. localStorage 손상 시 수동 복구
4. 배포 변경 또는 save migration 전 사용자 보호
5. QA 테스트 시 특정 상태 재현
6. 사용자가 직접 저장본을 보관할 수 있는 심리적 안정감 제공

특히 Step 2-23/2-24B가 완료되어도, localStorage 자체가 브라우저 종속인 한 수동 백업 기능은 필요하다.

## 3. Export 대상 데이터 범위

기본 export 대상은 `state` 전체다.

권장 export 구조:

```json
{
  "game": "nice-chicken",
  "schema": "niceChicken.save.export.v1",
  "version": 1,
  "exportedAt": 1710000000000,
  "saveKey": "niceChicken_idleServe_vFinal",
  "state": {}
}
```

필드 설명:

| 필드 | 설명 |
|---|---|
| `game` | 다른 게임 데이터와 구분하기 위한 식별자 |
| `schema` | export 데이터 구조 식별자 |
| `version` | export format 버전 |
| `exportedAt` | 내보낸 시각 |
| `saveKey` | 원래 저장 key |
| `state` | 실제 게임 진행 데이터 |

### 포함해야 할 state 범위

- 돈/평판/레벨
- 메뉴 레벨
- 업그레이드 상태
- 연구 상태
- 직원 상태
- 지역/지점 상태
- 쿠폰/교환권 상태
- 통계 데이터
- 마지막 접속 시간
- 설정값 중 저장 대상에 포함된 항목

### 제외할 수 있는 데이터

- 일시적인 DOM 상태
- 현재 열려 있는 모달 상태
- 렌더링 캐시
- 사운드 재생 중 상태
- 런타임 전용 임시 변수

단, 현재 구조에서 state에 포함되어 있는 값은 원칙적으로 그대로 export한다.

## 4. Import 시 검증해야 할 항목

Import는 단순히 JSON을 덮어쓰면 안 된다.

검증 조건:

1. JSON parse 가능 여부
2. 최상위 객체 여부
3. `game === "nice-chicken"` 여부
4. `schema` 또는 `saveKey` 확인
5. `state` 필드 존재 여부
6. `state`가 객체인지 확인
7. 필수 필드 일부 존재 여부
8. `defaultState()`와 병합 가능 여부
9. `sanitizeState()` 통과 가능 여부
10. import 후 `save(true)` 성공 여부

권장 import 흐름:

```text
사용자 데이터 입력
→ JSON parse
→ wrapper 검증
→ state 객체 추출
→ defaultState()와 병합
→ sanitizeState()
→ 사용자 최종 확인
→ state 교체
→ save(true)
→ updateUI()
→ 필요 시 location reload 또는 전체 render
```

## 5. 잘못된 JSON 대응

잘못된 JSON 예시:

- 중괄호가 깨진 텍스트
- 일부만 복사한 데이터
- 스마트폰 메모장 자동 변환 문자 포함
- 빈 문자열
- 다른 파일 내용

대응:

- JSON.parse를 try/catch로 감싼다.
- 실패 시 state를 절대 변경하지 않는다.
- 사용자에게 명확히 안내한다.

권장 메시지:

```text
저장 데이터를 읽을 수 없습니다. 복사한 내용이 올바른지 확인해 주세요.
```

console 로그:

```js
console.error("[import] invalid json", e);
```

## 6. 다른 게임 데이터 대응

다른 게임이나 다른 앱의 JSON이 들어올 수 있다.

대응:

- `game` 값 확인
- `schema` 값 확인
- `state` 구조 확인

권장 메시지:

```text
나이스치킨 저장 데이터가 아닙니다.
```

주의:

- 단순히 `state.money`가 있다고 해서 유효한 저장으로 판단하면 안 된다.
- 최소한 `game`, `schema`, `state` 3가지를 확인해야 한다.

## 7. 구버전 데이터 대응

향후 save schema가 바뀔 수 있다.

권장 방식:

```js
version: 1
```

Import 시 version에 따라 migration을 수행한다.

초기에는 v1만 허용하고, 알 수 없는 version은 확인 메시지를 띄운 뒤 보수적으로 처리한다.

권장 메시지:

```text
이 저장 데이터는 다른 버전에서 생성되었습니다. 불러오기를 시도할 수 있지만 일부 값이 보정될 수 있습니다.
```

기본 대응:

- `defaultState()`와 병합
- `sanitizeState()` 실행
- 누락 필드는 기본값 사용
- 알 수 없는 필드는 유지할지 제거할지 별도 판단

초기 구현에서는 알 수 없는 필드를 완전히 제거하지 않는 것이 안전하다.

## 8. 사용자 확인 팝업 설계

Import는 기존 저장을 덮어쓰는 위험 작업이다.

따라서 최소 2단계 확인이 필요하다.

### 1차 확인

```text
저장 데이터를 불러오면 현재 진행 상황이 가져온 데이터로 바뀝니다. 계속할까요?
```

버튼:

- 취소
- 불러오기

### 2차 확인, 선택사항

현재 저장을 먼저 export하도록 안내한다.

```text
불러오기 전에 현재 저장을 백업하는 것을 권장합니다.
```

버튼:

- 현재 저장 내보내기
- 계속 불러오기
- 취소

초기 구현에서는 1차 확인만 넣고, 이후 Step에서 2차 확인을 추가해도 된다.

## 9. 모바일 복사/붙여넣기 UX

모바일에서는 파일 다운로드/업로드보다 텍스트 복사/붙여넣기가 더 안정적일 수 있다.

권장 UX:

### Export

- 큰 textarea에 export JSON 표시
- `복사하기` 버튼 제공
- 복사 성공/실패 토스트 표시

### Import

- textarea에 JSON 붙여넣기
- `검증하기` 버튼
- 검증 성공 시 요약 표시
- `불러오기` 버튼 활성화

모바일 고려사항:

- textarea 높이 충분히 제공
- 전체 선택/복사 버튼 제공
- 긴 JSON 때문에 화면이 깨지지 않도록 monospace + scroll 적용
- 복사 API 실패 시 수동 복사 안내

## 10. 설정 모달 UI 초안

설정 모달에 다음 섹션을 추가하는 방식을 권장한다.

```text
[저장 관리]

현재 저장 내보내기
- 버튼: 저장 데이터 복사
- 설명: 현재 진행 상황을 텍스트로 백업합니다.

저장 데이터 가져오기
- textarea: 백업 데이터를 붙여넣으세요.
- 버튼: 데이터 검증
- 버튼: 불러오기

주의 문구:
불러오기를 실행하면 현재 진행 상황이 가져온 데이터로 바뀝니다.
```

초기 구현에서는 별도 모달보다 설정 모달 내부 접이식 영역이 좋다.

## 11. 실제 적용 전 선행 조건

Export/import 실제 구현 전 아래 조건을 만족해야 한다.

1. Step 2-23 저장 안정화 1차 완료
2. Step 2-24B backup key/save recovery 완료
3. `save(true)` boolean 반환 구조 존재
4. 저장 실패 토스트 존재
5. backup 복구 흐름 존재
6. `node --check js/main.js` 통과
7. 브라우저에서 저장/복구 기본 테스트 완료

Step 2-23/2-24B가 완료되지 않은 상태에서 export/import를 넣으면 저장 문제의 원인 분석이 더 어려워진다.

## 12. QA 테스트 시나리오

### 12-1. Export 정상

1. 게임 진행
2. 돈/레벨/메뉴 상태 변경
3. 저장 데이터 내보내기
4. JSON에 `game`, `schema`, `version`, `state`가 있는지 확인
5. 복사 성공 토스트 확인

기대 결과:

- JSON 생성 성공
- state 포함
- 콘솔 에러 없음

### 12-2. Import 정상

1. 정상 export JSON 복사
2. 새 브라우저 또는 localStorage 삭제 환경 준비
3. import textarea에 붙여넣기
4. 검증
5. 불러오기
6. UI 갱신 확인
7. 새로고침 후 유지 확인

기대 결과:

- 가져온 상태로 복구
- save(true) 성공
- 새로고침 후 유지

### 12-3. 잘못된 JSON

입력:

```text
{ broken json
```

기대 결과:

- import 중단
- 기존 state 유지
- 오류 토스트 표시
- console.error 기록

### 12-4. 다른 게임 데이터

입력:

```json
{
  "game": "other-game",
  "state": {}
}
```

기대 결과:

- import 중단
- 기존 state 유지
- "나이스치킨 저장 데이터가 아닙니다" 안내

### 12-5. 구버전 데이터

입력:

```json
{
  "game": "nice-chicken",
  "schema": "niceChicken.save.export.v1",
  "version": 0,
  "state": {}
}
```

기대 결과:

- 경고 표시
- 가능한 경우 defaultState와 병합
- sanitizeState 실행

### 12-6. Import 취소

1. import 데이터 검증 성공
2. 확인 팝업에서 취소

기대 결과:

- 기존 state 유지
- 저장하지 않음

### 12-7. Import 후 백업 연계

Step 2-24B 완료 후 테스트한다.

1. 기존 저장 존재
2. import 실행
3. 기존 primary가 backup에 보존되는지 확인
4. 새 primary 저장 확인

기대 결과:

- import 전 저장본이 backup에 남아 있음

## 13. Step 2-26 진입 조건

Step 2-26은 export/import 실제 적용 또는 저장 QA 자동화 단계로 정의할 수 있다.

진입 조건:

1. Step 2-23 완료
2. Step 2-24B 완료
3. 브라우저 저장 QA 1차 통과
4. export/import 설계 확정
5. 설정 모달 UI 위치 확정
6. import 확인 팝업 문구 확정

## 14. 결론

Export/import는 장기 플레이 데이터 보호를 위해 필요하다.

하지만 현 시점에서는 Step 2-23과 Step 2-24B가 아직 완료되지 않았으므로 실제 구현은 보류한다.

이번 단계의 산출물은 향후 구현을 위한 설계와 QA 기준이다.

권장 순서:

1. Step 2-23 저장 안정화 실제 반영
2. Step 2-24B backup key/save recovery 실제 반영
3. Step 2-25 설계 기반 export/import 실제 구현
4. Step 2-26 저장 QA 실행
