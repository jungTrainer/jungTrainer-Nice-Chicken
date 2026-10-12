const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { harness, NOW, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();
async function openContent(p) {
  await p.locator("#openStats").tap();
  await p.locator('[data-tab="stat-management"]').tap();
}
const control = (p, kind, value) =>
  p.locator(
    `#managementContent [data-management-kind="${kind}"][data-management-value="${value}"]`,
  );
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("legacy and inactive branch migration is neutral and preserves pending and extensions", async () =>
  game(
    fixture({
      management: undefined,
      money: "9007199254740993",
      coupons: { drink: 3, veg: 7 },
      offlineReward: { amount: 500, seconds: 60 },
      branches: {
        busan: {
          data: {
            upgrades: { hire: 1 },
            offlineReward: { amount: 777, seconds: 60 },
            legacy: { value: 19 },
          },
        },
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => ({
        management: state.management,
        branches: state.branches,
        money: state.money,
        coupons: state.coupons,
        pending: state.offlineReward.amount,
        effects: getManagementEffects(),
        price: getMenuPrice("fried"),
      }));
      assert.deepEqual(r.management, {
        focus: "balanced",
        leadStaff: null,
        menuPolicy: "all",
        featuredMenu: "fried",
        readStories: [],
      });
      assert.deepEqual(r.effects, {});
      assert.equal(r.price, 16500);
      assert.equal(r.money, "9007199254740993");
      assert.equal(r.pending, 500);
      assert.deepEqual(r.coupons, { drink: 3, veg: 7 });
      assert.equal(r.branches.busan.data.offlineReward.amount, 777);
      assert.equal(r.branches.busan.data.management.focus, "balanced");
      assert.deepEqual(r.branches.busan.data.legacy, { value: 19 });
    },
  ));

test("invalid/locked choices normalize without dropping unknown extension or future read flags", async () =>
  game(
    fixture({
      management: {
        focus: "bad",
        leadStaff: "__proto__",
        menuPolicy: "signature",
        featuredMenu: "buldak",
        readStories: ["arrival", "future", "arrival", 7],
        extension: { note: "keep" },
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => ({
        m: state.management,
        pool: getOrderMenuPool().map((m) => m.id),
        eff: getManagementEffects(),
      }));
      assert.equal(r.m.focus, "balanced");
      assert.equal(r.m.leadStaff, null);
      assert.equal(r.m.menuPolicy, "all");
      assert.deepEqual(r.m.readStories, ["arrival", "future"]);
      assert.deepEqual(r.m.extension, { note: "keep" });
      assert.deepEqual(r.pool, ["fried"]);
      assert.deepEqual(r.eff, {});
    },
  ));

for (const role of [
  "neighbor",
  "ato",
  "daughter1",
  "daughter2",
  "soninlaw",
  "grandson",
])
  test(`${role} applies only the selected specialty once after research`, async () =>
    game(
      fixture({
        upgrades: { hire: 6 },
        research: {
          levels: {
            training: 10,
            secretSauce: 10,
            deliveryOps: 10,
            onlineAlgo: 10,
            vipCare: 10,
          },
          running: [],
          completed: [],
        },
      }),
      async (p) => {
        const r = await p.evaluate((role) => {
          const base = computeRates(),
            price = getMenuPrice("fried"),
            original = structuredClone(state.staffStats);
          const chosen = chooseManagement("leadStaff", role),
            current = computeRates(),
            newPrice = getMenuPrice("fried");
          return {
            chosen,
            base: {
              auto: base.autoServesPerMin,
              online: base.onlineOrdersPerMin,
              patience: base.patienceSec,
              delivery: 1 + base.eff.deliveryEarningMul,
              freq: 1 + base.eff.deliveryFreqMul,
            },
            current: {
              auto: current.autoServesPerMin,
              online: current.onlineOrdersPerMin,
              patience: current.patienceSec,
              delivery: 1 + current.eff.deliveryEarningMul,
              freq: 1 + current.eff.deliveryFreqMul,
            },
            price,
            newPrice,
            staffSame:
              JSON.stringify(original) === JSON.stringify(state.staffStats),
            rotation: Array.from({ length: 6 }, () => pickStaffKey()),
          };
        }, role);
        assert.equal(r.chosen, true);
        assert.equal(r.staffSame, true);
        assert.equal(new Set(r.rotation).size, 6);
        if (role === "neighbor")
          near((r.current.auto - 0.8) / (r.base.auto - 0.8), 1.04);
        if (role === "ato") near(r.current.freq / r.base.freq, 1.04);
        if (role === "daughter1") near(r.current.online / r.base.online, 1.04);
        if (role === "daughter2") near(r.current.patience - r.base.patience, 1);
        if (role === "soninlaw")
          near(r.current.delivery / r.base.delivery, 1.04);
        if (role === "grandson")
          assert.equal(r.newPrice, Math.floor(r.price * 1.02));
        if (role !== "grandson") assert.equal(r.newPrice, r.price);
      },
    ));

test("focus tradeoffs affect actual coefficients while a new choice is not an upgrade purchase", async () =>
  game(
    fixture({
      upgrades: { hire: 6 },
      research: {
        levels: { kitchenAuto: 10, deliveryOps: 10, onlineAlgo: 10 },
        running: [],
        completed: [],
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const snapshot = structuredClone(state.missions),
          base = computeRates();
        chooseManagement("focus", "service");
        const service = computeRates();
        chooseManagement("focus", "dispatch");
        const dispatch = computeRates();
        return {
          base: {
            auto: base.autoServesPerMin,
            del: 1 + base.eff.deliveryEarningMul,
            on: 1 + base.eff.onlineEarningMul,
          },
          service: {
            auto: service.autoServesPerMin,
            del: 1 + service.eff.deliveryEarningMul,
            on: 1 + service.eff.onlineEarningMul,
          },
          dispatch: {
            auto: dispatch.autoServesPerMin,
            del: 1 + dispatch.eff.deliveryEarningMul,
            on: 1 + dispatch.eff.onlineEarningMul,
          },
          money: state.money,
          missionsSame:
            JSON.stringify(snapshot) === JSON.stringify(state.missions),
        };
      });
      near(r.service.auto / r.base.auto, 1.04);
      near(r.service.del / r.base.del, 0.96);
      near(r.service.on / r.base.on, 0.96);
      near(r.dispatch.auto / r.base.auto, 0.96);
      near(r.dispatch.del / r.base.del, 1.04);
      near(r.dispatch.on / r.base.on, 1.04);
      assert.equal(r.money, 0);
      assert.equal(r.missionsSame, true);
      const eventRates = await p.evaluate(() => {
        state.event = structuredClone(EVENTS.find((e) => e.id === "supply"));
        state.research.levels.rushHour = 10;
        chooseManagement("focus", "balanced");
        const base = computeRates().autoServesPerMin;
        chooseManagement("focus", "service");
        return { base, selected: computeRates().autoServesPerMin };
      });
      near(eventRates.selected / eventRates.base, 1.04);
    },
  ));

test("ending robot and menu-record specialist combine once in exact prices and reconnect", async () =>
  game(
    fixture({
      robotGrandson: true,
      endingSeen: true,
      upgrades: { hire: 6 },
      research: { levels: { secretSauce: 10 }, running: [], completed: [] },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const before = getMenuPrice("fried");
        chooseManagement("leadStaff", "grandson");
        chooseManagement("leadStaff", "grandson");
        return {
          before,
          after: getMenuPrice("fried"),
          robot: state.robotGrandson,
          money: state.money,
        };
      });
      assert.equal(r.after, (r.before * 102) / 100);
      assert.equal(r.robot, true);
      assert.equal(r.money, 0);
      await p.reload();
      assert.equal(await p.evaluate(() => getMenuPrice("fried")), r.after);
    },
  ));

test("unhired imported specialty is dormant; locked choices cannot save or pay", async () =>
  game(
    fixture({
      management: {
        focus: "balanced",
        leadStaff: "grandson",
        menuPolicy: "all",
        featuredMenu: "fried",
        readStories: [],
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const original = exportSaveData(),
          eff = getManagementEffects();
        const results = [
          chooseManagement("leadStaff", "grandson"),
          chooseManagement("menu", "buldak"),
          chooseManagement("focus", "bad"),
          readBranchStory("ending"),
        ];
        return {
          eff,
          results,
          same: original === exportSaveData(),
          price: getMenuPrice("fried"),
        };
      });
      assert.deepEqual(r.eff, {});
      assert.deepEqual(r.results, [false, false, false, false]);
      assert.equal(r.same, true);
      assert.equal(r.price, 16500);
    },
  ));

for (const channel of ["visit", "delivery", "online", "offline"])
  test(`${channel} uses selected unlocked menu and matches the displayed mean`, async () =>
    game(
      fixture({ upgrades: { menuUnlock: 1 }, menuLevels: { fried: 10 } }),
      async (p) => {
        await openContent(p);
        assert.equal(
          await p.locator("#managementMenuAverage").getAttribute("data-amount"),
          "64900",
        );
        await control(p, "menu", "fried").tap();
        assert.equal(
          await p.locator("#managementMenuAverage").getAttribute("data-amount"),
          "99000",
        );
        const r = await p.evaluate((channel) => {
          Math.random = () => 0.99;
          if (channel === "visit") spawnCustomer();
          if (channel === "delivery") processDelivery(VEHICLES[0]);
          if (channel === "online") updateOnlineAuto(301);
          if (channel === "offline") {
            window.testNow += 3600000;
            applyOfflineProgress();
          }
          return {
            customer: state.customers.at(-1)?.menuId,
            stats: state.menuStats,
            pending: state.offlineReward,
            money: state.money,
            price: getMenuPrice("fried"),
            mean: getMenuOfferSummary().average,
          };
        }, channel);
        assert.equal(r.price, r.mean);
        if (channel === "visit") assert.equal(r.customer, "fried");
        else if (channel === "offline") {
          assert.deepEqual(Object.keys(r.pending.menus), ["fried"]);
          assert.equal(
            BigInt(r.pending.menus.fried.earned),
            (BigInt(r.pending.menus.fried.count) * BigInt(r.price) * 105n) /
              100n,
          );
        } else {
          assert.deepEqual(Object.keys(r.stats), ["fried"]);
          assert.equal(r.money, r.price);
          assert.equal(r.stats.fried.count, 1);
        }
      },
    ));

test("selected menu leaves existing customer, fixed receipt and menu mission target intact", async () =>
  game(
    fixture({
      upgrades: { menuUnlock: 1 },
      offlineReward: {
        amount: 501,
        seconds: 60,
        menus: { yang: { earned: 501, count: 1 } },
      },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        state.customers = [
          {
            id: "old",
            menuId: "yang",
            state: "waiting",
            x: 50,
            y: 50,
            patience: 99,
          },
        ];
        state.selectedCustomerId = "old";
        const goal = structuredClone(
          state.missions.dailyList.find((g) => g.type === "menu"),
        );
        chooseManagement("menu", "fried");
        Math.random = () => 0.99;
        serveByMenu("yang");
        const pending = structuredClone(state.offlineReward),
          goalNow = state.missions.dailyList.find((g) => g.type === "menu");
        claimOfflineReward();
        return {
          sold: state.menuStats.yang.count,
          pending,
          offline: state.offlineSalesTotal,
          targetSame:
            goal.target === goalNow.target && goal.menuId === goalNow.menuId,
        };
      });
      assert.equal(r.sold, 1);
      assert.equal(r.pending.amount, 501);
      assert.equal(r.offline, 501);
      assert.equal(r.targetSame, true);
    },
  ));

test("new choices settle huge delivery and online income once with exact factors", async () =>
  game(
    fixture({
      regionId: "mars",
      regionUnlocked: { changnyeong: true, mars: true },
      level: 999,
      upgrades: { hire: 6, menuUnlock: 8, expand: 20 },
      menuLevels: { buldak: 10000 },
      endingPrompted: true,
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        chooseManagement("focus", "dispatch");
        chooseManagement("leadStaff", "soninlaw");
        chooseManagement("menu", "buldak");
        const price = getMenuPrice("buldak");
        processDelivery(VEHICLES[0]);
        updateOnlineAuto(301);
        return {
          price,
          money: state.money,
          total: state.totalSales,
          earned: state.menuStats.buldak.earned,
          count: state.menuStats.buldak.count,
          system: state.contrib.system,
        };
      });
      const price = BigInt(r.price),
        expected = (price * 10816n) / 10000n + (price * 104n) / 100n;
      for (const value of [r.money, r.total, r.earned, r.system])
        assert.equal(BigInt(value), expected);
      assert.equal(r.count, 2);
    },
  ));

