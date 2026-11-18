// «أراضٍ تحتاج تسويقاً»: which available plots to market next — varied across projects, the best first (featured, priced
// under their project's market, corners and lanes), and never a plot designed or shared in the last COOL days.
export const COOL = 14;   // days a designed / shared plot stays out of the list
const KEY = 'oay:mktDone';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
/** this phone's own record (shows at once, even before the website has it) */
export function markMarketed(ids) {
  const m = lsGet(), now = Date.now(), cut = now - 120 * 864e5;
  for (const id of [].concat(ids)) if (id) m[id] = now;
  for (const k of Object.keys(m)) if (m[k] < cut) delete m[k];
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
/** last time each plot was marketed: the website's record merged with this phone's */
export function lastMarketed(server) { const m = { ...(server || {}) }; for (const [k, v] of Object.entries(lsGet())) m[k] = Math.max(m[k] || 0, v); return m; }

const med = (a) => { const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
/** → ranked plots with { l, score, why[] }, mixed across projects (one from each project in turn, the best project first) */
export function pickForMarketing(lands, last, days = COOL) {
  const cut = Date.now() - days * 864e5;
  const av = lands.filter((l) => l.status === 'av' && (l.poly || l.pc) && !(last[l.id] > cut));
  const grp = {}; lands.filter((l) => l.status === 'av' && l.total && l.ft).forEach((l) => { (grp[l.project + '|' + l.cat] = grp[l.project + '|' + l.cat] || []).push(l.total / l.ft); });
  const ranked = av.map((l) => {
    const g = grp[l.project + '|' + l.cat], why = []; let score = 0;
    if (l.featured) { score += 3; why.push('مميزة'); }
    if (g && g.length >= 3 && l.total && l.ft) {
      const m = med(g), d = m ? (m - l.total / l.ft) / m : 0;
      score += Math.max(-0.3, Math.min(0.4, d)) * 20;
      if (d >= 0.04) why.push(`أقل من سعر المشروع ${Math.round(d * 100)}%`);
    }
    if (l.side === 'زاوية') { score += 1.5; why.push('زاوية'); } else if (l.side === 'سكة') { score += 0.7; why.push('على سكة'); }
    if (!l.total) score -= 4;   // no price: a weak post
    score += last[l.id] ? Math.min(1, (Date.now() - last[l.id]) / (60 * 864e5)) : 1;   // the longer since, the sooner
    return { l, score, why };
  });
  const by = {}; ranked.sort((a, b) => b.score - a.score).forEach((x) => { (by[x.l.project] = by[x.l.project] || []).push(x); });
  const order = Object.values(by).sort((a, b) => b[0].score - a[0].score), out = [];
  for (let i = 0; out.length < ranked.length; i++) for (const q of order) if (q[i]) out.push(q[i]);
  return out;
}
