const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { harness, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();
const scope = vm.createContext({});
for (const file of ["money", "utils", "config"])
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../js/core/" + file + ".js"), "utf8"),
    scope,
  );
const run = (code) => vm.runInContext(code, scope);

test("safe integer crossings retain each won in both directions", () => {
  assert.equal(run("moneyAdd(9007199254740991, 2)"), "9007199254740993");
  assert.equal(run('moneySub("9007199254740993", 2)'), 9007199254740991);
});
test("two formerly overflowing finite balances add without infinity", () => {
  const result = run("moneyAdd(Number.MAX_VALUE, Number.MAX_VALUE)");
  assert.equal(BigInt(result), BigInt(Number.MAX_VALUE) * 2n);
});
test("large decimal amounts preserve one-won income and one-won expense", () => {
  const amount = "1" + "0".repeat(350);
  scope.testAmount = amount;
  assert.equal(BigInt(run("moneyAdd(testAmount, 1)")), BigInt(amount) + 1n);
  assert.equal(BigInt(run("moneySub(testAmount, 1)")), BigInt(amount) - 1n);
});
test("combined fractional factors round down once, after the bonus", () => {
  assert.equal(run("moneyScale(1, 1.5, 1.5)"), 2);
  assert.equal(run("moneyCalculate(3, [1.5], 1, 1.5)"), 8);
  assert.equal(run("moneyScale(100000, 1 + .06 * 10)"), 160000);
});
test("signed debt uses floor division and correct compact formatting", () => {
  assert.equal(run("moneyQuotient(-1, 50000000)"), -1);
  assert.equal(run("moneyScale(-1, 1.5)"), -2);
  assert.equal(run("fmtWon(-12000)"), "-1.2만원");
});
test("numeric ordering and bounded ratios do not use string ordering or infinity", () => {
  assert.equal(run('moneyCompare("10000000000000000", "9999999999999999")'), 1);
  assert.equal(
    run('moneyRatio("5" + "0".repeat(349), "1" + "0".repeat(350))'),
    0.5,
  );
});
test("legacy conversion retains the Number integer actually stored", () => {
  assert.equal(BigInt(run("normalizeMoney(1e70)")), BigInt(1e70));
  assert.equal(run("normalizeMoney(123.9)"), 123);
  assert.equal(run("normalizeMoney(-12.1)"), -13);
});
test("invalid inputs and oversized strings cannot poison the monetary schema", () => {
  for (const value of [
    NaN,
    Infinity,
    null,
    {},
    "1e22",
    "01",
    "1.5",
    "1".repeat(4097),
  ]) {
    scope.bad = value;
    assert.equal(run("isMoney(bad)"), false);
    assert.equal(run("normalizeMoney(bad, 17)"), 17);
  }
});
test("menu research beyond Number overflow has an exact finite cost", () => {
  assert.equal(
    BigInt(run("menuResearchCost(1200)")),
    (100000n * 18n ** 1200n) / 10n ** 1200n,
  );
  assert.equal(run("menuResearchCost(10000)"), null);
  assert.equal(run("moneyGeometricCost(1, 2, -1)"), null);
});
test("growth thresholds are monotone and end at the documented exact anchor", () => {
  assert.equal(run("CONFIG.levelUpTotalSales[999]"), "10000000000000000000000");
  assert.equal(
    run(
      "CONFIG.levelUpTotalSales.every((v,i,a) => !i || moneyCompare(v,a[i-1]) >= 0)",
    ),
    true,
  );
  assert.equal(run("CONFIG.levelUpTotalSales[2]"), 120000);
});

test("very large display is compact without changing its exact value", () => {
  assert.equal(run('fmtWon("382" + "0".repeat(310))'), "3.82×10^312원");
  assert.equal(
    run('moneyExactText("9007199254740993")'),
    "9,007,199,254,740,993",
  );
});

test("offline estimate above safe integers has finite exact menu allocation", async () =>
  game(
    fixture({
      regionId: "mars",
      regionUnlocked: { changnyeong: true, mars: true },
      level: 999,
      menuLevels: { fried: 10000 },
      upgrades: { hire: 6, expand: 20 },
      endingPrompted: true,
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const price = getMenuPrice("fried"),
          served = Math.floor(computeRates().autoServesPerMin * 60);
        window.testNow += 3600000;
        applyOfflineProgress();
        const reward = structuredClone(state.offlineReward),
          claimed = claimOfflineReward();
        return {
          price,
          served,
          reward,
          claimed,
          earned: state.offlineSalesTotal,
        };
      });
      const expected = (BigInt(r.price) * BigInt(r.served) * 105n) / 100n;
      assert.equal(BigInt(r.reward.amount), expected);
      assert.equal(BigInt(r.reward.menus.fried.earned), expected);
      assert.equal(r.reward.menus.fried.count, r.served);
      assert.equal(r.claimed, true);
      assert.equal(BigInt(r.earned), expected);
    },
  ));

