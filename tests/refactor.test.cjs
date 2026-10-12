const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { harness, KEY } = require("./helpers/game.cjs");
const { game, fixture } = harness();

test("canonical functions have one source definition and boot loads last", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const files = [...html.matchAll(/<script src="\.\/(js\/[^\"]+)"/g)].map(
    (m) => m[1],
  );
  const sources = files
    .map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
    .join("\n");
  for (const name of [
    "save",
    "sanitizeState",
    "sumEffects",
    "computeRates",
    "updateDelivery",
    "updateOnlineAuto",
    "generateWeeklyCertificate",
    "startEndingSequence",
    "finishEndingSequence",
    "bindEndingUI",
    "updateUI",
    "updateStatsUI",
    "onCanvasDown",
  ]) {
    assert.equal(
      (
        sources.match(new RegExp("(?:async )?function " + name + "\\(", "g")) ||
        []
      ).length,
      1,
      name,
    );
    assert.equal(
      new RegExp("\\b" + name + "\\s*=\\s*(?:async )?function").test(sources),
      false,
      name,
    );
  }
  assert.equal(files.at(-1), "js/core/boot.js");
  assert.doesNotMatch(
    sources,
    /installImportantSaveActionAudit|importantSnapshot|installBranchSnapshotSaveStability/,
  );
});

test("one purchase writes one synchronized primary and one previous-save backup", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    const r = await p.evaluate(() => {
      save(true);
      const before = localStorage.getItem(SAVE_KEY),
        keys = [],
        original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        keys.push(k);
        return original.call(this, k, v);
      };
      try {
        buyUpgrade("signboard");
      } finally {
        Storage.prototype.setItem = original;
      }
      const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
      return {
        keys,
        before,
        backup: localStorage.getItem(SAVE_BACKUP_KEY),
        money: state.money,
        storedMoney: stored.money,
        level: stored.branches.changnyeong.data.upgrades.signboard,
        dirty: _saveDirty,
      };
    });
    assert.deepEqual(r.keys, [KEY + "_backup", KEY]);
    assert.equal(r.backup, r.before);
    assert.equal(r.money, r.storedMoney);
    assert.equal(r.level, 1);
    assert.equal(r.dirty, false);
  }));

test("tick marks progression without auditing or synchronous storage until save", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      save(true);
      const original = Storage.prototype.setItem,
        keys = [];
      Storage.prototype.setItem = function (k, v) {
        keys.push(k);
        return original.call(this, k, v);
      };
      try {
        tick(0.05);
        return {
          keys,
          dirty: _saveDirty,
          reason: lastStateChangeReason,
          online: state.serviceTimers.onlineOrders,
          play: state.play.onlineSecTotal,
          audit: window.__importantSaveAuditTimer ?? null,
        };
      } finally {
        Storage.prototype.setItem = original;
      }
    });
    assert.deepEqual(r.keys, []);
    assert.equal(r.dirty, true);
    assert.ok(r.online > 0 && r.play > 0);
    assert.equal(r.audit, null);
  }));

test("wrong serving marks reputation and customer progress dirty and survives reconnect", async () =>
  game(fixture({ rep: 4 }), async (p) => {
    const r = await p.evaluate(() => {
      state.customers = [
        {
          id: "wrong",
          menuId: "fried",
          state: "waiting",
          x: 10,
          y: 10,
          patience: 99,
        },
      ];
      state.selectedCustomerId = "wrong";
      save(true);
      serveByMenu("yangnyeom");
      const dirty = _saveDirty;
      save(true);
      return { dirty, rep: state.rep, patience: state.customers[0].patience };
    });
    assert.equal(r.dirty, true);
    assert.ok(r.rep < 4 && r.patience < 99);
    await p.reload();
    assert.equal(await p.evaluate(() => state.rep), r.rep);
  }));

test("derived effects are scoped and invalidated by a purchase within a batch", async () =>
  game(fixture({ money: 1e9 }), async (p) => {
    const r = await p.evaluate(() => {
      beginEffectBatch();
      const before = sumEffects().ordersMul;
      try {
        buyUpgrade("signboard");
        return { before, after: sumEffects().ordersMul };
      } finally {
        endEffectBatch();
      }
    });
    const fresh = await p.evaluate(() => {
      state.research.levels.secretSauce = 1;
      const first = sumEffects().earningMul;
      state.research.levels.secretSauce = 10;
      return {
        first,
        second: sumEffects().earningMul,
        depth: effectBatchDepth,
      };
    });
    assert.equal(r.before, 0);
    assert.ok(r.after > r.before);
    assert.ok(fresh.second > fresh.first);
    assert.equal(fresh.depth, 0);
  }));

