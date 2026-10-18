import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { InAppBrowser, DefaultWebViewOptions, ToolbarPosition } from '@capacitor/inappbrowser';
import { SITE, CONTACT, LOGO, EMBLEM } from './config.js';
import { loadAll, loadFromCache, cached, favs, STATUS } from './data.js';
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

/* ---- sharing ---- */
function landShareText(l) {
  const lines = [`🏡 قطعة رقم ${l.n} — مشروع ${l.projectName}`];
  if (l.use) lines.push(`${l.use}${l.tag ? ' · ' + l.tag : ''}`);
  if (l.ft) lines.push(`📐 المساحة: ${l.approx ? '≈ ' : ''}${money(l.ft)} قدم² (${money(l.m2)} م²)`);
  if (l.floors) lines.push(`🏢 الارتفاع: ${l.floors}`);
  if (l.status === 'sold') lines.push('الحالة: مباعة');
  else lines.push(`💰 السعر: ${l.total ? money(l.total) + ' د.إ' : 'عند الاستفسار'}${l.status === 'res' ? ' (محجوزة)' : ''}`);
  if (l.first && l.status !== 'sold') lines.push(`💳 دفعة أولى ${money(l.first)} د.إ + ${l.inst.length} أقساط`);
  lines.push(`📍 على المخطط: ${landUrl(l)}`);
  lines.push(`📞 واتساب: ${CONTACT.whatsappLabel}`);
  lines.push('عمر الياسي للعقارات');
  return lines.join('\n');
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
  if (!l.total) return `<div class="price ask">السعر عند الاستفسار</div>`;
  return `<div class="price${big ? ' big' : ''}">${money(l.total)} <small>د.إ</small></div>`;
}
const areaHTML = (l) => l.ft ? `${l.approx ? '≈ ' : ''}${money(l.ft)} قدم² <span class="subt">(${money(l.m2)} م²)</span>` : '—';
const dot = (c) => `<i class="dot" style="background:rgb(${c.join(',')})"></i>`;

