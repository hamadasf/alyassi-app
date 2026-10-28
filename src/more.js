// «المزيد» tab: profile, my activity, account & settings, support, terms & privacy.
import { api, session, refreshMe, logout, resizePhoto } from './owner.js';

let H = null;   // helpers from main.js
export function initMore(h) { H = h; }
const VER = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '';

const avatar = (u, cls = 'acc-av') => u && u.avatar
  ? `<span class="${cls} img"><img src="${H.esc(u.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></span>`
  : `<span class="${cls}">${H.esc(u ? (u.name || u.email || '?').trim().charAt(0) : '👤')}</span>`;
const row = (icon, label, attrs, extra = '') => `<button class="mrow" ${attrs}><span class="mi">${icon}</span><b>${label}</b>${extra}<i class="chev">‹</i></button>`;

/* ================= the tab ================= */
export function renderMore(el) {
  const { I, esc } = H; const u = session.user();
  el.innerHTML = `
    ${u ? `<button class="mprof" data-profile>${avatar(u, 'mav')}<div><b>${esc(u.name || 'حسابي')}</b><span>${esc(u.email || '')}</span></div><i class="chev">‹</i></button>`
      : `<button class="mprof" data-account>${avatar(null, 'mav')}<div><b>تسجيل الدخول / حساب جديد</b><span>بالبريد الإلكتروني أو حساب جوجل</span></div><i class="chev">‹</i></button>`}
    <h3 class="msec">نشاطي</h3>
    <div class="mbox">
      ${row(I.building, 'عقاراتي', 'data-account', u ? '' : '<small>سجّل الدخول</small>')}
      ${row(I.plusc, 'أضف أرضك للبيع', 'data-addland')}
      ${row(I.search, 'بحث محفوظ', 'data-saved', `<small>${saved.all().length || ''}</small>`)}
      ${row(I.heart, 'المفضلة', 'data-tab="favs"')}
      ${u && u.admin ? row(I.shield, 'لوحة الإدارة', 'data-admin') : ''}
    </div>
    <h3 class="msec">الحساب والإعدادات</h3>
    <div class="mbox">
      ${row(I.bell, 'خيارات الإشعارات', 'data-notifs')}
      ${u ? row(I.gear, 'إعدادات', 'data-settings') : ''}
    </div>
    <h3 class="msec">الدعم</h3>
    <div class="mbox">
      ${row(I.phone, 'الاتصال بنا', 'data-contactpg')}
      ${row(I.info, 'من نحن', `data-web="${H.SITE}/about-us/"`)}
      ${u ? `<button class="mrow danger" data-logout><span class="mi">${I.logout}</span><b>تسجيل الخروج</b></button>` : ''}
    </div>
    <p class="mfoot">باستخدامك تطبيق عمر الياسي للعقارات فأنت توافق على <button data-legal="terms">شروط الاستخدام</button> و<button data-legal="privacy">سياسة الخصوصية</button></p>
    <p class="ver">الإصدار ${esc(VER || '1.0')}</p>`;
}

