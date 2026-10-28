// «المحادثات»: each user talks to the office. Listings from offices are asked about here; the office forwards the
// advertiser's WhatsApp number when it sees fit — buyers never reach an office directly.
import { api, session } from './owner.js';

let H = null;
export function initChat(h) { H = h; }
let pendingRef = null;            // listing the user is asking about
let unread = 0, poll = 0;
const isAdmin = () => !!(session.user() || {}).admin;

/* ---------- unread badge on the bottom bar ---------- */
let summary = null;   // { n, group: {last, lastText, unread}, private: {...} }
export async function refreshUnread() {
  if (!session.token()) { unread = 0; summary = null; } else {
    try { summary = await api('chat_unread'); unread = (summary.n || 0) + ((summary.group && summary.group.unread) || 0); } catch { /* keep */ }
  }
  const b = document.getElementById('chatN'); if (b) { b.textContent = unread > 99 ? '99+' : unread; b.hidden = !unread; }
  return unread;
}

/* ---------- message rendering ---------- */
const linkify = (t) => H.esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" data-ext dir="ltr">${u.replace(/^https?:\/\//, '')}</a>`).replace(/\n/g, '<br>');
const tm = (t) => new Date(t).toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE', { hour: 'numeric', minute: '2-digit' });
const dy = (t) => new Date(t).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE', { weekday: 'long', day: 'numeric', month: 'long' });
function refCard(r, admin) {
  const { esc, money } = H;
  return `<div class="cref" ${r.live ? `data-oland="${r.id}"` : ''}>${r.photo ? `<img src="${esc(r.photo)}" alt="">` : ''}<div><b class="notr">${esc(r.title)}</b>
    <span>${r.price ? money(r.price) + ' د.إ' : ''}${r.area ? ' · ' + money(r.area) + ' قدم²' : ''}</span>${r.seller ? `<span class="sl">${H.I.verified} ${esc(r.seller)}</span>` : ''}
    ${admin && r.owner ? `<span class="muted">المعلن: ${esc(r.owner)}${r.ownerPhone ? ' · ' + esc(r.ownerPhone) : ''}</span>` : ''}</div></div>
    ${admin && r.ownerPhone ? `<button class="btn wa fwd" data-fwd="${r.id}">📲 إرسال رقم المعلن للعميل</button>` : ''}`;
}
function msgsHTML(items, admin) {
  if (!items.length) return `<div class="cempty">${H.I.chat}<p>${admin ? 'لا توجد رسائل بعد' : 'اكتب رسالتك وسيرد عليك فريق عمر الياسي للعقارات'}</p></div>`;
  let h = '', last = '';
  for (const m of items) {
    const d = dy(m.t); if (d !== last) { h += `<div class="cday">${H.esc(d)}</div>`; last = d; }
    const mine = admin ? m.from === 'admin' : m.from === 'user';
    h += `<div class="cmsg ${mine ? 'me' : 'them'}">${m.ref ? refCard(m.ref, admin) : ''}${m.text ? `<p class="notr">${linkify(m.text)}</p>` : ''}<time>${tm(m.t)}</time></div>`;
  }
  return h;
}

