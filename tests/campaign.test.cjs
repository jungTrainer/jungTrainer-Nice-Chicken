const assert = require('node:assert/strict'), path = require('node:path');
const { test } = require('node:test');
const { harness, NOW } = require('./helpers/game.cjs');
const { game, fixture } = harness();
const record = {unlockedAt:NOW,seenAt:0,badgeAwarded:false};
const campaign=(mode='easy',regions={})=>({version:1,mode,selectedAt:NOW,regions});
const accept=p=>p.on('dialog',d=>d.accept());
async function closePending(p) { if(await p.locator('#modalOffline').evaluate(e=>e.classList.contains('on')))await p.locator('[data-ui-close="modalOffline"]').tap(); }
async function snap(p) { return p.evaluate(()=>({money:state.money,coupons:state.coupons,cert:state.cert,pending:state.offlineReward,missions:state.missions,staff:state.staffStats,management:state.management,service:state.serviceTimers,regions:state.regionUnlocked,campaign:state.campaign,family:[state.endingUnlocked,state.endingSeen,state.robotGrandson],dirty:_saveDirty})); }
async function openStory(p,id='changnyeong') {await p.locator('#openSettings').tap();await p.locator(`[data-campaign-region="${id}"]`).tap();}
async function quota(p,on=true) {await p.evaluate(on=>{if(!window.originalSet)window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=on?function(k,v){if(k===SAVE_KEY)throw Error('synthetic primary quota');return originalSet.call(this,k,v);}:originalSet;},on);}

test('old save without campaign keeps legacy 100-hae and existing costs, without inferred badges',async()=>{
 const old=fixture({coupons:{drink:3,veg:7},endingSeen:true,robotGrandson:true});delete old.campaign;
 await game(old,async p=>{assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');assert.equal(await p.evaluate(()=>Campaign.rules().ending),'10000000000000000000000');assert.equal(await p.evaluate(()=>getRegionUnlockCost('busan')),50000000000);assert.deepEqual(await p.evaluate(()=>state.campaign.regions),{});assert.deepEqual(await p.evaluate(()=>state.coupons),old.coupons);});
});

test('explicit mode cancel preserves raw save and legacy policy',async()=>game(fixture(),async p=>{
 p.on('dialog',d=>d.dismiss());const before=await p.evaluate(()=>localStorage.getItem(SAVE_KEY));await p.locator('#openSettings').tap();await p.locator('#chooseMode-easy').tap();assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_KEY)),before);
}));

test('mode selection preserves exact pending/paid/six staff/management/caches and reconnects',async()=>game(fixture({money:'9007199254740993',coupons:{drink:3,veg:7},offlineReward:{amount:500,seconds:60,menus:{fried:{earned:500,count:1}}},upgrades:{hire:6},delivery:{level:1,riders:1},research:{slots:1,running:[],levels:{training:10,deliveryOps:10},completed:[]},management:{focus:'dispatch',leadStaff:'ato',menuPolicy:'signature',featuredMenu:'fried',readStories:['arrival']},endingSeen:true,robotGrandson:true,serviceTimers:{onlineOrders:0.25,deliveryMs:500,deliveryIntervalMs:2000,deliverySignature:''}}),async p=>{
 accept(p);await closePending(p);await p.evaluate(()=>{state.missions.dailyCompletedToday=true;state.cert.issuedThisWeek=true;save(true);});const before=await snap(p);
 await p.locator('#openSettings').tap();await p.locator('#chooseMode-normal').tap();const after=await snap(p);for(const key of ['money','coupons','cert','pending','missions','staff','management','service','regions','family'])assert.deepEqual(after[key],before[key],key);assert.equal(after.campaign.mode,'normal');
 await p.reload();assert.equal(await p.evaluate(()=>state.campaign.mode),'normal');assert.equal(await p.evaluate(()=>state.offlineReward.amount),500);assert.equal(await p.evaluate(()=>state.robotGrandson),true);
}));

test('mode primary failure restores old policy/dirty/progress and successful retry applies once',async()=>game(fixture(),async p=>{
 accept(p);await p.evaluate(()=>{state.money=123;markStateChanged('unsaved');});const before=await snap(p);const raw=await p.evaluate(()=>localStorage.getItem(SAVE_KEY));await p.locator('#openSettings').tap();await quota(p);await p.locator('#chooseMode-easy').tap();assert.deepEqual(await snap(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_KEY)),raw);await quota(p,false);await p.locator('#chooseMode-easy').tap();assert.equal(await p.evaluate(()=>state.campaign.mode),'easy');
}));

