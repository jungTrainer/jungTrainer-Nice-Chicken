// Synthetic browser measurements only. Compare a static tree, never production data.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const { browserOptions } = require("./browser-options.cjs");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const KEY = "niceChicken_idleServe_vFinal", NOW = Date.UTC(2026,9,12,12);
(async () => {
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,"."+new URL(req.url,"http://localhost").pathname.replace(/^\/$/,"/index.html"));
    if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
    fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{"Content-Type":({".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".mp3":"audio/mpeg"})[path.extname(file)]||"text/plain","Cache-Control":"no-store"}).end(data);});
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch(browserOptions());const url=`http://127.0.0.1:${server.address().port}/`;
  const result={root,browser:browser.version(),fixtureTime:NOW,synthetic:true,cases:{}};
  async function pair(run){
    const ctx=await browser.newContext({timezoneId:"Asia/Seoul"});
    await ctx.addInitScript(now=>{Date.now=()=>now;requestAnimationFrame=()=>1;cancelAnimationFrame=()=>{};},NOW);
    await ctx.route("https://fonts.googleapis.com/**",r=>r.abort());
    const a=await ctx.newPage();await a.goto(url);await a.evaluate(async()=>{if(typeof SessionOwner!=="undefined")await SessionOwner.ready;});
    await a.evaluate(()=>{state=defaultState();state.profile.name="검증";state.soundOn=false;state.money=10000;state.offlineReward={amount:500,seconds:60};sanitizeState();BranchManager.bootstrap();save(true);initAfterLoad(false);});
    const b=await ctx.newPage();await b.goto(url);await b.evaluate(async()=>{if(typeof SessionOwner!=="undefined")await SessionOwner.ready;});
    try{await run(a,b);}finally{await ctx.close();}
  }
  try {
    await pair(async(a,b)=>{
      await a.evaluate(()=>{recordIncome(17,{menuId:"fried",count:1});save(true);});
      const accepted=await b.evaluate(()=>{const income=recordIncome(23,{menuId:"fried",count:1});return {income,save:save(true)};});
      const stored=await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).money,KEY);
      result.cases.income={aIncome:17,bIncome:23,expectedIfBothAccepted:10040,stored,lostIfBothAccepted:10040-stored,bAccepted:accepted};
    });
    await pair(async(a,b)=>{
      const first=await a.evaluate(()=>claimOfflineReward());
      const second=await b.evaluate(()=>claimOfflineReward());
      result.cases.claim={first,second,stored:await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).money,KEY)};
    });
    await pair(async(a,b)=>{
      await a.evaluate(()=>claimOfflineReward());await b.close();
      result.cases.staleClose=await a.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));return {money:s.money,pending:s.offlineReward.amount};},KEY);
    });
    await pair(async(a,b)=>{
      await a.evaluate(()=>{state.regionUnlocked.busan=true;BranchManager.move("busan");});
      const before=await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).regionId,KEY);
      await b.evaluate(()=>save(true));
      result.cases.branch={before,after:await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).regionId,KEY)};
    });
    await pair(async(a,b)=>{
      await a.evaluate(()=>{tick(1);save(true);});
      const accepted=await b.evaluate(()=>{const prev=state.play.onlineSecTotal;tick(1);return {advanced:state.play.onlineSecTotal-prev,save:save(true)};});
      result.cases.tick={accepted,stored:await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).play.onlineSecTotal,KEY)};
    });
    await pair(async(a,b)=>{
      await a.evaluate(()=>{recordIncome(17);save(true);});
      const reset=await b.evaluate(()=>resetGame());
      result.cases.reset={accepted:reset,stored:await a.evaluate(key=>JSON.parse(localStorage.getItem(key)).money,KEY)};
    });
    result.support=await (async()=>{const ctx=await browser.newContext();const p=await ctx.newPage();await p.goto(url);const s=await p.evaluate(()=>({secure:isSecureContext,webLocks:!!navigator.locks,broadcastChannel:typeof BroadcastChannel==="function",serviceWorker:!!navigator.serviceWorker}));await ctx.close();return s;})();
    console.log(JSON.stringify(result,null,2));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
