import { canCheckUpdate } from './update.js';
import { phoneField } from './phone.js';
import { LEGAL, LEGAL_EN } from './legal.js';
// «المزيد» tab: profile, my activity, account & settings, support, terms & privacy.
import { api, session, refreshMe, logout, resizePhoto, can, isOffice, isBroker } from './owner.js';
import { uiConfirm, uiPrompt } from './dialog.js';
import { profileHead } from './owner-ui.js';

let H = null;   // helpers from main.js
export function initMore(h) { H = h; }
const VER = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '';

const avatar = (u, cls = 'acc-av') => u && u.avatar
  ? `<span class="${cls} img"><img src="${H.esc(u.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></span>`
  : `<span class="${cls}">${u ? H.esc((u.name || u.email || '?').trim().charAt(0)) : H.I.user}</span>`;
const vb = (u) => (u && u.verified ? H.I.verified : '');
const CITIES = ['الشارقة', 'دبي', 'أبوظبي', 'عجمان', 'رأس الخيمة', 'أم القيوين', 'الفجيرة', 'العين'];
const row = (icon, label, attrs, extra = '') => `<button class="mrow" ${attrs}><span class="mi">${icon}</span><b>${label}</b>${extra}<i class="chev">‹</i></button>`;

/* ================= the tab ================= */
const grp = (title, rows) => { const r = rows.filter(Boolean).join(''); return r ? `<h3 class="msec">${title}</h3><div class="mbox">${r}</div>` : ''; };
const tile = (icon, label, attrs, badge = '') => `<button class="mtile" ${attrs}><span>${icon}${badge ? `<i>${badge}</i>` : ''}</span>${label}</button>`;
export function renderMore(el) {
  const { I, esc } = H; const u = session.user();
  const nSaved = saved.all().length;
  el.innerHTML = `
    ${u ? `<button class="mprof" data-profile>${avatar(u, 'mav')}<div><b><span class="notr">${esc(u.verified && u.company ? u.company : u.name || '')}</span>${u.verified && u.company || u.name ? '' : 'حسابي'} ${vb(u)}</b><span>${esc(u.email || '')}</span></div><i class="chev">‹</i></button>`
      : `<button class="mprof" data-account>${avatar(null, 'mav')}<div><b>تسجيل الدخول / حساب جديد</b><span>بالبريد الإلكتروني أو حساب جوجل</span></div><i class="chev">‹</i></button>`}
    <div class="mtiles">
      ${tile(I.heart, 'المفضلة', 'data-tab="favs"')}
      ${tile(I.building, 'إعلاناتي', 'data-account')}
      ${tile(I.plusc, 'أضف أرضك', 'data-addland')}
      ${tile(I.calendar, 'مواعيدي', u ? 'data-myviews' : 'data-account')}
    </div>
    ${isOffice() ? `<button class="mwork" data-tools><span class="mwi">${I.brief}</span><div><b>لوحة العمل</b><span>${u.admin ? 'العملاء · الإعلانات · التسويق · الفريق' : 'أدواتك حسب صلاحياتك'}</span></div><i class="chev">‹</i></button>` : ''}
    ${grp('نشاطي', [
      u && !isOffice() && row(I.home, 'أرضي ودفعاتها', 'data-mylands'),
      u && isBroker(u) && row(I.wallet, 'محفظتي', 'data-wallet=""', '<small>صفقاتي وأرباحي</small>'),
      u && !isOffice() && row(I.chart, 'إحصائيات إعلاناتي', 'data-mystats'),
      row(I.alert, 'أرض تناسبني', 'data-alerts=""', '<small>تنبيه بالجديد</small>'),
      row(I.bookmark, 'بحث محفوظ', 'data-saved', nSaved ? `<small>${nSaved}</small>` : ''),
      row(I.wanted, 'مطلوب أرض', 'data-wanted'),
      u && row(I.share, 'ادعُ أصدقاءك', 'data-invite'),
    ])}
    ${grp('عام', [
      row(I.gear, 'الإعدادات', 'data-settings', '<small>الحساب · الإشعارات · اللغة · الخصوصية</small>'),
      row(I.phone, 'تواصل معنا', 'data-contactpg'),
      row(I.book, 'دليل الإجراءات العقارية', 'data-guide'),
      row(I.trend, 'الأخبار العقارية', 'data-news', can('news') ? '<small>إدارة الشريط</small>' : ''),
      row(I.info, 'من نحن', 'data-about=""'),
    ])}
    ${u ? `<button class="mlogout" data-logout>${I.logout} تسجيل الخروج</button>` : ''}
    <p class="mfoot">باستخدامك تطبيق عمر الياسي للعقارات فأنت توافق على <button data-legal="terms">شروط الاستخدام</button> و<button data-legal="privacy">سياسة الخصوصية</button></p>
    <p class="ver">الإصدار ${esc(VER || '1.0')}${canCheckUpdate() ? ` · <button class="linkbtn" data-chkupd>التحقق من التحديثات</button>` : ''}</p>`;
}