test("delivery specialty preserves trip ratio without an immediate payout, through travel and reload", async () =>
  game(
    fixture({ upgrades: { hire: 2 }, delivery: { level: 0, riders: 1 } }),
    async (p) => {
      const first = await p.evaluate(() => {
        Math.random = () => 0.5;
        updateDelivery(2, Date.now());
        const ratio = deliveryTimer / deliveryNextIntervalMs;
        chooseManagement("leadStaff", "ato");
        const before = state.money;
        updateDelivery(0, Date.now());
        const changed = deliveryTimer / deliveryNextIntervalMs;
        state.regionUnlocked.busan = true;
        BranchManager.move("busan");
        chooseManagement("focus", "service");
        BranchManager.move("changnyeong");
        save(true);
        return {
          ratio,
          changed,
          before,
          money: state.money,
          elapsed: deliveryTimer,
          interval: deliveryNextIntervalMs,
          lead: state.management.leadStaff,
        };
      });
      near(first.ratio, first.changed);
      assert.equal(first.before, 0);
      assert.equal(first.money, 0);
      assert.equal(first.lead, "ato");
      await p.reload();
      const restored = await p.evaluate(() => ({
        elapsed: deliveryTimer,
        interval: deliveryNextIntervalMs,
        lead: state.management.leadStaff,
      }));
      near(restored.elapsed, first.elapsed);
      near(restored.interval, first.interval);
      assert.equal(restored.lead, "ato");
    },
  ));

