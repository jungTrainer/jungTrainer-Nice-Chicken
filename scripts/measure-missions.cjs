// Synthetic localhost measurements only; no shop service/production data.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(process.argv[2] || '.');
  const server = http.createServer((req,res) => {
    const f = path.resolve(root, '.' + new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
    if (!f.startsWith(root+path.sep)) return res.writeHead(403).end();
    fs.readFile(f,(e,b) => { if(e) return res.writeHead(404).end(); res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream'); res.end(b); });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try {
    browser = await chromium.launch(require('./browser-options.cjs').browserOptions());
    const p = await browser.newPage({timezoneId:'Asia/Seoul'}), errors=[];
    p.on('pageerror',e=>errors.push(e.message)); p.on('dialog',d=>d.accept());
    await p.route('https://fonts.googleapis.com/**',r=>r.abort());
    await p.addInitScript(()=> { Date.now=()=>Date.UTC(2026,9,12,12); requestAnimationFrame=()=>1; cancelAnimationFrame=()=>{}; });
    await p.goto('http://127.0.0.1:'+server.address().port);
    await p.waitForFunction(()=>typeof SessionOwner!=='undefined'&&SessionOwner.mode!=='starting',null,{polling:100,timeout:20000});
    await p.evaluate(()=>SessionOwner.ready);
    const result = await p.evaluate(()=> {
      state=defaultState(); state.soundOn=false; sanitizeState(); BranchManager.bootstrap();
      const initial={daily:structuredClone(state.missions.dailyList),weekly:structuredClone(state.missions.weeklyList)};
      state.upgrades.menuUnlock=8;
      state.management.menuPolicy='signature'; state.management.featuredMenu='fried';
      const targeted=missionList(false).find(g=>g.type==='menu');
      const unavailable={goalMenu:targeted?.menuId||'any',pool:getOrderMenuPool().map(x=>x.id)};
      for(const u of UPGRADES) state.upgrades[u.id]=u.maxLevel;
      for(const s of STAFF_POOL) state.staffStats[s.key].auto=state.staffStats[s.key].tip=10;
      repairMissionGoals();
      const max={daily:structuredClone(state.missions.dailyList),weekly:structuredClone(state.missions.weeklyList)};
      const exchange=[50000000,'10000000000000000000000'].map(m=>({money:m,coupons:moneyQuotient(m,CONFIG.exchangeUnit)}));
      state.coupons.veg=5; save(true);
      window.measureStored=Storage.prototype.getItem;
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){ if(k===SAVE_KEY) throw Error('synthetic primary quota'); return set.call(this,k,v); };
      void useCoupon('veg');
      return {initial,unavailable,max,exchange,issuance:{dailyVeg:1,weekStamp:7,certificateDrink:1,exchangeWon:CONFIG.exchangeUnit},logLimit:80};
    });
    await p.locator('#pinInput').fill('0000'); await p.locator('#pinOk').click();
    await p.waitForFunction(()=>document.getElementById('modalPin').classList.contains('on')===false,null,{polling:50});
    result.couponPrimaryFailure=await p.evaluate(()=>({memory:state.coupons.veg,disk:JSON.parse(measureStored.call(localStorage,SAVE_KEY)).coupons.veg,log:state.benefitsLog,dirty:_saveDirty}));
    console.log(JSON.stringify({browser:browser.version(),synthetic:true,...result,errors},null,2));
  } finally { await browser?.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
