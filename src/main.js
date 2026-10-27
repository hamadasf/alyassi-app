import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { cardModel, buildLandPdf } from './card.js';
import { planLocHTML } from './planloc.js';
import { InAppBrowser, DefaultWebViewOptions, ToolbarPosition } from '@capacitor/inappbrowser';
import { SITE, CONTACT, LOGO, EMBLEM, ONESIGNAL_APP_ID, APP_URL } from './config.js';
import { loadAll, loadFromCache, cached, favs, STATUS, getChanges, loadChanges, seen, offerFor } from './data.js';
import { I } from './icons.js';

const native = Capacitor.isNativePlatform();
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('en-US');
const money = (v) => (v ? nf.format(Math.round(v)) : '');
const DATA = () => cached() || { projects: [], lands: [] };
const fmtDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : d; };

/* ================= helpers ================= */
const waLink = (text) => `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
const landUrl = (l) => `${SITE}/${l.project}/#p${l.n}`;
const landMsg = (l) => `مرحباً، أرغب بالاستفسار عن القطعة رقم ${l.n} في مشروع ${l.projectName}\n${landUrl(l)}`;

async function openWeb(url, title) {
  if (!native) { window.open(url, '_blank'); return; }
  try {
    await InAppBrowser.openInWebView({
      url,
      options: {
        ...DefaultWebViewOptions,
        showURL: false, showToolbar: true, toolbarPosition: ToolbarPosition.TOP,
        showNavigationButtons: false, closeButtonText: 'إغلاق', leftToRight: false,
        customWebViewUserAgent: null,
        android: { ...DefaultWebViewOptions.android, hardwareBack: true, pauseMedia: true },
      },
    });
  } catch { window.open(url, '_blank'); }
}
async function openExternal(url) {
  if (!native) { window.open(url, '_blank'); return; }
  try { await InAppBrowser.openInExternalBrowser({ url }); } catch { location.href = url; }
}

/* ---- recent changes ---- */
const DAY = 24 * 3600e3;
const hrs = (h) => `${h} ${h >= 3 && h <= 10 ? 'ساعات' : 'ساعة'}`;
function recentChange(id) {
  const c = getChanges().find((x) => x.id === id);
  return c && Date.now() - c.t < 3 * DAY ? c : null;
}
function changeBadge(l) {
  const c = recentChange(l.id); if (!c || c.kind === 'offer') return '';
  const txt = c.kind === 'new' ? 'جديدة' : c.kind === 'price' ? (c.to < c.from ? 'سعر أقل' : 'سعر جديد') : 'تحديث';
  return `<span class="badge upd ${c.kind === 'price' && c.to < c.from ? 'down' : ''}">${txt}</span>`;
}
function changeLine(c) {
  const st = (k) => (STATUS[k] || { label: k }).label;
  if (c.kind === 'offer') return `<b class="ofr-t">🔥 عرض لفترة محدودة</b>${c.to || c.from ? ` · بسعر ${money(c.to || c.from)} د.إ` : ''}${c.to && c.from > c.to ? ` <s>${money(c.from)}</s>` : ''}${c.until ? ` · حتى ${dmy(c.until)}` : ''}`;
  if (c.kind === 'new') return `أرض جديدة متاحة${c.to ? ' · ' + money(c.to) + ' د.إ' : ''}`;
  if (c.kind === 'status') return `الحالة: ${st(c.from)} ← <b>${st(c.to)}</b>`;
  const arrow = c.to < c.from ? I.down : I.up;
  return `السعر: <s>${c.from ? money(c.from) : 'للاستفسار'}</s> ← <b>${c.to ? money(c.to) + ' د.إ' : 'للاستفسار'}</b> <i class="arr ${c.to < c.from ? 'dn' : ''}">${arrow}</i>`;
}
/* ---- limited-time offers ---- */
const dmy = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
function leftText(until) {
  const ms = until - Date.now(); if (ms <= 0) return 'انتهى العرض';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  if (d >= 1) return `ينتهي خلال ${d} ${d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? 'أيام' : 'يوماً'}${h ? ` و${hrs(h)}` : ''}`;
  if (h >= 1) return `ينتهي خلال ${hrs(h)}${m ? ` و${m} دقيقة` : ''}`;
  return `ينتهي خلال ${Math.max(1, m)} ${m >= 3 && m <= 10 ? 'دقائق' : 'دقيقة'}`;
}
const offerPrice = (l, o) => (o && o.price) || l.total;
const offerWas = (l, o) => { const was = l.total || o.old; return o.price && was > o.price ? was : 0; };
const offerLands = () => DATA().lands.filter(offerFor).sort((a, b) => offerFor(a).until - offerFor(b).until);
setInterval(() => document.querySelectorAll('[data-until]').forEach((el) => { el.textContent = leftText(+el.dataset.until); }), 30e3);

function unseenCount() { const s = seen.get(); return getChanges().filter((c) => c.t > s).length; }
function updateBell() {
  const n = unseenCount(); const b = $('#bellN');
  if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
}
function changesPage() {
  const items = getChanges();
  if (!items.length) return `<div class="pad changes">${notifCard()}</div><div class="empty">${I.bell}<p>لا توجد تحديثات حالياً</p><p class="sub">ستظهر هنا أي تغييرات في الأسعار أو حالة الأراضي</p></div>`;
  const fmtDay = (t) => new Date(t).toLocaleDateString('ar-AE', { weekday: 'long', day: 'numeric', month: 'long' });
  let html = '', last = '';
  const s = seen.get();
  for (const c of items) {
    const day = fmtDay(c.t);
    if (day !== last) { html += `<h3 class="cday">${esc(day)}</h3>`; last = day; }
    const has = DATA().lands.some((l) => l.id === c.id);
    html += `<div class="citm${c.t > s ? ' unseen' : ''}" ${has ? `data-land="${esc(c.id)}"` : ''}>
      <div class="ck ${c.kind}">${c.kind === 'price' ? I.tag : c.kind === 'new' || c.kind === 'offer' ? I.star : I.info}</div>
      <div class="cb"><b>قطعة ${esc(c.n)} · ${esc(c.projectName)}</b><span>${changeLine(c)}</span></div>
      <time>${new Date(c.t).toLocaleTimeString('ar-AE', { hour: 'numeric', minute: '2-digit' })}</time></div>`;
  }
  return `<div class="pad changes">${notifCard()}${html}</div>`;
}

