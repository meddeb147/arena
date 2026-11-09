// Builds the client (offline mode: engine runs in the browser) into ONE html file
// with JS and CSS inlined. Used for shareable previews.  node scripts/build-single.mjs <out.html>
import { build } from 'vite';
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist-single');
await build({
  root,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const safeJs = js.replace(/<\/script/gi, '<\\/script');
const html = `<title>Stake Arena</title>
<meta name="theme-color" content="#171433">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Nunito:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark}${css}</style>
<div id="app"></div>
<script type="module">${safeJs}</script>
`;
const out = process.argv[2] ?? join(root, 'stake-arena.html');
writeFileSync(out, html);
rmSync(outDir, { recursive: true, force: true });
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
