const assert=require('node:assert/strict');
const {test}=require('node:test');
const {harness}=require('./helpers/game.cjs');
const {game,fixture}=harness();
const banned=/\b(?:v[12]|LocalStorage|archive|commit|paid)\b|로컬\s*PIN|서버\s*인증|미수령|주간\s*스탬프/gi;
async function stable(p){await p.waitForFunction(()=>state.customers.length>0,null,{polling:50});}
async function snapshot(p){return p.evaluate(()=>({state:JSON.stringify(state),raw:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty}));}
async function customerText(p,selector){return p.locator(selector).evaluate(root=>{
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;const text=[];
 while(node=walker.nextNode())if(!node.parentElement.closest('[data-staff-only],script,style,textarea,input,pre,code')&&node.parentElement.getClientRects().length)text.push(node.textContent);
 return text.join(' ');
});}
for(const width of [360,390]) {
 test(`${width}px first guide stays concise; touch/keyboard details and close preserve raw state`,async()=>game(null,async p=>{
  await stable(p);const before=await snapshot(p);
  assert.equal(await p.locator('#modalProfile details').first().evaluate(d=>d.open),false);
  assert.equal(await p.locator('#modalProfile .ux-intro > p').count(),3);
  assert.equal(await p.locator('#profileWelcomeNotice').isVisible(),true);
  assert.match(await p.locator('#profileWelcomeNotice').innerText(),/웰컴 음료 1장.*내일부터/);
  assert.equal(await p.locator('#saveName').isVisible(),true);
  const summary=p.locator('#modalProfile summary').first();await summary.tap();
  assert.equal(await p.locator('#modalProfile details').first().evaluate(d=>d.open),true);
  assert.match(await customerText(p,'#modalProfile'),/게임 난이도/);
  assert.deepEqual((await customerText(p,'#modalProfile')).match(banned),null);
  await summary.focus();await p.keyboard.press('Enter');
  assert.equal(await p.locator('#modalProfile details').first().evaluate(d=>d.open),false);
  const box=await summary.boundingBox();assert.ok(box.height>=44);
  await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
 },{viewport:{width,height:844}}));
 test(`${width}px customer surfaces contain no developer copy, including expanded details`,async()=>game(fixture(),async p=>{
  await stable(p);const before=await snapshot(p);
  for(const [open,id] of [['[data-panel="upg"]','panel-upg'],['[data-panel="res"]','panel-res'],['[data-panel="mis"]','panel-mis'],['[data-panel="shr"]','panel-shr'],['#openMap','modalExpansion'],['#openSettings','modalSettings']]){
   await p.locator(open).tap();await p.locator('#'+id+' details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
   const text=await customerText(p,'#'+id);assert.deepEqual(text.match(banned),null,`${id}: ${text}`);
   await p.keyboard.press('Escape');
  }
  await p.locator('#openSettings').tap();await p.locator('#openCoupons').tap();
  await p.locator('#modalCoupons details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  const couponText=await customerText(p,'#modalCoupons');assert.deepEqual(couponText.match(banned),null);
  assert.doesNotMatch(couponText,/\bPIN\b|테이블|기기 간.*공유/);
  await p.locator('#showStaffCoupon').tap();assert.match(await p.locator('#staffCouponView').innerText(),/서버 인증이 아닙니다/);
  await p.locator('#hideStaffCoupon').tap();await p.keyboard.press('Escape');
  await p.locator('#openExchange').tap();assert.deepEqual((await customerText(p,'#modalExchange')).match(banned),null);await p.keyboard.press('Escape');
  await p.locator('#openGameGuide').tap();assert.deepEqual((await customerText(p,'#modalGameGuide')).match(banned),null);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  assert.deepEqual(await snapshot(p),before,'viewing copy/details cannot grant, normalize or save benefits');
 },{viewport:{width,height:844}}));
}
test('attendance labels follow stored seven/five goals without changing titles, progress or paid state',async()=>game(fixture(),async p=>{
 await stable(p);const before=await snapshot(p);await p.locator('[data-panel="mis"]').tap();
 assert.match(await p.locator('#weeklyList').innerText(),/출석 도장 7/);assert.equal(await p.locator('#weeklyStampRow > div').count(),7);
 assert.match(await p.locator('#panel-mis > .note').innerText(),/목표는 7개/);await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
 await p.evaluate(()=>{window.testNow=state.missions.weekEndAt;sessionStorage.setItem('testNow',testNow);ensureMissionReset();updateUI();save(true);});
 const next=await snapshot(p);await p.locator('[data-panel="mis"]').tap();assert.match(await p.locator('#weeklyList').innerText(),/출석 도장 5/);
 assert.equal(await p.evaluate(()=>state.missions.weeklyList.find(g=>g.type==='stamp').title),'일간 올클 5');
 await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),next);
}));
test('disabled certificate action is visibly disabled; expired HQ certificate matches existing use guard',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
 await stable(p);await p.locator('[data-panel="shr"]').tap();
 assert.equal(await p.locator('#makeCard').isDisabled(),true);assert.equal(await p.locator('#useCertDrink').isDisabled(),true);
 assert.deepEqual(await p.locator('#useCertDrink').evaluate(b=>({background:getComputedStyle(b).backgroundColor,shadow:getComputedStyle(b).boxShadow})),{background:'rgb(225, 225, 225)',shadow:'none'});
 await p.keyboard.press('Escape');await p.evaluate(()=>{state.cert={issuedThisWeek:true,issuedAt:Date.now()-1000,validUntil:Date.now(),usedAt:0};renderPanel('shr');updateUI();});
 assert.equal(await p.locator('#useCertDrink').isDisabled(),true);
 await p.evaluate(()=>{state.cert.validUntil=Date.now()+86400000;state.missions.weeklyCompletedAt=0;updateUI();});
 assert.equal(await p.locator('#useCertDrink').isDisabled(),false,'valid HQ certificate stays usable across branch mission weeks');
 assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:3,veg:7});assert.equal(await p.evaluate(()=>state.cert.usedAt),0);
}));
test('modern reward labels and welcome visibility reflect eligibility without changing issued coupons',async()=>game(fixture(),async p=>{
 await stable(p);await p.evaluate(()=>{state.missions.dailyRewardPolicy=state.missions.weeklyRewardPolicy=2;updateUI();});const before=await snapshot(p);
 assert.equal(await p.locator('#profileWelcomeNotice').isVisible(),false);
 await p.locator('[data-panel="mis"]').tap();assert.match(await p.locator('#dailyRewardInfo').innerText(),/음료 스탬프 \+1/);assert.match(await p.locator('#weeklyRewardInfo').innerText(),/음료 스탬프 \+2/);
 assert.deepEqual((await customerText(p,'#panel-mis')).match(banned),null);await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
}));
test('summary participates in modal keyboard focus containment and restores opener on Escape',async()=>game(fixture(),async p=>{
 await p.locator('#openSettings').tap();const summary=p.locator('#modalSettings summary').first();await summary.focus();await p.keyboard.press('Enter');
 assert.equal(await summary.evaluate(s=>s.parentElement.open),true);
 for(let i=0;i<18;i++)await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.closest('#modalSettings')!==null),true);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openSettings');
}));