test("story conditions unlock from actual growth, and repeated reading/closing cannot allocate rewards", async () =>
  game(
    fixture({
      coupons: { drink: 3, veg: 7 },
      offlineReward: { amount: 501, seconds: 60 },
    }),
    async (p) => {
      await p.locator('[data-ui-close="modalOffline"]').tap();
      await openContent(p);
      assert.equal(await control(p, "story", "recipe").isDisabled(), true);
      await control(p, "story", "arrival").tap();
      assert.equal(await control(p, "story", "arrival").isDisabled(), true);
      assert.equal(
        await p
          .locator('[data-tab="stat-management"]')
          .evaluate((e) => e === document.activeElement),
        true,
      );
      const r = await p.evaluate(() => {
        readBranchStory("arrival");
        state.upgrades.hire = 6;
        state.upgrades.menuUnlock = 1;
        state.level = 10;
        state.research.levels.training = 1;
        return {
          stories: getBranchStories().map((s) => ({
            id: s.id,
            unlocked: s.unlocked,
          })),
          money: state.money,
          coupons: state.coupons,
          pending: state.offlineReward.amount,
          read: state.management.readStories,
        };
      });
      assert.equal(r.money, 0);
      assert.deepEqual(r.coupons, { drink: 3, veg: 7 });
      assert.equal(r.pending, 501);
      assert.deepEqual(r.read, ["arrival"]);
      assert.equal(r.stories.filter((s) => s.unlocked).length, 6);
      assert.equal(r.stories.find((s) => s.id === "ending").unlocked, false);
      await p.locator("#closeStats").tap();
      await p.reload();
      assert.deepEqual(await p.evaluate(() => state.management.readStories), [
        "arrival",
      ]);
    },
  ));

