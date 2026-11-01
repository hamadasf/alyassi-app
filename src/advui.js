// Screens for the advertiser pictures shown on listing cards:
// · «صورة المعلن وشعار الشركة» (admin, from Settings): the office's name, photo and logo → every office listing at once
// · the member's own photo + company logo (asked at sign-up, or from the account page) → approved by the admin
// · the admin's list of pictures waiting for approval (a tab of the admin panel)
import { api, session, refreshMe } from './owner.js';
import { office, setBrand, advStrip } from './adv.js';
import { ADVERTISER } from './config.js';

let H = null;
export function initAdvUI(h) { H = h; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** a picture from the phone, made smaller, on white (transparent logos stay readable) → JPEG data URL */
export function shrink(file, max = 700) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('صورة غير صالحة')); };
    img.src = url;
  });
}
/** two picture fields (personal photo · company logo) with previews; read() → { photo, logo } data URLs (or '') */
export function pickersHTML(cur = {}, only = '') {
  const one = (k, title, hint, src) => `<label class="advpick${k === 'photo' ? ' round' : ''}"${only ? ` data-only="${only}"` : ''}>
      <span class="advpv">${src ? `<img src="${esc(src)}" alt="">` : `<i>${k === 'photo' ? '👤' : '🏢'}</i>`}</span>
      <span class="advtx"><b>${title}</b><small>${hint}</small></span>
      <input type="file" accept="image/*" data-advk="${k}" hidden></label>`;
  return `<div class="advpicks"${only ? ` data-only="${only}"` : ''}>${one('photo', 'صورتك الشخصية *', 'تظهر بجانب اسمك على إعلاناتك', cur.photo)}${one('logo', 'صورة أو شعار الشركة *', 'يظهر على يسار إعلاناتك', cur.logo)}</div>`;
}
export function bindPickers(root) {
  const got = { photo: '', logo: '' };
  root.querySelectorAll('[data-advk]').forEach((inp) => {
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const d = await shrink(f, inp.dataset.advk === 'logo' ? 800 : 600); got[inp.dataset.advk] = d;
        inp.closest('.advpick').querySelector('.advpv').innerHTML = `<img src="${d}" alt="">`;
      } catch (e) { H.toast(e.message); }
    };
  });
  return () => ({ ...got });
}

/* ---------- admin: the office's advertiser ---------- */
export function brandPage() {
  const o = office();
  return `<div class="pad advset">
    <p class="muted">تظهر هذه الصورة والاسم والشعار على كل إعلانات الشركة في التطبيق، وأي تغيير يظهر تلقائياً على كل الإعلانات.</p>
    <div class="advdemo card"><div class="ph"></div><div class="body" id="bPrev">${advStrip()}</div></div>
    <label class="fld">اسم المعلن<input id="bName" maxlength="60" value="${esc(o.name)}"></label>
    <div class="advrow">
      <label class="btn"><input type="file" accept="image/*" id="bPhoto" hidden>📷 تغيير صورة المعلن</label>
      <label class="btn"><input type="file" accept="image/*" id="bLogo" hidden>🏢 تغيير شعار الشركة</label>
    </div>
    <div class="advrow"><button class="btn ghost sm" data-reset="photo">إرجاع الصورة الأصلية</button><button class="btn ghost sm" data-reset="logo">إرجاع الشعار الأصلي</button></div>
    <button class="btn primary block" id="bSave">حفظ</button>
  </div>`;
}
export function initBrand(pg) {
  const { toast } = H;
  const send = { photo: '', logo: '' };
  const prev = () => {
    const o = office(), b = pg.querySelector('#bPrev');
    b.innerHTML = advStrip();
    const nm = pg.querySelector('#bName').value.trim(); b.querySelector('.adv-nm b').textContent = nm || o.name;
    if (send.photo) b.querySelector('.adv-ph img').src = send.photo === 'reset' ? ADVERTISER.photo : send.photo;
    if (send.logo) { const im = b.querySelector('.adv-logo img'); if (im) im.src = send.logo === 'reset' ? ADVERTISER.logo : send.logo; }
  };
  pg.querySelector('#bName').oninput = prev;
  [['#bPhoto', 'photo', 600], ['#bLogo', 'logo', 800]].forEach(([sel, k, max]) => {
    const inp = pg.querySelector(sel);
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { send[k] = await shrink(f, max); prev(); } catch (e) { toast(e.message); } };
  });
  pg.querySelectorAll('[data-reset]').forEach((b) => { b.onclick = () => { send[b.dataset.reset] = 'reset'; prev(); }; });
  pg.querySelector('#bSave').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'جارِ الحفظ…';
    try {
      const body = { name: pg.querySelector('#bName').value.trim() };
      if (send.photo) body.photo = send.photo; if (send.logo) body.logo = send.logo;
      const j = await api('adm_brand', body); setBrand(j.brand);
      toast('تم — تغيّرت على كل الإعلانات ✓'); H.closeTop();
    } catch (ex) { toast(ex.message); b.disabled = false; b.textContent = 'حفظ'; }
  };
}

