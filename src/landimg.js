// «صورة إعلان» for one land: a ready 1080×1350 picture to send on WhatsApp — the company logo, the plot on its plan,
// price, area, price per sq ft and the payment plan, with the office number and Instagram at the bottom.
import { loadPlan, drawPlanLoc } from './planloc.js';

const W = 1080, HH = 1350;
const NAVY = '#24305E', GOLD = '#A88B57', INK = '#1E2A3A', MUTED = '#6B7280', LINE = '#E6E0D4', SOFT = '#F7F3EC';
const OFFICE = { phone: '06 744 2027', insta: 'omaralyassi.uae3' };
const F = (w, px) => `${w} ${px}px Tajawal, "Segoe UI", Tahoma, sans-serif`;
const nf = new Intl.NumberFormat('en-US');
const fmt = (n) => nf.format(Math.round(n || 0));
const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
let logoP = null;

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function text(c, s, x, y, font, color, align = 'right') { c.font = font; c.fillStyle = color; c.textAlign = align; c.fillText(String(s), x, y); return c.measureText(String(s)).width; }
function fit(c, s, font, max) { let px = font; c.font = F(800, px); while (px > 20 && c.measureText(s).width > max) { px -= 2; c.font = F(800, px); } return px; }
function dirham(c, x, y, s, color) {
  c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1.6, s * 0.13); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x, y); c.stroke();
  c.beginPath(); c.ellipse(x, y - s / 2, s * 0.55, s / 2, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
  c.lineWidth = Math.max(1.2, s * 0.09);
  [0.36, 0.62].forEach((f) => { c.beginPath(); c.moveTo(x - s * 0.28, y - s * f); c.lineTo(x + s * 0.68, y - s * f); c.stroke(); });
  c.restore();
}

/** l = the land, proj = its project (for the plan), price = the price to show (offer or list) */
export async function buildLandImage(l, proj, price) {
  logoP = logoP || img('./assets/adv-logo.jpg');
  const [logo, P] = await Promise.all([logoP, proj && proj.map && (l.poly || l.pc) ? loadPlan(l.project, proj.map).catch(() => null) : null]);
  await Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 30px Tajawal`, 'قطعة 0123'))).catch(() => {});
  const cv = document.createElement('canvas'); cv.width = W; cv.height = HH;
  const c = cv.getContext('2d'); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
  c.fillStyle = SOFT; c.fillRect(0, 0, W, HH);

  // header: logo on the right, «أرض للبيع» on the left
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, 230);
  c.fillStyle = GOLD; c.fillRect(0, 228, W, 4);
  if (logo) { const h = 200, w = h * logo.width / logo.height; c.drawImage(logo, W - 40 - w, 15, w, h); }
  const sale = l.status === 'res' ? 'أرض محجوزة' : 'أرض للبيع';
  text(c, sale, 300, 110, F(800, 66), NAVY, 'center');
  text(c, 'مشروع ' + l.projectName, 300, 170, F(700, fit(c, 'مشروع ' + l.projectName, 40, 480)), GOLD, 'center');

  // the plot on its plan
  const bx = 40, by = 260, bw = W - 80, bh = 540;
  c.save(); rr(c, bx, by, bw, bh, 28); c.clip();
  if (P) { drawPlanLoc(c, P, l, proj.lands, proj.map, { x: bx, y: by, w: bw, h: bh }); }
  else { c.fillStyle = NAVY; c.fillRect(bx, by, bw, bh); text(c, 'قطعة رقم ' + l.n, W / 2, by + bh / 2 + 30, F(800, 90), '#fff', 'center'); }
  c.restore();
  c.save(); rr(c, bx, by, bw, bh, 28); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); c.restore();
  if (P) {   // caption on the picture
    c.save(); c.globalAlpha = 0.9; rr(c, bx + 20, by + bh - 74, 330, 54, 27); c.fillStyle = NAVY; c.fill(); c.restore();
    text(c, 'موقع القطعة في المخطط', bx + 185, by + bh - 37, F(700, 26), '#fff', 'center');
  }

  // plot number, use
  text(c, 'قطعة رقم ' + l.n, W - 50, 880, F(800, 60), NAVY);
  const sub = [l.use, l.floors].filter(Boolean).join(' · ');
  if (sub) text(c, sub, W - 50, 935, F(500, fit(c, sub, 34, W - 100)), MUTED);

  // three boxes
  const ppf = price && l.ft ? price / l.ft : 0;
  const boxes = [['المساحة', l.ft ? fmt(l.ft) + ' قدم²' : '—'], ['سعر القدم', ppf ? fmt(ppf) + ' د.إ' : '—'], [l.side && l.side !== 'عادية' ? 'الموقع' : 'الارتفاع', (l.side && l.side !== 'عادية' ? l.side : l.floors) || '—']];
  const gw = (W - 80 - 40) / 3;
  boxes.forEach(([k, v], i) => {
    const x = W - 40 - (i + 1) * gw - i * 20, y = 970;
    rr(c, x, y, gw, 130, 22); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = LINE; c.stroke();
    text(c, k, x + gw / 2, y + 48, F(700, 28), MUTED, 'center');
    text(c, v, x + gw / 2, y + 102, F(800, fit(c, v, 40, gw - 30)), INK, 'center');
  });

  // price strip
  const py = 1125, ph = 130;
  rr(c, 40, py, W - 80, ph, 26); c.fillStyle = NAVY; c.fill();
  if (price) {
    text(c, 'السعر', W - 80, py + 52, F(700, 30), '#C9D1E6');
    const amt = fmt(price), px = 64; c.font = F(800, px);
    const w = text(c, amt, W - 80, py + 110, F(800, px), '#E8C98A');
    dirham(c, W - 80 - w - px * 0.62 * 0.9 - 6, py + 108, px * 0.62, '#E8C98A');
    const inst = (l.inst || []).filter((x) => +x[1] > 0);
    if (inst.length) {
      text(c, `مقدّم ${fmt(l.first)}`, 80, py + 58, F(800, 34), '#fff', 'left');
      text(c, `+ ${inst.length} ${inst.length <= 10 ? 'أقساط' : 'قسط'}`, 80, py + 104, F(700, 30), '#C9D1E6', 'left');
    }
  } else text(c, 'السعر عند الاستفسار', W / 2, py + 82, F(800, 46), '#fff', 'center');

  // footer
  c.save(); c.direction = 'ltr';
  text(c, OFFICE.phone, W - 60, 1312, F(800, 34), NAVY, 'right');
  text(c, '@' + OFFICE.insta, 60, 1312, F(800, 34), NAVY, 'left');
  c.restore();

  const blob = await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('img'))), 'image/jpeg', 0.9));
  return { name: `plot-${l.n}-${l.project}.jpg`, bytes: new Uint8Array(await blob.arrayBuffer()), type: 'image/jpeg' };
}
