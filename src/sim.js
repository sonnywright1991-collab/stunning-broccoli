// Pure simulation logic. The exact same step() runs live and for offline catch-up.
import {
  GROWTH, RES, BUILDINGS, UPGRADES, BUILDING_BY_ID, UPGRADE_BY_ID, TIER_GATE, BASE_INCOME,
  SEED_BONUS, PRESTIGE_UNLOCK, PRESTIGE_DIVISOR, AUTO_INTERVAL, MAX_VALUE, MAX_WORKERS,
  START_WOOD, OFFLINE_EFF, OFFLINE_EFF_UPGRADED, OFFLINE_CAP_S,
} from './data.js';

export function tierUnlocked(s, res) {
  return res === 'wood' || !!s.u[TIER_GATE[res]];
}

export function totalBuildings(s) {
  let t = 0;
  for (const b of BUILDINGS) t += s.b[b.id];
  return t;
}

export function workerCount(s) {
  return Math.min(MAX_WORKERS, 1 + Math.floor(Math.sqrt(totalBuildings(s))));
}

export function walkSpeedMult(s) {
  let m = 1;
  for (const u of UPGRADES) if (s.u[u.id] && u.walk) m *= u.walk;
  return m;
}

export function bMult(s, id) {
  let m = 1;
  for (const u of UPGRADES) if (s.u[u.id] && u.kind === 'bmult' && u.building === id) m *= u.mult;
  return m;
}

export function globalMult(s) {
  let m = 1 + SEED_BONUS * s.seeds;
  for (const u of UPGRADES) if (s.u[u.id] && u.prod) m *= u.prod;
  return m;
}

export function offlineEff(s) {
  return s.u.u_offline ? OFFLINE_EFF_UPGRADED : OFFLINE_EFF;
}

/** Per-second production of every resource. */
export function rates(s) {
  const r = { wood: BASE_INCOME, stone: 0, metal: 0, energy: 0 };
  for (const b of BUILDINGS) r[b.res] += s.b[b.id] * b.out * bMult(s, b.id);
  const g = globalMult(s);
  for (const k of RES) r[k] *= g;
  return r;
}

/** Production of one building type per second, including all multipliers. */
export function buildingRate(s, id) {
  const b = BUILDING_BY_ID[id];
  return s.b[id] * b.out * bMult(s, id) * globalMult(s);
}

export function addRes(s, res, amt) {
  if (!(amt > 0)) return;
  s.res[res] = Math.min(MAX_VALUE, s.res[res] + amt);
  s.run[res] = Math.min(MAX_VALUE, s.run[res] + amt);
  s.total[res] = Math.min(MAX_VALUE, s.total[res] + amt);
}

export function clickValue(s) {
  return 1 * globalMult(s);
}

export function gather(s) {
  addRes(s, 'wood', clickValue(s));
  s.stats.clicks += 1;
}

// ---- costs -------------------------------------------------------------

export function unitCost(b, owned) {
  return Math.floor(b.base * Math.pow(GROWTH, owned));
}

/** Cost of k buildings starting with `owned`: geometric series, not k separate loops. */
export function bulkCost(b, owned, k) {
  if (k <= 1) return unitCost(b, owned);
  const first = b.base * Math.pow(GROWTH, owned);
  // + 1e-6 guards against floor() landing one below an exact integer from float error
  return Math.floor((first * (Math.pow(GROWTH, k) - 1)) / (GROWTH - 1) + 1e-6);
}

/** Largest k whose bulkCost fits in `budget`, via the closed form (no loops over k). */
export function maxAffordable(b, owned, budget) {
  const first = b.base * Math.pow(GROWTH, owned);
  if (!(budget >= first)) return 0;
  let k = Math.floor(Math.log(1 + (budget * (GROWTH - 1)) / first) / Math.log(GROWTH));
  while (k > 0 && bulkCost(b, owned, k) > budget) k--; // float-edge safety
  while (bulkCost(b, owned, k + 1) <= budget) k++;
  return k;
}

export function buyBuilding(s, id, k) {
  const b = BUILDING_BY_ID[id];
  if (!tierUnlocked(s, b.res) || !(k >= 1)) return 0;
  const cost = bulkCost(b, s.b[id], k);
  if (s.res[b.costRes] < cost) return 0;
  s.res[b.costRes] -= cost;
  s.b[id] += k;
  return k;
}

export function canAffordUpgrade(s, u) {
  return s.res[u.cost.res] >= u.cost.amt;
}

export function buyUpgrade(s, id) {
  const u = UPGRADE_BY_ID[id];
  if (!u || s.u[id] || !u.req(s) || !canAffordUpgrade(s, u)) return false;
  s.res[u.cost.res] -= u.cost.amt;
  s.u[id] = true;
  return true;
}

// ---- automation --------------------------------------------------------

export function autoBuyCheapest(s) {
  let best = null;
  let bestCost = Infinity;
  for (const b of BUILDINGS) {
    if (!tierUnlocked(s, b.res)) continue;
    const c = unitCost(b, s.b[b.id]);
    if (c < bestCost && s.res[b.costRes] >= c) { best = b; bestCost = c; }
  }
  if (best) buyBuilding(s, best.id, 1);
}

// ---- time --------------------------------------------------------------

export function step(s, dt) {
  if (!(dt > 0)) return;
  const r = rates(s);
  for (const k of RES) addRes(s, k, r[k] * dt);
  if (s.u.u_foreman) {
    s.autoT += dt;
    let guard = 5;
    while (s.autoT >= AUTO_INTERVAL && guard-- > 0) {
      s.autoT -= AUTO_INTERVAL;
      autoBuyCheapest(s);
    }
    if (s.autoT > AUTO_INTERVAL) s.autoT = AUTO_INTERVAL;
  }
}

/**
 * Credit time spent away. Capped at 8h, efficiency 50% (75% with Night Shift).
 * Uses at most 600 coarse steps so a long gap loads in well under 50 ms.
 */
export function offlineCatchUp(s, rawSeconds) {
  if (!(rawSeconds > 0)) return null;
  const seconds = Math.min(rawSeconds, OFFLINE_CAP_S);
  const eff = offlineEff(s);
  const before = { ...s.res };
  const chunks = 600;
  const dt = (seconds * eff) / chunks;
  for (let i = 0; i < chunks; i++) step(s, dt);
  const gains = {};
  for (const k of RES) gains[k] = s.res[k] - before[k];
  return { rawSeconds, seconds, capped: rawSeconds > OFFLINE_CAP_S, eff, gains };
}

// ---- prestige ----------------------------------------------------------

export function seedsFor(runWood) {
  return Math.floor(Math.sqrt(runWood / PRESTIGE_DIVISOR));
}

export function prestigeReady(s) {
  return s.run.wood >= PRESTIGE_UNLOCK;
}

export function doPrestige(s) {
  if (!prestigeReady(s)) return 0;
  const gained = seedsFor(s.run.wood);
  s.seeds += gained;
  s.res = { wood: START_WOOD, stone: 0, metal: 0, energy: 0 };
  s.run = { wood: 0, stone: 0, metal: 0, energy: 0 };
  for (const b of BUILDINGS) s.b[b.id] = 0;
  s.u = {};
  s.autoT = 0;
  s.stats.prestiges += 1;
  return gained;
}