test('one-won regional goal boundary excludes confirmed-but-unclaimed receipt',async()=>game(fixture({campaign:campaign(),totalSales:39999999,offlineReward:{amount:1,seconds:60}}),async p=>{
 accept(p);assert.equal(await p.evaluate(()=>!!state.campaign.regions.changnyeong),false);await p.locator('#claimOffline').tap();await p.evaluate(()=>Campaign.check());assert.equal(await p.evaluate(()=>Campaign.sales('changnyeong')),40000000);assert.ok(await p.evaluate(()=>state.campaign.regions.changnyeong.unlockedAt));assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.seenAt),0);assert.equal(await p.evaluate(()=>state.coupons.drink),0);
}));

test('unlock requires story, exact mode price and one primary commit; quota cannot debit/open a branch',async()=>game(fixture({campaign:campaign(),money:999999,totalSales:40000000}),async p=>{
 const result=await p.evaluate(()=>{const short=BranchManager.unlock('busan');recordIncome(1);return {short,need:getRegionUnlockCost('busan')};});assert.deepEqual(result,{short:false,need:1000000});await quota(p);assert.equal(await p.evaluate(()=>BranchManager.unlock('busan')),false);assert.equal(await p.evaluate(()=>state.money),1000000);assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),undefined);await quota(p,false);assert.equal(await p.evaluate(()=>BranchManager.unlock('busan')),true);assert.equal(await p.evaluate(()=>state.money),0);assert.equal(await p.evaluate(()=>BranchManager.unlock('busan')),false);
}));

test('money alone cannot skip region story before new branch unlock',async()=>game(fixture({campaign:campaign(),money:1e9,totalSales:39999999}),async p=>{
 assert.equal(await p.evaluate(()=>BranchManager.unlockNext()),false);assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),undefined);assert.equal(await p.evaluate(()=>state.money),1e9);
}));

test('mode display/map affordability and actual debit use the same canonical price',async()=>game(fixture({campaign:campaign('normal',{changnyeong:{...record,goalAtUnlock:10000000000}}),money:500000000,totalSales:10000000000}),async p=>{
 await p.locator('#openMap').tap();const button=p.locator("#mapUnlock");assert.equal(await button.isDisabled(),false);assert.match(await button.innerText(),/5억/);await button.tap();assert.equal(await p.evaluate(()=>state.money),0);assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),true);
}));

test('story viewing/close/Escape never complete/pay and preserve pending plus family effect',async()=>game(fixture({campaign:campaign('easy',{changnyeong:record}),totalSales:40000000,coupons:{drink:3,veg:7},offlineReward:{amount:500,seconds:60},endingSeen:true,robotGrandson:true}),async p=>{
 await closePending(p);const before=await snap(p);await openStory(p);assert.equal(await p.locator('#modalSettings').evaluate(e=>e.inert),true);await p.locator('#closeRegionEnding').tap();assert.deepEqual(await snap(p),before);await p.locator('[data-campaign-region="changnyeong"]').tap();await p.keyboard.press('Escape');assert.deepEqual(await snap(p),before);assert.equal(await p.evaluate(()=>document.activeElement.dataset.campaignRegion),'changnyeong');
}));

test('first complete writes one badge, repeated playback writes no new reward or coupon',async()=>game(fixture({campaign:campaign('easy',{changnyeong:record}),totalSales:40000000,coupons:{drink:3,veg:7}}),async p=>{
 await openStory(p);await p.locator('#completeRegionEnding').tap();const once=await snap(p);assert.equal(once.campaign.regions.changnyeong.badgeAwarded,true);assert.ok(once.campaign.regions.changnyeong.seenAt);const raw=await p.evaluate(()=>localStorage.getItem(SAVE_KEY));await p.locator('[data-campaign-region="changnyeong"]').tap();await p.locator('#completeRegionEnding').tap();assert.deepEqual(await snap(p),once);assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_KEY)),raw);assert.deepEqual(once.coupons,{drink:3,veg:7});await p.reload();assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),true);
}));

test('failed regional completion keeps dialogue/open unpaid badge and retries without resetting game progress',async()=>game(fixture({campaign:campaign('easy',{changnyeong:record}),totalSales:40000000}),async p=>{
 await openStory(p);await p.evaluate(()=>{state.money=123;markStateChanged('unsaved');});const before=await snap(p);await quota(p);await p.locator('#completeRegionEnding').tap();assert.deepEqual(await snap(p),before);assert.equal(await p.locator('#modalRegionEnding').evaluate(e=>e.classList.contains('on')),true);await quota(p,false);await p.locator('#completeRegionEnding').tap();assert.equal(await p.evaluate(()=>state.money),123);assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),true);
}));

