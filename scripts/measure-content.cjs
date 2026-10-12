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
      state = defaultState(); sanitizeState(); state.soundOn = false;
      const scenarios = [];
      for(const research of [0,1,10]) {
        state.menuLevels.fried=research;
        for(const unlock of [0,1,2,8]) {
          state.upgrades.menuUnlock=unlock;
          const all=MENUS.slice(0,getOpenMenuCount());
          const prices=all.map(m=>({id:m.id,price:String(getMenuPrice(m.id))}));
          const sum=prices.reduce((s,m)=>s+BigInt(m.price),0n);
          scenarios.push({research,unlock,prices,allMeanWon:(sum/BigInt(all.length)).toString(),
            signatureFriedWon:String(getMenuPrice('fried')),
            selectedMeanWon:typeof getOrderMenuPool==='function' ?
              (getOrderMenuPool({menuPolicy:'signature',featuredMenu:'fried'}).reduce((s,m)=>s+moneyInt(getMenuPrice(m.id)),0n)/BigInt(getOrderMenuPool({menuPolicy:'signature',featuredMenu:'fried'}).length)).toString() : null});
        }
      }
      return {scenarios,staff:STAFF_POOL.map(s=>({key:s.key,grade:s.grade,baseSpeed:s.baseSpeed})),
        regions:REGIONS.map(r=>({id:r.id,priceMul:r.priceMul,costMul:r.costMul,unlockCost:String(r.unlockCost)}))};
    });
    console.log(JSON.stringify({root,browser:browser.version(),...result},null,2));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      JSON.stringify({ root, browser: browser.version(), ...result }, null, 2),
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
