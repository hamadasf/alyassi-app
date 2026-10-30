// Clients follow-up (office), «مطلوب أرض» requests, «أرض تناسبني» alerts, targeted notifications and the
// Sharjah procedures guide.
import { api, session } from './owner.js';
import { quoteToOffice } from './chat.js';

let H = null;
export function initCrm(h) { H = h; }
const isAdmin = () => !!(session.user() || {}).admin;
const CATS = ['سكني', 'فلل', 'تجاري', 'محلات', 'صناعي'];
const loc = () => (document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE');
const day = (t) => new Date(t).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 60) return `قبل ${Math.max(1, m)} د`; const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`; return day(t); };
const projOpts = (sel = '') => `<option value="">أي مشروع</option>${H.DATA().projects.map((p) => `<option value="${H.esc(p.slug)}"${p.slug === sel ? ' selected' : ''}>${H.esc(p.name)}</option>`).join('')}`;
const catOpts = (sel = '') => `<option value="">أي نوع</option>${CATS.map((c) => `<option${c === sel ? ' selected' : ''}>${c}</option>`).join('')}`;
const num = (v) => +String(v || '').replace(/[^\d]/g, '') || 0;
const needLogin = (msg) => { if (session.token()) return false; H.toast(msg); H.pushPage('account'); return true; };
const loading = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';

/* =============================== «مطلوب أرض» =============================== */
function wantedCard(w, mine, admin) {
  const { esc, money } = H;
  const chips = [w.projectName && `📍 ${esc(w.projectName)}`, w.area && `🗺️ ${esc(w.area)}`, w.budget && `💰 حتى ${money(w.budget)} د.إ`,
    (w.minFt || w.maxFt) && `📐 ${w.minFt ? money(w.minFt) : '0'}–${w.maxFt ? money(w.maxFt) : '∞'} قدم²`, w.pay && w.pay !== 'any' && (w.pay === 'cash' ? '💵 كاش' : '🗓️ أقساط')].filter(Boolean);
  const st = { approved: ['منشور', 'ok'], pending: ['بانتظار الموافقة', 'wait'], rejected: ['غير منشور', 'no'] }[w.status];
  return `<article class="wcard"><div class="wtop"><b>مطلوب ${esc(w.cat || 'أرض')}</b>${mine || admin ? `<i class="pill ${st[1]}">${st[0]}</i>` : ''}<time>${ago(w.date)}</time></div>
    <div class="wchips">${chips.map((c) => `<span>${c}</span>`).join('')}</div>
    ${w.notes ? `<p class="notr">${esc(w.notes)}</p>` : ''}
    <div class="wfoot"><small>${w.by ? `بواسطة <span class="notr">${esc(w.by)}</span>` : ''}</small>
      ${admin && w.user ? `<button class="btn ghost sm" data-lead="${w.user.id}">👤 ملف العميل</button>` : ''}
      ${admin && w.status === 'pending' ? `<button class="btn wa sm" data-wok="${w.id}">✓ نشر</button><button class="btn ghost sm" data-wno="${w.id}">✕</button>` : ''}
      ${mine || admin ? `<button class="btn ghost sm danger" data-wdel="${w.id}">حذف</button>` : `<button class="btn primary sm" data-whave="${w.id}">عندي أرض تناسب</button>`}</div></article>`;
}
export function wantedPage() {
  return `<div class="pad wanted"><div class="whead"><div><b>طلبات الشراء</b><span>مشترون يبحثون عن أراضٍ — التواصل عن طريق الإدارة</span></div><button class="btn gold" data-wadd>➕ أضف طلبك</button></div>
    <div class="cseg wtabs"><button class="on" data-wt="all">كل الطلبات</button><button data-wt="mine">طلباتي</button>${isAdmin() ? '<button data-wt="pending">بانتظار الموافقة <i id="wpend"></i></button>' : ''}</div>
    <div id="wlist">${loading}</div></div>`;
}
export function initWanted(pg) {
  const box = pg.querySelector('#wlist'); let tab = 'all', items = [];
  const admin = isAdmin();
  const load = async () => {
    box.innerHTML = loading;
    try {
      if (tab === 'mine') { if (!session.token()) { box.innerHTML = '<p class="muted">سجّل الدخول لعرض طلباتك</p>'; return; } items = (await api('wanted_mine')).items; }
      else if (tab === 'pending') items = (await api('adm_wanted', { status: 'pending' })).items;
      else items = (await api('wanted_list')).items;
      const me = (session.user() || {}).id;
      box.innerHTML = items.length ? items.map((w) => wantedCard(w, tab === 'mine', admin)).join('') : `<div class="cempty">${H.I.search}<p>${tab === 'mine' ? 'لم تضف طلبات بعد' : 'لا توجد طلبات حالياً'}</p></div>`;
      if (admin && tab !== 'pending') { try { const j = await api('adm_wanted', { status: 'pending' }); const b = pg.querySelector('#wpend'); if (b) b.textContent = j.pending || ''; } catch { /* ignore */ } }
      void me;
    } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; }
  };
  pg.querySelectorAll('[data-wt]').forEach((b) => { b.onclick = () => { tab = b.dataset.wt; pg.querySelectorAll('[data-wt]').forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  pg.querySelector('[data-wadd]').onclick = () => { if (!needLogin('سجّل الدخول لإضافة طلب شراء')) H.pushPage('wantedadd'); };
  box.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const w = items.find((x) => String(x.id) === (t.dataset.whave || t.dataset.wdel || t.dataset.wok || t.dataset.wno));
    try {
      if (t.dataset.whave && w) { if (needLogin('سجّل الدخول للتواصل مع الإدارة')) return; quoteToOffice(`عندي أرض قد تناسب طلب الشراء: مطلوب ${w.cat || 'أرض'}${w.projectName ? ' في ' + w.projectName : ''}${w.budget ? ' حتى ' + H.money(w.budget) + ' د.إ' : ''} (طلب رقم ${w.id})`); H.pushPage('mychat'); }
      else if (t.dataset.wdel) { if (!confirm('حذف هذا الطلب؟')) return; await api('wanted_delete', { id: t.dataset.wdel }); H.toast('تم الحذف'); load(); }
      else if (t.dataset.wok) { await api('adm_wanted_review', { id: t.dataset.wok, approve: '1' }); H.toast('تم نشر الطلب ✓'); load(); }
      else if (t.dataset.wno) { await api('adm_wanted_review', { id: t.dataset.wno, approve: '0' }); H.toast('تم'); load(); }
    } catch (ex) { H.toast(ex.message); }
  });
  pg.addEventListener('oay:refresh', load);
  load();
}
export function wantedAddPage() {
  return `<form class="pad cform ccard wform" id="wform">
    <p class="muted">صف الأرض التي تبحث عنها — يُنشر طلبك بعد مراجعة الإدارة، ورقمك لا يظهر لأحد.</p>
    <div class="cgrid"><label>نوع الأرض<select name="cat">${catOpts()}</select></label><label>المشروع<select name="project">${projOpts()}</select></label></div>
    <label>المنطقة (اختياري)<input name="area" maxlength="80" placeholder="مثال: الرحمانية، طريق مليحة"></label>
    <label>الميزانية القصوى (درهم)<input name="budget" inputmode="numeric" placeholder="مثال: 450,000"></label>
    <div class="cgrid"><label>أقل مساحة (قدم²)<input name="minFt" inputmode="numeric"></label><label>أكبر مساحة (قدم²)<input name="maxFt" inputmode="numeric"></label></div>
    <label>طريقة الدفع<select name="pay"><option value="any">لا يهم</option><option value="cash">كاش</option><option value="inst">أقساط</option></select></label>
    <label>ملاحظات<textarea name="notes" rows="3" maxlength="800" placeholder="زاوية، شارعين، قريبة من الخدمات…"></textarea></label>
    <label class="chkrow"><input type="checkbox" name="alert" checked> نبهني فوراً لما تنزل أرض تناسب طلبي</label>
    <button class="btn primary block">إرسال الطلب</button></form>`;
}
export function initWantedAdd(pg) {
  const f = pg.querySelector('#wform');
  f.onsubmit = async (e) => {
    e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
    const v = (k) => f.elements[k].value.trim();
    try {
      await api('wanted_submit', { cat: v('cat'), project: v('project'), area: v('area'), budget: num(v('budget')), minFt: num(v('minFt')), maxFt: num(v('maxFt')), pay: v('pay'), notes: v('notes'), alert: f.elements.alert.checked ? '1' : '0' });
      H.toast(isAdmin() ? 'تم نشر الطلب ✓' : 'تم إرسال طلبك — يُنشر بعد مراجعة الإدارة ✓');
      document.querySelectorAll('.page').forEach((p) => p.dispatchEvent(new Event('oay:refresh'))); H.closeTop();
    } catch (ex) { H.toast(ex.message); b.disabled = false; }
  };
}

/* =============================== «أرض تناسبني» =============================== */
export function alertsPage(pre = {}) {
  return `<div class="pad alerts">
    <div class="ccard ahead"><b>🔔 أرض تناسبني</b><span>حدد ما تبحث عنه، ونرسل لك إشعاراً فور نزول أرض مطابقة أو انخفاض سعر أرض لنطاقك.</span></div>
    <form class="ccard cform" id="aform">
      <div class="cgrid"><label>المشروع<select name="project">${projOpts(pre.project || '')}</select></label><label>نوع الأرض<select name="cat">${catOpts(pre.cat || '')}</select></label></div>
      <label>السعر الأقصى (درهم)<input name="maxPrice" inputmode="numeric" value="${pre.maxPrice ? H.money(pre.maxPrice) : ''}" placeholder="اختياري"></label>
      <div class="cgrid"><label>أقل مساحة (قدم²)<input name="minFt" inputmode="numeric" value="${pre.minFt || ''}"></label><label>أكبر مساحة (قدم²)<input name="maxFt" inputmode="numeric" value="${pre.maxFt || ''}"></label></div>
      <button class="btn primary block">حفظ التنبيه</button></form>
    <h2 class="h2">تنبيهاتي</h2><div id="alist">${loading}</div></div>`;
}
export function initAlerts(pg) {
  const box = pg.querySelector('#alist'), f = pg.querySelector('#aform');
  const pname = (s) => { const p = H.DATA().projects.find((x) => x.slug === s); return p ? p.name : s; };
  const draw = (items) => {
    box.innerHTML = items.length ? items.map((a) => `<div class="arow"><div><b>${H.esc(a.cat || 'أي نوع')}${a.project ? ' · ' + H.esc(pname(a.project)) : ''}</b>
      <span>${a.maxPrice ? 'حتى ' + H.money(a.maxPrice) + ' د.إ' : 'أي سعر'}${a.minFt || a.maxFt ? ` · ${a.minFt ? H.money(a.minFt) : 0}–${a.maxFt ? H.money(a.maxFt) : '∞'} قدم²` : ''}${a.hits ? ` · ${a.hits} تنبيه أُرسل` : ''}</span></div>
      <button data-adel="${a.id}" aria-label="حذف">🗑</button></div>`).join('') : '<p class="muted">لا توجد تنبيهات بعد.</p>';
  };
  const load = async () => { if (!session.token()) { box.innerHTML = '<p class="muted">سجّل الدخول لحفظ التنبيهات</p>'; return; } try { draw((await api('alert_list')).items); } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; } };
  f.onsubmit = async (e) => {
    e.preventDefault(); if (needLogin('سجّل الدخول لحفظ التنبيه')) return;
    const v = (k) => f.elements[k].value.trim(); const b = f.querySelector('button'); b.disabled = true;
    try { draw((await api('alert_save', { project: v('project'), cat: v('cat'), maxPrice: num(v('maxPrice')), minFt: num(v('minFt')), maxFt: num(v('maxFt')) })).items); H.toast('تم حفظ التنبيه 🔔 — تأكد أن الإشعارات مفعّلة'); }
    catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  };
  box.onclick = async (e) => { const b = e.target.closest('[data-adel]'); if (!b) return; try { draw((await api('alert_delete', { id: b.dataset.adel })).items); } catch (ex) { H.toast(ex.message); } };
  load();
}

/* =============================== client follow-up (office) =============================== */
const SRC = { form: ['📩', 'طلب اتصال'], chat: ['💬', 'محادثة'], wa: ['🟢', 'واتساب'], call: ['📞', 'اتصال'], wanted: ['📝', 'طلب شراء'], alert: ['🔔', 'تنبيه'], calc: ['🧮', 'حاسبة'] };
const ST = { new: 'جديد', follow: 'قيد المتابعة', won: 'تم البيع', lost: 'غير مهتم' };
const avatar = (u) => (u.avatar ? `<span class="acc-av img"><img src="${H.esc(u.avatar)}" alt="" referrerpolicy="no-referrer">${u.online ? '<i class="dot"></i>' : ''}</span>` : `<span class="acc-av">${H.esc((u.name || '?').charAt(0))}${u.online ? '<i class="dot"></i>' : ''}</span>`);
const waUrl = (ph) => { let d = String(ph).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '971' + d; return 'https://wa.me/' + d; };
export function leadsPage() {
  return `<div class="pad leads"><div class="chips scroll lchips"><button class="chip on" data-ls="">الكل</button><button class="chip due" data-ls="due">📅 متابعة اليوم <i></i></button>
    ${Object.entries(ST).map(([k, v]) => `<button class="chip" data-ls="${k}">${v} <i></i></button>`).join('')}</div><div id="llist">${loading}</div></div>`;
}
export function initLeads(pg) {
  const box = pg.querySelector('#llist'); let st = '';
  const load = async () => {
    try {
      const j = await api('adm_leads', { status: st });
      pg.querySelectorAll('[data-ls]').forEach((b) => { const i = b.querySelector('i'); if (i) i.textContent = b.dataset.ls === 'due' ? j.due || '' : j.counts[b.dataset.ls] || ''; });
      box.innerHTML = j.items.length ? j.items.map((r) => `<button class="lrow${r.due ? ' due' : ''}" data-lead="${r.id}">${avatar(r)}
        <div><b class="notr">${H.esc(r.verified && r.company ? r.company : r.name)} ${r.verified ? H.I.verified : ''}</b>
          <span>${r.top ? `${(SRC[r.top.src] || ['•'])[0]} <span class="notr">${H.esc(r.top.name || (SRC[r.top.src] || ['', ''])[1])}</span>` : ''}</span>
          <small>${r.count} اهتمام · ${ago(r.last)}${r.next ? ` · 📅 ${day(r.next)}` : ''}</small></div>
        <i class="lst ${r.status}">${ST[r.status]}</i></button>`).join('') : `<div class="cempty">${H.I.user || ''}<p>لا يوجد عملاء في هذه القائمة</p></div>`;
    } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; }
  };
  pg.querySelectorAll('[data-ls]').forEach((b) => { b.onclick = () => { st = b.dataset.ls; pg.querySelectorAll('[data-ls]').forEach((x) => x.classList.toggle('on', x === b)); box.innerHTML = loading; load(); }; });
  pg.addEventListener('oay:refresh', load);
  load();
}
export function leadPage() { return `<div class="pad lead">${loading}</div>`; }
export async function initLead(pg, id) {
  const el = pg.querySelector('.lead'); const { esc, I } = H;
  let j;
  const render = () => {
    const u = j.user, l = j.lead; const ph = u.phone;
    el.innerHTML = `<div class="ccard lcard">${avatar(u)}<div><b class="notr">${esc(u.verified && u.company ? u.company : u.name)} ${u.verified ? I.verified : ''}</b><span dir="ltr">${esc(ph || u.email)}</span></div></div>
      <div class="lbtns">${ph ? `<a class="btn ghost" href="tel:${esc(ph)}">📞 اتصال</a><a class="btn wa" href="${esc(waUrl(ph))}" data-ext>${I.wa} واتساب</a>` : ''}
        <button class="btn primary" data-chat="${u.id}">💬 محادثة</button><button class="btn ghost" data-prof="${u.id}">👤 الملف</button><button class="btn ghost" data-apush="${u.id}">🔔 إشعار له</button></div>
      <div class="ccard"><h4 class="lh">الحالة</h4><div class="lstates">${Object.entries(ST).map(([k, v]) => `<button class="${l.status === k ? 'on ' : ''}${k}" data-st="${k}">${v}</button>`).join('')}</div>
        <h4 class="lh">موعد المتابعة</h4><div class="lnext"><input type="date" id="lnext" value="${l.next ? new Date(l.next).toISOString().slice(0, 10) : ''}">
          <button data-nd="1">غداً</button><button data-nd="3">بعد 3 أيام</button><button data-nd="7">أسبوع</button>${l.next ? '<button data-nd="0">إلغاء</button>' : ''}</div>
        <h4 class="lh">ملاحظة</h4><textarea id="lnote" rows="2" maxlength="1000" placeholder="مثال: يريد أرض زاوية، يتصل بعد العيد…"></textarea><button class="btn primary block" id="lsave">حفظ الملاحظة</button>
        ${l.notes.length ? `<div class="ltl">${l.notes.map((n) => `<div><time>${day(n.t)}${n.by ? ' · ' + esc(n.by) : ''}</time><p class="notr">${esc(n.text)}</p></div>`).join('')}</div>` : ''}</div>
      <div class="ccard"><h4 class="lh">الاهتمامات (${l.items.length})</h4>${l.items.length ? l.items.map((it) => `<button class="lint" ${/^\d+$/.test(it.lid) ? `data-oland="${esc(it.lid)}"` : it.lid ? `data-land="${esc(it.lid)}"` : ''}><i>${(SRC[it.src] || ['•'])[0]}</i><span><b>${(SRC[it.src] || ['', it.src])[1]}</b> <span class="notr">${esc(it.name || '')}</span></span><time>${ago(it.t)}</time></button>`).join('') : '<p class="muted">—</p>'}</div>
      ${j.wanted.length ? `<div class="ccard"><h4 class="lh">طلبات الشراء</h4>${j.wanted.map((w) => `<p>📝 مطلوب ${esc(w.cat || 'أرض')}${w.projectName ? ' · ' + esc(w.projectName) : ''}${w.budget ? ' · حتى ' + H.money(w.budget) + ' د.إ' : ''}</p>`).join('')}</div>` : ''}
      ${j.alerts.length ? `<div class="ccard"><h4 class="lh">تنبيهات «أرض تناسبني»</h4>${j.alerts.map((a) => `<p>🔔 ${esc(a.cat || 'أي نوع')}${a.maxPrice ? ' · حتى ' + H.money(a.maxPrice) + ' د.إ' : ''}</p>`).join('')}</div>` : ''}`;
  };
  const save = async (body, msg) => { try { const r = await api('adm_lead_save', { id, ...body }); j.lead = r.lead; j.user = r.user; render(); if (msg) H.toast(msg); document.querySelectorAll('.page').forEach((p) => p.dispatchEvent(new Event('oay:refresh'))); } catch (e) { H.toast(e.message); } };
  try { j = await api('adm_lead', { id }); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  render();
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.st) save({ status: t.dataset.st }, 'تم تحديث الحالة');
    else if (t.dataset.nd !== undefined) { const d = +t.dataset.nd; save({ next: d ? new Date(Date.now() + d * 864e5).setHours(9, 0, 0, 0) : 0, status: d && j.lead.status === 'new' ? 'follow' : j.lead.status }, d ? 'تم ضبط موعد المتابعة 📅' : 'تم إلغاء الموعد'); }
    else if (t.id === 'lsave') { const v = el.querySelector('#lnote').value.trim(); if (v) save({ note: v, status: j.lead.status === 'new' ? 'follow' : j.lead.status }, 'تم حفظ الملاحظة'); }
    else if (t.dataset.apush) { e.stopPropagation(); H.pushPage('apush', 'user:' + t.dataset.apush + ':' + (j.user.name || '')); }
  });
  el.addEventListener('change', (e) => { if (e.target.id === 'lnext' && e.target.value) save({ next: new Date(e.target.value + 'T09:00:00').getTime(), status: j.lead.status === 'new' ? 'follow' : j.lead.status }, 'تم ضبط موعد المتابعة 📅'); });
}

/* =============================== targeted notifications (office) =============================== */
const AUD = [['all', 'كل مستخدمي التطبيق'], ['project', 'من تصفّح مشروعاً معيّناً (آخر 45 يوماً)'], ['alerts', 'أصحاب تنبيهات «أرض تناسبني»'], ['leads', 'العملاء قيد المتابعة'], ['offices', 'المكاتب الموثّقة'], ['members', 'كل الأعضاء المسجلين']];
export function apushPage(id = '') {
  const [kind, uid, name] = String(id).split(':');
  const one = kind === 'user';
  return `<form class="pad cform ccard apush" id="pform">
    ${one ? `<input type="hidden" name="audience" value="user"><input type="hidden" name="uid" value="${H.esc(uid)}"><p class="ahead">إشعار خاص إلى: <b class="notr">${H.esc(name || '')}</b></p>`
      : `<label>إلى من؟<select name="audience">${AUD.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label id="pproj" hidden>المشروع<select name="project">${H.DATA().projects.map((p) => `<option value="${H.esc(p.slug)}">${H.esc(p.name)}</option>`).join('')}</select></label>`}
    <p class="muted pcount" id="pcount"></p>
    <label>العنوان<input name="title" maxlength="120" placeholder="مثال: أراضٍ جديدة في بليدة 3"></label>
    <label>النص<textarea name="body" rows="3" maxlength="400" placeholder="مثال: نزلت 5 أراضٍ سكنية بأسعار تبدأ من 380,000 درهم — تصفحها الآن"></textarea></label>
    <div class="cgrid"><label>عند الضغط يفتح<select name="open"><option value="home">الصفحة الرئيسية</option><option value="project">مشروع</option><option value="news">الأخبار</option><option value="wanted">طلبات الشراء</option><option value="url">رابط</option></select></label>
      <label id="ptgt" hidden>الهدف<select name="tproj">${H.DATA().projects.map((p) => `<option value="${H.esc(p.slug)}">${H.esc(p.name)}</option>`).join('')}</select><input name="turl" type="url" dir="ltr" placeholder="https://" hidden></label></div>
    <button class="btn primary block">🔔 إرسال الإشعار</button>
    <div id="plog"></div></form>`;
}
export function initApush(pg) {
  const f = pg.querySelector('#pform'), cnt = pg.querySelector('#pcount');
  const sel = (k) => f.elements[k];
  const count = async () => {
    const aud = sel('audience').value; if (pg.querySelector('#pproj')) pg.querySelector('#pproj').hidden = aud !== 'project';
    if (aud === 'all') { cnt.textContent = 'يصل لكل من فعّل الإشعارات'; return; }
    cnt.textContent = '…';
    try { const j = await api('adm_push_count', { audience: aud, project: sel('project') ? sel('project').value : '', uid: sel('uid') ? sel('uid').value : '' }); cnt.textContent = `يصل إلى ${j.n} ${aud === 'project' ? 'جهاز/عضو' : 'عضو'}`; } catch (e) { cnt.textContent = e.message; }
  };
  const tgt = () => { const o = sel('open').value; pg.querySelector('#ptgt').hidden = o !== 'project' && o !== 'url'; sel('tproj').hidden = o !== 'project'; sel('turl').hidden = o !== 'url'; };
  f.addEventListener('change', (e) => { if (['audience', 'project'].includes(e.target.name)) count(); if (e.target.name === 'open') tgt(); });
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!confirm('إرسال هذا الإشعار الآن؟')) return;
    const b = f.querySelector('button'); b.disabled = true;
    const o = sel('open').value;
    try {
      const j = await api('adm_push', { audience: sel('audience').value, project: sel('project') ? sel('project').value : '', uid: sel('uid') ? sel('uid').value : '', title: sel('title').value, body: sel('body').value, open: o, target: o === 'project' ? sel('tproj').value : o === 'url' ? sel('turl').value : '' });
      H.toast(j.sent < 0 ? 'تم إرسال الإشعار للجميع ✓' : `تم الإرسال إلى ${j.sent} ✓`);
      pg.querySelector('#plog').innerHTML = `<h4 class="lh">آخر الإشعارات</h4>${j.log.map((x) => `<p class="muted">${day(x.t)} · ${H.esc(x.title)} · ${x.n < 0 ? 'الكل' : x.n}</p>`).join('')}`;
      sel('title').value = ''; sel('body').value = '';
    } catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  };
  count(); tgt();
}

/* =============================== Sharjah procedures guide =============================== */
const GK = 'oay:guide';
export function guidePage() { return `<div class="pad guide">${loading}</div>`; }
export async function initGuide(pg) {
  const el = pg.querySelector('.guide'); const { esc } = H;
  let secs = null; try { secs = JSON.parse(localStorage.getItem(GK) || 'null'); } catch { /* ignore */ }
  const link = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" data-ext dir="ltr">${u.replace(/^https?:\/\//, '')}</a>`).replace(/\n/g, '<br>');
  const view = () => {
    el.innerHTML = `<div class="ccard ghead"><b>📘 دليل الإجراءات العقارية في الشارقة</b><span>معلومات عامة للاسترشاد — الأنظمة والرسوم تُحدَّث من الجهات الرسمية، وفريقنا يساعدك في كل خطوة.</span></div>
      ${secs.map((s, i) => `<details class="gsec"${i ? '' : ' open'}><summary>${esc(s.title)}</summary><div class="gbody notr">${link(s.body)}</div></details>`).join('')}
      <div class="lbtns"><a class="btn wa" href="${esc(H.waLink('مرحباً، عندي استفسار عن إجراءات شراء وتسجيل أرض في الشارقة'))}" data-ext>${H.I.wa} اسأل فريقنا</a>${isAdmin() ? '<button class="btn ghost" id="gedit">✏️ تعديل الدليل</button>' : ''}</div>`;
    const b = el.querySelector('#gedit'); if (b) b.onclick = edit;
  };
  const edit = () => {
    el.innerHTML = `<div class="gedit">${secs.map((s) => `<div class="ccard cform gitem"><input class="gt" value="${esc(s.title)}" maxlength="120"><textarea class="gb" rows="6">${esc(s.body)}</textarea><button type="button" class="btn ghost sm danger gdel">حذف القسم</button></div>`).join('')}</div>
      <button class="btn ghost block" id="gadd">➕ قسم جديد</button><button class="btn primary block" id="gsave">حفظ الدليل</button>`;
    const wrap = el.querySelector('.gedit');
    wrap.onclick = (e) => { if (e.target.closest('.gdel')) e.target.closest('.gitem').remove(); };
    el.querySelector('#gadd').onclick = () => wrap.insertAdjacentHTML('beforeend', '<div class="ccard cform gitem"><input class="gt" placeholder="عنوان القسم" maxlength="120"><textarea class="gb" rows="6" placeholder="المحتوى"></textarea><button type="button" class="btn ghost sm danger gdel">حذف القسم</button></div>');
    el.querySelector('#gsave').onclick = async () => {
      const out = [...wrap.querySelectorAll('.gitem')].map((g, i) => ({ id: (secs[i] && secs[i].id) || '', title: g.querySelector('.gt').value, body: g.querySelector('.gb').value })).filter((s) => s.title.trim());
      try { secs = (await api('adm_guide_save', { sections: out })).sections; try { localStorage.setItem(GK, JSON.stringify(secs)); } catch { /* ignore */ } H.toast('تم حفظ الدليل ✓'); view(); } catch (ex) { H.toast(ex.message); }
    };
  };
  if (secs) view();
  try { secs = (await api('guide')).sections; try { localStorage.setItem(GK, JSON.stringify(secs)); } catch { /* ignore */ } view(); }
  catch { if (!secs) el.innerHTML = '<p class="muted">تعذّر تحميل الدليل — تحقق من الإنترنت</p>'; }
}

