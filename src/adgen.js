import { ei } from './icons.js';
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
import { uiConfirm, uiPrompt } from './dialog.js';

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
PZ_THEMES.ayk = Object.assign({}, PZ_THEMES.aya, { name: 'قالب آية كامل', ayaCol: 'plum', bar: '#5E1E51', ink: '#4A0D3C', price: '#4A0D3C', icon: '#5E1E51', phone: '0508600740' });
PZ_THEMES.wa = Object.assign({}, PZ_THEMES.co, { name: 'قالب واتس أب', layout: 'wa', size: [1600, 1200], bar: '#B8893F', phone: '' });   // management only (never in the staff list)
PZ_THEMES.wr = Object.assign({}, PZ_THEMES.co, { name: 'قالب لين واتس أب', layout: 'wr', size: [1600, 1200], bar: '#B25858', bg: '#F5EEE7', phone: '' });
PZ_THEMES.wi = Object.assign({}, PZ_THEMES.wr, { name: 'قالب لين إنستجرام', size: [1600, 2000] });
PZ_THEMES.wg = Object.assign({}, PZ_THEMES.wr, { name: 'لين واتس أب · إعلان عام', layout: 'wg' });   // a general ad (the areas we buy and sell in), not one plot — management only   // the same, at the Instagram post size (4:5), management only   // management only, the advertiser's portrait in her rose colours
let TH = PZ_THEMES.co;
let AD_W = 1600, AD_H = 2000;   // «قالب واتس أب» is 4:3 (1600 × 1200); the others 4:5

/* Aya Al Jabri's new post: its fixed artwork (shipped with the app), everything else drawn here */
const ayaArt = {}; let ayaReady = null;
function ayaLoad() {
  if (ayaReady) return ayaReady;
  const ld = (n) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = './assets/ad/' + n; });
  return (ayaReady = Promise.all([ld('aya-base.jpg'), ld('aya-icons.png'), ld('oy-flag.png'), ld('ar-icons.png'), ld('ar-avatar.jpg'), ld('ayk-base.jpg'), ld('ayk-icons.png'), ld('wr-avatar.jpg')]).then(([b, i, f, ai, av, kb, ki, wr]) => { ayaArt.wrAv = wr; ayaArt.pbase = ayaArt.base = b; ayaArt.picons = ayaArt.icons = i; ayaArt.oyFlag = f; ayaArt.arIcons = ai; ayaArt.arAv = av; ayaArt.kbase = kb; ayaArt.kicons = ki; }));
}
const AYA_PINK = { kick: '#A85E5E', title: '#655454', proj: '#A3504D', sub: '#605050', card: '#F0E5E1', cTitle: '#3E3330', cVal: '#A85E5D', tag: '#46372F', phone: '#A95F5E', addr: '#6A4E4A', plot: '#A2474F',
  ground: '#EFE3DC', wash: 'rgba(250,232,228,0.32)', pinA: '#E7A3A8', pinB: '#B4525C', labBg: 'rgba(180,82,92,.94)', shadow: 'rgba(120,70,70,.14)', cardLine: '' };
/* «قالب آية كامل»: the same layout in her plum and lavender */
const AYA_PLUM = { kick: '#4A0D3C', proj: '#4A0A3D', card: '#EEEDEB', cVal: '#4A0D3C', tag: '#3A2238', phone: '#FFFFFF', addr: '#FFFFFF', plot: '#4A0A3D',
  ground: '#ECE4EF', wash: 'rgba(240,230,246,0.34)', pinA: '#4A0A3D', pinB: '#4A0A3D', labBg: 'rgba(74,10,61,.94)', shadow: 'rgba(74,10,61,.12)', cardLine: '#5E1E51', downCard: 1, tagDy: -46, tagDx: 20,
  title: '#4A4F55', titleW: 700, subBig: 1, sub: '#3D4246', zoom: 3.2, sharpTop: 1, pinK: 1.25, barDy: -40, cTitle: '#4A3346', cSub: '#3D4246', cSubPx: 34, subY2: 1585 };
