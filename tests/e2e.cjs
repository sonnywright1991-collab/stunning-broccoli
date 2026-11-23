// Browser end-to-end test: node tests/e2e.cjs   (uses the preinstalled Playwright + Chromium)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOT_DIR || path.join(ROOT, 'tests', 'shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let passed = 0;
const results = [];
function check(id, name, cond, detail) {
  results.push([id, name, !!cond]);
  if (!cond) { console.log('FAIL ' + id + ' ' + name + (detail !== undefined ? ' -> ' + detail : '')); process.exitCode = 1; }
  else { passed++; console.log('ok   ' + id + ' ' + name); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
  };

  // ---------- fresh game, desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(url);
  await page.waitForFunction(() => !!window.tinyColony);

  // R1: passive income with zero clicks
  const w0 = await page.evaluate(() => window.tinyColony.game.state.res.wood);
  await sleep(3200);
  const w1 = await page.evaluate(() => window.tinyColony.game.state.res.wood);
  check('R1', 'wood ticks up with no clicks (' + w0 + ' -> ' + w1.toFixed(2) + ')', w1 > w0 + 1);

  // R2: tiers hidden until gate bought
  check('R2a', 'stone/metal/energy tiles hidden at start', await page.evaluate(() =>
    ['stone', 'metal', 'energy'].every((k) => document.getElementById('res-' + k).hidden)));
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.res.wood = 1000; s.run.wood = 300; });
  await page.click('.tab[data-tab="upgrades"]');
  await page.waitForSelector('#upgradeList .card[data-id="u_map"]');
  await page.click('#upgradeList .card[data-id="u_map"] button');
  await sleep(250);
  check('R2b', 'buying Surveyor\'s Map reveals Stone', await page.evaluate(() => !document.getElementById('res-stone').hidden
    && document.getElementById('res-metal').hidden));
  await page.click('.tab[data-tab="buildings"]');

  // R3: costs through the real UI
  const cost = (id) => page.evaluate((i) => document.querySelector('#b-' + i + ' .cost').textContent, id);
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.res.wood = 1000; s.b.lumber = 0; s.buyMode = '1'; });
  await sleep(250);
  check('R3a', 'first Lumber Camp costs 10', (await cost('lumber')).startsWith('10 '), await cost('lumber'));
  await page.click('#b-lumber button');
  await sleep(250);
  check('R3b', 'second costs 11', (await cost('lumber')).startsWith('11 '), await cost('lumber'));
  await page.evaluate(() => { window.tinyColony.game.state.b.lumber = 10; });
  await sleep(250);
  check('R3c', 'with 10 owned the next costs 40', (await cost('lumber')).startsWith('40 '), await cost('lumber'));
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.b.lumber = 0; s.res.wood = 1000; });
  await page.click('.mode[data-mode="10"]');
  await sleep(250);
  check('R3d', 'Buy x10 from zero costs 203', (await cost('lumber')).startsWith('203 '), await cost('lumber'));
  await page.click('#b-lumber button');
  await sleep(250);
  const after10 = await page.evaluate(() => ({ n: window.tinyColony.game.state.b.lumber, w: window.tinyColony.game.state.res.wood }));
  check('R3e', 'x10 bought 10 camps for 203 wood (wood ~797 + passive income)', after10.n === 10 && after10.w > 796 && after10.w < 830, JSON.stringify(after10));
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.res.wood = 203; s.b.lumber = 0; });
  await page.click('.mode[data-mode="100"]');
  await page.click('.mode[data-mode="max"]');
  await sleep(250);
  check('R3f', 'Max with 203 wood shows x10', await page.evaluate(() => document.querySelector('#b-lumber .k').textContent) === 'x10');
  check('R3g', 'x100 and Max buttons exist', await page.evaluate(() => !!document.querySelector('.mode[data-mode="100"]') && !!document.querySelector('.mode[data-mode="max"]')));
  check('R3h', '8 building rows', await page.evaluate(() => document.querySelectorAll('#buildingList .card').length) === 8);

  // R4: workers on canvas
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.b.lumber = 25; s.buyMode = '1'; });
  await sleep(1500);
  const wk = await page.evaluate(() => ({ drawn: window.tinyColony.world.workers.length, expect: window.tinyColony.workerCount() }));
  check('R4', 'worker sprites == formula (' + wk.drawn + ')', wk.drawn === wk.expect && wk.drawn === 6, JSON.stringify(wk));
  const moved = await page.evaluate(async () => {
    const w = window.tinyColony.world.workers; const a = w.map((x) => x.x + x.y);
    await new Promise((r) => setTimeout(r, 1500));
    return w.some((x, i) => Math.abs(x.x + x.y - a[i]) > 1);
  });
  check('R4b', 'workers actually move', moved);
  const painted = await page.evaluate(() => {
    const c = document.getElementById('world'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let non = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 60 || d[i + 1] > 70) non++; return non;
  });
  check('R4c', 'canvas is painted', painted > 100, painted);

  // R5: upgrade changes rate
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.b.lumber = 10; s.res.wood = 5000; delete s.u.u_axes; });
  const r0 = await page.evaluate(() => window.tinyColony.rates().wood);
  await sleep(300);
  await page.click('.tab[data-tab="upgrades"]');
  await page.waitForSelector('#upgradeList .card[data-id="u_axes"]');
  await page.click('#upgradeList .card[data-id="u_axes"] button');
  const r1 = await page.evaluate(() => window.tinyColony.rates().wood);
  check('R5', 'Sharper Axes lifts wood rate ' + r0 + ' -> ' + r1, Math.abs(r1 - r0 - 2) < 1e-9);
  check('R5b', '15 upgrades defined', await page.evaluate(async () => (await import('./src/data.js')).UPGRADES.length) === 15);

  // R6: prestige through the UI
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.run.wood = 4e6; s.seeds = 0; });
  await page.click('.tab[data-tab="prestige"]');
  await sleep(300);
  check('R6a', 'prestige panel previews 6 seeds', await page.textContent('#pGain') === '6' && await page.textContent('#pAfter') === '+30%');
  await page.click('#relocate');
  await page.click('#modalButtons .btn.primary');
  await sleep(300);
  const pr = await page.evaluate(() => { const s = window.tinyColony.game.state; return { seeds: s.seeds, l: s.b.lumber, u: Object.keys(s.u).length, rate: window.tinyColony.rates().wood, run: s.run.wood }; });
  check('R6b', 'relocate: 6 seeds, buildings/upgrades reset, rate 0.65', pr.seeds === 6 && pr.l === 0 && pr.u === 0 && Math.abs(pr.rate - 0.65) < 1e-9 && pr.run < 50, JSON.stringify(pr));
  check('R6c', 'bonus text +30%', await page.textContent('#pBonus') === '+30%');

  // R8: persistence, export/import
  await page.evaluate(() => { const s = window.tinyColony.game.state; s.b.sawmill = 7; s.res.wood = 12345; window.tinyColony.save(); });
  await page.reload();
  await page.waitForFunction(() => !!window.tinyColony);
  const rl = await page.evaluate(() => { const s = window.tinyColony.game.state; return { saw: s.b.sawmill, seeds: s.seeds, wood: s.res.wood }; });
  check('R8a', 'reload restores state', rl.saw === 7 && rl.seeds === 6 && rl.wood >= 12345, JSON.stringify(rl));
  const hasModal = await page.evaluate(() => !document.getElementById('modal').hidden);
  check('R8b', 'no offline modal after a quick reload', !hasModal);
  await page.click('.tab[data-tab="settings"]');
  await page.click('#exportBtn');
  const exported = await page.inputValue('#saveText');
  check('R8c', 'export fills a base64 string', /^[A-Za-z0-9+/=]+$/.test(exported) && exported.length > 100);
  await page.fill('#saveText', 'garbage!!');
  await page.click('#importBtn');
  check('R8d', 'import of garbage rejected, state intact', (await page.textContent('#importMsg')).includes('Import failed') &&
    await page.evaluate(() => window.tinyColony.game.state.b.sawmill) === 7);
  await page.evaluate(() => { window.tinyColony.game.state.b.sawmill = 1; });
  await page.fill('#saveText', exported);
  await page.click('#importBtn');
  check('R8e', 'import of exported string restores sawmills=7', await page.evaluate(() => window.tinyColony.game.state.b.sawmill) === 7 &&
    (await page.textContent('#importMsg')).includes('successful'));
  const saveLabel = await page.textContent('#saveInfo');
  check('R8f', 'autosave status shown', /Last save \d+s ago/.test(saveLabel), saveLabel);

  // R10 desktop screenshot after a richer state
  await page.evaluate(() => {
    const s = window.tinyColony.game.state;
    Object.assign(s.u, { u_map: true, u_ore: true, u_grid: true });
    Object.assign(s.b, { lumber: 30, sawmill: 18, quarry: 12, mason: 9, mine: 6, foundry: 3, solar: 2 });
    s.res.wood = 5e5; s.res.stone = 12000; s.res.metal = 8e4; s.res.energy = 1500;
  });
  await page.click('.tab[data-tab="buildings"]');
  await sleep(1500);
  await page.screenshot({ path: path.join(SHOTS, 'desktop-1280.png') });
  check('R10a', 'no horizontal page scroll at 1280', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  // R11: hard reset needs confirm
  await page.click('.tab[data-tab="settings"]');
  await page.click('#hardReset');
  check('R11a', 'hard reset opens a confirm modal', await page.evaluate(() => !document.getElementById('modal').hidden));
  await page.click('#modalButtons .btn:not(.primary)'); // Cancel
  check('R11b', 'cancel keeps progress', await page.evaluate(() => window.tinyColony.game.state.b.lumber) === 30);
  await page.click('#hardReset');
  await page.click('#modalButtons .btn.primary');
  await sleep(200);
  const rs = await page.evaluate(() => { const s = window.tinyColony.game.state; return { l: s.b.lumber, seeds: s.seeds, wood: s.res.wood }; });
  check('R11c', 'confirm wipes everything incl. seeds', rs.l === 0 && rs.seeds === 0 && rs.wood < 20, JSON.stringify(rs));
  // migration: an old/partial save loads with defaults filled in
  await page.evaluate(() => localStorage.setItem('tinycolony.save', JSON.stringify({ version: 1, res: { wood: 77 }, b: { sawmill: 2 } })));
  const migrated = await page.evaluate(async () => {
    const st = await import('./src/state.js');
    const s = st.load().state;
    return { wood: s.res.wood, stone: s.res.stone, saw: s.b.sawmill, fusion: s.b.fusion, v: s.version, hasStats: !!s.stats };
  });
  check('R11d', 'partial save migrates with defaults', migrated.wood === 77 && migrated.stone === 0 && migrated.saw === 2 && migrated.fusion === 0 && migrated.v === 1 && migrated.hasStats, JSON.stringify(migrated));
  await ctx.close();

  // ---------- R7: offline progress via a seeded save (pagehide would overwrite lastSeen on reload) ----------
  const seed = {
    version: 1, res: { wood: 100, stone: 0, metal: 0, energy: 0 }, run: { wood: 100, stone: 0, metal: 0, energy: 0 },
    total: { wood: 100, stone: 0, metal: 0, energy: 0 }, b: { lumber: 100 }, u: {}, seeds: 0, autoT: 0,
    lastSeen: Date.now() - 2 * 3600 * 1000, buyMode: '1', stats: { clicks: 0, prestiges: 0, created: 0 },
  };
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx2.addInitScript((s) => { if (!localStorage.getItem('tinycolony.save')) localStorage.setItem('tinycolony.save', JSON.stringify(s)); }, seed);
  const p2 = await ctx2.newPage(); watch(p2);
  const t0 = Date.now();
  await p2.goto(url);
  await p2.waitForFunction(() => !!window.tinyColony);
  const loadMs = Date.now() - t0;
  const rep = await p2.evaluate(() => window.__lastOffline);
  const expected = 20.5 * 7200 * 0.5; // (0.5 + 100*0.2) wood/s * 2h * 50%
  check('R7a', 'offline report ~' + Math.round(expected) + ' wood (got ' + Math.round(rep.gains.wood) + ')', Math.abs(rep.gains.wood - expected) < expected * 0.01);
  check('R7b', 'welcome-back modal visible with text', await p2.evaluate(() => !document.getElementById('modal').hidden
    && /While you were away/.test(document.getElementById('modalTitle').textContent)
    && /2h 0m/.test(document.getElementById('modalBody').textContent)
    && /73\.8K Wood/.test(document.getElementById('modalBody').textContent)), await p2.textContent('#modalBody'));
  await p2.screenshot({ path: path.join(SHOTS, 'offline-modal.png') });
  await p2.click('#modalButtons .btn.primary');
  check('R7c', 'modal closes on Collect', await p2.evaluate(() => document.getElementById('modal').hidden));
  check('R7d', 'load incl. catch-up fast (' + loadMs + ' ms incl. browser nav)', loadMs < 3000);
  await ctx2.close();

  // 30h away is capped at 8h
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx3.addInitScript((s) => { localStorage.setItem('tinycolony.save', JSON.stringify(s)); }, { ...seed, lastSeen: Date.now() - 30 * 3600 * 1000 });
  const p3 = await ctx3.newPage(); watch(p3);
  await p3.goto(url);
  await p3.waitForFunction(() => !!window.tinyColony);
  const rep3 = await p3.evaluate(() => window.__lastOffline);
  check('R7e', '30h away credited as 8h (capped)', rep3.capped && rep3.seconds === 28800 && /cap/.test(await p3.textContent('#modalBody')));
  await ctx3.close();

  // ---------- R10: mobile ----------
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p4 = await ctx4.newPage(); watch(p4);
  await p4.goto(url);
  await p4.waitForFunction(() => !!window.tinyColony);
  await p4.evaluate(() => {
    const s = window.tinyColony.game.state;
    Object.assign(s.u, { u_map: true, u_ore: true });
    Object.assign(s.b, { lumber: 20, sawmill: 8, quarry: 5, mason: 2 });
    s.res.wood = 3200; s.res.stone = 800;
  });
  await sleep(1500);
  await p4.screenshot({ path: path.join(SHOTS, 'mobile-390.png'), fullPage: true });
  check('R10b', 'no horizontal scroll at 390px', await p4.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    await p4.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  check('R10c', 'single column on mobile (canvas wider than half the page)', await p4.evaluate(() => document.getElementById('world').getBoundingClientRect().width > 300));
  await ctx4.close();

  check('R10d', 'zero console/page errors', errors.length === 0, errors.join(' | '));
  check('R12', 'README exists with balance table', fs.existsSync(path.join(ROOT, 'README.md')) && /Lumber Camp/.test(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')));

  await browser.close();
  server.close();
  const failed = results.filter((r) => !r[2]);
  console.log('\n' + passed + ' / ' + results.length + ' e2e checks passed' + (failed.length ? ' - FAILED: ' + failed.map((f) => f[0]).join(', ') : ''));
})().catch((e) => { console.error(e); process.exit(1); });
