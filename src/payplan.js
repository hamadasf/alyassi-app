// «خطة السداد» PDF for a land, in the company's letterhead (the office's own Payment Plan design):
// the plot's details, price / down payment / instalments, and the dated schedule — one A-letter page, shared as a PDF.
import { PDFDocument } from 'pdf-lib';

const W = 1224, HH = 1584;   // US Letter at 2× (612 × 792 pt)
const OFFICE = { phone: '06 744 2027', insta: 'omaralyassi.uae3' };   // the footer's contact: the office number only, and the company's Instagram
const NAVY = '#24305E', SLATE = '#3B4C66', GOLD = '#A88B57', INK = '#1E2A3A', MUTED = '#6B7280', LINE = '#E6E0D4', SOFT = '#F7F3EC', TOT = '#F1ECDF';
const F = (w, px) => `${w} ${px}px Tajawal, "Segoe UI", Tahoma, sans-serif`;
const nf = new Intl.NumberFormat('en-US');
const fmt = (n) => nf.format(Math.round(n || 0));

const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
let assets = null;
const loadAssets = () => assets || (assets = Promise.all([img('./assets/pp-head.jpg'), img('./assets/pp-foot.jpg'), img('./assets/pp-emblem.jpg')]).then(([head, foot, emblem]) => ({ head, foot, emblem })));

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function text(c, s, x, y, font, color, align = 'right') { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(String(s), x, y); return c.measureText(String(s)).width; }
/** the UAE dirham sign (a D with two bars), drawn — the fonts do not have it yet */
function dirham(c, x, y, s, color) {
  c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1.6, s * 0.13); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x, y); c.stroke();
  c.beginPath(); c.ellipse(x, y - s / 2, s * 0.55, s / 2, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.lineWidth = Math.max(1.2, s * 0.09);
  [0.36, 0.62].forEach((f) => { c.beginPath(); c.moveTo(x - s * 0.28, y - s * f); c.lineTo(x + s * 0.68, y - s * f); c.stroke(); });
  c.restore();
}
/** an amount with the dirham sign on its left, right-aligned at xr */
function money(c, n, xr, y, px, weight, color) {
  const w = text(c, fmt(n), xr, y, F(weight, px), color, 'right');
  const s = px * 0.62; dirham(c, xr - w - s * 0.9 - 4, y, s, color);
}
const monthsBetween = (a, b) => { const x = /^(\d{4})-(\d{2})/.exec(a || ''), y = /^(\d{4})-(\d{2})/.exec(b || ''); return x && y ? (+y[1] - +x[1]) * 12 + (+y[2] - +x[2]) : 0; };
const every = (m) => (m ? 'كل ' + (m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? m + ' شهور' : m + ' شهرًا') : '');
const instWord = (n) => (n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : n <= 10 ? n + ' أقساط' : n + ' قسط');

/** the plan's numbers from the land: price, down payment (paid at signing) and the dated instalments */
export function planOf(l) {
  const total = +l.total || 0;
  const inst = (l.inst || []).map((x) => [String(x[0] || ''), +x[1] || 0]).filter((x) => x[1] > 0);
  const sum = inst.reduce((a, x) => a + x[1], 0);
  const down = inst.length ? Math.max(0, total - sum) : total;
  return { total, inst, sum, down, ppf: l.ppf || (l.ft ? total / l.ft : 0), freq: inst.length > 1 ? monthsBetween(inst[0][0], inst[1][0]) : 0 };
}

