const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness, NOW, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();

test("delayed startup cannot spawn a customer after moving to another branch", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      const original = window.setTimeout,
        queued = [];
      window.setTimeout = (callback, delay, ...args) =>
        delay === 700
          ? (queued.push(callback), 0)
          : original(callback, delay, ...args);
      initAfterLoad(false);
      window.setTimeout = original;
      state.regionUnlocked.busan = true;
      BranchManager.move("busan");
      queued.forEach((callback) => callback());
      return {
        queued: queued.length,
        customers: state.customers.length,
        region: state.regionId,
      };
    });
    assert.deepEqual(r, { queued: 1, customers: 0, region: "busan" });
  }));

test("all six hired staff appear in management and automatic serving rotation", async () =>
  game(fixture(), async (p) => {
    const result = await p.evaluate(() => {
      state.upgrades.hire = 6;
      openPanel("upg");
      state._staffRot = 0;
      return {
        buttons: document.querySelectorAll('[data-action="buy-staff-upgrade"]')
          .length,
        rotation: Array.from({ length: 6 }, () => pickStaffKey()),
        centers: staffCenters().map((s) => s.key),
      };
    });
    assert.equal(result.buttons, 12);
    assert.deepEqual(result.rotation, [
      "neighbor",
      "ato",
      "daughter1",
      "daughter2",
      "soninlaw",
      "grandson",
    ]);
    assert.deepEqual(result.centers, result.rotation);
  }));

test("online order fractions cannot pay on a different branch", async () =>
  game(fixture(), async (p) => {
    const result = await p.evaluate(() => {
      state.regionUnlocked.busan = true;
      updateOnlineAuto((0.9 * 60) / computeRates().onlineOrdersPerMin);
      const first = state.totalSales;
      BranchManager.move("busan");
      updateOnlineAuto((0.2 * 60) / computeRates().onlineOrdersPerMin);
      return { first, busan: state.totalSales };
    });
    assert.deepEqual(result, { first: 0, busan: 0 });
  }));

test("new branch mission setup preserves headquarters certificate and paid coupons", async () =>
  game(fixture(), async (p) => {
    const result = await p.evaluate(() => {
      const cert = {
        issuedThisWeek: true,
        issuedAt: Date.now(),
        validUntil: Date.now() + 7 * 86400000,
        usedAt: 0,
      };
      state.cert = { ...cert };
      state.coupons = { veg: 7, drink: 3 };
      state.regionUnlocked.busan = true;
      BranchManager.move("busan");
      ensureMissionReset();
      return { expected: cert, actual: state.cert, coupons: state.coupons };
    });
    assert.deepEqual(result.actual, result.expected);
    assert.deepEqual(result.coupons, { veg: 7, drink: 3 });
  }));

test("six real automatic serves credit each employee and the branch ledger once", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.upgrades.hire = 6;
      Math.random = () => 0.99;
      state.customers = Array.from({ length: 20 }, (_, i) => ({
        id: "six" + i,
        menuId: "fried",
        state: "waiting",
        x: 20,
        y: 100,
        patience: 999,
      }));
      autoServe((6 * 60) / (computeRates().autoServesPerMin * 2) + 0.001);
      return {
        earned: STAFF_POOL.map((s) => state.staffStats[s.key].earned),
        count: state.menuStats.fried.count,
        contrib: state.contrib.staff,
        total: state.totalSales,
      };
    });
    assert.equal(r.count, 6);
    assert.ok(r.earned.every((n) => n > 0));
    assert.equal(
      r.earned.reduce((a, b) => a + b, 0),
      r.total,
    );
    assert.equal(r.contrib, r.total);
  }));

test("staff training is shared, hiring and contribution are local without historical backfill", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    const r = await p.evaluate(() => {
      state.regionUnlocked.busan = true;
      state.upgrades.hire = 6;
      state.staffStats.neighbor.earned = 1234;
      buyStaffUpgrade("neighbor", "auto");
      recordIncome(100, { menuId: "fried", actorKey: "neighbor", count: 1 });
      BranchManager.move("busan");
      const hire = getStaffCount(),
        before = state.money;
      buyStaffUpgrade("grandson", "tip");
      const rejected = state.money === before;
      buyUpgrade("hire");
      recordIncome(200, { menuId: "fried", actorKey: "neighbor", count: 1 });
      const second = {
        hire: getStaffCount(),
        training: state.staffStats.neighbor.auto,
        contrib: state.contrib.staff,
        total: state.totalSales,
      };
      BranchManager.move("changnyeong");
      return {
        hire,
        rejected,
        second,
        first: {
          hire: getStaffCount(),
          contrib: state.contrib.staff,
          total: state.totalSales,
        },
        career: state.staffStats.neighbor.earned,
      };
    });
    assert.equal(r.hire, 0);
    assert.equal(r.rejected, true);
    assert.deepEqual(r.second, {
      hire: 1,
      training: 1,
      contrib: 200,
      total: 200,
    });
    assert.deepEqual(r.first, { hire: 6, contrib: 100, total: 100 });
    assert.equal(r.career, 1534);
    await p.reload();
    assert.equal(
      await p.evaluate(() => state.staffStats.neighbor.earned),
      1534,
    );
  }));