test("branch decisions and read flags are local while employee education is shared", async () =>
  game(
    fixture({
      upgrades: { hire: 6 },
      staffStats: { neighbor: { auto: 3, tip: 4, earned: 500 } },
      coupons: { drink: 2, veg: 5 },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        chooseManagement("leadStaff", "neighbor");
        chooseManagement("focus", "dispatch");
        readBranchStory("arrival");
        const first = getBranchStories()[0].text;
        state.regionUnlocked.busan = true;
        BranchManager.move("busan");
        const busan = structuredClone(state.management),
          second = getBranchStories()[0].text;
        chooseManagement("focus", "service");
        readBranchStory("arrival");
        BranchManager.move("changnyeong");
        return {
          first,
          second,
          busan,
          home: state.management,
          staff: state.staffStats.neighbor,
          coupons: state.coupons,
        };
      });
      assert.notEqual(r.first, r.second);
      assert.equal(r.busan.focus, "balanced");
      assert.deepEqual(r.busan.readStories, []);
      assert.equal(r.home.focus, "dispatch");
      assert.equal(r.home.leadStaff, "neighbor");
      assert.deepEqual(r.home.readStories, ["arrival"]);
      assert.deepEqual(r.staff, { auto: 3, tip: 4, earned: 500 });
      assert.deepEqual(r.coupons, { drink: 2, veg: 5 });
    },
  ));

