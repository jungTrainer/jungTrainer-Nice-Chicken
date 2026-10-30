const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { pwaHarness } = require("./helpers/pwa.cjs");
const { build } = require("../scripts/build-pwa.cjs");
const { scenario } = pwaHarness();
const wait = (page, fn, arg) =>
  page.waitForFunction(fn, arg, { timeout: 20000, polling: 100 });
const results = path.resolve(__dirname, "../test-results");
const shot = (page, name) =>
  page.screenshot({
    path: path.join(results, `screenshots/nice-chicken-imp12-${name}.png`),
  });
async function settings(page) {
  if (
    await page
      .locator("#modalOffline")
      .evaluate((e) => e.classList.contains("on"))
  )
    await page.locator('[data-ui-close="modalOffline"]').tap();
  await page.locator("#openSettings").tap();
}
async function update({ page, select }, background = false) {
  select(1);
  if (background)
    await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration()).update(),
    );
  else {
    await settings(page);
    await page.locator("#checkPwaUpdate").tap();
  }
  await wait(
    page,
    async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    null,
    { timeout: 20000, polling: 100 },
  );
  await wait(page, () => !document.getElementById("applyPwaUpdate").disabled);
}
async function apply(page, version) {
  await page.locator("#applyPwaUpdate").tap();
  await wait(
    page,
    (expected) =>
      document.querySelector('meta[name="app-version"]').content === expected,
    version,
    { timeout: 20000, polling: 100 },
  );
  await wait(page, () => !!navigator.serviceWorker.controller);
  await page.evaluate(() => document.getElementById("splashScreen")?.remove());
}
const ledger = (page) =>
  page.evaluate(() => ({
    money: state.money,
    total: state.totalSales,
    offline: state.offlineSalesTotal,
    coupons: state.coupons,
    cert: state.cert,
    receipt: state.offlineReward,
    menus: state.menuStats,
    contribution: state.contrib,
    staff: state.staffStats,
    management: state.management,
    paid: state.missions.dailyCompletedToday,
    weekly: state.missions.weeklyCompletedAt,
    robot: state.robotGrandson,
    endingSeen: state.endingSeen,
    region: state.regionId,
    timers: state.serviceTimers,
  }));
const pending = {
  money: "9007199254740993",
  offlineReward: {
    amount: 500,
    seconds: 60,
    menuStats: { fried: { count: 1, earned: 500 } },
  },
  coupons: { drink: 3, veg: 7 },
  upgrades: { hire: 6, menuUnlock: 1 },
  management: {
    focus: "dispatch",
    leadStaff: "ato",
    menuPolicy: "signature",
    featuredMenu: "yang",
    readStories: ["arrival"],
  },
};

test("release generation covers all scripts/styles with SRI and matches tracked files", () => {
  const release = build(path.resolve(__dirname, ".."), true);
  const html = fs.readFileSync(
    path.resolve(__dirname, "../index.html"),
    "utf8",
  );
  const scripts = [
    ...html.matchAll(/<script src="\.\/([^"]+)" integrity="sha256-([^"]+)"/g),
  ];
  assert.equal(scripts.length, 28);
  assert.equal(scripts.at(-1)[1], "js/core/boot.js");
  for (const script of scripts)
    assert.ok(release.required.find((asset) => asset.path === script[1]));
  assert.equal(release.required.length, 33);
  assert.equal(release.optional.length, 6);
});

test("initial essential install failure preserves online progress and recovers after repair", async () =>
  scenario(
    async ({ page, failures }) => {
      await wait(page, () =>
        document.getElementById("pwaStatus").textContent.includes("설치 실패"),
      );
      assert.equal(
        await page.evaluate(() => !!navigator.serviceWorker.controller),
        false,
      );
      await page.evaluate(() => {
        recordIncome(1, { menuId: "fried", count: 1 });
        save(true);
      });
      const before = await ledger(page);
      failures.clear();
      await settings(page);
      await page.locator("#checkPwaUpdate").tap();
      await wait(page, () => !!navigator.serviceWorker.controller);
      await page.reload();
      assert.deepEqual(await ledger(page), before);
    },
    {
      initialFailure: true,
      failures: { "manifest.json": "missing" },
      state: { money: "9007199254740993" },
    },
  ));

