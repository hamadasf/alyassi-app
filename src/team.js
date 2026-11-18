// «نشاط الفريق» (the admin and the managers): each team member with their role, online / last seen, last sign-in and
// what they did in the chosen period (designs, shares, plots, replies); tap a person → their timeline.
import { api } from './owner.js';
import { uiPrompt } from './dialog.js';

let H = null;
export function initTeam(h) { H = h; }
const ICON = { login: 'user', design: 'image', share_design: 'share', save_img: 'download', share_land: 'share', plot_new: 'plusc', plot_edit: 'edit', chat: 'chat', lead: 'user', hold: 'clock', deal: 'brief' };
const COUNTED = [['design', 'تصميم'], ['share_design', 'مشاركة تصميم'], ['share_land', 'مشاركة أرض'], ['plot_new', 'أرض جديدة'], ['plot_edit', 'تعديل أرض'], ['chat', 'رد على عميل'], ['lead', 'متابعة عميل'], ['hold', 'حجز مؤقت'], ['deal', 'صفقة']];
/** this month against the monthly target the admin set (posts, clients followed, holds, deals) */
const GOALS = [['posts', 'منشورات'], ['clients', 'متابعة عملاء'], ['holds', 'حجوزات'], ['deals', 'صفقات']];
const pctOf = (u) => { const t = u.target || {}, m = u.month || {}; const ks = GOALS.filter(([k]) => +t[k]); if (!ks.length) return null; return Math.round(ks.reduce((a, [k]) => a + Math.min(1, (+m[k] || 0) / +t[k]), 0) / ks.length * 100); };
function goalHTML(u, boss) {
  const t = u.target || {}, m = u.month || {}, has = GOALS.some(([k]) => +t[k]);
  const month = new Date().toLocaleDateString('ar-AE', { month: 'long' });
  return `<div class="ccard tm-goal"><div class="tm-gh"><b>الهدف الشهري · ${month}</b>${has ? `<em>${pctOf(u)}%</em>` : ''}</div>
    ${has ? GOALS.filter(([k]) => +t[k]).map(([k, l]) => { const v = +m[k] || 0, p = Math.min(100, Math.round(v * 100 / +t[k])); return `<div class="tm-gr"><span>${l}</span><i><s style="width:${p}%"></s></i><small>${v} / ${t[k]}</small></div>`; }).join('') : '<p class="muted">لم يُحدَّد هدف لهذا الشهر.</p>'}
    ${boss ? `<button class="btn ghost sm" data-tgoal="${u.id}">${has ? 'تعديل الهدف' : 'تحديد الهدف الشهري'}</button>` : ''}</div>`;
}
/** «لوحة الأداء»: what counts most for selling, side by side — the posts, the clients followed, the holds and the deals */
const BOARD = [['منشورات', ['design', 'share_design', 'save_img', 'share_land']], ['عملاء', ['lead', 'chat']], ['حجوزات', ['hold']], ['صفقات', ['deal']]];
/** «رابط الموظف»: opens of their links · clients who signed up / came from them */
const refN = (u) => { const r = u.ref || {}; return { click: +r.click || 0, got: (+r.reg || 0) + (+r.lead || 0) }; };
const refTd = (u) => { const { click, got } = refN(u); return `<td class="${click || got ? 'tm-ref' : 'z'}">${click}${got ? `<small>+${got} 👤</small>` : ''}</td>`; };
const score = (c) => BOARD.reduce((a, [, ks], i) => a + ks.reduce((b, k) => b + (+c[k] || 0), 0) * [1, 2, 4, 10][i], 0);
const ago = (ms) => {
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'الآن'; if (s < 3600) return `قبل ${Math.round(s / 60)} د`; if (s < 86400) return `قبل ${Math.round(s / 3600)} س`;
  const d = Math.round(s / 86400); return d === 1 ? 'أمس' : d < 30 ? `قبل ${d} يوم` : new Date(ms).toLocaleDateString('ar-AE');
};
const when = (ms) => {   // short: «10:27 ص» today, «أمس 9:11 ص», else «15/11 9:11 ص»
  const d = new Date(ms), t = d.toLocaleTimeString('ar-AE', { hour: 'numeric', minute: '2-digit' }), n = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(n) - day(d)) / 864e5);
  return diff === 0 ? t : diff === 1 ? 'أمس ' + t : `${d.getDate()}/${d.getMonth() + 1} ${t}`;
};

