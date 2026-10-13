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
      Math.random = () => 0.99;
      const counts = {
        stringifies: 0,
        queries: 0,
        elements: 0,
        writes: 0,
        effects: 0,
      };
      const wrap = (obj, key, count) => {
        const fn = obj[key];
        obj[key] = function (...args) {
          counts[count]++;
          return fn.apply(this, args);
        };
      };
      wrap(JSON, "stringify", "stringifies");
      wrap(Document.prototype, "querySelectorAll", "queries");
      wrap(Element.prototype, "querySelectorAll", "queries");
      wrap(Document.prototype, "createElement", "elements");
      wrap(Storage.prototype, "setItem", "writes");
      if (typeof aggregateEffects === "function")
        wrap(window, "aggregateEffects", "effects");
      else wrap(window, "sumEffects", "effects");
      const rows = [];
      for (const [name, n, fn] of [
        ["updateUI", 200, () => updateUI()],
        ["updateStatsUI", 20, () => updateStatsUI()],
        ["tick", 200, () => tick(0.05)],
        ["buyUpgrade", 1, () => buyUpgrade("signboard")],
      ]) {
        const samples = [];
        for (let trial = 0; trial < 5; trial++) {
          state = defaultState();
          state.money = 1e12;
          state.upgrades.hire = 6;
          state.soundOn = false;
          state.menuStats = Object.fromEntries(
            MENUS.map((m) => [
              m.id,
              { count: 2, offlineCount: 1, earned: 100000 },
            ]),
          );
          sanitizeState();
          BranchManager.bootstrap();
          buildMenuGrid();
          updateUI();
          save(true);
          for (const k in counts) counts[k] = 0;
          const start = performance.now();
          for (let i = 0; i < n; i++) fn();
          samples.push({ ms: performance.now() - start, ...counts });
        }
        rows.push({
          name,
          iterations: n,
          counts: { ...samples[2] },
          medianMs: samples.map((x) => x.ms).sort((a, b) => a - b)[2],
        });
      }
      return rows;
    });
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ root, rows: result }, null, 2));
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
