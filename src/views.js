// «احجز معاينة»: the client picks a day and a time for a land; the office confirms, moves or cancels it,
// and both get a reminder before the visit.
import { api, session, can } from './owner.js';

let H = null;
export function initViews(h) { H = h; }
const loading = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
const loc = () => (document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayName = (s) => new Date(s + 'T12:00:00').toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
const t12 = (t) => { const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' }); };
const ST = { pending: ['بانتظار التأكيد', 'wait'], confirmed: ['مؤكد', 'ok'], done: ['تمت المعاينة', 'ok'], noshow: ['لم يحضر', 'no'], cancelled: ['ملغي', 'no'] };
const waUrl = (ph, text) => { let d = String(ph).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '971' + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };

/* ---------- booking (client) ---------- */
let pending = null;   // { id, title, ref, loc } of the listing being booked
export function setBooking(b) { pending = b; }
export function bookPage() {
  const b = pending || {}; const u = session.user() || {};
  return `<div class="pad vbook">
    <div class="ccard vhead"><b>📅 احجز موعد معاينة</b><span class="notr">${H.esc(b.title || '')}</span>${b.ref ? `<small dir="ltr">${H.esc(b.ref)}</small>` : ''}</div>
    <h2 class="h2">اختر اليوم</h2><div class="vdays" id="vdays">${loading}</div>
    <h2 class="h2">اختر الوقت</h2><div class="vslots" id="vslots"><p class="muted">اختر اليوم أولاً</p></div>
    <form class="ccard cform" id="vform">
      <label>الاسم<input name="name" maxlength="60" value="${H.esc(u.name || '')}" required></label>
      <label>رقم الجوال<input name="phone" inputmode="tel" dir="ltr" maxlength="20" placeholder="05X XXX XXXX" value="${H.esc(u.phone || '')}" required></label>
      <label>ملاحظات (اختياري)<textarea name="notes" rows="2" maxlength="400" placeholder="عدد الأشخاص، أسئلة…"></textarea></label>
      <button class="btn primary block" disabled id="vgo">اختر اليوم والوقت</button></form>
    <p class="muted cnote">يتواصل معك فريقنا لتأكيد الموعد، ويصلك تذكير قبل المعاينة.</p></div>`;
}
export async function initBook(pg) {
  const b = pending || {}; const days = pg.querySelector('#vdays'), slots = pg.querySelector('#vslots'), go = pg.querySelector('#vgo'), f = pg.querySelector('#vform');
  let date = '', time = '';
  const ready = () => { go.disabled = !(date && time); go.textContent = date && time ? `تأكيد الحجز · ${dayName(date)} · ${t12(time)}` : 'اختر اليوم والوقت'; };
  let cfg = { days: [0, 1, 2, 3, 4, 6], ahead: 14 };
  try { cfg = (await api('view_cfg')).cfg; } catch { /* defaults */ }
  const list = []; const d = new Date();
  for (let i = 0; list.length < cfg.ahead && i < 40; i++) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i); if (cfg.days.includes(x.getDay())) list.push(iso(x)); }
  days.innerHTML = list.map((s) => { const x = new Date(s + 'T12:00:00'); return `<button data-day="${s}"><small>${x.toLocaleDateString(loc(), { weekday: 'short' })}</small><b>${x.getDate()}</b><small>${x.toLocaleDateString(loc(), { month: 'short' })}</small></button>`; }).join('');
  days.onclick = async (e) => {
    const t = e.target.closest('[data-day]'); if (!t) return;
    date = t.dataset.day; time = ''; ready();
    days.querySelectorAll('[data-day]').forEach((x) => x.classList.toggle('on', x === t));
    slots.innerHTML = loading;
    try {
      const j = await api('view_slots', { date });
      slots.innerHTML = j.slots.length ? j.slots.map((s) => `<button data-t="${s.t}" ${s.free ? '' : 'disabled'}>${t12(s.t)}</button>`).join('') : '<p class="muted">لا توجد مواعيد في هذا اليوم</p>';
    } catch (ex) { slots.innerHTML = `<p class="muted">${H.esc(ex.message)}</p>`; }
  };
  slots.onclick = (e) => { const t = e.target.closest('[data-t]'); if (!t || t.disabled) return; time = t.dataset.t; slots.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === t)); ready(); };
  f.onsubmit = async (e) => {
    e.preventDefault(); if (!date || !time) return; go.disabled = true;
    try {
      await api('view_book', { id: b.id, title: b.title, loc: b.loc || '', date, time, name: f.name.value.trim(), phone: f.phone.value.replace(/[^\d+]/g, ''), notes: f.notes.value.trim() });
      pg.querySelector('.vbook').innerHTML = `<div class="ccard vdone"><span>✅</span><b>تم إرسال طلب المعاينة</b><p>${H.esc(b.title || '')}</p><p><b>${dayName(date)} · ${t12(time)}</b></p>
        <p class="muted">سيتواصل معك فريقنا لتأكيد الموعد${session.token() ? '، وتجد مواعيدك في «المزيد ← مواعيد المعاينة»' : ''}.</p>
        ${b.loc ? `<a class="btn ghost block" href="${H.esc(b.loc)}" data-ext>📍 موقع الأرض على الخريطة</a>` : ''}<button class="btn primary block" data-back>تم</button></div>`;
    } catch (ex) { H.toast(ex.message); go.disabled = false; }
  };
}

