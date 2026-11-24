import { ENTRIES, CATEGORIES } from "./entries.js";

const $ = (s) => document.querySelector(s);
const main = $("#main");
const byId = new Map(ENTRIES.map((e) => [e.id, e]));
const sorted = [...ENTRIES].sort((a, b) => a.title.localeCompare(b.title, "en"));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sortKey = (t) => t.replace(/^(The|A)\s+/i, "");

function card(e) {
  return `<li><a class="card" href="#entry-${e.id}"><span class="badge">${esc(CATEGORIES[e.cat])}</span><h3>${esc(e.title)}</h3><p>${esc(e.summary)}</p></a></li>`;
}

function home() {
  document.title = "Encyclopaedia of Esotericism";
  const featured = ["hermeticism", "kabbalah", "alchemy", "golden-dawn", "tarot", "gnosticism"].map((i) => byId.get(i)).filter(Boolean);
  const counts = Object.entries(CATEGORIES).map(([k, v]) =>
    `<li><a href="#browse-${k}">${esc(v)} (${ENTRIES.filter((e) => e.cat === k).length})</a></li>`).join("");
  main.innerHTML = `
  <section class="hero">
    <div class="rule" aria-hidden="true">&#10022; &#10022; &#10022;</div>
    <h1>Encyclopaedia of Esotericism</h1>
    <p class="lede">Hidden knowledge, its traditions, practices and people: ${ENTRIES.length} entries and growing.</p>
    <form id="heroSearch" role="search"><label class="sr" for="hq">Search</label>
    <input id="hq" type="search" placeholder="Try &ldquo;alchemy&rdquo;, &ldquo;Dee&rdquo; or &ldquo;tree of life&rdquo;" style="width:min(460px,100%);padding:10px 14px;font:inherit;border:1px solid var(--rule);border-radius:6px;background:var(--panel);color:var(--ink)"></form>
  </section>
  <h2>Browse by section</h2><ul class="chips">${counts}</ul>
  <h2>Featured entries</h2><ul class="grid">${featured.map(card).join("")}</ul>`;
  $("#heroSearch").addEventListener("submit", (ev) => { ev.preventDefault(); goSearch($("#hq").value); });
}

function browse(cat) {
  const list = cat && CATEGORIES[cat] ? sorted.filter((e) => e.cat === cat) : sorted;
  document.title = (cat && CATEGORIES[cat] ? CATEGORIES[cat] : "All entries") + " · Encyclopaedia of Esotericism";
  const chips = [`<li><a href="#browse" ${!cat ? 'aria-current="true"' : ""}>All</a></li>`]
    .concat(Object.entries(CATEGORIES).map(([k, v]) => `<li><a href="#browse-${k}" ${cat === k ? 'aria-current="true"' : ""}>${esc(v)}</a></li>`)).join("");
  const groups = new Map();
  [...list].sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), "en")).forEach((e) => {
    const L = sortKey(e.title)[0].toUpperCase();
    if (!groups.has(L)) groups.set(L, []);
    groups.get(L).push(e);
  });
  const az = [...groups.keys()].map((L) => `<li><a href="#" data-jump="L${L}">${L}</a></li>`).join("");
  const body = [...groups].map(([L, es]) => `<h3 class="letter" id="L${L}">${L}</h3><ul class="index-list">${es.map((e) => `<li><a href="#entry-${e.id}">${esc(e.title)}</a> <span class="meta" style="display:inline">&mdash; ${esc(e.era)}</span></li>`).join("")}</ul>`).join("");
  main.innerHTML = `<h1>${cat && CATEGORIES[cat] ? esc(CATEGORIES[cat]) : "All entries"}</h1><p class="lede">${list.length} entries</p><ul class="chips">${chips}</ul><ul class="az">${az}</ul>${body}`;
  main.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); document.getElementById(a.dataset.jump).scrollIntoView(); }));
}

