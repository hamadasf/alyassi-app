// The plot's location on its project plan, drawn exactly like the website's interactive plan:
// aerial photo → the plan's line drawing (vector) → plots coloured by status with number and area/status → frame on the plot.
// The drawing code follows the website's own plan viewer (alyassi-dabdaba-plan/assets/app.js).
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SITE } from './config.js';

const native = Capacitor.isNativePlatform();
const COL = { av: '#12243F', res: '#00A040', sold: '#E10600' };   // same colours as the website
const ST = { av: 'متاح', res: 'محجوز', sold: 'مباع' };
const INK = '#10151C', WHITE = '#FFFFFF', HL = '#00E1FF';   // HL: the highlighted plot (a colour the plans never use)
const FONT = "Tajawal, 'Segoe UI', Tahoma, sans-serif";
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

/* ---------- loading the plan files (cached per project) ---------- */
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function getBytes(project, kind, directUrl) {
  if (native) {
    if (!directUrl) return null;
    const r = await CapacitorHttp.request({ url: directUrl, method: 'GET', responseType: 'arraybuffer', readTimeout: 40000, connectTimeout: 15000 });
    if (r.status >= 300) return null;
    return typeof r.data === 'string' ? b64ToBytes(r.data) : new Uint8Array(r.data);
  }
  const r = await fetch(`${SITE}/wp-admin/admin-ajax.php?action=oay_img&project=${encodeURIComponent(project)}&kind=${kind}`, { cache: 'force-cache' });
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}
async function bytesToImg(u8) {
  if (!u8 || u8[0] !== 0xFF || u8[1] !== 0xD8) return null;   // must be a JPEG
  const img = new Image(); img.src = URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' }));
  try { await img.decode(); return img; } catch { return null; }
}

function decodeVec(u, VQ) {
  let i = 0;
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
  if (i !== u.length || oi !== nOps || pi !== nPts * 2) throw new Error('vec');
  const end = new Uint32Array(n);
  for (let k = 0, on = -1; k < n; k++) { if (st[k] === 254) on = k; else if (st[k] === 255 && on >= 0) { end[on] = k; on = -1; } }
  return { n, st, o0, p0, bb, ops, xy, end };
}

// vec.z files are gzip: unpack with the browser's own decompressor
async function gunzipIfNeeded(u8) {
  if (!(u8[0] === 0x1f && u8[1] === 0x8b)) return u8;
  if (typeof DecompressionStream !== 'function') throw new Error('gz');
  const buf = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new Uint8Array(buf);
}

const cache = new Map();
/** { img, V, VS } for a project — aerial photo (full size when available) and decoded line drawing. */
export function loadPlan(project, map) {
  if (!map) return Promise.resolve(null);
  if (!cache.has(project)) {
    cache.set(project, (async () => {
      const [raw, vec] = await Promise.all([
        getBytes(project, 'bgraw', map.bgRaw).catch(() => null),
        getBytes(project, 'vec', map.vec).catch(() => null),
      ]);
      let img = await bytesToImg(raw);
      if (!img) img = await bytesToImg(await getBytes(project, 'bg', map.bg).catch(() => null));
      let V = null;
      try { if (vec) V = decodeVec(await gunzipIfNeeded(vec), map.vq || 50); } catch { V = null; }
      const VS = (map.vs || []).map((s) => Object.assign({ css: `rgb(${s.c.join(',')})` }, s));
      if (!img && !V) throw new Error('plan');
      return { img, V, VS };
    })().catch((e) => { cache.delete(project); throw e; }));
  }
  return cache.get(project);
}

function trace(c, V, k) {
  const { o0, p0, ops, xy } = V; let j = p0[k];
  for (let o = o0[k], e = o0[k + 1]; o < e; o++) {
    const code = ops[o];
    if (code === 1) { c.lineTo(xy[j], xy[j + 1]); j += 2; }
    else if (code === 2) { c.bezierCurveTo(xy[j], xy[j + 1], xy[j + 2], xy[j + 3], xy[j + 4], xy[j + 5]); j += 6; }
    else if (code === 0) { c.moveTo(xy[j], xy[j + 1]); j += 2; }
    else c.closePath();
  }
}
function drawVec(c, V, VS, rx0, ry0, rx1, ry1, ppu) {
  const { n, st, o0, bb, end } = V, tiny = 2.4 / ppu, dot = 0.4 / ppu, hair = 0.8 / ppu;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'butt';
  let open = -1;
  const flush = () => { if (open >= 0) { c.stroke(); open = -1; } };
  for (let k = 0; k < n; k++) {
    const b = k * 4, id = st[k];
    if (id === 255) { flush(); c.restore(); continue; }
    if (id === 254) {
      flush();
      if (bb[b] > rx1 || bb[b + 2] < rx0 || bb[b + 1] > ry1 || bb[b + 3] < ry0) { k = end[k]; continue; }
      c.save(); c.beginPath(); trace(c, V, k); c.clip('evenodd'); continue;
    }
    const s = VS[id]; if (!s) continue;
    const pad = s.w || 0;
    if (bb[b] - pad > rx1 || bb[b + 2] + pad < rx0 || bb[b + 1] - pad > ry1 || bb[b + 3] + pad < ry0) continue;
    const size = Math.max(bb[b + 2] - bb[b], bb[b + 3] - bb[b + 1]);
    if (s.t === 'f') {
      if (size < tiny) continue;
      flush(); c.beginPath(); trace(c, V, k); c.fillStyle = s.css; c.fill('evenodd');
    } else {
      if (size < (o0[k + 1] - o0[k] > 2 ? tiny : dot)) continue;
      if (open !== st[k]) { flush(); open = st[k]; c.beginPath(); c.strokeStyle = s.css; c.lineWidth = Math.max(s.w, hair); c.setLineDash(s.d || []); c.lineDashOffset = s.ph || 0; }
      trace(c, V, k);
    }
  }
  flush(); c.restore();
}