test("the sixth employee remains an attainable purchase mission after five are maxed", async () =>
  game(fixture({ money: 1e12 }), async (p) => {
    const r = await p.evaluate(() => {
      for (const u of UPGRADES) state.upgrades[u.id] = u.maxLevel;
      for (const s of STAFF_POOL.slice(0, 5))
        state.staffStats[s.key].auto = state.staffStats[s.key].tip = 10;
      repairMissionGoals();
      const type = state.missions.dailyList.find((g) => g.id === "d_upg").type;
      buyStaffUpgrade("grandson", "auto");
      buyStaffUpgrade("grandson", "tip");
      updateMissionsOnlineOnly();
      return {
        type,
        done: state.missions.dailyList.find((g) => g.id === "d_upg").done,
        buys: state.missions._upgBuysToday,
      };
    });
    assert.deepEqual(r, { type: "upg", done: true, buys: 2 });
  }));

test("online fractions pause per branch, resume once and survive reconnection", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.regionUnlocked.busan = true;
      updateOnlineAuto((0.7 * 60) / computeRates().onlineOrdersPerMin);
      BranchManager.move("busan");
      updateOnlineAuto((0.4 * 60) / computeRates().onlineOrdersPerMin);
      BranchManager.move("changnyeong");
      const resumed = onlineTimer;
      updateOnlineAuto((0.31 * 60) / computeRates().onlineOrdersPerMin);
      const first = state.totalSales;
      BranchManager.move("busan");
      save(true);
      return { resumed, first, second: state.totalSales, acc: onlineTimer };
    });
    assert.ok(Math.abs(r.resumed - 0.7) < 1e-9);
    assert.ok(r.first > 0);
    assert.equal(r.second, 0);
    await p.reload();
    assert.ok(Math.abs((await p.evaluate(() => onlineTimer)) - 0.4) < 1e-9);
    await p.evaluate(() =>
      updateOnlineAuto((0.61 * 60) / computeRates().onlineOrdersPerMin),
    );
    assert.equal(await p.evaluate(() => state.menuStats.fried.count), 1);
    await p.evaluate(() => BranchManager.move("changnyeong"));
    assert.equal(await p.evaluate(() => state.totalSales), r.first);
  }));

test("delivery trips resume only on their originating branch through reload", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      Math.random = () => 0.5;
      state.regionUnlocked.busan = true;
      state.delivery.riders = 1;
      updateDelivery(6, Date.now());
      BranchManager.move("busan");
      state.delivery.riders = 1;
      updateDelivery(2, Date.now());
      BranchManager.move("changnyeong");
      const elapsed = deliveryTimer;
      updateDelivery(4.001, Date.now());
      const first = state.totalSales;
      BranchManager.move("busan");
      save(true);
      return { elapsed, first, second: state.totalSales, trip: deliveryTimer };
    });
    assert.equal(r.elapsed, 6000);
    assert.ok(r.first > 0);
    assert.equal(r.second, 0);
    assert.equal(r.trip, 2000);
    await p.reload();
    assert.equal(await p.evaluate(() => deliveryTimer), 2000);
    await p.evaluate(() => {
      Math.random = () => 0.5;
      updateDelivery(8.001, Date.now());
    });
    assert.equal(await p.evaluate(() => state.menuStats.fried.count), 1);
  }));