/* ================= profile ================= */
export function profilePage() {
  const { I } = H; const u = session.user() || {};
  return `<div class="pad pprof2">${profileHead(u, { points: true })}
      <button class="btn primary block share-big" data-editprofile>${I.edit || ''} تعديل الملف</button></div>`;
}
export function editProfilePage() {
  const { esc } = H; const u = session.user() || {};
  return `<div class="pad acc">
    <div class="pprof flat"><label class="avpick">${avatar(u, 'bav')}<input type="file" accept="image/*" hidden id="avFile"><span>تغيير الصورة</span></label></div>
    <form class="accf" id="profForm" novalidate>
      <label>الاسم<input name="name" maxlength="80" value="${esc(u.name || '')}"></label>
      <label>رقم الجوال${phoneField('phone', u.phone || '')}</label>
      <p class="ferr" id="profErr" hidden></p>
      <button class="btn gold block share-big" type="submit" id="profGo">حفظ</button>
    </form>
    <form class="accf emchg" id="emForm" novalidate>
      <label>البريد الإلكتروني<div class="emrow"><input value="${esc(u.email || '')}" disabled dir="ltr"><button type="button" class="btn ghost" id="emOpen">تغيير</button></div></label>
      <div id="emBox" hidden>
        <label>البريد الجديد<input name="email" type="email" dir="ltr" inputmode="email" autocomplete="email" placeholder="name@example.com"></label>
        ${u.google ? '' : '<label>كلمة المرور الحالية<input name="password" type="password" autocomplete="current-password"></label>'}
        <div id="emCode" hidden><p class="muted">أرسلنا كوداً من 6 أرقام إلى بريدك الجديد.</p>
          <label>كود التأكيد<input name="code" inputmode="numeric" maxlength="6" dir="ltr" autocomplete="one-time-code"></label></div>
        <p class="ferr" id="emErr" hidden></p>
        <button class="btn primary block" type="submit" id="emGo">إرسال الكود</button>
      </div>
    </form></div>`;
}
export function initEditProfile(pg) {
  const { toast } = H; const form = pg.querySelector('#profForm'), err = pg.querySelector('#profErr'), go = pg.querySelector('#profGo');
  pg.querySelector('#avFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const data = await resizePhoto(f, 600, 0.85); const j = await api('avatar', { data }); session.set(session.token(), j.user); toast('تم تحديث الصورة ✓'); H.closeTop(); setTimeout(() => H.pushPage('profile'), 280); }
    catch (ex) { toast(ex.message); }
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true; go.disabled = true;
    try { const j = await api('profile', { name: form.name.value.trim(), phone: form.phone.value.trim() }); session.set(session.token(), j.user); toast('تم الحفظ ✓'); H.closeTop(); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
    go.disabled = false;
  };
  const ef = pg.querySelector('#emForm'), eb = pg.querySelector('#emBox'), ee = pg.querySelector('#emErr'), eg = pg.querySelector('#emGo'), ec = pg.querySelector('#emCode');
  pg.querySelector('#emOpen').onclick = () => { eb.hidden = !eb.hidden; if (!eb.hidden) ef.email.focus(); };
  ef.onsubmit = async (e) => {
    e.preventDefault(); ee.hidden = true; eg.disabled = true;
    try {
      if (ec.hidden) {
        await api('email_code', { email: ef.email.value.trim(), password: ef.password ? ef.password.value : '' });
        ec.hidden = false; ef.email.disabled = true; if (ef.password) ef.password.disabled = true; eg.textContent = 'تأكيد التغيير'; ef.code.focus();
      } else {
        const j = await api('email_change', { code: ef.code.value.trim() });
        session.set(session.token(), j.user); toast('تم تغيير البريد ✓'); H.closeTop();
      }
    } catch (ex) { ee.textContent = ex.message; ee.hidden = false; }
    eg.disabled = false;
  };
}

/* ================= settings ================= */
export function settingsPage() {
  const { I } = H; const u = session.user();
  return `<div class="pad">
    ${u ? grp('الحساب', [
      row(I.user, 'المعلومات الأساسية', 'data-editprofile', '<small>الاسم والصورة والجوال</small>'),
      u.admin ? row(I.image, 'صورة المعلن وشعار الشركة', 'data-brand', '<small>تظهر على كل الإعلانات</small>') : !isOffice() && row(I.image, 'صورتي على الإعلانات', 'data-advmine', '<small>والشعار للشركات</small>'),
      row(I.verified, 'توثيق حسابك', 'data-verify', u.verified ? '<small class="okv">موثّق</small>' : u.verify && u.verify.status === 'pending' ? '<small>قيد المراجعة</small>' : '<small>للمكاتب العقارية</small>'),
    ]) : ''}
    ${grp('التفضيلات', [
      row(I.bell, 'الإشعارات', 'data-notifs'),
      `<button class="mrow" data-lang><span class="mi">${I.globe}</span><b class="notr">${H.isEn() ? 'العربية' : 'English'}</b><small class="notr">${H.isEn() ? 'التغيير إلى العربية' : 'Switch to English'}</small><i class="chev">‹</i></button>`,
    ])}
    ${grp('الخصوصية والأمان', [
      u && row(I.lock, 'المحظورون', 'data-blocked', '<small>الأعضاء الذين حظرتهم</small>'),
      row(I.shield, 'سياسة الخصوصية', 'data-legal="privacy"'),
      row(I.doc, 'شروط الاستخدام', 'data-legal="terms"'),
      u && `<button class="mrow danger" data-delacc><span class="mi">${I.trash}</span><b>حذف الحساب</b></button>`,
    ])}
  </div>`;
}
export async function deleteAccount() {
  const { toast } = H;
  if (!(await uiConfirm('حذف حسابك نهائياً؟ ستُحذف معه كل إعلاناتك ولا يمكن التراجع.', { danger: true, ok: 'متابعة الحذف' }))) return;
  if (!(await uiConfirm('لا يمكن التراجع بعد الحذف.', { danger: true, title: 'تأكيد أخير: حذف الحساب الآن؟', ok: 'حذف الحساب' }))) return;
  try { await api('delete_account'); session.clear(); toast('تم حذف الحساب'); H.closeAll(); }
  catch (e) { toast(e.message); }
}
export async function doLogout() { await logout(); H.toast('تم تسجيل الخروج'); H.closeAll(); }

/* ================= notifications ================= */

/* ================= «من نحن» — inside the app; the text under «عن الشركة» comes from the website's About page ================= */
const ABOUT_DEF = '<p>عمر الياسي للعقارات شركة عقارية في الشارقة، نساعد عملاءنا في اختيار الأرض المناسبة للسكن أو التطوير أو الاستثمار في الشارقة، بخيارات تنافسية وخطط سداد مرنة، مع متابعة كاملة من أول استفسار حتى تسجيل الأرض.</p>';
const aboutGet = () => { try { return JSON.parse(localStorage.getItem('oay:about')) || null; } catch { return null; } };
export function aboutPage() {
  const { I, CONTACT, waLink, LOGO, DATA } = H; const d = DATA();
  const sold = d.lands.filter((l) => l.status === 'sold').length, av = d.lands.filter((l) => l.status === 'av').length;
  const c = aboutGet();
  return `<div class="aboutpg">
    <section class="ab-hero"><div class="ab-logo"><img src="${LOGO}" alt="عمر الياسي للعقارات"></div>
      <p>شريكك الموثوق في أراضي الشارقة</p></section>
    <div class="ab-stats"><div><b>${d.projects.length || '—'}</b><span>مشروع</span></div><div><b>${av || '—'}</b><span>أرض متاحة</span></div><div><b>${sold || '—'}</b><span>تم بيعها</span></div></div>
    <section class="ab-sec"><h3>${I.building} عن الشركة</h3><div class="ab-body" id="abBody">${c && c.html ? c.html : ABOUT_DEF}</div></section>
    <section class="ab-sec"><h3>${I.star} لماذا عمر الياسي؟</h3><div class="ab-why">
      <div>${I.map}<b>مخططات تفاعلية</b><span>شاهد موقع كل أرض ومساحتها وحالتها على المخطط مباشرة</span></div>
      <div>${I.calc}<b>خطط سداد مرنة</b><span>دفعات وأقساط واضحة لكل أرض قبل أن تقرر</span></div>
      <div>${I.globe}<b>تملّك حر</b><span>مشاريع بتملّك حر لجميع الجنسيات العربية</span></div>
      <div>${I.chat}<b>متابعة حتى التسجيل</b><span>فريقنا معك من أول استفسار حتى نقل الملكية</span></div></div></section>
    <section class="ab-sec"><h3>${I.phone} تواصل معنا</h3>
      <div class="ab-cta"><a class="btn primary" href="tel:${CONTACT.phone}">${I.phone} اتصل بنا</a><a class="btn wa" href="${waLink('مرحباً، أرغب بالاستفسار عن الأراضي المتاحة')}" data-ext>${I.wa} واتساب</a></div>
      <div class="ab-lines"><span>${I.pin}${CONTACT.address}</span><span dir="ltr">${I.phone}${CONTACT.phoneLabel}</span><a href="${CONTACT.instagram}" data-ext>${I.ig}<span dir="ltr">@omaralyassi.uae3</span></a></div></section>
  </div>`;
}
/** the About page text from the website (WordPress REST), cleaned to plain headings / paragraphs / lists; kept on the phone */
export async function initAbout(pg) {
  const box = pg.querySelector('#abBody'); const c = aboutGet();
  if (c && Date.now() - c.t < 24 * 3600e3) return;
  try {
    const r = await fetch(`${H.SITE}/wp-json/wp/v2/pages?slug=about-us&_fields=content`, { cache: 'no-store' });
    const j = await r.json(); const raw = j && j[0] && j[0].content && j[0].content.rendered; if (!raw) return;
    const doc = new DOMParser().parseFromString(raw, 'text/html'); const out = []; const seen = new Set();
    doc.querySelectorAll('h1,h2,h3,h4,p,li').forEach((el) => {
      if (el.closest('li') && el.tagName !== 'LI') return;
      const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t.length < 3 || seen.has(t) || /^(من نحن|about us)$/i.test(t)) return; seen.add(t);
      out.push(/^H/.test(el.tagName) ? `<h4>${H.esc(t)}</h4>` : el.tagName === 'LI' ? `<p class="li">${H.esc(t)}</p>` : `<p>${H.esc(t)}</p>`);
    });
    const html = out.join(''); if (html.length < 80) return;
    try { localStorage.setItem('oay:about', JSON.stringify({ t: Date.now(), html })); } catch { /* private mode */ }
    if (box && box.isConnected) box.innerHTML = html;
  } catch { /* offline: keep what we have */ }
}

