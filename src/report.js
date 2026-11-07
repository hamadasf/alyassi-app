import { ei } from './icons.js';
// «التقرير الأسبوعي» for the office: visitors, land views, shares, WhatsApp / call taps, new members and listings,
// compared with the week before, plus the most viewed and most shared lands.
import { api } from './owner.js';

let H = null;
export function initReport(h) { H = h; }
export function reportPage() { return '<div class="pad rep"><div class="ss-state"><i class="spin"></i><span>جارِ إعداد التقرير…</span></div></div>'; }

export async function initReportPage(pg, weeks = 0) {
  const el = pg.querySelector('.rep'); const { esc, money } = H;
  let j; try { j = await api('adm_report', { weeks }); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  const c = j.cur, p = j.prev;
  const dmy = (s) => s.split('-').reverse().slice(0, 2).join('/');
  const delta = (a, b) => { if (!b) return a ? '<em class="up">جديد</em>' : ''; const d = Math.round(((a - b) / b) * 100); return d ? `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}%</em>` : '<em>—</em>'; };
  const kpi = (label, a, b, icon) => `<div class="kpi"><span>${icon} ${label}</span><b>${money(a)}</b>${delta(a, b)}</div>`;
  const C = (o, k) => (o.c && o.c[k]) || 0;
  const name = (x) => { const l = H.findLand(x.id); return l ? `قطعة ${l.n} · ${l.projectName}` : x.name; };
  const list = (title, arr, unit) => `<div class="pcard"><h4>${title}</h4>${arr.length ? arr.map((x, i) => `<button class="rrow" ${/^\d+$/.test(x.id) ? `data-oland="${esc(x.id)}"` : `data-land="${esc(x.id)}"`}><i>${i + 1}</i><span class="notr">${esc(name(x))}</span><b>${money(x.n)} ${unit}</b></button>`).join('') : '<p class="muted">لا توجد بيانات بعد</p>'}</div>`;
  const maxV = Math.max(1, ...c.daily.map((d) => d.dev));
  el.innerHTML = `<div class="rnav"><button data-w="${weeks + 1}">‹ الأسبوع السابق</button><b>${dmy(c.from)} – ${dmy(c.to)}</b><button data-w="${weeks - 1}" ${weeks ? '' : 'disabled'}>التالي ›</button></div>
    <div class="kpis">${kpi('زوار التطبيق', c.visitors, p.visitors, '' + ei('user') + ' ')}${kpi('مرات الفتح', C(c, 'open'), C(p, 'open'), '' + ei('phone') + ' ')}${kpi('مشاهدات الأراضي', C(c, 'view'), C(p, 'view'), '' + ei('eye') + ' ')}
      ${kpi('تواصل واتساب', C(c, 'wa'), C(p, 'wa'), '' + ei('chat') + ' ')}${kpi('اتصالات', C(c, 'call'), C(p, 'call'), '' + ei('phone') + ' ')}${kpi('مشاركات', C(c, 'share'), C(p, 'share'), '' + ei('share') + ' ')}
      ${kpi('فتح المخطط', C(c, 'plan'), C(p, 'plan'), '' + ei('map') + ' ')}${kpi('حاسبة الأقساط', C(c, 'calc'), C(p, 'calc'), '' + ei('calc') + ' ')}${kpi('أعضاء جدد', c.users, p.users, '' + ei('plusc') + ' ')}
      ${kpi('إعلانات جديدة', c.listings, p.listings, '' + ei('doc') + ' ')}${kpi('رسائل خاصة', c.msgs, p.msgs, '' + ei('mail') + ' ')}${kpi('رسائل المجموعة', c.group, p.group, '' + ei('user') + ' ')}</div>
    <div class="pcard"><h4>الزوار يومياً</h4><div class="bars">${c.daily.map((d) => `<div><i style="height:${Math.round((d.dev / maxV) * 100)}%"></i><b>${d.dev}</b><span>${new Date(d.d).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE', { weekday: 'short' })}</span></div>`).join('')}</div></div>
    ${list('الأكثر مشاهدة', c.top.view, 'مشاهدة')}${list('الأكثر سؤالاً عبر واتساب', c.top.wa, 'تواصل')}${list('الأكثر مشاركة', c.top.share, 'مشاركة')}
    <div id="repDemand"></div>
    <p class="muted cnote">الأرقام مجهولة الهوية: معرّف عشوائي لكل جهاز، بدون أسماء أو أرقام. يصلك إشعار بالتقرير كل يوم أحد صباحاً.</p>`;
  // demand: what visitors look for and do not find (last 30 days), and the most-viewed lands still for sale
  api('adm_demand', { weeks }).then((d) => {
    const box = el.querySelector('#repDemand'); if (!box) return;
    box.innerHTML = `<div class="pcard"><h4>${ei('search')} يبحثون عنه ولا يجدونه <small class="muted">آخر 30 يوماً</small></h4>
        ${d.nores.length ? d.nores.map((x, i) => `<div class="rrow"><i>${i + 1}</i><span class="notr">${esc(x.q)}</span><b>${money(x.n)} مرة</b></div>`).join('') : '<p class="muted">لا توجد بيانات بعد — تظهر هنا عمليات البحث والفلاتر التي لم تجد أي أرض</p>'}
        <p class="muted cnote">يساعدك تعرف نوع الأراضي والمساحات والأسعار المطلوبة اللي ناقصة عندك.</p></div>
      <div class="pcard"><h4>${ei('eye')} الأكثر مشاهدة ولم تُبع بعد</h4>
        ${d.unsold.length ? d.unsold.map((x, i) => `<button class="rrow" data-land="${esc(x.id)}"><i>${i + 1}</i><span class="notr">${esc(name(x))}${x.price ? ` · ${money(x.price)} د.إ` : ''}</span><b>${money(x.n)} مشاهدة · ${money(x.wa)} واتساب</b></button>`).join('') : '<p class="muted">لا توجد بيانات بعد</p>'}
        <p class="muted cnote">مشاهدات كثيرة وتواصل قليل = راجع السعر أو اعمل عليها عرض لفترة محدودة.</p></div>`;
  }).catch(() => {});
  el.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { el.innerHTML = reportPage().replace(/^<div class="pad rep">|<\/div>$/g, ''); initReportPage(pg, +b.dataset.w); }; });
}