test("auto serving backlog and employee rotation are branch-local", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.regionUnlocked.busan = true;
      state.upgrades.hire = 6;
      state._autoServeAcc = 0.75;
      state._eventCheckAcc = 5.5;
      state._staffRot = 5;
      BranchManager.move("busan");
      const second = {
        acc: state._autoServeAcc,
        rotation: state._staffRot,
        event: state._eventCheckAcc,
      };
      state._autoServeAcc = 0.2;
      state._eventCheckAcc = 3;
      state._staffRot = 2;
      BranchManager.move("changnyeong");
      save(true);
      return {
        second,
        first: {
          acc: state._autoServeAcc,
          rotation: state._staffRot,
          event: state._eventCheckAcc,
        },
        employee: pickStaffKey(),
      };
    });
    assert.deepEqual(r.second, { acc: 0, rotation: 0, event: 0 });
    assert.deepEqual(r.first, { acc: 0.75, rotation: 5, event: 5.5 });
    assert.equal(r.employee, "grandson");
    await p.reload();
    assert.equal(await p.evaluate(() => state._autoServeAcc), 0.75);
  }));

test("small-screen sixth employee touch does not hit a neighbor", async () =>
  game(
    fixture(),
    async (p) => {
      const point = await p.evaluate(() => {
        state.upgrades.hire = 6;
        updateUI();
        render();
        const s = staffCenters().at(-1),
          box = canvas.getBoundingClientRect();
        return {
          x: (s.x * box.width) / canvas.width,
          y: (s.hitY * box.height) / canvas.height,
        };
      });
      await p.locator("#stage").tap({ position: point });
      assert.deepEqual(
        await p.evaluate(() => Object.keys(window._fxState.staffs)),
        ["grandson"],
      );
      assert.equal(
        await p.evaluate(() => window._fxState.staffs.grandson.taps),
        1,
      );
    },
    { viewport: { width: 320, height: 568 } },
  ));

test("unexpired headquarters certificate remains paid across branch weeks and reuse", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.missions.weeklyList.forEach((g) => (g.done = true));
      state.missions.weeklyCompletedAt = Date.now();
      generateWeeklyCertificate();
      const cert = { ...state.cert };
      state.regionUnlocked.busan = true;
      BranchManager.move("busan");
      state.missions.weeklyList.forEach((g) => (g.done = true));
      state.missions.weeklyCompletedAt = Date.now();
      generateWeeklyCertificate();
      BranchManager.move("changnyeong");
      generateWeeklyCertificate();
      return { cert, after: state.cert, drink: state.coupons.drink };
    });
    assert.deepEqual(r.after, r.cert);
    assert.equal(r.drink, 1);
    await p.reload();
    assert.equal(await p.evaluate(() => state.coupons.drink), 1);
  }));

test("legacy and backup saves preserve shared staff values and independent pending receipts", async () => {
  const f = fixture({
    coupons: { veg: 7, drink: 3 },
    endingSeen: true,
    robotGrandson: true,
  });
  f.staffStats.grandson = { auto: 8, tip: 4, earned: 56789 };
  f.staffStats.neighbor = { auto: 2, tip: 3, earned: 1234 };
  f.upgrades.hire = 6;
  f.offlineReward = { amount: 500, seconds: 60 };
  delete f.serviceTimers;
  f.regionUnlocked.busan = true;
  f.branches.busan = {
    unlocked: true,
    data: {
      ...structuredClone(f),
      branches: undefined,
      serviceTimers: undefined,
      upgrades: { hire: 1 },
      staffStats: { neighbor: { auto: 1, tip: 1, earned: 99 } },
      offlineReward: { amount: 321, seconds: 60 },
    },
  };
  await game(f, async (p) => {
    const before = await p.evaluate(() => ({
      staff: state.staffStats,
      coupons: state.coupons,
      ending: state.robotGrandson,
      money: state.money,
    }));
    await p.evaluate(() => BranchManager.move("busan"));
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 321);
    assert.equal(
      await p.evaluate(() => state.staffStats.neighbor.earned),
      1234,
    );
    await p.evaluate(() => {
      BranchManager.move("changnyeong");
      localStorage.setItem(
        "niceChicken_idleServe_vFinal_backup",
        JSON.stringify(state),
      );
      localStorage.setItem("niceChicken_idleServe_vFinal", "{broken");
    });
    await p.reload();
    assert.deepEqual(
      await p.evaluate(() => ({
        staff: state.staffStats,
        coupons: state.coupons,
        ending: state.robotGrandson,
        money: state.money,
      })),
      before,
    );
    assert.equal(await p.evaluate(() => state.offlineReward.amount), 500);
    assert.equal(
      await p.evaluate(
        () => state.branches.busan.data.staffStats.neighbor.earned,
      ),
      99,
    );
  });
});

