// «المحادثات»: the public group (signed-in members) and each member's private chat with the office.
// Listings from offices are asked about through the office, which forwards the advertiser's WhatsApp number when
// it sees fit — members never reach each other directly, and phone numbers are not allowed in chats.
import { api, session, resizePhoto } from './owner.js';
import { oLandCard } from './owner-ui.js';

let H = null;
export function initChat(h) {
  H = h;
  // heartbeat: keeps «متصل الآن» up to date and the unread badge fresh while the app is open
  setInterval(() => { if (session.token() && !document.hidden) refreshUnread(); }, 40000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && session.token()) refreshUnread(); });
}
let pendingRef = null;            // listing the user is asking about
let pendingQuote = '';            // a group post the user replies to privately
let unread = 0, poll = 0, gpoll = 0;

/* ---------- unread badge on the bottom bar ---------- */
let summary = null;   // { n, group: {last, lastText, unread}, private: {last, lastText, unread, online} }
export async function refreshUnread() {
  if (!session.token()) { unread = 0; summary = null; } else {
    try { summary = await api('chat_unread'); unread = (summary.n || 0) + ((summary.group && summary.group.unread) || 0); } catch { /* keep */ }
  }
  const b = document.getElementById('chatN'); if (b) { b.textContent = unread > 99 ? '99+' : unread; b.hidden = !unread; }
  return unread;
}

/* ---------- small helpers ---------- */
const en = () => document.documentElement.lang === 'en';
const loc = () => (en() ? 'en-GB' : 'ar-AE');
const linkify = (t) => H.esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" data-ext dir="ltr">${u.replace(/^https?:\/\//, '')}</a>`).replace(/\n/g, '<br>');
const tm = (t) => new Date(t).toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function dayLabel(t) {
  const now = Date.now();
  if (sameDay(t, now)) return en() ? 'Today' : 'اليوم';
  if (sameDay(t, now - 864e5)) return en() ? 'Yesterday' : 'أمس';
  return new Date(t).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });
}
export function seenText(p) {
  if (!p) return '';
  if (p.online) return 'متصل الآن';
  if (!p.last) return '';
  const d = sameDay(p.last, Date.now()) ? (en() ? 'today' : 'اليوم') : sameDay(p.last, Date.now() - 864e5) ? (en() ? 'yesterday' : 'أمس') : new Date(p.last).toLocaleDateString(loc(), { day: 'numeric', month: 'short' });
  return en() ? `last seen ${d} at ${tm(p.last)}` : `آخر ظهور ${d} ${tm(p.last)}`;
}
const PHONE = /(?:\+|00)?[0-9٠-٩۰-۹](?:[\s\-().\/]*[0-9٠-٩۰-۹]){8,}/;
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const ICON = {
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  tick: '<svg class="tk" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m1.5 6.5 3.5 3.5 6.5-8"/></svg>',
  ticks: '<svg class="tk" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m1 6.5 3.5 3.5 6.5-8M7.5 9.5l.5.5 6.5-8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17 9V7A5 5 0 0 0 7 7v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 7a3 3 0 0 1 6 0v2H9z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
};
const groupIcon = (cls = '') => `<span class="acc-av grp ${cls}"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><circle cx="9" cy="8" r="3.4"/><circle cx="16.5" cy="9" r="2.6"/><path d="M2.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6v1h-13z"/><path d="M15.2 13.4c3.3-.4 6.3 1.6 6.3 5.1v1.5h-4.6v-1c0-2.2-.6-4.1-1.7-5.6z"/></svg></span>`;
const officeAv = (online, cls = '') => `<span class="acc-av img emb ${cls}"><img src="icons/icon-192.png" alt="">${online ? '<i class="dot"></i>' : ''}</span>`;
export function userAv(u, cls = '') {
  const { esc } = H;
  const dot = u.online ? '<i class="dot"></i>' : '';
  return u.avatar ? `<span class="acc-av img ${cls}"><img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">${dot}</span>`
    : `<span class="acc-av ${cls}">${esc((u.company && u.verified ? u.company : u.name || '?').charAt(0))}${dot}</span>`;
}
const notice = (txt) => `<div class="wanote">${ICON.lock} ${txt}</div>`;

