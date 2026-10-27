// Builds a complete, shareable PDF for a plot: a branded details card (page 1) followed by the plot's own plan PDF.
import { PDFDocument } from 'pdf-lib';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SITE, LOGO } from './config.js';
import { loadPlan, drawPlanLoc } from './planloc.js';

const native = Capacitor.isNativePlatform();
const nf = new Intl.NumberFormat('en-US');
const money = (v) => nf.format(Math.round(v || 0));
const ST = { av: ['متاحة', '#16a34a'], res: ['محجوزة', '#d97706'], sold: ['مباعة', '#b91c1c'] };
const NAVY = '#0e1c36', GOLD = '#c9a14a', INK = '#0f172a', MUTED = '#64748b', LINE = '#e6e9ef', SOFT = '#f6f7fb';
const W = 1240, PAD = 70;
const dstr = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : d || ''; };
const dmy = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

function loadImg(src) {
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}

/** Everything the card shows, in order. offer = active limited-time offer or null. */
export function cardModel(l, offer, projectLoc) {
  const price = (offer && offer.price) || l.total;
  const was = offer && offer.price && (l.total || offer.old) > offer.price ? (l.total || offer.old) : 0;
  const tagIsDims = /×/.test(l.tag || '');
  const dims = l.dims ? `${l.dims[2] ? '≈ ' : ''}${(+l.dims[0]).toFixed(2)} × ${(+l.dims[1]).toFixed(2)} م` : (tagIsDims ? l.tag : '');
  const area = l.ft ? `${l.approx ? '≈ ' : ''}${money(l.ft)} قدم²  (${money(l.m2)} م²)` : '';
  const info = [['المشروع', l.projectName], ['رقم القطعة', l.n], ['المساحة', area], ['الأبعاد', dims]].filter((r) => r[1]);
  const terms = [['الاستخدام', l.use], ['الارتفاع المسموح', l.floors], ['موقع القطعة', l.loc], ['التصنيف', l.tag && l.tag !== l.loc && !tagIsDims ? l.tag : '']].filter((r) => r[1]);
  const showPrice = l.status === 'av' && price;
  const pay = showPrice && l.inst.length ? [['الدفعة المقدمة', l.first], ...l.inst.map((x, i) => [`القسط ${i + 1} · ${dstr(x[0])}`, +x[1] || 0])] : [];
  return { l, offer, map: null, price: showPrice ? price : 0, was, info, terms, pay, loc: l.lo || projectLoc || '', planUrl: `${SITE}/${l.project}/#p${l.n}` };
}

/* ---------- page 1: the card, drawn on a canvas (browser shapes the Arabic text) ----------
 * Title, price, the plot's location on the project plan, payment plan. Height follows the plan PDF's page shape. */
