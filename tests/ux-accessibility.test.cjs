const assert=require('node:assert/strict');
const {test}=require('node:test');
const {harness}=require('./helpers/game.cjs');
const {auditSurface}=require('./helpers/ux-accessibility.cjs');
const {game,fixture}=harness();
const sizes=[{width:360,height:640},{width:390,height:844},{width:640,height:360}];
const stable=p=>p.waitForFunction(()=>state.customers.length>0,null,{polling:50});
const snapshot=p=>p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty}));
async function audit(p){await p.waitForFunction(()=>[...document.querySelectorAll('.tab-content.active')].every(e=>!e.checkVisibility({checkVisibilityCSS:true})||Number(getComputedStyle(e).opacity)===1),null,{polling:20});assert.deepEqual(await p.evaluate(auditSurface),{smallText:[],smallTargets:[],lowContrast:[]});}
async function reachable(p,selector){
 const e=p.locator(selector);await e.scrollIntoViewIfNeeded();
 const b=await e.boundingBox(),v=p.viewportSize();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,JSON.stringify({selector,b,v}));
 assert.equal(await e.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,selector+' hit target');
}
async function trap(p,id){
 // A real keyboard traversal must stay in the current surface (panels also own navigation).
 for(let i=0;i<8;i++){await p.keyboard.press('Tab');assert.equal(await p.evaluate(id=>{const root=document.querySelector(id);return root.contains(document.activeElement)||(root.classList.contains('panel')&&document.querySelector('nav').contains(document.activeElement));},id),true);}
 for(let i=0;i<8;i++){await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(id=>{const root=document.querySelector(id);return root.contains(document.activeElement)||(root.classList.contains('panel')&&document.querySelector('nav').contains(document.activeElement));},id),true);}
}
for(const viewport of sizes){
 test(`${viewport.width}x${viewport.height}: all panels keep 14px text, 44px targets, solid-text contrast and keyboard/scroll/close access`,async()=>game(fixture({money:1e12,endingUnlocked:true,endingPrompted:true}),async p=>{
  await stable(p);
  for(const key of ['upg','res','mis','shr']){
   await p.locator(`[data-panel="${key}"]`).tap();
   await p.waitForFunction(k=>getComputedStyle(document.getElementById('panel-'+k)).transform==='matrix(1, 0, 0, 1, 0, 0)',key,{polling:20});
   await audit(p);await trap(p,'#panel-'+key);
   await p.locator(`#panel-${key} .scroll`).evaluate(e=>e.scrollTop=e.scrollHeight);
   await reachable(p,`#panel-${key} .closeBtn`);await p.locator(`#panel-${key} .closeBtn`).tap();
   assert.equal(await p.evaluate(()=>document.activeElement.dataset.panel),key);
  }
 },{viewport}));
 test(`${viewport.width}x${viewport.height}: settings, guide, map, report, coupons and exchange close above scrolled content`,async()=>game(fixture({money:1e12,endingUnlocked:true,endingPrompted:true}),async p=>{
  await stable(p);
  for(const opener of ['openSettings','openMap','openStats']){
   await p.locator('#'+opener).tap();const id={openSettings:'modalSettings',openMap:'modalExpansion',openStats:'modalStats'}[opener];
   await audit(p);await trap(p,'#'+id);await p.locator(`#${id} .modal`).evaluate(e=>e.scrollTop=e.scrollHeight);
   await reachable(p,`#${id} .ui-modal-head .closeBtn`);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),opener);
  }
  for(const [opener,id] of [['openGameGuide','modalGameGuide'],['openCoupons','modalCoupons'],['openExchange','modalExchange']]){
   await p.locator('#openSettings').tap();await p.locator('#'+opener).tap();await audit(p);await trap(p,'#'+id);
   await p.locator(`#${id} .modal`).evaluate(e=>e.scrollTop=e.scrollHeight);await reachable(p,`#${id} .ui-modal-head .closeBtn`);
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),opener);await p.keyboard.press('Escape');
  }
 },{viewport}));
}
for(const money of [0,1e12])test(`actual ${money?'affordable':'unaffordable'} controls share distinct accessible action, danger and disabled palettes`,async()=>game(fixture({money}),async p=>{
 await stable(p);await p.locator('[data-panel="upg"]').tap();await p.waitForFunction(()=>getComputedStyle(document.getElementById('panel-upg')).transform==='matrix(1, 0, 0, 1, 0, 0)',null,{polling:20});await audit(p);
 const button=p.locator('[data-upgrade-id="signboard"]').locator('..').locator('button');assert.equal(await button.isDisabled(),!money);
 await p.keyboard.press('Escape');await p.locator('#openSettings').tap();
 const colors=await p.evaluate(()=>Object.fromEntries(['forceSave','resetAll','openCoupons','applyPwaUpdate'].map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return [id,[s.backgroundColor,s.color,s.opacity,e.disabled]];})));
 assert.equal(new Set(Object.values(colors).map(c=>c[0])).size,4);assert.equal(colors.applyPwaUpdate[2],'1');assert.equal(colors.applyPwaUpdate[3],true);await audit(p);
}));
for(const width of [360,390]){
 test(`${width}px new-name field stays usable in a reduced viewport without choosing mode or awarding on close`,async()=>game(null,async p=>{
  await p.locator('#nameInput').tap();await p.locator('#nameInput').fill('방문확인');
  await p.setViewportSize({width,height:320});await reachable(p,'#nameInput');await reachable(p,'#modalProfile .closeBtn');await audit(p);
  const before=await p.evaluate(()=>({name:state.profile.name,mode:state.campaign.mode,ledger:JSON.stringify(state.couponLedger)}));await p.keyboard.press('Escape');
  assert.deepEqual(await p.evaluate(()=>({name:state.profile.name,mode:state.campaign.mode,ledger:JSON.stringify(state.couponLedger)})),before);
 },{viewport:{width,height:700}}));
 test(`${width}px focused backup field survives actual viewport resize above sticky close header, preserving saves and dirty`,async()=>game(fixture(),async p=>{
  await stable(p);await p.locator('#openSettings').tap();const input=p.locator('#saveTransferText');await input.tap();await input.fill('확인용 붙여넣기 — 가져오기는 실행하지 않음');const before=await snapshot(p);
  await p.setViewportSize({width,height:320});await p.waitForFunction(()=>{const e=document.getElementById('saveTransferText'),r=e.getBoundingClientRect(),h=document.querySelector('#modalSettings .ui-modal-head').getBoundingClientRect();return r.top>=h.bottom-1&&r.bottom<=visualViewport.height-8;},null,{polling:30});
  assert.equal(await p.evaluate(()=>document.activeElement.id),'saveTransferText');await reachable(p,'#saveTransferText');await p.keyboard.type(' 확인');await reachable(p,'#modalSettings .closeBtn');
  assert.deepEqual(await snapshot(p),before);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openSettings');assert.deepEqual(await snapshot(p),before);
 },{viewport:{width,height:700}}));
 test(`${width}px staff PIN reduced-height focus, typing and Escape cancel retain exact coupon/visit/save records`,async()=>game(fixture({coupons:{drink:2,veg:3}}),async p=>{
  await stable(p);await p.evaluate(()=>{state.couponLedger.dailyFrom=Date.now();save(true);});await p.locator('#couponChip').tap();await p.locator('#showStaffCoupon').tap();const before=await snapshot(p);await p.locator('#serviceTable').fill('검증 테이블');p.once('dialog',d=>d.accept());await p.locator('#startServiceVisit').tap();
  await p.locator('#pinInput').fill('12');await p.setViewportSize({width,height:300});await reachable(p,'#pinInput');await audit(p);await reachable(p,'#pinCancel');
  await p.keyboard.press('Escape');assert.equal(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')),false);assert.deepEqual(await snapshot(p),before);
 },{viewport:{width,height:700}}));
}
test('ending replay uses the same navigation button without covering menus or adding listeners/effects',async()=>game(fixture({endingUnlocked:true,endingPrompted:true,coupons:{drink:2,veg:3}}),async p=>{
 await stable(p);const before=await snapshot(p);assert.equal(await p.locator('nav #replayEndingBtn').count(),1);assert.equal(await p.locator('#replayEndingBtn').count(),1);
 const a=await p.locator('#replayEndingBtn').boundingBox(),b=await p.locator('#menuBar').boundingBox();assert.ok(a.y>=b.y+b.height);await audit(p);
 await p.locator('#replayEndingBtn').tap();await p.locator('#endingDialogWrapper').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>__endingStep),0);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>endingPhase),'idle');assert.equal(await p.evaluate(()=>document.activeElement.id),'replayEndingBtn');assert.deepEqual(await snapshot(p),before);
}));
test('reduced-height reward modal can scroll, trap focus and close without claiming or deleting the receipt',async()=>game(fixture({offlineReward:{amount:12345,seconds:3600}}),async p=>{
 await stable(p);const before=await snapshot(p);await audit(p);await trap(p,'#modalOffline');await reachable(p,'#modalOffline .closeBtn');await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
},{viewport:{width:360,height:300}}));
test('reduced motion retains visible keyboard focus and modal ownership without serving background orders',async()=>game(fixture(),async p=>{
 await stable(p);await p.emulateMedia({reducedMotion:'reduce'});const before=await snapshot(p);await p.locator('#openSettings').tap();await p.keyboard.press('Tab');
 const focus=await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return {visible:e.matches(':focus-visible'),width:parseFloat(s.outlineWidth),style:s.outlineStyle};});assert.deepEqual(focus,{visible:true,width:3,style:'solid'});
 await p.evaluate(()=>document.querySelector('[data-action="serve-menu"]').click());await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
}));
test('coupon viewing, disclosure, resizing and navigation leave primary/backup/dirty and paid history unchanged',async()=>game(fixture({coupons:{drink:2,veg:3}}),async p=>{
 await stable(p);const before=await snapshot(p);await p.locator('#couponChip').tap();await p.locator('#couponHistory > summary').tap();await p.setViewportSize({width:360,height:320});await audit(p);await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
}));