test('upward/downward mode changes preserve existing story goals/badges/opened branches and family once-effect',async()=>game(fixture({campaign:campaign('easy',{changnyeong:{...record,seenAt:NOW,badgeAwarded:true,goalAtUnlock:40000000}}),regionUnlocked:{changnyeong:true,busan:true},totalSales:40000000,endingSeen:true,robotGrandson:true}),async p=>{
 accept(p);const before=await snap(p);await p.locator('#openSettings').tap();await p.locator('#chooseMode-normal').tap();await p.locator('#chooseMode-legacy').tap();const after=await snap(p);assert.deepEqual(after.campaign.regions,before.campaign.regions);assert.deepEqual(after.regions,before.regions);assert.deepEqual(after.family,before.family);assert.deepEqual(after.coupons,before.coupons);
}));

test('new family ending needs six chapters and exact shared money, while old ending remains available',async()=>game(fixture({campaign:campaign('normal',Object.fromEntries(['changnyeong','busan','seoul','japan','usa'].map(id=>[id,record]))),money:'224999999999999999999'}),async p=>{
 const r=await p.evaluate(()=>{checkEndingCondition();const short=state.endingUnlocked;state.campaign.regions.mars={unlockedAt:Date.now(),seenAt:0,badgeAwarded:false};checkEndingCondition();const stillShort=state.endingUnlocked;recordIncome(1);checkEndingCondition();return {short,stillShort,unlocked:state.endingUnlocked,money:state.money,robot:state.robotGrandson};});assert.deepEqual(r,{short:false,stillShort:false,unlocked:true,money:'225000000000000000000',robot:false});
}));

test('family popup does not interrupt an open regional story and can unlock after closing',async()=>game(fixture({campaign:campaign('easy',Object.fromEntries(['changnyeong','busan','seoul','japan','usa','mars'].map(id=>[id,record]))),money:'19999999999999999999'}),async p=>{
 await openStory(p);await p.evaluate(()=>{recordIncome(1);checkEndingCondition();});assert.equal(await p.evaluate(()=>state.endingUnlocked),false);await p.locator('#closeRegionEnding').tap();await p.evaluate(()=>checkEndingCondition());assert.equal(await p.evaluate(()=>state.endingUnlocked),true);
}));

test('late regional complete cannot affect imported root or moved branch',async()=>game(fixture({campaign:campaign('easy',{changnyeong:record}),regionUnlocked:{changnyeong:true,busan:true},totalSales:40000000}),async p=>{
 accept(p);await openStory(p);await p.evaluate(()=>BranchManager.move('busan'));assert.equal(await p.evaluate(()=>Campaign.complete()),false);assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),false);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.evaluate(()=>BranchManager.move('changnyeong'));await openStory(p);const backup=await p.evaluate(()=>exportSaveData());assert.equal(await p.evaluate(raw=>importSaveData(raw),backup),true);assert.equal(await p.locator('#modalRegionEnding').evaluate(e=>e.classList.contains('on')),false);assert.equal(await p.evaluate(()=>Campaign.complete()),false);
}));

test('archived region sales unlock that region only; no inactive income or pending revaluation',async()=>game(fixture({campaign:campaign(),totalSales:40000000,regionUnlocked:{changnyeong:true,busan:true}}),async p=>{
 const r=await p.evaluate(()=>{BranchManager.ensure('busan');state.branches.busan.data.totalSales=100000000000;state.branches.busan.data.offlineReward={amount:500,seconds:60};Campaign.check();return {a:state.campaign.regions.changnyeong,b:state.campaign.regions.busan,sales:state.branches.busan.data.totalSales,pending:state.branches.busan.data.offlineReward};});assert.ok(r.a.unlockedAt);assert.ok(r.b.unlockedAt);assert.equal(r.sales,100000000000);assert.deepEqual(r.pending,{amount:500,seconds:60});
}));

test('writer story blocks handoff; reader cannot change modes/badges and receives latest completed archive',async()=>game(fixture({campaign:campaign('easy',{changnyeong:record}),totalSales:40000000}),async p=>{
 const b=await p.context().newPage();await b.goto(p.url());await b.evaluate(()=>SessionOwner.ready);assert.equal(await b.evaluate(()=>Campaign.choose('normal')),false);assert.equal(await b.evaluate(()=>Campaign.showRegion('changnyeong')),false);await b.locator('#sessionRequest').tap();await openStory(p);assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),false);await p.locator('#completeRegionEnding').tap();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),true);await b.waitForFunction(()=>SessionOwner.canMutate(),null,{polling:100});assert.equal(await b.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),true);await b.close();
}));

test('backup/import/reset retain narrative/paid/receipt, explicit reset clears campaign without restoring old generation',async()=>game(fixture({campaign:campaign('normal',{changnyeong:{...record,seenAt:NOW,badgeAwarded:true}}),coupons:{drink:3,veg:7},offlineReward:{amount:500,seconds:60},endingSeen:true,robotGrandson:true}),async p=>{
 accept(p);await closePending(p);const before=await snap(p),raw=await p.evaluate(()=>exportSaveData());await p.evaluate(()=>{state.campaign.mode='easy';save(true);});assert.equal(await p.evaluate(raw=>importSaveData(raw),raw),true);const after=await snap(p);for(const k of ['campaign','coupons','pending','family'])assert.deepEqual(after[k],before[k]);await closePending(p);await p.evaluate(()=>resetGame());assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');assert.deepEqual(await p.evaluate(()=>state.campaign.regions),{});assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_BACKUP_KEY)),null);
}));

