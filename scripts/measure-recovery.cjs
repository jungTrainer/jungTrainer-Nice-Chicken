// Synthetic local Chromium failure measurements; no production storage or benefits.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { chromium } = require("playwright");
const { browserOptions } = require("./browser-options.cjs");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const KEY = "niceChicken_idleServe_vFinal",
  BACK = KEY + "_backup",
  NOW = Date.UTC(2026, 9, 12, 12);
(async () => {
  const server = http.createServer((req, res) => {
    const f = path.resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /^\/$/,
          "/index.html",
        ),
    );
    if (!f.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(f, (e, b) => {
      if (e) return res.writeHead(404).end();
      res
        .writeHead(200, {
          "Content-Type":
            {
              ".js": "text/javascript",
              ".css": "text/css",
              ".html": "text/html",
              ".json": "application/manifest+json",
              ".png": "image/png",
            }[path.extname(f)] || "application/octet-stream",
        })
        .end(b);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch(browserOptions()),
    url = "http://127.0.0.1:" + server.address().port + "/";
  const out = {
    browser: browser.version(),
    synthetic: true,
    fixtureTime: NOW,
    cases: {},
  };
  let fixture;
  async function run(name, seed, action) {
    const c = await browser.newContext();
    await c.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await c.addInitScript(
      ({ seed, KEY, BACK, NOW }) => {
        Date.now = () => NOW;
        requestAnimationFrame = () => 1;
        cancelAnimationFrame = () => {};
        if (!sessionStorage.getItem("seeded")) {
          if (seed.primary !== undefined)
            localStorage.setItem(KEY, seed.primary);
          if (seed.backup !== undefined)
            localStorage.setItem(BACK, seed.backup);
          sessionStorage.setItem("seeded", "1");
        }
        const get = Storage.prototype.getItem,
          set = Storage.prototype.setItem,
          remove = Storage.prototype.removeItem;
        window.measureRead = get;
        window.measureSet = set;
        window.measureRemove = remove;
        if (seed.readFail)
          Storage.prototype.getItem = function (k) {
            if (k === KEY || k === BACK) throw Error("synthetic read denial");
            return get.call(this, k);
          };
        if (seed.primaryFail || seed.backupFail)
          Storage.prototype.setItem = function (k, v) {
            if (
              (seed.primaryFail && k === KEY) ||
              (seed.backupFail && k === BACK)
            )
              throw Error("synthetic quota");
            return set.call(this, k, v);
          };
      },
      { seed, KEY, BACK, NOW },
    );
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    try {
      await p.goto(url);
      await p.evaluate(() => SessionOwner.ready);
      if (action) await action(p, c, url);
      out.cases[name] = await p.evaluate(
        ({ KEY, BACK }) => ({
          role: SessionOwner.mode,
          recovery:
            typeof SaveRecovery === "undefined" ? null : SaveRecovery.status,
          money: state.money,
          pending: state.offlineReward.amount,
          coupons: state.coupons,
          primary: measureRead.call(localStorage, KEY),
          backup: measureRead.call(localStorage, BACK),
        }),
        { KEY, BACK },
      );
      out.cases[name].errors = errors;
    } finally {
      await c.close();
    }
  }
  try {
    await run("new", {}, async (p) => {
      fixture = await p.evaluate(() => {
        state = defaultState();
        state.money = 123456;
        state.offlineReward = { amount: 500, seconds: 60 };
        state.coupons = { drink: 3, veg: 7 };
        state.profile.name = "검증";
        state.soundOn = false;
        sanitizeState();
        BranchManager.bootstrap();
        save(true);
        return JSON.parse(exportSaveData()).data;
      });
    });
    const valid = JSON.stringify(fixture);
    await run("corrupt-primary", { primary: "{broken", backup: valid });
    await run(
      "corrupt-primary-and-primary-write-fails",
      { primary: "{broken", backup: valid, primaryFail: true },
      (p) => p.evaluate(() => save(true)),
    );
    await run("corrupt-backup", { primary: valid, backup: "{broken" });
    await run("both-corrupt", { primary: "{broken", backup: "bad" });
    await run("wrong-json-shape", {
      primary: JSON.stringify({ money: 999, level: 1, upgrades: "wrong" }),
    });
    await run("read-denied", { primary: valid, backup: valid, readFail: true });
    await run(
      "backup-write-fails",
      { primary: valid, backup: valid, backupFail: true },
      (p) =>
        p.evaluate(() => {
          recordIncome(17);
          save(true);
        }),
    );
    await run(
      "primary-write-fails",
      { primary: valid, backup: valid, primaryFail: true },
      (p) =>
        p.evaluate(() => {
          recordIncome(17);
          save(true);
        }),
    );
    await run(
      "reset-primary-write-fails",
      { primary: valid, backup: valid, primaryFail: true },
      (p) =>
        p.evaluate(() => {
          window.resetAccepted = resetGame();
        }),
    );
    await run(
      "reset-delete-fails-then-corrupt",
      { primary: valid, backup: valid },
      async (p) => {
        await p.evaluate(() => {
          Storage.prototype.removeItem = function (k) {
            if (k === SAVE_BACKUP_KEY) throw Error("synthetic deletion denial");
            return measureRemove.call(this, k);
          };
          resetGame();
          measureSet.call(localStorage, SAVE_KEY, "{broken");
        });
        await p.reload();
        await p.evaluate(() => SessionOwner.ready);
      },
    );
    await run(
      "corrupt-owner-reader",
      { primary: "{broken", backup: valid },
      async (p, c, url) => {
        const b = await c.newPage();
        await b.goto(url);
        await b.evaluate(() => SessionOwner.ready);
        out.reader = await b.evaluate(() => ({
          role: SessionOwner.mode,
          claim: claimOfflineReward(),
          save: save(true),
        }));
        await b.close();
      },
    );
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
