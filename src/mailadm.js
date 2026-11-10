import { ei } from './icons.js';
// «النشرة البريدية» (admin): the weekly «أراضٍ مختارة لك» e-mail — on / off, day and hour, a test to my own e-mail,
// send now, and how the last round went.
import { api, session } from './owner.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null;
export function initMailAdm(h) { H = h; }
const DAYS = ['', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const nf = new Intl.NumberFormat('en-US');

export function mailAdmPage() { return '<div class="pad acc mailadm" id="mlBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export function initMailAdmPage(pg) {
  const box = pg.querySelector('#mlBox');
  const draw = (s) => {
    box.innerHTML = `<div class="ccard"><b>📧 «أراضٍ مختارة لك» — مثل رسائل بيوت</b>
        <p class="muted">رسالة أسبوعية لكل عضو مسجّل فيها 5 أراضٍ متاحة مختارة له: حسب طلبات «أرض تناسبني»، ثم المشاريع التي تصفّحها، ثم الأراضي المميزة. لكل أرض صورتها على المخطط والسعر والمساحة وزر لفتحها. في كل رسالة رابط لإلغاء الاشتراك.</p></div>
      <label class="nrow big"><span><b>الإرسال الأسبوعي</b><small>${s.on ? 'مفعّل' : 'متوقف'}</small></span><input type="checkbox" class="nchk" id="mlOn" ${s.on ? 'checked' : ''}></label>
      <div class="two"><label class="fld">اليوم<select id="mlDay">${DAYS.slice(1).map((d, i) => `<option value="${i + 1}" ${s.day === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label class="fld">الساعة<select id="mlHour">${Array.from({ length: 15 }, (_, i) => i + 8).map((h) => `<option value="${h}" ${s.hour === h ? 'selected' : ''}>${h > 12 ? h - 12 + ' م' : h + (h === 12 ? ' م' : ' ص')}</option>`).join('')}</select></label></div>
      <button class="btn primary block" id="mlSave">حفظ</button>
      <div class="mlstats"><div><b>${nf.format(s.audience)}</b><small>مشترك</small></div><div><b>${nf.format(s.pool)}</b><small>أرض متاحة بسعر</small></div>
        <div><b>${nf.format(s.sent)}</b><small>أُرسلت آخر مرة</small></div><div><b>${nf.format(s.queue)}</b><small>بالانتظار</small></div></div>
      ${s.started ? `<p class="help">آخر إرسال بدأ ${new Date(s.started).toLocaleString('ar-AE')}${s.fail ? ` · تعذّر ${s.fail}` : ''}. تُرسل ${12} رسالة كل 5 دقائق.</p>` : ''}
      <button class="btn block" id="mlTest">${ei('mail')} إرسال تجربة إلى بريدي</button>
      <button class="btn gold block" id="mlNow" ${s.queue ? 'disabled' : ''}>${ei('share')} إرسال للجميع الآن</button>`;
  };
  const load = async () => { try { draw((await api('adm_mail_get')).state); } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; } };
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    b.disabled = true;
    try {
      if (b.id === 'mlSave') { draw((await api('adm_mail_save', { on: box.querySelector('#mlOn').checked, day: +box.querySelector('#mlDay').value, hour: +box.querySelector('#mlHour').value })).state); H.toast('تم الحفظ ✓'); return; }
      if (b.id === 'mlTest') { const r = await api('adm_mail_test'); H.toast('أُرسلت التجربة إلى ' + r.to + ' — شيّك صندوق الوارد والـSpam'); }
      if (b.id === 'mlNow') { if (!(await uiConfirm('إرسال «أراضٍ مختارة لك» لكل المشتركين الآن؟', { ok: 'إرسال', icon: 'send' }))) { b.disabled = false; return; } draw((await api('adm_mail_now')).state); H.toast('بدأ الإرسال ✓'); return; }
    } catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  });
  load();
}
export const mailAdmAllowed = () => !!(session.user() || {}).admin;
