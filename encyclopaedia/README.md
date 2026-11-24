# Encyclopaedia of Esotericism

A static, build-free reference site on Western esoteric traditions. 49 entries across six sections, with search, A-Z browse, cross-links, dark mode.

Run: `cd encyclopaedia && python3 -m http.server 8000` (ES modules need http://).
Add entries in `entries.js`; validate links with `node check.mjs`.

## Merging into the canonical file

`node export-json.mjs` writes `export/claude-entries.json` (42 entries, skipping 7 that duplicate existing titles) in the schema used by `encyclopaedia_esotericism.html`. Load it with that app's Import JSON button. Do not import it into this site's own build: ids are prefixed `ek-`, so they would appear twice.
