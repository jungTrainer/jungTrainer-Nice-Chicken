const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { harness, NOW } = require('./helpers/game.cjs');
const { game, fixture } = harness();
const campaign = (mode, regions = {}) => ({version:1, mode, selectedAt:NOW, regions});
async function unchanged(p, view) {
  // The real 700ms boot spawn runs even with RAF frozen. Finish it before
  // comparing full state so an unrelated timer cannot masquerade as a view write.
  await p.waitForFunction(()=>state.customers.length>0,null,{polling:100});
  const snapshot = () => p.evaluate(() => ({state:JSON.stringify(state), raw:localStorage.getItem(SAVE_KEY), backup:localStorage.getItem(SAVE_BACKUP_KEY), dirty:_saveDirty}));
  const before = await snapshot();
  await view();
  assert.deepEqual(await snapshot(), before, 'view must not change state, saves or dirty');
}
async function openGuide(p) { await p.locator('#openSettings').tap(); await p.locator('#openGameGuide').tap(); }

test('new run guide explains serving, explicit legacy default and targets without schema/payout changes', async()=>game(null, async p=>{
  assert.equal(await p.locator('#modalProfile').evaluate(e=>e.classList.contains('on')), true);
  assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');
  const text = await p.locator('#modalProfile').innerText();
  for (const word of ['주문','설정','기존 운영','이지','노말','100해','지역 이야기 6곳','5,000만원','한 방문에 한 병']) assert.ok(text.includes(word),word);
  await unchanged(p,async()=>{await p.keyboard.press('Tab');await p.keyboard.press('Escape');});
  assert.deepEqual(await p.evaluate(()=>state.coupons),{veg:0,drink:0});
  assert.deepEqual(await p.evaluate(()=>state.campaign.regions),{});
  assert.equal(await p.evaluate(()=>Object.keys(state).some(k=>/tutorial|onboarding|guide/i.test(k))), false);
}));

test('guide replay, close and Escape preserve exact raw saves and paid/coupon/family records',async()=>game(fixture({coupons:{veg:7,drink:3},endingSeen:true,robotGrandson:true}),async p=>{
  await unchanged(p,async()=>{
    await openGuide(p);
    await p.locator('[data-ui-close="modalGameGuide"]').tap();
    await p.locator('#openGameGuide').tap();
    await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  });
  await p.reload();
  assert.equal(await p.locator('#modalProfile').evaluate(e=>e.classList.contains('on')),false);
  assert.deepEqual(await p.evaluate(()=>state.coupons),{veg:7,drink:3});
  assert.equal(await p.evaluate(()=>state.robotGrandson),true);
}));

test('guide cannot implicitly choose a mode; explicit settings confirmation still owns selection',async()=>game(fixture(),async p=>{
  p.on('dialog',d=>d.dismiss());await openGuide(p);
  assert.equal(await p.evaluate(()=>Campaign.choose('easy')),false);
  assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');
  await p.keyboard.press('Escape');await p.locator('#chooseMode-easy').tap();
  assert.equal(await p.evaluate(()=>state.campaign.mode),'legacy');
}));

test('map overview and locked stories are pure views with accurate legacy unlock requirements',async()=>game(fixture({money:50000000000,coupons:{veg:7,drink:3}}),async p=>{
 await unchanged(p,async()=>{
  await p.locator('#openMap').tap();
  assert.equal(await p.locator('.map-node').count(),6);
  assert.match(await p.locator('[data-region-id="busan"] .map-details').innerText(),/창녕 본점 지점 오픈.*보유금 충족/);
  assert.match(await p.locator('#mapHint').innerText(),/가족 목표.*100해/);
  assert.equal(await p.locator('#mapUnlock').isDisabled(),false);
  await p.keyboard.press('Escape');await p.locator('#openSettings').tap();
  assert.match(await p.locator('#campaignRegions').innerText(),/설정에서 이지\/노말.*선택/);
  assert.equal(await p.locator('[data-campaign-region="busan"]').innerText(),'이야기 잠김');
  await p.keyboard.press('Escape');
 });
}));

test('region summary excludes pending income and distinguishes archived sales from shared cash',async()=>game(fixture({campaign:campaign('easy'),totalSales:39999999,offlineReward:{amount:1,seconds:60}}),async p=>{
 await p.keyboard.press('Escape');
 const result=await p.evaluate(()=>{
  BranchManager.ensure('busan');state.branches.busan.data.totalSales=123456;
  state.branches.busan.data.offlineSalesTotal=7;
  state.branches.busan.data.offlineReward={amount:999,seconds:60};
  return {home:Campaign.regionSummary('changnyeong'),other:Campaign.regionSummary('busan')};
 });
 assert.ok(result.home.ratio<1);assert.equal(result.home.progress,await p.evaluate(()=>`기록 매출 ${fmtWon(39999999)} / 목표 ${fmtWon(40000000)}`));
 assert.equal(await p.evaluate(()=>Campaign.sales('busan')),123463);
 assert.ok(result.other.progress.startsWith(await p.evaluate(()=>`기록 매출 ${fmtWon(123463)}`)));
 assert.match(result.other.ending,/지점 오픈 후/);
 assert.match(result.other.unlock,/지역 이야기 해금.*미충족/);
 assert.equal(await p.evaluate(()=>state.offlineReward.amount),1);
}));

