const assert=require('node:assert/strict'),path=require('node:path');
const {test}=require('node:test');
const {harness,NOW,KEY}=require('./helpers/game.cjs');
const {game,fixture}=harness();
const accept=p=>p.on('dialog',d=>d.accept());
async function activate(p){await p.evaluate(()=>{state.couponLedger.dailyFrom=state.couponLedger.weeklyFrom=Date.now();state.missions.dailyRewardPolicy=state.missions.weeklyRewardPolicy=2;save(true);});}
async function at(p,ts){await p.evaluate(ts=>{window.testNow=ts;sessionStorage.setItem('testNow',ts);},ts);}
async function open(p){await p.locator('#openSettings').tap();await p.locator('#openCoupons').tap();}
async function pin(p){await p.locator('#pinInput').fill('0000');await p.locator('#pinOk').tap();await p.waitForFunction(()=>!BenefitService.pending,null,{polling:50});}
async function visit(p,table='3번'){await p.locator('#serviceTable').fill(table);await p.locator('#startServiceVisit').tap();if(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')))await pin(p);}
async function quota(p,on=true){await p.evaluate(on=>{window.goodSet ||= Storage.prototype.setItem;Storage.prototype.setItem=on?function(k,v){if(k===SAVE_KEY)throw Error('synthetic primary quota');return goodSet.call(this,k,v);}:goodSet;},on);}
async function snap(p){return p.evaluate(()=>({money:state.money,ledger:structuredClone(state.couponLedger),coupons:state.coupons,visit:state.serviceVisit,cert:state.cert,log:state.benefitsLog,dirty:_saveDirty}));}
async function welcome(p){await p.locator('#nameInput').fill('방문검증');await p.locator('#saveName').tap();}
async function lot(p,type='drink',days=30,source='stamp_card'){return p.evaluate(({type,days,source})=>{const c=CouponPolicy.issue(type,source);c.expiresAt=Date.now()+days*86400000;save(true);return c.id;},{type,days,source});}

// Real new storage and the genuine first-completion input; no retroactive welcome migration.
test('welcome only after genuine fresh completion; KST next-midnight unlock and exact expiry',async()=>game(null,async p=>{
 accept(p);assert.equal(await p.evaluate(()=>state.couponLedger.welcomeEligible),true);
 await welcome(p);const l=await p.evaluate(()=>structuredClone(state.couponLedger));assert.equal(l.lots.length,1);
 const c=l.lots[0];assert.equal(c.source,'welcome');assert.equal(c.expiresAt-c.issuedAt,30*86400000);assert.equal(c.usableAt,Date.UTC(2026,9,12,15));
 assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),0);await open(p);assert.match(await p.locator('#datedCouponList').innerText(),/🔒 내일부터 사용 가능/);
 await at(p,c.usableAt-1);assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),0);
 await at(p,c.usableAt);assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),1);
 await at(p,c.expiresAt-1);assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),1);
 await at(p,c.expiresAt);assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),0);await p.evaluate(()=>CouponPolicy.render());assert.match(await p.locator('#datedCouponList').innerText(),/만료/);
}));

test('first-guide close gives nothing; reload resumes unfinished welcome, completion replay cannot mint',async()=>game(null,async p=>{
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);await p.reload();await p.evaluate(()=>SessionOwner.ready);await p.evaluate(()=>document.getElementById('splashScreen')?.remove());
 assert.equal(await p.locator('#modalProfile').evaluate(e=>e.classList.contains('on')),true);await welcome(p);
 assert.equal(await p.evaluate(()=>CouponPolicy.completeWelcome()),false);
 await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);assert.equal(await p.locator('#modalProfile').evaluate(e=>e.classList.contains('on')),false);
}));

