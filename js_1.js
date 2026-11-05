
(function () {
'use strict';
/* The page keeps three data blocks: "assets" (images), "plan" (plot geometry, fixed) and "state" (what the admin edits).
   Saving regenerates the whole document from these blocks and publishes it as the new version. */
const $ = id => document.getElementById(id);
const read = id => $(id).textContent;
const A = JSON.parse(read('assets')), D = JSON.parse(read('plan'));
let state = JSON.parse(read('state'));
let savedJson = JSON.stringify(state);
/* What differs between projects comes with the plan data (D.cfg); without it the page is the first project, الدبدبة شمال. */
const CFG = D.cfg || {};
const PROJECT = CFG.name || 'الدبدبة شمال', PLACE = CFG.sub || 'حدود الشارقة / عجمان', FILE = CFG.file || 'Dabdaba-North';
/* Website mode: the page is served by the site itself, which stores the state and says who may edit it. */
const SITE = window.DN_SITE || null;
/* Shown inside one of the site's own pages (in a frame): the site's header is already there, and editing is done on the full page. */
const EMBED = !!SITE && /[?&]embed=1(&|$)/.test(location.search);
if (EMBED) document.documentElement.classList.add('embed');
/* Opened to hand over the whole plan as a PDF (the «تحميل ملف المشروع» button on the site's project page): made as soon as the page is ready. */
/* The way back for a visitor who opened the plan as a page of its own: the page of the site they came from,
   or — arriving from elsewhere — the project's page on the site. Inside the site's own frame the site shows its own button. */
const BACK = (() => {
  if (!SITE || EMBED) return '';
  try {
    const u = new URL(document.referrer);
    if (u.origin === location.origin && u.pathname !== location.pathname && !/^\/wp-(admin|login)/.test(u.pathname)) return u.href;
  } catch (err) {}
  return /^https?:\/\/[^\s"<>]+$/.test(SITE.back || '') ? SITE.back : '';
})();
const PDF_AUTO = !!SITE && /[?&]pdf=1(&|$)/.test(location.search);
/* Where a visitor is sent to ask about a plot when the project shows no contact number: the site's own contact page. */
const CONTACT = SITE && /^https?:\/\/[^\s"<>]+$/.test(SITE.contact || '') ? SITE.contact : '';
let siteNonce = '', siteRev = SITE ? (SITE.rev | 0) : 0, logoImg = null, siteUpload = false, siteMax = 0;
/* The company logo: the site hands over its address, the stand-alone page carries it inside the assets block. */
const LOGO = String((SITE && SITE.logo) || A.logo || '').replace(/[&<>"]/g, '');

const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 5.3l6.7 6.7-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>';   // points the way back in a right-to-left page
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z"/></svg>';

const SHELL = `
<div class="app" dir="rtl" lang="ar">
  <header class="bar">
    <a class="hbtn back" id="backBtn" hidden>${ARROW}<span>العودة</span></a>
    <div class="ttl">
      <h1>مخطط ${PROJECT}</h1>
      <div class="sub">${PLACE}<span class="ver"> · آخر تحديث <span class="num" id="upd"></span></span></div>
    </div>
    <div class="acts">
      <a class="hbtn" id="locBtn" target="_blank" rel="noopener" aria-label="موقع المشروع على خرائط Google">${PIN}<span>موقع المشروع</span></a>
      <button type="button" class="hbtn" id="adminBtn" aria-pressed="false" hidden>${GEAR}<span>إدارة</span></button>
    </div>
    <div class="firm${LOGO ? ' has-logo' : ''}">${LOGO ? `<img class="sitelogo bare" src="${LOGO}" alt="عمر الياسي للعقارات – Omar Al Yassi Real Estate">` : ''}<span>عمر الياسي للعقارات<small>Omar Al Yassi Real Estate</small></span></div>
  </header>

  <div class="adminbar" id="adminbar" hidden>
    <b>وضع الإدارة</b>
    <span class="st" id="adminSt"></span>
    <button type="button" class="btn primary" id="saveBtn">${SITE ? 'حفظ' : 'حفظ ونشر'}</button>
    ${SITE ? '<button type="button" class="btn" id="quietBtn" title="يحفظ التعديلات دون إرسال إشعار لمستخدمي التطبيق">حفظ بدون إشعار</button>' : ''}
    <button type="button" class="btn" id="undoBtn" title="تراجع عن آخر تعديل (Ctrl+Z)">↶ تراجع خطوة</button>
    <button type="button" class="btn" id="revertBtn">إلغاء كل التعديلات</button>
    <button type="button" class="btn" id="exitBtn">خروج</button>
    <span class="err" id="adminErr" role="alert" hidden></span>
    <span class="vertag">نسخة 2.49.1</span>
  </div>

  <div class="tools">
    <div class="search"><input id="q" type="search" inputmode="numeric" autocomplete="off" placeholder="ابحث برقم القطعة" aria-label="ابحث برقم القطعة"></div>
    <div class="seg" id="statusSeg" role="group" aria-label="الحالة">
      <button type="button" data-v="all" aria-pressed="true">الكل</button>
      <button type="button" data-v="av" aria-pressed="false"><i class="dot av"></i>متاح</button>
      <button type="button" data-v="res" aria-pressed="false"><i class="dot res"></i>محجوز</button>
      <button type="button" data-v="sold" aria-pressed="false"><i class="dot sold"></i>مباع</button>
    </div>
    <select id="areaSel" aria-label="المساحة">
      <option value="all">كل المساحات</option>
      <option value="0-2600">حتى 2,600 قدم²</option>
      <option value="2600-3000">2,600 – 3,000 قدم²</option>
      <option value="3000-4000">3,000 – 4,000 قدم²</option>
      <option value="4000-99999">أكثر من 4,000 قدم²</option>
    </select>
    <span class="msg" id="msg" role="status"></span>
    <span class="count" id="count"></span>
  </div>

  <main class="work">
    <aside class="panel" id="panel" data-open="false" aria-label="تفاصيل القطع">
      <button type="button" class="sheet-handle" id="handle" aria-expanded="false"><span id="handleText"></span><span class="chev" id="chev">عرض</span></button>
      <div class="panel-body" id="body"></div>
    </aside>
    <section class="map" id="map" aria-label="المخطط">
      <div class="stage" id="stage" data-z="0">
        <img id="bg" alt="" width="${D.w}" height="${D.h}">
        <canvas id="ink"></canvas>
        <svg id="svg" width="${D.w}" height="${D.h}" viewBox="0 0 ${D.w} ${D.h}" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
      <div class="zoom">
        <button type="button" id="zin" aria-label="تكبير">+</button>
        <button type="button" id="zout" aria-label="تصغير">−</button>
        <button type="button" id="zfit" class="wide" aria-label="عرض المخطط كاملًا">كامل</button>
        <button type="button" id="zpdf" class="wide" aria-label="تحميل المخطط كاملًا PDF">PDF</button>
      </div>
      <div class="hint">اسحب للتحريك · العجلة للتكبير · انقر على القطعة</div>
      <div class="tip" id="tip" hidden><img id="tipImg" alt="" hidden><div id="tipText"></div></div>
    </section>
  </main>
  <div class="lightbox" id="lightbox" hidden><img id="lbImg" alt=""><p id="lbCap"></p></div>
  <div class="filebox" id="sharebox" hidden><div class="fb-in" role="dialog" aria-label="مشاركة البطاقة">
    <p class="fb-msg" id="shTitle"></p>
    <button type="button" class="wa sh-send" id="shSend" disabled>مشاركة عبر الواتس أب…</button>
    <p class="help sh-sendhelp" id="shSendHelp"></p>
    <a class="btn" id="shWa" target="_blank" rel="noopener">مشاركة التفاصيل كنص فقط</a>
    <a class="btn" id="shPdf" hidden>تحميل ملف المخطط PDF</a>
    <div class="two"><button type="button" class="btn" id="shCopy">نسخ نص التفاصيل</button><button type="button" class="btn" id="shLink">نسخ رابط القطعة</button></div>
    <button type="button" class="btn primary" id="shNative" hidden>مشاركة البطاقة كصورة…</button>
    <p class="help" id="shHelp">جارٍ تجهيز صورة البطاقة…</p>
    <div class="fb-img"><div class="shot"><img id="shImg" alt="بطاقة القطعة" hidden><div id="shSpots"></div></div></div>
    <textarea id="shText" class="sh-text" readonly hidden aria-label="نص البطاقة"></textarea>
    <button type="button" class="btn" id="shClose">إغلاق</button>
  </div></div>
  <div class="filebox" id="filebox" hidden><div class="fb-in" role="dialog" aria-label="ملف PDF">
    <p class="fb-msg" id="fbMsg"></p>
    <div class="two" id="fbActs"></div>
    <div class="fb-img"><div class="shot"><img id="fbImg" alt="معاينة الملف"><div id="fbSpots"></div></div></div>
    <button type="button" class="btn" id="fbClose">إغلاق</button>
  </div></div>
  <div class="filebox" id="planbox" hidden><div class="fb-in pb-in" role="dialog" aria-label="تجهيز مخطط الأرض">
    <p class="fb-msg" id="pbTitle"></p>
    <p class="help">حدّد الجزء الذي يظهر فيه رسم القطعة: اسحب الإطار لتحريكه أو اسحب زواياه لتغيير حجمه. يُنشر هذا الجزء فقط، لا الصفحة كاملة.</p>
    <div class="pb-nav"><button type="button" class="btn" id="pbPrev" aria-label="الصفحة السابقة">‹</button><span id="pbPage"></span><button type="button" class="btn" id="pbNext" aria-label="الصفحة التالية">›</button><button type="button" class="btn" id="pbAuto">اقتصاص تلقائي</button></div>
    <div class="pb-wrap"><div class="pb-stage" id="pbStage"><canvas id="pbCanvas"></canvas><div class="pb-crop" id="pbCrop"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
    <label class="chk"><input type="checkbox" id="pbLast"> <span id="pbLastText"></span></label>
    <p class="adminerr" id="pbErr" hidden></p>
    <div class="two"><button type="button" class="btn" id="pbCancel">إلغاء</button><button type="button" class="btn primary" id="pbOk">اعتماد ورفع</button></div>
  </div></div>
  <div class="filebox" id="pzbox" hidden><div class="fb-in pz-in" role="dialog" aria-label="تصميم إعلان">
    <p class="fb-msg" id="pzTitle"></p>
    <div class="pz-wrap"><div class="pz-prev"><canvas id="pzCv" width="1600" height="2000"></canvas></div><div class="pz-form" id="pzForm"></div></div>
    <div class="pz-acts"><button type="button" class="btn" id="pzClose">إغلاق</button><button type="button" class="btn" id="pzSave">💾 حفظ التصميم</button><button type="button" class="btn" id="pzAll">تحميل بكل القوالب (ZIP)</button><button type="button" class="btn primary" id="pzDl">تحميل الإعلان JPEG</button></div>
  </div></div>
  <div class="filebox" id="pzCropBox" hidden><div class="fb-in pzc-in" role="dialog" aria-label="قصّ الصورة">
    <p class="fb-msg">اسحب على الصورة لتحديد الجزء الذي يظهر في الإعلان</p>
    <div class="pb-nav" id="pzCropNav"></div>
    <div class="pzc-wrap"><canvas id="pzCropCv"></canvas></div>
    <div class="two"><button type="button" class="btn" id="pzCropNo">إلغاء</button><button type="button" class="btn primary" id="pzCropOk">اعتماد القص</button></div>
  </div></div>
  <input type="file" id="pzFile" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" hidden>
  <input type="file" id="landFile" accept="application/pdf,.pdf" hidden>
  <input type="file" id="upFile" hidden>
  <div class="toast" id="toast" role="status" hidden></div>
</div>`;
$('root').innerHTML = SHELL;
/* The aerial photo. A site's CDN may shrink and re-encode pictures on the way (seen: 3750 px wide delivered as 1600), so the site
   also offers the same file under a neutral name that is passed through untouched; the page turns those bytes back into a picture. */
const bgReady = (async () => {
  let src = A.bg;
  if (A.bgRaw) {
    try {
      const r = await fetch(A.bgRaw); if (!r.ok) throw new Error('bg');
      const b = await r.arrayBuffer(), u = new Uint8Array(b, 0, 2); if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error('bg');
      src = URL.createObjectURL(new Blob([b], {type: 'image/jpeg'}));
    } catch (err) { src = A.bg; }
  }
  const el = $('bg');
  await new Promise(done => { el.onload = el.onerror = done; el.src = src; setTimeout(done, 15000); });
})();

/* Plot types, keyed by the colour they have on the plan: use, floors, `tag` (what sets the type apart, shown beside the use),
   `loc` (the «الموقع» line of a plot), `b` (which default building picture applies), `sizes` (typical sizes) and `c` (the colour). */
const TYPES = CFG.types || {
  magenta:{use:'تجاري سكني', floors:'أرضي + اثنين', loc:'عادية', b:'reg', c:[255,20,147], sizes:['15.0 × 15.0 م / 2,422 قدم²','16.0 × 26.0 م / 4,478 قدم²','20.0 × 25.8 م / 5,554 قدم²']},
  gold:{use:'تجاري سكني', floors:'أرضي + اثنين', tag:'زاوية', loc:'زاوية', b:'cor', c:[218,165,32], sizes:['15.0 × 16.0 م / 2,583 قدم²']},
  yellow:{use:'تجاري سكني', floors:'أرضي + اثنين', tag:'زاوية', loc:'زاوية', b:'cor', c:[255,255,0], sizes:['15.0 × 15.0 م / 2,422 قدم²','17.0 × 28.0 م / 5,123 قدم²']},
  khaki:{use:'تجاري سكني', floors:'أرضي + اثنين', loc:'عادية', b:'reg', c:[240,230,140], sizes:['15.0 × 15.0 م / 2,422 قدم²','17.0 × 28.0 م / 5,123 قدم²']},
  salmon:{use:'تجاري مكاتب سكني', floors:'أرضي + اثنين', tag:'زاوية', loc:'زاوية', b:'cor', c:[240,128,128], sizes:['18.0 × 15.0 م / 2,906 قدم²']},
  darkred:{use:'تجاري مكاتب سكني', floors:'أرضي + اثنين', loc:'عادية', b:'reg', c:[178,34,34], light:1, sizes:['18.0 × 15.0 م / 2,906 قدم²']},
  red:{use:'محلات تجارية', floors:'أرضي فقط', c:[255,0,0], light:1, sizes:[]}
};
const TYPE_ORDER = CFG.order || ['salmon','darkred','gold','magenta','yellow','khaki','red'];
const BLD_KINDS = CFG.bld || [['reg', 'قطعة عادية'], ['cor', 'قطعة زاوية']];
const typeLabel = t => TYPES[t].use + (TYPES[t].tag ? ' · ' + TYPES[t].tag : '');
(function typeStyles() {   // colours of the types, for the stand-in plan shown if the drawing cannot be loaded
  const el = document.createElement('style');
  el.textContent = Object.keys(TYPES).map(t => `.novec .t-${t} polygon{fill:rgb(${TYPES[t].c.join(',')})}` + (TYPES[t].light ? `.novec .t-${t} text{fill:#fff}` : '')).join('');
  document.head.appendChild(el);
})();
const ST = {av:'متاح', res:'محجوز', sold:'مباع'};
const ORDER = ['av','res','sold'];
const fmt = n => Number(n).toLocaleString('en-US', {maximumFractionDigits: 2});
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dstr = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? m[1] + '/' + (+m[2]) + '/' + (+m[3]) : ''; };

const plots = D.plots;
/* every plot is stored under its key; the number shown is the key, unless the plan marks it as a repeated number («1234*»)
   or the admin has given it its proper number (`lb` in the state) */
plots.forEach(p => { p.key = p.n; p.lb0 = p.lb || ''; delete p.n; delete p.lb; Object.defineProperty(p, 'n', {get() { const e = state.plots[p.key]; return (e && e.lb) || p.lb0 || p.key; }}); });
const byKey = new Map(plots.map((p, i) => [p.key, i]));
function noIndex(v) {
  v = String(v == null ? '' : v); if (!v) return -1;
  let i = plots.findIndex(p => p.n === v); if (i >= 0) return i;
  if (byKey.has(v)) return byKey.get(v);
  i = plots.findIndex(p => p.n === v + '*'); if (i >= 0) return i;
  return plots.findIndex(p => p.n === '#' + v);
}
const byNo = {has: v => noIndex(v) >= 0, get: v => noIndex(v)};
const sale = plots.filter(p => !p.am);
/* A plot's area comes from the plan; the admin may replace it with the official figure (kept in the state as `ft`, square feet). */
const FT2 = 10.7639;
plots.forEach(p => { p.ft0 = p.ft; p.m20 = p.m2; p.ap0 = p.ap; });
function applyAreas() {
  plots.forEach(p => { const e = state.plots[p.key], f = !p.am && e && e.ft > 0 ? e.ft : 0; p.ft = f || p.ft0; p.m2 = f ? Math.round(f / FT2 * 10) / 10 : p.m20; p.ap = f ? 0 : p.ap0; });
}
applyAreas();
const view = {s:1, tx:0, ty:0, sel:null, status:'all', area:'all', type:null};
let canAdmin = false, admin = false, designer = false, pdLink = '';
/* the manager's own link (…/?pd=key): posts in «قالب عمر الياسي» only, nothing else of the admin's tools */
const DES_KEY = (() => { try { return new URLSearchParams(location.search).get('pd') || ''; } catch (err) { return ''; } })();
const DES_THEMES = ['oy'];

/* ---------- state readers ---------- */
const ent = p => state.plots[p.key] || null;
const statusOf = p => { const e = ent(p); return e && e.s ? e.s : null; };
const TODAY = (() => { try { return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Dubai'}).format(new Date()); } catch (err) { return new Date().toISOString().slice(0, 10); } })();
function priceOf(p) {
  const e = ent(p); if (!e || !(e.total > 0)) return null;
  const inst = (e.inst || []).filter(x => String(x[0]) > TODAY).map(x => ({d: x[0], a: +x[1] || 0}));   // an instalment due today or earlier is paid: it counts in the down payment
  return {ppf: e.ppf || 0, total: e.total, inst, down: e.total - inst.reduce((s, x) => s + x.a, 0)};
}
const kindOf = p => p.am ? '' : TYPES[p.t].loc || '';
const bldOf = p => p.am ? null : TYPES[p.t].b || null;
const BLD_NAME = Object.fromEntries(BLD_KINDS);
const fileUrl = f => f && typeof f.u === 'string' && /^https?:\/\/[^\s"<>]+$/.test(f.u) ? f.u : '';
/* The building picture shown for a plot: its own picture if the admin gave it one, otherwise the default for its kind
   (which the admin may also have replaced or removed). `fallback` is the built-in picture to use if an uploaded one fails to load. */
function defaultBld(k) {
  if (!k) return null;
  const g = state.bld && state.bld[k];
  if (g && g.off) return null;
  return fileUrl(g) ? {src: fileUrl(g), fallback: A[k] || '', own: true} : A[k] ? {src: A[k]} : null;
}
function bldPic(p) {
  if (p.am) return null;
  const e = ent(p);
  if (e && e.noimg) return null;
  if (e && fileUrl(e.img)) { const d = defaultBld(bldOf(p)); return {src: fileUrl(e.img), fallback: d ? d.fallback || d.src : '', own: true}; }
  return defaultBld(bldOf(p));
}
const docOf = p => { const e = ent(p); return e && fileUrl(e.doc) ? e.doc : null; };
/* the plot's plan prepared by the admin: `sk` the sketch cut out of the uploaded document, `last` its last page (planning conditions) */
/* the plot's land document as the admin uploaded it (usually: payments page, official site plan, planning conditions).
   Its pages are drawn here for viewing; the PDF button hands out the file itself, unchanged. */
const docPages = {};
function docRender(doc, width) {
  const key = doc.u + '@' + width;
  return docPages[key] || (docPages[key] = (async () => {
    const L = await loadPdfjs(), d = await L.getDocument({url: doc.u}).promise, out = [];
    for (let i = 1; i <= Math.min(d.numPages, 6); i++) {
      const pg = await d.getPage(i), v0 = pg.getViewport({scale: 1}), vp = pg.getViewport({scale: width / v0.width});
      const [cv, c] = canvas(Math.round(vp.width), Math.round(vp.height), '#fff'); await pg.render({canvasContext: c, viewport: vp}).promise; out.push(cv);
    }
    out.n = d.numPages; return out;
  })().catch(err => { delete docPages[key]; throw err; }));
}
const docPlanPage = pages => pages[pages.length >= 2 ? 1 : 0];   // the official plan: second page when the file opens with the payments page
async function docFile(p) {
  const doc = docOf(p), r = await fetch(doc.u, {credentials: 'same-origin'});
  if (!r.ok) throw new Error('doc');
  const blob = await r.blob(), pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], {type: 'application/pdf'});
  return {pdf, spots: [], preview: async () => { const pages = await docRender(doc, 1400); return new Blob([(await jpegOf(pages[0], 0.88)).bytes], {type: 'image/jpeg'}); }};
}
const planOf = p => { const e = ent(p); return e && e.plan && fileUrl(e.plan.sk) ? {sk: e.plan.sk, last: fileUrl(e.plan.last) ? e.plan.last : null} : null; };
const offered = () => plots.filter(p => statusOf(p)).sort((a, b) => ORDER.indexOf(statusOf(a)) - ORDER.indexOf(statusOf(b)) || parseInt(a.n, 10) - parseInt(b.n, 10));
/* the number to contact: the plot's own if the admin gave it one, otherwise the general one */
const phoneOf = p => { const e = p ? ent(p) : null; return String((e && e.ph) || state.phone || ''); };
const phoneShown = p => phoneOf(p).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
function waNumber(p) { let d = phoneOf(p).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '971' + d.slice(1); return d; }
/* a project (or a plot) may show no number at all: every WhatsApp button and every «للاستفسار» line then goes away */
const hasPhone = p => waNumber(p).length >= 7;
const plotLoc = p => { const e = p ? ent(p) : null; return e && /^https:\/\/[^\s"<>]+$/.test(e.lo || '') ? e.lo : ''; };   // the plot's own map link, if the admin gave one
const locUrl = () => /^https:\/\/[^\s"<>]+$/.test(state.loc || '') ? state.loc : '';

/* ---------- build the plan ---------- */
const svg = $('svg'), stage = $('stage'), map = $('map');
const plotClass = p => 'pl t-' + p.t + (statusOf(p) ? ' s-' + statusOf(p) : '') + (p.am ? ' am' + (p.big || p.n === '4959' || p.n === '4763' ? ' big' : '') : '');
const line2 = p => p.am ? p.n : (statusOf(p) === 'res' || statusOf(p) === 'sold' ? ST[statusOf(p)] : fmt(p.ft));
(function build() {
  let h = '';
  plots.forEach((p, i) => {
    const k = p.am && (p.big || p.n === '4959' || p.n === '4763') ? 2.6 : 1;
    h += `<g class="${plotClass(p)}" data-i="${i}"><polygon points="${p.p.map(q => q.join(',')).join(' ')}"/>` +
         `<g transform="translate(${p.c[0]} ${p.c[1]}) rotate(${p.r}) scale(${k})"><text class="n" y="0.7">${esc(p.am || p.n)}</text><text class="a" y="${p.am ? 4.6 : 4.1}">${esc(line2(p))}</text></g></g>`;
  });
  h += '<polygon id="hl1" points=""/><polygon id="hl2" points=""/><g id="pins"></g>';
  svg.innerHTML = h;
})();
const groups = [...svg.querySelectorAll('.pl')];
let pins = [];
function rebuildPins() {
  $('pins').innerHTML = offered().map(p => `<circle class="pin ${statusOf(p)}" cx="${p.c[0]}" cy="${p.c[1]}" r="5"/>`).join('');
  pins = [...$('pins').children]; sizePins();
}
function sizePins() { const r = 5.5 / view.s, w = 1.6 / view.s; pins.forEach(c => { c.setAttribute('r', r); c.setAttribute('stroke-width', w); }); }
function refreshPlot(i) {
  const p = plots[i], g = groups[i], dim = g.classList.contains('dim');
  g.setAttribute('class', plotClass(p) + (dim ? ' dim' : ''));
  g.querySelector('.a').textContent = line2(p);
  const t = g.querySelector('.n'); if (t && !p.am && t.textContent !== p.n) t.textContent = p.n;
}
stage.style.width = D.w + 'px'; stage.style.height = D.h + 'px';

/* ---------- the drawing itself ----------
   Streets, plot outlines, dimensions and every label are kept as vector paths (taken from the developer's plan), so they stay
   sharp at any zoom and in the PDF. Only the aerial photo underneath is a picture. */
const VS = (D.vs || []).map(s => Object.assign({css: 'rgb(' + s.c.join(',') + ')'}, s)), VQ = D.vq || 50;
/* For the black-and-white plot sketch: lettering and line work stay (in dark ink), the coloured fills of the blocks are left out. */
VS.forEach(s => {
  const [r, g, b] = s.c, dark = r < 110 && g < 110;
  if (s.t === 'f') s.mono = dark && !s.h ? '#151515' : null;   // `h` on a fill: a dark area (street, park, parking) rather than lettering
  else s.mono = s.o ? '#1b1b1b' : s.h || (s.w >= 1.4 && !dark) ? null : dark ? '#1b1b1b' : (r < 40 && g > 220 && b > 220) ? '#93A5AE' : (r > 200 && g > 200 && b > 200) ? '#C9CED4' : '#7A7A7A';
});
let V = null;
function decodeVec(buf) {
  const u = new Uint8Array(buf); let i = 0;
  const uv = () => { let r = 0, m = 1, b; do { b = u[i++]; r += (b & 127) * m; m *= 128; } while (b & 128); return r; };
  const n = uv(), nOps = uv(), nPts = uv();
  const st = new Uint8Array(n), o0 = new Uint32Array(n + 1), p0 = new Uint32Array(n + 1), bb = new Float32Array(n * 4), ops = new Uint8Array(nOps), xy = new Float32Array(nPts * 2);
  let x = 0, y = 0, oi = 0, pi = 0;
  for (let k = 0; k < n; k++) {
    st[k] = uv(); o0[k] = oi; p0[k] = pi;
    let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
    for (let runs = uv(); runs > 0; runs--) {
      const h = uv(), code = h & 3, pts = code === 2 ? 3 : code === 3 ? 0 : 1;
      for (let c = h >> 2; c > 0; c--) {
        ops[oi++] = code;
        for (let q = 0; q < pts; q++) {
          let a = uv(); x += a & 1 ? -(a + 1) / 2 : a / 2; a = uv(); y += a & 1 ? -(a + 1) / 2 : a / 2;
          const fx = x / VQ, fy = y / VQ; xy[pi++] = fx; xy[pi++] = fy;
          if (fx < ax) ax = fx; if (fx > bx) bx = fx; if (fy < ay) ay = fy; if (fy > by) by = fy;
        }
      }
    }
    bb[k * 4] = ax; bb[k * 4 + 1] = ay; bb[k * 4 + 2] = bx; bb[k * 4 + 3] = by;
  }
  o0[n] = oi; p0[n] = pi;
  if (i !== u.length || oi !== nOps || pi !== nPts * 2) throw new Error('vec');   // not the file we shipped (cut short or rewritten on the way)
  const end = new Uint32Array(n);   // a clip (style 254) governs the paths up to its closing mark (255)
  for (let k = 0, on = -1; k < n; k++) { if (st[k] === 254) on = k; else if (st[k] === 255 && on >= 0) { end[on] = k; on = -1; } }
  return {n, st, o0, p0, bb, ops, xy, end};
}
function trace(c, k) {
  const {o0, p0, ops, xy} = V; let j = p0[k];
  for (let o = o0[k], e = o0[k + 1]; o < e; o++) {
    const code = ops[o];
    if (code === 1) { c.lineTo(xy[j], xy[j + 1]); j += 2; }
    else if (code === 2) { c.bezierCurveTo(xy[j], xy[j + 1], xy[j + 2], xy[j + 3], xy[j + 4], xy[j + 5]); j += 6; }
    else if (code === 0) { c.moveTo(xy[j], xy[j + 1]); j += 2; }
    else c.closePath();
  }
}
/* Paints the drawing inside the box (plan units) on a context already scaled to plan units; ppu = output pixels per plan unit.
   Lettering too small to read at this scale is left out, and lines never get thinner than a hairline. */
function drawVec(c, rx0, ry0, rx1, ry1, ppu, mono, lite) {
  if (!V) return false;
  const {n, st, o0, bb, end} = V, tiny = 2.4 / ppu, dot = 0.4 / ppu, hair = 0.8 / ppu;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
  let open = -1;
  const flush = () => { if (open >= 0) { c.stroke(); open = -1; } };
  for (let k = 0; k < n; k++) {
    const b = k * 4, id = st[k];
    if (id === 255) { flush(); c.restore(); continue; }
    if (id === 254) {
      flush();
      if (bb[b] > rx1 || bb[b + 2] < rx0 || bb[b + 1] > ry1 || bb[b + 3] < ry0) { k = end[k]; continue; }
      c.save(); c.beginPath(); trace(c, k); c.clip('evenodd'); continue;
    }
    const s = VS[id], pad = s.w || 0;
    if (mono && !s.mono) continue;
    if (bb[b] - pad > rx1 || bb[b + 2] + pad < rx0 || bb[b + 1] - pad > ry1 || bb[b + 3] + pad < ry0) continue;
    const size = Math.max(bb[b + 2] - bb[b], bb[b + 3] - bb[b + 1]);
    if (s.t === 'f') {
      if (size < tiny || (lite && size < 9)) continue;
      flush(); c.beginPath(); trace(c, k); c.fillStyle = mono ? s.mono : s.css; c.fill('evenodd');
    } else {
      if (size < (o0[k + 1] - o0[k] > 2 ? tiny : dot)) continue;
      if (open !== st[k]) { flush(); open = st[k]; c.beginPath(); c.strokeStyle = mono ? s.mono : s.css; c.lineWidth = mono ? (s.mono !== '#1b1b1b' ? 1.6 : s.w >= 1 ? 3.6 : 2.8) / ppu : Math.max(s.w, hair); c.setLineDash(s.d || []); c.lineDashOffset = s.ph || 0; }
      trace(c, k);
    }
  }
  flush(); c.restore();
  return true;
}
/* aerial photo + drawing, for the pictures and PDFs made on this page */
function drawPlan(c, rx0, ry0, rx1, ry1, ppu) {
  const bg = $('bg'); if (bg.naturalWidth) c.drawImage(bg, 0, 0, D.w, D.h);
  drawVec(c, rx0, ry0, rx1, ry1, ppu);
}
/* A plot sketch drawn from the project plan, for plots without an uploaded plan: the plot turned upright and tinted, its
   neighbours, dimensions and the roads around it as plain line work. Fills the W×H pixel box at the origin of the context. */
function drawSketch(c, p, W, H) {
  const a = -(p.sr != null ? p.sr : p.r) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);   // `sr`: the sketch's own turn, where the plan writes the number the other way up
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  p.p.forEach(q => { const dx = q[0] - p.c[0], dy = q[1] - p.c[1], rx = dx * co - dy * si, ry = dx * si + dy * co; x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); y0 = Math.min(y0, ry); y1 = Math.max(y1, ry); });
  const around = 30, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.min(W / (x1 - x0 + 2 * around), H / (y1 - y0 + 2 * around));
  const px = p.c[0] + cx * co + cy * si, py = p.c[1] - cx * si + cy * co, rad = Math.hypot(W, H) / (2 * k);   // centre of the view in plan units, and its reach
  c.save(); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-cx, -cy); c.rotate(a); c.translate(-p.c[0], -p.c[1]);
  if (!V) drawPlan(c, px - rad, py - rad, px + rad, py + rad, k);   // a plan with no line drawing: its picture shows the neighbours
  c.beginPath(); p.p.forEach((v, i) => i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])); c.closePath(); c.fillStyle = '#FFE98A'; c.fill();
  const ok = drawVec(c, px - rad, py - rad, px + rad, py + rad, k, true);
  if (!ok) { c.lineWidth = 2 / k; c.strokeStyle = '#1b1b1b'; c.stroke(); }
  c.restore();
  return ok;
}
const ink = $('ink'), inkC = ink.getContext('2d');
let inkT = 0, inkRest = 0, inkCost = 0, inkDone = '';
/* Redrawn while the view moves, as often as the device manages; in between the last bitmap is simply scaled along.
   Where a full drawing takes long (a big plan on a phone), the moving view gets the line work only, and the lettering
   comes back as soon as the view rests. */
function inkSoon() {
  if (!V) return;
  clearTimeout(inkRest); inkRest = setTimeout(() => { if (inkDone !== view.s + '|' + view.tx + '|' + view.ty) drawInk(false); }, 260);
  if (inkT) return;
  inkT = setTimeout(() => { inkT = 0; drawInk(inkCost > 40); }, inkCost > 24 ? 110 : 24);
}
function drawInk(lite) {
  const vw = map.clientWidth, vh = map.clientHeight, s = view.s; if (!V || !vw || !vh || !s) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3), mx = vw * 0.35, my = vh * 0.35;
  let x0 = Math.max(0, (-view.tx - mx) / s), y0 = Math.max(0, (-view.ty - my) / s);
  const x1 = Math.min(D.w, (vw - view.tx + mx) / s), y1 = Math.min(D.h, (vh - view.ty + my) / s);
  if (x1 <= x0 || y1 <= y0) return;
  let ppu = s * dpr; const cap = 9e6, area = (x1 - x0) * (y1 - y0) * ppu * ppu;
  if (area > cap) ppu *= Math.sqrt(cap / area);
  else { x0 = (Math.floor((view.tx + x0 * s) * dpr) / dpr - view.tx) / s; y0 = (Math.floor((view.ty + y0 * s) * dpr) / dpr - view.ty) / s; }   // keep the bitmap on whole device pixels
  const w = Math.max(1, Math.ceil((x1 - x0) * ppu)), h = Math.max(1, Math.ceil((y1 - y0) * ppu)), t0 = performance.now();
  if (ink.width !== w || ink.height !== h) { ink.width = w; ink.height = h; } else { inkC.setTransform(1, 0, 0, 1, 0, 0); inkC.clearRect(0, 0, w, h); }
  inkC.setTransform(ppu, 0, 0, ppu, -x0 * ppu, -y0 * ppu);
  drawVec(inkC, x0, y0, x1, y1, ppu, false, lite);
  ink.style.left = x0 + 'px'; ink.style.top = y0 + 'px'; ink.style.width = w / ppu + 'px'; ink.style.height = h / ppu + 'px';
  if (lite) inkDone = ''; else { inkCost = performance.now() - t0; inkDone = view.s + '|' + view.tx + '|' + view.ty; }
}
const vecReady = (async () => {
  const unzip = async buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  // sources in order of preference: the compressed file (where the browser can unpack it), the plain file, and the site's own script as a last resort
  for (const src of [typeof DecompressionStream === 'function' ? A.vecz : '', A.vec, A.vec2]) {
    if (!src || V) continue;
    try {
      let buf;
      if (String(src).startsWith('data:')) { const b = atob(src.slice(src.indexOf(',') + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); buf = a.buffer; }
      else { const r = await fetch(src, {credentials: 'same-origin'}); if (!r.ok) throw new Error('vec'); buf = await r.arrayBuffer(); }
      if (src === A.vecz) buf = await unzip(buf);
      V = decodeVec(buf);
    } catch (err) { V = null; }
  }
  if (V) drawInk(); else stage.classList.add('novec');
})();

/* ---------- view (pan / zoom) ---------- */
const MAXS = 10;
const minScale = () => Math.min(map.clientWidth / D.w, map.clientHeight / D.h) * 0.9;
function apply() {
  const vw = map.clientWidth, vh = map.clientHeight, s = view.s, mx = vw * 0.6, my = vh * 0.6;
  view.tx = Math.min(mx, Math.max(vw - mx - D.w * s, view.tx));
  view.ty = Math.min(my, Math.max(vh - my - D.h * s, view.ty));
  stage.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${s})`;
  const z = s >= 3.3 ? 2 : s >= 1.25 ? 1 : 0;
  if (stage.dataset.z !== String(z)) stage.dataset.z = z;
  if (z === 0) sizePins();
  inkSoon();
}
function zoomAt(f, cx, cy) {
  const s2 = Math.min(MAXS, Math.max(minScale(), view.s * f)), k = s2 / view.s;
  view.tx = cx - (cx - view.tx) * k; view.ty = cy - (cy - view.ty) * k; view.s = s2; apply();
}
const panel = $('panel');
const isSheet = () => getComputedStyle(panel).position === 'absolute';
function visibleBox() {
  const vw = map.clientWidth; let vh = map.clientHeight;
  if (isSheet()) vh -= (panel.dataset.open === 'true' ? Math.min(panel.offsetHeight, vh * 0.66) : 52);
  return {vw, vh: Math.max(120, vh)};
}
function fit(x0, y0, x1, y1, maxS) {
  const {vw, vh} = visibleBox();
  const s = Math.min(maxS || MAXS, Math.max(minScale(), Math.min(vw / (x1 - x0), vh / (y1 - y0))));
  view.s = s; view.tx = vw / 2 - (x0 + x1) / 2 * s; view.ty = vh / 2 - (y0 + y1) / 2 * s; apply();
}
function bounds(list, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  list.forEach(p => p.p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
const fitAll = () => fit(...bounds(plots, 40));
const focusPlot = p => fit(p.c[0] - 70, p.c[1] - 55, p.c[0] + 70, p.c[1] + 55, 4.2);
function ensureVisible(p) {
  const {vw, vh} = visibleBox(), x = p.c[0] * view.s + view.tx, y = p.c[1] * view.s + view.ty;
  if (x < 40 || x > vw - 40 || y < 40 || y > vh - 40) { view.tx += vw / 2 - x; view.ty += vh / 2 - y; apply(); }
}

const hint = map.querySelector('.hint'), tip = $('tip');
const pts = new Map(); let dragged = false, startPan = null, pinch = null;
function local(e) { const r = map.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
map.addEventListener('pointerdown', e => {
  if (e.target.closest('.zoom')) return;
  pts.set(e.pointerId, local(e)); dragged = false; hint.hidden = true;
  if (pts.size === 1) startPan = {p: local(e), tx: view.tx, ty: view.ty};
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s}; startPan = null; dragged = true; }
});
window.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  const p = local(e); pts.set(e.pointerId, p);
  if (pts.size === 1 && startPan) {
    const dx = p[0] - startPan.p[0], dy = p[1] - startPan.p[1];
    if (!dragged && Math.hypot(dx, dy) < 6) return;
    dragged = true; map.classList.add('dragging'); tip.hidden = true;
    view.tx = startPan.tx + dx; view.ty = startPan.ty + dy; apply();
  } else if (pts.size === 2 && pinch) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt(pinch.s * d / pinch.d / view.s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
});
function endPtr(e) {
  if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (pts.size === 0) { startPan = null; map.classList.remove('dragging'); }
  else if (pts.size === 1) startPan = {p: [...pts.values()][0], tx: view.tx, ty: view.ty};
}
window.addEventListener('pointerup', endPtr); window.addEventListener('pointercancel', endPtr);
map.addEventListener('wheel', e => { e.preventDefault(); hint.hidden = true; const [x, y] = local(e); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), x, y); }, {passive: false});
$('zin').onclick = () => zoomAt(1.5, map.clientWidth / 2, map.clientHeight / 2);
$('zout').onclick = () => zoomAt(1 / 1.5, map.clientWidth / 2, map.clientHeight / 2);
$('zfit').onclick = fitAll;
$('zpdf').onclick = e => exportPdf(e.currentTarget, planPdf, FILE + '-plan-' + state.updated + '.pdf');

/* ---------- select / hover ---------- */
svg.addEventListener('click', e => { if (dragged) return; const g = e.target.closest('.pl'); if (g) select(+g.dataset.i, false); });
let tipKey = '';
svg.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || pts.size) { tip.hidden = true; return; }
  const g = e.target.closest('.pl'); if (!g) { tip.hidden = true; return; }
  const p = plots[+g.dataset.i], [x, y] = local(e), st = statusOf(p), b = stage.dataset.z === '2' ? bldPic(p) : null;
  const key = p.n + '|' + (b || '');
  if (key !== tipKey) {
    tipKey = key;
    $('tipText').innerHTML = (p.am ? esc(p.am) + ' · <span class="num">' + p.n + '</span>' : 'قطعة <span class="num">' + p.n + '</span> · <span class="num">' + fmt(p.ft) + '</span> قدم²' + (st ? ' · ' + ST[st] : '')) + (b ? '<small>صورة تخيلية لشكل البناء</small>' : '');
    const im = $('tipImg'); im.hidden = !b; if (b && im.dataset.k !== b.src) { im.onerror = () => { im.hidden = true; }; im.src = b.src; im.dataset.k = b.src; }
  }
  tip.classList.toggle('below', y < (b ? 190 : 50));
  tip.style.left = Math.min(map.clientWidth - 120, Math.max(120, x)) + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
});
svg.addEventListener('pointerleave', () => { tip.hidden = true; });

function select(i, move) {
  view.sel = i;
  const p = i == null ? null : plots[i], s = p ? p.p.map(q => q.join(',')).join(' ') : '';
  $('hl1').setAttribute('points', s); $('hl2').setAttribute('points', s);
  render();
  if (p) { openSheet(true); if (move) focusPlot(p); else ensureVisible(p); }
}

/* ---------- filters ---------- */
function matches(p) {
  if (p.am) return view.status === 'all' && view.area === 'all' && !view.type;
  if (view.status !== 'all' && statusOf(p) !== view.status) return false;
  if (view.type && p.t !== view.type) return false;
  if (view.area !== 'all') { const [a, b] = view.area.split('-').map(Number); if (!(p.ft > a && p.ft <= b)) return false; }
  return true;
}
function applyFilters() {
  let n = 0;
  plots.forEach((p, i) => { const m = matches(p); if (m && !p.am) n++; groups[i].classList.toggle('dim', !m); });
  const active = view.status !== 'all' || view.area !== 'all' || view.type;
  $('count').textContent = active ? `${fmt(n)} قطعة مطابقة من ${fmt(sale.length)}` : `${fmt(sale.length)} قطعة`;
}
$('statusSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  view.status = b.dataset.v;
  [...$('statusSeg').children].forEach(x => x.setAttribute('aria-pressed', x === b));
  applyFilters();
  if (view.status !== 'all') { const l = plots.filter(p => statusOf(p) === view.status); if (l.length) fit(...bounds(l, 60), 3.4); }
});
/* the area choices follow the project's own plot sizes (a villa project and an industrial one have nothing in common) */
(function areaBands() {
  const sel = $('areaSel'), a = sale.map(p => +p.ft || 0).filter(x => x > 0).sort((x, y) => x - y);
  if (a.length < 8) { sel.hidden = true; return; }
  const nice = v => { const m = 10 ** Math.max(2, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };
  let cuts = [...new Set([0.25, 0.5, 0.75].map(q => nice(a[Math.floor(q * (a.length - 1))])))].filter(c => c > a[0] && c < a[a.length - 1]);
  const bands = []; let lo = 0;
  for (const c of [...cuts, Infinity]) { if (a.some(x => x > lo && x <= c)) { bands.push([lo, c]); lo = c; } else if (bands.length) bands[bands.length - 1][1] = c, lo = c; else lo = c; }
  if (bands.length < 2) { sel.hidden = true; return; }
  bands[0][0] = 0;
  sel.innerHTML = '<option value="all">كل المساحات</option>' + bands.map(([x, y], i) => `<option value="${x}-${y === Infinity ? 1e12 : y}">${i === 0 ? 'حتى ' + fmt(y) : y === Infinity ? 'أكثر من ' + fmt(x) : fmt(x) + ' – ' + fmt(y)} قدم²</option>`).join('');
})();
$('areaSel').addEventListener('change', e => { view.area = e.target.value; applyFilters(); });
let qTimer = 0;
const NO_LEN = Math.max(...plots.map(p => p.n.replace('*', '').length)), NO_SHORT = plots.some(p => p.n.length < NO_LEN);
$('q').addEventListener('input', e => {
  const v = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  $('msg').textContent = ''; clearTimeout(qTimer);
  if (!v) return;
  /* a full-length number is looked up at once; a shorter one (some projects have plots numbered 1, 21, 202…) after a short pause in typing */
  const go = () => { if (byNo.has(v)) select(byNo.get(v), true); else if (v.length >= NO_LEN || !plots.some(p => p.n.startsWith(v))) $('msg').textContent = 'لا توجد قطعة بالرقم ' + v; };
  if (v.length >= NO_LEN) go(); else if (NO_SHORT) qTimer = setTimeout(go, 900);
});
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, ''); clearTimeout(qTimer); if (byNo.has(v)) select(byNo.get(v), true); } });

/* ---------- panel ---------- */
function openSheet(o) { panel.dataset.open = o; $('handle').setAttribute('aria-expanded', o); $('chev').textContent = o ? 'إخفاء' : 'عرض'; }
$('handle').onclick = () => openSheet(panel.dataset.open !== 'true');
const body = $('body');

function overview() {
  const off = offered(), c = k => off.filter(p => statusOf(p) === k).length;
  const rows = off.map(p => {
    const st = statusOf(p), pr = st === 'av' ? priceOf(p) : null, kind = kindOf(p);
    return `<li><button type="button" data-no="${p.key}"><span class="no num">${p.n}</span>` +
      `<span class="meta"><span class="num">${fmt(p.ft)}</span> قدم²${kind ? ' · ' + kind : ''}</span>` +
      (pr ? `<span class="price"><span class="num">${fmt(pr.total)}</span> <small>درهم</small></span>` : `<span class="pill ${st}">${ST[st]}</span>`) + `</button></li>`;
  }).join('');
  const leg = TYPE_ORDER.map(t => {
    const T = TYPES[t], n = sale.filter(p => p.t === t).length;
    return `<li><button type="button" data-t="${t}" aria-pressed="${view.type === t}"><i class="sw" style="background:rgb(${T.c.join(',')})"></i>` +
      `<span><b>${T.use}${T.tag ? ' · ' + T.tag : ''} <span style="font-weight:400">(${T.floors})</span></b>${T.sizes.map(s => `<span class="sz num" style="direction:rtl">${s}</span>`).join('')}</span>` +
      `<span class="ct num">${n}</span></button></li>`;
  }).join('');
  return (admin ? adminOverview() : '') + `<dl class="stats">
      <div><dd>${fmt(sale.length)}</dd><dt>قطعة</dt></div>
      <div><dd>${c('av')}</dd><dt>متاح</dt></div>
      <div><dd>${c('res')}</dd><dt>محجوز</dt></div>
      <div><dd>${c('sold')}</dd><dt>مباع</dt></div></dl>
    <button type="button" class="loc dlbtn" id="dlPlan">${DLICON}تحميل المخطط كاملًا PDF</button>
    <section><h2>القطع المعروضة</h2>${rows ? `<ul class="offers">${rows}</ul>` : '<div class="plain">لا توجد قطع معروضة حاليًا.</div>'}</section>
    <section><h2>دليل الألوان</h2><ul class="legend">${leg}</ul></section>
    <p class="note">${esc(CFG.note || 'انقر على أي قطعة في المخطط لعرض تفاصيلها، وقرّب عليها لرؤية صورة تخيلية لشكل البناء. المساحات محسوبة من الأبعاد المدوّنة على المخطط. القطع بلا سعر تظهر «للاستفسار».')}</p>`;
}
function adminOverview() {
  const dates = new Map();
  Object.values(state.plots).forEach(e => (e.inst || []).forEach(x => dates.set(x[0], (dates.get(x[0]) || 0) + 1)));
  const rows = [...dates.entries()].sort().map(([d, n]) => `<li><span>قسط <span class="num">${dstr(d) || 'بدون تاريخ'}</span> · <span class="num">${n}</span> قطعة</span><button type="button" class="btn danger" data-bulk="${esc(d)}">حذف من كل القطع</button></li>`).join('');
  return `<section class="edit">${SITE && siteUpload ? `<h2>إضافة أرض من ملف</h2>
      <button type="button" class="btn pzbtn" id="landImpAll">📄 إضافة أرض من ملف تفاصيل الأرض (PDF)</button>
      <p class="help">ارفع ملف تفاصيل الأرض: يُقرأ منه رقم القطعة والمساحة والسعر والدفعة المقدمة والأقساط وتواريخها، فتُعبّأ القطعة وتصبح «متاح»، ويُرفق الملف نفسه بالقطعة. راجعها ثم اضغط «حفظ».</p>` : ''}
      <h2>إعدادات عامة</h2>
      <label>رقم التواصل العام (واتساب واتصال) — لكل القطع التي ليس لها رقم خاص. اتركه فارغًا لعرض المخطط وملفاته بلا رقم.<input id="setPhone" type="tel" inputmode="tel" value="${esc(state.phone || '')}"></label>
      <label>رابط موقع المشروع على الخرائط<input id="setLoc" type="url" inputmode="url" value="${esc(state.loc || '')}"></label>
      ${SITE ? '' : `<label>رابط هذه الصفحة (يُرسل مع البطاقة عند المشاركة)<input id="setLink" type="url" inputmode="url" value="${esc(state.link || PAGE_LINK)}"></label>`}
      ${rows ? `<h2>الأقساط</h2><ul class="bulk">${rows}</ul><p class="help">حذف القسط من كل القطع يضيف قيمته إلى الدفعة المقدمة لكل قطعة.</p>` : ''}
      ${bldSettings()}
      <p class="help">لتعديل قطعة: انقر عليها في المخطط أو ابحث برقمها.</p></section>`;
}
function priceView(p) {
  const st = statusOf(p), pr = st === 'av' ? priceOf(p) : null;
  if (pr) {
    const a = Math.max(0, pr.down) / pr.total * 100;
    let h = `<div class="total"><div><div class="ppf">السعر الإجمالي</div>${pr.ppf ? `<div class="ppf">سعر القدم <span class="num">${fmt(pr.ppf)}</span> درهم</div>` : ''}</div><div class="v"><span class="num">${fmt(pr.total)}</span> <small style="font-size:.6em">درهم</small></div></div>`;
    if (pr.inst.length) h += `<div class="plan"><h2 style="margin:0">خطة الدفع</h2>
        <div class="planbar" aria-hidden="true"><i style="width:${a}%"></i>${pr.inst.map(x => `<i style="width:${x.a / pr.total * 100}%"></i>`).join('')}</div>
        <table><tbody>
          <tr><td>الدفعة المقدمة <small class="num">${a.toFixed(0)}%</small></td><td class="num">${fmt(pr.down)}</td></tr>
          ${pr.inst.map(x => `<tr><td>قسط <span class="num">${dstr(x.d)}</span></td><td class="num">${fmt(x.a)}</td></tr>`).join('')}
        </tbody></table></div>`;
    return h;
  }
  if (st === 'sold') return '<div class="plain">هذه القطعة مباعة.</div>';
  if (st === 'res') return '<div class="plain">هذه القطعة محجوزة حاليًا.</div>';
  return '<div class="plain">تواصل معنا لمعرفة سعر هذه القطعة وتوفرها.</div>';
}
function editor(p) {
  const e = ent(p) || {}, st = e.s || '', inst = e.inst || [];
  const seg = [['', 'للاستفسار'], ['av', 'متاح'], ['res', 'محجوز'], ['sold', 'مباع']].map(([v, l]) => `<button type="button" data-st="${v}" aria-pressed="${st === v}">${l}</button>`).join('');
  const rows = inst.map((x, k) => `<div class="irow"><label>تاريخ القسط<input id="edD${k}" data-k="${k}" data-f="d" type="date" value="${esc(x[0] || '')}"></label><label>المبلغ (درهم)<input id="edA${k}" data-k="${k}" data-f="a" type="number" inputmode="numeric" min="0" step="1" value="${x[1] || ''}"></label><button type="button" class="btn danger" data-del="${k}" aria-label="حذف القسط">حذف</button></div>`).join('');
  return `<section class="edit" id="edit"><h2>تعديل القطعة <span class="num">${p.n}</span></h2>
      <button type="button" class="btn pzbtn" id="pzMake">🖼️ تصميم إعلان لهذه القطعة (JPEG)</button>
      ${SITE && siteUpload ? '<button type="button" class="btn pzbtn" id="landImp">📄 تعبئة بيانات القطعة من ملف التفاصيل (PDF)</button>' : ''}
      <div class="copyrow"><label>نسخ بيانات قطعة أخرى إلى هذه القطعة<input id="edCopy" type="text" inputmode="numeric" placeholder="اكتب رقم الأرض"></label><button type="button" class="btn" id="edCopyBtn">نسخ</button></div>
      <p class="help">تُنسخ الحالة وسعر القدم والسعر الإجمالي والأقساط كما هي. إذا اختلفت المساحة يُحسب الإجمالي من سعر القدم على مساحة هذه القطعة.</p>
      ${p.lb0 || e.lb ? `<label><span>رقم القطعة الصحيح${p.lb0 ? ' · مكرر في المخطط: <b class="num" dir="ltr">' + esc(p.lb0) + '</b>' : ''}</span><input id="edLb" type="text" inputmode="numeric" value="${esc(e.lb || '')}" placeholder="اكتب رقم القطعة"></label>` : ''}
      <div class="seg" role="group" aria-label="حالة القطعة">${seg}</div>
      <button type="button" class="btn fe${e.fe ? ' on' : ''}" data-fe aria-pressed="${!!e.fe}">${e.fe ? '★ أرض مميزة · تظهر في الصفحة الرئيسية' : '☆ تمييز الأرض (عرضها في «أراضٍ مميزة» بالصفحة الرئيسية)'}</button>
      ${e.fe && st !== 'av' ? '<p class="help">الأراضي المميزة تظهر في الصفحة الرئيسية ما دامت حالتها «متاح».</p>' : ''}
      <div class="two">
        <label>سعر القدم (درهم)<input id="edPpf" type="number" inputmode="decimal" min="0" step="any" value="${e.ppf || ''}"></label>
        <label>السعر الإجمالي (درهم)<input id="edTotal" type="number" inputmode="numeric" min="0" step="1" value="${e.total || ''}"></label>
      </div>
      <label>المساحة المعتمدة بالقدم المربع (اختياري)<input id="edFt" type="number" inputmode="numeric" min="0" step="1" value="${e.ft || ''}" placeholder="${p.ft0}"></label>
      <p class="help">مساحة المخطط لهذه القطعة ${p.ap0 ? '≈ ' : ''}<span class="num">${fmt(p.ft0)}</span> قدم². اكتب المساحة الرسمية إن اختلفت عنها، أو اترك الخانة فارغة.</p>
      <label>رابط موقع الأرض على الخريطة (اختياري)<input id="edLo" type="url" inputmode="url" dir="ltr" value="${esc(e.lo || '')}" placeholder="https://maps.app.goo.gl/…"></label>
      <label>رقم تواصل خاص بهذه القطعة (اختياري)<input id="edPh" type="tel" inputmode="tel" value="${esc(e.ph || '')}" placeholder="${esc(state.phone || '')}"></label>
      <p class="help">تغيير سعر القدم يحسب الإجمالي تلقائيًا (السعر × <span class="num">${fmt(p.ft)}</span> قدم²). وإذا عدّلت الإجمالي يدويًا يُقرَّب سعر القدم لأقرب درهم.</p>
      ${genBox(p, e)}
      ${rows}
      <div class="calc" id="edCalc"></div>
      <div class="rowbtns"><button type="button" class="btn" id="edAdd">+ إضافة قسط</button>${e.total || e.ppf ? '<button type="button" class="btn danger" id="edClear">إزالة السعر</button>' : ''}</div>
      <p class="help">الدفعة المقدمة = الإجمالي − الأقساط. حذف قسط يضيف قيمته إلى الدفعة المقدمة. السعر يظهر للزوار عندما تكون الحالة «متاح».</p>${fileEditor(p)}</section>`;
}
/* admin: a payment plan made in one step — first date, how many instalments, how far apart, and the down payment */
function addMonths(d, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return '';
  const y = +m[1], mo = +m[2] - 1 + n, day = +m[3], Y = y + Math.floor(mo / 12), M = ((mo % 12) + 12) % 12, last = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
  return Y + '-' + String(M + 1).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0');
}
function monthsBetween(a, b) { const x = /^(\d{4})-(\d{2})/.exec(a || ''), y = /^(\d{4})-(\d{2})/.exec(b || ''); return x && y ? (+y[1] - +x[1]) * 12 + (+y[2] - +x[2]) : 0; }
function genBox(p, e) {
  const inst = (e.inst || []).filter(x => x[0]), n0 = inst.length || 4;
  let step0 = inst.length > 1 ? monthsBetween(inst[0][0], inst[1][0]) : 6; if (step0 < 1 || step0 > 12) step0 = 6;
  const first0 = inst.length ? inst[0][0] : addMonths(new Date().toISOString().slice(0, 10), 3);
  const amt0 = inst.length ? +inst[0][1] || '' : '';
  const opt = (a, b, sel, lab) => Array.from({length: b - a + 1}, (_, i) => a + i).map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${lab(v)}</option>`).join('');
  return `<div class="gen" id="gen"><h3>خطة الدفع السريعة</h3>
      <div class="two"><label>تاريخ أول قسط<input id="gDate" type="date" value="${esc(first0)}"></label>
        <label>عدد الأقساط<select id="gN">${opt(1, 24, n0, v => v === 1 ? 'قسط واحد' : v === 2 ? 'قسطان' : v + (v <= 10 ? ' أقساط' : ' قسطًا'))}</select></label></div>
      <div class="two"><label>المدة بين كل قسط<select id="gStep">${opt(1, 12, step0, v => v === 1 ? 'كل شهر' : v === 2 ? 'كل شهرين' : 'كل ' + v + (v <= 10 ? ' شهور' : ' شهرًا'))}</select></label></div>
      <label>قيمة القسط (درهم)<input id="gAmt" type="number" inputmode="numeric" min="0" step="1" value="${amt0}" placeholder="مثال: 50000"></label>
      <div class="calc" id="gCalc"></div>
      <div class="rowbtns"><button type="button" class="btn primary" id="gMake">إنشاء الأقساط</button></div>
      <p class="help">الدفعة المقدمة تُحسب تلقائيًا = السعر الإجمالي − (قيمة القسط × عدد الأقساط). الإنشاء يستبدل الأقساط الحالية، وتقدر تعدّل أي قسط بعدها.</p></div>`;
}
function genCalc() {   // the down payment the chosen instalments leave, shown as the admin types
  const el = $('gCalc'); if (!el || view.sel == null) return;
  const e = ent(plots[view.sel]) || {}, total = +e.total || 0, n = +$('gN').value || 1, amt = Math.round(+$('gAmt').value || 0), down = total - n * amt;
  if (!total || !amt) { el.className = 'calc'; el.innerHTML = '<span>الدفعة المقدمة</span><span>—</span>'; return; }
  el.className = 'calc' + (down <= 0 ? ' bad' : '');
  el.innerHTML = down <= 0 ? '<span>مجموع الأقساط أكبر من السعر الإجمالي أو يساويه</span>' : `<span>الدفعة المقدمة</span><span><span class="num">${fmt(down)}</span> درهم</span>`;
}
/* admin: the plot's own PDF plan and building picture (kept in the site's media library) */
function thumb(b) { return b ? `<img class="thumb" alt="" src="${esc(b.src)}">` : '<span class="thumb none">لا صورة</span>'; }
function fileEditor(p) {
  if (!SITE || !siteUpload) return '';
  const e = ent(p) || {}, doc = docOf(p), b = bldPic(p), own = !!fileUrl(e.img), def = defaultBld(bldOf(p));
  const plan = planOf(p);
  return `<h2>مخطط الأرض</h2>` +
    (doc ? `<div class="filerow"><a class="fname" target="_blank" rel="noopener" href="${esc(doc.u)}">${DOCICON}<span>${esc(doc.t || 'ملف PDF')}</span></a></div>
      <div class="rowbtns"><button type="button" class="btn" data-up="doc">استبدال الملف</button><button type="button" class="btn danger" data-rm="doc">حذف</button></div>
      <p class="help">زر PDF في بطاقة القطعة يحمّل هذا الملف كما هو بكل صفحاته، ويظهر منه مخطط الأرض في الصفحة.</p>`
      : `<div class="rowbtns"><button type="button" class="btn" data-up="doc">رفع ملف تفاصيل الأرض (PDF كامل)</button></div>
      <p class="help">ارفع الملف كما هو بدون قص (مثلًا: صفحة الدفعات ثم مخطط الأرض ثم الاشتراطات). زر PDF في بطاقة القطعة يحمّله كاملًا، ويظهر منه مخطط الأرض للزوار. بدون ملف يظهر مخطط توضيحي مرسوم من مخطط المشروع.</p>`) +
    (plan ? `<div class="filerow"><img class="thumb" alt="" src="${esc(plan.sk.u)}"><span class="fnote">مقتطف مرفوع سابقًا${doc ? ' (لا يظهر ما دام الملف الكامل موجودًا)' : ''}</span></div>
      <div class="rowbtns"><button type="button" class="btn danger" data-rm="plan">حذف المقتطف</button></div>` : '') +
    `<h2>صورة المبنى</h2><div class="filerow">${thumb(b)}<span class="fnote">${e.noimg ? 'محذوفة من هذه القطعة' : own ? 'صورة خاصة بهذه القطعة' : b ? 'الصورة الافتراضية' : 'لا توجد صورة افتراضية لهذا النوع'}</span></div>
      <div class="rowbtns"><button type="button" class="btn" data-up="img">${own ? 'تغيير الصورة' : 'رفع صورة لهذه القطعة'}</button>` +
      (own ? `<button type="button" class="btn" data-rm="img">رجوع للافتراضية</button>` : '') +
      (e.noimg ? `<button type="button" class="btn" data-noimg="0">إظهار الصورة</button>` : (b ? `<button type="button" class="btn danger" data-noimg="1">حذف الصورة</button>` : '')) + `</div>`;
}
function bldSettings() {
  if (!SITE || !siteUpload) return '';
  return `<h2>صور المبنى الافتراضية</h2>` + BLD_KINDS.map(([k]) => {
    const g = state.bld && state.bld[k], b = defaultBld(k), own = !!fileUrl(g);
    return `<div class="filerow">${thumb(b)}<span class="fnote"><b>${BLD_NAME[k]}</b><br>${g && g.off ? 'محذوفة' : own ? 'صورة مرفوعة' : b ? 'الصورة الأصلية' : 'لا توجد صورة'}</span></div>
      <div class="rowbtns"><button type="button" class="btn" data-upg="${k}">تغيير الصورة</button>` +
      (own || (g && g.off) ? `<button type="button" class="btn" data-rmg="${k}">رجوع للأصلية</button>` : '') +
      (g && g.off ? '' : `<button type="button" class="btn danger" data-offg="${k}">حذف الصورة</button>`) + `</div>`;
  }).join('') + `<p class="help">تظهر هذه الصور لكل القطع من نفس النوع، ما لم تُرفع للقطعة صورة خاصة بها.</p>`;
}
function calcLine(p) {
  const el = $('edCalc'); if (!el) return;
  const pr = priceOf(p);
  if (!pr) { el.className = 'calc'; el.innerHTML = '<span>الدفعة المقدمة</span><span>—</span>'; return; }
  el.className = 'calc' + (pr.down < 0 ? ' bad' : '');
  el.innerHTML = pr.down < 0 ? '<span>مجموع الأقساط أكبر من السعر الإجمالي</span>' : `<span>الدفعة المقدمة</span><span><span class="num">${fmt(pr.down)}</span> درهم</span>`;
}
function head(p) {
  const st = statusOf(p), pill = st ? `<span class="pill ${st}">${ST[st]}</span>` : '<span class="pill ask">للاستفسار</span>';
  return `<div class="d-head"><div><div class="lbl">رقم القطعة</div><div class="big num">${p.n}</div></div><div class="hd-side">${pill}<div class="chips">${(admin || designer) && !p.am ? '<button type="button" class="pdfchip pzchip" id="pzTop" aria-label="تصميم إعلان للقطعة">🖼️ ' + (designer && !admin ? 'تصميم بوست' : 'تصميم إعلان') + '</button>' : ''}<button type="button" class="pdfchip" id="shareTop" aria-label="مشاركة بطاقة القطعة">${SHICON}مشاركة</button><button type="button" class="pdfchip" id="dlPlotTop" aria-label="${docOf(p) ? 'تحميل ملف تفاصيل الأرض PDF' : 'تحميل بطاقة القطعة PDF'}">${DLICON}PDF</button></div></div></div>`;
}
function detail(p) {
  const back = '<button type="button" class="back" id="back">→ كل القطع</button>';
  if (p.am) return back + `<div class="d-head"><div><div class="lbl">مرفق</div><div class="big" style="font-size:1.7rem">${esc(p.am)}</div></div><span class="num lbl">${p.n}</span></div>
    <div class="plain">مرفق عام ضمن المخطط، غير معروض للبيع.</div>`;
  const T = TYPES[p.t], kind = kindOf(p), b = bldPic(p), st = statusOf(p), doc = docOf(p), plan = planOf(p);
  let h = back + `<div id="dHead">${head(p)}</div>` + (admin ? editor(p) : '') +
    (b ? `<figure class="bld"><button type="button" id="bldBtn" aria-label="تكبير صورة المبنى"></button><figcaption>صورة تخيلية لشكل البناء · ${T.floors === 'أرضي + اثنين' ? 'أرضي + طابقين' : T.floors}${kind && !CFG.types ? ' · قطعة ' + kind : ''}</figcaption></figure>` : '') +
    `<figure class="bld skf"><button type="button" id="skBtn" aria-label="تكبير مخطط الأرض"></button><figcaption>${doc ? `مخطط الأرض · <a class="lnk" target="_blank" rel="noopener" href="${esc(doc.u)}">فتح الملف كاملًا</a>` : plan ? 'مخطط الأرض' : 'مخطط توضيحي للقطعة · ليس وثيقة رسمية'}${!doc && plan && plan.last ? ' · <button type="button" class="lnk" id="skLast">عرض اشتراطات التخطيط</button>' : ''}</figcaption></figure>` +
    `<dl class="facts">
      <dt>الاستخدام</dt><dd>${T.use}</dd>
      <dt>الطوابق</dt><dd>${T.floors}</dd>
      ${kind ? `<dt>الموقع</dt><dd>${kind}</dd>` : ''}
      <dt>المساحة</dt><dd>${p.ap ? '≈ ' : ''}<span class="num">${fmt(p.ft)}</span> قدم² <small style="color:var(--muted)">(<span class="num">${fmt(p.m2)}</span> م²)</small></dd>
      ${p.d ? `<dt>الأبعاد</dt><dd><span class="num" style="direction:rtl">${(p.ir ? '≈ ' : '') + p.d[0].toFixed(2) + ' × ' + p.d[1].toFixed(2)} م</span></dd>` : ''}
    </dl><div id="pview" style="display:flex;flex-direction:column;gap:18px">${priceView(p)}</div>`;
  const text = encodeURIComponent(`السلام عليكم، أرغب بالاستفسار عن القطعة رقم ${p.n} في مخطط ${PROJECT}.`), loc = locUrl();
  h += `<div class="cta">` + (st === 'sold' ? '' : hasPhone(p) ? `<a class="wa" target="_blank" rel="noopener" href="https://wa.me/${waNumber(p)}?text=${text}">استفسر عن القطعة عبر واتساب</a>
      <div class="phone"><a class="num" id="ph" target="_blank" rel="noopener" href="https://wa.me/${waNumber(p)}?text=${text}" aria-label="فتح واتساب على الرقم">${esc(phoneShown(p))}</a><button type="button" id="copy">نسخ الرقم</button></div>`
      : CONTACT ? `<a class="wa ask" target="_blank" rel="noopener" href="${esc(CONTACT)}">تواصل معنا للاستفسار عن القطعة</a>` : '') +
      (plotLoc(p) ? `<a class="loc" target="_blank" rel="noopener" href="${esc(plotLoc(p))}">${PIN}موقع الأرض على الخريطة</a>` : '') +
      (loc ? `<a class="loc" target="_blank" rel="noopener" href="${esc(loc)}">${PIN}موقع المشروع على الخريطة</a>` : '') +
      `<button type="button" class="loc dlbtn" id="shareBtn">${SHICON}مشاركة بطاقة القطعة</button><button type="button" class="loc dlbtn" id="dlPlot">${DLICON}${doc ? 'تحميل تفاصيل الأرض PDF (الدفعات + المخطط)' : 'تحميل ملف القطعة PDF (التفاصيل + المخطط)'}</button></div>`;
  return h;
}
const imgs = {};
function picEl(b) {   // one <img> per picture, reused between plots
  if (!imgs[b.src]) { const im = new Image(); im.alt = 'صورة تخيلية لشكل البناء'; if (b.fallback) im.onerror = () => { im.onerror = null; im.src = b.fallback; }; im.src = b.src; imgs[b.src] = im; }
  return imgs[b.src];
}
function fillSketch(p) {   // the uploaded sketch, or the one drawn from the project plan once the drawing has arrived
  const host = $('skBtn'), pl = planOf(p), doc = docOf(p); if (!host) return;
  const auto = () => { const [cv, c] = canvas(960, 720, '#fff'); cv.setAttribute('aria-label', 'مخطط توضيحي للقطعة'); drawSketch(c, p, 960, 720); host.textContent = ''; host.appendChild(cv); };
  if (doc) {
    host.classList.add('doc'); host.textContent = 'جارٍ فتح مخطط الأرض…';
    docRender(doc, 1400).then(pages => {
      if ($('skBtn') !== host) return;
      const src = docPlanPage(pages), im = new Image(); im.alt = 'مخطط الأرض'; im.src = src.toDataURL('image/jpeg', 0.9); host.textContent = ''; host.appendChild(im);
    }, () => { if ($('skBtn') !== host) return; host.classList.remove('doc'); if (pl) { host.textContent = ''; const im = new Image(); im.alt = 'مخطط الأرض'; im.onerror = auto; im.src = pl.sk.u; host.appendChild(im); } else auto(); });
    return;
  }
  if (pl) { const im = new Image(); im.alt = 'مخطط الأرض'; im.onerror = auto; im.src = pl.sk.u; host.appendChild(im); return; }
  auto();
  if (!V) vecReady.then(() => { if (V && view.sel != null && plots[view.sel] === p && $('skBtn') === host) auto(); });
}
function render() {
  const p = view.sel == null ? null : plots[view.sel];
  body.innerHTML = p ? detail(p) : overview();
  body.scrollTop = 0;
  const bb = $('bldBtn');
  if (bb && p) { const b = bldPic(p); if (b) bb.appendChild(picEl(b)); }
  if ($('skBtn') && p) fillSketch(p);
  if (p) { calcLine(p); genCalc(); }
  const st = p ? statusOf(p) : null;
  $('handleText').innerHTML = p ? (p.am ? esc(p.am) : 'قطعة <span class="num">' + p.n + '</span>' + (st ? ' · ' + ST[st] : '')) : `القطع المعروضة · <span class="num">${offered().filter(x => statusOf(x) === 'av').length}</span> متاح`;
}
function chrome() {
  $('upd').textContent = dstr(state.updated);
  const loc = locUrl(), lb = $('locBtn'); lb.hidden = !loc; if (loc) lb.href = loc;
  const bb = $('backBtn'); bb.hidden = !BACK; if (BACK) { bb.href = BACK; bb.title = 'العودة إلى الموقع'; }
}

/* ---------- lightbox / copy / lists ---------- */
$('lightbox').addEventListener('click', () => { $('lightbox').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('lightbox').hidden = true; if (prep && !prep.busy) closePrep(); if (!$('filebox').hidden) closeFilebox(); $('sharebox').hidden = true; if (!$('pzCropBox').hidden) $('pzCropNo').click(); else if (!$('pzbox').hidden) $('pzClose').click(); } });
function lightbox(src, cap) { $('lbImg').src = src; $('lbCap').textContent = cap + ' · انقر للإغلاق'; $('lightbox').hidden = false; }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

body.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'back') { select(null); return; }
  if (b.id === 'bldBtn') { const im = b.querySelector('img'); if (im) lightbox(im.currentSrc || im.src, 'صورة تخيلية لشكل البناء'); return; }
  if ((b.id === 'skBtn' || b.id === 'skLast') && view.sel != null) {
    const p = plots[view.sel], pl = planOf(p);
    const shown = b.id === 'skBtn' && docOf(p) && b.querySelector('img');
    if (shown) lightbox(shown.src, 'مخطط الأرض · قطعة ' + p.n);
    else if (b.id === 'skLast') { if (pl && pl.last) lightbox(pl.last.u, 'اشتراطات التخطيط · قطعة ' + p.n); }
    else if (pl) lightbox(pl.sk.u, 'مخطط الأرض · قطعة ' + p.n);
    else { const [cv, c] = canvas(1800, 1350, '#fff'); drawSketch(c, p, 1800, 1350); lightbox(cv.toDataURL('image/jpeg', 0.9), 'مخطط توضيحي للقطعة ' + p.n + ' · ليس وثيقة رسمية'); }
    return;
  }
  if (b.dataset.no) { select(byNo.get(b.dataset.no), true); return; }
  if (b.dataset.t) { view.type = view.type === b.dataset.t ? null : b.dataset.t; applyFilters(); render(); if (view.type && isSheet()) openSheet(false); return; }
  if (b.id === 'copy') {
    const done = () => { b.textContent = 'تم النسخ'; setTimeout(() => { b.textContent = 'نسخ الرقم'; }, 1600); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('ph')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'الرقم محدد'; };
    try { navigator.clipboard.writeText(phoneOf(view.sel == null ? null : plots[view.sel])).then(done, fallback); } catch (err) { fallback(); }
    return;
  }
  if ((b.id === 'shareBtn' || b.id === 'shareTop') && view.sel != null) { openShare(plots[view.sel]); return; }
  if ((b.id === 'dlPlot' || b.id === 'dlPlotTop') && view.sel != null) { const p = plots[view.sel]; exportPdf(b, () => docOf(p) ? docFile(p) : plotPdf(p), FILE + '-plot-' + p.n + '.pdf'); return; }
  if (b.id === 'dlPlan') { exportPdf(b, planPdf, FILE + '-plan-' + state.updated + '.pdf'); return; }
  if (b.id === 'pzTop' && designer && !admin && view.sel != null) { openAd(plots[view.sel]); return; }
  if (b.dataset.pdcopy !== undefined) { copyFrom(b, b.dataset.pdcopy, 'نسخ الرابط'); return; }
  if (admin) adminClick(b);
});

