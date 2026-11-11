import { ei } from './icons.js';
// «إحصائيات الإعلان»: how many saw a listing in the app and how many called / sent WhatsApp / shared / asked for a call,
// day by day (7, 30 or 90 days). The office sees every listing; a member sees their own listings only.
import { api } from './owner.js';

let H = null;
export function initStats(h) { H = h; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nf = new Intl.NumberFormat('en-US');
const KINDS = [['view', 'مشاهدة', ei('eye')], ['call', 'اتصال', ei('phone')], ['wa', 'واتساب', ei('chat')], ['form', 'طلب اتصال', ei('doc')], ['share', 'مشاركة', ei('share')]];
const RANGE = (d) => `<div class="seg stseg">${[[7, '7 أيام'], [30, '30 يوم'], [90, '3 أشهر']].map(([n, l]) => `<button data-days="${n}" class="${n === d ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const contacts = (t) => (t.call || 0) + (t.wa || 0) + (t.form || 0);
/** ▲ 12% / ▼ 8% against the period before (nothing when there is no earlier number) */
const trend = (now, before) => {
  if (!before) return now ? '<em class="sttr new">جديد</em>' : '';
  const p = Math.round((now - before) / before * 100);
  return p === 0 ? '<em class="sttr">ثابت</em>' : `<em class="sttr ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</em>`;
};
/** the headline band: views, contacts, contact rate — each against the period before */
function hero(t, prev, days) {
  const ct = contacts(t), pct = contacts(prev || {}), rate = t.view ? Math.round(ct / t.view * 1000) / 10 : 0, prate = prev && prev.view ? Math.round(pct / prev.view * 1000) / 10 : 0;
  return `<div class="sthero">
      <div class="sth-main"><span>المشاهدات · آخر ${days === 90 ? '3 أشهر' : days + (days === 7 ? ' أيام' : ' يوم')}</span><b>${nf.format(t.view || 0)}</b>${prev ? trend(t.view || 0, prev.view || 0) : ''}</div>
      <div class="sth-side"><div><span>تواصل</span><b>${nf.format(ct)}</b>${prev ? trend(ct, pct) : ''}</div><div><span>نسبة التواصل</span><b>${rate}%</b>${prev && prate ? trend(rate, prate) : ''}</div></div>
    </div>`;
}
const tiles = (t) => `<div class="sttiles">${KINDS.slice(1).map(([k, l, i]) => `<div class="sttile ${k}"><span>${i}</span><div><b>${nf.format(t[k] || 0)}</b><small>${l}</small></div></div>`).join('')}</div>`;

/** views per day as an area line, the day's contacts as gold bars under it; a few dates along the bottom */
function chart(series) {
  if (!series || !series.length) return '';
  const W = 340, Hh = 140, P = 6, n = series.length, max = Math.max(1, ...series.map((r) => r.view || 0)), cmax = Math.max(1, ...series.map(contacts));
  const x = (i) => P + (n === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (n - 1)), y = (v) => Hh - 4 - v / max * (Hh - 26);
  const line = series.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.view || 0).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${Hh} L${x(0).toFixed(1)},${Hh} Z`;
  const bw = Math.max(2, (W - 2 * P) / n * 0.55);
  const bars = series.map((r, i) => { const c = contacts(r); if (!c) return ''; const h = Math.max(3, c / cmax * 34); return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(Hh - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#c9a14a"><title>${r.d}: ${c} تواصل</title></rect>`; }).join('');
  const lab = (i) => { const d = series[i].d.slice(5).split('-'); return `${+d[1]}/${+d[0]}`; };
  const ticks = n <= 7 ? series.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round(2 * (n - 1) / 3), n - 1];
  const peak = series.reduce((a, r, i) => ((r.view || 0) > (series[a].view || 0) ? i : a), 0);
  return `<div class="stchart"><div class="stch-h"><b>الحركة يوماً بيوم</b><span>أعلى يوم: ${nf.format(series[peak].view || 0)} مشاهدة · ${lab(peak)}</span></div>
    <svg viewBox="0 0 ${W} ${Hh + 18}" preserveAspectRatio="none" class="stsvg">
      <defs><linearGradient id="stg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24407a" stop-opacity=".28"/><stop offset="1" stop-color="#24407a" stop-opacity="0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${W}" y1="${(Hh - 4 - f * (Hh - 26)).toFixed(1)}" y2="${(Hh - 4 - f * (Hh - 26)).toFixed(1)}" stroke="#e8ebf1" stroke-dasharray="3 4"/>`).join('')}
      ${bars}<path d="${area}" fill="url(#stg)"/><path d="${line}" fill="none" stroke="#24407a" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(peak).toFixed(1)}" cy="${y(series[peak].view || 0).toFixed(1)}" r="4" fill="#fff" stroke="#24407a" stroke-width="2"/>
      ${ticks.map((i) => `<text x="${x(i).toFixed(1)}" y="${Hh + 14}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${lab(i)}</text>`).join('')}
    </svg>
    <div class="stleg"><span><i class="ln"></i>المشاهدات</span><span><i style="background:#c9a14a"></i>التواصل (اتصال · واتساب · طلب اتصال)</span></div></div>`;
}

/* ---------- one listing ---------- */
export function statsPage() { return `<div class="pad lstats" id="stBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>`; }
export function initStatsPage(pg, id) {
  const box = pg.querySelector('#stBox'); let days = 30;
  const load = async () => {
    box.innerHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
    try {
      const j = await api('listing_stats', { id, days });
      const t = j.total;
      box.innerHTML = `<h2 class="sth notr">${esc(j.name)}</h2>${RANGE(days)}${hero(t, j.prev, days)}${tiles(t)}
        ${t.view ? '' : '<p class="stnote">لا توجد مشاهدات في هذه الفترة بعد.</p>'}
        ${chart(j.series)}
        <p class="help">الأرقام من التطبيق (أندرويد وآيفون). المشاهدة = فتح صفحة الإعلان. تُحسب الأرقام من تاريخ تفعيل الإحصائيات.</p>`;
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (b) { days = +b.dataset.days; load(); } });
  load();
}