function entry(id) {
  const e = byId.get(id);
  if (!e) return notFound();
  document.title = e.title + " · Encyclopaedia of Esotericism";
  const rel = (e.related || []).map((r) => byId.get(r)).filter(Boolean);
  const back = ENTRIES.filter((o) => o.id !== e.id && (o.related || []).includes(e.id) && !(e.related || []).includes(o.id));
  main.innerHTML = `
  <p class="back"><a href="#browse-${e.cat}">&larr; ${esc(CATEGORIES[e.cat])}</a></p>
  <article>
    <h1>${esc(e.title)}</h1>
    <div class="meta"><a class="badge" href="#browse-${e.cat}">${esc(CATEGORIES[e.cat])}</a><span>${esc(e.era)}</span></div>
    <p class="lede">${esc(e.summary)}</p>
    ${e.body.map((p) => `<p>${esc(p)}</p>`).join("")}
    ${rel.length ? `<h2>See also</h2><ul class="grid">${rel.map(card).join("")}</ul>` : ""}
    ${back.length ? `<h2>Mentioned in</h2><ul class="chips">${back.map((b) => `<li><a href="#entry-${b.id}">${esc(b.title)}</a></li>`).join("")}</ul>` : ""}
    ${e.reading?.length ? `<h2>Further reading</h2><ul class="reading">${e.reading.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
  </article>`;
}

let lastQuery = "";
function goSearch(q) {
  lastQuery = q.trim();
  if (location.hash === "#search") route(); else location.hash = "#search";
}

function search() {
  const q = lastQuery;
  document.title = `Search: ${q} · Encyclopaedia of Esotericism`;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = ENTRIES.map((e) => {
    let s = 0;
    const t = e.title.toLowerCase(), sm = e.summary.toLowerCase(), b = e.body.join(" ").toLowerCase();
    for (const w of terms) {
      if (t.includes(w)) s += 10;
      if (sm.includes(w)) s += 4;
      if (b.includes(w)) s += 1;
      else if (!t.includes(w) && !sm.includes(w)) return { e, s: 0 };
    }
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  main.innerHTML = `<h1>Search</h1><p class="lede">${scored.length} result${scored.length === 1 ? "" : "s"} for &ldquo;${esc(q)}&rdquo;</p>` +
    (scored.length ? `<ul class="grid">${scored.map((x) => card(x.e)).join("")}</ul>` : `<p>No entries found. Try a broader term, or <a href="#browse">browse all entries</a>.</p>`);
}

function about() {
  document.title = "About · Encyclopaedia of Esotericism";
  main.innerHTML = `<h1>About</h1>
  <p>This encyclopaedia is an introductory guide to the Western esoteric traditions: their currents, practices, texts, people and modern movements. It follows the approach of the academic study of Western esotericism, describing what practitioners believed and did, and what historians have established, without endorsing or dismissing claims of occult power.</p>
  <p>Where traditions claim ancient origins, entries say what the evidence supports. Entries list further reading from scholarly sources.</p>
  <h2>Using the site</h2>
  <ul><li>Search by title, topic or keyword from any page.</li><li><a href="#browse">Browse</a> by section or A&ndash;Z.</li><li>Follow &ldquo;See also&rdquo; links between entries.</li></ul>
  <p>The site is a static collection of files with no build step; entries live in <code>entries.js</code>.</p>`;
}

function notFound() {
  document.title = "Not found · Encyclopaedia of Esotericism";
  main.innerHTML = `<h1>Entry not found</h1><p>That page does not exist. <a href="#browse">Browse all entries</a>.</p>`;
}

function route() {
  const h = location.hash.replace(/^#/, "");
  const i = h.indexOf("-");
  const kind = i < 0 ? h : h.slice(0, i), arg = i < 0 ? "" : h.slice(i + 1);
  if (!kind || kind === "home") home();
  else if (kind === "browse") browse(arg);
  else if (kind === "entry") entry(arg);
  else if (kind === "search") search();
  else if (kind === "about") about();
  else notFound();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

$("#searchForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const q = $("#q").value.trim();
  if (q) goSearch(q);
});
$("#random").addEventListener("click", () => { location.hash = "#entry-" + ENTRIES[Math.floor(Math.random() * ENTRIES.length)].id; });
$("#theme").addEventListener("click", () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = document.documentElement.dataset.theme || (dark ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
});
try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}

addEventListener("hashchange", route);
route();
