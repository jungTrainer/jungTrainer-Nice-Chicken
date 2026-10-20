const assert=require('node:assert/strict');
const {test}=require('node:test');
const {harness,NOW}=require('./helpers/game.cjs');
const {game,fixture}=harness();
const campaign=(mode='easy',regions={})=>({version:1,mode,selectedAt:NOW,regions});
const record={unlockedAt:NOW,seenAt:0,badgeAwarded:false};
const stable=p=>p.waitForFunction(()=>state.customers.length>0,null,{polling:50});
const snapshot=p=>p.evaluate(()=>({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty}));
const card=(p,id)=>p.locator(`.map-node[data-region-id="${id}"]`);
async function open(p){await stable(p);await p.locator('#openMap').tap();}
for(const viewport of [{width:360,height:640},{width:390,height:844},{width:640,height:360}])test(`${viewport.width}x${viewport.height} vertical map cards, footer disclosures, touch/keyboard and Escape are bounded and read-only`,async()=>game(fixture({money:1e7}),async p=>{
 await stable(p);const before=await snapshot(p);await open(p);
 assert.equal(await p.locator('.map-node').count(),6);assert.equal(await card(p,'changnyeong').getAttribute('aria-current'),'location');
 const geometry=await p.locator('#mapWrap').evaluate(e=>({w:e.clientWidth,scrollW:e.scrollWidth,h:e.clientHeight,scrollH:e.scrollHeight}));assert.ok(geometry.scrollW<=geometry.w+1&&geometry.scrollH>geometry.h);
 const first=await card(p,'changnyeong').boundingBox(),second=await card(p,'busan').boundingBox();assert.ok(second.y>=first.y+first.height&&Math.abs(first.x-second.x)<1);
 assert.equal(await p.locator('#mapMore').evaluate(e=>e.open),false);assert.match(await p.locator('#mapHint').innerText(),/지역 이야기 0\/6 · 가족 목표/);
 await p.locator('#mapMore > summary').tap();assert.equal(await p.locator('#mapMore').evaluate(e=>e.open),true);
 await p.locator('#mapMore > summary').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#mapMore').evaluate(e=>e.open),false);
 await card(p,'mars').scrollIntoViewIfNeeded();const last=await card(p,'mars').boundingBox();assert.ok(last.x>=0&&last.x+last.width<=viewport.width);
 const close=p.locator('#closeExpansionModalBtn');const b=await close.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height&&b.height>=44);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openMap');assert.deepEqual(await snapshot(p),before);
},{viewport}));
for(const mode of ['legacy','easy','normal'])test(`${mode}: card and toolbar share exact one-won unlock boundary and live funding progress`,async()=>game(fixture({campaign:campaign(mode,{changnyeong:record})}),async p=>{
 await stable(p);await p.evaluate(()=>{state.money=moneySub(getRegionUnlockCost('busan'),1);});await open(p);
 const c=card(p,'busan'),b=c.locator('button'),progress=c.locator('progress');assert.equal(await b.isDisabled(),true);assert.equal(await p.locator('#mapUnlock').isDisabled(),true);
 assert.match(await c.locator('.map-details').innerText(),/오픈까지 1원/);assert.ok(await progress.evaluate(e=>e.value)<1);assert.match(await c.locator('.map-progress-label').innerText(),/99%/);
 assert.equal(await b.getAttribute('data-cost'),String(await p.evaluate(()=>getRegionUnlockCost('busan'))));
 await p.evaluate(()=>{state.money=moneyAdd(state.money,1);updateUI();});assert.equal(await b.isEnabled(),true);assert.equal(await p.locator('#mapUnlock').isEnabled(),true);assert.equal(await progress.evaluate(e=>e.value),1);
}));
test('money alone cannot unlock a missing previous story or future region; viewing never calls story unlock',async()=>game(fixture({campaign:campaign(),money:1e12}),async p=>{
 await stable(p);await p.evaluate(()=>{state.campaign.regions={};});const before=await snapshot(p);await open(p);
 assert.equal(await card(p,'busan').locator('button').isDisabled(),true);assert.match(await card(p,'busan').locator('.map-details').innerText(),/창녕 본점 지역 이야기/);
 assert.equal(await card(p,'seoul').locator('button').isDisabled(),true);assert.match(await card(p,'seoul').locator('.map-details').innerText(),/먼저 부산 해운대/);
 assert.equal(await card(p,'busan').locator('progress').evaluate(e=>e.value),1);assert.deepEqual(await snapshot(p),before);
}));
test('one touch card unlock reuses one original handler and exact debit, then card movement preserves branch receipt and timers',async()=>game(fixture({money:50000000000,offlineReward:{amount:500,seconds:60}}),async p=>{
 await p.keyboard.press('Escape');await stable(p);await p.evaluate(()=>{state.serviceTimers.onlineOrders=.25;bindBranchServiceTimers();window.unlocks=0;window.moves=0;const un=BranchManager.unlockNext,move=BranchManager.move;BranchManager.unlockNext=function(...a){unlocks++;return un.apply(this,a);};BranchManager.move=function(...a){moves++;return move.apply(this,a);};});
 await open(p);const before=await p.evaluate(()=>({ledger:JSON.stringify(state.couponLedger),coupons:state.coupons,mission:structuredClone(state.missions),cash:state.money,cost:getRegionUnlockCost('busan')}));
 await card(p,'busan').locator('button').tap();assert.equal(await p.evaluate(()=>unlocks),1);assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),true);
 assert.equal(await p.evaluate(()=>state.money),await p.evaluate(b=>moneySub(b.cash,b.cost),before));
 await card(p,'busan').locator('button').tap();assert.equal(await p.evaluate(()=>moves),1);assert.equal(await p.evaluate(()=>state.regionId),'busan');
 assert.equal(await p.evaluate(()=>state.branches.changnyeong.data.offlineReward.amount),500);assert.equal(await p.evaluate(()=>state.branches.changnyeong.data.serviceTimers.onlineOrders),.25);
 assert.equal(await p.evaluate(()=>JSON.stringify(state.couponLedger)),before.ledger);assert.deepEqual(await p.evaluate(()=>state.coupons),before.coupons);
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.regionId),'busan');
}));
test('root Enter selects only; native card button Enter executes movement once and retains focus',async()=>game(fixture({regionUnlocked:{changnyeong:true,busan:true}}),async p=>{
 await open(p);await card(p,'busan').focus();const before=await p.evaluate(()=>state.money);await p.keyboard.press('Enter');
 assert.equal(await p.evaluate(()=>state.mapSelected),'busan');assert.equal(await p.evaluate(()=>state.regionId),'changnyeong');assert.equal(await p.evaluate(()=>state.money),before);
 await p.evaluate(()=>{window.moves=0;const move=BranchManager.move;BranchManager.move=function(...args){moves++;return move.apply(this,args);};});
 await card(p,'busan').locator('button').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>moves),1);assert.equal(await p.evaluate(()=>state.regionId),'busan');assert.equal(await p.evaluate(()=>document.activeElement.dataset.regionId),'busan');
}));
test('live map updates preserve selected card DOM, button focus, vertical scroll and expanded details without saving',async()=>game(fixture(),async p=>{
 await open(p);await p.locator('#mapMore > summary').tap();await card(p,'mars').scrollIntoViewIfNeeded();await card(p,'mars').focus();
 const before=await snapshot(p);const scroll=await p.locator('#mapWrap').evaluate(e=>e.scrollTop);
 await p.evaluate(()=>{window.mapNode=document.querySelector('.map-node[data-region-id="mars"]');for(let i=0;i<5;i++)updateUI();});
 assert.equal(await p.evaluate(()=>mapNode===document.querySelector('.map-node[data-region-id="mars"]')),true);assert.equal(await p.evaluate(()=>document.activeElement.dataset.regionId),'mars');
 assert.equal(await p.locator('#mapWrap').evaluate(e=>e.scrollTop),scroll);assert.equal(await p.locator('#mapMore').evaluate(e=>e.open),true);assert.deepEqual(await snapshot(p),before);
}));
test('archived branch sales and stored story target own display; unclaimed income is excluded',async()=>game(fixture({campaign:campaign('normal',{changnyeong:{...record,goalAtUnlock:'10000000000000000000001'}}),regionUnlocked:{changnyeong:true,busan:true},totalSales:5,offlineSalesTotal:2,offlineReward:{amount:'10000000000000000000000',seconds:60}}),async p=>{
 await p.keyboard.press('Escape');await stable(p);await p.evaluate(()=>{BranchManager.ensure('busan');state.branches.busan.data.totalSales=123456;state.branches.busan.data.offlineSalesTotal=7;});await open(p);
 const before=await snapshot(p);assert.equal(await card(p,'changnyeong').locator('progress').evaluate(e=>e.value),0);
 await p.locator('#mapMore > summary').tap();const details=p.locator('[data-region-details="busan"]');assert.match(await details.innerText(),/12.34만원/);
 assert.match(await card(p,'changnyeong').locator('.map-details').getAttribute('title'),/10,000,000,000,000,000,000,001원/);assert.deepEqual(await snapshot(p),before);
}));
test('huge funds and final region remain finite, with no next-cost bar or duplicated family/story effects',async()=>game(fixture({money:'10000000000000000000001',endingPrompted:true,regionId:'mars',regionUnlocked:{changnyeong:true,busan:true,seoul:true,japan:true,usa:true,mars:true},campaign:campaign('normal',Object.fromEntries(['changnyeong','busan','seoul','japan','usa','mars'].map(id=>[id,record])))}),async p=>{
 await open(p);const before=await snapshot(p);assert.equal(await p.locator('progress[data-progress-kind="cost"]:visible').count(),0);assert.equal(await p.locator('#mapUnlock').isDisabled(),true);
 await p.evaluate(()=>renderMapUI());assert.equal(await p.locator('#mapHint').innerText(),await p.evaluate(()=>`지역 이야기 6/6 · 가족 목표 ${fmtWon(Campaign.rules().ending)}`));assert.deepEqual(await snapshot(p),before);
}));
test('map projection and disclosures cannot normalize, settle, complete, mark dirty or save',async()=>game(fixture(),async p=>{
 await open(p);const before=await snapshot(p);await p.evaluate(()=>{const forbidden=()=>{throw Error('map view attempted mutation');};sanitizeState=save=markStateChanged=forbidden;Campaign.check=Campaign.updateUnlocks=Campaign.complete=forbidden;BenefitService.commit=forbidden;renderMapUI();});
 await p.locator('#mapMore > summary').tap();await p.keyboard.press('Escape');assert.deepEqual(await snapshot(p),before);
}));
test('failed card unlock preserves original money, region, paid, receipt and disk before a successful retry',async()=>game(fixture({money:50000000000}),async p=>{
 await open(p);await p.evaluate(()=>{save(true);window.baseSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return baseSet.call(this,k,v);};});const before=await snapshot(p);
 await card(p,'busan').locator('button').tap();assert.equal(await p.evaluate(()=>state.regionUnlocked.busan||false),false);assert.equal(await p.evaluate(()=>state.money),JSON.parse(before.state).money);assert.equal(await p.evaluate(()=>localStorage.getItem(SAVE_KEY)),before.primary);
 await p.evaluate(()=>{Storage.prototype.setItem=baseSet;});await card(p,'busan').locator('button').tap();assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),true);assert.equal(await p.evaluate(()=>state.money),0);
}));
