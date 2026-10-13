const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { pwaHarness } = require("./helpers/pwa.cjs");
const { scenario } = pwaHarness();
const KEY = "niceChicken_idleServe_vFinal";
const wait = async (p, fn, arg) => {
  if (fn.constructor.name !== "AsyncFunction")
    return p.waitForFunction(fn, arg, { polling: 100, timeout: 20000 });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await p.evaluate(fn, arg)) return;
    await p.waitForTimeout(100);
  }
  assert.fail("async browser condition timed out");
};
async function second({ context, url }) {
  const p = await context.newPage();
  await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await p.goto(url);
  await p.evaluate(() => SessionOwner.ready);
  await p.evaluate(() => document.getElementById("splashScreen")?.remove());
  return p;
}
const disk = (p) =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const pending = {
  money: "9007199254740993",
  upgrades: { hire: 6, menuUnlock: 1 },
  coupons: { drink: 3, veg: 7 },
  offlineReward: {
    amount: 500,
    seconds: 60,
    menus: { fried: { count: 1, earned: 500 } },
  },
  management: {
    focus: "dispatch",
    leadStaff: "ato",
    menuPolicy: "signature",
    featuredMenu: "yang",
    readStories: ["arrival"],
  },
};
async function closePending(p) {
  if (
    await p.locator("#modalOffline").evaluate((e) => e.classList.contains("on"))
  )
    await p.locator('[data-ui-close="modalOffline"]').tap();
}
async function handoff(a, b) {
  await b.locator("#sessionRequest").tap();
  await closePending(a);
  await a.locator("#openSettings").tap();
  await a.locator("#yieldFromSettings").tap();
  await wait(b, () => SessionOwner.mode === "writer");
}
const shot = (p, name) =>
  p.screenshot({
    path: path.resolve(
      __dirname,
      `../test-results/screenshots/nice-chicken-imp13-${name}.png`,
    ),
  });

test("two tabs have one real Web Lock and a reader cannot write/tick/pay/move/import/reset", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      const before = await disk(a);
      const r = await b.evaluate(() => ({
        mode: SessionOwner.mode,
        income: recordIncome(23),
        claim: claimOfflineReward(),
        move: BranchManager.move("busan"),
        reset: resetGame(),
        imported: importSaveData(JSON.stringify(state)),
        save: save(true),
        tick: (() => {
          const n = state.play.onlineSecTotal;
          tick(60);
          return state.play.onlineSecTotal - n;
        })(),
      }));
      assert.deepEqual(r, {
        mode: "reader",
        income: false,
        claim: false,
        move: false,
        reset: false,
        imported: false,
        save: false,
        tick: 0,
      });
      assert.deepEqual(await disk(a), before);
      const locks = await a.evaluate(async () =>
        (await navigator.locks.query()).held.filter((l) =>
          l.name.startsWith("nice-chicken-writer"),
        ),
      );
      assert.equal(locks.length, 1);
      await b.close();
      assert.deepEqual(await disk(a), before);
    },
    { state: pending },
  ));

test("single accepted won persists while the stale reader close cannot resurrect a claimed receipt", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await s.context.setOffline(true);
      await b.reload();
      await b.evaluate(() => SessionOwner.ready);
      assert.equal(await b.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(await b.evaluate(() => claimOfflineReward()), false);
      await a.evaluate(() => {
        recordIncome(1, { menuId: "fried", count: 1 });
        claimOfflineReward();
      });
      const saved = await disk(a);
      assert.equal(saved.money, "9007199254741494");
      assert.equal(saved.offlineReward.amount, 0);
      await b.close();
      assert.deepEqual(await disk(a), saved);
      await a.reload();
      await a.evaluate(() => SessionOwner.ready);
      assert.equal((await disk(a)).money, saved.money);
    },
    { state: pending },
  ));

test("read-only backup uses latest persisted values and never snapshots its stale view", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await a.evaluate(() => {
        recordIncome(17);
        save(true);
      });
      await b.evaluate(() => {
        state.money = 7;
        state.offlineReward.amount = 77;
      });
      const data = await b.evaluate(() => JSON.parse(exportSaveData()).data);
      const stored = await disk(a);
      assert.equal(data.money, stored.money);
      assert.equal(data.offlineReward.amount, 500);
      await b.locator("#sessionExport").tap();
      assert.equal(
        JSON.parse(await b.locator("#sessionBackupText").inputValue()).data
          .money,
        stored.money,
      );
      await b.close();
    },
    { state: pending },
  ));

