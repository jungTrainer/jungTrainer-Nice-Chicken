const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { test } = require('node:test');
const { harness, NOW } = require('./helpers/game.cjs');
const { game, fixture } = harness();
const accept = p => p.on('dialog',d=>d.accept());
async function coupons(p) { await p.locator('#openSettings').tap(); await p.locator('#openCoupons').tap(); }
async function visit(p, table='3번') { await p.locator('#serviceTable').fill(table); await p.locator('#startServiceVisit').tap(); if(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on'))) await pin(p); }
async function pin(p) { await p.locator('#pinInput').fill('0000'); await p.locator('#pinOk').tap(); await p.waitForFunction(()=>!BenefitService.pending,null,{polling:50}); }
async function snapshot(p) { return p.evaluate(()=>({ money:state.money,coupons:state.coupons,cert:state.cert,visit:state.serviceVisit,log:state.benefitsLog,pending:state.offlineReward,dirty:_saveDirty })); }
async function correct(p, actor='player', menu='fried') {
  await p.evaluate(({actor,menu})=> {
    state.customers=[{id:'correct',menuId:menu,state:'waiting',x:100,y:100,patience:99}];
    state.selectedCustomerId='correct';
    if(actor!=='player') serveByMenu(menu,actor);
  },{actor,menu});
  if(actor==='player') await p.locator(`[data-action="serve-menu"][data-menu-id="${menu}"]`).tap();
}
async function nextPeriod(p, days=1) { await p.evaluate(days=>{ window.testNow+=days*86400000; sessionStorage.setItem('testNow',testNow); ensureMissionReset(); },days); }

test('v1 current periods preserve partial/completed/paid goals and coupons on reopening',async()=>game(fixture(),async p=>{
  const before=await p.evaluate(()=>{
    state.missions.dailyList[0].current=4; state.missions.dailyList[1].done=true;
    state.missions.dailyCompletedToday=true; state.coupons={drink:3,veg:7};
    state.cert={issuedThisWeek:true,issuedAt:Date.now(),validUntil:Date.now()+7*86400000,usedAt:0};
    save(true); return {missions:structuredClone(state.missions),coupons:state.coupons,cert:state.cert};
  });
  await p.locator('.navBtn[data-panel="mis"]').tap(); await p.keyboard.press('Escape'); await p.reload();
  assert.deepEqual(await p.evaluate(()=>({missions:state.missions,coupons:state.coupons,cert:state.cert})),before);
}));

test('next daily period starts eight feasible v2 goals while the partial v1 week remains',async()=>game(fixture(),async p=>{
  const week=await p.evaluate(()=>structuredClone(state.missions.weeklyList)); await nextPeriod(p);
  const r=await p.evaluate(()=>({d:state.missions.dailyList,w:state.missions.weeklyList,dp:state.missions.dailyPolicy,wp:state.missions.weeklyPolicy}));
  assert.equal(r.dp,2); assert.equal(r.wp,1); assert.equal(r.d.length,8); assert.deepEqual(r.w,week);
  assert.ok(r.d.every(g=>!['upg','sign','expand','delivery','online'].includes(g.type)&&!g.menuId));
}));

test('max-growth/ending v2 daily and week goals finish with serving/active play and pay once',async()=>game(fixture(),async p=>{
  const r=await p.evaluate(()=>{
    for(const u of UPGRADES) state.upgrades[u.id]=u.maxLevel;
    for(const s of STAFF_POOL) state.staffStats[s.key].auto=state.staffStats[s.key].tip=10;
    state.endingSeen=state.endingUnlocked=state.robotGrandson=true;
    window.testNow=state.missions.weekEndAt; sessionStorage.setItem("testNow",testNow); ensureMissionReset();
    state.missions.weeklyStamps=4;
    state.missions._dayActiveSec=60; state.missions._weekActiveSec=300;
    for(let i=0;i<60;i++) {
      state.customers=[{id:'c',menuId:'fried',state:'waiting',x:10,y:10,patience:99}];state.selectedCustomerId='c';serveByMenu('fried','neighbor');
    }
    updateMissionsOnlineOnly(); generateWeeklyCertificate(); generateWeeklyCertificate();
    return {daily:state.missions.dailyList.map(g=>g.done),week:state.missions.weeklyList.map(g=>g.done),coupons:state.coupons,stamps:state.couponLedger.stamps,dated:state.couponLedger.lots.map(c=>c.type),ending:state.endingSeen};
  });
  assert.deepEqual(r.daily,Array(8).fill(true)); assert.deepEqual(r.week,Array(8).fill(true)); assert.deepEqual(r.coupons,{drink:0,veg:0});assert.equal(r.stamps,3);assert.deepEqual(r.dated,["veg"]);assert.equal(r.ending,true);
  await p.reload(); assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:0,veg:0});assert.equal(await p.evaluate(()=>state.couponLedger.stamps),3);assert.equal(await p.evaluate(()=>CouponPolicy.available('veg')),1);
}));

