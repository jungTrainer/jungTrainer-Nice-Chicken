// Computed Chromium styles, not source-string checks. Gradients/assets need separate visual review.
function auditSurface(root = document.body) {
  const result={smallText:[],smallTargets:[],lowContrast:[]};
  const visible=e=>e.checkVisibility({checkVisibilityCSS:true})&&!!e.getClientRects().length;
  const label=e=>e.id||e.className||e.tagName;
  const rgb=s=>s.match(/[\d.]+/g)?.map(Number);
  const blend=(fg,bg)=>{const a=fg[3]??1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a));};
  const luminance=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode,e=node.parentElement,text=node.textContent.trim();
    if(!text||!visible(e)||e.closest('script,style'))continue;
    const style=getComputedStyle(e),font=parseFloat(style.fontSize);
    if(font<14)result.smallText.push({element:label(e),font,text:text.slice(0,35)});
    const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);
    let bg=[255,255,255],complex=false;
    for(const p of chain){const s=getComputedStyle(p);if(s.backgroundImage!=='none'||Number(s.opacity)<1)complex=true;const color=rgb(s.backgroundColor);if(color)bg=blend(color,bg);}
    if(complex)continue;
    const color=rgb(style.color);if(!color)continue;const fg=blend(color,bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const minimum=font>=24||(font>=18.66&&Number(style.fontWeight)>=700)?3:4.5;
    if(ratio+1e-6<minimum)result.lowContrast.push({element:label(e),ratio,text:text.slice(0,35),color:style.color,bg});
  }
  for(const e of root.querySelectorAll('button,summary,input:not([type="checkbox"]):not([type="radio"]),select,a[href],[role="button"]')){
    if(!visible(e))continue;const b=e.getBoundingClientRect();
    if(b.width<43.99||b.height<43.99)result.smallTargets.push({element:label(e),width:b.width,height:b.height});
  }
  return result;
}
module.exports={auditSurface};