function landCard(l) {
  const st = STATUS[l.status] || STATUS.av;
  const fav = favs.has(l.id);
  return `<article class="card land" data-land="${esc(l.id)}">
    <div class="ph"><img loading="lazy" decoding="async" src="${esc(l.img)}" alt="" onerror="this.style.opacity=0">
      <span class="badge ${st.cls}">${st.label}</span>
      ${l.featured && l.status === 'av' ? `<span class="badge star">${I.star} مميزة</span>` : ''}
      <button class="fav${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="مفضلة">${I.heart}</button>
      <button class="fav sh" data-share="land:${esc(l.id)}" aria-label="مشاركة">${I.share}</button>
    </div>
    <div class="body">
      <div class="row between"><h3>قطعة رقم ${esc(l.n)}</h3>${priceHTML(l)}</div>
      <div class="type">${dot(l.color)}${esc(l.use)}${l.tag ? ` · ${esc(l.tag)}` : ''}</div>
      <div class="meta">${I.pin}<span>${esc(l.projectName)}</span></div>
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
  const best = av.filter((l) => l.total).sort((a, b) => a.total - b.total).slice(0, 10);
  const cats = [...new Set(av.map((l) => l.cat))];
  const el = $('#home .content');
  el.innerHTML = `
    <section class="hero">
      <img class="hero-logo" src="${LOGO}" alt="عمر الياسي للعقارات">
      <p>أراضٍ ومشاريع في الشارقة بخطط سداد مرنة ومواقع استراتيجية</p>
      <button class="search-fake" data-go="lands" data-focus="1">${I.search}<span>ابحث برقم القطعة أو اسم المشروع…</span></button>
      <div class="stats">
        <div><b>${av.length || '—'}</b><span>أرض متاحة</span></div>
        <div><b>${projects.length || '—'}</b><span>مشروع</span></div>
        <div><b>${lands.filter((l) => l.status === 'sold').length || '—'}</b><span>تم بيعها</span></div>
      </div>
    </section>
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
const F = { q: '', project: '', status: 'av', cat: '', minA: '', maxA: '', minP: '', maxP: '', sort: 'default', feat: false };
function filtered() {
  const q = F.q.trim();
  let a = DATA().lands.filter((l) =>
    (!F.status || l.status === F.status) && (!F.project || l.project === F.project) && (!F.cat || l.cat === F.cat) &&
    (!F.feat || l.featured) &&
    (!F.minA || l.ft >= +F.minA) && (!F.maxA || l.ft <= +F.maxA) &&
    (!F.minP || (l.total && l.total >= +F.minP)) && (!F.maxP || (l.total && l.total <= +F.maxP)) &&
    (!q || l.n.includes(q) || l.projectName.includes(q) || l.use.includes(q) || (l.tag && l.tag.includes(q))));
  const s = F.sort;
  const P = (l) => l.total || Infinity;
  if (s === 'price-asc') a.sort((x, y) => P(x) - P(y));
  else if (s === 'price-desc') a.sort((x, y) => (y.total || 0) - (x.total || 0));
  else if (s === 'area-desc') a.sort((x, y) => y.ft - x.ft);
  else if (s === 'area-asc') a.sort((x, y) => x.ft - y.ft);
  else a.sort((x, y) => (y.featured - x.featured) || (!!y.total - !!x.total));
  return a;
}
function activeFilterCount() {
  return ['project', 'cat', 'minA', 'maxA', 'minP', 'maxP'].filter((k) => F[k]).length + (F.status !== 'av') + (F.sort !== 'default') + F.feat;
}
function renderLandsHead() {
  const { projects, lands } = DATA();
  const cats = [...new Set(lands.map((l) => l.cat))];
  $('#lands .chips').innerHTML =
    `<button class="chip${!F.cat ? ' on' : ''}" data-fcat="">الكل</button>` +
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
  const av = p.lands.filter((l) => l.status === 'av').sort((a, b) => (b.featured - a.featured) || ((a.total || 9e12) - (b.total || 9e12)));
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
  return `<div class="hero-img land"><img src="${esc(l.img)}" alt="" onerror="this.style.opacity=0">
      <span class="badge ${st.cls}">${st.label}</span>
      <button class="fav big${fav ? ' on' : ''}" data-fav="${esc(l.id)}" aria-label="مفضلة">${I.heart}</button></div>
    <div class="pad">
      <div class="row between"><h1>قطعة رقم ${esc(l.n)}</h1>${l.featured && l.status === 'av' ? `<span class="badge star inline">${I.star} مميزة</span>` : ''}</div>
      <button class="meta link" data-project="${esc(l.project)}">${I.pin}<span>مشروع ${esc(l.projectName)}</span></button>
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
      <button class="btn ghost block" data-share="land:${esc(l.id)}">${I.share} مشاركة تفاصيل الأرض</button>
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
  else { l = d.lands.find((x) => x.id === id); if (!l) return; html = landPage(l); }
  const pg = document.createElement('section');
  pg.className = 'page' + (kind === 'land' ? ' has-bar' : '');
  pg.innerHTML = `<header class="top sub"><button class="back" data-back aria-label="رجوع">${I.back}</button><span>${kind === 'project' ? 'المشروع' : 'تفاصيل الأرض'}</span><button class="back share-top" data-share="${kind}:${esc(id)}" aria-label="مشاركة">${I.share}</button></header><div class="scroller">${html}</div>`;
  document.body.appendChild(pg);
  if (p) renderList($('#projList', pg), p.lands.filter((x) => x.status === 'av').sort((a, b) => (b.featured - a.featured) || ((a.total || 9e12) - (b.total || 9e12))), landCard, 'لا توجد أراضٍ متاحة حالياً في هذا المشروع');
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
function resetFilters() { Object.assign(F, { q: '', project: '', status: 'av', cat: '', minA: '', maxA: '', minP: '', maxP: '', sort: 'default', feat: false }); $('#q').value = ''; renderLands(); }

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
    if (kind === 'land') { const l = d.lands.find((x) => x.id === id); if (l) shareText(`قطعة رقم ${l.n}`, landShareText(l)); }
    else { const p = d.projects.find((x) => x.slug === id); if (p) shareText(`مشروع ${p.name}`, projectShareText(p)); }
    return;
  }
  if (ds.back !== undefined) return goBack();
  if (ds.tab) {
    if (ds.tab === current && !stack.length) { const sc = $('#' + current + ' .scroller'); sc && sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    closeAll(); return showTab(ds.tab);
  }
  if (ds.plan) return openWeb(ds.plan);
  if (ds.web) return openWeb(ds.web);
  if (ds.reset !== undefined) return resetFilters();
  if (ds.go) {
    if (ds.go === 'lands') { resetFilters(); if (ds.sort) F.sort = ds.sort; if (ds.feat) F.feat = true; renderLands(); }
    closeAll(); return showTab(ds.go, { focus: !!ds.focus });
  }
  if (ds.cat !== undefined && !ds.fcat) { resetFilters(); F.cat = ds.cat; renderLands(); closeAll(); return showTab('lands'); }
  if (ds.fcat !== undefined) { F.cat = ds.fcat; renderLands(); return; }
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
  renderHome(); renderLands(); renderProjects(); renderContact();
  if (current === 'favs') renderFavs();
}
let loading = null;
function refresh(force) {
  if (loading) return loading;
  const hadData = DATA().lands.length > 0;
  let raf = 0;
  loading = loadAll({ force, onPartial: hadData ? null : () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderAll); } })
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
  await refresh(false);
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
