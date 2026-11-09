// Bundles the app into www/ (JS, CSS, fonts).
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('www/fonts', { recursive: true });
mkdirSync('www/assets', { recursive: true });
for (const s of ['arabic', 'latin']) for (const w of [400, 500, 700, 800]) {
  copyFileSync(`node_modules/@fontsource/tajawal/files/tajawal-${s}-${w}-normal.woff2`, `www/fonts/tajawal-${s}-${w}.woff2`);
}
for (const s of ['arabic', 'latin']) for (const w of [700, 800]) copyFileSync(`node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-${s}-${w}-normal.woff2`, `www/fonts/noto-arabic-${s}-${w}.woff2`);   // «قالب عمر الياسي»'s lettering
for (const f of ['aljazeera', 'aljazeera-bold']) copyFileSync(`src/fonts/${f}.woff2`, `www/fonts/${f}.woff2`);   // the app's lettering (Al Jazeera)
mkdirSync('www/leaflet', { recursive: true }); for (const f of ['leaflet.js', 'leaflet.css']) copyFileSync(`node_modules/leaflet/dist/${f}`, `www/leaflet/${f}`);   // «الخريطة» (loaded only when opened)
copyFileSync('src/app.css', 'www/app.css');
copyFileSync('src/img/villa-invest.jpg', 'www/assets/villa-invest.jpg');   // photo for investment villas (ground + 2)
copyFileSync('src/img/projmap.jpg', 'www/assets/projmap.jpg');   // the «خريطة المشاريع» slide
for (const f of ['adv-logo.jpg', 'adv-avatar.jpg', 'pp-head.jpg', 'pp-foot.jpg', 'pp-emblem.jpg']) copyFileSync(`src/img/${f}`, `www/assets/${f}`);   // the advertiser strip on every listing card
mkdirSync('www/assets/ad', { recursive: true }); mkdirSync('www/pdfjs', { recursive: true });
for (const f of ['aya-base.jpg', 'aya-icons.png', 'ayk-base.jpg', 'ayk-icons.png', 'oy-flag.png', 'ar-icons.png', 'ar-avatar.jpg']) copyFileSync(`src/img/ad/${f}`, `www/assets/ad/${f}`);   // the fixed artwork of Aya's ad template
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) copyFileSync(`node_modules/pdfjs-dist/legacy/build/${f}`, `www/pdfjs/${f}`);   // reading land PDFs in the ad designer
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'chrome89'], outfile: 'www/app.js', legalComments: 'none', define: { __VERSION__: JSON.stringify(process.env.APP_VERSION || '1.0') } });
console.log('built www/');