/* ---------- my appointments (client) ---------- */
export function myViewsPage() { return `<div class="pad vlist" id="myv">${loading}</div>`; }
export async function initMyViews(pg) {
  const box = pg.querySelector('#myv');
  const load = async () => {
    if (!session.token()) { box.innerHTML = '<p class="muted">سجّل الدخول لعرض مواعيدك</p>'; return; }
    try {
      const j = await api('view_mine');
      box.innerHTML = j.items.length ? j.items.map((v) => `<div class="vcard"><div class="vtop"><b class="notr">${H.esc(v.title)}</b><i class="pill ${ST[v.status][1]}">${ST[v.status][0]}</i></div>
        <p>📅 ${dayName(v.date)} · ${t12(v.time)}</p>${v.officeNote ? `<p class="muted">💬 ${H.esc(v.officeNote)}</p>` : ''}
        <div class="cact">${v.loc ? `<a class="btn ghost sm" href="${H.esc(v.loc)}" data-ext>📍 الموقع</a>` : ''}${['pending', 'confirmed'].includes(v.status) ? `<button class="btn ghost sm danger" data-vcancel="${v.id}">إلغاء الموعد</button>` : ''}</div></div>`).join('')
        : `<div class="cempty">📅<p>لا توجد مواعيد — احجز معاينة من صفحة أي أرض</p></div>`;
    } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; }
  };
  box.onclick = async (e) => { const b = e.target.closest('[data-vcancel]'); if (!b) return; if (!confirm('إلغاء موعد المعاينة؟')) return; try { await api('view_cancel', { id: b.dataset.vcancel }); H.toast('تم إلغاء الموعد'); load(); } catch (ex) { H.toast(ex.message); } };
  load();
}