/* ---- push notifications ---- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const push = {
  ready: false,
  nativeOn: false,
  initNative() {
    const go = async () => {
      const OS = (window.plugins && window.plugins.OneSignal) || (window.OneSignal && (window.OneSignal.default || window.OneSignal));
      if (!OS || !OS.initialize) return;
      try {
        OS.initialize(ONESIGNAL_APP_ID);
        push.os = OS; push.ready = true;
        OS.Notifications.addEventListener('click', (ev) => { setTimeout(() => openFromPush(ev), 400); });
        OS.Notifications.addEventListener('permissionChange', (granted) => { push.nativeOn = !!granted; push.render(); });
        push.nativeOn = await OS.Notifications.getPermissionAsync();
        push.render();
        // ask once on first launch so clients are subscribed without hunting for the button
        let asked = false; try { asked = !!localStorage.getItem('oay:askedPush'); } catch { /* ignore */ }
        if (!push.nativeOn && !asked) {
          try { localStorage.setItem('oay:askedPush', '1'); } catch { /* ignore */ }
          setTimeout(() => push.enable(), 2500);
        }
      } catch (e) { console.warn('push', e); }
    };
    if ((window.plugins && window.plugins.OneSignal) || window.OneSignal) go(); else document.addEventListener('deviceready', go, { once: true });
  },
  init() {
    if (native) { push.initNative(); return; }
    if (!('Notification' in window) || location.protocol !== 'https:') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OS) => {
      try {
        await OS.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: new URL('sw.js', location.href).pathname.slice(1),
          serviceWorkerParam: { scope: new URL('./', location.href).pathname },
          notifyButton: { enable: false }, autoResubscribe: true,
        });
        push.ready = true; push.os = OS;
        OS.Notifications.addEventListener('permissionChange', () => setTimeout(push.render, 300));
        OS.Notifications.addEventListener('click', (ev) => openFromPush(ev));
        push.render();
      } catch (e) { console.warn('push', e); }
    });
  },
  on() {
    if (native) return push.nativeOn;
    return !!(push.os && push.os.Notifications.permission && push.os.User.PushSubscription.optedIn !== false);
  },
  state() {
    if (native) return push.ready ? (push.nativeOn ? 'on' : 'off') : 'unsupported';
    if (!('Notification' in window)) return isIOS && !standalone() ? 'install' : 'unsupported';
    if (isIOS && !standalone()) return 'install';
    if (Notification.permission === 'denied') return 'denied';
    return push.on() ? 'on' : 'off';
  },
  async enable() {
    const st = push.state();
    if (st === 'install') { toast('أضف التطبيق إلى الشاشة الرئيسية أولاً ثم فعّل الإشعارات'); return; }
    if (!push.os) { toast('لحظة… جارِ التحضير'); return; }
    if (native) {
      try { push.nativeOn = await push.os.Notifications.requestPermission(true); push.os.User.pushSubscription.optIn(); } catch { /* ignore */ }
      push.render(); if (push.nativeOn) toast('تم تفعيل الإشعارات ✓'); return;
    }
    try { await push.os.Notifications.requestPermission(); await push.os.User.PushSubscription.optIn(); } catch { /* ignore */ }
    push.render();
    if (push.on()) toast('تم تفعيل الإشعارات ✓');
    else if (Notification.permission === 'denied') toast('الإشعارات مرفوضة من إعدادات المتصفح');
  },
  render() {
    const st = push.state();
    document.querySelectorAll('.notif-card').forEach((el) => {
      el.hidden = st === 'on' || st === 'unsupported';
      const p = el.querySelector('p');
      if (p) p.textContent = st === 'install' ? 'على الآيفون: أضف التطبيق للشاشة الرئيسية من زر المشاركة، ثم افتحه من الأيقونة وفعّل الإشعارات.'
        : st === 'denied' ? 'الإشعارات مرفوضة — فعّلها من إعدادات المتصفح لهذا الموقع.'
        : 'يوصلك إشعار فوراً عند تغيّر سعر أو حالة أي أرض، أو نزول أرض جديدة.';
      const b = el.querySelector('button'); if (b) b.hidden = st === 'install' || st === 'denied';
    });
  },
};
let lastOpen = { id: '', t: 0 };
function openLandId(id) {
  if (lastOpen.id === id && Date.now() - lastOpen.t < 4000) return;
  lastOpen = { id, t: Date.now() };
  const go = () => { if (DATA().lands.some((l) => l.id === id)) { closeAll(); pushPage('land', id); return true; } return false; };
  if (!go()) (loading || Promise.resolve()).then(() => { if (!go()) document.querySelector('[data-changes]')?.click(); });
}
function openFromPush(ev) {
  const n = (ev && (ev.notification || ev.result && ev.result.notification)) || {};
  const data = n.additionalData || n.data || {};
  if (data.open === 'land' && data.id) { refresh(false); openLandId(String(data.id)); return; }
  refresh(false).then(() => document.querySelector('[data-changes]')?.click());
}
const notifCard = () => `<div class="notif-card" hidden>${I.bell}<div><b>فعّل إشعارات الأسعار</b><p></p></div><button class="btn gold" data-notify>تفعيل</button></div>`;

