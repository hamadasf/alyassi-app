import { ei } from './icons.js';
// «إحصائيات الإعلان»: how many saw a listing in the app and how many called / sent WhatsApp / shared / asked for a call,
// day by day (7, 30 or 90 days). The office sees every listing; a member sees their own listings only.
import { api } from './owner.js';

let H = null;
export function initStats(h) { H = h; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nf = new Intl.NumberFormat('en-US');
const KINDS = [['view', 'مشاهدة', ei('eye')], ['call', 'اتصال', ei('phone')], ['wa', 'واتساب', ei('chat')], ['form', 'طلب اتصال', ei('doc')], ['share', 'مشاركة', ei('share')]];
const RANGE = (d) => `<div class="seg stseg">${[7, 30, 90].map((n) => `<button data-days="${n}" class="${n === d ? 'on' : ''}">${n} يوم</button>`).join('')}</div>`;
const tiles = (t) => `<div class="sttiles">${KINDS.map(([k, l, i]) => `<div class="sttile ${k}"><span>${i}</span><b>${nf.format(t[k] || 0)}</b><small>${l}</small></div>`).join('')}</div>`;

/** bars: views per day, with the day's contacts (call + WhatsApp + call-back) in green on top */
function chart(series) {
  const W = 340, Hh = 150, n = series.length, bw = W / n, max = Math.max(1, ...series.map((r) => r.view));
  const bars = series.map((r, i) => {
    const vh = Math.round(r.view / max * (Hh - 18)), ct = (r.call || 0) + (r.wa || 0) + (r.form || 0), ch = Math.min(vh, Math.round(ct / max * (Hh - 18)));
    const x = (i * bw + bw * 0.15).toFixed(1), w = Math.max(1, bw * 0.7).toFixed(1);
    return `<rect x="${x}" y="${Hh - vh}" width="${w}" height="${vh}" rx="1.5" fill="#c9d4e8"><title>${r.d}: ${r.view} مشاهدة · ${ct} تواصل</title></rect>${ct ? `<rect x="${x}" y="${Hh - Math.max(ch, 3)}" width="${w}" height="${Math.max(ch, 3)}" rx="1.5" fill="#16a34a"/>` : ''}`;
  }).join('');
  const lab = (i) => { const d = series[i].d.slice(5).split('-'); return `${+d[1]}/${+d[0]}`; };
  return `<div class="stchart"><svg viewBox="0 0 ${W} ${Hh + 16}" preserveAspectRatio="none">${bars}
      <text x="0" y="${Hh + 13}" text-anchor="start">${lab(0)}</text><text x="${W}" y="${Hh + 13}" text-anchor="end">${lab(n - 1)}</text></svg>
    <div class="stleg"><span><i style="background:#c9d4e8"></i>المشاهدات</span><span><i style="background:#16a34a"></i>التواصل (اتصال · واتساب · طلب اتصال)</span><span class="muted">أعلى يوم: ${nf.format(max)}</span></div></div>`;
}

/* ---------- one listing ---------- */
export function statsPage() { return `<div class="pad lstats" id="stBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>`; }
export function initStatsPage(pg, id) {
  const box = pg.querySelector('#stBox'); let days = 30;
  const load = async () => {
    box.innerHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
    try {
      const j = await api('listing_stats', { id, days });
      const t = j.total, ct = t.call + t.wa + t.form, rate = t.view ? Math.round(ct / t.view * 1000) / 10 : 0;
      box.innerHTML = `<h2 class="sth notr">${esc(j.name)}</h2>${RANGE(days)}${tiles(t)}
        <p class="stnote">${t.view ? `نسبة التواصل: <b>${rate}%</b> من المشاهدات` : 'لا توجد مشاهدات في هذه الفترة بعد.'}</p>
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
      box.innerHTML = `${RANGE(days)}${tiles(j.total)}
        <h3 class="msec">${j.office ? 'الإعلانات الأكثر مشاهدة' : 'إعلاناتي'}</h3>
        ${j.items.length ? `<div class="stlist">${j.items.map((x) => `<button class="strow" data-stats="${esc(x.id)}">
            <b class="notr">${esc(x.name)}</b>
            <span><i>${ei('eye')} ${nf.format(x.view)}</i><i>${ei('phone')} ${nf.format(x.call)}</i><i>${ei('chat')} ${nf.format(x.wa)}</i>${x.form ? `<i>${ei('doc')} ${nf.format(x.form)}</i>` : ''}</span><em>‹</em></button>`).join('')}</div>`
          : `<p class="muted">${j.office ? 'لا توجد بيانات في هذه الفترة.' : 'لم تضف إعلانات بعد.'}</p>`}`;
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-days]'); if (b) { days = +b.dataset.days; load(); } });
  load();
}