/* ---------- a conversation (user ↔ office, or office ↔ user for the admin) ---------- */
function chatView(admin) {
  return `<div class="chat"><div class="cmsgs" id="cmsgs"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
    <div class="cbar"><div class="cchip" id="cchip" hidden></div>
      <form class="ccomp" id="ccomp"><textarea id="ctext" rows="1" placeholder="اكتب رسالة…" maxlength="2000"></textarea><button class="csend" aria-label="إرسال">${H.I.send || '➤'}</button></form></div></div>`;
}
function bindChat(root, { admin, uid }) {
  const box = root.querySelector('#cmsgs'), form = root.querySelector('#ccomp'), ta = root.querySelector('#ctext'), chip = root.querySelector('#cchip');
  let items = [], sending = false;
  const draw = (keep) => {
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = msgsHTML(items, admin);
    if (!keep || atEnd) box.scrollTop = box.scrollHeight;
  };
  const showChip = () => {
    chip.hidden = !pendingRef;
    if (pendingRef) chip.innerHTML = `<span>بخصوص: <b class="notr">${H.esc(pendingRef.title)}</b></span><button type="button" aria-label="إزالة">✕</button>`;
  };
  chip.onclick = (e) => { if (e.target.closest('button')) { pendingRef = null; showChip(); } };
  const load = async (keep) => {
    try { const j = admin ? await api('adm_chat', { id: uid }) : await api('chat_get'); items = j.items; draw(keep); refreshUnread(); }
    catch (e) { box.innerHTML = `<p class="muted pad">${H.esc(e.message)}</p>`; }
  };
  const send = async (text, listing) => {
    if (sending) return; sending = true;
    try {
      const j = admin ? await api('adm_chat_send', { id: uid, text, listing }) : await api('chat_send', { text, listing });
      items = j.items; draw(); return true;
    } catch (e) { H.toast(e.message); return false; } finally { sending = false; }
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); const text = ta.value.trim(); const ref = !admin && pendingRef ? pendingRef.id : 0;
    if (!text && !ref) return;
    if (await send(text, ref)) { ta.value = ''; ta.style.height = ''; if (!admin) { pendingRef = null; showChip(); } }
  };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  box.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-fwd]'); if (!f) return;
    e.stopPropagation();
    const m = items.find((x) => x.ref && String(x.ref.id) === f.dataset.fwd); if (!m) return;
    let d = String(m.ref.ownerPhone).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '971' + d.slice(1); if (/^5\d{8}$/.test(d)) d = '971' + d;
    if (!confirm(`إرسال رقم المعلن (${m.ref.owner || ''}) لهذا العميل؟`)) return;
    send(`رقم المعلن${m.ref.owner ? ' (' + m.ref.owner + ')' : ''} للتواصل بخصوص «${m.ref.title}» عبر واتساب:\nhttps://wa.me/${d}`, m.ref.id);
  });
  if (!admin && pendingQuote) { ta.value = pendingQuote + '\n'; pendingQuote = ''; setTimeout(() => { ta.focus(); ta.dispatchEvent(new Event('input')); }, 300); }
  showChip(); load();
  clearInterval(poll); poll = setInterval(() => { if (root.isConnected && !document.hidden) load(true); else if (!root.isConnected) clearInterval(poll); }, 12000);
}

/* ---------- the tab ---------- */
const groupIcon = '<span class="acc-av grp"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><circle cx="9" cy="8" r="3.4"/><circle cx="16.5" cy="9" r="2.6"/><path d="M2.5 19c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6v1h-13z"/><path d="M15.2 13.4c3.3-.4 6.3 1.6 6.3 5.1v1.5h-4.6v-1c0-2.2-.6-4.1-1.7-5.6z"/></svg></span>';
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
    el.querySelector('#clist').innerHTML = rowHTML('data-group', groupIcon, 'المجموعة العامة', g.lastText || 'رسائل الأعضاء — لكل المسجّلين', g.last, g.unread)
      + (u.admin ? '' : rowHTML('data-mychat', '<span class="acc-av img emb"><img src="icons/icon-192.png" alt=""></span>', 'عمر الياسي للعقارات', pv.lastText || 'راسل الإدارة واستفسر عن أي إعلان', pv.last, pv.unread));
  };
  draw(); refreshUnread().then(draw);
  if (u.admin) { el.querySelector('#inbox').innerHTML = '<h3 class="msec">رسائل خاصة</h3><div id="ibx"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; loadInbox(el.querySelector('#ibx')); }
}
export function myChatPage() {
  return `<div class="chead"><span class="acc-av img emb"><img src="icons/icon-192.png" alt=""></span><div><b>عمر الياسي للعقارات</b><span>نرد عليك في أقرب وقت</span></div></div>${chatView(false)}`;
}
export function initMyChat(pg) { pg.classList.add('chatpg'); bindChat(pg, { admin: false }); }

