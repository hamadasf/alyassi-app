// Builds the web / iPhone version into web/ (published on GitHub Pages).
import { build } from 'esbuild';
import { mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync('node', ['scripts/build.mjs'], { stdio: 'inherit' });   // fonts, css, assets into www/
mkdirSync('web', { recursive: true });
cpSync('www', 'web', { recursive: true });
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari14'],
  outfile: 'web/app.js', legalComments: 'none', define: { __SNAPSHOT__: '"./data.json"', __VERSION__: JSON.stringify(process.env.APP_VERSION || 'ويب ' + new Date().toISOString().slice(0, 10)) },
});
const V = Date.now().toString(36);
let html = readFileSync('web/index.html', 'utf8');
html = html.replace('<title>', `<link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icons/icon-180.png">
  <link rel="icon" type="image/png" href="icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="عمر الياسي">
  <meta name="description" content="أراضٍ ومشاريع عمر الياسي للعقارات في الشارقة — الأسعار والمتاح أولاً بأول">
  <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
  <title>`).replace('app.css"', `app.css?v=${V}"`).replace('app.js"', `app.js?v=${V}"`);
writeFileSync('web/index.html', html);
// public legal pages (Google Play: privacy policy and account-deletion links)
{
  const { LEGAL, RAW_EN } = await import('../src/legal.js');
  const page = (k, file) => {
    const fix = (h) => h.replace(/href="#" data-legal="privacy"/g, 'href="privacy.html"');
    writeFileSync('web/' + file, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${LEGAL[k][0]} — عمر الياسي للعقارات</title><link rel="icon" href="icons/icon-192.png">
<style>body{margin:0;background:#f4f5f8;color:#1e293b;font:16px/1.85 Tahoma,"Segoe UI",Arial,sans-serif}main{max-width:780px;margin:0 auto;padding:24px 18px 60px}
header{background:#0e1c36;color:#fff;padding:18px;text-align:center}header b{font-size:20px}header span{display:block;color:#cbd5e1;font-size:13px}
.card{background:#fff;border-radius:14px;padding:20px 22px;margin-top:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}h1{font-size:24px;color:#0e1c36;margin:0 0 6px}h3{color:#0e1c36;margin:22px 0 6px;font-size:17px}
.upd{color:#64748b;font-size:13px}a{color:#9a6b2e}nav{text-align:center;margin-top:18px;font-size:14px}nav a{margin:0 8px}[dir=ltr]{text-align:left}</style></head>
<body><header><b>عمر الياسي للعقارات</b><span>Omar Al Yassi Real Estate</span></header><main>
<div class="card"><h1>${LEGAL[k][0]}</h1>${fix(LEGAL[k][1])}</div>
<div class="card" dir="ltr" lang="en"><h1>${{ privacy: 'Privacy policy', terms: 'Terms of use', delete: 'Delete your account and data' }[k]}</h1>${fix(RAW_EN[k])}</div>
<nav><a href="privacy.html">سياسة الخصوصية</a>·<a href="terms.html">شروط الاستخدام</a>·<a href="delete-account.html">حذف الحساب</a></nav></main></body></html>`);
  };
  page('privacy', 'privacy.html'); page('terms', 'terms.html'); page('delete', 'delete-account.html');
}
writeFileSync('web/manifest.webmanifest', JSON.stringify({
  name: 'عمر الياسي للعقارات', short_name: 'عمر الياسي', lang: 'ar', dir: 'rtl',
  start_url: './', scope: './', display: 'standalone', background_color: '#ffffff', theme_color: '#0e1c36',
  icons: [192, 512].map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })),
}, null, 1));
writeFileSync('web/sw.js', `// push notifications (OneSignal) + offline shell — app files cached, data always fetched fresh
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) {}
const C = 'oay-${V}';
const SHELL = ['./', 'index.html', 'app.js?v=${V}', 'app.css?v=${V}', 'assets/logo.png', 'assets/emblem.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('data.json') || u.pathname.includes('/pdf/')) return;   // data and project PDFs: always from the network
  const put = (res) => { if (res.ok) { const cp = res.clone(); caches.open(C).then((c) => c.put(e.request, cp)); } return res; };
  // pages: always try the network first so updates show up right away; versioned files: cache first
  if (e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html') || u.pathname.endsWith('sw.js')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(put).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then(put)));
});
`);
writeFileSync('web/.nojekyll', '');
if (!existsSync('web/icons')) mkdirSync('web/icons');
console.log('web app built');
