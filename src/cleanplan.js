// «المخطط بدون حالات» (management only): the project's plan as a PDF — the aerial photo and the plan drawing only,
// with no available / reserved / sold colours and no prices. Drawn on the phone from the same plan files as the
// interactive plan, so it is always the latest drawing.
import { PDFDocument } from 'pdf-lib';
import { loadPlan, drawPlanBase } from './planloc.js';

const NAVY = '#0e1c36', GOLD = '#c9a14a';
const css = (c) => (Array.isArray(c) ? `rgb(${c.slice(0, 3).join(',')})` : typeof c === 'string' && c ? (c[0] === '#' || /^rgb/.test(c) ? c : '#' + c) : '');
/** the plan's colour key: every kind of plot in the project (from the plan's own types, else from its plots) */
function legendItems(p) {
  const out = new Map();
  for (const v of Object.values(p.types || {})) { const col = css(v.c), lb = [v.use, v.tag].filter(Boolean).join(' · '); if (col && lb && !out.has(lb)) out.set(lb, col); }
  if (!out.size) for (const l of p.lands || []) { const col = css(l.color), lb = [l.use, l.tag].filter(Boolean).join(' · '); if (col && lb && !out.has(lb)) out.set(lb, col); }
  return [...out].map(([label, color]) => ({ label, color }));
}
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

/** → { bytes, name, type } */
export async function buildCleanPlanPdf(p, { emblem } = {}) {
  const map = p.map; if (!map) throw new Error('لا يوجد مخطط لهذا المشروع');
  const P = await loadPlan(p.slug, map);
  // as sharp as the phone allows: up to 5200 px on the long side and ~16 million pixels in all
  const head = 0.07;                                  // title band, as a share of the plan's height
  let s = 5200 / Math.max(map.w, map.h * (1 + head));
  const area = map.w * s * map.h * (1 + head) * s; if (area > 16e6) s *= Math.sqrt(16e6 / area);
  const W = Math.round(map.w * s), PH = Math.round(map.h * s), HB = Math.max(90, Math.round(PH * head));
  // colour key band under the plan: swatches laid out right-to-left in rows
  const items = legendItems(p), fs = Math.round(HB * 0.3), sw = Math.round(fs * 1.25), gap = Math.round(fs * 1.4), padX = Math.round(HB * 0.35);
  const meas = document.createElement('canvas').getContext('2d');
  try { await document.fonts.load(`700 ${fs}px AJ`); } catch { /* system font */ }
  meas.font = `700 ${fs}px AJ, Tajawal, sans-serif`;
  const titleW = items.length ? meas.measureText('دليل الألوان:').width + gap : 0;
  const rows = []; let row = [], used = titleW;
  for (const it of items) { const w = sw + fs * 0.5 + meas.measureText(it.label).width; if (row.length && used + w > W - padX * 2) { rows.push(row); row = []; used = titleW; } row.push({ ...it, w }); used += w + gap; }
  if (row.length) rows.push(row);
  const rowH = Math.round(fs * 2.1), LB = rows.length ? rows.length * rowH + Math.round(fs * 1.2) : 0, H = HB + PH + LB;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  // title band: emblem + «مخطط <project>» + the project's place
  c.fillStyle = NAVY; c.fillRect(0, 0, W, HB); c.fillStyle = GOLD; c.fillRect(0, HB - Math.max(3, HB * 0.05), W, Math.max(3, HB * 0.05));
  const em = emblem ? await loadImg(emblem) : null; let tx = W - HB * 0.35;
  if (em) { const eh = HB * 0.72, ew = eh * em.width / em.height; c.drawImage(em, W - HB * 0.3 - ew, (HB - eh) / 2 - HB * 0.02, ew, eh); tx = W - HB * 0.3 - ew - HB * 0.3; }
  try { await document.fonts.load(`800 ${Math.round(HB * 0.36)}px AJ`); } catch { /* the system font is used */ }
  c.direction = 'rtl'; c.textAlign = 'right'; c.textBaseline = 'middle';
  c.fillStyle = '#ffffff'; c.font = `800 ${Math.round(HB * 0.36)}px AJ, Tajawal, sans-serif`; c.fillText('مخطط ' + p.name, tx, HB * (p.sub ? 0.36 : 0.48));
  if (p.sub) { c.fillStyle = '#e6c77f'; c.font = `600 ${Math.round(HB * 0.2)}px AJ, Tajawal, sans-serif`; c.fillText(p.sub, tx, HB * 0.72); }
  c.direction = 'ltr'; c.textAlign = 'left'; c.fillStyle = '#e6c77f'; c.font = `700 ${Math.round(HB * 0.22)}px AJ, Tajawal, sans-serif`;
  c.fillText('عمر الياسي للعقارات', HB * 0.35, HB * 0.48);
  // the plan itself, with nothing on top
  c.save(); c.beginPath(); c.rect(0, HB, W, PH); c.clip();
  c.fillStyle = '#EFE9DD'; c.fillRect(0, HB, W, PH);
  c.translate(0, HB); c.scale(s, s);
  drawPlanBase(c, P, map, 0, 0, map.w, map.h, s);
  c.restore();
  if (LB) {
    const y0 = HB + PH; c.fillStyle = '#ffffff'; c.fillRect(0, y0, W, LB); c.fillStyle = GOLD; c.fillRect(0, y0, W, Math.max(2, fs * 0.08));
    c.direction = 'rtl'; c.textAlign = 'right'; c.textBaseline = 'middle';
    rows.forEach((r, i) => {
      const cy = y0 + Math.round(fs * 0.6) + i * rowH + rowH / 2; let x = W - padX;
      if (i === 0) { c.fillStyle = NAVY; c.font = `800 ${fs}px AJ, Tajawal, sans-serif`; c.fillText('دليل الألوان:', x, cy); }
      x -= titleW;
      for (const it of r) {
        c.fillStyle = it.color; c.strokeStyle = 'rgba(14,28,54,.35)'; c.lineWidth = Math.max(1, fs * 0.06);
        c.beginPath(); c.roundRect(x - sw, cy - sw / 2, sw, sw, sw * 0.18); c.fill(); c.stroke();
        c.fillStyle = '#1f2937'; c.font = `700 ${fs}px AJ, Tajawal, sans-serif`; c.fillText(it.label, x - sw - fs * 0.5, cy);
        x -= it.w + gap;
      }
    });
  }
  const jpg = await new Promise((ok) => cv.toBlob((b) => ok(b), 'image/jpeg', 0.9));
  cv.width = cv.height = 1;   // free the phone's memory
  const doc = await PDFDocument.create();
  doc.setTitle('مخطط ' + p.name); doc.setAuthor('عمر الياسي للعقارات');
  const im = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
  const pw = 1684, ph = pw * H / W;                   // A2 width in points: zooms in well on a phone or prints large
  doc.addPage([pw, ph]).drawImage(im, { x: 0, y: 0, width: pw, height: ph });
  const bytes = await doc.save();
  return { bytes, name: `مخطط ${p.name.replace(/[\\/:*?"<>|]+/g, ' ').trim()} - بدون حالات.pdf`, type: 'application/pdf' };
}