test('v2 any-menu progress follows actual signature sales without requiring locked menu or channel',async()=>game(fixture(),async p=>{
  await nextPeriod(p); await p.evaluate(()=>{state.upgrades.menuUnlock=8;state.management.menuPolicy='signature';state.management.featuredMenu='fried';});
  await correct(p);await correct(p);
  const r=await p.evaluate(()=>({g:state.missions.dailyList.find(g=>g.type==='menu'),menu:state.menuStats.fried.count,pool:getOrderMenuPool().map(m=>m.id)}));
  assert.equal(r.g.done,true);assert.equal(r.menu,2);assert.deepEqual(r.pool,['fried']);assert.equal(r.g.menuId,undefined);
}));

test('repeat active seconds use writer tick only, do not count offline/reload wall time',async()=>game(fixture(),async p=>{
  await nextPeriod(p);
  await p.evaluate(()=>{tick(0.05);save(true);});const before=await p.evaluate(()=>state.missions._dayActiveSec);
  await p.evaluate(()=>{window.testNow+=600000;sessionStorage.setItem('testNow',testNow);});await p.reload();
  assert.equal(await p.evaluate(()=>state.missions._dayActiveSec),before);assert.equal(before,0.05);
}));

test('visit challenge counts correct manual/staff service, excludes wrong input, repeat gives no coupons',async()=>game(fixture(),async p=>{
  accept(p);await p.locator('.navBtn[data-panel="mis"]').tap();await p.locator('#startVisitChallenge').tap();await p.keyboard.press('Escape');
  await p.evaluate(()=>{state.customers=[{id:'w',menuId:'fried',state:'waiting',x:10,y:10,patience:99}];state.selectedCustomerId='w';serveByMenu('yangnyeom');});
  await correct(p,'neighbor');assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),1);
  for(let i=0;i<5;i++) await correct(p);
  assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),5);assert.ok(await p.evaluate(()=>state.missions.visitChallenge.completedAt));
  await p.locator('.navBtn[data-panel="mis"]').tap();await p.locator('#startVisitChallenge').tap();await p.keyboard.press('Escape');
  for(let i=0;i<5;i++) await correct(p);
  assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:0,veg:0});await p.evaluate(()=>save(true));await p.reload();assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),5);
}));

test('challenge restart storage failure preserves previous completion and unsaved progress',async()=>game(fixture(),async p=>{
  await p.evaluate(()=>{RepeatMissions.startChallenge();state.missions.visitChallenge.serves=5;state.missions.visitChallenge.completedAt=Date.now();state.money=123;markStateChanged('synthetic');});
  const before=await p.evaluate(()=>structuredClone(state.missions.visitChallenge));accept(p);
  await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return set.call(this,k,v);};RepeatMissions.startChallenge();});
  assert.deepEqual(await p.evaluate(()=>state.missions.visitChallenge),before);assert.equal(await p.evaluate(()=>state.money),123);assert.equal(await p.evaluate(()=>_saveDirty),true);
}));

test('new daily all-clear retries after failed commit and reopening never pays twice',async()=>game(fixture(),async p=>{
  await nextPeriod(p);await p.evaluate(()=>{state.missions.dailyList.forEach(g=>g.done=true);window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};updateMissionsOnlineOnly();});
  assert.equal(await p.evaluate(()=>state.coupons.veg),0);assert.equal(await p.evaluate(()=>state.missions.dailyCompletedToday),false);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;updateMissionsOnlineOnly();updateMissionsOnlineOnly();});await p.reload();assert.equal(await p.evaluate(()=>state.coupons.veg),0);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),1);
}));