test("explicit handoff loads current branch, shared stats, fixed receipt and partial services", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await a.evaluate(() => {
        state.cert = {
          issuedThisWeek: true,
          issuedAt: Date.now(),
          validUntil: Date.now() + 604800000,
          usedAt: 0,
        };
        state.missions.dailyCompletedToday = true;
        state.regionUnlocked.busan = true;
        state.staffStats.ato.auto = 2;
        state.delivery = { level: 0, riders: 1 };
        Math.random = () => 0.5;
        updateDelivery(2, Date.now());
        updateOnlineAuto((0.4 * 60) / computeRates().onlineOrdersPerMin);
        recordIncome(17);
        save(true);
      });
      const expected = await disk(a);
      await handoff(a, b);
      const got = await b.evaluate(() => JSON.parse(exportSaveData()).data);
      for (const key of [
        "money",
        "offlineReward",
        "coupons",
        "cert",
        "staffStats",
        "management",
        "serviceTimers",
        "regionId",
      ])
        assert.deepEqual(got[key], expected[key], key);
      assert.equal(await a.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(await a.evaluate(() => save(true)), false);
      assert.equal(await b.evaluate(() => getStaffCount()), 6);
      await a.close();
      await b.close();
    },
    { state: pending },
  ));

test("failed handoff keeps owner/root/dirty; queued request succeeds only after storage retry", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await closePending(a);
      await a.locator("#openSettings").tap();
      await b.locator("#sessionRequest").tap();
      await a.evaluate(() => {
        recordIncome(1);
        window.originalStorage = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("synthetic quota");
          return originalStorage.call(this, k, v);
        };
      });
      await a.locator("#yieldFromSettings").tap();
      assert.equal(await a.evaluate(() => SessionOwner.mode), "writer");
      assert.equal(await b.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(await a.evaluate(() => _saveDirty), true);
      assert.ok(
        (await a.locator("#sessionStatus").textContent()).includes(
          "저장에 실패",
        ),
      );
      await a.evaluate(() => {
        Storage.prototype.setItem = originalStorage;
      });
      await a.locator("#sessionYield").tap();
      await wait(b, () => SessionOwner.mode === "writer");
      assert.equal(await b.evaluate(() => state.money), "9007199254740994");
      await a.close();
      await b.close();
    },
    { state: pending },
  ));

test("owner graceful close hands queued reader the last successful exact snapshot", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await a.evaluate(() => {
        recordIncome(17);
        save(true);
      });
      await b.locator("#sessionRequest").tap();
      await a.close();
      await wait(b, () => SessionOwner.mode === "writer");
      assert.equal(await b.evaluate(() => state.money), "9007199254741010");
      assert.equal(await b.evaluate(() => state.offlineReward.amount), 500);
      await b.close();
    },
    { state: pending },
  ));

test("renderer crash releases browser lock and recovers saved progress without inventing unsaved income", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await a.evaluate(() => {
        recordIncome(17);
        save(true);
        recordIncome(23);
      });
      await b.locator("#sessionRequest").tap();
      const cdp = await s.context.newCDPSession(a);
      const crashed = a.waitForEvent("crash", { timeout: 10000 });
      cdp.send("Page.crash").catch(() => {});
      await crashed;
      await a.close();
      await wait(b, () => SessionOwner.mode === "writer");
      assert.equal(await b.evaluate(() => state.money), "9007199254741010");
      assert.equal(await b.evaluate(() => state.offlineReward.amount), 500);
      await b.close();
    },
    { state: pending },
  ));

for (const method of ["request", "missing"])
  test(`Web Locks ${method} unavailable keeps old storage unchanged and provides exact backup`, async () =>
    scenario(
      async ({ page }) => {
        assert.equal(
          await page.evaluate(() => SessionOwner.mode),
          "unsupported",
        );
        const before = await disk(page);
        assert.equal(await page.evaluate(() => save(true)), false);
        assert.equal(await page.evaluate(() => resetGame()), false);
        await page.locator("#sessionExport").tap();
        assert.deepEqual(
          JSON.parse(await page.locator("#sessionBackupText").inputValue())
            .data,
          before,
        );
        await page.reload();
        await page.evaluate(() => SessionOwner.ready);
        assert.deepEqual(await disk(page), before);
      },
      {
        noLocks: method === "missing",
        seed: {
          ...pending,
          level: 1,
          lastSeenAt: 1791806400000,
          profile: { name: "검증" },
        },
        rejectLocks: method === "request",
      },
    ));

