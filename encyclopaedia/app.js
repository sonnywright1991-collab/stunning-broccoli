import { ENTRIES as BASE, CATEGORIES } from "./entries.js";

const $ = (s) => document.querySelector(s);
const main = $("#main");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "other";
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const sortKey = (t) => t.replace(/^(The|A)\s+/i, "");

// ---- storage (every access guarded) ----
const K = { custom: "esoteric_custom_entries_v4", saved: "esoteric_saved_ids_v4", notes: "esoteric_study_notes_v4", theme: "esoteric_theme_zine_v1" };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let custom = load(K.custom, []), saved = new Set(load(K.saved, [])), notes = load(K.notes, {});
if (!Array.isArray(custom)) custom = [];
if (typeof notes !== "object" || Array.isArray(notes)) notes = {};

// ---- entries ----
let entries = [], byId = new Map(), byTitle = new Map();
function normalise(e, i, isCustom) {
  const tradition = e.tradition || CATEGORIES[e.cat] || "Uncategorised";
  const body = Array.isArray(e.body) ? e.body : e.summary ? [e.summary] : [];
  return {
    id: String(e.id || slug(e.title) + i), title: String(e.title || "Untitled"), tradition, cat: slug(tradition),
    era: e.era || e.keyText || "", summary: String(e.summary || ""), body, excerpt: e.excerpt || "",
    keyText: e.keyText || "", related: Array.isArray(e.related) ? e.related : [], reading: e.reading || [],
    sourceUrl: safeUrl(e.sourceUrl), isCustom,
  };
}
function rebuild() {
  const seen = new Set();
  entries = [...BASE.map((e, i) => normalise(e, i, false)), ...custom.map((e, i) => normalise(e, i, true))]
    .filter((e) => !seen.has(e.id) && seen.add(e.id));
  entries.forEach((e, i) => (e.ref = "ES-" + String(i + 1).padStart(2, "0")));
  byId = new Map(entries.map((e) => [e.id, e]));
  byTitle = new Map(entries.map((e) => [e.title.toLowerCase(), e]));
  $("#count").textContent = entries.length + " treatises";
  if ($("#track").dataset.n !== String(entries.length)) {
  $("#track").dataset.n = String(entries.length);
  const links = entries.map((e) => `<a href="#entry-${esc(e.id)}">${esc(e.title)}</a>`).join("");
  $("#track").innerHTML = links + links.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ');
  }
  const traditions = new Map();
  entries.forEach((e) => traditions.set(e.cat, { label: e.tradition, n: (traditions.get(e.cat)?.n || 0) + 1 }));
  const cur = currentCat();
  const items = [["all", "All", entries.length], ["saved", "Saved", saved.size], ...[...traditions].map(([k, v]) => [k, v.label, v.n])];
  $("#stamps").innerHTML = items.map(([k, l, n]) => `<li><a href="#${k === "all" ? "browse" : "browse-" + k}" ${cur === k ? 'aria-current="true"' : ""}><span>${esc(l)}</span><span>${n}</span></a></li>`).join("");
}
const resolve = (r) => byId.get(r) || byTitle.get(String(r).toLowerCase());
const currentCat = () => { const h = location.hash.slice(1); return h === "browse" ? "all" : h.startsWith("browse-") ? h.slice(7) : ""; };

// ---- views ----
function card(e) {
  return `<li><a class="card" href="#entry-${esc(e.id)}"><span class="code">REF: ${e.ref}</span>${saved.has(e.id) ? '<span class="star" title="Saved">&#9733;</span>' : ""}<h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p></a></li>`;
}

function home() {
  document.title = "Encyclopaedia of Esotericism";
  const day = Math.floor(Date.now() / 864e5);
  const f = entries[day % entries.length];
  const picks = ["hermeticism", "kabbalah", "alchemy", "golden-dawn", "tarot", "gnosticism"].map((i) => byId.get(i)).filter(Boolean);
  main.innerHTML = `
  <section class="folio feature"><span class="code">Featured treatise &middot; ${f.ref}</span>
    <h1>${esc(f.title)}</h1><div class="meta"><span>${esc(f.tradition)}</span><span>${esc(f.era)}</span></div>
    <p class="lede">${esc(f.summary)}</p><a href="#entry-${esc(f.id)}">Read the treatise &rarr;</a></section>
  <h2 class="sec">Notable treatises</h2><ul class="grid">${picks.map(card).join("")}</ul>`;
}

