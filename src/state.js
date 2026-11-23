// State creation, validation/migration, save/load, import/export.
// localStorage is only touched inside functions so this module also loads in Node tests.
import {
  RES, BUILDINGS, UPGRADES, SAVE_KEY, SAVE_VERSION, START_WOOD, MAX_VALUE, OFFLINE_MIN_S,
} from './data.js';
import { offlineCatchUp } from './sim.js';

const zeroRes = () => ({ wood: 0, stone: 0, metal: 0, energy: 0 });

export function newState(now = Date.now()) {
  const b = {};
  for (const x of BUILDINGS) b[x.id] = 0;
  return {
    version: SAVE_VERSION,
    res: { ...zeroRes(), wood: START_WOOD },
    run: zeroRes(),
    total: zeroRes(),
    b,
    u: {},
    seeds: 0,
    autoT: 0,
    lastSeen: now,
    buyMode: '1',
    stats: { clicks: 0, prestiges: 0, created: now },
  };
}

function num(v, fallback = 0) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, MAX_VALUE) : fallback;
}

/** Throws if `raw` cannot possibly be a save. Used for imports. */
export function validate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid save');
  if (typeof raw.version !== 'number') throw new Error('Invalid save');
  if (!raw.res || typeof raw.res !== 'object') throw new Error('Invalid save');
  if (raw.version > SAVE_VERSION) throw new Error('Save is from a newer version');
}

/** Fill in missing fields, drop unknown ones, repair NaN/negative numbers. */
export function migrate(raw, now = Date.now()) {
  const s = newState(now);
  if (!raw || typeof raw !== 'object') return s;
  for (const k of RES) {
    s.res[k] = num(raw.res && raw.res[k], s.res[k]);
    s.run[k] = num(raw.run && raw.run[k], 0);
    s.total[k] = num(raw.total && raw.total[k], 0);
  }
  for (const x of BUILDINGS) s.b[x.id] = Math.floor(num(raw.b && raw.b[x.id], 0));
  for (const u of UPGRADES) if (raw.u && raw.u[u.id] === true) s.u[u.id] = true;
  s.seeds = Math.floor(num(raw.seeds, 0));
  s.autoT = num(raw.autoT, 0);
  s.lastSeen = num(raw.lastSeen, now);
  if (s.lastSeen > now) s.lastSeen = now; // clock moved backwards: never credit negative time
  s.buyMode = ['1', '10', '100', 'max'].includes(raw.buyMode) ? raw.buyMode : '1';
  if (raw.stats) {
    s.stats.clicks = Math.floor(num(raw.stats.clicks, 0));
    s.stats.prestiges = Math.floor(num(raw.stats.prestiges, 0));
    s.stats.created = num(raw.stats.created, now);
  }
  s.version = SAVE_VERSION;
  return s;
}

export function save(s) {
  try {
    s.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}

/** Loads the save (or a fresh game) and credits offline time. */
export function load(now = Date.now()) {
  let raw = null;
  try {
    const txt = localStorage.getItem(SAVE_KEY);
    if (txt) raw = JSON.parse(txt);
  } catch (e) {
    raw = null;
  }
  if (!raw) return { state: newState(now), report: null };
  const state = migrate(raw, now);
  const elapsed = (now - state.lastSeen) / 1000;
  let report = null;
  if (elapsed >= OFFLINE_MIN_S) report = offlineCatchUp(state, elapsed);
  state.lastSeen = now;
  return { state, report };
}

export function exportString(s) {
  return btoa(JSON.stringify(s));
}

/** Returns a clean state, or throws Error('Invalid save'). */
export function importString(str, now = Date.now()) {
  let raw;
  try {
    raw = JSON.parse(atob(String(str).trim()));
  } catch (e) {
    throw new Error('Invalid save');
  }
  validate(raw);
  const s = migrate(raw, now);
  s.lastSeen = now; // an imported file can never grant offline time
  return s;
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
