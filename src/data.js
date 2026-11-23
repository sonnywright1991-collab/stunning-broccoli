// Static game data and balance constants. Pure data, no DOM.
export const GROWTH = 1.15;            // cost multiplier per building owned
export const OFFLINE_CAP_S = 8 * 3600; // max offline time credited
export const OFFLINE_MIN_S = 60;       // show the "welcome back" modal above this
export const OFFLINE_EFF = 0.5;        // base offline efficiency
export const OFFLINE_EFF_UPGRADED = 0.75;
export const AUTO_INTERVAL = 5;        // seconds between auto-buys (Foreman)
export const SEED_BONUS = 0.05;        // +5% production per seed
export const PRESTIGE_UNLOCK = 1e6;    // run wood needed to relocate
export const PRESTIGE_DIVISOR = 1e5;   // seeds = floor(sqrt(runWood / this))
export const BASE_INCOME = 0.5;        // wood/s from the settlers themselves
export const START_WOOD = 10;
export const MAX_VALUE = 1e300;
export const MAX_WORKERS = 40;
export const SAVE_KEY = 'tinycolony.save';
export const SAVE_VERSION = 1;

export const RES = ['wood', 'stone', 'metal', 'energy'];

export const RES_INFO = {
  wood:   { name: 'Wood',   color: '#7bc86c' },
  stone:  { name: 'Stone',  color: '#aab4c0' },
  metal:  { name: 'Metal',  color: '#e0894a' },
  energy: { name: 'Energy', color: '#f2d24b' },
};

// Tier gates: wood is always open; the others open with a gate upgrade.
export const TIER_GATE = { stone: 'u_map', metal: 'u_ore', energy: 'u_grid' };

// res = what it produces, costRes = what it costs. Output is per second per building.
export const BUILDINGS = [
  { id: 'lumber',  name: 'Lumber Camp', res: 'wood',   out: 0.2, costRes: 'wood',   base: 10,      color: '#6b8e23' },
  { id: 'sawmill', name: 'Sawmill',     res: 'wood',   out: 1.6, costRes: 'wood',   base: 120,     color: '#a0713d' },
  { id: 'quarry',  name: 'Quarry',      res: 'stone',  out: 2,   costRes: 'wood',   base: 500,     color: '#8d99a6' },
  { id: 'mason',   name: 'Stone Mason', res: 'stone',  out: 16,  costRes: 'stone',  base: 4000,    color: '#c7ced6' },
  { id: 'mine',    name: 'Mine',        res: 'metal',  out: 10,  costRes: 'stone',  base: 12000,   color: '#b0652d' },
  { id: 'foundry', name: 'Foundry',     res: 'metal',  out: 90,  costRes: 'metal',  base: 120000,  color: '#e0894a' },
  { id: 'solar',   name: 'Solar Array', res: 'energy', out: 55,  costRes: 'metal',  base: 500000,  color: '#4aa3e0' },
  { id: 'fusion',  name: 'Fusion Core', res: 'energy', out: 700, costRes: 'energy', base: 6000000, color: '#f2d24b' },
];

const total = (s) => Object.values(s.b).reduce((a, b) => a + b, 0);

