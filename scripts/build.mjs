// Bundles the app into www/ (JS, CSS, fonts).
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('www/fonts', { recursive: true });
mkdirSync('www/assets', { recursive: true });
for (const s of ['arabic', 'latin']) for (const w of [400, 500, 700, 800]) {
  copyFileSync(`node_modules/@fontsource/tajawal/files/tajawal-${s}-${w}-normal.woff2`, `www/fonts/tajawal-${s}-${w}.woff2`);
}
copyFileSync('src/app.css', 'www/app.css');
copyFileSync('src/img/villa-invest.jpg', 'www/assets/villa-invest.jpg');   // photo for investment villas (ground + 2)
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020', 'chrome89'], outfile: 'www/app.js', legalComments: 'none' });
console.log('built www/');
