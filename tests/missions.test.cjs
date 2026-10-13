const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness, NOW } = require("./helpers/game.cjs");
const { game, fixture } = harness();

test("legacy partial serving progress continues from its recorded count", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      delete state.missions._serveToday;
      const goal = state.missions.dailyList.find((g) => g.type === "serve");
      goal.current = 4;
      ensureMissionReset();
      onServeOneOnline();
      return goal.current;
    });
    assert.equal(r, 5);
  }));
test("first purchase at Seoul midnight belongs to the new date", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    const r = await p.evaluate(() => {
      window.testNow = Date.UTC(2026, 9, 12, 14, 59, 59);
      ensureMissionReset();
      state.missions._upgBuysToday = 3;
      window.testNow = Date.UTC(2026, 9, 12, 15);
      buyUpgrade("expand");
      return {
        key: state.missions.dailyKey,
        count: state.missions._upgBuysToday,
      };
    });
    assert.deepEqual(r, { key: "2026-10-13", count: 1 });
  }));
test("all eight weekly objectives update and rewards pay once", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      const m = state.missions;
      m.weeklyStamps = 7;
      state.totalSales = 900000;
      state.rep = 4.4;
      m._weekTip = 20;
      m._weekUpgBuys = 15;
      state.upgrades.signboard = 3;
      state.upgrades.expand = 3;
      state.menuStats.fried = { count: 30, earned: 900000 };
      updateMissionsOnlineOnly();
      generateWeeklyCertificate();
      generateWeeklyCertificate();
      return {
        done: m.weeklyList.filter((g) => g.done).length,
        completed: m.weeklyCompletedAt,
        coupons: state.coupons.drink,
      };
    });
    assert.equal(r.done, 8);
    assert.ok(r.completed);
    assert.equal(r.coupons, 1);
  }));
test("normal and staff purchases increment counters only when paid", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    const r = await p.evaluate(() => {
      buyUpgrade("hire");
      buyStaffUpgrade("neighbor", "auto");
      state.money = 0;
      buyUpgrade("expand");
      return {
        day: state.missions._upgBuysToday,
        week: state.missions._weekUpgBuys,
      };
    });
    assert.deepEqual(r, { day: 2, week: 2 });
  }));
test("max-level objectives become repeatable serves without revoking paid goals", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      for (const u of UPGRADES) state.upgrades[u.id] = u.maxLevel;
      for (const s of STAFF_POOL)
        state.staffStats[s.key].auto = state.staffStats[s.key].tip = 10;
      const paid = state.missions.dailyList.find((g) => g.type === "rep");
      paid.done = true;
      state.rep = 1;
      repairMissionGoals();
      for (let i = 0; i < 40; i++) onServeOneOnline();
      return {
        converted: state.missions.weeklyList
          .filter((g) => g.originalType)
          .map((g) => g.done),
        paid: paid.done,
      };
    });
    assert.deepEqual(r.converted, [true, true, true]);
    assert.equal(r.paid, true);
  }));
test("daily payout retries after storage failure and never repeats on reload", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.missions.dailyList.forEach((g) => (g.done = true));
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw Error("full");
      };
      updateMissionsOnlineOnly();
      const failed = state.coupons.veg;
      Storage.prototype.setItem = original;
      updateMissionsOnlineOnly();
      updateMissionsOnlineOnly();
      return { failed, paid: state.coupons.veg };
    });
    assert.deepEqual(r, { failed: 0, paid: 1 });
    await p.reload();
    assert.equal(await p.evaluate(() => state.coupons.veg), 1);
  }));
test("date and exact weekly boundaries reset without erasing coupons", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.coupons.veg = 3;
      state.missions.dailyCompletedToday = true;
      window.testNow = state.missions.weekEndAt;
      sessionStorage.setItem("testNow", testNow);
      ensureMissionReset();
      return {
        done: state.missions.dailyCompletedToday,
        veg: state.coupons.veg,
        start: state.missions.weekStartAt,
      };
    });
    assert.equal(r.done, false);
    assert.equal(r.veg, 3);
    assert.equal(r.start, NOW + 7 * 86400000);
  }));
