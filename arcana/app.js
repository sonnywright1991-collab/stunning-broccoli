'use strict';

/* ---------- data ---------- */
const MAJORS = [
  ['The Fool','☆','new beginnings, leaps of faith','recklessness, hesitation at the edge'],
  ['The Magician','☿','will made manifest, skill','manipulation, untapped talent'],
  ['The High Priestess','☾','intuition, hidden knowledge','secrets withheld, ignoring your inner voice'],
  ['The Empress','♀','abundance, nurture, creation','smothering, creative block'],
  ['The Emperor','♈','structure, authority, stability','rigidity, domination'],
  ['The Hierophant','♉','tradition, teaching, ritual','dogma, breaking convention'],
  ['The Lovers','♊','union, alignment of values, choice','imbalance, a choice avoided'],
  ['The Chariot','♋','drive, victory through discipline','loss of direction, aggression'],
  ['Strength','♌','courage, gentle mastery','self-doubt, raw impulse'],
  ['The Hermit','♍','solitude, inner light, search','isolation, refusing guidance'],
  ['Wheel of Fortune','☸','cycles, turning points, fate','resisting change, bad timing'],
  ['Justice','♎','truth, balance, consequence','bias, evasion of accountability'],
  ['The Hanged Man','♓','surrender, a new perspective','stalling, needless sacrifice'],
  ['Death','☠','endings, transformation, release','clinging to what is finished'],
  ['Temperance','♐','moderation, blending, patience','excess, discord'],
  ['The Devil','♑','attachment, shadow, appetite','breaking chains, reclaiming power'],
  ['The Tower','⚡','sudden upheaval, revelation','averted disaster, fear of change'],
  ['The Star','✦','hope, renewal, calm guidance','despair, lost faith'],
  ['The Moon','☽','illusion, dreams, the unconscious','clearing fog, facing fear'],
  ['The Sun','☉','joy, vitality, clarity','temporary gloom, dimmed optimism'],
  ['Judgement','♆','reckoning, calling, rebirth','self-doubt, ignoring the call'],
  ['The World','◎','completion, wholeness, integration','loose ends, delayed closure']
];
const PLANETS = {
  Saturn:['♄','discipline, boundaries, banishing'],
  Jupiter:['♃','expansion, luck, wealth'],
  Mars:['♂','courage, conflict, drive'],
  Sun:['☉','vitality, success, clarity'],
  Venus:['♀','love, art, harmony'],
  Mercury:['☿','communication, study, travel'],
  Moon:['☽','dreams, intuition, cycles']
};
const CHALDEAN = ['Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon'];
const DAY_RULER = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']; // Sunday..Saturday
const PHASES = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

/* ---------- pure helpers (exported for tests) ---------- */
function moonInfo(date) {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const p = age / SYNODIC;
  return {
    age, p,
    illum: (1 - Math.cos(2 * Math.PI * p)) / 2,
    name: PHASES[Math.floor(p * 8 + 0.5) % 8]
  };
}

function planetaryHour(date) {
  // Simplified: day hours run 06:00-18:00, night hours 18:00-06:00, 60 min each.
  let h = date.getHours(), dow = date.getDay();
  let n = h - 6;
  if (h < 6) { n = h + 18; dow = (dow + 6) % 7; }
  const start = CHALDEAN.indexOf(DAY_RULER[dow]);
  return { day: DAY_RULER[dow], hour: CHALDEAN[(start + n) % 7], n: n + 1 };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dailyCard(key) {
  const h = hashStr('arcana:' + key);
  return { idx: h % MAJORS.length, reversed: ((h >>> 8) % 100) < 30 };
}

// Spare-style sigil: drop vowels and repeated letters, plot the rest on a ring.
function sigilLetters(text) {
  const seen = new Set(), out = [];
  for (const ch of text.toUpperCase().replace(/[^A-Z]/g, '')) {
    if ('AEIOU'.includes(ch) || seen.has(ch)) continue;
    seen.add(ch); out.push(ch);
  }
  return out;
}

function sigilPoints(text, size) {
  const c = size / 2, r = size * 0.38;
  return sigilLetters(text).map(ch => {
    const a = (ch.charCodeAt(0) - 65) / 26 * Math.PI * 2 - Math.PI / 2;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  });
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

if (typeof module !== 'undefined') {
  module.exports = { moonInfo, planetaryHour, dailyCard, sigilLetters, sigilPoints, hashStr, MAJORS };
}

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('arcana.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arcana.' + k, JSON.stringify(v)); } catch {} }
};

