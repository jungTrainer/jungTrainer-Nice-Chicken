const assert = require("node:assert/strict"),
  path = require("node:path");
const { test } = require("node:test");
const { harness, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();
function valid() {
  return fixture({
    money: "9007199254740993",
    coupons: { drink: 3, veg: 7 },
    offlineReward: {
      amount: 500,
      seconds: 60,
      menus: { fried: { count: 1, earned: 500 } },
    },
    endingSeen: true,
    robotGrandson: true,
    extension: { keep: "yes" },
  });
}
const raw = (p) =>
  p.evaluate(
    (key) => ({
      primary: recoveryTestStorage.get.call(localStorage, key),
      backup: recoveryTestStorage.get.call(localStorage, key + "_backup"),
      fence: recoveryTestStorage.get.call(localStorage, key + "_resetFence"),
      archive: recoveryTestStorage.get.call(
        localStorage,
        key + "_recoveryArchive",
      ),
    }),
    KEY,
  );
const acknowledge = (p) => p.on("dialog", (d) => d.accept());
const restore = (p) => p.locator("#recoverBackup").tap();
async function second(p) {
  const b = await p.context().newPage();
  await b.goto(p.url());
  await b.evaluate(() => SessionOwner.ready);
  return b;
}

test("absent storage starts a new game; two corrupt keys preserve originals and cannot start/pay/reset", async () => {
  await game(null, async (p) => {
    assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
    assert.equal(
      await p
        .locator("#modalProfile")
        .evaluate((e) => e.classList.contains("on")),
      true,
    );
  });
  await game(
    null,
    async (p) => {
      const before = await raw(p);
      const r = await p.evaluate(() => ({
        blocked: SaveRecovery.blocked,
        claim: claimOfflineReward(),
        reset: resetGame(),
        save: save(true),
        income: recordIncome(17),
        profile: modalProfile.classList.contains("on"),
      }));
      assert.deepEqual(r, {
        blocked: true,
        claim: false,
        reset: false,
        save: false,
        income: false,
        profile: false,
      });
      assert.deepEqual(await raw(p), before);
    },
    { rawSeed: { "": "{broken", _backup: "bad" } },
  );
});
for (const value of [
  null,
  [],
  { money: 17, level: 1, upgrades: "wrong" },
  { money: "not-money", level: 1, upgrades: {}, research: {}, menuStats: {} },
])
  test(
    "valid JSON with invalid game shape is paused: " + JSON.stringify(value),
    async () =>
      game(
        null,
        async (p) => {
          assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
          assert.equal((await raw(p)).primary, JSON.stringify(value));
          assert.equal(await p.evaluate(() => save(true)), false);
        },
        { rawSeed: { "": JSON.stringify(value) } },
      ),
  );

test("future version/encoding and invalid paid states are rejected without coercion or overwriting", async () => {
  for (const changes of [
    { version: 999 },
    { moneyEncoding: "future" },
    { coupons: { drink: -1, veg: 7 } },
    { endingSeen: "yes" },
    { offlineReward: { amount: "bad", seconds: 60 } },
  ]) {
    const seed = JSON.stringify({ ...valid(), ...changes });
    await game(
      null,
      async (p) => {
        assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
        assert.equal((await raw(p)).primary, seed);
      },
      { rawSeed: { "": seed } },
    );
  }
});

test("corrupt primary plus good backup is only a preview until an actual confirmed selection", async () => {
  const data = valid(),
    backup = JSON.stringify(data);
  await game(
    null,
    async (p) => {
      const before = await raw(p);
      assert.equal(await p.evaluate(() => state.money), data.money);
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), false);
      assert.equal(await p.evaluate(() => claimOfflineReward()), false);
      await p.locator("#recoveryClose").tap();
      assert.deepEqual(await raw(p), before);
      await p.locator("#openRecovery").tap();
      acknowledge(p);
      await restore(p);
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
      const disk = JSON.parse((await raw(p)).primary);
      assert.equal(disk.money, data.money);
      assert.deepEqual(disk.offlineReward, data.offlineReward);
      assert.deepEqual(disk.coupons, data.coupons);
      assert.equal(disk.endingSeen, true);
      assert.equal(disk.robotGrandson, true);
      assert.deepEqual(disk.extension, data.extension);
      assert.equal(
        JSON.parse((await raw(p)).archive).originals.primary,
        "{broken",
      );
      await p.reload();
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
    },
    { rawSeed: { "": "{broken", _backup: backup } },
  );
});

