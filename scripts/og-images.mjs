process.on('uncaughtException', (e) => { console.log(`::warning::link pictures crashed: ${String(e && e.stack || e).slice(0, 500).replace(/\n/g, ' | ')}`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log(`::warning::link pictures crashed: ${String(e && e.stack || e).slice(0, 500).replace(/\n/g, ' | ')}`); process.exit(1); });
// Link-preview pictures for WhatsApp: one image per listed plot — the plot on its project plan, highlighted — drawn with
// the app's own plan code and published as web/og/<project>/<plot>.jpg. The website's share link (?oay_p=…) points to it.
// A project's pictures are redrawn only when its plots, statuses or prices change.
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const [dataFile = 'web/data.json', outDir = 'web/og', cacheDir = '.ogcache'] = process.argv.slice(2);
const ORIGIN = 'https://hamadasf.github.io/alyassi-app/';
mkdirSync(outDir, { recursive: true }); mkdirSync(cacheDir, { recursive: true });
const { projects } = JSON.parse(readFileSync(dataFile, 'utf8'));
const exe = process.env.CHROME || ['google-chrome', 'chromium', 'chromium-browser'].map((c) => { try { return execSync(`which ${c}`).toString().trim(); } catch { return ''; } }).find(Boolean);

await build({ stdin: { contents: "import { loadPlan, drawPlanLoc } from './src/planloc.js'; window.OG = { loadPlan, drawPlanLoc };", resolveDir: process.cwd() },
  bundle: true, format: 'iife', outfile: '.og/bundle.js', logLevel: 'error' });
const page = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Tajawal; font-weight: 800; src: url(fonts/tajawal-arabic-800.woff2); unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFF; }
@font-face { font-family: Tajawal; font-weight: 800; src: url(fonts/tajawal-latin-800.woff2); unicode-range: U+0000-00FF; }
@font-face { font-family: Tajawal; font-weight: 700; src: url(fonts/tajawal-arabic-700.woff2); unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFF; }
@font-face { font-family: Tajawal; font-weight: 700; src: url(fonts/tajawal-latin-700.woff2); unicode-range: U+0000-00FF; }
</style><body><script src="og-bundle.js"></script></body>`;

const W = 1200, H = 630;
let browser = null, pg = null, made = 0;
const fmt = (n) => Number(n).toLocaleString('en-US');
for (const p of projects) {
  const lands = p.lands.filter((l) => l.poly || l.pc);
  if (!p.map || !lands.length) continue;
  const hash = createHash('sha1').update(JSON.stringify([p.map.vec, p.map.bgRaw, p.name, lands.map((l) => [l.n, l.status, l.total, l.ft])])).digest('hex').slice(0, 12);
  const cached = `${cacheDir}/${p.slug}-${hash}`;
  if (!existsSync(cached)) {
    if (!browser) {
      browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
      pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
      await pg.route(ORIGIN + '**', (r) => {
        const path = r.request().url().slice(ORIGIN.length).split('?')[0];
        if (path === 'og-render.html') return r.fulfill({ contentType: 'text/html', body: page });
        if (path === 'og-bundle.js') return r.fulfill({ contentType: 'application/javascript', body: readFileSync('.og/bundle.js') });
        if (path.startsWith('fonts/') && existsSync('web/' + path)) return r.fulfill({ contentType: 'font/woff2', body: readFileSync('web/' + path) });
        return r.fulfill({ status: 404, body: '' });
      });
      if (process.env.OG_REF) {   // local testing without the website: plan files from a folder
        await pg.route('**/admin-ajax.php?action=oay_img*', (r) => { const k = /kind=(\w+)/.exec(r.request().url())[1]; return r.fulfill({ body: readFileSync(`${process.env.OG_REF}/${{ bg: 'bg.jpg', bgraw: 'bg.bin', vec: 'vec.z' }[k]}`), headers: { 'Access-Control-Allow-Origin': '*' } }); });
      }
      await pg.goto(ORIGIN + 'og-render.html');
      await pg.evaluate(() => Promise.all(['800 20px Tajawal', '700 20px Tajawal'].map((f) => document.fonts.load(f, 'قطعة 0123'))));
    }
    try {
      const imgs = await pg.evaluate(async ({ p, lands, W, H }) => {
        const P = await window.OG.loadPlan(p.slug, p.map);
        const out = {}; const ST = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة' };
        const fmt = (n) => Number(n).toLocaleString('en-US');
        for (const l of lands) {
          const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
          window.OG.drawPlanLoc(x, P, l, p.lands, p.map, { w: W, h: H });
          // caption strip: plot, project, status · area · price
          const g = x.createLinearGradient(0, H - 150, 0, H); g.addColorStop(0, 'rgba(14,28,54,0)'); g.addColorStop(0.35, 'rgba(14,28,54,.88)'); g.addColorStop(1, 'rgba(14,28,54,.96)');
          x.fillStyle = g; x.fillRect(0, H - 150, W, 150);
          x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = '800 46px Tajawal';
          x.fillText(`قطعة رقم ${l.n} · ${p.name}`, W - 36, H - 62);
          x.fillStyle = '#E6C77F'; x.font = '700 32px Tajawal';
          x.fillText([ST[l.status] || '', l.ft ? `${fmt(l.ft)} قدم²` : '', l.status !== 'sold' && l.total ? `${fmt(l.total)} درهم` : ''].filter(Boolean).join('  ·  '), W - 36, H - 20);
          x.textAlign = 'left'; x.direction = 'ltr'; x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '700 24px Tajawal';
          x.fillText('عمر الياسي للعقارات', 36, H - 24);
          out[l.n] = c.toDataURL('image/jpeg', 0.74).split(',')[1];
        }
        return out;
      }, { p, lands, W, H });
      mkdirSync(cached, { recursive: true });
      for (const [n, b64] of Object.entries(imgs)) writeFileSync(`${cached}/${String(n).replace(/[^\w-]/g, '_')}.jpg`, Buffer.from(b64, 'base64'));
      readdirSync(cacheDir).filter((f) => f.startsWith(p.slug + '-') && `${cacheDir}/${f}` !== cached).forEach((f) => rmSync(`${cacheDir}/${f}`, { recursive: true, force: true }));
      made++;
      console.log(`${p.slug}: ${Object.keys(imgs).length} pictures`);
    } catch (e) { console.log(`::warning::link pictures ${p.slug}: ${String(e.message).slice(0, 300)}`); }
  }
  const src = existsSync(cached) ? cached : readdirSync(cacheDir).map((f) => `${cacheDir}/${f}`).find((f) => f.startsWith(`${cacheDir}/${p.slug}-`));
  if (src) cpSync(src, `${outDir}/${p.slug}`, { recursive: true });
}
if (browser) await browser.close();
writeFileSync(`${cacheDir}/.changed`, made ? '1' : '0');
console.log(`::notice::link pictures: ${made} projects redrawn, ${projects.filter((p) => existsSync(`${outDir}/${p.slug}`)).length}/${projects.length} published`);
