const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { test } = require('node:test');
const { harness } = require('./helpers/game.cjs');
const { game, fixture } = harness();
const root = path.resolve(__dirname, '..');
const expected = require('./fixtures/recovery-scene.json');
const files = Object.keys(expected.owners).map(n => 'js/scene/' + n + '.js');
const sources = files.map(f => fs.readFileSync(path.join(root, f), 'utf8'));
const hash = s => crypto.createHash('sha256').update(s.trim()).digest('hex');
const stable = p => p.waitForFunction(() => state.customers.length > 0, null, { polling: 50 });
const snapshot = p => p.evaluate(() => ({ state: JSON.stringify(state), primary: localStorage.getItem(SAVE_KEY), backup: localStorage.getItem(SAVE_BACKUP_KEY), dirty: _saveDirty, service: JSON.stringify(ServiceRuntime) }));

test('recreated scene owners have one definition, one effective FX default and pinned scripts before main/boot', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/runtime-globals.json')));
  assert.deepEqual(inventory.modules.map(m => m.file), scripts);
  const all = scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  const release = require('../scripts/build-pwa.cjs').build(root, true);
  assert.equal(scripts.at(-1), 'js/core/boot.js');
  for (const [owner, names] of Object.entries(expected.owners)) {
    const file = 'js/scene/' + owner + '.js';
    assert.ok(scripts.indexOf(file) > scripts.indexOf('js/core/services.js'));
    assert.ok(scripts.indexOf(file) < scripts.indexOf('js/main.js'));
    assert.ok(release.required.some(a => a.path === file && a.hash));
    for (const name of names) {
      assert.equal([...all.matchAll(new RegExp('^function ' + name + '\\(', 'gm'))].length, 1, name);
      assert.doesNotMatch(all, new RegExp('\\b' + name + '\\s*=\\s*(?:async )?function'));
    }
  }
  assert.equal([...all.matchAll(/^window\._fxState = /gm)].length, 1);
  assert.doesNotMatch(sources.join('\n'), /addEventListener\(|setInterval\(|requestAnimationFrame\(/);
});

test('scene bodies retain c66d96f except explicitly pinned image adapters; buffer declarations stay identical', () => {
  const source = sources.join('\n');
  const revised = require('./fixtures/recovery-image-adapters.json').functions;
  assert.equal(Object.keys(revised).length, 9);
  for (const [name, originalDigest] of Object.entries(expected.functions)) {
    const digest = revised[name] || originalDigest;
    const start = source.indexOf('function ' + name + '(');
    assert.ok(start >= 0);
    assert.equal(hash(source.slice(start, source.indexOf('\n}', start) + 2)), digest, name);
  }
  assert.equal(hash(source.match(/window\._fxState = \{[\s\S]*?\n};/)[0]), expected.declarations.effectiveFx);
  assert.equal(hash(source.match(/let _bossAnim = \{[\s\S]*?\n};/)[0]), expected.declarations.bossAnim);
  assert.equal(hash(source.match(/const _BG_CACHE = [^\n]+/)[0]), expected.declarations.backgroundCache);
  assert.equal(hash(source.match(/let floats = \[\];\nlet bossParticles = \[\];\nlet bossFlash = [^\n]+/)[0]), expected.declarations.particles);
});

test('scene installation requires no DOM/game/save/media and initializes only existing visual owners', () => {
  const context = vm.createContext({ window: {}, performance: { now: () => 1234 } });
  for (const source of sources) vm.runInContext(source, context);
  assert.equal(vm.runInContext('typeof render', context), 'function');
  assert.equal(vm.runInContext('_bossAnim.t0', context), 1234);
  assert.equal(vm.runInContext('floats.length + bossParticles.length + bossFlash', context), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window._fxState)), {
    boss: { taps: 0, buffUntil: 0, lastClick: 0, buffCount: 0, buffDate: '' },
    staffs: {}, speech: { type: null, key: null, msg: '', until: 0 },
  });
});

for (const width of [360, 390]) test(`${width}px scene layers render all six regions without changing game/save/service or canvas state`, () => game(fixture({ upgrades: { hire: 6, signboard: 9, interior: 10 } }), async p => {
  await stable(p);
  const pictures = [];
  for (const region of ['changnyeong', 'busan', 'seoul', 'japan', 'usa', 'mars']) {
    // Synthetic view only; actual branch transactions are checked separately.
    await p.evaluate(id => { state.regionId = id; state.selectedCustomerId = state.customers[0].id; }, region);
    const before = await snapshot(p);
    pictures.push(await p.evaluate(() => {
      render();
      if (!ctx.getTransform().isIdentity || ctx.globalAlpha !== 1) throw Error('canvas state leak');
      return canvas.toDataURL();
    }));
    assert.deepEqual(await snapshot(p), before);
  }
  assert.equal(new Set(pictures).size, 6);
}, { viewport: { width, height: 844 } }));

