// «المزيد» tab: profile, my activity, account & settings, support, terms & privacy.
import { api, session, refreshMe, logout, resizePhoto } from './owner.js';

let H = null;   // helpers from main.js
export function initMore(h) { H = h; }
const VER = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '';

const avatar = (u, cls = 'acc-av') => u && u.avatar
  ? `<span class="${cls} img"><img src="${H.esc(u.avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></span>`
  : `<span class="${cls}">${H.esc(u ? (u.name || u.email || '?').trim().charAt(0) : '👤')}</span>`;
const vb = (u) => (u && u.verified ? H.I.verified : '');
const CITIES = ['الشارقة', 'دبي', 'أبوظبي', 'عجمان', 'رأس الخيمة', 'أم القيوين', 'الفجيرة', 'العين'];
const row = (icon, label, attrs, extra = '') => `<button class="mrow" ${attrs}><span class="mi">${icon}</span><b>${label}</b>${extra}<i class="chev">‹</i></button>`;

/* ================= the tab ================= */
export function renderMore(el) {
  const { I, esc } = H; const u = session.user();
  el.innerHTML = `
    ${u ? `<button class="mprof" data-profile>${avatar(u, 'mav')}<div><b><span class="notr">${esc(u.verified && u.company ? u.company : u.name || '')}</span>${u.verified && u.company || u.name ? '' : 'حسابي'} ${vb(u)}</b><span>${esc(u.email || '')}</span></div><i class="chev">‹</i></button>`
      : `<button class="mprof" data-account>${avatar(null, 'mav')}<div><b>تسجيل الدخول / حساب جديد</b><span>بالبريد الإلكتروني أو حساب جوجل</span></div><i class="chev">‹</i></button>`}
    <h3 class="msec">نشاطي</h3>
    <div class="mbox">
      ${row(I.building, 'عقاراتي', 'data-account', u ? '' : '<small>سجّل الدخول</small>')}
      ${row(I.plusc, 'أضف أرضك للبيع', 'data-addland')}
      ${row(I.search, 'بحث محفوظ', 'data-saved', `<small>${saved.all().length || ''}</small>`)}
      ${row(I.heart, 'المفضلة', 'data-tab="favs"')}
      ${row(I.wallet, 'حاسبة الأقساط', 'data-calc=""')}
      ${row(I.bell, 'أرض تناسبني', 'data-alerts=""')}
      ${row(I.search, 'مطلوب أرض', 'data-wanted')}
      ${row(I.doc, 'دليل الإجراءات العقارية', 'data-guide')}
      ${row(I.doc, 'الأخبار العقارية', 'data-news', u && u.admin ? '<small>إدارة الشريط</small>' : '')}
      ${u && u.admin ? row(I.shield, 'لوحة الإدارة', 'data-admin') : ''}
      ${u && u.admin ? row(I.grid, 'التقرير الأسبوعي', 'data-report') : ''}
      ${u && u.admin ? row(I.phone, 'سجل التواصل', 'data-contacts') : ''}
      ${u && u.admin ? row(I.user, 'متابعة العملاء', 'data-leads') : ''}
      ${u && u.admin ? row(I.bell, 'إشعار موجّه', 'data-pushc') : ''}
    </div>
    <h3 class="msec">الحساب والإعدادات</h3>
    <div class="mbox">
      ${row(I.verified, 'توثيق حسابك', u ? 'data-verify' : 'data-account', u ? (u.verified ? '<small class="okv">موثّق</small>' : u.verify && u.verify.status === 'pending' ? '<small>قيد المراجعة</small>' : '') : '')}
      ${row(I.bell, 'خيارات الإشعارات', 'data-notifs')}
      <button class="mrow" data-lang><span class="mi">${I.globe}</span><b class="notr">${H.isEn() ? 'العربية' : 'English'}</b><small class="notr">${H.isEn() ? 'التغيير إلى العربية' : 'Switch to English'}</small><i class="chev">‹</i></button>
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
  return `<div class="pprof">${avatar(u, 'bav')}<h2><span class="notr">${esc(u.verified && u.company ? u.company : u.name || '')}</span> ${vb(u)}</h2>
      ${u.verified && u.company ? `<p class="muted">${esc(u.name || '')}</p>` : ''}
      <span class="role">${u.admin ? '🛡️ مدير' : u.verified ? '🏢 مكتب عقاري موثّق' : '🏠 عضو'}</span>
      <div class="pinfo"><div><b>${u.admin ? '∞' : u.points || 0}</b><span>نقطة</span></div><div><b dir="ltr">${esc(u.phone || '—')}</b><span>الجوال</span></div></div>
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
<li>رسائل المحادثة التي ترسلها للشركة.</li>
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
const LEGAL_EN = {
  privacy: ['Privacy policy', `<div class="notr" dir="ltr">
<p>The Omar Al Yassi Real Estate app (Sharjah, United Arab Emirates) respects your privacy. This policy explains what data we collect and how we use it.</p>
<h3>Data we collect</h3>
<ul><li>When you create an account: name, email, mobile number and a password stored encrypted. With Google sign-in: the name, email and account photo Google shares.</li>
<li>When you add a land: the listing details, the photos you upload and your contact number.</li>
<li>When you turn on notifications: a device identifier used to send them (through OneSignal).</li>
<li>Chat messages you send to the office.</li>
<li>Favourites and saved searches are stored on your device only.</li></ul>
<h3>How we use it</h3>
<ul><li>To manage your account and review, approve and show your listings.</li><li>To contact you about your land or your enquiry.</li><li>To send price and offer alerts if you turn them on.</li></ul>
<p>We do not sell your data or share it with anyone for marketing. Your mobile number is not shown to other users; contact about listings goes through the company.</p>
<h3>Deleting your data</h3><p>You can delete your account and all your listings at any time from «More → Settings → Delete account», or by emailing us.</p>
<h3>Contact</h3><p>For any privacy question: omaralyassi.realestate@gmail.com</p></div>`],
  terms: ['Terms of use', `<div class="notr" dir="ltr">
<p>By using the Omar Al Yassi Real Estate app you agree to the following terms.</p>
<h3>Account</h3><ul><li>You must enter correct details and keep your password confidential.</li><li>The office may suspend any account that breaks these terms.</li></ul>
<h3>Listings</h3><ul><li>You must own the land or be authorised to offer it, and its details, prices and photos must be correct.</li>
<li>The office reviews every listing before it is shown, and may edit, reject or delete it without giving reasons.</li>
<li>If you give a plot number in one of our projects, the land may be shown on that project's interactive plan after approval.</li>
<li>Enquiries about listings by other offices go through our office, which puts the client in touch with the advertiser.</li>
<li>Points are granted by the office to feature listings and cannot be exchanged for cash.</li></ul>
<h3>Information</h3><p>We aim to keep prices and statuses accurate, but they can change; the final reference is the company's confirmation before any booking or payment.</p>
<h3>Contact</h3><p>Phone: 06 744 2027 · WhatsApp: 056 808 0655</p></div>`],
};
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
