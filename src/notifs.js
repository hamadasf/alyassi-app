// «إعدادات الإشعارات»: the phone's switch, what broadcasts to receive (stored as tags on this phone),
// and which personal notifications to get (stored with the account).
import { api, session } from './owner.js';
import { tr } from './i18n.js';

const LS = 'oay:ntags';
const local = () => { try { return { prices: true, offers: true, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return { prices: true, offers: true }; } };
const sw = (k, on) => `<label class="tgl"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><i></i></label>`;
const chk = (k, label, on) => `<label class="nrow"><span>${label}</span><input type="checkbox" class="nchk" data-k="${k}" ${on ? 'checked' : ''}></label>`;

export function notifsPage() {
  const u = session.user(); const t = local();
  return `<div class="pad acc nset">
    <div class="ncard master"><div><b>تفعيل الإشعارات</b><span id="nstate">تلقي التنبيهات على جهازك</span></div>${sw('master', false)}</div>
    <div class="ncard"><h4>التحديثات</h4>
      ${chk('prices', 'أعلمني عند تغيّر سعر أو حالة أي أرض، أو نزول أرض جديدة', t.prices)}
      ${chk('offers', 'أعلمني بالعروض لفترة محدودة', t.offers)}</div>
    ${u ? `<div class="ncard"><h4>الرسائل الخاصة</h4>
      ${chk('chat_first', 'أعلمني عند استلام رسالة خاصة جديدة', true)}
      ${chk('chat_all', 'أخبرني عندما أتلقى كل رسالة خاصة', true)}</div>
    <div class="ncard"><h4>المجموعة العامة</h4>
      ${chk('group', 'أعلمني بكل رسالة جديدة في المجموعة العامة', false)}</div>
    <div class="ncard"><h4>الطلبات</h4>
      ${chk('reqs', u.admin ? 'أعلمني عند وصول طلب عرض أرض أو طلب توثيق جديد' : 'أعلمني عند الموافقة على إعلاناتي أو رفضها، وعند توثيق حسابي', true)}</div>`
    : '<p class="muted">سجّل الدخول لاختيار إشعارات الرسائل والطلبات</p>'}
    <button class="btn primary block share-big" id="nsave">حفظ</button>
  </div>`;
}

export async function initNotifs(pg) {
  const push = window.__oayPush; const H = { toast: (m) => { const t = document.getElementById('toast'); t.textContent = tr(m); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); } };
  const master = pg.querySelector('[data-k=master]'), state = pg.querySelector('#nstate');
  const show = () => {
    const st = push ? push.state() : 'unsupported';
    master.checked = st === 'on'; master.disabled = st === 'unsupported';
    state.textContent = tr(st === 'on' ? 'تلقي التنبيهات على جهازك' : st === 'denied' ? 'مرفوضة من إعدادات الجهاز — فعّلها من الإعدادات' : st === 'install' ? 'على الآيفون: أضف التطبيق للشاشة الرئيسية أولاً' : st === 'unsupported' ? 'هذا الجهاز لا يدعم الإشعارات' : 'الإشعارات متوقفة على هذا الجهاز');
  };
  show();
  if (session.token()) {
    try { const j = await api('notif_get'); Object.entries(j.prefs).forEach(([k, v]) => { const el = pg.querySelector(`[data-k=${k}]`); if (el) el.checked = !!v; }); } catch { /* defaults */ }
  }
  master.onchange = async () => {
    if (!push) return;
    try {
      if (master.checked) await push.enable();
      else await push.disable();
    } catch { /* ignore */ }
    setTimeout(() => { show(); push.render(); }, 400);
  };
  pg.querySelector('#nsave').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    const v = (k) => !!(pg.querySelector(`[data-k=${k}]`) || {}).checked;
    const tags = { prices: v('prices'), offers: v('offers') };
    try { localStorage.setItem(LS, JSON.stringify(tags)); } catch { /* ignore */ }
    try { if (push && push.os) push.os.User.addTags({ prices: tags.prices ? '1' : '0', offers: tags.offers ? '1' : '0' }); } catch { /* ignore */ }
    try {
      if (session.token()) await api('notif_save', { chat_first: v('chat_first'), chat_all: v('chat_all'), group: v('group'), reqs: v('reqs') });
      H.toast('تم حفظ إعدادات الإشعارات ✓');
    } catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  };
}