test("handoff works without BroadcastChannel; exclusion relies on real Web Locks", async () =>
  scenario(
    async (s) => {
      const b = await second(s);
      await handoff(s.page, b);
      assert.equal(await b.evaluate(() => SessionOwner.mode), "writer");
      assert.equal(await s.page.evaluate(() => SessionOwner.mode), "reader");
      await b.close();
    },
    { noChannel: true },
  ));

test("unexpected legacy write stops owner before it can overwrite; local draft and latest backups stay separate", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await a.evaluate(() => recordIncome(17));
      await b.evaluate(() => {
        const v = JSON.parse(localStorage.getItem(SAVE_KEY));
        v.money = "9007199254741993";
        localStorage.setItem(SAVE_KEY, JSON.stringify(v));
      });
      await wait(a, () => SessionOwner.mode === "conflict");
      assert.equal(await a.evaluate(() => save(true)), false);
      assert.equal((await disk(a)).money, "9007199254741993");
      await a.locator("#sessionDraft").tap();
      assert.equal(
        JSON.parse(await a.locator("#sessionBackupText").inputValue()).data
          .money,
        "9007199254741010",
      );
      await a.locator("#sessionExport").tap();
      assert.equal(
        JSON.parse(await a.locator("#sessionBackupText").inputValue()).data
          .money,
        "9007199254741993",
      );
      a.on("dialog", (d) => d.accept());
      await a.locator("#sessionRecover").tap();
      assert.equal(await a.evaluate(() => SessionOwner.mode), "writer");
      assert.equal(await a.evaluate(() => state.money), "9007199254741993");
      await b.close();
    },
    { state: pending },
  ));

test("saved import/reset publish authoritative state; reader cannot restore previous rewards", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      a.on("dialog", (d) => d.accept());
      await a.evaluate(() => {
        const data = JSON.parse(exportSaveData());
        data.data.money = "9007199254741993";
        importSaveData(JSON.stringify(data));
      });
      assert.equal((await disk(a)).money, "9007199254741993");
      assert.equal(await b.evaluate(() => resetGame()), false);
      await a.evaluate(() => resetGame());
      assert.equal((await disk(a)).money, 0);
      await b.close();
      assert.equal((await disk(a)).offlineReward.amount, 0);
      assert.equal(
        await a.evaluate(() => localStorage.getItem(SAVE_BACKUP_KEY)),
        null,
      );
    },
    { state: pending },
  ));

test("late PIN cannot use another root after import and ownership token changes", async () =>
  scenario(
    async (s) => {
      const a = s.page;
      a.on("dialog", (d) => d.accept());
      await closePending(a);
      await a.locator("#openSettings").tap();
      await a.locator("#openCoupons").tap();
      await a.locator("#useVegCoupon").tap();
      await a.evaluate(() => {
        const raw = JSON.parse(exportSaveData());
        raw.data.coupons.veg = 9;
        importSaveData(JSON.stringify(raw));
      });
      await closePending(a);
      await a.locator("#pinInput").fill("0000");
      await a.locator("#pinOk").tap();
      assert.equal(await a.evaluate(() => state.coupons.veg), 9);
    },
    { state: pending },
  ));

for (const [name, viewport] of [
  ["portrait", { width: 320, height: 568 }],
  ["landscape", { width: 568, height: 320 }],
])
  test(`${name} reader touch/backup/request panel fits and cannot use background input`, async () =>
    scenario(
      async (s) => {
        const b = await second(s);
        assert.equal(
          await b
            .locator("#modalOffline")
            .evaluate((e) => e.classList.contains("on")),
          false,
        );
        await b.locator("#sessionExport").tap();
        const box = await b.locator("#sessionControls").boundingBox();
        assert.ok(
          box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width + 1 &&
            box.y + box.height <= viewport.height + 1,
        );
        await b.evaluate(() => document.getElementById("resetAll").click());
        assert.equal((await disk(s.page)).offlineReward.amount, 500);
        await shot(b, name);
        await b.locator("#sessionRequest").tap();
        await closePending(s.page);
        await s.page.locator("#openSettings").tap();
        await s.page.locator("#yieldFromSettings").tap();
        await wait(b, () => SessionOwner.mode === "writer");
        assert.equal(await b.evaluate(() => state.offlineReward.amount), 500);
        await b.close();
      },
      { state: pending, viewport },
    ));