/* =============================== contact log (office): every call / WhatsApp / call-back on a listing =============================== */
export function contactsPage() {
  return `<div class="pad leads"><div class="kpis ck"><div><span>📞 اتصال</span><b id="ck-call">–</b><em>هذا الأسبوع</em></div><div><span>🟢 واتساب</span><b id="ck-wa">–</b><em>هذا الأسبوع</em></div><div><span>📩 طلبات اتصال</span><b id="ck-form">–</b><em>هذا الأسبوع</em></div></div>
    <div class="chips scroll lchips"><button class="chip on" data-ck="">الكل</button><button class="chip" data-ck="form">📩 طلبات اتصال <i id="ckopen"></i></button><button class="chip" data-ck="wa">🟢 واتساب</button><button class="chip" data-ck="call">📞 اتصال</button></div>
    <div id="clog">${loading}</div></div>`;
}
export function initContacts(pg) {
  const box = pg.querySelector('#clog'); let k = '';
  const load = async (extra = {}) => {
    try {
      const j = await api('adm_contacts', { kind: k, ...extra });
      ['call', 'wa', 'form'].forEach((x) => { pg.querySelector('#ck-' + x).textContent = j.week[x] || 0; });
      pg.querySelector('#ckopen').textContent = j.open || '';
      box.innerHTML = j.items.length ? j.items.map((x) => `<div class="crow${x.kind === 'form' && !x.done ? ' due' : ''}">
        <i class="cic">${(SRC[x.kind] || ['•'])[0]}</i>
        <div><b>${(SRC[x.kind] || ['', x.kind])[1]}${x.ref ? ` · <span dir="ltr">${H.esc(x.ref)}</span>` : ''}</b>
          ${x.id ? `<button class="clink notr" ${/^\d+$/.test(x.id) ? `data-oland="${H.esc(x.id)}"` : `data-land="${H.esc(x.id)}"`}>${H.esc(x.name)}</button>` : ''}
          <span>${x.kind === 'form' ? `<b class="notr">${H.esc(x.who)}</b> · <span dir="ltr">${H.esc(x.phone)}</span>${x.wa ? ' · يفضّل واتساب' : ''}` : x.uid ? `عضو: <button class="clink notr" data-lead="${x.uid}">${H.esc(x.who)}</button>` : `زائر بدون حساب #${H.esc(x.dev || '')}`}</span>
          ${x.msg ? `<p class="notr">${H.esc(x.msg)}</p>` : ''}
          ${x.kind === 'form' ? `<div class="cact"><a class="btn ghost sm" href="tel:${H.esc(x.phone)}">📞 اتصال</a><a class="btn wa sm" href="${H.esc(waUrl(x.phone))}" data-ext>واتساب</a>${x.done ? '<i class="pill ok">تم التواصل</i>' : `<button class="btn primary sm" data-done="${x.t}">✓ تم التواصل</button>`}</div>` : ''}</div>
        <time>${ago(x.t)}</time></div>`).join('') : `<div class="cempty">${H.I.phone}<p>لا يوجد تواصل بعد</p></div>`;
    } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; }
  };
  pg.querySelectorAll('[data-ck]').forEach((b) => { b.onclick = () => { k = b.dataset.ck; pg.querySelectorAll('[data-ck]').forEach((x) => x.classList.toggle('on', x === b)); box.innerHTML = loading; load(); }; });
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-done]'); if (b) { e.stopPropagation(); load({ done: b.dataset.done }); H.toast('تم ✓'); } });
  load();
}
