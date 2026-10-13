// Real browser capability/recovery probe, separate from the Chromium regression count.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const pw = require("playwright");
const { startDisplay } = require("./display.cjs");
(async () => {
  const root = path.resolve(__dirname, ".."),
    server = http.createServer((req, res) => {
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
                ".html": "text/html",
                ".js": "text/javascript",
                ".css": "text/css",
                ".json": "application/manifest+json",
                ".png": "image/png",
              }[path.extname(f)] || "application/octet-stream",
          })
          .end(b);
      });
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const result = { synthetic: true, browsers: [] };
  try {
    for (const name of ["firefox", "webkit"]) {
      let browser, context, display;
      const r = {
        name,
        executable: pw[name].executablePath(),
        status: "unverified",
      };
      try {
        const cache = path.join("/tmp", "nice-chicken-support-" + name);
        fs.mkdirSync(cache, { recursive: true });
        const opts = {
          headless: name !== "firefox",
          executablePath: pw[name].executablePath(),
          timeout: 30000,
          env: { ...process.env, XDG_CACHE_HOME: cache },
        };
        if (name === "firefox") {
          display = await startDisplay();
          opts.env.DISPLAY = display.display;
          opts.env.MOZ_DISABLE_CONTENT_SANDBOX = "1";
          opts.env.MOZ_DISABLE_RDD_SANDBOX = "1";
          opts.env.MOZ_DISABLE_GMP_SANDBOX = "1";
          opts.env.MOZ_DISABLE_GPU_SANDBOX = "1";
          opts.firefoxUserPrefs = {
            "gfx.webrender.software": true,
            "layers.acceleration.disabled": true,
          };
        }
        if (name === "webkit" && process.env.PLAYWRIGHT_WEBKIT_LIBRARY_PATH)
          opts.env = {
            ...opts.env,
            LD_LIBRARY_PATH: process.env.PLAYWRIGHT_WEBKIT_LIBRARY_PATH,
          };
        browser = await pw[name].launch(opts);
        context = await browser.newContext({ timezoneId: "Asia/Seoul" });
        await context.route("https://fonts.googleapis.com/**", (route) =>
          route.abort(),
        );
        await context.addInitScript(() => {
          Date.now = () => Date.UTC(2026, 9, 12, 12);
          requestAnimationFrame = () => 1;
          cancelAnimationFrame = () => {};
        });
        context.setDefaultTimeout(10000);
        const a = await context.newPage(),
          errors = [];
        console.error(name, "opening");
        a.on("pageerror", (e) => errors.push(e.message));
        await a.goto(url);
        await a.waitForFunction(
          () =>
            typeof SessionOwner !== "undefined" &&
            SessionOwner.mode !== "starting",
          null,
          { polling: 100, timeout: 10000 },
        );
        console.error(name, "role", await a.evaluate(() => SessionOwner.mode));
        r.version = browser.version();
        r.capabilities = await a.evaluate(() => ({
          secure: isSecureContext,
          locks: !!navigator.locks?.request,
          channel: typeof BroadcastChannel === "function",
          sw: !!navigator.serviceWorker,
          role: SessionOwner.mode,
        }));
        if (!r.capabilities.locks) {
          r.status = "read-only-verified";
          r.noMutation = await a.evaluate(() => !save(true) && !resetGame());
        } else {
          await a.evaluate(() => {
            state.profile.name = "검증";
            state.money = "9007199254740993";
            state.offlineReward = { amount: 500, seconds: 60 };
            state.coupons = { drink: 3, veg: 7 };
            save(true);
            localStorage.setItem(SAVE_BACKUP_KEY, JSON.stringify(state));
            localStorage.setItem(SAVE_KEY, "{broken");
          });
          await a.reload();
          await a.waitForFunction(
            () => SessionOwner.mode !== "starting",
            null,
            { polling: 100, timeout: 10000 },
          );
          console.error(
            name,
            "corrupt role",
            await a.evaluate(() => SessionOwner.mode),
          );
          r.corruptPaused = await a.evaluate(
            () =>
              SaveRecovery.blocked &&
              !SessionOwner.canMutate() &&
              localStorage.getItem(SAVE_KEY) === "{broken",
          );
          const b = await context.newPage();
          await b.goto(url);
          await b.waitForFunction(
            () => SessionOwner.mode !== "starting",
            null,
            { polling: 100, timeout: 10000 },
          );
          console.error(
            name,
            "reader role",
            await b.evaluate(() => SessionOwner.mode),
          );
          r.readerBlocked = await b.evaluate(
            () =>
              SessionOwner.mode === "reader" &&
              !save(true) &&
              !SaveRecovery.restore("backup"),
          );
          a.on("dialog", (d) => d.accept());
          await a.locator("#recoverBackup").click();
          r.restored = await a.evaluate(
            () =>
              SessionOwner.canMutate() &&
              state.money === "9007199254740993" &&
              state.offlineReward.amount === 500 &&
              state.coupons.veg === 7,
          );
          await a.evaluate(() => {
            document.getElementById("recoveryClose").click();
            modalOffline.classList.remove("on");
          });
          await b.locator("#sessionRequest").click();
          r.yielded = await a.evaluate(() => SessionOwner.yieldWriter());
          await b.waitForFunction(() => SessionOwner.canMutate(), null, {
            polling: 100,
            timeout: 10000,
          });
          r.inherited = await b.evaluate(
            () =>
              state.money === "9007199254740993" &&
              state.offlineReward.amount === 500,
          );
          r.status =
            [
              r.corruptPaused,
              r.readerBlocked,
              r.restored,
              r.yielded,
              r.inherited,
            ].every(Boolean) && errors.length === 0
              ? "passed"
              : "failed";
        }
        r.errors = errors;
      } catch (e) {
        r.status = "launch-or-probe-failed";
        r.error = e.message;
        process.exitCode = 1;
      } finally {
        await context?.close();
        await browser?.close();
        await display?.stop();
      }
      result.browsers.push(r);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
