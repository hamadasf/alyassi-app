// Where a plot sits in its block, read from the plan: «زاوية» (open on two sides that meet), «سكة» (beside a lane of
// 10 m or less) or «عادية». The same reading as the website's ad designer. p = { n, p: outline, c: centre, m2 }.
export function plotSide(p, all) {
  if (!p || !p.p || p.p.length < 3) return '';
  const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const u = Math.sqrt(area / (p.m2 || 1)); if (!(u > 0)) return '';   // plan units in one metre
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
  const open = edges.filter((e) => e.gap > 2); if (!open.length) return 'عادية';
  const widest = open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]);
  const turn = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); if (x > Math.PI) x = 2 * Math.PI - x; return x; };
  if (open.some((e) => open.some((f) => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return 'زاوية';
  if (open.some((e) => e !== widest && e.gap <= 10)) return 'سكة';
  return 'عادية';
}
/** adds `side` to each listed land of a project, from the whole plan's plot outlines */
export function addSides(lands, planPlots) {
  const all = (planPlots || []).filter((q) => q[6] && q[6].length > 2).map(([n, , , m2, , , poly, pc]) => ({ n: String(n), p: poly, m2, c: pc || [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length] }));
  if (!all.length) return;
  for (const l of lands) {
    const me = all.find((q) => q.n === l.n); if (!me) continue;
    try { l.side = plotSide(me, all); } catch { /* unreadable outline */ }
  }
}
