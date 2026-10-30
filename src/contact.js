// Contact like Bayut: every listing — the company's or an office's — has the same bar (call · WhatsApp · request a
// call back), and all of it reaches the office with the listing's reference number, so the office knows who asked about what.
import { api, session } from './owner.js';
import { track } from './track.js';

let H = null;
export function initContact(h) { H = h; }

const abbr = (slug) => String(slug || '').split(/[-_]/).filter(Boolean).map((w) => (/^\d+$/.test(w) ? w : w[0])).join('').toUpperCase();
/** Reference number shown on the listing and sent with every message: OAY-4938-DN (company plot) / OAY-M901 (member listing). */
export const refOf = (x) => (x.project && x.n ? `OAY-${x.n}-${abbr(x.project)}` : `OAY-M${x.id}`);

/** The WhatsApp message, worded like Bayut's: interest + listing link + reference number. */
export const waText = (title, url, ref) => `مرحباً، أنا مهتم بعقارك الموجود على تطبيق عمر الياسي للعقارات${title ? ` (${title})` : ''}، رابط الإعلان:\n${url || 'https://omaralyassirealestate.com'}\nالرقم المرجعي\n${ref}`;

/** id: the land id used by the app ('slug:n' or member listing id); title: what the client sees in the message. */
export function contactBar({ id, title, url }) {
  const { esc, I, CONTACT, waLink } = H;
  const ref = refOf(typeof id === 'string' && id.includes(':') ? { project: id.split(':')[0], n: id.split(':')[1] } : { id });
  const msg = waText(title, url, ref);
  return `<div class="bar cbar3">
    <a class="btn call" href="tel:${CONTACT.phone}" data-tid="${esc(id)}">${I.phone} اتصال</a>
    <a class="btn wa" href="${esc(waLink(msg))}" data-ext data-tid="${esc(id)}">${I.wa} واتساب</a>
    <button class="btn ghost cb" data-callback="${esc(id)}" data-cbt="${esc(title)}" data-ref="${esc(ref)}">${I.chat} طلب اتصال</button></div>`;
}
export const refLine = (id) => `<div class="refno">رقم المرجع: <b dir="ltr">${refOf(typeof id === 'string' && id.includes(':') ? { project: id.split(':')[0], n: id.split(':')[1] } : { id })}</b></div>`;

/** «طلب اتصال»: name, phone and a message — the office calls back. */
export function callbackSheet(id, title, ref) {
  const { esc, toast } = H; const u = session.user() || {};
  const el = document.createElement('div'); el.className = 'pkgsheet';
  el.innerHTML = `<form class="pkgbox cbform"><h3>طلب اتصال</h3><p class="muted">${esc(title)} · <span dir="ltr">${esc(ref)}</span></p>
    <input name="name" maxlength="60" placeholder="الاسم" value="${esc(u.name || '')}" required>
    <input name="phone" inputmode="tel" dir="ltr" maxlength="20" placeholder="05X XXX XXXX" value="${esc(u.phone || '')}" required>
    <textarea name="msg" rows="3" maxlength="500">مرحباً، أرغب بمعرفة تفاصيل أكثر عن هذا الإعلان.</textarea>
    <label class="chkrow"><input type="checkbox" name="wa" checked> أفضّل التواصل عبر واتساب</label>
    <button class="btn primary block">إرسال الطلب</button><button type="button" class="btn ghost block" data-x>إلغاء</button></form>`;
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); };
  el.onclick = (e) => { if (e.target === el || e.target.closest('[data-x]')) close(); };
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const b = f.querySelector('button'); b.disabled = true;
    const phone = f.phone.value.replace(/[^\d+]/g, '');
    if (phone.replace(/\D/g, '').length < 9) { toast('اكتب رقم جوال صحيح'); b.disabled = false; return; }
    try {
      await api('contact_req', { id, title, ref, name: f.name.value.trim(), phone, msg: f.msg.value.trim(), wa: f.wa.checked ? '1' : '0' });
      track('form', id); toast('تم إرسال طلبك — سيتواصل معك فريقنا قريباً ✓'); close();
    } catch (ex) { toast(ex.message); b.disabled = false; }
  };
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
}