test('welcome primary failure restores name/eligibility/lots/month quota; retry commits once',async()=>game(null,async p=>{
 await quota(p);await p.locator('#nameInput').fill('방문검증');await p.locator('#saveName').tap();
 assert.equal(await p.evaluate(()=>state.profile.name),'');assert.equal(await p.evaluate(()=>state.couponLedger.welcomeEligible),true);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);assert.deepEqual(await p.evaluate(()=>state.couponLedger.issuedMonths),{});
 assert.equal(await p.locator('#modalProfile').evaluate(e=>e.classList.contains('on')),true);
 await quota(p,false);await p.locator('#saveName').tap();await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);assert.equal(await p.evaluate(()=>state.couponLedger.welcomeEligible),false);
}));

test('v10 migration preserves unexpired legacy counts, paid/certificate/pending and never welcomes existing save',async()=>game(fixture({coupons:{drink:7,veg:9},offlineReward:{amount:123,seconds:60},cert:{issuedThisWeek:true,issuedAt:NOW,usedAt:0,validUntil:NOW+7*86400000}}),async p=>{
 assert.equal(await p.evaluate(()=>state.version),11);assert.equal(await p.evaluate(()=>state.couponLedger.welcomeEligible),false);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);
 assert.deepEqual(await p.evaluate(()=>state.coupons),{drink:7,veg:9});assert.equal(await p.evaluate(()=>state.offlineReward.amount),123);assert.equal(await p.evaluate(()=>state.cert.issuedThisWeek),true);
 await p.keyboard.press('Escape');await p.evaluate(()=>{document.getElementById('modalProfile').classList.add('on');});await welcome(p);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);
}));

test('legacy current day/week retain reward policy and future KST periods switch independently',async()=>game(fixture(),async p=>{
 const r=await p.evaluate(()=>{const l=state.couponLedger;return {d:state.missions.dailyRewardPolicy,w:state.missions.weeklyRewardPolicy,from:l.dailyFrom,week:l.weeklyFrom,end:state.missions.weekEndAt};});assert.equal(r.d,1);assert.equal(r.w,1);assert.equal(r.week,r.end);
 await at(p,r.from);await p.evaluate(()=>ensureMissionReset());assert.equal(await p.evaluate(()=>state.missions.dailyRewardPolicy),2);assert.equal(await p.evaluate(()=>state.missions.weeklyRewardPolicy),1);
 await at(p,r.week);await p.evaluate(()=>ensureMissionReset());assert.equal(await p.evaluate(()=>state.missions.weeklyRewardPolicy),2);assert.equal(await p.evaluate(()=>CouponPolicy.quote().modern),true);
}));

test('daily stamp is global across branches; per-branch completion and game weekly progress still recorded',async()=>game(fixture(),async p=>{
 await activate(p);const r=await p.evaluate(()=>{
  state.regionUnlocked.busan=true;
  const complete=()=>{state.missions.dailyRewardPolicy=2;state.missions.dailyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();};
  complete();const first=state.couponLedger.stamps;BranchManager.move('busan');complete();const second=state.couponLedger.stamps;const paid=state.missions.dailyCompletedToday;BranchManager.move('changnyeong');updateMissionsOnlineOnly();return {first,second,paid,stamps:state.couponLedger.stamps,old:state.coupons};
 });assert.deepEqual(r,{first:1,second:1,paid:true,stamps:1,old:{drink:0,veg:0}});await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.stamps),1);
}));

test('daily failed save preserves completed goals and retries one global stamp without duplicated paid',async()=>game(fixture(),async p=>{
 await activate(p);await quota(p);await p.evaluate(()=>{state.missions.dailyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();});assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);assert.equal(await p.evaluate(()=>state.missions.dailyCompletedToday),false);
 await quota(p,false);await p.evaluate(()=>{updateMissionsOnlineOnly();updateMissionsOnlineOnly();});assert.equal(await p.evaluate(()=>state.couponLedger.stamps),1);assert.equal(await p.evaluate(()=>state.missions.dailyCompletedToday),true);
}));