test("unlocked menu UI performs one effect aggregation per update batch", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.upgrades.menuUnlock = 9;
      buildMenuGrid();
      const original = aggregateEffects;
      let calls = 0;
      aggregateEffects = function () {
        calls++;
        return original();
      };
      try {
        updateUI();
        return {
          calls,
          prices: [...menuGrid.children].map((b) => Number(b.dataset.price)),
          expected: MENUS.map((m) => getMenuPrice(m.id)),
        };
      } finally {
        aggregateEffects = original;
      }
    });
    assert.equal(r.calls, 1);
    assert.deepEqual(r.prices, r.expected);
  }));

test("unchanged stamp and report DOM remains stable while changed values refresh", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      state.menuStats.fried = { count: 2, offlineCount: 1, earned: 60000 };
      updateUI();
      updateStatsUI();
      const stamp = dailyStampRow.firstChild,
        row = document.getElementById("menuRankBody").firstChild;
      updateUI();
      updateStatsUI();
      const stable =
        stamp === dailyStampRow.firstChild &&
        row === document.getElementById("menuRankBody").firstChild;
      state.missions.dailyStamps = 1;
      state.menuStats.fried.earned = 70000;
      updateUI();
      updateStatsUI();
      return {
        stable,
        stamp: dailyStampRow.firstChild.textContent,
        row: document.getElementById("menuRankBody").textContent,
      };
    });
    assert.equal(r.stable, true);
    assert.equal(r.stamp, "🐔");
    assert.ok(r.row.includes("7만원"));
  }));

test("export synchronizes current branch and partial services without writing or allocating rewards", async () =>
  game(fixture({ offlineReward: { amount: 500, seconds: 60 } }), async (p) => {
    const r = await p.evaluate(() => {
      state.branches.changnyeong.data.legacyExtension = { note: "keep" };
      state.regionUnlocked.busan = true;
      updateOnlineAuto((0.4 * 60) / computeRates().onlineOrdersPerMin);
      state.menuStats.fried = { count: 7, earned: 123 };
      markStateChanged("test-sales", false);
      const before = localStorage.getItem(SAVE_KEY);
      const data = JSON.parse(exportSaveData()).data;
      return {
        same: before === localStorage.getItem(SAVE_KEY),
        view: data.menuStats,
        snapshot: data.branches.changnyeong.data.menuStats,
        partial: data.branches.changnyeong.data.serviceTimers.onlineOrders,
        pending: data.offlineReward.amount,
        extension: data.branches.changnyeong.data.legacyExtension,
      };
    });
    assert.equal(r.same, true);
    assert.deepEqual(r.view, r.snapshot);
    assert.ok(Math.abs(r.partial - 0.4) < 1e-9);
    assert.equal(r.pending, 500);
    assert.deepEqual(r.extension, { note: "keep" });
  }));

test("delivery interval signature preserves a decided trip on reconnect without reroll", async () =>
  game(fixture(), async (p) => {
    const first = await p.evaluate(() => {
      state.delivery = { level: 0, riders: 1 };
      Math.random = () => 0.5;
      updateDelivery(2, Date.now());
      save(true);
      return {
        elapsed: deliveryTimer,
        interval: deliveryNextIntervalMs,
        signature: state.serviceTimers.deliverySignature,
      };
    });
    await p.reload();
    const restored = await p.evaluate(() => {
      deliveryNextVisualSec = 5;
      let randoms = 0;
      Math.random = () => {
        randoms++;
        return 0.99;
      };
      updateDelivery(0, Date.now());
      return {
        elapsed: deliveryTimer,
        interval: deliveryNextIntervalMs,
        signature: state.serviceTimers.deliverySignature,
        randoms,
      };
    });
    assert.equal(restored.randoms, 0);
    delete restored.randoms;
    assert.deepEqual(restored, first);
  }));

test("failed import retains original root, ending run, click effects and pending receipt", async () =>
  game(
    fixture({
      money: 123456,
      endingUnlocked: true,
      offlineReward: { amount: 500, seconds: 60 },
      coupons: { drink: 3, veg: 2 },
    }),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      const r = await p.evaluate(async () => {
        await startEndingSequence();
        window._fxState.boss.buffCount = 2;
        const source = state,
          run = endingRun;
        const raw = JSON.parse(exportSaveData());
        raw.data.money = 9;
        raw.data.offlineReward.amount = 77;
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("quota");
          return original.call(this, k, v);
        };
        let ok;
        try {
          ok = importSaveData(JSON.stringify(raw));
        } finally {
          Storage.prototype.setItem = original;
        }
        const result = {
          ok,
          same: state === source,
          money: state.money,
          pending: state.offlineReward.amount,
          phase: endingPhase,
          runSame: endingRun === run,
          uses: window._fxState.boss.buffCount,
          coupons: state.coupons,
        };
        cancelEndingRuntime();
        return result;
      });
      assert.deepEqual(r, {
        ok: false,
        same: true,
        money: 123456,
        pending: 500,
        phase: "playing",
        runSame: true,
        uses: 2,
        coupons: { drink: 3, veg: 2 },
      });
    },
  ));