test("choice and read save failures restore the original decision and can retry", async () =>
  game(
    fixture({
      money: "9007199254740993",
      coupons: { drink: 3, veg: 7 },
      offlineReward: { amount: 500, seconds: 60 },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        const before = JSON.stringify(state.management),
          original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("quota");
          return original.call(this, k, v);
        };
        let choice, read;
        try {
          choice = chooseManagement("focus", "dispatch");
          read = readBranchStory("arrival");
        } finally {
          Storage.prototype.setItem = original;
        }
        const restored = JSON.stringify(state.management) === before;
        const retry = readBranchStory("arrival"),
          again = readBranchStory("arrival");
        return {
          choice,
          read,
          restored,
          retry,
          again,
          money: state.money,
          pending: state.offlineReward.amount,
          coupons: state.coupons,
          snapshot: state.branches.changnyeong.data.management,
          management: state.management,
        };
      });
      assert.equal(r.choice, false);
      assert.equal(r.read, false);
      assert.equal(r.restored, true);
      assert.equal(r.retry, true);
      assert.equal(r.again, true);
      assert.equal(r.money, "9007199254740993");
      assert.equal(r.pending, 500);
      assert.deepEqual(r.coupons, { drink: 3, veg: 7 });
      assert.deepEqual(r.snapshot, r.management);
    },
  ));

test("same choice and already-read story are idempotent and do not write again", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      chooseManagement("focus", "dispatch");
      readBranchStory("arrival");
      const before = localStorage.getItem(SAVE_KEY),
        original = Storage.prototype.setItem;
      let writes = 0;
      Storage.prototype.setItem = function (k, v) {
        writes++;
        return original.call(this, k, v);
      };
      try {
        chooseManagement("focus", "dispatch");
        readBranchStory("arrival");
      } finally {
        Storage.prototype.setItem = original;
      }
      return {
        writes,
        same: before === localStorage.getItem(SAVE_KEY),
        dirty: _saveDirty,
      };
    });
    assert.deepEqual(r, { writes: 0, same: true, dirty: false });
  }));

