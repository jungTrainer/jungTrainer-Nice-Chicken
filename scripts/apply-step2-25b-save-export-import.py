#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-25b-save-export-import.md")

EXPORT_IMPORT_CODE = r'''
function exportSaveData(){
  try{
    const payload = {
      app: "niceChicken",
      type: "manual-save-export",
      version: 1,
      saveKey: SAVE_KEY,
      exportedAt: Date.now(),
      data: state
    };
    return JSON.stringify(payload, null, 2);
  }catch(e){
    console.error("[save-export] failed", e);
    return "";
  }
}

function isLikelyNiceChickenState(data){
  if(!data || typeof data !== "object") return false;
  const hasMoney = typeof data.money === "number";
  const hasLevel = typeof data.level === "number";
  const hasCoreObjects = !!data.upgrades && !!data.research && !!data.menuStats;
  return hasMoney && hasLevel && hasCoreObjects;
}

function importSaveData(raw){
  if(!raw || !String(raw).trim()){
    showToast("불러올 백업 JSON을 붙여넣어 주세요.");
    return false;
  }

  let parsed;
  try{
    parsed = JSON.parse(String(raw));
  }catch(e){
    console.error("[save-import] invalid json", e);
    showToast("백업 JSON 형식이 올바르지 않아요.");
    return false;
  }

  const imported = (parsed && parsed.app === "niceChicken" && parsed.data) ? parsed.data : parsed;
  if(!isLikelyNiceChickenState(imported)){
    showToast("나이스치킨 저장 데이터가 아닌 것 같아요.");
    return false;
  }

  if(!confirm("현재 저장 데이터를 가져온 백업으로 덮어쓸까요?\n기존 진행 상황이 바뀔 수 있습니다.")){
    return false;
  }

  try{
    state = { ...defaultState(), ...imported };
    sanitizeState();
    const ok = save(true);
    updateUI();
    updateStatsUI();
    if(typeof buildMenuGrid === "function") buildMenuGrid();
    if(typeof renderPanel === "function") renderPanel("upg");
    showToast(ok ? "백업 불러오기 완료" : "불러오기는 완료됐지만 저장에 실패했어요.");
    return ok;
  }catch(e){
    console.error("[save-import] failed", e);
    showToast("백업 불러오기에 실패했어요.");
    return false;
  }
}

function ensureSaveTransferUI(){
  const modal = document.getElementById("modalSettings");
  const box = modal ? modal.querySelector(".modal") : null;
  if(!box || document.getElementById("saveTransferBox")) return;

  const card = document.createElement("div");
  card.className = "card";
  card.id = "saveTransferBox";
  card.style.cssText = "margin:10px 0; flex-direction:column; align-items:stretch; gap:8px;";
  card.innerHTML = `
    <div class="info" style="width:100%;">
      <h4 style="margin:0;">💾 수동 백업 / 불러오기</h4>
      <p style="margin-top:5px;">저장 데이터를 복사해 보관하거나, 백업 JSON을 붙여넣어 복구합니다.</p>
    </div>
    <textarea id="saveTransferText" rows="5" placeholder="백업 JSON이 여기에 표시되거나, 불러올 JSON을 붙여넣으세요." style="width:100%; box-sizing:border-box; resize:vertical; font-size:12px;"></textarea>
    <div class="row">
      <button class="btn alt" id="exportSaveBtn">백업 만들기</button>
      <button class="btn gray" id="copySaveBtn">복사</button>
    </div>
    <div class="row">
      <button class="btn" id="importSaveBtn">백업 불러오기</button>
      <button class="btn gray" id="clearSaveTransferBtn">내용 지우기</button>
    </div>
    <div class="note">※ 다른 기기/브라우저로 옮길 때는 백업 만들기 → 복사 → 별도 메모장에 보관하세요.</div>
  `;

  const note = box.querySelector(".note");
  if(note) box.insertBefore(card, note);
  else box.appendChild(card);

  const text = card.querySelector("#saveTransferText");
  const exportBtn = card.querySelector("#exportSaveBtn");
  const copyBtn = card.querySelector("#copySaveBtn");
  const importBtn = card.querySelector("#importSaveBtn");
  const clearBtn = card.querySelector("#clearSaveTransferBtn");
  const bind = (el, evt, fn) => {
    if(typeof safeOn === "function") safeOn(el, evt, fn);
    else if(el && typeof el.addEventListener === "function") el.addEventListener(evt, fn);
  };

  bind(exportBtn, "click", ()=>{
    const raw = exportSaveData();
    if(!raw){ showToast("백업 생성에 실패했어요."); return; }
    text.value = raw;
    text.focus();
    text.select();
    showToast("백업 JSON을 만들었어요.");
  });

  bind(copyBtn, "click", async ()=>{
    if(!text.value.trim()){
      text.value = exportSaveData();
    }
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text.value);
      }else{
        text.focus();
        text.select();
        document.execCommand("copy");
      }
      showToast("백업 JSON을 복사했어요.");
    }catch(e){
      console.error("[save-export] clipboard failed", e);
      text.focus();
      text.select();
      showToast("복사 실패! 직접 전체 선택 후 복사해 주세요.");
    }
  });

  bind(importBtn, "click", ()=>{
    importSaveData(text.value);
  });

  bind(clearBtn, "click", ()=>{
    text.value = "";
    showToast("백업 입력창을 비웠어요.");
  });
}
'''