/* ---------- member: own photo + company logo ---------- */
const ST = { pending: ['بانتظار موافقة الإدارة', 'res'], approved: ['معتمدة', 'av'], rejected: ['لم تُعتمد', 'sold'] };
export function advMinePage() {
  const u = session.user() || {}, a = u.adv || {}, p = a.pending || {};
  const st = ST[a.status];
  return `<div class="pad advset">
    <p class="muted">صورتك الشخصية وشعار شركتك يظهران على إعلاناتك (مثل بروبيرتي فايندر) بعد أن تعتمدهما الإدارة.</p>
    ${st ? `<p class="advst"><i class="pill ${st[1]}">${st[0]}</i>${a.status === 'rejected' && a.note ? ` <small>السبب: ${esc(a.note)}</small>` : ''}</p>` : ''}
    ${pickersHTML({ photo: p.photo || a.photo, logo: p.logo || a.logo })}
    <button class="btn primary block" id="advSend">إرسال للاعتماد</button>
  </div>`;
}
export function initAdvMine(pg) {
  const read = bindPickers(pg);
  pg.querySelector('#advSend').onclick = async (e) => {
    const b = e.currentTarget, v = read();
    if (!v.photo && !v.logo) { H.toast('اختر صورتك أو شعار الشركة'); return; }
    b.disabled = true; b.textContent = 'جارِ الإرسال…';
    try { await submitAdv(v); H.toast('تم الإرسال — تظهر بعد موافقة الإدارة ✓'); H.closeTop(); }
    catch (ex) { H.toast(ex.message); b.disabled = false; b.textContent = 'إرسال للاعتماد'; }
  };
}
export async function submitAdv(v) {
  const body = {}; if (v.photo) body.photo = v.photo; if (v.logo) body.logo = v.logo;
  await api('adv_submit', body); await refreshMe().catch(() => {});
}
/** does the member still need to send their pictures? */
export function advMissing(u) {
  if (!u || u.admin || (u.staff && u.staff.length)) return false;
  const a = u.adv || {};
  return !(a.photo || a.logo) && a.status !== 'pending';
}

/* ---------- admin panel tab: pictures waiting for approval ---------- */
export async function renderAdvReqs(list, countEl) {
  const j = await api('adm_advs');
  if (countEl) countEl.textContent = j.count ? `(${j.count})` : '';
  list.innerHTML = j.items.length ? j.items.map((u) => `<div class="vreq advreq">
      <div class="advpair"><span class="adv-ph"><img src="${esc(u.photo || u.cur.photo || ADVERTISER.photo)}" alt="" data-web="${esc(u.photo)}"></span>
        ${u.logo || u.cur.logo ? `<span class="adv-logo big"><img src="${esc(u.logo || u.cur.logo)}" alt="" data-web="${esc(u.logo)}"></span>` : ''}</div>
      <b>${esc(u.verified && u.company ? u.company : u.name)}</b><span>${esc(u.email)}${u.photo ? ' · صورة جديدة' : ''}${u.logo ? ' · شعار جديد' : ''}</span>
      <div class="admact"><button class="btn wa" data-aok="${u.id}">✓ اعتماد</button><button class="btn ghost" data-ano="${u.id}">✕ رفض</button></div></div>`).join('')
    : '<p class="muted">لا توجد صور بانتظار الاعتماد.</p>';
}
export async function advReqClick(e, reload) {
  const ok = e.target.closest('[data-aok]'), no = e.target.closest('[data-ano]'); if (!ok && !no) return false;
  e.stopPropagation();
  const id = ok ? ok.dataset.aok : no.dataset.ano; let note = '';
  if (no) { note = prompt('سبب الرفض (اختياري):', ''); if (note === null) return true; }
  try { await api('adm_adv', { id, approve: ok ? '1' : '0', note }); H.toast(ok ? 'تم الاعتماد — تظهر على إعلاناته ✓' : 'تم الرفض'); reload(); }
  catch (ex) { H.toast(ex.message); }
  return true;
}