test('weekly clear gives +2 and dated veg once; certificate generation/reopening and second branch do not duplicate',async()=>game(fixture(),async p=>{
 await activate(p);const r=await p.evaluate(()=>{
  state.missions.weeklyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();generateWeeklyCertificate();generateWeeklyCertificate();
  const before=structuredClone(state.couponLedger);state.regionUnlocked.busan=true;BranchManager.move('busan');state.missions.weeklyRewardPolicy=2;state.missions.weeklyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();
  return {before,after:state.couponLedger,cert:state.cert,legacy:state.coupons};
 });assert.deepEqual(r.after,r.before);assert.equal(r.after.stamps,2);assert.equal(r.after.lots.length,1);assert.equal(r.after.lots[0].type,'veg');assert.equal(r.after.lots[0].expiresAt-r.after.lots[0].issuedAt,14*86400000);assert.equal(r.cert.rewardPolicy,2);assert.deepEqual(r.legacy,{drink:0,veg:0});
}));

test('weekly failed save rolls back completion/payment then successful retry pays once',async()=>game(fixture(),async p=>{
 await activate(p);await quota(p);await p.evaluate(()=>{state.missions.weeklyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();});assert.equal(await p.evaluate(()=>state.missions.weeklyCompletedAt),0);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);
 await quota(p,false);await p.evaluate(()=>{updateMissionsOnlineOnly();generateWeeklyCertificate();});assert.equal(await p.evaluate(()=>state.couponLedger.stamps),2);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
}));

test('certificate saved after a week boundary cannot repeat the completed weekly physical benefit',async()=>game(fixture(),async p=>{
 await activate(p);await p.evaluate(()=>{state.missions.weeklyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();});
 const before=await p.evaluate(()=>structuredClone(state.couponLedger));await at(p,NOW+86400000);await p.evaluate(()=>{generateWeeklyCertificate();generateWeeklyCertificate();});assert.deepEqual(await p.evaluate(()=>state.couponLedger),before);
}));

test('card conversion preserves surplus; a full already-issued card caps at 30 and pays once next month',async()=>game(fixture(),async p=>{
 await activate(p);const first=await p.evaluate(()=>{state.couponLedger.stamps=29;BenefitService.commit(()=>CouponPolicy.addStamps(5,'test'));return structuredClone(state.couponLedger);});assert.equal(first.stamps,4);assert.equal(first.lots.length,1);assert.equal(first.issuedMonths['2026-10'],1);
 await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(99,'test')));assert.equal(await p.evaluate(()=>state.couponLedger.stamps),30);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
 await at(p,Date.UTC(2026,9,31,14,59,59,999));assert.equal(await p.evaluate(()=>CouponPolicy.maybeSettle(true)),false);await p.evaluate(()=>save(true));
 await at(p,Date.UTC(2026,9,31,15));await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),2);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);assert.equal(await p.evaluate(()=>state.couponLedger.issuedMonths['2026-11']),1);
 assert.equal(await p.evaluate(()=>CouponPolicy.maybeSettle(true)),false);await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),2);
}));

test('welcome consumes the monthly slot; its reserved card waits and carries max 30 until next month',async()=>game(null,async p=>{
 await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(30,'test')));assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);
 await welcome(p);await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(5,'test')));assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),30);
 await at(p,Date.UTC(2026,9,31,15));assert.equal(await p.evaluate(()=>CouponPolicy.maybeSettle(true)),true);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),2);
}));

test('monthly deferred issue storage failure retains complete card and quota; explicit retry issues once',async()=>game(fixture(),async p=>{
 await activate(p);await p.evaluate(()=>{state.couponLedger.stamps=30;save(true);state.money=123;markStateChanged('unsaved-test');});const before=await snap(p);await quota(p);assert.equal(await p.evaluate(()=>CouponPolicy.maybeSettle(true)),false);assert.deepEqual(await snap(p),before);
 await quota(p,false);assert.equal(await p.evaluate(()=>CouponPolicy.maybeSettle(true)),true);assert.equal(await p.evaluate(()=>state.money),123);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
}));

test('staff PIN visit +5 is device-wide per KST day; preview/cancel/new tables cannot mint again',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await open(p);await p.locator('#serviceTable').fill('3번');await p.locator('#startServiceVisit').tap();assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>state.serviceVisit),null);
 await visit(p);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),5);await visit(p,'8번');assert.equal(await p.evaluate(()=>state.couponLedger.stamps),5);
 await p.locator('#showStaffCoupon').tap();await p.locator('#hideStaffCoupon').tap();assert.equal(await p.evaluate(()=>state.couponLedger.stamps),5);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.evaluate(()=>{state.regionUnlocked.busan=true;BranchManager.move('busan');});await open(p);await visit(p);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),5);
 await at(p,NOW+86400000);await visit(p);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),10);
}));