test('same-period next visit challenge does not reset paid day/week or certificate',async()=>game(fixture(),async p=>{
  accept(p);const before=await p.evaluate(()=>{state.missions.dailyCompletedToday=true;state.cert.issuedThisWeek=true;save(true);return {day:state.missions.dailyKey,week:state.missions.weekStartAt};});
  await p.evaluate(()=>{RepeatMissions.startChallenge();RepeatMissions.startChallenge();});
  const r=await p.evaluate(()=>({day:state.missions.dailyKey,week:state.missions.weekStartAt,paid:state.missions.dailyCompletedToday,issued:state.cert.issuedThisWeek}));assert.deepEqual(r,{...before,paid:true,issued:true});
}));

for(const type of ['veg','drink']) test(`${type} provision primary failure rolls back and retry saves before/after exactly once`,async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);
  const before=await snapshot(p);await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});
  await p.locator(type==='drink'?'#useDrinkCoupon':'#useVegCoupon').tap();await pin(p);
  assert.deepEqual(await snapshot(p),before);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});await p.locator(type==='drink'?'#useDrinkCoupon':'#useVegCoupon').tap();await pin(p);
  const r=await snapshot(p);assert.equal(r.coupons[type],before.coupons[type]-1);assert.equal(r.log[0].before,before.coupons[type]);assert.equal(r.log[0].after,r.coupons[type]);assert.equal(r.log[0].table,'3번');
  await p.reload();assert.equal(await p.evaluate(type=>state.coupons[type],type),r.coupons[type]);
}));

test('drink requires visit and same local visit cannot redeem twice; explicit next meal preserves logs',async()=>game(fixture({coupons:{drink:3,veg:0}}),async p=>{
  accept(p);await coupons(p);await p.locator('#useDrinkCoupon').tap();assert.equal(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')),false);
  await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);assert.equal(await p.locator('#useDrinkCoupon').isDisabled(),true);assert.equal(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')),false);assert.equal(await p.evaluate(()=>state.coupons.drink),2);
  await visit(p);assert.equal(await p.locator('#useDrinkCoupon').isDisabled(),true);assert.equal(await p.evaluate(()=>state.coupons.drink),2);
  await nextPeriod(p);await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);assert.equal(await p.evaluate(()=>state.coupons.drink),1);assert.equal(await p.evaluate(()=>state.benefitsLog.filter(l=>l.source==='coupon_use').length),2);
}));

test('exchange failure preserves exact huge cash, coupons and existing logs then retries once',async()=>game(fixture({money:'10000000000000000000001',endingPrompted:true,coupons:{drink:3,veg:7}}),async p=>{
  await p.locator('#openSettings').tap();await p.locator('#openExchange').tap();const before=await snapshot(p);
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});await p.locator('#doExchange').tap();assert.deepEqual(await snapshot(p),before);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});await p.locator('#doExchange').tap();assert.equal(BigInt(before.money)-BigInt(await p.evaluate(()=>state.money)),50000000n);assert.equal(await p.evaluate(()=>state.coupons.drink),4);
}));

test('certificate provision commit failure preserves issued/used/week and visit then success uses once',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await p.evaluate(()=>{state.cert={issuedThisWeek:true,issuedAt:Date.now(),validUntil:Date.now()+7*86400000,usedAt:0};state.missions.weeklyCompletedAt=Date.now();save(true);});
  await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.locator('.navBtn[data-panel="shr"]').tap();const before=await snapshot(p);
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});await p.locator('#useCertDrink').tap();await pin(p);assert.deepEqual(await snapshot(p),before);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});await p.locator('#useCertDrink').tap();await pin(p);assert.equal(await p.evaluate(()=>state.coupons.drink),2);assert.ok(await p.evaluate(()=>state.serviceVisit.drinkConfirmedAt));assert.equal(await p.evaluate(()=>state.missions.weeklyPolicy),2);
}));

