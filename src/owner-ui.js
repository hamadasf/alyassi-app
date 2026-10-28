// Screens for accounts and user-submitted lands. Plugged into main.js's page stack.
import { Capacitor } from '@capacitor/core';
import { api, session, refreshMe, logout, meta, googleNative, googleWebButton, resizePhoto, ownerLands } from './owner.js';

const native = Capacitor.isNativePlatform();
let H = null;   // helpers from main.js: { esc, toast, I, money, pushPage, closeTop, waLink, CONTACT }
export function initOwnerUI(helpers) { H = helpers; }

const REVIEW = { pending: ['بانتظار الموافقة', 'res'], approved: ['معروضة', 'av'], rejected: ['مرفوضة', 'sold'] };

/* ================= account ================= */
export function accountPage() {
  const { esc, I } = H; const u = session.user();
  if (session.token() && u) {
    return `<div class="pad acc">
      <div class="acc-card"><div class="acc-av">${esc((u.name || u.email || '?').trim().charAt(0))}</div>
        <div><b>${esc(u.name || '')}</b><span>${esc(u.email || '')}</span>${u.phone ? `<span dir="ltr">${esc(u.phone)}</span>` : ''}</div></div>
      ${u.admin ? `<button class="btn primary block share-big" data-admin>🛡️ لوحة الإدارة</button>` : ''}
      <div class="pts"><b>${u.points || 0}</b><span>نقطة في رصيدك · تمييز الإعلان بـ 70 نقطة يجعله يظهر أولاً في الصفحة الرئيسية</span></div>
      <button class="btn gold block share-big" data-addland>${I.plus || '＋'} أضف أرضاً للبيع</button>
      <h2 class="h2">طلباتي</h2>
      <div id="myList"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
      <button class="btn ghost block" data-logout>تسجيل الخروج</button>
    </div>`;
  }
  return `<div class="pad acc">
    <div class="acc-hero"><h2>حسابك في عمر الياسي للعقارات</h2><p>سجّل لتضيف أرضك للبيع — تظهر في التطبيق بعد مراجعة وموافقة الإدارة.</p></div>
    <div id="gwrap" class="gwrap" hidden><div id="gbtn"></div><div class="or"><span>أو بالبريد الإلكتروني</span></div></div>
    <div class="seg"><button class="on" data-accmode="login">تسجيل الدخول</button><button data-accmode="register">حساب جديد</button></div>
    <form class="accf" id="accForm" novalidate>
      <label data-only="register">الاسم<input name="name" autocomplete="name" maxlength="80"></label>
      <label>البريد الإلكتروني<input name="email" type="email" dir="ltr" autocomplete="email" inputmode="email" maxlength="120"></label>
      <label data-only="register">رقم الجوال<input name="phone" type="tel" dir="ltr" autocomplete="tel" inputmode="tel" placeholder="05xxxxxxxx" maxlength="20"></label>
      <label>كلمة المرور<input name="password" type="password" dir="ltr" autocomplete="current-password" maxlength="200"></label>
      <p class="ferr" id="accErr" hidden></p>
      <button class="btn primary block" type="submit" id="accGo">دخول</button>
      <button class="linkbtn" type="button" id="forgot" data-only="login">نسيت كلمة المرور؟</button>
    </form>
  </div>`;
}
export async function initAccount(pg, next) {
  const { esc, toast, money } = H;
  const done = (u) => {
    toast(`أهلاً ${u && u.name ? u.name : ''} ✓`);
    H.closeTop();
    setTimeout(() => H.pushPage(next === 'add' ? 'addland' : 'account'), 280);
  };
  if (session.token() && session.user()) {
    pg.querySelector('[data-logout]').onclick = async () => { await logout(); toast('تم تسجيل الخروج'); H.closeTop(); };
    const box = pg.querySelector('#myList');
    try {
      const j = await api('mine');
      box.innerHTML = j.items.length ? j.items.map((x) => `<div class="mine">
        ${x.photos[0] ? `<img src="${esc(x.photos[0])}" alt="" loading="lazy">` : '<div class="noimg"></div>'}
        <div><b>${esc(x.title)}</b><span>${x.area ? money(x.area) + ' قدم²' : ''}${x.price ? ' · ' + money(x.price) + ' د.إ' : ''}</span>
          <span class="pills"><i class="pill ${REVIEW[x.review][1]}">${REVIEW[x.review][0]}</i>${x.featured ? '<i class="pill star">⭐ مميز</i>' : ''}${x.onPlan ? '<i class="pill plan">على المخطط</i>' : ''}</span>
          ${x.note ? `<small>السبب: ${esc(x.note)}</small>` : ''}
          ${!x.featured && x.review !== 'rejected' ? `<button class="btn ghost feat" data-feat="${x.id}">⭐ تمييز الإعلان (70 نقطة)</button>` : ''}</div>
        ${x.review === 'approved' ? `<button class="back" data-oland="${x.id}" aria-label="عرض">‹</button>` : ''}</div>`).join('')
        : '<p class="muted">لم تضف أي أرض بعد.</p>';
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    box.onclick = async (e) => {
      const b = e.target.closest('[data-feat]'); if (!b) return;
      const u = session.user() || {};
      if ((u.points || 0) < 70) { toast(`رصيدك ${u.points || 0} نقطة — تمييز الإعلان يحتاج 70 نقطة. تواصل مع الإدارة لإضافة نقاط`); return; }
      if (!confirm('تمييز هذا الإعلان مقابل 70 نقطة؟')) return;
      b.disabled = true;
      try { await api('feature', { id: b.dataset.feat }); await refreshMe(); toast('تم تمييز الإعلان ⭐'); H.closeTop(); setTimeout(() => H.pushPage('account'), 280); }
      catch (ex) { toast(ex.message); b.disabled = false; }
    };
    return;
  }
  // login / register
  let mode = 'login';
  const form = pg.querySelector('#accForm'), err = pg.querySelector('#accErr'), go = pg.querySelector('#accGo');
  const setMode = (m) => {
    mode = m;
    pg.querySelectorAll('[data-accmode]').forEach((b) => b.classList.toggle('on', b.dataset.accmode === m));
    form.querySelectorAll('[data-only]').forEach((el) => { el.hidden = el.dataset.only !== m; });
    form.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    go.textContent = m === 'login' ? 'دخول' : 'إنشاء الحساب'; err.hidden = true;
  };
  pg.querySelectorAll('[data-accmode]').forEach((b) => { b.onclick = () => setMode(b.dataset.accmode); });
  pg.querySelector('#forgot').onclick = async () => {
    const email = form.email.value.trim() || prompt('اكتب بريدك الإلكتروني المسجّل:', '') || '';
    if (!email) return;
    try { const j = await api('forgot', { email }); H.toast(j.message); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  };
  setMode('login');
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true; go.disabled = true; go.textContent = '…';
    const f = Object.fromEntries(new FormData(form));
    try {
      const j = await api(mode, mode === 'login' ? { email: f.email, password: f.password } : f);
      session.set(j.token, j.user); done(j.user);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    go.disabled = false; go.textContent = mode === 'login' ? 'دخول' : 'إنشاء الحساب';
  };
  // Google (shown once the office has switched it on)
  try {
    const m = await meta(); if (!m.google) return;
    const wrap = pg.querySelector('#gwrap'); wrap.hidden = false;
    if (native) {
      pg.querySelector('#gbtn').innerHTML = '<button class="btn gbtn block" type="button"><svg viewBox="0 0 48 48" width="22" height="22"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg> المتابعة بحساب جوجل</button>';
      pg.querySelector('#gbtn button').onclick = async () => { const u = await googleNative(); if (u) done(u); };
    } else {
      await googleWebButton(pg.querySelector('#gbtn'), m.google, done, (ex) => { err.textContent = ex.message; err.hidden = false; });
    }
  } catch { /* no Google */ }
}

/* ================= add a land ================= */
function landFormHTML(v = {}, admin = false) {
  const e = H.esc; const val = (k) => e(v[k] == null ? '' : v[k]);
  return `<form class="accf" id="landForm" novalidate>
      <label>عنوان الإعلان *<input name="title" maxlength="120" value="${val('title')}" placeholder="مثال: أرض سكنية زاوية في الرحمانية"></label>
      <label>المشروع<select name="plan"><option value="">— خارج مخططات المشاريع —</option></select></label>
      <label class="ifother" ${v.plan ? 'hidden' : ''}>المنطقة / المشروع (تصنيف)<select name="project"><option value="">— اختر —</option></select></label>
      <div class="two"><label>رقم الأرض<input name="land_number" dir="ltr" maxlength="30" value="${val('number')}"></label>
        <label>نوع الأرض<select name="land_type"><option value="">— اختر —</option></select></label></div>
      <p class="plotchk" id="plotChk" hidden></p>
      <div class="two"><label>المساحة (قدم²) *<input name="area" inputmode="decimal" dir="ltr" value="${v.area || ''}"></label>
        <label>السعر (درهم) *<input name="price" inputmode="numeric" dir="ltr" value="${v.price || ''}"></label></div>
      <div class="two"><label>الدفعة المقدمة<input name="down_payment" inputmode="numeric" dir="ltr" value="${v.down || ''}"></label>
        <label>عدد الأقساط<input name="installments" inputmode="numeric" dir="ltr" value="${v.installments || ''}"></label></div>
      <label>نوع التصريح<input name="permit" maxlength="60" value="${val('permit')}" placeholder="مثال: أرضي + اثنين"></label>
      <label>الموقع / الوصف المختصر للمكان<input name="location" maxlength="160" value="${val('location')}" placeholder="مثال: الشارقة، شارع مليحة"></label>
      <label>رابط الموقع على خرائط جوجل<input name="maps_url" dir="ltr" inputmode="url" value="${val('maps')}" placeholder="https://maps.app.goo.gl/…"></label>
      <label>تفاصيل إضافية<textarea name="description" rows="4" maxlength="3000">${val('description')}</textarea></label>
      <label>${admin ? 'جوال صاحب الأرض' : 'رقم جوالك للتواصل'}<input name="phone" type="tel" dir="ltr" inputmode="tel" value="${val('phone')}"></label>
      ${admin ? '' : `<div class="photos"><b>صور الأرض (حتى 10) — الأولى صورة الغلاف</b>
        <div class="pgrid" id="pgrid"><label class="padd"><input type="file" accept="image/*" multiple hidden id="pfile"><span>＋<br>إضافة صور</span></label></div></div>`}
      <p class="ferr" id="landErr" hidden></p>
      <button class="btn gold block share-big" type="submit" id="landGo">${admin ? 'حفظ التعديلات' : 'إرسال للمراجعة'}</button>
    </form>`;
}
function bindLandForm(pg, v = {}) {
  const { esc } = H; const form = pg.querySelector('#landForm'), chk = pg.querySelector('#plotChk');
  meta().then((m) => {
    form.plan.insertAdjacentHTML('beforeend', (m.plans || []).map((p) => `<option value="${esc(p.slug)}">مشروع ${esc(p.name)}</option>`).join(''));
    form.project.insertAdjacentHTML('beforeend', m.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(''));
    form.land_type.insertAdjacentHTML('beforeend', m.types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join(''));
    if (v.plan) form.plan.value = v.plan; if (v.projectId) form.project.value = v.projectId; if (v.typeId) form.land_type.value = v.typeId;
    check();
  }).catch(() => {});
  // the plot number is checked against the project's interactive plan while typing
  let t = 0, seq = 0;
  const check = () => {
    clearTimeout(t);
    pg.querySelector('.ifother').hidden = !!form.plan.value;
    const plan = form.plan.value, n = form.land_number.value.trim();
    if (!plan || !n) { chk.hidden = true; return; }
    t = setTimeout(async () => {
      const my = ++seq;
      try {
        const r = await api('plotcheck', { plan, n }); if (my !== seq) return;
        chk.hidden = false;
        chk.className = 'plotchk ' + (!r.exists ? 'bad' : r.listed && !v.onPlan ? 'warn' : 'ok');
        chk.textContent = !r.exists ? '⚠ هذا الرقم غير موجود في مخطط المشروع — تأكد من رقم القطعة'
          : r.listed && !v.onPlan ? 'ℹ️ هذه القطعة معروضة على المخطط مسبقاً' : `✓ القطعة موجودة في المخطط${r.ft ? ' (' + Math.round(r.ft).toLocaleString('en-US') + ' قدم²)' : ''} — تظهر عليه بعد الموافقة`;
        if (r.exists && r.ft && !form.area.value) form.area.value = Math.round(r.ft);
      } catch { chk.hidden = true; }
    }, 350);
  };
  form.plan.addEventListener('change', check); form.land_number.addEventListener('input', check);
  return form;
}
function readForm(form) {
  const f = Object.fromEntries(new FormData(form)); delete f.pfile;
  if (f.plan) delete f.project;
  return f;
}
function formError(form, f) {
  if ((f.title || '').trim().length < 3) return 'اكتب عنواناً للإعلان';
  if (!f.area) return 'اكتب مساحة الأرض';
  if (!f.price) return 'اكتب السعر';
  return '';
}

export function addLandPage() {
  const u = session.user() || {};
  return `<div class="pad acc">
    <div class="acc-hero"><h2>أضف أرضك للبيع</h2><p>تُراجع الإدارة طلبك، وتظهر الأرض في التطبيق بعد الموافقة. إذا اخترت المشروع ورقم القطعة تظهر أيضاً على المخطط التفاعلي.</p></div>
    ${landFormHTML({ phone: u.phone || '' })}
  </div>`;
}
export async function initAddLand(pg) {
  const { toast } = H;
  const form = bindLandForm(pg), err = pg.querySelector('#landErr'), go = pg.querySelector('#landGo');
  const grid = pg.querySelector('#pgrid'), file = pg.querySelector('#pfile');
  const photos = [];   // { data (jpeg data url), id (after upload) }
  const draw = () => {
    grid.querySelectorAll('.pth').forEach((x) => x.remove());
    grid.insertAdjacentHTML('afterbegin', photos.map((p, i) => `<div class="pth"><img src="${p.data}" alt="">${i === 0 ? '<i>الغلاف</i>' : ''}<button type="button" data-rm="${i}" aria-label="حذف">✕</button></div>`).join(''));
    grid.querySelector('.padd').hidden = photos.length >= 10;
  };
  grid.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { photos.splice(+b.dataset.rm, 1); draw(); } };
  file.onchange = async () => {
    for (const f of [...file.files].slice(0, 10 - photos.length)) { try { photos.push({ data: await resizePhoto(f) }); draw(); } catch { toast('تعذّر قراءة إحدى الصور'); } }
    file.value = '';
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const f = readForm(form); const bad = formError(form, f);
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    go.disabled = true;
    try {
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].id) continue;
        go.textContent = `رفع الصور ${i + 1}/${photos.length}…`;
        photos[i].id = (await api('upload', { data: photos[i].data })).id;
      }
      go.textContent = 'جارِ الإرسال…';
      await api('submit', { ...f, photos: photos.map((p) => p.id) });
      toast('تم إرسال الطلب ✓ سيظهر بعد موافقة الإدارة');
      H.closeTop(); setTimeout(() => H.pushPage('account'), 280);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; go.textContent = 'إرسال للمراجعة'; }
  };
}