test("cancelled recovery makes no archive/primary/backup writes and does not change the receipt", async () =>
  game(
    null,
    async (p) => {
      const before = await raw(p);
      p.on("dialog", (d) => d.dismiss());
      await restore(p);
      assert.deepEqual(await raw(p), before);
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
      assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
    },
    { rawSeed: { "": "{broken", _backup: JSON.stringify(valid()) } },
  ));

test("raw download retains byte-for-byte corrupt and valid originals without normalization", async () =>
  game(
    null,
    async (p) => {
      const before = await raw(p);
      const downloaded = p.waitForEvent("download");
      await p.locator("#recoveryExport").tap();
      await downloaded;
      const archive = JSON.parse(
        await p.locator("#recoveryRawText").inputValue(),
      );
      assert.equal(archive.originals.primary, before.primary);
      assert.equal(archive.originals.backup, before.backup);
      assert.deepEqual(await raw(p), before);
    },
    { rawSeed: { "": "{broken", _backup: JSON.stringify(valid()) } },
  ));

for (const failure of ["archive", "primary"])
  test(
    "failed recovery " +
      failure +
      " commit preserves good backup, original primary and exact receipt",
    async () =>
      game(
        null,
        async (p) => {
          const before = await raw(p);
          acknowledge(p);
          await restore(p);
          const after = await raw(p);
          assert.equal(after.primary, before.primary);
          assert.equal(after.backup, before.backup);
          assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
          assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
          await p.evaluate(() => {
            recoveryFailure = {};
          });
          await restore(p);
          assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
          assert.equal(
            JSON.parse((await raw(p)).primary).money,
            "9007199254740993",
          );
        },
        {
          rawSeed: { "": "{broken", _backup: JSON.stringify(valid()) },
          storageFailure: { [failure]: true },
        },
      ),
  );

test("read denial stays paused with lock; permission recovery requires explicit primary selection", async () =>
  game(
    null,
    async (p) => {
      const before = await raw(p);
      assert.equal(await p.evaluate(() => SessionOwner.ownsLock()), true);
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), false);
      await p.evaluate(() => {
        recoveryFailure = {};
      });
      await p.locator("#recoveryRefresh").tap();
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), false);
      assert.deepEqual(await raw(p), before);
      acknowledge(p);
      await p.locator("#recoverPrimary").tap();
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
      assert.equal(await p.evaluate(() => state.money), "9007199254740993");
    },
    {
      rawSeed: {
        "": JSON.stringify(valid()),
        _backup: JSON.stringify(valid()),
      },
      storageFailure: { read: true },
    },
  ));

test("backup write refusal reports reduced backup protection while primary income commits once", async () =>
  game(
    valid(),
    async (p) => {
      const before = await raw(p);
      await p.evaluate(() => {
        recordIncome(17);
        save(true);
      });
      assert.equal(
        JSON.parse((await raw(p)).primary).money,
        "9007199254741010",
      );
      assert.equal((await raw(p)).backup, before.backup);
      assert.ok(
        (await p.locator("#recoveryStatus").textContent()).includes(
          "백업 저장 실패",
        ),
      );
    },
    { storageFailure: { backup: true } },
  ));