/* ---- sharing ---- */
// organised WhatsApp message (same facts as the PDF card)
function landModel(l) {
  const proj = DATA().projects.find((p) => p.slug === l.project);
  const m = cardModel(l, offerFor(l), l.projectLoc || (proj && proj.loc) || '');
  m.map = (proj && proj.map) || null;
  return m;
}
function landShareText(l, withPdf) {
  const m = landModel(l);
  const ST = { av: '✅ متاحة', res: '🟠 محجوزة', sold: '⛔ مباعة' };
  const L = [];
  L.push(`*🏡 قطعة رقم ${l.n} · مشروع ${l.projectName}*`);
  L.push(`الحالة: ${ST[l.status] || 'للاستفسار'}`);
  if (m.offer) L.push(`🔥 *عرض لفترة محدودة* حتى ${dmy(m.offer.until)}${m.offer.note ? ` · ${m.offer.note}` : ''}`);
  L.push('', '📐 *بيانات القطعة*'); m.info.slice(2).forEach((r) => L.push(`• ${r[0]}: ${r[1]}`));
  if (m.terms.length) { L.push('', '📋 *شروط التخطيط*'); m.terms.forEach((r) => L.push(`• ${r[0]}: ${r[1]}`)); }
  if (m.price) {
    L.push('', `💰 *السعر الإجمالي: ${money(m.price)} درهم*${m.was ? ` بدلاً من ${money(m.was)}` : ''}${l.ppf && !(m.offer && m.offer.price) ? ` (سعر القدم ${money(l.ppf)} درهم)` : ''}`);
  } else if (l.status === 'av') L.push('', '💰 السعر: عند الاستفسار');
  if (m.pay.length) {
    L.push('', '🗓️ *خطة السداد*'); m.pay.forEach((r) => L.push(`• ${r[0]}: ${money(r[1])} درهم`));
  }
  L.push('');
  if (withPdf && withPdf.hasPdf) L.push('📎 مرفق: بطاقة القطعة + مخطط الأرض (PDF)');
  else { if (withPdf) L.push('📎 مرفق: بطاقة القطعة (PDF)'); if (l.doc) L.push('📎 مخطط الأرض (PDF):', l.doc); }
  if (m.loc) L.push(`📍 ${l.lo ? 'موقع الأرض' : 'موقع المشروع'} على الخريطة:`, m.loc);
  L.push('🗺️ القطعة على المخطط التفاعلي:', m.planUrl);
  L.push('', `📞 للحجز: ${CONTACT.phoneLabel} · واتساب ${CONTACT.whatsappLabel}`, '*عمر الياسي للعقارات*');
  return L.join('\n');
}