for (const [name, viewport] of [
  ["portrait", { width: 320, height: 568 }],
  ["landscape", { width: 568, height: 320 }],
  ["desktop", { width: 1280, height: 800 }],
])
  test(`${name}: actual touch, scroll, focus and background guard keep content usable`, async () =>
    game(
      fixture({ upgrades: { hire: 6, menuUnlock: 8 }, level: 10 }),
      async (p) => {
        await openContent(p);
        await control(p, "focus", "dispatch").tap();
        await control(p, "menu", "buldak").tap();
        await control(p, "leadStaff", "grandson").tap();
        await control(p, "story", "team").tap();
        const r = await p.evaluate(() => {
          const modal = document.querySelector("#modalStats .modal"),
            rect = modal.getBoundingClientRect();
          const money = state.money,
            policy = state.management.menuPolicy,
            scene = JSON.stringify({
              customers: state.customers,
              selected: state.selectedCustomerId,
              rep: state.rep,
            });
          document.querySelector('[data-action="serve-menu"]').click();
          document
            .getElementById("stage")
            .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          return {
            bounded:
              rect.x >= -1 &&
              rect.y >= -1 &&
              rect.right <= innerWidth + 1 &&
              rect.bottom <= innerHeight + 1,
            width: document.documentElement.scrollWidth,
            viewport: innerWidth,
            moneySame: money === state.money,
            sceneSame:
              scene ===
              JSON.stringify({
                customers: state.customers,
                selected: state.selectedCustomerId,
                rep: state.rep,
              }),
            policy,
            management: state.management,
            focusInModal: !!document.activeElement.closest("#modalStats"),
          };
        });
        assert.equal(r.bounded, true);
        assert.ok(r.width <= r.viewport);
        assert.equal(r.moneySame, true);
        assert.equal(r.sceneSame, true);
        assert.equal(r.focusInModal, true);
        assert.equal(r.management.leadStaff, "grandson");
        assert.equal(r.policy, "signature");
        assert.ok(r.management.readStories.includes("team"));
        await p.screenshot({
          path: path.join(
            __dirname,
            `../test-results/screenshots/nice-chicken-imp11-${name}.png`,
          ),
        });
        await control(p, "focus", "dispatch").scrollIntoViewIfNeeded();
        await p.screenshot({
          path: path.join(
            __dirname,
            `../test-results/screenshots/nice-chicken-imp11-${name}-choices.png`,
          ),
        });
        await p.keyboard.press("Escape");
        assert.equal(
          await p
            .locator("#openStats")
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await p.evaluate(() =>
          document
            .querySelector(
              '[data-management-kind="focus"][data-management-value="service"]',
            )
            .click(),
        );
        assert.equal(
          await p.evaluate(() => state.management.focus),
          "dispatch",
        );
        await p.reload();
        assert.equal(
          await p.evaluate(() => state.management.leadStaff),
          "grandson",
        );
      },
      { viewport },
    ));

test("actual backup/import/reset preserve choices and pending/paid guards then restore defaults", async () =>
  game(
    fixture({
      money: 999999,
      upgrades: { hire: 1, menuUnlock: 1 },
      offlineReward: { amount: 500, seconds: 60 },
      coupons: { drink: 3, veg: 7 },
    }),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      await p.evaluate(() => {
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
      await p.locator('[data-ui-close="modalOffline"]').tap();
      await openContent(p);
      await control(p, "focus", "dispatch").tap();
      await control(p, "leadStaff", "neighbor").tap();
      await control(p, "menu", "yang").tap();
      await control(p, "story", "arrival").tap();
      await p.keyboard.press("Escape");
      await p.locator("#openSettings").tap();
      await p.locator("#exportSaveBtn").tap();
      const raw = await p.locator("#saveTransferText").inputValue(),
        data = JSON.parse(raw).data;
      assert.equal(data.management.featuredMenu, "yang");
      assert.equal(data.offlineReward.amount, 500);
      await p.locator("#saveTransferText").fill(raw);
      await p.locator("#importSaveBtn").tap();
      await p.reload();
      assert.deepEqual(
        await p.evaluate(() => state.management),
        data.management,
      );
      assert.deepEqual(await p.evaluate(() => state.coupons), data.coupons);
      assert.deepEqual(await p.evaluate(() => state.cert), data.cert);
      assert.equal(
        await p.evaluate(() => state.missions.dailyCompletedToday),
        true,
      );
      assert.equal(
        await p.evaluate(() => state.missions.weeklyCompletedAt),
        data.missions.weeklyCompletedAt,
      );
      const reset = await p.evaluate(() => {
        const ok = resetGame();
        return {
          ok,
          m: state.management,
          backup: localStorage.getItem(SAVE_BACKUP_KEY),
          pending: state.offlineReward.amount,
        };
      });
      assert.equal(reset.ok, true);
      assert.equal(reset.backup, null);
      assert.equal(reset.pending, 0);
      assert.equal(reset.m.focus, "balanced");
      assert.equal(reset.m.leadStaff, null);
      assert.deepEqual(reset.m.readStories, []);
    },
    { viewport: { width: 320, height: 568 } },
  ));

test("failed import/reset retain decisions, root, service owner and pending rewards", async () =>
  game(
    fixture({
      upgrades: { hire: 2 },
      offlineReward: { amount: 500, seconds: 60 },
    }),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      const r = await p.evaluate(() => {
        chooseManagement("focus", "dispatch");
        chooseManagement("leadStaff", "ato");
        const source = state;
        const raw = JSON.parse(exportSaveData());
        raw.data.management.focus = "service";
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("quota");
          return original.call(this, k, v);
        };
        let imported, reset;
        try {
          imported = importSaveData(JSON.stringify(raw));
          reset = resetGame();
        } finally {
          Storage.prototype.setItem = original;
        }
        return {
          imported,
          reset,
          same: source === state,
          owner: ServiceRuntime.ownerState === state,
          m: state.management,
          pending: state.offlineReward.amount,
        };
      });
      assert.equal(r.imported, false);
      assert.equal(r.reset, false);
      assert.equal(r.same, true);
      assert.equal(r.owner, true);
      assert.equal(r.m.focus, "dispatch");
      assert.equal(r.m.leadStaff, "ato");
      assert.equal(r.pending, 500);
    },
  ));

