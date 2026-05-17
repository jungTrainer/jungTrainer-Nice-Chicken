#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

MAIN = Path("js/main.js")
INDEX = Path("index.html")
AUDIO = Path("js/core/audio.js")
REPORT = Path("docs/2026-05-15-step3-2a-audio-split.md")

SOUND_START = "/* --------------------\n   SOUND (WebAudio)\n-------------------- */"
CONFIG_START = "/* --------------------\n   CONFIG\n-------------------- */"
MAIN_SCRIPT = '<script src="./js/main.js"></script>'
AUDIO_SCRIPT = '<script src="./js/core/audio.js"></script>'
SCRIPT_BLOCK = AUDIO_SCRIPT + "\n" + MAIN_SCRIPT

REQUIRED_AUDIO_MARKERS = [
    "const SOUND",
    "const AudioEngine",
    "function ensureAudio",
    "function unlockAudioOnce",
    "function beep",
    "function sfxTick",
    "function sfxDing",
    "function sfxWrong",
    "function sfxFanfare",
    "function sfxConfirm",
    "function startBGM",
    "function stopBGM",
    "function setSoundEnabled",
]


def fail(msg):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def actual_safe_click_count(js):
    return sum(1 for line in js.splitlines() if "safeClick(" in line and not line.strip().startswith("function safeClick"))


def direct_onclick_count(js):
    return len(re.findall(r"\.onclick\s*=", js))


def inline_onclick_count(index_html, js):
    return len(re.findall(r"\sonclick\s*=", index_html + "\n" + js, flags=re.I))


def assert_event_invariants(index_html, js):
    if inline_onclick_count(index_html, js) != 0:
        fail(f"inline onclick must remain 0, found {inline_onclick_count(index_html, js)}")
    if direct_onclick_count(js) != 0:
        fail(f".onclick assignments must remain 0, found {direct_onclick_count(js)}")
    if js.count("function safeClick") != 0:
        fail(f"function safeClick must remain 0, found {js.count('function safeClick')}")
    if actual_safe_click_count(js) != 0:
        fail(f"safeClick actual calls must remain 0, found {actual_safe_click_count(js)}")


def validate_audio_block(text, label):
    missing = [m for m in REQUIRED_AUDIO_MARKERS if text.count(m) != 1]
    if missing:
        fail(f"unexpected audio marker counts in {label}: " + ", ".join(f"{m}={text.count(m)}" for m in missing))


def extract_sound_block(main_js):
    start = main_js.find(SOUND_START)
    end = main_js.find(CONFIG_START)
    if start < 0:
        return None, main_js
    if end < 0:
        fail("CONFIG block marker not found")
    if start >= end:
        fail("SOUND block marker must appear before CONFIG marker")
    sound_block = main_js[start:end].rstrip() + "\n"
    validate_audio_block(sound_block, "js/main.js extracted block")
    patched_main = main_js[:start] + "/* Step 3-2A: SOUND/WebAudio moved to js/core/audio.js */\n\n" + main_js[end:]
    return sound_block, patched_main


def ensure_index_scripts(index_html):
    audio_count = index_html.count(AUDIO_SCRIPT)
    main_count = index_html.count(MAIN_SCRIPT)

    if audio_count > 1:
        fail(f"audio script tag appears too many times: {audio_count}")
    if main_count > 1:
        fail(f"main script tag appears too many times: {main_count}")

    if audio_count == 1 and main_count == 1:
        if index_html.find(AUDIO_SCRIPT) > index_html.find(MAIN_SCRIPT):
            fail("audio script tag must appear before main script tag")
        return index_html

    if audio_count == 0 and main_count == 1:
        return index_html.replace(MAIN_SCRIPT, SCRIPT_BLOCK, 1)

    if audio_count == 1 and main_count == 0:
        return index_html.replace(AUDIO_SCRIPT, SCRIPT_BLOCK, 1)

    if audio_count == 0 and main_count == 0:
        if "</body>" not in index_html:
            fail("</body> anchor not found for script insertion")
        return index_html.replace("</body>", SCRIPT_BLOCK + "\n</body>", 1)

    fail("unreachable index script state")


