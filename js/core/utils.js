/* Step 3-3E: Utility helpers split candidate.
   Classic script global helpers. */

function fmtKoreanUnits(n, addWon=true){
  if (n === null || n === undefined) return addWon ? "0원" : "0";
  let val;
  try{
    if (typeof n === "number"){
      if (!isFinite(n)) return "무한";
      if (Math.abs(n) < 10000) return (Math.floor(n).toLocaleString("ko-KR") + (addWon ? "원" : ""));
      val = BigInt(Math.floor(n));
    } else {
      val = BigInt(n);
      if (val < 10000n) return (val.toString() + (addWon ? "원" : ""));
    }
  }catch(e){
    return addWon ? "0원" : "0";
  }

  if (val <= 0n) return addWon ? "0원" : "0";

  const units = [
    {v: 10000n, s: "만"}, {v: 100000000n, s: "억"}, {v: 1000000000000n, s: "조"},
    {v: 10000000000000000n, s: "경"}, {v: 100000000000000000000n, s: "해"},
    {v: 1000000000000000000000000n, s: "자"}, {v: 10000000000000000000000000000n, s: "양"},
    {v: 100000000000000000000000000000000n, s: "구"}, {v: 1000000000000000000000000000000000000n, s: "간"},
    {v: 10000000000000000000000000000000000000000n, s: "정"}, {v: 100000000000000000000000000000000000000000000n, s: "재"},
    {v: 1000000000000000000000000000000000000000000000000n, s: "극"},
    {v: 10000000000000000000000000000000000000000000000000000n, s: "항하사"},
    {v: 100000000000000000000000000000000000000000000000000000000n, s: "아승기"},
    {v: 1000000000000000000000000000000000000000000000000000000000000n, s: "나유타"},
    {v: 10000000000000000000000000000000000000000000000000000000000000000n, s: "불가사의"},
    {v: 100000000000000000000000000000000000000000000000000000000000000000000n, s: "무량대수"}
  ];

  for (let i = units.length - 1; i >= 0; i--){
    const u = units[i];
    if (val >= u.v){
      const intPart = val / u.v;
      const decPart = (val % u.v) * 100n / u.v;
      let str = intPart.toString();
      if (decPart > 0n){
        str += "." + decPart.toString().padStart(2, "0").replace(/0+$/, "");
      }
      return str + u.s + (addWon ? "원" : "");
    }
  }
  return val.toString() + (addWon ? "원" : "");
}

function fmtWon(n){ return fmtKoreanUnits(n, true); }
function fmtNoWon(n){ return fmtKoreanUnits(n, false); }
function fmtCompactWon(n){ return fmtNoWon(n); }
function fmtCompact(n){ return fmtNoWon(n); }

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function clampInt(v,min,max){ return Math.max(min, Math.min(max, Math.floor(v))); }
function dayKey(ts=Date.now()){
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowK(){
  return new Date().toLocaleString("ko-KR");
}
function isHangulOnly(s){
  if(s === "") return true;
  return /^[가-힣]{1,10}$/.test(s);
}

function safeOn(el, evt, fn, opts){
  if(el && typeof el.addEventListener === "function") el.addEventListener(evt, fn, opts);
}
function _bindSafe(el, evt, fn, opts){ return safeOn(el, evt, fn, opts); }
