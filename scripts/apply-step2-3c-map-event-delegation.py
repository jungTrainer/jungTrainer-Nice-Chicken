#!/usr/bin/env python3
"""
Apply Step 2-3C safely.

Goal:
- Replace map node direct onclick assignment in renderMapUI() with data attributes.
- Add one delegated click handler on #mapWrap.

This script only writes index.html after all validations pass.
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")

OLD_BLOCK = '''    node.className = "map-node" + (unlocked ? "" : " locked") + (r.id===selId ? " active":"");
    node.onclick = ()=>{
      state.mapSelected = r.id;
      renderMapUI();
    };
'''

NEW_BLOCK = '''    node.className = "map-node" + (unlocked ? "" : " locked") + (r.id===selId ? " active":"");
    node.dataset.action = "select-region";
    node.dataset.regionId = r.id;
'''

BINDING = '''
  const mapWrapEl = document.getElementById("mapWrap");
  if(mapWrapEl){
    mapWrapEl.addEventListener("click", (e)=>{
      const node = e.target.closest('.map-node[data-action="select-region"]');
      if(!node || !mapWrapEl.contains(node)) return;
      const id = node.dataset.regionId;
      if(!id) return;
      state.mapSelected = id;
      renderMapUI();
    });
  }
'''

ANCHOR = '  const closeExpansionModalBtn = document.getElementById("closeExpansionModalBtn");\n'


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def counts(text: str) -> dict:
    return {
        "node_onclick": text.count("node.onclick = ()=>{"),
        "data_action": text.count('node.dataset.action = "select-region";'),
        "data_region": text.count('node.dataset.regionId = r.id;'),
        "map_binding": text.count('mapWrapEl.addEventListener("click"'),
        "render_map": text.count("function renderMapUI()"),
    }


def print_counts(label: str, data: dict) -> None:
    print(f"[{label}] node.onclick count:", data["node_onclick"])
    print(f"[{label}] data-action count:", data["data_action"])
    print(f"[{label}] data-region count:", data["data_region"])
    print(f"[{label}] mapWrap binding count:", data["map_binding"])
    print(f"[{label}] renderMapUI count:", data["render_map"])


def check_js(text: str) -> None:
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", text, flags=re.S | re.I)
    tmp = Path("/tmp/index-step2-3c-check.js")
    tmp.write_text("\n".join(scripts), encoding="utf-8")
    subprocess.run(["node", "--check", str(tmp)], check=True)
    ok(f"node --check passed for {len(scripts)} script blocks")


def validate_final(text: str) -> None:
    c = counts(text)
    if c["node_onclick"] != 0:
        fail(f"node onclick remains: {c['node_onclick']}")
    if c["data_action"] != 1:
        fail(f"Expected one select-region data-action, found {c['data_action']}")
    if c["data_region"] != 1:
        fail(f"Expected one regionId dataset assignment, found {c['data_region']}")
    if c["map_binding"] != 1:
        fail(f"Expected one mapWrap delegated binding, found {c['map_binding']}")
    if c["render_map"] != 1:
        fail(f"Expected one renderMapUI function, found {c['render_map']}")
    check_js(text)


def main() -> None:
    if not INDEX.exists():
        fail("index.html not found. Run this script from the repository root.")

    text = INDEX.read_text(encoding="utf-8")
    before = counts(text)
    print_counts("before", before)

    if before["render_map"] != 1:
        fail(f"Expected exactly one renderMapUI function before patch, found {before['render_map']}")

    if before["node_onclick"] == 0 and before["data_action"] == 1 and before["data_region"] == 1 and before["map_binding"] == 1:
        ok("Step 2-3C already appears to be applied. Running final validation only.")
        validate_final(text)
        return

    if before["node_onclick"] != 1:
        fail(f"Expected exactly one map node onclick before patch, found {before['node_onclick']}")
    if before["data_action"] != 0:
        fail(f"Expected zero select-region data-action before patch, found {before['data_action']}")
    if before["data_region"] != 0:
        fail(f"Expected zero regionId dataset assignments before patch, found {before['data_region']}")
    if before["map_binding"] != 0:
        fail(f"Expected zero mapWrap delegated bindings before patch, found {before['map_binding']}")
    if OLD_BLOCK not in text:
        fail("Expected map node onclick block was not found exactly.")
    if ANCHOR not in text:
        fail("Could not find initDOMRefs anchor for adding mapWrap delegation.")

    patched = text.replace(OLD_BLOCK, NEW_BLOCK, 1)
    patched = patched.replace(ANCHOR, BINDING + "\n" + ANCHOR, 1)

    after = counts(patched)
    print_counts("after", after)
    validate_final(patched)

    INDEX.write_text(patched, encoding="utf-8")
    ok("Step 2-3C map event delegation patch applied to index.html")


if __name__ == "__main__":
    main()
