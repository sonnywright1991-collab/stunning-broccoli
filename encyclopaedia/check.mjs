import { ENTRIES, CATEGORIES } from "./entries.js";
const ids = new Set(ENTRIES.map((e) => e.id));
let bad = 0;
if (ids.size !== ENTRIES.length) { console.log("duplicate ids"); bad++; }
for (const e of ENTRIES) {
  if (!CATEGORIES[e.cat]) { console.log("bad cat", e.id); bad++; }
  for (const r of e.related || []) if (!ids.has(r)) { console.log("dangling", e.id, "->", r); bad++; }
}
console.log(ENTRIES.length, "entries,", bad, "problems");
process.exit(bad ? 1 : 0);