test("paid mission flags and coupons remain paid through monetary migration and import", async () => {
  const data = fixture({ money: 1e22, coupons: { drink: 3, veg: 7 } });
  data.missions.dailyCompletedToday = true;
  data.missions.weeklyCompletedAt = Date.now();
  data.missions.dailyList.forEach((g) => {
    g.current = g.target;
    g.done = true;
  });
  data.missions.weeklyList.forEach((g) => {
    g.current = g.target;
    g.done = true;
  });
  await game(data, async (p) => {
    p.on("dialog", (d) => d.accept());
    const r = await p.evaluate(() => {
      const before = structuredClone(state.coupons),
        paid = state.missions.weeklyCompletedAt;
      const raw = exportSaveData();
      importSaveData(raw);
      updateMissionsOnlineOnly();
      save(true);
      return {
        before,
        after: state.coupons,
        daily: state.missions.dailyCompletedToday,
        paid,
        preserved: state.missions.weeklyCompletedAt,
      };
    });
    assert.deepEqual(r.after, r.before);
    assert.equal(r.daily, true);
    assert.equal(r.preserved, r.paid);
    await p.reload();
    assert.deepEqual(await p.evaluate(() => state.coupons), r.before);
  });
});

test("regional unlock rejects one won short and deducts the exact large cost", async () =>
  game(
    fixture({
      money: "19999999999999999999",
      endingPrompted: true,
      regionUnlocked: {
        changnyeong: true,
        busan: true,
        seoul: true,
        japan: true,
        usa: true,
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        unlockBranch("mars");
        const rejected = !state.regionUnlocked.mars;
        recordIncome(1);
        unlockBranch("mars");
        return {
          rejected,
          money: state.money,
          unlocked: state.regionUnlocked.mars,
        };
      });
      assert.deepEqual(r, { rejected: true, money: 0, unlocked: true });
    },
  ));

test("one-won income at the boundary reaches all ledgers and survives reload", async () =>
  game(
    fixture({
      money: 2 ** 53,
      totalSales: 2 ** 53,
      todaySales: 2 ** 53,
      staffStats: { neighbor: { auto: 3, tip: 4, earned: 2 ** 53 } },
      menuStats: { fried: { count: 7, earned: 2 ** 53 } },
      contrib: { player: 0, staff: 2 ** 53, system: 0 },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        recordIncome(1, { menuId: "fried", actorKey: "neighbor", count: 1 });
        const dirty = _saveDirty;
        save(true);
        return {
          dirty,
          money: state.money,
          sales: state.totalSales,
          today: state.todaySales,
          career: state.staffStats.neighbor.earned,
          menu: state.menuStats.fried.earned,
          contribution: state.contrib.staff,
        };
      });
      assert.equal(r.dirty, true);
      for (const [key, v] of Object.entries(r))
        if (key !== "dirty") assert.equal(v, "9007199254740993", key);
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), r.money);
    },
  ));

test("huge income survives tick, combined sales and report formatting", async () =>
  game(
    fixture({
      money: 1e308,
      totalSales: 1e308,
      offlineSalesTotal: 1e308,
      endingPrompted: true,
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        recordIncome(1, { menuId: "fried" });
        tick(0);
        updateStatsUI();
        save(true);
        return {
          money: state.money,
          total: getLifetimeSales(),
          text: document.getElementById("rptTotalAll").textContent,
        };
      });
      assert.equal(BigInt(r.money), BigInt(1e308) + 1n);
      assert.equal(BigInt(r.total), BigInt(1e308) * 2n + 1n);
      assert.ok(!/Infinity|NaN|무한/.test(r.text));
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), r.money);
    },
  ));