async function drawCard(m, { aspect = 1.414, planImg = null } = {}) {
  await Promise.all(['400', '500', '700', '800'].map((w) => document.fonts.load(`${w} 40px Tajawal`, 'عربي 123').catch(() => {})));
  const logo = await loadImg(LOGO);
  const rowH = 70;
  const hasMap = !!(planImg && m.map && m.l.poly && m.l.poly.length > 2);   // planImg = loaded plan files
  const fixed = 308 + 190 + (m.offer ? 150 : 0) + (m.price ? 210 : 80) + (m.pay.length ? 100 + (m.pay.length + 1) * rowH + 30 : 0) + 60;
  const target = Math.round(W * aspect);
  const mapH = hasMap ? Math.min(980, Math.max(460, target - fixed - 90)) : 0;
  const H = Math.max(target, fixed + (hasMap ? mapH + 90 : 0));

  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.direction = 'rtl'; x.textBaseline = 'middle';
  const font = (w, s) => { x.font = `${w} ${s}px Tajawal, Arial, sans-serif`; };
  const R = W - PAD, L = PAD;
  const text = (t, px, py, { w = 400, s = 34, col = INK, al = 'right' } = {}) => { font(w, s); x.fillStyle = col; x.textAlign = al; x.fillText(String(t), px, py); };
  const rr = (x0, y0, w, h, r, fill, stroke) => {
    x.beginPath(); x.roundRect(x0, y0, w, h, r);
    if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); }
  };

  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  // header
  x.fillStyle = NAVY; x.fillRect(0, 0, W, 300);
  x.fillStyle = GOLD; x.fillRect(0, 300, W, 8);
  if (logo) { const k = Math.min(1000 / logo.width, 200 / logo.height); const w = logo.width * k, h = logo.height * k; x.drawImage(logo, (W - w) / 2, (300 - h) / 2, w, h); }
  else text('عمر الياسي للعقارات', W / 2, 150, { w: 800, s: 60, col: '#fff', al: 'center' });

  let y = 400;
  text(`قطعة رقم ${m.l.n}`, R, y, { w: 800, s: 76, col: NAVY });
  const [stl, stc] = ST[m.l.status] || ST.av;
  font(700, 36); const sw = x.measureText(stl).width + 64;
  rr(L, y - 36, sw, 72, 36, stc); text(stl, L + sw / 2, y + 2, { w: 700, s: 36, col: '#fff', al: 'center' });
  y += 84;
  text(`مشروع ${m.l.projectName}${m.l.use ? ' · ' + m.l.use : ''}`, R, y, { w: 500, s: 38, col: MUTED });
  y += 74;

  if (m.offer) {
    const g = x.createLinearGradient(L, 0, R, 0); g.addColorStop(0, '#f97316'); g.addColorStop(1, '#dc2626');
    rr(L, y, R - L, 120, 24, g);
    text('🔥 عرض لفترة محدودة', R - 30, y + 42, { w: 800, s: 40, col: '#fff' });
    text(`ينتهي العرض في ${dmy(m.offer.until)}${m.offer.note ? ' · ' + m.offer.note : ''}`, R - 30, y + 88, { w: 500, s: 30, col: '#fff' });
    y += 150;
  }

  if (m.price) {
    rr(L, y, R - L, 180, 28, '#fbf6ea', GOLD);
    text('السعر الإجمالي', R - 36, y + 50, { w: 700, s: 34, col: MUTED });
    text(`${money(m.price)} درهم`, R - 36, y + 118, { w: 800, s: 66, col: m.offer ? '#dc2626' : NAVY });
    if (m.was) text(`بدلاً من ${money(m.was)} درهم`, L + 36, y + 50, { w: 500, s: 30, col: MUTED, al: 'left' });
    if (m.l.ppf && !m.offer?.price) text(`سعر القدم ${money(m.l.ppf)} درهم`, L + 36, y + 118, { w: 700, s: 34, col: GOLD, al: 'left' });
    if (m.l.ft && !m.was) text(`${money(m.l.ft)} قدم²`, L + 36, y + 50, { w: 500, s: 30, col: MUTED, al: 'left' });
    y += 210;
  } else {
    text(m.l.status === 'av' ? 'السعر عند الاستفسار' : '', R, y + 24, { w: 700, s: 40, col: GOLD }); y += 80;
  }

  if (hasMap) {
    text('موقع القطعة في مخطط المشروع', R, y + 30, { w: 800, s: 40, col: NAVY });
    x.fillStyle = GOLD; x.fillRect(R - 90, y + 62, 90, 6);
    y += 90;
    drawPlanLoc(x, planImg, m.l, m.lands || [m.l], m.map, { x: L, y, w: R - L, h: mapH, radius: 24 });
    x.lineWidth = 3; x.strokeStyle = '#e6e9ef'; x.beginPath(); x.roundRect(L, y, R - L, mapH, 24); x.stroke();
    y += mapH + 30;
  }

  if (m.pay.length) {
    text('خطة السداد', R, y + 36, { w: 800, s: 42, col: NAVY });
    x.fillStyle = GOLD; x.fillRect(R - 90, y + 70, 90, 6);
    y += 96;
    const total = m.pay.reduce((a, r) => a + r[1], 0);
    const all = [...m.pay, ['الإجمالي', total]];
    all.forEach((r, i) => {
      const last = i === all.length - 1;
      if (i % 2 === 0 || last) rr(L, y, R - L, rowH - 8, 16, last ? NAVY : SOFT);
      text(r[0], R - 28, y + (rowH - 8) / 2, { w: last ? 800 : 500, s: 32, col: last ? '#fff' : MUTED });
      text(`${money(r[1])} درهم`, L + 28, y + (rowH - 8) / 2, { w: 700, s: 34, col: last ? '#fff' : INK, al: 'left' });
      y += rowH;
    });
  }
  // thin brand line at the bottom
  x.fillStyle = GOLD; x.fillRect(0, H - 10, W, 10);

  return new Promise((ok) => c.toBlob((b) => ok({ blob: b, w: W, h: H }), 'image/jpeg', 0.9));
}

/* ---------- fetch the plot's plan PDF ---------- */
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function fetchPlotPdf(l) {
  if (!l.doc && !l.docId) return null;
  const url = l.docId ? `${SITE}/wp-admin/admin-ajax.php?action=oay_doc&id=${l.docId}` : l.doc;
  try {
    if (native) {
      const r = await CapacitorHttp.request({ url: l.doc || url, method: 'GET', responseType: 'arraybuffer', readTimeout: 30000, connectTimeout: 15000 });
      if (r.status >= 300) return null;
      return typeof r.data === 'string' ? b64ToBytes(r.data) : new Uint8Array(r.data);
    }
    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

/** Returns { bytes, name, hasPdf } — the finished PDF. */
export async function buildLandPdf(m) {
  const planBytes = await fetchPlotPdf(m.l);
  let src = null;
  if (planBytes) { try { src = await PDFDocument.load(planBytes, { ignoreEncryption: true }); } catch { src = null; } }
  // the card page gets the same size as the plot plan's page, so both open at the same zoom
  let pw = 595.28, ph = 841.89;
  if (src) { try { const p0 = src.getPage(0); const sz = p0.getSize(); const rot = ((p0.getRotation().angle % 360) + 360) % 360; [pw, ph] = rot === 90 || rot === 270 ? [sz.height, sz.width] : [sz.width, sz.height]; } catch { /* keep A4 */ } }
  const planImg = m.map && m.l.poly ? await loadPlan(m.l.project, m.map).catch(() => null) : null;
  const card = await drawCard(m, { aspect: Math.max(1.2, ph / pw), planImg });
  const doc = await PDFDocument.create();
  doc.setTitle(`قطعة ${m.l.n} - ${m.l.projectName}`); doc.setAuthor('عمر الياسي للعقارات'); doc.setCreator('Omar Al Yassi Real Estate');
  const img = await doc.embedJpg(new Uint8Array(await card.blob.arrayBuffer()));
  const k = Math.min(pw / card.w, ph / card.h), iw = card.w * k, ih = card.h * k;
  doc.addPage([pw, ph]).drawImage(img, { x: (pw - iw) / 2, y: ph - ih, width: iw, height: ih });
  let hasPdf = false;
  if (src) {
    try { (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p)); hasPdf = true; }
    catch { /* unreadable PDF — card only */ }
  }
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return { bytes: await doc.save(), name: `قطعة ${safe(m.l.n)} - ${safe(m.l.projectName)}.pdf`, hasPdf };
}
