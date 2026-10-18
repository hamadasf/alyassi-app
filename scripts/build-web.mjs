// Builds the web / iPhone version into web/ (published on GitHub Pages).
import { build } from 'esbuild';
import { mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync('node', ['scripts/build.mjs'], { stdio: 'inherit' });   // fonts, css, assets into www/
mkdirSync('web', { recursive: true });
cpSync('www', 'web', { recursive: true });
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari14'],
  outfile: 'web/app.js', legalComments: 'none', define: { __SNAPSHOT__: '"./data.json"' },
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
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('data.json')) return;
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