/* ---- share sheet: complete PDF card (details + plot plan) ---- */
const pdfCache = new Map();
function landPdf(l) {
  const key = l.id + '|' + l.status + '|' + l.total + '|' + (offerFor(l) ? offerFor(l).until : '');
  if (!pdfCache.has(key)) pdfCache.set(key, buildLandPdf(landModel(l)).catch((e) => { pdfCache.delete(key); throw e; }));
  return pdfCache.get(key);
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function sendPdf(l, pdf) {
  const text = landShareText(l, pdf), title = `قطعة رقم ${l.n}`;
  if (native) {
    const w = await Filesystem.writeFile({ path: pdf.name, data: b64(pdf.bytes), directory: Directory.Cache });
    await Share.share({ title, text, files: [w.uri], dialogTitle: 'إرسال عبر واتساب' });
    return;
  }
  const file = new File([pdf.bytes], pdf.name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text }); return; }
  // desktop browsers: save the PDF and open WhatsApp with the text
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = pdf.name; a.click();
  openExternal('https://wa.me/?text=' + encodeURIComponent(text));
}
function openShareSheet(l) {
  document.querySelector('.ssheet')?.remove();
  const el = document.createElement('div'); el.className = 'ssheet';
  el.innerHTML = `<div class="ss-scrim" data-ssclose></div><div class="ss-box">
    <div class="ss-grip"></div>
    <h3>مشاركة تفاصيل القطعة ${esc(l.n)}</h3>
    <p class="ss-sub">بطاقة كاملة: التفاصيل، شروط التخطيط، السعر والدفعات مع تواريخها${l.doc ? '، ومخطط الأرض PDF' : ''} — في ملف واحد</p>
    <div class="ss-state"><i class="spin"></i><span>جارِ تجهيز الملف…</span></div>
    <button class="btn wa block" data-sspdf disabled>${I.wa} إرسال البطاقة + المخطط PDF</button>
    <button class="btn ghost block" data-sstext>${I.share} إرسال النص فقط</button>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 250); };
  el.querySelector('[data-ssclose]').onclick = close;
  el.querySelector('[data-sstext]').onclick = () => { close(); shareText(`قطعة رقم ${l.n}`, landShareText(l, false)); };
  const btn = el.querySelector('[data-sspdf]'), st = el.querySelector('.ss-state');
  let ready = null;
  landPdf(l).then((pdf) => {
    ready = pdf; btn.disabled = false;
    st.innerHTML = `<b class="ok">✓</b><span>${pdf.hasPdf ? 'البطاقة ومخطط الأرض جاهزان في ملف PDF واحد' : l.doc ? 'البطاقة جاهزة (تعذّر إرفاق المخطط — سيُرسل رابطه)' : 'البطاقة جاهزة (لا يوجد مخطط PDF لهذه القطعة)'}</span>`;
  }).catch(() => { st.innerHTML = '<span>تعذّر تجهيز الملف — يمكنك إرسال النص</span>'; });
  btn.onclick = async () => {
    if (!ready) return;
    try { await sendPdf(l, ready); close(); }
    catch (e) { if (!(e && (e.name === 'AbortError' || /cancel/i.test(e.message || '')))) toast('تعذّر فتح المشاركة'); }
  };
}
function projectShareText(p) {
  return [`📍 مشروع ${p.name}${p.sub ? ' — ' + p.sub : ''}`, `${p.available} أرض متاحة`,
    `المخطط التفاعلي: ${p.plan}`, `📞 واتساب: ${CONTACT.whatsappLabel}`, 'عمر الياسي للعقارات'].join('\n');
}
async function shareText(title, text) {
  try {
    if (native) { await Share.share({ title, text, dialogTitle: 'مشاركة' }); return; }
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) { if (e && (e.name === 'AbortError' || /cancel/i.test(e.message || ''))) return; }
  try { await navigator.clipboard.writeText(text); toast('تم نسخ التفاصيل — الصقها في أي محادثة'); }
  catch { openExternal('https://wa.me/?text=' + encodeURIComponent(text)); }
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= cards ================= */
function priceHTML(l, big) {
  if (l.status === 'sold') return `<div class="price muted">تم البيع</div>`;
  const o = offerFor(l);
  if (o && offerPrice(l, o)) return `<div class="price ofr${big ? ' big' : ''}">${offerWas(l, o) ? `<s>${money(offerWas(l, o))}</s>` : ''}${money(offerPrice(l, o))} <small>د.إ</small></div>`;
  if (!l.total) return `<div class="price ask">السعر عند الاستفسار</div>`;
  return `<div class="price${big ? ' big' : ''}">${money(l.total)} <small>د.إ</small></div>`;
}
const areaHTML = (l) => l.ft ? `${l.approx ? '≈ ' : ''}${money(l.ft)} قدم² <span class="subt">(${money(l.m2)} م²)</span>` : '—';
const dot = (c) => `<i class="dot" style="background:rgb(${c.join(',')})"></i>`;

function landCard(l) {
  const st = STATUS[l.status] || STATUS.av;
  const fav = favs.has(l.id);
  const o = offerFor(l);
  return `<article class="card land${o ? ' has-ofr' : ''}" data-land="${esc(l.id)}">
    <div class="ph"><img loading="lazy" decoding="async" src="${esc(l.img)}" alt="" onerror="this.style.opacity=0">
      <span class="badge ${st.cls}">${st.label}</span>
      ${o ? `<span class="badge ofr">🔥 عرض</span>` : l.featured && l.status === 'av' ? `<span class="badge star">${I.star} مميزة</span>` : ''}
      ${changeBadge(l)}
      <button class="fav${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="مفضلة">${I.heart}</button>
      <button class="fav sh" data-share="land:${esc(l.id)}" aria-label="مشاركة">${I.share}</button>
    </div>
    <div class="body">
      <div class="row between"><h3>قطعة رقم ${esc(l.n)}</h3>${priceHTML(l)}</div>
      <div class="type">${dot(l.color)}${esc(l.use)}${l.tag ? ` · ${esc(l.tag)}` : ''}</div>
      <div class="meta">${I.pin}<span>${esc(l.projectName)}</span></div>
      ${o ? `<div class="ofr-line">⏳ <span data-until="${o.until}">${leftText(o.until)}</span>${o.note ? ` · ${esc(o.note)}` : ''}</div>` : ''}
      <div class="specs"><span>${I.area}${areaHTML(l)}</span>${l.floors ? `<span>${I.floors}${esc(l.floors)}</span>` : ''}</div>
      ${l.first && l.status !== 'sold' ? `<div class="plan-pay">${I.wallet} دفعة أولى ${money(l.first)} د.إ + ${l.inst.length} أقساط</div>` : ''}
      <div class="actions">
        <a class="btn call" href="tel:${CONTACT.phone}">${I.phone} اتصال</a>
        <a class="btn wa" href="${esc(waLink(landMsg(l)))}" data-ext>${I.wa} واتساب</a>
      </div>
    </div>
  </article>`;
}

function projectCard(p, wide) {
  return `<article class="card proj${wide ? ' wide' : ''}" data-project="${esc(p.slug)}">
    <div class="ph"><img loading="lazy" decoding="async" src="${esc(p.poster)}" alt="" onerror="this.style.opacity=0">
      <span class="badge av">${p.available} متاحة</span></div>
    <div class="body"><h3>${esc(p.name)}</h3>${p.sub ? `<div class="meta">${I.pin}<span>${esc(p.sub)}</span></div>` : ''}</div>
  </article>`;
}

/* incremental list rendering — keeps long lists smooth */
function renderList(container, items, render, empty) {
  container.innerHTML = '';
  if (!items.length) { container.innerHTML = `<div class="empty">${empty}</div>`; return; }
  let i = 0; const step = 24;
  const sentinel = document.createElement('div'); sentinel.className = 'sentinel';
  const more = () => {
    const html = items.slice(i, i + step).map(render).join('');
    sentinel.insertAdjacentHTML('beforebegin', html); i += step;
    if (i >= items.length) { io.disconnect(); sentinel.remove(); }
  };
  container.appendChild(sentinel);
  const io = new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: '800px' });
  more(); if (i < items.length) io.observe(sentinel);
}

/* ================= screens ================= */
const tabs = ['home', 'lands', 'projects', 'favs', 'contact'];
let current = 'home';

function skeleton(n = 3) { return Array.from({ length: n }, () => '<div class="card sk"><div class="ph"></div><div class="body"><i></i><i></i><i></i></div></div>').join(''); }

function renderHome() {
  const { projects, lands } = DATA();
  const av = lands.filter((l) => l.status === 'av');
  const featured = av.filter((l) => l.featured);
  const ofr = offerLands();
  const best = av.filter((l) => l.total).sort((a, b) => a.total - b.total).slice(0, 10);
  const cats = [...new Set(av.map((l) => l.cat))];
  const el = $('#home .content');
  el.innerHTML = `
    <section class="hero">
      <button class="bell" data-changes aria-label="التحديثات">${I.bell}<i id="bellN" hidden></i></button>
      <img class="hero-logo" src="${LOGO}" alt="عمر الياسي للعقارات">
      <p>أراضٍ ومشاريع في الشارقة بخطط سداد مرنة ومواقع استراتيجية</p>
      <button class="search-fake" data-go="lands" data-focus="1">${I.search}<span>ابحث برقم القطعة أو اسم المشروع…</span></button>
      <div class="stats">
        <div><b>${av.length || '—'}</b><span>أرض متاحة</span></div>
        <div><b>${projects.length || '—'}</b><span>مشروع</span></div>
        <div><b>${lands.filter((l) => l.status === 'sold').length || '—'}</b><span>تم بيعها</span></div>
      </div>
    </section>
    ${notifCard()}
    ${ofr.length ? `<div class="sec-h ofr-h"><h2>🔥 عروض لفترة محدودة</h2><button data-go="lands" data-offers="1">عرض الكل</button></div>
      <div class="hscroll lands">${ofr.map(landCard).join('')}</div>` : ''}
    ${cats.length ? `<div class="chips scroll">${cats.map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="sec-h"><h2>مشاريعنا</h2><button data-go="projects">عرض الكل</button></div>
    <div class="hscroll">${projects.length ? projects.map((p) => projectCard(p)).join('') : skeleton(2)}</div>
    ${featured.length ? `<div class="sec-h"><h2>أراضٍ مميزة</h2><button data-go="lands" data-feat="1">عرض الكل</button></div>
      <div class="hscroll lands">${featured.map(landCard).join('')}</div>` : ''}
    <div class="sec-h"><h2>أفضل الأسعار</h2><button data-go="lands" data-sort="price-asc">عرض الكل</button></div>
    <div class="list">${best.length ? best.slice(0, 6).map(landCard).join('') : (projects.length ? '<div class="empty">لا توجد أسعار معروضة حالياً</div>' : skeleton(2))}</div>
    <section class="cta">
      <div><h3>عندك أرض للبيع؟</h3><p>أضف أرضك ونتواصل معك لتسويقها</p></div>
      <button class="btn gold" data-web="${SITE}/add-property/">أضف أرضك</button>
    </section>`;
}

/* ---- lands with filters ---- */
const F = { q: '', project: '', status: 'av', cat: '', minA: '', maxA: '', minP: '', maxP: '', sort: 'default', feat: false, offers: false };
function filtered() {
  const q = F.q.trim();
  let a = DATA().lands.filter((l) =>
    (!F.status || l.status === F.status) && (!F.project || l.project === F.project) && (!F.cat || l.cat === F.cat) &&
    (!F.feat || l.featured) && (!F.offers || offerFor(l)) &&
    (!F.minA || l.ft >= +F.minA) && (!F.maxA || l.ft <= +F.maxA) &&
    (!F.minP || (l.total && l.total >= +F.minP)) && (!F.maxP || (l.total && l.total <= +F.maxP)) &&
    (!q || l.n.includes(q) || l.projectName.includes(q) || l.use.includes(q) || (l.tag && l.tag.includes(q))));
  const s = F.sort;
  const P = (l) => l.total || Infinity;
  if (s === 'price-asc') a.sort((x, y) => P(x) - P(y));
  else if (s === 'price-desc') a.sort((x, y) => (y.total || 0) - (x.total || 0));
  else if (s === 'area-desc') a.sort((x, y) => y.ft - x.ft);
  else if (s === 'area-asc') a.sort((x, y) => x.ft - y.ft);
  else a.sort((x, y) => (!!offerFor(y) - !!offerFor(x)) || (y.featured - x.featured) || (!!y.total - !!x.total));
  return a;
}
function activeFilterCount() {
  return ['project', 'cat', 'minA', 'maxA', 'minP', 'maxP'].filter((k) => F[k]).length + (F.status !== 'av') + (F.sort !== 'default') + F.feat + F.offers;
}
function renderLandsHead() {
  const { projects, lands } = DATA();
  const cats = [...new Set(lands.map((l) => l.cat))];
  const hasOfr = DATA().lands.some(offerFor);
  $('#lands .chips').innerHTML =
    `<button class="chip${!F.cat && !F.offers ? ' on' : ''}" data-fcat="">الكل</button>` +
    (hasOfr || F.offers ? `<button class="chip ofr${F.offers ? ' on' : ''}" data-foffers>🔥 العروض</button>` : '') +
    cats.map((c) => `<button class="chip${F.cat === c ? ' on' : ''}" data-fcat="${esc(c)}">${esc(c)}</button>`).join('');
  const n = activeFilterCount();
  $('#filterBtn .n').textContent = n || ''; $('#filterBtn').classList.toggle('has', !!n);
  $('#fProject').innerHTML = '<option value="">كل المشاريع</option>' + projects.map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('');
  $('#fProject').value = F.project;
}
function renderLands() {
  renderLandsHead();
  const items = filtered();
  $('#lands .count').textContent = DATA().lands.length ? `${items.length} أرض` : '';
  if (!DATA().lands.length) { $('#lands .list').innerHTML = skeleton(4); return; }
  renderList($('#lands .list'), items, landCard, `${I.empty}<p>لا توجد أراضٍ تطابق البحث</p><button class="btn ghost" data-reset>مسح الفلاتر</button>`);
}

function renderProjects() {
  const { projects } = DATA();
  $('#projects .list').innerHTML = projects.length ? projects.map((p) => projectCard(p, true)).join('') : skeleton(3);
}

function renderFavs() {
  const ids = favs.all(); const map = new Map(DATA().lands.map((l) => [l.id, l]));
  const items = ids.map((id) => map.get(id)).filter(Boolean);
  renderList($('#favs .list'), items, landCard, `${I.heart}<p>لم تضف أي أرض للمفضلة بعد</p><button class="btn ghost" data-go="lands">تصفح الأراضي</button>`);
}

function renderContact() {
  $('#contact .content').innerHTML = `
    <section class="about"><img src="${EMBLEM}" alt=""><h2>عمر الياسي للعقارات</h2><p>نساعدك في اختيار الأرض المناسبة للتطوير أو الاستثمار في الشارقة، بخيارات تنافسية وخطط سداد مرنة.</p></section>
    <div class="clist">
      <a class="citem" href="tel:${CONTACT.phone}">${I.phone}<div><b>اتصل بنا</b><span dir="ltr">${CONTACT.phoneLabel}</span></div></a>
      <a class="citem" href="${waLink('مرحباً، أرغب بالاستفسار عن الأراضي المتاحة')}" data-ext>${I.wa}<div><b>واتساب</b><span dir="ltr">${CONTACT.whatsappLabel}</span></div></a>
      <a class="citem" href="tel:${CONTACT.office}">${I.office}<div><b>هاتف المكتب</b><span dir="ltr">${CONTACT.officeLabel}</span></div></a>
      <a class="citem" href="mailto:${CONTACT.email}">${I.mail}<div><b>البريد الإلكتروني</b><span>${CONTACT.email}</span></div></a>
      <div class="citem">${I.pin}<div><b>العنوان</b><span>${CONTACT.address}</span></div></div>
    </div>
    <div class="social">
      <a href="${CONTACT.instagram}" data-ext>${I.ig} إنستغرام</a>
      <a href="${CONTACT.facebook}" data-ext>${I.fb} فيسبوك</a>
    </div>
    <div class="clist">
      <button class="citem" data-web="${SITE}/about-us/">${I.info}<div><b>من نحن</b><span>تعرّف على عمر الياسي</span></div></button>
      <button class="citem" data-web="${SITE}">${I.globe}<div><b>الموقع الإلكتروني</b><span>omaralyassirealestate.com</span></div></button>
    </div>
    <p class="ver">الإصدار 1.0</p>`;
}

/* ---- detail pages (pushed on top) ---- */
function projectPage(p) {
  const types = {};
  p.lands.filter((l) => l.status === 'av').forEach((l) => { const k = l.use + (l.tag ? ' · ' + l.tag : ''); (types[k] = types[k] || { c: l.color, n: 0 }).n++; });
  const av = p.lands.filter((l) => l.status === 'av').sort((a, b) => (!!offerFor(b) - !!offerFor(a)) || (b.featured - a.featured) || ((a.total || 9e12) - (b.total || 9e12)));
  return `<div class="hero-img" data-plan="${esc(p.plan)}"><img src="${esc(p.poster)}" alt=""><span class="open-plan">${I.map} افتح المخطط التفاعلي</span></div>
    <div class="pad">
      <h1>${esc(p.name)}</h1>${p.sub ? `<div class="meta">${I.pin}<span>${esc(p.sub)}</span></div>` : ''}
      <div class="stat3"><div class="av"><b>${p.available}</b>متاحة</div><div class="res"><b>${p.reserved}</b>محجوزة</div><div class="sold"><b>${p.sold}</b>مباعة</div></div>
      <div class="grid2">
        <button class="btn primary" data-plan="${esc(p.plan)}">${I.map} المخطط التفاعلي</button>
        ${p.loc ? `<a class="btn ghost" href="${esc(p.loc)}" data-ext>${I.pin} الموقع</a>` : ''}
        ${p.pdf ? `<a class="btn ghost" href="${esc(p.pdf)}" data-ext>${I.pdf} ملف المشروع PDF</a>` : ''}
        <a class="btn wa" href="${esc(waLink(`مرحباً، أرغب بالاستفسار عن مشروع ${p.name}\n${p.plan}`))}" data-ext>${I.wa} استفسر</a>
      </div>
      ${Object.keys(types).length ? `<h2 class="h2">الأنواع المتاحة</h2><div class="tlist">${Object.entries(types).map(([k, v]) => `<div>${dot(v.c)}<span>${esc(k)}</span><b>${v.n}</b></div>`).join('')}</div>` : ''}
      ${p.updated ? `<p class="upd">آخر تحديث للبيانات: <bdi>${esc(fmtDate(p.updated))}</bdi></p>` : ''}
      <h2 class="h2">الأراضي المتاحة (${av.length})</h2>
      <div class="list" id="projList"></div>
    </div>`;
}

function landPage(l) {
  const st = STATUS[l.status] || STATUS.av;
  const fav = favs.has(l.id);
  const sumInst = l.inst.reduce((a, x) => a + (+x[1] || 0), 0);
  const o = offerFor(l);
  const proj = DATA().projects.find((p) => p.slug === l.project);
  const loc = planLocHTML(l, proj && proj.map, esc);
  return `<div class="hero-img land${loc ? ' planloc' : ''}"${loc ? ` data-plan="${esc(landUrl(l))}"` : ''}>${loc || `<img src="${esc(l.img)}" alt="" onerror="this.style.opacity=0">`}
      ${loc ? `<span class="planloc-cap">${I.map} موقع القطعة في مخطط المشروع · اضغط للتكبير</span>` : ''}
      <span class="badge ${st.cls}">${st.label}</span>
      <button class="fav big${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="مفضلة">${I.heart}</button></div>
    <div class="pad">
      <div class="row between"><h1>قطعة رقم ${esc(l.n)}</h1>${l.featured && l.status === 'av' ? `<span class="badge star inline">${I.star} مميزة</span>` : ''}</div>
      <button class="meta link" data-project="${esc(l.project)}">${I.pin}<span>مشروع ${esc(l.projectName)}</span></button>
      <button class="btn wa block share-big" data-share="land:${esc(l.id)}">${I.wa} مشاركة التفاصيل + مخطط الأرض PDF</button>
      ${o ? `<div class="ofr-box"><b>🔥 عرض لفترة محدودة</b>${o.note ? `<span>${esc(o.note)}</span>` : ''}<div class="ofr-t2">⏳ <span data-until="${o.until}">${leftText(o.until)}</span> · حتى ${dmy(o.until)}</div></div>` : ''}
      <div class="pricebox">${priceHTML(l, true)}${l.ppf && l.status !== 'sold' ? `<span>سعر القدم ${money(l.ppf)} د.إ</span>` : ''}</div>
      <div class="spec-grid">
        <div>${I.tag}<span>الاستخدام</span><b>${esc(l.use || '—')}</b></div>
        <div>${I.area}<span>المساحة</span><b>${l.ft ? `${l.approx ? '≈ ' : ''}${money(l.ft)} قدم²` : '—'}</b><small>${l.m2 ? money(l.m2) + ' م²' : ''}</small></div>
        <div>${I.floors}<span>الارتفاع</span><b>${esc(l.floors || '—')}</b></div>
        <div>${I.pin}<span>${l.loc ? 'الموقع' : l.tag ? 'الأبعاد' : 'المشروع'}</span><b>${esc(l.loc || l.tag || l.projectName)}</b></div>
      </div>
      ${l.inst.length && l.status !== 'sold' ? `<h2 class="h2">خطة السداد</h2>
        <div class="inst"><div class="r head"><span>الدفعة الأولى</span><b>${money(l.first)} د.إ</b></div>
        ${l.inst.map((x, i) => `<div class="r"><span>القسط ${i + 1} · <bdi>${esc(fmtDate(x[0]))}</bdi></span><b>${money(x[1])} د.إ</b></div>`).join('')}
        <div class="r total"><span>الإجمالي</span><b>${money(l.first + sumInst)} د.إ</b></div></div>` : ''}
      ${l.sketch && l.sketch !== l.img ? `<h2 class="h2">كروكي القطعة</h2><img class="sketch" src="${esc(l.sketch)}" alt="" loading="lazy" data-web="${esc(l.sketch)}">` : ''}
      <button class="btn primary block" data-plan="${esc(landUrl(l))}">${I.map} عرض القطعة على المخطط</button>
      ${l.doc ? `<a class="btn ghost block" href="${esc(l.doc)}" data-ext>${I.pdf} مخطط القطعة (PDF)</a>` : ''}
    </div>
    <div class="bar">
      <a class="btn call" href="tel:${CONTACT.phone}">${I.phone} اتصال</a>
      <a class="btn wa" href="${esc(waLink(landMsg(l)))}" data-ext>${I.wa} واتساب</a>
    </div>`;
}

/* ================= navigation ================= */
const stack = [];   // open detail pages

function showTab(name, opts = {}) {
  if (!tabs.includes(name)) name = 'home';
  current = name;
  tabs.forEach((t) => { $('#' + t).hidden = t !== name; });
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  if (name === 'favs') renderFavs();
  if (name === 'lands' && opts.focus) setTimeout(() => $('#q').focus(), 60);
}

function pushPage(kind, id) {
  const d = DATA();
  let html = '', p, l;
  if (kind === 'project') { p = d.projects.find((x) => x.slug === id); if (!p) return; html = projectPage(p); }
  else if (kind === 'changes') { html = changesPage(); }
  else { l = d.lands.find((x) => x.id === id); if (!l) return; html = landPage(l); }
  const pg = document.createElement('section');
  pg.className = 'page' + (kind === 'land' ? ' has-bar' : '');
  pg.innerHTML = `<header class="top sub"><button class="back" data-back aria-label="رجوع">${I.back}</button><span>${kind === 'project' ? 'المشروع' : kind === 'changes' ? 'آخر التحديثات' : 'تفاصيل الأرض'}</span>${kind === 'changes' ? '' : `<button class="back share-top" data-share="${kind}:${esc(id)}" aria-label="مشاركة">${I.share}</button>`}</header><div class="scroller">${html}</div>`;
  document.body.appendChild(pg);
  if (p) renderList($('#projList', pg), p.lands.filter((x) => x.status === 'av').sort((a, b) => (!!offerFor(b) - !!offerFor(a)) || (b.featured - a.featured) || ((a.total || 9e12) - (b.total || 9e12))), landCard, 'لا توجد أراضٍ متاحة حالياً في هذا المشروع');
  push.render();
  requestAnimationFrame(() => pg.classList.add('in'));
  stack.push(pg);
  history.pushState({ depth: stack.length }, '');
}
function popPage() {
  const pg = stack.pop(); if (!pg) return false;
  pg.classList.remove('in'); pg.classList.add('out');
  setTimeout(() => pg.remove(), 260);
  return true;
}
window.addEventListener('popstate', () => { if (stack.length) popPage(); });

function goBack() {
  if ($('#sheet').classList.contains('open')) { closeSheet(); return; }
  if (stack.length) { history.back(); return; }
  if (current !== 'home') { showTab('home'); return; }
  App.exitApp();
}

/* ---- filter sheet ---- */
function openSheet() {
  $('#fStatus').value = F.status; $('#fSort').value = F.sort;
  ['minA', 'maxA', 'minP', 'maxP'].forEach((k) => { $('#f' + k).value = F[k]; });
  $('#fProject').value = F.project;
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); }
function applySheet() {
  F.status = $('#fStatus').value; F.sort = $('#fSort').value; F.project = $('#fProject').value;
  ['minA', 'maxA', 'minP', 'maxP'].forEach((k) => { F[k] = $('#f' + k).value.replace(/[^\d]/g, ''); });
  closeSheet(); renderLands(); $('#lands .scroller').scrollTop = 0;
}
function resetFilters() { Object.assign(F, { q: '', project: '', status: 'av', cat: '', minA: '', maxA: '', minP: '', maxP: '', sort: 'default', feat: false, offers: false }); $('#q').value = ''; renderLands(); }