/* ---------- admin editing ---------- */
const dirty = () => JSON.stringify(state) !== savedJson;
function entry(p) { return state.plots[p.key] || (state.plots[p.key] = {}); }
function tidy(p) {
  const e = state.plots[p.key]; if (!e) return;
  if (!(e.ppf > 0)) delete e.ppf; if (!(e.total > 0)) delete e.total; if (!(e.ft > 0)) delete e.ft; if (!e.inst || !e.inst.length) delete e.inst; if (!e.s) delete e.s;
  if (!Object.keys(e).length) delete state.plots[p.key];
}
/* one-step undo: every change to the plan's data is remembered (typing in one box counts as one step) */
let undoStack = [], undoCur = JSON.stringify(state), undoKey = '', undoT = 0, editKey = '';
function noteUndo() {
  const now = JSON.stringify(state); if (now === undoCur) return;
  const t = Date.now();
  if (!(editKey && editKey === undoKey && t - undoT < 1500)) { undoStack.push(undoCur); if (undoStack.length > 80) undoStack.shift(); }
  undoKey = editKey; undoT = t; undoCur = now;
}
function resetUndo() { undoStack = []; undoCur = JSON.stringify(state); undoKey = ''; }
function undoStep() {
  if (!undoStack.length || saving) return;
  state = JSON.parse(undoStack.pop()); undoCur = JSON.stringify(state); undoKey = ''; editKey = '';
  applyAreas(); plots.forEach((q, i) => refreshPlot(i)); chrome(); afterEdit(true);
  toast(undoStack.length ? 'تم التراجع عن آخر خطوة.' : 'تم التراجع. لا توجد خطوات أخرى للتراجع عنها.');
}
function adminBar() {
  noteUndo();
  const d = dirty(), st = $('adminSt');
  st.textContent = d ? 'تعديلات غير محفوظة' : 'لا توجد تعديلات';
  st.className = 'st' + (d ? ' dirty' : '');
  $('saveBtn').disabled = !d || saving; if ($('quietBtn')) $('quietBtn').disabled = !d || saving; $('revertBtn').disabled = !d || saving; $('undoBtn').disabled = !undoStack.length || saving;
  $('exitBtn').textContent = 'خروج';
}
function afterEdit(structural) {
  if (view.sel != null) refreshPlot(view.sel);
  rebuildPins(); applyFilters(); adminBar();
  const p = view.sel == null ? null : plots[view.sel];
  if (structural || !p) { const y = body.scrollTop; render(); body.scrollTop = y; }
  else { $('dHead').innerHTML = head(p); $('pview').innerHTML = priceView(p); calcLine(p); genCalc(); }
}
function adminClick(b) {
  const p = view.sel == null ? null : plots[view.sel]; editKey = '';
  if ((b.id === 'pzMake' || b.id === 'pzTop') && p) { openAd(p); return; }
  if (b.id === 'landImpAll' || (b.id === 'landImp' && p)) { if (uploading || landBusy) return; landFor = b.id === 'landImp' ? p : null; $('landFile').value = ''; $('landFile').click(); return; }
  if (b.dataset.bulk !== undefined) {
    const d = b.dataset.bulk;
    Object.keys(state.plots).forEach(n => { const e = state.plots[n]; if (e.inst) { e.inst = e.inst.filter(x => x[0] !== d); if (!e.inst.length) delete e.inst; } });
    plots.forEach((q, i) => refreshPlot(i)); afterEdit(true); toast('حُذف القسط من كل القطع. اضغط «حفظ ونشر» لتثبيته.'); return;
  }
  const gk = b.dataset.upg || b.dataset.rmg || b.dataset.offg;
  if (gk && BLD_NAME[gk]) {
    if (b.dataset.upg) { pickFile({kind: 'img', tag: gk, done: f => { (state.bld = state.bld || {})[gk] = f; }}, b); return; }
    if (b.dataset.offg) (state.bld = state.bld || {})[gk] = {off: 1};
    else if (state.bld) { delete state.bld[gk]; if (!Object.keys(state.bld).length) delete state.bld; }
    afterEdit(true); return;
  }
  if (!p || p.am) return;
  if (b.dataset.up === 'plan') { pickFile({kind: 'plan', tag: p.n, plot: p}, b); return; }
  if (b.dataset.up === 'doc') { pickFile({kind: 'pdf', tag: p.n, done: f => { const e = entry(p); e.doc = f; delete e.plan; }}, b); return; }
  if (b.dataset.up === 'img') { pickFile({kind: 'img', tag: p.n, done: f => { const e = entry(p); e.img = f; delete e.noimg; }}, b); return; }
  if (b.dataset.rm === 'doc' || b.dataset.rm === 'img' || b.dataset.rm === 'plan') { const e = entry(p); delete e[b.dataset.rm]; tidy(p); afterEdit(true); return; }
  if (b.dataset.noimg !== undefined) { const e = entry(p); if (b.dataset.noimg === '1') { e.noimg = 1; delete e.img; } else delete e.noimg; tidy(p); afterEdit(true); return; }
  if (b.id === 'gMake') {
    const e = entry(p), total = +e.total || 0, first = $('gDate').value, n = +$('gN').value || 1, step = +$('gStep').value || 6;
    if (!(total > 0)) { toast('اكتب السعر الإجمالي أولًا.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) { toast('اختر تاريخ أول قسط.'); return; }
    const each = Math.round(+$('gAmt').value || 0), down = total - n * each, inst = [];
    if (!(each > 0)) { toast('اكتب قيمة القسط.'); return; }
    if (down <= 0) { toast('مجموع الأقساط أكبر من السعر الإجمالي أو يساويه.'); return; }
    for (let k = 0; k < n; k++) inst.push([addMonths(first, k * step), each]);
    e.inst = inst; tidy(p); afterEdit(true);
    toast('تم إنشاء ' + n + (n === 1 ? ' قسط' : ' أقساط') + ' · الدفعة المقدمة ' + fmt(down) + ' درهم. اضغط «حفظ».'); return;
  }
  if (b.id === 'edCopyBtn') {
    const v = ($('edCopy').value || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
    const src = byNo.has(v) ? plots[byNo.get(v)] : null, se = src && ent(src);
    if (!v) { toast('اكتب رقم الأرض المراد النسخ منها.'); return; }
    if (!src || src.am) { toast('لا توجد قطعة بالرقم ' + v + ' في هذا المخطط.'); return; }
    if (src === p) { toast('هذه هي نفس القطعة.'); return; }
    if (!se || !(se.s || se.ppf || se.total || (se.inst && se.inst.length))) { toast('القطعة ' + v + ' ليس لها بيانات لنسخها.'); return; }
    const e = entry(p);
    ['s', 'ppf', 'total', 'inst'].forEach(k => { delete e[k]; });
    if (se.s) e.s = se.s;
    if (se.ppf) e.ppf = se.ppf;
    if (se.total) e.total = se.ppf && src.ft !== p.ft ? Math.round(se.ppf * p.ft) : se.total;   // a plot of another size: the price per foot on this plot's area
    if (se.inst && se.inst.length) e.inst = se.inst.map(x => [x[0], x[1]]);
    tidy(p); afterEdit(true); toast('نُسخت بيانات القطعة ' + v + ' إلى القطعة ' + p.n + '. راجعها ثم اضغط «حفظ».'); return;
  }
  if (b.dataset.fe !== undefined) { const e = entry(p); if (e.fe) delete e.fe; else e.fe = 1; tidy(p); afterEdit(true); return; }
  if (b.dataset.st !== undefined) { const e = entry(p); if (b.dataset.st) e.s = b.dataset.st; else delete e.s; tidy(p); afterEdit(true); return; }
  if (b.dataset.del !== undefined) { const e = entry(p); (e.inst || []).splice(+b.dataset.del, 1); tidy(p); afterEdit(true); return; }
  if (b.id === 'edAdd') {
    const e = entry(p), last = (e.inst || []).slice(-1)[0]; let d = '';
    if (last && /^\d{4}-\d{2}-\d{2}$/.test(last[0])) { const t = new Date(last[0] + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() + 6); d = t.toISOString().slice(0, 10); }
    (e.inst = e.inst || []).push([d, 0]); afterEdit(true); return;
  }
  if (b.id === 'edClear') { const e = entry(p); delete e.ppf; delete e.total; delete e.inst; tidy(p); afterEdit(true); }
}
body.addEventListener('input', e => {
  if (!admin) return;
  const t = e.target; editKey = t.id || '';
  if (t.id === 'setPhone') { state.phone = t.value.trim(); adminBar(); return; }
  if (t.id === 'setLoc') { state.loc = t.value.trim(); chrome(); adminBar(); return; }
  if (t.id === 'setLink') { const v = t.value.trim(); if (v && v !== PAGE_LINK) state.link = v; else delete state.link; adminBar(); return; }
  const p = view.sel == null ? null : plots[view.sel]; if (!p || p.am || !t.closest('#edit')) return;
  const en = entry(p), v = Math.max(0, parseFloat(t.value) || 0);
  if (t.id === 'gAmt') { genCalc(); return; }
  if (t.id === 'edLo') { const v = t.value.trim(); if (/^https:\/\/[^\s"<>]+$/.test(v)) en.lo = v; else delete en.lo; t.classList.toggle('bad', !!v && !en.lo); tidy(p); adminBar(); return; }
  if (t.id === 'edLb') {
    const v = t.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '').slice(0, 6);
    const clash = v && plots.some(q => q !== p && q.n === v);
    if (v && !clash) en.lb = v; else delete en.lb;
    t.classList.toggle('bad', !!clash); if (clash) toast('الرقم ' + v + ' مستخدم لقطعة أخرى في هذا المخطط.');
    tidy(p); refreshPlot(view.sel); $('dHead').innerHTML = head(p); adminBar(); return;
  }
  if (t.id === 'edPh') { const ph = t.value.replace(/[^0-9+ ]/g, '').trim(); if (ph) en.ph = ph; else delete en.ph; adminBar(); return; }
  if (t.id === 'edFt') {
    if (v >= 1) en.ft = Math.round(v); else delete en.ft;
    applyAreas(); if (en.ppf > 0) { en.total = Math.round(en.ppf * p.ft); $('edTotal').value = en.total; }
    afterEdit(false); return;
  }
  if (t.id === 'edPpf') { en.ppf = v; en.total = Math.round(v * p.ft); $('edTotal').value = en.total || ''; }
  else if (t.id === 'edTotal') { en.total = Math.round(v); en.ppf = Math.round(v / p.ft); $('edPpf').value = en.ppf || ''; }
  else if (t.dataset.k !== undefined && en.inst && en.inst[+t.dataset.k]) { if (t.dataset.f === 'd') en.inst[+t.dataset.k][0] = t.value; else en.inst[+t.dataset.k][1] = Math.round(v); }
  else return;
  if (en.total > 0 && !en.s) { en.s = 'av'; body.querySelectorAll('#edit [data-st]').forEach(x => x.setAttribute('aria-pressed', x.dataset.st === 'av')); }
  afterEdit(false);
});
body.addEventListener('change', e => { if (e.target.id === 'gN') genCalc(); if (admin && view.sel != null && e.target.closest('#edit')) { const p = plots[view.sel]; tidy(p); if (e.target.id === 'edFt') afterEdit(true); else adminBar(); } });

/* uploads go to the site's media library; the plan only remembers which file belongs where, and it is published with «حفظ» */
let upCtx = null, uploading = false;
const upInput = $('upFile');
function pickFile(ctx, btn) {
  if (uploading || !SITE) return;
  upCtx = ctx; ctx.btn = btn;
  upInput.accept = ctx.kind === 'pdf' ? 'application/pdf,.pdf' : ctx.kind === 'plan' ? 'application/pdf,.pdf,image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp';
  upInput.value = ''; upInput.click();
}
const UPERR = {
  forbidden: 'انتهت جلسة الدخول أو لا تملك صلاحية رفع الملفات. حدّث الصفحة وسجّل دخولك ثم أعد المحاولة.',
  type: 'نوع الملف غير مقبول. مخطط الأرض بصيغة PDF أو صورة، وصورة المبنى بصيغة JPG أو PNG أو WebP.',
  too_big: 'حجم الملف أكبر من الحد المسموح للرفع على الموقع.',
  upload: 'تعذّر رفع الملف. تحقق من الاتصال ثم حاول مرة أخرى.'
};
const upMsg = err => (UPERR[err && err.code] || UPERR.upload) + (err && err.msg ? ' (' + err.msg + ')' : '');
async function uploadBlob(blob, name, kind, tag) {
  const fd = new FormData(); fd.set('action', 'dn_upload'); fd.set('project', SITE.project || 'dabdaba-north'); fd.set('nonce', siteNonce); fd.set('kind', kind); fd.set('for', tag || ''); fd.set('name', name); fd.set('file', blob, name);
  const r = await fetch(SITE.ajax, {method: 'POST', credentials: 'same-origin', body: fd});
  let j = null; try { j = await r.json(); } catch (e3) {}
  if (!r.ok || !j || !j.success || !j.data || !fileUrl(j.data)) throw {code: (j && j.data && j.data.code) || (r.status === 403 ? 'forbidden' : r.status === 413 ? 'too_big' : 'upload'), msg: j && j.data && j.data.msg};
  return j.data;
}
upInput.addEventListener('change', async () => {
  const f = upInput.files && upInput.files[0], ctx = upCtx; upCtx = null;
  if (!f || !ctx || uploading) return;
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name), isImg = /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);
  if (ctx.kind === 'pdf' ? !isPdf : ctx.kind === 'plan' ? !(isPdf || isImg) : !isImg) { showErr(UPERR.type); return; }
  if (ctx.kind === 'plan') { openPrep(ctx.plot, f, isPdf); return; }
  if (siteMax && f.size > siteMax) { showErr(UPERR.too_big + ' (الحد ' + fmt(Math.floor(siteMax / 1048576)) + ' م.ب)'); return; }
  uploading = true; showErr('');
  const label = ctx.btn && ctx.btn.isConnected ? ctx.btn.textContent : ''; if (label) { ctx.btn.textContent = 'جارٍ الرفع…'; ctx.btn.disabled = true; }
  try {
    ctx.done(await uploadBlob(f, f.name, ctx.kind, ctx.tag)); uploading = false; afterEdit(true); toast('تم رفع الملف. اضغط «حفظ» ليظهر للزوار.');
  } catch (err) {
    uploading = false; showErr(upMsg(err));
    if (label && ctx.btn.isConnected) { ctx.btn.textContent = label; ctx.btn.disabled = false; }
  }
});

/* ---------- admin: preparing a plot's plan from the document the admin has ----------
   The document (the official site plan, usually a scan) never leaves the admin's browser as it is: the page is drawn here,
   the admin confirms which part shows the plot, and only that cut-out — plus, if wanted, the last page — is uploaded as pictures. */
let pdfjsP = null, prep = null;
function loadPdfjs() {
  if (!SITE || !SITE.pdfjs) return Promise.reject(new Error('pdfjs'));
  return pdfjsP || (pdfjsP = new Promise((ok, no) => {
    const el = document.createElement('script'); el.src = SITE.pdfjs.lib;
    el.onload = () => { const L = window.pdfjsLib; if (!L) { pdfjsP = null; no(new Error('pdfjs')); return; } L.GlobalWorkerOptions.workerSrc = SITE.pdfjs.worker; ok(L); };
    el.onerror = () => { pdfjsP = null; no(new Error('pdfjs')); };
    document.head.appendChild(el);
  }));
}
async function openSource(file, isPdf) {   // → {n pages, render(i, width) → canvas}
  if (isPdf) {
    const L = await loadPdfjs(), doc = await L.getDocument({data: await file.arrayBuffer()}).promise;
    return {n: doc.numPages, render: async (i, width) => {
      const pg = await doc.getPage(i + 1), v0 = pg.getViewport({scale: 1}), vp = pg.getViewport({scale: width / v0.width});
      const [cv, c] = canvas(Math.round(vp.width), Math.round(vp.height), '#fff');
      await pg.render({canvasContext: c, viewport: vp}).promise; return cv;
    }};
  }
  const im = new Image(); im.src = URL.createObjectURL(file); await im.decode();
  return {n: 1, render: async (i, width) => { const w = Math.min(width, im.naturalWidth * 2), [cv, c] = canvas(Math.round(w), Math.round(w * im.naturalHeight / im.naturalWidth), '#fff'); c.drawImage(im, 0, 0, cv.width, cv.height); return cv; }};
}
/* Where the plot drawing sits on a page, as fractions of the page. On the standard site-plan form the drawing lies in the large
   empty box between the header and the table, below the barcode band; elsewhere the answer is simply where the ink is. */
function autoCrop(cv) {
  // read at twice the working grid and keep the darkest of each 2×2, so thin lines survive; "dark" is measured against the paper's own tone
  const W = 360, H = Math.max(8, Math.round(cv.height * W / cv.width)), [t, c] = canvas(W * 2, H * 2, '#fff');
  c.drawImage(cv, 0, 0, W * 2, H * 2);
  const d = c.getImageData(0, 0, W * 2, H * 2).data, lum = new Uint8Array(W * H * 4), hist = new Uint32Array(256), dark = new Uint8Array(W * H);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) { const v = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; lum[j] = v; hist[v]++; }
  let paper = 255; for (let acc = 0; paper > 0; paper--) { acc += hist[paper]; if (acc > lum.length * 0.4) break; }
  const thr = Math.min(185, paper - 45);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * 2) * (W * 2) + x * 2; dark[y * W + x] = Math.min(lum[j], lum[j + 1], lum[j + W * 2], lum[j + W * 2 + 1]) < thr ? 1 : 0; }
  const rules = [];   // rows crossed by a long horizontal rule (a column counts if it is dark within ±3 rows, so a tilted scan still qualifies)
  for (let y = 3; y < H - 3; y++) { let n = 0; for (let x = 0; x < W; x++) { let on = 0; for (let k = -3; k <= 3; k++) on |= dark[(y + k) * W + x]; n += on; } if (n > W * 0.66) rules.push(y); }
  let ya = 0, yb = 0;
  for (let i = 1; i < rules.length; i++) if (rules[i] - rules[i - 1] > yb - ya) { ya = rules[i - 1]; yb = rules[i]; }
  // the form is recognised by its large empty box: a tall gap between two rules, closed by the frame's vertical lines on both sides
  let ok = yb - ya >= H * 0.35, left = -1, right = -1;
  if (ok) {
    ya += 4; yb -= 4;
    for (let x = 0; x < W; x++) { let n = 0; for (let y = ya; y < yb; y++) n += dark[y * W + x] | (x > 0 ? dark[y * W + x - 1] : 0) | (x < W - 1 ? dark[y * W + x + 1] : 0); if (n > (yb - ya) * 0.6) { if (x < W * 0.35) left = x; else if (x > W * 0.65 && right < 0) right = x; } }
    ok = left >= 0 && right >= 0;
  }
  let x0 = Math.round(W * 0.02), x1 = Math.round(W * 0.98), y0 = Math.round(H * 0.02), y1 = Math.round(H * 0.98);
  if (ok) {
    x0 = left + Math.round(W * 0.025); x1 = right - Math.round(W * 0.025);
    y0 = ya + Math.round((yb - ya) * 0.19); y1 = yb - Math.round((yb - ya) * 0.06);
  }
  let bx0 = x1, bx1 = x0, by0 = y1, by1 = y0;
  for (let x = x0; x < x1; x++) { let n = 0; for (let y = y0; y < y1; y++) n += dark[y * W + x]; if (n >= 2) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; } }
  for (let y = y0; y < y1; y++) { let n = 0; for (let x = x0; x < x1; x++) n += dark[y * W + x]; if (n >= 2) { if (y < by0) by0 = y; if (y > by1) by1 = y; } }
  t.width = t.height = 1;
  if (bx1 <= bx0 || by1 <= by0) { bx0 = x0; bx1 = x1; by0 = y0; by1 = y1; }
  const px = Math.round((x1 - x0) * 0.04), py = Math.round((y1 - y0) * 0.04);
  bx0 = Math.max(x0, bx0 - px); bx1 = Math.min(x1, bx1 + px); by0 = Math.max(y0, by0 - py); by1 = Math.min(y1, by1 + py);
  return {x: bx0 / W, y: by0 / H, w: (bx1 - bx0) / W, h: (by1 - by0) / H, ok};
}
function cleanScan(cv) {   // paper to white, ink a little darker; colours keep their hue
  const c = cv.getContext('2d'), im = c.getImageData(0, 0, cv.width, cv.height), d = im.data, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = (v - 35) * 255 / (226 - 35);
  for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  c.putImageData(im, 0, 0);
}
const blobOf = (cv, q) => new Promise((ok, no) => cv.toBlob(b => b ? ok(b) : no(new Error('canvas')), 'image/jpeg', q));
function placeCrop() { const el = $('pbCrop'), k = prep.crop; el.style.left = k.x * 100 + '%'; el.style.top = k.y * 100 + '%'; el.style.width = k.w * 100 + '%'; el.style.height = k.h * 100 + '%'; }
async function prepShow(i, fresh) {
  const src = prep.src, cv = await src.render(i, 900), shown = $('pbCanvas');
  if (!prep || prep.src !== src) return;
  prep.page = i; shown.width = cv.width; shown.height = cv.height; shown.getContext('2d').drawImage(cv, 0, 0);
  if (fresh || !prep.crops[i]) prep.crops[i] = autoCrop(cv);
  cv.width = cv.height = 1;
  prep.crop = Object.assign({}, prep.crops[i]); placeCrop();
  $('pbPage').textContent = 'صفحة ' + (i + 1) + ' من ' + src.n; $('pbPrev').disabled = i <= 0; $('pbNext').disabled = i >= src.n - 1;
  const can = src.n > 1 && i !== src.n - 1, box = $('pbLast');
  box.disabled = !can; if (!can) box.checked = false; else if (prep.wantLast) box.checked = true;
  $('pbLastText').textContent = src.n > 1 ? 'إضافة الصفحة الأخيرة من الملف (صفحة ' + src.n + ') كما هي' : 'الملف صفحة واحدة، فلا توجد صفحة أخيرة تُضاف';
}
async function openPrep(p, file, isPdf) {
  showErr(''); toast('جارٍ فتح الملف…');
  try {
    const src = await openSource(file, isPdf);
    prep = {p, src, page: 0, crops: {}, crop: null, busy: false, wantLast: true};
    let pick = src.n > 1 ? src.n - 2 : 0;   // the plan is normally the page before the conditions page; prefer the first page that has the form's layout
    for (let i = 0; i < Math.min(src.n, 8) && !(src.n > 1 && i === src.n - 1); i++) { const cv = await src.render(i, 900), a = autoCrop(cv); cv.width = cv.height = 1; prep.crops[i] = a; if (a.ok) { pick = i; break; } }
    $('pbTitle').textContent = 'تجهيز مخطط الأرض · قطعة ' + p.n; $('pbErr').hidden = true; $('pbOk').textContent = 'اعتماد ورفع'; $('pbOk').disabled = false;
    $('planbox').hidden = false; await prepShow(pick);
  } catch (err) { prep = null; $('planbox').hidden = true; showErr(isPdf && (!SITE || !SITE.pdfjs) ? 'قراءة ملفات PDF غير متاحة في هذه النسخة. ارفع صورة للمخطط بدلًا من ذلك.' : 'تعذّر فتح الملف. تأكد أنه ملف PDF أو صورة سليمة ثم أعد المحاولة.'); }
}
function closePrep() { prep = null; $('planbox').hidden = true; const v = $('pbCanvas'); v.width = v.height = 1; }
$('pbCancel').onclick = () => { if (!prep || !prep.busy) closePrep(); };
$('pbPrev').onclick = () => { if (prep && !prep.busy && prep.page > 0) prepShow(prep.page - 1); };
$('pbNext').onclick = () => { if (prep && !prep.busy && prep.page < prep.src.n - 1) prepShow(prep.page + 1); };
$('pbAuto').onclick = () => { if (prep && !prep.busy) prepShow(prep.page, true); };
$('pbLast').onchange = () => { if (prep) prep.wantLast = $('pbLast').checked; };
(function cropDrag() {
  const el = $('pbCrop'), stage = $('pbStage'); let g = null;
  el.addEventListener('pointerdown', e => {
    if (!prep || prep.busy) return;
    const r = stage.getBoundingClientRect(); g = {h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, k: Object.assign({}, prep.crop), w: r.width, hh: r.height};
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!g || !prep) return;
    const dx = (e.clientX - g.x) / g.w, dy = (e.clientY - g.y) / g.hh, k = g.k, min = 0.06; let x0 = k.x, y0 = k.y, x1 = k.x + k.w, y1 = k.y + k.h;
    if (g.h === 'move') { const mx = Math.min(1 - x1, Math.max(-x0, dx)), my = Math.min(1 - y1, Math.max(-y0, dy)); x0 += mx; x1 += mx; y0 += my; y1 += my; }
    else {
      if (g.h[1] === 'w') x0 = Math.min(x1 - min, Math.max(0, x0 + dx)); else x1 = Math.max(x0 + min, Math.min(1, x1 + dx));
      if (g.h[0] === 'n') y0 = Math.min(y1 - min, Math.max(0, y0 + dy)); else y1 = Math.max(y0 + min, Math.min(1, y1 + dy));
    }
    prep.crop = {x: x0, y: y0, w: x1 - x0, h: y1 - y0}; prep.crops[prep.page] = Object.assign({ok: true}, prep.crop); placeCrop();
  });
  const end = () => { g = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();
$('pbOk').onclick = async () => {
  if (!prep || prep.busy) return;
  const job = prep, {p, src} = job, cr = job.crop, ok = $('pbOk'), err = $('pbErr');
  job.busy = true; err.hidden = true; ok.disabled = true; ok.textContent = 'جارٍ التجهيز والرفع…';
  try {
    const big = await src.render(job.page, Math.min(2600, Math.round(1500 / Math.max(0.15, cr.w))));
    const [cv, c] = canvas(Math.max(1, Math.round(cr.w * big.width)), Math.max(1, Math.round(cr.h * big.height)), '#fff');
    c.drawImage(big, -Math.round(cr.x * big.width), -Math.round(cr.y * big.height)); big.width = big.height = 1; cleanScan(cv);
    const sk = await uploadBlob(await blobOf(cv, 0.9), 'sketch-' + p.n + '.jpg', 'plan', p.n); cv.width = cv.height = 1;
    let last = null;
    if ($('pbLast').checked && !$('pbLast').disabled) { const lv = await src.render(src.n - 1, 1500); cleanScan(lv); last = await uploadBlob(await blobOf(lv, 0.86), 'conditions-' + p.n + '.jpg', 'plan', p.n); lv.width = lv.height = 1; }
    const e = entry(p); e.plan = last ? {sk, last} : {sk}; delete e.doc;
    closePrep(); afterEdit(true); toast('تم تجهيز مخطط الأرض. اضغط «حفظ» ليظهر للزوار.');
  } catch (e2) {
    job.busy = false; ok.disabled = false; ok.textContent = 'اعتماد ورفع';
    err.textContent = e2 && e2.code ? upMsg(e2) : 'تعذّر تجهيز الملف. حاول مرة أخرى.'; err.hidden = false;
  }
};

function setAdmin(on) {
  admin = on; $('adminbar').hidden = !on; $('adminBtn').setAttribute('aria-pressed', on); resetUndo();
  $('adminErr').hidden = true; adminBar(); render();
  if (lastW) apply();
}
$('adminBtn').onclick = () => { if (admin && dirty()) { toast('لديك تعديلات غير محفوظة. احفظها أو تراجع عنها أولًا.'); return; } setAdmin(!admin); };
$('exitBtn').onclick = () => { if (dirty()) { toast('لديك تعديلات غير محفوظة. احفظها أو تراجع عنها أولًا.'); return; } setAdmin(false); };
$('undoBtn').onclick = undoStep;
document.addEventListener('keydown', e => {
  if (!admin || !(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key !== 'z' && e.key !== 'Z' && e.key !== 'ظ')) return;
  const t = e.target; if (!$('pzbox').hidden || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.type !== 'checkbox')) return;   // inside a text box the browser's own undo applies
  e.preventDefault(); undoStep();
});
$('revertBtn').onclick = () => { state = JSON.parse(savedJson); resetUndo(); applyAreas(); plots.forEach((q, i) => refreshPlot(i)); chrome(); afterEdit(true); toast('أُلغيت التعديلات غير المحفوظة.'); };

/* ---------- save: regenerate the document from its blocks and publish it ---------- */
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n';
const HEAD = '<title>مخطط ' + PROJECT + '</title>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Tajawal:wght@400;500;700&display=swap">\n';
const block = (id, json) => '<script type="application/json" id="' + id + '">' + json + '<\/script>\n';
function documentHtml() {
  return SKELETON + HEAD + '<style id="css">' + read('css') + '</style>\n<div id="root"></div>\n' +
    block('assets', read('assets')) + block('plan', read('plan')) + block('state', JSON.stringify(state).replace(/</g, '\\u003c')) +
    '<script id="main">' + read('main') + '<\/script>\n\n</body></html>';
}
const ERR = {
  conflict: 'نُشرت نسخة أحدث من مكان آخر. ستُحدَّث الصفحة الآن، أعد التعديل بعدها.',
  too_large: 'حجم الصفحة تجاوز الحد المسموح، فلم يُحفظ التعديل.',
  rate_limited: 'محاولات حفظ متتالية كثيرة. انتظر قليلًا ثم احفظ مرة أخرى.',
  readonly: 'هذا العرض للقراءة فقط. افتح الصفحة من حساب مالكها أو محرر فيها لحفظ التعديلات.',
  forbidden: 'انتهت جلسة الدخول أو لا تملك صلاحية التعديل. حدّث الصفحة وسجّل دخولك في الموقع ثم أعد المحاولة.',
  site_conflict: 'حُفظت نسخة أحدث من جهاز آخر. حدّث الصفحة ثم أعد تعديلك.',
  invalid: 'رفض الموقع البيانات المرسلة. حدّث الصفحة ثم أعد المحاولة.',
  other: 'تعذّر الحفظ. تحقق من الاتصال ثم حاول مرة أخرى.'
};
let saving = false;
const SAVE_LABEL = SITE ? 'حفظ' : 'حفظ ونشر';
function showErr(t) { const el = $('adminErr'); el.textContent = t; el.hidden = !t; }
$('saveBtn').onclick = () => doSave(false);
if ($('quietBtn')) $('quietBtn').onclick = () => doSave(true);
async function doSave(quiet) {
  if (saving || !dirty()) return;
  const bad = plots.find(p => { const pr = priceOf(p); return pr && pr.down < 0; });
  if (bad) { showErr('مجموع الأقساط أكبر من السعر الإجمالي في القطعة ' + bad.n + '. صحّحها ثم احفظ.'); select(byNo.get(bad.n), true); return; }
  showErr(''); saving = true; adminBar(); $('saveBtn').textContent = 'جارٍ النشر…';
  const prevUpd = state.updated, now = new Date();
  state.updated = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  try {
    if (SITE) {
      const body = new URLSearchParams(); body.set('action', 'dn_save'); body.set('project', SITE.project || 'dabdaba-north'); body.set('nonce', siteNonce); body.set('rev', String(siteRev)); body.set('state', JSON.stringify(state)); if (quiet) body.set('quiet', '1');
      const r = await fetch(SITE.ajax, {method: 'POST', credentials: 'same-origin', body});
      let j = null; try { j = await r.json(); } catch (e3) {}
      if (!r.ok || !j || !j.success) { const c = j && j.data && j.data.code; throw {code: c === 'conflict' ? 'site_conflict' : c || (r.status === 403 ? 'forbidden' : 'other')}; }
      siteRev = j.data.rev; state = j.data.state; savedJson = JSON.stringify(state); resetUndo(); applyAreas();
      plots.forEach((q, i) => refreshPlot(i)); chrome(); afterEdit(true); toast(quiet ? 'تم الحفظ بدون إرسال إشعار للتطبيق.' : 'تم الحفظ. يرى زوار الموقع التحديث الآن.');
      saving = false; $('saveBtn').textContent = SAVE_LABEL; adminBar(); return;
    }
    const art = window.claude && window.claude.use ? await window.claude.use('artifact') : null;
    if (!art) throw {code: 'not_granted'};
    try { sessionStorage.setItem('dn-stash', JSON.stringify({admin: true, sel: view.sel, s: view.s, tx: view.tx, ty: view.ty})); } catch (err) {}
    await art.publish(documentHtml());
    savedJson = JSON.stringify(state); chrome(); toast('تم الحفظ والنشر. يرى الزوار التحديث الآن.');
  } catch (err) {
    state.updated = prevUpd;
    const c = err && err.code;
    showErr(ERR[c] || (['not_writer', 'not_granted', 'not_declared', 'consent_required', 'capability_disabled', 'capability_removed'].includes(c) ? ERR.readonly : ERR.other));
    if (c !== 'conflict') { try { sessionStorage.removeItem('dn-stash'); } catch (e2) {} }
  }
  saving = false; $('saveBtn').textContent = SAVE_LABEL; adminBar();
}

/* ---------- PDF export ---------- */
let dl = null, exporting = false;
const SHICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.6a3 3 0 0 0 0-1.2l6.7-3.6A3 3 0 1 0 15 7c0 .2 0 .4.1.6l-6.7 3.6a3 3 0 1 0 0 3.6l6.7 3.6A3 3 0 1 0 18 16z"/></svg>';
const PAGE_LINK = CFG.link || (CFG.types ? location.href.split('#')[0] : 'https://claude.ai/artifact/D8ZU7L8GVcYj9Whn4tABf4');
const DOCICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5zM7 12v2h10v-2zm0 4v2h7v-2z"/></svg>';
const DLICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4L11 12.2zM5 18h14v2H5z"/></svg>';
const PC = Object.fromEntries(Object.keys(TYPES).map(t => [t, TYPES[t].c]));
const SC = {av:[18,36,63], res:[0,160,64], sold:[225,6,0]};
const NAVY = '#12243F', GOLD = '#C9A24A', INK = '#12243F', MUTED = '#56667E', LINE = '#D5DCE6';
const rgb = a => 'rgb(' + a.join(',') + ')';
const FD = (w, px) => w + ' ' + px + 'px "DNP Tajawal", Tajawal, "Segoe UI", Tahoma, sans-serif';
const FB = (w, px) => w + ' ' + px + 'px "DNP Tajawal", Tajawal, "Segoe UI", Tahoma, sans-serif';
const LTR = s => '⁦' + s + '⁩';
const fillOf = p => statusOf(p) ? SC[statusOf(p)] : PC[p.t];
const lightText = p => !!statusOf(p) || !!TYPES[p.t].light;

/* pages: [{W, H, images, content, links}] — each page has its own pictures (/Im0…), content stream and link areas */
function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0, next = 4;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const open = n => { offs[n] = len; push(n + ' 0 obj\n'); };
  pages.forEach(pg => { pg.id = next; pg.cid = next + 1; pg.img0 = next + 2; pg.an0 = pg.img0 + pg.images.length; next = pg.an0 + (pg.links || []).length; });
  const total = next;
  push('%PDF-1.4\n');
  open(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  open(2); push('<< /Type /Pages /Kids [' + pages.map(pg => pg.id + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>\nendobj\n');
  open(3); push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  pages.forEach(pg => {
    const links = pg.links || [], content = pg.content;
    open(pg.id); push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pg.W + ' ' + pg.H + '] /Resources << /Font << /F1 3 0 R >> /XObject << ' +
      pg.images.map((m, i) => '/Im' + i + ' ' + (pg.img0 + i) + ' 0 R').join(' ') + ' >> >> /Contents ' + pg.cid + ' 0 R /Annots [' + links.map((l, i) => (pg.an0 + i) + ' 0 R').join(' ') + '] >>\nendobj\n');
    const cb = content.bytes || enc.encode(content); open(pg.cid); push('<< /Length ' + cb.length + (content.flate ? ' /Filter /FlateDecode' : '') + ' >>\nstream\n'); push(cb); push('\nendstream\nendobj\n');
    pg.images.forEach((m, i) => { open(pg.img0 + i); push('<< /Type /XObject /Subtype /Image /Width ' + m.w + ' /Height ' + m.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + m.bytes.length + ' >>\nstream\n'); push(m.bytes); push('\nendstream\nendobj\n'); });
    links.forEach((l, i) => { open(pg.an0 + i); push('<< /Type /Annot /Subtype /Link /Rect [' + l.r.map(n => n.toFixed(2)).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI (' + l.url.replace(/[\\()]/g, '\\$&') + ') >> >>\nendobj\n'); });
  });
  const xref = len; let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, {type: 'application/pdf'});
}
const jpegOf = (cv, q) => new Promise((ok, no) => cv.toBlob(b => b ? b.arrayBuffer().then(a => ok({bytes: new Uint8Array(a), w: cv.width, h: cv.height})) : no(new Error('canvas')), 'image/jpeg', q || 0.9));
async function fontsReady() { try { await Promise.all([document.fonts.load(FD(800, 40), 'قطعة 123'), document.fonts.load(FD(700, 40), 'قطعة 123'), document.fonts.load(FB(500, 40), 'قطعة 123'), document.fonts.load(FB(700, 40), 'قطعة 123')]); } catch (err) {} }
function canvas(w, h, bg) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.direction = 'rtl'; c.textBaseline = 'alphabetic'; return [cv, c]; }
function txt(c, s, x, y, font, color, align) { c.font = font; c.fillStyle = color; c.textAlign = align || 'right'; c.fillText(s, x, y); }
function box(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function cover(c, img, x, y, w, h) {
  const iw = img.naturalWidth, ih = img.naturalHeight, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
  c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
let logoPlate = true;
function inspectLogo(im) {   // a logo made for dark headers (light or gold artwork) goes straight on the navy band; a dark one needs a white plate
  try {
    const w = 64, h = Math.max(1, Math.round(64 * im.naturalHeight / im.naturalWidth)), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.drawImage(im, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h).data; let op = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40) { op++; if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 110) dark++; }
    return op === 0 || dark / op > 0.12;
  } catch (err) { return true; }
}
function drawLogo(c, x, y, h) {   // the site's logo; false when there is none
  if (!logoImg || !logoImg.naturalWidth) return false;
  const pad = logoPlate ? Math.round(h * 0.1) : 0, r = logoImg.naturalWidth / logoImg.naturalHeight;
  let ih = h - 2 * pad, iw = ih * r; const maxW = h * 3.6;
  if (iw > maxW) { iw = maxW; ih = iw / r; }
  if (logoPlate) { c.fillStyle = '#fff'; box(c, x, y, iw + 2 * pad, h, 16); c.fill(); }
  c.drawImage(logoImg, x + pad, y + (h - ih) / 2, iw, ih); return true;
}
/* a picture that can be drawn into the PDF canvases: an uploaded one is fetched as a blob first, so it never taints the canvas */
const drawable = {};
async function imageOf(b) {
  const load = async (src, viaBlob) => {
    if (drawable[src]) return drawable[src];
    const im = new Image();
    im.src = viaBlob ? URL.createObjectURL(await (await fetch(src)).blob()) : src;
    await im.decode(); return (drawable[src] = im);
  };
  try { return await load(b.src, !!b.own); } catch (err) {}
  if (b.fallback) { try { return await load(b.fallback, false); } catch (err) {} }
  return null;
}

/* a close-up of the plan around one plot, drawn like the on-screen map */
function paintPlots(c, test, size) {
  const path = q => { c.beginPath(); q.p.forEach((v, i) => i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1])); c.closePath(); };
  c.direction = 'ltr';
  plots.forEach(q => {
    if (q.am || !test(q) || (V && !statusOf(q))) return;
    path(q); c.fillStyle = rgb(fillOf(q)); c.fill();
    if (statusOf(q)) { c.lineWidth = 1.1; c.strokeStyle = '#fff'; c.stroke(); }
    c.save(); c.translate(q.c[0], q.c[1]); c.rotate(q.r * Math.PI / 180);
    txt(c, q.n, 0, 1.6, FD(800, size), lightText(q) ? '#fff' : '#10151C', 'center'); c.restore();
  });
  c.direction = 'rtl';
  return path;
}
function drawSnippet(c, p, x, y, w, h) {
  const k = 3.2, uw = w / k, uh = h / k, x0 = p.c[0] - uw / 2, y0 = p.c[1] - uh / 2;
  c.save(); box(c, x, y, w, h, 18); c.clip(); c.translate(x, y); c.scale(k, k); c.translate(-x0, -y0);
  drawPlan(c, x0, y0, x0 + uw, y0 + uh, k);
  const path = paintPlots(c, q => Math.abs(q.c[0] - p.c[0]) <= uw / 2 + 40 && Math.abs(q.c[1] - p.c[1]) <= uh / 2 + 40, 4.5);
  path(p); c.lineJoin = 'round'; c.lineWidth = 4.4; c.strokeStyle = '#10151C'; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#fff'; c.stroke();
  const pr = statusOf(p) === 'av' ? priceOf(p) : null;
  if (pr) {   // the plot's price, in a tag right beside it
    let a = 1e9, b = 1e9, e = -1e9, d = -1e9; p.p.forEach(v => { a = Math.min(a, v[0]); b = Math.min(b, v[1]); e = Math.max(e, v[0]); d = Math.max(d, v[1]); });
    const t = fmt(pr.total) + ' درهم', fs = 9; c.font = FD(800, fs); const tw = c.measureText(t).width, bw = tw + 8, bh = fs * 1.9, cy = (b + d) / 2;
    let bx = e + 4; if (bx + bw > x0 + uw - 3) bx = a - 4 - bw;
    let by = cy - bh / 2; if (bx < x0 + 3) { bx = (a + e) / 2 - bw / 2; by = d + 4; if (by + bh > y0 + uh - 3) by = b - 4 - bh; }
    c.fillStyle = '#fff'; box(c, bx, by, bw, bh, 3); c.fill(); c.lineWidth = 1.2; c.strokeStyle = '#E1192D'; c.stroke();
    c.direction = 'rtl'; txt(c, t, bx + bw / 2, by + bh * 0.68, FD(800, fs), '#12243F', 'center');
  }
  c.restore();
}

async function plotPdf(p) {
  await fontsReady(); await logoReady; await vecReady; await bgReady;
  const W = 1654, H = 2339, M = 90, PW = 595.28, PH = 841.89, T = TYPES[p.t], st = statusOf(p), pr = st === 'av' ? priceOf(p) : null, kind = kindOf(p), pic = bldPic(p), bim = pic ? await imageOf(pic) : null, b = !!bim, doc = docOf(p);
  const [cv, c] = canvas(W, H, '#FFFFFF'), links = [];
  // header
  c.fillStyle = NAVY; c.fillRect(0, 0, W, 230); c.fillStyle = GOLD; c.fillRect(0, 230, W, 7);
  txt(c, 'مخطط ' + PROJECT, W - M, 112, FD(800, 68), '#fff'); txt(c, PLACE, W - M, 176, FB(500, 36), '#B9C6DA');
  if (!drawLogo(c, M, 34, 162)) { txt(c, 'عمر الياسي للعقارات', M, 108, FD(700, 46), '#fff', 'left'); c.direction = 'ltr'; txt(c, 'Omar Al Yassi Real Estate', M, 160, FB(400, 30), '#B9C6DA', 'left'); c.direction = 'rtl'; }
  // plot number + status
  txt(c, 'قطعة رقم', W - M, 330, FB(500, 38), MUTED); txt(c, p.n, W - M, 470, FD(800, 150), INK);
  const pillBg = st ? rgb(SC[st]) : '#EEF1F5', pillFg = st ? '#fff' : MUTED;
  c.fillStyle = pillBg; box(c, M, 300, 300, 84, 42); c.fill(); txt(c, st ? ST[st] : 'للاستفسار', M + 150, 357, FD(700, 40), pillFg, 'center');
  txt(c, [T.use, T.floors, kind].filter(Boolean).join(' · '), M, 462, FB(500, 38), MUTED, 'left');
  // pictures
  const top = 520, ph = 560, gap = 40, bw = b ? (W - 2 * M - gap) / 2 : W - 2 * M;
  drawSnippet(c, p, M, top, bw, ph);
  txt(c, 'موقع القطعة في المخطط', M + bw / 2, top + ph + 52, FB(500, 32), MUTED, 'center');
  if (b) {
    const im = bim, bx = M + bw + gap;
    c.save(); box(c, bx, top, bw, ph, 18); c.clip(); cover(c, im, bx, top, bw, ph); c.restore();
    txt(c, 'صورة تخيلية لشكل البناء', bx + bw / 2, top + ph + 52, FB(500, 32), MUTED, 'center');
  }
  // facts (right column)
  const cy = 1230, colR = W - M, colL = W / 2 + 30, rowH = 84;
  const facts = [['الاستخدام', T.use], ['الطوابق', T.floors]];
  if (kind) facts.push(['الموقع', kind]);
  facts.push(['المساحة', (p.ap ? '≈ ' : '') + fmt(p.ft) + ' قدم²  (' + fmt(p.m2) + ' م²)']);
  if (p.d) facts.push(['الأبعاد', (p.ir ? '≈ ' : '') + LTR(p.d[0].toFixed(2) + ' × ' + p.d[1].toFixed(2)) + ' م']);
  let docY = 0;
  if (doc) facts.push(['مخطط الأرض', 'ملف PDF ↗', 1]);
  facts.forEach((f, i) => {
    const y = cy + i * rowH; if (f[2]) docY = y;
    txt(c, f[0], colR, y + 54, FB(500, 36), MUTED); txt(c, f[1], colL, y + 54, FB(700, 38), INK, 'left');
    c.fillStyle = LINE; c.fillRect(colL, y + rowH - 2, colR - colL, 2);
  });
  // price (left column)
  const px = M, pw = W / 2 - 30 - M;
  if (pr) {
    c.fillStyle = NAVY; box(c, px, cy, pw, 250, 24); c.fill();
    txt(c, 'السعر الإجمالي', px + pw - 36, cy + 70, FB(500, 36), '#B9C6DA');
    txt(c, fmt(pr.total) + ' درهم', px + pw - 36, cy + 168, FD(800, 84), '#fff');
    if (pr.ppf) txt(c, 'سعر القدم ' + fmt(pr.ppf) + ' درهم', px + pw - 36, cy + 222, FB(500, 34), '#B9C6DA');
    const rows = pr.inst.length ? [['الدفعة المقدمة', pr.down]].concat(pr.inst.map(x => ['قسط ' + dstr(x.d), x.a])) : [];
    const rh = Math.min(78, 380 / Math.max(1, rows.length)), fs = Math.min(36, Math.round(rh * 0.48));
    rows.forEach((r, i) => {
      const y = cy + 266 + i * rh;
      txt(c, r[0], px + pw - 8, y + rh * 0.68, FB(500, fs), INK); txt(c, fmt(r[1]), px + 8, y + rh * 0.68, FD(700, fs + 2), INK, 'left');
      c.fillStyle = LINE; c.fillRect(px, y + rh - 2, pw, 2);
    });
  } else {
    c.fillStyle = '#F5F7FA'; box(c, px, cy, pw, 250, 24); c.fill();
    txt(c, st === 'sold' ? 'القطعة مباعة' : st === 'res' ? 'القطعة محجوزة حاليًا' : 'السعر عند الاستفسار', px + pw / 2, cy + 120, FD(700, 52), INK, 'center');
    if (st !== 'sold') txt(c, 'تواصل معنا لمعرفة السعر والتوفر', px + pw / 2, cy + 184, FB(500, 34), MUTED, 'center');
  }
  // contact
  const fy = 1960, bh = 124, half = (W - 2 * M - gap) / 2, toPt = (x, y, w, h) => [x * PW / W, PH - (y + h) * PH / H, (x + w) * PW / W, PH - y * PH / H];
  c.fillStyle = LINE; c.fillRect(M, fy - 50, W - 2 * M, 2);
  const wa = hasPhone(p) ? {r: toPt(M + half + gap, fy, half, bh), url: 'https://wa.me/' + waNumber(p) + '?text=' + encodeURIComponent('السلام عليكم، أرغب بالاستفسار عن القطعة رقم ' + p.n + ' في مخطط ' + PROJECT + '.')} : null;
  const locW = wa ? half : W - 2 * M;   // without a contact number the map button takes the whole row
  if (wa) {
    c.fillStyle = '#0F7F45'; box(c, M + half + gap, fy, half, bh, 22); c.fill();
    txt(c, 'واتساب  ' + LTR(phoneShown(p)), M + half + gap + half / 2, fy + 78, FD(700, 46), '#fff', 'center');
    links.push(wa);
  }
  const mapUrl = plotLoc(p) || locUrl();
  if (mapUrl) {
    c.strokeStyle = NAVY; c.lineWidth = 3; box(c, M, fy, locW, bh, 22); c.stroke();
    txt(c, plotLoc(p) ? 'موقع الأرض على الخريطة' : 'موقع المشروع على الخريطة', M + locW / 2, fy + 78, FD(700, 42), INK, 'center');
    links.push({r: toPt(M, fy, locW, bh), url: mapUrl});
  }
  txt(c, 'صورة المبنى تخيلية لتوضيح شكل البناء. ' + (CFG.areaNote || 'المساحات محسوبة من الأبعاد المدوّنة على المخطط.'), W / 2, fy + bh + 84, FB(400, 30), MUTED, 'center');
  txt(c, 'الأسعار والحالات بحسب آخر تحديث ' + dstr(state.updated), W / 2, fy + bh + 130, FB(400, 30), MUTED, 'center');
  const jpg = await jpegOf(cv);
  const spots = wa ? [{l: (M + half + gap) / W, t: fy / H, w: half / W, h: bh / H, url: wa.url, label: 'واتساب'}] : [];
  if (docY) { links.push({r: toPt(colL, docY, colR - colL, rowH), url: doc.u}); spots.push({l: colL / W, t: docY / H, w: (colR - colL) / W, h: rowH / H, url: doc.u, label: 'مخطط الأرض PDF'}); }
  if (mapUrl) spots.push({l: M / W, t: fy / H, w: locW / W, h: bh / H, url: mapUrl, label: plotLoc(p) ? 'موقع الأرض' : 'موقع المشروع'});
  spots.push({l: M / W, t: top / H, w: bw / W, h: ph / H, plot: p, label: 'عرض القطعة على المخطط'});
  const full = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q', pages = [{W: PW, H: PH, images: [jpg], content: full, links}];
  cv.width = cv.height = 1;
  // page 2: the plot's plan — the sketch the admin prepared from the official document, or one drawn from the project plan
  const pl = planOf(p), skIm = pl ? await imageOf({src: pl.sk.u, own: true}) : null;
  const band = (c2, title, sub) => {
    c2.fillStyle = NAVY; c2.fillRect(0, 0, W, 230); c2.fillStyle = GOLD; c2.fillRect(0, 230, W, 7);
    txt(c2, title, W - M, 112, FD(800, 68), '#fff'); txt(c2, sub, W - M, 176, FB(500, 36), '#B9C6DA');
    if (!drawLogo(c2, M, 34, 162)) { txt(c2, 'عمر الياسي للعقارات', M, 108, FD(700, 46), '#fff', 'left'); c2.direction = 'ltr'; txt(c2, 'Omar Al Yassi Real Estate', M, 160, FB(400, 30), '#B9C6DA', 'left'); c2.direction = 'rtl'; }
  };
  const foot = c2 => {
    c2.fillStyle = LINE; c2.fillRect(M, H - 190, W - 2 * M, 2);
    if (!wa) { txt(c2, 'عمر الياسي للعقارات', W - M, H - 110, FD(700, 40), INK); return null; }
    txt(c2, 'للاستفسار عبر واتساب:  ' + LTR(phoneShown(p)), W - M, H - 110, FD(700, 44), INK);
    txt(c2, 'عمر الياسي للعقارات', M, H - 110, FD(700, 40), INK, 'left');
    return {r: toPt(W - M - 900, H - 170, 900, 90), url: wa.url};
  };
  const fit = (c2, im, x, y, w, h) => { const k2 = Math.min(w / im.naturalWidth, h / im.naturalHeight), iw = im.naturalWidth * k2, ih = im.naturalHeight * k2; c2.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); };
  {
    const [c2v, c2] = canvas(W, H, '#FFFFFF'), bx = M, by = 300, bw2 = W - 2 * M, bh2 = 1480;
    band(c2, 'مخطط الأرض', 'قطعة رقم ' + p.n + ' · مخطط ' + PROJECT);
    if (skIm) fit(c2, skIm, bx + 20, by + 20, bw2 - 40, bh2 - 40);
    else { c2.save(); c2.translate(bx, by); drawSketch(c2, p, bw2, bh2); c2.restore(); c2.direction = 'rtl'; }
    c2.strokeStyle = LINE; c2.lineWidth = 3; c2.strokeRect(bx, by, bw2, bh2);
    txt(c2, skIm ? 'مقتطف من مخطط الأرض' : 'مخطط توضيحي مستخرج من مخطط المشروع، القطعة مظلّلة بالأصفر — ليس وثيقة رسمية', W / 2, by + bh2 + 62, FB(500, 32), MUTED, 'center');
    const line = ['المساحة ' + (p.ap ? '≈ ' : '') + fmt(p.ft) + ' قدم² (' + fmt(p.m2) + ' م²)'];
    if (p.d) line.push('الأبعاد ' + (p.ir ? '≈ ' : '') + LTR(p.d[0].toFixed(2) + ' × ' + p.d[1].toFixed(2)) + ' م');
    txt(c2, line.join('   ·   '), W / 2, by + bh2 + 142, FD(700, 40), INK, 'center');
    txt(c2, [T.use, T.floors, kind ? (CFG.types ? kind : 'قطعة ' + kind) : ''].filter(Boolean).join(' · '), W / 2, by + bh2 + 204, FB(500, 36), MUTED, 'center');
    const l2 = foot(c2), j2 = await jpegOf(c2v); c2v.width = c2v.height = 1;
    pages.push({W: PW, H: PH, images: [j2], content: full, links: l2 ? [l2] : []});
  }
  // page 3: the last page of the uploaded document (planning conditions), as it is
  const lastIm = pl && pl.last ? await imageOf({src: pl.last.u, own: true}) : null;
  if (lastIm) {
    const [c3v, c3] = canvas(W, H, '#FFFFFF');
    band(c3, 'اشتراطات التخطيط', 'قطعة رقم ' + p.n + ' · مخطط ' + PROJECT);
    fit(c3, lastIm, M / 2, 270, W - M, H - 270 - 220);
    const l3 = foot(c3), j3 = await jpegOf(c3v); c3v.width = c3v.height = 1;
    pages.push({W: PW, H: PH, images: [j3], content: full, links: l3 ? [l3] : []});
  }
  return {pdf: buildPdf(pages), preview: async () => new Blob([jpg.bytes], {type: 'image/jpeg'}), spots};
}