function browse(cat) {
  cat = cat || "all";
  let list = cat === "all" ? entries : cat === "saved" ? entries.filter((e) => saved.has(e.id)) : entries.filter((e) => e.cat === cat);
  const label = cat === "all" ? "Index of treatises" : cat === "saved" ? "Saved treatises" : list[0]?.tradition || "Not found";
  document.title = label + " · Encyclopaedia of Esotericism";
  const groups = new Map();
  [...list].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), "en")).forEach((e) => {
    const L = sortKey(e.title)[0].toUpperCase();
    (groups.get(L) || groups.set(L, []).get(L)).push(e);
  });
  main.innerHTML = `<h1>${esc(label)}</h1><p class="lede">${list.length} treatise${list.length === 1 ? "" : "s"}${cat === "saved" && !list.length ? ". Use Save on any entry to collect it here." : ""}</p>
  <ul class="az">${[...groups.keys()].map((L) => `<li><a href="#" data-jump="L${L}">${L}</a></li>`).join("")}</ul>
  ${[...groups].map(([L, es]) => `<h3 class="letter" id="L${L}">${L}</h3><ul class="index-list">${es.map((e) => `<li><a href="#entry-${esc(e.id)}">${esc(e.title)}</a> <span class="meta" style="display:inline">${esc(e.ref)}</span></li>`).join("")}</ul>`).join("")}`;
  main.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); document.getElementById(a.dataset.jump)?.scrollIntoView(); }));
}