test('exact one-won map affordability and progress use canonical integer money, not rounded labels',async()=>game(fixture({campaign:campaign('easy'),money:999999,totalSales:40000000}),async p=>{
 await p.locator('#openMap').tap();assert.equal(await p.locator('#mapUnlock').isDisabled(),true);
 assert.match(await p.locator('[data-region-id="busan"] .map-details').innerText(),/1원 부족/);
 assert.equal(await p.locator('[data-region-id="changnyeong"] progress').evaluate(e=>e.value),1);
 await p.evaluate(()=>{recordIncome(1);renderMapUI();});
 assert.equal(await p.locator('#mapUnlock').isDisabled(),false);
 await p.locator('#mapUnlock').tap();
 assert.equal(await p.evaluate(()=>state.regionUnlocked.busan),true);
 assert.equal(await p.evaluate(()=>state.money),0);
}));

test('huge archived goals and existing badges remain valid in legacy presentation',async()=>game(fixture({campaign:campaign('legacy',{mars:{unlockedAt:NOW,seenAt:NOW,badgeAwarded:true,goalAtUnlock:'20000000000000000000'}}),regionUnlocked:{changnyeong:true,mars:true}}),async p=>{
 await unchanged(p,async()=>{
  const summary=await p.evaluate(()=>Campaign.regionSummary('mars'));
  assert.equal(summary.goal,'20000000000000000000');
  assert.match(summary.ending,/ 기념 완료/);
  await p.locator('#openSettings').tap();
  assert.equal(await p.locator('[data-campaign-region="mars"]').innerText(),'다시보기');
  await p.keyboard.press('Escape');
 });
}));

test('growth achievements, repeat goals and real benefits are separately labelled without view rewards',async()=>game(fixture(),async p=>{
 await unchanged(p,async()=>{
  await p.locator('[data-panel="mis"]').tap();
  assert.match(await p.locator('#panel-mis').innerText(),/게임 목표/);
  assert.match(await p.locator('#panel-mis').innerText(),/반복 미션/);
  await p.keyboard.press('Escape');await p.locator('#openSettings').tap();await p.locator('#openCoupons').tap();
  assert.match(await p.locator('#modalCoupons').innerText(),/실물 혜택/);
  await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 });
}));

for(const [name,viewport] of [['360-portrait',{width:360,height:640}],['360-landscape',{width:640,height:360}]]) {
 test(`${name} guide scroll, touch close, keyboard trap, focus return and background guard`,async()=>game(fixture(),async p=>{
  await openGuide(p);
  const modal=p.locator('#modalGameGuide .modal');
  const box=await modal.boundingBox();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
  await p.locator('#modalGameGuide .game-guide p').last().scrollIntoViewIfNeeded();
  assert.ok(await modal.evaluate(e=>e.scrollTop)>0);
  const close=p.locator('[data-ui-close="modalGameGuide"]');const c=await close.boundingBox();assert.ok(c.y>=0&&c.y+c.height<=viewport.height);assert.ok(c.width>=44&&c.height>=44);
  for(let i=0;i<4;i++)await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(()=>document.activeElement.closest('#modalGameGuide')!==null),true);
  const before=await p.evaluate(()=>state.totalSales);
  await p.evaluate(()=>{state.customers=[{id:'guard',menuId:'fried',state:'waiting',x:10,y:10,patience:99}];state.selectedCustomerId='guard';document.querySelector('[data-action="serve-menu"][data-menu-id="fried"]').click();});
  assert.equal(await p.evaluate(()=>state.totalSales),before);
  await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/imp17-${name}-guide.png`)});
  await close.tap();assert.equal(await p.evaluate(()=>document.activeElement.id),'openGameGuide');
  await p.locator('#openGameGuide').tap();await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(()=>document.activeElement.id),'openGameGuide');await p.keyboard.press('Escape');
 },{viewport}));
 test(`${name} map scroll and locked region keyboard selection show readable conditions`,async()=>game(fixture({campaign:campaign('normal')}),async p=>{
  await p.locator('#openMap').tap();
  const wrap=p.locator('#mapWrap');
  assert.ok(await wrap.evaluate(e=>e.scrollWidth>e.clientWidth));
  await p.locator('[data-region-id="mars"]').scrollIntoViewIfNeeded();
  await p.locator('[data-region-id="mars"]').focus();await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(()=>state.mapSelected),'mars');
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.regionId),'mars');
  assert.equal(await p.locator('#mapGo').isDisabled(),true);
  assert.match(await p.locator('[data-region-id="mars"] .map-details').innerText(),/미국 뉴욕 지점 오픈.*지역 이야기 해금/);
  assert.ok(await p.locator('[data-region-id="mars"]').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await p.screenshot({path:path.join(__dirname,`../test-results/screenshots/imp17-${name}-map.png`)});
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openMap');
 },{viewport}));
}
