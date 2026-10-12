const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness, NOW, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();

test("backup recovery and manual import keep pending valuation and paid guards", async () =>
  game(fixture({ offlineReward: { amount: 500, seconds: 60 } }), async (p) => {
    await p.evaluate(() => {
      state.coupons.veg = 7;
      state.missions.dailyCompletedToday = true;
      state.endingSeen = true;
      state.robotGrandson = true;
      localStorage.setItem(
        "niceChicken_idleServe_vFinal_backup",
        JSON.stringify(state),
      );
      localStorage.setItem("niceChicken_idleServe_vFinal", "{broken");
    });
    await p.reload();
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
    assert.equal(await p.evaluate(() => state.coupons.veg), 7);
    p.on("dialog", (d) => d.accept());
    assert.equal(
      await p.evaluate(() => importSaveData(exportSaveData())),
      true,
    );
    await p.reload();
    assert.equal(
      await p.evaluate(() => state.missions.dailyCompletedToday),
      true,
    );
    assert.equal(await p.evaluate(() => state.robotGrandson), true);
  }));
test("pending amount survives reload and claims once", async () =>
  game(
    fixture({ offlineReward: { amount: 12345, seconds: 3600 } }),
    async (p) => {
      await p.reload();
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 12345);
      assert.equal(await p.evaluate(() => claimOfflineReward()), true);
      assert.equal(await p.evaluate(() => claimOfflineReward()), false);
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), 12345);
    },
  ));
test("absence is accumulated once; deadlines remain absolute", async () => {
  const f = fixture({ lastSeenAt: NOW - 3600000 });
  f.research.running = [
    {
      activeId: "training",
      targetLevel: 1,
      startAt: NOW - 1000,
      endAt: NOW + 3600000,
    },
  ];
  await game(f, async (p) => {
    const r = await p.evaluate(() => ({
      reward: state.offlineReward,
      deadline: state.research.running[0].endAt,
    }));
    assert.ok(r.reward.amount > 0);
    assert.equal(r.deadline, NOW + 3600000);
    await p.evaluate(() => {
      applyOfflineProgress();
      save(true);
    });
    await p.reload();
    assert.deepEqual(await p.evaluate(() => state.offlineReward), r.reward);
  });
});
test("failed claim restores pending and money", async () =>
  game(fixture({ offlineReward: { amount: 500, seconds: 60 } }), async (p) => {
    const r = await p.evaluate(() => {
      const s = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k.includes("vFinal")) throw Error("quota");
        return s.call(this, k, v);
      };
      const ok = claimOfflineReward();
      Storage.prototype.setItem = s;
      return { ok, money: state.money, pending: state.offlineReward.amount };
    });
    assert.deepEqual(r, { ok: false, money: 0, pending: 500 });
    assert.equal(await p.evaluate(() => claimOfflineReward()), true);
  }));
test("branch pending and shared cash restore through moves", async () =>
  game(fixture({ offlineReward: { amount: 500, seconds: 60 } }), async (p) => {
    await p.evaluate(() => {
      state.regionUnlocked.busan = true;
      BranchManager.move("busan");
    });
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 0);
    await p.evaluate(() => BranchManager.move("changnyeong"));
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
  }));
test("offline cap, backup recovery and reset do not resurrect a claimed receipt", async () =>
  game(fixture({ lastSeenAt: NOW - 20 * 3600000 }), async (p) => {
    assert.equal(await p.evaluate(() => state.offlineReward.seconds), 8 * 3600);
    await p.evaluate(() => claimOfflineReward());
    p.on("dialog", (d) => d.accept());
    await p.locator("#openSettings").tap();
    await p.locator("#resetAll").tap();
    await p.reload();
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 0);
    assert.equal(await p.evaluate(() => state.money), 0);
  }));
