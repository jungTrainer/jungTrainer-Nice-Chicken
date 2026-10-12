const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assert = require("node:assert/strict");
const { before, after } = require("node:test");
const { chromium } = require("playwright");
const NOW = Date.UTC(2026, 9, 12, 12),
  KEY = "niceChicken_idleServe_vFinal";
function harness() {
  let browser, server, url, base;
  before(async () => {
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
    browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    });
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
    await context.addInitScript(
      ({ data, now, key, live }) => {
        window.testNow = Number(sessionStorage.getItem("testNow")) || now;
        Date.now = () => window.testNow;
        if (!live) {
          requestAnimationFrame = () => 1;
          cancelAnimationFrame = () => {};
        }
        if (data && !localStorage.getItem(key))
          localStorage.setItem(key, JSON.stringify(data));
      },
      { data, now: NOW, key: KEY, live: options.live || false },
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    try {
      await page.goto(url);
      await page.evaluate(() =>
        document.getElementById("splashScreen")?.remove(),
      );
      await run(page);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  return { game, fixture };
}
module.exports = { harness, NOW, KEY };
