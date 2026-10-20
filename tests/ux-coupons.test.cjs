const assert = require('node:assert/strict');
const {test} = require('node:test');
const {harness, NOW} = require('./helpers/game.cjs');
const {game, fixture} = harness();
const stable = p => p.waitForFunction(() => state.customers.length > 0, null, {polling:50});
const snapshot = p => p.evaluate(() => ({state:JSON.stringify(state), primary:localStorage.getItem(SAVE_KEY), backup:localStorage.getItem(SAVE_BACKUP_KEY), dirty:_saveDirty}));
const ready = async p => { await p.evaluate(() => SessionOwner.ready); await p.evaluate(() => document.getElementById('splashScreen')?.remove()); };
async function seed(p) {
  await stable(p);
  await p.evaluate(() => {
    const now = Date.now(), day = CouponPolicy.dayMs;
    const lot = (id, extra) => ({id, type:'drink', source:'stamp_card', issuedAt:now-day, usableAt:now-day, expiresAt:now+day*10, usedAt:0, ...extra});
    state.couponLedger.stamps = 12;
    state.couponLedger.lots = [lot('late',{}), lot('locked',{source:'welcome',usableAt:CouponPolicy.dayStart()+day}), lot('soon',{type:'veg',expiresAt:now+day}), lot('expired',{expiresAt:now}), lot('used',{usedAt:now-1})];
    updateUI(); save(true);
  });
}
for (const width of [360,390]) {
  test(`${width}px header opens one shared coupon box; card order, counts, touch and Escape are read-only`, async () => game(fixture({coupons:{drink:2,veg:1}}), async p => {
    await seed(p); const before = await snapshot(p);
    assert.match(await p.locator('#couponChip').innerText(), /음료 스탬프 12\/30 · 🎟️ 사용 가능 5장/);
    await p.locator('#couponChip').tap();
    assert.equal(await p.locator('#panel-shr').evaluate(e=>e.classList.contains('on')), true);
    assert.equal(await p.locator('#couponContents').count(), 1);
    assert.equal(await p.locator('#couponStampGrid > span').count(), 30);
    assert.equal(await p.locator('#couponStampGrid .filled').count(), 12);
    assert.deepEqual(await p.locator('#datedCouponList [data-coupon-id]').evaluateAll(es=>es.map(e=>e.dataset.couponId)), ['soon','late','locked']);
    assert.match(await p.locator('[data-coupon-id="soon"]').innerText(), /사용 가능 · D-1/);
    assert.match(await p.locator('[data-coupon-id="locked"]').innerText(), /🔒 내일부터 사용 가능/);
    assert.deepEqual(await p.locator('#couponContents > section, #couponContents > details').evaluateAll(es=>es.map(e=>e.id)), ['couponStamps','couponCardsSection','couponHow','couponCertificate','couponStaff','couponHistory']);
    assert.equal(await p.locator('#couponEarningMethods li').count(),4);
    assert.equal(await p.locator('#couponHistory').evaluate(e=>e.open),false);
    await p.locator('#couponHistory > summary').tap();
    assert.match(await p.locator('#couponPastLots').innerText(), /만료/);
    await p.locator('#couponHistory > summary').focus(); await p.keyboard.press('Enter');
    await p.keyboard.press('Escape'); assert.equal(await p.evaluate(()=>document.activeElement.id),'couponChip');
    assert.deepEqual(await snapshot(p),before);
    await p.locator('[data-panel="shr"]').tap();
    assert.match(await p.locator('[data-panel="shr"]').innerText(),/쿠폰함/);
    assert.equal(await p.locator('#panel-shr #couponCertificate').count(),1);
    await p.keyboard.press('Escape');
    await p.locator('#openSettings').tap(); await p.locator('#openCoupons').tap();
    assert.equal(await p.locator('#modalCoupons #couponContents').count(),1);
    assert.equal(await p.locator('#makeCard').count(),1);
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
    await p.locator('#couponChip').tap(); assert.equal(await p.locator('#panel-shr #couponContents').count(),1);
    await p.keyboard.press('Escape'); assert.deepEqual(await snapshot(p),before);
  }, {viewport:{width,height:844}}));
  test(`${width}px coupon keyboard trap, staff preview and close controls remain reachable without writes`, async () => game(fixture(), async p => {
    await seed(p); const before=await snapshot(p); await p.locator('#couponChip').focus(); await p.keyboard.press('Enter');
    await p.waitForFunction(()=>document.activeElement.id==='couponPolicyStatus',null,{polling:20});
    for(let i=0;i<22;i++) await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(()=>!!document.activeElement.closest('#panel-shr,nav')),true);
    await p.locator('#showStaffCoupon').tap(); assert.equal(await p.locator('#staffCouponView').isVisible(),true);
    assert.equal(await p.locator('#couponHistory').evaluate(e=>e.open),true,'staff preview also exposes before/after records');
    await p.locator('#hideStaffCoupon').tap(); assert.equal(await p.evaluate(()=>document.activeElement.id),'showStaffCoupon');
    const close=p.locator('#panel-shr .closeBtn'); await close.tap();
    assert.equal(await p.evaluate(()=>document.activeElement.id),'couponChip');
    assert.deepEqual(await snapshot(p),before);
    const b=await p.locator('#couponChip').boundingBox(); assert.ok(b.height>=44 && b.x>=0 && b.x+b.width<=width);
  }, {viewport:{width,height:640}}));
}
test('coupon view never calls normalization, reward settlement or benefit commits', async () => game(fixture(), async p => {
  await seed(p); const before=await snapshot(p);
  await p.evaluate(()=>{
    const forbidden=()=>{throw Error('view attempted mutation');};
    sanitizeState=forbidden; BenefitService.commit=forbidden;
    for(const key of ['settle','maybeSettle','completeWelcome','addStamps','issue','consume']) CouponPolicy[key]=forbidden;
  });
  await p.locator('#couponChip').tap(); await p.locator('#couponHow summary').tap();
  await p.locator('#couponHistory summary').tap(); await p.keyboard.press('Escape');
  assert.deepEqual(await snapshot(p),before);
}));
test('welcome celebration and KST availability notice appear once without issuing again', async () => game(null, async p => {
  await p.locator('#nameInput').fill('첫방문'); await p.locator('#saveName').tap();
  await p.waitForSelector('#couponNotice:not([hidden])');
  assert.match(await p.locator('#couponNoticeText').innerText(),/웰컴 음료 1장 받았어요.*내일 방문 때/);
  const ledger=await p.evaluate(()=>structuredClone(state.couponLedger)); assert.equal(ledger.lots.length,1);
  await p.locator('#couponNoticeOpen').tap(); assert.equal(await p.locator('#panel-shr').evaluate(e=>e.classList.contains('on')),true);
  await p.keyboard.press('Escape'); assert.equal(await p.evaluate(()=>document.activeElement.id),'couponChip');
  await p.reload(); await ready(p);
  assert.equal(await p.locator('#couponNotice').isVisible(),false);
  // Advance only the next document: the current page has not yet crossed midnight.
  await p.evaluate(ts=>sessionStorage.setItem('testNow',ts),ledger.lots[0].usableAt);
  await p.reload(); await ready(p);
  // Reconnection can have already-confirmed offline income; close it without claiming.
  if(await p.locator('#modalOffline').evaluate(e=>e.classList.contains('on'))) await p.keyboard.press('Escape');
  await p.waitForSelector('#couponNotice:not([hidden])');
  assert.match(await p.locator('#couponNoticeText').innerText(),/오늘부터 웰컴 음료/);
  assert.deepEqual(await p.evaluate(()=>state.couponLedger),ledger);
  await p.locator('#couponNoticeClose').tap(); await p.evaluate(()=>updateUI());
  assert.equal(await p.locator('#couponNotice').isVisible(),false);
  await p.reload(); await ready(p); assert.equal(await p.locator('#couponNotice').isVisible(),false);
  assert.deepEqual(await p.evaluate(()=>state.couponLedger),ledger);
  assert.equal(await p.evaluate(()=>JSON.parse(exportSaveData()).data.niceChicken_couponPresentation_v1),undefined);
}));
test('failed welcome save shows no success display; retry celebrates the single committed coupon', async () => game(null, async p => {
  await p.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return realSet.call(this,k,v);};});
  await p.locator('#nameInput').fill('첫방문'); await p.locator('#saveName').tap();
  assert.equal(await p.locator('#couponNotice').isVisible(),false); assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);
  assert.equal(await p.evaluate(()=>localStorage.getItem(CouponPolicy.presentation.key)),null);
  await p.evaluate(()=>{Storage.prototype.setItem=realSet;}); await p.locator('#saveName').tap();
  assert.equal(await p.locator('#couponNotice').isVisible(),true); assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
}));
test('display preference failure does not fail a committed welcome or repeat in the current document', async () => game(null, async p => {
  await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===CouponPolicy.presentation.key)throw Error('UI preference quota');return set.call(this,k,v);};});
  await p.locator('#nameInput').fill('첫방문'); await p.locator('#saveName').tap();
  assert.equal(await p.locator('#couponNotice').isVisible(),true);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(SAVE_KEY)).couponLedger.lots.length),1);
  await stable(p); const before=await snapshot(p); await p.locator('#couponNoticeClose').tap();
  for(let i=0;i<5;i++) await p.evaluate(()=>updateUI());
  assert.equal(await p.locator('#couponNotice').isVisible(),false); assert.deepEqual(await snapshot(p),before);
}));
test('successful daily/weekly/exchange/visit paths show their existing stamp result once', async () => game(fixture({money:1e12}), async p => {
  p.on('dialog',d=>d.accept()); await stable(p);
  await p.evaluate(()=>{state.couponLedger.dailyFrom=state.couponLedger.weeklyFrom=Date.now();state.missions.dailyRewardPolicy=state.missions.weeklyRewardPolicy=2;state.missions.dailyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();});
  assert.match(await p.locator('#couponStampToast').innerText(),/음료 스탬프 \+1 \(1\/30\)/);
  await p.evaluate(()=>{state.missions.weeklyList.forEach(g=>g.done=true);updateMissionsOnlineOnly();});
  assert.match(await p.locator('#couponStampToast').innerText(),/음료 스탬프 \+2 \(3\/30\)/);
  await p.locator('#openSettings').tap(); await p.locator('#openExchange').tap(); await p.locator('#doExchange').tap();
  assert.match(await p.locator('#couponStampToast').innerText(),/음료 스탬프 \+2 \(5\/30\)/);
  await p.keyboard.press('Escape'); await p.locator('#openCoupons').tap();
  await p.locator('#serviceTable').fill('검사'); await p.locator('#startServiceVisit').tap();
  await p.locator('#pinInput').fill('0000'); await p.locator('#pinOk').tap();
  await p.waitForFunction(()=>!BenefitService.pending,null,{polling:20});
  assert.match(await p.locator('#couponStampToast').innerText(),/음료 스탬프 \+5 \(10\/30\)/);
  const ledger=await p.evaluate(()=>structuredClone(state.couponLedger)); await p.reload(); await ready(p);
  assert.equal(await p.locator('#couponStampToast').isVisible(),false); assert.deepEqual(await p.evaluate(()=>state.couponLedger),ledger);
}));
test('failed stamp commit produces no toast; card conversion shows awarded quantity and actual remainder', async () => game(fixture(), async p => {
  await stable(p); await p.evaluate(()=>save(true)); const before=await snapshot(p);
  const failed=await p.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===SAVE_KEY)throw Error('quota');return set.call(this,k,v);};const ok=BenefitService.commit(()=>CouponPolicy.addStamps(2,'test'));Storage.prototype.setItem=set;return ok;});
  assert.equal(failed,false); assert.equal(await p.locator('#couponStampToast').isVisible(),false);
  const afterFailure=await snapshot(p);
  assert.deepEqual({state:afterFailure.state,primary:afterFailure.primary,dirty:afterFailure.dirty}, {state:before.state,primary:before.primary,dirty:before.dirty});
  await p.evaluate(()=>{state.couponLedger.stamps=29;BenefitService.commit(()=>CouponPolicy.addStamps(5,'test'));});
  assert.match(await p.locator('#couponStampToast').innerText(),/\+5 \(4\/30\)/); assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),1);
}));
test('restoring, reading or receiving another window snapshot does not fabricate stamp toasts', async () => game(fixture(), async p => {
  await stable(p); await p.evaluate(()=>{state.couponLedger.stamps=17;save(true);updateUI();});
  assert.equal(await p.locator('#couponStampToast').isVisible(),false);
  const other=await p.context().newPage(); await other.goto(p.url()); await ready(other);
  await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(2,'test')));
  assert.equal(await other.locator('#couponStampToast').isVisible(),false);
  await other.close(); await p.reload(); await ready(p);
  assert.equal(await p.locator('#couponStampToast').isVisible(),false);
  assert.equal(await p.evaluate(()=>state.couponLedger.stamps),19);
}));
test('landscape coupon box scrolls to staff/history and returns focus without covering close', async () => game(fixture(), async p => {
  await seed(p); await p.locator('#couponChip').tap(); await p.locator('#couponHistory summary').tap();
  await p.locator('#panel-shr .scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
  const close=p.locator('#panel-shr .closeBtn'); const b=await close.boundingBox(); assert.ok(b.y>=0 && b.y+b.height<=360,JSON.stringify(b));
  assert.equal(await p.evaluate(()=>document.getElementById('app').scrollTop),0,'coupon scrolling cannot move the app/header/nav');
  await close.tap(); assert.equal(await p.evaluate(()=>document.activeElement.id),'couponChip');
}, {viewport:{width:640,height:360}}));
test('consecutive successful stamp commits announce each committed quantity and remainder', async () => game(fixture(), async p => {
  await p.evaluate(()=>{
    window.couponMessages=[];
    const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)couponMessages.push(n.textContent);});
    observer.observe(document.getElementById('couponStampToast'),{childList:true});
    BenefitService.commit(()=>CouponPolicy.addStamps(1,'test'));
    BenefitService.commit(()=>CouponPolicy.addStamps(2,'test'));
  });
  await p.waitForFunction(()=>couponMessages.length===2,null,{polling:20});
  assert.deepEqual(await p.evaluate(()=>couponMessages),['🥤 음료 스탬프 +1 (1/30)','🥤 음료 스탬프 +2 (3/30)']);
}));
test('availability notice waits for pending-income surface; closing cannot issue or claim', async () => game(fixture({offlineReward:{amount:4321,seconds:120}}), async p => {
  await stable(p);
  await p.evaluate(()=>{
    state.couponLedger.lots=[{id:'previous-welcome',type:'drink',source:'welcome',issuedAt:Date.now()-86400000,usableAt:Date.now(),expiresAt:Date.now()+86400000,usedAt:0}];
    updateUI(); save(true);
  });
  const before=await snapshot(p);
  assert.equal(await p.locator('#couponNotice').isVisible(),false);
  assert.equal(await p.evaluate(()=>localStorage.getItem(CouponPolicy.presentation.key)),null);
  await p.keyboard.press('Escape'); await p.waitForSelector('#couponNotice:not([hidden])');
  assert.match(await p.locator('#couponNoticeText').innerText(),/오늘부터 웰컴 음료/);
  assert.deepEqual(await snapshot(p),before);
  assert.equal(await p.evaluate(()=>state.offlineReward.amount),4321);
}));
test('full monthly card shows next-month date without settling rewards from coupon views', async () => game(fixture(), async p => {
  await stable(p); await p.evaluate(()=>{
    state.couponLedger.stamps=30; state.couponLedger.issuedMonths[CouponPolicy.month()]=1; save(true); updateUI();
  });
  const before=await snapshot(p); await p.locator('#couponChip').tap();
  assert.match(await p.locator('#couponPolicyStatus').innerText(),/이번 달 1\/1장/);
  assert.equal(await p.locator('#couponStampGrid .filled').count(),30);
  assert.match(await p.locator('#couponNextIssue').innerText(),/다음 지급 예정: 2026-11-01/);
  await p.keyboard.press('Escape'); assert.deepEqual(await snapshot(p),before);
}));
test('display rendering failure cannot roll back a successfully saved stamp award', async () => game(fixture(), async p => {
  await stable(p);
  const ok=await p.evaluate(()=>{
    const get=document.getElementById.bind(document);
    document.getElementById=id=>id==='couponStampToast'?null:get(id);
    const committed=BenefitService.commit(()=>CouponPolicy.addStamps(2,'test'));
    queueMicrotask(()=>{document.getElementById=get;}); return committed;
  });
  assert.equal(ok,true); assert.equal(await p.evaluate(()=>state.couponLedger.stamps),2);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(SAVE_KEY)).couponLedger.stamps),2);
  assert.equal(await p.evaluate(()=>_saveDirty),false);
}));
test('coupon D-day follows Korean date and exact expiry without changing the ledger', async () => game(fixture(), async p => {
  await seed(p); await p.locator('#couponChip').tap();
  assert.match(await p.locator('[data-coupon-id="soon"]').innerText(),/D-1/);
  await p.evaluate(()=>{testNow=CouponPolicy.dayStart()+CouponPolicy.dayMs;CouponPolicy.render();});
  assert.match(await p.locator('[data-coupon-id="soon"]').innerText(),/오늘 만료/);
  const ledger=await p.evaluate(()=>structuredClone(state.couponLedger));
  await p.evaluate(()=>{testNow=state.couponLedger.lots.find(c=>c.id==='soon').expiresAt;CouponPolicy.render();});
  assert.equal(await p.locator('#datedCouponList [data-coupon-id="soon"]').count(),0);
  assert.match(await p.locator('#couponPastLots [data-coupon-id="soon"]').textContent(),/만료/);
  assert.deepEqual(await p.evaluate(()=>state.couponLedger),ledger);
}));
test('stamp toast reports retained progress at the monthly storage cap without promising discarded surplus', async () => game(fixture(), async p => {
  await p.evaluate(()=>{
    state.couponLedger.stamps=29;state.couponLedger.issuedMonths[CouponPolicy.month()]=1;
    BenefitService.commit(()=>CouponPolicy.addStamps(5,'test'));
  });
  assert.match(await p.locator('#couponStampToast').innerText(),/\+1 \(30\/30\)/);
  assert.equal(await p.evaluate(()=>state.couponLedger.stamps),30);
  assert.equal(await p.evaluate(()=>state.couponLedger.lots.length),0);
  await p.evaluate(()=>BenefitService.commit(()=>CouponPolicy.addStamps(2,'test')));
  assert.match(await p.locator('#couponStampToast').innerText(),/30\/30 · 카드가 가득 찼어요/);
  assert.doesNotMatch(await p.locator('#couponStampToast').innerText(),/\+2/);
  assert.equal(await p.evaluate(()=>state.couponLedger.stamps),30);
}));
