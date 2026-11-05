// «مولّد منشورات الإعلانات»: the website's ad designer (alyassi-dabdaba-plan → advertisement designer) inside the app.
// The same four templates (الشركة · عبادة · آية الجابري · آية الجديد), cash and instalment versions, filled from the plot
// and the plan, every text editable, parts dragged on the picture, photos / PDF pages cut out, saved or shared as JPEG.
// The drawing code is the website's own, adapted to the app's land objects.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SITE } from './config.js';
import { loadPlan, drawPlanBase, drawPlanLoc, plotCentre } from './planloc.js';
import { rawPlots } from './data.js';
import { AD_LOGOS } from './adlogos.js';

const native = Capacitor.isNativePlatform();
let H = null;
export function initAdgen(h) { H = h; }

/* ---------- small drawing helpers (as on the website) ---------- */
const FAM = 'Tajawal, "Segoe UI", Tahoma, sans-serif';
const FD = (w, px) => w + ' ' + px + 'px ' + FAM;
const FB = FD;
function canvas(w, h, bg) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.direction = 'rtl'; c.textBaseline = 'alphabetic'; return [cv, c]; }
function txt(c, s, x, y, font, color, align) { c.font = font; c.fillStyle = color; c.textAlign = align || 'right'; c.fillText(s, x, y); }
function box(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function monthsBetween(a, b) { const x = /^(\d{4})-(\d{2})/.exec(a || ''), y = /^(\d{4})-(\d{2})/.exec(b || ''); return x && y ? (+y[1] - +x[1]) * 12 + (+y[2] - +x[2]) : 0; }
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const COL = { av: '#12243F', res: '#00A040', sold: '#E10600' };

/* ---------- the templates ---------- */
const pzLogo = (b) => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b; return im; };
const PZ_THEMES = {
  co: { name: 'قالب الشركة', logo: pzLogo(AD_LOGOS.co), bg: '#FFFFFF', ink: '#262A5E', band: ['#252C62', '#252C62'], bandText: '#C2A46E', card: '#F2EFEA', cardLine: '#262A5E', icon: '#C2A46E', price: '#262A5E',
    plot: '#1D2B4F', lbox: '#262A5E', ltext: '#FFFFFF', lline: '#1D4E57', mapLine: '#262A5E', cap: '#262A5E', capText: '#FFFFFF', picLine: '#9AA0B8', bar: '#262A5E', blob: '#D4BC8E', phoneInk: '#262A5E', addr: '#FFFFFF', pinIcon: '#C2A46E', phone: '0568080655' },
  gr: { name: 'قالب عبادة', logo: pzLogo(AD_LOGOS.gr), bg: '#FFFFFF', ink: '#006262', band: ['#026868', '#2A9C96'], bandText: '#FFFFFF', card: '#F2EFEA', cardLine: '#5A6290', icon: '#AC9462', price: '#006262',
    plot: '#1D2B4F', lbox: '#006262', ltext: '#FFFFFF', lline: '#10203F', mapLine: '#242C61', cap: '#006666', capText: '#FFFFFF', picLine: '#C8CBD3', bar: '#006666', blob: '#D8BC7D', phoneInk: '#006262', addr: '#FFFFFF', pinIcon: '#D8BC7D', phone: '0564090004' },
  pk: { name: 'قالب آية الجابري', logo: pzLogo(AD_LOGOS.pk), bg: '#FFF5F4', ink: '#625252', band: ['#F6DCDB', '#F6DCDB'], bandText: '#625252', card: '#FCEAE8', cardLine: '#8C7894', icon: '#C47C80', price: '#625252',
    plot: '#1D2B4F', lbox: '#FFFFFF', ltext: '#3E3438', lline: '#C47C80', mapLine: '#C67F85', cap: 'rgba(70,66,74,.82)', capText: '#FFFFFF', picLine: '#D0C6C6', bar: '#CB7C7F', blob: '#F9E1E1', phoneInk: '#5A4A4C', addr: '#FFFFFF', pinIcon: '#F9E1E1', phone: '0564080004' },
};
PZ_THEMES.aya = Object.assign({}, PZ_THEMES.pk, { name: 'قالب آية الجديد', layout: 'aya', bar: '#B4525C', logo: null, phone: '0564080004' });
let TH = PZ_THEMES.co;
const AD_W = 1600, AD_H = 2000;

/* Aya Al Jabri's new post: its fixed artwork (shipped with the app), everything else drawn here */
const ayaArt = {}; let ayaReady = null;
function ayaLoad() {
  if (ayaReady) return ayaReady;
  const ld = (n) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = './assets/ad/' + n; });
  return (ayaReady = Promise.all([ld('aya-base.jpg'), ld('aya-icons.png'), ld('oy-flag.png'), ld('ar-icons.png'), ld('ar-avatar.jpg')]).then(([b, i, f, ai, av]) => { ayaArt.base = b; ayaArt.icons = i; ayaArt.oyFlag = f; ayaArt.arIcons = ai; ayaArt.arAv = av; }));
}
const AYA = { kick: '#A85E5E', title: '#655454', proj: '#A3504D', sub: '#605050', card: '#F0E5E1', cTitle: '#3E3330', cVal: '#A85E5D', tag: '#46372F', phone: '#A95F5E', addr: '#6A4E4A', plot: '#A2474F' };
const AYA_CARDS = [156, 422, 691, 952, 1222], AYA_CW = 226, AYA_CY = 1347, AYA_CH = 260;

/* ---------- the plot and plan, from the app's data ---------- */
let ad = null, adRaf = 0, PZS = 1, PG = null;
const $ = (id) => (PG ? PG.querySelector('#' + id) : null);
function centreOf(poly) { return [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length]; }
const plotOf = (l) => ({ n: l.n, t: l.t, p: l.poly, c: plotCentre(l), r: l.pr || 0, ft: l.ft, m2: l.m2, status: l.status, l });
function priceOf(p) {
  const l = p.l; if (!l || !(l.total > 0)) return null;
  const T = todayIso();
  const inst = (l.inst || []).filter((x) => String(x[0]) > T).map((x) => ({ d: x[0], a: +x[1] || 0 }));   // an instalment due today or earlier counts in the down payment
  return { total: l.total, inst, down: l.total - inst.reduce((s, x) => s + x.a, 0) };
}
/* the plan (aerial photo + line drawing) in plan units */
function drawPlan(c, x0, y0, x1, y1, k) { if (ad && ad.P) drawPlanBase(c, ad.P, ad.proj.map, x0, y0, x1, y1, k); }
/* the listed plots around, in their sale colours, with their numbers */
function paintPlots(c, test, size) {
  const path = (q) => { c.beginPath(); q.p.forEach((v, i) => (i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]))); c.closePath(); };
  c.direction = 'ltr';
  ad.plots.forEach((q) => {
    if (!q.p || !COL[q.status] || !test(q)) return;
    path(q); c.fillStyle = COL[q.status]; c.fill(); c.lineWidth = 1.1; c.strokeStyle = '#fff'; c.stroke();
    c.save(); c.translate(q.c[0], q.c[1]); c.rotate(q.r * Math.PI / 180);
    txt(c, q.n, 0, 1.6, FD(800, size), '#fff', 'center'); c.restore();
  });
  c.direction = 'rtl';
  return path;
}

