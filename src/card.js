// Builds a complete, shareable PDF for a plot: a branded details card (page 1) followed by the plot's own plan PDF.
import { PDFDocument } from 'pdf-lib';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SITE, CONTACT, LOGO } from './config.js';

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
  return { l, offer, price: showPrice ? price : 0, was, info, terms, pay, loc: l.lo || projectLoc || '', planUrl: `${SITE}/${l.project}/#p${l.n}` };
}

/* ---------- page 1: the card, drawn on a canvas (browser shapes the Arabic text) ---------- */
async function drawCard(m, hasPdf) {
  await Promise.all(['400', '700', '800'].map((w) => document.fonts.load(`${w} 40px Tajawal`, 'عربي 123').catch(() => {})));
  const logo = await loadImg(LOGO);
  const rowH = 74;
  // height depends on content
  let H = 330 + 190 + (m.offer ? 150 : 0) + (m.price ? 210 : 70);
  H += 90 + m.info.length * rowH + 40;
  if (m.terms.length) H += 90 + m.terms.length * rowH + 40;
  if (m.pay.length) H += 90 + (m.pay.length + 1) * rowH + 40;
  H += 300;
  H = Math.max(H, Math.round(W * 1.414));

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

  let y = 390;
  text(`قطعة رقم ${m.l.n}`, R, y, { w: 800, s: 70, col: NAVY });
  const [stl, stc] = ST[m.l.status] || ST.av;
  font(700, 34); const sw = x.measureText(stl).width + 60;
  rr(L, y - 34, sw, 68, 34, stc); text(stl, L + sw / 2, y + 2, { w: 700, s: 34, col: '#fff', al: 'center' });
  y += 78;
  text(`مشروع ${m.l.projectName}`, R, y, { w: 500, s: 38, col: MUTED });
  y += 70;

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
    text(`${money(m.price)} درهم`, R - 36, y + 118, { w: 800, s: 64, col: m.offer ? '#dc2626' : NAVY });
    if (m.was) text(`بدلاً من ${money(m.was)} درهم`, L + 36, y + 50, { w: 500, s: 30, col: MUTED, al: 'left' });
    if (m.l.ppf && !m.offer?.price) text(`سعر القدم ${money(m.l.ppf)} درهم`, L + 36, y + 118, { w: 700, s: 34, col: GOLD, al: 'left' });
    y += 210;
  } else {
    text(m.l.status === 'av' ? 'السعر عند الاستفسار' : '', R, y + 20, { w: 700, s: 38, col: GOLD }); y += 70;
  }

  const section = (title, rows, { money: isMoney = false, total = 0 } = {}) => {
    text(title, R, y + 40, { w: 800, s: 42, col: NAVY });
    x.fillStyle = GOLD; x.fillRect(R - 90, y + 76, 90, 6);
    y += 100;
    const all = total ? [...rows, ['الإجمالي', total]] : rows;
    all.forEach((r, i) => {
      const last = total && i === all.length - 1;
      if (i % 2 === 0 || last) rr(L, y, R - L, rowH - 8, 16, last ? NAVY : SOFT);
      text(r[0], R - 28, y + (rowH - 8) / 2, { w: last ? 800 : 500, s: 32, col: last ? '#fff' : MUTED });
      text(isMoney ? `${money(r[1])} درهم` : r[1], L + 28, y + (rowH - 8) / 2, { w: 700, s: 34, col: last ? '#fff' : INK, al: 'left' });
      y += rowH;
    });
    y += 40;
  };
  section('بيانات القطعة', m.info);
  if (m.terms.length) section('شروط التخطيط', m.terms);
  if (m.pay.length) section('خطة السداد', m.pay, { money: true, total: m.pay.reduce((a, r) => a + r[1], 0) });

  // footer
  const fy = H - 250;
  x.fillStyle = NAVY; x.fillRect(0, fy, W, 250);
  x.fillStyle = GOLD; x.fillRect(0, fy, W, 8);
  text('للحجز والاستفسار', W / 2, fy + 60, { w: 700, s: 34, col: GOLD, al: 'center' });
  x.direction = 'ltr';
  text(`☎ ${CONTACT.phoneLabel}     ·     WhatsApp ${CONTACT.whatsappLabel}`, W / 2, fy + 122, { w: 700, s: 40, col: '#fff', al: 'center' });
  x.direction = 'rtl';
  text(hasPdf ? 'مخطط الأرض الرسمي مرفق في الصفحة التالية' : 'عمر الياسي للعقارات · الشارقة', W / 2, fy + 190, { w: 500, s: 30, col: '#cbd5e1', al: 'center' });

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
  const card = await drawCard(m, !!src);
  const doc = await PDFDocument.create();
  doc.setTitle(`قطعة ${m.l.n} - ${m.l.projectName}`); doc.setAuthor('عمر الياسي للعقارات'); doc.setCreator('Omar Al Yassi Real Estate');
  const img = await doc.embedJpg(new Uint8Array(await card.blob.arrayBuffer()));
  const pw = 595.28, ph = pw * card.h / card.w;
  doc.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  let hasPdf = false;
  if (src) {
    try { (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p)); hasPdf = true; }
    catch { /* unreadable PDF — card only */ }
  }
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return { bytes: await doc.save(), name: `قطعة ${safe(m.l.n)} - ${safe(m.l.projectName)}.pdf`, hasPdf };
}