/* ================= events ================= */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a, [data-land], [data-project], [data-plan], [data-web]');
  if (!t) return;
  const ds = t.dataset;
  if (ds.fav) { e.stopPropagation(); const on = favs.toggle(ds.fav); document.querySelectorAll(`[data-fav="${CSS.escape(ds.fav)}"]`).forEach((b) => b.classList.toggle('on', on)); toast(on ? 'أضيفت إلى المفضلة' : 'أزيلت من المفضلة'); if (current === 'favs' && !stack.length) renderFavs(); return; }
  if (t.tagName === 'A') {
    const href = t.getAttribute('href') || '';
    if (ds.ext !== undefined || /^https?:/.test(href)) { e.preventDefault(); openExternal(href); }
    return;  // tel: / mailto: handled by the system
  }
  if (ds.share) {
    e.stopPropagation();
    const [kind, ...rest] = ds.share.split(':'); const id = rest.join(':'); const d = DATA();
    if (kind === 'land') { const l = d.lands.find((x) => x.id === id); if (l) openShareSheet(l); }
    else { const p = d.projects.find((x) => x.slug === id); if (p) shareText(`مشروع ${p.name}`, projectShareText(p)); }
    return;
  }
  if (ds.notify !== undefined) { push.enable(); return; }
  if (ds.changes !== undefined) { pushPage('changes'); const top = getChanges()[0]; if (top) seen.set(top.t); updateBell(); return; }
  if (ds.back !== undefined) return goBack();
  if (ds.tab) {
    if (ds.tab === current && !stack.length) { const sc = $('#' + current + ' .scroller'); sc && sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    closeAll(); return showTab(ds.tab);
  }
  if (ds.plan) return openWeb(ds.plan);
  if (ds.web) return openWeb(ds.web);
  if (ds.reset !== undefined) return resetFilters();
  if (ds.go) {
    if (ds.go === 'lands') { resetFilters(); if (ds.sort) F.sort = ds.sort; if (ds.feat) F.feat = true; if (ds.offers) F.offers = true; renderLands(); }
    closeAll(); return showTab(ds.go, { focus: !!ds.focus });
  }
  if (ds.cat !== undefined && !ds.fcat) { resetFilters(); F.cat = ds.cat; renderLands(); closeAll(); return showTab('lands'); }
  if (ds.foffers !== undefined) { F.offers = !F.offers; renderLands(); return; }
  if (ds.fcat !== undefined) { F.cat = ds.fcat; F.offers = false; renderLands(); return; }
  if (ds.land) return pushPage('land', ds.land);
  if (ds.project) return pushPage('project', ds.project);
});
function closeAll() { const n = stack.length; if (n) { stack.splice(0).forEach((p) => p.remove()); history.go(-n); } }