function entry(id) {
  const e = byId.get(id);
  if (!e) return notFound();
  document.title = e.title + " · Encyclopaedia of Esotericism";
  const rel = (e.related || []).map(resolve).filter(Boolean);
  const back = entries.filter((o) => o.id !== e.id && o.related.some((r) => resolve(r) === e) && !rel.includes(o));
  const i = entries.indexOf(e), prev = entries[(i - 1 + entries.length) % entries.length], next = entries[(i + 1) % entries.length];
  main.innerHTML = `
  <article class="folio entry">
    <span class="code">Treatise · REF: ${e.ref}</span>
    <h1>${esc(e.title)}</h1>
    <div class="meta"><a href="#browse-${e.cat}">${esc(e.tradition)}</a>${e.era ? `<span>${esc(e.era)}</span>` : ""}</div>
    <p class="lede">${esc(e.summary)}</p>
    ${e.body.length > 1 ? e.body.map((p) => `<p class="body">${esc(p)}</p>`).join("") : ""}
    ${e.excerpt ? `<blockquote>${esc(e.excerpt)}</blockquote>` : ""}
    ${e.keyText ? `<p class="meta">Key text: ${esc(e.keyText)}</p>` : ""}
    ${e.sourceUrl ? `<p><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source document</a></p>` : ""}
    <div class="tools"><button id="save" type="button" aria-pressed="${saved.has(e.id)}">${saved.has(e.id) ? "★ Saved" : "☆ Save"}</button><button id="copy" type="button">Copy</button></div>
    ${rel.length ? `<h2 class="sec">See also</h2><ul class="grid">${rel.map(card).join("")}</ul>` : ""}
    ${back.length ? `<h2 class="sec">Cited by</h2><p>${back.map((b) => `<a href="#entry-${esc(b.id)}">${esc(b.title)}</a>`).join(" &middot; ")}</p>` : ""}
    ${e.reading.length ? `<h2 class="sec">Further reading</h2><ul class="reading">${e.reading.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
    <h2 class="sec"><label for="note">Personal study notes</label></h2>
    <textarea id="note" placeholder="Notes save automatically in this browser.">${esc(notes[e.id] || "")}</textarea>
    <h2 class="sec">Continue</h2><div class="tools"><a href="#entry-${esc(prev.id)}">&larr; ${esc(prev.title)}</a><a href="#entry-${esc(next.id)}">${esc(next.title)} &rarr;</a></div>
  </article>`;
  $("#save").addEventListener("click", () => {
    saved.has(e.id) ? saved.delete(e.id) : saved.add(e.id);
    store(K.saved, [...saved]); rebuild(); entry(e.id);
  });
  $("#copy").addEventListener("click", async (ev) => {
    const text = `${e.title}\n\n${e.summary}\n${e.sourceUrl}`.trim();
    try { await navigator.clipboard.writeText(text); ev.target.textContent = "Copied"; } catch { ev.target.textContent = "Copy failed"; }
  });
  $("#note").addEventListener("input", (ev) => {
    if (ev.target.value) notes[e.id] = ev.target.value; else delete notes[e.id];
    store(K.notes, notes);
  });
}

let lastQuery = "";
function goSearch(q) { lastQuery = q.trim(); if (location.hash === "#search") route(); else location.hash = "#search"; }
function search() {
  const q = lastQuery;
  document.title = `Search: ${q} · Encyclopaedia of Esotericism`;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = entries.map((e) => {
    const t = e.title.toLowerCase(), tr = e.tradition.toLowerCase(), sm = (e.summary + " " + e.keyText).toLowerCase(), b = (e.body.join(" ") + " " + (notes[e.id] || "")).toLowerCase();
    let s = 0;
    for (const w of terms) {
      const h = (t.includes(w) ? 10 : 0) + (tr.includes(w) ? 5 : 0) + (sm.includes(w) ? 4 : 0) + (b.includes(w) ? 1 : 0);
      if (!h) return { e, s: 0 };
      s += h;
    }
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  main.innerHTML = `<h1>Search</h1><p class="lede">${hits.length} result${hits.length === 1 ? "" : "s"} for &ldquo;${esc(q)}&rdquo;</p>` +
    (hits.length ? `<ul class="grid">${hits.map((x) => card(x.e)).join("")}</ul>` : `<p>Nothing found. Try a broader term or the <a href="#browse">index</a>.</p>`);
}

function about() {
  document.title = "About · Encyclopaedia of Esotericism";
  main.innerHTML = `<article class="folio entry"><h1>About</h1>
  <p class="body">This encyclopaedia is an introductory guide to the Western esoteric traditions: currents, practices, texts, people and modern movements. It follows the academic study of Western esotericism, describing what practitioners believed and did and what historians have established, without endorsing or dismissing claims of occult power.</p>
  <p class="body">Where traditions claim ancient origins, entries say what the evidence supports. Quotations appear only when taken verbatim from a verified source.</p>
  <h2 class="sec">Your own entries</h2>
  <p>Import a JSON backup (an array of entries, or an object with <code>custom</code>, <code>saved</code> and <code>notes</code>) from the Archive backup box. Each entry takes <code>id</code>, <code>title</code>, <code>tradition</code>, <code>summary</code>, optional <code>excerpt</code> (verbatim only), <code>keyText</code>, <code>related</code> (titles) and <code>sourceUrl</code>.</p></article>`;
}
function notFound() { document.title = "Not found · Encyclopaedia of Esotericism"; main.innerHTML = `<h1>Not found</h1><p>That page does not exist. <a href="#browse">Open the index</a>.</p>`; }

function route() {
  rebuild();
  const h = location.hash.replace(/^#/, ""), i = h.indexOf("-");
  const kind = i < 0 ? h : h.slice(0, i), arg = i < 0 ? "" : h.slice(i + 1);
  if (!kind || kind === "home") home();
  else if (kind === "browse") browse(arg);
  else if (kind === "entry") entry(arg);
  else if (kind === "search") search();
  else if (kind === "about") about();
  else notFound();
  window.scrollTo(0, 0);
  main.querySelectorAll(".grid > li, .index-list li").forEach((li, n) => li.style.setProperty("--i", Math.min(n, 24)));
  if (!reduce && main.animate) main.animate([{ transform: "translateY(10px)" }, { transform: "none" }], { duration: 320, easing: "ease-out" });
}

// ---- backup ----
const msg = (t) => { $("#backupMsg").textContent = t; };
$("#export").addEventListener("click", async () => {
  const json = JSON.stringify({ custom, saved: [...saved], notes }, null, 2);
  try { await navigator.clipboard.writeText(json); msg("Backup JSON copied to the clipboard."); }
  catch { main.insertAdjacentHTML("afterbegin", `<div class="box"><label for="bk">Copy this backup JSON</label><textarea id="bk" readonly>${esc(json)}</textarea></div>`); $("#bk").select(); msg("Select and copy the backup below."); }
});
$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const add = Array.isArray(d) ? d : Array.isArray(d.custom) ? d.custom : [];
    const valid = add.filter((e) => e && typeof e.title === "string" && typeof e.summary === "string");
    const have = new Set(custom.map((e) => e.id));
    valid.forEach((e) => { if (!have.has(e.id)) custom.push(e); });
    if (!Array.isArray(d)) {
      if (Array.isArray(d.saved)) d.saved.forEach((x) => typeof x === "string" && saved.add(x));
      if (d.notes && typeof d.notes === "object") Object.entries(d.notes).forEach(([k, v]) => typeof v === "string" && (notes[k] = v));
    }
    store(K.custom, custom); store(K.saved, [...saved]); store(K.notes, notes);
    msg(`Imported ${valid.length} entr${valid.length === 1 ? "y" : "ies"}.`); route();
  } catch { msg("That file is not valid backup JSON."); }
  ev.target.value = "";
});

// ---- movement ----
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
(function wheel() {
  const NS = "http://www.w3.org/2000/svg", Z = "♈♉♊♋♌♍♎♏♐♑♒♓", P = "☉☽☿♀♂♃♄";
  const ring = (chars, r, size, cls) => `<g class="${cls}">${[...chars].map((ch, i) => {
    const t = (i / chars.length) * 2 * Math.PI - Math.PI / 2;
    return `<text x="${500 + r * Math.cos(t)}" y="${500 + r * Math.sin(t)}" font-size="${size}">${ch}\uFE0E</text>`;
  }).join("")}</g>`;
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI, r1 = i % 6 ? 452 : 440, r2 = 470;
    return `<line x1="${500 + r1 * Math.cos(t)}" y1="${500 + r1 * Math.sin(t)}" x2="${500 + r2 * Math.cos(t)}" y2="${500 + r2 * Math.sin(t)}"/>`;
  }).join("");
  $("#wheel").innerHTML = `<svg viewBox="0 0 1000 1000" fill="none" stroke="currentColor" stroke-width="2">
    <g id="scrollRot" style="transform-origin:500px 500px">
      <g class="spin"><circle cx="500" cy="500" r="480"/><circle cx="500" cy="500" r="430"/>${ticks}${ring(Z, 385, 54, "z")}<circle cx="500" cy="500" r="340"/></g>
      <g class="spin rev"><circle cx="500" cy="500" r="290"/>${ring(P, 245, 44, "p")}<circle cx="500" cy="500" r="200"/><path d="M500 320 L656 590 L344 590 Z"/><path d="M500 680 L344 410 L656 410 Z"/><circle cx="500" cy="500" r="28" fill="currentColor"/></g>
    </g></svg>`;
  if (reduce) return;
  const rot = document.getElementById("scrollRot");
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { rot.style.transform = `rotate(${scrollY * 0.06}deg)`; ticking = false; });
  }, { passive: true });
})();
$("#random").addEventListener("click", (ev) => { if (reduce) return; const b = ev.currentTarget; b.classList.remove("spin"); void b.offsetWidth; b.classList.add("spin"); });

// ---- chrome ----
$("#searchForm").addEventListener("submit", (ev) => { ev.preventDefault(); const q = $("#q").value.trim(); if (q) goSearch(q); });
$("#random").addEventListener("click", () => { location.hash = "#entry-" + entries[Math.floor(Math.random() * entries.length)].id; });
function setTheme(t) {
  if (t === "night") document.documentElement.dataset.theme = "night"; else delete document.documentElement.dataset.theme;
  $("#theme").textContent = t === "night" ? "Cream paper" : "Night ink";
}
$("#theme").addEventListener("click", () => { const n = document.documentElement.dataset.theme === "night" ? "zine" : "night"; setTheme(n); store(K.theme, n); });
const t0 = load(K.theme, null);
setTheme(t0 || (matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "zine"));

addEventListener("hashchange", route);
route();
