/* REC-04: one valuation and one receipt ledger for every channel. */
getMenuPrice=function(id,eff=sumEffects()){
  const base=MENU_MAP[id]?.price||0;if(!base)return 0;
  return Math.floor((base*(1+(state.upgrades.expand||0)*.45)*(1+(state.menuLevels[id]||0)*.5)*(1+state.level*.1)*(getRegion()?.priceMul||1)+(eff.priceBonus||0))*Math.max(0,1+(eff.earningMul||0)));
};
function upgradeCost(id,level=state.upgrades[id]||0){
  const price=UPGRADES.find(u=>u.id===id)?.costFn(level)*(getRegion()?.costMul||1);
  return Number.isFinite(price)&&price>0?Math.floor(price):Infinity;
}
menuUnlockCost=level=>upgradeCost('menuUnlock',level);
upStaff=(key,kind)=>buyStaffUpgrade(key,kind);
const legacyMenuResearch=researchMenu;
researchMenu=function(id){if(!MENUS.slice(0,getOpenMenuCount()).some(m=>m.id===id))return;legacyMenuResearch(id);};
function recordIncome(amount,{menuId=null,actorKey='system',count=0,offline=false}={}){
  if(!Number.isFinite(amount)||amount<=0)return false;amount=Math.floor(amount);if(!amount)return false;
  ensureMissionReset();ensureStaffStats();state.money+=amount;
  const today=offline?'offlineSalesToday':'todaySales',total=offline?'offlineSalesTotal':'totalSales';
  state[today]=(state[today]||0)+amount;state[total]=(state[total]||0)+amount;
  const owner=actorKey==='player'?'player':actorKey==='system'||!state.staffStats[actorKey]?'system':'staff';
  state.contrib[owner]=(state.contrib[owner]||0)+amount;
  if(owner==='staff')state.staffStats[actorKey].earned+=amount;
  if(MENU_MAP[menuId]){
    const stats=state.menuStats[menuId]||={count:0,earned:0};stats.earned=(stats.earned||0)+amount;
    const key=offline?'offlineCount':'count';stats[key]=(stats[key]||0)+count;
  }else state.unattributedSales=(state.unattributedSales||0)+amount;
  _saveDirty=true;return true;
}
processDelivery=function(vehicle){
  const eff=sumEffects(),pool=MENUS.slice(0,getOpenMenuCount()),menu=pool[Math.floor(Math.random()*pool.length)];
  const earnings=Math.floor(getMenuPrice(menu.id,eff)*Math.max(0,1+(eff.deliveryEarningMul||0))*(Date.now()<(state.buffEndTime||0)?2:1));
  recordIncome(earnings,{menuId:menu.id,count:1});updateMissionsOnlineOnly();
  spawnVisualRider(vehicle,false);showFloatingText(canvas.width-110,canvas.height-210,`+${fmtCompact(earnings)}`);
};
updateOnlineAuto=function(dt){
  onlineTimer+=computeRates().onlineOrdersPerMin/60*dt;
  while(onlineTimer>=1){
    onlineTimer--;const eff=sumEffects(),pool=MENUS.slice(0,getOpenMenuCount()),menu=pool[Math.floor(Math.random()*pool.length)];
    recordIncome(Math.floor(getMenuPrice(menu.id,eff)*(1+(eff.onlineMul||0))*(1+(eff.onlineEarningMul||0))*(Date.now()<(state.buffEndTime||0)?2:1)),{menuId:menu.id,count:1});
  }
  updateMissionsOnlineOnly();
};
const economyUpdateUI=updateUI;
updateUI=function(){
  economyUpdateUI();
  for(const button of document.querySelectorAll('[data-action="serve-menu"]')){
    if(button.disabled)continue;const price=getMenuPrice(button.dataset.menuId);
    if(button.dataset.price!==String(price)){button.dataset.price=price;button.querySelector('.price').textContent=fmtWon(price);}
  }
  for(const b of document.querySelectorAll('[data-action="buy-upgrade"]')){
    const u=UPGRADES.find(u=>u.id===b.dataset.upgradeId);b.disabled=(state.upgrades[u.id]||0)>=(u.maxLevel||99)||state.money<upgradeCost(u.id);
  }
};
const economyStats=updateStatsUI;
updateStatsUI=function(){
  economyStats();const body=document.getElementById('menuRankBody');if(!body)return;
  body.replaceChildren();
  for(const menu of MENUS){
    const stats=state.menuStats[menu.id];if(!stats||!stats.earned)continue;
    const row=document.createElement('tr');
    for(const text of [menu.emoji+' '+menu.name,((stats.count||0)+(stats.offlineCount||0)).toLocaleString('ko-KR'),fmtWon(stats.earned)]){const td=document.createElement('td');td.textContent=text;row.append(td);}body.append(row);
  }
  if(state.unattributedSales){const row=document.createElement('tr');for(const text of ['메뉴 미분류','-',fmtWon(state.unattributedSales)]){const td=document.createElement('td');td.textContent=text;row.append(td);}body.append(row);}
};