/* ---------- all my listings (office: the most seen listings) ---------- */
export function myStatsPage() { return `<div class="pad lstats" id="msBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>`; }
export function initMyStats(pg) {
  const box = pg.querySelector('#msBox'); let days = 30;
  const load = async () => {
    box.innerHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
    try {
      const j = await api('my_stats', { days });
      const top = Math.max(1, ...j.items.map((x) => x.view || 0));
      box.innerHTML = `${RANGE(days)}${hero(j.total, j.prev, days)}${tiles(j.total)}${chart(j.series)}
        <h3 class="msec">${j.office ? 'الأكثر اهتماماً' : 'إعلاناتي'}<small>${j.items.length ? nf.format(j.items.length) + ' إعلان' : ''}</small></h3>
        ${j.items.length ? `<div class="stlist">${j.items.map((x, i) => { const c = contacts(x); return `<button class="strow2" data-stats="${esc(x.id)}">
            <span class="strk ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="stbody"><b class="notr">${esc(x.name)}</b><span class="stbar"><i style="width:${Math.max(3, Math.round((x.view || 0) / top * 100))}%"></i></span>
              <span class="stmini"><i>${ei('eye')} ${nf.format(x.view || 0)}</i><i class="g">${ei('phone')} ${nf.format(c)} تواصل</i>${x.view ? `<i>${Math.round(c / x.view * 100)}%</i>` : ''}</span></span>
            <em>‹</em></button>`; }).join('')}</div>`
          : `<div class="stempty">${ei('chart')}<b>${j.office ? 'لا توجد بيانات في هذه الفترة' : 'لم تضف إعلانات بعد'}</b></div>`}`;
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (b) { days = +b.dataset.days; load(); } });
  load();
}
