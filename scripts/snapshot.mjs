// Collects the live website data (projects, plots, prices, availability) into one JSON file
// for the web/iPhone version of the app. Run by GitHub Actions every few minutes.
import { DOMParser } from 'linkedom';
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] || 'web/data.json';
globalThis.DOMParser = DOMParser;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const realFetch = globalThis.fetch;
const ORIGIN = process.env.SNAP_ORIGIN; // testing only
let active = 0; const queue = [];
const slot = () => new Promise((r) => { if (active < 4) { active++; r(); } else queue.push(r); });
const release = () => { const n = queue.shift(); if (n) n(); else active--; };
globalThis.fetch = async (url, opt = {}) => {
  const u = ORIGIN ? String(url).replace('https://omaralyassirealestate.com', ORIGIN) : url;
  await slot();
  try {
    for (let i = 1; ; i++) {
      try {
        const r = await realFetch(u, { ...opt, headers: { 'User-Agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(90000) });
        if (r.ok || i >= 4) return r;
      } catch (e) { if (i >= 4) throw e; }
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  } finally { release(); }
};

// bundle the app's own data module so the snapshot uses exactly the same rules as the app
await build({ entryPoints: ['src/data.js'], bundle: true, format: 'esm', platform: 'neutral', outfile: '.snap/data.mjs', logLevel: 'error' });
const { loadAll } = await import(process.cwd() + '/.snap/data.mjs');
const { getIndex } = await import(process.cwd() + '/.snap/data.mjs');
const index = await getIndex(true);
const d = await loadAll({ force: true });
const missing = index.filter((p) => !d.projects.some((x) => x.slug === p.slug)).map((p) => p.slug);
if (!d.projects.length || missing.length) { console.error('missing projects: ' + missing.join(', ')); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ at: Date.now(), projects: d.projects }));
console.log(`snapshot: ${d.projects.length} projects, ${d.lands.length} plots -> ${out}`);
