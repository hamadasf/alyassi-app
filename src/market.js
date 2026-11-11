import { ei } from './icons.js';
// «مقارنة بالسوق» (office only): comparable listings from other sites, added by the office (link, price, area, use,
// corner / lane / regular), and the company's own reservations / sales. Each company land is compared by price per sq ft
// with similar listings in its project (same use, similar size, same position first) — so our prices stay competitive.
import { api } from './owner.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null, comps = null, loading = null;
export function initMarket(h) { H = h; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nf = new Intl.NumberFormat('en-US');
const m = (n) => nf.format(Math.round(n || 0));
const num = (v) => +String(v || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '') || 0;
const SRC = { bayut: 'بيوت', pf: 'بروبرتي فايندر', dubizzle: 'دوبيزل', opensooq: 'السوق المفتوح', ours: 'مبيعاتنا', other: 'أخرى' };
const CATS = ['فلل', 'سكني', 'تجاري', 'محلات', 'صناعي'];
const SIDES = ['عادية', 'زاوية', 'سكة'];
const daysAgo = (iso) => Math.round((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 864e5);
const median = (a) => { const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length ? (s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2) : 0; };

function load(force) {
  if (comps && !force) return Promise.resolve(comps);
  return loading || (loading = api('market_list').then((j) => { comps = j.items || []; loading = null; return comps; }).catch((e) => { loading = null; throw e; }));
}
const allLands = () => (H.projects() || []).flatMap((p) => p.lands || []);

/** how a company land stands against the market */
export function compare(l, list, near) {
  if (!l || !(l.total > 0) || !(l.ft > 0)) return null;
  const ours = l.total / l.ft, more = near === undefined ? nearOf(l.project) : near;
  let pool = list.filter((c) => (c.slug === l.project || more.includes(c.slug)) && c.ref !== l.id && c.ft > 0 && c.price > 0 && daysAgo(c.seen) <= 240);
  const sameCat = pool.filter((c) => c.cat === l.cat); if (sameCat.length >= 2) pool = sameCat;
  const similar = pool.filter((c) => c.ft >= l.ft * 0.6 && c.ft <= l.ft * 1.6); if (similar.length >= 2) pool = similar;
  const side = l.side || 'عادية', sameSide = pool.filter((c) => (c.side || 'عادية') === side);
  const usedSide = sameSide.length >= 2;
  if (usedSide) pool = sameSide;
  if (!pool.length) return { n: 0, ours };
  const ppf = pool.map((c) => c.price / c.ft), lo = Math.min(...ppf), md = median(ppf), hi = Math.max(...ppf);
  const diff = (ours - md) / md * 100;
  return { n: pool.length, ours, lo, md, hi, diff, usedSide, side, cheapest: Math.floor(lo * l.ft * 0.99 / 1000) * 1000, level: Math.round(md * l.ft / 1000) * 1000, pool: pool.sort((a, b) => a.price / a.ft - b.price / b.ft) };
}
/* ---------- «مزامنة»: when a project has no comparables, look in the nearby areas (by the projects' real coordinates
   and their names: بليدة 1 / 2 / 3, الحوشي / الحوشي طرح المروان, الدبدبة شمال / بساتين الزبير «الدبدبة جنوب») for
   recorded listings and our own sales of the same use and a close size; the areas found are kept for that project ---------- */
const NEAR_KEY = 'oay:mknear';
const ALIAS = { 'basateen-al-zubair': 'الدبدبة', 'dabdaba-north': 'الدبدبة' };
function nearOf(slug) { try { const m = JSON.parse(localStorage.getItem(NEAR_KEY) || '{}'); return Array.isArray(m[slug]) ? m[slug] : []; } catch { return []; } }
function setNear(slug, list) { try { const m = JSON.parse(localStorage.getItem(NEAR_KEY) || '{}'); if (list.length) m[slug] = list; else delete m[slug]; localStorage.setItem(NEAR_KEY, JSON.stringify(m)); } catch { /* private mode */ } }
let geo = null;
async function projGeo() {
  if (geo) return geo;
  const ps = H.projects() || [];
  try { const j = await api('proj_geo', { items: ps.slice(0, 60).map((p) => ({ slug: p.slug, loc: p.loc || '' })) }); geo = j.items || {}; } catch { geo = {}; }
  return geo;
}
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const stem = (p) => ALIAS[p.slug] || String(p.name || '').replace(/[()0-9٠-٩]/g, ' ').replace(/\s+(طرح|المرحلة|مرحلة|شمال|جنوب|شرق|غرب|A-B).*$/, '').trim().split(/\s+/).slice(0, 2).join(' ');
/** → [{ slug, name, km, n }] the nearby areas with listings like this land (closest first) */
async function syncFind(l) {
  const list = await load(true), ps = H.projects() || [], me = ps.find((p) => p.slug === l.project) || { slug: l.project, name: l.projectName };
  const g = await projGeo(), c0 = g[l.project];
  const like = (c) => c.slug !== l.project && c.ft > 0 && c.price > 0 && daysAgo(c.seen) <= 240 && c.ft >= l.ft * 0.6 && c.ft <= l.ft * 1.6 && (!l.cat || !c.cat || c.cat === l.cat);
  const by = {}; list.filter(like).forEach((c) => { (by[c.slug] = by[c.slug] || []).push(c); });
  const out = Object.keys(by).map((slug) => {
    const p = ps.find((x) => x.slug === slug) || { slug, name: slug }; const c1 = g[slug];
    const d = c0 && c1 ? km(c0, c1) : null, kin = stem(p) && stem(p) === stem(me);
    return { slug, name: p.name || slug, km: d, n: by[slug].length, ok: kin || (d !== null && d <= 12) };
  }).filter((x) => x.ok).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  return out.slice(0, 4);
}
const tone = (d) => (d > 3 ? 'hi' : d < -3 ? 'lo' : 'ok');
const verdict = (r) => (r.diff > 3 ? `أغلى من السوق بـ ${Math.round(r.diff)}%` : r.diff < -3 ? `أرخص من السوق بـ ${Math.round(-r.diff)}%` : 'في مستوى السوق');

/* ---------- the card on a land's page ---------- */
export function marketCardHTML(l) { return `<div class="mkcard" data-mkland="${esc(l.id)}"><div class="ss-state"><i class="spin"></i><span>مقارنة بالسوق…</span></div></div>`; }
export async function fillMarketCard(root, l) {
  const el = root.querySelector('.mkcard'); if (!el) return;
  try {
    const r = compare(l, await load());
    if (!r) { el.remove(); return; }
    if (!r.n) {
      el.className = 'mkcard';
      el.innerHTML = `<b>${H.I.trend} مقارنة بالسوق</b><p class="muted">لا توجد إعلانات مشابهة مسجّلة لهذا المشروع بعد.</p>
        <button class="btn primary sm mksync" data-mksync>${ei('refresh')} مزامنة — ابحث عن أراضٍ مشابهة في المناطق القريبة</button>
        <button class="btn sm" data-mkadd="${esc(l.project)}">＋ أضف إعلاناً مشابهاً</button>`;
      el.querySelector('[data-mksync]').onclick = async (e) => {
        e.stopPropagation(); const b = e.currentTarget; b.disabled = true; b.innerHTML = '<i class="spin"></i> جارِ البحث…';
        try {
          const found = await syncFind(l);
          if (!found.length) { b.outerHTML = `<p class="mknone">لم نجد إعلانات مسجّلة لأراضٍ ${esc(l.cat || '')} بمساحة قريبة (${m(l.ft * 0.6)}–${m(l.ft * 1.6)} قدم) في المناطق القريبة. أضف إعلاناً من بيوت أو بروبرتي فايندر لتظهر المقارنة.</p>`; return; }
          setNear(l.project, found.map((x) => x.slug)); H.toast(`تمت المزامنة ✓ ${found.reduce((a, x) => a + x.n, 0)} إعلان من ${found.length === 1 ? found[0].name : found.length + ' مناطق'}`);
          fillMarketCard(root, l);
        } catch (ex) { b.disabled = false; b.textContent = 'تعذّر البحث — حاول مرة أخرى'; H.toast(ex.message); }
      };
      return;
    }
    const fromNear = r.pool.filter((c) => c.slug !== l.project);
    el.className = 'mkcard ' + tone(r.diff);
    el.innerHTML = `<div class="mk1"><b>${H.I.trend} مقارنة بالسوق</b><span>${r.n} ${r.n > 10 ? 'إعلاناً' : 'إعلانات'} مشابهة${r.usedSide ? ` · ${esc(r.side)}` : ''}</span></div>
      <div class="mk2"><div><small>أرخص</small><b>${m(r.lo)}</b></div><div><small>متوسط السوق</small><b>${m(r.md)}</b></div><div class="us"><small>سعرنا</small><b>${m(r.ours)}</b></div></div>
      <p class="mkv">${verdict(r)} <small>(درهم / قدم)</small></p>
      <p class="mks">لتكون الأرخص: <b>${m(r.cheapest)} درهم</b> · مستوى السوق: ${m(r.level)} درهم</p>
      ${fromNear.length ? `<p class="mknear">${ei('pin')} ${fromNear.length === r.n ? 'كل المقارنات' : fromNear.length + ' منها'} من مناطق قريبة: ${esc([...new Set(fromNear.map((c) => ((H.projects() || []).find((p) => p.slug === c.slug) || {}).name || c.slug))].join('، '))} <button class="linkbtn" data-mkunsync>إلغاء</button></p>` : ''}
      <button class="btn sm" data-mkopen="${esc(l.id)}">عرض الإعلانات المقارنة</button>`;
    const un = el.querySelector('[data-mkunsync]'); if (un) un.onclick = (e) => { e.stopPropagation(); setNear(l.project, []); fillMarketCard(root, l); };
  } catch { el.remove(); }
}

/* ---------- the office's page: our lands vs the market, and the comparable listings ---------- */
export function marketPage() { return '<div class="pad mkpage" id="mkBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export function initMarketPage(pg, focus) {
  const box = pg.querySelector('#mkBox'); let tab = focus ? 'comps' : 'ours', proj = '', only = focus || '';
  const projects = (H.projects() || []).filter((p) => p.lands && p.lands.some((l) => l.status === 'av' && l.total));
  const draw = () => {
    const lands = allLands().filter((l) => l.status === 'av' && l.total && (!proj || l.project === proj));
    const rows = lands.map((l) => ({ l, r: compare(l, comps) })).filter((x) => x.r && x.r.n);
    const dear = rows.filter((x) => x.r.diff > 3).length, cheap = rows.filter((x) => x.r.diff < -3).length;
    rows.sort((a, b) => b.r.diff - a.r.diff);
    const list = comps.filter((c) => (!proj || c.slug === proj) && (!only || ((allLands().find((l) => l.id === only) || {}).project === c.slug)));
    box.innerHTML = `<div class="mkfilter"><select id="mkProj"><option value="">كل المشاريع</option>${projects.map((p) => `<option value="${esc(p.slug)}" ${proj === p.slug ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="mksum"><div class="hi"><b>${dear}</b><small>أغلى من السوق</small></div><div class="ok"><b>${rows.length - dear - cheap}</b><small>في مستوى السوق</small></div><div class="lo"><b>${cheap}</b><small>أرخص من السوق</small></div><div><b>${lands.length - rows.length}</b><small>بدون مقارنات</small></div></div>
      <div class="seg"><button data-mktab="ours" class="${tab === 'ours' ? 'on' : ''}">أراضينا (${rows.length})</button><button data-mktab="comps" class="${tab === 'comps' ? 'on' : ''}">الإعلانات المقارنة (${list.length})</button></div>
      ${tab === 'ours' ? (rows.length ? rows.map(({ l, r }) => `<button class="mkrow ${tone(r.diff)}" data-land="${esc(l.id)}">
          <div><b>قطعة ${esc(l.n)} · ${esc(l.projectName)}</b><span>${esc(l.use || '')} · ${m(l.ft)} قدم · ${esc(l.side || '—')} · ${m(l.total)} د.إ</span></div>
          <div class="mkn"><b>${m(r.ours)} <small>/</small> ${m(r.md)}</b><em>${r.diff > 0 ? '+' : ''}${Math.round(r.diff)}%</em><small>لتكون الأرخص: ${m(r.cheapest)}</small></div></button>`).join('')
        : '<p class="muted">أضف إعلانات مشابهة من المواقع الأخرى لتظهر المقارنة.</p>')
      : `${only ? `<p class="help">إعلانات مشروع القطعة المختارة · <button class="linkbtn" data-mkall>عرض الكل</button></p>` : ''}
        <button class="btn gold block" data-mkadd="${esc(proj || (only ? (allLands().find((l) => l.id === only) || {}).project || '' : ''))}">＋ إضافة إعلان من بيوت / بروبرتي فايندر / دوبيزل</button>
        ${list.map((c) => `<div class="mkcomp"><div><b>${m(c.price)} د.إ</b> · ${m(c.ft)} قدم · <b>${m(c.price / c.ft)}</b>/قدم
            <span>${esc(((H.projects() || []).find((p) => p.slug === c.slug) || {}).name || c.slug)} · ${esc(c.cat || '')} · ${esc(c.side || '—')}${c.inst ? ' · أقساط' : ''} · ${esc(SRC[c.src] || c.src)} · قبل ${Math.max(0, daysAgo(c.seen))} يوم${c.note ? ' · ' + esc(c.note) : ''}</span></div>
            <span class="rowbtns">${c.url ? `<a class="btn sm" href="${esc(c.url)}" data-ext>فتح</a>` : ''}${c.src !== 'ours' ? `<button class="btn sm" data-mkedit="${esc(c.id)}">تعديل</button>` : ''}</span></div>`).join('') || '<p class="muted">لا توجد إعلانات بعد.</p>'}`}
      <p class="help">المقارنة بسعر القدم مع إعلانات نفس المشروع ونوع الأرض وبمساحة قريبة، وبنفس الموقع (زاوية / سكة / عادية) إن وُجد إعلانان على الأقل. الإعلانات الأقدم من 8 أشهر لا تُحسب. مبيعاتنا وحجوزاتنا تُضاف تلقائياً.</p>`;
  };
  const go = async (force) => { try { await load(force); draw(); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  box.addEventListener('change', (e) => { if (e.target.id === 'mkProj') { proj = e.target.value; only = ''; draw(); } });
  box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mktab], [data-mkadd], [data-mkedit], [data-mkall]'); if (!t) return;
    e.stopPropagation();
    if (t.dataset.mktab) { tab = t.dataset.mktab; draw(); return; }
    if (t.dataset.mkall !== undefined) { only = ''; draw(); return; }
    if (t.dataset.mkadd !== undefined) { editComp(null, t.dataset.mkadd, draw); return; }
    if (t.dataset.mkedit) editComp(comps.find((c) => c.id === t.dataset.mkedit), '', draw);
  });
  go(true);
}

/* ---------- add / edit a comparable listing ---------- */
export function editComp(c0, slug, after) {
  const c = c0 ? { ...c0 } : { slug: slug || '', cat: '', url: '', price: '', ft: '', side: 'عادية', inst: false, seen: new Date().toISOString().slice(0, 10), note: '' };
  if (!c.cat && c.slug) { const l = allLands().find((x) => x.project === c.slug); if (l) c.cat = l.cat; }
  const ov = document.createElement('div'); ov.className = 'walletf';
  const projects = (H.projects() || []);
  ov.innerHTML = `<div class="wfbox"><header><button class="back" data-wx aria-label="إغلاق">✕</button><b>${c0 ? 'تعديل إعلان' : 'إضافة إعلان مشابه'}</b></header><div class="wfbody">
    <label class="fld">رابط الإعلان (بيوت / بروبرتي فايندر / دوبيزل)<div class="mkurl"><input id="cUrl" dir="ltr" inputmode="url" value="${esc(c.url)}" placeholder="https://"><button type="button" class="btn sm" id="cPaste">لصق</button></div></label>
    <p class="help">افتح الإعلان في تطبيق بيوت أو بروبرتي فايندر ← مشاركة ← نسخ الرابط، ثم الصقه هنا واكتب السعر والمساحة.</p>
    <label class="fld">المشروع / المنطقة المقارَن بها *<select id="cSlug"><option value="">—</option>${projects.map((p) => `<option value="${esc(p.slug)}" ${c.slug === p.slug ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <div class="two"><label class="fld">السعر (درهم) *<input id="cPrice" inputmode="numeric" dir="ltr" value="${c.price || ''}"></label><label class="fld">المساحة (قدم²) *<input id="cFt" inputmode="numeric" dir="ltr" value="${c.ft || ''}"></label></div>
    <p class="wcomm" id="cPpf"></p>
    <label class="fld">نوع الأرض<select id="cCat">${CATS.map((x) => `<option ${c.cat === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <div class="seg" id="cSide">${SIDES.map((x) => `<button type="button" data-cs="${x}" class="${(c.side || 'عادية') === x ? 'on' : ''}">${x}</button>`).join('')}</div>
    <div class="two"><label class="fld">تاريخ الإعلان<input id="cSeen" type="date" value="${esc(c.seen)}"></label><label class="nrow"><span>عليه أقساط</span><input type="checkbox" class="nchk" id="cInst" ${c.inst ? 'checked' : ''}></label></div>
    <label class="fld">ملاحظة<input id="cNote" value="${esc(c.note || '')}" placeholder="مثلاً: مقابل مسجد، على شارع 18 متر"></label>
    <button class="btn primary block share-big" id="cSave">حفظ</button>
    ${c0 ? '<button class="btn ghost danger block" id="cDel">' + ei('trash') + ' حذف</button>' : ''}</div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
  const $ = (s) => ov.querySelector(s);
  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 200); };
  const ppf = () => { const p = num($('#cPrice').value), f = num($('#cFt').value); $('#cPpf').textContent = p && f ? `سعر القدم: ${m(p / f)} درهم` : ''; };
  ov.addEventListener('input', (e) => { if (['cPrice', 'cFt'].includes(e.target.id)) ppf(); });
  ov.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.wx !== undefined) { close(); return; }
    if (b.dataset.cs) { c.side = b.dataset.cs; ov.querySelectorAll('[data-cs]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.id === 'cPaste') { try { $('#cUrl').value = (await navigator.clipboard.readText()).trim().match(/https?:\/\/\S+/)?.[0] || ''; } catch { H.toast('الصق الرابط يدوياً'); } return; }
    if (b.id === 'cDel') { if (!(await uiConfirm('حذف هذا الإعلان من المقارنات؟', { danger: true }))) return; try { comps = (await api('market_del', { id: c.id })).items; close(); after && after(); } catch (ex) { H.toast(ex.message); } return; }
    if (b.id === 'cSave') {
      const item = { ...c, url: $('#cUrl').value.trim(), slug: $('#cSlug').value, price: num($('#cPrice').value), ft: num($('#cFt').value), cat: $('#cCat').value, seen: $('#cSeen').value, inst: $('#cInst').checked, note: $('#cNote').value.trim() };
      b.disabled = true;
      try { comps = (await api('market_save', { item })).items; H.toast('تم الحفظ ✓'); close(); after && after(); } catch (ex) { H.toast(ex.message); b.disabled = false; }
    }
  });
  ppf();
}
