#!/usr/bin/env python3
"""
Apply Step 2-3E safely.

Goal:
- Align renderMapUI target DOM id with the modal list DOM.
- Ensure openMap button opens modalExpansion and calls renderMapUI().
- Preserve Step 2-3B/C/D event fixes.

This script writes index.html only after validation and node --check pass.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")

OLD_LIST_ID = 'id="expansionList"'
NEW_LIST_ID = 'id="mapWrap"'
ANCHOR = '  const mapGoBtn = document.getElementById("mapGo");\n'

OPEN_BINDING = '''
  const openMapBtn = document.getElementById("openMap");
  const modalExpansionEl = document.getElementById("modalExpansion");
  if(openMapBtn){
    openMapBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      if(modalExpansionEl) modalExpansionEl.classList.add("on");
      renderMapUI();
    });
  }
'''


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def counts(text: str) -> dict:
    return {
        "open_map_id": text.count('id="openMap"'),
        "open_map_binding": text.count('openMapBtn.addEventListener("click"'),
        "modal_expansion_id": text.count('id="modalExpansion"'),
        "modal_expansion_add": text.count('modalExpansionEl.classList.add("on")'),
        "render_map_call": text.count('renderMapUI();'),
        "render_map_func": text.count('function renderMapUI()'),
        "map_wrap_id": text.count('id="mapWrap"'),
        "expansion_list_id": text.count('id="expansionList"'),
        "map_wrap_get": text.count('document.getElementById("mapWrap")'),
        "map_go_id": text.count('id="mapGo"'),
        "map_unlock_id": text.count('id="mapUnlock"'),
        "close_expansion_binding": text.count('closeExpansionModalBtn.addEventListener("click"'),
        "map_wrap_binding": text.count('mapWrapEl.addEventListener("click"'),
    }


def print_counts(label: str, data: dict) -> None:
    for k, v in data.items():
        print(f"[{label}] {k}: {v}")


def check_js(text: str) -> None:
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", text, flags=re.S | re.I)
    tmp = Path("/tmp/index-step2-3e-check.js")
    tmp.write_text("\n".join(scripts), encoding="utf-8")
    subprocess.run(["node", "--check", str(tmp)], check=True)
    ok(f"node --check passed for {len(scripts)} script blocks")


def validate_final(text: str) -> None:
    c = counts(text)
    if c["open_map_id"] != 1:
        fail(f"Expected one openMap id, found {c['open_map_id']}")
    if c["open_map_binding"] != 1:
        fail(f"Expected one openMap click binding, found {c['open_map_binding']}")
    if c["modal_expansion_id"] != 1:
        fail(f"Expected one modalExpansion id, found {c['modal_expansion_id']}")
    if c["modal_expansion_add"] != 1:
        fail(f"Expected one modalExpansion open flow, found {c['modal_expansion_add']}")
    if c["render_map_func"] != 1:
        fail(f"Expected one renderMapUI function, found {c['render_map_func']}")
    if c["map_wrap_id"] != 1:
        fail(f"Expected one mapWrap id, found {c['map_wrap_id']}")
    if c["expansion_list_id"] != 0:
        fail(f"Expected zero expansionList ids after alignment, found {c['expansion_list_id']}")
    if c["map_wrap_get"] < 2:
        fail(f"Expected mapWrap DOM lookups for render and delegation, found {c['map_wrap_get']}")
    if c["map_go_id"] != 1 or c["map_unlock_id"] != 1:
        fail(f"mapGo/mapUnlock button ids invalid: {c['map_go_id']} / {c['map_unlock_id']}")
    if c["close_expansion_binding"] != 1:
        fail(f"Expected closeExpansionModalBtn binding to remain 1, found {c['close_expansion_binding']}")
    if c["map_wrap_binding"] != 1:
        fail(f"Expected mapWrap delegation to remain 1, found {c['map_wrap_binding']}")
    check_js(text)


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run from repository root.")

    text = INDEX.read_text(encoding="utf-8")
    before = counts(text)
    print_counts("before", before)

    if before["render_map_func"] != 1:
        fail(f"Expected exactly one renderMapUI function before patch, found {before['render_map_func']}")
    if before["open_map_id"] != 1:
        fail(f"Expected exactly one openMap button before patch, found {before['open_map_id']}")
    if before["modal_expansion_id"] != 1:
        fail(f"Expected exactly one modalExpansion before patch, found {before['modal_expansion_id']}")
    if before["map_go_id"] != 1 or before["map_unlock_id"] != 1:
        fail("Step 2-3D map buttons must exist before Step 2-3E")
    if before["close_expansion_binding"] != 1:
        fail("Step 2-3B close expansion binding must exist before Step 2-3E")

    patched = text

    if before["map_wrap_id"] == 0 and before["expansion_list_id"] == 1:
        patched = patched.replace(OLD_LIST_ID, NEW_LIST_ID, 1)
    elif before["map_wrap_id"] == 1 and before["expansion_list_id"] == 0:
        ok("mapWrap id already aligned. Skipping id replacement.")
    else:
        fail(f"Unexpected mapWrap/expansionList id counts: mapWrap={before['map_wrap_id']}, expansionList={before['expansion_list_id']}")

    mid = counts(patched)
    if mid["open_map_binding"] == 0:
        if ANCHOR not in patched:
            fail("Could not find initDOMRefs anchor for adding openMap binding")
        patched = patched.replace(ANCHOR, OPEN_BINDING + "\n" + ANCHOR, 1)
    elif mid["open_map_binding"] == 1:
        ok("openMap binding already exists. Skipping binding insertion.")
    else:
        fail(f"Unexpected openMap binding count before patch: {mid['open_map_binding']}")

    after = counts(patched)
    print_counts("after", after)
    validate_final(patched)

    INDEX.write_text(patched, encoding="utf-8")
    ok("Step 2-3E open map flow applied to index.html")


if __name__ == "__main__":
    main()
