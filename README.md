# Tiny Colony

An idle colony sim that runs in the browser. Workers gather wood, stone, metal and energy on their own; you spend what they bring on buildings and upgrades, and the colony keeps working, even while the tab is closed.

No build step, no dependencies. Plain HTML, CSS and ES modules.

## Run it

```bash
python3 -m http.server 8000     # any static server works (ES modules need http://, not file://)
# open http://localhost:8000
```

## Tests

```bash
node tests/unit.mjs      # 14 pure-logic tests (costs, max-buy, prestige, offline, saves, formatting)
node tests/e2e.cjs       # real-browser run with Playwright/Chromium; writes screenshots to tests/shots/
```

## How to play

1. Wood trickles in by itself (0.5/s). Click **Gather wood** for a quick boost, then buy **Lumber Camps**.
2. Buy upgrades when they appear. **Surveyor's Map**, **Ore Prospecting** and **Power Grid** open Stone, Metal and Energy in turn.
3. Switch buy mode (x1 / x10 / x100 / Max) to buy in bulk.
4. At 1M wood in one run, **Relocate** resets the colony for permanent seeds (+5% production each).
5. Leave the game. Up to 8 hours of progress is credited when you return (50% efficiency, 75% with **Night Shift**).

## Balance

Cost of the next building with `n` owned: `floor(base * 1.15^n)`. Buying `k` at once: `base * 1.15^n * (1.15^k - 1) / 0.15`. Max-buy solves for `k` with a logarithm instead of looping.

Lumber Camp (base 10): n=0 -> 10, n=1 -> 11, n=10 -> 40, n=25 -> 329, n=50 -> 10,836. Ten at once from zero cost 203 (not 100).

| Building | Produces | Cost (base) | Output / s each |
|---|---|---|---|
| Lumber Camp | Wood | 10 wood | 0.2 |
| Sawmill | Wood | 120 wood | 1.6 |
| Quarry | Stone | 500 wood | 2 |
| Stone Mason | Stone | 4K stone | 16 |
| Mine | Metal | 12K stone | 10 |
| Foundry | Metal | 120K metal | 90 |
| Solar Array | Energy | 500K metal | 55 |
| Fusion Core | Energy | 6M energy | 700 |

15 upgrades: eight x2 building multipliers (unlocked at 5-10 owned), three tier gates, Teamwork (x1.5 all), Worker Boots (+10%, faster walking), Foreman (auto-buys the cheapest affordable building every 5s) and Night Shift (offline 50% -> 75%).

Prestige: `seeds = floor(sqrt(wood this run / 100,000))`. Example: 4M wood -> 6 seeds -> +30% production.

A greedy bot (always buys the best payback) reaches Stone in ~8 min, Metal in ~17 min, Energy in ~43 min and 1M wood in ~95 min, with a new purchase every 12-26 s early on.

## Design notes and pitfalls handled

- **Real time, not ticks.** The sim advances by `Date.now()` deltas, so throttled background tabs do not stall progress. The same `step()` powers live play and offline catch-up.
- **Offline abuse.** Credit is capped at 8h, negative gaps are ignored, a save with a future timestamp is clamped, and imported saves never grant offline time.
- **Float traps.** Bulk cost uses an epsilon so `floor()` never lands one below an exact integer; values are capped at 1e300; display switches to scientific at 1e15.
- **Saving.** Every 10s, on tab hide and on page close. Loading repairs `NaN`/negative values, drops unknown keys and fills missing fields (`version` field for future migrations).
- **Performance.** DOM text is written only when it changes; canvas renders at ~30 fps; workers are capped at 40.

## Files

`index.html`, `style.css`, `src/data.js` (balance), `src/sim.js` (logic), `src/state.js` (saves), `src/format.js`, `src/render.js` (canvas), `src/ui.js` (DOM), `src/main.js` (loops), `tests/`.