test("Chromium installs the real worker and accepts the Pages-scoped manifest/icons", async () =>
  scenario(
    async ({ page, context, url, scope, releases }) => {
      const cdp = await context.newCDPSession(page);
      const manifest = await cdp.send("Page.getAppManifest");
      assert.deepEqual(manifest.errors, []);
      assert.equal(new URL(manifest.url).pathname, scope + "manifest.json");
      const parsed = JSON.parse(manifest.data);
      const manifestId = new URL(parsed.start_url, manifest.url).href;
      assert.equal(
        new URL(parsed.start_url, manifest.url).href,
        url + "index.html",
      );
      assert.equal(new URL(parsed.scope, manifest.url).pathname, scope);
      const errors = await cdp.send("Page.getInstallabilityErrors");
      assert.deepEqual(errors.installabilityErrors, []);
      const icon = await page.evaluate(async () => {
        const image = new Image();
        image.src = "./icon-192.png";
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      });
      assert.deepEqual(icon, [192, 192]);
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      const evidence = {
        browser: await cdp.send("Browser.getVersion"),
        manifestURL: manifest.url,
        installability: errors,
        realServiceWorker: true,
        nativeInstall: null,
      };
      await cdp.send("PWA.install", {
        manifestId,
        installUrlOrBundleUrl: url + "index.html",
      });
      evidence.nativeInstall = await cdp.send("PWA.getOsAppState", {
        manifestId,
      });
      assert.equal(evidence.nativeInstall.badgeCount, 0);
      await cdp.send("PWA.changeAppUserSettings", {
        manifestId,
        displayMode: "standalone",
      });
      const appWindow = context.waitForEvent("page", { timeout: 10000 });
      evidence.launch = await cdp.send("PWA.launch", { manifestId });
      const installedPage = await appWindow;
      await installedPage.waitForLoadState();
      evidence.standalone = await installedPage.evaluate(
        () => matchMedia("(display-mode: standalone)").matches,
      );
      assert.equal(evidence.standalone, true);
      await installedPage.evaluate(() => document.getElementById("splashScreen")?.remove());
      await shot(installedPage, "standalone");
      await installedPage.close();
      fs.mkdirSync(path.join(results, "verification"), { recursive: true });
      fs.writeFileSync(
        path.join(results, "verification/IMP-12-install.json"),
        JSON.stringify(evidence, null, 2),
      );
      await settings(page);
      await shot(page, "install");
      await cdp.send("PWA.uninstall", { manifestId });
    },
    { scope: "/jungTrainer-Nice-Chicken/", persistent: true },
  ));

test("online to offline reload runs the full cached shell and exact one-won settlement", async () =>
  scenario(
    async ({ page, context, releases, serverOffline }) => {
      await page.evaluate(() => {
        recordIncome(1, { menuId: "fried", count: 1 });
        save(true);
      });
      const before = await ledger(page);
      serverOffline(true);
      await context.setOffline(true);
      const response = await page.reload();
      assert.equal(
        response.headers()["x-nice-chicken-version"],
        releases[0].version,
      );
      assert.deepEqual(await ledger(page), before);
      const uncached = await page.evaluate(async () => {
        try {
          return (await fetch("./not-cached-network-probe")).status;
        } catch (_) {
          return "network-unavailable";
        }
      });
      assert.ok([503, "network-unavailable"].includes(uncached));
      assert.equal(await page.evaluate(() => state.money), "9007199254740994");
      assert.ok(
        (await page.locator("#pwaStatus").textContent()).includes("오프라인"),
      );
      await settings(page);
      await shot(page, "offline");
      serverOffline(false);
      await context.setOffline(false);
      await page.locator("#checkPwaUpdate").tap();
      assert.ok(
        (await page.locator("#pwaStatus").textContent()).includes("온라인"),
      );
    },
    { state: { money: "9007199254740993" } },
  ));

test("optional media 404s do not fail installation or offline story fallback", async () =>
  scenario(
    async ({ page, context, serverOffline }) => {
      serverOffline(true);
      await context.setOffline(true);
      await page.reload();
      const response = await page.evaluate(async () => {
        const r = await fetch("./END_01.png");
        return r.status;
      });
      assert.equal(response, 404);
      await page.evaluate(async () => {
        state.endingUnlocked = true;
        await startEndingSequence();
      });
      await page.locator("#endingDialogWrapper").tap();
      assert.equal(await page.evaluate(() => endingPhase), "playing");
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => state.robotGrandson), false);
    },
    {
      failures: Object.fromEntries(
        [1, 2, 3, 4, 5]
          .map((n) => [`END_0${n}.png`, "missing"])
          .concat([["END_SOUND.mp3", "missing"]]),
      ),
    },
  ));

