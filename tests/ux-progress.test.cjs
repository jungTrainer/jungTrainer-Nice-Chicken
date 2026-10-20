const assert = require('node:assert/strict');
const {test} = require('node:test');
const {harness} = require('./helpers/game.cjs');
const {game,fixture} = harness();
const stable=p=>p.waitForFunction(()=>state.customers.length>0,null,{polling:50});
const snapshot=p=>p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty}));
const upgrade=p=>p.locator('[data-upgrade-id="signboard"]').locator('..');
async function open(p,key){await stable(p);await p.locator(`[data-panel="${key}"]`).tap();await p.waitForFunction(()=>{const r=document.querySelector('.panel.on').getBoundingClientRect();const t=getComputedStyle(document.querySelector('.panel.on')).transform;return r.top>=0&&r.top<20&&(t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)');},null,{polling:20});}
for(const money of [0,12400000,20000000])test(`upgrade progress at ${money} won uses exact price, preserves list order and excludes max levels`,async()=>game(fixture({money,upgrades:{deliVehicle:10}}),async p=>{
 await open(p,'upg');const before=await snapshot(p);
 const r=await p.evaluate(()=>{
  updateProgressUI('upg');const b=document.querySelector('[data-upgrade-id="signboard"]'),o=b.closest('.purchase-option');
  return {value:o.querySelector('progress').value,status:o.querySelector('.purchase-status').textContent,can:!b.disabled,highlight:o.classList.contains('is-affordable'),order:[...upgList.querySelectorAll('[data-upgrade-id]')].map(e=>e.dataset.upgradeId),expected:Object.values(Object.groupBy(UPGRADES,u=>u.cat)).flat().map(u=>u.id),canCount:[...upgList.querySelectorAll('[data-action="buy-upgrade"],[data-action="buy-staff-upgrade"]')].filter(e=>!e.disabled).length};
 });
 assert.equal(r.value,money/20000000);assert.equal(r.can,money>=20000000);assert.equal(r.highlight,r.can);assert.deepEqual(r.order,r.expected);
 assert.equal(r.status,money>=20000000?'살 수 있어요':`보유금 ${Math.floor(money/20000000*100)}%`);
 assert.equal(await p.locator('#upgradeSummary').innerText(),`지금 살 수 있는 것 ${r.canCount}개`);
 const max=p.locator('[data-upgrade-id="deliVehicle"]').locator('..');assert.equal(await max.locator('button').isDisabled(),true);assert.equal(await max.locator('progress').isVisible(),false);
 assert.deepEqual(await snapshot(p),before);
}));
test('one won below a regional upgrade price never displays affordable or 100 percent',async()=>game(fixture({regionId:'mars',regionUnlocked:{changnyeong:true,mars:true},endingPrompted:true,upgrades:{signboard:9}}),async p=>{
 await stable(p);await p.evaluate(()=>{state.money=moneySub(upgradeCost('signboard'),1);});await open(p,'upg');
 const b=p.locator('[data-upgrade-id="signboard"]'),card=b.locator('..');
 assert.equal(await b.isDisabled(),true);assert.match(await card.locator('.purchase-status').innerText(),/보유금 99%/);
 assert.ok(await card.locator('progress').evaluate(e=>e.value)<1);
 await p.evaluate(()=>{state.money=moneyAdd(state.money,1);updateUI();});assert.equal(await b.isEnabled(),true);assert.equal(await card.locator('.purchase-status').innerText(),'살 수 있어요');
 assert.equal(await b.getAttribute('data-cost'),String(await p.evaluate(()=>upgradeCost('signboard'))));
}));
test('staff education and summary refresh in place with exact affordability and maximum caps',async()=>game(fixture({money:0,upgrades:{hire:6}}),async p=>{
 await open(p,'upg');await p.evaluate(()=>{window.progressButton=document.getElementById('btn-auto-neighbor');state.staffStats.neighbor.tip=10;state.money=staffUpgradeCost('neighbor','auto',0);updateUI();});
 const b=p.locator('#btn-auto-neighbor');assert.equal(await b.isEnabled(),true);assert.equal(await b.locator('..').locator('.purchase-status').innerText(),'살 수 있어요');
 assert.equal(await p.evaluate(()=>progressButton===document.getElementById('btn-auto-neighbor')),true);
 assert.equal(await p.locator('#btn-tip-neighbor').isDisabled(),true);assert.equal(await p.locator('#btn-tip-neighbor').locator('..').locator('progress').isVisible(),false);
 const before=await snapshot(p);await p.evaluate(()=>updateProgressUI('upg'));assert.deepEqual(await snapshot(p),before);
}));
test('highlighted touch purchase still debits one canonical regional price and records once',async()=>game(fixture({money:1e12,regionId:'busan',regionUnlocked:{changnyeong:true,busan:true}}),async p=>{
 await open(p,'upg');const before=await p.evaluate(()=>({money:state.money,cost:upgradeCost('signboard'),buys:state.missions._upgBuysToday||0,ledger:JSON.stringify(state.couponLedger)}));
 await p.locator('[data-upgrade-id="signboard"]').tap();
 assert.equal(await p.evaluate(()=>state.money),await p.evaluate(b=>moneySub(b.money,b.cost),before));assert.equal(await p.evaluate(()=>state.upgrades.signboard),1);
 assert.equal(await p.evaluate(()=>state.missions._upgBuysToday),before.buys+1);assert.equal(await p.evaluate(()=>JSON.stringify(state.couponLedger)),before.ledger);
}));
test('mission progress and default-folded growth are pure views, including completed disclosure and legacy paid records',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
 await stable(p);await p.evaluate(()=>{const m=state.missions;m.dailyRewardPaid=m.weeklyRewardPaid=true;m.dailyList[0].current=3;m.dailyList[2].done=true;m.dailyList[2].current=1;});
 await open(p,'mis');const before=await snapshot(p);
 assert.equal(await p.locator('#uiDailyStampText').innerText(),'1');assert.equal(await p.locator('#growthDetails').evaluate(e=>e.open),false);assert.equal(await p.locator('#dailyList .card').nth(0).locator('progress').evaluate(e=>e.value),0.5);
 const pending=p.locator('#dailyList .card').nth(0),done=p.locator('#dailyList .card').nth(2);
 const lastPending=p.locator('#dailyList .card').nth(7).locator('summary');
 await lastPending.focus();await p.keyboard.press('Tab');assert.equal(await done.locator('summary').evaluate(e=>e===document.activeElement),true,'Tab follows the visual pending/done order');
 await p.keyboard.press('Shift+Tab');assert.equal(await lastPending.evaluate(e=>e===document.activeElement),true);
 const boxes=await Promise.all([pending.boundingBox(),done.boundingBox()]);assert.ok(boxes[1].y>boxes[0].y);
 assert.equal(await done.locator('details').evaluate(e=>e.open),false);assert.equal(await done.locator('.info').isVisible(),false);assert.equal(await done.locator('button').innerText(),'완료');
 await done.locator('summary').scrollIntoViewIfNeeded();await done.locator('summary').tap();assert.equal(await done.locator('progress').evaluate(e=>e.value),1);
 await done.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await done.locator('details').evaluate(e=>e.open),false);
 await p.locator('#growthDetails > summary').scrollIntoViewIfNeeded();await p.locator('#growthDetails > summary').tap();await p.evaluate(()=>{RepeatMissions.render();RepeatMissions.render();});assert.equal(await p.locator('#growthDetails').evaluate(e=>e.open),true);
 assert.deepEqual(await snapshot(p),before);
}));
test('live mission completion folds only once without replacing focused controls or reordering stored goals',async()=>game(fixture(),async p=>{
 await open(p,'mis');await p.locator('#startVisitChallenge').focus();
 const ids=await p.evaluate(()=>{window.progressRow=document.getElementById('dailyList').firstElementChild;return state.missions.dailyList.map(m=>m.id);});
 await p.evaluate(()=>{for(let i=0;i<6;i++)onServeOneOnline();updateUI();});
 assert.equal(await p.evaluate(()=>document.activeElement.id),'startVisitChallenge');assert.equal(await p.evaluate(()=>progressRow===document.getElementById('dailyList').firstElementChild),true);
 assert.deepEqual(await p.evaluate(()=>state.missions.dailyList.map(m=>m.id)),ids);
 const d=p.locator('#dailyList .card').first().locator('details');assert.equal(await d.evaluate(e=>e.open),false);
 await d.locator('summary').scrollIntoViewIfNeeded();await d.locator('summary').tap();await p.evaluate(()=>updateUI());assert.equal(await d.evaluate(e=>e.open),true,'ticks do not close a manually reopened completion');
}));
test('large money mission progress keeps exact one-won comparison and original current/paid fields',async()=>game(fixture(),async p=>{
 await stable(p);await p.evaluate(()=>{state.missions.dailyList=[{id:'huge',type:'earn',title:'큰 매출',current:'10000000000000000000000',target:'10000000000000000000001',done:false}];});await open(p,'mis');const before=await snapshot(p);
 assert.equal(await p.locator('#dailyList progress').evaluate(e=>e.value),0.999999);assert.equal(await p.locator('#dailyList button').innerText(),'진행중');
 await p.evaluate(()=>RepeatMissions.render());assert.deepEqual(await snapshot(p),before);
}));
test('stored completed goals retain a full bar without inferring new payments from inconsistent old counters',async()=>game(fixture(),async p=>{
 await stable(p);await p.evaluate(()=>{state.missions.dailyList=[{id:'paid',type:'serve',title:'기존 완료',current:0,target:6,done:true},{id:'zero',type:'serve',title:'목표 대기',current:0,target:0,done:false}];});await open(p,'mis');const before=await snapshot(p);
 assert.deepEqual(await p.locator('#dailyList progress').evaluateAll(es=>es.map(e=>e.value)),[1,0]);await p.evaluate(()=>RepeatMissions.render());assert.deepEqual(await snapshot(p),before);
}));
test('research deadline progress updates in place, rounds remaining seconds upward and never completes from viewing',async()=>game(fixture(),async p=>{
 await stable(p);await p.evaluate(()=>{const n=Date.now();state.research.running=[{activeId:'training',targetLevel:1,startAt:n-30000,endAt:n+30001}];});await open(p,'res');const before=await snapshot(p);
 assert.match(await p.locator('#resBar').innerText(),/직원 교육.*남은 시간 31초/);await p.evaluate(()=>window.researchBarNode=resBar.querySelector('progress'));
 await p.evaluate(()=>{window.testNow+=1001;updateProgressUI('res');});assert.match(await p.locator('#resBar').innerText(),/남은 시간 29초/);
 assert.equal(await p.evaluate(()=>researchBarNode===resBar.querySelector('progress')),true);assert.deepEqual(await snapshot(p),before);
 await p.evaluate(()=>{window.testNow=state.research.running[0].endAt;updateProgressUI('res');});assert.match(await p.locator('#resBar').innerText(),/100%.*완료 확인 중/);
 assert.equal(await p.evaluate(()=>state.research.levels.training||0),0);assert.deepEqual(await snapshot(p),before);
}));
test('every supplied research slot gets its own remaining time and bar; pure display never changes slot ownership',async()=>game(fixture(),async p=>{
 await open(p,'res');await p.evaluate(()=>{const n=Date.now();state.research.running=[{activeId:'training',targetLevel:1,startAt:n-30000,endAt:n+30000},{activeId:'secretSauce',targetLevel:1,startAt:n-15000,endAt:n+45000}];state.research.slots=2;});const before=await snapshot(p);
 await p.evaluate(()=>updateProgressUI('res'));assert.equal(await p.locator('#resBar progress').count(),2);assert.deepEqual(await p.locator('#resBar progress').evaluateAll(es=>es.map(e=>e.value)),[0.5,0.25]);
 assert.match(await p.locator('#resBar').innerText(),/직원 교육.*30초[\s\S]*비법 소스.*45초/);assert.deepEqual(await snapshot(p),before);
}));
test('research empty and zero-duration states remain finite and actual completion is owned by the unchanged gameplay path',async()=>game(fixture(),async p=>{
 await open(p,'res');assert.equal(await p.locator('#resBar progress').count(),0);
 await p.evaluate(()=>{state.research.running=[{activeId:'training',targetLevel:1,startAt:Date.now(),endAt:Date.now()}];updateProgressUI('res');});
 assert.equal(await p.locator('#resBar progress').evaluate(e=>e.value),1);assert.equal(await p.evaluate(()=>state.research.levels.training||0),0);
 await p.evaluate(()=>updateResearch());assert.equal(await p.evaluate(()=>state.research.levels.training),1);assert.equal(await p.locator('#resBar progress').count(),0);
 const before=await snapshot(p);await p.evaluate(()=>{updateProgressUI('res');updateProgressUI('res');});assert.deepEqual(await snapshot(p),before);
}));
for(const viewport of [{width:360,height:640},{width:390,height:844},{width:844,height:390}])test(`${viewport.width}x${viewport.height} progress panels support touch, summary keyboard, scroll, close and Escape focus`,async()=>game(fixture({money:12400000}),async p=>{
 await stable(p);const before=await snapshot(p);
 for(const key of ['upg','mis','res']){
  await open(p,key);const close=p.locator(`#panel-${key} .closeBtn`);const b=await close.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height&&b.height>=44);
  if(key==='mis'){const s=p.locator('#growthDetails > summary');await s.tap();await s.focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#growthDetails').evaluate(e=>e.open),false);}
  if(key==='res'){const b=p.locator('[data-action="start-research"]').last();await b.scrollIntoViewIfNeeded();const r=await b.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width&&r.height>=44);}
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.dataset.panel),key);
 }
 assert.deepEqual(await snapshot(p),before);
},{viewport}));
test('progress projection cannot call purchase, research completion, reward, dirty or persistence paths',async()=>game(fixture({money:1e8}),async p=>{
 await stable(p);await p.evaluate(()=>{renderPanel('upg');});const before=await snapshot(p);
 await p.evaluate(()=>{const forbidden=()=>{throw Error('display attempted mutation');};save=markStateChanged=buyUpgrade=buyStaffUpgrade=startResearch=updateResearch=updateMissionsOnlineOnly=forbidden;BenefitService.commit=forbidden;updateProgressUI('upg');updateProgressUI('res');});
 assert.deepEqual(await snapshot(p),before);
}));
test('reopening and reconnecting keep mission progress, paid, coupon and research timestamps unchanged',async()=>game(fixture(),async p=>{
 await stable(p);await p.evaluate(()=>{state.missions.dailyList[0].current=3;state.missions.dailyRewardPaid=true;const n=Date.now();state.research.running=[{activeId:'training',targetLevel:1,startAt:n-30000,endAt:n+30000}];save(true);});
 const data=()=>({goals:state.missions.dailyList,paid:state.missions.dailyRewardPaid,ledger:state.couponLedger,cert:state.cert,research:state.research.running});const before=await p.evaluate(data);
 for(const key of ['mis','res','upg']){await open(p,key);await p.keyboard.press('Escape');}
 assert.deepEqual(await p.evaluate(data),before);await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.deepEqual(await p.evaluate(data),before);
}));

test('huge cash never overflows display ratios or loses a won while viewing affordability',async()=>game(fixture({money:'10000000000000000000001',endingPrompted:true}),async p=>{
 await open(p,'upg');const before=await snapshot(p);
 assert.equal(await p.locator('[data-action="buy-upgrade"]:disabled').count(),0);
 assert.ok((await p.locator('.purchase-option progress').evaluateAll(es=>es.map(e=>e.value))).every(v=>v===1));
 await p.evaluate(()=>updateProgressUI('upg'));assert.deepEqual(await snapshot(p),before);
}));