for (const channel of ["serve", "delivery", "online"])
  test(`${channel} settles huge menu price and tips exactly once`, async () =>
    game(
      fixture({
        regionId: "mars",
        regionUnlocked: { changnyeong: true, mars: true },
        level: 999,
        menuLevels: { fried: 10000 },
        upgrades: { expand: 20 },
        research: {
          levels: { secretSauce: 10, deliveryOps: 10, onlineAlgo: 10 },
          running: [],
          completed: [],
        },
        endingPrompted: true,
      }),
      async (p) => {
        const result = await p.evaluate((channel) => {
          Math.random = () => 0;
          const price = getMenuPrice("fried");
          if (channel === "serve") {
            state.customers = [
              {
                id: "one",
                menuId: "fried",
                state: "waiting",
                x: 50,
                y: 50,
                patience: 99,
              },
            ];
            state.selectedCustomerId = "one";
            serveByMenu("fried");
          } else if (channel === "delivery") processDelivery(VEHICLES[0]);
          else updateOnlineAuto(60 / computeRates().onlineOrdersPerMin);
          return {
            price,
            money: state.money,
            sales: state.totalSales,
            menu: state.menuStats.fried,
            contribution:
              channel === "serve" ? state.contrib.player : state.contrib.system,
          };
        }, channel);
        const price = (15000n * 10n * 5001n * 1009n * 100000000n * 16n) / 100n;
        assert.equal(BigInt(result.price), price);
        const expected =
          channel === "serve"
            ? price + (price * 8n) / 100n + price / 100n
            : channel === "delivery"
              ? (price * 15n) / 10n
              : (price * 14n) / 10n;
        for (const value of [
          result.money,
          result.sales,
          result.menu.earned,
          result.contribution,
        ])
          assert.equal(BigInt(value), expected);
        assert.equal(result.menu.count, 1);
      },
    ));

test("fixed huge pending receipt closes without payment then claims once after branch travel", async () =>
  game(
    fixture({
      money: "9007199254740993",
      endingPrompted: true,
      offlineReward: {
        amount: "10000000000000001",
        seconds: 60,
        menus: { fried: { earned: "10000000000000000", count: 3 } },
      },
    }),
    async (p) => {
      await p.locator('[data-ui-close="modalOffline"]').tap();
      assert.equal(await p.evaluate(() => state.money), "9007199254740993");
      const r = await p.evaluate(() => {
        state.regionUnlocked.busan = true;
        updateOnlineAuto((60 * 0.4) / computeRates().onlineOrdersPerMin);
        BranchManager.move("busan");
        recordIncome(7);
        BranchManager.move("changnyeong");
        state.menuLevels.fried = 100;
        const before = state.money;
        const partial = state.serviceTimers.onlineOrders,
          claimed = claimOfflineReward(),
          again = claimOfflineReward();
        return {
          before,
          partial,
          claimed,
          again,
          money: state.money,
          sales: state.offlineSalesTotal,
          menu: state.menuStats.fried,
          unclassified: state.unattributedSales,
        };
      });
      assert.equal(r.before, "9007199254741000");
      assert.equal(r.claimed, true);
      assert.equal(r.again, false);
      assert.ok(Math.abs(r.partial - 0.4) < 1e-9);
      assert.equal(BigInt(r.money), BigInt(r.before) + 10000000000000001n);
      assert.equal(r.sales, "10000000000000001");
      assert.equal(r.menu.earned, "10000000000000000");
      assert.equal(r.unclassified, 1);
      await p.reload();
      assert.equal(await p.evaluate(() => state.offlineReward.amount), 0);
    },
  ));

test("large purchase compares exact balance and charges the displayed research cost", async () =>
  game(
    fixture({
      money: "1" + "0".repeat(312),
      menuLevels: { fried: 1200 },
      endingPrompted: true,
    }),
    async (p) => {
      await p.locator("#openStats").tap();
      await p.locator('[data-tab="stat-rnd"]').tap();
      // R&D button is in the report; test an actual touch purchase.
      const button = p.locator(
        '[data-action="research-menu"][data-menu-id="fried"]',
      );
      const cost = await button.getAttribute("data-cost");
      const before = await p.evaluate(() => state.money);
      await button.tap();
      const after = await p.evaluate(() => ({
        money: state.money,
        level: state.menuLevels.fried,
      }));
      assert.equal(BigInt(before) - BigInt(after.money), BigInt(cost));
      assert.equal(after.level, 1201);
      await p.screenshot({
        path: path.join(
          __dirname,
          "../test-results/screenshots/nice-chicken-imp10-huge-research.png",
        ),
      });
      await p.reload();
      assert.equal(await p.evaluate(() => state.menuLevels.fried), 1201);
    },
  ));