// kind: bmult (x mult on one building) | gate (opens a tier) | global (prod only)
//       | speed (walk speed + prod) | auto (Foreman) | offline
export const UPGRADES = [
  { id: 'u_axes',    name: 'Sharper Axes',     desc: 'Lumber Camps produce x2.',                kind: 'bmult', building: 'lumber',  mult: 2, cost: { res: 'wood',   amt: 100 },     req: (s) => s.b.lumber >= 10,  reqText: 'Own 10 Lumber Camps' },
  { id: 'u_saws',    name: 'Sturdy Saws',      desc: 'Sawmills produce x2.',                    kind: 'bmult', building: 'sawmill', mult: 2, cost: { res: 'wood',   amt: 1500 },    req: (s) => s.b.sawmill >= 5,  reqText: 'Own 5 Sawmills' },
  { id: 'u_map',     name: "Surveyor's Map",   desc: 'Unlocks Stone and the Quarry.',           kind: 'gate',  tier: 'stone',                cost: { res: 'wood',   amt: 300 },     req: (s) => s.run.wood >= 250, reqText: 'Gather 250 wood' },
  { id: 'u_picks',   name: 'Iron Picks',       desc: 'Quarries produce x2.',                    kind: 'bmult', building: 'quarry',  mult: 2, cost: { res: 'wood',   amt: 6000 },    req: (s) => s.b.quarry >= 10,  reqText: 'Own 10 Quarries' },
  { id: 'u_chisel',  name: 'Fine Chisels',     desc: 'Stone Masons produce x2.',                kind: 'bmult', building: 'mason',   mult: 2, cost: { res: 'stone',  amt: 50000 },   req: (s) => s.b.mason >= 10,   reqText: 'Own 10 Stone Masons' },
  { id: 'u_ore',     name: 'Ore Prospecting',  desc: 'Unlocks Metal and the Mine.',             kind: 'gate',  tier: 'metal',                cost: { res: 'stone',  amt: 3000 },    req: (s) => s.run.stone >= 2000, reqText: 'Gather 2K stone' },
  { id: 'u_shafts',  name: 'Deep Shafts',      desc: 'Mines produce x2.',                       kind: 'bmult', building: 'mine',    mult: 2, cost: { res: 'stone',  amt: 200000 },  req: (s) => s.b.mine >= 10,    reqText: 'Own 10 Mines' },
  { id: 'u_furnace', name: 'Blast Furnace',    desc: 'Foundries produce x2.',                   kind: 'bmult', building: 'foundry', mult: 2, cost: { res: 'metal',  amt: 1500000 }, req: (s) => s.b.foundry >= 10, reqText: 'Own 10 Foundries' },
  { id: 'u_grid',    name: 'Power Grid',       desc: 'Unlocks Energy and the Solar Array.',     kind: 'gate',  tier: 'energy',               cost: { res: 'metal',  amt: 60000 },   req: (s) => s.run.metal >= 40000, reqText: 'Gather 40K metal' },
  { id: 'u_panels',  name: 'Panel Coating',    desc: 'Solar Arrays produce x2.',                kind: 'bmult', building: 'solar',   mult: 2, cost: { res: 'metal',  amt: 6000000 }, req: (s) => s.b.solar >= 10,   reqText: 'Own 10 Solar Arrays' },
  { id: 'u_core',    name: 'Containment Field', desc: 'Fusion Cores produce x2.',               kind: 'bmult', building: 'fusion',  mult: 2, cost: { res: 'energy', amt: 70000000 }, req: (s) => s.b.fusion >= 10, reqText: 'Own 10 Fusion Cores' },
  { id: 'u_team',    name: 'Teamwork',         desc: 'All production x1.5.',                    kind: 'global', prod: 1.5,                   cost: { res: 'wood',   amt: 2500 },    req: (s) => total(s) >= 25,    reqText: 'Own 25 buildings' },
  { id: 'u_boots',   name: 'Worker Boots',     desc: 'Workers walk 25% faster; production +10%.', kind: 'speed', walk: 1.25, prod: 1.1,        cost: { res: 'wood',   amt: 800 },     req: (s) => total(s) >= 4,     reqText: 'Own 4 buildings' },
  { id: 'u_foreman', name: 'Foreman',          desc: 'Automatically buys the cheapest affordable building every 5s.', kind: 'auto',      cost: { res: 'wood',   amt: 20000 },   req: (s) => total(s) >= 40,    reqText: 'Own 40 buildings' },
  { id: 'u_offline', name: 'Night Shift',      desc: 'Offline efficiency rises from 50% to 75%.', kind: 'offline',                         cost: { res: 'stone',  amt: 10000 },   req: (s) => !!s.u.u_map,       reqText: "Buy Surveyor's Map" },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
