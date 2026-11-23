// Node unit tests: node tests/unit.mjs
import assert from 'node:assert/strict';
import { fmt, fmtTime } from '../src/format.js';
import { BUILDING_BY_ID, UPGRADES, BUILDINGS } from '../src/data.js';
import {
  unitCost, bulkCost, maxAffordable, seedsFor, rates, offlineCatchUp, step, doPrestige,
  buyBuilding, buyUpgrade, tierUnlocked, workerCount,
} from '../src/sim.js';
import { newState, migrate, importString, exportString } from '../src/state.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('R9 fmt suffixes', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(12.34), '12.3');
  assert.equal(fmt(999), '999');
  assert.equal(fmt(1230), '1.23K');
  assert.equal(fmt(4.5e6), '4.5M');
  assert.equal(fmt(999950), '1M');
  assert.equal(fmt(2.5e9), '2.5B');
  assert.equal(fmt(1.2e15), '1.2e15');
  assert.equal(fmt(9.999e17), '1e18');
  assert.equal(fmt(NaN), '0');
});
t('fmtTime', () => {
  assert.equal(fmtTime(7200), '2h 0m');
  assert.equal(fmtTime(75), '1m 15s');
  assert.equal(fmtTime(9), '9s');
});
t('R3 cost curve (Lumber Camp base 10)', () => {
  const b = BUILDING_BY_ID.lumber;
  assert.deepEqual([0, 1, 10, 25, 50].map((o) => unitCost(b, o)), [10, 11, 40, 329, 10836]);
});
t('R3 bulk cost: 10 at n=0 is 203, not 100', () => {
  assert.equal(bulkCost(BUILDING_BY_ID.lumber, 0, 10), 203);
  assert.equal(bulkCost(BUILDING_BY_ID.lumber, 0, 1), 10);
  assert.equal(bulkCost(BUILDING_BY_ID.lumber, 0, 100), Math.floor(10 * (Math.pow(1.15, 100) - 1) / 0.15));
});
t('R3 max-buy closed form is exact', () => {
  const b = BUILDING_BY_ID.lumber;
  for (const budget of [9, 10, 203, 1000, 123456, 1e9]) {
    for (const owned of [0, 7, 40]) {
      const k = maxAffordable(b, owned, budget);
      assert.ok(k === 0 || bulkCost(b, owned, k) <= budget, 'fits');
      assert.ok(bulkCost(b, owned, k + 1) > budget, 'k+1 does not fit');
    }
  }
  assert.equal(maxAffordable(b, 0, 203), 10);
  assert.equal(maxAffordable(b, 0, 202), 9);
});
t('R6 prestige math: 4M wood -> 6 seeds -> +30%', () => {
  assert.equal(seedsFor(4e6), 6);
  const s = newState(0);
  s.run.wood = 4e6;
  s.b.lumber = 10;
  s.u.u_map = true;
  assert.equal(doPrestige(s), 6);
  assert.equal(s.seeds, 6);
  assert.equal(s.b.lumber, 0);
  assert.deepEqual(s.u, {});
  assert.equal(s.res.wood, 10);
  assert.ok(Math.abs(rates(s).wood - 0.5 * 1.3) < 1e-9);
  s.run.wood = 5; // below unlock
  assert.equal(doPrestige(s), 0);
});
t('R7 offline: 100 camps, 2h at 50% grants ~73,800 wood; 8h cap', () => {
  const s = newState(0);
  s.b.lumber = 100; // 0.5 + 20 = 20.5/s
  const before = s.res.wood;
  const rep = offlineCatchUp(s, 7200);
  assert.ok(Math.abs(rep.gains.wood - 20.5 * 7200 * 0.5) < 1);
  assert.equal(s.res.wood - before, rep.gains.wood);
  const s2 = newState(0);
  const rep2 = offlineCatchUp(s2, 30 * 3600);
  assert.equal(rep2.seconds, 8 * 3600);
  assert.ok(rep2.capped);
  assert.equal(offlineCatchUp(newState(0), -50), null);
});
t('R7 offline upgrade raises efficiency to 75%', () => {
  const s = newState(0);
  s.u.u_offline = true;
  assert.equal(offlineCatchUp(s, 100).eff, 0.75);
});
t('R2 tiers are gated', () => {
  const s = newState(0);
  assert.ok(tierUnlocked(s, 'wood'));
  assert.ok(!tierUnlocked(s, 'stone') && !tierUnlocked(s, 'metal') && !tierUnlocked(s, 'energy'));
  s.res.wood = 1000;
  s.run.wood = 300;
  assert.ok(buyUpgrade(s, 'u_map'));
  assert.ok(tierUnlocked(s, 'stone'));
  assert.equal(buyBuilding(s, 'mine', 1), 0, 'metal tier still locked');
});
t('R5 upgrades: at least 12, doubling works, requirement enforced', () => {
  assert.ok(UPGRADES.length >= 12);
  const s = newState(0);
  s.b.lumber = 10;
  s.res.wood = 1000;
  const before = rates(s).wood; // 0.5 + 2
  assert.ok(buyUpgrade(s, 'u_axes'));
  assert.equal(rates(s).wood - before, 2);
  const s2 = newState(0);
  s2.res.wood = 1e6;
  assert.ok(!buyUpgrade(s2, 'u_axes'), 'requirement not met');
});
t('Foreman auto-buys cheapest every 5s', () => {
  const s = newState(0);
  s.u.u_foreman = true;
  s.res.wood = 100;
  step(s, 5.1);
  assert.equal(s.b.lumber, 1);
});
t('R4 worker count formula and cap', () => {
  const s = newState(0);
  assert.equal(workerCount(s), 1);
  s.b.lumber = 9;
  assert.equal(workerCount(s), 4);
  s.b.lumber = 1e6;
  assert.equal(workerCount(s), 40);
});
t('R11 migrate repairs bad data; import rejects garbage', () => {
  const m = migrate({ version: 1, res: { wood: NaN, stone: -5, metal: 'x', energy: 7 }, b: { lumber: 3.7 }, u: { u_axes: true, fake: true }, lastSeen: 9e15 }, 1000);
  assert.equal(m.res.wood, 10); assert.equal(m.res.stone, 0); assert.equal(m.res.energy, 7);
  assert.equal(m.b.lumber, 3); assert.equal(m.u.u_axes, true); assert.equal(m.u.fake, undefined);
  assert.equal(m.lastSeen, 1000, 'future lastSeen clamped');
  assert.throws(() => importString('not base64 !!'), /Invalid save/);
  assert.throws(() => importString(btoa('{"foo":1}')), /Invalid save/);
  assert.throws(() => importString(btoa('[1,2]')), /Invalid save/);
  const good = newState(5); good.seeds = 4; good.lastSeen = 1;
  const back = importString(exportString(good), 99999);
  assert.equal(back.seeds, 4);
  assert.equal(back.lastSeen, 99999, 'import never grants offline time');
});
t('R3 data sanity: 8 buildings, 4 tiers', () => {
  assert.equal(BUILDINGS.length, 8);
});

console.log('\n' + n + ' unit tests passed');