test("safe shell cleanup deletes only unused scoped shells and preserves saves/legacy/foreign caches", async () =>
  scenario(async ({ page }) => {
    const before = await disk(page);
    await page.evaluate(async () => {
      const key = (await caches.keys()).find((k) =>
        k.startsWith("nice-chicken-shell"),
      );
      window.unusedCache = key.replace(/:[^:]+$/, ":unused-test-release");
      for (const k of [unusedCache, "other-app", "nice-chicken-v1"])
        await caches.open(k);
    });
    await page.locator("#openSettings").tap();
    await page.locator("#prunePwaCaches").tap();
    await wait(page, () =>
      document.getElementById("pwaStatus").textContent.includes("정리했습니다"),
    );
    const keys = await page.evaluate(() => caches.keys());
    assert.ok(keys.includes("other-app") && keys.includes("nice-chicken-v1"));
    assert.ok(!keys.some((k) => k.endsWith(":unused-test-release")));
    assert.deepEqual(await disk(page), before);
  }));

test("waiting update prevents shell cleanup and keeps both candidate and active versions", async () =>
  scenario(async (s) => {
    await s.page.locator("#openSettings").tap();
    s.select(1);
    await s.page.locator("#checkPwaUpdate").tap();
    await wait(
      s.page,
      async (version) => {
        const registration = await navigator.serviceWorker.getRegistration();
        return (
          registration.waiting?.state === "installed" &&
          (await caches.keys()).some((key) => key.endsWith(":" + version))
        );
      },
      s.releases[1].version,
    );
    const before = await s.page.evaluate(() => caches.keys());
    await s.page.locator("#prunePwaCaches").tap();
    await wait(s.page, () =>
      document
        .getElementById("pwaStatus")
        .textContent.includes("정리하지 않았습니다"),
    );
    assert.deepEqual(await s.page.evaluate(() => caches.keys()), before);
  }));

test("real hidden tab retains its lock, pauses tick and accumulates only one resume receipt", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      const visibility = await s.context.newCDPSession(a);
      await visibility.send("Emulation.setFocusEmulationEnabled", {
        enabled: false,
      });
      const otherVisibility = await s.context.newCDPSession(b);
      await otherVisibility.send("Emulation.setFocusEmulationEnabled", {
        enabled: false,
      });
      await b.bringToFront();
      await wait(a, () => document.hidden);
      assert.equal(await a.evaluate(() => SessionOwner.mode), "writer");
      const before = await disk(a);
      await a.evaluate(() => {
        window.testNow += 61000;
        tick(60);
      });
      assert.deepEqual(await disk(a), before);
      await b.evaluate(() => {
        window.testNow += 61000;
      });
      await a.bringToFront();
      await wait(a, () => !document.hidden);
      const receipt = await a.evaluate(() => state.offlineReward);
      assert.ok(money(receipt.amount) > 500n);
      assert.equal(receipt.menus.fried.earned, 500);
      await a.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      assert.deepEqual(await a.evaluate(() => state.offlineReward), receipt);
      await shot(a, "native-resume");
      // A queued background document must remain paused even if the owner closes.
      await b.evaluate(() => {
        void SessionOwner.request();
      });
      await wait(b, () => document.hidden);
      const foreground = await s.context.newPage();
      await foreground.bringToFront();
      await a.close();
      await wait(b, () => SessionOwner.mode === "writer");
      const inherited = await disk(b);
      assert.equal(await b.evaluate(() => SessionOwner.canTick()), false);
      await b.evaluate(() => tick(60));
      assert.deepEqual(await disk(b), inherited);
      await b.bringToFront();
      await wait(b, () => !document.hidden && SessionOwner.canTick());
      assert.deepEqual(await b.evaluate(() => state.offlineReward), receipt);
    },
    { state: pending, persistent: true, headed: true },
  ));
function money(value) {
  return BigInt(value);
}

test("actual installed standalone window is read-only until the existing tab saves and hands off", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        cdp = await s.context.newCDPSession(a),
        manifestId = s.url + "index.html";
      await cdp.send("PWA.install", {
        manifestId,
        installUrlOrBundleUrl: manifestId,
      });
      await cdp.send("PWA.changeAppUserSettings", {
        manifestId,
        displayMode: "standalone",
      });
      const newWindow = s.context.waitForEvent("page");
      await cdp.send("PWA.launch", { manifestId });
      const app = await newWindow;
      await app.waitForLoadState();
      await app.evaluate(() => SessionOwner.ready);
      assert.equal(
        await app.evaluate(
          () => matchMedia("(display-mode: standalone)").matches,
        ),
        true,
      );
      assert.equal(await app.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(await app.evaluate(() => state.offlineReward.amount), 500);
      assert.equal(await app.evaluate(() => claimOfflineReward()), false);
      await app.evaluate(() => {
        document.getElementById("splashScreen")?.remove();
        cancelAnimationFrame(rAF_ID);
        requestAnimationFrame = () => 1;
        cancelAnimationFrame = () => {};
      });
      await shot(app, "standalone-reader");
      await handoff(a, app);
      assert.equal(await app.evaluate(() => state.money), "9007199254740993");
      assert.equal(await app.evaluate(() => state.offlineReward.amount), 500);
      await app.close();
      await cdp.send("PWA.uninstall", { manifestId });
    },
    { state: pending, persistent: true, realTime: true },
  ));

