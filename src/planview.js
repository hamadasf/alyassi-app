// «المخطط التفاعلي» inside the app: the project's plan (aerial photo, line drawing, plots by status) with
// drag, pinch / wheel zoom and tap on a plot to see it and open its page. Drawn by the same code as the cards.
import { loadPlan, drawPlanView, plotAt, plotCentre } from './planloc.js';
import { planLocator } from './projmap.js';

let H = null;
export function initPlanView(h) { H = h; }

export function planViewPage(p) {
  const { esc } = H;
  return `<div class="pview">
    <canvas class="pvcv"></canvas>
    <div class="pvload"><i class="spin"></i><span>جارِ تحميل المخطط…</span></div>
    <div class="pvtop"><div class="pvleg"><span><i class="av"></i>متاح ${p.available}</span><span><i class="res"></i>محجوز ${p.reserved}</span><span><i class="sold"></i>مباع ${p.sold}</span></div>
      <button class="pvweb" data-web="${esc(p.plan)}" aria-label="فتح في الموقع">${H.I.globe}</button></div>
    <div class="pvzoom"><button data-z="in" aria-label="تكبير">＋</button><button data-z="out" aria-label="تصغير">－</button><button data-z="fit" aria-label="عرض الكل">⤢</button><button data-z="me" class="pvme" aria-label="موقعي على المخطط">${H.I.pin}</button></div>
    <div class="pvmetip" hidden></div>
    <div class="pvcard" hidden></div>
  </div>`;
}