/* ---------- the public group ---------- */
export function groupPage() {
  return `<div class="chat"><div class="cmsgs grpmsgs" id="gmsgs"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>
    <div class="cbar"><form class="ccomp" id="gcomp"><textarea id="gtext" rows="1" placeholder="ابدأ محادثة …" maxlength="3000"></textarea><button class="csend" aria-label="إرسال">${H.I.send}</button></form>
    <p class="gnote">أرقام الهواتف والروابط تُخفى تلقائياً — التواصل بين الأعضاء يتم عن طريق الإدارة</p></div></div>`;
}
export function initGroup(pg) {
  pg.classList.add('chatpg');
  const box = pg.querySelector('#gmsgs'), form = pg.querySelector('#gcomp'), ta = pg.querySelector('#gtext');
  let items = [], admin = false, lastId = 0, sending = false;
  const { esc, I } = H;
  const av = (u) => u.avatar ? `<span class="acc-av img gav"><img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer"></span>` : `<span class="acc-av gav">${esc((u.name || '?').charAt(0))}</span>`;
  const draw = (keep) => {
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (!items.length) { box.innerHTML = `<div class="cempty">${I.chat}<p>كن أول من يكتب في المجموعة</p></div>`; return; }
    let h = '', last = '';
    for (const m of items) {
      const d = dy(m.t); if (d !== last) { h += `<div class="cday">${esc(d)}</div>`; last = d; }
      const long = m.text.length > 320;
      h += `<div class="gmsg ${m.mine ? 'me' : ''}" data-gid="${m.id}">${m.mine ? '' : av(m.user)}<div class="gbody">
        ${m.mine ? '' : `<b class="gname notr">${esc(m.user.name)} ${m.user.verified ? I.verified : ''}${m.user.admin ? '<i class="pill plan">الإدارة</i>' : ''}</b>`}
        <div class="gbubble"><p class="notr${long ? ' clamp' : ''}">${linkify(m.text)}</p>${long ? '<button class="gmore" data-gmore>قراءة المزيد</button>' : ''}
          <div class="gact">${!m.mine ? `<button data-greply="${m.id}">${I.chat} رد على الخاص</button>` : ''}<button data-gcopy="${m.id}">📋 نسخ</button>${m.mine || admin ? `<button data-gdel="${m.id}" class="del">🗑</button>` : ''}</div>
          <time>${tm(m.t)}</time></div></div></div>`;
    }
    box.innerHTML = h;
    if (!keep || atEnd) box.scrollTop = box.scrollHeight;
  };
  const load = async (more) => {
    try {
      const j = await api('group_get', more ? { after: lastId } : {}); admin = j.admin;
      if (more) { if (!j.items.length) return; items = items.concat(j.items); } else items = j.items;
      lastId = items.length ? items[items.length - 1].id : 0; draw(more); refreshUnread();
    } catch (e) { box.innerHTML = `<p class="muted pad">${esc(e.message)}</p>`; }
  };
  form.onsubmit = async (e) => {
    e.preventDefault(); const text = ta.value.trim(); if (!text || sending) return; sending = true;
    try { const j = await api('group_send', { text, after: lastId }); items = items.concat(j.items); lastId = items[items.length - 1].id; ta.value = ''; ta.style.height = ''; draw(); }
    catch (ex) { H.toast(ex.message); } finally { sending = false; }
  };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  box.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const m = items.find((x) => String(x.id) === (t.dataset.greply || t.dataset.gcopy || t.dataset.gdel || t.closest('[data-gid]')?.dataset.gid));
    if (t.dataset.gmore !== undefined) { t.previousElementSibling.classList.remove('clamp'); t.remove(); return; }
    if (!m) return;
    if (t.dataset.gcopy) { try { await navigator.clipboard.writeText(m.text); H.toast('تم النسخ'); } catch { H.toast('تعذّر النسخ'); } return; }
    if (t.dataset.gdel) { if (!confirm('حذف هذه الرسالة من المجموعة؟')) return; try { await api('group_delete', { id: m.id }); items = items.filter((x) => x !== m); draw(true); } catch (ex) { H.toast(ex.message); } return; }
    if (t.dataset.greply) {
      if (admin) { H.pushPage('chat', String(m.user.id)); return; }
      // members never reach each other directly: the question goes to the office, quoting the post
      pendingQuote = `بخصوص رسالة ${m.user.name} في المجموعة العامة: «${m.text.slice(0, 140)}${m.text.length > 140 ? '…' : ''}»`;
      H.pushPage('mychat');
    }
  });
  load();
  clearInterval(gpoll); gpoll = setInterval(() => { if (pg.isConnected && !document.hidden) load(true); else if (!pg.isConnected) clearInterval(gpoll); }, 8000);
}
let gpoll = 0, pendingQuote = '';

async function loadInbox(box) {
  const { esc } = H;
  try {
    const j = await api('adm_chats');
    box.innerHTML = j.items.length ? j.items.map((c) => `<button class="cthread${c.unread ? ' new' : ''}" data-chat="${c.user.id}">
        ${c.user.avatar ? `<span class="acc-av img"><img src="${esc(c.user.avatar)}" alt="" referrerpolicy="no-referrer"></span>` : `<span class="acc-av">${esc((c.user.company || c.user.name || '?').charAt(0))}</span>`}
        <div><b class="notr">${esc(c.user.verified && c.user.company ? c.user.company : c.user.name)} ${c.user.verified ? H.I.verified : ''}</b><span>${c.lastFrom === 'admin' ? 'أنت: ' : ''}<span class="notr">${esc(c.lastText)}</span></span></div>
        <div class="cmeta"><time>${c.last ? tm(c.last) : ''}</time>${c.unread ? `<i>${c.unread}</i>` : ''}</div></button>`).join('')
      : `<div class="cempty">${H.I.chat}<p>لا توجد محادثات بعد</p></div>`;
  } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  refreshUnread();
}
export function chatPage() { return chatView(true); }
export function initChatPage(pg, uid) { pg.classList.add('chatpg'); bindChat(pg, { admin: true, uid }); }
export function askAbout(listing) { pendingRef = listing; }
