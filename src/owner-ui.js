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
          <i class="pill ${REVIEW[x.review][1]}">${REVIEW[x.review][0]}</i>${x.note ? `<small>السبب: ${esc(x.note)}</small>` : ''}</div>
        ${x.review === 'approved' ? `<button class="back" data-oland="${x.id}" aria-label="عرض">‹</button>` : ''}</div>`).join('')
        : '<p class="muted">لم تضف أي أرض بعد.</p>';
    } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
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
export function addLandPage() {
  const u = session.user() || {};
  return `<div class="pad acc">
    <div class="acc-hero"><h2>أضف أرضك للبيع</h2><p>تُراجع الإدارة طلبك، وتظهر الأرض في التطبيق بعد الموافقة. نتواصل معك على رقمك.</p></div>
    <form class="accf" id="landForm" novalidate>
      <label>عنوان الإعلان *<input name="title" maxlength="120" placeholder="مثال: أرض سكنية زاوية في الرحمانية"></label>
      <div class="two"><label>المشروع / المنطقة<select name="project"><option value="">— اختر —</option></select></label>
        <label>نوع الأرض<select name="land_type"><option value="">— اختر —</option></select></label></div>
      <div class="two"><label>المساحة (قدم²) *<input name="area" inputmode="decimal" dir="ltr"></label>
        <label>رقم الأرض<input name="land_number" dir="ltr" maxlength="30"></label></div>
      <div class="two"><label>السعر (درهم) *<input name="price" inputmode="numeric" dir="ltr"></label>
        <label>الدفعة المقدمة<input name="down_payment" inputmode="numeric" dir="ltr"></label></div>
      <div class="two"><label>عدد الأقساط<input name="installments" inputmode="numeric" dir="ltr"></label>
        <label>نوع التصريح<input name="permit" maxlength="60" placeholder="مثال: أرضي + اثنين"></label></div>
      <label>الموقع / الوصف المختصر للمكان<input name="location" maxlength="160" placeholder="مثال: الشارقة، شارع مليحة"></label>
      <label>رابط الموقع على خرائط جوجل<input name="maps_url" dir="ltr" inputmode="url" placeholder="https://maps.app.goo.gl/…"></label>
      <label>تفاصيل إضافية<textarea name="description" rows="4" maxlength="3000"></textarea></label>
      <label>رقم جوالك للتواصل<input name="phone" type="tel" dir="ltr" inputmode="tel" value="${H.esc(u.phone || '')}"></label>
      <div class="photos"><b>صور الأرض (حتى 10) — الأولى صورة الغلاف</b>
        <div class="pgrid" id="pgrid"><label class="padd"><input type="file" accept="image/*" multiple hidden id="pfile"><span>＋<br>إضافة صور</span></label></div></div>
      <p class="ferr" id="landErr" hidden></p>
      <button class="btn gold block share-big" type="submit" id="landGo">إرسال للمراجعة</button>
    </form>
  </div>`;
}
export async function initAddLand(pg) {
  const { esc, toast } = H;
  const form = pg.querySelector('#landForm'), err = pg.querySelector('#landErr'), go = pg.querySelector('#landGo');
  const grid = pg.querySelector('#pgrid'), file = pg.querySelector('#pfile');
  const photos = [];   // { data (jpeg data url), id (after upload) }
  meta().then((m) => {
    form.project.insertAdjacentHTML('beforeend', m.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(''));
    form.land_type.insertAdjacentHTML('beforeend', m.types.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join(''));
  }).catch(() => {});
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
    const f = Object.fromEntries(new FormData(form));
    if ((f.title || '').trim().length < 3) { err.textContent = 'اكتب عنواناً للإعلان'; err.hidden = false; return; }
    if (!f.area) { err.textContent = 'اكتب مساحة الأرض'; err.hidden = false; return; }
    if (!f.price) { err.textContent = 'اكتب السعر'; err.hidden = false; return; }
    go.disabled = true;
    try {
      for (let i = 0; i < photos.length; i++) {
        if (photos[i].id) continue;
        go.textContent = `رفع الصور ${i + 1}/${photos.length}…`;
        photos[i].id = (await api('upload', { data: photos[i].data })).id;
      }
      go.textContent = 'جارِ الإرسال…';
      delete f.pfile;
      await api('submit', { ...f, photos: photos.map((p) => p.id) });
      toast('تم إرسال الطلب ✓ سيظهر بعد موافقة الإدارة');
      H.closeTop(); setTimeout(() => H.pushPage('account'), 280);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; go.textContent = 'إرسال للمراجعة'; }
  };
}

/* ================= approved lands from owners ================= */
export function oLandCard(x) {
  const { esc, money, I } = H;
  return `<article class="card land oland" data-oland="${x.id}">
    <div class="ph">${x.photos[0] ? `<img loading="lazy" decoding="async" src="${esc(x.photos[0])}" alt="" onerror="this.style.opacity=0">` : ''}
      <span class="badge av">للبيع</span></div>
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
