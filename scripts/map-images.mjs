process.on('uncaughtException', (e) => { console.log(`::warning::map pictures crashed: ${String(e && e.stack || e).slice(0, 500).replace(/\n/g, ' | ')}`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log(`::warning::map pictures crashed: ${String(e && e.stack || e).slice(0, 500).replace(/\n/g, ' | ')}`); process.exit(1); });
// «خريطة المشاريع»: each project's plan picture (its drawing, plots coloured, cut to the project — or one per part, مزيرعة A / B)
// drawn here once with the app's own code and published as web/mapimg/<key>.<hash>.webp + web/mapimg/index.json, so phones
// show the pictures at once instead of drawing every plan themselves. A project is redrawn only when its plan changes.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const [dataFile = 'web/data.json', outDir = 'web/mapimg', cacheDir = '.mapcache'] = process.argv.slice(2);
const ORIGIN = 'https://hamadasf.github.io/alyassi-app/';
mkdirSync(outDir, { recursive: true }); mkdirSync(cacheDir, { recursive: true });
const { projects } = JSON.parse(readFileSync(dataFile, 'utf8'));
const exe = process.env.CHROME || ['google-chrome', 'chromium', 'chromium-browser'].map((c) => { try { return execSync(`which ${c}`).toString().trim(); } catch { return ''; } }).find(Boolean);
const sha = (x) => createHash('sha1').update(x).digest('hex').slice(0, 12);
// the drawing code itself is part of the key: a change to it redraws every picture
const code = sha(readFileSync('src/projmap.js') + readFileSync('src/planloc.js') + readFileSync('src/data.js'));

await build({ stdin: { contents: "import { planPicture, mapItems } from './src/projmap.js'; window.MP = { planPicture, mapItems };", resolveDir: process.cwd() },
  bundle: true, format: 'iife', outfile: '.mapimg/bundle.js', logLevel: 'error', define: { __VERSION__: '"ci"', __SNAPSHOT__: 'false' } });
const page = '<!doctype html><meta charset="utf-8"><style>@font-face { font-family: Tajawal; font-weight: 700; src: url(fonts/tajawal-arabic-700.woff2); }</style><body><script src="mp-bundle.js"></script></body>';

let browser = null, pg = null, made = 0; const index = {};
const items = projects.flatMap((p) => {
  if (!p.map) return [];
  const o = existsSync(`web/outlines/${p.slug}.json`) ? readFileSync(`web/outlines/${p.slug}.json`) : '';
  return [{ p, base: sha(JSON.stringify([code, p.map.vec, p.map.bgRaw, p.map.vs, p.map.w, p.map.h, p.types, o.length ? sha(o) : '', p.lands.length])) }];
});
for (const { p, base } of items) {
  const cached = `${cacheDir}/${p.slug}-${base}`;
  if (!existsSync(`${cached}/index.json`)) {
    if (!browser) {
      browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
      pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
      pg.on('pageerror', (e) => console.log(`page error: ${String(e.message).slice(0, 200)}`));
      await pg.route(ORIGIN + '**', (r) => {
        const path = r.request().url().slice(ORIGIN.length).split('?')[0];
        if (path === 'mp-render.html') return r.fulfill({ contentType: 'text/html', body: page });
        if (path === 'mp-bundle.js') return r.fulfill({ contentType: 'application/javascript', body: readFileSync('.mapimg/bundle.js') });
        if ((path.startsWith('fonts/') || path.startsWith('outlines/')) && existsSync('web/' + path)) return r.fulfill({ body: readFileSync('web/' + path) });
        return r.fulfill({ status: 404, body: '' });
      });
      await pg.goto(ORIGIN + 'mp-render.html');
      await pg.evaluate(() => document.fonts.load('700 20px Tajawal', 'قطعة 0123')).catch(() => {});
    }
    try {
      const out = await pg.evaluate(async (p) => {
        const res = {};
        for (const it of window.MP.mapItems([p])) {
          const r = await window.MP.planPicture(it);
          const c = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = r.src; });
          const cv = document.createElement('canvas'); cv.width = c.naturalWidth; cv.height = c.naturalHeight; cv.getContext('2d').drawImage(c, 0, 0);
          const transparent = r.src.startsWith('data:image/png');
          res[it.key] = { b64: cv.toDataURL(transparent ? 'image/webp' : 'image/jpeg', 0.86).split(',')[1], ext: transparent ? 'webp' : 'jpg', cut: r.cut, box: r.box || null, w: cv.width, h: cv.height };
        }
        return res;
      }, p);
      rmSync(cached, { recursive: true, force: true }); mkdirSync(cached, { recursive: true });
      const meta = {};
      for (const [key, x] of Object.entries(out)) {
        const buf = Buffer.from(x.b64, 'base64'), file = `${key}.${sha(buf)}.${x.ext}`;
        writeFileSync(`${cached}/${file}`, buf); meta[key] = { file, cut: x.cut, box: x.box, w: x.w, h: x.h };
        console.log(`${key}: ${x.w}×${x.h} ${Math.round(buf.length / 1024)} KB`);
      }
      writeFileSync(`${cached}/index.json`, JSON.stringify(meta));
      readdirSync(cacheDir).filter((f) => f.startsWith(p.slug + '-') && `${cacheDir}/${f}` !== cached).forEach((f) => rmSync(`${cacheDir}/${f}`, { recursive: true, force: true }));
      made++;
    } catch (e) { console.log(`::warning::map pictures ${p.slug}: ${String(e.message).slice(0, 300)}`); }
  }
  // publish this project's pictures: the fresh ones, else the last good ones (a failed draw keeps yesterday's)
  const src = existsSync(`${cached}/index.json`) ? cached : readdirSync(cacheDir).map((f) => `${cacheDir}/${f}`).find((f) => f.startsWith(`${cacheDir}/${p.slug}-`) && existsSync(`${f}/index.json`));
  if (!src) continue;
  const meta = JSON.parse(readFileSync(`${src}/index.json`, 'utf8'));
  for (const [key, m] of Object.entries(meta)) { copyFileSync(`${src}/${m.file}`, `${outDir}/${m.file}`); index[key] = m; }
}
if (browser) await browser.close();
writeFileSync(`${outDir}/index.json`, JSON.stringify(index));
writeFileSync(`${cacheDir}/.changed`, made ? '1' : '0');
console.log(`map pictures: ${Object.keys(index).length} published, ${made} project(s) redrawn`);
