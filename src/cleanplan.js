// «المخطط بدون حالات» (management only): the project's plan as a PDF — the aerial photo and the plan drawing only,
// with no available / reserved / sold colours and no prices. Drawn on the phone from the same plan files as the
// interactive plan, so it is always the latest drawing.
import { PDFDocument } from 'pdf-lib';
import { loadPlan, drawPlanBase } from './planloc.js';

const NAVY = '#0e1c36', GOLD = '#c9a14a';
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

/** → { bytes, name, type } */
export async function buildCleanPlanPdf(p, { emblem } = {}) {
  const map = p.map; if (!map) throw new Error('لا يوجد مخطط لهذا المشروع');
  const P = await loadPlan(p.slug, map);
  // as sharp as the phone allows: up to 5200 px on the long side and ~16 million pixels in all
  const head = 0.07;                                  // title band, as a share of the plan's height
  let s = 5200 / Math.max(map.w, map.h * (1 + head));
  const area = map.w * s * map.h * (1 + head) * s; if (area > 16e6) s *= Math.sqrt(16e6 / area);
  const W = Math.round(map.w * s), PH = Math.round(map.h * s), HB = Math.max(90, Math.round(PH * head)), H = PH + HB;
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
