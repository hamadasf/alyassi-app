// «حجز مؤقت»: a team member holds an available plot for a client for 24 / 48 hours. It shows «محجوزة» to everyone; «تم دفع
// العربون» keeps it reserved, otherwise the website puts it back «متاحة» when the time is up and tells the holder.
import { api, session, isOffice } from './owner.js';
import { uiConfirm } from './dialog.js';

let H = null;
export function initHold(h) { H = h; }
let cache = null, cacheAt = 0;
async function holds(force) {
  if (!force && cache && Date.now() - cacheAt < 30e3) return cache;
  cache = (await api('holds')).items || []; cacheAt = Date.now(); return cache;
}
const left = (ms) => { const m = Math.max(0, Math.round((ms - Date.now()) / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} ساعة${m % 60 ? ` و${m % 60} دقيقة` : ''}` : `${m} دقيقة`; };

export function holdSlot(l) { return isOffice() && (l.status === 'av' || l.status === 'res') ? `<div class="holdbox" data-holdid="${H.esc(l.id)}"></div>` : ''; }

export async function fillHold(pg, l) {
  const box = pg.querySelector('.holdbox'); if (!box) return;
  const { esc, I } = H; const me = session.user() || {};
  let h = null;
  try { h = (await holds()).find((x) => x.id === l.id) || null; } catch { return; }
  const boss = me.admin || me.role === 'mgr';
  const paint = () => {
    if (h) {
      const mine = h.uid === me.id || boss;
      box.innerHTML = `<div class="hold on"><b>⏳ محجوزة مؤقتاً لـ <span class="notr">${esc(h.client)}</span></b>
        <span>بواسطة <span class="notr">${esc(h.by)}</span> · المتبقي <em data-hleft>${left(h.until)}</em></span>
        ${mine ? `<div class="hold-b"><button class="btn primary sm" data-hact="paid">تم دفع العربون</button><button class="btn ghost sm" data-hact="extend">تمديد يوم</button><button class="btn ghost sm" data-hact="release">إلغاء الحجز</button></div>` : ''}</div>`;
    } else if (l.status === 'av') {
      box.innerHTML = `<div class="hold"><b>⏳ حجز مؤقت لعميل</b><span>تظهر «محجوزة» للجميع، وتعود متاحة تلقائياً إذا لم يُسجَّل العربون خلال المدة.</span>
        <input class="hold-c" maxlength="80" placeholder="اسم العميل"><div class="hold-b"><button class="btn primary sm" data-hh="24">24 ساعة</button><button class="btn ghost sm" data-hh="48">48 ساعة</button></div></div>`;
    } else box.innerHTML = '';
  };
  paint();
  box.onclick = async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.hh) {
        const client = box.querySelector('.hold-c').value.trim(); if (!client) { H.toast('اكتب اسم العميل'); box.querySelector('.hold-c').focus(); return; }
        const [project, n] = [l.project, l.n]; t.disabled = true;
        h = (await api('hold_set', { project, n, hours: +t.dataset.hh, client })).hold; cache = null;
        l.status = 'res'; H.toast('تم الحجز المؤقت ✓'); H.refreshData && H.refreshData();
      } else if (t.dataset.hact) {
        const a = t.dataset.hact;
        if (a === 'release' && !(await uiConfirm('إلغاء الحجز المؤقت؟ ستعود القطعة «متاحة» للجميع.', { ok: 'إلغاء الحجز', danger: true }))) return;
        t.disabled = true;
        h = (await api('hold_done', { id: l.id, act: a })).hold; cache = null;
        if (a === 'release') l.status = 'av';
        H.toast(a === 'paid' ? 'تم — القطعة محجوزة نهائياً ✓' : a === 'extend' ? 'تم تمديد الحجز يوماً ✓' : 'أُلغي الحجز وعادت القطعة متاحة'); H.refreshData && H.refreshData();
      }
      paint();
    } catch (ex) { t.disabled = false; H.toast(ex.message); }
  };
}
