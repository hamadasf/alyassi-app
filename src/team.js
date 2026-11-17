// «نشاط الفريق» (the admin and the managers): each team member with their role, online / last seen, last sign-in and
// what they did in the chosen period (designs, shares, plots, replies); tap a person → their timeline.
import { api } from './owner.js';

let H = null;
export function initTeam(h) { H = h; }
const ICON = { login: 'user', design: 'image', share_design: 'share', save_img: 'download', share_land: 'share', plot_new: 'plusc', plot_edit: 'edit', chat: 'chat', lead: 'user', hold: 'clock', deal: 'brief' };
const COUNTED = [['design', 'تصميم'], ['share_design', 'مشاركة تصميم'], ['share_land', 'مشاركة أرض'], ['plot_new', 'أرض جديدة'], ['plot_edit', 'تعديل أرض'], ['chat', 'رد على عميل'], ['lead', 'متابعة عميل'], ['hold', 'حجز مؤقت'], ['deal', 'صفقة']];
/** «لوحة الأداء»: what counts most for selling, side by side — the posts, the clients followed, the holds and the deals */
const BOARD = [['منشورات', ['design', 'share_design', 'save_img', 'share_land']], ['عملاء', ['lead', 'chat']], ['حجوزات', ['hold']], ['صفقات', ['deal']]];
const score = (c) => BOARD.reduce((a, [, ks], i) => a + ks.reduce((b, k) => b + (+c[k] || 0), 0) * [1, 2, 4, 10][i], 0);
const ago = (ms) => {
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'الآن'; if (s < 3600) return `قبل ${Math.round(s / 60)} د`; if (s < 86400) return `قبل ${Math.round(s / 3600)} س`;
  const d = Math.round(s / 86400); return d === 1 ? 'أمس' : d < 30 ? `قبل ${d} يوم` : new Date(ms).toLocaleDateString('ar-AE');
};
const when = (ms) => new Date(ms).toLocaleString('ar-AE', { weekday: 'short', day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' });

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
        <table><thead><tr><th></th>${BOARD.map(([l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${[...j.team].sort((a, b) => score(b.counts) - score(a.counts)).map((u, i) => `<tr data-twho="${u.id}"><td><b>${i < 3 && score(u.counts) ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}${esc(u.name)}</b></td>${BOARD.map(([, ks]) => { const v = ks.reduce((a, k) => a + (+u.counts[k] || 0), 0); return `<td class="${v ? '' : 'z'}">${v}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`}
      ${person ? '' : `<div class="tm-list">${j.team.map((u) => `<button class="tm-row" data-twho="${u.id}">
          <span class="tm-av">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u.name || '?').charAt(0))}${u.online ? '<i class="tm-on"></i>' : ''}</span>
          <span class="tm-info"><b>${esc(u.name)}</b><em class="tm-role r-${esc(u.role)}">${esc(u.roleLabel)}</em>
            <small>${u.online ? '<span class="ok">متصل الآن</span>' : 'آخر ظهور ' + ago(u.seen)}${u.login ? ' · آخر دخول ' + ago(u.login) : ''}</small>
            <span class="tm-chips">${COUNTED.filter(([k]) => +u.counts[k]).map(([k, l]) => `<i>${ic(k)}${u.counts[k]} ${l}</i>`).join('') || '<i class="none">لا نشاط في هذه الفترة</i>'}</span></span>
          <span class="tm-n"><b>${total(u.counts)}</b><small>نشاط</small></span></button>`).join('') || '<p class="muted">لا يوجد موظفون بعد.</p>'}</div>`}
      ${person ? `<div class="ccard tm-head"><span class="tm-av big">${person.avatar ? `<img src="${esc(person.avatar)}" alt="">` : esc((person.name || '?').charAt(0))}</span>
          <div><b>${esc(person.name)}</b><em class="tm-role r-${esc(person.role)}">${esc(person.roleLabel)}</em><small>${person.online ? 'متصل الآن' : 'آخر ظهور ' + ago(person.seen)}${person.login ? ' · آخر دخول ' + when(person.login) : ''}</small></div></div>
        <div class="tm-kpis">${COUNTED.map(([k, l]) => `<div><b>${+person.counts[k] || 0}</b><span>${l}</span></div>`).join('')}</div>` : ''}
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
  });
  load();
}
