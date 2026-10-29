// «المخطط التفاعلي» inside the app: the project's plan (aerial photo, line drawing, plots by status) with
// drag, pinch / wheel zoom and tap on a plot to see it and open its page. Drawn by the same code as the cards.
import { loadPlan, drawPlanView, plotAt, plotCentre } from './planloc.js';

let H = null;
export function initPlanView(h) { H = h; }

export function planViewPage(p) {
  const { esc } = H;
  return `<div class="pview">
    <canvas class="pvcv"></canvas>
    <div class="pvload"><i class="spin"></i><span>جارِ تحميل المخطط…</span></div>
    <div class="pvtop"><div class="pvleg"><span><i class="av"></i>متاح ${p.available}</span><span><i class="res"></i>محجوز ${p.reserved}</span><span><i class="sold"></i>مباع ${p.sold}</span></div>
      <button class="pvweb" data-web="${esc(p.plan)}" aria-label="فتح في الموقع">${H.I.globe}</button></div>
    <div class="pvzoom"><button data-z="in" aria-label="تكبير">＋</button><button data-z="out" aria-label="تصغير">－</button><button data-z="fit" aria-label="عرض الكل">⤢</button></div>
    <div class="pvcard" hidden></div>
  </div>`;
}

export async function initPlanView2(pg, p, focusN) {
  const { esc, money } = H;
  pg.classList.add('pvpg');
  const box = pg.querySelector('.pview'), cv = pg.querySelector('.pvcv'), card = pg.querySelector('.pvcard');
  const ctx = cv.getContext('2d'), map = p.map, lands = p.lands;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let W = 0, Hh = 0, P = null;
  const view = { x0: 0, y0: 0, ppu: 1 };
  let sel = focusN ? lands.find((l) => l.n === String(focusN)) || null : null;
  let snap = null, snapView = null, idleT = 0;

  const resize = () => { const r = box.getBoundingClientRect(); W = Math.round(r.width * dpr); Hh = Math.round(r.height * dpr); cv.width = W; cv.height = Hh; };
  const minPpu = () => Math.min(W / map.w, Hh / map.h) * 0.9;
  const maxPpu = () => 40 * dpr;
  const fit = () => { view.ppu = minPpu(); view.x0 = map.w / 2 - W / 2 / view.ppu; view.y0 = map.h / 2 - Hh / 2 / view.ppu; };
  const focus = (l) => { const [cx, cy] = plotCentre(l); view.ppu = Math.min(maxPpu(), Math.max(minPpu(), Math.min(W / 150, Hh / 120))); view.x0 = cx - W / 2 / view.ppu; view.y0 = cy - Hh / 2 / view.ppu; };
  const clamp = () => {
    view.ppu = Math.max(minPpu(), Math.min(maxPpu(), view.ppu));
    const vw = W / view.ppu, vh = Hh / view.ppu, m = 0.25;
    view.x0 = Math.max(-vw * m - (vw > map.w ? (vw - map.w) / 2 : 0), Math.min(map.w - vw * (1 - m) + (vw > map.w ? (vw - map.w) / 2 : 0), view.x0));
    view.y0 = Math.max(-vh * m - (vh > map.h ? (vh - map.h) / 2 : 0), Math.min(map.h - vh * (1 - m) + (vh > map.h ? (vh - map.h) / 2 : 0), view.y0));
  };
  // full drawing (aerial photo + line drawing + plots); while the finger moves, the last drawing is just moved/scaled
  const full = () => {
    drawPlanView(ctx, P, lands, map, { w: W, h: Hh, ...view, sel });
    snap = snap || document.createElement('canvas'); snap.width = W; snap.height = Hh; snap.getContext('2d').drawImage(cv, 0, 0); snapView = { ...view };
  };
  let raf = 0;
  const quick = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!snap) { full(); return; }
      const k = view.ppu / snapView.ppu;
      ctx.fillStyle = '#EFE9DD'; ctx.fillRect(0, 0, W, Hh);
      ctx.drawImage(snap, (snapView.x0 - view.x0) * view.ppu, (snapView.y0 - view.y0) * view.ppu, W * k, Hh * k);
    });
    clearTimeout(idleT); idleT = setTimeout(full, 140);
  };
  const zoomAt = (sx, sy, f) => {
    const px = view.x0 + sx / view.ppu, py = view.y0 + sy / view.ppu;
    view.ppu *= f; clamp();
    view.x0 = px - sx / view.ppu; view.y0 = py - sy / view.ppu; clamp(); quick();
  };
  const showCard = () => {
    card.hidden = !sel;
    if (!sel) return;
    const st = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة' }[sel.status] || '';
    card.innerHTML = `<button class="pvx" aria-label="إغلاق">✕</button>
      <div class="pvc1"><b>قطعة رقم ${esc(sel.n)}</b><span class="pvst ${sel.status}">${st}</span></div>
      <div class="pvc2"><span>${esc(sel.use || '')}</span><span>${sel.ft ? money(sel.ft) + ' قدم²' : ''}</span>${sel.status !== 'sold' && sel.total ? `<b>${money(sel.total)} د.إ</b>` : ''}</div>
      <button class="btn primary block" data-land="${esc(sel.id)}">تفاصيل الأرض</button>`;
    card.querySelector('.pvx').onclick = (e) => { e.stopPropagation(); sel = null; showCard(); full(); };
  };

  // gestures: one finger drags, two fingers pinch, a tap picks a plot
  const pts = new Map(); let start = null, moved = false, pinch = null;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, x0: view.x0, y0: view.y0 }; moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ppu: view.ppu }; moved = true; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = cv.getBoundingClientRect();
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = ((a.x + b.x) / 2 - r.left) * dpr, my = ((a.y + b.y) / 2 - r.top) * dpr;
      zoomAt(mx, my, (pinch.ppu * d / pinch.d) / view.ppu);
    } else if (start) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) { view.x0 = start.x0 - dx * dpr / view.ppu; view.y0 = start.y0 - dy * dpr / view.ppu; clamp(); quick(); }
    }
  });
  const up = (e) => {
    const r = cv.getBoundingClientRect();
    if (pts.size === 1 && !moved && start) {
      const px = view.x0 + (e.clientX - r.left) * dpr / view.ppu, py = view.y0 + (e.clientY - r.top) * dpr / view.ppu;
      const hit = plotAt(lands, px, py);
      sel = hit; showCard(); full();
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const [a] = [...pts.values()]; start = { x: a.x, y: a.y, x0: view.x0, y0: view.y0 }; }
    if (!pts.size) start = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
  let lastTap = 0;
  cv.addEventListener('pointerup', (e) => { const t = Date.now(); if (t - lastTap < 300 && !moved) { const r = cv.getBoundingClientRect(); zoomAt((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, 2); } lastTap = t; });
  pg.querySelector('.pvzoom').addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]'); if (!z) return; e.stopPropagation();
    if (z.dataset.z === 'fit') { fit(); clamp(); full(); return; }
    zoomAt(W / 2, Hh / 2, z.dataset.z === 'in' ? 1.6 : 1 / 1.6);
  });
  new ResizeObserver(() => { const old = { w: W, h: Hh }; resize(); if (!P || !old.w) return; view.x0 += (old.w - W) / 2 / view.ppu; view.y0 += (old.h - Hh) / 2 / view.ppu; clamp(); full(); }).observe(box);

  resize();
  try {
    P = await loadPlan(p.slug, map);
    await document.fonts.load('800 20px Tajawal', '0123').catch(() => {});
  } catch {
    pg.querySelector('.pvload').innerHTML = `<span>تعذّر تحميل المخطط</span><button class="btn ghost" data-web="${esc(p.plan)}">فتح في الموقع</button>`;
    return;
  }
  pg.querySelector('.pvload').remove();
  if (sel) focus(sel); else fit();
  clamp(); full(); showCard();
}
