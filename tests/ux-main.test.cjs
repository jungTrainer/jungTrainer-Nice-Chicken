const assert = require('node:assert/strict');
const {test} = require('node:test');
const {harness} = require('./helpers/game.cjs');
const {game, fixture} = harness();
const guideKey = 'niceChicken_servingGuide_v1';
const stable = p => p.waitForFunction(() => state.customers.length > 0, null, {polling:50});
const snapshot = p => p.evaluate(() => ({state:JSON.stringify(state),primary:localStorage.getItem(SAVE_KEY),backup:localStorage.getItem(SAVE_BACKUP_KEY),dirty:_saveDirty}));
async function customer(p) {
  await stable(p);
  await p.evaluate(() => {
    state.customers = [{id:'ux-customer',menuId:'fried',menuName:MENU_MAP.fried.name,emoji:'🙂',state:'waiting',x:canvas.width/2,y:canvas.height-220,r:30,patience:99,patienceMax:99}];
    state.selectedCustomerId = null; render();
  });
  return p.evaluate(() => {const c=state.customers[0],r=canvas.getBoundingClientRect();return {x:c.x*r.width/canvas.width,y:c.y*r.height/canvas.height};});
}
for(const level of [0,1,7,8]) test(`menu level ${level}: only unlocked actions and at most one exact next-menu preview; view is pure`, async()=>game(fixture({upgrades:{menuUnlock:level}}), async p=>{
  await stable(p);const before=await snapshot(p);
  const result=await p.evaluate(()=>{
    buildMenuGrid();updateEconomyUI();
    return {actions:[...menuGrid.querySelectorAll('[data-action="serve-menu"]')].map(b=>({id:b.dataset.menuId,disabled:b.disabled,locked:b.dataset.locked,price:b.dataset.price})),expected:MENUS.slice(0,getOpenMenuCount()).map(m=>({id:m.id,disabled:false,locked:'0',price:String(getMenuPrice(m.id))})),next:menuGrid.querySelector('.menuNext')?.dataset.menuId||null,cost:menuGrid.querySelector('.menuNext')?.dataset.cost||null,expectedCost:String(menuUnlockCost(state.upgrades.menuUnlock||0)),expectedNext:MENUS[getOpenMenuCount()]?.id||null,disabled:menuGrid.querySelectorAll('button:disabled').length};
  });
  assert.deepEqual(result.actions,result.expected);assert.equal(result.next,result.expectedNext);assert.equal(result.disabled,0);
  assert.equal(await p.locator('.menuNext').count(),level===8?0:1);
  if(level<8){assert.equal(result.cost,result.expectedCost);assert.match(await p.locator('.menuNext').innerText(),/다음 메뉴:.*\n해금/);}
  assert.deepEqual(await snapshot(p),before);
}));
test('next menu exact regional price agrees with upgrade display and one actual touch purchase',async()=>game(fixture({money:1e12,regionId:'busan',regionUnlocked:{changnyeong:true,busan:true},upgrades:{menuUnlock:0}}),async p=>{
  await stable(p);const quote=await p.evaluate(()=>({cost:menuUnlockCost(0),money:state.money}));
  assert.equal(await p.locator('.menuNext').getAttribute('data-cost'),String(quote.cost));
  const nextId=await p.locator('.menuNext').getAttribute('data-menu-id');
  await p.locator('[data-panel="upg"]').tap();const buy=p.locator('[data-upgrade-id="menuUnlock"]');
  assert.equal(await buy.getAttribute('data-cost'),String(quote.cost));await buy.tap();await p.keyboard.press('Escape');
  assert.equal(await p.locator(`[data-action="serve-menu"][data-menu-id="${nextId}"]`).count(),1);
  assert.equal(await p.evaluate(()=>state.money),await p.evaluate(q=>moneySub(q.money,q.cost),quote));
  assert.equal(await p.locator('.menuNext').getAttribute('data-cost'),String(await p.evaluate(()=>menuUnlockCost(1))));
}));
for(const width of [360,390]) test(`${width}px guide remains after selection, hides on successful touch serving, and stays hidden after reconnect`,async()=>game(fixture(),async p=>{
  const point=await customer(p);assert.equal(await p.locator('#hint').isVisible(),true);
  const geometry=await p.evaluate(()=>({hint:document.getElementById('hint').getBoundingClientRect().top,stage:document.getElementById('stageWrap').getBoundingClientRect().bottom}));
  assert.ok(geometry.hint>=geometry.stage,'guide is outside the canvas');
  await p.locator('#stage').tap({position:point});assert.equal(await p.evaluate(()=>state.selectedCustomerId),'ux-customer');
  assert.equal(await p.locator('#hint').isVisible(),true,'selection alone is not successful serving');
  const before=await p.evaluate(()=>({count:state.menuStats.fried?.count||0,coupons:JSON.stringify(state.couponLedger)}));
  await p.locator('[data-action="serve-menu"][data-menu-id="fried"]').tap();
  assert.equal(await p.locator('#hint').isVisible(),false);
  assert.equal(await p.evaluate(k=>localStorage.getItem(k),guideKey),'done');
  assert.equal(await p.evaluate(()=>state.menuStats.fried.count),before.count+1);
  assert.equal(await p.evaluate(()=>JSON.stringify(state.couponLedger)),before.coupons);
  await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.locator('#hint').isVisible(),false);
  assert.equal(await p.evaluate(()=>state.menuStats.fried.count),before.count+1);
},{viewport:{width,height:844}}));
test('absent selection and incorrect menu never complete the serving guide',async()=>game(fixture({upgrades:{menuUnlock:1}}),async p=>{
  await customer(p);await p.locator('[data-menu-id="fried"][data-action="serve-menu"]').tap();assert.equal(await p.locator('#hint').isVisible(),true);
  await p.evaluate(()=>{state.selectedCustomerId='ux-customer';serveByMenu('yangnyeom');});
  assert.equal(await p.locator('#hint').isVisible(),true);assert.equal(await p.evaluate(k=>localStorage.getItem(k),guideKey),null);
  assert.equal(await p.evaluate(()=>state.menuStats.fried?.count||0),0);
}));
test('automatic serving uses the unchanged staff path and completes only the display preference',async()=>game(fixture({upgrades:{hire:6}}),async p=>{
  await customer(p);const before=await p.evaluate(()=>({money:state.money,count:state.menuStats.fried?.count||0,ledger:JSON.stringify(state.couponLedger)}));
  await p.evaluate(()=>{state._autoServeAcc=1;autoServe(0);});
  assert.equal(await p.locator('#hint').isVisible(),false);assert.equal(await p.evaluate(()=>state.menuStats.fried.count),before.count+1);
  assert.equal(await p.evaluate(()=>moneyCompare(state.money,0)>0),true);assert.equal(await p.evaluate(()=>JSON.stringify(state.couponLedger)),before.ledger);
  assert.equal(await p.evaluate(()=>getStaffCount()),6);
}));
for(const viewport of [{width:360,height:640},{width:390,height:844},{width:844,height:390}]) test(`${viewport.width}x${viewport.height} settings replay is read-only, keyboard/Escape focus and touch targets survive`,async()=>game(fixture(),async p=>{
  await customer(p);await p.evaluate(()=>{window.dispatchEvent(new Event('nice-chicken:served'));save(true);});
  const before=await snapshot(p);await p.locator('#openSettings').focus();await p.keyboard.press('Enter');
  await p.locator('#replayServingGuide').focus();await p.keyboard.press('Enter');
  assert.equal(await p.locator('#hint').isVisible(),true);assert.equal(await p.locator('#modalSettings').evaluate(e=>e.classList.contains('on')),false);
  assert.equal(await p.evaluate(()=>document.activeElement.id),'openSettings');
  await p.locator('#openSettings').tap();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'openSettings');
  assert.deepEqual(await snapshot(p),before);assert.equal(await p.evaluate(k=>localStorage.getItem(k),guideKey),'done');
  const b=await p.locator('[data-action="serve-menu"]').first().boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=viewport.width);
  const bounds=await p.evaluate(()=>({scroll:document.getElementById('app').scrollTop,w:document.documentElement.scrollWidth}));assert.equal(bounds.scroll,0);assert.ok(bounds.w<=viewport.width);
  await p.reload();await p.evaluate(()=>SessionOwner.ready);assert.equal(await p.locator('#hint').isVisible(),false,'replay is temporary and does not reset recorded completion');
},{viewport}));
test('guide storage denial cannot interrupt a successful settlement or its save',async()=>game(fixture(),async p=>{
  await customer(p);await p.evaluate(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,v){if(key===k)throw Error('display preference denied');return original.call(this,key,v);};state.selectedCustomerId='ux-customer';serveByMenu('fried');},guideKey);
  assert.equal(await p.locator('#hint').isVisible(),false);assert.equal(await p.evaluate(()=>state.menuStats.fried.count),1);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(SAVE_KEY)).menuStats.fried.count),1);
  assert.equal(await p.evaluate(()=>_saveDirty),false);
}));
test('guide completion synchronizes to another actual tab without game writes',async()=>game(fixture(),async p=>{
  await stable(p);const reader=await p.context().newPage();await reader.goto(p.url());await reader.evaluate(()=>SessionOwner.ready);await reader.evaluate(()=>document.getElementById('splashScreen')?.remove());
  const before=await snapshot(p);await p.evaluate(k=>localStorage.setItem(k,'done'),guideKey);
  await reader.waitForFunction(()=>document.getElementById('hint').hidden,null,{polling:50});
  assert.deepEqual(await snapshot(p),before);assert.equal(await reader.evaluate(()=>SessionOwner.canMutate()),false);await reader.close();
}));
test('selected customer has the only order bubble; render leaves state and save untouched',async()=>game(fixture(),async p=>{
  await stable(p);await p.evaluate(()=>{
    state.customers=[{id:'selected',menuId:'fried',menuName:'후라이드',state:'waiting',x:150,y:300,patience:99,patienceMax:99},{id:'arrival',menuId:'fried',menuName:'후라이드',state:'waiting',x:100,y:100,patience:99,patienceMax:99},{id:'leaving',menuId:'fried',menuName:'후라이드',state:'leaving',x:250,y:350}];state.selectedCustomerId='selected';
  });
  const before=await snapshot(p);const bubbles=await p.evaluate(()=>{
    const original=drawSpeechBubble,calls=[];drawSpeechBubble=(...args)=>calls.push(args);try{drawCustomers();return calls;}finally{drawSpeechBubble=original;}
  });
  assert.equal(bubbles.length,1);assert.deepEqual(bubbles[0],[150,248,'(후라이드)',1.25,true]);assert.deepEqual(await snapshot(p),before);
  await p.evaluate(()=>state.selectedCustomerId='arrival');
  const next=await p.evaluate(()=>{const original=drawSpeechBubble,calls=[];drawSpeechBubble=(...args)=>calls.push(args);try{drawCustomers();return calls;}finally{drawSpeechBubble=original;}});
  assert.equal(next.length,1);assert.equal(next[0][0],100);
}));