test("live report refreshes growth prices and stories but reuses unchanged DOM without saving", async () =>
  game(fixture(), async (p) => {
    await openContent(p);
    const r = await p.evaluate(() => {
      const root = document.getElementById("managementContent"),
        first = root.firstChild;
      const original = Storage.prototype.setItem;
      let writes = 0;
      Storage.prototype.setItem = function (k, v) {
        writes++;
        return original.call(this, k, v);
      };
      try {
        updateUI();
        updateUI();
        const stable = first === root.firstChild;
        state.level = 10;
        state.research.levels.training = 1;
        markStateChanged("test-growth");
        updateUI();
        return {
          stable,
          replaced: first !== root.firstChild,
          writes,
          price: getMenuPrice("fried"),
          shown: document.getElementById("managementMenuAverage").dataset
            .amount,
          growthEnabled: !root.querySelector(
            '[data-management-kind="story"][data-management-value="growth"]',
          ).disabled,
          researchEnabled: !root.querySelector(
            '[data-management-kind="story"][data-management-value="research"]',
          ).disabled,
        };
      } finally {
        Storage.prototype.setItem = original;
      }
    });
    assert.equal(r.stable, true);
    assert.equal(r.replaced, true);
    assert.equal(r.writes, 0);
    assert.equal(String(r.price), r.shown);
    assert.equal(r.growthEnabled, true);
    assert.equal(r.researchEnabled, true);
  }));