/* ---------- WhatsApp-style header ---------- */
function waHead(av, name, sub, prof) {
  return `<header class="wahead"><button class="waback" data-back aria-label="رجوع">${H.I.back}</button>
    <button class="waid" ${prof != null ? `data-prof="${prof}"` : ''}>${av}<div><b>${name}</b><span class="wasub">${sub || ''}</span></div></button></header>`;
}
function setSub(root, txt) { const s = root.querySelector('.wasub'); if (s) { s.textContent = txt; s.classList.toggle('on', txt === 'متصل الآن'); } }

/* ---------- attachments in messages ---------- */
function filesHTML(files) {
  if (!files || !files.length) return '';
  const { esc } = H;
  const imgs = files.filter((f) => f.k === 'img'), docs = files.filter((f) => f.k !== 'img');
  let h = '';
  if (imgs.length) h += `<div class="cimgs n${Math.min(imgs.length, 4)}">${imgs.slice(0, 4).map((f, i) => `<button class="cimg" data-view="${esc(f.u)}"><img src="${esc(f.u)}" alt="" loading="lazy">${i === 3 && imgs.length > 4 ? `<i>+${imgs.length - 4}</i>` : ''}</button>`).join('')}</div>`;
  h += docs.map((f) => { const ext = (f.n.split('.').pop() || '').toUpperCase().slice(0, 4); return `<a class="cfile" href="${esc(f.u)}" data-ext><span class="fi">${ICON.file}<em>${esc(ext)}</em></span><span class="fn"><b class="notr" dir="auto">${esc(f.n.replace(/\.[^.]+$/, ""))}</b><small>${ext} · ${kb(f.s || 0)}</small></span></a>`; }).join('');
  return h;
}
function viewImage(url) {
  const v = document.createElement('div'); v.className = 'viewer';
  v.innerHTML = `<button class="vx" aria-label="إغلاق">✕</button><img src="${H.esc(url)}" alt=""><a class="vdl" href="${H.esc(url)}" data-ext>فتح الصورة</a>`;
  v.addEventListener('click', (e) => { if (!e.target.closest('a')) v.remove(); });
  document.body.appendChild(v);
}
document.addEventListener('click', (e) => { const t = e.target.closest('[data-view]'); if (t) { e.stopPropagation(); viewImage(t.dataset.view); } }, true);