let qT;
$('#q').addEventListener('input', (e) => { clearTimeout(qT); qT = setTimeout(() => { F.q = e.target.value; renderLands(); }, 180); });
$('#filterBtn').addEventListener('click', openSheet);
$('#scrim').addEventListener('click', closeSheet);
$('#applyF').addEventListener('click', applySheet);
$('#resetF').addEventListener('click', () => { resetFilters(); closeSheet(); });

/* pull to refresh on every tab */
document.querySelectorAll('.tab .scroller').forEach((sc) => {
  let y0 = null, dy = 0; const ind = sc.parentElement.querySelector('.ptr');
  sc.addEventListener('touchstart', (e) => { y0 = sc.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  sc.addEventListener('touchmove', (e) => {
    if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0);
    ind.style.transform = `translateY(${Math.min(dy, 90) - 50}px) rotate(${dy * 3}deg)`; ind.style.opacity = Math.min(1, dy / 70);
  }, { passive: true });
  sc.addEventListener('touchend', () => {
    if (y0 !== null && dy > 75) { ind.classList.add('spin'); refresh(true).finally(() => { ind.classList.remove('spin'); ind.style.cssText = ''; }); }
    else ind.style.cssText = '';
    y0 = null;
  });
});

/* ================= boot ================= */
function renderAll() {
  renderHome(); updateBell(); push.render(); renderLands(); renderProjects(); renderContact();
  if (current === 'favs') renderFavs();
}
let loading = null;
function refresh(force) {
  if (loading) return loading;
  const hadData = DATA().lands.length > 0;
  let raf = 0;
  loading = loadAll({ force, onPartial: hadData ? null : () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderAll); } })
    .then(() => loadChanges().catch(() => {}))
    .then(() => { renderAll(); })
    .catch(() => { if (!DATA().lands.length) { $('#home .content').innerHTML = `<div class="empty">${I.wifi}<p>تعذّر الاتصال بالإنترنت</p><button class="btn ghost" id="retry">إعادة المحاولة</button></div>`; $('#retry').onclick = () => refresh(true); } else toast('تعذّر التحديث — تُعرض آخر بيانات محفوظة'); })
    .finally(() => { loading = null; });
  return loading;
}

