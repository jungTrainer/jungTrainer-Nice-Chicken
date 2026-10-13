const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");
const { before, after } = require("node:test");
const { chromium } = require("playwright");
const { browserOptions } = require("../../scripts/browser-options.cjs");
const { captureFailure, resultRoot } = require("./diagnostics.cjs");
const NOW = Date.UTC(2026, 9, 12, 12),
  KEY = "niceChicken_idleServe_vFinal";
function harness() {
  let browser,
    server,
    url,
    base,
    caseNumber = 0;
  before(async () => {
    fs.mkdirSync(path.join(resultRoot, "screenshots"), { recursive: true });
    const root = path.resolve(__dirname, "../..");
    server = http.createServer((req, res) => {
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
        const type =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".mp3": "audio/mpeg",
          }[path.extname(file)] || "text/plain";
        res.writeHead(200, { "Content-Type": type }).end(data);
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch(browserOptions());
    await game(null, async (page) => {
      base = await page.evaluate(() => {
        state = defaultState();
        sanitizeState();
        state.soundOn = false;
        state.profile.name = "검증";
        return JSON.parse(JSON.stringify(state));
      });
    });
  });
  after(async () => {
    await browser?.close();
    if (server) await new Promise((r) => server.close(r));
  });
  function fixture(overrides = {}) {
    return {
      ...structuredClone(base),
      branches: {},
      lastSeenAt: NOW,
      ...overrides,
    };
  }
  async function game(data, run, options = {}) {
    const context = await browser.newContext({
      viewport: options.viewport || { width: 390, height: 844 },
      hasTouch: true,
      timezoneId: "Asia/Seoul",
    });
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    const currentCase = ++caseNumber;
    await context.addInitScript(
      ({ data, now, key, live, rawSeed, storageFailure }) => {
        window.testNow = Number(sessionStorage.getItem("testNow")) || now;
        Date.now = () => window.testNow;
        if (!live) {
          requestAnimationFrame = () => 1;
          cancelAnimationFrame = () => {};
        }
        const get = Storage.prototype.getItem,
          set = Storage.prototype.setItem,
          remove = Storage.prototype.removeItem;
        if (rawSeed && !get.call(localStorage, "_imp14_test_seeded")) {
          for (const [suffix, raw] of Object.entries(rawSeed))
            if (raw !== null) set.call(localStorage, key + suffix, raw);
          set.call(localStorage, "_imp14_test_seeded", "1");
        } else if (!rawSeed && data && !get.call(localStorage, key))
          set.call(localStorage, key, JSON.stringify(data));
        window.recoveryFailure = storageFailure || {};
        window.recoveryTestStorage = { get, set, remove };
        if (storageFailure) {
          Storage.prototype.getItem = function (k) {
            if (
              window.recoveryFailure.read &&
              [key, key + "_backup", key + "_resetFence"].includes(k)
            )
              throw Error("synthetic read denial");
            return get.call(this, k);
          };
          Storage.prototype.setItem = function (k, v) {
            const targets = {
              primary: key,
              backup: key + "_backup",
              fence: key + "_resetFence",
              archive: key + "_recoveryArchive",
            };
            if (
              Object.entries(targets).some(
                ([n, target]) => window.recoveryFailure[n] && k === target,
              )
            )
              throw Error("synthetic " + k + " quota");
            return set.call(this, k, v);
          };
          Storage.prototype.removeItem = function (k) {
            if (window.recoveryFailure.delete && k === key + "_backup")
              throw Error("synthetic delete denial");
            return remove.call(this, k);
          };
        }
      },
      {
        data,
        now: NOW,
        key: KEY,
        live: options.live || false,
        rawSeed: options.rawSeed,
        storageFailure: options.storageFailure,
      },
    );
    const page = await context.newPage(),
      errors = [],
      consoleMessages = [];
    page.on("console", (message) => {
      consoleMessages.push({ type: message.type(), text: message.text() });
      if (consoleMessages.length > 100) consoleMessages.shift();
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    try {
      await page.goto(url);
      await page.waitForFunction(
        () =>
          typeof SessionOwner !== "undefined" &&
          SessionOwner.mode !== "starting",
        null,
        { polling: 100, timeout: 20000 },
      );
      await page.evaluate(() => SessionOwner.ready);
      await page.evaluate(() =>
        document.getElementById("splashScreen")?.remove(),
      );
      await run(page);
      assert.deepEqual(errors, []);
    } catch (error) {
      try {
        await captureFailure({
          page,
          context,
          error,
          pageErrors: errors,
          consoleMessages,
          browserVersion: browser.version(),
          options,
          caseNumber: currentCase,
        });
      } catch (captureError) {
        console.error("Diagnostic capture failed:", captureError.message);
      }
      throw error;
    } finally {
      await context.close();
    }
  }
  return { game, fixture };
}
module.exports = { harness, NOW, KEY };