/* ---------- the composer: text, photos (camera) and files ---------- */
function composerHTML(ph) {
  return `<div class="wabar"><div class="watts" hidden></div>
    <form class="wacomp"><div class="wapill"><textarea rows="1" placeholder="${ph}" maxlength="3000"></textarea>
      <button type="button" class="wai" data-attach aria-label="إرفاق ملف">${ICON.clip}</button><button type="button" class="wai" data-cam aria-label="الكاميرا">${ICON.cam}</button></div>
      <button class="wasend" aria-label="إرسال">${H.I.send}</button></form>
    <input type="file" class="fpick" hidden multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt">
    <input type="file" class="cpick" hidden accept="image/*" capture="environment"></div>`;
}
function bindComposer(root, { admin, onSend }) {
  const form = root.querySelector('.wacomp'), ta = form.querySelector('textarea'), strip = root.querySelector('.watts');
  const fpick = root.querySelector('.fpick'), cpick = root.querySelector('.cpick'), btn = form.querySelector('.wasend');
  let picks = [], busy = false;
  const drawPicks = () => {
    strip.hidden = !picks.length;
    strip.innerHTML = picks.map((p, i) => `<div class="watt">${p.img ? `<img src="${p.prev}" alt="">` : `<span class="fi">${ICON.file}<em>${H.esc(p.ext)}</em></span><small class="notr" dir="ltr">${H.esc(p.name)}</small>`}<button type="button" data-rm="${i}" aria-label="إزالة">✕</button></div>`).join('');
  };
  strip.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { picks.splice(+b.dataset.rm, 1); drawPicks(); } });
  const add = async (list) => {
    for (const f of Array.from(list || [])) {
      if (picks.length >= 10) { H.toast('الحد الأقصى 10 مرفقات في الرسالة'); break; }
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const img = /^image\//.test(f.type) || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);
      try {
        if (img) { const data = await resizePhoto(f, 1600, 0.82); picks.push({ img: true, data, prev: data, name: (f.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', ext: 'JPG' }); }
        else {
          if (f.size > 10 * 1048576) { H.toast('الحد الأقصى لحجم الملف 10 ميجابايت'); continue; }
          const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
          picks.push({ img: false, data, name: f.name, ext: ext.toUpperCase().slice(0, 4) });
        }
      } catch { H.toast('تعذّر قراءة الملف'); }
    }
    drawPicks();
  };
  form.querySelector('[data-attach]').onclick = () => fpick.click();
  form.querySelector('[data-cam]').onclick = () => cpick.click();
  fpick.onchange = () => { add(fpick.files); fpick.value = ''; };
  cpick.onchange = () => { add(cpick.files); cpick.value = ''; };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  form.onsubmit = async (e) => {
    e.preventDefault(); if (busy) return;
    const text = ta.value.trim();
    if (!admin && PHONE.test(text)) { H.toast('يُمنع مشاركة أرقام الهواتف في المحادثات — التواصل يتم عن طريق الإدارة'); return; }
    if (!text && !picks.length && !(onSend.allowEmpty && onSend.allowEmpty())) return;
    busy = true; btn.disabled = true; btn.classList.add('busy');
    try {
      const files = [];
      for (let i = 0; i < picks.length; i++) {
        H.toast(picks.length > 1 ? `جارِ رفع المرفقات ${i + 1}/${picks.length}…` : 'جارِ رفع المرفق…');
        const j = await api('chat_file', { data: picks[i].data, name: picks[i].name }); files.push(j.id);
      }
      if (await onSend(text, files)) { ta.value = ''; ta.style.height = ''; picks = []; drawPicks(); }
    } catch (ex) { H.toast(ex.message); }
    busy = false; btn.disabled = false; btn.classList.remove('busy');
  };
  return { ta };
}

/* ---------- messages ---------- */
function refCard(r, admin) {
  const { esc, money } = H;
  return `<div class="cref" ${r.live ? `data-oland="${r.id}"` : ''}>${r.photo ? `<img src="${esc(r.photo)}" alt="">` : ''}<div><b class="notr">${esc(r.title)}</b>
    <span>${r.price ? money(r.price) + ' د.إ' : ''}${r.area ? ' · ' + money(r.area) + ' قدم²' : ''}</span>${r.seller ? `<span class="sl">${H.I.verified} ${esc(r.seller)}</span>` : ''}
    ${admin && r.owner ? `<span class="muted">المعلن: ${esc(r.owner)}${r.ownerPhone ? ' · ' + esc(r.ownerPhone) : ''}</span>` : ''}</div></div>
    ${admin && r.ownerPhone ? `<button class="btn wa fwd" data-fwd="${r.id}">📲 إرسال رقم المعلن للعميل</button>` : ''}`;
}
const meta = (m, mine, seen) => `<span class="wmeta"><time>${tm(m.t)}</time>${mine ? (seen && m.t <= seen ? `<i class="rd">${ICON.ticks}</i>` : `<i>${ICON.tick}</i>`) : ''}</span>`;
const isLabel = (m) => m.files && m.files.length && /^(📷|📎) /.test(m.text);
function msgsHTML(items, admin, seen) {
  let h = notice(admin ? 'رسائلك مع هذا العميل خاصة — أرقام الهواتف في رسائل العملاء تُحذف تلقائياً.' : 'يُمنع مشاركة أرقام الهواتف في المحادثات — التواصل مع المعلنين يتم عن طريق الإدارة.');
  if (!items.length) return h + `<div class="cempty">${H.I.chat}<p>${admin ? 'لا توجد رسائل بعد' : 'اكتب رسالتك وسيرد عليك فريق عمر الياسي للعقارات'}</p></div>`;
  let lastDay = '', prev = null;
  for (const m of items) {
    const d = dayLabel(m.t); if (d !== lastDay) { h += `<div class="cday">${H.esc(d)}</div>`; lastDay = d; prev = null; }
    const mine = admin ? m.from === 'admin' : m.from === 'user';
    const tail = !prev || prev.from !== m.from;
    const text = isLabel(m) ? '' : m.text;
    h += `<div class="cmsg ${mine ? 'me' : 'them'}${tail ? ' tail' : ''}">${m.ref ? refCard(m.ref, admin) : ''}${filesHTML(m.files)}${text ? `<p class="notr">${linkify(text)}</p>` : ''}${meta(m, mine, seen)}</div>`;
    if (m.rate && !admin) h += rateCard(m);
    prev = m;
  }
  return h;
}

/* ---------- «كيف كان التعامل؟» after the office forwarded an advertiser's number ---------- */
export const starsHTML = (v, cls = '') => `<span class="stars ${cls}" aria-label="${v}/5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(v) ? 'on' : ''}">★</i>`).join('')}</span>`;
function rateCard(m) {
  const r = m.rate, { esc } = H;
  if (r.stars) return `<div class="ratec done"><span>شكراً لتقييمك تعاملك مع <b class="notr">${esc(r.name)}</b></span>${starsHTML(r.stars)}<button data-rerate="${m.id}">تعديل</button></div>`;
  return `<div class="ratec" data-rate="${m.id}"><b>كيف كان تعاملك مع <span class="notr">${esc(r.name)}</span>؟</b>
    <div class="rstars">${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-st="${i}" aria-label="${i}">★</button>`).join('')}</div>
    <textarea rows="2" maxlength="500" placeholder="اكتب رأيك (اختياري)"></textarea><button class="btn primary block rsend" disabled>إرسال التقييم</button></div>`;
}

/* ---------- a conversation (user ↔ office, or office ↔ user for the admin) ---------- */
function chatView(head) {
  return `${head}<div class="chat wa"><div class="cmsgs" id="cmsgs"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
    <div class="cchip" id="cchip" hidden></div>${composerHTML('اكتب رسالة')}</div>`;
}
function bindChat(root, { admin, uid }) {
  const box = root.querySelector('#cmsgs'), chip = root.querySelector('#cchip');
  let items = [], seen = 0, sending = false;
  const draw = (keep) => {
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    // keep a half-filled rating card as it is when new messages arrive
    const open = [...box.querySelectorAll('[data-rate]')].map((rc) => ({ id: rc.dataset.rate, v: rc.dataset.v, t: rc.querySelector('textarea').value, f: document.activeElement === rc.querySelector('textarea') }));
    const top = box.scrollTop;
    box.innerHTML = msgsHTML(items, admin, seen);
    open.forEach((o) => {
      const rc = box.querySelector(`[data-rate="${o.id}"]`); if (!rc) return;
      if (o.v) { rc.dataset.v = o.v; rc.querySelectorAll('[data-st]').forEach((b) => b.classList.toggle('on', +b.dataset.st <= +o.v)); rc.querySelector('.rsend').disabled = false; }
      const ta = rc.querySelector('textarea'); ta.value = o.t; if (o.f) ta.focus();
    });
    if (open.length && keep) box.scrollTop = top;
    if (!keep || atEnd) box.scrollTop = box.scrollHeight;
  };
  const showChip = () => {
    chip.hidden = !pendingRef;
    if (pendingRef) chip.innerHTML = `<span>بخصوص: <b class="notr">${H.esc(pendingRef.title)}</b></span><button type="button" aria-label="إزالة">✕</button>`;
  };
  chip.onclick = (e) => { if (e.target.closest('button')) { pendingRef = null; showChip(); } };
  const took = (j) => {
    items = j.items; seen = j.seen || 0;
    if (j.peer) setSub(root, seenText(j.peer) || (admin ? '' : 'نرد عليك في أقرب وقت'));
    if (admin && j.user) {
      const u = j.user;
      root.querySelector('.waid b').innerHTML = `<span class="notr">${H.esc(u.verified && u.company ? u.company : u.name)}</span> ${u.verified ? H.I.verified : ''}`;
      root.querySelector('.waid .acc-av').outerHTML = userAv({ ...u, online: j.peer && j.peer.online });
    }
  };
  const load = async (keep) => {
    try { took(admin ? await api('adm_chat', { id: uid }) : await api('chat_get')); draw(keep); refreshUnread(); }
    catch (e) { box.innerHTML = `<p class="muted pad">${H.esc(e.message)}</p>`; }
  };
  const send = async (text, files, listing) => {
    if (sending) return false; sending = true;
    try {
      const body = { text, listing, files };
      took(admin ? await api('adm_chat_send', { id: uid, ...body }) : await api('chat_send', body)); draw(); return true;
    } catch (e) { H.toast(e.message); return false; } finally { sending = false; }
  };
  const onSend = async (text, files) => {
    const ref = !admin && pendingRef ? pendingRef.id : 0;
    if (!text && !ref && !files.length) return false;
    const ok = await send(text, files, ref); if (ok && !admin) { pendingRef = null; showChip(); } return ok;
  };
  onSend.allowEmpty = () => !admin && !!pendingRef;
  const { ta } = bindComposer(root, { admin, onSend });
  box.addEventListener('click', async (e) => {
    const rr = e.target.closest('[data-rerate]');
    if (rr) { const m = items.find((x) => String(x.id) === rr.dataset.rerate); if (m) { m.rate.stars = 0; draw(true); } return; }
    const rc = e.target.closest('[data-rate]');
    if (rc) {
      const st = e.target.closest('[data-st]'), m = items.find((x) => String(x.id) === rc.dataset.rate); if (!m) return;
      if (st) { rc.dataset.v = st.dataset.st; rc.querySelectorAll('[data-st]').forEach((b) => b.classList.toggle('on', +b.dataset.st <= +st.dataset.st)); rc.querySelector('.rsend').disabled = false; return; }
      if (e.target.closest('.rsend')) {
        const b = rc.querySelector('.rsend'); b.disabled = true;
        try { await api('rate_send', { listing: m.rate.listing, stars: rc.dataset.v, text: rc.querySelector('textarea').value }); m.rate.stars = +rc.dataset.v; H.toast('شكراً — تم إرسال تقييمك ⭐'); draw(true); }
        catch (ex) { H.toast(ex.message); b.disabled = false; }
      }
      return;
    }
    const f = e.target.closest('[data-fwd]'); if (!f) return;
    e.stopPropagation();
    const m = items.find((x) => x.ref && String(x.ref.id) === f.dataset.fwd); if (!m) return;
    let d = String(m.ref.ownerPhone).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '971' + d;
    if (!confirm(`إرسال رقم المعلن (${m.ref.owner || ''}) لهذا العميل؟`)) return;
    send(`رقم المعلن${m.ref.owner ? ' (' + m.ref.owner + ')' : ''} للتواصل بخصوص «${m.ref.title}» عبر واتساب:\nhttps://wa.me/${d}`, [], m.ref.id);
  });
  if (!admin && pendingQuote) { ta.value = pendingQuote + '\n'; pendingQuote = ''; setTimeout(() => { ta.focus(); ta.dispatchEvent(new Event('input')); }, 300); }
  showChip(); load();
  clearInterval(poll); poll = setInterval(() => { if (root.isConnected && !document.hidden) load(true); else if (!root.isConnected) clearInterval(poll); }, 8000);
}

/* ---------- the tab ---------- */
function rowHTML(attrs, icon, name, last, t, n) {
  return `<button class="cthread${n ? ' new' : ''}" ${attrs}>${icon}<div><b>${name}</b><span class="notr">${H.esc(last || '')}</span></div><div class="cmeta"><time>${t ? tm(t) : ''}</time>${n ? `<i>${n}</i>` : ''}</div></button>`;
}
export function renderChatsTab(el) {
  const u = session.user();
  if (!session.token() || !u) {
    el.innerHTML = `<div class="cempty big">${H.I.chat}<h3>المحادثات</h3><p>سجّل الدخول لدخول المجموعة العامة ومراسلة فريق عمر الياسي للعقارات</p><button class="btn primary" data-account>تسجيل الدخول / حساب جديد</button></div>`;
    return;
  }
  el.innerHTML = `<div class="pad"><div id="clist"></div><div id="inbox"></div></div>`;
  const draw = () => {
    const g = (summary && summary.group) || {}, pv = (summary && summary.private) || {};
    el.querySelector('#clist').innerHTML = rowHTML('data-group', groupIcon(), 'المجموعة العامة', g.lastText || 'رسائل الأعضاء — لكل المسجّلين', g.last, g.unread)
      + (u.admin ? '' : rowHTML('data-mychat', officeAv(pv.online), 'عمر الياسي للعقارات', pv.lastText || 'راسل الإدارة واستفسر عن أي إعلان', pv.last, pv.unread));
  };
  draw(); refreshUnread().then(draw);
  if (u.admin) { el.querySelector('#inbox').innerHTML = '<h3 class="msec">رسائل خاصة</h3><div id="ibx"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; loadInbox(el.querySelector('#ibx')); }
}
export function myChatPage() { return chatView(waHead(officeAv(false), `عمر الياسي للعقارات ${H.I.verified}`, '', 0)); }
export function initMyChat(pg) { pg.classList.add('chatpg'); bindChat(pg, { admin: false }); }
export function chatPage(uid) { return chatView(waHead('<span class="acc-av"></span>', '…', '', uid)); }
export function initChatPage(pg, uid) { pg.classList.add('chatpg'); bindChat(pg, { admin: true, uid }); }
export function askAbout(listing) { pendingRef = listing; }
export function quoteToOffice(text) { pendingQuote = text; }

/* ---------- the public group ---------- */
export function groupPage() {
  return `${waHead(groupIcon(), 'المجموعة العامة', 'أعضاء التطبيق', null)}<div class="chat wa"><div class="cmsgs grpmsgs" id="gmsgs"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
    ${composerHTML('ابدأ محادثة …')}</div>`;
}
const HUES = ['#1d6fe8', '#c2410c', '#7c3aed', '#0f766e', '#be123c', '#a16207', '#0369a1', '#15803d'];
const hue = (id) => HUES[Math.abs(+id || 0) % HUES.length];
export function initGroup(pg) {
  pg.classList.add('chatpg');
  const box = pg.querySelector('#gmsgs');
  let items = [], admin = false, lastId = 0, sending = false;
  const { esc, I } = H;
  const who = (u) => (u.verified && u.company ? u.company : u.name);
  const draw = (keep) => {
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    let h = notice('يُمنع مشاركة أرقام الهواتف والروابط في المجموعة — التواصل بين الأعضاء والمعلنين يتم عن طريق الإدارة.');
    if (!items.length) { box.innerHTML = h + `<div class="cempty">${I.chat}<p>كن أول من يكتب في المجموعة</p></div>`; return; }
    let lastDay = '', prev = null;
    for (const m of items) {
      const d = dayLabel(m.t); if (d !== lastDay) { h += `<div class="cday">${esc(d)}</div>`; lastDay = d; prev = null; }
      const first = !prev || prev.user.id !== m.user.id;
      const long = m.text.length > 320;
      const text = isLabel(m) ? '' : m.text;
      const pid = m.user.admin && !admin ? 0 : m.user.id;
      h += `<div class="gmsg ${m.mine ? 'me' : ''}${first ? ' first' : ''}" data-gid="${m.id}">${m.mine ? '' : (first ? `<button class="gavb" data-prof="${pid}">${m.user.admin ? officeAv(m.user.online, 'gav') : userAv(m.user, 'gav')}</button>` : '<span class="gsp"></span>')}
        <div class="cmsg ${m.mine ? 'me' : 'them'}${first ? ' tail' : ''}">
          ${!m.mine && first ? `<button class="gname notr" data-prof="${pid}" style="color:${hue(m.user.id)}">${esc(who(m.user))} ${m.user.verified ? I.verified : ''}${m.user.admin ? '<i class="pill plan">الإدارة</i>' : ''}</button>` : ''}
          ${filesHTML(m.files)}${text ? `<p class="notr${long ? ' clamp' : ''}">${linkify(text)}</p>${long ? '<button class="gmore" data-gmore>قراءة المزيد</button>' : ''}` : ''}
          <div class="gact">${!m.mine ? `<button data-greply="${m.id}">${I.chat} رد على الخاص</button>` : ''}${text ? `<button data-gcopy="${m.id}">نسخ</button>` : ''}${m.mine || admin ? `<button data-gdel="${m.id}" class="del">حذف</button>` : ''}${meta(m, false)}</div></div></div>`;
      prev = m;
    }
    box.innerHTML = h;
    if (!keep || atEnd) box.scrollTop = box.scrollHeight;
  };
  const took = (j) => { if (typeof j.online === 'number') setSub(pg, j.online > 1 ? (en() ? `${j.online} online now` : `${j.online} متصلون الآن`) : 'أعضاء التطبيق'); };
  const load = async (more) => {
    try {
      const j = await api('group_get', more ? { after: lastId } : {}); admin = j.admin; took(j);
      if (more) { if (!j.items.length) return; items = items.concat(j.items); } else items = j.items;
      lastId = items.length ? items[items.length - 1].id : 0; draw(more); refreshUnread();
    } catch (e) { box.innerHTML = `<p class="muted pad">${esc(e.message)}</p>`; }
  };
  bindComposer(pg, {
    admin: (session.user() || {}).admin,
    onSend: async (text, files) => {
      if (sending) return false; sending = true;
      try { const j = await api('group_send', { text, files, after: lastId }); took(j); items = items.concat(j.items); lastId = items[items.length - 1].id; draw(); return true; }
      catch (ex) { H.toast(ex.message); return false; } finally { sending = false; }
    },
  });
  box.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t || t.dataset.prof !== undefined || t.dataset.view !== undefined) return;
    const m = items.find((x) => String(x.id) === (t.dataset.greply || t.dataset.gcopy || t.dataset.gdel || t.closest('[data-gid]')?.dataset.gid));
    if (t.dataset.gmore !== undefined) { t.previousElementSibling.classList.remove('clamp'); t.remove(); return; }
    if (!m) return;
    if (t.dataset.gcopy) { try { await navigator.clipboard.writeText(m.text); H.toast('تم النسخ'); } catch { H.toast('تعذّر النسخ'); } return; }
    if (t.dataset.gdel) { if (!confirm('حذف هذه الرسالة من المجموعة؟')) return; try { await api('group_delete', { id: m.id }); items = items.filter((x) => x !== m); draw(true); } catch (ex) { H.toast(ex.message); } return; }
    if (t.dataset.greply) {
      if (admin) { H.pushPage('chat', String(m.user.id)); return; }
      // members never reach each other directly: the question goes to the office, quoting the post
      pendingQuote = `بخصوص رسالة ${who(m.user)} في المجموعة العامة: «${m.text.slice(0, 140)}${m.text.length > 140 ? '…' : ''}»`;
      H.pushPage('mychat');
    }
  });
  load();
  clearInterval(gpoll); gpoll = setInterval(() => { if (pg.isConnected && !document.hidden) load(true); else if (!pg.isConnected) clearInterval(gpoll); }, 8000);
}