/* ---------- UI (browser only) ---------- */
if (typeof document !== 'undefined') {
  const view = document.getElementById('view');
  const tabs = document.querySelectorAll('#tabs button');
  let tab = 'today';
  let sigilText = '';

  function moonSvg(m) {
    const r = 30, c = 32, k = Math.cos(2 * Math.PI * m.p), rx = Math.abs(k) * r;
    const waxing = m.p < 0.5;
    const sweep = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
    const outer = waxing ? 1 : 0;
    const d = `M${c} ${c - r} A${r} ${r} 0 0 ${outer} ${c} ${c + r} A${rx} ${r} 0 0 ${sweep} ${c} ${c - r}Z`;
    return `<svg class="moon" viewBox="0 0 64 64" role="img" aria-label="${esc(m.name)}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="#1d1630" stroke="#2c2147"/><path d="${d}" fill="#e9e4f5"/></svg>`;
  }

  function cardHtml(card, revealed) {
    if (!revealed) return `<div class="tarot back" id="cardback" role="button" tabindex="0" aria-label="Reveal today's card">✦</div>`;
    const [name, glyph] = MAJORS[card.idx];
    return `<div class="tarot ${card.reversed ? 'rev' : ''}"><div class="num">${card.idx}</div>
      <div class="glyph">${glyph}</div><div class="name">${esc(name)}</div></div>`;
  }

  function renderToday() {
    const now = new Date(), key = dateKey(now);
    const card = dailyCard(key), m = moonInfo(now), ph = planetaryHour(now);
    const revealed = store.get('revealed', '') === key;
    const [name, , up, rev] = MAJORS[card.idx];
    view.innerHTML = `
      <h1>Arcana</h1><p class="sub">${now.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</p>
      <section class="card" style="text-align:center">
        <h2>Card of the Day</h2>${cardHtml(card, revealed)}
        ${revealed ? `<div class="big">${esc(name)}${card.reversed ? ' <span class="dim">(reversed)</span>' : ''}</div>
          <p class="dim">${esc(card.reversed ? rev : up)}</p>
          <button class="btn ghost" id="noteCard">Add to grimoire</button>`
        : `<p class="dim">Tap the card to turn it over.</p>`}
      </section>
      <section class="card row">${moonSvg(m)}<div class="grow"><h2>Moon</h2>
        <div class="big">${m.name}</div><div class="dim">${Math.round(m.illum * 100)}% lit · day ${m.age.toFixed(1)} of 29.5</div></div></section>
      <section class="card"><h2>Planetary Hour</h2>
        <div class="big">${PLANETS[ph.hour][0]} ${ph.hour} <span class="dim">· hour ${ph.n}</span></div>
        <div class="dim">${PLANETS[ph.hour][1]}</div>
        <p><span class="tag">Day of ${ph.day} ${PLANETS[ph.day][0]}</span></p>
        <small class="dim">Hours are fixed 60-minute blocks from 06:00, not sunrise-based.</small></section>`;
    const back = document.getElementById('cardback');
    if (back) {
      const reveal = () => { store.set('revealed', key); renderToday(); };
      back.onclick = reveal;
      back.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') reveal(); };
    }
    const note = document.getElementById('noteCard');
    if (note) note.onclick = () => {
      addEntry({ kind: 'card', text: `${name}${card.reversed ? ' (reversed)' : ''}: ${card.reversed ? rev : up}.` });
      setTab('journal');
    };
  }

  function renderSigil() {
    view.innerHTML = `
      <h1>Sigil</h1><p class="sub">State your intent. Letters become a glyph.</p>
      <section class="card">
        <input id="intent" maxlength="80" placeholder="e.g. I walk with courage" value="${esc(sigilText)}" aria-label="Intent">
        <canvas id="cv" width="640" height="640"></canvas>
        <div class="row"><button class="btn grow" id="save">Save to grimoire</button></div>
        <p class="dim"><small>Method: strike vowels and repeated letters, plot the rest around a ring, join in order. Circle marks the start, bar the end.</small></p>
      </section>`;
    const input = document.getElementById('intent'), cv = document.getElementById('cv');
    const draw = () => {
      sigilText = input.value;
      const g = cv.getContext('2d'), S = cv.width;
      g.clearRect(0, 0, S, S);
      g.strokeStyle = '#2c2147'; g.lineWidth = 2;
      g.beginPath(); g.arc(S / 2, S / 2, S * 0.38, 0, Math.PI * 2); g.stroke();
      const pts = sigilPoints(sigilText, S);
      if (!pts.length) return;
      g.strokeStyle = '#d4af37'; g.lineWidth = 6; g.lineCap = g.lineJoin = 'round';
      g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
      g.beginPath(); g.arc(sx, sy, 16, 0, Math.PI * 2); g.stroke();
      const ang = Math.atan2(ey - S / 2, ex - S / 2) + Math.PI / 2;
      g.save(); g.translate(ex, ey); g.rotate(ang); g.beginPath(); g.moveTo(-16, 0); g.lineTo(16, 0); g.stroke(); g.restore();
    };
    input.oninput = draw; draw();
    document.getElementById('save').onclick = () => {
      if (!sigilLetters(sigilText).length) return;
      addEntry({ kind: 'sigil', text: `Sigil: “${sigilText.trim()}” → ${sigilLetters(sigilText).join(' ')}` });
      setTab('journal');
    };
  }

  function addEntry(e) {
    const list = store.get('entries', []);
    list.unshift({ id: Date.now() + Math.random(), at: new Date().toISOString(), moon: moonInfo(new Date()).name, ...e });
    store.set('entries', list);
  }

  function renderJournal() {
    const list = store.get('entries', []);
    view.innerHTML = `
      <h1>Grimoire</h1><p class="sub">Dreams, omens, workings.</p>
      <section class="card"><textarea id="txt" placeholder="Write an entry…" aria-label="New entry"></textarea>
        <button class="btn" id="add">Inscribe</button></section>
      <section class="card">${list.length ? list.map(e => `
        <div class="entry"><small>${new Date(e.at).toLocaleString()} · ${esc(e.moon || '')}${e.kind !== 'note' ? ' · ' + esc(e.kind) : ''}</small>
        <p>${esc(e.text)}</p><button class="link" data-del="${e.id}">Delete</button></div>`).join('')
        : '<p class="dim">Nothing written yet.</p>'}</section>`;
    document.getElementById('add').onclick = () => {
      const t = document.getElementById('txt').value.trim();
      if (!t) return;
      addEntry({ kind: 'note', text: t }); renderJournal();
    };
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      store.set('entries', store.get('entries', []).filter(e => String(e.id) !== b.dataset.del));
      renderJournal();
    });
  }

  function setTab(t) {
    tab = t;
    tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ({ today: renderToday, sigil: renderSigil, journal: renderJournal })[t]();
    window.scrollTo(0, 0);
  }
  tabs.forEach(b => b.onclick = () => setTab(b.dataset.tab));
  setTab('today');
  setInterval(() => { if (tab === 'today' && document.visibilityState === 'visible') renderToday(); }, 60000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