for (const width of [360, 390]) test(`${width}px actual touch still selects six distinct staff effect owners`, () => game(fixture({ upgrades: { hire: 6 } }), async p => {
  await stable(p); const before = await snapshot(p);
  const points = await p.evaluate(() => { const r = canvas.getBoundingClientRect(); return staffCenters().map(s => ({ key: s.key, x: s.x * r.width / canvas.width, y: s.hitY * r.height / canvas.height })); });
  assert.equal(points.length, 6);
  for (const s of points) await p.locator('#stage').tap({ position: { x: s.x, y: s.y } });
  assert.deepEqual(await p.evaluate(() => Object.keys(_fxState.staffs)), points.map(s => s.key));
  assert.deepEqual(await p.evaluate(() => Object.values(_fxState.staffs).map(s => s.taps)), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(await snapshot(p), before);
}, { viewport: { width, height: 844 } }));

test('visual buffer updates expire particles/text without ticking, saving or granting rewards', () => game(fixture(), async p => {
  await stable(p); const before = await snapshot(p);
  const result = await p.evaluate(() => { floatText('display only', 20, 30, 'gold'); bossBurst(20, 30, 3); updateFloats(2); updateBossParticles(2); render(); return [floats.length, bossParticles.length, bossFlash]; });
  assert.deepEqual(result, [0, 0, 0]);
  assert.deepEqual(await snapshot(p), before);
}));

test('actual customer/menu touch settles once, refresh is pure and reconnect keeps the serving result', () => game(fixture({ coupons: { drink: 3, veg: 7 } }), async p => {
  await stable(p);
  await p.evaluate(() => { state.customers = [{ id: 'recovery-order', menuId: 'fried', menuName: MENU_MAP.fried.name, emoji: '🙂', state: 'waiting', x: canvas.width / 2, y: canvas.height - 220, r: 30, patience: 99, patienceMax: 99 }]; state.selectedCustomerId = null; render(); });
  const point = await p.evaluate(() => { const c = state.customers[0], r = canvas.getBoundingClientRect(); return { x: c.x * r.width / canvas.width, y: c.y * r.height / canvas.height }; });
  const count = await p.evaluate(() => state.menuStats.fried?.count || 0);
  const ledger = await p.evaluate(() => JSON.stringify(state.couponLedger));
  await p.locator('#stage').tap({ position: point });
  await p.locator('[data-action="serve-menu"][data-menu-id="fried"]').tap();
  assert.equal(await p.evaluate(() => state.menuStats.fried.count), count + 1);
  const after = await snapshot(p); await p.evaluate(() => { render(); render(); });
  assert.deepEqual(await snapshot(p), after);
  assert.equal(await p.evaluate(() => JSON.stringify(state.couponLedger)), ledger);
  await p.reload(); await p.evaluate(() => SessionOwner.ready);
  assert.equal(await p.evaluate(() => state.menuStats.fried.count), count + 1);
}));

test('branch travel/reconnect/export/import/reset preserve ledger and archived fixed pending across scene ownership', () => game(fixture({ money: 1e15, upgrades: { hire: 6 }, regionUnlocked: { changnyeong: true, busan: true }, coupons: { drink: 3, veg: 7 }, offlineReward: { amount: 777, seconds: 60 } }), async p => {
  p.on('dialog', d => d.accept()); await p.keyboard.press('Escape'); await stable(p);
  const ledger = await p.evaluate(() => JSON.stringify(state.couponLedger));
  await p.locator('#openMap').tap(); await p.locator('.map-node[data-region-id="busan"] button').tap(); await p.keyboard.press('Escape');
  await p.reload(); await p.evaluate(() => SessionOwner.ready); await p.keyboard.press('Escape');
  assert.equal(await p.evaluate(() => state.regionId), 'busan');
  assert.equal(await p.evaluate(() => state.branches.changnyeong.data.offlineReward.amount), 777);
  assert.equal(await p.evaluate(() => importSaveData(exportSaveData())), true);
  await p.keyboard.press('Escape'); const before = await snapshot(p);
  await p.evaluate(() => render()); assert.deepEqual(await snapshot(p), before);
  assert.equal(await p.evaluate(() => resetGame()), true);
  assert.equal(await p.evaluate(() => JSON.stringify(state.couponLedger)), ledger);
  assert.equal(await p.evaluate(() => getStaffCount()), 0);
}));