test("salary and coupon exchange deduct small exact amounts from huge shared cash", async () =>
  game(
    fixture({
      money: "10000000000000000000001",
      upgrades: { hire: 6 },
      endingPrompted: true,
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        state.payroll.lastDayKey = "2026-10-11";
        processPayroll();
        renderExchange();
        return { money: state.money, count: uiExchangeCnt.textContent };
      });
      assert.equal(r.money, "9999999999999999520001");
      assert.equal(BigInt(r.count), BigInt(r.money) / 50000000n);
      await p.evaluate(() => modalExchange.classList.add("on"));
      await p.locator("#doExchange").tap();
      assert.equal(
        await p.evaluate(() => state.money),
        String(BigInt(r.money) - 50000000n),
      );
      assert.equal(await p.evaluate(() => state.coupons.drink), 1);
    },
  ));

test("ending boundary compares exact strings and does not grant a reward on closing", async () =>
  game(fixture({ money: "9999999999999999999999" }), async (p) => {
    await p.evaluate(() => {
      state.level = 1;
      state.totalSales = 60000;
      updateUI();
    });
    assert.equal(await p.evaluate(() => window.uiXpFill.style.width), "50%");
    await p.evaluate(() => {
      state.level = 999;
      updateUI();
    });
    assert.equal(await p.evaluate(() => window.uiXpFill.style.width), "100%");
    await p.evaluate(() => checkEndingCondition());
    assert.equal(await p.evaluate(() => state.endingUnlocked), false);
    await p.evaluate(() => {
      recordIncome(1);
      checkEndingCondition();
    });
    assert.equal(await p.evaluate(() => state.endingUnlocked), true);
    await p.locator("#endingNoBtn").tap();
    await p.reload();
    assert.deepEqual(
      await p.evaluate(() => ({
        money: state.money,
        seen: state.endingSeen,
        robot: state.robotGrandson,
      })),
      { money: "10000000000000000000000", seen: false, robot: false },
    );
  }));

test("weekly money baseline retains a one-won difference above safe integers", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.totalSales = "10000000000000000000000";
      state.missions._weekStartTotalSales = state.totalSales;
      state.missions.weeklyList = [
        { type: "sales", target: 1, current: 0, done: false },
      ];
      recordIncome(1);
      updateMissionsOnlineOnly();
      return state.missions.weeklyList[0];
    });
    assert.equal(r.current, 1);
    assert.equal(r.done, true);
  }));

