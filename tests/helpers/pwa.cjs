// Real HTTP, Chromium and ServiceWorker. Server swaps complete release fixtures.
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { before, after } = require("node:test");
const { chromium } = require("playwright");
const { browserOptions } = require("../../scripts/browser-options.cjs");
const { build } = require("../../scripts/build-pwa.cjs");
const { captureFailure, resultRoot } = require("./diagnostics.cjs");
const { NOW } = require("./game.cjs");
function pwaHarness() {
  let browser,
    temp,
    roots,
    releases,
    caseNumber = 0;
  before(async () => {
    browser = await chromium.launch(browserOptions());
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "nice-chicken-pwa-"));
    roots = ["a", "b"].map((v) => path.join(temp, v));
    const source = path.resolve(__dirname, "../..");
    for (const root of roots) {
      fs.mkdirSync(root);
      for (const file of [
        "index.html",
        "sw.js",
        "manifest.json",
        "icon-192.png",
        "icon-512.png",
        "js",
        "css",
        ...[1, 2, 3, 4, 5].map((n) => `END_0${n}.png`),
        "END_SOUND.mp3",
      ])
        fs.cpSync(path.join(source, file), path.join(root, file), {
          recursive: true,
        });
    }
    fs.appendFileSync(
      path.join(roots[1], "js/core/config.js"),
      '\nwindow.pwaFixtureVersion = "b";\n',
    );
    releases = roots.map((root) => build(root));
    fs.mkdirSync(path.join(resultRoot, "screenshots"), { recursive: true });
  });
  after(async () => {
    await browser?.close();
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  });
  async function scenario(run, options = {}) {
    let selected = 0;
    let serverOffline = false;
    const failures = new Map(Object.entries(options.failures || {})),
      requests = [],
      scope = options.scope || "/game/";
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const file =
        decodeURIComponent(url.pathname.slice(scope.length)) || "index.html";
      requests.push({ method: req.method, path: file, version: selected });
      if (serverOffline)
        return res.writeHead(503).end("synthetic network unavailable");
      if (!url.pathname.startsWith(scope) || file.includes(".."))
        return res.writeHead(404).end();
      const failure = failures.get(file);
      if (failure === "missing") return res.writeHead(404).end("missing");
      if (req.method !== "GET") return res.writeHead(405).end("no backend");
      fs.readFile(path.join(roots[selected], file), (error, data) => {
        if (error) return res.writeHead(404).end();
        const type =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/manifest+json",
            ".png": "image/png",
            ".mp3": "audio/mpeg",
          }[path.extname(file)] || "text/plain";
        res.writeHead(200, {
          "Content-Type": failure === "mime" ? "text/html" : type,
          "Cache-Control": "no-store",
        });
        res.end(failure === "hash" ? Buffer.from("wrong release bytes") : data);
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}${scope}`;
    const contextOptions = {
      viewport: options.viewport || { width: 390, height: 844 },
      hasTouch: true,
      timezoneId: "Asia/Seoul",
    };
    const context = options.persistent
      ? await chromium.launchPersistentContext(
          path.join(temp, `profile-${caseNumber + 1}`),
          {
            ...browserOptions(),
            ...contextOptions,
            env: {
              ...process.env,
              XDG_DATA_HOME: path.join(temp, "xdg-data"),
              XDG_CONFIG_HOME: path.join(temp, "xdg-config"),
            },
          },
        )
      : await browser.newContext(contextOptions);
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    await context.addInitScript(
      ({ now, live }) => {
        Date.now = () => now;
        if (!live) {
          requestAnimationFrame = () => 1;
          cancelAnimationFrame = () => {};
        }
      },
      { now: NOW, live: !!options.live },
    );
    const page = await context.newPage(),
      errors = [],
      consoleMessages = [],
      currentCase = ++caseNumber;
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (m) => {
      consoleMessages.push({ type: m.type(), text: m.text() });
      if (consoleMessages.length > 100) consoleMessages.shift();
    });
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    try {
      await page.goto(url);
      await page.evaluate((overrides) => {
        state = Object.assign(defaultState(), overrides);
        state.profile.name = "검증";
        state.soundOn = false;
        sanitizeState();
        BranchManager.bootstrap();
        save(true);
        document
          .querySelectorAll(".dim.on,.panel.on")
          .forEach((s) => s.classList.remove("on"));
        initAfterLoad(false);
        document.getElementById("splashScreen")?.remove();
      }, options.state || {});
      if (!options.initialFailure)
        await page.waitForFunction(
          () => !!navigator.serviceWorker.controller,
          null,
          { timeout: 20000, polling: 100 },
        );
      await run({
        page,
        context,
        url,
        scope,
        requests,
        failures,
        releases,
        select: (version) => {
          selected = version;
        },
        serverOffline: (value) => {
          serverOffline = value;
        },
      });
      assert.deepEqual(errors, []);
    } catch (error) {
      try {
        consoleMessages.push({
          type: "pwa-diagnostics",
          text: JSON.stringify(
            await page.evaluate(async () => {
              const r = await navigator.serviceWorker.getRegistration();
              return {
                status: document.getElementById("pwaStatus")?.textContent,
                controller: !!navigator.serviceWorker.controller,
                registration: r
                  ? {
                      active: r.active?.state,
                      waiting: r.waiting?.state,
                      installing: r.installing?.state,
                      scope: r.scope,
                    }
                  : null,
                caches: await caches.keys(),
              };
            }),
          ),
        });
        consoleMessages.push({
          type: "server-requests",
          text: JSON.stringify(requests),
        });
      } catch (_) {}
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
      throw error;
    } finally {
      await context.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  return { scenario };
}
module.exports = { pwaHarness };