export function teamPage() { return '<div class="pad team"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export function initTeamPage(pg) {
  const { esc, I } = H; const el = pg.querySelector('.team');
  let days = 7, who = 0, data = null;
  const ic = (k) => I[ICON[k]] || I.dot || '';
  const draw = () => {
    const j = data; const person = who && j.team.find((x) => x.id === who);
    const total = (c) => COUNTED.reduce((a, [k]) => a + (+c[k] || 0), 0);
    el.innerHTML = `<div class="tm-top"><div class="seg tm-days">${[[1, 'اليوم'], [7, 'أسبوع'], [30, 'شهر']].map(([d, l]) => `<button class="${d === days ? 'on' : ''}" data-tdays="${d}">${l}</button>`).join('')}</div>
        ${person ? `<button class="btn ghost sm" data-twho="0">كل الفريق</button>` : ''}</div>
      ${person || !j.team.length ? '' : `<div class="ccard tm-board"><h3 class="lh">${I.chart || ''} لوحة الأداء · ${days === 1 ? 'اليوم' : days === 7 ? 'آخر أسبوع' : 'آخر شهر'}</h3>
        <table><thead><tr><th></th>${BOARD.map(([l]) => `<th>${l}</th>`).join('')}<th title="فتحوا روابطه · سجّلوا منها">روابطه</th>${j.team.some((u) => pctOf(u) !== null) ? '<th>الهدف</th>' : ''}</tr></thead><tbody>${[...j.team].sort((a, b) => score(b.counts) - score(a.counts)).map((u, i) => `<tr data-twho="${u.id}"><td><b>${i < 3 && score(u.counts) ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}${esc(u.name)}</b></td>${BOARD.map(([, ks]) => { const v = ks.reduce((a, k) => a + (+u.counts[k] || 0), 0); return `<td class="${v ? '' : 'z'}">${v}</td>`; }).join('')}${refTd(u)}${j.team.some((x) => pctOf(x) !== null) ? `<td class="tm-pc">${pctOf(u) === null ? '—' : pctOf(u) + '%'}</td>` : ''}</tr>`).join('')}</tbody></table></div>`}
      ${person ? '' : `<div class="tm-list">${j.team.map((u) => `<button class="tm-row" data-twho="${u.id}">
          <span class="tm-av">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u.name || '?').charAt(0))}${u.online ? '<i class="tm-on"></i>' : ''}</span>
          <span class="tm-info"><b>${esc(u.name)}</b><em class="tm-role r-${esc(u.role)}">${esc(u.roleLabel)}</em>
            <small>${u.online ? '<span class="ok">متصل الآن</span>' : 'آخر ظهور ' + ago(u.seen)}${u.login ? ' · آخر دخول ' + ago(u.login) : ''}</small>
            <span class="tm-chips">${COUNTED.filter(([k]) => +u.counts[k]).map(([k, l]) => `<i>${ic(k)}${u.counts[k]} ${l}</i>`).join('') || '<i class="none">لا نشاط في هذه الفترة</i>'}</span></span>
          <span class="tm-n"><b>${total(u.counts)}</b><small>نشاط</small></span></button>`).join('') || '<p class="muted">لا يوجد موظفون بعد.</p>'}</div>`}
      ${person ? `<div class="ccard tm-head"><span class="tm-av big">${person.avatar ? `<img src="${esc(person.avatar)}" alt="">` : esc((person.name || '?').charAt(0))}</span>
          <div><b>${esc(person.name)}</b><em class="tm-role r-${esc(person.role)}">${esc(person.roleLabel)}</em><small>${person.online ? 'متصل الآن' : 'آخر ظهور ' + ago(person.seen)}${person.login ? ' · آخر دخول ' + when(person.login) : ''}</small></div></div>
        <div class="tm-kpis">${COUNTED.map(([k, l]) => `<div><b>${+person.counts[k] || 0}</b><span>${l}</span></div>`).join('')}<div><b>${refN(person).click}</b><span>فتحوا روابطه</span></div><div><b>${refN(person).got}</b><span>عملاء من روابطه</span></div></div>
        ${goalHTML(person, j.boss)}` : ''}
      <h3 class="msec">${person ? 'سجل النشاط' : 'آخر نشاط الفريق'}</h3>
      <div class="tm-feed">${j.feed.length ? j.feed.map((e) => { const u = j.team.find((x) => x.id === e.u); return `<div class="tm-ev k-${esc(e.k)}"${e.r && e.r.includes(':') && e.k !== 'chat' ? ` data-tland="${esc(e.r.split('|')[0])}"` : ''}>
          <span class="tm-ic">${ic(e.k)}</span><div><b>${person ? '' : esc(u ? u.name : '') + ' · '}${esc(j.kinds[e.k] || e.k)}</b><span>${esc(e.x)}</span></div><small>${when(e.t)}</small></div>`; }).join('') : '<p class="muted">لا يوجد نشاط في هذه الفترة.</p>'}</div>`;
  };
  const load = async () => {
    try { data = await api('team_report', { days, user: who || '' }); draw(); }
    catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-tdays]'); if (d) { days = +d.dataset.tdays; load(); return; }
    const w = e.target.closest('[data-twho]'); if (w) { who = +w.dataset.twho; el.scrollTop = 0; load(); return; }
    const l = e.target.closest('[data-tland]'); if (l && H.openLand) H.openLand(l.dataset.tland);
    const g = e.target.closest('[data-tgoal]');
    if (g) {
      const u = data.team.find((x) => x.id === +g.dataset.tgoal) || {}; const t = u.target || {};
      uiPrompt('اكتب الأرقام بالترتيب: منشورات - متابعة عملاء - حجوزات - صفقات (اكتب 0 لما لا تريد له هدفاً)', GOALS.map(([k]) => +t[k] || 0).join(' - '), { title: 'الهدف الشهري لـ ' + (u.name || '') }).then(async (v) => {
        if (v === null) return; const n = (v.match(/\d+/g) || []).map(Number);
        try { await api('adm_targets_save', { user: u.id, posts: n[0] || 0, clients: n[1] || 0, holds: n[2] || 0, deals: n[3] || 0 }); H.toast('تم حفظ الهدف ✓'); load(); } catch (ex) { H.toast(ex.message); }
      });
    }
  });
  load();
}
