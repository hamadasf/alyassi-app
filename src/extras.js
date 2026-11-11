// «قيّم خدمتنا» (asked two days after a client contacts the office) and two office pages:
// service ratings, and the «قريباً» pre-registration list from omaralyassirealestate.com/app.
import { api, session } from './owner.js';
import { deviceId } from './track.js';
import { askPlayReview } from './growth.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null;
export function initExtras(h) { H = h; }
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem('oay:' + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('oay:' + k, JSON.stringify(v)); } catch { /* private mode */ } };
const DAY = 864e5;

/* ---------------- the client side ---------------- */
/** a WhatsApp / call to the office about a land: remember it, to ask for a rating later */
export function noteContact(id) {
  if ((session.user() || {}).admin || ((session.user() || {}).staff || []).length) return;   // not the office's own phones
  if (Date.now() - (lsGet('rated', 0) || 0) < 60 * DAY) return;
  if (!lsGet('rateq', null)) lsSet('rateq', { id: id || '', t: Date.now() });
}
/** on opening the app: two days after a contact, once */
export function maybeAskRating() {
  const q = lsGet('rateq', null); if (!q) return;
  const age = Date.now() - q.t;
  if (age > 30 * DAY) { localStorage.removeItem('oay:rateq'); return; }
  if (age < 2 * DAY) return;
  setTimeout(() => rateSheet(q.id), 2500);
}
function rateSheet(id) {
  const { esc, toast } = H;
  if (document.querySelector('.ratesheet')) return;
  const el = document.createElement('div'); el.className = 'pkgsheet ratesheet';
  el.innerHTML = `<form class="pkgbox rsbox"><div class="rs-ic">${H.I.star}</div><h3>كيف كانت تجربتك مع عمر الياسي للعقارات؟</h3>
    <p class="muted">رأيك يساعدنا نخدمك أحسن${id ? ' · بخصوص استفسارك الأخير' : ''}</p>
    <div class="rs-st">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-rst="${i}" aria-label="${i}">${H.I.star}</button>`).join('')}</div>
    <div class="rs-lb"></div>
    <textarea name="text" rows="3" maxlength="500" placeholder="اكتب ملاحظتك (اختياري)"></textarea>
    <button class="btn primary block rs-go" disabled>إرسال التقييم</button>
    <div class="rs-later"><button type="button" data-rlater>لاحقاً</button><button type="button" data-rno>لا، شكراً</button></div></form>`;
  const LB = ['', 'سيئة', 'مقبولة', 'جيدة', 'جيدة جداً', 'ممتازة'];
  let stars = 0;
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); };
  el.addEventListener('click', (e) => {
    const s = e.target.closest('[data-rst]');
    if (s) { stars = +s.dataset.rst; el.querySelectorAll('[data-rst]').forEach((b) => b.classList.toggle('on', +b.dataset.rst <= stars)); el.querySelector('.rs-lb').textContent = LB[stars]; el.querySelector('.rs-go').disabled = false; return; }
    if (e.target.closest('[data-rlater]')) { lsSet('rateq', { id, t: Date.now() - DAY }); close(); return; }   // ask again tomorrow
    if (e.target.closest('[data-rno]') || e.target === el) { localStorage.removeItem('oay:rateq'); lsSet('rated', Date.now()); close(); }
  });
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); if (!stars) return;
    const go = el.querySelector('.rs-go'); go.disabled = true; go.textContent = 'جارِ الإرسال…';
    try {
      await api('svc_rate', { stars, text: el.querySelector('textarea').value.trim(), id, dev: deviceId() });
      localStorage.removeItem('oay:rateq'); lsSet('rated', Date.now());
      if (stars >= 4) { setTimeout(close, 1800); askPlayReview(2200); }   // a happy client: ask for a Google Play rating too
      el.querySelector('form').innerHTML = `<div class="rs-ic ok">✓</div><h3>شكراً لتقييمك!</h3><p class="muted">${stars >= 4 ? 'سعداء إن تجربتك كانت مميزة' : 'وصلت ملاحظتك للإدارة وهنتواصل معك لو احتجنا'}</p><button type="button" class="btn ghost block" data-rno>إغلاق</button>`;
    } catch (ex) { toast(ex.message); go.disabled = false; go.textContent = 'إرسال التقييم'; }
  };
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  void esc;
}

/* ---------------- office: service ratings ---------------- */
const ago = (t) => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : (document.documentElement.lang === 'en' ? `${d} days ago` : `منذ ${d} يوم`); };
const starsRow = (n) => `<span class="rs-row">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">${H.I.star}</i>`).join('')}</span>`;
export const ratesPage = () => `<div class="pad" id="ratesBox"><div class="cempty">${H.I.star}<p>جارِ التحميل…</p></div></div>`;
export async function initRatesPage(pg) {
  const { esc } = H; const box = pg.querySelector('#ratesBox');
  try {
    const j = await api('adm_rates');
    const bar = (s) => { const n = j.dist[s] || 0; return `<div class="rb"><span>${s}</span><i><b style="width:${j.n ? (n / j.n) * 100 : 0}%"></b></i><em>${n}</em></div>`; };
    box.innerHTML = `<div class="rsum2"><div><b>${j.n ? j.avg.toFixed(1) : '—'}</b>${starsRow(j.avg)}<span>${j.n} تقييم</span></div><div class="rbars">${[5, 4, 3, 2, 1].map(bar).join('')}</div></div>
      ${j.items.length ? j.items.map((x) => `<div class="ccard rrow${x.stars <= 3 ? ' low' : ''}"><div class="rr1">${starsRow(x.stars)}<time>${ago(x.t)}</time></div>
        ${x.text ? `<p class="notr">${esc(x.text)}</p>` : '<p class="muted">بدون تعليق</p>'}
        <small>${x.uid ? `<button class="clink notr" data-lead="${x.uid}">${esc(x.who)}</button>` : 'زائر بدون حساب'}${x.id ? ` · <button class="clink notr" data-land="${esc(x.id)}">${esc(x.name || x.id)}</button>` : ''}</small></div>`).join('')
        : `<div class="cempty">${H.I.star}<p>لا توجد تقييمات بعد</p><p class="muted">يُطلب التقييم من العميل بعد يومين من تواصله معكم.</p></div>`}`;
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

/* ---------------- office: «قريباً» pre-registrations ---------------- */
const KIND = { buyer: 'يبحث عن أرض', seller: 'عنده أرض للبيع', broker: 'مكتب / وسيط' };
const PAGE = 'https://omaralyassirealestate.com/app';
export const preregPage = () => `<div class="pad" id="preBox"><div class="cempty">${H.I.user}<p>جارِ التحميل…</p></div></div>`;
export async function initPreregPage(pg) {
  const { esc, toast } = H; const box = pg.querySelector('#preBox'); let all = [], k = '';
  const wa = (p) => 'https://wa.me/' + String(p).replace(/\D/g, '');
  const draw = () => {
    const ls = k ? all.filter((x) => x.kind === k) : all;
    box.querySelector('.prl').innerHTML = ls.length ? ls.map((x) => `<div class="ccard prrow"><div><b class="notr">${esc(x.name)}</b><span><bdi dir="ltr">+${esc(x.phone)}</bdi>${x.email ? ` · <bdi class="notr">${esc(x.email)}</bdi>` : ''}</span><small>${KIND[x.kind] || ''} · ${ago(x.t)}</small></div>
      <div class="cact"><a class="btn ghost sm" href="tel:+${esc(x.phone)}">${H.I.phone}</a><a class="btn wa sm" href="${esc(wa(x.phone))}" data-ext>${H.I.wa}</a></div></div>`).join('') : `<div class="cempty">${H.I.user}<p>لا يوجد تسجيلات بعد</p></div>`;
  };
  try {
    const j = await api('adm_prereg'); all = j.items || [];
    box.innerHTML = `<div class="ccard prhead"><b>${j.n}</b><span>شخص سجّل في صفحة «قريباً»</span>
        <div class="prlink"><bdi dir="ltr">${PAGE}</bdi><button class="btn sm" data-prcopy>نسخ الرابط</button></div>
        <p class="muted small">ضع هذا الرابط في البايو وفي وصف الريل. كل من يسجّل يظهر هنا.</p></div>
      <div class="chips scroll"><button class="chip on" data-prk="">الكل ${j.n}</button>${Object.keys(KIND).map((x) => `<button class="chip" data-prk="${x}">${KIND[x]} ${j.kinds[x] || 0}</button>`).join('')}</div>
      <div class="prbtns"><button class="btn ghost" data-prcsv>${H.I.file} تصدير الأسماء (CSV)</button>${(session.user() || {}).admin ? `<button class="btn primary" data-prmail ${j.mailed ? 'disabled' : ''}>${H.I.mail} ${j.mailed ? 'تم إرسال إيميل الإطلاق' : 'إيميل الإطلاق للجميع'}</button>` : ''}</div>
      <div class="prl"></div>`;
    draw();
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  box.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-prk]');
    if (c) { k = c.dataset.prk; box.querySelectorAll('[data-prk]').forEach((b) => b.classList.toggle('on', b === c)); draw(); return; }
    if (e.target.closest('[data-prcopy]')) { try { await navigator.clipboard.writeText(PAGE); toast('تم نسخ الرابط ✓'); } catch { toast(PAGE); } return; }
    if (e.target.closest('[data-prcsv]')) {
      const rows = [['الاسم', 'الجوال', 'البريد', 'النوع', 'التاريخ'], ...all.map((x) => [x.name, '+' + x.phone, x.email || '', KIND[x.kind] || '', new Date(x.t).toISOString().slice(0, 10)])];
      const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const f = { name: 'pre-registrations.csv', bytes: new TextEncoder().encode(csv), type: 'text/csv' };
      if (H.native) await H.shareFile(f, 'التسجيل المسبق', 'التسجيل المسبق');
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([f.bytes], { type: f.type })); a.download = f.name; a.click(); }
      return;
    }
    if (e.target.closest('[data-prmail]')) {
      const android = await uiPrompt('اتركه فارغاً إن لم يكن جاهزاً', '', { title: 'رابط التطبيق على Google Play', ok: 'التالي', type: 'url', placeholder: 'https://play.google.com/…' }) || '';
      const ios = await uiPrompt('اتركه فارغاً إن لم يكن جاهزاً', '', { title: 'رابط التطبيق على App Store', ok: 'التالي', type: 'url', placeholder: 'https://apps.apple.com/…' }) || '';
      if (!android && !ios) return;
      if (!(await uiConfirm('إرسال إيميل «التطبيق متاح الآن» لكل من كتب بريده؟ يُرسل مرة واحدة فقط.', { ok: 'إرسال', icon: 'send' }))) return;
      try { const j = await api('adm_prereg_mail', { android, ios }); toast(`تم الإرسال إلى ${j.sent} بريد ✓`); e.target.closest('[data-prmail]').disabled = true; } catch (ex) { toast(ex.message); }
    }
  });
}