test("import immediately replaces old runtime progress without paying an order", async () =>
  game(fixture(), async (p) => {
    p.on("dialog", (d) => d.accept());
    const r = await p.evaluate(() => {
      updateOnlineAuto((0.9 * 60) / computeRates().onlineOrdersPerMin);
      const raw = JSON.parse(exportSaveData());
      raw.data.serviceTimers = {
        onlineOrders: 0.25,
        deliveryMs: 2000,
        deliveryIntervalMs: 10000,
        deliverySignature: "",
      };
      raw.data._staffRot = 5;
      raw.data._autoServeAcc = 0.4;
      const ok = importSaveData(JSON.stringify(raw));
      return {
        ok,
        online: onlineTimer,
        delivery: deliveryTimer,
        rot: state._staffRot,
        auto: state._autoServeAcc,
        money: state.money,
      };
    });
    assert.deepEqual(r, {
      ok: true,
      online: 0.25,
      delivery: 2000,
      rot: 5,
      auto: 0.4,
      money: 0,
    });
    await p.reload();
    assert.equal(await p.evaluate(() => onlineTimer), 0.25);
  }));

test("failed or invalid branch moves preserve funds, receipt and source progress", async () =>
  game(fixture({ offlineReward: { amount: 500, seconds: 60 } }), async (p) => {
    const r = await p.evaluate(() => {
      const schedule = window.setTimeout,
        queued = [];
      window.setTimeout = (callback, delay, ...args) =>
        delay === 700
          ? (queued.push(callback), 0)
          : schedule(callback, delay, ...args);
      initAfterLoad(false);
      window.setTimeout = schedule;
      state.customers = [];
      state.regionUnlocked.busan = true;
      updateOnlineAuto((0.8 * 60) / computeRates().onlineOrdersPerMin);
      window._fxState.boss.buffUntil = Date.now() + 1000;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw Error("full");
      };
      const moved = BranchManager.move("busan");
      Storage.prototype.setItem = original;
      const invalid = BranchManager.move("unknown"),
        locked = BranchManager.move("seoul");
      queued.forEach((callback) => callback());
      return {
        moved,
        invalid,
        locked,
        region: state.regionId,
        online: onlineTimer,
        pending: state.offlineReward.amount,
        buff: window._fxState.boss.buffUntil,
        startupCustomers: state.customers.length,
      };
    });
    assert.equal(r.moved, false);
    assert.equal(r.invalid, false);
    assert.equal(r.locked, false);
    assert.equal(r.region, "changnyeong");
    assert.ok(Math.abs(r.online - 0.8) < 1e-9);
    assert.equal(r.pending, 500);
    assert.equal(r.buff, NOW + 1000);
    assert.equal(r.startupCustomers, 1);
  }));

test("reset clears every service timer and shared employee progression", async () =>
  game(fixture(), async (p) => {
    await p.evaluate(() => {
      state.upgrades.hire = 6;
      state.staffStats.grandson.auto = 10;
      state.staffStats.grandson.earned = 1234;
      window._fxState.boss.buffCount = 3;
      state._autoServeAcc = 0.8;
      state._staffRot = 5;
      updateOnlineAuto((0.9 * 60) / computeRates().onlineOrdersPerMin);
      state.delivery.riders = 1;
      updateDelivery(2, Date.now());
    });
    p.on("dialog", (d) => d.accept());
    await p.locator("#openSettings").tap();
    await p.locator("#resetAll").tap();
    await p.reload();
    const r = await p.evaluate(() => ({
      count: getStaffCount(),
      staff: state.staffStats.grandson,
      online: onlineTimer,
      delivery: deliveryTimer,
      auto: state._autoServeAcc,
      rotation: state._staffRot,
      uses: window._fxState.boss.buffCount,
    }));
    assert.deepEqual(r, {
      count: 0,
      staff: { auto: 0, tip: 0, earned: 0 },
      online: 0,
      delivery: 0,
      auto: 0,
      rotation: 0,
      uses: 0,
    });
  }));

test("branch buffs expire by absolute time and cannot accelerate a different branch", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      Math.random = () => 0.5;
      state.regionUnlocked.busan = true;
      state.delivery.riders = 1;
      state.buffEndTime = Date.now() + 20000;
      updateDelivery(2, Date.now());
      const first = deliveryTimer / deliveryNextIntervalMs;
      window._fxState.boss.buffUntil = Date.now() + 10000;
      window._fxState.boss.buffCount = 3;
      BranchManager.move("busan");
      state.delivery.riders = 1;
      updateDelivery(0, Date.now());
      const second = {
        buff: state.buffEndTime,
        interval: deliveryNextIntervalMs,
        clickBuff: window._fxState.boss.buffUntil,
        uses: window._fxState.boss.buffCount,
      };
      window.testNow += 25000;
      sessionStorage.setItem("testNow", testNow);
      BranchManager.move("changnyeong");
      updateDelivery(0, Date.now());
      return {
        first,
        second,
        interval: deliveryNextIntervalMs,
        ratio: deliveryTimer / deliveryNextIntervalMs,
      };
    });
    assert.equal(r.first, 0.4);
    assert.deepEqual(r.second, {
      buff: 0,
      interval: 10000,
      clickBuff: 0,
      uses: 3,
    });
    assert.equal(r.interval, 10000);
    assert.equal(r.ratio, 0.4);
  }));