test('log clearing save failure preserves history; successful clearing keeps current drink-use guard',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);const before=await snapshot(p);
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});await p.locator('#clearLog').tap();assert.deepEqual(await snapshot(p),before);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});await p.locator('#clearLog').tap();assert.equal(await p.evaluate(()=>state.benefitsLog.length),0);assert.ok(await p.evaluate(()=>state.serviceVisit.drinkConfirmedAt));assert.equal(await p.locator('#useDrinkCoupon').isDisabled(),true);assert.equal(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')),false);
}));

test('staff preview/close/PIN cancellation never uses coupon; unsafe text stays text',async()=>game(fixture({coupons:{drink:3,veg:7},benefitsLog:[{at:'old',type:'veg',qty:1,source:'old',note:'<img src=x onerror="window.injected=true">'}]}),async p=>{
  accept(p);await coupons(p);const before=await snapshot(p);await p.locator('#showStaffCoupon').tap();assert.equal(await p.locator('#staffCouponView').isVisible(),true);assert.match(await p.locator('#staffCouponStatus').innerText(),/다른 기기/);await p.locator('#hideStaffCoupon').tap();assert.deepEqual(await snapshot(p),before);
  assert.equal(await p.evaluate(()=>window.injected),undefined);await p.locator('#useVegCoupon').tap();await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
}));

test('pending PIN duplicate/changed visit cannot commit stale local provision',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.locator('#useDrinkCoupon').tap();
  assert.equal(await p.evaluate(()=>useCoupon('drink')),false);
  await p.evaluate(()=>{state.serviceVisit.id='changed';});await pin(p);assert.equal(await p.evaluate(()=>state.coupons.drink),3);assert.equal(await p.evaluate(()=>state.benefitsLog.length),0);
}));

test('visitor challenge is branch-local, table visit is HQ; movement preserves fixed receipt and timers',async()=>game(fixture(),async p=>{
  accept(p);await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  const before=await p.evaluate(()=>{
    RepeatMissions.startChallenge();onServeOneOnline('player');state.offlineReward={amount:500,seconds:60};state.serviceTimers.onlineOrders=0.25;bindBranchServiceTimers();
    const visit=structuredClone(state.serviceVisit);BranchManager.saveCurrent();state.regionUnlocked.busan=true;BranchManager.ensure('busan');BranchManager.move('busan');return {visit};
  });
  assert.equal(await p.evaluate(()=>state.missions.visitChallenge),undefined);assert.deepEqual(await p.evaluate(()=>state.serviceVisit),before.visit);
  await p.evaluate(()=>{BranchManager.move('changnyeong');save(true);});assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),1);assert.equal(await p.evaluate(()=>state.offlineReward.amount),500);assert.equal(await p.evaluate(()=>state.serviceTimers.onlineOrders),0.25);
}));

test('backup/import/reset preserve or explicitly clear visit/challenge with no historical minting',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  await p.evaluate(()=>{RepeatMissions.startChallenge();onServeOneOnline('player');save(true);window.visitBackup=exportSaveData();});const before=await snapshot(p);
  await p.evaluate(()=>{state.coupons.drink=99;save(true);importSaveData(visitBackup);});assert.deepEqual((await snapshot(p)).coupons,before.coupons);assert.deepEqual((await snapshot(p)).visit,before.visit);assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),1);
  await p.evaluate(()=>resetGame());assert.equal(await p.evaluate(()=>state.serviceVisit),null);assert.equal(await p.evaluate(()=>state.missions.visitChallenge),undefined);assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:0,veg:0});
}));

test('explicit corrupt-primary backup recovery retains new fields and paid coupons without merging',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  await p.evaluate(()=>{RepeatMissions.startChallenge();onServeOneOnline('player');save(true);localStorage.setItem(SAVE_BACKUP_KEY,JSON.stringify(state));localStorage.setItem(SAVE_KEY,'{broken');});await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.evaluate(()=>SaveRecovery.blocked),true);
  await p.locator('#recoverBackup').tap();assert.equal(await p.evaluate(()=>SessionOwner.canMutate()),true);assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),1);assert.equal(await p.evaluate(()=>state.serviceVisit.table),'3번');assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:3,veg:7});
}));

