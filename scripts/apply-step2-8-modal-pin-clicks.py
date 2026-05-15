#!/usr/bin/env python3
"""
Step 2-8: convert modal/settings/PIN close handlers from .onclick to addEventListener.

Scope is intentionally limited to 5 handlers:
- closeSettingsBtn
- closeCouponsBtn
- closeExchangeBtn
- pinCancelBtn
- pinOkBtn
"""

from pathlib import Path
import re
import subprocess
import sys

INDEX = Path("index.html")
MAIN = Path("js/main.js")
REPORT = Path("docs/2026-05-15-step2-8-modal-pin-click-cleanup.md")

REPLACEMENTS = {
    'if(closeSettingsBtn) closeSettingsBtn.onclick = ()=> modalSettings && modalSettings.classList.remove("on");':
    '''if(closeSettingsBtn){
    closeSettingsBtn.addEventListener("click", ()=> modalSettings && modalSettings.classList.remove("on"));
  }''',

    'if(closeCouponsBtn) closeCouponsBtn.onclick = ()=> modalCoupons && modalCoupons.classList.remove("on");':
    '''if(closeCouponsBtn){
    closeCouponsBtn.addEventListener("click", ()=> modalCoupons && modalCoupons.classList.remove("on"));
  }''',

    'if(closeExchangeBtn) closeExchangeBtn.onclick = ()=> modalExchange && modalExchange.classList.remove("on");':
    '''if(closeExchangeBtn){
    closeExchangeBtn.addEventListener("click", ()=> modalExchange && modalExchange.classList.remove("on"));
  }''',

    '''if(pinCancelBtn) pinCancelBtn.onclick = ()=>{
    if(modalPin) modalPin.classList.remove("on");
    if(pinResolver){ pinResolver(false); pinResolver = null; }
  };''':
    '''if(pinCancelBtn){
    pinCancelBtn.addEventListener("click", ()=>{
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(false); pinResolver = null; }
    });
  }''',

    '''if(pinOkBtn) pinOkBtn.onclick = ()=>{
    const ok = (pinInput && pinInput.value === CONFIG.pin);
    if(modalPin) modalPin.classList.remove("on");
    if(pinResolver){ pinResolver(ok); pinResolver = null; }
  };''':
    '''if(pinOkBtn){
    pinOkBtn.addEventListener("click", ()=>{
      const ok = (pinInput && pinInput.value === CONFIG.pin);
      if(modalPin) modalPin.classList.remove("on");
      if(pinResolver){ pinResolver(ok); pinResolver = null; }
    });
  }'''
}

TARGET_ONCLICK_PATTERNS = [
    "closeSettingsBtn.onclick",
    "closeCouponsBtn.onclick",
    "closeExchangeBtn.onclick",
    "pinCancelBtn.onclick",
    "pinOkBtn.onclick",
]

TARGET_EVENT_PATTERNS = [
    'closeSettingsBtn.addEventListener("click"',
    'closeCouponsBtn.addEventListener("click"',
    'closeExchangeBtn.addEventListener("click"',
    'pinCancelBtn.addEventListener("click"',
    'pinOkBtn.addEventListener("click"',
]

PRESERVE_EVENT_PATTERNS = [
    'openMapBtn.addEventListener("click"',
    'mapGoBtn.addEventListener("click"',
    'mapUnlockBtn.addEventListener("click"',
    'closeExpansionModalBtn.addEventListener("click"',
]


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    sys.exit(1)


def ok(message: str) -> None:
    print(f"[OK] {message}")


def read_texts():
    if not INDEX.exists() or not MAIN.exists():
        fail("index.html or js/main.js missing")
    return INDEX.read_text(encoding="utf-8"), MAIN.read_text(encoding="utf-8")


def direct_onclick_count(js: str) -> int:
    return len(re.findall(r"\.onclick\s*=", js))


def inline_onclick_count(index: str, js: str) -> int:
    return len(re.findall(r"\sonclick\s*=", index + "\n" + js, flags=re.I))


def node_check():
    subprocess.run(["node", "--check", str(MAIN)], check=True)
    ok("node --check js/main.js passed")


def validate(index: str, js: str):
    if inline_onclick_count(index, js) != 0:
        fail(f"inline onclick must remain 0, found {inline_onclick_count(index, js)}")
    for pattern in TARGET_ONCLICK_PATTERNS:
        if pattern in js:
            fail(f"target .onclick remains: {pattern}")
    for pattern in TARGET_EVENT_PATTERNS:
        count = js.count(pattern)
        if count != 1:
            fail(f"expected one target addEventListener for {pattern}, found {count}")
    for pattern in PRESERVE_EVENT_PATTERNS:
        count = js.count(pattern)
        if count != 1:
            fail(f"preserved event missing or duplicated: {pattern} count={count}")
    node_check()


def main():
    index, js = read_texts()
    before_direct = direct_onclick_count(js)
    before_inline = inline_onclick_count(index, js)
    print(f"[before] inline onclick: {before_inline}")
    print(f"[before] direct .onclick: {before_direct}")

    patched = js
    for old, new in REPLACEMENTS.items():
        if old not in patched:
            fail(f"target block not found: {old[:80]}")
        patched = patched.replace(old, new, 1)

    MAIN.write_text(patched, encoding="utf-8")
    index2, js2 = read_texts()
    after_direct = direct_onclick_count(js2)
    after_inline = inline_onclick_count(index2, js2)
    print(f"[after] inline onclick: {after_inline}")
    print(f"[after] direct .onclick: {after_direct}")

    if after_direct != before_direct - 5:
        fail(f"expected direct .onclick count to decrease by 5, before={before_direct}, after={after_direct}")

    validate(index2, js2)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Step 2-8 Modal/PIN Click Cleanup\n\n"
        "작성일: 2026-05-15\n\n"
        "## 결과\n\n"
        "- 모달/설정/PIN 계열 `.onclick =` 직접 대입 5개를 `addEventListener`로 전환했다.\n"
        "- 대상: `closeSettingsBtn`, `closeCouponsBtn`, `closeExchangeBtn`, `pinCancelBtn`, `pinOkBtn`.\n"
        "- 기존 openMap / mapGo / mapUnlock / closeExpansionModalBtn 이벤트는 유지했다.\n\n"
        "## 검증\n\n"
        f"- inline onclick: {after_inline}\n"
        f"- `.onclick =` 직접 대입: {before_direct} → {after_direct}\n"
        "- 대상 5개 `.onclick =` 제거\n"
        "- 대상 5개 `addEventListener(\"click\")` 추가\n"
        "- `node --check js/main.js` 통과\n\n"
        "## 브라우저 확인 필요\n\n"
        "1. 설정 닫기\n"
        "2. 쿠폰 모달 닫기\n"
        "3. 교환 모달 닫기\n"
        "4. PIN 취소\n"
        "5. PIN 확인\n",
        encoding="utf-8",
    )
    ok(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