/* ================= contact us (the old tab) ================= */
export function contactPage() {
  const { I, CONTACT, waLink, EMBLEM, SITE } = H;
  return `<div class="pad">
    <section class="about"><img src="${EMBLEM}" alt=""><h2>عمر الياسي للعقارات</h2><p>نساعدك في اختيار الأرض المناسبة للتطوير أو الاستثمار في الشارقة، بخيارات تنافسية وخطط سداد مرنة.</p></section>
    <div class="clist">
      <a class="citem" href="tel:${CONTACT.phone}">${I.phone}<div><b>اتصل بنا</b><span dir="ltr">${CONTACT.phoneLabel}</span></div></a>
      <a class="citem" href="${waLink('مرحباً، أرغب بالاستفسار عن الأراضي المتاحة')}" data-ext>${I.wa}<div><b>واتساب</b><span dir="ltr">${CONTACT.whatsappLabel}</span></div></a>
      <a class="citem" href="tel:${CONTACT.office}">${I.office}<div><b>هاتف المكتب</b><span dir="ltr">${CONTACT.officeLabel}</span></div></a>
      <a class="citem" href="mailto:${CONTACT.email}">${I.mail}<div><b>البريد الإلكتروني</b><span>${CONTACT.email}</span></div></a>
      <div class="citem">${I.pin}<div><b>العنوان</b><span>${CONTACT.address}</span></div></div>
    </div>
    <div class="social"><a href="${CONTACT.instagram}" data-ext>${I.ig} إنستغرام</a><a href="${CONTACT.facebook}" data-ext>${I.fb} فيسبوك</a></div>
    <div class="clist"><button class="citem" data-web="${SITE}">${I.globe}<div><b>الموقع الإلكتروني</b><span>omaralyassirealestate.com</span></div></button></div>
  </div>`;
}

