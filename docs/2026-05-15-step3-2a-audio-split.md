# Step 3-2A Audio Module Split

작성일: 2026-05-15

## 변경 내용

- `js/main.js`의 SOUND/WebAudio 블록을 `js/core/audio.js`로 분리했다.
- `index.html`에서 `js/core/audio.js`를 `js/main.js`보다 먼저 로드하도록 했다.
- ES module 전환은 하지 않고 classic script/global 호출 구조를 유지했다.

## 분리된 항목

- `SOUND`, `AudioEngine`
- `ensureAudio()`, `unlockAudioOnce()`, `beep()`
- `sfxTick()`, `sfxDing()`, `sfxWrong()`, `sfxFanfare()`, `sfxConfirm()`
- `startBGM()`, `stopBGM()`, `setSoundEnabled()`

## 검증

- `node --check js/core/audio.js`
- `node --check js/main.js`
- inline `onclick=` 0개 유지
- `.onclick =` 0개 유지
- `function safeClick` 0개 유지
- 실제 `safeClick(` 호출 0개 유지

## 남은 리스크

- 브라우저에서 첫 사용자 터치 후 audio unlock이 정상 동작하는지 확인 필요.
- BGM 시작/정지, 효과음 재생, 사운드 ON/OFF 버튼 수동 테스트 필요.
- Step 2-23 저장 안정화는 여전히 미완료 상태.
