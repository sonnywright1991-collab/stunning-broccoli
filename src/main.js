// Entry point: load, wire loops, autosave.
import { load, save } from './state.js';
import { step, offlineCatchUp, rates, buyBuilding, workerCount } from './sim.js';
import { OFFLINE_MIN_S } from './data.js';
import { createWorld } from './render.js';
import { createUI } from './ui.js';

const { state, report } = load();
const game = { state };
const world = createWorld(document.getElementById('world'));
const ui = createUI(game);

ui.update();
if (report) { ui.showOffline(report); window.__lastOffline = report; }

// Simulation: always advance by real elapsed time, never by "number of ticks",
// because background tabs throttle timers.
let last = Date.now();
function tick() {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  if (dt <= 0) return; // clock moved backwards: ignore
  if (dt > 5) {
    // device slept / tab frozen: treat like time away
    const rep = offlineCatchUp(game.state, dt);
    if (rep && dt >= OFFLINE_MIN_S) { ui.showOffline(rep); window.__lastOffline = rep; }
  } else {
    let rem = dt;
    while (rem > 0) { const d = Math.min(rem, 0.1); step(game.state, d); rem -= d; }
  }
  ui.update();
}
setInterval(tick, 100);

// Rendering: capped at ~30 fps.
let lastFrame = 0;
function frame(t) {
  if (t - lastFrame >= 33) {
    world.update((t - lastFrame) / 1000, game.state);
    world.draw(game.state);
    lastFrame = t;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Saving: timer + whenever the page is hidden or closed.
function doSave() { if (save(game.state)) ui.setLastSave(Date.now()); }
setInterval(doSave, 10000);
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
window.addEventListener('pagehide', doSave);

// Small hook for automated tests and debugging.
window.tinyColony = {
  game, world, ui,
  rates: () => rates(game.state),
  save: doSave,
  buy: (id, k) => buyBuilding(game.state, id, k),
  workerCount: () => workerCount(game.state),
  tick,
};