test("ending/input blocks handoff until closed without granting the once-only effect", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await closePending(a);
      await a.evaluate(() => {
        state.endingUnlocked = true;
        checkEndingCondition();
      });
      await a.locator("#endingYesBtn").tap();
      await b.locator("#sessionRequest").tap();
      await a.locator("#sessionYield").tap();
      assert.equal(await a.evaluate(() => endingPhase), "playing");
      assert.equal(await b.evaluate(() => SessionOwner.mode), "reader");
      await a.keyboard.press("Escape");
      await a.locator("#sessionYield").tap();
      await wait(b, () => SessionOwner.mode === "writer");
      assert.equal(await b.evaluate(() => state.robotGrandson), false);
      assert.equal(await b.evaluate(() => state.endingSeen), false);
      await b.close();
    },
    { state: pending },
  ));

test("unknown live document prevents pruning unused shells", async () =>
  scenario(async (s) => {
    const a = s.page;
    await a.evaluate(async () => {
      const key = (await caches.keys()).find((k) =>
        k.startsWith("nice-chicken-shell"),
      );
      await caches.open(key.replace(/:[^:]+$/, ":unused-test-release"));
    });
    const unknown = await s.context.newPage();
    await unknown.goto(s.url + "unresponsive.html");
    await a.locator("#openSettings").tap();
    await a.locator("#prunePwaCaches").tap();
    await wait(a, () =>
      document
        .getElementById("pwaStatus")
        .textContent.includes("정리하지 않았습니다"),
    );
    assert.ok(
      (await a.evaluate(() => caches.keys())).some((k) =>
        k.endsWith(":unused-test-release"),
      ),
    );
    await unknown.close();
  }));

test("cleanup preserves the cache used by an old live document after a real forced worker activation", async () =>
  scenario(async (s) => {
    const a = s.page;
    await a.locator("#openSettings").tap();
    s.select(1);
    await a.locator("#checkPwaUpdate").tap();
    await wait(
      a,
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    );
    const worker = s.context
      .serviceWorkers()
      .find((w) => w !== s.context.serviceWorkers()[0]);
    assert.ok(worker);
    await worker.evaluate(() => self.skipWaiting());
    await wait(
      a,
      async () => !(await navigator.serviceWorker.getRegistration()).waiting,
    );
    await a.evaluate(async () => {
      const key = (await caches.keys()).find((k) =>
        k.startsWith("nice-chicken-shell"),
      );
      await caches.open(key.replace(/:[^:]+$/, ":unused-test-release"));
    });
    await a.locator("#prunePwaCaches").tap();
    await wait(a, () =>
      document.getElementById("pwaStatus").textContent.includes("정리했습니다"),
    );
    const keys = await a.evaluate(() => caches.keys());
    for (const r of s.releases)
      assert.ok(keys.some((k) => k.endsWith(":" + r.version)));
    assert.ok(!keys.some((k) => k.endsWith(":unused-test-release")));
  }));

test("reader cannot apply the pending PWA update or prune while owner keeps its receipt", async () =>
  scenario(
    async (s) => {
      const a = s.page,
        b = await second(s);
      await closePending(a);
      await a.locator("#openSettings").tap();
      s.select(1);
      s.failures.set("js/core/config.js", "hash");
      await a.locator("#checkPwaUpdate").tap();
      await wait(a, () =>
        document.getElementById("pwaStatus").textContent.includes("설치 실패"),
      );
      assert.equal(
        await a.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration()).waiting,
        ),
        false,
      );
      assert.equal((await disk(a)).offlineReward.amount, 500);
      assert.equal(await b.evaluate(() => SessionOwner.mode), "reader");
      s.failures.clear();
      await a.evaluate(async () =>
        (await navigator.serviceWorker.getRegistration()).update(),
      );
      await wait(
        a,
        async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
      );
      await b.evaluate(() => {
        document.getElementById("modalSettings").classList.add("on");
        document.getElementById("applyPwaUpdate").click();
        document.getElementById("prunePwaCaches").click();
      });
      assert.equal(
        await a.evaluate(() => PwaRuntime.version),
        s.releases[0].version,
      );
      assert.equal((await disk(a)).offlineReward.amount, 500);
      await b.close();
    },
    { state: pending },
  ));
