#!/usr/bin/env python3
"""
Apply Step 2-3B safely in Codespaces or local git.

Goal:
- Remove inline onclick from the expansion modal close button.
- Add id-based event binding for closeExpansionModalBtn.

This script only edits index.html and exits without writing if validation fails.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")

OLD_BUTTON = '<button class="closeBtn" onclick="closeExpansionModal()">✕</button>'
NEW_BUTTON = '<button class="closeBtn" id="closeExpansionModalBtn" type="button">✕</button>'
BINDING = '''
  const closeExpansionModalBtn = document.getElementById("closeExpansionModalBtn");
  if(closeExpansionModalBtn){
    closeExpansionModalBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(typeof closeExpansionModal === "function") closeExpansionModal();
      else document.getElementById("modalExpansion")?.classList.remove("on");
    }, {passive:false});
  }
'''
ANCHOR = "  // 5. Canvas 설정"


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def count_report(text: str, label: str) -> None:
    print(f"[{label}] onclick count:", text.count('onclick="closeExpansionModal()"'))
    print(f"[{label}] id count:", text.count('id="closeExpansionModalBtn"'))
    print(f"[{label}] binding count:", text.count('closeExpansionModalBtn.addEventListener("click"'))
    print(f"[{label}] function count:", text.count('function closeExpansionModal('))


def check_js(text: str) -> None:
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", text, flags=re.S | re.I)
    tmp = Path("/tmp/index-step2-3b-check.js")
    tmp.write_text("\n".join(scripts), encoding="utf-8")
    subprocess.run(["node", "--check", str(tmp)], check=True)
    ok(f"node --check passed for {len(scripts)} script blocks")


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run this script from the repository root.")

    text = INDEX.read_text(encoding="utf-8")
    count_report(text, "before")

    before_func = text.count('function closeExpansionModal(')
    if before_func != 1:
        fail(f"Expected exactly one closeExpansionModal function before patch, found {before_func}")

    inline_count = text.count('onclick="closeExpansionModal()"')
    id_count = text.count('id="closeExpansionModalBtn"')
    binding_count = text.count('closeExpansionModalBtn.addEventListener("click"')

    if inline_count == 0 and id_count == 1 and binding_count == 1:
        ok("Step 2-3B already appears to be applied. Running final validation only.")
        check_js(text)
        return

    if inline_count != 1:
        fail(f"Expected exactly one inline closeExpansionModal onclick before patch, found {inline_count}")
    if id_count != 0:
        fail(f"Expected zero closeExpansionModalBtn ids before patch, found {id_count}")
    if binding_count != 0:
        fail(f"Expected zero closeExpansionModalBtn bindings before patch, found {binding_count}")
    if OLD_BUTTON not in text:
        fail("Expected old close button markup was not found exactly.")

    patched = text.replace(OLD_BUTTON, NEW_BUTTON, 1)

    if ANCHOR not in patched:
        fail(f"Could not find anchor for event binding: {ANCHOR}")

    patched = patched.replace(ANCHOR, BINDING + "\n" + ANCHOR, 1)

    after_inline = patched.count('onclick="closeExpansionModal()"')
    after_id = patched.count('id="closeExpansionModalBtn"')
    after_binding = patched.count('closeExpansionModalBtn.addEventListener("click"')
    after_func = patched.count('function closeExpansionModal(')

    count_report(patched, "after")

    if after_inline != 0:
        fail(f"inline onclick remains after patch: {after_inline}")
    if after_id != 1:
        fail(f"Expected one closeExpansionModalBtn id after patch, found {after_id}")
    if after_binding != 1:
        fail(f"Expected one closeExpansionModalBtn binding after patch, found {after_binding}")
    if after_func != 1:
        fail(f"Expected one closeExpansionModal function after patch, found {after_func}")

    check_js(patched)
    INDEX.write_text(patched, encoding="utf-8")
    ok("Step 2-3B patch applied to index.html")
    ok("Next: git diff -- index.html, then git add/commit/push if the diff is correct")


if __name__ == "__main__":
    main()