/* ================= saved searches (kept on the phone) ================= */
export const saved = {
  all() { try { return JSON.parse(localStorage.getItem('oay:saved') || '[]'); } catch { return []; } },
  put(a) { try { localStorage.setItem('oay:saved', JSON.stringify(a)); } catch { /* ignore */ } },
};
export function savedPage() {
  const { esc } = H; const a = saved.all();
  return `<div class="pad">${a.length ? `<div class="mbox">${a.map((x, i) => `<div class="mrow"><span class="mi">${H.I.search}</span><button class="grow" data-runsaved="${i}"><b>${esc(x.name)}</b></button><button class="xdel" data-delsaved="${i}" aria-label="حذف">✕</button></div>`).join('')}</div>`
    : `<div class="empty">${H.I.search}<p>لا توجد عمليات بحث محفوظة</p><p class="sub">من «الأراضي» افتح الفلاتر واضغط «حفظ هذا البحث»</p></div>`}</div>`;
}

/* ================= terms & privacy ================= */
export function legalPage(k) { const L = (H.isEn() ? LEGAL_EN : LEGAL)[k] || LEGAL.privacy; return `<div class="pad legal"><h2>${L[0]}</h2>${L[1]}</div>`; }
export const legalTitle = (k) => ((H && H.isEn() ? LEGAL_EN : LEGAL)[k] || LEGAL.privacy)[0];