test('explicit backup recovery preserves new mode/story archive and certified pending without guessing',async()=>game(fixture({campaign:campaign('normal',{changnyeong:{...record,seenAt:NOW,badgeAwarded:true}}),coupons:{drink:3,veg:7},offlineReward:{amount:500,seconds:60}}),async p=>{
 accept(p);await closePending(p);await p.evaluate(()=>{save(true);localStorage.setItem(SAVE_BACKUP_KEY,JSON.stringify(state));localStorage.setItem(SAVE_KEY,'{broken');});await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.evaluate(()=>SaveRecovery.blocked),true);await p.locator('#recoverBackup').tap();assert.equal(await p.evaluate(()=>state.campaign.mode),'normal');assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),true);assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:3,veg:7});assert.equal(await p.evaluate(()=>state.offlineReward.amount),500);
}));

test('future/malformed campaign blocks import and preserves raw primary; opaque extension remains',async()=>game(fixture(),async p=>{
 accept(p);const results=await p.evaluate(()=>{const raw=localStorage.getItem(SAVE_KEY),results=[];for(const edit of [c=>c.version=2,c=>c.mode='hell',c=>c.regions.changnyeong={unlockedAt:0,seenAt:1,badgeAwarded:true}]){const backup=JSON.parse(exportSaveData());edit(backup.data.campaign);results.push(importSaveData(JSON.stringify(backup)));if(localStorage.getItem(SAVE_KEY)!==raw)throw Error('raw changed');}return results;});assert.deepEqual(results,[false,false,false]);
 assert.equal(await p.evaluate(()=>{const b=JSON.parse(exportSaveData());b.data.campaign.extension={keep:'yes'};b.data.campaign.regions.future={opaque:'yes'};return importSaveData(JSON.stringify(b));}),true);assert.deepEqual(await p.evaluate(()=>state.campaign.regions.future),{opaque:'yes'});
}));

for(const [name,viewport] of [['portrait',{width:320,height:568}],['landscape',{width:568,height:320}]]) test(`${name} mode/region story uses real touch/scroll/focus, background guard and safe close/complete`,async()=>game(fixture({totalSales:40000000,coupons:{drink:3,veg:7}}),async p=>{
 accept(p);await p.locator('#openSettings').tap();await p.locator('#chooseMode-easy').tap();await p.locator('[data-campaign-region="changnyeong"]').tap();const box=await p.locator('#modalRegionEnding .modal').boundingBox();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);for(let i=0;i<10;i++)await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.closest('#modalRegionEnding')!==null),true);assert.equal(await p.evaluate(()=>state.coupons.drink),3);
 const sales=await p.evaluate(()=>state.totalSales);
 await p.evaluate(()=>{state.customers=[{id:'guard',menuId:'fried',state:'waiting',x:10,y:10,patience:99}];state.selectedCustomerId='guard';document.querySelector('[data-action="serve-menu"][data-menu-id="fried"]').click();});
 assert.equal(await p.evaluate(()=>state.totalSales),sales);
 await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/nice-chicken-imp16-${name}-story.png`)});await p.locator('#completeRegionEnding').tap();assert.equal(await p.evaluate(()=>state.campaign.regions.changnyeong.badgeAwarded),true);assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:3,veg:7});await p.locator('#campaignStatus').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/nice-chicken-imp16-${name}-modes.png`)});await p.keyboard.press('Escape');await p.reload();assert.equal(await p.evaluate(()=>state.campaign.mode),'easy');
},{viewport}));

test('date/week transition resets period goals while preserving mode, region badge and existing coupons/receipt',async()=>game(fixture({campaign:campaign('normal',{changnyeong:{...record,seenAt:NOW,badgeAwarded:true}}),coupons:{drink:3,veg:7},offlineReward:{amount:500,seconds:60}}),async p=>{
 await closePending(p);const before=await snap(p);await p.evaluate(()=>{window.testNow=state.missions.weekEndAt;sessionStorage.setItem('testNow',testNow);ensureMissionReset();save(true);});const after=await snap(p);assert.deepEqual(after.campaign,before.campaign);assert.deepEqual(after.coupons,before.coupons);assert.deepEqual(after.pending,before.pending);assert.equal(after.missions.dailyPolicy,2);assert.equal(after.missions.weeklyPolicy,2);await p.reload();assert.equal(await p.evaluate(()=>state.campaign.mode),'normal');assert.equal(await p.evaluate(()=>state.offlineReward.amount),500);
}));