export async function initPlanView2(pg, p, focusN) {
  const { esc, money } = H;
  pg.classList.add('pvpg');
  const box = pg.querySelector('.pview'), cv = pg.querySelector('.pvcv'), card = pg.querySelector('.pvcard');
  const ctx = cv.getContext('2d'), map = p.map; let lands = p.lands;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  let W = 0, Hh = 0, P = null;
  const view = { x0: 0, y0: 0, ppu: 1 };
  let sel = focusN ? lands.find((l) => l.n === String(focusN)) || null : null;
  if (focusN && !sel) {   // a plot the company does not list (from the search): only its centre is known
    const na = (p.na || []).find((x) => String(x[0]) === String(focusN));
    if (na && na[3]) sel = { id: p.slug + ':' + na[0], n: String(na[0]), ft: na[2], pc: na[3], poly: null, status: 'na', use: ((p.types || {})[na[1]] || {}).use || '' };
  }
  let snap = null, snapView = null, idleT = 0;
  // «أنا فين؟»: the phone's place as a blue dot on the plan (with how sure the phone is), and the nearest plot
  let me = null, watch = null, loc = null, centred = false;
  const tip = pg.querySelector('.pvmetip');
  const meDot = () => {
    if (!me) return;
    const x = (me.x - view.x0) * view.ppu, y = (me.y - view.y0) * view.ppu, r = Math.max(9 * dpr, me.r * view.ppu);
    ctx.save(); ctx.fillStyle = 'rgba(37,99,235,.14)'; ctx.strokeStyle = 'rgba(37,99,235,.45)'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6 * dpr; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 9 * dpr, 0, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(x, y, 6.5 * dpr, 0, 7); ctx.fill(); ctx.restore();
  };
  const nearest = (x, y) => {
    let best = null, bd = Infinity;
    for (const l of lands) { const c = l.pc || (l.poly && plotCentre(l)); if (!c) continue; const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = { n: l.n, l }; } }
    for (const q of p.na || []) { if (!q[3]) continue; const d = Math.hypot(q[3][0] - x, q[3][1] - y); if (d < bd) { bd = d; best = { n: String(q[0]) }; } }
    return best && bd < plotR * 4 ? best : null;
  };
  const say = (t) => { tip.innerHTML = t; tip.hidden = !t; };
  const stopMe = () => { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; me = null; centred = false; say(''); pg.querySelector('.pvme').classList.remove('on'); full(); };
  const whereAmI = async (btn) => {
    if (watch !== null) { stopMe(); return; }
    if (!navigator.geolocation) { H.toast('الموقع غير متاح على هذا الجهاز'); return; }
    say('<i class="spin"></i> جارِ تحديد موقعك…'); btn.classList.add('on');
    try { loc = loc || await planLocator(p); } catch { loc = null; }
    if (!loc) { say(''); btn.classList.remove('on'); H.toast('لم يُحدَّد موقع هذا المشروع على الخريطة بعد — تحدده الإدارة من «خريطة المشاريع»'); return; }
    watch = navigator.geolocation.watchPosition((pos) => {
      if (!pg.isConnected) { navigator.geolocation.clearWatch(watch); watch = null; return; }   // the plan was closed
      const { latitude: la, longitude: lo, accuracy: acc } = pos.coords;
      const q = loc(la, lo), q2 = loc(la + Math.min(acc || 10, 200) / 111320, lo); if (!q) return;
      me = { x: q[0], y: q[1], r: q2 ? Math.hypot(q2[0] - q[0], q2[1] - q[1]) : 0 };
      const out = q[0] < -map.w * 0.15 || q[1] < -map.h * 0.15 || q[0] > map.w * 1.15 || q[1] > map.h * 1.15;
      if (out) { say('📍 أنت خارج المشروع حالياً — افتح المخطط وأنت في الموقع'); if (!centred) { fit(); clamp(); } }
      else {
        const nb = nearest(q[0], q[1]);
        say(nb ? `📍 أنت بجوار القطعة <b>${esc(nb.n)}</b>${nb.l ? ` <button class="pvmego" data-land="${esc(nb.l.id)}">التفاصيل</button>` : ''}` : '📍 هذا موقعك على المخطط');
        if (!centred) { view.ppu = Math.max(view.ppu, Math.min(maxPpu(), Math.min(W / 220, Hh / 180))); view.x0 = q[0] - W / 2 / view.ppu; view.y0 = q[1] - Hh / 2 / view.ppu; clamp(); }
      }
      centred = true; full();
    }, (err) => { stopMe(); H.toast(err && err.code === 1 ? 'اسمح للتطبيق بالوصول إلى موقعك من إعدادات الجهاز' : 'تعذّر تحديد موقعك — حاول في مكان مفتوح'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };
  // a plot the company does not offer: only its centre is known → the nearest centre within about a plot's size
  const plotR = (() => { const a = lands.filter((l) => l.poly && l.poly.length > 2).slice(0, 40).map((l) => { let s = 0; const q = l.poly; for (let i = 0, j = q.length - 1; i < q.length; j = i++) s += (q[j][0] + q[i][0]) * (q[j][1] - q[i][1]); return Math.abs(s / 2); }).sort((x, y) => x - y); return a.length ? Math.sqrt(a[a.length >> 1]) * 0.65 : 0; })();
  const naAt = (px, py) => {
    let best = null, bd = Infinity;
    for (const x of p.na || []) { if (!x[3]) continue; const d = Math.hypot(x[3][0] - px, x[3][1] - py); if (d < bd) { bd = d; best = x; } }
    const lim = Math.max(plotR, 26 * dpr / view.ppu);
    return best && bd <= lim ? { id: p.slug + ':' + best[0], n: String(best[0]), ft: best[2], pc: best[3], poly: null, status: 'na', use: ((p.types || {})[best[1]] || {}).use || '' } : null;
  };

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
    if (!(W > 0 && Hh > 0) || !cv.width || !cv.height) return;   // the page is closing (no size)
    drawPlanView(ctx, P, lands, map, { w: W, h: Hh, ...view, sel }); meDot();
    snap = snap || document.createElement('canvas'); snap.width = W; snap.height = Hh; snap.getContext('2d').drawImage(cv, 0, 0); snapView = { ...view };
  };
  // a plot saved meanwhile (here or by «إضافة / تعديل قطعة»): the plan shows it at once
  pg.addEventListener('oay:refresh', () => {
    const np = H.project && H.project(p.slug); if (!np || !cv.width) return;
    p = np; lands = p.lands; if (sel && sel.n) sel = lands.find((l) => l.n === sel.n) || sel; full();
  });
  let raf = 0;
  const quick = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (!snap) { full(); return; }
      const k = view.ppu / snapView.ppu;
      ctx.fillStyle = '#EFE9DD'; ctx.fillRect(0, 0, W, Hh);
      ctx.drawImage(snap, (snapView.x0 - view.x0) * view.ppu, (snapView.y0 - view.y0) * view.ppu, W * k, Hh * k); meDot();
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
    const st = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة', na: 'غير متوفرة' }[sel.status] || '';
    card.innerHTML = `<button class="pvx" aria-label="إغلاق">✕</button>
      <div class="pvc1"><b>قطعة رقم ${esc(sel.n)}</b><span class="pvst ${sel.status}">${st}</span></div>
      ${H.guest && H.guest() ? `<button class="btn primary block" data-signin="land">${H.I.lock} سجّل لعرض تفاصيل القطعة</button>` : `<div class="pvc2"><span>${esc(sel.use || '')}</span><span>${sel.ft ? money(sel.ft) + ' قدم²' : ''}</span>${sel.status !== 'sold' && sel.total ? `<b>${money(sel.total)} د.إ</b>` : ''}</div>
      <button class="btn primary block" data-land="${esc(sel.id)}">تفاصيل الأرض</button>`}
      ${H.canDesign && H.canDesign() && (sel.poly || sel.pc) ? `<button class="btn adgbtn block" data-adgen="${esc(sel.id)}">${H.I.image} تصميم بوست</button>` : ''}
      ${H.canPlots && H.canPlots() ? `<button class="btn ${sel.status === 'na' ? 'primary' : 'ghost'} block pvedit" data-plotedit="${esc(p.slug + '|' + sel.n)}">${sel.status === 'na' ? (H.I.plusc || '') + ' إضافة القطعة للبيع' : (H.I.edit || '') + ' تعديل الحالة والسعر والدفعات'}</button>` : ''}`;
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
      let hit = plotAt(lands, px, py);
      if (!hit) {   // a plot just listed whose outline is not in this data yet: the nearest centre
        let bd = Infinity, b = null; for (const l of lands) { if (l.poly || !l.pc) continue; const d = Math.hypot(l.pc[0] - px, l.pc[1] - py); if (d < bd) { bd = d; b = l; } }
        if (b && bd <= Math.max(plotR, 26 * dpr / view.ppu)) hit = b;
      }
      if (!hit && H.canPlots && H.canPlots()) hit = naAt(px, py);   // the office: any plot of the plan, offered or not
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
    if (z.dataset.z === 'me') { whereAmI(z); return; }
    if (z.dataset.z === 'fit') { fit(); clamp(); full(); return; }
    zoomAt(W / 2, Hh / 2, z.dataset.z === 'in' ? 1.6 : 1 / 1.6);
  });
  new ResizeObserver(() => { const old = { w: W, h: Hh }; resize(); if (!P || !old.w || !W || !Hh) return; view.x0 += (old.w - W) / 2 / view.ppu; view.y0 += (old.h - Hh) / 2 / view.ppu; clamp(); full(); }).observe(box);

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