test('staff PIN visit failed save rolls back visit/stamps, retains unsaved game income and retries',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await open(p);await p.evaluate(()=>{state.money=123;markStateChanged('unsaved-test');});const before=await snap(p);await quota(p);await visit(p);assert.deepEqual(await snap(p),before);await quota(p,false);await visit(p);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),5);assert.equal(await p.evaluate(()=>state.money),123);
}));

test('new exchange quote is deterministic and uses one exact price/weekly claim/debit across branch switch',async()=>game(fixture({money:'10000000000000000000001',endingPrompted:true,upgrades:{hire:6,expand:10},delivery:{level:1,riders:3}}),async p=>{
 await activate(p);const q=await p.evaluate(()=>{const old=Math.random;const timers=JSON.stringify(ServiceRuntime);Math.random=()=>0;const a=CouponPolicy.quote();Math.random=()=>0.999;const b=CouponPolicy.quote();Math.random=old;if(JSON.stringify(ServiceRuntime)!==timers)throw Error('quote changed service runtime');return {a,b};});assert.deepEqual(q.a,q.b);assert.ok(BigInt(q.a.price)>50000000n);assert.equal(BigInt(q.a.price),BigInt(q.a.minute)*120n);
 await p.locator('#openSettings').tap();await p.locator('#openExchange').tap();assert.equal(await p.locator('#doExchange').getAttribute('data-cost'),String(q.a.price));assert.equal(await p.locator('#exchangePrice').getAttribute('title'),BigInt(q.a.price).toLocaleString('ko-KR')+'원');
 const money=await p.evaluate(()=>state.money);await p.locator('#doExchange').tap();assert.equal(BigInt(money)-BigInt(await p.evaluate(()=>state.money)),BigInt(q.a.price));assert.equal(await p.evaluate(()=>state.couponLedger.stamps),2);assert.equal(await p.locator('#doExchange').isDisabled(),true);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.evaluate(()=>{state.regionUnlocked.busan=true;BranchManager.move('busan');});assert.equal(await p.evaluate(()=>CouponPolicy.quote().remaining),0);
}));

test('exchange rejects price changes without debit and minimum/one-won affordability match',async()=>game(fixture({money:49999999}),async p=>{
 await activate(p);assert.equal(await p.evaluate(()=>CouponPolicy.quote().price),50000000);assert.equal(await p.evaluate(()=>CouponPolicy.quote().allowed),false);
 await p.evaluate(()=>{state.money=50000000;});await p.locator('#openSettings').tap();await p.locator('#openExchange').tap();assert.equal(await p.locator('#doExchange').isDisabled(),false);
 await p.evaluate(()=>{state.upgrades.expand=20;invalidateDerivedEffects();});const money=await p.evaluate(()=>state.money);assert.equal(await p.evaluate(()=>CouponPolicy.exchange(1)),false);assert.equal(await p.evaluate(()=>state.money),money);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);
}));

test('exchange primary failure restores money/stamps/quota then one successful retry survives reload',async()=>game(fixture({money:'1000000000000000000'}),async p=>{
 await activate(p);await p.locator('#openSettings').tap();await p.locator('#openExchange').tap();const before=await snap(p);await quota(p);await p.locator('#doExchange').tap();assert.deepEqual(await snap(p),before);await quota(p,false);await p.locator('#doExchange').tap();await p.reload();assert.equal(await p.evaluate(()=>state.couponLedger.stamps),2);assert.equal(await p.evaluate(()=>CouponPolicy.quote().remaining),0);
}));