/* the whole plan: aerial photo, the drawing as vector paths, and the offered plots repainted with their current status */
/* the drawing as PDF path operators, in whole steps of 1/VQ plan unit (the caller sets the matrix) */
function vecPdf() {
  const {n, st, o0, p0, ops, xy} = V, out = [], R = v => Math.round(v * VQ), n3 = a => a.map(v => +(v / 255).toFixed(3)).join(' ');
  let buf = '', open = -1, fill = '';
  const tr = k => {
    let j = p0[k], t = '';
    for (let o = o0[k], e = o0[k + 1]; o < e; o++) {
      const code = ops[o];
      if (code === 1) { t += R(xy[j]) + ' ' + R(xy[j + 1]) + ' l\n'; j += 2; }
      else if (code === 2) { t += R(xy[j]) + ' ' + R(xy[j + 1]) + ' ' + R(xy[j + 2]) + ' ' + R(xy[j + 3]) + ' ' + R(xy[j + 4]) + ' ' + R(xy[j + 5]) + ' c\n'; j += 6; }
      else if (code === 0) { t += R(xy[j]) + ' ' + R(xy[j + 1]) + ' m\n'; j += 2; }
      else t += 'h\n';
    }
    return t;
  };
  const flush = () => { if (open >= 0) { buf += 'S\n'; open = -1; } };
  for (let k = 0; k < n; k++) {
    const id = st[k];
    if (id === 255) { flush(); buf += 'Q\n'; fill = ''; }
    else if (id === 254) { flush(); buf += 'q\n' + tr(k) + 'W* n\n'; }
    else {
      const s = VS[id];
      if (s.t === 'f') { flush(); const col = n3(s.c) + ' rg\n'; if (col !== fill) { buf += col; fill = col; } buf += tr(k) + 'f*\n'; }
      else {
        if (open !== id) { flush(); open = id; buf += n3(s.c) + ' RG ' + R(s.w) + ' w [' + (s.d || []).map(R).join(' ') + '] ' + R(s.ph || 0) + ' d\n'; }
        buf += tr(k);
      }
    }
    if (buf.length > 60000) { out.push(buf); buf = ''; }
  }
  flush(); out.push(buf);
  return out.join('');
}
async function deflate(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  try { const cs = new CompressionStream('deflate'), w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch (err) { return null; }
}
async function planPdf() {
  await fontsReady(); await logoReady; await vecReady;
  const TALL = CFG.page === 'portrait' || D.h > D.w * 1.05, PW = TALL ? 841.89 : 1190.55, PH = TALL ? 1190.55 : 841.89, CW = 2976, HH = 0, FH = PW * 130 / CW, links = [];
  const off = offered(), cnt = k => off.filter(p => statusOf(p) === k).length;
  // header strip
  const [hc, h] = canvas(CW, 200, NAVY);
  h.fillStyle = GOLD; h.fillRect(0, 192, CW, 8);
  txt(h, 'مخطط ' + PROJECT, CW - 70, 96, FD(800, 76), '#fff'); txt(h, PLACE + ' · آخر تحديث ' + dstr(state.updated), CW - 70, 156, FB(500, 36), '#B9C6DA');
  if (!drawLogo(h, 70, 22, 148)) { txt(h, 'عمر الياسي للعقارات', 70, 92, FD(700, 52), '#fff', 'left'); h.direction = 'ltr'; txt(h, 'Omar Al Yassi Real Estate', 70, 148, FB(400, 32), '#B9C6DA', 'left'); h.direction = 'rtl'; }
  txt(h, 'متاح ' + cnt('av') + '  ·  محجوز ' + cnt('res') + '  ·  مباع ' + cnt('sold'), CW / 2, 118, FD(700, 48), '#E7CF8E', 'center');
  // footer strip: the colour key only
  const [fc, f] = canvas(CW, 130, '#FFFFFF');
  f.fillStyle = LINE; f.fillRect(0, 0, CW, 3);
  const keys = [[SC.av, 'متاح'], [SC.res, 'محجوز'], [SC.sold, 'مباع']].concat(TYPE_ORDER.map(t => [PC[t], TYPES[t].chip || typeLabel(t), 1]));
  f.font = FB(500, 34); const kw = keys.map(k => 40 + 14 + f.measureText(k[1]).width), gapK = 48;
  let rows = [[]], rw = [0]; keys.forEach((k, i) => { const w = kw[i] + (rows[rows.length - 1].length ? gapK : 0); if (rw[rw.length - 1] + w > CW - 140) { rows.push([]); rw.push(0); } rows[rows.length - 1].push(i); rw[rw.length - 1] += kw[i] + (rows[rows.length - 1].length > 1 ? gapK : 0); });
  const rowH = 52, y0 = (130 - rows.length * rowH) / 2 + 8;
  rows.forEach((r, ri) => {
    let x = CW / 2 + rw[ri] / 2; const y = y0 + ri * rowH;
    r.forEach(i => { const k = keys[i]; f.fillStyle = rgb(k[0]); f.fillRect(x - 40, y, 40, 40); if (k[2]) { f.strokeStyle = LINE; f.lineWidth = 2; f.strokeRect(x - 40, y, 40, 40); } txt(f, k[1], x - 54, y + 33, FB(500, 34), INK); x -= kw[i] + gapK; });
  });
  const waUrl = '';
  const fj = await jpegOf(fc);
  // plan area
  // the plan either fills the sheet's height (its sides may run off the page) or, where the project asks for it, is shown whole
  const top = PH - HH, ah = top - FH, k = Math.min(ah / D.h, PW / D.w),   /* the whole plan on the sheet, never cut at the sides */ ux0 = (D.w - PW / k) / 2, uy0 = (D.h - ah / k) / 2;
  const X = v => ((v - ux0) * k).toFixed(2), Y = v => (top - (v - uy0) * k).toFixed(2), n3 = a => a.map(v => (v / 255).toFixed(3)).join(' ');
  /* The aerial image goes in as four plain JPEG tiles redrawn here. Embedding the file as the server sends it is fragile:
     a site may deliver it in another format, and some phone PDF viewers skip very large or progressive images. */
  const bgImg = $('bg'); await bgReady; try { await bgImg.decode(); } catch (err) {}
  const uw = PW / k, px = bgImg.naturalWidth / D.w, COLS = 2, ROWS = 2, tiles = [];
  for (let r = 0; r < ROWS; r++) for (let cI = 0; cI < COLS; cI++) {
    const vx0 = Math.max(0, ux0), vx1 = Math.min(D.w, ux0 + uw), tw = (vx1 - vx0) / COLS, th = D.h / ROWS, tx = vx0 + cI * tw, ty = r * th;
    const [tc, t2] = canvas(Math.round(tw * px), Math.round(th * px), '#D9C9AF');
    t2.drawImage(bgImg, tx * px, ty * px, tw * px, th * px, 0, 0, tc.width, tc.height);
    const j = await jpegOf(tc, 0.86); j.x = tx; j.y = ty; j.tw = tw; j.th = th; tiles.push(j); tc.width = tc.height = 1;
  }
  let s = 'q ' + PW + ' 0 0 ' + FH + ' 0 0 cm /Im' + tiles.length + ' Do Q\n';
  s += 'q 0 ' + FH + ' ' + PW + ' ' + ah.toFixed(2) + ' re W n\n';
  s += '0.914 0.863 0.765 rg 0 ' + FH + ' ' + PW + ' ' + ah.toFixed(2) + ' re f\n';
  tiles.forEach((t, i) => { s += 'q ' + (t.tw * k + 0.5).toFixed(2) + ' 0 0 ' + (t.th * k + 0.5).toFixed(2) + ' ' + ((t.x - ux0) * k).toFixed(2) + ' ' + (top - (t.y + t.th - uy0) * k - 0.5).toFixed(2) + ' cm /Im' + i + ' Do Q\n'; });
  const wOf = (t, size) => [...t].reduce((a, ch) => a + (ch === ',' ? 278 : 556), 0) / 1000 * size;
  const label = (p, t, size, dy) => {
    const a = p.r * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), w = wOf(t, size), px = p.c[0] - w / 2 * co - dy * si, py = p.c[1] - w / 2 * si + dy * co;
    return 'BT /F1 ' + (size * k).toFixed(3) + ' Tf ' + (lightText(p) ? '1 1 1' : '0.063 0.082 0.11') + ' rg ' + co.toFixed(4) + ' ' + (-si).toFixed(4) + ' ' + si.toFixed(4) + ' ' + co.toFixed(4) + ' ' + X(px) + ' ' + Y(py) + ' Tm (' + t + ') Tj ET\n';
  };
  // the drawing itself goes in as vector paths, so streets, dimensions and labels stay sharp however far the PDF is zoomed
  if (V) s += 'q ' + X(0) + ' ' + Y(D.h) + ' ' + (D.w * k).toFixed(2) + ' ' + (D.h * k).toFixed(2) + ' re W n\nq ' + (k / VQ).toFixed(6) + ' 0 0 ' + (-k / VQ).toFixed(6) + ' ' + (-ux0 * k).toFixed(3) + ' ' + (top + uy0 * k).toFixed(3) + ' cm 1 j 0 J\n' + vecPdf() + 'Q\nQ\n';   // lines that run past the plan's own edge stop there
  plots.forEach(p => {
    if (p.am || (V && !statusOf(p))) return;
    s += n3(fillOf(p)) + ' rg ' + p.p.map((v, i) => X(v[0]) + ' ' + Y(v[1]) + (i ? ' l' : ' m')).join(' ') + ' h ' + (statusOf(p) ? '1 1 1 RG ' + (1.1 * k).toFixed(3) + ' w B' : 'f') + '\n';
    s += label(p, p.n, 4.4, 0.0) + label(p, fmt(p.ft), 2.4, 3.6) + label(p, 'sq.ft', 1.3, 5.6);
  });
  /* next to each available plot with a price: a card with its area, price per foot, down payment, instalments and total,
     placed in the nearest free space (roads, open ground) and pointing at the plot */
  const callouts = new Map(), cimgs = [];
  {
    const offered0 = plots.filter(p => !p.am && statusOf(p));
    const sizes = plots.filter(p => !p.am).map(p => { let a = 0; const P = p.p; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; } return Math.sqrt(Math.abs(a) / 2); }).sort((a, b) => a - b);
    const med = sizes[Math.floor(sizes.length / 2)] || 20, CWU = med * 3.0;
    const vx0 = Math.max(0, ux0), vx1 = Math.min(D.w, ux0 + PW / k), vy0 = Math.max(0, uy0), vy1 = Math.min(D.h, uy0 + ah / k);
    const bb = q => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; q.p.forEach(v => { a = Math.min(a, v[0]); b = Math.min(b, v[1]); c = Math.max(c, v[0]); d = Math.max(d, v[1]); }); return [a, b, c, d]; };
    const inP = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const blocks = offered0.map(bb), placed = [];
    const hit = (r, list, pad) => list.some(o => r[0] < o[2] + pad && r[2] > o[0] - pad && r[1] < o[3] + pad && r[3] > o[1] - pad);
    // plots with the same area, price and payment plan that lie close together share one card
    const keyOf = p => { const pr = priceOf(p); return [kindOf(p), p.ft, pr.total, pr.ppf, pr.inst.map(x => x.d + ':' + x.a).join(',')].join('|'); };
    const list = plots.filter(p => !p.am && statusOf(p) === 'av' && priceOf(p)).sort((a, b) => (+a.n || 0) - (+b.n || 0));
    const cen = p => { const b = bb(p); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
    const groups = [];
    list.forEach(p => {
      const kk = keyOf(p), c = cen(p);
      const g = groups.find(g => g.key === kk && g.plots.some(q => { const d = cen(q); return Math.hypot(d[0] - c[0], d[1] - c[1]) < med * 2.6; }));
      if (g) g.plots.push(p); else groups.push({key: kk, plots: [p]});
    });
    const card = async g => {
      const p = g.plots[0], pr = priceOf(p), kind = kindOf(p), PX = 720, rows = pr.inst.length, M2 = 34, nos = g.plots.map(q => q.n);
      const R = PX - M2, Lx = M2 + 10, room = R - Lx;
      // measure first, so nothing is written over anything else
      const c0 = canvas(10, 10, NAVY)[1], wOfT = (t, f) => { c0.font = f; return c0.measureText(t).width; };
      const lines = []; { let cur = nos.length > 1 ? 'القطع: ' : 'قطعة رقم ';
        nos.forEach((w, i) => { const t = cur + (i ? '  ·  ' : '') + w; if (wOfT(t, FD(800, 38)) > room && i) { lines.push(cur); cur = w; } else cur = t; }); lines.push(cur); }
      const aLab = 'مساحة الأرض' + (kind ? ' (' + kind + ')' : '') + ' :', aVal = fmt(p.ft) + ' قدم';
      const aTwo = wOfT(aLab, FB(500, 34)) + wOfT(aVal, FD(800, 36)) + 30 > room;   // a long description of the plot goes on a line of its own, under the area
      let aSize = 30; while (aSize > 20 && wOfT('(' + kind + ')', FB(500, aSize)) > room) aSize -= 2;
      const H = 30 + lines.length * 50 + 24 + 50 + (aTwo ? 46 : 0) + 12 + (rows ? 62 + 62 + 40 + rows * 50 : (pr.ppf ? 62 : 0)) + 30 + 70 + 20;
      const [cv, c] = canvas(PX, H, NAVY);
      let y = 30;
      lines.forEach(l => { y += 50; txt(c, l, R, y, FD(800, 38), '#E7CF8E'); });
      y += 24; c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(Lx, y - 12, R - Lx, 2);
      if (aTwo) {
        y += 50; txt(c, 'مساحة الأرض :', R, y, FB(500, 34), '#fff'); txt(c, aVal, Lx, y, FD(800, 36), '#fff', 'left');
        y += 46; txt(c, '(' + kind + ')', R, y, FB(500, aSize), '#C9D3E3');
      } else { y += 50; txt(c, aLab, R, y, FB(500, 34), '#fff'); txt(c, aVal, Lx, y, FD(800, 36), '#fff', 'left'); }
      y += 12;
      let badgeY = y - 18;
      if (!rows && pr.ppf) { y += 62; txt(c, 'سعر القدم :', R, y, FB(500, 34), '#fff'); txt(c, fmt(pr.ppf) + ' درهم', Lx, y, FD(800, 36), '#fff', 'left'); }
      if (rows) {
        y += 62; txt(c, 'الدفعة المقدمة :', R, y, FB(500, 34), '#fff'); txt(c, fmt(pr.down) + ' درهم', Lx, y, FD(800, 36), '#fff', 'left');
        y += 62; txt(c, 'الأقساط المتبقية :', R, y, FB(500, 34), '#fff');
        y += 40; badgeY = y + 20 + Math.min(rows, 2) * 25;
        pr.inst.forEach(x => { y += 50; c.direction = 'ltr'; txt(c, dstr(x.d), R - 150, y, FD(800, 40), '#fff', 'right'); txt(c, fmt(x.a), Lx, y, FD(800, 40), '#fff', 'left'); c.direction = 'rtl'; });
      }
      y += 30; c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(Lx, y, R - Lx, 2);
      y += 62; txt(c, 'السعر الإجمالي :', R, y, FB(500, 36), '#fff'); txt(c, fmt(pr.total) + ' درهم', Lx, y, FD(800, 40), '#fff', 'left');
      if (pr.ppf) {
        const bx = rows ? R - 60 : PX / 2, by = rows ? badgeY : badgeY, rr = 54;
        if (rows) {
          c.fillStyle = '#E1192D'; c.beginPath(); c.arc(bx, by, rr, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
          txt(c, 'سعر القدم', bx, by - 22, FB(700, 20), '#fff', 'center'); txt(c, fmt(pr.ppf), bx, by + 18, FD(800, 42), '#fff', 'center'); txt(c, 'درهم', bx, by + 40, FB(500, 18), '#fff', 'center');
        }
      }
      c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(3, 3, PX - 6, H - 6);
      const j = await jpegOf(cv, 0.9); cv.width = cv.height = 1; return j;
    };
    // a pointer may not run across a plot that is not one of its own (above all a sold one)
    const others = g => offered0.filter(q => !g.plots.includes(q));
    const wedges = [];   // pointers already drawn: a new card may not sit on one, and a new pointer may not cross a card
    const inR = (x, y, r, pad) => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad;
    const clearPath = (a, b, oth, self) => { for (let t = 0.04; t < 0.97; t += 0.04) { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; if (oth.some(q => inP(x, y, q.p)) || placed.some(r => r !== self && inR(x, y, r, med * 0.1))) return false; } return true; };
    const onWedge = rc => wedges.some(([a, b]) => { for (let t = 0; t <= 1; t += 0.05) if (inR(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, rc, med * 0.15)) return true; return false; });
    const tipOf = (q, rc) => { const o = bb(q), mx = (rc[0] + rc[2]) / 2, my = (rc[1] + rc[3]) / 2, c = cen(q); let best = c, bd = 1e18; q.p.forEach((v, i) => { const w = q.p[(i + 1) % q.p.length], m = [(v[0] + w[0]) / 2, (v[1] + w[1]) / 2], d = Math.hypot(m[0] - mx, m[1] - my); if (d < bd) { bd = d; best = m; } }); return best; };
    const baseOf = (rc, tip) => [Math.max(rc[0], Math.min(rc[2], tip[0])), Math.max(rc[1], Math.min(rc[3], tip[1]))];
    for (const g of groups) {
      const j = await card(g), cw = CWU, ch = CWU * j.h / j.w, oth = others(g);
      const gb = g.plots.map(bb).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
      const cx = (gb[0] + gb[2]) / 2, cy = (gb[1] + gb[3]) / 2, rad = Math.max(gb[2] - gb[0], gb[3] - gb[1]) / 2;
      let best = null, bestScore = 1e18;
      for (let r = med * 0.3; r < med * 16 && !best; r += med * 0.4) {
        for (let a = 0; a < 32; a++) {
          const th = a / 32 * Math.PI * 2, ex = cx + Math.cos(th) * (rad + r + cw / 2), ey = cy + Math.sin(th) * (rad + r + ch / 2);
          const rc = [ex - cw / 2, ey - ch / 2, ex + cw / 2, ey + ch / 2];
          if (rc[0] < vx0 || rc[1] < vy0 || rc[2] > vx1 || rc[3] > vy1) continue;
          if (hit(rc, blocks, med * 0.45) || hit(rc, placed, med * 0.6) || onWedge(rc)) continue;
          let pick = null, pd = 1e18;
          g.plots.forEach(q => { const t = tipOf(q, rc), b = baseOf(rc, t), d = Math.hypot(t[0] - b[0], t[1] - b[1]); if (d < pd && clearPath(b, t, oth, rc)) { pd = d; pick = q; } });
          if (!pick) continue;
          if (pd < bestScore) { bestScore = pd; best = rc; best.q = pick; }
        }
      }
      if (!best) continue;   // nowhere free and clear near them: the plots keep their price tags
      placed.push(best); cimgs.push(j);
      const idx = tiles.length + 1 + cimgs.length - 1, [x0, y0, x1, y1] = best, w2 = Math.min(cw, ch) * 0.12;
      let o = '';
      {   // a wedge, like a speech bubble, to one plot of the card
        const q = best.q, t = tipOf(q, best); wedges.push([baseOf(best, t), t]); const b = baseOf(best, t), onX = b[0] === x0 || b[0] === x1;
        const b1 = onX ? [b[0], Math.max(y0, b[1] - w2)] : [Math.max(x0, b[0] - w2), b[1]], b2 = onX ? [b[0], Math.min(y1, b[1] + w2)] : [Math.min(x1, b[0] + w2), b[1]];
        o += '0.071 0.141 0.247 rg 1 1 1 RG ' + (0.2 * k).toFixed(3) + ' w ' + X(b1[0]) + ' ' + Y(b1[1]) + ' m ' + X(t[0]) + ' ' + Y(t[1]) + ' l ' + X(b2[0]) + ' ' + Y(b2[1]) + ' l h b\n';
      }
      o += 'q ' + (cw * k).toFixed(3) + ' 0 0 ' + (ch * k).toFixed(3) + ' ' + X(x0) + ' ' + Y(y1) + ' cm /Im' + idx + ' Do Q\n';
      callouts.set(g.plots[0], o); g.plots.slice(1).forEach(q => callouts.set(q, ' '));
    }
  }
  /* the price of each available plot, in a small framed tag just outside the plot, on its side that faces the road */
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const boxes = plots.map(q => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; q.p.forEach(v => { a = Math.min(a, v[0]); b = Math.min(b, v[1]); c = Math.max(c, v[0]); d = Math.max(d, v[1]); }); return [a, b, c, d]; });
  const taken = (x, y, self) => plots.some((q, i) => q !== self && x >= boxes[i][0] && x <= boxes[i][2] && y >= boxes[i][1] && y <= boxes[i][3] && inPoly(x, y, q.p));
  const tag = (p, price) => {
    const P = p.p, n = P.length; let area2 = 0; for (let i = 0; i < n; i++) area2 += P[i][0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * P[i][1];
    let best = null;
    for (let i = 0; i < n; i++) {
      const A = P[i], B = P[(i + 1) % n], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 3) continue;
      const tx = (B[0] - A[0]) / L, ty = (B[1] - A[1]) / L, nx = area2 > 0 ? ty : -ty, ny = area2 > 0 ? -tx : tx, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      let free = 0; for (const dd of [1.5, 3, 4.5, 6]) { if (taken(mx + nx * dd, my + ny * dd, p) || taken(mx + nx * dd + tx * L * 0.3, my + ny * dd + ty * L * 0.3, p) || taken(mx + nx * dd - tx * L * 0.3, my + ny * dd - ty * L * 0.3, p)) break; free = dd; }
      if (free >= 4.5 && (!best || L > best.L)) best = {mx, my, tx, ty, nx, ny, L};
    }
    if (!best) return '';
    const t = fmt(price), size0 = 3.4, wD = 0.722, w1 = (wD + 0.3) * size0 + wOf(t, size0), fs = Math.min(size0, (best.L * 1.0 - 1.0) / (w1 / size0)), tw = (wD + 0.3) * fs + wOf(t, fs), bw = tw + 1.2, bh = fs * 1.45;
    if (fs < 1.1) return '';
    let ux = best.tx, uy = best.ty; if (ux < -1e-6 || (Math.abs(ux) < 1e-6 && uy > 0)) { ux = -ux; uy = -uy; }   // text left to right, upright
    const cx = best.mx + best.nx * (0.7 + bh / 2), cy = best.my + best.ny * (0.7 + bh / 2);
    // local frame: x along the edge, y up on the page; one unit = one plan unit
    const co = ux, si = -uy;
    let o = 'q ' + (co * k).toFixed(4) + ' ' + (si * k).toFixed(4) + ' ' + (-si * k).toFixed(4) + ' ' + (co * k).toFixed(4) + ' ' + X(cx) + ' ' + Y(cy) + ' cm\n';
    o += '1 1 1 rg 0.86 0.08 0.1 RG 0.28 w ' + (-bw / 2).toFixed(2) + ' ' + (-bh / 2).toFixed(2) + ' ' + bw.toFixed(2) + ' ' + bh.toFixed(2) + ' re B\n';
    const x0 = -tw / 2, base = -fs * 0.36;
    o += 'BT /F1 ' + fs.toFixed(3) + ' Tf 0.071 0.141 0.247 rg ' + x0.toFixed(3) + ' ' + base.toFixed(3) + ' Td (D) Tj ET\n';
    // the dirham sign: a D with two bars across it
    o += '0.071 0.141 0.247 RG ' + (fs * 0.085).toFixed(3) + ' w ' + [0.30, 0.50].map(f => (x0 - fs * 0.12).toFixed(3) + ' ' + (base + fs * f).toFixed(3) + ' m ' + (x0 + fs * 0.62).toFixed(3) + ' ' + (base + fs * f).toFixed(3) + ' l S').join(' ') + '\n';
    o += 'BT /F1 ' + fs.toFixed(3) + ' Tf 0.071 0.141 0.247 rg ' + (x0 + (wD + 0.3) * fs).toFixed(3) + ' ' + base.toFixed(3) + ' Td (' + t + ') Tj ET\nQ\n';
    return o;
  };
  let cardsOut = '', tagsOut = '';
  plots.forEach(p => {
    if (p.am || statusOf(p) !== 'av') return;
    const pr = priceOf(p); if (!pr) return;
    const sp = callouts.get(p);
    if (sp) cardsOut += sp;   // the cards go on top of everything, after all the tags
    const o = tag(p, pr.total);
    tagsOut += o || label(p, fmt(pr.total), Math.min(2.2, 2.4), 7.6);   // no free side (a plot in the middle of a block): under its area
  });
  s += cardsOut + tagsOut;   // the price tags last, so a card's pointer never hides one
  s += 'Q\n';
  const preview = async () => {   // the same sheet as one picture, for views that cannot save files
    const W = 4200, hh = Math.round(W * HH / PW), fh = Math.round(W * FH / PW), ph = Math.round(W * ah / PW), k2 = k * W / PW;
    const [cv, c] = canvas(W, hh + ph + fh, '#FFFFFF');
    c.drawImage(hc, 0, 0, W, hh); c.drawImage(fc, 0, hh + ph, W, fh);
    c.save(); c.beginPath(); c.rect(0, hh, W, ph); c.clip(); c.fillStyle = '#E9DCC3'; c.fillRect(0, hh, W, ph); c.translate(-ux0 * k2, hh - uy0 * k2); c.scale(k2, k2);
    drawPlan(c, 0, 0, D.w, D.h, k2); paintPlots(c, () => true, 4.4); c.restore();
    return new Blob([(await jpegOf(cv)).bytes], {type: 'image/jpeg'});
  };
  const ft = (PH - FH) / PH + 0.56 * FH / PH, fhh = 0.4 * FH / PH, spots = waUrl ? [{l: (CW - 900) / CW, t: ft, w: 830 / CW, h: fhh, url: waUrl, label: 'واتساب'}] : [];
  if (locUrl()) spots.push({l: 70 / CW, t: ft, w: 760 / CW, h: fhh, url: locUrl(), label: 'موقع المشروع'});
  const raw = new TextEncoder().encode(s), packed = await deflate(raw);
  return {pdf: buildPdf([{W: PW, H: PH, images: tiles.concat([fj], cimgs), content: packed ? {bytes: packed, flate: true} : {bytes: raw}, links: []}]), preview, spots: []};
}
/* after the plan: every available plot with its price and payment plan, as a table over as many pages as it needs */
async function pricePages(PW, PH, hc) {
  const list = offered().filter(p => statusOf(p) === 'av').sort((a, b) => (+a.n || 0) - (+b.n || 0) || (a.n > b.n ? 1 : -1));
  if (!list.length) return [];
  const CW = 2976, CH = Math.round(CW * PH / PW), M = 80, HB = 200, top0 = HB + 150, bottom = CH - 130, LH = 52, FS = 34;
  // columns, right to left: [title, width share]
  const cols = [['رقم القطعة', 0.09], ['النوع', 0.19], ['المساحة (قدم²)', 0.11], ['سعر القدم', 0.09], ['السعر الإجمالي (درهم)', 0.14], ['الدفعة المقدمة (درهم)', 0.13], ['الأقساط (التاريخ · المبلغ بالدرهم)', 0.25]];
  const TW = CW - 2 * M, xs = []; let x = CW - M; cols.forEach(c => { xs.push([x, x - c[1] * TW]); x -= c[1] * TW; });
  const rows = list.map(p => {
    const pr = priceOf(p), T = TYPES[p.t];
    const inst = pr && pr.inst.length ? pr.inst.map(i => dstr(i.d) + '   ·   ' + fmt(i.a)) : [pr ? 'دفعة واحدة' : '—'];
    return {p, pr, type: T.chip || typeLabel(p.t), inst, h: Math.max(1, inst.length) * LH + 26};
  });
  const pages = []; let cur = [], y = top0;
  rows.forEach(r => { if (y + r.h > bottom && cur.length) { pages.push(cur); cur = []; y = top0; } cur.push(r); y += r.h; });
  if (cur.length) pages.push(cur);
  const out = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const [cv, c] = canvas(CW, CH, '#FFFFFF');
    c.drawImage(hc, 0, 0, CW, HB);
    txt(c, 'الأسعار وخطة الدفع للقطع المتاحة', CW - M, HB + 76, FD(800, 52), INK);
    txt(c, 'بحسب آخر تحديث ' + dstr(state.updated) + (pages.length > 1 ? '  ·  صفحة ' + (pi + 1) + ' من ' + pages.length : ''), M, HB + 76, FB(500, 32), MUTED, 'left');
    // header row
    const hy = top0 - 62; c.fillStyle = NAVY; c.fillRect(M, hy, TW, 62);
    cols.forEach((col, i) => txt(c, col[0], (xs[i][0] + xs[i][1]) / 2, hy + 42, FD(700, 28), '#fff', 'center'));
    let ry = top0;
    pages[pi].forEach((r, k) => {
      if (k % 2) { c.fillStyle = '#F4F6F9'; c.fillRect(M, ry, TW, r.h); }
      const mid = ry + 13 + LH * 0.72, cx = i => (xs[i][0] + xs[i][1]) / 2, p = r.p, pr = r.pr;
      txt(c, p.n, cx(0), mid, FD(800, FS + 4), INK, 'center');
      c.fillStyle = rgb(PC[p.t]); c.fillRect(xs[1][0] - 44, mid - 26, 28, 28); c.strokeStyle = LINE; c.lineWidth = 2; c.strokeRect(xs[1][0] - 44, mid - 26, 28, 28);
      c.save(); c.beginPath(); c.rect(xs[1][1], ry, xs[1][0] - 56 - xs[1][1], r.h); c.clip(); txt(c, r.type, xs[1][0] - 58, mid, FB(500, FS - 4), INK); c.restore();
      txt(c, (p.ap ? '≈ ' : '') + fmt(p.ft), cx(2), mid, FB(700, FS), INK, 'center');
      txt(c, pr && pr.ppf ? fmt(pr.ppf) : '—', cx(3), mid, FB(700, FS), INK, 'center');
      txt(c, pr ? fmt(pr.total) : 'للاستفسار', cx(4), mid, FD(800, FS), pr ? INK : MUTED, 'center');
      txt(c, pr ? fmt(pr.inst.length ? pr.down : pr.total) : '—', cx(5), mid, FB(700, FS), INK, 'center');
      r.inst.forEach((line, j) => { c.direction = 'ltr'; txt(c, line, cx(6), mid + j * LH, FB(500, FS - 2), INK, 'center'); c.direction = 'rtl'; });
      ry += r.h; c.fillStyle = LINE; c.fillRect(M, ry - 2, TW, 2);
    });
    c.strokeStyle = LINE; c.lineWidth = 2; c.strokeRect(M, hy, TW, ry - hy);
    txt(c, 'الأسعار والحالات قابلة للتغيير. للتأكد من توفر القطعة وسعرها تواصل معنا.', CW / 2, CH - 60, FB(400, 30), MUTED, 'center');
    const j = await jpegOf(cv, 0.9); cv.width = cv.height = 1;
    out.push({W: PW, H: PH, images: [j], content: 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q', links: []});
  }
  return out;
}

const FRAMED = window.top !== window.self && !EMBED;   // a viewer's frame; the site's own frame (EMBED) saves files normally
let lastExport = 'none';
function closeFilebox() { $('filebox').hidden = true; $('fbImg').removeAttribute('src'); $('fbSpots').innerHTML = ''; }
/* the picture's own buttons are just pixels: lay real links over them so they work when tapped */
function renderSpots(el, spots) {
  el.innerHTML = '';
  (spots || []).forEach(sp => {
    const a = document.createElement(sp.url ? 'a' : 'button');
    if (sp.url) { a.href = sp.url; a.target = '_blank'; a.rel = 'noopener'; } else { a.type = 'button'; a.onclick = () => { closeFilebox(); $('sharebox').hidden = true; shareSeq++; select(byNo.get(sp.plot.n), true); if (isSheet()) openSheet(false); }; }
    a.className = 'spot'; a.setAttribute('aria-label', sp.label);
    a.style.cssText = 'left:' + (sp.l * 100).toFixed(2) + '%;top:' + (sp.t * 100).toFixed(2) + '%;width:' + (sp.w * 100).toFixed(2) + '%;height:' + (sp.h * 100).toFixed(2) + '%';
    el.appendChild(a);
  });
}
$('fbClose').onclick = closeFilebox;
$('filebox').addEventListener('click', e => { if (e.target === $('filebox')) closeFilebox(); });
const dataUrl = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
/* No save surface. Opened directly (own site, saved file): a normal browser download works. Inside a viewer frame
   file downloads and file links are blocked, so the sheet is offered as a picture to save by long-press. */
async function showFilebox(out, filename) {
  if (!FRAMED) {
    const u = URL.createObjectURL(out.pdf), a = document.createElement('a');
    a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
    lastExport = 'direct'; toast('بدأ تحميل ملف PDF.'); return;
  }
  lastExport = 'picture';
  $('fbMsg').textContent = 'هذا العرض لا يسمح بتنزيل ملف PDF. أزرار الصورة أدناه تعمل بالضغط عليها، ولحفظها كصورة اضغط عليها مطوّلًا.';
  $('fbActs').innerHTML = (out.spots || []).filter(sp => sp.url).map(sp => '<a class="' + (sp.label === 'واتساب' ? 'wa' : 'loc') + '" target="_blank" rel="noopener" href="' + esc(sp.url) + '">' + (sp.label === 'واتساب' ? 'استفسار عبر واتساب' : PIN + 'موقع المشروع') + '</a>').join('');
  try { $('fbImg').src = await dataUrl(await out.preview()); $('fbImg').hidden = false; renderSpots($('fbSpots'), out.spots); }
  catch (err) { $('fbImg').hidden = true; $('fbMsg').textContent = 'هذا العرض لا يسمح بتنزيل الملفات، وتعذّر تجهيز الصورة على هذا الجهاز.'; lastExport = 'picture-failed'; }
  $('filebox').hidden = false;
}
window.addEventListener('message', e => {   // read-only status probe, used to check a published copy
  if (!e.data || e.data.dn !== 'diag' || !e.source) return;
  const r = $('zpdf').getBoundingClientRect();
  try { e.source.postMessage({dn: 'diag-reply', downloads: !!dl, framed: FRAMED, last: lastExport, btn: [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)], sheet: !$('filebox').hidden, img: $('fbImg').naturalWidth || 0}, '*'); } catch (err) {}
});
const NO_SAVE = ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed', 'extension_not_enabled', 'rejected_extension'];
async function exportPdf(btn, make, filename) {
  if (exporting) return;
  exporting = true; const old = btn.innerHTML; btn.disabled = true; btn.textContent = btn.classList.contains('dlbtn') ? 'جارٍ تجهيز الملف…' : '…';
  try {
    const out = await make();
    if (dl) {
      lastExport = 'save-pending';
      try { const r = await dl.save({filename, data: out.pdf}); lastExport = 'saved:' + (r && r.status); toast('تم تجهيز ملف PDF.'); }
      catch (err) {
        const c = err && err.code; lastExport = 'rejected:' + c;
        if (c === 'declined') { /* the viewer said no: nothing to report */ }
        else if (c === 'rate_limited') toast('انتظر لحظة ثم حاول التحميل مرة أخرى.');
        else { if (NO_SAVE.includes(c)) dl = null; await showFilebox(out, filename); }
      }
    } else await showFilebox(out, filename);
  } catch (err) { lastExport = 'error:' + (err && err.message); toast('تعذّر تجهيز الملف. حاول مرة أخرى.'); }
  exporting = false; if (btn.isConnected) { btn.disabled = false; btn.innerHTML = old; }
}
(async () => { try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (err) { dl = null; } })();