test("new release waits while old HTML and every JS response stay on the old version", async () =>
  scenario(async (s) => {
    const { page, releases } = s;
    await update(s);
    const data = await page.evaluate(async () => {
      const html = await fetch("./index.html"),
        code = await fetch("./js/core/config.js");
      return {
        html: html.headers.get("x-nice-chicken-version"),
        js: code.headers.get("x-nice-chicken-version"),
        marker: window.pwaFixtureVersion || null,
        version: PwaRuntime.version,
      };
    });
    assert.deepEqual(data, {
      html: releases[0].version,
      js: releases[0].version,
      marker: null,
      version: releases[0].version,
    });
    await shot(page, "waiting");
    await apply(page, releases[1].version);
    assert.equal(await page.evaluate(() => window.pwaFixtureVersion), "b");
    const r = await page.evaluate(async () =>
      (await fetch("./js/main.js")).headers.get("x-nice-chicken-version"),
    );
    assert.equal(r, releases[1].version);
  }));

test("explicit update preserves fixed pending receipt, paid rewards, six staff and branch choices", async () =>
  scenario(
    async (s) => {
      const { page, releases } = s;
      await page.evaluate(() => {
        state.cert = {
          issuedThisWeek: true,
          issuedAt: Date.now(),
          validUntil: Date.now() + 604800000,
          usedAt: 0,
        };
        state.missions.dailyCompletedToday = true;
        state.missions.weeklyCompletedAt = Date.now();
        save(true);
      });
      const before = await ledger(page);
      await update(s);
      await apply(page, releases[1].version);
      assert.deepEqual(await ledger(page), before);
      assert.equal(await page.evaluate(() => getStaffCount()), 6);
      await page.reload();
      assert.deepEqual(await ledger(page), before);
    },
    { state: pending },
  ));

for (const failure of ["missing", "hash", "mime"])
  test(`failed ${failure} update retains the current release and retries after repair`, async () =>
    scenario(
      async (s) => {
        const { page, failures, releases, select } = s;
        await settings(page);
        select(1);
        failures.set("js/core/config.js", failure);
        await page.locator("#checkPwaUpdate").tap();
        await wait(
          page,
          () =>
            document
              .getElementById("pwaStatus")
              .textContent.includes("설치 실패"),
          null,
          { timeout: 20000, polling: 100 },
        );
        assert.equal(
          await page.evaluate(() => PwaRuntime.version),
          releases[0].version,
        );
        assert.equal(
          await page.evaluate(
            async () =>
              !!(await navigator.serviceWorker.getRegistration()).waiting,
          ),
          false,
        );
        assert.equal(await page.evaluate(() => state.money), 123456);
        assert.equal(
          await page.evaluate(
            async () =>
              (await caches.keys()).filter((key) =>
                key.includes("nice-chicken-shell"),
              ).length,
          ),
          1,
        );
        await shot(page, `failed-${failure}`);
        failures.clear();
        await page.locator("#checkPwaUpdate").tap();
        await wait(
          page,
          () => !document.getElementById("applyPwaUpdate").disabled,
          null,
          { timeout: 20000, polling: 100 },
        );
        await apply(page, releases[1].version);
        assert.equal(await page.evaluate(() => state.money), 123456);
      },
      { state: { money: 123456 } },
    ));

test("save failure blocks activation/reload and retry preserves the exact current ledger", async () =>
  scenario(
    async (s) => {
      const { page, releases } = s;
      await update(s);
      await page.evaluate(() => {
        recordIncome(1, { menuId: "fried", count: 1 });
        window.originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("synthetic quota");
          return window.originalSetItem.call(this, k, v);
        };
      });
      const before = await ledger(page);
      await page.locator("#applyPwaUpdate").tap();
      await wait(page, () =>
        document
          .getElementById("pwaStatus")
          .textContent.includes("저장에 실패"),
      );
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      assert.equal(await page.evaluate(() => PwaRuntime.applying), false);
      assert.equal(await page.evaluate(() => _saveDirty), true);
      assert.deepEqual(await ledger(page), before);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.originalSetItem;
      });
      await apply(page, releases[1].version);
      assert.deepEqual(await ledger(page), before);
    },
    { state: { money: "9007199254740993" } },
  ));

