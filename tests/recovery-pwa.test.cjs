const assert = require("node:assert/strict"),
  path = require("node:path");
const { test } = require("node:test");
const { pwaHarness } = require("./helpers/pwa.cjs");
const { scenario } = pwaHarness();
async function breakPrimary(p) {
  await p.evaluate(() => {
    state.offlineReward = { amount: 500, seconds: 60 };
    state.coupons = { drink: 3, veg: 7 };
    state.missions.dailyCompletedToday = true;
    save(true);
    localStorage.setItem(SAVE_BACKUP_KEY, JSON.stringify(state));
    localStorage.setItem(SAVE_KEY, "{broken");
  });
  await p.reload();
  await p.evaluate(() => SessionOwner.ready);
  assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
}
async function wait(p, fn) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (await p.evaluate(fn)) return;
    await p.waitForTimeout(100);
  }
  assert.fail("real worker condition timed out");
}

test("actual worker offline shell can inspect/export/restore corrupt primary and reload exact paid/pending state", async () =>
  scenario(async (s) => {
    await s.context.setOffline(true);
    await breakPrimary(s.page);
    const p = s.page;
    p.on("dialog", (d) => d.accept());
    const before = await p.evaluate(() =>
      localStorage.getItem(SAVE_BACKUP_KEY),
    );
    await p.locator("#recoveryExport").tap();
    assert.equal(
      JSON.parse(await p.locator("#recoveryRawText").inputValue()).originals
        .backup,
      before,
    );
    await p.locator("#recoverBackup").tap();
    assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
    await p.reload();
    await p.evaluate(() => SessionOwner.ready);
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
    assert.deepEqual(await p.evaluate(() => state.coupons), {
      drink: 3,
      veg: 7,
    });
    assert.equal(
      await p.evaluate(() => state.missions.dailyCompletedToday),
      true,
    );
    await p.screenshot({
      path: path.join(
        __dirname,
        "../test-results/screenshots/nice-chicken-imp14-offline.png",
      ),
    });
  }));

test("actual waiting/failed update cannot apply while recovery is unresolved; repair preserves raw originals", async () =>
  scenario(async (s) => {
    const p = s.page;
    await breakPrimary(p);
    const originals = await p.evaluate(() => ({
      p: localStorage.getItem(SAVE_KEY),
      b: localStorage.getItem(SAVE_BACKUP_KEY),
    }));
    s.select(1);
    s.failures.set("js/core/config.js", "hash");
    await p.evaluate(async () => {
      try {
        await (await navigator.serviceWorker.getRegistration()).update();
      } catch (_) {}
    });
    await wait(
      p,
      async () => !(await navigator.serviceWorker.getRegistration()).installing,
    );
    assert.deepEqual(
      await p.evaluate(() => ({
        p: localStorage.getItem(SAVE_KEY),
        b: localStorage.getItem(SAVE_BACKUP_KEY),
      })),
      originals,
    );
    s.failures.clear();
    await p.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await wait(
      p,
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    );
    await p.evaluate(() => {
      document.getElementById("modalSettings").classList.add("on");
      document.getElementById("applyPwaUpdate").click();
    });
    assert.equal(await p.evaluate(() => PwaRuntime.applying), false);
    assert.deepEqual(
      await p.evaluate(() => ({
        p: localStorage.getItem(SAVE_KEY),
        b: localStorage.getItem(SAVE_BACKUP_KEY),
      })),
      originals,
    );
    p.on("dialog", (d) => d.accept());
    await p.locator("#recoverBackup").tap();
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
  }));

test("installed standalone reader cannot repair a paused owner; closed owner allows explicit recovery without paying", async () =>
  scenario(
    async (s) => {
      const p = s.page;
      await breakPrimary(p);
      const cdp = await s.context.newCDPSession(p),
        id = s.url + "index.html";
      await cdp.send("PWA.install", {
        manifestId: id,
        installUrlOrBundleUrl: id,
      });
      await cdp.send("PWA.changeAppUserSettings", {
        manifestId: id,
        displayMode: "standalone",
      });
      const event = s.context.waitForEvent("page");
      await cdp.send("PWA.launch", { manifestId: id });
      const app = await event;
      await app.waitForLoadState();
      await app.evaluate(() => SessionOwner.ready);
      assert.equal(
        await app.evaluate(
          () => matchMedia("(display-mode: standalone)").matches,
        ),
        true,
      );
      assert.equal(await app.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(await app.locator("#recoverBackup").isDisabled(), true);
      await app.locator("#sessionRequest").tap();
      await p.close();
      await wait(app, () => SessionOwner.ownsLock());
      assert.equal(await app.evaluate(() => SessionOwner.canMutate()), false);
      app.on("dialog", (d) => d.accept());
      await app.locator("#recoverBackup").tap();
      assert.equal(await app.evaluate(() => SessionOwner.canMutate()), true);
      assert.equal(await app.evaluate(() => state.offlineReward.amount), 500);
      await app.evaluate(() => {
        cancelAnimationFrame(rAF_ID);
        requestAnimationFrame = () => 1;
        cancelAnimationFrame = () => {};
      });
      await app.screenshot({
        path: path.join(
          __dirname,
          "../test-results/screenshots/nice-chicken-imp14-installed.png",
        ),
      });
      const appCdp = await s.context.browser().newBrowserCDPSession();
      await appCdp.send("PWA.uninstall", { manifestId: id });
    },
    { persistent: true, realTime: true },
  ));