/* ---------- share a plot card ---------- */
function plotLink(p) {
  let base = state.link || PAGE_LINK;
  if ((SITE || window.top === window.self) && /^https?:/.test(location.protocol)) base = location.href.split('#')[0];
  return (/^https?:\/\/[^\s"<>]+$/.test(base) ? base : PAGE_LINK).split('#')[0].split('?')[0] + '#p' + p.key;
}
function cardText(p) {
  const T = TYPES[p.t], st = statusOf(p), pr = st === 'av' ? priceOf(p) : null, kind = kindOf(p), L = [];
  L.push('مخطط ' + PROJECT + ' · قطعة رقم ' + p.n);
  L.push('الحالة: ' + (st ? ST[st] : 'للاستفسار'));
  L.push('الاستخدام: ' + T.use + ' (' + T.floors + ')' + (kind ? ' · ' + kind : ''));
  L.push('المساحة: ' + (p.ap ? '≈ ' : '') + fmt(p.ft) + ' قدم² (' + fmt(p.m2) + ' م²)');
  if (p.d) L.push('الأبعاد: ' + (p.ir ? '≈ ' : '') + p.d[0].toFixed(2) + ' × ' + p.d[1].toFixed(2) + ' م');
  if (pr) {
    L.push('السعر الإجمالي: ' + fmt(pr.total) + ' درهم' + (pr.ppf ? ' (سعر القدم ' + fmt(pr.ppf) + ' درهم)' : ''));
    if (pr.inst.length) { L.push('الدفعة المقدمة: ' + fmt(pr.down) + ' درهم'); pr.inst.forEach(x => L.push('قسط ' + dstr(x.d) + ': ' + fmt(x.a) + ' درهم')); }
  }
  L.push(''); L.push('التفاصيل وموقع القطعة على المخطط:'); L.push(plotLink(p));
  if (docOf(p)) { L.push('مخطط الأرض (PDF):'); L.push(docOf(p).u); }
  if (plotLoc(p)) { L.push('موقع الأرض على الخريطة:'); L.push(plotLoc(p)); }
  else if (locUrl()) { L.push('موقع المشروع على الخريطة:'); L.push(locUrl()); }
  L.push(hasPhone(p) ? 'للاستفسار: ' + phoneShown(p) + ' · عمر الياسي للعقارات' : 'عمر الياسي للعقارات');
  return L.join('\n');
}
/* the plot's details as a WhatsApp message to a customer: short lines, the price first, the plan attached as a PDF */
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthName = d => { const m = /^(\d{4})-(\d{2})/.exec(d || ''); return m ? AR_MONTHS[+m[2] - 1] + ' ' + m[1] : ''; };
function waText(p, withPdf) {
  const T = TYPES[p.t], st = statusOf(p), pr = st === 'av' ? priceOf(p) : null, side = adSide(p), L = [];
  const fl = String(T.floors || '').replace(/\s*\([^()]*\)\s*$/, '');
  L.push('🏡 *أرض ' + T.use + (side ? ' ' + side : '') + ' – ' + PROJECT + '*');
  L.push('📍 قطعة رقم *' + p.n + '*' + (st && st !== 'av' ? ' · ' + ST[st] : ''));
  L.push('');
  L.push('📐 المساحة: ' + (p.ap ? '≈ ' : '') + fmt(p.ft) + ' قدم² (' + fmt(p.m2) + ' م²)');
  if (p.d) L.push('📏 الأبعاد: ' + (p.ir ? '≈ ' : '') + p.d[0].toFixed(2) + ' × ' + p.d[1].toFixed(2) + ' م');
  L.push('🏗️ الاستخدام: ' + T.use + (fl ? ' · ' + fl : ''));
  if (pr) {
    L.push('');
    L.push('💰 *السعر: ' + fmt(pr.total) + ' درهم*' + (pr.ppf ? ' (سعر القدم ' + fmt(pr.ppf) + ')' : ''));
    if (pr.inst.length) {
      L.push('💵 الدفعة المقدمة: ' + fmt(pr.down) + ' درهم');
      const n = pr.inst.length, a0 = pr.inst[0].a, same = pr.inst.every(x => Math.abs(x.a - a0) <= 5);
      const every = n > 1 ? adEvery(monthsBetween(pr.inst[0].d, pr.inst[1].d)) : '';
      if (same) {
        L.push('🗓️ الأقساط: ' + (n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : n + ' أقساط') + ' × ' + fmt(a0) + ' درهم' + (every ? ' ' + every : ''));
        L.push(n === 1 ? '     في ' + monthName(pr.inst[0].d) : '     من ' + monthName(pr.inst[0].d) + ' إلى ' + monthName(pr.inst[n - 1].d));
      } else { L.push('🗓️ الأقساط:'); pr.inst.forEach((x, i) => L.push('     ' + (i + 1) + ') ' + monthName(x.d) + ': ' + fmt(x.a) + ' درهم')); }
    } else L.push('💵 الدفع: كاش');
  }
  L.push('');
  if (withPdf) L.push('📎 مخطط الأرض مرفق (PDF)');
  else if (docOf(p)) L.push('📎 مخطط الأرض (PDF): ' + docOf(p).u);
  L.push('🔗 موقع القطعة على المخطط:'); L.push(plotLink(p));
  const map = plotLoc(p) || locUrl(); if (map) { L.push('🗺️ الموقع على الخريطة:'); L.push(map); }
  L.push('');
  L.push('*عمر الياسي للعقارات*' + (hasPhone(p) ? '\n📞 ' + phoneShown(p) : ''));
  return L.join('\n');
}
const sharePdfFor = p => docOf(p) ? docFile(p) : plotPdf(p);
let shareFile = null, shareSeq = 0;
function copyFrom(btn, text, label) {
  const done = () => { btn.textContent = 'تم النسخ'; setTimeout(() => { btn.textContent = label; }, 1600); };
  const fallback = () => { const t = $('shText'); t.value = text; t.hidden = false; t.focus(); t.select(); btn.textContent = 'النص محدد، انسخه'; setTimeout(() => { btn.textContent = label; }, 2600); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
}
async function openShare(p) {
  const seq = ++shareSeq, text = waText(p, false), st = statusOf(p), pdfName = FILE + '-plot-' + p.n + '.pdf';
  shareFile = null;
  $('shTitle').innerHTML = 'مشاركة قطعة <span class="num">' + p.n + '</span>' + (st ? ' · ' + ST[st] : '');
  $('shWa').href = 'https://wa.me/?text=' + encodeURIComponent(text);
  $('shCopy').onclick = e => copyFrom(e.currentTarget, text, 'نسخ نص التفاصيل');
  const send = $('shSend'); send.disabled = true; send.hidden = false; send.textContent = 'مشاركة عبر الواتس أب…'; send.onclick = null; $('shSendHelp').textContent = ''; $('shPdf').hidden = true;
  (async () => {   // the PDF is made first, so that the share opens straight from the tap (phones ask for that)
    try {
      const out = await sharePdfFor(p); if (seq !== shareSeq) return;
      const pdf = new File([out.pdf], pdfName, {type: 'application/pdf'}), msg = waText(p, true);
      if (window.top === window.self && navigator.canShare && navigator.canShare({files: [pdf]})) {
        send.disabled = false; send.textContent = 'مشاركة عبر الواتس أب';
        $('shSendHelp').textContent = 'يُرسل مع التفاصيل ملف المخطط PDF. إذا وصل الملف بدون النص، الصق النص في المحادثة (يُنسخ تلقائيًا).';
        send.onclick = () => {
          try { navigator.clipboard.writeText(msg).catch(() => {}); } catch (err) {}
          navigator.share({files: [pdf], text: msg, title: 'قطعة ' + p.n + ' – ' + PROJECT}).catch(() => {});
        };
      } else {   // a computer: the text goes by WhatsApp, the PDF is downloaded to attach it
        send.hidden = true; const u = URL.createObjectURL(pdf), a = $('shPdf'); a.href = u; a.download = pdfName; a.hidden = false;
        $('shSendHelp').textContent = 'على الكمبيوتر: شارك التفاصيل عبر الواتس أب، ثم حمّل ملف المخطط وأرفقه في نفس المحادثة.';
      }
    } catch (err) { if (seq === shareSeq) { send.hidden = true; $('shSendHelp').textContent = 'تعذّر تجهيز ملف المخطط. أرسل التفاصيل كنص.'; } }
  })();
  $('shLink').onclick = e => copyFrom(e.currentTarget, plotLink(p), 'نسخ رابط القطعة');
  $('shText').hidden = true; $('shNative').hidden = true; $('shImg').hidden = true; $('shImg').removeAttribute('src'); $('shSpots').innerHTML = '';
  $('shHelp').textContent = 'جارٍ تجهيز صورة البطاقة…';
  $('sharebox').hidden = false;
  try {
    const out = await plotPdf(p), jpg = await out.preview();
    if (seq !== shareSeq) return;
    $('shImg').src = await dataUrl(jpg); $('shImg').hidden = false; renderSpots($('shSpots'), out.spots);
    $('shHelp').textContent = 'أزرار البطاقة تعمل بالضغط عليها. لإرسالها كصورة: اضغط مطوّلًا على الصورة ثم اختر «مشاركة».';
    const file = new File([jpg], FILE + '-plot-' + p.n + '.jpg', {type: 'image/jpeg'});
    if (window.top === window.self && navigator.canShare && navigator.canShare({files: [file]})) {
      shareFile = file; $('shNative').hidden = false;
      $('shNative').onclick = () => { navigator.share({files: [file], text, title: 'قطعة ' + p.n}).catch(() => {}); };
    }
  } catch (err) { if (seq === shareSeq) $('shHelp').textContent = 'تعذّر تجهيز صورة البطاقة على هذا الجهاز. استخدم واتساب أو نسخ النص.'; }
}
$('shClose').onclick = () => { $('sharebox').hidden = true; shareSeq++; };
$('sharebox').addEventListener('click', e => { if (e.target === $('sharebox')) { $('sharebox').hidden = true; shareSeq++; } });

/* ---------- start ---------- */
let lastW = 0, stash = null;
try { stash = JSON.parse(sessionStorage.getItem('dn-stash') || 'null'); sessionStorage.removeItem('dn-stash'); } catch (err) {}
function start() {
  chrome(); rebuildPins(); applyFilters(); render();
  if (stash && stash.s) { view.s = stash.s; view.tx = stash.tx; view.ty = stash.ty; apply(); if (stash.sel != null && plots[stash.sel]) select(stash.sel, false); return; }
  let hash = ''; try { hash = (location.hash || '').replace(/^#p?/, ''); } catch (err) {}
  if (byNo.has(hash)) { select(byNo.get(hash), true); return; }
  const all = bounds(plots, 40), s = Math.min(map.clientWidth / (all[2] - all[0]), map.clientHeight / (all[3] - all[1]));
  const off = offered().filter(p => statusOf(p) === 'av');
  if (s >= 0.4) fitAll();
  else if (!off.length) {   // a long plan on a narrow screen: as a thin strip it says nothing; start on its middle, big enough to read the layout
    const k = Math.min(0.4, map.clientHeight * 0.6 / (all[3] - all[1])), cx = (all[0] + all[2]) / 2, cy = (all[1] + all[3]) / 2, hw = map.clientWidth / k / 2, hh = map.clientHeight / k / 2;
    if (k <= s * 1.3) fitAll(); else fit(cx - hw, cy - hh, cx + hw, cy + hh, k);
  } else { const c = off[Math.floor(off.length / 2)]; fit(c.c[0] - 115, c.c[1] - 115, c.c[0] + 115, c.c[1] + 115, 2.2); }
}
window.addEventListener('hashchange', () => { const h = (location.hash || '').replace(/^#p?/, ''); if (byNo.has(h)) { select(byNo.get(h), true); if (isSheet()) openSheet(true); } });
const logoReady = (async () => {   // fetched as a blob so the picture can be drawn into the PDF canvases without tainting them
  if (!LOGO) return;
  try {
    const im = new Image();
    im.src = LOGO.startsWith('data:') ? LOGO : URL.createObjectURL(await (await fetch(LOGO, {cache: 'force-cache'})).blob());
    await im.decode(); logoImg = im; logoPlate = inspectLogo(im);
    const el = document.querySelector('.sitelogo'); if (el) el.classList.toggle('bare', !logoPlate);
  } catch (err) { logoImg = null; }
})();
new ResizeObserver(() => { const w = map.clientWidth; if (!lastW && w) { lastW = w; start(); } else if (w) { lastW = w; view.s = Math.max(view.s, minScale()); apply(); } }).observe(map);
(async () => {
  if (SITE) {
    try {
      const j = await (await fetch(SITE.ajax + '?action=dn_whoami&project=' + encodeURIComponent(SITE.project || 'dabdaba-north') + (DES_KEY ? '&pd=' + encodeURIComponent(DES_KEY) : ''), {credentials: 'same-origin', cache: 'no-store'})).json();
      if (j && j.success) {
        if (j.data.rev !== siteRev) {   // the page copy is older than the stored state (a cache in between): take the stored one
          const st = await (await fetch(SITE.ajax + '?action=dn_state&project=' + encodeURIComponent(SITE.project || 'dabdaba-north'), {credentials: 'same-origin', cache: 'no-store'})).json();
          if (st && st.success && !dirty()) { state = st.data.state; siteRev = st.data.rev; savedJson = JSON.stringify(state); resetUndo(); applyAreas(); plots.forEach((q, i) => refreshPlot(i)); rebuildPins(); applyFilters(); chrome(); render(); }
        }
        if (j.data.admin) { siteNonce = j.data.nonce; canAdmin = true; siteUpload = !!j.data.upload; siteMax = +j.data.max || 0; }
        if (j.data.pdlink) pdLink = j.data.pdlink;
        if (j.data.designer && !j.data.admin) { designer = true; if (view.sel != null) select(view.sel, true); toast('رابط تصميم البوستات: اختر القطعة ثم اضغط «تصميم بوست».'); }
      }
    } catch (err) { canAdmin = false; }
  } else
  try { const u = window.claude && window.claude.use ? await window.claude.use('user') : null; canAdmin = u ? !!(await u.canEdit()) : false; } catch (err) { canAdmin = false; }
  if (canAdmin && !EMBED) { $('adminBtn').hidden = false; if (stash && stash.admin) setAdmin(true); }
  if (PDF_AUTO) {
    const name = FILE + '-plan-' + state.updated + '.pdf';
    if (EMBED && window.parent !== window) {   // asked for by the project page: hand the file to it
      try { const out = await planPdf(); window.parent.postMessage({dnp: 'pdf', project: SITE.project, name, blob: out.pdf}, location.origin); }
      catch (err) { try { window.parent.postMessage({dnp: 'pdf-error', project: SITE.project}, location.origin); } catch (e2) {} }
    } else {
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (err) {}   // a reload should not download again
      exportPdf($('dlPlan') || $('zpdf'), planPdf, name);
    }
  }
})();
/* ---------- advertisement designer (admin): the company's ad template, filled from the plot and the plan, every text editable, saved as JPEG ---------- */
const pzLogo = b => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b; return im; };
/* the company's three post templates: colours and logo taken from each one */
const PZ_THEMES = {
  co: {name: 'قالب الشركة', logo: pzLogo('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x1M9WCZHMcHMa5vDjhHD0CkLTW0umtK7sah3Ctste6634cNWyWUOiHpA+g3GRzHrXe48VlJ32T+5hRRHm6uzmlt4bZbqDVUtxjit8z54TRTCIlzmhp4uRyMBcPpXySdstH61tmp7XV399ZbpxURNqKsPYXAY9IcPMYJU9okb7Ix2p8BxTecFd7p5HO1lx1HUV8VVf7fQ1M5nmtFHWBtMXE5IALSWjwzy7lIGttj9v9eaEtWkrxapIKC0Na23milMUlK0NDeFrueRgAEHrhSRhMI77G09z4CiiFLx5MG3F62rtWiKx12dFaZJJKK4moDquIyO4ngvIw5pPcR3LyaS8lHbbR+rLLqa3VN8mulrmM7Z6irDu3f3F4xjAHIAYU648VnCn+ItSaUhsXwRFuF5Oe3e5GtW6svMNyo7sGMZJU26qMPbhn2eMYIJAwM+rkvDuH5MW3m4mom6gqn3S0XUxtinq7XOIzUho4QZGkEF2BjiGCRjOcBTVhZURvsjjEug4o47bfbLSW1ekf2f0lbzBC9/azzyu45qiTGOOR/eccgOg7l2KYRVttvL7OgiIoAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREB/9k='), bg: '#FFFFFF', ink: '#262A5E', band: ['#252C62', '#252C62'], bandText: '#C2A46E', card: '#F2EFEA', cardLine: '#262A5E', icon: '#C2A46E', price: '#262A5E',
    plot: '#1D2B4F', lbox: '#262A5E', ltext: '#FFFFFF', lline: '#1D4E57', mapLine: '#262A5E', cap: '#262A5E', capText: '#FFFFFF', picLine: '#9AA0B8', bar: '#262A5E', blob: '#D4BC8E', phoneInk: '#262A5E', addr: '#FFFFFF', pinIcon: '#C2A46E', phone: '0568080655'},
  gr: {name: 'قالب عبادة', logo: pzLogo('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'), bg: '#FFFFFF', ink: '#006262', band: ['#026868', '#2A9C96'], bandText: '#FFFFFF', card: '#F2EFEA', cardLine: '#5A6290', icon: '#AC9462', price: '#006262',
    plot: '#1D2B4F', lbox: '#006262', ltext: '#FFFFFF', lline: '#10203F', mapLine: '#242C61', cap: '#006666', capText: '#FFFFFF', picLine: '#C8CBD3', bar: '#006666', blob: '#D8BC7D', phoneInk: '#006262', addr: '#FFFFFF', pinIcon: '#D8BC7D', phone: '0564090004'},
  pk: {name: 'قالب آية الجابري', logo: pzLogo('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qU5SabfK/sR+xaNsVgs7LfT0cczGuLu0nY17yT44WM/0a2JpvAhmrIYbqC2aFjxuN94O93hw45+KmaI4x9iavtTb3Pkx9ktNNYtP0tppHPdDTs3GOkOXEc+K8uptN0WqdPm1V8kzIS9smYiA7I81mkTCIKclLenz3MRWactdw0ozTtZE6ajbEyIZOHDdGAQR1GFDGbFdMiFzJay5S5xuOdKP1Y8ABjirKRccYvnBZXqba01GRDb/ALN7Ffqmnq3z1tHVQxNh9opnhr3tAwA7hgpDsy0xDpCbT/ZTSRTSCZ9Q9/60vHJ2emO7lxUxwcc04psj7D4m5LG58EKsOzGx2O8C6Cpra6pYwsidVPDuzBBHADrgnyWY0vpS36Uoailt8k72Ty9s8yuBIOMYGOizuMDA4LlFFLscnfZZncyPV+j7bcNaUWpp5agVVGAI2NI3OvMY8Sup+irX+nLNWQzVMFaBh7InAMk4YO8McchSZE2pnFdYljPjH5exALpsj01crtLXMmraMTO35YKZ4Ebz14EcPRZi4aC07cNJQ6ddRmGkg4wuidh8burgepPXPNSdcY4psj7EnqbXj5nwV3TbHNN08sEntdxkmilbKJXyDPDiG4xjCktNpK3UmuarVUUk5rKlnZvY5w3AOHIY8ApB1XAHDmihFdkJam2f1S+xgtVaUt+rbZHQ3GSeOOOTtGmEgHOCOOfNR237JNO267U1whrbk6SnlbKwPkBBIORnhy4Kf8cLnijgm8tCGpthHZGXBX1x2R6drrpNVR1VwpI6h/aTU0EoEbnE5J4jgs5dNEWC66VptPT0zmUlKB2HZPIdHwxz65yc96kqY6psj7D4m3jMnwQmXZhp2fScdimkrJI4pXSxVD3gysLueDjGOHLC89u2S6dt1fR10dVXy1NNKJRJLIDvkcgRjkFPuK46psj7HVq70mlJkT1Ps9sWqrky4VrqmCqawR9rTybpc0cs+WSvPftmdgv1RDUSvqqWpjjbEaineA6RoGBvZGCfFTTHu4THTou7Y+xGOotjhKXbsYPTGk7RpO3vprXE7ekdvyzSHL5T4n8lneXBAiJJcIhKcpvdJ5YREXSIREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREB//Z'), bg: '#FFF5F4', ink: '#625252', band: ['#F6DCDB', '#F6DCDB'], bandText: '#625252', card: '#FCEAE8', cardLine: '#8C7894', icon: '#C47C80', price: '#625252',
    plot: '#1D2B4F', lbox: '#FFFFFF', ltext: '#3E3438', lline: '#C47C80', mapLine: '#C67F85', cap: 'rgba(70,66,74,.82)', capText: '#FFFFFF', picLine: '#D0C6C6', bar: '#CB7C7F', blob: '#F9E1E1', phoneInk: '#5A4A4C', addr: '#FFFFFF', pinIcon: '#F9E1E1', phone: '0564080004'}
};
let TH = PZ_THEMES.co;
const AD_W = 1600, AD_H = 2000;
/* the portrait cards (Aya Al Jabri's pink post, Aya Kamil's purple one): the fixed artwork of each is shipped with the plugin,
   everything else is drawn here from one shared layout, with each card's own positions and colours */
PZ_THEMES.aya = Object.assign({}, PZ_THEMES.pk, {name: 'قالب آية الجديد', layout: 'aya', ay: 'aya', bar: '#B4525C', logo: null, phone: '0564080004'});
PZ_THEMES.kamil = Object.assign({}, PZ_THEMES.pk, {name: 'قالب آية كامل', layout: 'aya', ay: 'kamil', bar: '#5E1E51', logo: null, phone: '0508600740'});
const AYS = {
  aya: {base: 'aya-base.jpg', icons: 'aya-icons.png', iconH: 74,
    cards: {xs: [156, 422, 691, 952, 1222], y: 1347, w: 226, h: 260, r: 30, fill: '#F0E5E1', stroke: '', shadow: true, iconY: 1364, t: [1441, 1480], v: [1493, 1538], s: [1545, 1577]},
    map: {y: 812, h: 660, at: 360, wash: 'rgba(250,232,228,0.32)', fadeTop: [806, 46], fadeBot: [1290, 184], plot: '#A2474F'},
    pin: {R: 58, drop: 128, g1: '#E7A3A8', g2: '#B4525C', ring: 'rgba(255,255,255,.55)', ringR: 0.8, inner: '#B4525C', innerR: 0.68},
    col: {kick: '#A85E5E', title: '#655454', proj: '#A3504D', sub: '#605050', cTitle: '#3E3330', cVal: '#A85E5D', cSub: '#3E3330', tag: '#46372F', phone: '#A95F5E', addr: '#6A4E4A', clbl: '#6A4E4A'},
    head: {kick: [280, 336, 42, 3, 50], title: [352, 472, 96], proj: [498, 654, 150], sub: [710, 786, 72, 890]},
    tag: [800, 1662, 1712, 396], lbl: [542, 1772, 1802], phone: [542, 1816, 1890], addr: [1100, 1808, 1860, 1792, 1830, 1838, 1874], mid: 'loc'},
  kamil: {base: 'kamil-base.jpg', icons: 'kamil-icons.png', iconH: 70,
    cards: {xs: [155, 420, 690, 950, 1220], y: 1337, w: 226, h: 261, r: 28, fill: '#EEEDEB', stroke: '#5A1A4E', shadow: false, iconY: 1357, t: [1430, 1477], v: [1482, 1529], s: [1546, 1588]},
    map: {y: 812, h: 690, at: 330, wash: '', fadeTop: null, fadeBot: [1352, 150], plot: '#4A0F3D'},
    pin: {R: 80, drop: 152, g1: '#5E1E51', g2: '#4A0F3D', ring: '#FFFFFF', ringR: 0.86, inner: '#4A0F3D', innerR: 0.74},
    col: {kick: '#4A0B3A', title: '#45494A', proj: '#4A0B3B', sub: '#45494A', cTitle: '#3B3537', cVal: '#5A1A4E', cSub: '#3B3537', tag: '#43062F', phone: '#FFFFFF', addr: '#FFFFFF', clbl: '#FFFFFF'},
    head: {kick: [298, 348, 42, 5, 56], title: [368, 482, 100], proj: [528, 654, 140], sub: [684, 768, 84, 900]},
    tag: [822, 1624, 1682, 380], lbl: [553, 1730, 1762], phone: [553, 1772, 1840], addr: [1098, 1768, 1818, 1748, 1788, 1793, 1833], mid: 'down'}
};
const AY = () => AYS[TH.ay] || AYS.aya;
const ayaArt = {}; let ayaReady = null;
function ayaLoad() {
  if (ayaReady) return ayaReady;
  const app = document.querySelector('script[src*="/assets/app.js"]'), dir = app ? app.src.replace(/app\.js.*$/, 'ad/') : '';
  const ld = n => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = dir + n; });
  return (ayaReady = Promise.all(Object.entries(AYS).map(async ([k, s]) => { ayaArt[k] = {base: await ld(s.base), icons: await ld(s.icons)}; }).concat([ld('oy-flag.png').then(im => { ayaArt.oyFlag = im; })])));
}
/* a strip of the card's own background laid over the plan, fading in or out, so the plan melts into the card */
function ayaFade(c, base, y0, hh, fromTop) {
  if (!base) return;
  const [cv, g] = canvas(AD_W, hh, 'rgba(0,0,0,0)'); g.clearRect(0, 0, AD_W, hh);
  g.drawImage(base, 0, y0 * base.naturalHeight / AD_H, base.naturalWidth, hh * base.naturalHeight / AD_H, 0, 0, AD_W, hh);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, fromTop ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'); gr.addColorStop(1, fromTop ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 0, AD_W, hh); c.drawImage(cv, 0, y0);
}
function ayaMap(c, p, x, y, w, h, v, M) {
  const k = 2.4 * (+v.zoom || 1), uw = w / k, uh = h / k, px = x + w / 2, py = y + M.at;
  const x0 = p.c[0] - (px - x) / k - (+v.mx || 0) / k, y0 = p.c[1] - (py - y) / k - (+v.my || 0) / k;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#EFE3DC'; c.fillRect(x, y, w, h);
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x0, -y0);
  drawPlan(c, x0, y0, x0 + uw, y0 + uh, k);
  if (M.wash) { c.fillStyle = M.wash; c.fillRect(x0, y0, uw, uh); }   // the pink card's soft wash over the plan (the plan as drawn, without sale colours)
  c.beginPath(); p.p.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.lineJoin = 'round'; c.fillStyle = M.plot; c.fill(); c.lineWidth = 3.2 / k * 2.4; c.strokeStyle = '#fff'; c.stroke();
  c.save(); c.translate(p.c[0], p.c[1]); c.rotate(p.r * Math.PI / 180); c.direction = 'ltr'; txt(c, p.n, 0, 2.4, FD(800, 6.6), '#fff', 'center'); c.restore();
  c.restore(); c.restore();
  let top = 1e9; p.p.forEach(q => { top = Math.min(top, y + (q[1] - y0) * k); });
  return {sx: x + (p.c[0] - x0) * k, sy: y + (p.c[1] - y0) * k, top};
}
/* the card's marker: a drop with a ring and a white house */
function ayaPin(c, sx, tip, K, P) {
  c.save(); c.translate(sx, tip); c.scale(K, K);
  const R = P.R, cy = -P.drop, hs = R / 58;
  c.shadowColor = 'rgba(60,20,40,.28)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
  const g = c.createLinearGradient(0, cy - R, 0, 0); g.addColorStop(0, P.g1); g.addColorStop(1, P.g2);
  c.fillStyle = g; c.beginPath(); c.arc(0, cy, R, Math.PI * 0.82, Math.PI * 0.18); c.lineTo(0, 0); c.closePath(); c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = P.ring; c.beginPath(); c.arc(0, cy, R * P.ringR, 0, 7); c.fill();
  c.fillStyle = P.inner; c.beginPath(); c.arc(0, cy, R * P.innerR, 0, 7); c.fill();
  c.save(); c.translate(0, cy); c.scale(hs, hs);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -26); c.lineTo(-27, -2); c.lineTo(-19, -2); c.lineTo(-19, 22); c.lineTo(19, 22); c.lineTo(19, -2); c.lineTo(27, -2); c.closePath(); c.fill();
  c.fillStyle = P.inner; c.fillRect(-6, 6, 12, 16);
  c.restore(); c.restore();
}
/* the location mark drawn as a card icon, where the artwork has none */
function ayaPinIcon(c, cx, cy, col) {
  c.save(); c.strokeStyle = col; c.lineWidth = 3.4; c.lineJoin = c.lineCap = 'round';
  c.beginPath(); c.arc(cx, cy - 12, 16, Math.PI * 0.8, Math.PI * 0.2); c.lineTo(cx, cy + 18); c.closePath(); c.stroke();
  c.beginPath(); c.arc(cx, cy - 12, 6, 0, 7); c.stroke();
  c.beginPath(); c.ellipse(cx, cy + 22, 20, 5, 0, 0, 7); c.stroke(); c.restore();
}
function ayaCard(c, i, title, val, sub, num, icon) {
  const A = AY(), C = A.cards, art = ayaArt[TH.ay] || {}, x = C.xs[i], cx = x + C.w / 2, v = ad.v;
  c.save(); if (C.shadow) { c.shadowColor = 'rgba(120,70,70,.14)'; c.shadowBlur = 22; c.shadowOffsetY = 5; }
  c.fillStyle = C.fill; box(c, x, C.y, C.w, C.h, C.r); c.fill(); c.restore();
  if (C.stroke) { c.lineWidth = 2; c.strokeStyle = C.stroke; box(c, x, C.y, C.w, C.h, C.r); c.stroke(); }
  if (icon === 'pin') ayaPinIcon(c, cx, C.iconY + A.iconH / 2, A.col.cVal);
  else if (art.icons) c.drawImage(art.icons, (icon == null ? i : icon) * 84, 0, 84, A.iconH, cx - 42, C.iconY, 84, A.iconH);
  PZS = v.fsL; adFitV(c, title, cx, C.t[0], C.t[1], C.w - 24, 40, 700, A.col.cTitle, 'center');
  PZS = v.fsN; if (num) c.direction = 'ltr'; adFitV(c, val, cx, C.v[0], C.v[1], C.w - 18, 48, 700, A.col.cVal, 'center'); c.direction = 'rtl';
  PZS = v.fsL;
  const L = String(sub || '').split('\n').filter(Boolean).slice(0, 2);
  if (L.length < 2) adFitV(c, L[0] || '', cx, C.s[0], C.s[1], C.w - 24, 28, 600, A.col.cSub, 'center', FB);
  else { const t0 = C.s[0] - 14, t1 = C.s[1] + 4, m = (t0 + t1) / 2; adFitV(c, L[0], cx, t0, m - 1, C.w - 24, 24, 600, A.col.cSub, 'center', FB); adFitV(c, L[1], cx, m + 1, t1, C.w - 24, 26, 700, A.col.cSub, 'center', FB); }
}
function ayaDraw(c, v, p, at) {
  const A = AY(), art = ayaArt[TH.ay] || {}, M = A.map, C = A.cards, H = A.head, col = A.col;
  if (art.base) c.drawImage(art.base, 0, 0, AD_W, AD_H); else { c.fillStyle = '#F4ECF2'; c.fillRect(0, 0, AD_W, AD_H); }
  // the plan across the card, melting into the background under the cards
  PZS = v.fsL; const o = v.o.map || [0, 0];
  c.save(); c.translate(o[0], o[1]); const m = ayaMap(c, p, 96, M.y, 1412, M.h, v, M); c.restore();
  if (M.fadeTop) ayaFade(c, art.base, M.fadeTop[0], M.fadeTop[1], true);
  if (M.fadeBot) ayaFade(c, art.base, M.fadeBot[0], M.fadeBot[1], false);
  ad.hits.push({k: 'map', pan: 1, x: 96, y: M.y, w: 1412, h: C.y - M.y});
  const sx = m.sx + o[0], sy = m.sy + o[1], K = +v.pinK || 1;
  if (v.lab && (v.label1 || v.label2)) {   // an optional label beside the marker
    const lo = v.o.lab || [0, 0]; c.font = FD(700, 34); const tw = Math.max(c.measureText(v.label1 || '').width, (c.font = FB(600, 30), c.measureText(v.label2 || '').width));
    const bw = Math.min(600, tw + 50), bh = v.label1 && v.label2 ? 100 : 62; let bx = sx + 100 + lo[0], by = sy - 270 + lo[1]; if (bx + bw > 1490) bx = sx - 100 - bw + lo[0];
    c.fillStyle = A.pin.inner; c.globalAlpha = 0.94; box(c, bx, by, bw, bh, 14); c.fill(); c.globalAlpha = 1;
    if (v.label1) adFitV(c, v.label1, bx + bw / 2, by + 8, by + (v.label2 ? 52 : bh - 8), bw - 26, 34, 700, '#fff', 'center');
    if (v.label2) adFitV(c, v.label2, bx + bw / 2, by + (v.label1 ? 54 : 8), by + bh - 8, bw - 26, 30, 600, '#fff', 'center', FB);
    ad.hits.push({k: 'lab', x: bx, y: by, w: bw, h: bh});
  }
  if (v.pin) ayaPin(c, sx, m.top + o[1] - 4, K, A.pin);
  // the five cards
  const n = (ad.p && priceOf(ad.p) ? priceOf(ad.p).inst.length : 0);
  at('cards', C.xs[0], C.y, C.xs[4] + C.w - C.xs[0], C.h, () => {
    ayaCard(c, 0, 'التصريح', v.a_use, v.a_fl);
    ayaCard(c, 1, 'المساحة', v.area, 'قدم مربع', 1);
    if (A.mid === 'down' && v.mode === 'inst') ayaCard(c, 2, v.a_dT, v.down, v.a_ps, 1);
    else ayaCard(c, 2, 'الموقع', v.a_loc, v.a_city, 0, A.mid === 'down' ? 'pin' : 2);
    ayaCard(c, 3, 'السعر', v.price, v.a_ps, 1);
    if (v.mode === 'inst') ayaCard(c, 4, v.a_iT || (n ? n + ' أقساط' : 'أقساط'), v.until, v.a_iS); else ayaCard(c, 4, v.a_cT, v.a_cV, v.a_cS);
  });
  // the words at the top
  PZS = v.fsT;
  at('kick', 420, H.kick[0] - 10, 760, H.kick[1] - H.kick[0] + 20, () => {
    const px = adFitV(c, v.a_kick, 800, H.kick[0], H.kick[1], 640, H.kick[2], 800, col.kick, 'center'); if (!v.a_kick) return;
    c.font = FD(800, px); const w = c.measureText(v.a_kick).width, my = (H.kick[0] + H.kick[1]) / 2 + 2; c.strokeStyle = col.kick; c.lineWidth = H.kick[3]; c.lineCap = 'round';
    c.beginPath(); c.moveTo(800 - w / 2 - 20, my); c.lineTo(800 - w / 2 - 20 - H.kick[4], my); c.moveTo(800 + w / 2 + 20, my); c.lineTo(800 + w / 2 + 20 + H.kick[4], my); c.stroke();
  });
  at('title', 400, H.title[0] - 4, 800, H.title[1] - H.title[0] + 8, () => adFitV(c, v.a_title, 800, H.title[0], H.title[1], 780, H.title[2], 800, col.title, 'center'));
  at('proj', 400, H.proj[0] - 4, 800, H.proj[1] - H.proj[0] + 8, () => adFitV(c, v.proj, 800, H.proj[0], H.proj[1], 790, H.proj[2], 800, col.proj, 'center'));
  at('sub', 352, H.sub[0] - 8, 896, H.sub[1] - H.sub[0] + 16, () => adFitV(c, v.sub, 800, H.sub[0], H.sub[1], H.sub[3], H.sub[2], 700, col.sub, 'center'));
  // above the contact panel, and the panel
  PZS = v.fsC; const T = A.tag, ad2 = A.addr;
  at('more', T[0] - 240, T[1] - 12, 480, T[2] - T[1] + 24, () => adFitV(c, v.a_tag, T[0], T[1], T[2], T[3], 46, 500, col.tag, 'center', FB));
  at('bar', 330, A.lbl[1] - 22, 1000, A.phone[2] - A.lbl[1] + 40, () => {
    adFitV(c, v.a_clbl, A.lbl[0], A.lbl[1], A.lbl[2], 300, 28, 600, col.clbl, 'center', FB);
    c.direction = 'ltr'; adFitV(c, v.phone, A.phone[0], A.phone[1], A.phone[2], 330, 66, 800, col.phone, 'center'); c.direction = 'rtl';
    const L = String(v.a_addr || '').split('\n').filter(Boolean).slice(0, 2);
    if (L.length === 1) adFitV(c, L[0], ad2[0], ad2[1], ad2[2], 380, 38, 700, col.addr, 'center', FB);
    else L.forEach((t, i) => adFitV(c, t, ad2[0], i ? ad2[5] : ad2[3], i ? ad2[6] : ad2[4], 380, 36, 700, col.addr, 'center', FB));
  });
}
/* «قالب عمر الياسي»: the plan across the whole picture, the facts in coloured boxes over it, an arrow and a ring on the plot */
PZ_THEMES.oy = Object.assign({}, PZ_THEMES.co, {name: 'قالب عمر الياسي', layout: 'oy', bar: '#B535FE'});
const OY = {black: '#0B0B0B', blue: '#4033FC', red: '#FF3535', purple: '#B535FE', ring: '#E0040B'};
const isLatin = s => !/[؀-ۿ]/.test(String(s || ''));
/* a box hugging its text, kept to the right edge (or centred) */
function oyBox(c, s, right, top, bot, minW, maxW, px, fill, col, r, centre, weight) {
  s = String(s || ''); if (!s) return null;
  const f = FD; let size = Math.round(px * PZS); c.font = f(weight || 800, size);
  while (c.measureText(s).width > maxW - 70 && size > 18) { size -= 2; c.font = f(weight || 800, size); }
  const w = Math.max(minW, Math.min(maxW, c.measureText(s).width + 80)), x = centre ? right - w / 2 : right - w;
  c.fillStyle = fill; box(c, x, top, w, bot - top, r); c.fill();
  c.direction = isLatin(s) ? 'ltr' : 'rtl'; adFitV(c, s, x + w / 2, top + 8, bot - 8, w - 50, size / PZS, weight || 800, col, 'center'); c.direction = 'rtl';
  return {x, y: top, w, h: bot - top};
}
function oyArrow(c, tx, ty, K) {   // a thick black arrow coming down from the upper right, its tip at (tx, ty)
  c.save(); c.translate(tx, ty); c.rotate(-Math.PI / 4); c.scale(K, K);
  const L = 250, hw = 50, hl = 92, sw = 19;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(hl, -hw); c.lineTo(hl, -sw); c.lineTo(L, -sw); c.lineTo(L, sw); c.lineTo(hl, sw); c.lineTo(hl, hw); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fillStyle = '#000000'; c.fill();
  c.restore();
}
function oyDraw(c, v, p, at) {
  // the plan, full bleed
  const k = 2.2 * (+v.zoom || 1), px = AD_W * 0.36, py = AD_H * 0.62;
  const x0 = p.c[0] - px / k - (+v.mx || 0) / k, y0 = p.c[1] - py / k - (+v.my || 0) / k;
  c.save(); c.fillStyle = '#E9DCC0'; c.fillRect(0, 0, AD_W, AD_H); c.scale(k, k); c.translate(-x0, -y0); drawPlan(c, x0, y0, x0 + AD_W / k, y0 + AD_H / k, k); c.restore();
  ad.hits.push({k: 'map', pan: 1, x: 0, y: 0, w: AD_W, h: AD_H});
  const sx = (p.c[0] - x0) * k, sy = (p.c[1] - y0) * k;
  let rr = 0; p.p.forEach(q => { rr = Math.max(rr, Math.hypot((q[0] - p.c[0]) * k, (q[1] - p.c[1]) * k)); });
  const K = +v.pinK || 1, R = Math.max(44, rr + 14) * K;
  if (v.pin) {
    c.lineWidth = 9 * K; c.strokeStyle = OY.ring; c.beginPath(); c.arc(sx, sy, R, 0, 7); c.stroke();
    oyArrow(c, sx + R * 0.74 + 12, sy - R * 0.74 - 12, K * 1.25);
  }
  // the facts
  PZS = v.fsT;
  at('proj', 1000, 145, 508, 148, () => oyBox(c, v.o_proj, 1508, 145, 293, 486, 900, 112, OY.black, '#FFFFFF', 44));
  at('area', 1000, 345, 508, 114, () => oyBox(c, v.o_area, 1508, 345, 459, 486, 900, 92, OY.blue, '#FFFFFF', 28));
  at('use', 1000, 504, 508, 166, () => {
    c.font = FD(800, 80); const w = Math.max(492, Math.min(900, Math.max(c.measureText(v.o_use1 || '').width, c.measureText(v.o_use2 || '').width) + 90));
    c.fillStyle = OY.red; box(c, 1508 - w, 504, w, 166, 34); c.fill();
    adFitV(c, v.o_use1, 1508 - w / 2, 512, 592, w - 50, 80, 800, '#FFFFFF', 'center');
    c.direction = isLatin(v.o_use2) ? 'ltr' : 'rtl'; adFitV(c, v.o_use2, 1508 - w / 2, 596, 662, w - 50, 72, 800, '#FFFFFF', 'center'); c.direction = 'rtl';
  });
  PZS = v.fsN;
  at('price', 70, 1600, 1460, 190, () => {
    const s = v.mode === 'inst' ? v.o_priceI : v.o_priceC; c.fillStyle = OY.purple; box(c, 70, 1600, 1460, 190, 64); c.fill();
    c.direction = isLatin(s) ? 'ltr' : 'rtl'; adFitV(c, s, 800, 1622, 1768, 1360, 160, 800, '#FFFFFF', 'center'); c.direction = 'rtl';
  });
  PZS = v.fsL;
  at('pills', 200, 1812, 500, 160, () => {
    [[v.o_p1, 1812, 1880], [v.o_p2, 1900, 1968]].forEach(([s, t, b]) => {
      if (!s) return; c.font = FD(800, 54); const w = Math.min(760, c.measureText(s).width + 60);
      c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 444 - w / 2, t, w, b - t, 16); c.fill(); c.restore();
      adFitV(c, s, 444, t + 7, b - 7, w - 30, 54, 800, '#111111', 'center');
    });
  });
  PZS = 1;
  if (v.oFlag && ayaArt.oyFlag) at('flag', 120, 170, 500, 392, () => c.drawImage(ayaArt.oyFlag, 120, 170, 500, 392));
  const lg = PZ_THEMES.co.logo;
  if (v.oLogo && lg && lg.naturalWidth) at('logo', 1318, 1812, 240, 170, () => {
    c.save(); c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = 12; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 1318, 1812, 240, 170, 22); c.fill(); c.restore();
    const h = 152, w = h * lg.naturalWidth / lg.naturalHeight; c.drawImage(lg, 1318 + (240 - w) / 2, 1821, w, h);
  });
}
const OY_PARTS = [['proj', 'اسم المشروع (المربع الأسود)'], ['area', 'المساحة (المربع الأزرق)'], ['use', 'الاستخدام (المربع الأحمر)'], ['price', 'السعر (الشريط البنفسجي)'], ['pills', 'السطران الأبيضان'], ['flag', 'خريطة الإمارات'], ['logo', 'شعار الشركة']];
const OY_FIELDS = [
  ['o_proj', 'اسم المشروع (المربع الأسود)'], ['o_area', 'المساحة (المربع الأزرق)'], ['o_use1', 'الاستخدام · السطر الأول (المربع الأحمر)'], ['o_use2', 'الاستخدام · السطر الثاني (مثلًا: G + 2)'],
  ['o_priceC', 'السعر (الشريط البنفسجي)', 'cash'], ['o_priceI', 'السعر (الشريط البنفسجي)', 'inst'], ['o_p1', 'السطر الأبيض الأول'], ['o_p2', 'السطر الأبيض الثاني']
];
const AYA_PARTS = [['kick', 'السطر الصغير فوق العنوان'], ['title', 'العنوان'], ['proj', 'اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'], ['map', 'الخريطة'], ['lab', 'بطاقة الموقع'], ['cards', 'البطاقات الخمس'], ['more', 'السطر فوق التواصل'], ['bar', 'نصوص التواصل']];
const AYA_FIELDS = [
  ['a_kick', 'السطر الصغير فوق العنوان'], ['a_title', 'العنوان (مثلًا: أرض سكنية في)'], ['proj', 'اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'],
  ['a_use', 'بطاقة التصريح'], ['a_fl', 'بطاقة التصريح · السطر الصغير (مثلًا: G+2، وسطر ثانٍ بـ Enter)', '', 1], ['area', 'بطاقة المساحة (قدم مربع)'],
  ['a_loc', 'بطاقة الموقع'], ['a_city', 'بطاقة الموقع · السطر الصغير'], ['a_dT', 'بطاقة الدفعة الأولى · العنوان', 'inst', 0, 'kamil'], ['down', 'بطاقة الدفعة الأولى (درهم)', 'inst', 0, 'kamil'], ['price', 'بطاقة السعر (درهم)'], ['a_ps', 'بطاقة السعر · السطر الصغير'],
  ['a_iT', 'بطاقة الأقساط · العنوان (مثلًا: 5 أقساط)', 'inst'], ['until', 'بطاقة الأقساط · القيمة (مثلًا: حتى 2028)', 'inst'], ['a_iS', 'بطاقة الأقساط · السطر الصغير', 'inst'],
  ['a_cT', 'بطاقة الدفع · العنوان', 'cash'], ['a_cV', 'بطاقة الدفع · القيمة', 'cash'], ['a_cS', 'بطاقة الدفع · السطر الصغير', 'cash'],
  ['label1', 'بطاقة الموقع على الخريطة · السطر الأول'], ['label2', 'بطاقة الموقع على الخريطة · السطر الثاني'],
  ['a_tag', 'السطر فوق التواصل'], ['a_clbl', 'عنوان التواصل'], ['phone', 'رقم التواصل'], ['a_addr', 'العنوان (سطران، Enter بينهما)', '', 1]
];

const AD_KEEP = ['sub', 'more', 'addr', 'a_tag', 'a_addr', 'a_city'];   // remembered on this device from one ad to the next
let ad = null, adRaf = 0;
try { Object.defineProperty(window, 'dnpAd', {get: () => ad}); window.dnpSide = (n, d) => adSide(plots[noIndex(n)], d); window.dnpSides = () => { const r = {}; sale.forEach(p => { const k = adSide(p) || '-'; (r[k] = r[k] || []).push(p.n); }); return r; }; } catch (err) {}
function pzPhone(t) { try { const s = JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; if (s.phones && s.phones[t]) return s.phones[t]; } catch (err) {} return PZ_THEMES[t].phone; }
function pzKeep(f) { try { const s = JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; f(s); localStorage.setItem('dnp-ad', JSON.stringify(s)); } catch (err) {} }
function adEvery(m) { return m ? 'كل ' + (m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? m + ' شهور' : m + ' شهرًا') : ''; }
/* a plot with no official plan: drawn the way the official site plans of its neighbours look (thin lines, the plot in red with
   its sides in metres, the numbers around it and the roads), and its planning conditions the same way (built area in yellow,
   setbacks in the official colours), so the post can carry both pictures */
/* the plot's outline without thin spikes (a road's edge caught with the plot when the plan was read) */
function skClean(p) {
  let pts = p.p.slice();
  for (let loop = 0; loop < 40 && pts.length > 3; loop++) {
    const area = Math.abs(pts.reduce((s, q, j) => { const r = pts[(j + 1) % pts.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
    const i = pts.findIndex((v, j) => {
      const a = pts[(j + pts.length - 1) % pts.length], b = pts[(j + 1) % pts.length], ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
      if (!(lu > 0 && lw > 0)) return true;
      const cos = (ux * wx + uy * wy) / (lu * lw), tri = Math.abs(ux * wy - uy * wx) / 2;
      return cos > Math.cos(15 * Math.PI / 180) || (cos > Math.cos(60 * Math.PI / 180) && tri < area * 0.05);
    });
    if (i < 0) break; pts.splice(i, 1);
  }
  if (pts.length === p.p.length) return p;
  const q = Object.create(p); Object.defineProperty(q, 'p', {value: pts}); return q;
}
const SK_W = 1245, SK_H = 1086, SK_SERIF = '"Times New Roman", Times, serif';
function skView(p, D) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
  const span = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.min(SK_W, SK_H) / (span * 3.1);
  const P = q => [SK_W / 2 + (q[0] - cx) * k, (D ? SK_H * 0.46 : SK_H / 2) + (q[1] - cy) * k];
  const near = plots.filter(q => q !== p && q.key !== p.key && q.p && Math.abs(q.c[0] - cx) < SK_W / k && Math.abs(q.c[1] - cy) < SK_H / k);
  return {k, P, near};
}
function skPath(c, P, q) { c.beginPath(); q.p.forEach((t, i) => { const [x, y] = P(t); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); }
function skNeighbours(c, V, withNo) {
  c.lineWidth = 1.6; c.strokeStyle = '#8A8A8A';
  V.near.forEach(q => { skPath(c, V.P, q); c.stroke(); });
  if (withNo) V.near.forEach(q => { if (q.am) return; const [x, y] = V.P(q.c); c.direction = 'ltr'; txt(c, String(q.n).replace(/^#/, ''), x, y + 10, '500 30px ' + SK_SERIF, '#2B2B2B', 'center'); });
}
/* text laid along an edge, turned so it reads upright */
function skAlong(c, s, x, y, ang, font, col) { let a = ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; c.save(); c.translate(x, y); c.rotate(a); c.direction = 'rtl'; txt(c, s, 0, 0, font, col, 'center'); c.restore(); }
function skRoads(c, V, E) {
  E.edges.filter(e => e.gap > 2).forEach(e => {
    const d = (e.gap > 45 ? 9 : e.gap / 2) * E.u, mx = (e.q[0] + e.r[0]) / 2 + e.nx * d, my = (e.q[1] + e.r[1]) / 2 + e.ny * d, [x, y] = V.P([mx, my]);
    if (x < 40 || x > SK_W - 40 || y < 40 || y > SK_H - 40) return;
    skAlong(c, 'طريق' + (e.gap <= 45 ? ' ' + e.gap.toFixed(1) : ''), x, y + 10, Math.atan2(e.r[1] - e.q[1], e.r[0] - e.q[0]), '600 30px ' + SK_SERIF, '#2B2B2B');
  });
}
function planSketch(p0) {
  const p = skClean(p0), [cv, c] = canvas(SK_W, SK_H, '#FFFFFF'), V = skView(p, false), E = adSide(p, true);
  skNeighbours(c, V, true);
  if (E && E.u) skRoads(c, V, E);
  skPath(c, V.P, p); c.lineWidth = 4; c.strokeStyle = '#D0021B'; c.stroke();
  const [x, y] = V.P(p.c); c.direction = 'ltr'; txt(c, String(p.n).replace(/^#/, ''), x, y + 12, '700 36px ' + SK_SERIF, '#1B1B1B', 'center');
  if (E && E.u) p.p.forEach((q, i) => {   // each side in metres, written inside it
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]) / E.u; if (L < 4) return;
    const [ax, ay] = V.P(q), [bx, by] = V.P(r), [cx0, cy0] = V.P(p.c), mx = (ax + bx) / 2, my = (ay + by) / 2, t = 26 / Math.hypot(cx0 - mx, cy0 - my);
    skAlong(c, L.toFixed(2), mx + (cx0 - mx) * t, my + (cy0 - my) * t + 8, Math.atan2(by - ay, bx - ax), '500 24px ' + SK_SERIF, '#D0021B');
  });
  return cv;
}
const SK_COL = {front: '#4FB6E8', side: '#24346E', back: '#D81B60', fill: '#F7E200'};
function condSketch(p0) {
  const p = skClean(p0), [cv, c] = canvas(SK_W, SK_H, '#FFFFFF'), V = skView(p, true), E = adSide(p, true);
  skNeighbours(c, V, true);
  skPath(c, V.P, p); c.fillStyle = SK_COL.fill; c.fill();
  const used = {};
  if (E && E.u && E.edges.length) {
    const open = E.edges.filter(e => e.gap > 2), front = open.length ? open.reduce((a, e) => e.gap > a.gap ? e : a, open[0]) : null;
    const turn = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
    const kindOf = e => e === front ? 'front' : e.gap > 2 ? 'side' : front && turn(e.a, front.a) > Math.PI * 0.8 ? 'back' : 'hatch';
    const depth = Math.min(3 * E.u, Math.min(...E.edges.map(e => e.L)) * 0.22);
    const strip = e => { const a = V.P(e.q), b = V.P(e.r), ix = -e.nx * depth * V.k, iy = -e.ny * depth * V.k; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + ix, b[1] + iy); c.lineTo(a[0] + ix, a[1] + iy); c.closePath(); };
    E.edges.map(e => [e, kindOf(e)]).sort((x, y) => (x[1] === 'hatch' ? 0 : 1) - (y[1] === 'hatch' ? 0 : 1)).forEach(([e, kd]) => {
      used[kd] = 1; strip(e);
      if (kd === 'hatch') { c.save(); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, SK_W, SK_H); c.strokeStyle = '#3A3A3A'; c.lineWidth = 2; for (let t = -SK_H; t < SK_W; t += 14) { c.beginPath(); c.moveTo(t, SK_H); c.lineTo(t + SK_H, 0); c.stroke(); } c.restore(); strip(e); c.lineWidth = 1.4; c.strokeStyle = '#3A3A3A'; c.stroke(); }
      else { c.fillStyle = SK_COL[kd]; c.fill(); }
    });
    skRoads(c, V, E);
  }
  skPath(c, V.P, p); c.lineWidth = 2.4; c.strokeStyle = '#3A3A3A'; c.stroke();
  const [x, y] = V.P(p.c); c.direction = 'ltr'; txt(c, String(p.n).replace(/^#/, ''), x, y + 12, '700 36px ' + SK_SERIF, '#1B1B1B', 'center');
  // the key, as on the official sheet
  const keys = [['front', 'أساسي 3.0 م'], ['side', 'جانبي 3.0 م'], ['back', 'خلفي 3.0 م'], ['hatch', 'جانبي/ملاصق']].filter(([k]) => used[k]);
  c.fillStyle = '#FFFFFF'; c.fillRect(0, SK_H - 96, SK_W, 96); c.fillStyle = '#C9C9C9'; c.fillRect(30, SK_H - 96, SK_W - 60, 2);
  const w = (SK_W - 60) / Math.max(1, keys.length);
  keys.forEach(([k, l], i) => {
    const xr = SK_W - 30 - i * w - 18, y0 = SK_H - 64;
    if (k === 'hatch') { c.save(); c.beginPath(); c.rect(xr - 40, y0, 40, 30); c.clip(); c.strokeStyle = '#3A3A3A'; c.lineWidth = 2; for (let t = -40; t < 80; t += 9) { c.beginPath(); c.moveTo(xr - 40 + t, y0 + 30); c.lineTo(xr - 10 + t, y0); c.stroke(); } c.restore(); c.strokeStyle = '#3A3A3A'; c.strokeRect(xr - 40, y0, 40, 30); }
    else { c.fillStyle = SK_COL[k]; c.fillRect(xr - 40, y0, 40, 30); }
    c.direction = 'rtl'; txt(c, l, xr - 52, y0 + 25, FB(600, 28), '#2B2B2B', 'right');
  });
  return cv;
}
/* where the plot sits in its block, read from the plan: «زاوية» with roads on two sides, «سكة» beside a lane (a gap of 10 m or less) */
const SIDE_LANE = 10;
function adSide(p, dbg) {
  if (!p || !p.p || p.p.length < 3 || p.am) return '';
  const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const u = Math.sqrt(area / (p.m20 || p.m2 || 1)); if (!(u > 0)) return '';   // plan units in one metre
  const inside = (q, x, y) => { let a = false; for (let i = 0, j = q.p.length - 1; i < q.p.length; j = i++) { const [xi, yi] = q.p[i], [xj, yj] = q.p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; } return a; };
  const R = 45 * u, near = plots.filter(q => q !== p && q.key !== p.key && q.p && Math.abs(q.c[0] - p.c[0]) < R + 80 * u && Math.abs(q.c[1] - p.c[1]) < R + 80 * u);
  const hit = (x, y) => near.some(q => inside(q, x, y));
  let cw = 0; for (let i = 0; i < p.p.length; i++) { const q = p.p[i], r = p.p[(i + 1) % p.p.length]; cw += (r[0] - q[0]) * (r[1] + q[1]); }
  const edges = [];
  let longest = 0;
  p.p.forEach((q, i) => { const r = p.p[(i + 1) % p.p.length]; longest = Math.max(longest, Math.hypot(r[0] - q[0], r[1] - q[1])); });
  p.p.forEach((q, i) => {
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]); if (L < Math.max(3 * u, longest * 0.25)) return;
    let nx = (r[1] - q[1]) / L, ny = -(r[0] - q[0]) / L; if (!inside(p, (q[0] + r[0]) / 2 - nx * 0.5 * u, (q[1] + r[1]) / 2 - ny * 0.5 * u)) { nx = -nx; ny = -ny; }   // pointing away from the plot
    const gaps = [0.25, 0.5, 0.75].map(f => { const x = q[0] + (r[0] - q[0]) * f, y = q[1] + (r[1] - q[1]) * f; for (let d = 1; d <= 45; d += 1) if (hit(x + nx * d * u, y + ny * d * u)) return d; return 99; }).sort((a, b) => a - b);
    edges.push({gap: gaps[1], a: Math.atan2(ny, nx), q, r, nx, ny, L});
  });
  if (dbg) return {u, edges};
  const open = edges.filter(e => e.gap > 2); if (!open.length) return '';
  const widest = open.reduce((a, e) => e.gap > a.gap ? e : a, open[0]);
  const turn = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
  if (open.some(e => open.some(f => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return 'زاوية';   // open on two sides that meet (a cut corner counts)
  if (open.some(e => e !== widest && e.gap <= SIDE_LANE)) return 'سكة';
  return '';
}
function adDefaults(p) {
  const T = TYPES[p.t], pr = statusOf(p) === 'av' || ent(p) ? priceOf(p) : null, inst = pr ? pr.inst : [];
  const fl = (T.floors === 'أرضي + اثنين' ? 'أرضي + طابقين' : T.floors).replace(/\s*\([^()]*\)\s*$/, ''), last = inst.length ? String(inst[inst.length - 1].d || '').slice(0, 4) : '';
  const v = {
    mode: inst.length ? 'inst' : 'cash', side: adSide(p), title: 'أرض ' + T.use, proj: PROJECT, sub: 'تملك حر لجميع الجنسيات العربية',
    area: fmt(p.ft), pay: 'كاش', until: last ? 'حتى ' + last : '', down: pr && inst.length ? fmt(Math.max(0, pr.down)) : '',
    each: inst.length ? fmt(inst[0].a) : '', every: adEvery(inst.length > 1 ? monthsBetween(inst[0].d, inst[1].d) : 0),
    price: pr ? fmt(pr.total) : '', feat: 'موقع مميز في مشروع ' + PROJECT + '\nقطعة رقم ' + p.n,
    label1: T.use, label2: '(' + fl + ')', cap1: T.use, cap2: fl,
    more: 'للمزيد من التفاصيل والإستفسار التواصل على الرقم', phone: (phoneOf(p) || '0568080655').replace(/\s/g, ''), addr: 'الشارقة شارع مليحة مكتب رقم 2',
    zoom: 1, pin: true, lab: true, pinK: 1, mx: 0, my: 0, o: {}, fsT: 1, fsN: 1, fsL: 1, fsC: 1
  };
  v.auto = v.side; if (v.side) v.title += ' ' + v.side;
  const n = inst.length, code = /\(([^()]+)\)\s*$/.exec(T.floors || '');
  Object.assign(v, {a_kick: 'فرصة إستثمارية مميزة', a_title: 'أرض ' + T.use + (v.side ? ' ' + v.side : '') + ' في', a_use: T.use, a_fl: (v.side ? '(' + v.side + ')\n' : '') + (code ? code[1] : fl), a_dT: 'دفعة أولى',
    a_loc: PROJECT, a_city: 'الشارقة', a_ps: 'درهم فقط', a_iT: n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : n ? n + ' أقساط' : 'أقساط', a_iS: 'شيكات',
    a_cT: 'الدفعات', a_cV: 'كاش', a_cS: 'نقداً',
    o_proj: PROJECT, o_area: fmt(p.ft) + ' قدم', o_use1: T.use + (v.side ? ' ' + v.side : ''), o_use2: (code ? code[1] : fl).replace(/\s*\+\s*/g, '  +  '),
    o_priceC: pr ? fmt(pr.total) + ' Dhs, Cash' : 'للاستفسار', o_priceI: pr ? fmt(pr.total) + ' Dhs, ' + (n ? n + ' Installments' : 'Installments') : 'للاستفسار',
    o_p1: 'المنطقة جاهزة للبناء', o_p2: 'تملّك حر للعرب', oFlag: true, oLogo: true, a_tag: 'موقع مميز إستثمار مضمون', a_clbl: 'للتواصل والإستفسار', a_addr: 'شركة عمر الياسي للعقارات\nالشارقة - شارع مليحة'});
  try { const s = JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; ['a_tag', 'a_addr', 'a_city'].forEach(k => { if (typeof s[k] === 'string' && s[k]) v[k] = s[k]; }); } catch (err) {}

  try { const s = JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; AD_KEEP.forEach(k => { if (typeof s[k] === 'string' && s[k]) v[k] = s[k]; }); if (PZ_THEMES[s.theme]) v.theme = s.theme; } catch (err) {}
  v.theme = v.theme || 'co'; if (designer && !admin && !DES_THEMES.includes(v.theme)) v.theme = DES_THEMES[0]; v.phone = pzPhone(v.theme); if (layoutOf(v.theme) === 'aya') v.lab = false;
  return v;
}
const adSize = im => [im.naturalWidth || im.width || 1, im.naturalHeight || im.height || 1];
/* where the plot is drawn on a scanned page: the red outline of the official plan, or the coloured setbacks of the planning conditions */
function pzFind(cv, kind) {
  const [iw, ih] = adSize(cv), W = 800, H = Math.max(1, Math.round(W * ih / iw)), [sm, c] = canvas(W, H, '#fff');
  c.drawImage(cv, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, xs = [], ys = [];
  const y0 = Math.round(H * (kind === 'plan' ? 0.12 : 0.04)), y1 = Math.round(H * (kind === 'plan' ? 0.66 : 0.32));
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const hit = kind === 'plan' ? r > 110 && r > g * 1.6 && r > b * 1.4 && r - g > 50
      : (r > 200 && g > 170 && b < 110) || (b > 170 && g > 140 && r < 140) || (r > 150 && g < 90 && b > 80 && r - b > 20);
    if (hit) { xs.push(x); ys.push(y); }
  }
  let bx0, bx1, by0, by1;
  if (xs.length < 25) { bx0 = W * 0.15; bx1 = W * 0.85; by0 = H * (kind === 'plan' ? 0.2 : 0.08); by1 = H * (kind === 'plan' ? 0.55 : 0.3); }
  else {
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    bx0 = q(xs, 0.03); bx1 = q(xs, 0.97); by0 = q(ys, 0.03); by1 = q(ys, 0.97);
  }
  const A = 415 / 362, grow = kind === 'plan' ? 2.6 : 3.2;
  let bw = Math.max(20, bx1 - bx0) * grow, bh = Math.max(20, by1 - by0) * grow;
  if (bw / bh < A) bw = bh * A; else bh = bw / A;
  return {cx: (bx0 + bx1) / 2 / W, cy: (by0 + by1) / 2 / H, z: Math.max(1, Math.min(10, W / bw))};
}
async function adPictures(p) {
  const out = [null, null, null], b = bldPic(p);
  if (b) { const im = await imageOf(b); if (im) out[0] = {im, fit: 'cover', name: 'صورة المبنى', src: b.src, fb: b.fallback || '', own: !!b.own}; }
  if (!out[0] && !(ent(p) || {}).noimg && bldOf(p)) {   // no picture for this kind here: the plugin's own villa or building picture
    const app = document.querySelector('script[src*="/assets/app.js"]'), k = bldOf(p);
    if (app) { const u = app.src.replace(/app\.js.*$/, k === 'reg' || k === 'cor' ? 'p/al-ruwaidat/b-reg.jpg' : 'p/houshi-marwan/b-villa.jpg'); const im = await imageOf({src: u}); if (im) out[0] = {src: u, im, fit: 'cover', name: 'صورة تخيلية (يمكن تغييرها)'}; }
  }
  const pl = planOf(p), doc = docOf(p), sketch = () => { const [cv, c] = canvas(1200, 900, '#fff'); drawSketch(c, p, 1200, 900); return cv; };
  const pageSlot = (pages, k, kind, name) => pages[k] ? {im: pages[k], fit: 'crop', page: k, doc: 1, kind, crop: pzFind(pages[k], kind), name} : null;
  if (doc) {
    try {
      const pages = await docRender(doc, 1600); ad.pages = pages;
      out[1] = pageSlot(pages, pages.length >= 2 ? 1 : 0, 'plan', 'مخطط الأرض الرسمي');
      out[2] = pageSlot(pages, 2, 'cond', 'شروط التخطيط للقطعة');
    } catch (err) {}
  }
  if (!out[1] && pl) { const im = await imageOf({src: pl.sk.u, own: true}); if (im) out[1] = {im, fit: 'contain', name: 'مخطط الأرض', src: pl.sk.u, own: true}; }
  if (!out[2] && pl && pl.last) { const im = await imageOf({src: pl.last.u, own: true}); if (im) out[2] = {im, fit: 'crop', kind: 'cond', crop: pzFind(im, 'cond'), name: 'شروط التخطيط للقطعة', src: pl.last.u, own: true}; }
  if (!out[1]) { try { out[1] = {im: planSketch(p), fit: 'contain', name: 'مخطط الأرض (مرسوم من الخارطة)', gen: 'plan'}; } catch (err) { out[1] = {im: sketch(), fit: 'contain', name: 'مخطط توضيحي', gen: 'sketch'}; } }
  if (!out[2] && !p.am) { try { out[2] = {im: condSketch(p), fit: 'contain', name: 'شروط التخطيط (مرسومة من الخارطة)', gen: 'cond'}; } catch (err) {} }
  return out;
}
let PZS = 1;   // the admin's font size for the part being drawn
function adFit(c, s, x, y, w, px, weight, color, align, fam) {
  px = Math.round(px * PZS); const f = fam || FD; c.font = f(weight, px);
  while (c.measureText(s).width > w && px > 14) { px -= 2; c.font = f(weight, px); }
  txt(c, s, x, y, f(weight, px), color, align); return px;
}
/* a text kept inside its own box: smaller until it fits the width and the height (marks above and below the letters
   included), then centred in the box, so no line can run into the next one */
function adFitV(c, s, x, top, bot, w, px, weight, color, align, fam) {
  s = String(s || ''); if (!s) return 0;
  const f = fam || FD; px = Math.round(px * PZS); let m, hgt;
  for (;;) { c.font = f(weight, px); m = c.measureText(s); hgt = (m.actualBoundingBoxAscent || px * 0.8) + (m.actualBoundingBoxDescent || px * 0.25); if ((m.width <= w && hgt <= bot - top) || px <= 12) break; px -= 2; }
  const y = top + (bot - top - hgt) / 2 + (m.actualBoundingBoxAscent || px * 0.8);
  txt(c, s, x, y, f(weight, px), color, align); return px;
}
function adWrap(c, s, w) {
  const out = [];
  String(s || '').split('\n').forEach(par => {
    let line = '';
    par.split(/\s+/).filter(Boolean).forEach(word => { const t = line ? line + ' ' + word : word; if (line && c.measureText(t).width > w) { out.push(line); line = word; } else line = t; });
    out.push(line);
  });
  return out;
}
function adIcon(c, kind, cx, cy) {
  c.save(); c.strokeStyle = TH.icon; c.fillStyle = TH.icon; c.lineWidth = 4; c.lineJoin = c.lineCap = 'round';
  const cal = () => { box(c, cx - 34, cy - 30, 68, 62, 10); c.stroke(); c.beginPath(); c.moveTo(cx - 34, cy - 12); c.lineTo(cx + 34, cy - 12); c.moveTo(cx - 18, cy - 40); c.lineTo(cx - 18, cy - 24); c.moveTo(cx + 18, cy - 40); c.lineTo(cx + 18, cy - 24); c.stroke(); };
  if (kind === 'area') {
    c.strokeRect(cx - 30, cy - 30, 60, 60);
    [[-30, -30], [30, -30], [-30, 30], [30, 30]].forEach(([a, b]) => { c.beginPath(); c.arc(cx + a, cy + b, 7, 0, 7); c.fillStyle = TH.card; c.fill(); c.stroke(); });
  } else if (kind === 'cal') {
    cal(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.fillRect(cx - 22 + i * 17, cy - 2 + j * 10, 9, 6);
  } else if (kind === 'money') {
    cal(); c.beginPath(); c.arc(cx + 22, cy + 22, 20, 0, 7); c.fillStyle = TH.card; c.fill(); c.stroke();
    c.direction = 'ltr'; txt(c, '$', cx + 22, cy + 31, FD(800, 26), TH.icon, 'center'); c.direction = 'rtl';
  } else if (kind === 'wallet') {
    box(c, cx - 36, cy - 24, 66, 54, 10); c.stroke(); box(c, cx + 8, cy - 8, 32, 22, 6); c.fillStyle = TH.card; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(cx - 30, cy - 24); c.lineTo(cx + 14, cy - 40); c.lineTo(cx + 22, cy - 24); c.stroke();
  }
  c.restore();
}
function adMap(c, p, x, y, w, h, v) {
  const k = 2.4 * (+v.zoom || 1), uw = w / k, uh = h / k, x0 = p.c[0] - uw / 2 - (+v.mx || 0) / k, y0 = p.c[1] - uh * 0.56 - (+v.my || 0) / k;
  c.save(); box(c, x, y, w, h, 34); c.clip(); c.fillStyle = '#EDE6D6'; c.fillRect(x, y, w, h);
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x0, -y0);
  drawPlan(c, x0, y0, x0 + uw, y0 + uh, k);
  const path = paintPlots(c, q => Math.abs(q.c[0] - p.c[0]) <= uw / 2 + 40 && Math.abs(q.c[1] - p.c[1]) <= uh / 2 + 40, 4.2);
  path(p); c.lineJoin = 'round'; c.fillStyle = TH.plot; c.fill(); c.lineWidth = 3.2 / k * 2.4; c.strokeStyle = '#fff'; c.stroke();
  c.save(); c.translate(p.c[0], p.c[1]); c.rotate(p.r * Math.PI / 180); c.direction = 'ltr'; txt(c, p.n, 0, 1.6, FD(800, 4.2), '#fff', 'center'); c.restore();
  c.restore();
  const sx = x + (p.c[0] - x0) * k, sy = y + (p.c[1] - y0) * k;
  {
    const l1 = v.label1 || '', l2 = v.label2 || '', K = +v.pinK || 1, lo = (v.o && v.o.lab) || [0, 0];
    if (v.lab && (l1 || l2)) {   // the label box, joined to the plot by a line
      c.font = FD(700, 36); const tw = Math.max(c.measureText(l1).width, (c.font = FB(600, 32), c.measureText(l2).width));
      const bw = Math.min(w - 60, tw + 56), bh = l1 && l2 ? 108 : 66;
      let bx = sx + 60, by = sy - 300; if (bx + bw > x + w - 24) bx = sx - 60 - bw; if (bx < x + 24) bx = x + 24; if (by < y + 24) by = y + 24;
      bx += lo[0]; by += lo[1]; ad.hits.push({k: 'lab', x: bx, y: by, w: bw, h: bh});
      c.strokeStyle = TH.lline; c.lineWidth = 6; c.beginPath(); c.moveTo(bx + (bx > sx ? 50 : bw - 50), by + bh); c.lineTo(sx, sy); c.stroke();
      c.fillStyle = TH.lline; c.beginPath(); c.arc(sx, sy, 9, 0, 7); c.fill();
      c.fillStyle = TH.lbox; box(c, bx, by, bw, bh, 10); c.fill(); if (TH.lbox === '#FFFFFF') { c.lineWidth = 2; c.strokeStyle = TH.lline; c.stroke(); }
      if (l1) adFitV(c, l1, bx + bw / 2, by + 8, by + (l2 ? 56 : bh - 8), bw - 30, 36, 700, TH.ltext, 'center');
      if (l2) adFitV(c, l2, bx + bw / 2, by + (l1 ? 58 : 8), by + bh - 8, bw - 30, 32, 600, TH.ltext, 'center', FB);
    }
    if (v.pin) {
    c.save(); c.translate(sx, sy); c.scale(K, K); c.translate(-sx, -sy);
    const px = sx - 22, top = sy - 170;   // the red pin
    c.strokeStyle = '#B8BCC4'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, top + 30); c.lineTo(sx - 2, sy - 6); c.stroke();
    const g = c.createRadialGradient(px - 12, top - 12, 4, px, top, 40); g.addColorStop(0, '#FF8A8A'); g.addColorStop(0.35, '#E3262B'); g.addColorStop(1, '#9E1015');
    c.fillStyle = g; c.beginPath(); c.arc(px, top, 38, 0, 7); c.fill();
    c.restore();
    }
  }
  c.restore();
  c.lineWidth = 5; c.strokeStyle = TH.mapLine; box(c, x, y, w, h, 34); c.stroke();
}
function adCard(c, y, h, title, num, unit, icon, extra) {
  const x = 1045, w = 525;
  c.fillStyle = TH.card; box(c, x, y, w, h, 30); c.fill(); c.lineWidth = 2; c.strokeStyle = TH.cardLine; c.stroke();
  c.strokeStyle = TH.icon; c.lineWidth = 3; c.beginPath(); c.moveTo(1207, y + 26); c.lineTo(1207, y + h - 26); c.stroke();
  adIcon(c, icon, 1128, y + h / 2);
  const v = ad.v, r = 1535, t0 = extra ? y + 12 : y + 16, t1 = extra ? y + 60 : y + 72, n0 = extra ? y + 66 : y + 80, n1 = extra ? y + 112 : y + 136;
  PZS = v.fsL; adFitV(c, title, r - 4, t0, t1, 300, 42, 700, TH.ink, 'right');
  let nw = 0;
  if (num) { PZS = v.fsN; c.direction = 'ltr'; const px = adFitV(c, num, r, n0, n1, 250, 50, 800, TH.ink, 'right'); c.font = FD(800, px); nw = c.measureText(num).width; c.direction = 'rtl'; }
  PZS = v.fsL;
  if (unit) adFitV(c, unit, r - nw - (num ? 14 : 0), n0 + (num ? 6 : 0), n1, 300 - nw, num ? 38 : 50, num ? 500 : 800, TH.ink, 'right', num ? FB : FD);
  if (extra) adFitV(c, extra, r - 60, y + 114, y + h - 8, 260, 27, 500, TH.ink, 'right', FB);
}
function adPicture(c, slot, x, y, w, h, cap) {
  c.save(); box(c, x, y, w, h, 24); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y, w, h);
  const [iw, ih] = adSize(slot.im);
  if (slot.fit === 'crop') {   // a cut-out of a page: centre and zoom chosen automatically, adjustable in the form
    const k0 = slot.crop, sw = iw / k0.z, sh = sw * h / w, sx = k0.cx * iw - sw / 2, sy = k0.cy * ih - sh / 2, k = w / sw;
    c.drawImage(slot.im, x - sx * k, y - sy * k, iw * k, ih * k);
  } else {   // the whole picture, or the frame filled: enlarged and moved as the admin chooses
    const k = (slot.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min((w - 20) / iw, (h - 20) / ih)) * (slot.z || 1), dw = iw * k, dh = ih * k;
    c.drawImage(slot.im, x + w / 2 - (slot.cx == null ? 0.5 : slot.cx) * dw, y + h / 2 - (slot.cy == null ? 0.5 : slot.cy) * dh, dw, dh);
  }
  if (cap && (cap[0] || cap[1])) {
    const bh = cap[0] && cap[1] ? 76 : 50; c.fillStyle = TH.cap; c.fillRect(x, y + h - bh, w, bh);
    if (cap[0]) adFitV(c, cap[0], x + w / 2, y + h - bh + 4, y + h - (cap[1] ? 38 : 4), w - 30, 28, 600, TH.capText, 'center', FB);
    if (cap[1]) adFitV(c, cap[1], x + w / 2, y + h - (cap[0] ? 38 : bh - 4), y + h - 4, w - 30, 28, 600, TH.capText, 'center', FB);
  }
  c.restore(); c.lineWidth = 2; c.strokeStyle = TH.picLine; box(c, x, y, w, h, 24); c.stroke();
}
/* the parts of the post the admin can move (arrows in the form, or dragged on the picture) */
const AD_PARTS = [['title', 'العنوان الرئيسي'], ['proj', 'شريط اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'], ['logo', 'الشعار'], ['map', 'الخريطة'], ['lab', 'بطاقة الموقع'], ['cards', 'البطاقات والسعر'], ['pics', 'صف الصور'], ['more', 'سطر التواصل'], ['bar', 'الرقم والعنوان (الشريط السفلي)']];
function drawAd(cv) {
  const c = cv.getContext('2d'), v = ad.v, p = ad.p; TH = PZ_THEMES[v.theme] || PZ_THEMES.co; v.o = v.o || {}; ad.hits = [];
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = TH.bg; c.fillRect(0, 0, AD_W, AD_H); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
  const at = (k, x, y, w, h, f) => { const o = v.o[k] || [0, 0]; c.save(); c.translate(o[0], o[1]); f(); c.restore(); ad.hits.push({k, x: x + o[0], y: y + o[1], w, h}); };
  if (TH.layout === 'aya') { ayaDraw(c, v, p, at); PZS = 1; adSel(c); return; }
  if (TH.layout === 'oy') { oyDraw(c, v, p, at); PZS = 1; adSel(c); return; }
  // the company mark with its name, where the template has it
  at('logo', 40, 0, 430, 362, () => {
    if (TH.logo && TH.logo.naturalWidth) c.drawImage(TH.logo, 40, 0, 430, 362);
    else { adFit(c, 'عمر الياسي للعقارات', 217, 300, 420, 42, 800, TH.ink, 'center'); c.direction = 'ltr'; adFit(c, 'Omar Al Yassi Real Estate', 217, 338, 420, 28, 700, TH.ink, 'center', FB); c.direction = 'rtl'; }
  });
  // title, project band, line under it
  PZS = v.fsT; at('title', 740, 20, 860, 112, () => adFitV(c, v.title, 1560, 22, 120, 820, 78, 800, TH.ink, 'right'));
  at('proj', 740, 138, 860, 124, () => {
    { const g = c.createLinearGradient(740, 0, AD_W, 0); g.addColorStop(0, TH.band[0]); g.addColorStop(0.55, TH.band[1]); g.addColorStop(1, TH.band[0]); c.fillStyle = g; } c.beginPath(); c.moveTo(AD_W, 138); c.lineTo(762, 138); c.arcTo(740, 138, 740, 160, 22); c.lineTo(740, 240); c.arcTo(740, 262, 762, 262, 22); c.lineTo(AD_W, 262); c.closePath(); c.fill();
    adFitV(c, v.proj, 1170, 150, 252, 800, 104, 800, TH.bandText, 'center');
  });
  at('sub', 620, 280, 940, 85, () => adFitV(c, v.sub, 1540, 288, 366, 900, 62, 700, TH.ink, 'right'));
  // the plan around the plot (dragging inside it moves the plan; the label box is its own part)
  PZS = v.fsL; { const o = v.o.map || [0, 0]; c.save(); c.translate(o[0], o[1]); const h0 = ad.hits.length; adMap(c, p, 52, 387, 950, 913, v); ad.hits.slice(h0).forEach(t => { t.x += o[0]; t.y += o[1]; }); c.restore(); ad.hits.push({k: 'map', pan: 1, x: 52 + o[0], y: 387 + o[1], w: 950, h: 913}); }
  // the facts
  const big = (y, h, title, num) => {
    c.fillStyle = TH.card; box(c, 1045, y, 525, h, 30); c.fill(); c.lineWidth = 2; c.strokeStyle = TH.cardLine; c.stroke();
    PZS = v.fsL; adFitV(c, title, 1307, y + 26, y + 92, 480, 56, 400, TH.ink, 'center', FB);
    if (num) { PZS = v.fsN; c.direction = 'ltr'; adFitV(c, num, 1307, y + 100, y + h - 74, 470, 118, 800, TH.price, 'center'); c.direction = 'rtl'; }
    PZS = v.fsL; adFitV(c, 'درهـــم', 1307, y + h - 66, y + h - 12, 300, 46, 400, TH.ink, 'center', FB);
  };
  at('cards', 1045, 390, 525, v.mode === 'cash' ? 885 : 915, () => {
    if (v.mode === 'cash') {
      adCard(c, 390, 150, 'المساحة', v.area, 'قدم مربع', 'area');
      adCard(c, 556, 150, 'طريقة الدفع', '', v.pay, 'money');
      big(726, 265, 'سعر الأرض', v.price);
      c.fillStyle = TH.card; box(c, 1045, 1010, 525, 265, 30); c.fill(); c.lineWidth = 2; c.strokeStyle = TH.cardLine; c.stroke();
      let px = Math.round(52 * v.fsL), lines; do { c.font = FB(500, px); lines = adWrap(c, v.feat, 480); px -= 2; } while ((lines.length * px * 1.25 > 235 || lines.some(l => c.measureText(l).width > 490)) && px > 18);
      px += 2; const lh = px * 1.25, y0 = 1010 + 132 - (lines.length - 1) * lh / 2 + px * 0.35;
      lines.forEach((l, i) => txt(c, l, 1307, y0 + i * lh, FB(500, px), TH.ink, 'center'));
    } else {
      adCard(c, 397, 150, 'المساحة', v.area, 'قدم مربع', 'area');
      adCard(c, 560, 150, 'الأقساط', '', v.until, 'cal');
      adCard(c, 722, 150, 'الدفعة المقدمة', v.down, 'درهم', 'wallet');
      adCard(c, 884, 150, 'قيمة القسط', v.each, 'درهم', 'money', v.every);
      big(1043, 262, 'سعر الأرض', v.price);
    }
  });
  // the pictures (dragging inside one moves the picture in its frame)
  PZS = v.fsL;
  const shown = ad.img.map((s, i) => s ? i : -1).filter(i => i >= 0), n = shown.length, w = 415, h = 362;
  if (n) {
    const gap = n === 3 ? (1516 - 3 * w) / 2 : 90, x0 = (AD_W - (n * w + (n - 1) * gap)) / 2, o = v.o.pics || [0, 0];   // building · official plan · planning conditions, as in the template
    c.save(); c.translate(o[0], o[1]);
    ad.hits.push({k: 'pics', x: x0 + o[0], y: 1340 + o[1], w: n * w + (n - 1) * gap, h});
    shown.forEach((i, j) => { const x = x0 + j * (w + gap); adPicture(c, ad.img[i], x, 1340, w, h, i === 0 ? [v.cap1, v.cap2] : null); ad.hits.push({k: 'pics', pic: i, x: x + o[0], y: 1340 + o[1], w, h}); });
    c.restore();
  }
  // contact
  PZS = v.fsC; at('more', 100, 1745, 1400, 75, () => adFitV(c, v.more, 800, 1756, 1832, 1400, 50, 700, TH.ink, 'center'));
  c.fillStyle = TH.bar; c.fillRect(0, 1852, AD_W, AD_H - 1852);
  at('bar', 0, 1852, AD_W, 148, () => {
    c.fillStyle = TH.blob; c.beginPath(); c.moveTo(0, 1852); c.lineTo(560, 1852); c.bezierCurveTo(615, 1852, 640, 1890, 640, 1926); c.bezierCurveTo(640, 1962, 615, 2000, 560, 2000); c.lineTo(0, 2000); c.closePath(); c.fill();
    c.direction = 'ltr'; adFitV(c, v.phone, 335, 1876, 1980, 470, 86, 800, TH.phoneInk, 'center'); c.direction = 'rtl';
    const icon = (d, x, y, k, col) => { c.save(); c.translate(x, y); c.scale(k, k); c.fillStyle = col; c.fill(new Path2D(d)); c.restore(); };
    icon('M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z', 26, 1891, 3, TH.phoneInk);
    adFitV(c, v.addr, 1462, 1890, 1968, 760, 56, 700, TH.addr, 'right');
    icon('M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', 1488, 1888, 3.3, TH.pinIcon);
  });
  PZS = 1; adSel(c);
}
function adSel(c) { if (ad.sel && !ad.export) { const t = [...ad.hits].reverse().find(t => t.k === ad.sel && t.pic == null); if (t) { c.save(); c.setLineDash([14, 10]); c.lineWidth = 4; c.strokeStyle = '#1E88E5'; c.strokeRect(t.x - 6, t.y - 6, t.w + 12, t.h + 12); c.restore(); } } }
function adRedraw() { cancelAnimationFrame(adRaf); adRaf = requestAnimationFrame(() => { if (ad) drawAd($('pzCv')); }); }
const AD_FIELDS = [
  ['title', 'العنوان الرئيسي'], ['proj', 'اسم المشروع (الشريط الأزرق)'], ['sub', 'السطر تحت اسم المشروع'], ['area', 'المساحة (قدم مربع)'],
  ['pay', 'طريقة الدفع', 'cash'], ['feat', 'نص المميزات (سطر جديد = Enter)', 'cash', 1],
  ['until', 'الأقساط (مثلًا: حتى 2029)', 'inst'], ['down', 'الدفعة المقدمة (درهم)', 'inst'], ['each', 'قيمة القسط (درهم)', 'inst'], ['every', 'الفترة بين الأقساط (مثلًا: كل 4 شهور)', 'inst'],
  ['price', 'سعر الأرض (درهم)'], ['label1', 'بطاقة الموقع على الخريطة · السطر الأول'], ['label2', 'بطاقة الموقع على الخريطة · السطر الثاني'],
  ['cap1', 'تعليق صورة المبنى · السطر الأول'], ['cap2', 'تعليق صورة المبنى · السطر الثاني'], ['more', 'سطر التواصل'], ['phone', 'رقم التواصل'], ['addr', 'العنوان']
];
function pzForm() {
  const lay = layoutOf(ad.v.theme), aya = lay === 'aya', oy = lay === 'oy';
  const v = ad.v, f = ([k, l, m, area, only]) => only && only !== (PZ_THEMES[v.theme] || {}).ay ? '' : `<label data-m="${m || ''}"${m && m !== v.mode ? ' hidden' : ''}>${l}${area ? `<textarea dir="auto" data-k="${k}" rows="3">${esc(v[k])}</textarea>` : `<input type="text" dir="auto" data-k="${k}" value="${esc(v[k])}">`}</label>`;
  const slots = ['صورة المبنى', 'مخطط الأرض', 'شروط التخطيط'].map((t, i) => {
    const s = ad.img[i];
    const crop = s && s.fit === 'crop' ? `<div class="pz-crop">${(s.pages || ad.pages) && s.page != null ? `<label>صفحة الملف<select data-slotpage="${i}">${(s.pages || ad.pages).map((q, k) => `<option value="${k}"${k === s.page ? ' selected' : ''}>صفحة ${k + 1}</option>`).join('')}</select></label>` : ''}
      <label>تكبير<input type="range" data-slotz="${i}" min="0.4" max="10" step="0.05" value="${s.crop.z}"></label>
      <label>تحريك أفقي<input type="range" data-slotx="${i}" min="0" max="1" step="0.002" value="${s.crop.cx}"></label>
      <label>تحريك عمودي<input type="range" data-sloty="${i}" min="0" max="1" step="0.002" value="${s.crop.cy}"></label>
      <span class="rowbtns"><button type="button" class="btn" data-slotcut="${i}">✂️ قصّ يدوي</button>${s.kind ? `<button type="button" class="btn" data-slotauto="${i}">قصّ تلقائي</button>` : ''}</span></div>`
      : s ? `<div class="pz-crop">
      <label>تكبير<input type="range" data-picz="${i}" min="0.4" max="4" step="0.05" value="${s.z || 1}"></label>
      <label>تحريك يمين / يسار<input type="range" data-picx="${i}" min="0" max="1" step="0.005" value="${s.cx == null ? 0.5 : s.cx}"></label>
      <label>تحريك فوق / تحت<input type="range" data-picy="${i}" min="0" max="1" step="0.005" value="${s.cy == null ? 0.5 : s.cy}"></label>
      <span class="rowbtns"><button type="button" class="btn" data-picreset="${i}">إرجاع</button><button type="button" class="btn" data-slotcut="${i}">✂️ قصّ يدوي</button></span></div>` : '';
    return `<div class="pz-slot"><span><b>${t}</b><br><small>${s ? esc(s.name) : 'بدون صورة'}</small></span><span class="rowbtns"><button type="button" class="btn" data-pzup="${i}">${s ? 'تغيير' : 'إضافة'} (صورة أو PDF)</button>${s && s.fit !== 'crop' ? `<button type="button" class="btn" data-pzfit="${i}">${s.fit === 'cover' ? 'ملء الإطار' : 'الصورة كاملة'}</button>` : ''}${s ? `<button type="button" class="btn danger" data-pzrm="${i}">حذف</button>` : ''}</span>${crop}</div>`;
  }).join('');
  $('pzForm').innerHTML = `${ad.savedAt ? `<div class="pz-saved">📌 تصميم محفوظ (<span class="num">${esc(ad.savedAt)}</span>)<button type="button" class="btn" data-pznew>بدء تصميم جديد</button></div>` : ''}<div class="seg pz-th" role="group" aria-label="القالب"${designer && !admin ? ' hidden' : ''}>${Object.entries(PZ_THEMES).filter(([k]) => admin || !designer || DES_THEMES.includes(k)).map(([k, t]) => `<button type="button" data-pzth="${k}" aria-pressed="${v.theme === k}"><i style="background:${t.bar}"></i>${t.name}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="طريقة الدفع"><button type="button" data-pzmode="cash" aria-pressed="${v.mode === 'cash'}">قالب الكاش</button><button type="button" data-pzmode="inst" aria-pressed="${v.mode === 'inst'}">قالب الأقساط</button></div>
    ${(aya ? AYA_FIELDS : oy ? OY_FIELDS : AD_FIELDS).map(f).join('')}
    <h3>حجم الخط</h3>
    ${[['fsT', 'العنوان واسم المشروع'], ['fsN', 'الأرقام والأسعار'], ['fsL', 'النصوص والعناوين الصغيرة'], ['fsC', 'سطر وشريط التواصل']].map(([k, l]) => `<label>${l} <b class="num" data-fsv="${k}">${Math.round(v[k] * 100)}%</b><input type="range" data-k="${k}" min="0.6" max="1.6" step="0.05" value="${v[k]}"></label>`).join('')}
    <button type="button" class="btn" data-fsreset>إرجاع أحجام الخط الأصلية</button>
    <h3>موقع القطعة في العنوان</h3>
    <div class="seg pz-side" role="group" aria-label="موقع القطعة">${[['', 'عادية'], ['زاوية', 'زاوية'], ['سكة', 'سكة']].map(([k, l]) => `<button type="button" data-pzside="${k}" aria-pressed="${(v.side || '') === k}">${l}${(v.auto || '') === k ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="help">✓ = ما قرأته من الخارطة${v.auto ? ': ' + v.auto : ': ليست زاوية ولا على سكة'}. الاختيار يضيف الكلمة إلى آخر العنوان، ويمكنك تعديل العنوان بنفسك.</p>
    <h3>تحريك العناصر</h3>
    <p class="help">اسحب أي نص أو بطاقة على الإعلان مباشرة، أو اختر العنصر وحرّكه بالأسهم. السحب داخل الخريطة أو داخل صورة يحرّك ما بداخلها.</p>
    <div class="pz-move"><select id="pzPart">${(aya ? AYA_PARTS : oy ? OY_PARTS : AD_PARTS).map(([k, l]) => `<option value="${k}"${ad.sel === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="pz-arrows"><button type="button" class="btn" data-mv="0,-1" aria-label="فوق">▲</button><button type="button" class="btn" data-mv="1,0" aria-label="يمين">▶</button><button type="button" class="btn" data-mv="-1,0" aria-label="يسار">◀</button><button type="button" class="btn" data-mv="0,1" aria-label="تحت">▼</button></div>
      <span class="rowbtns"><button type="button" class="btn" data-mvreset>إرجاع مكانه</button><button type="button" class="btn" data-mvall>إرجاع كل الأماكن</button></span></div>
    <h3>الخريطة والدبوس</h3>
    <label>تكبير الخريطة<input type="range" data-k="zoom" min="0.5" max="3" step="0.1" value="${v.zoom}"></label>
    <label>حجم الدبوس <b class="num" data-fsv="pinK">${Math.round((v.pinK || 1) * 100)}%</b><input type="range" data-k="pinK" min="0.4" max="2.5" step="0.05" value="${v.pinK || 1}"></label>
    <label class="chk"><input type="checkbox" data-k="pin"${v.pin ? ' checked' : ''}> الدبوس الأحمر</label>
    ${oy ? `<label class="chk"><input type="checkbox" data-k="oFlag"${v.oFlag ? ' checked' : ''}> خريطة الإمارات</label><label class="chk"><input type="checkbox" data-k="oLogo"${v.oLogo ? ' checked' : ''}> شعار الشركة</label>` : `<label class="chk"><input type="checkbox" data-k="lab"${v.lab ? ' checked' : ''}> بطاقة الموقع على الخريطة</label>`}
    <button type="button" class="btn" data-mapcenter>إرجاع الخريطة إلى القطعة</button>
    ${aya || oy ? '' : `<h3>الصور</h3>${slots}`}
    ${admin && pdLink ? `<div class="pz-saved">رابط المدير لتصميم البوستات بقالب عمر الياسي (بدون تسجيل دخول): <span class="pd-link" dir="ltr">${esc(pdLink)}</span><button type="button" class="btn" data-pdcopy="${esc(pdLink)}">نسخ الرابط</button></div>` : ''}
    <p class="help">الصور التي تضيفها هنا للإعلان فقط، ولا تُرفع إلى الموقع. أسماء الحقول المحفوظة على هذا الجهاز: السطر تحت اسم المشروع وسطر التواصل والرقم والعنوان.</p>`;
}
async function openAd(p, fresh) {
  $('pzTitle').textContent = 'تصميم إعلان · قطعة ' + p.n + ' · جارٍ التجهيز…'; $('pzbox').hidden = false; $('pzForm').innerHTML = '';
  await fontsReady(); await logoReady; await vecReady; await bgReady; await ayaLoad();
  ad = {p, v: adDefaults(p), img: [null, null, null]};
  try { ad.img = await adPictures(p); } catch (err) {}
  let restored = false; if (!fresh) { try { restored = await adRestore(p); } catch (err) {} }
  $('pzTitle').textContent = 'تصميم إعلان · قطعة ' + p.n + (restored ? ' · تصميم محفوظ' : '');
  $('pzSave').hidden = $('pzAll').hidden = designer && !admin;
  pzForm(); drawAd($('pzCv'));
}
$('pzForm').addEventListener('input', e => {
  const t = e.target, k = t.dataset.k; if (!ad) return;
  for (const [key, f] of [['slotz', 'z'], ['slotx', 'cx'], ['sloty', 'cy']]) if (t.dataset[key] !== undefined) { const s = ad.img[+t.dataset[key]]; if (s && s.crop) { s.crop[f] = +t.value; adRedraw(); } return; }
  for (const [key, f] of [['picz', 'z'], ['picx', 'cx'], ['picy', 'cy']]) if (t.dataset[key] !== undefined) { const s = ad.img[+t.dataset[key]]; if (s) { s[f] = +t.value; adRedraw(); } return; }
  if (!k) return;
  ad.v[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
  const fv = $('pzForm').querySelector('[data-fsv="' + k + '"]'); if (fv) fv.textContent = Math.round(+t.value * 100) + '%';
  if (k === 'phone') pzKeep(s => { (s.phones = s.phones || {})[ad.v.theme] = t.value; });
  if (AD_KEEP.includes(k)) { try { const s = JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; s[k] = t.value; localStorage.setItem('dnp-ad', JSON.stringify(s)); } catch (err) {} }
  adRedraw();
});
$('pzForm').addEventListener('change', e => {
  const t = e.target; if (!ad) return;
  if (t.id === 'pzPart') { ad.sel = t.value; adRedraw(); return; }
  if (t.dataset.slotpage === undefined) return;
  const i = +t.dataset.slotpage, s = ad.img[i], n = +t.value, pages = s && (s.pages || ad.pages); if (!s || !pages || !pages[n]) return;
  s.im = pages[n]; s.page = n; s.crop = pzFind(s.im, s.kind || 'plan'); pzForm(); adRedraw();
});
$('pzForm').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !ad) return;
  if (b.dataset.pzside !== undefined) { const t = ad.v.title.replace(/\s+(زاوية|سكة)\s*$/, ''); ad.v.side = b.dataset.pzside; ad.v.title = t + (ad.v.side ? ' ' + ad.v.side : '');
    { const fi = /\s+في\s*$/.test(ad.v.a_title), b0 = ad.v.a_title.replace(/\s+في\s*$/, '').replace(/\s+(زاوية|سكة)\s*$/, ''); ad.v.a_title = b0 + (ad.v.side ? ' ' + ad.v.side : '') + (fi ? ' في' : ''); } pzForm(); adRedraw(); return; }
  if (b.dataset.mv) { const k = $('pzPart').value, [dx, dy] = b.dataset.mv.split(',').map(Number), o = ad.v.o[k] || [0, 0]; ad.sel = k; ad.v.o[k] = [o[0] + dx * 10, o[1] + dy * 10]; adRedraw(); return; }
  if (b.dataset.mvreset !== undefined) { delete ad.v.o[$('pzPart').value]; ad.sel = $('pzPart').value; adRedraw(); return; }
  if (b.dataset.mvall !== undefined) { ad.v.o = {}; adRedraw(); return; }
  if (b.dataset.mapcenter !== undefined) { ad.v.mx = ad.v.my = 0; adRedraw(); return; }
  if (b.dataset.picreset !== undefined) { const s = ad.img[+b.dataset.picreset]; if (s) { delete s.z; delete s.cx; delete s.cy; pzForm(); adRedraw(); } return; }
  if (b.dataset.slotcut !== undefined) { pzCut(+b.dataset.slotcut); return; }
  if (b.dataset.pznew !== undefined) { if (window.confirm('بدء تصميم جديد من بيانات القطعة؟ يبقى التصميم المحفوظ كما هو حتى تضغط «حفظ التصميم».')) openAd(ad.p, true); return; }
  if (b.dataset.fsreset !== undefined) { ['fsT', 'fsN', 'fsL', 'fsC'].forEach(k => { ad.v[k] = 1; }); pzForm(); adRedraw(); return; }
  if (b.dataset.pzth) { const now = layoutOf(b.dataset.pzth); if (layoutOf(ad.v.theme) !== now) { pzStash(); pzUnstash(now); } ad.v.theme = b.dataset.pzth; ad.v.phone = pzPhone(ad.v.theme); pzKeep(s => { s.theme = ad.v.theme; }); pzForm(); adRedraw(); return; }
  if (b.dataset.pzmode) { ad.v.mode = b.dataset.pzmode; pzForm(); adRedraw(); return; }
  if (b.dataset.pzup !== undefined) { ad.slot = +b.dataset.pzup; $('pzFile').value = ''; $('pzFile').click(); return; }
  if (b.dataset.slotauto !== undefined) { const s = ad.img[+b.dataset.slotauto]; if (s && s.crop) { s.crop = pzFind(s.im, s.kind || 'plan'); pzForm(); adRedraw(); } return; }
  if (b.dataset.pzrm !== undefined) { ad.img[+b.dataset.pzrm] = null; pzForm(); adRedraw(); return; }
  if (b.dataset.pzfit !== undefined) { const s = ad.img[+b.dataset.pzfit]; s.fit = s.fit === 'cover' ? 'contain' : 'cover'; pzForm(); adRedraw(); }
});
$('pzFile').addEventListener('change', async () => {
  const f = $('pzFile').files[0]; if (!f || !ad) return;
  const i = ad.slot;
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {   // a land file or any PDF: its pages drawn here, the right part cut out
    toast('جارٍ فتح ملف PDF…');
    try {
      const u = URL.createObjectURL(f), pages = await docRender({u}, 1600);
      const k = Math.min(pages.length - 1, pages.length >= 3 ? (i === 2 ? 2 : 1) : i === 2 ? pages.length - 1 : 0), kind = i === 2 ? 'cond' : 'plan';
      ad.img[i] = {im: pages[k], pages, page: k, fit: 'crop', kind: i ? kind : '', crop: i ? pzFind(pages[k], kind) : {cx: 0.5, cy: 0.5, z: 1}, name: f.name};
      pzForm(); adRedraw(); pzCut(i);
    } catch (err) { toast('تعذّر فتح ملف PDF.'); }
    return;
  }
  try { const im = new Image(); im.src = URL.createObjectURL(f); await im.decode(); ad.img[i] = {im, fit: i === 0 ? 'cover' : 'contain', name: f.name}; pzForm(); adRedraw(); }
  catch (err) { toast('تعذّر فتح الصورة. اختر صورة JPG أو PNG أو ملف PDF.'); }
});
/* cutting a part out of a picture or a PDF page: a frame of the post's shape, dragged over the page */
let pzc = null;
const PZ_A = 415 / 362;
function pzCut(i) {
  const s = ad && ad.img[i]; if (!s) return;
  pzc = {i, page: s.page, im: s.im};
  const [iw, ih] = adSize(s.im);
  let r;
  if (s.fit === 'crop') { const sw = iw / s.crop.z, sh = sw / PZ_A; r = {x: s.crop.cx * iw - sw / 2, y: s.crop.cy * ih - sh / 2, w: sw, h: sh}; }
  else { let w = iw * 0.8, h = w / PZ_A; if (h > ih * 0.8) { h = ih * 0.8; w = h * PZ_A; } r = {x: (iw - w) / 2, y: (ih - h) / 2, w, h}; }
  pzc.r = r;
  const pages = s.pages || (s.page != null ? ad.pages : null);
  $('pzCropNav').innerHTML = pages && pages.length > 1 ? pages.map((q, k) => `<button type="button" class="btn" data-cpage="${k}" aria-pressed="${k === s.page}">صفحة ${k + 1}</button>`).join('') : '';
  $('pzCropBox').hidden = false; pzcDraw();
}
function pzcDraw() {
  const cv = $('pzCropCv'), im = pzc.im, [iw, ih] = adSize(im), box = cv.parentElement.getBoundingClientRect();
  const k = Math.min((box.width || 800) / iw, (Math.max(240, window.innerHeight - 260)) / ih, 1.2); pzc.k = k;
  cv.width = Math.round(iw * k); cv.height = Math.round(ih * k);
  const c = cv.getContext('2d'); c.drawImage(im, 0, 0, cv.width, cv.height);
  const r = pzc.r, x = r.x * k, y = r.y * k, w = r.w * k, h = r.h * k;
  c.fillStyle = 'rgba(15,20,35,.55)'; c.beginPath(); c.rect(0, 0, cv.width, cv.height); c.rect(x, y, w, h); c.fill('evenodd');
  c.lineWidth = 3; c.strokeStyle = '#FFC400'; c.strokeRect(x, y, w, h);
  c.fillStyle = '#FFC400'; [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([a, b]) => c.fillRect(a - 7, b - 7, 14, 14));
}
(() => {
  const cv = $('pzCropCv'); let drag = null;
  const pt = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width / pzc.k, (e.clientY - b.top) * cv.height / b.height / pzc.k]; };
  cv.addEventListener('pointerdown', e => {
    if (!pzc) return; const [x, y] = pt(e), r = pzc.r, tol = 16 / pzc.k;
    const corner = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].findIndex(([a, b]) => Math.abs(a - x) < tol && Math.abs(b - y) < tol);
    if (corner >= 0) { const ox = corner % 2 ? r.x : r.x + r.w, oy = corner > 1 ? r.y : r.y + r.h; drag = {mode: 'new', ox, oy}; }
    else if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) drag = {mode: 'move', dx: x - r.x, dy: y - r.y};
    else drag = {mode: 'new', ox: x, oy: y};
    cv.setPointerCapture(e.pointerId); e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag || !pzc) return; const [x, y] = pt(e), r = pzc.r;
    if (drag.mode === 'move') { r.x = x - drag.dx; r.y = y - drag.dy; }
    else { let w = Math.max(Math.abs(x - drag.ox), Math.abs(y - drag.oy) * PZ_A, 20 / pzc.k); const h = w / PZ_A; r.w = w; r.h = h; r.x = x < drag.ox ? drag.ox - w : drag.ox; r.y = y < drag.oy ? drag.oy - h : drag.oy; }
    pzcDraw();
  });
  const end = () => { drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
})();
$('pzCropNav').addEventListener('click', e => {
  const b = e.target.closest('[data-cpage]'); if (!b || !pzc) return; const s = ad.img[pzc.i], pages = s.pages || ad.pages, n = +b.dataset.cpage;
  pzc.page = n; pzc.im = pages[n]; $('pzCropNav').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); pzcDraw();
});
$('pzCropNo').onclick = () => { $('pzCropBox').hidden = true; pzc = null; };
$('pzCropOk').onclick = () => {
  if (!pzc || !ad) return; const s = ad.img[pzc.i], [iw, ih] = adSize(pzc.im), r = pzc.r;
  s.im = pzc.im; if (pzc.page != null) s.page = pzc.page;
  s.fit = 'crop'; s.crop = {cx: (r.x + r.w / 2) / iw, cy: (r.y + r.h / 2) / ih, z: iw / r.w};
  $('pzCropBox').hidden = true; pzc = null; pzForm(); adRedraw();
};
/* dragging on the post: a text or card moves; inside the plan or a picture, what is shown moves; the wheel enlarges the plan or the picture */
(() => {
  const cv = $('pzCv'); let drag = null;
  const pt = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * AD_W / b.width, (e.clientY - b.top) * AD_H / b.height]; };
  const under = (x, y) => ad && ad.hits ? [...ad.hits].reverse().find(t => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) : null;
  cv.addEventListener('pointerdown', e => {
    if (!ad) return; const [x, y] = pt(e), t = under(x, y); if (!t) return;
    drag = {t, x, y}; if (t.pic == null && !t.pan) { ad.sel = t.k; const s = $('pzPart'); if (s) s.value = t.k; } else ad.sel = null;
    cv.setPointerCapture(e.pointerId); e.preventDefault(); adRedraw();
  });
  cv.addEventListener('pointermove', e => {
    if (!ad) return; const [x, y] = pt(e);
    if (!drag) { const t = under(x, y); cv.style.cursor = t ? (t.pic != null || t.pan ? 'grab' : 'move') : ''; return; }
    const dx = x - drag.x, dy = y - drag.y, t = drag.t, v = ad.v; drag.x = x; drag.y = y;
    if (t.pic != null) {
      const s = ad.img[t.pic], [iw, ih] = adSize(s.im);
      if (s.fit === 'crop') { s.crop.cx -= dx / (t.w * s.crop.z); s.crop.cy -= dy / (ih * t.w * s.crop.z / iw); }
      else { const k = (s.fit === 'cover' ? Math.max(t.w / iw, t.h / ih) : Math.min((t.w - 20) / iw, (t.h - 20) / ih)) * (s.z || 1); s.cx = (s.cx == null ? 0.5 : s.cx) - dx / (iw * k); s.cy = (s.cy == null ? 0.5 : s.cy) - dy / (ih * k); }
    } else if (t.pan) { v.mx = (+v.mx || 0) + dx; v.my = (+v.my || 0) + dy; }
    else { const o = v.o[t.k] || [0, 0]; v.o[t.k] = [o[0] + dx, o[1] + dy]; }
    adRedraw();
  });
  const end = () => { if (drag && drag.t.pic != null) pzForm(); drag = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e => {
    if (!ad) return; const [x, y] = pt(e), t = under(x, y); if (!t || (t.pic == null && !t.pan)) return;
    e.preventDefault(); const f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    if (t.pan) ad.v.zoom = Math.max(0.5, Math.min(3, (+ad.v.zoom || 1) * f));
    else { const s = ad.img[t.pic]; if (s.fit === 'crop') s.crop.z = Math.max(0.4, Math.min(10, s.crop.z * f)); else s.z = Math.max(0.4, Math.min(4, (s.z || 1) * f)); }
    adRedraw();
  }, {passive: false});
})();
/* ---------- the post in every template at once, and a design kept on the site to open again later ---------- */
const PZ_FILE = {co: 'company', gr: 'ebada', pk: 'aya-aljabri', aya: 'aya-pink', kamil: 'aya-kamil', oy: 'omar-alyassi'};
const layoutOf = t => (PZ_THEMES[t] || {}).layout || 'classic';
function pzStash() { const v = ad.v; (v.os = v.os || {})[layoutOf(v.theme)] = {o: v.o || {}, mx: v.mx || 0, my: v.my || 0, lab: !!v.lab}; }
function pzUnstash(L) { const v = ad.v, s = (v.os || {})[L]; v.o = s ? s.o : {}; v.mx = s ? s.mx : 0; v.my = s ? s.my : 0; v.lab = s ? s.lab : L !== 'aya'; ad.sel = null; }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
/* a plain (stored) ZIP of a few files: pictures are already compressed */
function zipStore(files) {
  const parts = [], dir = [], enc = new TextEncoder(); let off = 0;
  const u16 = (a, o, v) => { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }, u32 = (a, o, v) => { u16(a, o, v & 0xFFFF); u16(a, o + 2, (v >>> 16) & 0xFFFF); };
  files.forEach(f => {
    const name = enc.encode(f.name), crc = crc32(f.data), h = new Uint8Array(30 + name.length);
    u32(h, 0, 0x04034b50); u16(h, 4, 20); u16(h, 6, 0x0800); u16(h, 8, 0); u32(h, 14, crc); u32(h, 18, f.data.length); u32(h, 22, f.data.length); u16(h, 26, name.length); h.set(name, 30);
    const d = new Uint8Array(46 + name.length);
    u32(d, 0, 0x02014b50); u16(d, 4, 20); u16(d, 6, 20); u16(d, 8, 0x0800); u32(d, 16, crc); u32(d, 20, f.data.length); u32(d, 24, f.data.length); u16(d, 28, name.length); u32(d, 42, off); d.set(name, 46);
    parts.push(h, f.data); dir.push(d); off += h.length + f.data.length;
  });
  const size = dir.reduce((s, d) => s + d.length, 0), e = new Uint8Array(22);
  u32(e, 0, 0x06054b50); u16(e, 8, files.length); u16(e, 10, files.length); u32(e, 12, size); u32(e, 16, off);
  return new Blob([...parts, ...dir, e], {type: 'application/zip'});
}
function saveBlob(b, name) { const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
$('pzAll').onclick = async () => {
  if (!ad || ad.busy) return; ad.busy = true; const btn = $('pzAll'), old = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ تجهيز كل القوالب…';
  const v = ad.v, keep = {theme: v.theme, phone: v.phone, o: v.o, mx: v.mx, my: v.my, lab: v.lab, sel: ad.sel}, files = [];
  pzStash();
  try {
    const cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H;
    for (const k of Object.keys(PZ_THEMES)) {
      if (layoutOf(k) === layoutOf(keep.theme)) Object.assign(v, {o: keep.o, mx: keep.mx, my: keep.my, lab: keep.lab}); else pzUnstash(layoutOf(k));
      v.theme = k; v.phone = k === keep.theme ? keep.phone : pzPhone(k);
      ad.export = true; drawAd(cv); ad.export = false;
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
      if (b) files.push({name: FILE + '-post-' + String(ad.p.n).replace(/[^\w-]/g, '') + '-' + (PZ_FILE[k] || k) + '.jpg', data: new Uint8Array(await b.arrayBuffer())});
    }
  } catch (err) { toast('تعذّر تجهيز القوالب.'); }
  finally { Object.assign(v, {theme: keep.theme, phone: keep.phone, o: keep.o, mx: keep.mx, my: keep.my, lab: keep.lab}); ad.sel = keep.sel; ad.export = false; ad.busy = false; btn.disabled = false; btn.textContent = old; adRedraw(); }
  if (files.length) { saveBlob(zipStore(files), FILE + '-post-' + String(ad.p.n).replace(/[^\w-]/g, '') + '-all.zip'); toast('تم تجهيز الإعلان بكل القوالب (' + files.length + ' صور في ملف ZIP).'); }
};
/* a picture of the design as JPEG, for keeping a picture the admin added on this device */
const imgJpeg = im => { const [iw, ih] = adSize(im), k = Math.min(1, 2200 / Math.max(iw, ih)), [cv, c] = canvas(Math.round(iw * k), Math.round(ih * k), '#fff'); c.drawImage(im, 0, 0, cv.width, cv.height); return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88)); };
async function adPost(action, data) {
  const body = new URLSearchParams(); body.set('action', action); body.set('project', SITE.project || 'dabdaba-north'); body.set('nonce', siteNonce); Object.entries(data).forEach(([k, x]) => body.set(k, x));
  const r = await fetch(SITE.ajax, {method: 'POST', credentials: 'same-origin', body}); let j = null; try { j = await r.json(); } catch (err) {}
  if (!r.ok || !j || !j.success) throw new Error((j && j.data && j.data.code) || 'save');
  return j.data;
}
$('pzSave').onclick = async () => {
  if (!ad || ad.busy) return;
  if (!SITE || !siteNonce) { toast('حفظ التصميم يعمل من صفحة المخطط على الموقع وأنت مسجّل الدخول.'); return; }
  ad.busy = true; const btn = $('pzSave'), old = btn.textContent; btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
  try {
    pzStash(); const imgs = [];
    for (let i = 0; i < 3; i++) {
      const s = ad.img[i]; if (!s) { imgs.push(null); continue; }
      const rec = {fit: s.fit, z: s.z, cx: s.cx, cy: s.cy, crop: s.crop, kind: s.kind, name: s.name};
      if (s.doc) { rec.doc = 1; rec.page = s.page; }
      else if (s.gen) rec.gen = s.gen;
      else if (s.src) { rec.src = s.src; rec.fb = s.fb || ''; rec.own = !!s.own; }
      else {   // a picture or PDF page added on this device: kept on the site so the design opens anywhere
        if (!siteUpload) throw new Error('upload');
        const f = await uploadBlob(await imgJpeg(s.im), 'post-' + ad.p.key + '-' + (i + 1) + '.jpg', 'ad', String(ad.p.key));
        s.src = fileUrl(f); s.own = true; delete s.pages; rec.src = s.src; rec.own = true;
      }
      imgs.push(rec);
    }
    const r = await adPost('dn_adsave', {key: ad.p.key, design: JSON.stringify({ver: 1, v: ad.v, img: imgs})});
    ad.savedAt = r.at || ''; pzForm(); toast('تم حفظ التصميم. يفتح كما هو في المرة القادمة لهذه القطعة.');
  } catch (err) { toast(err && err.message === 'upload' ? 'لا يمكن حفظ الصور المضافة: صلاحية رفع الملفات غير متاحة.' : 'تعذّر حفظ التصميم. حاول مرة أخرى.'); }
  finally { ad.busy = false; btn.disabled = false; btn.textContent = old; }
};
/* a kept design: its words, places and template as saved; its pictures fetched again */
async function adRestore(p) {
  if (!SITE || !siteNonce) return false;
  let r; try { r = await adPost('dn_adget', {key: p.key}); } catch (err) { return false; }
  const d = r && r.design; if (!d || !d.v) return false;
  Object.keys(d.v).forEach(k => { if (k in ad.v || /^(os|o|mx|my|side|auto|theme|mode)$/.test(k)) ad.v[k] = d.v[k]; });
  if (!PZ_THEMES[ad.v.theme]) ad.v.theme = 'co';
  ad.v.o = ad.v.o || {};
  const out = ad.img.slice();
  for (let i = 0; i < 3; i++) {
    const rec = (d.img || [])[i];
    if (rec === null) { out[i] = null; continue; }
    if (!rec) continue;
    let base = null;
    if (rec.doc && ad.pages && ad.pages[rec.page]) base = {im: ad.pages[rec.page], doc: 1, page: rec.page};
    else if (rec.gen && out[i] && out[i].gen === rec.gen) base = {im: out[i].im, gen: rec.gen};
    else if (rec.src) { const im = await imageOf({src: rec.src, fallback: rec.fb || '', own: !!rec.own}); if (im) base = {im, src: rec.src, fb: rec.fb, own: rec.own}; }
    if (base) out[i] = Object.assign(base, {fit: rec.fit, z: rec.z, cx: rec.cx, cy: rec.cy, crop: rec.crop, kind: rec.kind, name: rec.name || ''});
  }
  ad.img = out; ad.savedAt = r.at || '';
  return true;
}
$('pzClose').onclick = () => { $('pzbox').hidden = true; ad = null; };
$('pzDl').onclick = () => {
  if (!ad) return; const cv = $('pzCv'); ad.export = true; drawAd(cv); ad.export = false;
  cv.toBlob(b => {
    adRedraw();
    if (!b) { toast('تعذّر تجهيز الصورة.'); return; }
    const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = FILE + '-post-' + ad.p.n + '.jpg'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000); toast('تم تجهيز الإعلان بصيغة JPEG.');
  }, 'image/jpeg', 0.92);
};

/* ---------- a plot filled from its land-details file (the company's «تفاصيل الدفعات» PDF) ---------- */
let landFor = null, landBusy = false;
const normAr = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s\-–_()|.,]/g, '').toLowerCase();
const numOf = s => +String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '') || 0;
async function landText(file) {
  const L = await loadPdfjs(), d = await L.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
  let t = '';
  for (let i = 1; i <= Math.min(d.numPages, 3); i++) { const tc = await (await d.getPage(i)).getTextContent(); t += tc.items.map(x => x.str).join('\n') + '\n'; }
  return t;
}
function parseLand(text) {
  const r = {inst: []}, flat = text.replace(/\s+/g, '');
  const m = /PLANDATA:([A-Za-z0-9+/=]+?):END/.exec(flat);
  if (m) {   // the generator writes all its inputs into the file: the surest source
    try {
      const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1]), c => c.charCodeAt(0))));
      r.no = String(j.plotNo || '').replace(/\D/g, ''); r.ft = numOf(j.areaSqft); r.proj = String(j.projectSelect || '');
      const n = Math.round(numOf(j.numInstallments)), each = Math.round(numOf(j.installmentValue)), paid = Math.min(n, Math.round(numOf(j.paidInstallments))), freq = Math.round(numOf(j.freq)) || 6;
      r.down = Math.round(numOf(j.dpAmount));
      if (j.payMethod !== 'cash' && n > 0 && each > 0 && /^\d{4}-\d{2}-\d{2}$/.test(j.firstDate || '')) {
        for (let k = 0; k < n; k++) r.inst.push([addMonths(j.firstDate, k * freq), each]);
        r.total = r.down + n * each;
        if (paid) { r.inst = r.inst.slice(paid); r.down += paid * each; }   // instalments already paid go into the down payment
      } else r.total = r.down;
    } catch (err) {}
  }
  // what the file shows: used when there is no data block, and its total wins when it is written
  const T = text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if (!r.no) { const a = /رقم القطعة\s*(\d{3,7})/.exec(T) || /(\d{3,7})\s*رقم القطعة/.exec(T) || /Plot\s*(?:Details\s*)?NO\.?\s*(\d{3,7})/i.exec(T); if (a) r.no = a[1]; }
  const tot = /TOTAL\s*(?:\n\s*الإجمالي)?\s*\n\s*([\d,]{4,})/i.exec(T) || /الإجمالي\s*\n\s*([\d,]{4,})/.exec(T);
  if (tot) r.total = Math.round(numOf(tot[1]));
  if (!r.inst.length) {
    const rows = [...T.matchAll(/(?:^|\n)\s*\d{1,2}\s*\n\s*([\d,]{3,})\s*\n\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
    rows.forEach(x => r.inst.push([x[4] + '-' + x[3].padStart(2, '0') + '-' + x[2].padStart(2, '0'), Math.round(numOf(x[1]))]));
  }
  if (!r.down) { const dp = /الدفعة المقدمة\s*\n\s*([\d,]{3,})/.exec(T) || /Down\s*\n?\s*Payment[\s\S]{0,40}?\n\s*([\d,]{4,})/i.exec(T); if (dp) r.down = Math.round(numOf(dp[1])); }
  if (!r.ft) { const ar = /\b(\d{1,3}(?:,\d{3})+|\d{3,6})\b\s*\n\s*(?:Residential|Commercial|Industrial|سكني|تجاري|صناعي)/i.exec(T); if (ar) r.ft = numOf(ar[1]); }
  if (!r.total && r.down) r.total = r.down + r.inst.reduce((s, x) => s + x[1], 0);
  return r;
}
$('landFile').addEventListener('change', async () => {
  const file = $('landFile').files[0]; if (!file || landBusy) return;
  landBusy = true; toast('جارٍ قراءة ملف تفاصيل الأرض…');
  try {
    const r = parseLand(await landText(file));
    if (!r.no) { toast('لم أجد رقم القطعة في هذا الملف.'); return; }
    if (!(r.total > 0)) { toast('لم أجد السعر في هذا الملف.'); return; }
    if (!byNo.has(r.no)) { toast('القطعة ' + r.no + ' غير موجودة في مخطط ' + PROJECT + '.'); return; }
    const q = plots[byNo.get(r.no)];
    if (q.am) { toast('القطعة ' + r.no + ' مرفق عام وليست قطعة للبيع.'); return; }
    const pa = r.proj.split('|'), arName = pa[pa.length - 1] || '';
    if (arName && normAr(arName) !== normAr(PROJECT) && !window.confirm('هذا الملف لمشروع «' + arName.trim() + '» وليس «' + PROJECT + '». هل تريد إضافته إلى القطعة ' + r.no + ' في هذا المخطط؟')) return;
    if (landFor && landFor !== q && !window.confirm('الملف للقطعة ' + r.no + ' وليس للقطعة ' + landFor.n + ' المفتوحة. هل تريد تعبئة القطعة ' + r.no + '؟')) return;
    const e = entry(q);
    e.s = 'av'; e.total = r.total;
    if (r.inst.length) e.inst = r.inst; else delete e.inst;
    if (r.ft >= 1 && Math.abs(Math.round(r.ft) - q.ft0) >= 1) e.ft = Math.round(r.ft); else delete e.ft;
    applyAreas(); e.ppf = Math.round(r.total / q.ft);
    let att = '';
    if (SITE && siteUpload) {
      try { uploading = true; e.doc = await uploadBlob(file, file.name, 'pdf', r.no); delete e.plan; att = ' وأُرفق الملف بالقطعة'; }
      catch (err) { att = '، لكن تعذّر رفع الملف نفسه (' + upMsg(err) + ')'; }
      finally { uploading = false; }
    }
    tidy(q); refreshPlot(byNo.get(r.no)); select(byNo.get(r.no), true); afterEdit(true);
    const down = r.total - r.inst.reduce((s, x) => s + x[1], 0);
    toast('تمت تعبئة القطعة ' + r.no + ': السعر ' + fmt(r.total) + ' درهم' + (r.inst.length ? '، دفعة مقدمة ' + fmt(down) + ' و' + r.inst.length + (r.inst.length === 1 ? ' قسط' : ' أقساط') : ' كاش') + att + '. راجعها ثم اضغط «حفظ».');
  } catch (err) { toast('تعذّر قراءة الملف. تأكد أنه ملف PDF لتفاصيل الأرض.'); }
  finally { landBusy = false; }
});

})();
