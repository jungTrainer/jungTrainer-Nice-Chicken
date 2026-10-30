const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pwaHarness } = require('./helpers/pwa.cjs');
const { scenario } = pwaHarness();
const owners = ['layout', 'effects', 'signboard', 'background', 'characters', 'render'];
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { polling: 100, timeout: 30000 });
const data = p => p.evaluate(() => ({ money: state.money, coupons: state.coupons, ledger: JSON.stringify(state.couponLedger), pending: state.offlineReward, paid: [state.missions.dailyRewardPaid, state.missions.weeklyRewardPaid], region: state.regionId }));
const state = { money: '9007199254740993', upgrades: { hire: 6 }, coupons: { drink: 3, veg: 7 }, offlineReward: { amount: 777, seconds: 60 } };
async function render(p) {
  await p.evaluate(() => { if (typeof drawBackground !== 'function' || typeof staffCenters !== 'function') throw Error('missing scene'); window.render(); });
}
async function settings(p) { await p.keyboard.press('Escape'); await p.locator('#openSettings').tap(); }
async function apply(p, version) {
  await p.locator('#applyPwaUpdate').tap();
  await wait(p, v => document.querySelector('meta[name="app-version"]').content === v, version);
  await wait(p, () => typeof SessionOwner !== 'undefined' && SessionOwner.mode !== 'starting');
  await p.evaluate(() => SessionOwner.ready);
}

test('new scene shell stays playable offline and across explicit update without changing fixed benefits', () => scenario(async ({ page, context, serverOffline, select, releases }) => {
  await render(page); const before = await data(page);
  serverOffline(true); await context.setOffline(true); await page.reload(); await page.evaluate(() => SessionOwner.ready);
  await render(page); assert.deepEqual(await data(page), before);
  serverOffline(false); await context.setOffline(false); await settings(page);
  select(1); await page.locator('#checkPwaUpdate').tap(); await wait(page, () => !document.getElementById('applyPwaUpdate').disabled);
  await apply(page, releases[1].version); await render(page); assert.deepEqual(await data(page), before);
}, { state }));

for (const owner of owners) test(`missing scene ${owner} refuses an update and repairs explicitly with benefits intact`, () => scenario(async ({ page, failures, select, releases }) => {
  await render(page); const before = await data(page); await settings(page);
  select(1); failures.set('js/scene/' + owner + '.js', 'missing');
  await page.locator('#checkPwaUpdate').tap(); await wait(page, () => document.getElementById('pwaStatus').textContent.includes('설치 실패'));
  assert.equal(await page.evaluate(() => PwaRuntime.version), releases[0].version);
  await render(page); assert.deepEqual(await data(page), before);
  failures.clear(); await page.locator('#checkPwaUpdate').tap(); await wait(page, () => !document.getElementById('applyPwaUpdate').disabled);
  await apply(page, releases[1].version); await render(page); assert.deepEqual(await data(page), before);
}, { state }));
