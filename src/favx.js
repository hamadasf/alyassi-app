// Favourites extras: «قارن» (2–3 lands side by side), «نزل السعر / رجعت متاحة» notices for saved lands
// (in the app, and a push from the server even when the app is closed), and keeping the server's copy of the list.
import { favs, offerFor, STATUS } from './data.js';
import { api, session } from './owner.js';
import { deviceId } from './track.js';

let H = null;
export function initFavx(h) { H = h; }

const NS = 'oay:';
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(NS + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* ignore */ } };
const price = (l) => { const o = offerFor(l); return (o && o.price) || l.total || 0; };
const lands = () => { const m = new Map(H.DATA().lands.map((l) => [l.id, l])); return favs.all().map((id) => m.get(id)).filter(Boolean); };

/* ---------- the server's copy (for the push) ---------- */
let syncT = 0;
export function syncFavs(now) {
  clearTimeout(syncT);
  syncT = setTimeout(() => api('favs_sync', { dev: deviceId(), ids: favs.all().filter((id) => /^[a-z0-9-]+:/.test(id)).slice(0, 100) }).catch(() => {}), now ? 0 : 1500);
}
/** once a day, and after signing in (the list moves from the phone's id to the member) */
export function syncFavsDaily() {
  const k = (session.user() || {}).id || 'd'; const last = lsGet('favsync', {});
  if (last.k === k && Date.now() - (last.t || 0) < 864e5) return;
  lsSet('favsync', { k, t: Date.now() }); syncFavs(true);
}

/* ---------- what changed since the land was saved / last looked at ---------- */
export function snapOne(l) { const s = lsGet('favsnap', {}); s[l.id] = { p: price(l), s: l.status }; lsSet('favsnap', s); }
export function favChanges() {
  const s = lsGet('favsnap', {}); const out = []; let dirty = false;
  for (const l of lands()) {
    const was = s[l.id];
    if (!was) { s[l.id] = { p: price(l), s: l.status }; dirty = true; continue; }
    const p = price(l);
    if (l.status === 'av' && was.s !== 'av') out.push({ l, kind: 'av' });
    else if (l.status === 'av' && p && was.p && p < was.p) out.push({ l, kind: 'down', from: was.p, to: p });
  }
  if (dirty) lsSet('favsnap', s);
  return out;
}
/** the user has seen them (opened the favourites) */
export function favSeen() { const s = {}; for (const l of lands()) s[l.id] = { p: price(l), s: l.status }; lsSet('favsnap', s); }

export function favNoticeHTML() {
  const ch = favChanges(); if (!ch.length) return '';
  const { esc, money } = H;
  return `<div class="favnote"><b>${H.I.heart} تحديثات على أراضٍ في مفضلتك</b>${ch.map((c) => `<button data-land="${esc(c.l.id)}">قطعة ${esc(c.l.n)} · ${esc(c.l.projectName)}<span>${c.kind === 'av' ? 'رجعت متاحة للبيع' : `نزل السعر من ${money(c.from)} إلى ${money(c.to)} د.إ`}</span></button>`).join('')}</div>`;
}
/** a toast once per change when the app opens */
export function favToast() {
  const ch = favChanges(); if (!ch.length) return;
  const key = ch.map((c) => c.l.id + c.kind + (c.to || '')).join('|');
  if (lsGet('favtoast', '') === key) return; lsSet('favtoast', key);
  H.toast(ch.length > 1 ? `❤️ ${ch.length} تحديثات على أراضٍ في مفضلتك` : ch[0].kind === 'av' ? `❤️ قطعة ${ch[0].l.n} في مفضلتك رجعت متاحة` : `❤️ نزل سعر قطعة ${ch[0].l.n} في مفضلتك`);
}

/* ---------- compare ---------- */
let pick = [];
let extra = null;   // the land the compare was opened from, when it is not in the favourites
const pool = () => (extra && !favs.has(extra.id) ? [extra, ...lands()] : lands());
export function comparePage(first) {
  extra = first ? H.findLand(first) : null; const all = pool();
  pick = [first, ...all.map((l) => l.id)].filter((id, i, a) => id && a.indexOf(id) === i && all.some((l) => l.id === id)).slice(0, 3);
  if (pick.length < 2) pick = all.slice(0, 3).map((l) => l.id);
  return `<div class="pad cmp"><p class="muted">اختر حتى 3 أراضٍ للمقارنة (من مفضلتك)</p><div class="cmpchips"></div><div class="cmptbl"></div></div>`;
}
export function initComparePage(pg) {
  const { esc, money } = H; const all = pool();
  const draw = () => {
    pg.querySelector('.cmpchips').innerHTML = all.map((l) => `<button class="${pick.includes(l.id) ? 'on' : ''}" data-cmpk="${esc(l.id)}">قطعة ${esc(l.n)} · ${esc(l.projectName)}</button>`).join('');
    const ls = pick.map((id) => all.find((l) => l.id === id)).filter(Boolean);
    if (ls.length < 2) { pg.querySelector('.cmptbl').innerHTML = '<div class="empty">اختر أرضين على الأقل</div>'; return; }
    const ppf = (l) => (price(l) && l.ft ? price(l) / l.ft : 0);
    const best = Math.min(...ls.map(ppf).filter(Boolean));
    const instOf = (l) => (l.inst && l.inst.length ? `${l.inst.length} أقساط · مقدّم ${money(l.first)}` : l.total ? 'كاش' : '—');
    const rows = [
      ['المشروع', (l) => esc(l.projectName)],
      ['الحالة', (l) => `<span class="badge inline ${(STATUS[l.status] || STATUS.av).cls}">${(STATUS[l.status] || STATUS.av).label}</span>`],
      ['السعر', (l) => (price(l) ? `<b>${money(price(l))}</b> د.إ` : 'عند الاستفسار')],
      ['المساحة', (l) => (l.ft ? `${money(l.ft)} قدم²` : '—')],
      ['سعر القدم', (l) => (ppf(l) ? `<b class="${Math.round(ppf(l)) === Math.round(best) ? 'best' : ''}">${money(ppf(l))}</b> د.إ` : '—')],
      ['الموقع', (l) => esc(l.side || '—')],
      ['الاستخدام', (l) => esc(l.use || '—')],
      ['الارتفاع', (l) => esc(l.floors || '—')],
      ['الدفع', instOf],
    ];
    pg.querySelector('.cmptbl').innerHTML = `<table><thead><tr><th></th>${ls.map((l) => `<th><button data-land="${esc(l.id)}">قطعة ${esc(l.n)}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([k, f]) => `<tr><th>${k}</th>${ls.map((l) => `<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${best ? '<p class="muted small">✓ الأخضر = أقل سعر للقدم</p>' : ''}`;
  };
  pg.querySelector('.cmpchips').onclick = (e) => {
    const b = e.target.closest('[data-cmpk]'); if (!b) return; e.stopPropagation();
    const id = b.dataset.cmpk;
    if (pick.includes(id)) pick = pick.filter((x) => x !== id);
    else if (pick.length >= 3) { H.toast('حتى 3 أراضٍ فقط'); return; } else pick.push(id);
    draw();
  };
  draw();
}
