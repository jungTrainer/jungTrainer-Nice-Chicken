const assert = require('node:assert/strict'), path = require('node:path');
const { test } = require('node:test');
const { pwaHarness } = require('./helpers/pwa.cjs');
const { scenario } = pwaHarness();
async function wait(p, fn) {
  const until=Date.now()+20000;
  while(Date.now()<until) { if(await p.evaluate(fn))return;await p.waitForTimeout(100); }
  assert.fail('real worker/ownership condition timed out');
}
async function seed(p) {
  await p.evaluate(()=>{
    state.coupons={drink:3,veg:7};state.offlineReward={amount:500,seconds:60};
    state.serviceVisit={id:'synthetic-visit',table:'4번',startedAt:Date.now(),drinkConfirmedAt:0,vegConfirmed:0};
    RepeatMissions.startChallenge();onServeOneOnline('player');save(true);
    document.querySelectorAll('.dim.on,.panel.on').forEach(e=>e.classList.remove('on'));
  });
}
const data=p=>p.evaluate(()=>({coupons:state.coupons,visit:state.serviceVisit,challenge:state.missions.visitChallenge,pending:state.offlineReward.amount}));

test('actual offline SW serves repeat/staff UI, preserves pending/paid across reload and backup/import/reset',async()=>scenario(async s=>{
  const p=s.page;p.on('dialog',d=>d.accept());await seed(p);const before=await data(p);
  await s.context.setOffline(true);s.serverOffline(true);await p.reload();await p.evaluate(()=>SessionOwner.ready);
  assert.deepEqual(await data(p),before);await p.keyboard.press('Escape');
  await p.locator('#openSettings').tap();await p.locator('#openCoupons').tap();await p.locator('#showStaffCoupon').tap();assert.match(await p.locator('#staffCouponStatus').innerText(),/4번/);
  await p.screenshot({path:path.join(__dirname,'../test-results/screenshots/nice-chicken-imp15-offline.png')});
  await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  const backup=await p.evaluate(()=>exportSaveData());assert.equal(await p.evaluate(raw=>importSaveData(raw),backup),true);assert.deepEqual(await data(p),before);
  await p.evaluate(()=>resetGame());assert.equal(await p.evaluate(()=>state.serviceVisit),null);assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:0,veg:0});
}));

test('waiting/failed update never applies during provision PIN; later successful save preserves visits and paid data',async()=>scenario(async s=>{
  const p=s.page;p.on('dialog',d=>d.accept());await seed(p);const before=await data(p);
  s.select(1);s.failures.set('js/core/config.js','hash');await p.evaluate(async()=>{try{await(await navigator.serviceWorker.getRegistration()).update();}catch(_){}});
  await wait(p,async()=>!(await navigator.serviceWorker.getRegistration()).installing);assert.deepEqual(await data(p),before);
  s.failures.clear();await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await wait(p,async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  await p.locator('#openSettings').tap();await p.locator('#openCoupons').tap();await p.locator('#useDrinkCoupon').tap();
  await p.evaluate(()=>document.getElementById('applyPwaUpdate').click());
  assert.equal(await p.evaluate(()=>PwaRuntime.applying),false);
  assert.equal(await p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
  assert.deepEqual(await data(p),before);
  await p.locator('#pinCancel').tap();await wait(p,()=>!BenefitService.pending);await p.keyboard.press('Escape');assert.deepEqual(await data(p),before);
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});
  await p.locator('#applyPwaUpdate').tap();assert.equal(await p.evaluate(()=>window.pwaFixtureVersion),undefined);assert.deepEqual(await data(p),before);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});
  // The successful update reloads immediately: dispatch one real click without waiting on the old document.
  await Promise.all([p.waitForEvent('domcontentloaded'),p.locator('#applyPwaUpdate').click({noWaitAfter:true})]);await p.waitForFunction(()=>window.pwaFixtureVersion==='b',null,{polling:100,timeout:20000});await p.evaluate(()=>SessionOwner.ready);assert.deepEqual(await data(p),before);
}));

test('real installed standalone reader cannot redeem and inherits saved visit/challenge after owner closes',async()=>scenario(async s=>{
  const p=s.page;await seed(p);const before=await data(p),cdp=await s.context.newCDPSession(p),id=s.url+'index.html';
  await cdp.send('PWA.install',{manifestId:id,installUrlOrBundleUrl:id});await cdp.send('PWA.changeAppUserSettings',{manifestId:id,displayMode:'standalone'});
  const event=s.context.waitForEvent('page');await cdp.send('PWA.launch',{manifestId:id});const app=await event;await app.waitForLoadState();await app.evaluate(()=>SessionOwner.ready);
  assert.equal(await app.evaluate(()=>matchMedia('(display-mode: standalone)').matches),true);assert.equal(await app.evaluate(()=>SessionOwner.mode),'reader');assert.equal(await app.evaluate(()=>useCoupon('drink')),false);assert.equal(await app.evaluate(()=>RepeatMissions.startChallenge()),false);
  await app.locator('#sessionRequest').tap();await p.close();await wait(app,()=>SessionOwner.canMutate());
  // Installed page's genuine rAF is stopped only after ownership for deterministic snapshot assertions.
  await app.evaluate(()=>{cancelAnimationFrame(rAF_ID);requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};});
  const after=await data(app);assert.deepEqual(after.coupons,before.coupons);assert.deepEqual(after.visit,before.visit);assert.equal(after.challenge.id,before.challenge.id);assert.ok(after.challenge.serves>=before.challenge.serves&&after.challenge.serves<=5);assert.equal(after.pending,500);
  await app.keyboard.press('Escape');await app.locator('#openSettings').tap();await app.locator('#openCoupons').tap();await app.locator('#showStaffCoupon').tap();await app.screenshot({path:path.join(__dirname,'../test-results/screenshots/nice-chicken-imp15-installed.png')});
  const rootCdp=await s.context.browser().newBrowserCDPSession();await rootCdp.send('PWA.uninstall',{manifestId:id});
},{persistent:true,realTime:true}));