const poly = (c, pts) => { c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); };
const centre = (l) => l.pc || [l.poly.reduce((a, q) => a + q[0], 0) / l.poly.length, l.poly.reduce((a, q) => a + q[1], 0) / l.poly.length];

/**
 * Draws the plan around `land` into the W×H pixel box at (x, y) of context `c`.
 * `lands` = every listed plot of the project (coloured by status, like the website).
 */
export function drawPlanLoc(c, P, land, lands, map, { x = 0, y = 0, w, h, radius = 0 }) {
  const [cx, cy] = centre(land);
  // same framing as the website's «focus on a plot» (140 × 110 plan units around it), widened to the box's shape
  let vw = 140, vh = 110;
  if (vw / vh < w / h) vw = vh * w / h; else vh = vw * h / w;
  const ppu = w / vw;
  const x0 = cx - vw / 2, y0 = cy - vh / 2, x1 = x0 + vw, y1 = y0 + vh;
  c.save();
  c.beginPath(); if (radius) c.roundRect(x, y, w, h, radius); else c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#EFE9DD'; c.fillRect(x, y, w, h);
  c.translate(x, y); c.scale(ppu, ppu); c.translate(-x0, -y0);
  if (P.img) { c.imageSmoothingQuality = 'high'; c.drawImage(P.img, 0, 0, map.w, map.h); }
  if (P.V) drawVec(c, P.V, P.VS, x0, y0, x1, y1, ppu);
  // plots with a status, as on the website
  for (const l of lands) {
    if (!l.poly || !COL[l.status] || l === land || l.id === land.id) continue;
    const xs = l.poly.map((q) => q[0]), ys = l.poly.map((q) => q[1]);
    if (Math.max(...xs) < x0 || Math.min(...xs) > x1 || Math.max(...ys) < y0 || Math.min(...ys) > y1) continue;
    poly(c, l.poly); c.fillStyle = COL[l.status]; c.fill(); c.lineWidth = 1.1; c.strokeStyle = WHITE; c.lineJoin = 'round'; c.stroke();
    const [px, py] = centre(l);
    c.save(); c.translate(px, py); c.rotate((l.pr || 0) * Math.PI / 180);
    c.fillStyle = WHITE; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.direction = 'rtl';
    c.font = `800 4.5px ${FONT}`; c.fillText(l.n, 0, 0.7);
    c.font = `700 2.5px ${FONT}`; c.fillText(l.status === 'av' ? fmt(l.ft) : ST[l.status], 0, 4.1);
    c.restore();
  }
  // the chosen plot, highlighted: bright cyan with a glow, so it stands out among the plots around it
  c.save();
  poly(c, land.poly); c.lineJoin = 'round';
  c.shadowColor = 'rgba(0, 225, 255, 1)'; c.shadowBlur = 14 * ppu; c.fillStyle = HL; c.fill();
  c.shadowBlur = 0;
  c.lineWidth = 3; c.strokeStyle = WHITE; c.stroke();
  c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
  c.restore();
  const [hx, hy] = centre(land);
  c.save(); c.translate(hx, hy); c.rotate((land.pr || 0) * Math.PI / 180);
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.direction = 'rtl';
  c.font = `800 4.8px ${FONT}`; c.fillText(land.n, 0, 0.8);
  c.font = `700 2.6px ${FONT}`; c.fillText(fmt(land.ft), 0, 4.3);
  c.restore();
  c.restore();
}

/** Plot page: renders into a <canvas> once the plan files are in. */
export async function paintPlanLoc(canvas, land, lands, map) {
  const P = await loadPlan(land.project, map);
  await document.fonts.load(`800 20px Tajawal`, '0123').catch(() => {});
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  canvas.width = w; canvas.height = h;
  drawPlanLoc(canvas.getContext('2d'), P, land, lands, map, { w, h });
}

/* ---------- land cards: the plot on its plan instead of a stock photo (drawn when the card scrolls into view) ---------- */
const shots = new Map();   // land key → finished bitmap (canvas), so lists re-render instantly
export async function paintCardLoc(canvas, land, lands, map) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  const key = `${land.project}:${land.n}:${land.status}:${lands.map((l) => l.status[0]).join('')}:${w}x${h}`;
  let off = shots.get(key);
  if (!off) {
    const P = await loadPlan(land.project, map);
    await document.fonts.load('800 20px Tajawal', '0123').catch(() => {});
    off = document.createElement('canvas'); off.width = w; off.height = h;
    drawPlanLoc(off.getContext('2d'), P, land, lands, map, { w, h });
    shots.set(key, off);
  }
  canvas.width = w; canvas.height = h; canvas.getContext('2d').drawImage(off, 0, 0);
}