test("failed reset leaves original root and durable save available for reconnect", async () =>
  game(
    fixture({ money: 123456, offlineReward: { amount: 500, seconds: 60 } }),
    async (p) => {
      const r = await p.evaluate(() => {
        save(true);
        const source = state,
          before = localStorage.getItem(SAVE_KEY),
          original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === SAVE_KEY) throw Error("quota");
          return original.call(this, k, v);
        };
        let ok;
        try {
          ok = resetGame();
        } finally {
          Storage.prototype.setItem = original;
        }
        return {
          ok,
          same: state === source,
          stored: before === localStorage.getItem(SAVE_KEY),
          money: state.money,
          pending: state.offlineReward.amount,
        };
      });
      assert.deepEqual(r, {
        ok: false,
        same: true,
        stored: true,
        money: 123456,
        pending: 500,
      });
      await p.reload();
      assert.equal(await p.evaluate(() => state.money), 123456);
    },
  ));

test("completed reset removes old backup so corruption cannot resurrect prior rewards", async () =>
  game(
    fixture({
      money: 123456,
      coupons: { drink: 5, veg: 7 },
      offlineReward: { amount: 500, seconds: 60 },
    }),
    async (p) => {
      const r = await p.evaluate(() => {
        save(true);
        save(true);
        const ok = resetGame();
        const backup = localStorage.getItem(SAVE_BACKUP_KEY);
        localStorage.setItem(SAVE_KEY, "corrupt");
        return { ok, backup };
      });
      assert.deepEqual(r, { ok: true, backup: null });
      await p.reload();
      assert.deepEqual(
        await p.evaluate(() => ({
          money: state.money,
          pending: state.offlineReward.amount,
          coupons: state.coupons,
          staff: getStaffCount(),
        })),
        { money: 0, pending: 0, coupons: { drink: 0, veg: 0 }, staff: 0 },
      );
    },
  ));

test("failed primary write remains dirty and retry persists the same ledger exactly once", async () =>
  game(fixture(), async (p) => {
    const r = await p.evaluate(() => {
      recordIncome(700, { menuId: "fried", count: 1 });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === SAVE_KEY) throw Error("quota");
        return original.call(this, k, v);
      };
      let first;
      try {
        first = save(true);
      } finally {
        Storage.prototype.setItem = original;
      }
      const dirty = _saveDirty,
        second = save(true),
        stored = JSON.parse(localStorage.getItem(SAVE_KEY));
      return {
        first,
        dirty,
        second,
        money: stored.money,
        total: stored.branches.changnyeong.data.totalSales,
        count: stored.menuStats.fried.count,
      };
    });
    assert.deepEqual(r, {
      first: false,
      dirty: true,
      second: true,
      money: 700,
      total: 700,
      count: 1,
    });
    await p.reload();
    assert.equal(await p.evaluate(() => state.totalSales), 700);
  }));

test("small-screen backup and import buttons preserve paid and pending rewards on reconnect", async () =>
  game(
    fixture({
      money: 123456,
      coupons: { drink: 5, veg: 7 },
      offlineReward: { amount: 500, seconds: 60 },
    }),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      await p.locator('[data-ui-close="modalOffline"]').tap();
      await p.locator("#openSettings").tap();
      await p.locator("#exportSaveBtn").tap();
      const raw = await p.locator("#saveTransferText").inputValue();
      const data = JSON.parse(raw).data;
      assert.equal(data.offlineReward.amount, 500);
      assert.deepEqual(data.coupons, { drink: 5, veg: 7 });
      await p.locator("#saveTransferText").fill(raw);
      await p.locator("#importSaveBtn").tap();
      await p.evaluate(() =>
        document.getElementById("modalOffline").classList.remove("on"),
      );
      await p.screenshot({
        path: path.join(
          __dirname,
          "../test-results/screenshots/nice-chicken-imp08-backup-small.png",
        ),
      });
      await p.reload();
      assert.deepEqual(
        await p.evaluate(() => ({
          money: state.money,
          pending: state.offlineReward.amount,
          coupons: state.coupons,
        })),
        { money: 123456, pending: 500, coupons: { drink: 5, veg: 7 } },
      );
    },
    { viewport: { width: 320, height: 568 } },
  ));

test("clean profile and sound actions persist immediately without the removed drift timer", async () =>
  game(fixture(), async (p) => {
    await p.evaluate(() => {
      save(true);
      modalProfile.classList.add("on");
    });
    await p.locator("#nameInput").fill("새이름");
    await p.locator("#saveName").tap();
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem(SAVE_KEY)).profile.name,
      ),
      "새이름",
    );
    await p.locator("#openSettings").tap();
    await p.locator("#toggleSound").tap();
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem(SAVE_KEY)).soundOn,
      ),
      true,
    );
    await p.reload();
    assert.deepEqual(
      await p.evaluate(() => ({
        name: state.profile.name,
        sound: state.soundOn,
      })),
      { name: "새이름", sound: true },
    );
  }));