/* ================= account verification (real-estate offices) ================= */
export function verifyPage() {
  const { esc, I } = H; const u = session.user() || {}; const v = u.verify || {};
  if (u.verified) {
    return `<div class="pad vpage"><div class="vhero ok">${I.verified}</div><h2>حسابك موثّق</h2>
      <p class="muted">${esc(u.company || '')}</p><p class="vtxt">تظهر علامة التوثيق على حسابك وإعلاناتك، ويمكنك تمييز إعلاناتك بالنقاط من «عقاراتي».</p>
      <div class="pts"><b>${u.points || 0}</b><span>نقطة في رصيدك · تمييز الإعلان بـ 70 نقطة</span></div></div>`;
  }
  if (v.status === 'pending') {
    return `<div class="pad vpage"><div class="vhero">${I.verified}</div><h2>طلبك قيد المراجعة</h2>
      <p class="vtxt">شكراً لكم، سيتواصل معكم أحد موظفينا في أقرب وقت.</p>
      <div class="inst"><div class="r"><span>المكتب / الشركة</span><b>${esc(v.company)}</b></div><div class="r"><span>المدينة</span><b>${esc(v.city)}</b></div><div class="r"><span>الهاتف</span><b dir="ltr">${esc(v.phone)}</b></div></div></div>`;
  }
  const ph = (u.phone || '').replace(/\D/g, '').replace(/^(00971|971|0)/, '').slice(0, 9);
  return `<div class="pad vpage"><div class="vhero">${I.verified}</div><h2>وثّق حسابك</h2>
    <p class="muted">خدمة مخصصة للمكاتب والشركات العقارية<br>يرجى إدخال بياناتك أدناه</p>
    ${v.status === 'rejected' ? `<p class="ferr">لم تتم الموافقة على الطلب السابق${v.note ? ': ' + esc(v.note) : ''}</p>` : ''}
    <form class="accf vcard" id="vForm" novalidate>
      <label>اسم المكتب / الشركة العقارية<input name="company" maxlength="120" value="${esc(v.company || '')}"></label>
      <label>المدينة<select name="city"><option value="">اختر المدينة</option>${CITIES.map((c) => `<option ${v.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>الاسم<input name="name" maxlength="80" value="${esc(v.name || u.name || '')}"></label>
      <label>رقم الهاتف<div class="phone"><span dir="ltr">🇦🇪 +971</span><input name="phone" dir="ltr" inputmode="numeric" maxlength="9" placeholder="5XXXXXXXX" value="${esc(ph)}"></div><small class="cnt" id="pcnt">${ph.length}/9</small></label>
      <p class="ferr" id="vErr" hidden></p>
    </form>
    <p class="vnote">هذه الخدمة مجانية للمكاتب العقارية المرخّصة. بعد النقر على «إرسال الطلب» سيتصل بك أحد موظفينا لطلب نسخة من الرخصة التجارية. عند الموافقة تظهر علامة التوثيق على حسابك وتحصل على 500 نقطة لتمييز إعلاناتك.</p>
    <button class="btn primary block share-big" id="vGo">إرسال الطلب</button></div>`;
}
export function initVerify(pg) {
  const form = pg.querySelector('#vForm'); if (!form) return;
  const err = pg.querySelector('#vErr'), go = pg.querySelector('#vGo'), cnt = pg.querySelector('#pcnt');
  form.phone.addEventListener('input', () => { form.phone.value = form.phone.value.replace(/\D/g, '').slice(0, 9); cnt.textContent = form.phone.value.length + '/9'; });
  go.onclick = async () => {
    err.hidden = true; go.disabled = true;
    try {
      const j = await api('verify_request', Object.fromEntries(new FormData(form)));
      session.set(session.token(), j.user);
      H.closeTop(); setTimeout(() => H.pushPage('verify'), 280);
      H.toast('شكراً لكم، سيتواصل معكم أحد موظفينا في أقرب وقت');
    } catch (ex) { err.textContent = ex.message; err.hidden = false; go.disabled = false; }
  };
}

/* ================= «لوحة الإدارة / أدوات الموظف»: the office's tools in three groups ================= */
export function toolsPage() {
  const { I } = H; const u = session.user() || {};
  const t = (ok, icon, label, attrs, cnt = '') => (ok ? `<button class="wtile" ${attrs}><span>${icon}${cnt ? `<i data-cnt="${cnt}" hidden></i>` : ''}</span><b>${label}</b></button>` : '');
  const sec = (title, tiles) => { const r = tiles.filter(Boolean).join(''); return r ? `<h3 class="msec">${title}</h3><div class="wgrid">${r}</div>` : ''; };
  const stat = (ok, key, label, attrs) => (ok ? `<button class="wstat" ${attrs}><b data-stat="${key}">–</b><span>${label}</span></button>` : '');
  const stats = [
    stat(can('listings'), 'ads', 'إعلانات بانتظار المراجعة', 'data-admin'),
    stat(!!u.admin, 'reports', 'بلاغات جديدة', 'data-admrep'),
    stat(can('chats'), 'chats', 'رسائل غير مقروءة', 'data-tab="chats"'),
    stat(can('viewings'), 'views', 'معاينات قادمة', 'data-views'),
  ].filter(Boolean).join('');
  return `<div class="pad mtools">
    <div class="wkhead"><span class="wrole">${u.admin ? I.shield + ' الإدارة' : I.brief + ' ' + ({ mgr: 'مدير', mkt: 'مدير تسويق' }[u.role] || 'موظف')}</span><b class="notr">${H.esc(u.name || '')}</b></div>
    ${stats ? `<div class="wstats">${stats}</div>` : ''}
    ${sec('العملاء', [
      t(can('leads'), I.user, 'متابعة العملاء', 'data-leads'),
      t(can('leads'), I.phone, 'سجل التواصل', 'data-contacts'),
      t(can('viewings'), I.calendar, 'مواعيد المعاينة', 'data-views'),
      t(can('chats'), I.chat, 'المحادثات', 'data-tab="chats"'),
      t(can('leads'), I.star, 'تقييمات الخدمة', 'data-rates'),
      t(can('leads'), I.share, 'دعوات العملاء', 'data-refs'),
      t(can('leads'), I.clock, 'التسجيل المسبق', 'data-prereg'),
    ])}
    ${sec('الإعلانات والمخططات', [
      t(can('listings'), I.shield, 'مراجعة الإعلانات', 'data-admin', 'ads'),
      t(!!u.admin, I.alert, 'البلاغات', 'data-admrep', 'reports'),
      t(can('plots'), I.grid, 'تعديل قطعة على المخطط', 'data-plotedit=""'),
      t(!!u.admin, I.file, 'استيراد ملف الأراضي', 'data-limport=""'),
      t(can('listings'), I.scale, 'مقارنة بالسوق', 'data-market'),
    ])}
    ${sec('التسويق', [
      t(can('design'), I.image, 'تصميم البوستات', 'data-adgen=""'),
      t(can('push'), I.bell, 'إشعار موجّه', 'data-pushc'),
      t(!!u.admin, I.mail, 'النشرة البريدية', 'data-mailadm'),
      t(can('news'), I.trend, 'الأخبار العقارية', 'data-news'),
    ])}
    ${sec('الفريق والتقارير', [
      t(can('report'), I.doc, 'التقرير الأسبوعي', 'data-report'),
      t(can('listings') || can('report'), I.chart, 'إحصائيات الإعلانات', 'data-mystats'),
      t(!!u.admin, I.verified, 'الموظفون والصلاحيات', 'data-staff'),
      t(!!u.admin || u.role === 'mgr', I.users || I.user, 'نشاط الفريق', 'data-team'),
    ])}
  </div>`;
}
/** the counters on top of «لوحة العمل» */
export async function initTools(pg) {
  const set = (k, n) => { pg.querySelectorAll(`[data-stat="${k}"]`).forEach((b) => { b.textContent = n; b.closest('.wstat').classList.toggle('hot', n > 0); }); pg.querySelectorAll(`[data-cnt="${k}"]`).forEach((i) => { i.textContent = n; i.hidden = !(n > 0); }); };
  const u = session.user() || {};
  const jobs = [];
  if (can('listings')) jobs.push(api('adm_ads', { status: 'pending' }).then((j) => set('ads', (j.counts && j.counts.pending) || 0)).catch(() => set('ads', '–')));
  if (u.admin) jobs.push(api('adm_reports').then((j) => set('reports', j.items.filter((r) => !r.done).length)).catch(() => set('reports', '–')));
  if (can('chats')) jobs.push(api('chat_unread').then((j) => set('chats', (j.n || 0) + ((j.group && j.group.unread) || 0))).catch(() => set('chats', '–')));
  if (can('viewings')) jobs.push(api('adm_views', { tab: 'next' }).then((j) => set('views', (j.items || []).length)).catch(() => set('views', '–')));
  await Promise.all(jobs);
}
