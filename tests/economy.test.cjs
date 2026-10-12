const assert = require("node:assert/strict");
const { test } = require("node:test");
const { harness } = require("./helpers/game.cjs");
const { game, fixture } = harness();
for (const actor of ["player", "neighbor", "system"])
  for (const roll of [0, 0.99])
    test(`${actor} serving with tip roll ${roll} records full revenue once`, async () =>
      game(fixture(), async (p) => {
        const r = await p.evaluate(
          ({ actor, roll }) => {
            Math.random = () => roll;
            state.customers = [
              {
                id: "one",
                menuId: "fried",
                state: "waiting",
                x: 50,
                y: 100,
                patience: 10,
              },
            ];
            state.selectedCustomerId = "one";
            serveByMenu("fried", actor);
            state.selectedCustomerId = "one";
            serveByMenu("fried", actor);
            return {
              money: state.money,
              sales: state.totalSales,
              menu: state.menuStats.fried,
              contrib: state.contrib,
            };
          },
          { actor, roll },
        );
        assert.equal(r.money, r.sales);
        assert.equal(r.money, r.menu.earned);
        assert.equal(r.menu.count, 1);
        assert.equal(
          r.money,
          Object.values(r.contrib).reduce((a, b) => a + b, 0),
        );
        await p.reload();
        assert.equal(await p.evaluate(() => state.totalSales), r.sales);
      }));
test("unlocked menu prices, general research and channels apply once", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      Math.random = () => 0.99;
      state.research.levels.secretSauce = 10;
      state.upgrades.expand = 2;
      state.menuLevels.fried = 1;
      const price = getMenuPrice("fried");
      processDelivery(VEHICLES[0]);
      updateOnlineAuto(300);
      return {
        price,
        money: state.money,
        total: state.totalSales,
        menu: state.menuStats.fried,
      };
    });
    assert.equal(r.price, 75240);
    assert.equal(r.money, r.total);
    assert.equal(r.menu.earned, r.money);
    assert.equal(r.menu.count, 2);
  }));
test("new offline receipt records menu counts separately; legacy receipt remains unclassified", async () =>
  game(fixture({ offlineReward: { amount: 100, seconds: 60 } }), async (p) => {
    const r = await p.evaluate(() => {
      window.testNow += 3600000;
      applyOfflineProgress();
      const amount = state.offlineReward.amount;
      claimOfflineReward();
      return {
        amount,
        offline: state.offlineSalesTotal,
        unclassified: state.unattributedSales,
        system: state.contrib.system,
        menu: state.menuStats.fried,
        online: state.totalSales,
      };
    });
    assert.equal(r.amount, r.offline);
    assert.equal(r.system, r.amount);
    assert.equal(r.unclassified, 100);
    assert.equal(r.online, 0);
    assert.ok(r.menu.offlineCount > 0);
    assert.equal(r.menu.count, 0);
  }));
test("all displayed regional prices equal charged upgrade cost", async () =>
  game(fixture({ money: 1e12 }), async (p) => {
    const r = await p.evaluate(() => {
      state.regionId = "busan";
      openPanel("upg");
      return UPGRADES.map((u) => {
        renderPanel("upg");
        const b = document.querySelector(`[data-upgrade-id="${u.id}"]`),
          cost = Number(b.dataset.cost),
          before = state.money;
        b.click();
        return { cost, charged: before - state.money };
      });
    });
    for (const x of r) assert.equal(x.cost, x.charged);
  }));
test("historical revenue gaps and paid coupons survive import and reload without backfill", async () =>
  game(fixture(), async (p) => {
    p.on("dialog", (d) => d.accept());
    const r = await p.evaluate(() => {
      const raw = JSON.parse(exportSaveData());
      raw.data.totalSales = 111;
      raw.data.contrib.system = 77;
      raw.data.menuStats = {};
      raw.data.coupons.veg = 8;
      raw.data.missions.dailyCompletedToday = true;
      importSaveData(JSON.stringify(raw));
      save(true);
      return {
        total: state.totalSales,
        contrib: state.contrib.system,
        menus: state.menuStats,
        veg: state.coupons.veg,
      };
    });
    assert.deepEqual(r, { total: 111, contrib: 77, menus: {}, veg: 8 });
    await p.reload();
    assert.equal(await p.evaluate(() => state.coupons.veg), 8);
  }));