test("legacy migration preserves paid flags, source branch receipts and unknown fields", async () =>
  game(
    fixture({
      money: 1e70,
      level: 999,
      endingSeen: true,
      robotGrandson: true,
      coupons: { drink: 3, veg: 7 },
      cert: {
        issuedThisWeek: true,
        issuedAt: 1,
        validUntil: 9999999999999,
        usedAt: 0,
      },
      branches: {
        busan: {
          data: {
            totalSales: 1e30,
            offlineReward: { amount: 1e20, seconds: 60 },
            legacyExtension: { earned: 123.5 },
          },
        },
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => ({
        money: state.money,
        level: state.level,
        coupons: state.coupons,
        cert: state.cert.issuedThisWeek,
        branch: state.branches.busan.data,
        seen: state.endingSeen,
        total: state.totalSales,
        encoding: state.moneyEncoding,
      }));
      assert.equal(BigInt(r.money), BigInt(1e70));
      assert.equal(r.level, 999);
      assert.equal(r.total, 0);
      assert.deepEqual(r.coupons, { drink: 3, veg: 7 });
      assert.equal(r.cert, true);
      assert.equal(r.seen, true);
      assert.equal(BigInt(r.branch.totalSales), BigInt(1e30));
      assert.equal(BigInt(r.branch.offlineReward.amount), BigInt(1e20));
      assert.deepEqual(r.branch.legacyExtension, { earned: 123.5 });
      assert.equal(r.encoding, "won-integer-v1");
      const dirty = await p.evaluate(() => {
        state.money = 1e70;
        _saveDirty = false;
        migrateMoneyState();
        const first = _saveDirty;
        save(true);
        migrateMoneyState();
        return { first, second: _saveDirty, money: state.money };
      });
      assert.equal(dirty.first, true);
      assert.equal(dirty.second, false);
      assert.equal(BigInt(dirty.money), BigInt(1e70));
    },
  ));

test("huge backup/export/import/reset preserve pending and paid guards on small screens", async () =>
  game(
    fixture({
      money: "10000000000000000000001",
      endingPrompted: true,
      coupons: { drink: 5, veg: 7 },
      offlineReward: { amount: "10000000000000001", seconds: 60 },
    }),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      await p.locator('[data-ui-close="modalOffline"]').tap();
      await p.locator("#openSettings").tap();
      await p.locator("#exportSaveBtn").tap();
      const raw = await p.locator("#saveTransferText").inputValue();
      assert.equal(JSON.parse(raw).data.money, "10000000000000000000001");
      await p.locator("#saveTransferText").fill(raw);
      await p.locator("#importSaveBtn").tap();
      await p.evaluate(() => {
        save(true);
        save(true);
        localStorage.setItem(SAVE_KEY, "corrupt");
      });
      await p.reload();
      assert.equal(
        await p.evaluate(() => SaveRecovery.restore("backup")),
        true,
      );

      assert.equal(
        await p.evaluate(() => state.money),
        "10000000000000000000001",
      );
      assert.equal(
        await p.evaluate(() => state.offlineReward.amount),
        "10000000000000001",
      );
      await p.locator("#recoveryClose").tap();
      await p.locator('[data-ui-close="modalOffline"]').tap();
      await p.locator("#openSettings").tap();
      await p.screenshot({
        path: path.join(
          __dirname,
          "../test-results/screenshots/nice-chicken-imp10-backup-small.png",
        ),
      });
      const resetBackup = await p.evaluate(() => {
        resetGame();
        return localStorage.getItem(SAVE_BACKUP_KEY);
      });
      assert.equal(resetBackup, null);
      await p.reload();
      assert.deepEqual(
        await p.evaluate(() => ({
          money: state.money,
          pending: state.offlineReward.amount,
          coupons: state.coupons,
        })),
        { money: 0, pending: 0, coupons: { drink: 0, veg: 0 } },
      );
      const backup = await p.evaluate(() =>
        JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY)),
      );
      assert.equal(backup.money, 0);
      assert.equal(backup.offlineReward.amount, 0);
    },
    { viewport: { width: 320, height: 568 } },
  ));

test("failed huge receipt save rolls back and retries without duplicate allocation", async () =>
  game(
    fixture({
      money: "9007199254740993",
      offlineReward: { amount: "10000000000000001", seconds: 60 },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("quota");
          return original.call(this, k, v);
        };
        let failed;
        try {
          failed = claimOfflineReward();
        } finally {
          Storage.prototype.setItem = original;
        }
        const afterFail = {
          money: state.money,
          pending: state.offlineReward.amount,
        };
        const retry = claimOfflineReward(),
          again = claimOfflineReward();
        return {
          failed,
          afterFail,
          retry,
          again,
          money: state.money,
          sales: state.offlineSalesTotal,
        };
      });
      assert.equal(r.failed, false);
      assert.deepEqual(r.afterFail, {
        money: "9007199254740993",
        pending: "10000000000000001",
      });
      assert.equal(r.retry, true);
      assert.equal(r.again, false);
      assert.equal(r.money, "19007199254740994");
      assert.equal(r.sales, "10000000000000001");
    },
  ));

test("representation limit rejects a transaction atomically and retains a fixed receipt", async () =>
  game(
    fixture({
      money: "9".repeat(4096),
      endingPrompted: true,
      offlineReward: { amount: 1, seconds: 60 },
    }),
    async (p) => {
      const r = await p.evaluate(() => ({
        recorded: recordIncome(1),
        claimed: claimOfflineReward(),
        money: state.money,
        sales: state.totalSales,
        pending: state.offlineReward.amount,
      }));
      assert.equal(r.recorded, false);
      assert.equal(r.claimed, false);
      assert.equal(r.money, "9".repeat(4096));
      assert.equal(r.sales, 0);
      assert.equal(r.pending, 1);
      const offline = await p.evaluate(() => {
        state.offlineReward = { amount: "9".repeat(4096), seconds: 60 };
        const before = state.play.offlineSecTotal;
        window.testNow += 3600000;
        applyOfflineProgress();
        return {
          reward: state.offlineReward,
          before,
          after: state.play.offlineSecTotal,
        };
      });
      assert.equal(offline.reward.amount, "9".repeat(4096));
      assert.equal(offline.reward.seconds, 60);
      assert.equal(offline.before, offline.after);
    },
  ));
