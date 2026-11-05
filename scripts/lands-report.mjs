// A table of the company's lands (for the office's market comparison): project, plot, use, area, price, price per
// sq ft, status and the plot's position read from the plan (زاوية / سكة / عادية). Run by GitHub Actions on demand.
import { DOMParser } from 'linkedom';
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
globalThis.DOMParser = DOMParser;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const rf = globalThis.fetch; globalThis.fetch = (u, o = {}) => rf(u, { ...o, headers: { 'User-Agent': UA, ...(o.headers || {}) } });
await build({ entryPoints: ['src/data.js'], bundle: true, format: 'esm', platform: 'neutral', outfile: '.snap/data.mjs', logLevel: 'error' });
const { loadAll, rawPlots } = await import(process.cwd() + '/.snap/data.mjs');
const d = await loadAll({ force: true });

// the same reading as the ad designer: open on two sides that meet → زاوية; beside a gap of 10 m or less → سكة
function side(p, all) {
  if (!p.p || p.p.length < 3) return '';
  const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const u = Math.sqrt(area / (p.m2 || 1)); if (!(u > 0)) return '';
  const inside = (q, x, y) => { let a = false; for (let i = 0, j = q.p.length - 1; i < q.p.length; j = i++) { const [xi, yi] = q.p[i], [xj, yj] = q.p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; } return a; };
  const R = 45 * u, near = all.filter((q) => q.n !== p.n && q.p && Math.abs(q.c[0] - p.c[0]) < R + 80 * u && Math.abs(q.c[1] - p.c[1]) < R + 80 * u);
  const hit = (x, y) => near.some((q) => inside(q, x, y));
  let longest = 0; p.p.forEach((q, i) => { const r = p.p[(i + 1) % p.p.length]; longest = Math.max(longest, Math.hypot(r[0] - q[0], r[1] - q[1])); });
  const edges = [];
  p.p.forEach((q, i) => {
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]); if (L < Math.max(3 * u, longest * 0.25)) return;
    let nx = (r[1] - q[1]) / L, ny = -(r[0] - q[0]) / L; if (!inside(p, (q[0] + r[0]) / 2 - nx * 0.5 * u, (q[1] + r[1]) / 2 - ny * 0.5 * u)) { nx = -nx; ny = -ny; }
    const gaps = [0.25, 0.5, 0.75].map((f) => { const x = q[0] + (r[0] - q[0]) * f, y = q[1] + (r[1] - q[1]) * f; for (let k = 1; k <= 45; k++) if (hit(x + nx * k * u, y + ny * k * u)) return k; return 99; }).sort((a, b) => a - b);
    edges.push({ gap: gaps[1], a: Math.atan2(ny, nx) });
  });
  const open = edges.filter((e) => e.gap > 2); if (!open.length) return '';
  const widest = open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]);
  const turn = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); if (x > Math.PI) x = 2 * Math.PI - x; return x; };
  if (open.some((e) => open.some((f) => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return 'زاوية';
  if (open.some((e) => e !== widest && e.gap <= 10)) return 'سكة';
  return 'عادية';
}
const rows = [];
for (const p of d.projects) {
  const raw = rawPlots(p.slug) || [];
  const all = raw.filter((q) => q[6] && q[6].length > 2).map(([n, , , m2, , , poly, pc]) => ({ n: String(n), p: poly, c: pc || [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length], m2 }));
  for (const l of p.lands) {
    const me = all.find((q) => q.n === l.n) || (l.poly ? { n: l.n, p: l.poly, c: l.pc, m2: l.m2 } : null);
    let sd = ''; try { sd = me ? side(me, all) : ''; } catch { sd = ''; }
    rows.push({ project: p.name, slug: p.slug, n: l.n, status: l.status, use: l.use, floors: l.floors, ft: l.ft, total: l.total, ppf: l.total && l.ft ? Math.round(l.total / l.ft) : 0, side: sd, inst: (l.inst || []).length, loc: p.loc || '' });
  }
}
writeFileSync('lands-report.json', JSON.stringify(rows));
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
writeFileSync('lands-report.csv', '﻿' + ['المشروع,القطعة,الحالة,الاستخدام,الطوابق,المساحة قدم,السعر,سعر القدم,الموقع,الأقساط'].concat(rows.map((r) => [r.project, r.n, r.status, r.use, r.floors, r.ft, r.total, r.ppf, r.side, r.inst].map(esc).join(','))).join('\n'));
console.log(`::notice::lands report: ${rows.length} plots`);
// the projects' own descriptions (for the post designer's per-project lines)
writeFileSync('lands-report.projects.json', JSON.stringify(d.projects.map((p) => ({ slug: p.slug, name: p.name, title: p.title, sub: p.sub, note: p.note, loc: p.loc, types: p.types, lands: p.lands.length, na: (p.na || []).length })), null, 1));
// plots that are not for sale (mosques, parks, services…) as the plan has them, to read what is near a plot
writeFileSync('lands-report.amen.json', JSON.stringify(d.projects.map((p) => { const raw = rawPlots(p.slug) || []; const odd = raw.filter((q) => /^#/.test(String(q[0])) || !(p.types || {})[q[1]]); return { slug: p.slug, n: raw.length, typesKeys: Object.keys(p.types || {}), sample: raw.slice(0, 2), odd: odd.slice(0, 40).map((q) => [q[0], q[1], q[2], q[3]]), oddCount: odd.length }; }), null, 1));