test("primary write refusal retains dirty and exact one-won income; UI retry persists once", async () =>
  game(
    valid(),
    async (p) => {
      await p.evaluate(() => {
        recordIncome(1);
        save(true);
      });
      assert.equal(await p.evaluate(() => _saveDirty), true);
      await p.evaluate(() => {
        recoveryFailure = {};
      });
      if (
        await p
          .locator("#modalOffline")
          .evaluate((e) => e.classList.contains("on"))
      )
        await p.locator('[data-ui-close="modalOffline"]').tap();
      await p.locator("#openSettings").tap();
      await p.locator("#openRecoverySettings").tap();
      await p.locator("#recoveryRetry").tap();
      assert.equal(await p.evaluate(() => _saveDirty), false);
      assert.equal(
        JSON.parse((await raw(p)).primary).money,
        "9007199254740994",
      );
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), "9007199254740994");
    },
    { storageFailure: { primary: true } },
  ));

test("reset fence refusal and primary refusal retain root, fixed receipt and current durable primary", async () => {
  for (const failure of ["fence", "primary"])
    await game(
      valid(),
      async (p) => {
        const before = await raw(p);
        const r = await p.evaluate(() => {
          const original = state;
          return {
            ok: resetGame(),
            same: state === original,
            money: state.money,
            pending: state.offlineReward.amount,
          };
        });
        assert.deepEqual(r, {
          ok: false,
          same: true,
          money: "9007199254740993",
          pending: 500,
        });
        assert.equal((await raw(p)).primary, before.primary);
      },
      { storageFailure: { [failure]: true } },
    );
});

test("reset deletion refusal followed by damaged primary cannot revive prior-generation coupons/pending", async () =>
  game(
    valid(),
    async (p) => {
      await p.evaluate(() => {
        save(true);
        save(true);
      });
      assert.equal(await p.evaluate(() => resetGame()), true);
      const after = await raw(p);
      assert.ok(after.backup);
      assert.equal(JSON.parse(after.primary).money, 0);
      assert.ok(after.fence);
      await p.evaluate(() =>
        recoveryTestStorage.set.call(localStorage, SAVE_KEY, "{broken"),
      );
      await p.reload();
      assert.equal(await p.evaluate(() => SaveRecovery.blocked), true);
      assert.equal(await p.locator("#recoverBackup").isDisabled(), true);
      assert.equal((await raw(p)).primary, "{broken");
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 0);
    },
    { storageFailure: { delete: true } },
  ));

test("failed reset preparation followed by ordinary save advances generation without losing original progress", async () =>
  game(
    valid(),
    async (p) => {
      await p.evaluate(() => {
        recoveryFailure.primary = true;
        resetGame();
        recoveryFailure = {};
        recordIncome(1);
        save(true);
        save(true);
      });
      const data = await raw(p);
      assert.equal(JSON.parse(data.primary).money, "9007199254740994");
      assert.equal(
        JSON.parse(data.primary)._saveRecovery.generation,
        JSON.parse(data.fence).generation,
      );
      assert.equal(
        JSON.parse(data.backup)._saveRecovery.generation,
        JSON.parse(data.fence).generation,
      );
      await p.reload();
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
    },
    { storageFailure: {} },
  ));

test("recovery commit sets absence baseline now; it never invents income from an old snapshot", async () => {
  const data = valid();
  data.upgrades.hire = 6;
  data.lastSeenAt -= 3600000;
  await game(
    null,
    async (p) => {
      acknowledge(p);
      await restore(p);
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
      assert.equal(
        await p.evaluate(() => state.lastSeenAt),
        await p.evaluate(() => Date.now()),
      );
    },
    { rawSeed: { "": "{broken", _backup: JSON.stringify(data) } },
  );
});

test("stale candidate selection refuses changed primary and does not overwrite another saved snapshot", async () =>
  game(
    null,
    async (p) => {
      const current = await raw(p);
      await p.evaluate(
        (data) =>
          recoveryTestStorage.set.call(
            localStorage,
            SAVE_KEY,
            JSON.stringify(data),
          ),
        valid(),
      );
      acknowledge(p);
      assert.equal(
        await p.evaluate(() => SaveRecovery.restore("backup")),
        false,
      );
      assert.notEqual((await raw(p)).primary, current.primary);
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), false);
    },
    { rawSeed: { "": "{broken", _backup: JSON.stringify(valid()) } },
  ));