test('reader cannot start challenge/visit/use; saved handoff loads latest challenge and visit',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.evaluate(()=>{RepeatMissions.startChallenge();onServeOneOnline('player');save(true);});
  const b=await p.context().newPage();await b.goto(p.url());await b.evaluate(()=>SessionOwner.ready);
  assert.equal(await b.evaluate(()=>RepeatMissions.startChallenge()),false);assert.equal(await b.evaluate(()=>BenefitService.startVisit()),false);assert.equal(await b.evaluate(()=>useCoupon('veg')),false);
  await b.locator('#sessionRequest').tap();assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),true);await b.waitForFunction(()=>SessionOwner.canMutate(),null,{polling:100});assert.equal(await b.evaluate(()=>state.missions.visitChallenge.serves),1);assert.equal(await b.evaluate(()=>state.serviceVisit.table),'3번');assert.deepEqual(await b.evaluate(()=>state.coupons),{drink:3,veg:7});await b.close();
}));

test('malformed/future visit and mission policy stop explicit import with raw save unchanged',async()=>game(fixture(),async p=>{
  accept(p);const r=await p.evaluate(()=>{
    const raw=localStorage.getItem(SAVE_KEY),results=[];
    for(const edit of [d=>d.serviceVisit={id:'x',table:'3',startedAt:1,drinkConfirmedAt:'yes',vegConfirmed:0},d=>d.missions.visitChallenge={id:'x',startedAt:1,serves:3,completedAt:2},d=>d.missions.dailyPolicy=3]) {
      const backup=JSON.parse(exportSaveData());edit(backup.data);results.push(importSaveData(JSON.stringify(backup)));if(localStorage.getItem(SAVE_KEY)!==raw)throw Error('raw changed');
    }return results;
  });assert.deepEqual(r,[false,false,false]);
}));

