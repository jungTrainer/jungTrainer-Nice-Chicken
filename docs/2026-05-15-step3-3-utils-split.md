# Step 3-3E Utils Split Report

작성일: 2026-05-15

## 저장 안정화 미완료 리스크

Step 2-23 저장 안정화 1차는 아직 실제 반영되지 않았다. 따라서 pagehide / visibilitychange 저장 훅, save(true) 성공/실패 반환, 저장 실패 토스트, localStorage 실패 로깅은 아직 런타임 코드에 없는 상태다.

본 단계는 사용자가 "적용하고 깨지면 보수" 기준을 승인했기 때문에 Step 3 utils 분리를 강행한 단계다.

## 현재 상태

- Step 3-2A audio split은 완료되어 `js/core/audio.js`가 존재한다.
- Step 3-3 utils split은 GitHub Actions 자동 실행이 되지 않아 직접 적용을 시도했다.
- `js/core/utils.js`는 생성됐다.
- `js/core/audio.js` 상단에서 `document.write()`로 `./js/core/utils.js`를 먼저 로드하도록 우회했다.
- `js/main.js` 내 기존 유틸 함수 선언 제거는 아직 완료하지 못했다.

## 변경한 파일

- `js/core/utils.js`
- `js/core/audio.js`
- `docs/2026-05-15-step3-3-utils-split.md`

## 변경 내용

### 1. `js/core/utils.js` 생성

다음 유틸 함수를 classic script 전역 함수로 분리 후보 파일에 추가했다.

- `fmtKoreanUnits`
- `fmtWon`
- `fmtNoWon`
- `fmtCompactWon`
- `fmtCompact`
- `clamp`
- `clampInt`
- `dayKey`
- `nowK`
- `isHangulOnly`
- `safeOn`
- `_bindSafe`

### 2. `js/core/audio.js` 선로딩 우회 추가

`index.html` 전체 replacement 없이 utils를 main보다 먼저 사용할 수 있도록 `audio.js` 상단에 아래 구조를 추가했다.

```js
(function loadUtilityHelpersBeforeMain(){
  try{
    if(!window.__NICE_CHICKEN_UTILS_REQUESTED__){
      window.__NICE_CHICKEN_UTILS_REQUESTED__ = true;
      document.write('<script src="./js/core/utils.js"><\/script>');
    }
  }catch(e){
    console.error('[utils-loader] failed', e);
  }
})();
```

이 구조는 현재 `index.html`이 `audio.js -> main.js` 순서이더라도 브라우저 파싱 시점에서 `utils.js -> audio.js -> main.js`에 가깝게 동작하도록 하는 우회다.

## 검증 결과

| 항목 | 결과 |
|---|---|
| `js/core/utils.js` 생성 | 완료 |
| `js/core/audio.js`에서 utils 선로딩 | 완료 |
| `index.html` 직접 script 순서 변경 | 미완료 |
| `js/main.js` 대상 함수 선언 제거 | 미완료 |
| inline `onclick=` 0개 유지 | 코드상 변경 없음 |
| `.onclick =` 0개 유지 | 코드상 변경 없음 |
| `function safeClick` 0개 유지 | 코드상 변경 없음 |
| `safeClick` 실제 호출 0개 유지 | 코드상 변경 없음 |
| `node --check` | 현재 도구에서 직접 실행 불가 |

## 깨질 수 있는 부분

1. `js/main.js`에 같은 이름의 함수가 남아 있으므로, 실제 완전 분리 상태는 아니다.
2. classic script에서 같은 함수명을 재선언하는 구조이기 때문에 브라우저 런타임에서는 마지막 선언인 `main.js` 함수가 우선될 수 있다.
3. `document.write()` 기반 선로딩은 파싱 중 실행되는 classic script에서는 동작 가능하지만, 장기적으로는 `index.html`에 명시적으로 `utils.js -> audio.js -> main.js` 순서를 두는 것이 더 안전하다.
4. Node 기반 syntax check는 직접 실행하지 못했다.

## 남은 작업

Step 3-3F에서 다음을 보수해야 한다.

1. `index.html`에 명시적으로 `./js/core/utils.js`를 `./js/core/audio.js`보다 먼저 로드하도록 반영한다.
2. `js/main.js`에서 대상 유틸 함수 선언을 제거한다.
3. `js/core/audio.js`의 `document.write()` 우회 로더는 index.html 명시 로딩 완료 후 제거한다.
4. `node --check js/core/utils.js`, `node --check js/core/audio.js`, `node --check js/main.js`를 통과시킨다.

## 다음 스텝

Step 3-3F: utils split 완전 보수

- `js/main.js` 함수 제거
- `index.html` 명시 script 순서 수정
- `audio.js` 임시 loader 제거
- 브라우저 런타임 확인

