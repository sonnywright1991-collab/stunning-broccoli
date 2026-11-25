const a = require('./app.js'), assert = require('assert');
// Known full moon: 2000-01-21 04:40 UTC
let m = a.moonInfo(new Date(Date.UTC(2000, 0, 21, 4, 40)));
assert(m.illum > 0.99 && m.name === 'Full Moon', JSON.stringify(m));
m = a.moonInfo(new Date(Date.UTC(2000, 0, 6, 18, 14)));
assert(m.illum < 0.01 && m.name === 'New Moon');
// Sunday 06:30 = hour of the Sun; Sunday 07:30 = Venus
assert.strictEqual(a.planetaryHour(new Date(2026, 10, 22, 6, 30)).hour, 'Sun');
assert.strictEqual(a.planetaryHour(new Date(2026, 10, 22, 7, 30)).hour, 'Venus');
// Before 06:00 belongs to previous day's ruler (Sat 2026-11-21 → Saturn), hour 19 of it
const p = a.planetaryHour(new Date(2026, 10, 22, 2, 0));
assert.strictEqual(p.day, 'Saturn');
// Daily card deterministic and in range
const c = a.dailyCard('2026-11-25');
assert.deepStrictEqual(c, a.dailyCard('2026-11-25'));
assert(c.idx >= 0 && c.idx < 22);
// Sigil
assert.deepStrictEqual(a.sigilLetters('I walk with courage'), ['W','L','K','T','H','C','R','G']);
assert.strictEqual(a.sigilPoints('', 100).length, 0);
console.log('all tests passed');