for(const [name,viewport] of [['portrait',{width:320,height:568}],['landscape',{width:568,height:320}]]) test(`${name} visitor/staff flow uses real touch/scroll/focus, shows pre/post records and closes safely`,async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await p.locator('.navBtn[data-panel="mis"]').tap();await p.locator('#startVisitChallenge').tap();await p.keyboard.press('Escape');for(let i=0;i<5;i++)await correct(p);
  await p.locator('.navBtn[data-panel="mis"]').tap();assert.match(await p.locator('#missionExtraStatus').innerText(),/5\/5회.*완료/);await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/nice-chicken-imp15-${name}-missions.png`)});await p.keyboard.press('Escape');
  await coupons(p);await visit(p,'7번');await p.locator('#showStaffCoupon').tap();assert.equal(await p.evaluate(()=>document.activeElement.id),'staffCouponView');
  const box=await p.locator('#modalCoupons .modal').boundingBox();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
  await p.locator('#staffCouponStatus').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/nice-chicken-imp15-${name}-staff-before.png`)});
  await p.locator('#useDrinkCoupon').tap();await pin(p);assert.match(await p.locator('#staffCouponStatus').innerText(),/제공 후/);assert.match(await p.locator('#benefitLogList').innerText(),/잔량 3 → 2/);
  await p.locator('#staffCouponStatus').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/nice-chicken-imp15-${name}-staff-after.png`)});await p.locator('#closeCoupons').tap();await p.keyboard.press('Escape');await p.reload();assert.equal(await p.evaluate(()=>state.coupons.drink),2);assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),5);
},{viewport}));

test('maximum-growth actual auto service can finish visit challenge without changing timer/staff ownership',async()=>game(fixture(),async p=>{
  const r=await p.evaluate(()=>{
    for(const u of UPGRADES)state.upgrades[u.id]=u.maxLevel;
    for(const s of STAFF_POOL)state.staffStats[s.key].auto=state.staffStats[s.key].tip=10;
    RepeatMissions.startChallenge();state._autoServeAcc=10;
    for(let i=0;i<5;i++) {
      state.customers=[{id:'max'+i,menuId:'fried',state:'waiting',x:10,y:10,patience:99}];state.selectedCustomerId='max'+i;autoServe(0.05);
    }
    save(true);return {serves:state.missions.visitChallenge.serves,completed:state.missions.visitChallenge.completedAt,rotation:state._staffRot,acc:state._autoServeAcc,coupons:state.coupons};
  });assert.equal(r.serves,5);assert.ok(r.completed);assert.equal(r.rotation,5);assert.ok(r.acc>5);assert.deepEqual(r.coupons,{drink:0,veg:0});await p.reload();assert.equal(await p.evaluate(()=>state.missions.visitChallenge.serves),5);
}));

test('failed new visit commit preserves prior drink confirmation, history, dirty cash and disk original',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);
  await p.evaluate(()=>{state.money=123;markStateChanged('synthetic-unsaved');});const before=await snapshot(p),raw=await p.evaluate(()=>localStorage.getItem(SAVE_KEY));
  await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});
  await visit(p,'8번');assert.deepEqual(await snapshot(p),before);assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_KEY)),raw);
}));

test('save failure prevents reader handoff of visit/challenge until owner retries latest pending progress',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
  accept(p);await coupons(p);await visit(p);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  await p.evaluate(()=>{RepeatMissions.startChallenge();onServeOneOnline('player');state.money=123;state.offlineReward={amount:500,seconds:60};markStateChanged('synthetic-progress');window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return originalSet.call(this,k,v);};});
  const b=await p.context().newPage();await b.goto(p.url());await b.evaluate(()=>SessionOwner.ready);await b.locator('#sessionRequest').tap();
  assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),false);assert.equal(await b.evaluate(()=>SessionOwner.mode),'reader');assert.equal(await p.evaluate(()=>state.money),123);assert.equal(await p.evaluate(()=>_saveDirty),true);
  await p.evaluate(()=>{Storage.prototype.setItem=originalSet;});assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),true);await b.waitForFunction(()=>SessionOwner.canMutate(),null,{polling:100});
  assert.equal(await b.evaluate(()=>state.money),123);assert.equal(await b.evaluate(()=>state.offlineReward.amount),500);assert.equal(await b.evaluate(()=>state.serviceVisit.table),'3번');assert.equal(await b.evaluate(()=>state.missions.visitChallenge.serves),1);assert.deepEqual(await b.evaluate(()=>state.coupons),{drink:3,veg:7});await b.close();
}));

test('open mission cards reflect live progress and completion without rebuilding focused controls',async()=>game(fixture(),async p=>{
  await p.locator('.navBtn[data-panel="mis"]').tap();await p.locator('#startVisitChallenge').focus();
  await p.evaluate(()=>{onServeOneOnline();updateUI();});
  assert.match(await p.locator('#dailyList .card').first().innerText(),/진행: 1 \/ 6/);
  assert.equal(await p.evaluate(()=>document.activeElement.id),'startVisitChallenge');
  await p.evaluate(()=>{for(let i=0;i<5;i++)onServeOneOnline();updateUI();});
  assert.equal(await p.locator('#dailyList .card').first().locator('button').innerText(),'완료');
}));

test('in-progress seven-clear v2 week survives reload, branch travel and import with its own target',async()=>game(fixture(),async p=>{
  accept(p);
  const before=await p.evaluate(()=>{
    const m=state.missions;m.weeklyList=RepeatMissions.list(true);m.weeklyPolicy=2;
    Object.assign(m.weeklyList[0],{target:7,title:'일간 올클 7',current:4});m.weeklyStamps=4;
    save(true);return {list:structuredClone(m.weeklyList),coupons:state.coupons,cert:state.cert};
  });
  await p.reload();await p.locator('.navBtn[data-panel="mis"]').tap();
  assert.deepEqual(await p.evaluate(()=>state.missions.weeklyList),before.list);
  assert.equal(await p.locator('#weeklyStampRow > div').count(),7);
  assert.equal(await p.locator('#uiWeeklyStampText').innerText(),'4');
  for(const n of await p.locator('[data-weekly-stamp-target]').all())assert.equal(await n.innerText(),'7');
  await p.keyboard.press('Escape');
  await p.evaluate(()=>{state.regionUnlocked.busan=true;BranchManager.move('busan');});
  assert.equal(await p.evaluate(()=>RepeatMissions.weeklyStampTarget()),5);
  await p.evaluate(()=>BranchManager.move('changnyeong'));
  assert.equal(await p.evaluate(()=>importSaveData(exportSaveData())),true);
  assert.deepEqual(await p.evaluate(()=>state.missions.weeklyList),before.list);
  assert.deepEqual(await p.evaluate(()=>state.coupons),before.coupons);
  assert.deepEqual(await p.evaluate(()=>state.cert),before.cert);
  // The saved seven-clear week still needs seven, even though new weeks require five.
  const r=await p.evaluate(()=>{
    const m=state.missions;m.weeklyStamps=5;updateMissionsOnlineOnly();const atFive=m.weeklyList[0].done;
    m.weeklyStamps=6;m.dailyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();
    return {atFive,count:m.weeklyStamps,done:m.weeklyList[0].done};
  });assert.deepEqual(r,{atFive:false,count:7,done:true});
}));

test('exact next-week boundary switches seven to five without paying for opening the mission panel',async()=>game(fixture(),async p=>{
  await p.locator('.navBtn[data-panel="mis"]').tap();
  assert.equal(await p.locator('#weeklyStampRow > div').count(),7);
  const end=await p.evaluate(()=>state.missions.weekEndAt);
  await p.evaluate(t=>{window.testNow=t;sessionStorage.setItem('testNow',t);ensureMissionReset();updateUI();},end-1);
  assert.equal(await p.evaluate(()=>RepeatMissions.weeklyStampTarget()),7);
  await p.evaluate(t=>{window.testNow=t;sessionStorage.setItem('testNow',t);ensureMissionReset();updateUI();save(true);},end);
  assert.equal(await p.evaluate(()=>RepeatMissions.weeklyStampTarget()),5);
  assert.equal(await p.locator('#weeklyStampRow > div').count(),5);
  for(const n of await p.locator('[data-weekly-stamp-target]').all())assert.equal(await n.innerText(),'5');
  assert.match(await p.locator('#panel-mis > .note').innerText(),/주간 스탬프 5\/5/);
  assert.match(await p.locator('#weeklyList').innerText(),/일간 올클 5/);
  assert.equal(await p.locator('#weeklyStampRow').evaluate(e=>e.style.gridTemplateColumns),'repeat(5, 1fr)');
  const before=await p.evaluate(()=>({ledger:structuredClone(state.couponLedger),coupons:state.coupons,cert:state.cert}));
  await p.keyboard.press('Escape');await p.reload();await p.locator('.navBtn[data-panel="mis"]').tap();
  assert.equal(await p.evaluate(()=>RepeatMissions.weeklyStampTarget()),5);
  assert.deepEqual(await p.evaluate(()=>({ledger:state.couponLedger,coupons:state.coupons,cert:state.cert})),before);
}));

test('new five-clear v2 week finishes on day five, caps game stamps and pays weekly reward only once',async()=>game(fixture(),async p=>{
  await p.evaluate(()=>{window.testNow=state.missions.weekEndAt;sessionStorage.setItem('testNow',testNow);ensureMissionReset();});
  for(let day=1;day<=6;day++){
    if(day>1)await nextPeriod(p);
    const r=await p.evaluate(()=>{
      const m=state.missions;m.dailyList.forEach(g=>g.done=true);m.weeklyList.filter(g=>g.type!=='stamp').forEach(g=>g.done=true);
      updateMissionsOnlineOnly();updateMissionsOnlineOnly();
      return {count:m.weeklyStamps,stamp:m.weeklyList[0].done,completed:!!m.weeklyCompletedAt,paid:m.weeklyRewardPaid,lots:state.couponLedger.lots.length,stamps:state.couponLedger.stamps};
    });
    assert.equal(r.count,Math.min(day,5));assert.equal(r.stamp,day>=5);assert.equal(r.completed,day>=5);assert.equal(r.paid,day>=5);
    assert.equal(r.lots,day>=5?1:0);assert.equal(r.stamps,day+(day>=5?2:0));
  }
  await p.evaluate(()=>{generateWeeklyCertificate();generateWeeklyCertificate();save(true);});
  await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.stamps),8);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
  assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:0,veg:0});
}));