/* ================= profile ================= */
export function profilePage() {
  const { esc } = H; const u = session.user() || {};
  return `<div class="pprof">${avatar(u, 'bav')}<h2>${esc(u.name || '')}</h2>
      <span class="role">${u.admin ? '🛡️ مدير' : '🏠 عضو'}</span>
      <div class="pinfo"><div><b>${u.points || 0}</b><span>نقطة</span></div><div><b dir="ltr">${esc(u.phone || '—')}</b><span>الجوال</span></div></div>
      <p class="muted">${esc(u.email || '')}${u.google ? ' · دخول بحساب جوجل' : ''}</p></div>
    <div class="pad"><button class="btn primary block share-big" data-editprofile>تعديل الملف</button></div>`;
}
export function editProfilePage() {
  const { esc } = H; const u = session.user() || {};
  return `<div class="pad acc">
    <div class="pprof flat"><label class="avpick">${avatar(u, 'bav')}<input type="file" accept="image/*" hidden id="avFile"><span>تغيير الصورة</span></label></div>
    <form class="accf" id="profForm" novalidate>
      <label>الاسم<input name="name" maxlength="80" value="${esc(u.name || '')}"></label>
      <label>رقم الجوال<input name="phone" type="tel" dir="ltr" inputmode="tel" value="${esc(u.phone || '')}" placeholder="05xxxxxxxx"></label>
      <label>البريد الإلكتروني<input value="${esc(u.email || '')}" disabled dir="ltr"></label>
      <p class="ferr" id="profErr" hidden></p>
      <button class="btn gold block share-big" type="submit" id="profGo">حفظ</button>
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
}

/* ================= settings ================= */
export function settingsPage() {
  const { I } = H;
  return `<div class="pad">
    <h3 class="msec">إعدادات الحساب</h3>
    <div class="mbox">
      ${row(I.user, 'المعلومات الأساسية', 'data-editprofile')}
      ${row(I.phone, 'رقم الجوال', 'data-editprofile')}
      <button class="mrow danger" data-delacc><span class="mi">${I.trash}</span><b>حذف الحساب</b></button>
    </div>
    <h3 class="msec">الخصوصية</h3>
    <div class="mbox">${row(I.shield, 'سياسة الخصوصية', 'data-legal="privacy"')}${row(I.doc, 'شروط الاستخدام', 'data-legal="terms"')}</div>
  </div>`;
}
export async function deleteAccount() {
  const { toast } = H;
  if (!confirm('حذف حسابك نهائياً؟ ستُحذف معه كل إعلاناتك ولا يمكن التراجع.')) return;
  if (!confirm('تأكيد أخير: حذف الحساب الآن؟')) return;
  try { await api('delete_account'); session.clear(); toast('تم حذف الحساب'); H.closeAll(); }
  catch (e) { toast(e.message); }
}
export async function doLogout() { await logout(); H.toast('تم تسجيل الخروج'); H.closeAll(); }

/* ================= notifications ================= */
export function notifsPage() {
  return `<div class="pad acc"><div class="notif-card" style="display:flex">${H.I.bell}<div><b>إشعارات الأسعار والعروض</b><p></p></div><button class="btn gold" data-notify>تفعيل</button></div>
    <div class="mbox"><div class="mrow static"><span class="mi">${H.I.bell}</span><b>تصلك إشعارات عند:</b></div>
      <div class="mrow static sub">• تغيّر سعر أو حالة أي أرض</div><div class="mrow static sub">• نزول أرض جديدة على المخططات</div><div class="mrow static sub">• العروض لفترة محدودة</div></div>
    <p class="muted" id="nstate"></p></div>`;
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
const LEGAL = {
  privacy: ['سياسة الخصوصية', `
<p>تطبيق «عمر الياسي للعقارات» (الشارقة، الإمارات العربية المتحدة) يحترم خصوصيتك. توضح هذه السياسة البيانات التي نجمعها وكيف نستخدمها.</p>
<h3>البيانات التي نجمعها</h3>
<ul><li>عند إنشاء حساب: الاسم، البريد الإلكتروني، رقم الجوال، وكلمة مرور محفوظة بشكل مشفّر. عند الدخول بحساب جوجل: الاسم والبريد وصورة الحساب التي يشاركها جوجل.</li>
<li>عند إضافة أرض: تفاصيل الإعلان والصور التي ترفعها ورقم التواصل.</li>
<li>عند تفعيل الإشعارات: معرّف جهاز لإرسال الإشعارات (عبر خدمة OneSignal).</li>
<li>المفضلة وعمليات البحث المحفوظة تُحفظ على جهازك فقط.</li></ul>
<h3>كيف نستخدمها</h3>
<ul><li>لإدارة حسابك ومراجعة إعلاناتك وعرضها بعد الموافقة.</li><li>للتواصل معك بخصوص أرضك أو استفسارك.</li><li>لإرسال إشعارات الأسعار والعروض إذا فعّلتها.</li></ul>
<p>لا نبيع بياناتك ولا نشاركها مع أي طرف لأغراض تسويقية. رقم جوالك لا يظهر للمستخدمين الآخرين؛ التواصل حول الإعلانات يتم عبر الشركة.</p>
<h3>حذف البيانات</h3>
<p>يمكنك حذف حسابك وكل إعلاناتك في أي وقت من «المزيد ← إعدادات ← حذف الحساب»، أو بمراسلتنا على البريد الإلكتروني.</p>
<h3>التواصل</h3><p>لأي سؤال حول الخصوصية: ${'omaralyassi.realestate@gmail.com'}</p>`],
  terms: ['شروط الاستخدام', `
<p>باستخدامك تطبيق «عمر الياسي للعقارات» فأنت توافق على الشروط التالية.</p>
<h3>الحساب</h3><ul><li>تلتزم بإدخال بيانات صحيحة، وأنت مسؤول عن الحفاظ على سرية كلمة المرور.</li><li>يحق للإدارة إيقاف أي حساب يخالف هذه الشروط.</li></ul>
<h3>الإعلانات</h3><ul><li>يجب أن تكون مالكاً للأرض أو مخوّلاً بعرضها، وأن تكون البيانات والأسعار والصور صحيحة.</li>
<li>تُراجع الإدارة كل إعلان قبل عرضه، ويحق لها تعديله أو رفضه أو حذفه دون إبداء أسباب.</li>
<li>عند ذكر رقم القطعة ضمن أحد مشاريعنا قد تُعرض الأرض على المخطط التفاعلي للمشروع بعد الموافقة.</li>
<li>النقاط تُمنح من الإدارة وتُستخدم لتمييز الإعلانات، ولا تُسترد نقداً.</li></ul>
<h3>المعلومات</h3><p>نسعى لدقة الأسعار والحالات المعروضة، لكنها قابلة للتغيير، والمرجع النهائي هو التأكيد من الشركة قبل أي حجز أو دفع.</p>
<h3>التواصل</h3><p>الهاتف: 06 744 2027 · واتساب: 056 808 0655</p>`],
};
export function legalPage(k) { const L = LEGAL[k] || LEGAL.privacy; return `<div class="pad legal"><h2>${L[0]}</h2>${L[1]}</div>`; }
export const legalTitle = (k) => (LEGAL[k] || LEGAL.privacy)[0];