def main():
    if not MAIN.exists():
        fail("js/main.js not found")
    if not INDEX.exists():
        fail("index.html not found")

    main_js = MAIN.read_text(encoding="utf-8")
    index_html = INDEX.read_text(encoding="utf-8")
    assert_event_invariants(index_html, main_js)

    extracted_audio, patched_main = extract_sound_block(main_js)

    if AUDIO.exists():
        audio_text = AUDIO.read_text(encoding="utf-8")
        validate_audio_block(audio_text, "existing js/core/audio.js")
        if extracted_audio is None:
            # Already extracted from main; keep existing audio file.
            final_audio = audio_text
        else:
            # Partial state: audio exists but main still has the block. Keep existing audio if valid.
            final_audio = audio_text
    else:
        if extracted_audio is None:
            fail("audio.js missing and SOUND block not found in main.js")
        final_audio = (
            "// Step 3-2A: extracted from js/main.js.\n"
            "// Loaded before js/main.js as a classic script, so existing global calls remain compatible.\n\n"
            + extracted_audio
        )

    if extracted_audio is not None:
        final_main = patched_main
    else:
        final_main = main_js

    for marker in ["const SOUND", "const AudioEngine", "function ensureAudio", "function unlockAudioOnce", "function beep", "function startBGM", "function stopBGM", "function setSoundEnabled"]:
        if marker in final_main:
            fail(f"audio marker still remains in js/main.js after extraction: {marker}")

    final_index = ensure_index_scripts(index_html)
    assert_event_invariants(final_index, final_main)

    AUDIO.parent.mkdir(parents=True, exist_ok=True)
    AUDIO.write_text(final_audio, encoding="utf-8")
    MAIN.write_text(final_main, encoding="utf-8")
    INDEX.write_text(final_index, encoding="utf-8")

    subprocess.run(["node", "--check", str(AUDIO)], check=True)
    subprocess.run(["node", "--check", str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 3-2A Audio Module Split\n\n"
        "작성일: 2026-05-15\n\n"
        "## 변경 내용\n\n"
        "- `js/main.js`의 SOUND/WebAudio 블록을 `js/core/audio.js`로 분리했다.\n"
        "- `index.html`에서 `js/core/audio.js`를 `js/main.js`보다 먼저 로드하도록 했다.\n"
        "- ES module 전환은 하지 않고 classic script/global 호출 구조를 유지했다.\n"
        "- partial apply 상태에서도 재실행 가능하도록 스크립트를 보강했다.\n\n"
        "## 분리된 항목\n\n"
        "- `SOUND`, `AudioEngine`\n"
        "- `ensureAudio()`, `unlockAudioOnce()`, `beep()`\n"
        "- `sfxTick()`, `sfxDing()`, `sfxWrong()`, `sfxFanfare()`, `sfxConfirm()`\n"
        "- `startBGM()`, `stopBGM()`, `setSoundEnabled()`\n\n"
        "## 검증\n\n"
        "- `node --check js/core/audio.js`\n"
        "- `node --check js/main.js`\n"
        "- inline `onclick=` 0개 유지\n"
        "- `.onclick =` 0개 유지\n"
        "- `function safeClick` 0개 유지\n"
        "- 실제 `safeClick(` 호출 0개 유지\n\n"
        "## 남은 리스크\n\n"
        "- 브라우저에서 첫 사용자 터치 후 audio unlock이 정상 동작하는지 확인 필요.\n"
        "- BGM 시작/정지, 효과음 재생, 사운드 ON/OFF 버튼 수동 테스트 필요.\n"
        "- Step 2-23 저장 안정화는 여전히 미완료 상태.\n",
        encoding="utf-8",
    )
    print("[OK] Step 3-2A audio split applied")


if __name__ == "__main__":
    main()