test('expired/locked lots are excluded; earliest expiry precedes unexpired legacy quantity',async()=>game(fixture({coupons:{drink:3,veg:2}}),async p=>{
 accept(p);await activate(p);const later=await lot(p,'drink',30),first=await lot(p,'drink',1);await lot(p,'drink',14,'welcome');await p.evaluate(()=>{state.couponLedger.lots.at(-1).usableAt=Date.now()+3600000;save(true);});
 await open(p);await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);assert.equal(await p.evaluate(id=>state.couponLedger.lots.find(c=>c.id===id).usedAt,first),NOW);assert.equal(await p.evaluate(id=>state.couponLedger.lots.find(c=>c.id===id).usedAt,later),0);assert.equal(await p.evaluate(()=>state.coupons.drink),3);
 assert.match(await p.locator('#staffCouponStatus').innerText(),/오늘 사용함/);assert.equal(await p.locator('#useDrinkCoupon').isDisabled(),true);
 await at(p,NOW+31*86400000);assert.equal(await p.evaluate(()=>CouponPolicy.available('drink')),3);
}));

test('same device daily use limit survives new visits, branch/date changes and log clearing',async()=>game(fixture({coupons:{drink:3,veg:0}}),async p=>{
 accept(p);await open(p);await visit(p);await p.locator('#useDrinkCoupon').tap();await pin(p);await visit(p,'8번');assert.equal(await p.evaluate(()=>useCoupon('drink')),false);await p.locator('#clearLog').tap();assert.equal(await p.evaluate(()=>CouponPolicy.usedToday()),1);
 await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.evaluate(()=>{state.regionUnlocked.busan=true;BranchManager.move('busan');});assert.equal(await p.evaluate(()=>CouponPolicy.canUse('drink')),false);
 await at(p,Date.UTC(2026,9,12,15));assert.equal(await p.evaluate(()=>CouponPolicy.canUse('drink')),true);
 await p.reload();assert.equal(await p.evaluate(()=>state.coupons.drink),2);assert.equal(await p.evaluate(()=>state.couponLedger.usedDays['2026-10-12']),1);
}));

test('dated use primary failure restores usedAt/day/visit/log and successful retry consumes once',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);const id=await lot(p);await open(p);await visit(p);const before=await snap(p);await quota(p);await p.locator('#useDrinkCoupon').tap();await pin(p);assert.deepEqual(await snap(p),before);await quota(p,false);await p.locator('#useDrinkCoupon').tap();await pin(p);assert.equal(await p.evaluate(()=>document.activeElement.closest('#modalCoupons')!==null),true);assert.equal(await p.evaluate(id=>state.couponLedger.lots.find(c=>c.id===id).usedAt,id),NOW);assert.equal(await p.evaluate(()=>CouponPolicy.usedToday()),1);
}));

test('same and forged-future backup imports preserve the current new ledger exactly, never add stamp/month/lot rights',async()=>game(fixture({coupons:{drink:3,veg:7}}),async p=>{
 accept(p);await activate(p);await lot(p);const r=await p.evaluate(()=>{
  const old=exportSaveData();BenefitService.commit(()=>{CouponPolicy.addStamps(7,'test');state.couponLedger.lots[0].usedAt=Date.now();state.couponLedger.usedDays[CouponPolicy.day()]=1;state.couponLedger.issuedMonths[CouponPolicy.month()]=1;});
  const current=structuredClone(state.couponLedger);
  const first=importSaveData(old),after=structuredClone(state.couponLedger);
  const future=JSON.parse(old);future.data.couponLedger.stamps=30;future.data.couponLedger.lots[0].usedAt=0;future.data.couponLedger.issuedMonths={};
  const second=importSaveData(JSON.stringify(future));return {first,second,current,after,final:state.couponLedger};
 });assert.equal(r.first,true);assert.equal(r.second,true);assert.deepEqual(r.after,r.current);assert.deepEqual(r.final,r.current);await p.reload();assert.deepEqual(await p.evaluate(()=>state.couponLedger),r.current);
}));