/* ---------- appointments (office) ---------- */
export function viewsPage() {
  return `<div class="pad vlist"><div class="chips scroll lchips"><button class="chip on" data-vt="today">اليوم <i></i></button><button class="chip" data-vt="pending">بانتظار التأكيد <i></i></button><button class="chip" data-vt="next">القادمة <i></i></button><button class="chip" data-vt="past">السابقة</button><button class="chip" data-vt="cfg">⚙️ أوقات العمل</button></div>
    <div id="vl">${loading}</div></div>`;
}
export function initViewsAdm(pg) {
  const box = pg.querySelector('#vl'); let tab = 'today', items = [], cfg = null;
  const card = (v) => {
    const conf = `مرحباً ${v.name}، نؤكد موعد معاينة ${v.title} (${v.ref}) يوم ${dayName(v.date)} الساعة ${t12(v.time)}.${v.loc ? '\nالموقع: ' + v.loc : ''}\nعمر الياسي للعقارات`;
    return `<div class="vcard${v.status === 'pending' ? ' due' : ''}" data-vid="${v.id}"><div class="vtop"><b>${dayName(v.date)} · ${t12(v.time)}</b><i class="pill ${ST[v.status][1]}">${ST[v.status][0]}</i></div>
      <button class="clink notr" ${/^\d+$/.test(v.lid) ? `data-oland="${H.esc(v.lid)}"` : v.lid ? `data-land="${H.esc(v.lid)}"` : ''}>${H.esc(v.title)} <span dir="ltr">${H.esc(v.ref)}</span></button>
      <p>👤 <b class="notr">${H.esc(v.name)}</b> · <span dir="ltr">${H.esc(v.phone)}</span>${v.uid ? ` · <button class="clink" data-lead="${v.uid}">ملف العميل</button>` : ''}</p>
      ${v.notes ? `<p class="muted notr">📝 ${H.esc(v.notes)}</p>` : ''}${v.officeNote ? `<p class="muted notr">💬 ${H.esc(v.officeNote)}</p>` : ''}
      <div class="cact"><a class="btn ghost sm" href="tel:${H.esc(v.phone)}">📞</a><a class="btn wa sm" href="${H.esc(waUrl(v.phone, conf))}" data-ext>واتساب</a>
        ${v.status === 'pending' ? '<button class="btn primary sm" data-vs="confirmed">✓ تأكيد</button>' : ''}
        ${['pending', 'confirmed'].includes(v.status) ? '<button class="btn ghost sm" data-vmove>🔁 تغيير الموعد</button><button class="btn ghost sm" data-vs="done">تمت</button><button class="btn ghost sm" data-vs="noshow">لم يحضر</button><button class="btn ghost sm danger" data-vs="cancelled">إلغاء</button>' : ''}
        <button class="btn ghost sm" data-vnote>ملاحظة</button></div></div>`;
  };
  const cfgForm = () => {
    const names = [0, 1, 2, 3, 4, 5, 6].map((d) => new Date(2023, 0, 1 + d).toLocaleDateString(loc(), { weekday: 'long' }));
    box.innerHTML = `<form class="ccard cform" id="vcfg"><h4 class="lh">أيام العمل</h4><div class="vdaysel">${names.map((n, d) => `<label class="chkrow"><input type="checkbox" value="${d}" ${cfg.days.includes(d) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <div class="cgrid"><label>من الساعة<input name="from" type="number" min="0" max="23" value="${cfg.from}"></label><label>إلى الساعة<input name="to" type="number" min="1" max="24" value="${cfg.to}"></label></div>
      <div class="cgrid"><label>مدة الموعد (دقيقة)<input name="step" type="number" min="15" max="240" step="15" value="${cfg.step}"></label><label>معاينات في نفس الوقت<input name="max" type="number" min="1" max="20" value="${cfg.max}"></label></div>
      <label>الحجز متاح لكم يوم قادم<input name="ahead" type="number" min="1" max="60" value="${cfg.ahead}"></label>
      <button class="btn primary block">حفظ أوقات العمل</button></form>`;
    box.querySelector('#vcfg').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      try { cfg = (await api('adm_view_cfg', { days: [...f.querySelectorAll('.vdaysel input:checked')].map((c) => +c.value), from: f.from.value, to: f.to.value, step: f.step.value, max: f.max.value, ahead: f.ahead.value })).cfg; H.toast('تم حفظ أوقات العمل ✓'); } catch (ex) { H.toast(ex.message); }
    };
  };
  const load = async () => {
    try {
      const j = await api('adm_views', { tab: tab === 'cfg' ? 'next' : tab }); items = j.items; cfg = j.cfg;
      pg.querySelectorAll('[data-vt]').forEach((b) => { const i = b.querySelector('i'); if (i) i.textContent = j.counts[b.dataset.vt] || ''; });
      if (tab === 'cfg') { cfgForm(); return; }
      box.innerHTML = items.length ? items.map(card).join('') : `<div class="cempty">📅<p>لا توجد مواعيد هنا</p></div>`;
    } catch (e) { box.innerHTML = `<p class="muted">${H.esc(e.message)}</p>`; }
  };
  const save = async (id, body, msg) => { try { await api('adm_view_save', { id, ...body }); H.toast(msg); load(); } catch (e) { H.toast(e.message); } };
  pg.querySelectorAll('[data-vt]').forEach((b) => { b.onclick = () => { tab = b.dataset.vt; pg.querySelectorAll('[data-vt]').forEach((x) => x.classList.toggle('on', x === b)); box.innerHTML = loading; load(); }; });
  box.addEventListener('click', (e) => {
    const t = e.target.closest('button'); const c = e.target.closest('[data-vid]'); if (!t || !c) return;
    const v = items.find((x) => String(x.id) === c.dataset.vid); if (!v) return;
    if (t.dataset.vs) { if (t.dataset.vs === 'cancelled' && !confirm('إلغاء هذا الموعد؟')) return; save(v.id, { status: t.dataset.vs }, ST[t.dataset.vs][0] + ' ✓'); }
    else if (t.dataset.vmove !== undefined) {
      const d = prompt('التاريخ الجديد (YYYY-MM-DD):', v.date); if (!d) return; const tm = prompt('الوقت الجديد (HH:MM بنظام 24 ساعة):', v.time); if (!tm) return;
      save(v.id, { date: d.trim(), time: tm.trim() }, 'تم تغيير الموعد وإعلام العميل ✓');
    } else if (t.dataset.vnote !== undefined) { const n = prompt('ملاحظة تظهر للعميل:', v.officeNote || ''); if (n === null) return; save(v.id, { note: n }, 'تم حفظ الملاحظة'); }
  });
  pg.addEventListener('oay:refresh', load);
  load();
}
export const canViews = () => can('viewings');
