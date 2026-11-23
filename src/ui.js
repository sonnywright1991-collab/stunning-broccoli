// DOM layer. Built once; update() only writes text/attributes that actually changed.
import {
  BUILDINGS, UPGRADES, RES, RES_INFO, SEED_BONUS, PRESTIGE_UNLOCK, OFFLINE_CAP_S,
} from './data.js';
import { fmt, fmtTime } from './format.js';
import {
  rates, tierUnlocked, bulkCost, maxAffordable, buyBuilding, buyUpgrade, gather, seedsFor,
  prestigeReady, doPrestige, workerCount, totalBuildings, buildingRate, canAffordUpgrade,
  clickValue, offlineEff,
} from './sim.js';
import { save, exportString, importString, newState, wipeSave } from './state.js';

const $ = (id) => document.getElementById(id);

function setText(el, txt) {
  if (el._t !== txt) { el.textContent = txt; el._t = txt; }
}
function setDisabled(el, v) {
  if (el._d !== v) { el.disabled = v; el._d = v; }
}
function setClass(el, cls, on) {
  if (el._c !== undefined && el._c[cls] === on) return;
  el._c = Object.assign(el._c || {}, { [cls]: on });
  el.classList.toggle(cls, on);
}
function setHidden(el, v) {
  if (el._h !== v) { el.hidden = v; el._h = v; }
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createUI(game) {
  const tiles = {};
  const rows = {};
  let upKey = '';
  let upRefs = [];
  let lastSave = Date.now();

  // ---- resource bar ----
  for (const k of RES) {
    const t = el('div', 'res');
    t.id = 'res-' + k;
    const name = el('div', 'name');
    const dot = el('span', 'dot');
    dot.style.background = RES_INFO[k].color;
    name.append(dot, document.createTextNode(RES_INFO[k].name));
    const val = el('div', 'val', '0'); val.className = 'val';
    const rate = el('div', 'rate', '+0/s');
    t.append(name, val, rate);
    $('resbar').append(t);
    tiles[k] = { t, val, rate };
  }

  // ---- buy mode buttons ----
  const modeBtns = {};
  for (const m of ['1', '10', '100', 'max']) {
    const b = el('button', 'mode', m === 'max' ? 'Max' : 'x' + m);
    b.type = 'button';
    b.dataset.mode = m;
    b.addEventListener('click', () => { game.state.buyMode = m; update(); });
    $('modes').append(b);
    modeBtns[m] = b;
  }

  // ---- building rows ----
  for (const b of BUILDINGS) {
    const card = el('div', 'card');
    card.id = 'b-' + b.id;
    const title = el('div', 'title', b.name);
    const owned = el('span', 'owned', '0');
    title.append(owned);
    const desc = el('div', 'desc');
    const btn = el('button', 'btn');
    btn.type = 'button';
    btn.append(document.createTextNode('Buy '));
    const kLbl = el('span', 'k');
    const cost = el('span', 'cost');
    btn.append(kLbl, el('br'), cost);
    btn.addEventListener('click', () => {
      const q = quote(b);
      if (buyBuilding(game.state, b.id, q.k)) update();
    });
    card.append(title, btn, desc);
    $('buildingList').append(card);
    rows[b.id] = { card, owned, desc, btn, kLbl, cost };
  }

  function quote(b) {
    const s = game.state;
    const n = s.b[b.id];
    const budget = s.res[b.costRes];
    let k;
    if (s.buyMode === 'max') k = Math.max(1, maxAffordable(b, n, budget));
    else k = Number(s.buyMode);
    const cost = bulkCost(b, n, k);
    return { k, cost, ok: budget >= cost };
  }

  // ---- tabs ----
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.id !== 'pane-' + t.dataset.tab; });
    });
  });

  // ---- gather button ----
  $('gather').addEventListener('click', () => { gather(game.state); update(); });

  // ---- modal ----
  function showModal(title, bodyNodes, buttons) {
    $('modalTitle').textContent = title;
    const body = $('modalBody');
    body.replaceChildren(...bodyNodes);
    const bar = $('modalButtons');
    bar.replaceChildren();
    for (const b of buttons) {
      const btn = el('button', 'btn' + (b.primary ? ' primary' : ''), b.label);
      btn.type = 'button';
      btn.addEventListener('click', () => { closeModal(); if (b.onClick) b.onClick(); });
      bar.append(btn);
    }
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }

  function showOffline(rep) {
    if (!rep) return;
    const intro = el('p', null,
      'You were away ' + fmtTime(rep.rawSeconds) +
      (rep.capped ? ' (credited up to the ' + fmtTime(OFFLINE_CAP_S) + ' cap)' : '') +
      '. Your colony kept working at ' + Math.round(rep.eff * 100) + '% efficiency:');
    const ul = el('ul');
    for (const k of RES) if (rep.gains[k] > 0) ul.append(el('li', null, '+' + fmt(rep.gains[k]) + ' ' + RES_INFO[k].name));
    showModal('While you were away', [intro, ul], [{ label: 'Collect', primary: true }]);
  }

  function confirmModal(title, text, label, onYes) {
    showModal(title, [el('p', null, text)], [
      { label: 'Cancel' },
      { label, primary: true, onClick: onYes },
    ]);
  }

  // ---- prestige ----
  $('relocate').addEventListener('click', () => {
    const s = game.state;
    if (!prestigeReady(s)) return;
    const gain = seedsFor(s.run.wood);
    confirmModal('Relocate?', 'You will gain ' + gain + ' seeds (+' + Math.round(gain * SEED_BONUS * 100) +
      '% production) and restart with nothing else.', 'Relocate', () => {
      doPrestige(s);
      save(s);
      update();
    });
  });

  // ---- settings ----
  $('saveNow').addEventListener('click', () => { save(game.state); lastSave = Date.now(); update(); });
  $('exportBtn').addEventListener('click', () => {
    const str = exportString(game.state);
    $('saveText').value = str;
    $('importMsg').textContent = 'Save string ready: copy it somewhere safe.';
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(str).catch(() => {});
  });
  $('importBtn').addEventListener('click', () => {
    try {
      game.state = importString($('saveText').value);
      save(game.state);
      $('importMsg').textContent = 'Import successful.';
      update();
    } catch (e) {
      $('importMsg').textContent = 'Import failed: ' + e.message + '.';
    }
  });
  $('hardReset').addEventListener('click', () => {
    confirmModal('Hard reset?', 'This permanently deletes ALL progress, including seeds. This cannot be undone.',
      'Delete everything', () => {
        wipeSave();
        game.state = newState();
        save(game.state);
        update();
      });
  });

  // ---- upgrades list ----
  function rebuildUpgrades() {
    const s = game.state;
    const list = $('upgradeList');
    list.replaceChildren();
    upRefs = [];
    const visible = UPGRADES.filter((u) => !s.u[u.id] && u.req(s));
    for (const u of visible) {
      const card = el('div', 'card');
      card.dataset.id = u.id;
      card.append(el('div', 'title', u.name));
      const btn = el('button', 'btn');
      btn.type = 'button';
      btn.append(document.createTextNode('Buy '), el('br'));
      const cost = el('span', 'cost', fmt(u.cost.amt) + ' ' + RES_INFO[u.cost.res].name);
      btn.append(cost);
      btn.addEventListener('click', () => { if (buyUpgrade(game.state, u.id)) update(); });
      card.append(btn, el('div', 'desc', u.desc));
      list.append(card);
      upRefs.push({ u, btn, cost });
    }
    if (!visible.length) list.append(el('p', 'muted', 'No upgrades available yet. Keep building!'));
  }

  function update() {
    const s = game.state;
    const r = rates(s);
    for (const k of RES) {
      const open = tierUnlocked(s, k);
      setHidden(tiles[k].t, !open);
      setText(tiles[k].val, fmt(s.res[k]));
      setText(tiles[k].rate, '+' + fmt(r[k]) + '/s');
    }
    for (const m of Object.keys(modeBtns)) setClass(modeBtns[m], 'active', s.buyMode === m);
    for (const b of BUILDINGS) {
      const row = rows[b.id];
      setHidden(row.card, !tierUnlocked(s, b.res));
      const q = quote(b);
      setText(row.owned, 'x' + s.b[b.id]);
      setText(row.kLbl, q.k > 1 ? 'x' + q.k : '');
      setText(row.cost, fmt(q.cost) + ' ' + RES_INFO[b.costRes].name);
      setClass(row.cost, 'ok', q.ok);
      setClass(row.cost, 'no', !q.ok);
      setDisabled(row.btn, !q.ok);
      row.cost.dataset.cost = String(q.cost);
      setText(row.desc, '+' + fmt(b.out) + ' ' + RES_INFO[b.res].name + '/s each' +
        (s.b[b.id] ? ' | total +' + fmt(buildingRate(s, b.id)) + '/s' : ''));
    }

    const key = UPGRADES.filter((u) => !s.u[u.id] && u.req(s)).map((u) => u.id).join(',') + '|' + Object.keys(s.u).length;
    if (key !== upKey) { upKey = key; rebuildUpgrades(); }
    for (const ref of upRefs) {
      const ok = canAffordUpgrade(s, ref.u);
      setDisabled(ref.btn, !ok);
      setClass(ref.cost, 'ok', ok);
      setClass(ref.cost, 'no', !ok);
    }
    setText($('upgradeOwned'), 'Owned: ' + Object.keys(s.u).length + ' / ' + UPGRADES.length +
      (Object.keys(s.u).length ? ' (' + UPGRADES.filter((u) => s.u[u.id]).map((u) => u.name).join(', ') + ')' : ''));

    const mult = 1 + SEED_BONUS * s.seeds;
    const gain = prestigeReady(s) ? seedsFor(s.run.wood) : 0;
    setText($('pRun'), fmt(s.run.wood) + ' / ' + fmt(PRESTIGE_UNLOCK));
    setText($('pSeeds'), String(s.seeds));
    setText($('pBonus'), '+' + Math.round((mult - 1) * 100) + '%');
    setText($('pGain'), String(gain));
    setText($('pAfter'), '+' + Math.round((s.seeds + gain) * SEED_BONUS * 100) + '%');
    setText($('pCount'), String(s.stats.prestiges));
    setDisabled($('relocate'), !prestigeReady(s));

    setText($('gather'), 'Gather wood (+' + fmt(clickValue(s)) + ')');
    setText($('colonyInfo'), 'Workers: ' + workerCount(s) + ' | Buildings: ' + totalBuildings(s) +
      ' | Offline efficiency: ' + Math.round(offlineEff(s) * 100) + '%');
    const ago = Math.max(0, Math.floor((Date.now() - lastSave) / 1000));
    setText($('saveInfo'), 'Autosaves every 10 seconds and when you leave the tab. Last save ' + ago + 's ago.');
  }

  return { update, showOffline, setLastSave: (t) => { lastSave = t; } };
}
