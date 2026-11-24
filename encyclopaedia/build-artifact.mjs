// Bundles the site into one self-contained HTML file (dist/encyclopaedia.html) for hosting as an artifact.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const r = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const entries = r("entries.js").replace(/export const/g, "const");
const app = r("app.js").replace(/^import .*$/m, "");
let html = r("index.html");
html = html.replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${r("style.css")}</style>`)
  .replace(/<meta name="viewport"[^>]*>\n?/, "")
  .replace("<title>", '<meta name="claude:viewport-fit-sides" content="cover">\n<title>')
  .replace(/<script type="module" src="app.js"><\/script>/, () => `<script>\n(() => {\n${entries}\n${app}\n})();\n</script>`);
html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, "").replace(/<\/head>\s*<body>/i, "").replace(/<\/body>\s*<\/html>/i, "");
mkdirSync(new URL("dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("dist/encyclopaedia.html", import.meta.url), html);
console.log("wrote dist/encyclopaedia.html", html.length, "bytes");
