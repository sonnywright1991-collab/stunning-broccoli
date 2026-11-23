// Bundles the ES modules + CSS + markup into one self-contained HTML page: node tools/build-artifact.mjs
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const order = ['format', 'data', 'sim', 'state', 'render', 'ui', 'main'];
const js = order.map((m) => '// ---- ' + m + '.js ----\n' + read('src/' + m + '.js')
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '')
  .replace(/^export\s+/gm, '')).join('\n');
const html = read('index.html');
const body = html.slice(html.indexOf('<header'), html.indexOf('<script')).trim();
const css = read('style.css')
  .replace(/html, body \{/, 'html, body { margin: 0;')
  + `\nbody { padding-left: max(0px, env(safe-area-inset-left, 0px)); padding-right: max(0px, env(safe-area-inset-right, 0px)); }\n`
  + `.top, .layout { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }\n`;
const out = `<title>Tiny Colony</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
${body}
<script>
(() => {
${js}
})();
</script>
`;
fs.writeFileSync(new URL('../dist/tiny-colony.html', import.meta.url), out);
console.log('wrote dist/tiny-colony.html', out.length, 'bytes');
