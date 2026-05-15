#!/usr/bin/env python3
"""
Apply Step 2-3D safely.

Goal:
- Ensure mapGo / mapUnlock buttons exist in the expansion modal.
- Bind each button exactly once with addEventListener.
- Use existing BranchManager.move() and BranchManager.unlockNext() logic.

This script writes index.html only after validation and node --check pass.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")

OLD_MODAL_NOTE = '''    <div style="background:#fff; border-radius:0 0 20px 20px; padding:15px; text-align:center;">
      <p class="note" style="margin:0;">좌우로 스크롤하여 지역을 확인하세요.<br>새 지역 오픈 시 자금이 차감됩니다.</p>
    </div>
'''

NEW_MODAL_NOTE = '''    <div style="background:#fff; border-radius:0 0 20px 20px; padding:15px; text-align:center;">
      <div class="row" style="margin-bottom:10px;">
        <button class="btn alt" id="mapGo" type="button">선택 지역으로 이동 🚀</button>
        <button class="btn" id="mapUnlock" type="button">다음 지역 오픈 🔓</button>
      </div>
      <p class="note" id="mapHint" style="margin:0;">좌우로 스크롤하여 지역을 확인하세요.<br>새 지역 오픈 시 자금이 차감됩니다.</p>
    </div>
'''

BINDING = '''
  const mapGoBtn = document.getElementById("mapGo");
  if(mapGoBtn){
    mapGoBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      const id = state.mapSelected || state.regionId;
      if(typeof BranchManager !== "undefined" && BranchManager.move) BranchManager.move(id);
    });
  }

  const mapUnlockBtn = document.getElementById("mapUnlock");
  if(mapUnlockBtn){
    mapUnlockBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      unlockAudioOnce(); startBGM();
      if(typeof BranchManager !== "undefined" && BranchManager.unlockNext) BranchManager.unlockNext();
    });
  }
'''

ANCHOR = '  const mapWrapEl = document.getElementById("mapWrap");\n'


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def counts(text: str) -> dict:
    return {
        "map_go_id": text.count('id="mapGo"'),
        "map_unlock_id": text.count('id="mapUnlock"'),
        "map_hint_id": text.count('id="mapHint"'),
        "map_go_binding": text.count('mapGoBtn.addEventListener("click"'),
        "map_unlock_binding": text.count('mapUnlockBtn.addEventListener("click"'),
        "branch_move": text.count('BranchManager.move'),
        "branch_unlock": text.count('BranchManager.unlockNext'),
        "render_map": text.count('function renderMapUI()'),
        "map_wrap_binding": text.count('mapWrapEl.addEventListener("click"'),
    }


def print_counts(label: str, data: dict) -> None:
    for k, v in data.items():
        print(f"[{label}] {k}: {v}")


def check_js(text: str) -> None:
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", text, flags=re.S | re.I)
    tmp = Path("/tmp/index-step2-3d-check.js")
    tmp.write_text("\n".join(scripts), encoding="utf-8")
    subprocess.run(["node", "--check", str(tmp)], check=True)
    ok(f"node --check passed for {len(scripts)} script blocks")


def validate_final(text: str) -> None:
    c = counts(text)
    if c["map_go_id"] != 1:
        fail(f"Expected one mapGo button id, found {c['map_go_id']}")
    if c["map_unlock_id"] != 1:
        fail(f"Expected one mapUnlock button id, found {c['map_unlock_id']}")
    if c["map_hint_id"] != 1:
        fail(f"Expected one mapHint id, found {c['map_hint_id']}")
    if c["map_go_binding"] != 1:
        fail(f"Expected one mapGo click binding, found {c['map_go_binding']}")
    if c["map_unlock_binding"] != 1:
        fail(f"Expected one mapUnlock click binding, found {c['map_unlock_binding']}")
    if c["render_map"] != 1:
        fail(f"Expected one renderMapUI function, found {c['render_map']}")
    if c["map_wrap_binding"] != 1:
        fail(f"Expected one mapWrap delegated binding, found {c['map_wrap_binding']}")
    if "move(id){" not in text:
        fail("BranchManager.move implementation is missing")
    if "unlockNext(){" not in text:
        fail("BranchManager.unlockNext implementation is missing")
    check_js(text)


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run from repository root.")

    text = INDEX.read_text(encoding="utf-8")
    before = counts(text)
    print_counts("before", before)

    if before["render_map"] != 1:
        fail(f"Expected exactly one renderMapUI function before patch, found {before['render_map']}")
    if before["map_wrap_binding"] != 1:
        fail(f"Expected Step 2-3C mapWrap binding before Step 2-3D, found {before['map_wrap_binding']}")
    if "move(id){" not in text:
        fail("BranchManager.move implementation not found before patch")
    if "unlockNext(){" not in text:
        fail("BranchManager.unlockNext implementation not found before patch")

    patched = text

    if before["map_go_id"] == 0 and before["map_unlock_id"] == 0:
        if OLD_MODAL_NOTE not in patched:
            fail("Could not find expansion modal note block for inserting map buttons")
        patched = patched.replace(OLD_MODAL_NOTE, NEW_MODAL_NOTE, 1)
    elif before["map_go_id"] == 1 and before["map_unlock_id"] == 1:
        ok("mapGo/mapUnlock buttons already exist. Skipping DOM insertion.")
    else:
        fail(f"Unexpected map button id counts before patch: mapGo={before['map_go_id']}, mapUnlock={before['map_unlock_id']}")

    mid = counts(patched)
    if mid["map_go_binding"] == 0 and mid["map_unlock_binding"] == 0:
        if ANCHOR not in patched:
            fail("Could not find initDOMRefs anchor for adding map button bindings")
        patched = patched.replace(ANCHOR, BINDING + "\n" + ANCHOR, 1)
    elif mid["map_go_binding"] == 1 and mid["map_unlock_binding"] == 1:
        ok("mapGo/mapUnlock bindings already exist. Skipping binding insertion.")
    else:
        fail(f"Unexpected map button binding counts before patch: mapGo={mid['map_go_binding']}, mapUnlock={mid['map_unlock_binding']}")

    after = counts(patched)
    print_counts("after", after)
    validate_final(patched)

    INDEX.write_text(patched, encoding="utf-8")
    ok("Step 2-3D map button events applied to index.html")


if __name__ == "__main__":
    main()