test("other app tab blocks activation until closed and does not reload either session", async () =>
  scenario(async (s) => {
    const { page, context, url, releases } = s;
    await update(s);
    const other = await context.newPage();
    await other.goto(url);
    await page.locator("#applyPwaUpdate").tap();
    await wait(page, () =>
      document.getElementById("pwaStatus").textContent.includes("다른 앱 탭"),
    );
    assert.equal(
      await page.evaluate(() => PwaRuntime.version),
      releases[0].version,
    );
    assert.equal(
      await other.evaluate(() => PwaRuntime.version),
      releases[0].version,
    );
    await other.close();
    await apply(page, releases[1].version);
  }));

test("waiting update cannot interrupt the pending-reward modal; closing it never pays", async () =>
  scenario(
    async (s) => {
      const { page, releases } = s;
      const before = await ledger(page);
      await update(s, true);
      await page.evaluate(() =>
        document.getElementById("applyPwaUpdate").click(),
      );
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      assert.equal(
        await page
          .locator("#modalOffline")
          .evaluate((e) => e.classList.contains("on")),
        true,
      );
      assert.deepEqual(await ledger(page), before);
      await shot(page, "pending-waiting");
      await settings(page);
      await apply(page, releases[1].version);
      assert.deepEqual(await ledger(page), before);
    },
    { state: pending },
  ));

test("waiting update leaves live ending timers/input intact until the user cancels", async () =>
  scenario(
    async (s) => {
      const { page, releases } = s;
      await page.evaluate(async () => {
        state.endingUnlocked = true;
        checkEndingCondition();
      });
      await page.locator("#endingYesBtn").tap();
      await wait(page, () => endingPhase === "playing");
      const run = await page.evaluate(() => endingRun);
      await update(s, true);
      await page.evaluate(() =>
        document.getElementById("applyPwaUpdate").click(),
      );
      assert.equal(await page.evaluate(() => endingPhase), "playing");
      assert.equal(await page.evaluate(() => endingRun), run);
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      await page.locator("#endingDialogWrapper").tap();
      await shot(page, "ending-waiting");
      await page.keyboard.press("Escape");
      await settings(page);
      await apply(page, releases[1].version);
      assert.deepEqual(
        await page.evaluate(() => [
          state.endingSeen,
          state.robotGrandson,
          endingPhase,
        ]),
        [false, false, "idle"],
      );
    },
    { live: true },
  ));

test("nonempty backup input blocks applying without altering the exported receipt", async () =>
  scenario(
    async (s) => {
      const { page, releases } = s;
      await update(s);
      await page.locator("#exportSaveBtn").tap();
      const raw = await page.locator("#saveTransferText").inputValue();
      await page.locator("#applyPwaUpdate").tap();
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      assert.equal(await page.locator("#saveTransferText").inputValue(), raw);
      assert.ok(
        (await page.locator("#pwaStatus").textContent()).includes("입력란"),
      );
      await page.locator("#saveTransferText").fill("");
      await apply(page, releases[1].version);
    },
    { state: pending },
  ));

test("missing pinned JS fails closed rather than fetching the server's newer code", async () =>
  scenario(
    async ({ page, select, requests, releases }) => {
      const key = await page.evaluate(async () =>
        (await caches.keys()).find((key) =>
          key.startsWith("nice-chicken-shell"),
        ),
      );
      await page.evaluate(async (key) => {
        const cache = await caches.open(key);
        await cache.delete(new URL("./js/core/config.js", location.href).href);
      }, key);
      select(1);
      const count = requests.filter(
        (r) => r.path === "js/core/config.js",
      ).length;
      const response = await page.evaluate(async () => {
        const r = await fetch("./js/core/config.js");
        return { status: r.status, body: await r.text() };
      });
      assert.equal(response.status, 503);
      assert.ok(!response.body.includes("pwaFixtureVersion"));
      assert.equal(
        requests.filter((r) => r.path === "js/core/config.js").length,
        count,
      );
      assert.equal(
        await page.evaluate(() => PwaRuntime.version),
        releases[0].version,
      );
      assert.equal(await page.evaluate(() => state.money), 123456);
    },
    { state: { money: 123456 } },
  ));

