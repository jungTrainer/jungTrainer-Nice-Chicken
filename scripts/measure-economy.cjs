// Reproducible Chromium work counts; timings are diagnostics, not pass thresholds.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(process.argv[2] || ".");
  const server = http.createServer((req, res) => {
    const file = path.resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /^\/$/,
          "/index.html",
        ),
    );
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
      );
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch(
      require("./browser-options.cjs").browserOptions(),
    );
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Seoul",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.addInitScript(() => {
      Date.now = () => Date.UTC(2026, 9, 12, 12);
      requestAnimationFrame = () => 1;
      cancelAnimationFrame = () => {};
    });
    await page.goto("http://127.0.0.1:" + server.address().port);
    const result = await page.evaluate(() => {
      const num = v => Number(v);
      const rows = [];
      const reset = () => { state = defaultState(); sanitizeState(); state.soundOn = false; };
      const rate = () => {
        const r = computeRates(), e = r.eff;
        const prices = MENUS.slice(0, getOpenMenuCount()).map(m => num(getMenuPrice(m.id, e)));
        const avg = prices.reduce((a,b) => a+b, 0) / prices.length;
        // 40 midpoint samples of the real random interval, including the 12% rest.
        let ms = 0;
        const original = Math.random;
        for (let i=0;i<40;i++) for (const [rest,weight] of [[false,.88],[true,.12]]) {
          let call = 0; Math.random = () => call++ === 0 ? (i+.5)/40 : rest ? 0 : 1;
          ms += computeDeliveryIntervalMs(VEHICLES[Math.min(9,state.delivery.level)]) * weight/40;
        }
        Math.random = original;
        const served = Math.min(r.ordersPerMin, r.autoServesPerMin * 2);
        const delivery = state.delivery.riders > 0 ? 60000/ms : 0;
        return { avgPrice: avg, servedPerMin: served, deliveryPerMin: delivery,
          incomePerMin: avg * (served*(1+r.tipChance*r.tipMul+.01) + delivery*(1+(e.deliveryEarningMul||0)) + r.onlineOrdersPerMin*(1+(e.onlineMul||0))*(1+(e.onlineEarningMul||0))) };
      };
      for (const region of REGIONS) {
        reset(); state.regionId=region.id; state.level=999;
        for (const u of UPGRADES) state.upgrades[u.id]=u.maxLevel;
        state.delivery={level:10,riders:10};
        for (const s of STAFF_POOL) state.staffStats[s.key]={auto:10,tip:10,earned:0};
        for (const r of RESEARCH) state.research.levels[r.id]=10;
        for (const m of MENUS) state.menuLevels[m.id]=10;
        const r=rate();
        rows.push({region:region.id, ...r, nextUnlockMinutes: num(getNextRegion().unlockCost)/r.incomePerMin,
          endingYearsFromZero: num(ENDING_MONEY)/r.incomePerMin/60/24/365});
      }
      reset(); state.money=2**53;
      recordIncome(1,{menuId:'fried',count:1});
      const lost = {start:2**53, after:state.money, sales:state.totalSales};
      state.menuLevels.fried=1200;
      const overflowCost = String(Math.floor(100000*Math.pow(1.8,1200)));
      reset();
      // Optimistic automated growth model. Continuous orders, no crowd loss or events;
      // one real-duration research slot, branch research restarts on moving;
      // shared staff education; menu research capped at 10 for the measurement only.
      const milestones = [], levels = [], running = [];
      let minute=0, nextLevel=10, ending=null;
      const candidates = () => {
        const list=[];
        for(const u of UPGRADES) if((state.upgrades[u.id]||0)<u.maxLevel) {
          const cur=state.upgrades[u.id]||0;
          list.push({cost:num(upgradeCost(u.id,cur)), change:delta=>{
            state.upgrades[u.id]=cur+delta;
            if(u.id==='deliRider') state.delivery.riders=cur+delta;
            if(u.id==='deliVehicle') state.delivery.level=cur+delta;
          }});
        }
        for(const s of getHiredStaff()) for(const k of ['auto','tip']) {
          const cur=state.staffStats[s.key][k];
          if(cur<10) list.push({cost:num(staffUpgradeCost(s.key,k,cur)),change:d=>state.staffStats[s.key][k]=cur+d});
        }
        for(const m of MENUS.slice(0,getOpenMenuCount())) {
          const cur=state.menuLevels[m.id]||0;
          if(cur<10) list.push({cost: typeof menuResearchCost==='function' ? num(menuResearchCost(cur)) : Math.floor(100000*1.8**cur),change:d=>state.menuLevels[m.id]=cur+d});
        }
        return list;
      };
      // Thirty days is a censoring horizon, not an estimated ending time.
      for(minute=0;minute<43200;minute++) {
        if(running[0] && running[0].end<=minute) {
          state.research.levels[running[0].id]++; running.length=0;
        }
        if(!running.length) {
          const r=RESEARCH.filter(r=>(state.research.levels[r.id]||0)<10 && Object.keys(r.effectPerLevel).some(k=>['earningMul','baseAutoAdd','autoServeMul','staffSpeedMul','ordersMul','deliveryFreqMul','onlineFreqMul','deliveryEarningMul','onlineEarningMul'].includes(k)))
            .sort((a,b)=> (a.baseMin*a.timeScale**(state.research.levels[a.id]||0))-(b.baseMin*b.timeScale**(state.research.levels[b.id]||0)))[0];
          if(r) {state.research.levels[r.id] ||= 0; running.push({id:r.id,end:minute+r.baseMin*r.timeScale**state.research.levels[r.id]});}
        }
        const rpm=rate().incomePerMin;
        state.money=num(state.money)+rpm; state.totalSales=num(state.totalSales)+rpm;
        if(minute && minute%1440===0) state.money-=getStaffCount()*80000;
        for(let lv=state.level+1;lv<=CONFIG.maxLevel;lv++) {
          if(num(state.totalSales)>=num(CONFIG.levelUpTotalSales[lv])) state.level=lv; else break;
        }
        if(state.level>=nextLevel) {levels.push({level:state.level,minute});nextLevel=nextLevel===10?100:nextLevel===100?500:1000;}
        if(num(state.money)>=num(ENDING_MONEY)) {ending=minute;break;}
        const next=getNextRegion();
        if(next.id!==state.regionId && num(state.money)>=num(next.unlockCost)) {
          const money=num(state.money)-num(next.unlockCost), stats=state.staffStats;
          milestones.push({region:next.id,minute}); reset(); state.money=money; state.staffStats=stats; state.regionId=next.id; running.length=0;
          continue;
        }
        // Buy the best expected revenue gain per cost when affordable, max 40 per minute.
        for(let n=0;n<40;n++) {
          const before=rate().incomePerMin;
          let best=null, score=0;
          for(const c of candidates()) if(c.cost<=num(state.money)) {
            c.change(1); const gain=rate().incomePerMin-before; c.change(0);
            if(gain/c.cost>score) {best=c;score=gain/c.cost;}
          }
          if(!best) break;
          state.money=num(state.money)-best.cost; best.change(1);
        }
      }
      return {precision:lost, overflowCost, thresholds:[1,10,100,500,999].map(lv=>({level:lv,required:String(CONFIG.levelUpTotalSales[lv])})),
        endingTarget:String(ENDING_MONEY), checkpoints:rows,
        model:{horizonMinutes:43200,endingMinute:ending,milestones,levels,finalRegion:state.regionId, finalMoney:String(state.money),finalLevel:state.level, finalRate:rate()}};
    });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({root,browser:browser.version(), ...result},null,2));
  } finally {
    await browser?.close();
    await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
