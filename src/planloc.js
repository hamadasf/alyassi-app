// The plot's location on its project plan: a zoomed crop of the plan image with the plot outlined.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { SITE } from './config.js';

const native = Capacitor.isNativePlatform();

/** Visible window (plan coordinates) around the plot, with the given width/height ratio. */
export function planWindow(poly, map, aspect) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = Math.max(x1 - x0, y1 - y0, 10);
  let w = Math.min(Math.max(s * 6.5, 200), map.w), h = w / aspect;
  if (h > map.h) { h = map.h; w = h * aspect; }
  const x = Math.min(Math.max(cx - w / 2, 0), Math.max(0, map.w - w));
  const y = Math.min(Math.max(cy - h / 2, 0), Math.max(0, map.h - h));
  return { x, y, w, h, cx, cy };
}

const pts = (poly) => poly.map((p) => p.join(',')).join(' ');

/** Inline SVG for the plot page (the plan image is shown as-is, no canvas needed). */
export function planLocHTML(l, map, esc) {
  if (!map || !l.poly || l.poly.length < 3) return '';
  const v = planWindow(l.poly, map, 4 / 3);
  const k = v.w / 400;   // keep line widths constant on screen
  return `<svg class="planloc-svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="موقع القطعة على مخطط المشروع">
      <image href="${esc(map.bg)}" x="0" y="0" width="${map.w}" height="${map.h}" preserveAspectRatio="none"/>
      <polygon points="${pts(l.poly)}" fill="rgba(220,38,38,.38)" stroke="#dc2626" stroke-width="${3 * k}" stroke-linejoin="round"/>
      <circle cx="${v.cx}" cy="${v.cy}" r="${26 * k}" fill="none" stroke="#dc2626" stroke-width="${2 * k}" opacity=".55"><animate attributeName="r" values="${14 * k};${40 * k}" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;0" dur="1.6s" repeatCount="indefinite"/></circle>
    </svg>`;
}

/* ---- plan image as a same-origin image, so it can be drawn into the PDF card ---- */
const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
export async function loadPlanImage(project, map) {
  try {
    let blob;
    if (native) {
      const r = await CapacitorHttp.request({ url: map.bg, method: 'GET', responseType: 'arraybuffer', readTimeout: 30000 });
      if (r.status >= 300) return null;
      blob = new Blob([typeof r.data === 'string' ? b64ToBytes(r.data) : r.data], { type: 'image/jpeg' });
    } else {
      const r = await fetch(`${SITE}/wp-admin/admin-ajax.php?action=oay_img&project=${encodeURIComponent(project)}`, { cache: 'force-cache' });
      if (!r.ok) return null;
      blob = await r.blob();
    }
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url; await img.decode();
    return img;
  } catch { return null; }
}

/** Draws the zoomed plan crop with the plot outlined into a canvas box. */
export function drawPlanLoc(ctx, img, l, map, box, label) {
  const v = planWindow(l.poly, map, box.w / box.h);
  const sx = img.naturalWidth / map.w, sy = img.naturalHeight / map.h;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 24); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, v.x * sx, v.y * sy, v.w * sx, v.h * sy, box.x, box.y, box.w, box.h);
  const k = box.w / v.w;
  const P = (p) => [box.x + (p[0] - v.x) * k, box.y + (p[1] - v.y) * k];
  ctx.beginPath(); l.poly.forEach((p, i) => { const [a, b] = P(p); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.closePath();
  ctx.fillStyle = 'rgba(220,38,38,.38)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#dc2626'; ctx.lineJoin = 'round'; ctx.stroke();
  // label pin above the plot
  const [cx, cy] = P([v.cx, v.cy]);
  const ys = l.poly.map((p) => P(p)[1]); const top = Math.min(...ys);
  ctx.font = '800 34px Tajawal, Arial, sans-serif'; ctx.direction = 'rtl';
  const tw = ctx.measureText(label).width + 44, th = 60, ly = Math.max(box.y + 14, top - th - 26);
  ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.roundRect(cx - tw / 2, ly, tw, th, 30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 14, ly + th - 1); ctx.lineTo(cx + 14, ly + th - 1); ctx.lineTo(cx, ly + th + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, cx, ly + th / 2 + 2);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = '#e6e9ef'; ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 24); ctx.stroke();
}
