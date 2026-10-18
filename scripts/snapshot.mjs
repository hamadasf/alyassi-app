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
globalThis.fetch = (url, opt = {}) => realFetch(ORIGIN ? String(url).replace('https://omaralyassirealestate.com', ORIGIN) : url, { ...opt, headers: { 'User-Agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(60000) });

// bundle the app's own data module so the snapshot uses exactly the same rules as the app
await build({ entryPoints: ['src/data.js'], bundle: true, format: 'esm', platform: 'neutral', outfile: '.snap/data.mjs', logLevel: 'error' });
const { loadAll } = await import(process.cwd() + '/.snap/data.mjs');
const d = await loadAll({ force: true });
if (!d.projects.length) { console.error('no projects collected'); process.exit(1); }
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ at: Date.now(), projects: d.projects }));
console.log(`snapshot: ${d.projects.length} projects, ${d.lands.length} plots -> ${out}`);