test("update preserves foreign/legacy caches and never caches API POST", async () =>
  scenario(async (s) => {
    const { page, releases } = s;
    await page.evaluate(async () => {
      for (const key of ["other-app", "nice-chicken-v1"]) {
        const c = await caches.open(key);
        await c.put("/sentinel", new Response("keep"));
      }
    });
    await update(s);
    await apply(page, releases[1].version);
    const r = await page.evaluate(async () => {
      const keys = await caches.keys();
      const response = await fetch("./v1/coupons/mock/redemptions", {
        method: "POST",
        body: "synthetic",
      });
      const cached = await caches.match(
        new URL("./v1/coupons/mock/redemptions", location.href),
      );
      return { keys, status: response.status, cached: !!cached };
    });
    assert.ok(
      r.keys.includes("other-app") && r.keys.includes("nice-chicken-v1"),
    );
    assert.equal(r.status, 405);
    assert.equal(r.cached, false);
  }));

test("offline branch roundtrip retains six staff, choices, receipt and service cache through update", async () =>
  scenario(
    async (s) => {
      const { page, context, releases, serverOffline } = s;
      await page.evaluate(() => {
        state.regionUnlocked.busan = true;
        state.delivery = { level: 0, riders: 1 };
        Math.random = () => 0.5;
        updateDelivery(2, Date.now());
        updateOnlineAuto((0.4 * 60) / computeRates().onlineOrdersPerMin);
        save(true);
      });
      const before = await ledger(page);
      serverOffline(true);
      await context.setOffline(true);
      await page.locator('[data-ui-close="modalOffline"]').tap();
      await page.locator("#openMap").tap();
      await page.locator('.map-node[data-region-id="busan"]').tap();
      await page.locator("#mapGo").tap();
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => state.offlineReward.amount), 0);
      await page.locator("#openMap").tap();
      await page.locator('.map-node[data-region-id="changnyeong"]').tap();
      await page.locator("#mapGo").tap();
      await page.keyboard.press("Escape");
      if (
        await page
          .locator("#modalExpansion")
          .evaluate((e) => e.classList.contains("on"))
      )
        await page.keyboard.press("Escape");
      assert.deepEqual(await ledger(page), before);
      serverOffline(false);
      await context.setOffline(false);
      await update(s);
      await apply(page, releases[1].version);
      assert.deepEqual(await ledger(page), before);
    },
    { state: pending },
  ));

for (const [name, viewport] of [
  ["portrait", { width: 320, height: 568 }],
  ["landscape", { width: 568, height: 320 }],
])
  test(`${name} real touch/scroll/focus, backup/import/reset work in the controlled offline shell`, async () =>
    scenario(
      async ({ page, context, serverOffline }) => {
        page.on("dialog", (d) => d.accept());
        serverOffline(true);
        await context.setOffline(true);
        await page.reload();
        await settings(page);
        const bounds = await page
          .locator("#modalSettings .modal")
          .boundingBox();
        assert.ok(
          bounds.x >= -1 &&
            bounds.y >= -1 &&
            bounds.x + bounds.width <= viewport.width + 1 &&
            bounds.y + bounds.height <= viewport.height + 1,
        );
        await page.locator("#checkPwaUpdate").tap();
        await wait(page, () =>
          document
            .getElementById("pwaStatus")
            .textContent.includes("확인 실패"),
        );
        await shot(page, name + "-update");
        await page.locator("#exportSaveBtn").tap();
        const raw = await page.locator("#saveTransferText").inputValue();
        const before = await ledger(page);
        assert.equal(JSON.parse(raw).data.offlineReward.amount, 500);
        await page.locator("#saveTransferText").fill(raw);
        await page.locator("#importSaveBtn").tap();
        await page.reload();
        assert.deepEqual(await ledger(page), before);
        await settings(page);
        await page.locator("#openCoupons").tap();
        await page.locator("#useVegCoupon").tap();
        assert.ok(
          (await page.locator("#modalPin").textContent()).includes(
            "서버 검증이나 매장 승인",
          ),
        );
        await page.locator("#pinInput").fill("0000");
        await page.keyboard.press("Escape");
        assert.equal(await page.evaluate(() => state.coupons.veg), 7);
        await page.keyboard.press("Escape");
        await page.locator("#resetAll").tap();
        assert.deepEqual(
          await page.evaluate(() => [
            state.money,
            state.offlineReward.amount,
            state.coupons,
            localStorage.getItem(SAVE_BACKUP_KEY),
          ]),
          [0, 0, { drink: 0, veg: 0 }, null],
        );
        await page.reload();
        assert.equal(await page.evaluate(() => state.money), 0);
        assert.equal(
          await page.evaluate(() => !!navigator.serviceWorker.controller),
          true,
        );
      },
      { state: pending, viewport },
    ));