async function loadInbox(box) {
  const { esc } = H;
  try {
    const j = await api('adm_chats');
    box.innerHTML = j.items.length ? j.items.map((c) => `<button class="cthread${c.unread ? ' new' : ''}" data-chat="${c.user.id}">
        ${userAv(c.user)}
        <div><b class="notr">${esc(c.user.verified && c.user.company ? c.user.company : c.user.name)} ${c.user.verified ? H.I.verified : ''}</b><span>${c.lastFrom === 'admin' ? 'أنت: ' : ''}<span class="notr">${esc(c.lastText)}</span></span></div>
        <div class="cmeta"><time>${c.last ? tm(c.last) : ''}</time>${c.unread ? `<i>${c.unread}</i>` : ''}</div></button>`).join('')
      : `<div class="cempty">${H.I.chat}<p>لا توجد محادثات بعد</p></div>`;
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  refreshUnread();
}

/* ---------- profiles (opened from the chats) ---------- */
export function profPage() { return '<div class="uprof"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
const waNum = (ph) => { let d = String(ph).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '971' + d; return 'https://wa.me/' + d; };
export async function initProf(pg, id) {
  const el = pg.querySelector('.uprof'); const { esc, I, money } = H;
  const me = session.user() || {};
  let j; try { j = await api('user_get', { id: +id || 0 }); } catch (e) { el.innerHTML = `<p class="muted pad">${esc(e.message)}</p>`; return; }
  const p = j.profile; const st = seenText(p);
  if (j.office) {
    el.innerHTML = `<div class="ptop">${officeAv(p.online, 'big')}<h2>عمر الياسي للعقارات ${I.verified}</h2><p class="pst${p.online ? ' on' : ''}">${st || 'حساب الإدارة'}</p></div>
      <div class="pstats"><div><b>${money(p.ads)}</b><span>أرض معروضة</span></div><div><b>${I.verified}</b><span>حساب موثّق</span></div></div>
      <div class="pcard"><p>المكتب الرسمي لعمر الياسي للعقارات — الشارقة. جميع الاستفسارات عن الإعلانات تتم عن طريقنا.</p></div>
      <div class="pbtns">${me.admin ? '' : `<button class="btn primary" data-mychat>${I.chat} مراسلة الإدارة</button>`}<button class="btn ghost" data-contactpg>الاتصال بنا</button></div>`;
    return;
  }
  const name = p.verified && p.company ? p.company : p.name;
  const joined = new Date(p.joined).toLocaleDateString(loc(), { month: 'long', year: 'numeric' });
  let h = `<div class="ptop">${userAv(p, 'big')}<h2><span class="notr">${esc(name)}</span> ${p.verified ? I.verified : ''}</h2>
    ${p.verified && p.company && p.company !== p.name ? `<p class="psub notr">${esc(p.name)}</p>` : ''}
    <p class="pst${p.online ? ' on' : ''}">${st}</p></div>
    <div class="pstats"><div><b>${money(p.ads)}</b><span>عقارات معروضة</span></div><div><b>${p.verified ? I.verified : '—'}</b><span>${p.verified ? 'مكتب موثّق' : 'غير موثّق'}</span></div><div><b class="sm">${esc(joined)}</b><span>عضو منذ</span></div></div>`;
  if (p.verified && (p.company || p.city)) h += `<div class="pcard"><h4>الشركة / المكتب</h4>${p.company ? `<p class="notr">${esc(p.company)}</p>` : ''}${p.city ? `<p class="muted">${esc(p.city)}</p>` : ''}</div>`;
  if (p.full) {
    const f = p.full; const ph = f.phone || f.verifyPhone;
    h += `<div class="pcard adm"><h4>التفاصيل الكاملة — للإدارة فقط</h4>
      <div class="prow"><span>البريد</span><b class="notr" dir="ltr">${esc(f.email)}</b></div>
      ${f.phone ? `<div class="prow"><span>الهاتف</span><b dir="ltr">${esc(f.phone)}</b></div>` : ''}
      ${f.verifyPhone && f.verifyPhone !== f.phone ? `<div class="prow"><span>هاتف التوثيق</span><b dir="ltr">${esc(f.verifyPhone)}</b></div>` : ''}
      <div class="prow"><span>طريقة الدخول</span><b>${f.google ? 'Google' : 'البريد الإلكتروني'}</b></div>
      <div class="prow"><span>النقاط</span><b>${f.admin ? '∞' : money(f.points)}</b></div>
      <div class="prow"><span>كل الإعلانات</span><b>${money(f.ads)}</b></div>
      ${f.banned ? '<div class="prow"><span>الحالة</span><b class="red">موقوف</b></div>' : ''}
      <div class="pbtns">${ph ? `<a class="btn ghost" href="tel:${esc(ph)}">اتصال</a><a class="btn wa" href="${esc(waNum(ph))}" data-ext>${I.wa || ''} واتساب</a>` : ''}
        ${f.id !== me.id ? `<button class="btn primary" data-chat="${f.id}">${I.chat} محادثة</button>` : ''}<button class="btn ghost" data-auser="${f.id}">إدارة الحساب</button></div></div>`;
  } else if (!me.admin && p.id !== me.id) {
    h += `<div class="pbtns"><button class="btn primary" data-askuser="${p.id}">${I.chat} استفسر عن طريق الإدارة</button></div>`;
  }
  const rt = p.rating || { avg: 0, n: 0, items: [] };
  h += `<div class="pcard prate"><h4>تقييمات التعامل</h4>${rt.n ? `<div class="rsum"><b>${rt.avg.toFixed(1)}</b>${starsHTML(rt.avg, 'big')}<span>${rt.n} تقييم</span></div>
    ${rt.items.map((r) => `<div class="ritem"><div>${starsHTML(r.stars)}<b class="notr">${esc(r.name)}</b><time>${new Date(r.t).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' })}</time>${me.admin ? `<button class="rdel" data-rdel="${r.from}:${r.lid}">حذف</button>` : ''}</div>${r.text ? `<p class="notr">${esc(r.text)}</p>` : ''}</div>`).join('')}`
    : '<p class="muted">لا توجد تقييمات بعد — التقييم يكون من العملاء بعد تواصلهم مع المعلن عن طريق الإدارة.</p>'}</div>`;
  h += p.items.length ? `<h3 class="msec">العقارات المعروضة (${money(p.ads)})</h3><div class="list">${p.items.map(oLandCard).join('')}</div>` : '';
  el.innerHTML = h;
  el.querySelectorAll('[data-rdel]').forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); if (!confirm('حذف هذا التقييم؟')) return; const [from, listing] = b.dataset.rdel.split(':'); try { await api('rate_delete', { owner: p.id, from, listing }); b.closest('.ritem').remove(); H.toast('تم حذف التقييم'); } catch (ex) { H.toast(ex.message); } }; });
  const ask = el.querySelector('[data-askuser]');
  if (ask) ask.onclick = (e) => { e.stopPropagation(); pendingQuote = `أرغب بالتواصل بخصوص إعلانات ${name}`; H.pushPage('mychat'); };
}