test("reader cannot recover/reset/pay while owner is paused; owner recovery then actual handoff loads latest", async () =>
  game(
    null,
    async (p) => {
      const b = await second(p);
      assert.equal(await b.evaluate(() => SessionOwner.mode), "reader");
      assert.equal(
        await b.evaluate(() => SaveRecovery.restore("backup")),
        false,
      );
      await b.locator("#sessionRequest").tap();
      assert.equal(await p.evaluate(() => SessionOwner.yieldWriter()), false);
      acknowledge(p);
      await restore(p);
      await p.locator("#recoveryClose").tap();
      if (
        await p
          .locator("#modalOffline")
          .evaluate((e) => e.classList.contains("on"))
      )
        await p.locator('[data-ui-close="modalOffline"]').tap();
      assert.equal(await p.evaluate(() => SessionOwner.yieldWriter()), true);
      await b.waitForFunction(() => SessionOwner.canMutate(), null, {
        polling: 100,
      });
      assert.equal(await b.evaluate(() => state.money), "9007199254740993");
      assert.equal(await b.evaluate(() => state.offlineReward.amount), 500);
      await b.close();
    },
    { rawSeed: { "": "{broken", _backup: JSON.stringify(valid()) } },
  ));

test("external manual backup can explicitly restore both-corrupt storage while raw archive preserves all inputs", async () =>
  game(
    null,
    async (p) => {
      acknowledge(p);
      await p.locator("#recoveryImportText").fill(
        JSON.stringify({
          app: "niceChicken",
          type: "manual-save-export",
          version: 1,
          data: valid(),
        }),
      );
      await p.locator("#recoveryImport").tap();
      assert.equal(await p.evaluate(() => SessionOwner.canMutate()), true);
      const after = await raw(p);
      assert.equal(JSON.parse(after.archive).originals.backup, "bad");
      assert.equal(JSON.parse(after.primary).coupons.veg, 7);
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), "9007199254740993");
    },
    { rawSeed: { "": "{broken", _backup: "bad" } },
  ));

for (const [name, viewport] of [
  ["portrait", { width: 320, height: 568 }],
  ["landscape", { width: 568, height: 320 }],
])
  test(
    name +
      " actual recovery inputs/scroll/close fit; offline branch roundtrip retains paid/pending and service progress",
    async () => {
      const data = valid();
      data.regionUnlocked.busan = true;
      data.upgrades.hire = 6;
      data.serviceTimers.onlineOrders = 0.4;
      data.staffStats.neighbor = { auto: 3, tip: 2, earned: 123 };
      await game(
        null,
        async (p) => {
          const box = await p.locator("#sessionControls").boundingBox();
          assert.ok(
            box.x >= 0 &&
              box.y >= 0 &&
              box.width <= viewport.width &&
              box.y + box.height <= viewport.height + 1,
          );
          await p.locator("#recoveryImportText").fill("invalid");
          await p.locator("#recoveryImport").tap();
          assert.equal((await raw(p)).primary, "{broken");
          await p.locator("#recoveryImportText").fill("");
          acknowledge(p);
          await restore(p);
          await p.locator("#recoveryClose").tap();
          await p.evaluate(() => {
            if (modalOffline) modalOffline.classList.remove("on");
          });
          await p.context().setOffline(true);
          assert.equal(
            await p.evaluate(() => BranchManager.move("busan")),
            true,
          );
          assert.equal(
            await p.evaluate(() => BranchManager.move("changnyeong")),
            true,
          );
          assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
          assert.equal(await p.evaluate(() => state.coupons.veg), 7);
          assert.equal(
            await p.evaluate(() => state.staffStats.neighbor.auto),
            3,
          );
          assert.ok(
            Math.abs(
              (await p.evaluate(() => state.serviceTimers.onlineOrders)) - 0.4,
            ) < 1e-9,
          );
          await p.screenshot({
            path: path.join(
              __dirname,
              "../test-results/screenshots/nice-chicken-imp14-" + name + ".png",
            ),
          });
        },
        { viewport, rawSeed: { "": "{broken", _backup: JSON.stringify(data) } },
      );
    },
  );