async function boot() {
  document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = I[el.dataset.i] + el.innerHTML; });
  if (loadFromCache()) renderAll(); else { renderHome(); renderLands(); renderProjects(); renderContact(); }
  showTab('home');
  if (native) {
    SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
    App.addListener('backButton', goBack);
    App.addListener('resume', () => { if (Date.now() - (DATA().at || 0) > 5 * 60e3) refresh(false); });
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}), 150);
  }
  if (!native) setupWebApp();
  push.init(); push.render();
  await refresh(false);
  if (location.hash === '#notify') { history.replaceState(null, '', location.pathname); setTimeout(() => push.enable(), 1200); }
  const hm = /^#land=(.+)$/.exec(location.hash);
  if (hm) { history.replaceState(null, '', location.pathname); openLandId(decodeURIComponent(hm[1])); }
  if (location.hash === '#updates') { history.replaceState(null, '', location.pathname); document.querySelector('[data-changes]')?.click(); }
}

/* Web / iPhone version: offline shell + "Add to Home Screen" hint */
function setupWebApp() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let seen = false; try { seen = !!localStorage.getItem('oay:a2hs'); } catch { /* ignore */ }
  if (!ios || standalone || seen) return;
  const b = document.createElement('div');
  b.className = 'a2hs';
  b.innerHTML = `<img src="assets/emblem.png" alt=""><div><b>ثبّت التطبيق على جوالك</b><span>اضغط زر المشاركة <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> في الأسفل ثم «إضافة إلى الشاشة الرئيسية»</span></div><button aria-label="إغلاق">✕</button>`;
  b.querySelector('button').onclick = () => { b.remove(); try { localStorage.setItem('oay:a2hs', '1'); } catch { /* ignore */ } };
  document.body.appendChild(b);
}
boot();
