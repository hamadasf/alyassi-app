// Makes each project's full plan PDF exactly as the website's «تحميل ملف المشروع» button does, and publishes it
// next to the app (web/pdf/<slug>.pdf) so the app can share the file itself. Run by GitHub Actions.
// A project's PDF is rebuilt only when its plots, prices or statuses change (cached by a hash of the live state).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const [dataFile = 'web/data.json', outDir = 'web/pdf', cacheDir = '.pdfcache'] = process.argv.slice(2);
const SITE = 'https://omaralyassirealestate.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
mkdirSync(outDir, { recursive: true }); mkdirSync(cacheDir, { recursive: true });

const { projects } = JSON.parse(readFileSync(dataFile, 'utf8'));
const exe = process.env.CHROME || ['google-chrome', 'chromium', 'chromium-browser'].map((c) => { try { return execSync(`which ${c}`).toString().trim(); } catch { return ''; } }).find(Boolean);

async function stateHash(p) {
  const r = await fetch(`${SITE}/wp-admin/admin-ajax.php?action=dn_state&project=${encodeURIComponent(p.slug)}`, { headers: { 'User-Agent': UA } });
  const t = await r.text();
  return createHash('sha1').update(t).digest('hex').slice(0, 16);
}

const index = {};
let browser = null, built = 0;
for (const p of projects) {
  let hash = '';
  try { hash = await stateHash(p); } catch (e) { console.warn(p.slug, 'state', e.message); }
  const cached = hash && `${cacheDir}/${p.slug}-${hash}.pdf`;
  if (cached && existsSync(cached)) {
    copyFileSync(cached, `${outDir}/${p.slug}.pdf`);
  } else {
    try {
      browser = browser || await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
      const ctx = await browser.newContext({ userAgent: UA, acceptDownloads: true, viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const dl = page.waitForEvent('download', { timeout: 240000 });
      await page.goto(`${p.plan.split('#')[0].split('?')[0]}?pdf=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      const d = await dl;
      const tmp = `${cacheDir}/${p.slug}-${hash || 'x'}.pdf`;
      await d.saveAs(tmp);
      const head = readFileSync(tmp).subarray(0, 5).toString();
      if (head !== '%PDF-') throw new Error('not a pdf');
      // keep only the newest cached copy of this project
      readdirSync(cacheDir).filter((f) => f.startsWith(p.slug + '-') && `${cacheDir}/${f}` !== tmp).forEach((f) => unlinkSync(`${cacheDir}/${f}`));
      copyFileSync(tmp, `${outDir}/${p.slug}.pdf`);
      built++;
      await ctx.close();
      console.log(`${p.slug}: built (${(statSync(tmp).size / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      console.warn(`${p.slug}: failed — ${e.message}`);
      // fall back to the last good copy, whatever state it was made from
      const old = readdirSync(cacheDir).find((f) => f.startsWith(p.slug + '-'));
      if (old) copyFileSync(`${cacheDir}/${old}`, `${outDir}/${p.slug}.pdf`);
    }
  }
  if (existsSync(`${outDir}/${p.slug}.pdf`)) index[p.slug] = { name: p.name, size: statSync(`${outDir}/${p.slug}.pdf`).size, v: hash };
}
if (browser) await browser.close();
writeFileSync(`${outDir}/index.json`, JSON.stringify(index));
writeFileSync(`${cacheDir}/.changed`, built ? '1' : '0');
console.log(`project PDFs: ${Object.keys(index).length}/${projects.length} ready, ${built} rebuilt`);