test('reset preserves physical ledger/limits, removes welcome eligibility and cannot revive imported spent coupons',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await lot(p);const before=await p.evaluate(()=>{state.couponLedger.stamps=12;state.couponLedger.issuedMonths[CouponPolicy.month()]=1;state.couponLedger.usedDays[CouponPolicy.day()]=1;save(true);return structuredClone(state.couponLedger);});
 await p.evaluate(()=>resetGame());assert.deepEqual(await p.evaluate(()=>state.couponLedger),before);assert.equal(await p.evaluate(()=>state.couponLedger.welcomeEligible),false);assert.equal(await p.evaluate(()=>CouponPolicy.completeWelcome()),false);assert.equal(await p.evaluate(()=>state.regionId),'changnyeong');
}));

test('explicit backup recovery preserves a newer in-memory new ledger instead of resurrecting older spent rights',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await lot(p);const before=await p.evaluate(()=>{localStorage.setItem(SAVE_BACKUP_KEY,JSON.stringify(state));state.couponLedger.lots[0].usedAt=Date.now();state.couponLedger.usedDays[CouponPolicy.day()]=1;save(true);localStorage.setItem(SAVE_KEY,'{broken');SaveRecovery.open();return structuredClone(state.couponLedger);});
 await p.locator('#recoverBackup').tap();assert.deepEqual(await p.evaluate(()=>state.couponLedger),before);
}));

test('invalid ledger/future versions/duplicate lots and negative stamps fail import without changing raw primary',async()=>game(fixture(),async p=>{
 accept(p);const result=await p.evaluate(()=>{
  const raw=localStorage.getItem(SAVE_KEY),results=[];
  for(const edit of [l=>l.version=2,l=>l.stamps=-1,l=>l.stamps=31,l=>l.lots=[{id:'x',type:'drink',source:'welcome',issuedAt:1,usableAt:2,expiresAt:1,usedAt:0}],l=>l.claims.daily=null]){
   const b=JSON.parse(exportSaveData());edit(b.data.couponLedger);results.push(importSaveData(JSON.stringify(b)));if(localStorage.getItem(SAVE_KEY)!==raw)throw Error('raw changed');
  }return results;
 });assert.deepEqual(result,[false,false,false,false,false]);
}));

for(const zone of ['UTC','America/New_York'])test(`policy uses Korean midnight/month/year/Monday boundaries in ${zone}`,async()=>game(fixture(),async p=>{
 const r=await p.evaluate(()=>[Date.UTC(2026,9,31,14,59,59,999),Date.UTC(2026,9,31,15),Date.UTC(2026,11,31,15),Date.UTC(2026,9,18,15)].map(t=>({day:CouponPolicy.day(t),month:CouponPolicy.month(t),week:CouponPolicy.week(t)})));
 assert.equal(r[0].day,'2026-10-31');assert.equal(r[1].day,'2026-11-01');assert.equal(r[2].month,'2027-01');assert.equal(r[3].week,'2026-10-19');assert.equal(r[1].week,'2026-10-26');
},{timezoneId:zone}));