test("touch hires and trains the sixth employee with clear shared-income labels", async () => {
  const f = fixture({ money: 1e9 });
  f.upgrades.hire = 5;
  await game(f, async (p) => {
    await p.setViewportSize({ width: 320, height: 568 });
    await p.locator('.navBtn[data-panel="upg"]').tap();
    const hire = p.locator('[data-upgrade-id="hire"]');
    await hire.scrollIntoViewIfNeeded();
    await hire.tap();
    assert.equal(await p.evaluate(() => getStaffCount()), 6);
    const training = p.locator('[data-staff-key="grandson"][data-kind="auto"]');
    await training.scrollIntoViewIfNeeded();
    const cost = Number(await training.getAttribute("data-cost")),
      before = await p.evaluate(() => state.money);
    await training.tap();
    assert.equal(await p.evaluate(() => state.staffStats.grandson.auto), 1);
    assert.equal(before - (await p.evaluate(() => state.money)), cost);
    assert.equal(
      await p.locator('[data-action="buy-staff-upgrade"]').count(),
      12,
    );
    assert.match(await p.locator("#upgList").textContent(), /고용은 지점별/);
    assert.match(await p.locator("#upgList").textContent(), /전체 지점 누적/);
    await p.screenshot({ path: "test-results/screenshots/nice-chicken-imp07-staff-small.png" });
    await p.reload();
    assert.equal(await p.evaluate(() => state.staffStats.grandson.auto), 1);
    assert.equal(await p.evaluate(() => getStaffCount()), 6);
  });
});

test("live six-staff serving and delivery stay attributed through map movement", async () => {
  const f = fixture();
  f.upgrades.hire = 6;
  f.delivery = { level: 9, riders: 10 };
  f.regionUnlocked.busan = true;
  for (const stats of Object.values(f.staffStats)) stats.auto = 10;
  await game(
    f,
    async (p) => {
      await p.evaluate(() => {
        state.customers = Array.from({ length: 100 }, (_, i) => ({
          id: "live" + i,
          menuId: "fried",
          state: "waiting",
          x: 100,
          y: 120,
          tx: 100,
          ty: 120,
          speed: 0,
          r: 30,
          patience: 10000,
        }));
      });
      await p.waitForFunction(() => state.staffStats.grandson.earned > 0);
      await p.evaluate(() => {
        const b = BranchManager.ensure("busan");
        b.data.upgrades.hire = 1;
        b.data.delivery = { level: 9, riders: 10 };
      });
      await p.locator("#openMap").tap();
      await p.locator('.map-node[data-region-id="busan"]').tap();
      await p.locator("#mapGo").tap();
      await p.waitForFunction(
        () =>
          state.regionId === "busan" &&
          state.contrib.system > 0 &&
          state.contrib.staff > 0,
      );
      const r = await p.evaluate(() => ({
        source: state.branches.changnyeong.data.totalSales,
        total: state.totalSales,
        contrib:
          state.contrib.staff + state.contrib.player + state.contrib.system,
        menus: Object.values(state.menuStats).reduce((n, s) => n + s.earned, 0),
        sourcePending: state.branches.changnyeong.data.offlineReward.amount,
        currentPending: state.offlineReward.amount,
      }));
      assert.ok(r.source > 0);
      assert.equal(r.total, r.contrib);
      assert.equal(r.total, r.menus);
      assert.equal(r.sourcePending, 0);
      assert.equal(r.currentPending, 0);
      await p.screenshot({ path: "test-results/screenshots/nice-chicken-imp07-live-busan.png" });
      await p.evaluate(() => save(true));
      await p.reload();
      assert.equal(await p.evaluate(() => state.regionId), "busan");
      assert.equal(
        await p.evaluate(() => state.branches.changnyeong.data.totalSales),
        r.source,
      );
    },
    { live: true },
  );
});
