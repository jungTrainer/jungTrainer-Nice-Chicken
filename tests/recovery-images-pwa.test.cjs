const assert=require('node:assert/strict');const {test}=require('node:test');const {pwaHarness}=require('./helpers/pwa.cjs'),{prepareMedia}=require('./helpers/recovery-media.cjs');
const {scenario}=pwaHarness({prepare:prepareMedia});
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{polling:100,timeout:20000});
const snapshot=p=>p.evaluate(()=>({money:state.money,coupons:state.coupons,ledger:JSON.stringify(state.couponLedger),receipt:state.offlineReward,paid:state.missions.dailyCompletedToday}));
const pixel=p=>p.evaluate(async()=>{await ImageAssets.load('menu.fried');const c=document.createElement('canvas');c.width=c.height=4;const ctx=c.getContext('2d');ImageAssets.draw(ctx,'menu.fried',0,0,4,4);return [...ctx.getImageData(2,2,1,1).data];});
async function settings(p){if(await p.locator('#modalOffline').evaluate(e=>e.classList.contains('on')))await p.locator('[data-ui-close="modalOffline"]').tap();await p.locator('#openSettings').tap();}
async function apply(p,version){await p.locator('#applyPwaUpdate').tap();await wait(p,v=>document.querySelector('meta[name="app-version"]').content===v,version);await wait(p,()=>typeof ImageAssets!=='undefined'&&typeof SessionOwner!=='undefined'&&SessionOwner.mode!=='starting');await p.evaluate(()=>SessionOwner.ready);}

test('verified media stays on its release offline and while B waits; explicit apply replaces same-name A red with B blue',()=>scenario(async({page,context,serverOffline,select,releases})=>{
 const before=await snapshot(page);assert.deepEqual(await pixel(page),[255,0,0,255]);serverOffline(true);await context.setOffline(true);await page.reload();await page.evaluate(()=>SessionOwner.ready);assert.deepEqual(await pixel(page),[255,0,0,255]);assert.deepEqual(await snapshot(page),before);
 serverOffline(false);await context.setOffline(false);await page.evaluate(()=>document.getElementById('splashScreen')?.remove());await settings(page);select(1);await page.locator('#checkPwaUpdate').tap();await wait(page,()=>!document.getElementById('applyPwaUpdate').disabled);
 await page.evaluate(()=>ImageAssets.cache.clear());assert.deepEqual(await pixel(page),[255,0,0,255]);assert.equal(await page.evaluate(()=>PwaRuntime.version),releases[0].version);await apply(page,releases[1].version);assert.deepEqual(await pixel(page),[0,0,255,255]);assert.deepEqual(await snapshot(page),before);
},{state:{money:'9007199254740993',coupons:{drink:3,veg:7},offlineReward:{amount:777,seconds:60}}}));

test('optional picture 404 does not block worker installation, play, fallback or offline reconnect',()=>scenario(async({page,context,serverOffline})=>{
 const before=await snapshot(page);assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);assert.equal(await page.evaluate(async()=>await ImageAssets.load('menu.fried')),null);serverOffline(true);await context.setOffline(true);await page.reload();await page.evaluate(()=>SessionOwner.ready);assert.equal(await page.evaluate(async()=>await ImageAssets.load('menu.fried')),null);assert.deepEqual(await snapshot(page),before);
},{failures:{'assets/images/test/picture.svg':'missing'},state:{money:123456,coupons:{drink:3,veg:7}}}));

test('optional image hash mismatch in B keeps a successful shell usable with fallback and preserves all benefits',()=>scenario(async({page,failures,select,releases})=>{
 const before=await snapshot(page);await settings(page);select(1);failures.set('assets/images/test/picture.svg','hash');await page.locator('#checkPwaUpdate').tap();await wait(page,()=>!document.getElementById('applyPwaUpdate').disabled);await apply(page,releases[1].version);assert.equal(await page.evaluate(async()=>await ImageAssets.load('menu.fried')),null);assert.deepEqual(await snapshot(page),before);
},{state:{money:123456,coupons:{drink:3,veg:7}}}));

for(const name of ['catalog','images'])test(`missing required media ${name}.js rejects update and can be repaired without altering current progress`,()=>scenario(async({page,failures,select,releases})=>{
 const before=await snapshot(page);await settings(page);select(1);failures.set('js/media/'+name+'.js','missing');await page.locator('#checkPwaUpdate').tap();await wait(page,()=>document.getElementById('pwaStatus').textContent.includes('설치 실패'));assert.equal(await page.evaluate(()=>PwaRuntime.version),releases[0].version);assert.deepEqual(await pixel(page),[255,0,0,255]);assert.deepEqual(await snapshot(page),before);failures.clear();await page.locator('#checkPwaUpdate').tap();await wait(page,()=>!document.getElementById('applyPwaUpdate').disabled);await apply(page,releases[1].version);assert.deepEqual(await pixel(page),[0,0,255,255]);assert.deepEqual(await snapshot(page),before);
},{state:{money:123456,coupons:{drink:3,veg:7}}}));

test('cached undecodable optional bytes fall back online and offline while the essential shell stays healthy',()=>scenario(async({page,context,serverOffline})=>{
 const before=await snapshot(page);
 assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);
 assert.equal(await page.evaluate(()=>ImageAssets.load('test.broken')),null);
 serverOffline(true);await context.setOffline(true);await page.reload();await page.evaluate(()=>SessionOwner.ready);
 assert.equal(await page.evaluate(()=>ImageAssets.load('test.broken')),null);
 assert.deepEqual(await snapshot(page),before);
},{state:{money:123456,coupons:{drink:3,veg:7}}}));
