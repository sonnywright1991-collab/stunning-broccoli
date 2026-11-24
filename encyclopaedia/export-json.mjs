// Writes export/claude-entries.json in the schema used by encyclopaedia_esotericism.html (Import JSON).
// Entries that duplicate the existing 43-entry file's titles are skipped so nothing is added twice.
import { writeFileSync } from "node:fs";
import { ENTRIES, CATEGORIES } from "./entries.js";

const SKIP = new Set(["alchemy", "hermeticism", "gnosticism", "kabbalah", "neoplatonism", "theurgy", "tarot"]);
const TITLE_OVERRIDE = { tarot: "Esoteric Tarot" }; // existing entry names, so related-title links resolve
const byId = new Map(ENTRIES.map((e) => [e.id, e]));
const titleOf = (id) => TITLE_OVERRIDE[id] || byId.get(id).title;

const out = ENTRIES.filter((e) => !SKIP.has(e.id)).map((e) => ({
  id: "ek-" + e.id,
  title: e.title,
  tradition: CATEGORIES[e.cat],
  summary: [e.summary, e.body[0]].join(" "),
  keyText: (e.reading && e.reading[0]) || "",
  related: (e.related || []).map(titleOf),
  sourceUrl: "",
}));
writeFileSync(new URL("export/claude-entries.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(out.length, "entries written");