async function drawPage(l, client) {
  const A = await loadAssets();
  await Promise.all(['400', '500', '700', '800'].map((w) => document.fonts.load(`${w} 30px Tajawal`, 'خطة 0123'))).catch(() => {});
  const P = planOf(l);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = HH;
  const c = cv.getContext('2d'); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, HH);
  // the big faint emblem behind everything, as in the letterhead
  if (A.emblem) { c.save(); c.globalAlpha = 0.11; c.globalCompositeOperation = 'multiply'; const eh = 1000, ew = eh * A.emblem.width / A.emblem.height; c.drawImage(A.emblem, (W - ew) / 2, 300, ew, eh); c.restore(); }
  if (A.head) c.drawImage(A.head, 0, 0, W, W * A.head.height / A.head.width);
  if (A.foot) {   // the letterhead's footer, with the office number and the Instagram account written in
    const fh = W * A.foot.height / A.foot.width, fy = HH - fh, k = W / 1224;
    c.drawImage(A.foot, 0, fy, W, fh);
    c.save(); c.direction = 'ltr';
    text(c, OFFICE.phone, 1138 * k, fy + 55 * k, F(800, 27 * k), NAVY, 'right');
    text(c, OFFICE.insta, 369 * k, fy + 54 * k, F(800, 27 * k), NAVY, 'left');
    c.restore();
  }

  const L = 108, R = 1116;
  text(c, 'خطة السداد', R, 310, F(800, 44), INK);
  c.direction = 'ltr'; text(c, 'Payment Plan', L, 310, F(700, 22), GOLD, 'left'); c.direction = 'rtl';
  c.fillStyle = GOLD; c.fillRect(L, 328, R - L, 3);

  // details box: two columns × three rows
  const bx = L, by = 352, bw = R - L, rh = 50;
  c.fillStyle = 'rgba(255,255,255,.86)'; rr(c, bx, by, bw, rh * 3, 14); c.fill(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.moveTo(bx + bw / 2, by); c.lineTo(bx + bw / 2, by + rh * 3); c.moveTo(bx, by + rh); c.lineTo(bx + bw, by + rh); c.moveTo(bx, by + rh * 2); c.lineTo(bx + bw, by + rh * 2); c.stroke();
  const cell = (col, row, label, value, isMoney) => {
    const xr = (col ? bx + bw / 2 : bx + bw) - 20, y = by + row * rh + 33;
    const lw = text(c, label, xr, y, F(500, 17), MUTED);
    if (isMoney) money(c, value, xr - lw - 14, y, 21, 800, INK);
    else text(c, value, xr - lw - 14, y, F(800, 21), INK);
  };
  cell(0, 0, 'اسم العميل', client || '—'); cell(1, 0, 'رقم الأرض', l.n);
  cell(0, 1, 'المنطقة', l.projectName || ''); cell(1, 1, 'المساحة', `${fmt(l.ft)} قدم²`);
  cell(0, 2, 'سعر القدم', P.ppf, true);
  { const d = new Date(); cell(1, 2, 'تاريخ الإصدار', `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`); }

  // three cards: price · down payment (highlighted) · instalments
  const cy = 518, ch = 114, gap = 14, cw = (bw - gap * 2) / 3;
  const card = (i, title, n, sub, dark) => {
    const x = R - (i + 1) * cw - i * gap;
    c.fillStyle = dark ? SLATE : 'rgba(255,255,255,.9)'; rr(c, x, cy, cw, ch, 14); c.fill(); c.strokeStyle = dark ? '#2C3A50' : LINE; c.lineWidth = 2; c.stroke();
    text(c, title, x + cw - 18, cy + 32, F(500, 17), dark ? '#E8EDF5' : MUTED);
    money(c, n, x + cw - 18, cy + 74, 34, 800, dark ? '#fff' : INK);
    if (sub) text(c, sub, x + cw - 18, cy + 100, F(500, 15), dark ? '#F3D9A4' : '#9A6B2E');
  };
  card(0, 'سعر الأرض', P.total, '');
  if (P.inst.length) {
    card(1, 'الدفعة المقدمة', P.down, `${P.total ? (Math.round(P.down / P.total * 1000) / 10) : 0}% — عند توقيع العقد`, true);
    card(2, 'الأقساط', P.sum, `${instWord(P.inst.length)}${P.freq ? ' · ' + every(P.freq) : ''}`);
  } else {
    card(1, 'طريقة الدفع', P.total, 'كاش — عند توقيع العقد', true);
    card(2, 'الأقساط', 0, 'بدون أقساط');
  }

  // the schedule
  const rows = [['0', P.inst.length ? 'الدفعة المقدمة' : 'المبلغ كاملاً', 'عند توقيع العقد', P.down, true], ...P.inst.map((x, i) => [String(i + 1), `القسط ${i + 1}`, x[0].slice(0, 10), x[1], false])];
  const ty = 650, hh = 42, bottom = HH - 190;
  const rowH = Math.max(22, Math.min(40.5, (bottom - ty - hh - 40) / (rows.length + 1)));
  const fs = Math.max(12, Math.min(18, rowH * 0.45));
  const X = { n: R - 14, desc: 1028, date: 650, amt: 355 };
  c.fillStyle = SLATE; c.fillRect(L, ty, bw, hh);
  text(c, '#', X.n, ty + 28, F(700, 17), '#fff');
  text(c, 'البيان', X.desc, ty + 28, F(700, 17), '#fff');
  text(c, 'تاريخ الاستحقاق', X.date, ty + 28, F(700, 17), '#fff', 'center');
  { const w = text(c, 'المبلغ (', X.amt, ty + 28, F(700, 17), '#fff', 'right'); dirham(c, X.amt - w - 10, ty + 27, 12, '#fff'); text(c, ')', X.amt - w - 22, ty + 28, F(700, 17), '#fff', 'right'); }
  rows.forEach((r, i) => {
    const y = ty + hh + i * rowH;
    if (i % 2 === 0) { c.fillStyle = 'rgba(247,243,236,.85)'; c.fillRect(L, y, bw, rowH); }
    c.fillStyle = LINE; c.fillRect(L, y + rowH - 1, bw, 1);
    const yy = y + rowH / 2 + fs * 0.36, wt = r[4] ? 800 : 500;
    text(c, r[0], X.n, yy, F(wt, fs), INK);
    text(c, r[1], X.desc, yy, F(wt, fs), INK);
    c.direction = r[4] ? 'rtl' : 'ltr'; text(c, r[2], X.date, yy, F(wt, fs), INK, 'center'); c.direction = 'rtl';
    text(c, fmt(r[3]), X.amt, yy, F(wt, fs), INK, 'right');
  });
  const ey = ty + hh + rows.length * rowH;
  c.fillStyle = TOT; c.fillRect(L, ey, bw, rowH);
  text(c, 'الإجمالي', X.desc, ey + rowH / 2 + fs * 0.36, F(800, fs), INK);
  text(c, fmt(P.total), X.amt, ey + rowH / 2 + fs * 0.36, F(800, fs), INK, 'right');
  text(c, 'هذه الخطة للتوضيح وتخضع لبنود العقد الموقّع بين الطرفين.', R, ey + rowH + 30, F(500, 15), MUTED);
  return cv;
}

/** → { bytes, name } — a one-page PDF */
export async function buildPayPlan(l, client = '') {
  const cv = await drawPage(l, client.trim());
  const jpg = await new Promise((ok) => cv.toBlob((b) => ok(b), 'image/jpeg', 0.92));
  const doc = await PDFDocument.create();
  doc.setTitle(`خطة السداد - قطعة ${l.n} - ${l.projectName || ''}`); doc.setAuthor('عمر الياسي للعقارات'); doc.setCreator('Omar Al Yassi Real Estate');
  const im = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
  const pg = doc.addPage([612, 792]); pg.drawImage(im, { x: 0, y: 0, width: 612, height: 792 });
  const bytes = await doc.save();
  return { bytes, name: `خطة السداد - قطعة ${l.n}${client ? ' - ' + client.replace(/[\\/:*?"<>|]+/g, ' ').trim() : ''}.pdf` };
}
/** for checking the design (tests) */
export const payPlanCanvas = drawPage;