for(const [name,viewport] of [['portrait',{width:360,height:640}],['landscape',{width:640,height:360}]])test(`${name} stamps/dates/staff touch/PIN/cancel/focus/scroll remain accessible without view payouts`,async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await lot(p,'veg',14,'weekly');await open(p);const before=await snap(p);await p.locator('#datedCouponList').scrollIntoViewIfNeeded();assert.match(await p.locator('#couponPolicyStatus').innerText(),/음료 스탬프 0\/30/);assert.match(await p.locator('#datedCouponList').innerText(),/사용 가능.*만료/s);
 await p.locator('#showStaffCoupon').tap();assert.match(await p.locator('#staffCouponStatus').innerText(),/오늘 음료 미사용/);await p.locator('#hideStaffCoupon').tap();assert.deepEqual(await snap(p),before);
 await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/imp18-${name}-coupons.png`)});
 await p.locator('#serviceTable').fill('3번');await p.locator('#startServiceVisit').tap();for(let i=0;i<4;i++)await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.closest('#modalPin')!==null),true);await p.keyboard.press('Escape');assert.deepEqual(await snap(p),before);
 const b=await p.locator('[data-ui-close="modalCoupons"]').boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openCoupons');
},{viewport}));

test('reader cannot mutate coupon ledger; handoff inherits latest stamp/issued/used state once',async()=>game(fixture(),async p=>{
 await activate(p);await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(12,'test')));
 const b=await p.context().newPage();await b.goto(p.url());await b.evaluate(()=>SessionOwner.ready);await b.evaluate(()=>document.getElementById('splashScreen')?.remove());
 const result=await b.evaluate(()=>{const before=JSON.stringify(state.couponLedger);return {calls:[CouponPolicy.addStamps(10,'reader'),CouponPolicy.issue('drink','reader'),CouponPolicy.completeWelcome(),CouponPolicy.dailyReward(),CouponPolicy.exchange(50000000)],same:JSON.stringify(state.couponLedger)===before};});assert.deepEqual(result.calls,[false,false,false,false,false]);assert.equal(result.same,true);
 await b.locator('#sessionRequest').tap();assert.equal(await p.evaluate(()=>SessionOwner.yieldWriter()),true);await b.waitForFunction(()=>SessionOwner.canMutate(),null,{polling:100});assert.equal(await b.evaluate(()=>state.couponLedger.stamps),12);assert.equal(await b.evaluate(()=>state.couponLedger.lots.length),0);await b.close();
}));

test('late staff visit PIN after import cannot create a visit or stamp on replaced root',async()=>game(fixture(),async p=>{
 accept(p);await activate(p);await open(p);await p.locator('#serviceTable').fill('3번');await p.locator('#startServiceVisit').tap();
 const backup=await p.evaluate(()=>exportSaveData());assert.equal(await p.evaluate(raw=>importSaveData(raw),backup),true);await pin(p);
 assert.equal(await p.evaluate(()=>state.serviceVisit),null);assert.equal(await p.evaluate(()=>state.couponLedger.stamps),0);
}));

test('huge exchange price and debit remain exact won strings above safe integers',async()=>game(fixture({regionId:'mars',regionUnlocked:{changnyeong:true,mars:true},level:999,money:'100000000000000000000000000000000000000',endingPrompted:true,upgrades:{hire:6,expand:20},menuLevels:{fried:10000},delivery:{level:9,riders:10}}),async p=>{
 await activate(p);const q=await p.evaluate(()=>CouponPolicy.quote());assert.equal(typeof q.price,'string');assert.equal(BigInt(q.price),BigInt(q.minute)*120n);const cash=await p.evaluate(()=>state.money);
 assert.equal(await p.evaluate(price=>CouponPolicy.exchange(price),q.price),true);assert.equal(BigInt(await p.evaluate(()=>state.money)),BigInt(cash)-BigInt(q.price));assert.equal(await p.evaluate(()=>state.couponLedger.stamps),2);
}));

test('price representation failure stops exchange without free stamps or money loss',async()=>game(fixture(),async p=>{
 await activate(p);const before=await snap(p);const result=await p.evaluate(()=>{MENU_MAP.fried.price='9'.repeat(4096);return CouponPolicy.quote();});assert.equal(result.price,null);assert.equal(result.allowed,false);assert.equal(await p.evaluate(()=>CouponPolicy.exchange('')),false);assert.deepEqual(await snap(p),before);
}));

test('pre-use import cannot erase known table provision or current local use history on the next day',async()=>game(fixture({coupons:{drink:3,veg:0}}),async p=>{
 accept(p);await open(p);await visit(p);const old=await p.evaluate(()=>exportSaveData());await p.locator('#useDrinkCoupon').tap();await pin(p);
 const current=await p.evaluate(()=>({v:structuredClone(state.serviceVisit),logs:structuredClone(state.benefitsLog)}));
 assert.equal(await p.evaluate(raw=>importSaveData(raw),old),true);assert.deepEqual(await p.evaluate(()=>state.serviceVisit),current.v);assert.deepEqual(await p.evaluate(()=>state.benefitsLog),current.logs);
 await at(p,NOW+86400000);assert.equal(await p.evaluate(()=>useCoupon('drink')),false);assert.equal(await p.locator('#modalPin').evaluate(e=>e.classList.contains('on')),false);
}));