let AYA = AYA_PINK;
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
  const k = (AYA.zoom || 2.4) * (+v.zoom || 1), uw = w / k, uh = h / k, px = x + w / 2, py = y + 360;
  const x0 = p.c[0] - (px - x) / k - (+v.mx || 0) / k, y0 = p.c[1] - (py - y) / k - (+v.my || 0) / k;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = AYA.ground; c.fillRect(x, y, w, h);
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x0, -y0);
  drawPlan(c, x0, y0, x0 + uw, y0 + uh, k);
  c.fillStyle = AYA.wash; c.fillRect(x0, y0, uw, uh);   // the template's soft tint over the plan
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
  const g = c.createLinearGradient(0, cy - R, 0, 0); g.addColorStop(0, AYA.pinA); g.addColorStop(1, AYA.pinB);
  c.fillStyle = g; c.beginPath(); c.arc(0, cy, R, Math.PI * 0.82, Math.PI * 0.18); c.lineTo(0, 0); c.closePath(); c.fill();
  c.shadowColor = 'transparent';
  c.fillStyle = AYA.cardLine ? '#FFFFFF' : 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, cy, R * 0.8, 0, 7); c.fill();
  c.fillStyle = AYA.pinB; c.beginPath(); c.arc(0, cy, R * 0.68, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, cy - 26); c.lineTo(-27, cy - 2); c.lineTo(-19, cy - 2); c.lineTo(-19, cy + 22); c.lineTo(19, cy + 22); c.lineTo(19, cy - 2); c.lineTo(27, cy - 2); c.closePath(); c.fill();
  c.fillStyle = AYA.pinB; c.fillRect(-6, cy + 6, 12, 16);
  c.restore();
}
function ayaCard(c, i, title, val, sub, num) {
  const x = AYA_CARDS[i], cx = x + AYA_CW / 2, v = ad.v;
  c.save(); c.shadowColor = AYA.shadow; c.shadowBlur = 22; c.shadowOffsetY = 5; c.fillStyle = AYA.card; box(c, x, AYA_CY, AYA_CW, AYA_CH, 30); c.fill(); c.restore();
  if (AYA.cardLine) { c.save(); c.strokeStyle = AYA.cardLine; c.lineWidth = 2.2; box(c, x + 1, AYA_CY + 1, AYA_CW - 2, AYA_CH - 2, 29); c.stroke(); c.restore(); }
  if (ayaArt.icons) c.drawImage(ayaArt.icons, i * 84, 0, 84, 74, cx - 42, 1364, 84, 74);
  PZS = v.fsL; adFitV(c, title, cx, 1441, 1480, AYA_CW - 24, 40, 700, AYA.cTitle, 'center');
  PZS = v.fsN; if (num) c.direction = 'ltr'; adFitV(c, val, cx, 1493, 1538, AYA_CW - 18, 48, 700, AYA.cVal, 'center'); c.direction = 'rtl';
  PZS = v.fsL; adFitV(c, sub, cx, 1545, AYA.subY2 || 1577, AYA_CW - 24, AYA.cSubPx || 28, 600, AYA.cSub || AYA.cTitle, 'center', FB);
}
function ayaDraw(c, v, p, at) {
  const plum = TH.ayaCol === 'plum'; AYA = plum ? AYA_PLUM : AYA_PINK;
  ayaArt.base = plum ? ayaArt.kbase : ayaArt.pbase; ayaArt.icons = plum ? ayaArt.kicons : ayaArt.picons;
  if (ayaArt.base) c.drawImage(ayaArt.base, 0, 0, AD_W, AD_H); else { c.fillStyle = '#F6E4E2'; c.fillRect(0, 0, AD_W, AD_H); }
  PZS = v.fsL; const o = v.o.map || [0, 0];
  c.save(); c.translate(o[0], o[1]); const m = ayaMap(c, p, 92, 812, 1416, 660, v); c.restore();
  if (!AYA.sharpTop) ayaFade(c, 806, 46, true); ayaFade(c, 1290, 184, false);
  ad.hits.push({ k: 'map', pan: 1, x: 92, y: 812, w: 1416, h: 535 });
  const sx = m.sx + o[0], K = (+v.pinK || 1) * (AYA.pinK || 1);
  const sy = m.sy + o[1];
  if (v.lab && (v.label1 || v.label2)) {   // an optional label beside the marker
    const lo = v.o.lab || [0, 0]; c.font = FD(700, 34); const tw = Math.max(c.measureText(v.label1 || '').width, (c.font = FB(600, 30), c.measureText(v.label2 || '').width));
    const bw = Math.min(600, tw + 50), bh = v.label1 && v.label2 ? 100 : 62; let bx = sx + 90 + lo[0]; const by = sy - 250 + lo[1]; if (bx + bw > 1490) bx = sx - 90 - bw + lo[0];
    c.fillStyle = AYA.labBg; box(c, bx, by, bw, bh, 14); c.fill();
    if (v.label1) adFitV(c, v.label1, bx + bw / 2, by + 8, by + (v.label2 ? 52 : bh - 8), bw - 26, 34, 700, '#fff', 'center');
    if (v.label2) adFitV(c, v.label2, bx + bw / 2, by + (v.label1 ? 54 : 8), by + bh - 8, bw - 26, 30, 600, '#fff', 'center', FB);
    ad.hits.push({ k: 'lab', x: bx, y: by, w: bw, h: bh });
  }
  if (v.pin) ayaPin(c, sx, m.top + o[1] - 4, K);
  const pr = priceOf(p), n = pr ? pr.inst.length : 0;
  at('cards', AYA_CARDS[0], AYA_CY, AYA_CARDS[4] + AYA_CW - AYA_CARDS[0], AYA_CH, () => {
    ayaCard(c, 0, 'التصريح', v.a_use, v.a_fl);
    ayaCard(c, 1, 'المساحة', v.area, 'قدم مربع', 1);
    if (AYA.downCard) { if (v.mode === 'inst') ayaCard(c, 2, 'دفعة أولى', v.down, v.a_ds || 'درهم فقط', 1); else ayaCard(c, 2, 'الدفع', v.a_cV || 'كاش', v.a_cS || 'دفعة واحدة'); }
    else ayaCard(c, 2, 'الموقع', v.a_loc, v.a_city);
    ayaCard(c, 3, 'السعر', v.price, v.a_ps, 1);
    if (v.mode === 'inst') ayaCard(c, 4, v.a_iT || (n ? n + ' أقساط' : 'أقساط'), v.until, v.a_iS); else ayaCard(c, 4, v.a_cT, v.a_cV, v.a_cS);
  });
  PZS = v.fsT;
  at('kick', 420, 268, 760, 76, () => {
    const px = adFitV(c, v.a_kick, 800, 280, 336, 640, 42, 800, AYA.kick, 'center'); if (!v.a_kick) return;
    c.font = FD(800, px); const w = c.measureText(v.a_kick).width; c.strokeStyle = AYA.kick; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(800 - w / 2 - 20, 309); c.lineTo(800 - w / 2 - 70, 309); c.moveTo(800 + w / 2 + 20, 309); c.lineTo(800 + w / 2 + 70, 309); c.stroke();
  });
  at('title', 400, 348, 800, 126, () => adFitV(c, v.a_title, 800, 352, 472, 780, 96, AYA.titleW || 800, AYA.title, 'center'));
  at('proj', 400, 494, 800, 162, () => adFitV(c, v.proj, 800, 498, 654, 790, 150, 800, AYA.proj, 'center'));
  if (AYA.subBig) at('sub', 260, 676, 1080, 100, () => adFitV(c, v.sub, 800, 680, 772, 1070, 84, 700, AYA.sub, 'center'));
  else at('sub', 352, 700, 896, 92, () => adFitV(c, v.sub, 800, 710, 786, 890, 72, 700, AYA.sub, 'center'));
  PZS = v.fsC;
  { const dy = AYA.tagDy || 0, dx = AYA.tagDx || 0; at('more', 560 + dx, 1650 + dy, 480, 72, () => adFitV(c, v.a_tag, 800 + dx, 1662 + dy, 1712 + dy, 396, 46, 500, AYA.tag, 'center', FB)); }
  const by = AYA.barDy || 0;   // the plum bar sits a little higher than the pink one
  at('bar', 330, 1748 + by, 1000, 158, () => {
    adFitV(c, v.a_clbl, 542, 1772 + by, 1802 + by, 300, 28, 600, AYA.addr, 'center', FB);
    c.direction = 'ltr'; adFitV(c, v.phone, 542, 1816 + by, 1890 + by, 330, 66, 800, AYA.phone, 'center'); c.direction = 'rtl';
    const L = String(v.a_addr || '').split('\n').filter(Boolean).slice(0, 2);
    if (L.length === 1) adFitV(c, L[0], 1100, 1808 + by, 1860 + by, 380, 38, 700, AYA.addr, 'center', FB);
    else L.forEach((t, i) => adFitV(c, t, 1100, (i ? 1838 : 1792) + by, (i ? 1874 : 1830) + by, 380, 36, 700, AYA.addr, 'center', FB));
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
  if (v.o_p3) at('pfeat', 120, 1512, 700, 72, () => {
    c.font = FO(800, 50); const w = Math.min(1100, c.measureText(v.o_p3).width + 60);
    c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 120, 1512, w, 72, 18); c.fill(); c.restore();
    adFitV(c, v.o_p3, 120 + w / 2, 1519, 1577, w - 30, 50, 800, '#111111', 'center', FO);
  });
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
const OY_PARTS = [['proj', 'اسم المشروع (المربع الأسود)'], ['area', 'المساحة (المربع الأزرق)'], ['use', 'الاستخدام (المربع الأحمر)'], ['price', 'السعر (الشريط البنفسجي)'], ['pills', 'السطران الأبيضان'], ['pfeat', 'مميزات الأرض'], ['flag', 'خريطة الإمارات'], ['logo', 'شعار الشركة']];
const OY_FIELDS = [
  ['o_proj', 'اسم المشروع (المربع الأسود)'], ['o_area', 'المساحة (المربع الأزرق)'], ['o_use1', 'الاستخدام · السطر الأول (المربع الأحمر)'], ['o_use2', 'الاستخدام · السطر الثاني (مثلًا: G + 2)'],
  ['o_priceC', 'السعر (الشريط البنفسجي)', 'cash'], ['o_priceI', 'السعر (الشريط البنفسجي)', 'inst'], ['o_p1', 'السطر الأبيض الأول (جاهزة للبناء…)'], ['o_p2', 'السطر الأبيض الثاني (التملّك)'], ['o_p3', 'مميزات الأرض (فوق السعر)'],
];
/* «قالب واتس أب» (4:3, management only): kicker, the project in big letters, a ribbon, the plan with a ring and an arrow on the
   plot, three cards (area · permit · price) and the ownership line — in three colour sets */
const WA_COLS = {
  gold: { name: 'ذهبي', bg: ['#FBF8F3', '#EFE8DD'], corner: '#3B3B3D', ink: '#2A2A2C', rib: ['#A87A35', '#E3C47E', '#A87A35'], ribText: '#FFFFFF', card: '#EEE7DC', cardInk: '#2A2A2C', icon: '#3B3B3D', hot: '#C42F2B', hotInk: '#FFFFFF', foot: '#3B3B3D', footInk: '#E9CB86', frame: '#FFFFFF' },
  navy: { name: 'كحلي', bg: ['#F7F8FB', '#E6EAF2'], corner: '#0E1C36', ink: '#0E1C36', rib: ['#0E1C36', '#25386A', '#0E1C36'], ribText: '#E6C77F', card: '#E9EDF5', cardInk: '#0E1C36', icon: '#C9A14A', hot: '#0E1C36', hotInk: '#FFFFFF', foot: '#C9A14A', footInk: '#0E1C36', frame: '#FFFFFF' },
  teal: { name: 'أخضر', bg: ['#F5FAF9', '#E2EEEC'], corner: '#0B4F4C', ink: '#0B3B39', rib: ['#0B5F5B', '#2A9C96', '#0B5F5B'], ribText: '#FFFFFF', card: '#E3EFED', cardInk: '#0B3B39', icon: '#0B5F5B', hot: '#D08A2E', hotInk: '#FFFFFF', foot: '#0B4F4C', footInk: '#F1D08C', frame: '#FFFFFF' },
};
function waArrow(c, tx, ty, K) {   // a thick black arrow coming up from below, its tip at (tx, ty)
  c.save(); c.translate(tx, ty); c.rotate(Math.PI / 2 - 0.22); c.scale(K, K);
  const L = 230, hw = 46, hl = 86, sw = 18;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(hl, -hw); c.lineTo(hl, -sw); c.lineTo(L, -sw); c.lineTo(L, sw); c.lineTo(hl, sw); c.lineTo(hl, hw); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = '#FFFFFF'; c.stroke(); c.fillStyle = '#000000'; c.fill();
  c.restore();
}
function waIcon(c, kind, cx, cy, col) {
  c.save(); c.strokeStyle = col; c.lineWidth = 5; c.lineJoin = c.lineCap = 'round'; c.beginPath();
  if (kind === 'cube') {   // a box drawn in lines, like the area icon of the design
    const r = 44, h = r * 0.5;
    c.moveTo(cx, cy - r); c.lineTo(cx + r, cy - h); c.lineTo(cx + r, cy + h); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy + h); c.lineTo(cx - r, cy - h); c.closePath();
    c.moveTo(cx - r, cy - h); c.lineTo(cx, cy); c.lineTo(cx + r, cy - h); c.moveTo(cx, cy); c.lineTo(cx, cy + r);
    c.stroke(); c.lineWidth = 3; c.setLineDash([6, 7]); c.beginPath(); c.moveTo(cx - r - 14, cy - h + 8); c.lineTo(cx - r - 14, cy + h + 8); c.moveTo(cx + r + 14, cy - h + 8); c.lineTo(cx + r + 14, cy + h + 8); c.stroke();
  } else {   // two buildings
    c.rect(cx - 40, cy - 46, 46, 92); c.rect(cx + 6, cy - 14, 34, 60); c.stroke(); c.beginPath();
    for (let i = 0; i < 4; i++) { c.moveTo(cx - 28, cy - 30 + i * 20); c.lineTo(cx - 6, cy - 30 + i * 20); }
    c.moveTo(cx + 16, cy + 4); c.lineTo(cx + 30, cy + 4); c.moveTo(cx + 16, cy + 22); c.lineTo(cx + 30, cy + 22); c.stroke();
  }
  c.restore();
}
function waDraw(c, v, p, at) {
  const C = WA_COLS[v.wCol] || WA_COLS.gold, W = AD_W, H = AD_H;
  { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg[0]); g.addColorStop(1, C.bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  c.fillStyle = C.corner;   // the two dark corner cuts of the design
  c.beginPath(); c.moveTo(0, 0); c.lineTo(250, 0); c.lineTo(0, 150); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(W, 0); c.lineTo(W - 250, 0); c.lineTo(W, 150); c.closePath(); c.fill();
  c.globalAlpha = 0.18; c.beginPath(); c.moveTo(0, 0); c.lineTo(330, 0); c.lineTo(0, 220); c.closePath(); c.fill(); c.beginPath(); c.moveTo(W, 0); c.lineTo(W - 330, 0); c.lineTo(W, 220); c.closePath(); c.fill(); c.globalAlpha = 1;
  // the plan, with a ring and an arrow on the plot
  const MX = 44, MY = 452, MW = 960, MH = 600;
  { const o = v.o.map || [0, 0];
    c.save(); c.translate(o[0], o[1]);
    c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 22; c.shadowOffsetY = 6; c.fillStyle = C.frame; box(c, MX - 12, MY - 12, MW + 24, MH + 24, 30); c.fill(); c.restore();
    const k = 2.4 * (+v.zoom || 1), x0 = p.c[0] - MW / 2 / k - (+v.mx || 0) / k, y0 = p.c[1] - MH * 0.42 / k - (+v.my || 0) / k;
    c.save(); box(c, MX, MY, MW, MH, 20); c.clip(); c.fillStyle = '#EDE6D6'; c.fillRect(MX, MY, MW, MH);
    c.translate(MX, MY); c.scale(k, k); c.translate(-x0, -y0); drawPlan(c, x0, y0, x0 + MW / k, y0 + MH / k, k); c.restore();
    const sx = MX + (p.c[0] - x0) * k, sy = MY + (p.c[1] - y0) * k;
    let rr = 0; (p.p || []).forEach((q) => { rr = Math.max(rr, Math.hypot((q[0] - p.c[0]) * k, (q[1] - p.c[1]) * k)); });
    const K = +v.pinK || 1, R = Math.max(34, rr + 12) * K;
    if (v.pin) { c.save(); box(c, MX, MY, MW, MH, 20); c.clip(); c.lineWidth = 8 * K; c.strokeStyle = '#E0040B'; c.beginPath(); c.arc(sx, sy, R, 0, 7); c.stroke(); waArrow(c, sx + R * 0.2, sy + R + 8, K); c.restore(); }
    c.restore(); ad.hits.push({ k: 'map', pan: 1, x: MX + o[0], y: MY + o[1], w: MW, h: MH }); }
  PZS = v.fsL; at('kick', 300, 22, 1000, 96, () => adFitV(c, v.w_kick, 800, 28, 112, 980, 74, 700, C.ink, 'center'));
  PZS = v.fsT; at('proj', 300, 112, 1000, 210, () => {
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 14; c.shadowOffsetY = 6; adFitV(c, v.w_proj, 800, 118, 318, 1000, 230, 800, C.ink, 'center'); c.restore();
  });
  PZS = v.fsL; at('rib', 400, 330, 800, 100, () => {
    c.font = FD(800, 54); const w = Math.max(560, Math.min(1100, c.measureText(v.w_rib || '').width + 120)), x = 800 - w / 2;
    const g = c.createLinearGradient(x, 0, x + w, 0); C.rib.forEach((col, i) => g.addColorStop(i / (C.rib.length - 1), col));
    c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 12; c.shadowOffsetY = 4; c.fillStyle = g; box(c, x, 336, w, 92, 46); c.fill(); c.restore();
    adFitV(c, v.w_rib, 800, 346, 420, w - 70, 54, 800, C.ribText, 'center');
  });
  const card = (y, h, fill) => { c.save(); c.shadowColor = 'rgba(0,0,0,.12)'; c.shadowBlur = 14; c.shadowOffsetY = 4; c.fillStyle = fill; box(c, 1040, y, 520, h, 26); c.fill(); c.restore(); };
  at('c1', 1040, 452, 520, 180, () => {
    card(452, 180, C.card); waIcon(c, 'cube', 1128, 542, C.icon); c.fillStyle = C.icon; c.fillRect(1206, 482, 4, 120);
    PZS = v.fsL; adFitV(c, v.w_c1t, 1530, 470, 534, 300, 48, 700, C.cardInk, 'right');
    PZS = v.fsN; c.direction = 'ltr'; const px = adFitV(c, v.w_area, 1530, 538, 616, 220, 80, 800, C.cardInk, 'right'); c.font = FD(800, px); const nw = c.measureText(v.w_area || '').width; c.direction = 'rtl';
    PZS = v.fsL; adFitV(c, v.w_unit, 1530 - nw - 14, 558, 610, 300 - nw, 36, 600, C.cardInk, 'right');
  });
  at('c2', 1040, 652, 520, 170, () => {
    card(652, 170, C.card); waIcon(c, 'bld', 1128, 737, C.icon); c.fillStyle = C.icon; c.fillRect(1206, 680, 4, 114);
    PZS = v.fsL; adFitV(c, v.w_c2t, 1530, 672, 740, 310, 50, 700, C.cardInk, 'right');
    adFitV(c, v.w_c2s, 1380, 744, 804, 310, 40, 600, C.cardInk, 'center');
  });
  at('c3', 1040, 842, 520, 222, () => {
    card(842, 222, C.hot);
    PZS = v.fsL; adFitV(c, v.mode === 'inst' ? v.w_c3tI : v.w_c3t, 1300, 856, 920, 470, 50, 700, C.hotInk, 'center');
    PZS = v.fsN; c.direction = 'ltr'; adFitV(c, v.w_price, 1300, 918, 1018, 480, 112, 800, C.hotInk, 'center'); c.direction = 'rtl';
    PZS = v.fsL; adFitV(c, v.w_cur, 1300, 1016, 1058, 470, 38, 600, C.hotInk, 'center');
  });
  PZS = v.fsC; at('own', 250, 1088, 1100, 96, () => {
    c.save(); c.shadowColor = 'rgba(0,0,0,.2)'; c.shadowBlur = 12; c.shadowOffsetY = 4; c.fillStyle = C.foot; box(c, 250, 1092, 1100, 88, 44); c.fill(); c.restore();
    adFitV(c, v.w_own, 800, 1100, 1172, 1020, 52, 800, C.footInk, 'center');
  });
  PZS = 1;
  const lg = PZ_THEMES.co.logo;
  if (v.wLogo && lg && lg.naturalWidth) at('logo', 1360, 150, 200, 168, () => {
    c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 12; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 1360, 150, 200, 168, 22); c.fill(); c.restore();
    const h = 150, w = h * lg.naturalWidth / lg.naturalHeight; c.drawImage(lg, 1360 + (200 - w) / 2, 159, w, h);
  });
}
const WA_PARTS = [['kick', 'السطر العلوي'], ['proj', 'اسم المشروع'], ['rib', 'الشريط الذهبي'], ['map', 'المخطط'], ['c1', 'بطاقة المساحة'], ['c2', 'بطاقة التصريح'], ['c3', 'بطاقة السعر'], ['own', 'شريط التملّك'], ['logo', 'الشعار']];
const WA_FIELDS = [
  ['w_kick', 'السطر العلوي'], ['w_proj', 'اسم المشروع (الكبير)'], ['w_rib', 'الشريط تحت اسم المشروع'],
  ['w_c1t', 'بطاقة المساحة · العنوان'], ['w_area', 'المساحة (الرقم)'], ['w_unit', 'وحدة المساحة'],
  ['w_c2t', 'بطاقة التصريح · العنوان'], ['w_c2s', 'بطاقة التصريح · السطر الثاني'],
  ['w_c3t', 'بطاقة السعر · العنوان', 'cash'], ['w_c3tI', 'بطاقة السعر · العنوان', 'inst'], ['w_price', 'السعر (الرقم)'], ['w_cur', 'تحت السعر'], ['w_own', 'شريط التملّك (أسفل)'],
];
/* «قالب لين واتس أب» (4:3) and «قالب لين إنستجرام» (4:5), management only: a rose panel with the advertiser's portrait, her WhatsApp
   number and the price; on the right the project, the plan with a rose ring and a pin on the plot, area / permit cards and
   the ownership line — in the colours of her photo (rose, ivory, gold, espresso) */
const WR = { bg: ['#F8F3EE', '#EDE2D8'], rose: '#B25858', deep: '#8A3D44', blush: '#F2D3CE', ivory: '#F8F3EE', gold: '#D2AE72', ink: '#41322B', soft: '#7A5F57' };
const WA_GLYPH = typeof Path2D === 'function' ? new Path2D('M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z') : null;
function wrDiamond(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); }
function wrPin(c, x, y, K) {   // a rose teardrop pin standing on the plot, tip at (x, y)
  c.save(); c.translate(x, y); c.scale(K, K);
  c.shadowColor = 'rgba(70,25,30,.35)'; c.shadowBlur = 12; c.shadowOffsetY = 5;
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-14, -30, -46, -52, -46, -86); c.arc(0, -86, 46, Math.PI, 0); c.bezierCurveTo(46, -52, 14, -30, 0, 0); c.closePath();
  const g = c.createLinearGradient(0, -132, 0, 0); g.addColorStop(0, WR.rose); g.addColorStop(1, WR.deep); c.fillStyle = g; c.fill();
  c.shadowColor = 'transparent'; c.lineWidth = 5; c.strokeStyle = WR.ivory; c.stroke();
  c.fillStyle = WR.ivory; c.beginPath(); c.arc(0, -86, 18, 0, 7); c.fill(); wrDiamond(c, 0, -86, 9, WR.gold);
  c.restore();
}
function wrPanel(c, x, y, w, h, cx, cy) {   // the rose panel with faint rings around (cx, cy) and a thin gold inner line
  c.save(); c.shadowColor = 'rgba(90,35,40,.28)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#BE6464'); g.addColorStop(1, WR.deep); c.fillStyle = g; box(c, x, y, w, h, 56); c.fill(); c.restore();
  c.save(); box(c, x, y, w, h, 56); c.clip(); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2;
  for (let r = 240; r < 1000; r += 46) { c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(210,174,114,.8)'; c.lineWidth = 2; box(c, x + 18, y + 18, w - 36, h - 36, 44); c.stroke();
}
function wrAvatar(c, v, at, cx, cy, r) {   // her portrait in an ivory ring with a gold line and two gold diamonds
  if (v.wAv === false || !ayaArt.wrAv) return;
  at('avatar', cx - r - 26, cy - r - 26, 2 * r + 52, 2 * r + 52, () => {
    c.save(); c.shadowColor = 'rgba(50,15,20,.35)'; c.shadowBlur = 26; c.shadowOffsetY = 8; c.fillStyle = WR.ivory; c.beginPath(); c.arc(cx, cy, r + 14, 0, 7); c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); c.drawImage(ayaArt.wrAv, cx - r, cy - r, 2 * r, 2 * r); c.restore();
    c.strokeStyle = WR.gold; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r + 22, 0, 7); c.stroke();
    wrDiamond(c, cx, cy - r - 22, 11, WR.gold); wrDiamond(c, cx, cy + r + 22, 11, WR.gold);
  });
}
function wrWho(c, v, at, cx, y, w, ink, sub) {
  PZS = v.fsL; at('who', cx - w / 2, y, w, 110, () => {
    adFitV(c, v.w_name, cx, y + 2, y + 60, w - 20, 50, 800, ink, 'center');
    adFitV(c, v.w_nameS, cx, y + 64, y + 108, w - 40, 34, 500, sub, 'center');
  });
}
function wrPhone(c, v, at, cx, y, w) {
  PZS = v.fsC; if (!v.w_phone) return;
  const x = cx - w / 2;
  at('wa', x, y, w, 96, () => {
    c.save(); c.shadowColor = 'rgba(50,15,20,.3)'; c.shadowBlur = 14; c.shadowOffsetY = 5; c.fillStyle = WR.ivory; box(c, x, y, w, 96, 48); c.fill(); c.restore();
    c.fillStyle = WR.rose; c.beginPath(); c.arc(x + 48, y + 48, 38, 0, 7); c.fill();
    if (WA_GLYPH) { c.save(); c.translate(x + 48 - 27, y + 48 - 27); c.scale(54 / 24, 54 / 24); c.fillStyle = '#FFFFFF'; c.fill(WA_GLYPH); c.restore(); }
    c.direction = 'ltr'; adFitV(c, v.w_phone, x + 96 + (w - 96) / 2 - 8, y + 14, y + 84, w - 140, 58, 800, WR.deep, 'center'); c.direction = 'rtl';
  });
}
function wrPrice(c, v, at, cx, y, w) {
  at('price', cx - w / 2, y, w, 214, () => {
    c.fillStyle = 'rgba(242,211,206,.45)'; c.fillRect(cx - w * 0.38, y + 6, w * 0.76, 2); wrDiamond(c, cx, y + 7, 8, WR.gold);
    PZS = v.fsL; adFitV(c, v.mode === 'inst' ? v.w_c3tI : v.w_c3t, cx, y + 24, y + 74, w - 40, 40, 700, WR.blush, 'center');
    PZS = v.fsN; c.direction = isLatin(v.w_price) ? 'ltr' : 'rtl'; adFitV(c, v.w_price, cx, y + 74, y + 166, w - 20, 100, 800, '#FFFFFF', 'center'); c.direction = 'rtl';
    PZS = v.fsL; adFitV(c, v.w_cur, cx, y + 168, y + 206, w - 40, 32, 600, WR.blush, 'center');
  });
}
function wrHead(c, v, at, R, w, y) {   // kicker pill, the project in big letters, the gold line — right-aligned at R
  PZS = v.fsL; at('kick', R - Math.min(w, 620), y, Math.min(w, 620), 64, () => {
    c.font = FD(700, Math.round(38 * PZS)); const pw = Math.min(620, c.measureText(v.w_kick || '').width + 76);
    c.fillStyle = WR.blush; box(c, R - pw, y, pw, 64, 32); c.fill();
    wrDiamond(c, R - pw + 30, y + 32, 8, WR.rose);
    adFitV(c, v.w_kick, R - 26, y + 6, y + 58, pw - 76, 38, 700, WR.deep, 'right');
  });
  PZS = v.fsT; at('proj', R - w, y + 74, w, 160, () => adFitV(c, v.w_proj, R, y + 78, y + 228, w, 128, 800, WR.ink, 'right'));
  PZS = v.fsL; at('rib', R - w, y + 238, w, 60, () => {
    wrDiamond(c, R - 12, y + 268, 11, WR.gold);
    const px = adFitV(c, v.w_rib, R - 36, y + 242, y + 294, w - 300, 40, 700, WR.rose, 'right'); c.font = FD(700, px);
    const x = R - 36 - c.measureText(v.w_rib || '').width - 28, L = R - w;
    if (x > L + 40) { const g = c.createLinearGradient(L, 0, x, 0); g.addColorStop(0, 'rgba(210,174,114,0)'); g.addColorStop(1, WR.gold); c.fillStyle = g; c.fillRect(L, y + 267, x - L, 3); }
  });
}
function wrPlan(c, v, p, MX, MY, MW, MH) {   // the plan, with a rose ring and a pin on the plot
  const o = v.o.map || [0, 0];
  c.save(); c.translate(o[0], o[1]);
  c.save(); c.shadowColor = 'rgba(90,40,40,.22)'; c.shadowBlur = 26; c.shadowOffsetY = 8; c.fillStyle = '#FFFFFF'; box(c, MX - 12, MY - 12, MW + 24, MH + 24, 44); c.fill(); c.restore();
  const k = 2.4 * (+v.zoom || 1), x0 = p.c[0] - MW / 2 / k - (+v.mx || 0) / k, y0 = p.c[1] - MH * 0.55 / k - (+v.my || 0) / k;
  c.save(); box(c, MX, MY, MW, MH, 34); c.clip(); c.fillStyle = '#F1E8DF'; c.fillRect(MX, MY, MW, MH);
  c.translate(MX, MY); c.scale(k, k); c.translate(-x0, -y0); drawPlan(c, x0, y0, x0 + MW / k, y0 + MH / k, k); c.restore();
  const sx = MX + (p.c[0] - x0) * k, sy = MY + (p.c[1] - y0) * k;
  let rr = 0; (p.p || []).forEach((q) => { rr = Math.max(rr, Math.hypot((q[0] - p.c[0]) * k, (q[1] - p.c[1]) * k)); });
  const K = +v.pinK || 1, R = Math.max(34, rr + 12) * K;
  if (v.pin) {
    c.save(); box(c, MX, MY, MW, MH, 34); c.clip();
    c.fillStyle = 'rgba(178,88,88,.16)'; c.beginPath(); c.arc(sx, sy, R + 18 * K, 0, 7); c.fill();
    c.lineWidth = 8 * K; c.strokeStyle = WR.rose; c.beginPath(); c.arc(sx, sy, R, 0, 7); c.stroke();
    c.lineWidth = 3 * K; c.strokeStyle = WR.ivory; c.setLineDash([10 * K, 10 * K]); c.beginPath(); c.arc(sx, sy, R + 12 * K, 0, 7); c.stroke(); c.setLineDash([]);
    wrPin(c, sx, sy - R + 6 * K, K); c.restore();
  }
  c.strokeStyle = 'rgba(210,174,114,.7)'; c.lineWidth = 2; box(c, MX - 4, MY - 4, MW + 8, MH + 8, 38); c.stroke();
  c.restore(); ad.hits.push({ k: 'map', pan: 1, x: MX + o[0], y: MY + o[1], w: MW, h: MH });
}
function wrCard(c, v, at, k, x, y, w, kind, t, val, unit) {   // a white card: rose badge with an icon on the right, title and value
  at(k, x, y, w, 136, () => {
    c.save(); c.shadowColor = 'rgba(90,40,40,.14)'; c.shadowBlur = 18; c.shadowOffsetY = 5; c.fillStyle = '#FFFFFF'; box(c, x, y, w, 136, 34); c.fill(); c.restore();
    c.fillStyle = WR.rose; box(c, x + w - 10, y + 24, 10, 88, 5); c.fill();
    c.fillStyle = WR.blush; c.beginPath(); c.arc(x + w - 80, y + 68, 48, 0, 7); c.fill();
    c.save(); c.translate(x + w - 80, y + 68); c.scale(0.72, 0.72); waIcon(c, kind, 0, 0, WR.deep); c.restore();
    const R = x + w - 148, tw = w - 180;
    PZS = v.fsL; adFitV(c, t, R, y + 16, y + 60, tw, 34, 600, WR.soft, 'right');
    if (unit) {
      PZS = v.fsN; c.direction = 'ltr'; const px = adFitV(c, val, R, y + 60, y + 122, tw - 120, 58, 800, WR.ink, 'right'); c.font = FD(800, px); const nw = c.measureText(val || '').width; c.direction = 'rtl';
      PZS = v.fsL; adFitV(c, unit, R - nw - 12, y + 76, y + 118, tw - nw - 12, 30, 600, WR.soft, 'right');
    } else { PZS = v.fsL; adFitV(c, val, R, y + 60, y + 122, tw, 46, 800, WR.ink, 'right'); }
  });
}
function wrOwn(c, v, at, cx, y, w) {
  PZS = v.fsC; at('own', cx - w / 2, y, w, 70, () => {
    const px = adFitV(c, v.w_own, cx, y + 4, y + 60, w - 140, 40, 700, WR.ink, 'center'); c.font = FD(700, px);
    const hw = c.measureText(v.w_own || '').width / 2 + 30; if (v.w_own) { wrDiamond(c, cx - hw, y + 34, 9, WR.gold); wrDiamond(c, cx + hw, y + 34, 9, WR.gold); }
  });
}
function wrDraw(c, v, p, at) {
  const W = AD_W, H = AD_H, tall = H > W;   // «قالب لين واتس أب» (4:3) or «قالب لين إنستجرام» (4:5)
  { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, WR.bg[0]); g.addColorStop(1, WR.bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  c.fillStyle = 'rgba(242,211,206,.55)'; c.beginPath(); c.arc(W + 40, -40, 330, 0, 7); c.fill();
  c.fillStyle = 'rgba(242,211,206,.35)'; c.beginPath(); c.arc(tall ? -60 : W - 120, tall ? 1380 : H + 80, 230, 0, 7); c.fill();
  c.strokeStyle = 'rgba(210,174,114,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(W + 40, -40, 380, 0, 7); c.stroke();
  if (!tall) {
    wrPanel(c, 40, 40, 540, 1120, 310, 330);
    wrAvatar(c, v, at, 310, 318, 200);
    wrWho(c, v, at, 310, 572, 480, '#FFFFFF', WR.blush);
    wrPhone(c, v, at, 310, 712, 452);
    wrPrice(c, v, at, 310, 852, 480);
    wrHead(c, v, at, 1560, 940, 62);
    wrPlan(c, v, p, 620, 384, 940, 516);
    wrCard(c, v, at, 'c1', 1100, 934, 460, 'cube', v.w_c1t, v.w_area, v.w_unit);
    wrCard(c, v, at, 'c2', 620, 934, 460, 'bld', v.w_c2t, v.w_c2s, '');
    wrOwn(c, v, at, 1090, 1090, 940);
  } else {
    wrAvatar(c, v, at, 290, 290, 196);
    wrHead(c, v, at, 1540, 960, 92);
    wrPlan(c, v, p, 60, 560, 1480, 720);
    wrCard(c, v, at, 'c1', 820, 1316, 720, 'cube', v.w_c1t, v.w_area, v.w_unit);
    wrCard(c, v, at, 'c2', 60, 1316, 720, 'bld', v.w_c2t, v.w_c2s, '');
    wrOwn(c, v, at, 800, 1474, 1400);
    wrPanel(c, 40, 1570, 1520, 390, 800, 1765);
    c.fillStyle = 'rgba(210,174,114,.7)'; c.fillRect(799, 1620, 2, 290); wrDiamond(c, 800, 1765, 9, WR.gold);
    wrPrice(c, v, at, 1180, 1648, 680);
    wrWho(c, v, at, 420, 1630, 680, '#FFFFFF', WR.blush);
    wrPhone(c, v, at, 420, 1792, 560);
  }
  PZS = 1;
}
const WR_PARTS = [['avatar', 'صورة المعلنة'], ['who', 'الاسم تحت الصورة'], ['wa', 'رقم الواتساب'], ['price', 'السعر'], ['kick', 'السطر العلوي'], ['proj', 'اسم المشروع'], ['rib', 'السطر الذهبي'], ['map', 'المخطط'], ['c1', 'بطاقة المساحة'], ['c2', 'بطاقة التصريح'], ['own', 'سطر التملّك']];
const WR_FIELDS = [
  ['w_kick', 'السطر العلوي'], ['w_proj', 'اسم المشروع (الكبير)'], ['w_rib', 'السطر تحت اسم المشروع'],
  ['w_name', 'الاسم تحت الصورة'], ['w_nameS', 'السطر تحت الاسم'], ['w_phone', 'رقم الواتساب (فارغ = يختفي)'],
  ['w_c1t', 'بطاقة المساحة · العنوان'], ['w_area', 'المساحة (الرقم)'], ['w_unit', 'وحدة المساحة'],
  ['w_c2t', 'بطاقة التصريح · العنوان'], ['w_c2s', 'بطاقة التصريح · القيمة'],
  ['w_c3t', 'السعر · العنوان', 'cash'], ['w_c3tI', 'السعر · العنوان', 'inst'], ['w_price', 'السعر (الرقم)'], ['w_cur', 'تحت السعر'], ['w_own', 'سطر التملّك (أسفل)'],
];
/* «لين واتس أب · إعلان عام» (4:3, management only): her panel on the left; «مطلوب — شراء، بيع، وساطة» and the twelve areas
   on the right, in five tile styles, over a faint city skyline — every word drawn here, so every area name is exact and editable */
const WG_AREAS = ['المطرق', 'السحمة', 'روضة القرط', 'مزيرعة', 'القاسمية', 'بساتين الزبير', 'البليدة', 'الحوشي', 'الطي شرق', 'الرقيبة', 'الصجعة', 'الطي غرب'];   // row by row, right to left
const WG_STYLES = [['map', 'بطاقات بأيقونة'], ['line', 'إطار وردي'], ['slant', 'مائلة بلونين'], ['gold', 'إطار ذهبي'], ['rose', 'وردي كامل']];
function wgSkyline(c, x0, x1, base) {   // a soft city skyline with its reflection, fading into the background
  c.save(); let x = x0, i = 0;
  const hs = [60, 96, 74, 130, 88, 170, 104, 70, 150, 116, 300, 124, 82, 142, 98, 66, 126, 90, 166, 78, 108, 62];
  while (x < x1) {
    const h = hs[i % hs.length], w = 16 + (i * 11) % 26;
    c.fillStyle = 'rgba(178,130,120,.09)'; c.fillRect(x, base - h, w, h);
    if (h > 300) { c.beginPath(); c.moveTo(x + w / 2 - 3, base - h); c.lineTo(x + w / 2, base - h - 70); c.lineTo(x + w / 2 + 3, base - h); c.fill(); }
    c.fillStyle = 'rgba(178,130,120,.05)'; c.fillRect(x, base + 4, w, h * 0.4);
    c.fillStyle = 'rgba(232,190,120,.35)'; for (let k = 0; k < 3; k++) c.fillRect(x + 5 + k * 6, base - h * (0.3 + k * 0.17), 3, 3);
    x += w + 3 + (i * 5) % 9; i++;
  }
  const g = c.createLinearGradient(0, base - 340, 0, base + 160); g.addColorStop(0, 'rgba(245,238,231,0)'); g.addColorStop(0.75, 'rgba(245,238,231,.15)'); g.addColorStop(1, 'rgba(240,230,222,.95)');
  c.fillStyle = g; c.fillRect(x0, base - 420, x1 - x0, 600); c.restore();
}
function wgPinIcon(c, cx, cy, s, col, bg) {   // a folded map with a pin, for the «بطاقات بأيقونة» style
  c.save(); c.translate(cx, cy); c.scale(s, s); c.strokeStyle = col; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-26, 4); c.lineTo(-10, -2); c.lineTo(8, 4); c.lineTo(26, -2); c.lineTo(26, 22); c.lineTo(8, 28); c.lineTo(-10, 22); c.lineTo(-26, 28); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(-10, -2); c.lineTo(-10, 22); c.moveTo(8, 4); c.lineTo(8, 28); c.stroke();
  c.fillStyle = WR.gold; c.beginPath(); c.moveTo(0, 14); c.bezierCurveTo(-6, 4, -14, -4, -14, -14); c.arc(0, -14, 14, Math.PI, 0); c.bezierCurveTo(14, -4, 6, 4, 0, 14); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(0, -14, 5.5, 0, 7); c.fill(); c.restore();
}
const wgTw = (st, w) => (st === 'map' ? w - 72 - 34 : st === 'slant' ? w - 112 : w - 40);   // the room each tile style leaves for its name
function wgTile(c, st, x, y, w, h, name, alt, px) {
  const sh = (a) => { c.shadowColor = 'rgba(110,40,45,' + a + ')'; c.shadowBlur = 14; c.shadowOffsetY = 5; };
  const rose = () => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#BC5A60'); g.addColorStop(1, '#842F37'); return g; };
  const cream = () => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#FFFDF9'); g.addColorStop(1, '#F3E7DA'); return g; };
  let ink = WR.deep, tx = x + w / 2; const tw = wgTw(st, w);
  c.save();
  if (st === 'map') {
    sh(0.18); c.fillStyle = cream(); box(c, x, y, w, h, 18); c.fill(); c.shadowColor = 'transparent';
    const bw = 72; c.save(); box(c, x, y, w, h, 18); c.clip(); c.fillStyle = rose(); c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w - bw, y); c.lineTo(x + w - bw - 26, y + h); c.lineTo(x + w, y + h); c.closePath(); c.fill(); c.restore();
    c.lineWidth = 4; c.strokeStyle = WR.gold; box(c, x + 2, y + 2, w - 4, h - 4, 16); c.stroke();
    wgPinIcon(c, x + w - 40, y + h / 2 + 2, 0.95, '#FFFFFF', '#9B4148');
    tx = x + (w - bw - 14) / 2;
  } else if (st === 'line') {
    sh(0.10); c.fillStyle = '#FFFBF7'; box(c, x, y, w, h, h / 2.6); c.fill(); c.shadowColor = 'transparent';
    c.lineWidth = 4; c.strokeStyle = '#8E3A42'; box(c, x + 2, y + 2, w - 4, h - 4, h / 2.6); c.stroke();
  } else if (st === 'slant') {
    const k = 22;
    c.beginPath(); c.moveTo(x + k * 2, y); c.lineTo(x + w, y); c.lineTo(x + w - k * 2, y + h); c.lineTo(x, y + h); c.closePath();
    sh(0.2); c.fillStyle = alt ? rose() : cream(); c.fill(); c.shadowColor = 'transparent';
    c.lineWidth = 3.5; c.strokeStyle = WR.gold; c.stroke();
    if (alt) ink = '#FFFFFF';
  } else if (st === 'gold') {
    const k = 16; c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k); c.closePath();
    sh(0.08); c.fillStyle = '#FFFBF5'; c.fill(); c.shadowColor = 'transparent';
    c.lineWidth = 3; c.strokeStyle = WR.gold; c.stroke();
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(210,174,114,.6)'; c.beginPath(); c.moveTo(x + k + 6, y + 7); c.lineTo(x + w - k - 6, y + 7); c.moveTo(x + k + 6, y + h - 7); c.lineTo(x + w - k - 6, y + h - 7); c.stroke();
  } else {   // rose
    sh(0.25); c.fillStyle = rose(); box(c, x, y, w, h, 20); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = 'rgba(255,255,255,.12)'; box(c, x + 6, y + 5, w - 12, h * 0.42, 16); c.fill();
    ink = '#FFFFFF';
  }
  c.restore();
  PZS = 1; adFitV(c, name, tx, y + 14, y + h - 12, tw, px, 800, ink, 'center');
}
function wgDraw(c, v, p, at) {
  const W = AD_W, H = AD_H;
  { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FAF4EF'); g.addColorStop(1, '#F1E6DE'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  wgSkyline(c, 600, W, 1130);
  wrPanel(c, 40, 40, 540, 1120, 310, 462);
  const lv = Object.assign({}, v, { w_name: v.g_name, w_nameS: v.g_nameS, w_phone: v.g_phone });
  wrAvatar(c, v, at, 310, 462, 196);
  wrWho(c, lv, at, 310, 720, 480, '#FFFFFF', WR.blush);
  wrPhone(c, lv, at, 310, 872, 452);
  const cx = 1088;
  PZS = v.fsL; at('kick', cx - 330, 48, 660, 72, () => {
    c.font = FD(700, Math.round(38 * PZS)); const w = Math.min(660, c.measureText(v.g_kick || '').width + 90);
    if (v.g_kick) { c.fillStyle = 'rgba(242,211,206,.75)'; box(c, cx - w / 2, 50, w, 70, 35); c.fill(); }
    adFitV(c, v.g_kick, cx, 56, 114, w - 60, 38, 700, WR.deep, 'center');
  });
  PZS = v.fsT; at('title', cx - 440, 132, 880, 170, () => {
    c.save(); c.shadowColor = 'rgba(90,20,25,.18)'; c.shadowBlur = 10; c.shadowOffsetY = 4; adFitV(c, v.g_title, cx, 134, 298, 860, 180, 800, '#5E1A21', 'center'); c.restore();
  });
  PZS = v.fsT; at('pill', cx - 380, 312, 760, 110, () => {
    c.save(); c.shadowColor = 'rgba(90,25,30,.3)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    const g = c.createLinearGradient(0, 314, 0, 420); g.addColorStop(0, '#C0646A'); g.addColorStop(1, '#8A3440'); c.fillStyle = g; box(c, cx - 375, 314, 750, 104, 52); c.fill(); c.restore();
    adFitV(c, v.g_pill, cx, 324, 410, 680, 72, 800, '#FFF7F2', 'center');
  });
  PZS = v.fsL; at('sub', cx - 470, 436, 940, 70, () => {
    const px = adFitV(c, v.g_sub, cx, 440, 502, 640, 50, 800, WR.ink, 'center'); c.font = FD(800, px);
    const hw = c.measureText(v.g_sub || '').width / 2 + 34;
    if (v.g_sub) { c.fillStyle = WR.gold; c.fillRect(cx - hw - 130, 470, 130, 3); c.fillRect(cx + hw, 470, 130, 3); }
  });
  const st = v.gSt || 'map', GX = 612, GW = 956, gap = 16, cw = (GW - gap * 2) / 3, ch = 98;
  at('grid', GX, 530, GW, 4 * ch + 3 * 24, () => {
    if (st === 'slant') {   // two gold sweeps around the slanted tiles
      c.save(); c.strokeStyle = WR.gold; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(GX - 8, 650); c.quadraticCurveTo(GX - 12, 512, GX + 280, 512); c.stroke();
      c.beginPath(); c.moveTo(GX + GW - 4, 900); c.quadraticCurveTo(GX + GW - 10, 1024, GX + GW - 420, 1022); c.stroke(); c.restore();
    }
    let px = Math.round(50 * (v.fsL || 1)); const tw = wgTw(st, cw);   // one size for all twelve names: the largest the longest one allows
    for (let i = 1; i <= 12; i++) { const n = v['g_a' + i]; if (!n) continue; for (;;) { c.font = FD(800, px); if (c.measureText(n).width <= tw || px <= 18) break; px -= 1; } }
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(i / 3), col = i % 3, x = GX + GW - (col + 1) * cw - col * gap, y = 530 + r * (ch + 24);
      wgTile(c, st, x, y, cw, ch, v['g_a' + (i + 1)], (r + col) % 2 === 1, px);
    }
  });
  PZS = 1;
}
const WG_PARTS = [['avatar', 'صورة المعلنة'], ['who', 'الاسم تحت الصورة'], ['wa', 'رقم الواتساب'], ['kick', 'السطر العلوي'], ['title', 'العنوان الكبير'], ['pill', 'الشريط الوردي'], ['sub', 'السطر فوق المناطق'], ['grid', 'المناطق']];
const WG_FIELDS = [['g_kick', 'السطر العلوي (فارغ = يختفي)'], ['g_title', 'العنوان الكبير'], ['g_pill', 'الشريط الوردي'], ['g_sub', 'السطر فوق المناطق'],
  ['g_name', 'الاسم تحت الصورة'], ['g_nameS', 'السطر تحت الاسم'], ['g_phone', 'رقم الواتساب (فارغ = يختفي)']]
  .concat(WG_AREAS.map((a, i) => ['g_a' + (i + 1), 'المنطقة ' + (i + 1)]));
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
  if (v.rLines) at('rlines', 40, 1318, 820, 190, () => {   // optional: who may own, and what the plot is near
    [[v.r_own, 1318], [v.r_feat, 1420]].forEach(([s, t]) => {
      if (!s) return; c.font = FO(800, 50); const w = Math.min(820, c.measureText(s).width + 60);
      c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.fillStyle = '#FFFFFF'; box(c, 40, t, w, 76, 18); c.fill(); c.restore();
      adFitV(c, s, 40 + w / 2, t + 8, t + 68, w - 30, 50, 800, '#111111', 'center', FO);
    });
  });
}
const AR_PARTS = [['proj', 'اسم المشروع (اللسان)'], ['rows', 'المساحة والتصريح والسعر'], ['arrow', 'السهم'], ['avatar', 'صورة المعلن'], ['rlines', 'سطرا التملّك والمميزات']];
const AR_FIELDS = [
  ['r_proj', 'اسم المشروع'], ['r_l1', 'عنوان السطر الأول'], ['r_area', 'المساحة'], ['r_l2', 'عنوان السطر الثاني'], ['r_use', 'تصريح الأرض (مثلًا: سكني  G + 2)'],
  ['r_l3', 'عنوان السطر الثالث'], ['r_priceC', 'السعر (الشريط الأحمر)', 'cash'], ['r_priceI', 'السعر (الشريط الأحمر)', 'inst'],
  ['r_own', 'سطر التملّك (اختياري — فعّله من «الخريطة والدبوس»)'], ['r_feat', 'مميزات الأرض (اختياري)'],
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

const AYK_FIELDS = AYA_FIELDS.flatMap((f) => (f[0] === 'a_loc' ? [['down', 'بطاقة الدفعة الأولى (درهم)', 'inst'], ['a_ds', 'بطاقة الدفعة الأولى · السطر الصغير', 'inst']] : f[0] === 'a_city' ? [] : [f]));
const AD_KEEP = ['more', 'addr', 'a_tag', 'a_addr', 'a_city'];   // remembered on this phone from one ad to the next
const store = () => { try { return JSON.parse(localStorage.getItem('dnp-ad') || '{}') || {}; } catch { return {}; } };
function pzPhone(t) { const s = store(); return (s.phones && s.phones[t]) || PZ_THEMES[t].phone; }
/** open the designer on a template (a team notification «تصميم جديد» → that design, when this account may use the template) */
export function adgenWant(theme) { pzKeep((s) => { s.theme = theme; }); }
function pzKeep(f) { try { const s = store(); f(s); localStorage.setItem('dnp-ad', JSON.stringify(s)); } catch { /* private mode */ } }
function adEvery(m) { return m ? 'كل ' + (m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? m + ' شهور' : m + ' شهرًا') : ''; }

/* where the plot sits in its block, read from the plan: «زاوية» with roads on two sides, «سكة» beside a lane (10 m or less) */
const SIDE_LANE = 10;
function adSide(p, dbg) {
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
    edges.push({ gap: gaps[1], a: Math.atan2(ny, nx), q, r, nx, ny, L });
  });
  if (dbg) return { u, edges };
  const open = edges.filter((e) => e.gap > 2); if (!open.length) return '';
  const widest = open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]);
  const turn = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
  if (open.some((e) => open.some((f) => turn(e.a, f.a) > Math.PI * 0.22 && turn(e.a, f.a) < Math.PI * 0.78))) return 'زاوية';
  if (open.some((e) => e !== widest && e.gap <= SIDE_LANE)) return 'سكة';
  return '';
}
/** what the plot is near, read from the plan: a park (green), services / mosque (blue), a main road, a corner — else the general line */
function adFeats(p) {
  const out = [];
  try {
    if (!p || !p.p || p.p.length < 3) throw 0;
    const area = Math.abs(p.p.reduce((s, q, i) => { const r = p.p[(i + 1) % p.p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
    const u = Math.sqrt(area / (p.m2 || 1)); if (!(u > 0)) throw 0;
    const types = (ad.proj && ad.proj.types) || {};
    const near = (kind, m) => ad.all.some((q) => {
      if (q.n === p.n || !q.p || q.t !== kind || types[q.t]) return false;
      const qa = Math.abs(q.p.reduce((s, a, i) => { const b = q.p[(i + 1) % q.p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
      return Math.hypot(q.c[0] - p.c[0], q.c[1] - p.c[1]) / u - Math.sqrt(qa) / u / 2 <= m;
    });
    if (ad.rawOk) {   // corners and roads only with the whole plan's plots
      if (adSide(p) === 'زاوية') out.push('أرض زاوية');
      const E = adSide(p, true); if (E && E.edges && E.edges.some((e) => e.gap >= 30 && e.gap < 99)) out.push('على شارع رئيسي');
    }
    if (near('blue', 160)) out.push('قريبة من الخدمات');
    if (near('green', 200)) out.push('قريبة من حديقة');
  } catch { /* read nothing */ }
  return out.length ? out : [ad.pl && ad.pl.infra ? 'فرصة قبل اكتمال البنية التحتية' : 'أرض مميزة في موقع حيوي'];
}
/** the project's ownership line in the form the older templates write it */
const ownSub = (s) => (/جميع الجنسيات/.test(s || '') ? 'تملك حر لجميع الجنسيات' : /للعرب|العرب/.test(s || '') ? 'تملك حر لجميع الجنسيات العربية' : '');
function adDefaults(p) {
  const l = p.l, PROJECT = l.projectName, T = { use: l.use || 'أرض', floors: l.floors || '' };
  const pr = priceOf(p), inst = pr ? pr.inst : [];
  const fl = (T.floors === 'أرضي + اثنين' ? 'أرضي + طابقين' : T.floors).replace(/\s*\([^()]*\)\s*$/, ''), last = inst.length ? String(inst[inst.length - 1].d || '').slice(0, 4) : '';
  let side = ''; if (ad.rawOk) { try { side = adSide(p); } catch { side = ''; } }   // only with the whole plan's plots (the phone app), never guessed from the listed ones alone
  const v = {
    mode: inst.length ? 'inst' : 'cash', side, title: 'أرض ' + T.use, proj: PROJECT, sub: 'تملك حر لجميع الجنسيات العربية',
    area: p.ft ? fmt(p.ft) : '', pay: 'كاش', until: last ? 'حتى ' + last : '', down: pr && inst.length ? fmt(Math.max(0, pr.down)) : '',
    each: inst.length ? fmt(inst[0].a) : '', every: adEvery(inst.length > 1 ? monthsBetween(inst[0].d, inst[1].d) : 0),
    price: pr ? fmt(pr.total) : '', ppf: (p.l && p.l.ppf) ? String(Math.round(p.l.ppf)) : pr && p.ft ? String(Math.round(pr.total / p.ft)) : '', nInst: inst.length, feat: adFeats(p).slice(0, 3).join('\n'),
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
    o_p1: (ad && ad.pl && ad.pl.p1) || '', o_p2: (ad && ad.pl && ad.pl.p2) || '', o_p3: inst.length ? '' : adFeats(p).slice(0, 2).join(' · '), oFlag: true, oLogo: false,
    w_kick: 'أراضي ' + T.use + ' للبيع', w_proj: PROJECT, w_rib: (ad && ad.pl && ad.pl.p1) || 'موقع مميز في الشارقة',   // never «جاهزة للبناء» unless the project's own line says so
    w_c1t: 'المساحة', w_area: p.ft ? fmt(p.ft) : '', w_unit: 'قدم مربع', w_c2t: 'تصريح بناء ' + T.use, w_c2s: fl ? '( ' + fl + ' )' : '',
    w_c3t: 'السعر كاش', w_c3tI: n ? 'السعر · ' + (n === 1 ? 'قسط واحد' : n === 2 ? 'قسطان' : n + ' أقساط') : 'السعر بالتقسيط', w_price: pr ? fmt(pr.total) : 'للاستفسار', w_cur: 'درهم إماراتي',
    w_own: (ad && ad.pl && (ownSub(ad.pl.p2) || ad.pl.p2)) || 'تملك حر لجميع الجنسيات العربية', wCol: 'gold', wLogo: true, wAv: true, w_name: 'مستشارتك العقارية', w_nameS: 'للتواصل والاستفسار عبر واتساب', w_phone: '056 500 0069', gSt: 'map', g_kick: 'أراضي في إمارة الشارقة', g_title: 'مطلوب', g_pill: 'شراء، بيع، وساطة', g_sub: 'في المناطق التالية', g_name: 'مستشارة عقارية', g_nameS: 'للتواصل والاستفسار عبر واتساب', g_phone: '056 500 0069', ...Object.fromEntries(WG_AREAS.map((a, i) => ['g_a' + (i + 1), a])),   // the project's own lines (set by the office), none when unknown
    r_proj: PROJECT, r_l1: 'المساحة', r_area: p.ft ? fmt(p.ft) + ' قدم' : '', r_l2: 'تصريح الأرض', r_use: (T.use + '   ' + String(code ? code[1] : fl).replace(/\s*\+\s*/g, '  +  ')).trim(),
    r_l3: 'السعـــر', r_priceC: pr ? fmt(pr.total) + ' Dhs, Cash' : 'للاستفسار', r_priceI: pr ? fmt(pr.total) + ' اقساط' : 'للاستفسار', rAv: true, rLines: false, r_own: (ad && ad.pl && ad.pl.p2) || '', r_feat: adFeats(p).slice(0, 2).join(' · '), a_tag: inst.length ? 'موقع مميز وفرصة إستثمارية' : adFeats(p).slice(0, 2).join(' · '), a_clbl: 'للتواصل والإستفسار', a_addr: 'شركة عمر الياسي للعقارات\nالشارقة - شارع مليحة' });
  if (ad && ad.pl && (ad.pl.sub || ownSub(ad.pl.p2))) v.sub = ad.pl.sub || ownSub(ad.pl.p2);
  const s = store();
  AD_KEEP.forEach((k) => { if (typeof s[k] === 'string' && s[k]) v[k] = s[k]; });
  v.theme = PZ_THEMES[s.theme] ? s.theme : allowed()[0]; if (!allowed().includes(v.theme)) v.theme = allowed()[0];
  v.phone = pzPhone(v.theme); if (layoutOf(v.theme) === 'aya') v.lab = false;
  return v;
}

/* ---------- a plot with no official plan: drawn the way the official site plans of its neighbours look (thin lines, the plot in red
   with its sides in metres, the numbers around it and the roads), and its planning conditions the same way (built area in yellow,
   setbacks in the official colours) — the website's own drawing ---------- */
function skClean(p) {   // the outline without thin spikes (a road's edge caught with the plot when the plan was read)
  const pts = p.p.slice();
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
  return pts.length === p.p.length ? p : { ...p, p: pts };
}
const SK_W = 1245, SK_H = 1086, SK_SERIF = '"Times New Roman", Times, serif';
function skView(p, D) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.p.forEach((q) => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); });
  const span = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = Math.min(SK_W, SK_H) / (span * 3.1);
  const P = (q) => [SK_W / 2 + (q[0] - cx) * k, (D ? SK_H * 0.46 : SK_H / 2) + (q[1] - cy) * k];
  const near = ad.all.filter((q) => q.n !== p.n && q.p && Math.abs(q.c[0] - cx) < SK_W / k && Math.abs(q.c[1] - cy) < SK_H / k);
  return { k, P, near };
}
function skPath(c, P, q) { c.beginPath(); q.p.forEach((t, i) => { const [x, y] = P(t); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); }
function skNeighbours(c, V) {
  c.lineWidth = 1.6; c.strokeStyle = '#8A8A8A';
  V.near.forEach((q) => { skPath(c, V.P, q); c.stroke(); });
  V.near.forEach((q) => { const [x, y] = V.P(q.c); c.direction = 'ltr'; txt(c, String(q.n).replace(/^#/, ''), x, y + 10, '500 30px ' + SK_SERIF, '#2B2B2B', 'center'); });
}
function skAlong(c, s, x, y, ang, font, col) { let a = ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; c.save(); c.translate(x, y); c.rotate(a); c.direction = 'rtl'; txt(c, s, 0, 0, font, col, 'center'); c.restore(); }
function skRoads(c, V, E) {
  E.edges.filter((e) => e.gap > 2).forEach((e) => {
    const d = (e.gap > 45 ? 9 : e.gap / 2) * E.u, mx = (e.q[0] + e.r[0]) / 2 + e.nx * d, my = (e.q[1] + e.r[1]) / 2 + e.ny * d, [x, y] = V.P([mx, my]);
    if (x < 40 || x > SK_W - 40 || y < 40 || y > SK_H - 40) return;
    skAlong(c, 'طريق' + (e.gap <= 45 ? ' ' + e.gap.toFixed(1) : ''), x, y + 10, Math.atan2(e.r[1] - e.q[1], e.r[0] - e.q[0]), '600 30px ' + SK_SERIF, '#2B2B2B');
  });
}
function planSketch(p0) {
  const p = skClean(p0), [cv, c] = canvas(SK_W, SK_H, '#FFFFFF'), V = skView(p, false), E = adSide(p, true);
  skNeighbours(c, V);
  if (E && E.u) skRoads(c, V, E);
  skPath(c, V.P, p); c.lineWidth = 4; c.strokeStyle = '#D0021B'; c.stroke();
  const [x, y] = V.P(p.c); c.direction = 'ltr'; txt(c, String(p.n).replace(/^#/, ''), x, y + 12, '700 36px ' + SK_SERIF, '#1B1B1B', 'center');
  if (E && E.u) p.p.forEach((q, i) => {   // each side in metres, written inside it
    const r = p.p[(i + 1) % p.p.length], L = Math.hypot(r[0] - q[0], r[1] - q[1]) / E.u; if (L < 4) return;
    const [ax, ay] = V.P(q), [bx, by] = V.P(r), [cx0, cy0] = V.P(p.c), mx = (ax + bx) / 2, my = (ay + by) / 2, t = 26 / Math.hypot(cx0 - mx, cy0 - my);
    skAlong(c, L.toFixed(2), mx + (cx0 - mx) * t, my + (cy0 - my) * t + 8, Math.atan2(by - ay, bx - ax), '500 24px ' + SK_SERIF, '#D0021B');
  });
  c.direction = 'rtl';
  return cv;
}
const SK_COL = { front: '#4FB6E8', side: '#24346E', back: '#D81B60', fill: '#F7E200' };
function condSketch(p0) {
  const p = skClean(p0), [cv, c] = canvas(SK_W, SK_H, '#FFFFFF'), V = skView(p, true), E = adSide(p, true);
  skNeighbours(c, V);
  skPath(c, V.P, p); c.fillStyle = SK_COL.fill; c.fill();
  const used = {};
  if (E && E.u && E.edges.length) {
    const open = E.edges.filter((e) => e.gap > 2), front = open.length ? open.reduce((a, e) => (e.gap > a.gap ? e : a), open[0]) : null;
    const turn = (a, b) => { let d = Math.abs(a - b) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
    const kindOf = (e) => (e === front ? 'front' : e.gap > 2 ? 'side' : front && turn(e.a, front.a) > Math.PI * 0.8 ? 'back' : 'hatch');
    const depth = Math.min(3 * E.u, Math.min(...E.edges.map((e) => e.L)) * 0.22);
    const strip = (e) => { const a = V.P(e.q), b = V.P(e.r), ix = -e.nx * depth * V.k, iy = -e.ny * depth * V.k; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + ix, b[1] + iy); c.lineTo(a[0] + ix, a[1] + iy); c.closePath(); };
    E.edges.map((e) => [e, kindOf(e)]).sort((x, y) => (x[1] === 'hatch' ? 0 : 1) - (y[1] === 'hatch' ? 0 : 1)).forEach(([e, kd]) => {
      used[kd] = 1; strip(e);
      if (kd === 'hatch') { c.save(); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, SK_W, SK_H); c.strokeStyle = '#3A3A3A'; c.lineWidth = 2; for (let t = -SK_H; t < SK_W; t += 14) { c.beginPath(); c.moveTo(t, SK_H); c.lineTo(t + SK_H, 0); c.stroke(); } c.restore(); strip(e); c.lineWidth = 1.4; c.strokeStyle = '#3A3A3A'; c.stroke(); }
      else { c.fillStyle = SK_COL[kd]; c.fill(); }
    });
    skRoads(c, V, E);
  }
  skPath(c, V.P, p); c.lineWidth = 2.4; c.strokeStyle = '#3A3A3A'; c.stroke();
  const [x, y] = V.P(p.c); c.direction = 'ltr'; txt(c, String(p.n).replace(/^#/, ''), x, y + 12, '700 36px ' + SK_SERIF, '#1B1B1B', 'center');
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
  if (!out[0]) {   // no picture for this kind: the website's own villa or building picture
    const villa = /فلل|فيلا/.test(l.use || ''), u = `${SITE}/wp-content/plugins/alyassi-dabdaba-plan/assets/p/${villa ? 'houshi-marwan/b-villa.jpg' : 'al-ruwaidat/b-reg.jpg'}`;
    const im = await imageOf(u); if (im) out[0] = { im, fit: 'cover', name: 'صورة تخيلية (يمكن تغييرها)' };
  }
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
  if (!out[1] && ad.p.p) { try { out[1] = { im: planSketch(ad.p), fit: 'contain', name: 'مخطط الأرض (مرسوم من الخارطة)', gen: 'plan' }; } catch { /* the illustration below */ } }
  if (!out[2] && ad.p.p) { try { out[2] = { im: condSketch(ad.p), fit: 'contain', name: 'شروط التخطيط (مرسومة من الخارطة)', gen: 'cond' }; } catch { /* none */ } }
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
  [AD_W, AD_H] = TH.size || [1600, 2000];
  if (cv.width !== AD_W || cv.height !== AD_H) { cv.width = AD_W; cv.height = AD_H; } cv.style.aspectRatio = `${AD_W} / ${AD_H}`;
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
  if (TH.layout === 'wg') { wgDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
  if (TH.layout === 'wr') { wrDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
  if (TH.layout === 'wa') { waDraw(c, v, p, at); PZS = 1; drawExtras(c, v, at); adSel(c); return; }
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
  return num(lay === 'oy' ? v.o_area : lay === 'ar' ? v.r_area : lay === 'wa' || lay === 'wr' ? v.w_area : v.area) || +ad.p.ft || 0;
}
function applyPpf() {
  const v = ad.v, ppf = num(v.ppf), ft = areaFt(); if (!ppf || !ft) return 0;
  const total = Math.round(ppf * ft), t = fmt(total), n = +v.nInst || 0;
  Object.assign(v, { price: t, w_price: t, o_priceC: t + ' Dhs, Cash', o_priceI: t + ' Dhs, ' + (n ? n + ' Installments' : 'Installments'), r_priceC: t + ' Dhs, Cash', r_priceI: t + ' اقساط' });
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
      ${H.ownerOf && H.ownerOf('*') ? '<label class="fld">المالك<select id="adgOwn"><option value="">كل الملاك</option></select></label>' : ''}
      <button class="btn gold block wt-go" data-adwant="">${ei('image')} بوست عام: مطلوب شراء ووساطة</button>
      <button class="btn primary block" id="adgPlan">${ei('map')} اختر القطعة من المخطط</button>
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
    <div class="adg-bar"><button class="btn primary" id="pzShare">${ei('share')} مشاركة</button><button class="btn" id="pzSave">${ei('pdf')} حفظ الصورة</button><button class="btn" id="pzKeep">${ei('bookmark')} حفظ التصميم</button><button class="btn gold" id="pzAll" hidden>${ei('grid')} كل القوالب</button></div>
    <div class="adg-allpop" id="pzAllPop" hidden><div class="adg-allin"><b>كل القوالب مرة واحدة</b><p class="muted" id="pzAllTxt"></p>
      <button class="btn primary block" id="pzAllShare">${ei('share')} مشاركة الكل</button><button class="btn ghost block" id="pzAllSave">${ei('pdf')} حفظ الكل</button><button class="btn block" id="pzAllNo">إلغاء</button></div></div>
    <div class="adg-crop" id="pzCropBox" hidden><div class="adg-cropin">
      <b>اسحب الإطار على الجزء المطلوب (أو ارسم إطارًا جديدًا)</b>
      <div class="adg-cnav" id="pzCropNav"></div>
      <div class="adg-cwrap"><canvas id="pzCropCv"></canvas></div>
      <div class="adg-cbtns"><button class="btn primary" id="pzCropOk">تم</button><button class="btn" id="pzCropNo">إلغاء</button></div>
    </div></div>
  </div>`;
}

function pzForm() {
  const aya = layoutOf(ad.v.theme) === 'aya', oy = layoutOf(ad.v.theme) === 'oy', ar = layoutOf(ad.v.theme) === 'ar', wa = layoutOf(ad.v.theme) === 'wa', wr = layoutOf(ad.v.theme) === 'wr', wg = layoutOf(ad.v.theme) === 'wg', okT = allowed(), only = okT.length < 2;
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
  $('pzForm').innerHTML = (sv ? `<div class="pz-saved">${ei('bookmark')} تصميم محفوظ لهذا القالب · <span class="num">${esc(dmy(sv.t))}</span>${sv.by ? ' · ' + esc(sv.by) : ''}<span class="rowbtns"><button type="button" class="btn sm" data-pznew>بدء تصميم جديد</button><button type="button" class="btn sm danger" data-pzunsave>حذف المحفوظ</button></span></div>` : '') + `<p class="pz-tip">👆 اسحب أي نص على الصورة لتحريكه · إصبعان لتكبيره أو تصغيره · عدّل الكتابة من الأسفل · ثم اضغط «مشاركة» أو «حفظ الصورة»</p>` + sec('th', only ? '١. نوع الدفع' : '١. القالب ونوع الدفع', `<div class="pz-th"${only ? ' hidden' : ''}>${Object.entries(PZ_THEMES).filter(([k]) => okT.includes(k)).map(([k, t]) => `<button type="button" data-pzth="${k}" class="${v.theme === k ? 'on' : ''}"><i style="background:${t.bar}"></i>${t.name}</button>`).join('')}</div>
    <div class="seg"${wg ? ' hidden' : ''}><button type="button" data-pzmode="cash" class="${v.mode === 'cash' ? 'on' : ''}">قالب الكاش</button><button type="button" data-pzmode="inst" class="${v.mode === 'inst' ? 'on' : ''}">قالب الأقساط</button></div>${wg ? `<h3>شكل المناطق</h3><div class="seg pz-wacol">${WG_STYLES.map(([k, l]) => `<button type="button" data-gst="${k}" class="${(v.gSt || 'map') === k ? 'on' : ''}">${l}</button>`).join('')}</div><label class="chk"><input type="checkbox" data-k="wAv"${v.wAv !== false ? ' checked' : ''}> صورة المعلنة</label>` : ''}${wa ? `<h3>لون القالب</h3><div class="seg pz-wacol">${Object.entries(WA_COLS).map(([k, t]) => `<button type="button" data-wacol="${k}" class="${(v.wCol || 'gold') === k ? 'on' : ''}"><i style="background:linear-gradient(90deg,${t.rib[0]},${t.rib[1]})"></i>${t.name}</button>`).join('')}</div><label class="chk"><input type="checkbox" data-k="wLogo"${v.wLogo ? ' checked' : ''}> شعار الشركة</label>` : wr ? `<label class="chk"><input type="checkbox" data-k="wAv"${v.wAv !== false ? ' checked' : ''}> صورة المعلنة</label>` : ''}`, true)
    + sec('tx', '٢. الكتابة والأسعار', `<label class="fld pz-ppf"${wg ? ' hidden' : ''}>سعر القدم (درهم) — يحسب الإجمالي تلقائياً<input type="text" inputmode="decimal" data-ppf value="${esc(v.ppf || '')}" placeholder="مثلاً 143"></label><p class="help" id="pzTot"${wg ? ' hidden' : ''}>${ppfHelp()}</p>${(aya ? (ad.v.theme === 'ayk' ? AYK_FIELDS : AYA_FIELDS) : oy ? OY_FIELDS : ar ? AR_FIELDS : wa ? WA_FIELDS : wr ? WR_FIELDS : wg ? WG_FIELDS : AD_FIELDS).map(f).join('')}
    ${oy ? `<p class="help">السطران الأبيضان خاصّان بكل مشروع (جاهز للبناء، تملّك حر للعرب أو لكل الجنسيات، البنية التحتية…)${ad.pl ? '' : ' — لم تُحدَّد بعد لهذا المشروع'}.</p>${H.isAdmin && H.isAdmin() ? `<button type="button" class="btn sm" data-pzpl>${ei('bookmark')} اجعل السطرين الأبيضين لكل بوستات مشروع ${esc(ad.p.l.projectName)}</button>` : ''}` : ''}
    <h3${wg ? ' hidden' : ''}>موقع القطعة في العنوان</h3>
    <div class="seg pz-side"${wg ? ' hidden' : ''}>${[['', 'عادية'], ['زاوية', 'زاوية'], ['سكة', 'سكة']].map(([k, l]) => `<button type="button" data-pzside="${k}" class="${(v.side || '') === k ? 'on' : ''}">${l}${ad.rawOk && (v.auto || '') === k ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="help"${wg ? ' hidden' : ''}>${ad.rawOk ? `✓ = ما قرأته من المخطط${v.auto ? ': ' + v.auto : ': ليست زاوية ولا على سكة'}. ` : ''}الاختيار يضيف الكلمة إلى آخر العنوان.</p>`, false)
    + (aya || oy || ar || wa || wr || wg ? '' : sec('im', '٣. الصور', `${slots}<p class="help">الصور التي تضيفها هنا للبوست فقط ولا تُرفع إلى الموقع. يمكنك اختيار صورة أو ملف PDF.</p>`, false))
    + (wg ? '' : sec('mp', (aya || oy || ar || wa || wr || wg ? '٣' : '٤') + '. الخريطة والدبوس', `
    <label>تكبير الخريطة<input type="range" data-k="zoom" min="0.5" max="3" step="0.1" value="${v.zoom}"></label>
    <label>حجم الدبوس <b class="num" data-fsv="pinK">${Math.round((v.pinK || 1) * 100)}%</b><input type="range" data-k="pinK" min="0.4" max="2.5" step="0.05" value="${v.pinK || 1}"></label>
    <label class="chk"><input type="checkbox" data-k="pin"${v.pin ? ' checked' : ''}> الدبوس</label>
    ${ar ? `<label class="chk"><input type="checkbox" data-k="rAv"${v.rAv ? ' checked' : ''}> صورة المعلن</label><label class="chk"><input type="checkbox" data-k="rLines"${v.rLines ? ' checked' : ''}> سطرا التملّك ومميزات الأرض</label>` : oy ? `<label class="chk"><input type="checkbox" data-k="oFlag"${v.oFlag ? ' checked' : ''}> خريطة الإمارات</label><label class="chk"><input type="checkbox" data-k="oLogo"${v.oLogo ? ' checked' : ''}> شعار الشركة</label>` : `<label class="chk"><input type="checkbox" data-k="lab"${v.lab ? ' checked' : ''}> بطاقة الموقع على الخريطة</label>`}
    <button type="button" class="btn sm" data-mapcenter>إرجاع الخريطة إلى القطعة</button>`, false))
    + sec('ex', '＋ أشكال إضافية' + (v.ex && v.ex.length ? ` (${v.ex.length})` : ''), exForm(v), !!(v.ex && v.ex.length))
    + sec('fs', (wg ? '٣' : aya || oy || ar || wa || wr ? '٤' : '٥') + '. حجم الخط وأماكن العناصر', `<h3>حجم الخط</h3>
    ${[['fsT', 'العنوان واسم المشروع'], ['fsN', 'الأرقام والأسعار'], ['fsL', 'النصوص والعناوين الصغيرة'], ['fsC', 'سطر وشريط التواصل']].map(([k, l]) => `<label>${l} <b class="num" data-fsv="${k}">${Math.round(v[k] * 100)}%</b><input type="range" data-k="${k}" min="0.6" max="1.6" step="0.05" value="${v[k]}"></label>`).join('')}
    <button type="button" class="btn sm" data-fsreset>إرجاع أحجام الخط الأصلية</button>
    <h3>تحريك العناصر</h3>
    <p class="help">اسحب أي نص أو بطاقة على المعاينة مباشرة، وكبّره أو صغّره بإصبعين، أو اختر العنصر وحرّكه بالأسهم. السحب داخل الخريطة أو داخل صورة يحرّك ما بداخلها.</p>
    <div class="pz-move"><select id="pzPart">${(aya ? AYA_PARTS : oy ? OY_PARTS : ar ? AR_PARTS : wa ? WA_PARTS : wr ? WR_PARTS : wg ? WG_PARTS : AD_PARTS).concat((v.ex || []).map((e, i) => ['ex' + i, (e.t === 'box' ? 'مربع نص ' : e.t === 'arrow' ? 'سهم ' : 'دائرة ') + (i + 1)])).map(([k, l]) => `<option value="${k}"${ad.sel === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
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
const PZ_FILE = { wa: 'whatsapp', wr: 'leen-whatsapp', wi: 'leen-instagram', wg: 'leen-general', co: 'company', gr: 'ebada', pk: 'aya-aljabri', aya: 'aya-pink', oy: 'omar-alyassi', ar: 'abdulrahman' };
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
  if (H.teamEv) H.teamEv(share ? 'share_design' : 'save_img', ad.p.l.id, ad.v.theme);   // the team's activity (and, for a manager, the team is told)
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
    const own = pg.querySelector('#adgOwn');
    if (own) {   // the owners in this project (staff with «رؤية اسم مالك الأرض»)
      const names = [...new Set(pool.map((l) => H.ownerOf(l.id)).filter(Boolean))].sort();
      const keep = own.value; own.innerHTML = '<option value="">كل الملاك</option>' + names.map((o) => `<option${o === keep ? ' selected' : ''}>${esc(o)}</option>`).join('');
    }
    const wo = own ? own.value : '';
    const ls = pool.filter((l) => (l.poly || l.pc) && (!q || l.n.startsWith(q)) && (!wo || H.ownerOf(l.id) === wo)).sort((a, b) => (rank[a.status] ?? 4) - (rank[b.status] ?? 4) || (+a.n || 0) - (+b.n || 0)).slice(0, q ? 60 : 40);
    list.innerHTML = ls.map((l) => `<button type="button" class="chip ${l.status}" data-adg="${esc(l.id)}">${esc(l.n)}<small>${l.status === 'av' ? 'متاحة' : l.status === 'res' ? 'محجوزة' : l.status === 'sold' ? 'مباعة' : 'غير معروضة'}</small>${H.ownerOf && H.ownerOf(l.id) ? `<em class="adg-own">${esc(H.ownerOf(l.id))}</em>` : ''}</button>`).join('') || '<p class="muted">لا توجد قطعة بهذا الرقم في القطع المعروضة.</p>';
  };
  try { const last = localStorage.getItem('oay:adgproj'); if (last && projects.some((p) => p.slug === last && p.map)) sel.value = last; } catch { /* ignore */ }
  sel.onchange = () => { try { localStorage.setItem('oay:adgproj', sel.value); } catch { /* ignore */ } show(); }; inp.oninput = show; show();
  { const o = pg.querySelector('#adgOwn'); if (o) o.onchange = show; }
  list.onclick = (e) => { const b = e.target.closest('[data-adg]'); if (b) open(b.dataset.adg); };
  pg.querySelector('#adgPlan').onclick = () => { const p = proj(); if (p && H.openPlan) H.openPlan(p.slug); };
  inp.onkeydown = (e) => { if (e.key !== 'Enter') return; const p = proj(), q = inp.value.trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); const l = p && (H.landsOf ? H.landsOf(p.slug) : p.lands).find((x) => x.n === q && (x.poly || x.pc)); if (l) open(l.id); else H.toast('لا توجد قطعة بهذا الرقم — اختر من القائمة'); };
}

export async function initAdgen2(pg, l, proj) {
  PG = pg; ad = null; pzc = null; hist = []; fut = [];
  const cv = $('pzCv');
  const raw = rawPlots(l.project);
  const all = raw ? raw.filter((q) => q[6] && q[6].length > 2).map(([n, t, , m2, , , poly, pc]) => ({ n: String(n), t, p: poly, c: pc || centreOf(poly), m2 })) : proj.lands.filter((x) => x.poly).map(plotOf);
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
    else if (l.pc) {   // the shape of the nearest offered plot of its kind (same block, same turn), moved onto it and sized to its area
      const refs = proj.lands.filter((x) => x.poly && x.poly.length > 2), d2 = (x) => { const c = plotCentre(x); return (c[0] - l.pc[0]) ** 2 + (c[1] - l.pc[1]) ** 2; };
      const same = refs.filter((x) => x.t === l.t), ref = (same.length ? same : refs).sort((a, b) => d2(a) - d2(b))[0];
      if (ref) {
        const [rx, ry] = plotCentre(ref), k = ref.ft > 0 && l.ft > 0 ? Math.max(0.6, Math.min(1.6, Math.sqrt(l.ft / ref.ft))) : 1;
        l = { ...l, poly: ref.poly.map(([x, y]) => [l.pc[0] + (x - rx) * k, l.pc[1] + (y - ry) * k]), pr: ref.pr || 0 };
      } else { const h = 6, [cx, cy] = l.pc; l = { ...l, poly: [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]] }; }
    }
  }
  ad = { p: plotOf(l), proj, P, plots: proj.lands.filter((x) => x.poly).map(plotOf), all, rawOk: !!raw, img: [null, null, null], hits: [] };
  ad.pl = null;
  try { const j = await H.api('proj_lines', { slug: l.project }); if (PG !== pg) return; ad.pl = j.lines || null; } catch { /* none */ }
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
  form.addEventListener('click', async (e) => {
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
    if (d.gst) { mark(); ad.v.gSt = d.gst; pzForm(); adRedraw(); return; }
    if (d.wacol) { mark(); ad.v.wCol = d.wacol; pzForm(); adRedraw(); return; }
    if (d.pzpl !== undefined) {
      H.api('proj_lines_save', { slug: ad.p.l.project, p1: ad.v.o_p1 || '', p2: ad.v.o_p2 || '', sub: (ad.pl && ad.pl.sub) || '' })
        .then((j) => { ad.pl = j.lines; pzForm(); H.toast('تم — هذان السطران لكل بوستات ' + ad.p.l.projectName); }).catch((ex) => H.toast(ex.message));
      return;
    }
    if (d.pznew !== undefined) { const th = ad.v.theme; ad.v = adDefaults(ad.p); ad.v.theme = th; ad.v.phone = pzPhone(th); if (layoutOf(th) === 'aya') ad.v.lab = false; ad.sel = null; pzForm(); adRedraw(); H.toast('تصميم جديد — المحفوظ باقٍ حتى تحفظ فوقه'); return; }
    if (d.pzunsave !== undefined) {
      if (!(await uiConfirm('حذف التصميم المحفوظ لهذا القالب؟', { danger: true }))) return;
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

/* =====================================================================================================================
   «مطلوب شراء ووساطة»: one general post (no plot) — a big title, the areas as dark chips over a large piece of a real
   plan, and the advertiser (her / his photo or the template's logo, the name and the WhatsApp number). Each account draws
   it in its own template's colours, 4:3 (WhatsApp) or 4:5 (Instagram). Everything is centred by measuring the text.
   ===================================================================================================================== */
const WT_AREAS = ['المطرق', 'السحمة', 'روضة القرط', 'مزيرعة', 'القاسمية', 'بساتين الزبير', 'البليدة', 'الحوشي', 'الطي شرق', 'الرقيبة', 'الصجعة', 'الطي غرب'];
const WT_FEM = { wr: 1, wi: 1, pk: 1, aya: 1, ayk: 1 };
const WT_PLOT = { yellow: '#F5DE70', gold: '#EBBC4E', blue: '#A9CBF2', green: '#A6DA8F', pink: '#F7BFC9', magenta: '#E6A9EA', red: '#F2A59C', orange: '#F6C27A', purple: '#CDB3F0', brown: '#D9B48C' };
let wt = null;
const wtHex = (h) => { h = String(h || '#B25858').replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const wtMix = (a, b, k) => { const x = wtHex(a), y = wtHex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
function wtPal(k) {
  const t = PZ_THEMES[k] || PZ_THEMES.co; const A = /^#/.test(t.bar || '') ? t.bar : '#B25858';
  return { A, deep: wtMix(A, '#000000', 0.22), soft: wtMix(A, '#FFFFFF', 0.82), bg: wtMix(A, '#F7F1EA', 0.94), ink: wtMix(A, '#2A1A14', 0.72), chip: wtMix(A, '#1E1714', 0.82), gold: '#D9B06A', ivory: '#FBF5EE' };
}
function wtStore() { try { return JSON.parse(localStorage.getItem('oay:want') || '{}') || {}; } catch { return {}; } }
function wtKeep() { try { const s = wtStore(); s.theme = wt.v.theme; s.size = wt.v.size; s.proj = wt.v.proj; s.areas = wt.v.areas; s.per = s.per || {}; s.per[wt.v.theme] = { name: wt.v.name, sub: wt.v.sub, phone: wt.v.phone, photo: wt.v.photo || '' }; localStorage.setItem('oay:want', JSON.stringify(s)); } catch { /* full or private */ } }
function wtDefaults(k) {
  const s = wtStore(), per = (s.per || {})[k] || {}, f = WT_FEM[k];
  return { name: per.name || (f ? 'مستشارتك العقارية' : 'مستشارك العقاري'), sub: per.sub || 'للتواصل والاستفسار عبر واتساب', phone: per.phone || pzPhone(k) || (k === 'wr' || k === 'wi' ? '056 500 0069' : '0568080655'), photo: per.photo || '' };
}
function wtFace(k) {   // [image, isPhoto]: the account's own photo, the template's portrait, else its logo
  if (wt.photoImg) return [wt.photoImg, true];
  if ((k === 'wr' || k === 'wi') && ayaArt.wrAv) return [ayaArt.wrAv, true];
  if (k === 'ar' && ayaArt.arAv) return [ayaArt.arAv, true];
  const t = PZ_THEMES[k] || {}; const lg = t.logo || (k === 'aya' || k === 'ayk' ? PZ_THEMES.pk.logo : PZ_THEMES.co.logo);
  return [lg && lg.complete && lg.naturalWidth ? lg : null, false];
}
function wtPortrait(c, P, cx, cy, r, k) {
  const [im, photo] = wtFace(k);
  c.save(); c.shadowColor = 'rgba(40,15,15,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 10; c.fillStyle = P.gold; c.beginPath(); c.arc(cx, cy, r + 22, 0, 7); c.fill(); c.restore();
  c.fillStyle = P.ivory; c.beginPath(); c.arc(cx, cy, r + 10, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); c.fillStyle = '#FFFFFF'; c.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  if (im) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    if (photo) { const s = Math.max(2 * r / iw, 2 * r / ih); c.drawImage(im, cx - iw * s / 2, cy - ih * s / 2, iw * s, ih * s); }
    else { const s = Math.min(1.5 * r / iw, 1.5 * r / ih); c.drawImage(im, cx - iw * s / 2, cy - ih * s / 2, iw * s, ih * s); }
  }
  c.restore();
  wrDiamond(c, cx, cy - r - 34, 12, P.gold); wrDiamond(c, cx, cy + r + 34, 12, P.gold);
}
function wtPill(c, cx, top, h, s, px, fill, col, padX, minW) {   // a pill sized to its text, centred on cx
  c.font = FD(800, px); let w = c.measureText(s).width + 2 * padX; w = Math.max(minW || 0, w);
  c.fillStyle = fill; box(c, cx - w / 2, top, w, h, h / 2); c.fill(); return w;
}
function wtPhone(c, P, cx, top, w, phone) {
  const h = 100, x = cx - w / 2;
  c.save(); c.shadowColor = 'rgba(40,15,15,.28)'; c.shadowBlur = 16; c.shadowOffsetY = 6; c.fillStyle = P.ivory; box(c, x, top, w, h, h / 2); c.fill(); c.restore();
  c.fillStyle = P.A; c.beginPath(); c.arc(x + 50, top + 50, 40, 0, 7); c.fill();
  if (WA_GLYPH) { c.save(); c.translate(x + 50 - 28, top + 50 - 28); c.scale(56 / 24, 56 / 24); c.fillStyle = '#FFFFFF'; c.fill(WA_GLYPH); c.restore(); }
  c.direction = 'ltr'; adFitV(c, phone, x + 100 + (w - 100) / 2 - 10, top + 18, top + h - 18, w - 150, 52, 800, P.deep, 'center'); c.direction = 'rtl';
}
function wtLine(c, P, cx, y, s, px, w) {   // «في المناطق التالية» with gold lines and diamonds either side, all centred
  c.font = FD(800, px); const tw = Math.min(c.measureText(s).width, w - 300);
  adFitV(c, s, cx, y - px * 0.7, y + px * 0.5, w - 300, px, 800, P.deep, 'center');
  const gap = 34, L = 130; c.fillStyle = P.gold;
  [[-1], [1]].forEach(([d]) => { const x0 = cx + d * (tw / 2 + gap); wrDiamond(c, x0, y - px * 0.1, 8, P.gold); c.fillRect(d < 0 ? x0 - 22 - L : x0 + 22, y - px * 0.1 - 1.5, L, 3); });
}
function wtMapPick(slug, aspect) {   // the densest piece of the plan in the map's proportions, with plots big enough to read
  const raw = rawPlots(slug);   // every plot of the plan; without it, the plots the app knows
  const P = raw ? raw.filter((q) => q[6] && q[6].length > 2).map((q) => ({ n: String(q[0]), t: q[1], p: q[6], c: q[7] || centreOf(q[6]) }))
    : ((H.landsOf && H.landsOf(slug)) || []).filter((l) => l.poly && l.poly.length > 2).map((l) => ({ n: String(l.n), t: l.t || 'yellow', p: l.poly, c: l.pc || centreOf(l.poly) }));
  if (!P.length) return null;
  const sz = P.map((q) => { const xs = q.p.map((a) => a[0]), ys = q.p.map((a) => a[1]); return Math.sqrt((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))); }).sort((a, b) => a - b);
  const unit = sz[Math.floor(sz.length / 2)] || 10, Wn = unit * 26, Hn = Wn / aspect;
  const xs = P.map((q) => q.c[0]), ys = P.map((q) => q.c[1]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  let best = null; const st = unit;
  for (let x0 = mnx - unit; x0 <= Math.max(mnx, mxx - Wn) + unit; x0 += st) {
    for (let y0 = mny - unit; y0 <= Math.max(mny, mxy - Hn) + unit; y0 += st) {
      let n = 0; for (const q of P) if (q.c[0] > x0 && q.c[0] < x0 + Wn && q.c[1] > y0 && q.c[1] < y0 + Hn) n++;
      if (!best || n > best.n) best = { n, x0, y0 };
    }
  }
  return { P, x0: best.x0, y0: best.y0, w: Wn, h: Hn, unit };
}
function wtMap(c, P, x, y, w, h, R) {
  c.save(); box(c, x, y, w, h, R); c.clip();
  c.fillStyle = '#E9DCC3'; c.fillRect(x, y, w, h);
  const m = wt.map && wt.map.slug === wt.v.proj && Math.abs(wt.map.aspect - w / h) < 0.01 ? wt.map : (wt.map = Object.assign(wtMapPick(wt.v.proj, w / h) || {}, { slug: wt.v.proj, aspect: w / h }));
  if (m.P && wt.P && (wt.P.img || wt.P.V)) {   // the official plan itself (its picture and drawing: plots, numbers, roads)
    const k = w / m.w; c.save(); c.translate(x, y); c.scale(k, k); c.translate(-m.x0, -m.y0);
    drawPlanBase(c, wt.P, wt.pmap, m.x0, m.y0, m.x0 + m.w, m.y0 + m.h, k); c.restore();
  } else if (m.P) {
    const s = w / m.w, X = (a) => x + (a - m.x0) * s, Y = (b) => y + (b - m.y0) * s;
    c.lineJoin = 'round';
    for (const q of m.P) {
      if (q.c[0] < m.x0 - m.unit * 3 || q.c[0] > m.x0 + m.w + m.unit * 3 || q.c[1] < m.y0 - m.unit * 3 || q.c[1] > m.y0 + m.h + m.unit * 3) continue;
      c.beginPath(); q.p.forEach((a, i) => (i ? c.lineTo(X(a[0]), Y(a[1])) : c.moveTo(X(a[0]), Y(a[1])))); c.closePath();
      c.fillStyle = WT_PLOT[q.t] || '#EAD9A6'; c.fill(); c.strokeStyle = '#86A23A'; c.lineWidth = 1.6; c.stroke();
    }
    const fs = Math.max(11, Math.min(20, m.unit * s * 0.3)); c.direction = 'ltr';
    for (const q of m.P) { const cx = X(q.c[0]), cy = Y(q.c[1]); if (cx < x - 40 || cx > x + w + 40 || cy < y - 40 || cy > y + h + 40) continue; txt(c, q.n, cx, cy + fs * 0.36, FD(700, fs), '#5B4A12', 'center'); }
    c.direction = 'rtl';
  }
  c.restore();
  c.strokeStyle = '#FFFFFF'; c.lineWidth = 10; box(c, x, y, w, h, R); c.stroke();
}
function wtChips(c, P, x, y, w, h) {   // the areas: 3 a row, every row centred, the block centred in the map
  const A = wt.v.areas.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 18); if (!A.length) return;
  const cols = A.length <= 4 ? 2 : 3, rows = Math.ceil(A.length / cols), pad = 36, gx = 26;
  const cw = (w - 2 * pad - (cols - 1) * gx) / cols, avail = h - 2 * pad;
  const ch = Math.min(100, avail / (rows * 1.5)), gy = rows > 1 ? Math.min(64, (avail - rows * ch) / (rows - 1) * 0.75) : 0;
  const top = y + (h - (rows * ch + (rows - 1) * gy)) / 2;
  for (let r = 0; r < rows; r++) {
    const row = A.slice(r * cols, r * cols + cols), rw = row.length * cw + (row.length - 1) * gx, x0 = x + w / 2 + rw / 2;   // right to left
    row.forEach((s, i) => {
      const bx = x0 - (i + 1) * cw - i * gx, by = top + r * (ch + gy);
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 6; c.fillStyle = '#0B0B0B'; box(c, bx, by, cw, ch, ch * 0.32); c.fill(); c.restore();
      adFitV(c, s, bx + cw / 2, by + ch * 0.2, by + ch * 0.8, cw - 34, ch * 0.5, 800, '#FFFFFF', 'center');
    });
  }
}
function wtDraw(cv) {
  const v = wt.v, k = v.theme, P = wtPal(k), W = cv.width, H = cv.height, c = cv.getContext('2d');
  PZS = 1; c.direction = 'rtl'; c.textBaseline = 'alphabetic';
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
  let g = c.createRadialGradient(W, 0, 0, W, 0, W * 0.65); g.addColorStop(0, wtMix(P.A, '#FFFFFF', 0.8)); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const head = (cx, top, w, tPx) => {   // kicker · title · pill · «في المناطق التالية», each centred on cx; → the y under it
    const kw = wtPill(c, cx, top, 72, v.kick, 34, P.soft, P.deep, 48);
    adFitV(c, v.kick, cx, top + 14, top + 60, kw - 60, 34, 800, P.deep, 'center');
    let y = top + 72 + 16;
    adFitV(c, v.title, cx, y, y + tPx * 1.02, w, tPx, 800, P.ink, 'center'); y += tPx * 1.02 + 18;
    const ph = 104, pw = Math.min(w, wtPill(c, cx, y, ph, v.pill, 72, P.A, '#FFF', 90));
    c.save(); c.globalCompositeOperation = 'source-over'; const gg = c.createLinearGradient(0, y, 0, y + ph); gg.addColorStop(0, wtMix(P.A, '#FFFFFF', 0.08)); gg.addColorStop(1, P.deep); c.fillStyle = gg; box(c, cx - pw / 2, y, pw, ph, ph / 2); c.fill(); c.restore();
    adFitV(c, v.pill, cx, y + 16, y + ph - 22, pw - 120, 72, 800, '#FFFFFF', 'center'); y += ph + 30;
    wtLine(c, P, cx, y + 30, v.inl, 44, w); return y + 30 + 46;
  };
  if (W / H > 1.1) {   // 4:3 — the advertiser on the left, the post on the right
    const sx = 40, sy = 40, sw = 560, sh = H - 80, scx = sx + sw / 2;
    c.save(); c.shadowColor = 'rgba(80,30,30,.25)'; c.shadowBlur = 40; c.shadowOffsetY = 18; g = c.createLinearGradient(sx, sy, sx + sw * 0.4, sy + sh); g.addColorStop(0, wtMix(P.A, '#FFFFFF', 0.06)); g.addColorStop(1, P.deep); c.fillStyle = g; box(c, sx, sy, sw, sh, 44); c.fill(); c.restore();
    c.strokeStyle = 'rgba(232,196,128,.55)'; c.lineWidth = 2; box(c, sx + 18, sy + 18, sw - 36, sh - 36, 32); c.stroke();
    const r = 200, block = 2 * r + 44 + 60 + 66 + 50 + 100 + 60, t0 = sy + (sh - block) / 2, cy = t0 + r + 22;
    wtPortrait(c, P, scx, cy, r, k);
    let y = cy + r + 22 + 60;
    adFitV(c, v.name, scx, y, y + 64, sw - 70, 54, 800, '#FFFFFF', 'center'); y += 72;
    adFitV(c, v.sub, scx, y, y + 40, sw - 90, 30, 500, wtMix(P.A, '#FFFFFF', 0.82), 'center'); y += 40 + 46;
    if (v.phone) wtPhone(c, P, scx, y, sw - 100, v.phone);
    const mx = 640, mw = W - 40 - mx, mcx = mx + mw / 2, my = head(mcx, 46, mw, 176) + 18;
    wtMap(c, P, mx, my, mw, H - 40 - my, 34); wtChips(c, P, mx, my, mw, H - 40 - my);
  } else {   // 4:5 — the post on top, the advertiser in a band at the bottom
    const mx = 60, mw = W - 120, cx = W / 2, bandH = 340, by = H - 60 - bandH, my = head(cx, 60, mw, 200) + 22;
    wtMap(c, P, mx, my, mw, by - 36 - my, 36); wtChips(c, P, mx, my, mw, by - 36 - my);
    c.save(); c.shadowColor = 'rgba(80,30,30,.25)'; c.shadowBlur = 36; c.shadowOffsetY = 14; g = c.createLinearGradient(mx, by, mx + mw, by + bandH); g.addColorStop(0, wtMix(P.A, '#FFFFFF', 0.06)); g.addColorStop(1, P.deep); c.fillStyle = g; box(c, mx, by, mw, bandH, 44); c.fill(); c.restore();
    c.strokeStyle = 'rgba(232,196,128,.55)'; c.lineWidth = 2; box(c, mx + 16, by + 16, mw - 32, bandH - 32, 32); c.stroke();
    const r = 100, pcx = mx + mw - 80 - r - 22, pcy = by + bandH / 2;
    wtPortrait(c, P, pcx, pcy, r, k);
    const tx0 = mx + 60, tw = pcx - r - 60 - tx0, tcx = tx0 + tw / 2;
    adFitV(c, v.name, tcx, by + 50, by + 114, tw, 56, 800, '#FFFFFF', 'center');
    adFitV(c, v.sub, tcx, by + 120, by + 158, tw - 40, 30, 500, wtMix(P.A, '#FFFFFF', 0.82), 'center');
    if (v.phone) wtPhone(c, P, tcx, by + 190, Math.min(560, tw), v.phone);
  }
}
const WT_SIZES = { wa: [1600, 1200], ig: [1600, 2000] };
export function adwantPage(projects) {
  const ok = allowed(), s = wtStore(), k = ok.includes(s.theme) ? s.theme : ok[0];
  void projects;
  return `<div class="adg wt">
    <div class="adg-prev"><canvas id="wtCv" width="1600" height="1200"></canvas><div class="adg-load" id="wtLoad"><i class="spin"></i><span>جارِ تجهيز التصميم…</span></div></div>
    <div class="adg-form">
      ${ok.length > 1 ? `<h3>القالب</h3><div class="wt-th">${ok.map((t) => `<button type="button" data-wtth="${t}" class="${t === k ? 'on' : ''}"><i style="background:${wtPal(t).A}"></i>${esc(PZ_THEMES[t].name)}</button>`).join('')}</div>` : ''}
      <h3>المقاس</h3><div class="seg"><button type="button" data-wtsz="wa">واتساب 4:3</button><button type="button" data-wtsz="ig">إنستجرام 4:5</button></div>
      <label class="fld">المناطق (كل منطقة في سطر)<textarea id="wtAreas" rows="6"></textarea></label>
      <div class="wt-who"><button type="button" class="btn ghost sm" id="wtPhoto">${ei('image')} صورتك</button><button type="button" class="btn ghost sm" id="wtPhotoX" hidden>إزالة الصورة</button></div>
      <label class="fld">الاسم تحت الصورة<input type="text" data-wt="name"></label>
      <label class="fld">السطر الصغير<input type="text" data-wt="sub"></label>
      <label class="fld">رقم الواتساب<input type="text" data-wt="phone" dir="ltr" inputmode="tel"></label>
      <details class="wt-more"><summary>نصوص العنوان</summary>
        <label class="fld">السطر العلوي<input type="text" data-wt="kick"></label><label class="fld">العنوان<input type="text" data-wt="title"></label>
        <label class="fld">الشريط<input type="text" data-wt="pill"></label><label class="fld">فوق المناطق<input type="text" data-wt="inl"></label></details>
    </div>
    <input type="file" id="wtFile" accept="image/*" hidden>
    <div class="adg-bar"><button class="btn primary" id="wtShare">${ei('share')} مشاركة</button><button class="btn" id="wtSave">${ei('pdf')} حفظ الصورة</button></div>
  </div>`;
}
async function wtOut(share) {
  const cv = $('wtCv'), b = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.93));
  if (!b) { H.toast('تعذّر تجهيز الصورة'); return; }
  if (H.teamEv) H.teamEv(share ? 'share_design' : 'save_img', 'wanted', wt.v.theme);
  const name = `wanted-${PZ_FILE[wt.v.theme] || wt.v.theme}-${wt.v.size}.jpg`, title = 'مطلوب شراء ووساطة';
  try {
    if (native) {
      const u8 = new Uint8Array(await b.arrayBuffer());
      if (!share) { try { await Filesystem.writeFile({ path: 'عمر الياسي/' + name.replace('.jpg', '-' + Date.now().toString(36) + '.jpg'), data: b64(u8), directory: Directory.Documents, recursive: true }); H.toast('تم حفظ البوست في: المستندات ← عمر الياسي'); return; } catch { /* the share sheet has «حفظ» */ } }
      const w = await Filesystem.writeFile({ path: name, data: b64(u8), directory: Directory.Cache });
      await Share.share({ title, files: [w.uri], dialogTitle: share ? 'مشاركة البوست' : 'حفظ البوست' }); return;
    }
    const file = new File([b], name, { type: 'image/jpeg' });
    if (share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
    const a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); H.toast('تم تجهيز البوست');
  } catch (e) { if (!/cancel/i.test(String(e && (e.message || e)))) H.toast('تعذّر الحفظ: ' + String((e && e.message) || e).slice(0, 80)); }
}
export async function initAdwant(pg, projects) {
  PG = pg; const s = wtStore(), ok = allowed();
  const k = ok.includes(s.theme) ? s.theme : ok[0];
  const ps = projects.filter((p) => p.map), mp = ps.find((p) => p.slug === 'al-mutraq') || ps[0] || {}, proj = mp.slug;   // always Al Mutraq's plan
  wt = { v: Object.assign({ theme: k, size: s.size || (PZ_THEMES[k].size && PZ_THEMES[k].size[1] < 1500 ? 'wa' : 'wa'), proj, areas: s.areas || WT_AREAS.join('\n'), kick: 'مطلوب شراء • بيع • وساطة', title: 'مطلوب', pill: 'شراء ووساطة', inl: 'في المناطق التالية' }, wtDefaults(k)), map: null, photoImg: null };
  const cv = $('wtCv'), form = pg.querySelector('.adg-form');
  const loadPhoto = () => new Promise((r) => { if (!wt.v.photo) { wt.photoImg = null; r(); return; } const im = new Image(); im.onload = () => { wt.photoImg = im; r(); }; im.onerror = () => { wt.photoImg = null; r(); }; im.src = wt.v.photo; });
  const fill = () => {
    form.querySelectorAll('[data-wt]').forEach((i) => { i.value = wt.v[i.dataset.wt] || ''; });
    $('wtAreas').value = wt.v.areas;
    form.querySelectorAll('[data-wtsz]').forEach((b) => b.classList.toggle('on', b.dataset.wtsz === wt.v.size));
    form.querySelectorAll('[data-wtth]').forEach((b) => b.classList.toggle('on', b.dataset.wtth === wt.v.theme));
    $('wtPhotoX').hidden = !wt.v.photo;
  };
  let raf = 0;
  const draw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const [w, h] = WT_SIZES[wt.v.size] || WT_SIZES.wa; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } wtDraw(cv); }); };
  await Promise.all([ayaLoad(), document.fonts.load('800 40px Tajawal', 'مطلوب 0123').catch(() => {}), document.fonts.load('500 40px Tajawal', 'مطلوب').catch(() => {}),
    Promise.all(Object.values(PZ_THEMES).map((t) => (t.logo && !t.logo.complete ? new Promise((r) => { t.logo.onload = t.logo.onerror = r; }) : null))), loadPhoto(),
    loadPlan(mp.slug, mp.map).then((P) => { wt.P = P; wt.pmap = mp.map; }).catch(() => {})]);
  if (PG !== pg) return;
  $('wtLoad').remove(); fill(); draw();
  let kt = 0; const keep = () => { clearTimeout(kt); kt = setTimeout(wtKeep, 500); };
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.wt) wt.v[t.dataset.wt] = t.value; else if (t.id === 'wtAreas') wt.v.areas = t.value; else return;
    draw(); keep();
  });
  form.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.wtsz) { wt.v.size = b.dataset.wtsz; wt.map = null; fill(); draw(); keep(); return; }
    if (b.dataset.wtth) { wtKeep(); wt.v.theme = b.dataset.wtth; Object.assign(wt.v, wtDefaults(wt.v.theme)); await loadPhoto(); fill(); draw(); keep(); return; }
    if (b.id === 'wtPhoto') { $('wtFile').click(); return; }
    if (b.id === 'wtPhotoX') { wt.v.photo = ''; wt.photoImg = null; fill(); draw(); wtKeep(); }
  });
  $('wtFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const im = new Image(), u = URL.createObjectURL(f);
    im.onload = () => {   // square, 640 px, kept on this phone for this template
      const n = Math.min(im.width, im.height), z = document.createElement('canvas'); z.width = z.height = 640;
      z.getContext('2d').drawImage(im, (im.width - n) / 2, (im.height - n) / 2, n, n, 0, 0, 640, 640); URL.revokeObjectURL(u);
      wt.v.photo = z.toDataURL('image/jpeg', 0.86); loadPhoto().then(() => { fill(); draw(); wtKeep(); });
    };
    im.onerror = () => { URL.revokeObjectURL(u); H.toast('تعذّر فتح الصورة'); }; im.src = u;
  });
  $('wtShare').onclick = () => wtOut(true); $('wtSave').onclick = () => wtOut(false);
}
export function closeAdwant(pg) { if (PG === pg) { PG = null; wt = null; } }