/* a strip of the template's own background laid over the plan, fading in or out, so the plan melts into the card */
function ayaFade(c, y0, hh, fromTop) {
  if (!ayaArt.base) return;
  const [cv, g] = canvas(AD_W, hh, 'rgba(0,0,0,0)'); g.clearRect(0, 0, AD_W, hh);
  g.drawImage(ayaArt.base, 0, y0 * ayaArt.base.naturalHeight / AD_H, ayaArt.base.naturalWidth, hh * ayaArt.base.naturalHeight / AD_H, 0, 0, AD_W, hh);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, fromTop ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'); gr.addColorStop(1, fromTop ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 0, AD_W, hh); c.drawImage(cv, 0, y0);
}
function ayaMap(c, p, x, y, w, h, v) {
  const k = 2.4 * (+v.zoom || 1), uw = w / k, uh = h / k, px = x + w / 2, py = y + 360;
  const x0 = p.c[0] - (px - x) / k - (+v.mx || 0) / k, y0 = p.c[1] - (py - y) / k - (+v.my || 0) / k;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#EFE3DC'; c.fillRect(x, y, w, h);
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x0, -y0);
  drawPlan(c, x0, y0, x0 + uw, y0 + uh, k);
  c.fillStyle = 'rgba(250,232,228,0.32)'; c.fillRect(x0, y0, uw, uh);   // the template's soft pink over the plan
  c.beginPath(); p.p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.lineJoin = 'round'; c.fillStyle = AYA.plot; c.fill(); c.lineWidth = 3.2 / k * 2.4; c.strokeStyle = '#fff'; c.stroke();
  c.save(); c.translate(p.c[0], p.c[1]); c.rotate(p.r * Math.PI / 180); c.direction = 'ltr'; txt(c, p.n, 0, 2.4, FD(800, 6.6), '#fff', 'center'); c.restore();
  c.restore(); c.restore();
  let top = 1e9; p.p.forEach((q) => { top = Math.min(top, y + (q[1] - y0) * k); });
  return { sx: x + (p.c[0] - x0) * k, sy: y + (p.c[1] - y0) * k, top };
}
/* the template's marker: a rose drop with a white house */
function ayaPin(c, sx, tip, K) {
  c.save(); c.translate(sx, tip); c.scale(K, K);
  const R = 58, cy = -128;
  c.shadowColor = 'rgba(90,30,40,.28)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
  const g = c.createLinearGradient(0, cy - R, 0, 0); g.addColorStop(0, '#E7A3A8'); g.addColorStop(1, '#B4525C');
  c.fillStyle = g; c.beginPath(); c.arc(0, cy, R, Math.PI * 0.82, Math.PI * 0.18); c.lineTo(0, 0); c.closePath(); c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, cy, R * 0.8, 0, 7); c.fill();
  c.fillStyle = '#B4525C'; c.beginPath(); c.arc(0, cy, R * 0.68, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, cy - 26); c.lineTo(-27, cy - 2); c.lineTo(-19, cy - 2); c.lineTo(-19, cy + 22); c.lineTo(19, cy + 22); c.lineTo(19, cy - 2); c.lineTo(27, cy - 2); c.closePath(); c.fill();
  c.fillStyle = '#B4525C'; c.fillRect(-6, cy + 6, 12, 16);
  c.restore();
}
function ayaCard(c, i, title, val, sub, num) {
  const x = AYA_CARDS[i], cx = x + AYA_CW / 2, v = ad.v;
  c.save(); c.shadowColor = 'rgba(120,70,70,.14)'; c.shadowBlur = 22; c.shadowOffsetY = 5; c.fillStyle = AYA.card; box(c, x, AYA_CY, AYA_CW, AYA_CH, 30); c.fill(); c.restore();
  if (ayaArt.icons) c.drawImage(ayaArt.icons, i * 84, 0, 84, 74, cx - 42, 1364, 84, 74);
  PZS = v.fsL; adFitV(c, title, cx, 1441, 1480, AYA_CW - 24, 40, 700, AYA.cTitle, 'center');
  PZS = v.fsN; if (num) c.direction = 'ltr'; adFitV(c, val, cx, 1493, 1538, AYA_CW - 18, 48, 700, AYA.cVal, 'center'); c.direction = 'rtl';
  PZS = v.fsL; adFitV(c, sub, cx, 1545, 1577, AYA_CW - 24, 28, 600, AYA.cTitle, 'center', FB);
}
function ayaDraw(c, v, p, at) {
  if (ayaArt.base) c.drawImage(ayaArt.base, 0, 0, AD_W, AD_H); else { c.fillStyle = '#F6E4E2'; c.fillRect(0, 0, AD_W, AD_H); }
  PZS = v.fsL; const o = v.o.map || [0, 0];
  c.save(); c.translate(o[0], o[1]); const m = ayaMap(c, p, 92, 812, 1416, 660, v); c.restore();
  ayaFade(c, 806, 46, true); ayaFade(c, 1290, 184, false);
  ad.hits.push({ k: 'map', pan: 1, x: 92, y: 812, w: 1416, h: 535 });
  const sx = m.sx + o[0], K = +v.pinK || 1;
  const sy = m.sy + o[1];
  if (v.lab && (v.label1 || v.label2)) {   // an optional label beside the marker
    const lo = v.o.lab || [0, 0]; c.font = FD(700, 34); const tw = Math.max(c.measureText(v.label1 || '').width, (c.font = FB(600, 30), c.measureText(v.label2 || '').width));
    const bw = Math.min(600, tw + 50), bh = v.label1 && v.label2 ? 100 : 62; let bx = sx + 90 + lo[0]; const by = sy - 250 + lo[1]; if (bx + bw > 1490) bx = sx - 90 - bw + lo[0];
    c.fillStyle = 'rgba(180,82,92,.94)'; box(c, bx, by, bw, bh, 14); c.fill();
    if (v.label1) adFitV(c, v.label1, bx + bw / 2, by + 8, by + (v.label2 ? 52 : bh - 8), bw - 26, 34, 700, '#fff', 'center');
    if (v.label2) adFitV(c, v.label2, bx + bw / 2, by + (v.label1 ? 54 : 8), by + bh - 8, bw - 26, 30, 600, '#fff', 'center', FB);
    ad.hits.push({ k: 'lab', x: bx, y: by, w: bw, h: bh });
  }
  if (v.pin) ayaPin(c, sx, m.top + o[1] - 4, K);
  const pr = priceOf(p), n = pr ? pr.inst.length : 0;
  at('cards', AYA_CARDS[0], AYA_CY, AYA_CARDS[4] + AYA_CW - AYA_CARDS[0], AYA_CH, () => {
    ayaCard(c, 0, 'التصريح', v.a_use, v.a_fl);
    ayaCard(c, 1, 'المساحة', v.area, 'قدم مربع', 1);
    ayaCard(c, 2, 'الموقع', v.a_loc, v.a_city);
    ayaCard(c, 3, 'السعر', v.price, v.a_ps, 1);
    if (v.mode === 'inst') ayaCard(c, 4, v.a_iT || (n ? n + ' أقساط' : 'أقساط'), v.until, v.a_iS); else ayaCard(c, 4, v.a_cT, v.a_cV, v.a_cS);
  });
  PZS = v.fsT;
  at('kick', 420, 268, 760, 76, () => {
    const px = adFitV(c, v.a_kick, 800, 280, 336, 640, 42, 800, AYA.kick, 'center'); if (!v.a_kick) return;
    c.font = FD(800, px); const w = c.measureText(v.a_kick).width; c.strokeStyle = AYA.kick; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(800 - w / 2 - 20, 309); c.lineTo(800 - w / 2 - 70, 309); c.moveTo(800 + w / 2 + 20, 309); c.lineTo(800 + w / 2 + 70, 309); c.stroke();
  });
  at('title', 400, 348, 800, 126, () => adFitV(c, v.a_title, 800, 352, 472, 780, 96, 800, AYA.title, 'center'));
  at('proj', 400, 494, 800, 162, () => adFitV(c, v.proj, 800, 498, 654, 790, 150, 800, AYA.proj, 'center'));
  at('sub', 352, 700, 896, 92, () => adFitV(c, v.sub, 800, 710, 786, 890, 72, 700, AYA.sub, 'center'));
  PZS = v.fsC;
  at('more', 560, 1650, 480, 72, () => adFitV(c, v.a_tag, 800, 1662, 1712, 396, 46, 500, AYA.tag, 'center', FB));
  at('bar', 330, 1748, 1000, 158, () => {
    adFitV(c, v.a_clbl, 542, 1772, 1802, 300, 28, 600, AYA.addr, 'center', FB);
    c.direction = 'ltr'; adFitV(c, v.phone, 542, 1816, 1890, 330, 66, 800, AYA.phone, 'center'); c.direction = 'rtl';
    const L = String(v.a_addr || '').split('\n').filter(Boolean).slice(0, 2);
    if (L.length === 1) adFitV(c, L[0], 1100, 1808, 1860, 380, 38, 700, AYA.addr, 'center', FB);
    else L.forEach((t, i) => adFitV(c, t, 1100, i ? 1838 : 1792, i ? 1874 : 1830, 380, 36, 700, AYA.addr, 'center', FB));
  });
}
/* «قالب عمر الياسي» (the website's): the plan across the whole picture, the facts in coloured boxes over it, an arrow and a ring on the plot */
PZ_THEMES.oy = Object.assign({}, PZ_THEMES.co, { name: 'قالب عمر الياسي', layout: 'oy', bar: '#B535FE' });
const OY = { black: '#0B0B0B', blue: '#4033FC', red: '#FF3535', purple: '#B535FE', ring: '#E0040B' };
const isLatin = (s) => !/[؀-ۿ]/.test(String(s || ''));
const FO = (w, px) => w + ' ' + px + 'px OYF, ' + FAM;   // the Instagram-like lettering of «قالب عمر الياسي» (and the extra shapes)
function oyBox(c, s, right, top, bot, minW, maxW, px, fill, col, r, centre, weight) {
  s = String(s || ''); if (!s) return null;
  let size = Math.round(px * PZS); c.font = FO(weight || 800, size);
  while (c.measureText(s).width > maxW - 70 && size > 18) { size -= 2; c.font = FO(weight || 800, size); }
  const w = Math.max(minW, Math.min(maxW, c.measureText(s).width + 80)), x = centre ? right - w / 2 : right - w;
  c.fillStyle = fill; box(c, x, top, w, bot - top, r); c.fill();
  c.direction = isLatin(s) ? 'ltr' : 'rtl'; adFitV(c, s, x + w / 2, top + 8, bot - 8, w - 50, size / PZS, weight || 800, col, 'center', FO); c.direction = 'rtl';
  return { x, y: top, w, h: bot - top };
}
function oyArrow(c, tx, ty, K) {   // a thick black arrow coming down from the upper right, its tip at (tx, ty)
  c.save(); c.translate(tx, ty); c.rotate(-Math.PI / 4); c.scale(K, K);
  const L = 250, hw = 50, hl = 92, sw = 19;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(hl, -hw); c.lineTo(hl, -sw); c.lineTo(L, -sw); c.lineTo(L, sw); c.lineTo(hl, sw); c.lineTo(hl, hw); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fillStyle = '#000000'; c.fill();
  c.restore();
}
function oyDraw(c, v, p, at) {
  const k = 2.2 * (+v.zoom || 1), px = AD_W * 0.36, py = AD_H * 0.62;
  const x0 = p.c[0] - px / k - (+v.mx || 0) / k, y0 = p.c[1] - py / k - (+v.my || 0) / k;
  c.save(); c.fillStyle = '#E9DCC0'; c.fillRect(0, 0, AD_W, AD_H); c.scale(k, k); c.translate(-x0, -y0); drawPlan(c, x0, y0, x0 + AD_W / k, y0 + AD_H / k, k); c.restore();
  ad.hits.push({ k: 'map', pan: 1, x: 0, y: 0, w: AD_W, h: AD_H });
  const sx = (p.c[0] - x0) * k, sy = (p.c[1] - y0) * k;
  let rr = 0; (p.p || []).forEach((q) => { rr = Math.max(rr, Math.hypot((q[0] - p.c[0]) * k, (q[1] - p.c[1]) * k)); });
  const K = +v.pinK || 1, R = Math.max(44, rr + 14) * K;
  if (v.pin) {
    c.lineWidth = 9 * K; c.strokeStyle = OY.ring; c.beginPath(); c.arc(sx, sy, R, 0, 7); c.stroke();
    oyArrow(c, sx + R * 0.74 + 12, sy - R * 0.74 - 12, K * 1.25);
  }
  PZS = v.fsT;
  at('proj', 1000, 145, 508, 148, () => oyBox(c, v.o_proj, 1508, 145, 293, 486, 900, 112, OY.black, '#FFFFFF', 44));
  at('area', 1000, 345, 508, 114, () => oyBox(c, v.o_area, 1508, 345, 459, 486, 900, 92, OY.blue, '#FFFFFF', 28));
  at('use', 1000, 504, 508, 166, () => {
    c.font = FO(800, 80); const w = Math.max(492, Math.min(900, Math.max(c.measureText(v.o_use1 || '').width, c.measureText(v.o_use2 || '').width) + 90));
    c.fillStyle = OY.red; box(c, 1508 - w, 504, w, 166, 34); c.fill();
    adFitV(c, v.o_use1, 1508 - w / 2, 512, 592, w - 50, 80, 800, '#FFFFFF', 'center', FO);
    c.direction = isLatin(v.o_use2) ? 'ltr' : 'rtl'; adFitV(c, v.o_use2, 1508 - w / 2, 596, 662, w - 50, 72, 800, '#FFFFFF', 'center', FO); c.direction = 'rtl';
  });
  PZS = v.fsN;
  at('price', 70, 1600, 1460, 190, () => {
    const s = v.mode === 'inst' ? v.o_priceI : v.o_priceC; c.fillStyle = OY.purple; box(c, 70, 1600, 1460, 190, 64); c.fill();
    c.direction = isLatin(s) ? 'ltr' : 'rtl'; adFitV(c, s, 800, 1622, 1768, 1360, 160, 800, '#FFFFFF', 'center', FO); c.direction = 'rtl';
  });
  PZS = v.fsL;
  at('pills', 200, 1812, 500, 160, () => {
    [[v.o_p1, 1812, 1880], [v.o_p2, 1900, 1968]].forEach(([s, t, b]) => {
      if (!s) return; c.font = FO(800, 54); const w = Math.min(760, c.measureText(s).width + 60);
      c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 444 - w / 2, t, w, b - t, 16); c.fill(); c.restore();
      adFitV(c, s, 444, t + 7, b - 7, w - 30, 54, 800, '#111111', 'center', FO);
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
  ['o_priceC', 'السعر (الشريط البنفسجي)', 'cash'], ['o_priceI', 'السعر (الشريط البنفسجي)', 'inst'], ['o_p1', 'السطر الأبيض الأول'], ['o_p2', 'السطر الأبيض الثاني'],
];
/* «قالب عبد الرحمن»: the plan with a ring and an arrow on the plot, a navy panel below — project name on a tab, area / permit / price rows, the advertiser */
PZ_THEMES.ar = Object.assign({}, PZ_THEMES.co, { name: 'قالب عبد الرحمن', layout: 'ar', bar: '#132440', phone: '' });
const AR = { navy: '#132440', gold: '#AE9A67', yellow: '#FEF631', red: '#FF3436', line: '#BFCADE' };
function arArrow(c, tx, ty, K) {   // the black arrow with a white outline, coming up from the lower left to the plot
  c.save(); c.translate(tx, ty); c.rotate(Math.PI * 0.75); c.scale(K, K);
  const L = 300, hw = 62, hl = 110, sw = 24;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(hl, -hw); c.lineTo(hl, -sw); c.lineTo(L, -sw); c.lineTo(L, sw); c.lineTo(hl, sw); c.lineTo(hl, hw); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = '#111'; c.stroke(); c.lineWidth = 9; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fillStyle = '#101A2E'; c.fill();
  c.restore();
}
function arDraw(c, v, p, at) {
  const PY = 1531;   // where the panel starts
  const k = 2.4 * (+v.zoom || 1), px = AD_W * 0.56, py = 640;
  const x0 = p.c[0] - px / k - (+v.mx || 0) / k, y0 = p.c[1] - py / k - (+v.my || 0) / k;
  c.save(); c.beginPath(); c.rect(0, 0, AD_W, PY); c.clip(); c.fillStyle = '#E9DCC0'; c.fillRect(0, 0, AD_W, PY);
  c.save(); c.scale(k, k); c.translate(-x0, -y0); drawPlan(c, x0, y0, x0 + AD_W / k, y0 + PY / k, k); c.restore();
  const sx = (p.c[0] - x0) * k, sy = (p.c[1] - y0) * k;
  let rr = 0; (p.p || []).forEach((q) => { rr = Math.max(rr, Math.hypot((q[0] - p.c[0]) * k, (q[1] - p.c[1]) * k)); });
  const K = +v.pinK || 1, R = Math.max(40, rr + 10) * K;
  if (v.pin) {
    c.lineWidth = 9 * K; c.strokeStyle = '#E3060C'; c.beginPath(); c.arc(sx, sy, R, 0, 7); c.stroke();
    const ao = v.o.arrow || [0, 0]; arArrow(c, sx - R * 0.5 + ao[0], sy + R * 0.95 + ao[1], K);
    ad.hits.push({ k: 'arrow', x: sx - R * 0.5 - 260 * K + ao[0], y: sy + R * 0.95 + ao[1], w: 260 * K, h: 260 * K });
  }
  c.restore();
  ad.hits.unshift({ k: 'map', pan: 1, x: 0, y: 0, w: AD_W, h: PY });
  // the panel and the tab
  c.fillStyle = AR.navy; c.fillRect(0, PY, AD_W, AD_H - PY);
  PZS = v.fsT;
  {   // the tab widens with the project's name (its slanted edge moves left), and the name always stays inside it
    let px = Math.round(92 * PZS); c.font = FD(800, px); let tw = c.measureText(v.r_proj || '').width;
    while (tw > 820 && px > 24) { px -= 2; c.font = FD(800, px); tw = c.measureText(v.r_proj || '').width; }
    const L = Math.max(720, Math.min(1150, 1560 - tw - 70)), B = L - 206;
    at('proj', B - 35, 1366, AD_W - B + 35, PY - 1366, () => {
      c.fillStyle = AR.gold; c.beginPath(); c.moveTo(B - 35, PY + 1); c.lineTo(L - 35, 1369); c.lineTo(L, 1369); c.lineTo(B, PY + 1); c.closePath(); c.fill();
      c.fillRect(L - 35, 1366, AD_W - L + 35, 6);
      c.fillStyle = AR.navy; c.beginPath(); c.moveTo(B, PY + 1); c.lineTo(L, 1372); c.lineTo(AD_W, 1372); c.lineTo(AD_W, PY + 1); c.closePath(); c.fill();
      adFitV(c, v.r_proj, (L + 1575) / 2, 1392, 1515, 1575 - L - 30, px / PZS, 800, AR.yellow, 'center');
    });
  }
  // the three rows
  const rows = [[1638, v.r_l1, v.r_area, 0], [1765, v.r_l2, v.r_use, 1], [1896, v.r_l3, v.mode === 'inst' ? v.r_priceI : v.r_priceC, 2]];
  at('rows', 380, 1575, 1210, 380, () => {
    rows.forEach(([y, lab, val, i]) => {
      if (ayaArt.arIcons) c.drawImage(ayaArt.arIcons, i * 86, 0, 86, 82, 1478, y - 51, 107, 102);
      PZS = v.fsL; adFitV(c, lab, 1430, y - 40, y + 40, 340, 56, 800, '#FFFFFF', 'right');
      txt(c, ':', 1050, y + 18, FD(800, 50), '#FFFFFF', 'center');
      PZS = v.fsN;
      if (i === 2) {
        c.font = FD(800, Math.round(62 * PZS)); const w = Math.min(680, Math.max(420, c.measureText(val || '').width + 70));
        c.fillStyle = AR.red; box(c, 1036 - w, y - 46, w, 92, 34); c.fill();
        c.direction = isLatin(val) ? 'ltr' : 'rtl'; adFitV(c, val, 1036 - w / 2, y - 38, y + 38, w - 44, 62, 800, '#FFFFFF', 'center'); c.direction = 'rtl';
      } else adFitV(c, val, 712, y - 50, y + 26, 640, 80, 800, '#FFFFFF', 'center');
      c.fillStyle = AR.line; c.fillRect(388, y + (i === 2 ? 52 : 38), 650, 3);
    });
  });
  PZS = 1;
  if (v.rAv && ayaArt.arAv) at('avatar', 0, 1577, 365, 423, () => c.drawImage(ayaArt.arAv, 0, 1577, 365, 423));
}
const AR_PARTS = [['proj', 'اسم المشروع (اللسان)'], ['rows', 'المساحة والتصريح والسعر'], ['arrow', 'السهم'], ['avatar', 'صورة المعلن']];
const AR_FIELDS = [
  ['r_proj', 'اسم المشروع'], ['r_l1', 'عنوان السطر الأول'], ['r_area', 'المساحة'], ['r_l2', 'عنوان السطر الثاني'], ['r_use', 'تصريح الأرض (مثلًا: سكني  G + 2)'],
  ['r_l3', 'عنوان السطر الثالث'], ['r_priceC', 'السعر (الشريط الأحمر)', 'cash'], ['r_priceI', 'السعر (الشريط الأحمر)', 'inst'],
];
/** the office has every template; a member with «تصميم البوستات» only the ones the office chose for them (none chosen: قالب عمر الياسي) */
const allowed = () => {
  if (H && H.isAdmin && H.isAdmin()) return Object.keys(PZ_THEMES);
  const t = ((H && H.tpls && H.tpls()) || []).filter((k) => PZ_THEMES[k]);
  return t.length ? t : ['oy'];
};
const layoutOf = (t) => (PZ_THEMES[t] || {}).layout || '';
const AYA_PARTS = [['kick', 'السطر الصغير فوق العنوان'], ['title', 'العنوان'], ['proj', 'اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'], ['map', 'الخريطة'], ['lab', 'بطاقة الموقع'], ['cards', 'البطاقات الخمس'], ['more', 'السطر فوق التواصل'], ['bar', 'نصوص التواصل']];
const AYA_FIELDS = [
  ['a_kick', 'السطر الصغير فوق العنوان'], ['a_title', 'العنوان (مثلًا: أرض سكنية في)'], ['proj', 'اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'],
  ['a_use', 'بطاقة التصريح'], ['a_fl', 'بطاقة التصريح · السطر الصغير (مثلًا: G+2)'], ['area', 'بطاقة المساحة (قدم مربع)'],
  ['a_loc', 'بطاقة الموقع'], ['a_city', 'بطاقة الموقع · السطر الصغير'], ['price', 'بطاقة السعر (درهم)'], ['a_ps', 'بطاقة السعر · السطر الصغير'],
  ['a_iT', 'بطاقة الأقساط · العنوان (مثلًا: 5 أقساط)', 'inst'], ['until', 'بطاقة الأقساط · القيمة (مثلًا: حتى 2028)', 'inst'], ['a_iS', 'بطاقة الأقساط · السطر الصغير', 'inst'],
  ['a_cT', 'بطاقة الدفع · العنوان', 'cash'], ['a_cV', 'بطاقة الدفع · القيمة', 'cash'], ['a_cS', 'بطاقة الدفع · السطر الصغير', 'cash'],
  ['label1', 'بطاقة الموقع على الخريطة · السطر الأول'], ['label2', 'بطاقة الموقع على الخريطة · السطر الثاني'],
  ['a_tag', 'السطر فوق التواصل'], ['a_clbl', 'عنوان التواصل'], ['phone', 'رقم التواصل'], ['a_addr', 'العنوان (سطران، Enter بينهما)', '', 1],
];

const AD_KEEP = ['sub', 'more', 'addr', 'a_tag', 'a_addr', 'a_city'];   // remembered on this phone from one ad to the next
const store = () => { try { return JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; } catch { return {}; } };
function pzPhone(t) { const s = store(); return (s.phones && s.phones[t]) || PZ_THEMES[t].phone; }
function pzKeep(f) { try { const s = store(); f(s); localStorage.setItem('dnp-ad', JSON.stringify(s)); } catch { /* private mode */ } }
function adEvery(m) { return m ? 'كل ' + (m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? m + ' شهور' : m + ' شهرًا') : ''; }

/* where the plot sits in its block, read from the plan: «زاوية» with roads on two sides, «سكة» beside a lane (10 m or less) */
const SIDE_LANE = 10;
function adSide(p) {
  if (!p || !p.p || p.p.length < 3) return '';
  const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const u = Math.sqrt(area / (p.m2 || 1)); if (!(u > 0)) return '';   // plan units in one metre
  const inside = (q, x, y) => { let a = false; for (let i = 0, j = q.p.length - 1; i < q.p.length; j = i++) { const [xi, yi] = q.p[i], [xj, yj] = q.p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; } return a; };
  const R = 45 * u, near = ad.all.filter((q) => q.n !== p.n && q.p && Math.abs(q.c[0] - p.c[0]) < R + 80 * u && Math.abs(q.c[1] - p.c[1]) < R + 80 * u);
  const hit = (x, y) => near.some((q) => inside(q, x, y));
  const edges = [];
  let longest = 0;
  p.p.forEach((q, i) => { const r = p.p[(i + 1) % p.p.length]; longest = Math.max(longest, Math.hypot(r[0] - q[0], r[1] - q[1])); });
  p.p.forEach((q, i) => {
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]); if (L < Math.max(3 * u, longest * 0.25)) return;
    let nx = (r[1] - q[1]) / L, ny = -(r[0] - q[0]) / L; if (!inside(p, (q[0] + r[0]) / 2 - nx * 0.5 * u, (q[1] + r[1]) / 2 - ny * 0.5 * u)) { nx = -nx; ny = -ny; }
    const gaps = [0.25, 0.5, 0.75].map((f) => { const x = q[0] + (r[0] - q[0]) * f, y = q[1] + (r[1] - q[1]) * f; for (let d = 1; d <= 45; d += 1) if (hit(x + nx * d * u, y + ny * d * u)) return d; return 99; }).sort((a, b) => a - b);
    edges.push({ gap: gaps[1], a: Math.atan2(ny, nx) });
  });
  const open = edges.filter((e) => e.gap > 2); if (!open.length) return '';
  const widest = open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]);
  const turn = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
  if (open.some((e) => open.some((f) => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return 'زاوية';
  if (open.some((e) => e !== widest && e.gap <= SIDE_LANE)) return 'سكة';
  return '';
}
function adDefaults(p) {
  const l = p.l, PROJECT = l.projectName, T = { use: l.use || 'أرض', floors: l.floors || '' };
  const pr = priceOf(p), inst = pr ? pr.inst : [];
  const fl = (T.floors === 'أرضي + اثنين' ? 'أرضي + طابقين' : T.floors).replace(/\s*\([^()]*\)\s*$/, ''), last = inst.length ? String(inst[inst.length - 1].d || '').slice(0, 4) : '';
  let side = ''; if (ad.rawOk) { try { side = adSide(p); } catch { side = ''; } }   // only with the whole plan's plots (the phone app), never guessed from the listed ones alone
  const v = {
    mode: inst.length ? 'inst' : 'cash', side, title: 'أرض ' + T.use, proj: PROJECT, sub: 'تملك حر لجميع الجنسيات العربية',
    area: p.ft ? fmt(p.ft) : '', pay: 'كاش', until: last ? 'حتى ' + last : '', down: pr && inst.length ? fmt(Math.max(0, pr.down)) : '',
    each: inst.length ? fmt(inst[0].a) : '', every: adEvery(inst.length > 1 ? monthsBetween(inst[0].d, inst[1].d) : 0),
    price: pr ? fmt(pr.total) : '', ppf: (p.l && p.l.ppf) ? String(Math.round(p.l.ppf)) : pr && p.ft ? String(Math.round(pr.total / p.ft)) : '', nInst: inst.length, feat: 'موقع مميز في مشروع ' + PROJECT + '\nقطعة رقم ' + p.n,
    label1: T.use, label2: fl ? '(' + fl + ')' : '', cap1: T.use, cap2: fl,
    more: 'للمزيد من التفاصيل والإستفسار التواصل على الرقم', phone: '0568080655', addr: 'الشارقة شارع مليحة مكتب رقم 2',
    zoom: 1, pin: true, lab: true, pinK: 1, mx: 0, my: 0, o: {}, fsT: 1, fsN: 1, fsL: 1, fsC: 1,
  };
  v.auto = v.side; if (v.side) v.title += ' ' + v.side;
  const n = inst.length, code = /\(([^()]+)\)\s*$/.exec(T.floors || '');
  Object.assign(v, { a_kick: 'فرصة إستثمارية مميزة', a_title: 'أرض ' + T.use + (v.side ? ' ' + v.side : '') + ' في', a_use: T.use, a_fl: code ? code[1] : fl,
    a_loc: PROJECT, a_city: 'الشارقة', a_ps: 'درهم فقط', a_iT: n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : n ? n + ' أقساط' : 'أقساط', a_iS: 'شيكات',
    a_cT: 'الدفعات', a_cV: 'كاش', a_cS: 'نقداً',
    o_proj: PROJECT, o_area: p.ft ? fmt(p.ft) + ' قدم' : '', o_use1: T.use + (v.side ? ' ' + v.side : ''), o_use2: String(code ? code[1] : fl).replace(/\s*\+\s*/g, '  +  '),
    o_priceC: pr ? fmt(pr.total) + ' Dhs, Cash' : 'للاستفسار', o_priceI: pr ? fmt(pr.total) + ' Dhs, ' + (n ? n + ' Installments' : 'Installments') : 'للاستفسار',
    o_p1: 'المنطقة جاهزة للبناء', o_p2: 'تملّك حر للعرب', oFlag: true, oLogo: true,
    r_proj: PROJECT, r_l1: 'المساحة', r_area: p.ft ? fmt(p.ft) + ' قدم' : '', r_l2: 'تصريح الأرض', r_use: (T.use + '   ' + String(code ? code[1] : fl).replace(/\s*\+\s*/g, '  +  ')).trim(),
    r_l3: 'السعـــر', r_priceC: pr ? fmt(pr.total) + ' Dhs, Cash' : 'للاستفسار', r_priceI: pr ? fmt(pr.total) + ' اقساط' : 'للاستفسار', rAv: true, a_tag: 'موقع مميز إستثمار مضمون', a_clbl: 'للتواصل والإستفسار', a_addr: 'شركة عمر الياسي للعقارات\nالشارقة - شارع مليحة' });
  const s = store();
  AD_KEEP.forEach((k) => { if (typeof s[k] === 'string' && s[k]) v[k] = s[k]; });
  v.theme = PZ_THEMES[s.theme] ? s.theme : allowed()[0]; if (!allowed().includes(v.theme)) v.theme = allowed()[0];
  v.phone = pzPhone(v.theme); if (v.theme === 'aya') v.lab = false;
  return v;
}

/* ---------- pictures: the building, the official plan and the planning conditions (from the land's PDF) ---------- */
const adSize = (im) => [im.naturalWidth || im.width || 1, im.naturalHeight || im.height || 1];
/* where the plot is drawn on a scanned page: the red outline of the official plan, or the coloured setbacks of the planning conditions */
function pzFind(cv, kind) {
  const [iw, ih] = adSize(cv), W = 800, Hh = Math.max(1, Math.round(W * ih / iw)), [, c] = canvas(W, Hh, '#fff');
  c.drawImage(cv, 0, 0, W, Hh);
  const d = c.getImageData(0, 0, W, Hh).data, xs = [], ys = [];
  const y0 = Math.round(Hh * (kind === 'plan' ? 0.12 : 0.04)), y1 = Math.round(Hh * (kind === 'plan' ? 0.66 : 0.32));
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const hit = kind === 'plan' ? r > 110 && r > g * 1.6 && r > b * 1.4 && r - g > 50
      : (r > 200 && g > 170 && b < 110) || (b > 170 && g > 140 && r < 140) || (r > 150 && g < 90 && b > 80 && r - b > 20);
    if (hit) { xs.push(x); ys.push(y); }
  }
  let bx0, bx1, by0, by1;
  if (xs.length < 25) { bx0 = W * 0.15; bx1 = W * 0.85; by0 = Hh * (kind === 'plan' ? 0.2 : 0.08); by1 = Hh * (kind === 'plan' ? 0.55 : 0.3); }
  else {
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    bx0 = q(xs, 0.03); bx1 = q(xs, 0.97); by0 = q(ys, 0.03); by1 = q(ys, 0.97);
  }
  const A = 415 / 362, grow = kind === 'plan' ? 2.6 : 3.2;
  let bw = Math.max(20, bx1 - bx0) * grow, bh = Math.max(20, by1 - by0) * grow;
  if (bw / bh < A) bw = bh * A; else bh = bw / A;
  return { cx: (bx0 + bx1) / 2 / W, cy: (by0 + by1) / 2 / Hh, z: Math.max(1, Math.min(10, W / bw)) };
}
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
/* a file from the website as bytes (the phone app reads it directly; the web version through the site's CORS copy) */
async function siteBytes(url, docId) {
  try {
    if (native) {
      const r = await CapacitorHttp.request({ url, method: 'GET', responseType: 'arraybuffer', readTimeout: 40000, connectTimeout: 15000 });
      if (r.status >= 300) return null;
      return typeof r.data === 'string' ? b64ToBytes(r.data) : new Uint8Array(r.data);
    }
    const u = docId ? `${SITE}/wp-admin/admin-ajax.php?action=oay_doc&id=${docId}` : `${SITE}/wp-admin/admin-ajax.php?action=oay_upl&u=${encodeURIComponent(url)}`;
    const r = await fetch(u, { cache: 'force-cache' });
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch { return null; }
}
async function imageOf(url) {
  if (!url) return null;
  let src = url;
  if (/^https?:/i.test(url) && new URL(url, location.href).origin !== location.origin) {
    const u8 = await siteBytes(url); if (!u8) return null;
    src = URL.createObjectURL(new Blob([u8]));
  }
  const im = new Image(); im.src = src;
  try { await im.decode(); return im; } catch { return null; }
}
let pdfjsP = null;
function loadPdfjs() {
  return pdfjsP || (pdfjsP = new Promise((ok, no) => {
    if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
    const el = document.createElement('script'); el.src = './pdfjs/pdf.min.js';
    el.onload = () => { const L = window.pdfjsLib; if (!L) { pdfjsP = null; no(new Error('pdfjs')); return; } L.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.js'; ok(L); };
    el.onerror = () => { pdfjsP = null; no(new Error('pdfjs')); };
    document.head.appendChild(el);
  }));
}
async function pdfPages(bytes, width) {
  const L = await loadPdfjs(), d = await L.getDocument({ data: bytes }).promise, out = [];
  for (let i = 1; i <= Math.min(d.numPages, 6); i++) {
    const pg = await d.getPage(i), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: width / v0.width });
    const [cv, c] = canvas(Math.round(vp.width), Math.round(vp.height), '#fff'); await pg.render({ canvasContext: c, viewport: vp }).promise; out.push(cv);
  }
  return out;
}
async function adPictures(p) {
  const l = p.l, out = [null, null, null];
  const bld = l.img && l.img !== l.sketch && l.img !== (ad.proj && ad.proj.poster) ? l.img : '';
  if (bld) { const im = await imageOf(bld); if (im) out[0] = { im, fit: 'cover', name: l.ownImg ? 'صورة المبنى' : 'صورة تخيلية (يمكن تغييرها)' }; }
  const pageSlot = (pages, k, kind, name) => (pages[k] ? { im: pages[k], fit: 'crop', page: k, kind, crop: pzFind(pages[k], kind), name } : null);
  if (l.doc || l.docId) {
    try {
      const bytes = await siteBytes(l.doc, native ? 0 : l.docId);
      if (bytes) {
        const pages = await pdfPages(bytes, 1600); ad.pages = pages;
        out[1] = pageSlot(pages, pages.length >= 2 ? 1 : 0, 'plan', 'مخطط الأرض الرسمي');
        out[2] = pageSlot(pages, 2, 'cond', 'شروط التخطيط للقطعة');
      }
    } catch { /* no PDF reader or a broken file: the sketch is used */ }
  }
  if (!out[1] && l.sketch) { const im = await imageOf(l.sketch); if (im) out[1] = { im, fit: 'contain', name: 'مخطط الأرض' }; }
  if (!out[1] && ad.P) {   // the plan around the plot, as an illustration
    const [cv, c] = canvas(1200, 900, '#fff');
    drawPlanLoc(c, ad.P, l, ad.proj.lands, ad.proj.map, { x: 0, y: 0, w: 1200, h: 900 });
    out[1] = { im: cv, fit: 'contain', name: 'مخطط توضيحي' };
  }
  return out;
}

/* ---------- extra shapes the user adds on any template: a text box, an arrow, a ring ---------- */
const EX_COLS = ['#0B0B0B', '#4033FC', '#FF3535', '#B535FE', '#F23FD6', '#16A34A', '#FEF631', '#FFFFFF'];
const exInk = (bg) => (bg === '#FFFFFF' || bg === '#FEF631' ? '#111111' : '#FFFFFF');
function exArrow(c, cx, cy, K, deg) {   // centred at (cx, cy), pointing along `deg` (0 = up)
  c.save(); c.translate(cx, cy); c.rotate((deg - 90) * Math.PI / 180); c.scale(K, K);
  const L = 300, hw = 62, hl = 110, sw = 24; c.translate(L / 2, 0); c.scale(-1, 1);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(hl, -hw); c.lineTo(hl, -sw); c.lineTo(L, -sw); c.lineTo(L, sw); c.lineTo(hl, sw); c.lineTo(hl, hw); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fillStyle = '#000000'; c.fill();
  c.restore();
}
function drawExtras(c, v, at) {
  (v.ex || []).forEach((e, i) => {
    const k = 'ex' + i;
    if (e.t === 'box') {
      const L = String(e.text || '').split('\n').map((x) => x.trim()).filter(Boolean); if (!L.length) return;
      const px = Math.round(e.s || 64); c.font = FO(800, px);
      const w = Math.min(1500, Math.max(...L.map((x) => c.measureText(x).width)) + px * 1.1), lh = px * 1.32, h = L.length * lh + px * 0.55;
      const x = e.x - w / 2, y = e.y - h / 2;
      at(k, x, y, w, h, () => {
        if (e.sh !== false) { c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 12; c.shadowOffsetY = 4; }
        c.fillStyle = e.bg || EX_COLS[0]; box(c, x, y, w, h, Math.min(h / 2, px * 0.55)); c.fill(); if (e.sh !== false) c.restore();
        L.forEach((t, j) => { c.direction = isLatin(t) ? 'ltr' : 'rtl'; c.font = FO(800, px); let f = px; while (c.measureText(t).width > w - px * 0.6 && f > 14) { f -= 2; c.font = FO(800, f); }
          txt(c, t, e.x, y + px * 0.28 + lh * j + lh * 0.78, FO(800, f), exInk(e.bg || EX_COLS[0]), 'center'); });
        c.direction = 'rtl';
      });
    } else if (e.t === 'arrow') {
      const K = (e.s || 100) / 100, r = 165 * K;
      at(k, e.x - r, e.y - r, r * 2, r * 2, () => exArrow(c, e.x, e.y, K, +e.r || 0));
    } else if (e.t === 'ring') {
      const R = e.s || 60;
      at(k, e.x - R - 8, e.y - R - 8, R * 2 + 16, R * 2 + 16, () => { c.lineWidth = Math.max(5, R * 0.14); c.strokeStyle = e.bg || '#E3060C'; c.beginPath(); c.arc(e.x, e.y, R, 0, 7); c.stroke(); });
    }
  });
}
function exForm(v) {
  const ex = v.ex || [];
  const sw = (i, cur) => `<div class="ex-cols">${EX_COLS.map((col) => `<button type="button" data-exc="${i}|${col}" class="${cur === col ? 'on' : ''}" style="background:${col}" aria-label="لون"></button>`).join('')}</div>`;
  return `<div class="ex-add"><button type="button" class="btn sm" data-exadd="box">＋ مربع نص</button><button type="button" class="btn sm" data-exadd="arrow">＋ سهم</button><button type="button" class="btn sm" data-exadd="ring">＋ دائرة</button></div>
    ${ex.map((e, i) => `<div class="pz-slot ex-item"><div class="pz-sh"><b>${e.t === 'box' ? 'مربع نص' : e.t === 'arrow' ? 'سهم' : 'دائرة'} ${i + 1}</b><span class="rowbtns"><button type="button" class="btn sm danger" data-exdel="${i}">حذف</button></span></div>
      ${e.t === 'box' ? `<label>الكتابة (سطر جديد = Enter)<textarea dir="auto" rows="2" data-exk="${i}|text">${esc(e.text || '')}</textarea></label>${sw(i, e.bg)}
        <label>حجم الخط<input type="range" min="30" max="140" step="2" data-exk="${i}|s" value="${e.s || 64}"></label>`
      : e.t === 'arrow' ? `<label>الاتجاه<input type="range" min="0" max="359" step="5" data-exk="${i}|r" value="${e.r || 0}"></label><label>الحجم<input type="range" min="30" max="250" step="5" data-exk="${i}|s" value="${e.s || 100}"></label>`
      : `${sw(i, e.bg || '#E3060C')}<label>الحجم<input type="range" min="20" max="300" step="2" data-exk="${i}|s" value="${e.s || 60}"></label>`}</div>`).join('')}
    <p class="help">${ex.length ? 'اسحب الشكل على الصورة لتحريكه، وكبّره أو صغّره بإصبعين، و«✕» على الشكل تحذفه.' : 'أضف مربع نص (مثل «143 بالقدم 💥») أو سهماً أو دائرة، ثم اسحبه على الصورة.'}</p>`;
}
/* ---------- drawing the post (the website's code) ---------- */
function adFit(c, s, x, y, w, px, weight, color, align, fam) {
  px = Math.round(px * PZS); const f = fam || FD; c.font = f(weight, px);
  while (c.measureText(s).width > w && px > 14) { px -= 2; c.font = f(weight, px); }
  txt(c, s, x, y, f(weight, px), color, align); return px;
}
/* a text kept inside its own box: smaller until it fits the width and the height, then centred in the box */
function adFitV(c, s, x, top, bot, w, px, weight, color, align, fam) {
  s = String(s || ''); if (!s) return 0;
  const f = fam || FD; px = Math.round(px * PZS); let m, hgt;
  for (;;) { c.font = f(weight, px); m = c.measureText(s); hgt = (m.actualBoundingBoxAscent || px * 0.8) + (m.actualBoundingBoxDescent || px * 0.25); if ((m.width <= w && hgt <= bot - top) || px <= 12) break; px -= 2; }
  const y = top + (bot - top - hgt) / 2 + (m.actualBoundingBoxAscent || px * 0.8);
  txt(c, s, x, y, f(weight, px), color, align); return px;
}
function adWrap(c, s, w) {
  const out = [];
  String(s || '').split('\n').forEach((par) => {
    let line = '';
    par.split(/\s+/).filter(Boolean).forEach((word) => { const t = line ? line + ' ' + word : word; if (line && c.measureText(t).width > w) { out.push(line); line = word; } else line = t; });
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
  const path = paintPlots(c, (q) => q.n !== p.n && Math.abs(q.c[0] - p.c[0]) <= uw / 2 + 40 && Math.abs(q.c[1] - p.c[1]) <= uh / 2 + 40, 4.2);
  path(p); c.lineJoin = 'round'; c.fillStyle = TH.plot; c.fill(); c.lineWidth = 3.2 / k * 2.4; c.strokeStyle = '#fff'; c.stroke();
  c.save(); c.translate(p.c[0], p.c[1]); c.rotate(p.r * Math.PI / 180); c.direction = 'ltr'; txt(c, p.n, 0, 1.6, FD(800, 4.2), '#fff', 'center'); c.restore();
  c.restore();
  const sx = x + (p.c[0] - x0) * k, sy = y + (p.c[1] - y0) * k;
  const l1 = v.label1 || '', l2 = v.label2 || '', K = +v.pinK || 1, lo = (v.o && v.o.lab) || [0, 0];
  if (v.lab && (l1 || l2)) {   // the label box, joined to the plot by a line
    c.font = FD(700, 36); const tw = Math.max(c.measureText(l1).width, (c.font = FB(600, 32), c.measureText(l2).width));
    const bw = Math.min(w - 60, tw + 56), bh = l1 && l2 ? 108 : 66;
    let bx = sx + 60, by = sy - 300; if (bx + bw > x + w - 24) bx = sx - 60 - bw; if (bx < x + 24) bx = x + 24; if (by < y + 24) by = y + 24;
    bx += lo[0]; by += lo[1]; ad.hits.push({ k: 'lab', x: bx, y: by, w: bw, h: bh });
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
/* the parts of the post that can be moved (arrows in the form, or dragged on the picture) */
const AD_PARTS = [['title', 'العنوان الرئيسي'], ['proj', 'شريط اسم المشروع'], ['sub', 'السطر تحت اسم المشروع'], ['logo', 'الشعار'], ['map', 'الخريطة'], ['lab', 'بطاقة الموقع'], ['cards', 'البطاقات والسعر'], ['pics', 'صف الصور'], ['more', 'سطر التواصل'], ['bar', 'الرقم والعنوان (الشريط السفلي)']];
function drawAd(cv) {
  if (!cv || !ad) return;
  const c = cv.getContext('2d'), v = ad.v, p = ad.p; TH = PZ_THEMES[v.theme] || PZ_THEMES.co; v.o = v.o || {}; ad.hits = [];
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = TH.bg; c.fillRect(0, 0, AD_W, AD_H); c.direction = 'rtl'; c.textBaseline = 'alphabetic';
  const at = (k, x, y, w, h, f) => {   // a part of the post: moved by v.o[k], enlarged by v.sc[k] (two fingers) around its centre
    if (v.hide && v.hide[k]) return;   // removed with ✕ (brought back with «إظهار العناصر المحذوفة» or ↶)
    const o = v.o[k] || [0, 0], sc = (v.sc && v.sc[k]) || 1, cx = x + w / 2, cy = y + h / 2;
    c.save(); c.translate(o[0], o[1]); if (sc !== 1) { c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); } f(); c.restore();
    ad.hits.push({ k, x: cx - w * sc / 2 + o[0], y: cy - h * sc / 2 + o[1], w: w * sc, h: h * sc });
  };
  if (TH.layout === 'aya') { ayaDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
  if (TH.layout === 'oy') { oyDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
  if (TH.layout === 'ar') { arDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
  at('logo', 40, 0, 430, 362, () => {
    if (TH.logo && TH.logo.naturalWidth) c.drawImage(TH.logo, 40, 0, 430, 362);
    else { adFit(c, 'عمر الياسي للعقارات', 217, 300, 420, 42, 800, TH.ink, 'center'); c.direction = 'ltr'; adFit(c, 'Omar Al Yassi Real Estate', 217, 338, 420, 28, 700, TH.ink, 'center', FB); c.direction = 'rtl'; }
  });
  PZS = v.fsT; at('title', 740, 20, 860, 112, () => adFitV(c, v.title, 1560, 22, 120, 820, 78, 800, TH.ink, 'right'));
  at('proj', 740, 138, 860, 124, () => {
    { const g = c.createLinearGradient(740, 0, AD_W, 0); g.addColorStop(0, TH.band[0]); g.addColorStop(0.55, TH.band[1]); g.addColorStop(1, TH.band[0]); c.fillStyle = g; }
    c.beginPath(); c.moveTo(AD_W, 138); c.lineTo(762, 138); c.arcTo(740, 138, 740, 160, 22); c.lineTo(740, 240); c.arcTo(740, 262, 762, 262, 22); c.lineTo(AD_W, 262); c.closePath(); c.fill();
    adFitV(c, v.proj, 1170, 150, 252, 800, 104, 800, TH.bandText, 'center');
  });
  at('sub', 620, 280, 940, 85, () => adFitV(c, v.sub, 1540, 288, 366, 900, 62, 700, TH.ink, 'right'));
  PZS = v.fsL; { const o = v.o.map || [0, 0]; c.save(); c.translate(o[0], o[1]); const h0 = ad.hits.length; adMap(c, p, 52, 387, 950, 913, v); ad.hits.slice(h0).forEach((t) => { t.x += o[0]; t.y += o[1]; }); c.restore(); ad.hits.push({ k: 'map', pan: 1, x: 52 + o[0], y: 387 + o[1], w: 950, h: 913 }); }
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
      let px = Math.round(52 * v.fsL), lines; do { c.font = FB(500, px); lines = adWrap(c, v.feat, 480); px -= 2; } while ((lines.length * px * 1.25 > 235 || lines.some((l) => c.measureText(l).width > 490)) && px > 18);
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
  PZS = v.fsL;
  const shown = ad.img.map((s, i) => (s ? i : -1)).filter((i) => i >= 0), n = shown.length, w = 415, h = 362;
  if (n) {
    const gap = n === 3 ? (1516 - 3 * w) / 2 : 90, x0 = (AD_W - (n * w + (n - 1) * gap)) / 2, o = v.o.pics || [0, 0];
    c.save(); c.translate(o[0], o[1]);
    ad.hits.push({ k: 'pics', x: x0 + o[0], y: 1340 + o[1], w: n * w + (n - 1) * gap, h });
    shown.forEach((i, j) => { const x = x0 + j * (w + gap); adPicture(c, ad.img[i], x, 1340, w, h, i === 0 ? [v.cap1, v.cap2] : null); ad.hits.push({ k: 'pics', pic: i, x: x + o[0], y: 1340 + o[1], w, h }); });
    c.restore();
  }
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
  PZS = 1; drawExtras(c, v, at); adSel(c);
}
function adSel(c) {
  ad.xBtn = null;
  if (!ad.sel || ad.export) return;
  const t = [...ad.hits].reverse().find((h) => h.k === ad.sel && h.pic == null); if (!t) return;
  c.save(); c.setLineDash([14, 10]); c.lineWidth = 4; c.strokeStyle = '#1E88E5'; c.strokeRect(t.x - 6, t.y - 6, t.w + 12, t.h + 12); c.restore();
  if (t.k !== 'map') {   // an × on the corner: removes an added shape, or hides a part of the template
    const r = 64, x = Math.min(AD_W - r - 4, Math.max(r + 4, t.x + t.w + 6)), y = Math.min(AD_H - r - 4, Math.max(r + 4, t.y - 6));
    c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 10; c.fillStyle = '#E11D2E'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore();
    c.save(); c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round'; const d = r * 0.42;
    c.beginPath(); c.moveTo(x - d, y - d); c.lineTo(x + d, y + d); c.moveTo(x + d, y - d); c.lineTo(x - d, y + d); c.stroke(); c.restore();
    ad.xBtn = { k: t.k, x, y, r };
  }
}
/** removes added shape i; the moves and sizes of the shapes after it follow them down */
function partDelete(k) {
  if (/^ex\d+$/.test(k)) { exDelete(+k.slice(2)); return; }
  (ad.v.hide = ad.v.hide || {})[k] = true; ad.sel = null;
}
function exDelete(i) {
  const ex = ad.v.ex || []; if (!ex[i]) return; ex.splice(i, 1);
  for (const m of [ad.v.o, ad.v.sc || {}]) for (let j = i; j <= ex.length; j++) { if (m['ex' + (j + 1)]) m['ex' + j] = m['ex' + (j + 1)]; else delete m['ex' + j]; }
  ad.sel = null;
}
let hist = [], fut = [], inT = 0;
/** remembers the design as it is now, before a change (one step for ↶) */
function mark() {
  if (!ad) return; const s = JSON.stringify(ad.v);
  if (hist[hist.length - 1] !== s) { hist.push(s); if (hist.length > 80) hist.shift(); fut = []; }
  tools();
}
function undo(redo) {
  if (!ad) return; const from = redo ? fut : hist, to = redo ? hist : fut; if (!from.length) return;
  to.push(JSON.stringify(ad.v)); ad.v = JSON.parse(from.pop()); ad.sel = null; pzForm(); adRedraw();
}
function tools() {
  const u = $('pzUndo'), r = $('pzRedo'); if (u) u.disabled = !hist.length; if (r) r.disabled = !fut.length;
}
function adRedraw() { tools(); cancelAnimationFrame(adRaf); adRaf = requestAnimationFrame(() => { if (ad) drawAd($('pzCv')); }); }

const AD_FIELDS = [
  ['title', 'العنوان الرئيسي'], ['proj', 'اسم المشروع (الشريط)'], ['sub', 'السطر تحت اسم المشروع'], ['area', 'المساحة (قدم مربع)'],
  ['pay', 'طريقة الدفع', 'cash'], ['feat', 'نص المميزات (سطر جديد = Enter)', 'cash', 1],
  ['until', 'الأقساط (مثلًا: حتى 2029)', 'inst'], ['down', 'الدفعة المقدمة (درهم)', 'inst'], ['each', 'قيمة القسط (درهم)', 'inst'], ['every', 'الفترة بين الأقساط (مثلًا: كل 4 شهور)', 'inst'],
  ['price', 'سعر الأرض (درهم)'], ['label1', 'بطاقة الموقع على الخريطة · السطر الأول'], ['label2', 'بطاقة الموقع على الخريطة · السطر الثاني'],
  ['cap1', 'تعليق صورة المبنى · السطر الأول'], ['cap2', 'تعليق صورة المبنى · السطر الثاني'], ['more', 'سطر التواصل'], ['phone', 'رقم التواصل'], ['addr', 'العنوان'],
];

/* ---------- «سعر القدم»: the total worked out and written in every template's price fields ---------- */
const num = (s) => +String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '') || 0;
function areaFt() {   // the area written in the current template (so an edited area counts), else the plot's
  const v = ad.v, lay = layoutOf(v.theme);
  return num(lay === 'oy' ? v.o_area : lay === 'ar' ? v.r_area : v.area) || +ad.p.ft || 0;
}
function applyPpf() {
  const v = ad.v, ppf = num(v.ppf), ft = areaFt(); if (!ppf || !ft) return 0;
  const total = Math.round(ppf * ft), t = fmt(total), n = +v.nInst || 0;
  Object.assign(v, { price: t, o_priceC: t + ' Dhs, Cash', o_priceI: t + ' Dhs, ' + (n ? n + ' Installments' : 'Installments'), r_priceC: t + ' Dhs, Cash', r_priceI: t + ' اقساط' });
  return total;
}
const ppfHelp = () => { const ppf = num(ad.v.ppf), ft = areaFt(); return ppf && ft ? `الإجمالي: <b class="num">${fmt(ppf)}</b> × <b class="num">${fmt(ft)}</b> قدم = <b class="num">${fmt(Math.round(ppf * ft))}</b> درهم` : 'اكتب سعر القدم ويُحسب السعر الإجمالي ويُكتب في البوست تلقائياً.'; };
const dmy = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/* ---------- the page ---------- */
export function adgenPage(l, projects) {
  if (!l) {   // opened from «المزيد»: choose the plot first
    return `<div class="pad adg-pick">
      <ol class="adg-steps"><li>اختر المشروع</li><li>اختر القطعة من المخطط أو من القائمة</li><li>عدّل الكتابة إن أردت، ثم شارك البوست أو احفظه</li></ol>
      <label class="fld">١. المشروع<select id="adgProj">${projects.filter((p) => p.map).map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}</select></label>
      <button class="btn primary block" id="adgPlan">🗺️ اختر القطعة من المخطط</button>
      <div class="adg-or"><span>أو</span></div>
      <label class="fld">٢. رقم القطعة<input id="adgN" inputmode="numeric" placeholder="اكتب الرقم أو اختر من القائمة"></label>
      <div id="adgList" class="adg-chips"></div>
    </div>`;
  }
  return `<div class="adg">
    <div class="adg-prev"><canvas id="pzCv" width="${AD_W}" height="${AD_H}"></canvas><div class="adg-load" id="adgLoad"><i class="spin"></i><span>جارِ تجهيز التصميم…</span></div>
      <button class="adg-big" id="adgBig" aria-label="تكبير المعاينة">⤢</button>
      <div class="adg-tools"><button type="button" id="pzUndo" disabled><b>↶</b>تراجع</button><button type="button" id="pzRedo" disabled>إعادة<b>↷</b></button></div></div>
    <div class="adg-form" id="pzForm"></div>
    <input type="file" id="pzFile" accept="image/*,application/pdf" hidden>
    <div class="adg-bar"><button class="btn primary" id="pzShare">📤 مشاركة</button><button class="btn" id="pzSave">⬇️ حفظ الصورة</button><button class="btn" id="pzKeep">💾 حفظ التصميم</button><button class="btn gold" id="pzAll" hidden>🗂️ كل القوالب</button></div>
    <div class="adg-allpop" id="pzAllPop" hidden><div class="adg-allin"><b>كل القوالب مرة واحدة</b><p class="muted" id="pzAllTxt"></p>
      <button class="btn primary block" id="pzAllShare">📤 مشاركة الكل</button><button class="btn ghost block" id="pzAllSave">⬇️ حفظ الكل</button><button class="btn block" id="pzAllNo">إلغاء</button></div></div>
    <div class="adg-crop" id="pzCropBox" hidden><div class="adg-cropin">
      <b>اسحب الإطار على الجزء المطلوب (أو ارسم إطارًا جديدًا)</b>
      <div class="adg-cnav" id="pzCropNav"></div>
      <div class="adg-cwrap"><canvas id="pzCropCv"></canvas></div>
      <div class="adg-cbtns"><button class="btn primary" id="pzCropOk">تم</button><button class="btn" id="pzCropNo">إلغاء</button></div>
    </div></div>
  </div>`;
}

function pzForm() {
  const aya = layoutOf(ad.v.theme) === 'aya', oy = layoutOf(ad.v.theme) === 'oy', ar = layoutOf(ad.v.theme) === 'ar', okT = allowed(), only = okT.length < 2;
  const v = ad.v, f = ([k, l, m, area]) => `<label class="fld" data-m="${m || ''}"${m && m !== v.mode ? ' hidden' : ''}>${l}${area ? `<textarea data-k="${k}" rows="3">${esc(v[k])}</textarea>` : `<input type="text" data-k="${k}" value="${esc(v[k])}">`}</label>`;
  const slots = ['صورة المبنى', 'مخطط الأرض', 'شروط التخطيط'].map((t, i) => {
    const s = ad.img[i];
    const crop = s && s.fit === 'crop' ? `<div class="pz-crop">${(s.pages || ad.pages) && s.page != null ? `<label class="fld">صفحة الملف<select data-slotpage="${i}">${(s.pages || ad.pages).map((q, k) => `<option value="${k}"${k === s.page ? ' selected' : ''}>صفحة ${k + 1}</option>`).join('')}</select></label>` : ''}
      <label>تكبير<input type="range" data-slotz="${i}" min="0.4" max="10" step="0.05" value="${s.crop.z}"></label>
      <label>تحريك أفقي<input type="range" data-slotx="${i}" min="0" max="1" step="0.002" value="${s.crop.cx}"></label>
      <label>تحريك عمودي<input type="range" data-sloty="${i}" min="0" max="1" step="0.002" value="${s.crop.cy}"></label>
      <span class="rowbtns"><button type="button" class="btn sm" data-slotcut="${i}">✂️ قصّ يدوي</button>${s.kind ? `<button type="button" class="btn sm" data-slotauto="${i}">قصّ تلقائي</button>` : ''}</span></div>`
      : s ? `<div class="pz-crop">
      <label>تكبير<input type="range" data-picz="${i}" min="0.4" max="4" step="0.05" value="${s.z || 1}"></label>
      <label>تحريك يمين / يسار<input type="range" data-picx="${i}" min="0" max="1" step="0.005" value="${s.cx == null ? 0.5 : s.cx}"></label>
      <label>تحريك فوق / تحت<input type="range" data-picy="${i}" min="0" max="1" step="0.005" value="${s.cy == null ? 0.5 : s.cy}"></label>
      <span class="rowbtns"><button type="button" class="btn sm" data-picreset="${i}">إرجاع</button><button type="button" class="btn sm" data-slotcut="${i}">✂️ قصّ يدوي</button></span></div>` : '';
    return `<div class="pz-slot"><div class="pz-sh"><span><b>${t}</b><small>${s ? esc(s.name) : 'بدون صورة'}</small></span><span class="rowbtns"><button type="button" class="btn sm" data-pzup="${i}">${s ? 'تغيير' : 'إضافة'}</button>${s && s.fit !== 'crop' ? `<button type="button" class="btn sm" data-pzfit="${i}">${s.fit === 'cover' ? 'ملء الإطار' : 'الصورة كاملة'}</button>` : ''}${s ? `<button type="button" class="btn sm danger" data-pzrm="${i}">حذف</button>` : ''}</span></div>${crop}</div>`;
  }).join('');
  const was = new Set([...$('pzForm').querySelectorAll('details[open]')].map((d) => d.dataset.sec));
  const fresh = !$('pzForm').querySelector('details');
  const sec = (k, t, body, open) => `<details class="pz-sec" data-sec="${k}"${(fresh ? open : was.has(k)) ? ' open' : ''}><summary>${t}</summary><div class="pz-body">${body}</div></details>`;
  const sv = ad.saved && ad.saved[v.theme];
  $('pzForm').innerHTML = (sv ? `<div class="pz-saved">📌 تصميم محفوظ لهذا القالب · <span class="num">${esc(dmy(sv.t))}</span>${sv.by ? ' · ' + esc(sv.by) : ''}<span class="rowbtns"><button type="button" class="btn sm" data-pznew>بدء تصميم جديد</button><button type="button" class="btn sm danger" data-pzunsave>حذف المحفوظ</button></span></div>` : '') + `<p class="pz-tip">👆 اسحب أي نص على الصورة لتحريكه · إصبعان لتكبيره أو تصغيره · عدّل الكتابة من الأسفل · ثم اضغط «مشاركة» أو «حفظ الصورة»</p>` + sec('th', only ? '١. نوع الدفع' : '١. القالب ونوع الدفع', `<div class="pz-th"${only ? ' hidden' : ''}>${Object.entries(PZ_THEMES).filter(([k]) => okT.includes(k)).map(([k, t]) => `<button type="button" data-pzth="${k}" class="${v.theme === k ? 'on' : ''}"><i style="background:${t.bar}"></i>${t.name}</button>`).join('')}</div>
    <div class="seg"><button type="button" data-pzmode="cash" class="${v.mode === 'cash' ? 'on' : ''}">قالب الكاش</button><button type="button" data-pzmode="inst" class="${v.mode === 'inst' ? 'on' : ''}">قالب الأقساط</button></div>`, true)
    + sec('tx', '٢. الكتابة والأسعار', `<label class="fld pz-ppf">سعر القدم (درهم) — يحسب الإجمالي تلقائياً<input type="text" inputmode="decimal" data-ppf value="${esc(v.ppf || '')}" placeholder="مثلاً 143"></label><p class="help" id="pzTot">${ppfHelp()}</p>${(aya ? AYA_FIELDS : oy ? OY_FIELDS : ar ? AR_FIELDS : AD_FIELDS).map(f).join('')}
    <h3>موقع القطعة في العنوان</h3>
    <div class="seg pz-side">${[['', 'عادية'], ['زاوية', 'زاوية'], ['سكة', 'سكة']].map(([k, l]) => `<button type="button" data-pzside="${k}" class="${(v.side || '') === k ? 'on' : ''}">${l}${ad.rawOk && (v.auto || '') === k ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="help">${ad.rawOk ? `✓ = ما قرأته من المخطط${v.auto ? ': ' + v.auto : ': ليست زاوية ولا على سكة'}. ` : ''}الاختيار يضيف الكلمة إلى آخر العنوان.</p>`, false)
    + (aya || oy || ar ? '' : sec('im', '٣. الصور', `${slots}<p class="help">الصور التي تضيفها هنا للبوست فقط ولا تُرفع إلى الموقع. يمكنك اختيار صورة أو ملف PDF.</p>`, false))
    + sec('mp', (aya || oy || ar ? '٣' : '٤') + '. الخريطة والدبوس', `
    <label>تكبير الخريطة<input type="range" data-k="zoom" min="0.5" max="3" step="0.1" value="${v.zoom}"></label>
    <label>حجم الدبوس <b class="num" data-fsv="pinK">${Math.round((v.pinK || 1) * 100)}%</b><input type="range" data-k="pinK" min="0.4" max="2.5" step="0.05" value="${v.pinK || 1}"></label>
    <label class="chk"><input type="checkbox" data-k="pin"${v.pin ? ' checked' : ''}> الدبوس</label>
    ${ar ? `<label class="chk"><input type="checkbox" data-k="rAv"${v.rAv ? ' checked' : ''}> صورة المعلن</label>` : oy ? `<label class="chk"><input type="checkbox" data-k="oFlag"${v.oFlag ? ' checked' : ''}> خريطة الإمارات</label><label class="chk"><input type="checkbox" data-k="oLogo"${v.oLogo ? ' checked' : ''}> شعار الشركة</label>` : `<label class="chk"><input type="checkbox" data-k="lab"${v.lab ? ' checked' : ''}> بطاقة الموقع على الخريطة</label>`}
    <button type="button" class="btn sm" data-mapcenter>إرجاع الخريطة إلى القطعة</button>`, false)
    + sec('ex', '＋ أشكال إضافية' + (v.ex && v.ex.length ? ` (${v.ex.length})` : ''), exForm(v), !!(v.ex && v.ex.length))
    + sec('fs', (aya || oy || ar ? '٤' : '٥') + '. حجم الخط وأماكن العناصر', `<h3>حجم الخط</h3>
    ${[['fsT', 'العنوان واسم المشروع'], ['fsN', 'الأرقام والأسعار'], ['fsL', 'النصوص والعناوين الصغيرة'], ['fsC', 'سطر وشريط التواصل']].map(([k, l]) => `<label>${l} <b class="num" data-fsv="${k}">${Math.round(v[k] * 100)}%</b><input type="range" data-k="${k}" min="0.6" max="1.6" step="0.05" value="${v[k]}"></label>`).join('')}
    <button type="button" class="btn sm" data-fsreset>إرجاع أحجام الخط الأصلية</button>
    <h3>تحريك العناصر</h3>
    <p class="help">اسحب أي نص أو بطاقة على المعاينة مباشرة، وكبّره أو صغّره بإصبعين، أو اختر العنصر وحرّكه بالأسهم. السحب داخل الخريطة أو داخل صورة يحرّك ما بداخلها.</p>
    <div class="pz-move"><select id="pzPart">${(aya ? AYA_PARTS : oy ? OY_PARTS : ar ? AR_PARTS : AD_PARTS).concat((v.ex || []).map((e, i) => ['ex' + i, (e.t === 'box' ? 'مربع نص ' : e.t === 'arrow' ? 'سهم ' : 'دائرة ') + (i + 1)])).map(([k, l]) => `<option value="${k}"${ad.sel === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <div class="pz-arrows"><button type="button" class="btn" data-mv="0,-1" aria-label="فوق">▲</button><button type="button" class="btn" data-mv="1,0" aria-label="يمين">▶</button><button type="button" class="btn" data-mv="-1,0" aria-label="يسار">◀</button><button type="button" class="btn" data-mv="0,1" aria-label="تحت">▼</button></div>
      <span class="rowbtns"><button type="button" class="btn sm" data-mvreset>إرجاع مكانه</button><button type="button" class="btn sm" data-mvall>إرجاع كل الأماكن</button>${v.hide && Object.keys(v.hide).length ? `<button type="button" class="btn sm" data-unhide>إظهار العناصر المحذوفة (${Object.keys(v.hide).length})</button>` : ''}</span></div>`, false)
    + `<p class="help">يُحفظ على هذا الجهاز: القالب المختار، رقم كل قالب، والسطر تحت اسم المشروع وسطر التواصل والعنوان.</p>`;
}

/* ---------- cutting a part out of a picture or a PDF page: a frame of the post's shape, dragged over the page ---------- */
let pzc = null;
const PZ_A = 415 / 362;
function pzCut(i) {
  const s = ad && ad.img[i]; if (!s) return;
  pzc = { i, page: s.page, im: s.im };
  const [iw, ih] = adSize(s.im);
  let r;
  if (s.fit === 'crop') { const sw = iw / s.crop.z, sh = sw / PZ_A; r = { x: s.crop.cx * iw - sw / 2, y: s.crop.cy * ih - sh / 2, w: sw, h: sh }; }
  else { let w = iw * 0.8, h = w / PZ_A; if (h > ih * 0.8) { h = ih * 0.8; w = h * PZ_A; } r = { x: (iw - w) / 2, y: (ih - h) / 2, w, h }; }
  pzc.r = r;
  const pages = s.pages || (s.page != null ? ad.pages : null);
  $('pzCropNav').innerHTML = pages && pages.length > 1 ? pages.map((q, k) => `<button type="button" class="btn sm${k === s.page ? ' on' : ''}" data-cpage="${k}">صفحة ${k + 1}</button>`).join('') : '';
  $('pzCropBox').hidden = false; requestAnimationFrame(pzcDraw);
}
function pzcDraw() {
  if (!pzc) return;
  const cv = $('pzCropCv'), im = pzc.im, [iw, ih] = adSize(im), wrap = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const k = Math.min((wrap.width || 340) / iw, (wrap.height || Math.max(240, window.innerHeight - 220)) / ih) * dpr; pzc.k = k;
  cv.width = Math.round(iw * k); cv.height = Math.round(ih * k); cv.style.width = cv.width / dpr + 'px'; cv.style.height = cv.height / dpr + 'px';
  const c = cv.getContext('2d'); c.drawImage(im, 0, 0, cv.width, cv.height);
  const r = pzc.r, x = r.x * k, y = r.y * k, w = r.w * k, h = r.h * k;
  c.fillStyle = 'rgba(15,20,35,.55)'; c.beginPath(); c.rect(0, 0, cv.width, cv.height); c.rect(x, y, w, h); c.fill('evenodd');
  c.lineWidth = 3 * dpr; c.strokeStyle = '#FFC400'; c.strokeRect(x, y, w, h);
  c.fillStyle = '#FFC400'; const hs = 9 * dpr; [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([a, b]) => c.fillRect(a - hs, b - hs, hs * 2, hs * 2));
}

/* ---------- saving / sharing the finished post ---------- */
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function exportBlob() {
  const cv = $('pzCv'); ad.export = true; drawAd(cv); ad.export = false;
  return new Promise((ok) => cv.toBlob((b) => { adRedraw(); ok(b); }, 'image/jpeg', 0.92));
}
/* ---------- every template at once: one picture per template the account may use, shared or saved together ---------- */
const PZ_FILE = { co: 'company', gr: 'ebada', pk: 'aya-aljabri', aya: 'aya-pink', oy: 'omar-alyassi', ar: 'abdulrahman' };
function designFor(k) {   // the template's saved design, the open one, or a fresh one carrying the payment type and prices
  if (k === ad.v.theme) return ad.v;
  const sv = ad.saved && ad.saved[k]; if (sv) return Object.assign(adDefaults(ad.p), sv.v, { theme: k });
  const v = adDefaults(ad.p); v.theme = k; v.phone = pzPhone(k); if (layoutOf(k) === 'aya') v.lab = false;
  ['mode', 'ppf', 'price', 'o_priceC', 'o_priceI', 'r_priceC', 'r_priceI'].forEach((f) => { if (ad.v[f] !== undefined && ad.v[f] !== '') v[f] = ad.v[f]; });
  return v;
}
async function allBlobs() {
  const keep = ad.v, sel = ad.sel, out = [], cv = document.createElement('canvas'); cv.width = AD_W; cv.height = AD_H;
  ad.export = true; ad.sel = null;
  try {
    for (const k of allowed()) {
      ad.v = designFor(k); drawAd(cv);
      const b = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.92));
      if (b) out.push({ k, b, name: `post-${ad.p.l.project}-${ad.p.n}-${PZ_FILE[k] || k}.jpg` });
    }
  } finally { ad.v = keep; ad.sel = sel; ad.export = false; adRedraw(); }
  return out;
}
async function finishAll(share) {
  if (!ad) return;
  H.toast(`جارِ تجهيز ${allowed().length} صور…`);
  const list = await allBlobs().catch(() => []);
  if (!list.length) { H.toast('تعذّر تجهيز الصور'); return; }
  const title = `قطعة رقم ${ad.p.n} · ${ad.p.l.projectName}`;
  try {
    if (native) {
      const uris = [];
      for (const x of list) { const u8 = new Uint8Array(await x.b.arrayBuffer()); uris.push((await Filesystem.writeFile({ path: x.name, data: b64(u8), directory: Directory.Cache })).uri); }
      if (!share) {
        try {
          for (const x of list) { const u8 = new Uint8Array(await x.b.arrayBuffer()); await Filesystem.writeFile({ path: 'عمر الياسي/' + x.name.replace('.jpg', '-' + Date.now().toString(36) + '.jpg'), data: b64(u8), directory: Directory.Documents, recursive: true }); }
          H.toast(`تم حفظ ${list.length} صور في: المستندات ← عمر الياسي`); return;
        } catch { /* no access to the phone's folders: the share sheet has «حفظ» */ }
      }
      await Share.share({ title, files: uris, dialogTitle: share ? 'مشاركة كل القوالب' : 'حفظ كل القوالب' });
      return;
    }
    const files = list.map((x) => new File([x.b], x.name, { type: 'image/jpeg' }));
    if (share && navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title }); return; }
    for (const x of list) { const a = document.createElement('a'), u = URL.createObjectURL(x.b); a.href = u; a.download = x.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); await new Promise((r) => setTimeout(r, 350)); }
    H.toast(`تم تجهيز ${list.length} صور`);
  } catch (e) {
    if (!/cancel/i.test(String(e && (e.message || e)))) H.toast('تعذّر الحفظ: ' + String((e && e.message) || e).slice(0, 80));
  }
}
async function finish(share) {
  if (!ad) return;
  const b = await exportBlob().catch(() => null);
  if (!b) { H.toast('تعذّر تجهيز الصورة'); return; }
  const name = `post-${ad.p.l.project}-${ad.p.n}.jpg`, title = `قطعة رقم ${ad.p.n} · ${ad.p.l.projectName}`;
  try {
    if (native) {
      const u8 = new Uint8Array(await b.arrayBuffer());
      if (share) {
        const w = await Filesystem.writeFile({ path: name, data: b64(u8), directory: Directory.Cache });
        await Share.share({ title, files: [w.uri], dialogTitle: 'مشاركة الإعلان' });
      } else {
        try {
          await Filesystem.writeFile({ path: 'عمر الياسي/' + name.replace('.jpg', '-' + Date.now().toString(36) + '.jpg'), data: b64(u8), directory: Directory.Documents, recursive: true });
          H.toast('تم حفظ الإعلان في: المستندات ← عمر الياسي');
        } catch {   // no access to the phone's folders: the share sheet has «حفظ» options
          const w = await Filesystem.writeFile({ path: name, data: b64(u8), directory: Directory.Cache });
          await Share.share({ title, files: [w.uri], dialogTitle: 'حفظ الإعلان' });
        }
      }
      return;
    }
    const file = new File([b], name, { type: 'image/jpeg' });
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
    const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000); H.toast('تم تجهيز الإعلان بصيغة JPEG');
  } catch (e) {
    if (!/cancel/i.test(String(e && (e.message || e)))) H.toast('تعذّر الحفظ: ' + String((e && e.message) || e).slice(0, 80));
  }
}

/* ---------- wiring ---------- */
export function initAdgenPick(pg, projects, open) {
  const sel = pg.querySelector('#adgProj'), inp = pg.querySelector('#adgN'), list = pg.querySelector('#adgList');
  const proj = () => projects.find((p) => p.slug === sel.value);
  const show = () => {
    const p = proj(); if (!p) return;
    const q = inp.value.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const rank = { av: 0, res: 1, sold: 2, na: 3 }, pool = H.landsOf ? H.landsOf(p.slug) : p.lands;   // every plot of the plan, offered or not
    const ls = pool.filter((l) => (l.poly || l.pc) && (!q || l.n.startsWith(q))).sort((a, b) => (rank[a.status] ?? 4) - (rank[b.status] ?? 4) || (+a.n || 0) - (+b.n || 0)).slice(0, q ? 60 : 40);
    list.innerHTML = ls.map((l) => `<button type="button" class="chip ${l.status}" data-adg="${esc(l.id)}">${esc(l.n)}<small>${l.status === 'av' ? 'متاحة' : l.status === 'res' ? 'محجوزة' : l.status === 'sold' ? 'مباعة' : 'غير معروضة'}</small></button>`).join('') || '<p class="muted">لا توجد قطعة بهذا الرقم في القطع المعروضة.</p>';
  };
  try { const last = localStorage.getItem('oay:adgproj'); if (last && projects.some((p) => p.slug === last && p.map)) sel.value = last; } catch { /* ignore */ }
  sel.onchange = () => { try { localStorage.setItem('oay:adgproj', sel.value); } catch { /* ignore */ } show(); }; inp.oninput = show; show();
  list.onclick = (e) => { const b = e.target.closest('[data-adg]'); if (b) open(b.dataset.adg); };
  pg.querySelector('#adgPlan').onclick = () => { const p = proj(); if (p && H.openPlan) H.openPlan(p.slug); };
  inp.onkeydown = (e) => { if (e.key !== 'Enter') return; const p = proj(), q = inp.value.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); const l = p && (H.landsOf ? H.landsOf(p.slug) : p.lands).find((x) => x.n === q && (x.poly || x.pc)); if (l) open(l.id); else H.toast('لا توجد قطعة بهذا الرقم — اختر من القائمة'); };
}

export async function initAdgen2(pg, l, proj) {
  PG = pg; ad = null; pzc = null; hist = []; fut = [];
  const cv = $('pzCv');
  const raw = rawPlots(l.project);
  const all = raw ? raw.filter((q) => q[6] && q[6].length > 2).map(([n, , , m2, , , poly, pc]) => ({ n: String(n), p: poly, c: pc || centreOf(poly), m2 })) : proj.lands.filter((x) => x.poly).map(plotOf);
  const P = await Promise.all([
    loadPlan(l.project, proj.map).catch(() => null),
    ayaLoad(),
    Promise.all(['500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Tajawal`, 'أرض 0123')).concat(['700', '800'].map((w) => document.fonts.load(`${w} 40px OYF`, 'أرض 0123')))).catch(() => {}),
    Promise.all(Object.values(PZ_THEMES).map((t) => (t.logo && !t.logo.complete ? new Promise((r) => { t.logo.onload = t.logo.onerror = r; }) : null))),
  ]).then((r) => r[0]);
  if (PG !== pg) return;
  if (!l.poly) {   // a plot the company does not list: its outline from the whole plan, or a square of its size around its centre
    const q = raw && raw.find((r) => String(r[0]) === String(l.n));
    if (q && q[6] && q[6].length > 2) l = { ...l, poly: q[6], pc: q[7] || l.pc || centreOf(q[6]), pr: q[8] || 0 };
    else if (l.pc) {
      const ref = proj.lands.find((x) => x.poly && x.poly.length > 2 && x.m2 > 0);
      const u = ref ? Math.sqrt(Math.abs(ref.poly.reduce((s, a, i) => { const b = ref.poly[(i + 1) % ref.poly.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2 / ref.m2) : 0.3;
      const h = Math.max(2, Math.sqrt(l.m2 || 230) * u / 2), [cx, cy] = l.pc;
      l = { ...l, poly: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] };
    }
  }
  ad = { p: plotOf(l), proj, P, plots: proj.lands.filter((x) => x.poly).map(plotOf), all, rawOk: !!raw, img: [null, null, null], hits: [] };
  ad.v = adDefaults(ad.p); ad.saved = {};
  try {   // a design saved before for this plot (the current template's, else the newest one this account may use)
    const j = await H.api('design_get', { id: l.id }); if (PG !== pg) return;
    ad.saved = j.items || {};
    const ok = allowed(), ks = Object.keys(ad.saved).filter((k) => ok.includes(k) && PZ_THEMES[k]);
    const k = ks.includes(ad.v.theme) ? ad.v.theme : ks.sort((a, b) => ad.saved[b].t - ad.saved[a].t)[0];
    if (k) { ad.v = Object.assign(adDefaults(ad.p), ad.saved[k].v, { theme: k }); H.toast('فُتح التصميم المحفوظ لهذه القطعة'); }
  } catch { /* offline or no permission: a fresh design */ }
  pzForm(); drawAd(cv);
  $('adgLoad').querySelector('span').textContent = 'جارِ تجهيز الصور…';
  try { const img = await adPictures(ad.p); if (PG !== pg) return; ad.img = img; } catch { /* without pictures */ }
  $('adgLoad').remove();
  pzForm(); drawAd(cv);

  const form = $('pzForm');
  form.addEventListener('input', (e) => {
    const t = e.target, k = t.dataset.k; if (!ad) return;
    if (!inT) mark(); clearTimeout(inT); inT = setTimeout(() => { inT = 0; }, 900);
    for (const [key, f] of [['slotz', 'z'], ['slotx', 'cx'], ['sloty', 'cy']]) if (t.dataset[key] !== undefined) { const s = ad.img[+t.dataset[key]]; if (s && s.crop) { s.crop[f] = +t.value; adRedraw(); } return; }
    for (const [key, f] of [['picz', 'z'], ['picx', 'cx'], ['picy', 'cy']]) if (t.dataset[key] !== undefined) { const s = ad.img[+t.dataset[key]]; if (s) { s[f] = +t.value; adRedraw(); } return; }
    if (t.dataset.ppf !== undefined) {
      ad.v.ppf = t.value; applyPpf();
      ['price', 'o_priceC', 'o_priceI', 'r_priceC', 'r_priceI'].forEach((f) => { const el = form.querySelector(`[data-k="${f}"]`); if (el) el.value = ad.v[f]; });
      const h = $('pzTot'); if (h) h.innerHTML = ppfHelp(); adRedraw(); return;
    }
    if (t.dataset.exk) { const [i, f] = t.dataset.exk.split('|'), e = (ad.v.ex || [])[+i]; if (e) { e[f] = f === 'text' ? t.value : +t.value; adRedraw(); } return; }
    if (!k) return;
    ad.v[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
    const fv = form.querySelector('[data-fsv="' + k + '"]'); if (fv) fv.textContent = Math.round(+t.value * 100) + '%';
    if (/^(area|o_area|r_area)$/.test(k) && num(ad.v.ppf)) { applyPpf(); ['price', 'o_priceC', 'o_priceI', 'r_priceC', 'r_priceI'].forEach((f) => { const el = form.querySelector(`[data-k="${f}"]`); if (el) el.value = ad.v[f]; }); const h = $('pzTot'); if (h) h.innerHTML = ppfHelp(); }
    if (k === 'phone') pzKeep((s) => { (s.phones = s.phones || {})[ad.v.theme] = t.value; });
    if (AD_KEEP.includes(k)) pzKeep((s) => { s[k] = t.value; });
    adRedraw();
  });
  form.addEventListener('change', (e) => {
    const t = e.target; if (!ad) return;
    if (t.id === 'pzPart') { ad.sel = t.value; adRedraw(); return; }
    if (t.dataset.slotpage === undefined) return;
    const i = +t.dataset.slotpage, s = ad.img[i], n = +t.value, pages = s && (s.pages || ad.pages); if (!s || !pages || !pages[n]) return;
    s.im = pages[n]; s.page = n; s.crop = pzFind(s.im, s.kind || 'plan'); pzForm(); adRedraw();
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !ad) return;
    const d = b.dataset;
    if (Object.keys(d).length) mark();
    if (d.pzside !== undefined) {
      const t = ad.v.title.replace(/\s+(زاوية|سكة)\s*$/, ''); ad.v.side = d.pzside; ad.v.title = t + (ad.v.side ? ' ' + ad.v.side : '');
      const fi = /\s+في\s*$/.test(ad.v.a_title), b0 = ad.v.a_title.replace(/\s+في\s*$/, '').replace(/\s+(زاوية|سكة)\s*$/, ''); ad.v.a_title = b0 + (ad.v.side ? ' ' + ad.v.side : '') + (fi ? ' في' : '');
      pzForm(); adRedraw(); return;
    }
    if (d.mv) { const k = $('pzPart').value, [dx, dy] = d.mv.split(',').map(Number), o = ad.v.o[k] || [0, 0]; ad.sel = k; ad.v.o[k] = [o[0] + dx * 10, o[1] + dy * 10]; adRedraw(); return; }
    if (d.mvreset !== undefined) { delete ad.v.o[$('pzPart').value]; if (ad.v.sc) delete ad.v.sc[$('pzPart').value]; ad.sel = $('pzPart').value; adRedraw(); return; }
    if (d.mvall !== undefined) { ad.v.o = {}; ad.v.sc = {}; ad.v.hide = {}; pzForm(); adRedraw(); return; }
    if (d.unhide !== undefined) { ad.v.hide = {}; pzForm(); adRedraw(); return; }
    if (d.mapcenter !== undefined) { ad.v.mx = ad.v.my = 0; adRedraw(); return; }
    if (d.picreset !== undefined) { const s = ad.img[+d.picreset]; if (s) { delete s.z; delete s.cx; delete s.cy; pzForm(); adRedraw(); } return; }
    if (d.slotcut !== undefined) { pzCut(+d.slotcut); return; }
    if (d.fsreset !== undefined) { ['fsT', 'fsN', 'fsL', 'fsC'].forEach((k) => { ad.v[k] = 1; }); pzForm(); adRedraw(); return; }
    if (d.pzth) {
      if (!allowed().includes(d.pzth)) return;
      const was = layoutOf(ad.v.theme), now = layoutOf(d.pzth);
      if (was !== now) { ad.v.o = {}; ad.v.sc = {}; ad.v.mx = ad.v.my = 0; ad.v.lab = now !== 'aya'; ad.sel = null; }
      ad.v.theme = d.pzth; ad.v.phone = pzPhone(ad.v.theme); pzKeep((s) => { s.theme = ad.v.theme; });
      const sv = ad.saved && ad.saved[d.pzth]; if (sv) { ad.v = Object.assign(adDefaults(ad.p), sv.v, { theme: d.pzth }); H.toast('فُتح التصميم المحفوظ لهذا القالب'); }
      pzForm(); adRedraw(); return;
    }
    if (d.pzmode) { ad.v.mode = d.pzmode; pzForm(); adRedraw(); return; }
    if (d.pznew !== undefined) { const th = ad.v.theme; ad.v = adDefaults(ad.p); ad.v.theme = th; ad.v.phone = pzPhone(th); if (layoutOf(th) === 'aya') ad.v.lab = false; ad.sel = null; pzForm(); adRedraw(); H.toast('تصميم جديد — المحفوظ باقٍ حتى تحفظ فوقه'); return; }
    if (d.pzunsave !== undefined) {
      if (!confirm('حذف التصميم المحفوظ لهذا القالب؟')) return;
      H.api('design_del', { id: ad.p.l.id, theme: ad.v.theme }).then(() => { delete ad.saved[ad.v.theme]; pzForm(); H.toast('تم حذف التصميم المحفوظ'); }).catch((ex) => H.toast(ex.message));
      return;
    }
    if (d.exadd) {
      const ex = (ad.v.ex = ad.v.ex || []), n = ex.length, [x, y] = [[470, 780], [470, 960], [470, 1140], [1130, 1140], [800, 1380]][n % 5];
      ex.push(d.exadd === 'box' ? { t: 'box', text: 'اكتب هنا', bg: EX_COLS[4], s: 64, x, y } : d.exadd === 'arrow' ? { t: 'arrow', r: 45, s: 100, x, y } : { t: 'ring', bg: '#E3060C', s: 60, x, y });
      ad.sel = 'ex' + n; pzForm(); adRedraw(); return;
    }
    if (d.exdel !== undefined) { exDelete(+d.exdel); pzForm(); adRedraw(); return; }
    if (d.exc) { const [i, col] = d.exc.split('|'), e = (ad.v.ex || [])[+i]; if (e) { e.bg = col; pzForm(); adRedraw(); } return; }
    if (d.pzup !== undefined) { ad.slot = +d.pzup; $('pzFile').value = ''; $('pzFile').click(); return; }
    if (d.slotauto !== undefined) { const s = ad.img[+d.slotauto]; if (s && s.crop) { s.crop = pzFind(s.im, s.kind || 'plan'); pzForm(); adRedraw(); } return; }
    if (d.pzrm !== undefined) { ad.img[+d.pzrm] = null; pzForm(); adRedraw(); return; }
    if (d.pzfit !== undefined) { const s = ad.img[+d.pzfit]; s.fit = s.fit === 'cover' ? 'contain' : 'cover'; pzForm(); adRedraw(); }
  });
  $('pzFile').addEventListener('change', async () => {
    const f = $('pzFile').files[0]; if (!f || !ad) return;
    const i = ad.slot;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {   // a land file or any PDF: its pages drawn here, the right part cut out
      H.toast('جارٍ فتح ملف PDF…');
      try {
        const pages = await pdfPages(new Uint8Array(await f.arrayBuffer()), 1600);
        const k = Math.min(pages.length - 1, pages.length >= 3 ? (i === 2 ? 2 : 1) : i === 2 ? pages.length - 1 : 0), kind = i === 2 ? 'cond' : 'plan';
        ad.img[i] = { im: pages[k], pages, page: k, fit: 'crop', kind: i ? kind : '', crop: i ? pzFind(pages[k], kind) : { cx: 0.5, cy: 0.5, z: 1 }, name: f.name };
        pzForm(); adRedraw(); pzCut(i);
      } catch { H.toast('تعذّر فتح ملف PDF'); }
      return;
    }
    try { const im = new Image(); im.src = URL.createObjectURL(f); await im.decode(); ad.img[i] = { im, fit: i === 0 ? 'cover' : 'contain', name: f.name }; pzForm(); adRedraw(); }
    catch { H.toast('تعذّر فتح الصورة. اختر صورة JPG أو PNG أو ملف PDF.'); }
  });

  // crop dialog
  {
    const ccv = $('pzCropCv'); let drag = null;
    const pt = (e) => { const r = ccv.getBoundingClientRect(); return [(e.clientX - r.left) * ccv.width / r.width / pzc.k, (e.clientY - r.top) * ccv.height / r.height / pzc.k]; };
    ccv.addEventListener('pointerdown', (e) => {
      if (!pzc) return; const [x, y] = pt(e), r = pzc.r, tol = 22 * (ccv.width / ccv.getBoundingClientRect().width) / pzc.k;
      const corner = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].findIndex(([a, b]) => Math.abs(a - x) < tol && Math.abs(b - y) < tol);
      if (corner >= 0) { const ox = corner % 2 ? r.x : r.x + r.w, oy = corner > 1 ? r.y : r.y + r.h; drag = { mode: 'new', ox, oy }; }
      else if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) drag = { mode: 'move', dx: x - r.x, dy: y - r.y };
      else drag = { mode: 'new', ox: x, oy: y };
      ccv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    ccv.addEventListener('pointermove', (e) => {
      if (!drag || !pzc) return; const [x, y] = pt(e), r = pzc.r;
      if (drag.mode === 'move') { r.x = x - drag.dx; r.y = y - drag.dy; }
      else { const w = Math.max(Math.abs(x - drag.ox), Math.abs(y - drag.oy) * PZ_A, 20 / pzc.k), h = w / PZ_A; r.w = w; r.h = h; r.x = x < drag.ox ? drag.ox - w : drag.ox; r.y = y < drag.oy ? drag.oy - h : drag.oy; }
      pzcDraw();
    });
    const end = () => { drag = null; };
    ccv.addEventListener('pointerup', end); ccv.addEventListener('pointercancel', end);
    $('pzCropNav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cpage]'); if (!b || !pzc) return; const s = ad.img[pzc.i], pages = s.pages || ad.pages, n = +b.dataset.cpage;
      pzc.page = n; pzc.im = pages[n]; $('pzCropNav').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pzcDraw();
    });
    $('pzCropNo').onclick = () => { $('pzCropBox').hidden = true; pzc = null; };
    $('pzCropOk').onclick = () => {
      if (!pzc || !ad) return; const s = ad.img[pzc.i], [iw, ih] = adSize(pzc.im), r = pzc.r;
      s.im = pzc.im; if (pzc.page != null) s.page = pzc.page;
      s.fit = 'crop'; s.crop = { cx: (r.x + r.w / 2) / iw, cy: (r.y + r.h / 2) / ih, z: iw / r.w };
      $('pzCropBox').hidden = true; pzc = null; pzForm(); adRedraw();
    };
  }

  // dragging on the post: a text or card moves; inside the plan or a picture, what is shown moves; two fingers enlarge them
  {
    let drag = null; const pts = new Map(); let pinch = null;
    const pt = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * AD_W / b.width, (e.clientY - b.top) * AD_H / b.height]; };
    const under = (x, y) => (ad && ad.hits ? [...ad.hits].reverse().find((t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) : null);
    const zoomT = (t, f) => {
      if (t.pan) ad.v.zoom = Math.max(0.5, Math.min(3, (+ad.v.zoom || 1) * f));
      else if (t.pic != null) { const s = ad.img[t.pic]; if (s.fit === 'crop') s.crop.z = Math.max(0.4, Math.min(10, s.crop.z * f)); else s.z = Math.max(0.4, Math.min(4, (s.z || 1) * f)); }
      else if (t.k) { const sc = (ad.v.sc = ad.v.sc || {}); sc[t.k] = Math.max(0.3, Math.min(4, (sc[t.k] || 1) * f)); }   // a text, a card or an added shape: bigger / smaller
      adRedraw();
    };
    cv.addEventListener('pointerdown', (e) => {
      if (!ad) return; pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); e.preventDefault();
      if (pts.size === 2) { mark(); const tg = drag ? drag.t : ad.sel ? { k: ad.sel } : null; if (tg) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), t: tg }; } return; }
      const [x, y] = pt(e);
      if (ad.xBtn && Math.hypot(x - ad.xBtn.x, y - ad.xBtn.y) <= ad.xBtn.r * 1.6) { mark(); partDelete(ad.xBtn.k); pzForm(); adRedraw(); return; }
      const t = under(x, y); if (!t) { ad.sel = null; adRedraw(); return; }
      mark(); drag = { t, x, y }; if (t.pic == null && !t.pan) { ad.sel = t.k; const s = $('pzPart'); if (s) s.value = t.k; } else ad.sel = null;
      adRedraw();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ad || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch.d > 0) zoomT(pinch.t, d / pinch.d); pinch.d = d; return; }
      if (!drag) return;
      if (drag.re) { [drag.x, drag.y] = pt(e); drag.re = false; return; }   // one finger left after a pinch: carry on from here
      const [x, y] = pt(e), dx = x - drag.x, dy = y - drag.y, t = drag.t, v = ad.v; drag.x = x; drag.y = y;
      if (t.pic != null) {
        const s = ad.img[t.pic], [iw, ih] = adSize(s.im);
        if (s.fit === 'crop') { s.crop.cx -= dx / (t.w * s.crop.z); s.crop.cy -= dy / (ih * t.w * s.crop.z / iw); }
        else { const k = (s.fit === 'cover' ? Math.max(t.w / iw, t.h / ih) : Math.min((t.w - 20) / iw, (t.h - 20) / ih)) * (s.z || 1); s.cx = (s.cx == null ? 0.5 : s.cx) - dx / (iw * k); s.cy = (s.cy == null ? 0.5 : s.cy) - dy / (ih * k); }
      } else if (t.pan) { v.mx = (+v.mx || 0) + dx; v.my = (+v.my || 0) + dy; }
      else { const o = v.o[t.k] || [0, 0]; v.o[t.k] = [o[0] + dx, o[1] + dy]; }
      adRedraw();
    });
    const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) { if (pinch && drag) drag.re = true; pinch = null; } if (!pts.size) { if (drag && drag.t.pic != null) pzForm(); drag = null; } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => { if (!ad) return; const [x, y] = pt(e), t = under(x, y); if (!t || (t.pic == null && !t.pan)) return; e.preventDefault(); zoomT(t, e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
  }
  $('pzKeep').onclick = async () => {
    if (!ad) return; const b = $('pzKeep'); b.disabled = true;
    try { const j = await H.api('design_save', { id: ad.p.l.id, v: ad.v }); ad.saved[ad.v.theme] = { v: JSON.parse(JSON.stringify(ad.v)), t: j.t, by: H.myName ? H.myName() : '' }; pzForm(); H.toast('تم حفظ التصميم ✓ — تجده عند فتح هذه القطعة'); }
    catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  };
  { const n = allowed().length, all = $('pzAll'), pop = $('pzAllPop');
    all.hidden = n < 2; pg.querySelector('.adg-bar').classList.toggle('four', n >= 2);
    all.onclick = () => { $('pzAllTxt').textContent = `${n} صور — صورة بكل قالب (${allowed().map((k) => PZ_THEMES[k].name.replace('قالب ', '')).join('، ')}). القالب المحفوظ يُستخدم كما حفظته.`; pop.hidden = false; };
    $('pzAllNo').onclick = () => { pop.hidden = true; };
    $('pzAllShare').onclick = () => { pop.hidden = true; finishAll(true); };
    $('pzAllSave').onclick = () => { pop.hidden = true; finishAll(false); };
  }
  $('pzUndo').onclick = () => undo(false); $('pzRedo').onclick = () => undo(true);
  $('adgBig').onclick = () => pg.querySelector('.adg').classList.toggle('big');
  $('pzShare').onclick = () => finish(true);
  $('pzSave').onclick = () => finish(false);
}
/** the page was closed */
export function closeAdgen(pg) { if (PG === pg) { PG = null; ad = null; pzc = null; } }