/* ================= admin ================= */
const ADM = { tab: 'pending' };
const admCache = new Map();   // id → card, for the detail page
function admCard(x) {
  const { esc, money } = H; admCache.set(String(x.id), x);
  return `<div class="mine adm" data-aad="${x.id}">
    ${x.photos[0] ? `<img src="${esc(x.photos[0])}" alt="" loading="lazy">` : '<div class="noimg"></div>'}
    <div><b>${esc(x.title)}</b><span>${x.area ? money(x.area) + ' قدم²' : ''}${x.price ? ' · ' + money(x.price) + ' د.إ' : ''}</span>
      <span>${x.owner ? esc(x.owner.name) : ''}${x.project ? ' · ' + esc(x.project) : ''}${x.number ? ' · قطعة ' + esc(x.number) : ''}</span>
      <span class="pills"><i class="pill ${REVIEW[x.review][1]}">${REVIEW[x.review][0]}</i>${x.featured ? '<i class="pill star">⭐ مميز</i>' : ''}${x.onPlan ? '<i class="pill plan">على المخطط</i>' : ''}</span></div>
    <i class="chev">‹</i></div>`;
}
export function adminPage() {
  return `<div class="pad acc">
    <div class="seg four"><button data-atab="pending">الطلبات <em id="cPending"></em></button><button data-atab="publish">المعروضة</button><button data-atab="draft">المرفوضة</button><button data-atab="users">المستخدمون</button></div>
    <div id="admSearch" hidden><input class="srch" id="admQ" placeholder="ابحث بالاسم أو البريد…"></div>
    <div id="admList"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
  </div>`;
}
export function initAdmin(pg) {
  const { esc, money } = H;
  const list = pg.querySelector('#admList'), q = pg.querySelector('#admQ');
  const load = async () => {
    pg.querySelectorAll('[data-atab]').forEach((b) => b.classList.toggle('on', b.dataset.atab === ADM.tab));
    pg.querySelector('#admSearch').hidden = ADM.tab !== 'users';
    list.innerHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
    try {
      if (ADM.tab === 'users') {
        const j = await api('adm_users', { q: q.value.trim() });
        list.innerHTML = j.items.length ? j.items.map((u) => `<div class="mine adm" data-auser="${u.id}"><div class="acc-av">${esc((u.name || u.email || '?').charAt(0))}</div>
          <div><b>${esc(u.name || '—')}${u.banned ? ' <i class="pill sold">موقوف</i>' : ''}${u.admin ? ' <i class="pill plan">مدير</i>' : ''}</b><span>${esc(u.email)}</span><span>${u.ads} إعلان · ${u.points} نقطة${u.google ? ' · جوجل' : ''}</span></div><i class="chev">‹</i></div>`).join('')
          : '<p class="muted">لا يوجد مستخدمون.</p>';
      } else {
        const j = await api('adm_ads', { status: ADM.tab });
        const c = pg.querySelector('#cPending'); if (c) c.textContent = j.counts.pending ? `(${j.counts.pending})` : '';
        list.innerHTML = j.items.length ? j.items.map(admCard).join('') : `<p class="muted">لا توجد إعلانات هنا.</p>`;
      }
    } catch (e) { list.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  pg.querySelectorAll('[data-atab]').forEach((b) => { b.onclick = () => { ADM.tab = b.dataset.atab; load(); }; });
  let qt = 0; q.oninput = () => { clearTimeout(qt); qt = setTimeout(load, 350); };
  pg.addEventListener('oay:refresh', load);
  load();
}
export function admAdPage(id) {
  const x = admCache.get(String(id)); if (!x) return '';
  const { esc, money } = H;
  const rows = [['صاحب الإعلان', x.owner ? `${x.owner.name} · ${x.owner.email}` : ''], ['جواله', x.ownerPhone], ['المشروع', x.project], ['رقم الأرض', x.number],
    ['المخطط التفاعلي', x.planMsg || (x.plan ? 'سيُضاف عند الموافقة' : '')], ['التاريخ', new Date(x.date).toLocaleDateString('ar-AE')]].filter((r) => r[1]);
  return `<div class="ogal">${x.photos.length ? x.photos.map((s) => `<img src="${esc(s)}" alt="" loading="lazy" data-web="${esc(s)}">`).join('') : '<div class="noimg"></div>'}</div>
    <div class="pad acc">
      <span class="pills"><i class="pill ${REVIEW[x.review][1]}">${REVIEW[x.review][0]}</i>${x.featured ? '<i class="pill star">⭐ مميز</i>' : ''}${x.onPlan ? '<i class="pill plan">على المخطط</i>' : ''}</span>
      <div class="inst">${rows.map((r) => `<div class="r"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</div>
      <div class="admact">
        ${x.review !== 'approved' ? '<button class="btn wa" data-act="approve">✓ موافقة وعرض</button>' : ''}
        ${x.review !== 'rejected' ? `<button class="btn ghost" data-act="reject">✕ ${x.review === 'approved' ? 'إخفاء' : 'رفض'}</button>` : ''}
        <button class="btn ghost" data-act="feature">${x.featured ? 'إلغاء التمييز' : '⭐ تمييز'}</button>
        <button class="btn ghost danger" data-act="delete">🗑 حذف</button>
        ${x.owner ? `<button class="btn ghost" data-auser="${x.owner.id}">👤 ملف صاحب الإعلان</button>` : ''}
      </div>
      <h2 class="h2">تعديل الإعلان</h2>
      ${landFormHTML({ ...x, phone: x.ownerPhone }, true)}
    </div>`;
}
export function initAdmAd(pg, id) {
  const { toast } = H; const x = admCache.get(String(id)); if (!x) return;
  const form = bindLandForm(pg, x), err = pg.querySelector('#landErr'), go = pg.querySelector('#landGo');
  const done = (msg) => { toast(msg); document.querySelectorAll('.page').forEach((p) => p.dispatchEvent(new Event('oay:refresh'))); H.closeTop(); };
  pg.querySelector('.admact').onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act; b.disabled = true;
    try {
      if (act === 'approve') { const r = await api('adm_review', { id, approve: '1' }); done('تمت الموافقة ✓' + (r.planMsg ? ' — ' + r.planMsg : '')); }
      else if (act === 'reject') { const note = prompt('سبب الرفض (اختياري):', '') ; if (note === null) { b.disabled = false; return; } await api('adm_review', { id, approve: '0', note }); done('تم'); }
      else if (act === 'feature') { await api('adm_feature', { id, on: x.featured ? '0' : '1' }); done(x.featured ? 'تم إلغاء التمييز' : 'تم تمييز الإعلان ⭐'); }
      else if (act === 'delete') { if (!confirm('حذف هذا الإعلان نهائياً من التطبيق؟')) { b.disabled = false; return; } await api('adm_delete', { id }); done('تم حذف الإعلان'); }
    } catch (ex) { toast(ex.message); b.disabled = false; }
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const f = readForm(form); const bad = formError(form, f);
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    go.disabled = true; go.textContent = 'جارِ الحفظ…';
    try { await api('adm_save', { id, ...f }); done('تم حفظ التعديلات ✓'); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; go.textContent = 'حفظ التعديلات'; }
  };
}
export function admUserPage() {
  return `<div class="pad acc" id="auser"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>`;
}
export async function initAdmUser(pg, id) {
  const { esc, toast } = H; const box = pg.querySelector('#auser');
  const draw = (j) => {
    const u = j.user;
    box.innerHTML = `<div class="acc-card"><div class="acc-av">${esc((u.name || u.email || '?').charAt(0))}</div>
        <div><b>${esc(u.name || '—')}</b><span>${esc(u.email)}</span>${u.phone ? `<span dir="ltr">${esc(u.phone)}</span>` : ''}
        <span>عضو منذ ${new Date(u.joined).toLocaleDateString('ar-AE')}${u.google ? ' · دخول بجوجل' : ''}</span>
        <span class="pills">${u.banned ? '<i class="pill sold">موقوف</i>' : '<i class="pill av">نشط</i>'}${u.admin ? '<i class="pill plan">مدير</i>' : ''}</span></div></div>
      <div class="pts"><b>${u.points}</b><span>نقطة · تمييز إعلان = 70 نقطة</span></div>
      <div class="admact">
        <button class="btn gold" data-pts="70">＋ 70 نقطة (تمييز إعلان)</button>
        <button class="btn ghost" data-pts="custom">± نقاط بعدد آخر</button>
        ${u.admin ? '' : `<button class="btn ghost ${u.banned ? '' : 'danger'}" data-ban="${u.banned ? '0' : '1'}">${u.banned ? 'رفع الإيقاف' : '⛔ إيقاف الحساب'}</button>`}
      </div>
      <h2 class="h2">إعلاناته (${j.ads.length})</h2>
      ${j.ads.length ? j.ads.map(admCard).join('') : '<p class="muted">لا توجد إعلانات.</p>'}`;
  };
  const load = async () => { try { draw(await api('adm_user', { id })); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  box.onclick = async (e) => {
    const p = e.target.closest('[data-pts]'), b = e.target.closest('[data-ban]'); if (!p && !b) return;
    try {
      if (p) {
        let delta = 70;
        if (p.dataset.pts === 'custom') { const v = prompt('عدد النقاط (اكتب رقماً سالباً للخصم):', '70'); if (v === null) return; delta = parseInt(v, 10) || 0; if (!delta) return; }
        await api('adm_points', { id, delta }); toast(delta > 0 ? `تمت إضافة ${delta} نقطة ✓` : `تم خصم ${-delta} نقطة`);
      } else {
        if (b.dataset.ban === '1' && !confirm('إيقاف هذا الحساب؟ يُسجَّل خروجه وتُخفى إعلاناته المعروضة.')) return;
        await api('adm_ban', { id, on: b.dataset.ban }); toast(b.dataset.ban === '1' ? 'تم إيقاف الحساب' : 'تم رفع الإيقاف');
      }
      load(); document.querySelectorAll('.page').forEach((x) => { if (x !== pg) x.dispatchEvent(new Event('oay:refresh')); });
    } catch (ex) { toast(ex.message); }
  };
  pg.addEventListener('oay:refresh', load);
  load();
}

/* ================= approved lands from owners ================= */
export function oLandCard(x) {
  const { esc, money, I } = H;
  return `<article class="card land oland" data-oland="${x.id}">
    <div class="ph">${x.photos[0] ? `<img loading="lazy" decoding="async" src="${esc(x.photos[0])}" alt="" onerror="this.style.opacity=0">` : ''}
      <span class="badge av">للبيع</span>${x.featured ? `<span class="badge star">⭐ مميز</span>` : ''}</div>
    <div class="body">
      <div class="row between"><h3>${esc(x.title)}</h3>${x.price ? `<div class="price">${money(x.price)} <small>د.إ</small></div>` : ''}</div>
      ${x.project || x.location ? `<div class="meta">${I.pin}<span>${esc(x.project || x.location)}</span></div>` : ''}
      <div class="specs">${x.area ? `<span>${I.area}${money(x.area)} قدم²</span>` : ''}${x.type ? `<span>${I.tag}${esc(x.type)}</span>` : ''}</div>
    </div></article>`;
}
export function oLandsPage() {
  const items = ownerLands();
  return `<div class="pad"><div class="list">${items.length ? items.map(oLandCard).join('') : '<div class="empty">لا توجد أراضٍ معروضة حالياً</div>'}</div></div>`;
}
export function oLandPage(x) {
  const { esc, money, I, waLink, CONTACT } = H;
  const msg = `مرحباً، أرغب بالاستفسار عن الأرض المعروضة: ${x.title}${x.number ? ' (رقم ' + x.number + ')' : ''} — إعلان رقم ${x.id}`;
  const rows = [['المشروع / المنطقة', x.project], ['نوع الأرض', x.type], ['رقم الأرض', x.number], ['المساحة', x.area ? money(x.area) + ' قدم² (' + money(x.area / 10.7639) + ' م²)' : ''],
    ['الدفعة المقدمة', x.down ? money(x.down) + ' د.إ' : ''], ['عدد الأقساط', x.installments || ''], ['الموقع', x.location]].filter((r) => r[1]);
  return `<div class="ogal">${x.photos.length ? x.photos.map((s) => `<img src="${esc(s)}" alt="" loading="lazy" data-web="${esc(s)}">`).join('') : '<div class="noimg"></div>'}</div>
    <div class="pad">
      <h1>${esc(x.title)}</h1>
      ${x.price ? `<div class="pricebox"><div class="price big">${money(x.price)} <small>د.إ</small></div></div>` : ''}
      <div class="inst">${rows.map((r) => `<div class="r"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</div>
      ${x.description ? `<p class="odesc">${esc(x.description)}</p>` : ''}
      ${x.maps ? `<a class="btn ghost block" href="${esc(x.maps)}" data-ext>${I.pin} الموقع على الخريطة</a>` : ''}
    </div>
    <div class="bar">
      <a class="btn call" href="tel:${CONTACT.phone}">${I.phone} اتصال</a>
      <a class="btn wa" href="${esc(waLink(msg))}" data-ext>${I.wa} واتساب</a>
    </div>`;
}
