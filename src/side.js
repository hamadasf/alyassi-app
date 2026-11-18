// Where a plot sits in its block, read from the plan: «زاوية» (open on two sides that meet), «سكة» (beside a lane of
// 10 m or less) or «عادية». The same reading as the website's ad designer. p = { n, p: outline, c: centre, m2 }.
export function plotSide(p, all) { const w = plotWhere(p, all); return w ? w.side : ''; }
/** → { side, main, park }: «زاوية/سكة/عادية», facing a wide road (30 m+ open in front), facing a garden */
export function plotWhere(p, all, isPark = () => false) {
  if (!p || !p.p || p.p.length < 3) return null;
  const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const u = Math.sqrt(area / (p.m2 || 1)); if (!(u > 0)) return null;   // plan units in one metre
  const inside = (q, x, y) => { let a = false; for (let i = 0, j = q.p.length - 1; i < q.p.length; j = i++) { const [xi, yi] = q.p[i], [xj, yj] = q.p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; } return a; };
  const R = 45 * u, near = all.filter((q) => q.n !== p.n && q.p && Math.abs(q.c[0] - p.c[0]) < R + 80 * u && Math.abs(q.c[1] - p.c[1]) < R + 80 * u);
  let park = false; const hit = (x, y, k) => near.some((q) => { if (!inside(q, x, y)) return false; if (k <= 25 && isPark(q)) park = true; return true; });
  let longest = 0; p.p.forEach((q, i) => { const r = p.p[(i + 1) % p.p.length]; longest = Math.max(longest, Math.hypot(r[0] - q[0], r[1] - q[1])); });
  const edges = [];
  p.p.forEach((q, i) => {
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]); if (L < Math.max(3 * u, longest * 0.25)) return;
    let nx = (r[1] - q[1]) / L, ny = -(r[0] - q[0]) / L; if (!inside(p, (q[0] + r[0]) / 2 - nx * 0.5 * u, (q[1] + r[1]) / 2 - ny * 0.5 * u)) { nx = -nx; ny = -ny; }
    const gaps = [0.25, 0.5, 0.75].map((f) => { const x = q[0] + (r[0] - q[0]) * f, y = q[1] + (r[1] - q[1]) * f; for (let k = 1; k <= 45; k++) if (hit(x + nx * k * u, y + ny * k * u, k)) return k; return 99; }).sort((a, b) => a - b);
    edges.push({ gap: gaps[1], a: Math.atan2(ny, nx) });
  });
  const open = edges.filter((e) => e.gap > 2), main = open.some((e) => e.gap >= 30); if (!open.length) return { side: 'عادية', main, park };
  const widest = open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]);
  const turn = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); if (x > Math.PI) x = 2 * Math.PI - x; return x; };
  if (open.some((e) => open.some((f) => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return { side: 'زاوية', main, park };
  if (open.some((e) => e !== widest && e.gap <= 10)) return { side: 'سكة', main, park };
  return { side: 'عادية', main, park };
}
/* a plan colour class labelled with alternatives («شارع رئيسي · زاوية · حديقة» = any of them): each plot gets only the
   ones that are true for it, read from the plan */
const FEAT = [['شارع رئيسي', 'main', 'على الشارع الرئيسي'], ['زاوية', 'corner', 'زاوية'], ['حديقة', 'park', 'مطلة على الحديقة']];
export function ownTag(l, w) {
  const parts = String(l.tag || '').split(/\s*[·•،,]\s*/).filter(Boolean);
  const feats = parts.filter((x) => FEAT.some(([k]) => x.includes(k)));
  if (feats.length < 2 || !w) return;   // a plain label (one thing) stays as the website wrote it
  const yes = { main: w.main, corner: w.side === 'زاوية', park: w.park };
  const keep = parts.filter((x) => { const f = FEAT.find(([k]) => x.includes(k)); return !f || yes[f[1]]; });
  l.tag = keep.join(' · ');
  l.loc = FEAT.filter(([, k]) => yes[k]).map(([, , txt]) => txt).join(' و') || '';
}
/** adds `side` to each listed land of a project, from the whole plan's plot outlines (and narrows an «a · b · c» label) */
export function addSides(lands, planPlots, types = {}) {
  const all = (planPlots || []).filter((q) => q[6] && q[6].length > 2).map(([n, t, , m2, , , poly, pc]) => ({ n: String(n), t, p: poly, m2, c: pc || [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length] }));
  if (!all.length) return;
  // a garden only when the plan says so (a class named a garden) — a green colour alone can be anything (services, a mosque…)
  const isPark = (q) => /^(park|garden)/i.test(String(q.t || '')) || /حديقة|حدائق|منتزه/.test(String((types[q.t] || {}).use || ''));
  for (const l of lands) {
    const me = all.find((q) => q.n === l.n); if (!me) continue;
    try { const w = plotWhere(me, all, isPark); if (w) { l.side = w.side; ownTag(l, w); } } catch { /* unreadable outline */ }
  }
}