def fail(msg):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def func_decl_count(text, name):
    return len(re.findall(rf"\bfunction\s+{re.escape(name)}\s*\(", text))


def actual_safe_click_count(js):
    return sum(1 for line in js.splitlines() if "safeClick(" in line and not line.strip().startswith("function safeClick"))


def verify(js):
    required = {
        "exportSaveData": func_decl_count(js, "exportSaveData"),
        "importSaveData": func_decl_count(js, "importSaveData"),
        "ensureSaveTransferUI": func_decl_count(js, "ensureSaveTransferUI"),
        "SAVE_KEY": js.count('const SAVE_KEY = "niceChicken_idleServe_vFinal";'),
        "SAVE_BACKUP_KEY": js.count('const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";'),
        "readSavePayload": func_decl_count(js, "readSavePayload"),
        "ensure_call": js.count("ensureSaveTransferUI();"),
        "export_button": js.count('id="exportSaveBtn"'),
        "import_button": js.count('id="importSaveBtn"'),
        "safeOn_usage": js.count('typeof safeOn === "function"'),
        "direct_onclick": len(re.findall(r"\.onclick\s*=", js)),
        "function_safeClick": func_decl_count(js, "safeClick"),
        "safeClick_actual": actual_safe_click_count(js),
    }
    bad = {k:v for k,v in required.items() if (
        (k in ["direct_onclick", "function_safeClick", "safeClick_actual"] and v != 0) or
        (k not in ["direct_onclick", "function_safeClick", "safeClick_actual"] and v != 1)
    )}
    if bad:
        fail(f"verification failed: {bad}")


def main():
    if not MAIN.exists():
        fail("js/main.js not found")
    js = MAIN.read_text(encoding="utf-8")

    # Preflight: storage layers must exist.
    for marker in [
        'const SAVE_KEY = "niceChicken_idleServe_vFinal";',
        'const SAVE_BACKUP_KEY = SAVE_KEY + "_backup";',
        'function readSavePayload()',
        'function save(force=false)',
        'function bindSaveLifecycleEvents()',
    ]:
        if js.count(marker) != 1:
            fail(f"required storage marker invalid: {marker} count={js.count(marker)}")

    if func_decl_count(js, "exportSaveData") or func_decl_count(js, "importSaveData") or func_decl_count(js, "ensureSaveTransferUI"):
        fail("export/import functions already exist; refusing to reapply")

    if len(re.findall(r"\.onclick\s*=", js)) != 0:
        fail(".onclick must remain 0 before patch")
    if func_decl_count(js, "safeClick") != 0 or actual_safe_click_count(js) != 0:
        fail("safeClick must remain 0 before patch")

    anchor = "function load(){"
    if js.count(anchor) != 1:
        fail(f"expected function load anchor exactly 1, found {js.count(anchor)}")
    patched = js.replace(anchor, EXPORT_IMPORT_CODE + "\n" + anchor, 1)

    call_anchor = "    initDOMRefs();\n  bindSaveLifecycleEvents();"
    if call_anchor not in patched:
        fail("DOMContentLoaded initDOMRefs/bindSaveLifecycleEvents anchor not found")
    patched = patched.replace(call_anchor, call_anchor + "\n    ensureSaveTransferUI();", 1)

    verify(patched)
    MAIN.write_text(patched, encoding="utf-8")
    subprocess.run(["node", "--check", str(MAIN)], check=True)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-25B 수동 백업 Export/Import 적용 보고\n\n"
        "작성일: 2026-05-15\n\n"
        "## 변경 내용\n\n"
        "- `exportSaveData()`를 추가했다.\n"
        "- `importSaveData(raw)`를 추가했다.\n"
        "- `ensureSaveTransferUI()`를 추가해 설정 모달에 백업/불러오기 UI를 동적으로 삽입한다.\n"
        "- `index.html`은 수정하지 않았다.\n"
        "- 이벤트는 `safeOn` 또는 `addEventListener`로만 바인딩한다.\n"
        "- export는 현재 `state`를 JSON 문자열로 생성한다.\n"
        "- import는 JSON parse, 나이스치킨 저장 데이터 검증, confirm 확인 후 `state`에 반영한다.\n"
        "- import 성공 시 `sanitizeState()`, `save(true)`, `updateUI()`, `updateStatsUI()`를 호출한다.\n\n"
        "## 유지한 내용\n\n"
        "- `SAVE_KEY` 유지\n"
        "- `SAVE_BACKUP_KEY` 유지\n"
        "- `readSavePayload()` 유지\n"
        "- `save()` / `load()` / `saveGame()` 구조 유지\n"
        "- inline `onclick=` 추가 없음\n"
        "- `.onclick =` 직접 대입 추가 없음\n\n"
        "## 검증\n\n"
        "- `exportSaveData()` 1개\n"
        "- `importSaveData(raw)` 1개\n"
        "- `ensureSaveTransferUI()` 1개\n"
        "- 설정 모달 동적 UI 추가\n"
        "- `node --check js/main.js` 통과\n\n"
        "## 남은 리스크\n\n"
        "- 브라우저에서 textarea 복사/붙여넣기 UX 확인 필요\n"
        "- 모바일 Safari clipboard 권한 제한 확인 필요\n"
        "- 잘못된 JSON/타 게임 JSON/import 취소 시나리오 QA 필요\n",
        encoding="utf-8"
    )
    print("[OK] Step 2-25B save export/import patch applied")


if __name__ == "__main__":
    main()
