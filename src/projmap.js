// «الخريطة»: every project as a pin on a map (Leaflet, loaded only when the page opens). The website works out each
// project's coordinates once from its Google Maps link (proj_geo) and the phone keeps them.
import { api } from './owner.js';
import { loadPlan, drawPlanView } from './planloc.js';
import { rawPlots, projectParts } from './data.js';

let H = null;
export function initProjMap(h) { H = h; }
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem('oay:' + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('oay:' + k, JSON.stringify(v)); } catch { /* private mode */ } };

let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return leafletP || (leafletP = new Promise((ok, no) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'leaflet/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'leaflet/leaflet.js'; js.onload = () => ok(window.L); js.onerror = () => { leafletP = null; no(new Error('map')); }; document.head.appendChild(js);
  }));
}
/** coordinates of the projects: [slug] → [lat, lng] — kept on this phone, asked again from the website every hour (the
 *  website reads each project's Google Maps link, finds named places, and the admin's own pins win) */
async function coords(projects, force) {
  const have = lsGet('pgeo2', {}), at = lsGet('pgeoAt', 0);
  const stale = force || Date.now() - at > 3600e3 || projects.some((p) => !have[p.key] || have[p.key].loc !== (p.loc || ''));
  if (stale) {
    try {
      const j = await api('proj_geo', { items: projects.slice(0, 60).map((p) => ({ slug: p.key, loc: p.loc || '' })) });
      for (const p of projects) { const I = j.items || {}, pinned = j.pinned || [];   // a part not placed by hand yet starts where the whole project was placed
        const c = p.part && !pinned.includes(p.key) && pinned.includes(p.slug) ? I[p.slug] : I[p.key]; have[p.key] = { loc: p.loc || '', c: c || (have[p.key] && have[p.key].loc === (p.loc || '') ? have[p.key].c : null) }; }
      lsSet('pgeo2', have); lsSet('pgeoAt', Date.now());
    } catch { /* offline: show what we have */ }
  }
  return have;
}

/* ---- the project's own plan laid on the map at its real size (from the plots' areas), turned as the admin set it ---- */
function planMpp(p) {   // metres per plan unit, from the plots whose area is known
  const r = [];
  for (const l of p.all || p.lands || []) {   // a part: the whole project's plots (both parts at one scale)
    if (!l.poly || l.poly.length < 3 || !(+l.ft > 0)) continue;
    let a = 0; for (let i = 0, j = l.poly.length - 1; i < l.poly.length; j = i++) a += (l.poly[j][0] + l.poly[i][0]) * (l.poly[j][1] - l.poly[i][1]);
    a = Math.abs(a / 2); if (a > 4) r.push(Math.sqrt(l.ft * 0.09290304 / a));
  }
  if (!r.length) return 0; r.sort((a, b) => a - b); return r[r.length >> 1];
}
/* the project on the map: its plots alone (no plan picture, no rectangle) — each in its kind's colour, the listed ones in
   their status colour, on a see-through picture */
const SCOL = { av: [22, 163, 74], res: [217, 119, 6], sold: [220, 38, 38] };
/* one set of colours for the same kind of place in every project: gardens green, mosques and services light blue,
   shops red; homes yellow — a plan that marks its homes in a dark or blue colour (مزيرعة) gets the same yellow as the others */
const GREEN = [112, 186, 88], BLUE = [150, 205, 236], SHOP = [200, 30, 40], HOME = [255, 215, 0], HOME2 = [218, 165, 32];
const FILL_AS = { muzaira: { '178,178,177': GREEN } };
const NAMED = { green: GREEN, park: GREEN, garden: GREEN, blue: BLUE, mosque: BLUE, svc: BLUE };
const darkHome = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 < 0.5 || c[2] > c[0] + 30;
const isHome = (y) => y && y.c && /سكن/.test(String(y.use || y.name || '')) && !/تجار|مكاتب|شقق/.test(String(y.use || y.name || ''));
/** a plan whose homes are all in dark or blue colours (مزيرعة): drawn in the others' yellow */
const hasYellow = (p) => { const H = Object.values(p.types || {}).filter(isHome); return !H.length || !H.every((y) => darkHome(y.c)); };
function kindCol(p, t) {
  if (NAMED[t]) return NAMED[t];
  const ty = p.types && p.types[t], u = ty ? String(ty.use || ty.name || '') : '', c = ty && ty.c;
  if (/حديق|منتزه|park|garden/i.test(u)) return GREEN;
  if (/مسجد|مصل|خدمات|مرافق/i.test(u)) return BLUE;
  if (/^محلات/.test(u)) return SHOP;
  if (c && /سكن/.test(u) && !/تجار|مكاتب|شقق/.test(u) && !hasYellow(p)) {   // only a plan with no yellow homes at all (مزيرعة)
    return /^a?g/.test(t) ? HOME2 : HOME;
  }
  return c || [242, 205, 70];
}
async function plotOutlines(p) {
  const raw = rawPlots(p.slug); let O;
  if (raw && raw.length) O = raw.filter((q) => Array.isArray(q[6]) && q[6].length > 2).map((q) => [String(q[0]), q[1], q[6].flat()]);
  else { const r = await fetch(`outlines/${encodeURIComponent(p.slug)}.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error('outlines'); O = await r.json(); }
  return p.part ? O.filter((o) => p.part.kinds.includes(o[1])) : O;   // a project sold in parts: this part's plots only
}
/** the map items: one per project, or one per part of a project sold in parts (مزيرعة A / B — each placed on its own) */
export function mapItems(projects) {
  return projects.flatMap((p) => {
    const P = projectParts(p); if (!P) return [{ ...p, key: p.slug }];
    return P.map((x) => {
      const lands = (p.lands || []).filter((l) => x.kinds.includes(l.t));
      return { ...p, key: x.key, part: x, name: x.name, all: p.lands, lands, na: (p.na || []).filter((q) => x.kinds.includes(q[1])), available: lands.filter((l) => l.status === 'av').length, sold: lands.filter((l) => l.status === 'sold').length };
    });
  });
}
/** the middle of a part's plots on its plan (plan units), from every plot's centre */
function partMid(p) {
  const C = [...(p.lands || []).map((l) => l.pc), ...(p.na || []).map((q) => q[3])].filter((c) => c && c.length > 1);
  if (!C.length) return null; const xs = C.map((c) => c[0]), ys = C.map((c) => c[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
/** a point of the plan (plan units) on the map, for the plan laid at g */
function planLL(map, p, g, x, y) {
  const mpp = planMpp(p); if (!mpp || !p.map) return g.c;
  const z = 16, mppMap = 40075016.686 * Math.cos(g.c[0] * Math.PI / 180) / (256 * Math.pow(2, z)), k = (g.k || 1) * mpp / mppMap;
  const dx = (x - p.map.w / 2) * k, dy = (y - p.map.h / 2) * k, a = (g.rot || 0) * Math.PI / 180;
  const c = map.project(g.c, z); const ll = map.unproject([c.x + dx * Math.cos(a) - dy * Math.sin(a), c.y + dx * Math.sin(a) + dy * Math.cos(a)], z);
  return [ll.lat, ll.lng];
}
const size = (f) => { let a = Infinity, b = -Infinity, c2 = Infinity, d = -Infinity; for (let i = 0; i < f.length; i += 2) { a = Math.min(a, f[i]); b = Math.max(b, f[i]); c2 = Math.min(c2, f[i + 1]); d = Math.max(d, f[i + 1]); } return [b - a, d - c2]; };
/** does the plan's drawing carry the plot numbers? (many tiny shapes — the digits — for every plot) */
function vecHasNumbers(V, O) {
  const sz = O.map((o) => { const [w, h] = size(o[2]); return Math.min(w, h); }).sort((x, y) => x - y), unit = sz[sz.length >> 1] || 10;
  let small = 0; const { n, st, bb } = V;
  for (let k = 0; k < n; k++) { if (st[k] >= 254) continue; const b = k * 4, m = Math.max(bb[b + 2] - bb[b], bb[b + 3] - bb[b + 1]); if (m > 0 && m < unit * 0.3) small++; }
  return small > O.length * 1.5;
}
/** each plot's number in the middle of it, along its long side, sized to the plot */
function plotNumbers(c, O, s) {
  c.save(); c.scale(s, s); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1d1d1d';
  for (const [n, , f] of O) {
    let cx = 0, cy = 0; const k = f.length / 2; for (let i = 0; i < f.length; i += 2) { cx += f[i]; cy += f[i + 1]; } cx /= k; cy /= k;
    let best = 0, ang = 0; for (let i = 0; i < f.length; i += 2) { const j = (i + 2) % f.length, dx = f[j] - f[i], dy = f[j + 1] - f[i + 1], L = Math.hypot(dx, dy); if (L > best) { best = L; ang = Math.atan2(dy, dx); } }
    if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    const [w, h] = size(f), fs = Math.max(1.2, Math.min(w, h) * 0.32);
    c.save(); c.translate(cx, cy); c.rotate(ang); c.font = `700 ${fs}px Tajawal, sans-serif`;
    const tw = c.measureText(String(n)).width; if (tw > best * 0.92) c.font = `700 ${fs * best * 0.92 / tw}px Tajawal, sans-serif`;
    c.fillText(String(n), 0, 0); c.restore();
  }
  c.restore();
}
const hull = (pts) => {   // convex hull (monotone chain) of [x, y] points
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let k = pts.length - 1; k >= 0; k--) { const q = pts[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};
export async function planPicture(p) {
  const m = p.map, s = Math.min(1, 2600 / Math.max(m.w, m.h)), cv = document.createElement('canvas');
  cv.width = Math.round(m.w * s); cv.height = Math.round(m.h * s); const c = cv.getContext('2d');
  let O = null; try { O = await plotOutlines(p); } catch { O = null; }
  const P = await loadPlan(p.slug, m).catch(() => null);
  if (P && P.V && O && O.length) {   // the plan's drawing (plots, numbers, roads and their widths, gardens, shops, clinics, names) without its picture, cut to the project
    const pts = []; for (const [, , f] of O) for (let i = 0; i < f.length; i += 2) pts.push([f[i], f[i + 1]]);
    const H0 = hull(pts), cx = H0.reduce((a, q) => a + q[0], 0) / H0.length, cy = H0.reduce((a, q) => a + q[1], 0) / H0.length;
    const pad = Math.max(m.w, m.h) * 0.025, clip = H0.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [x + (x - cx) / d * pad, y + (y - cy) / d * pad]; });
    // the plan hatches its plots (the solid colour is in the plan picture we leave out): fill each plot solid first, so
    // the satellite photo does not show through them
    c.save(); c.scale(s, s);
    for (const [, t, f] of O) {
      const k = kindCol(p, t);
      c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.closePath();
      c.fillStyle = `rgb(${k[0]},${k[1]},${k[2]})`; c.fill();
    }
    // each plot's own edge, in a darker shade of its colour (the plan's white separators are left out below: on the
    // satellite photo they show as loose white lines — some plans also carry an older, shifted grid or the neighbours' plots in white)
    { const sz = O.map((o) => { const [w, h] = size(o[2]); return Math.min(w, h); }).sort((x, y) => x - y), unit = sz[sz.length >> 1] || 10;
      c.lineJoin = 'round'; c.lineWidth = Math.max(unit * 0.045, 0.6 / s);
      for (const [, t, f] of O) {
        const k = kindCol(p, t);
        c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.closePath();
        c.strokeStyle = `rgb(${Math.round(k[0] * 0.55)},${Math.round(k[1] * 0.55)},${Math.round(k[2] * 0.55)})`; c.stroke();
      } }
    c.restore();
    // no hatching over the solid colour — it dulls it. Some plans (made from a PDF) flag every filled shape — names, plot
    // numbers, mosques, gardens — the same way: there the flag means nothing, and only hatched strokes are left out
    const fills = P.VS.filter((v) => v && v.t === 'f'), allFlag = fills.length > 0 && fills.every((v) => v.h);
    // white and light-grey lines: separators drawn for the plan's own colours, and the neighbours' plots — loose lines on the photo
    const white = (v) => v.t === 's' && v.c && Math.min(...v.c) >= 185 && Math.max(...v.c) - Math.min(...v.c) <= 25;
    // white fills too: some plans (مزيرعة) paint every plot white over the colour
    const whiteFill = (v) => v.t === 'f' && v.c && Math.min(...v.c) >= 230 && Math.max(...v.c) - Math.min(...v.c) <= 25;
    const re = FILL_AS[p.slug] || {};   // a plan's own colour for a kind of place → the shared one (its gardens in grey → green)
    const VS = P.VS.map((v) => (v && ((v.h && (!allFlag || v.t === 's')) || white(v) || whiteFill(v)) ? null
      : v && v.t === 'f' && v.c && re[v.c.join(',')] ? Object.assign({}, v, { c: re[v.c.join(',')], css: `rgb(${re[v.c.join(',')].join(',')})` }) : v));
    drawPlanView(c, { V: P.V, VS }, p.lands || [], m, { w: cv.width, h: cv.height, ppu: s, x0: 0, y0: 0, labels: false, bg: false, clip });
    if (!vecHasNumbers(P.V, O)) plotNumbers(c, O, s);   // some plans keep the plot numbers in their picture only: write them
    return crop(cv, s, p.part && clip, m);
  }
  if (!O || !O.length) {   // nothing else to be had: the plan as before
    drawPlanView(c, P, p.lands || [], m, { w: cv.width, h: cv.height, ppu: s, x0: 0, y0: 0, labels: false });
    return { src: cv.toDataURL('image/jpeg', 0.82), cut: false };
  }
  const st = {}; (p.lands || []).forEach((l) => { st[l.n] = l.status; });   // no drawing: the plots alone
  c.scale(s, s); c.lineJoin = 'round'; c.lineWidth = Math.max(0.6, 1.1 / s);
  for (const [n, t, f] of O) {
    c.beginPath(); c.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) c.lineTo(f[i], f[i + 1]); c.closePath();
    const k = SCOL[st[n]] || kindCol(p, t);
    c.fillStyle = `rgb(${k[0]},${k[1]},${k[2]})`; c.fill();
    c.strokeStyle = 'rgba(40,52,30,.85)'; c.stroke();
  }
  return crop(cv, s, p.part && O.flatMap((o) => { const r = []; for (let i = 0; i < o[2].length; i += 2) r.push([o[2][i], o[2][i + 1]]); return r; }), m);
}
/** a part of a plan: keep only the box around its own plots (so the other part's picture does not cover it) */
function crop(cv, s, pts, m) {
  if (!pts || !pts.length) return { src: cv.toDataURL('image/png'), cut: true };
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const b = [Math.max(0, Math.min(...xs)), Math.max(0, Math.min(...ys)), Math.min(m.w, Math.max(...xs)), Math.min(m.h, Math.max(...ys))].map((v, i) => (i < 2 ? Math.floor(v) : Math.ceil(v)));
  const o = document.createElement('canvas'); o.width = Math.max(1, Math.round((b[2] - b[0]) * s)); o.height = Math.max(1, Math.round((b[3] - b[1]) * s));
  o.getContext('2d').drawImage(cv, b[0] * s, b[1] * s, o.width, o.height, 0, 0, o.width, o.height);
  return { src: o.toDataURL('image/png'), cut: true, box: b };
}
/* the plan pictures drawn ahead of time by the website's build (scripts/map-images.mjs): shown at once; a project
   without one (new, or no connection to the list) is drawn on the phone as before */
const MAPIMG = (/github\.io$/.test(location.hostname) ? '' : 'https://hamadasf.github.io/alyassi-app/') + 'mapimg/';
let mapIdx = null;
const readyPictures = () => mapIdx || (mapIdx = fetch(MAPIMG + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
async function pictureFor(p) {
  const m = (await readyPictures())[p.key || p.slug];
  return m ? { src: MAPIMG + m.file, cut: m.cut, box: m.box || null, ready: true } : planPicture(p);
}
function planLayer(L, p, g) {   // g: { c: [lat, lng], rot, k }
  const mpp = planMpp(p); if (!p.map || !mpp) return null;
  const Lay = L.Layer.extend({
    onAdd(map) {
      this._map = map; const el = this._el = L.DomUtil.create('img', 'pplan'); el.alt = ''; el.style.opacity = 0;
      map.getPanes().overlayPane.appendChild(el);
      const use = (r) => { el.src = r.src; this._cut = r.cut; this._box = r.box || null; this._ok = 1; this._reset(); };
      pictureFor(p).then((r) => {
        if (r.ready) el.onerror = () => { el.onerror = null; planPicture(p).then(use).catch(() => el.remove()); };   // the ready picture failed: draw it here
        use(r);
      }).catch(() => el.remove());
      map.on('zoomend viewreset moveend', this._reset, this); map.on('zoomstart', this._hide, this);
      L.DomEvent.on(el, 'click', (e) => { L.DomEvent.stopPropagation(e); this.fire('click'); });
    },
    onRemove(map) { this._el.remove(); map.off('zoomend viewreset moveend', this._reset, this); map.off('zoomstart', this._hide, this); },
    _hide() { if (this._el) this._el.style.opacity = 0; },
    set(ng) { Object.assign(g, ng); this._reset(); },
    _reset() {
      const map = this._map, el = this._el; if (!map || !el || !this._ok) return;
      const z = map.getZoom(); if (z < 13) { el.style.opacity = 0; el.style.pointerEvents = 'none'; return; }
      const mppMap = 40075016.686 * Math.cos(g.c[0] * Math.PI / 180) / (256 * Math.pow(2, z));
      const k = (g.k || 1) * mpp / mppMap, W = p.map.w * k, Hh = p.map.h * k, pt = map.latLngToLayerPoint(g.c);
      const [x0, y0, x1, y1] = this._box || [0, 0, p.map.w, p.map.h];   // g.c is always the whole plan's middle; a part is a box of it
      Object.assign(el.style, { width: (x1 - x0) * k + 'px', height: (y1 - y0) * k + 'px', left: pt.x - W / 2 + x0 * k + 'px', top: pt.y - Hh / 2 + y0 * k + 'px',
        transformOrigin: `${(p.map.w / 2 - x0) * k}px ${(p.map.h / 2 - y0) * k}px`, transform: `rotate(${g.rot || 0}deg)`, opacity: this._cut ? 1 : z >= 15 ? 0.92 : 0.8, pointerEvents: 'auto' });
      el.classList.toggle('cut', !!this._cut);
    },
  });
  return new Lay();
}

export function mapPage() {
  return `<div class="pmap"><div id="pmapEl"></div><div class="pmap-load">${H.I.map}<span>جارِ تحميل الخريطة…</span></div><div class="pmap-card" hidden></div></div>`;
}
export async function initMapPage(pg) {
  const { esc, I } = H; const projects = mapItems(H.projects()); const admin = H.isAdmin && H.isAdmin();
  const loadEl = pg.querySelector('.pmap-load'), card = pg.querySelector('.pmap-card');
  let L, have;
  try { [L, have] = await Promise.all([loadLeaflet(), coords(projects)]); } catch { loadEl.innerHTML = `${I.wifi}<span>تعذّر تحميل الخريطة — تأكد من الاتصال بالإنترنت</span>`; return; }
  const pins = projects.map((p) => { const v = have[p.key] && have[p.key].c; return v ? { p, c: [v[0], v[1]], g: { c: [v[0], v[1]], rot: +v[2] || 0, k: +v[3] || 1 } } : null; }).filter(Boolean);
  if (!pins.length && !admin) { loadEl.innerHTML = `${I.map}<span>مواقع المشاريع غير متوفرة بعد — حاول لاحقاً</span>`; return; }
  loadEl.remove();
  const map = L.map(pg.querySelector('#pmapEl'), { zoomControl: false, attributionControl: true }).setView(pins.length ? pins[0].c : [25.33, 55.55], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  // Esri tiles: no key needed (CARTO now answers apps with an «API KEY REQUIRED» picture). Street map + satellite toggle.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const street = L.tileLayer(ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' });
  const sat = L.layerGroup([
    L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }),
    L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  ]);
  let isSat = true;   // always opens on the satellite view (the button switches for this visit only)
  (isSat ? sat : street).addTo(map);
  const tg = document.createElement('button'); tg.className = 'pmap-tg';
  const tgLbl = () => { tg.innerHTML = isSat ? `${I.map}<span>خريطة</span>` : `${I.globe || I.map}<span>قمر صناعي</span>`; };
  tgLbl(); pg.querySelector('.pmap').appendChild(tg);
  tg.addEventListener('click', () => { map.removeLayer(isSat ? sat : street); isSat = !isSat; (isSat ? sat : street).addTo(map); tgLbl(); });
  const fromP = (p) => { const v = (p.lands || []).filter((l) => l.status === 'av' && l.total > 0).map((l) => l.total); return v.length ? Math.min(...v) : 0; };
  const shortP = (n) => (n >= 1e6 ? (Math.round(n / 1e5) / 10) + ' مليون' : Math.round(n / 1e3) + ' ألف');
  const show = (p) => {
    const av = p.available || 0, from = fromP(p);
    card.innerHTML = `<button class="pmap-x" data-pmx aria-label="إغلاق">✕</button><img src="${esc(p.poster)}" alt="" onerror="this.remove()"><div class="pmap-i"><b>${esc(p.name)}</b><span>${av ? `<em>${av}</em> أرض متاحة` : p.sold ? `<em>${p.sold}</em> قطعة مباعة` : 'لا توجد أراضٍ متاحة حالياً'}</span>${from ? `<span class="pmap-from">تبدأ من <b>${H.money ? H.money(from) : from}</b> د.إ</span>` : ''}
      <div class="pmap-b"><button class="btn primary" data-project="${esc(p.slug)}">${I.building} تفاصيل المشروع</button>${p.map ? `<button class="btn ghost" data-pview="${esc(p.slug)}">${I.grid} المخطط</button>` : ''}</div></div>`;
    card.hidden = false;
  };
  const bounds = [], marks = [];
  const layers = {};
  for (let { p, c, g } of pins) {
    const lay = planLayer(L, p, g); if (lay) { lay.addTo(map).on('click', () => { if (!(H.editing && H.editing())) show(p); }); layers[p.key] = lay; }
    const mid = p.part && partMid(p); if (mid) c = planLL(map, p, g, mid[0], mid[1]);   // a part's label in the middle of its own plots
    const av = p.available || 0;
    const from = fromP(p);   // the price bubble: «من 365 ألف»
    const icon = L.divIcon({ className: 'pmk-w', html: `<div class="pmk${av ? '' : ' none'}"><b>${esc(p.name)}</b>${from ? `<i class="pr">من ${shortP(from)}</i>` : av ? `<i>${av}</i>` : ''}</div>`, iconSize: null, iconAnchor: [0, 0] });
    const m = L.marker(c, { icon, riseOnHover: true }).addTo(map).on('click', () => { show(p); map.flyTo(c, Math.max(map.getZoom(), 15), { duration: .6 }); });
    marks.push({ m, c, av }); bounds.push(c);
  }
  // declutter: a label only shows where it doesn't cover another one; the rest shrink to a small gold dot with the count
  const declutter = () => {
    const taken = [];
    const order = [...marks].sort((a, b) => b.av - a.av);
    for (const k of order) {
      const el = k.m.getElement() && k.m.getElement().querySelector('.pmk'); if (!el) continue;
      el.classList.remove('dot');
      const pt = map.latLngToContainerPoint(k.c), w = el.offsetWidth + 6, h = el.offsetHeight + 8;
      const box = [pt.x - w / 2, pt.y - h, pt.x + w / 2, pt.y];
      const hit = taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
      if (hit) { el.classList.add('dot'); k.m.setZIndexOffset(-100); } else { taken.push(box); k.m.setZIndexOffset(100); }
    }
  };
  map.on('zoomend moveend', declutter);
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  setTimeout(declutter, 50);
  map.on('click', () => { card.hidden = true; });
  H.editing = null;
  card.addEventListener('click', (e) => { if (e.target.closest('[data-pmx]')) { e.stopPropagation(); card.hidden = true; } });
  setTimeout(() => map.invalidateSize(), 300);
  if (admin) adminPins(pg, map, L, projects, have, layers);
}

/* management: put a project on the map by hand — pick it, tap its place on the map, save */
function adminPins(pg, map, L, projects, have, layers) {
  const { esc, I } = H;
  const missing = projects.filter((p) => !(have[p.key] && have[p.key].c));
  const bar = document.createElement('div'); bar.className = 'pmap-adm';
  const closed = () => `<button class="pmap-admb" data-pmadm>${I.pin || I.map} تحديد موقع مشروع${missing.length ? ` <em>${missing.length} بدون موقع</em>` : ''}</button>`;
  bar.innerHTML = closed(); pg.querySelector('.pmap').appendChild(bar);
  let pos = null, tmp = null, rot = 0, k = 1;   // the chosen project's centre, turn and size while editing
  const $ = (q) => bar.querySelector(q);
  const open = () => {
    const first = (missing[0] || projects[0] || {}).key;
    bar.innerHTML = `<div class="pmap-admf"><div class="pmap-admh"><b>تحديد موقع مشروع <small>للإدارة</small></b><button class="pmap-min" data-pmmin aria-label="تصغير">—</button></div>
      <div class="pmap-body">
      <select data-pmsel>${projects.map((p) => `<option value="${esc(p.key)}"${p.key === first ? ' selected' : ''}>${esc(p.name)}${have[p.key] && have[p.key].c ? '' : ' — بدون موقع'}</option>`).join('')}</select>
      <p class="muted" data-pmhint>اسحب المخطط بإصبعك أو حرّكه بالأسهم (مشروع بدون موقع: اضغط مكانه في الخريطة أولاً)</p></div>
      <div class="pmap-ctl">
        <div class="pmap-pad"><button data-mv="0,-1" aria-label="فوق">▲</button><button data-mv="1,0" aria-label="يمين">▶</button><button data-mv="0,1" aria-label="تحت">▼</button><button data-mv="-1,0" aria-label="يسار">◀</button><span data-step title="الخطوة">${'خطوة'}<b data-stepv>صغيرة</b></span></div>
        <div class="pmap-tw">
          <div class="pmap-row"><span>تدوير</span><button data-rt="-1">↺</button><output data-pmrv>0°</output><button data-rt="1">↻</button></div>
          <div class="pmap-row"><span>حجم</span><button data-kk="-1">−</button><output data-pmkv>100%</output><button data-kk="1">+</button></div>
        </div>
      </div>
      <div class="pmap-admr"><button class="btn primary" data-pmsave disabled>حفظ الموقع</button><button class="btn ghost" data-pmclr>إزالة التحديد اليدوي</button><button class="btn ghost" data-pmx2>إغلاق</button></div></div>`;
    sync();
  };
  const cur = () => { const sl = $('[data-pmsel]'); return sl ? sl.value : ''; };
  let big = false;   // arrow step: small (fine) or big
  const outs = () => { if (!$('[data-pmrv]')) return; $('[data-pmrv]').textContent = (Math.round(rot * 10) / 10) + '°'; $('[data-pmkv]').textContent = Math.round(k * 100) + '%'; $('[data-stepv]').textContent = big ? 'كبيرة' : 'صغيرة'; };
  const live = () => {
    outs(); if (!pos) return;
    let lay = layers[cur()];
    if (!lay) { const p = projects.find((x) => x.key === cur()); lay = p && planLayer(L, p, { c: pos, rot, k }); if (lay) { lay.addTo(map); layers[cur()] = lay; } }
    if (lay) { lay.set({ c: pos, rot, k }); bindDrag(lay); }
    if (tmp) tmp.setLatLng(pos); else tmp = L.marker(pos, { icon: L.divIcon({ className: 'pmk-w', html: '<div class="pmk new"><b>وسط المشروع</b></div>', iconSize: null, iconAnchor: [0, 0] }), interactive: false }).addTo(map);
    $('[data-pmsave]').disabled = false;
  };
  const sync = () => {   // follow the chosen project's saved place, turn and size
    const v = have[cur()] && have[cur()].c;
    pos = v ? [v[0], v[1]] : null; rot = v ? +v[2] || 0 : 0; k = v ? +v[3] || 1 : 1;
    if (tmp) { map.removeLayer(tmp); tmp = null; }
    if (pos) { map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: .5 }); live(); } else { outs(); $('[data-pmsave]').disabled = true; }
  };
  // move the plan by screen pixels (so a step is the same on screen at any zoom)
  const nudge = (dx, dy) => { if (!pos) { H.toast('اضغط على الخريطة في مكان المشروع أولاً'); return; } const pt = map.latLngToContainerPoint(pos); const ll = map.containerPointToLatLng([pt.x + dx, pt.y + dy]); pos = [ll.lat, ll.lng]; live(); };
  // drag the plan itself with a finger
  const bindDrag = (lay) => {
    const el = lay._el; if (!el || el._pmDrag) return; el._pmDrag = 1;
    let st = null;
    el.addEventListener('pointerdown', (e) => {
      if (!$('[data-pmsel]') || layers[cur()] !== lay) return;
      e.preventDefault(); e.stopPropagation(); map.dragging.disable();
      st = { x: e.clientX, y: e.clientY, pt: map.latLngToContainerPoint(pos) }; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => { if (!st) return; const ll = map.containerPointToLatLng([st.pt.x + e.clientX - st.x, st.pt.y + e.clientY - st.y]); pos = [ll.lat, ll.lng]; live(); });
    const end = () => { if (!st) return; st = null; map.dragging.enable(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  };
  H.editing = () => !!$('[data-pmsel]');
  bar.addEventListener('change', (e) => { if (e.target.matches('[data-pmsel]')) sync(); });
  map.on('click', (e) => {
    if (!$('[data-pmsel]') || pos) return;   // once placed, the plan moves only by dragging it or with the arrows
    pos = [e.latlng.lat, e.latlng.lng]; live();
    $('[data-pmhint]').textContent = 'اسحب المخطط أو استخدم الأسهم حتى ينطبق على الشوارع، ثم «حفظ الموقع»';
  });
  const send = async (body, msg) => {
    try { await api('adm_proj_pin', body); H.toast(msg); lsSet('pgeoAt', 0); H.reopen && H.reopen(); }
    catch (ex) { H.toast(ex.message); }
  };
  // press and hold an arrow / turn / size button to keep going
  let rep = null;
  const act = (t) => {
    const d = t.dataset, f = big ? 5 : 1;
    if (d.mv) { const [x, y] = d.mv.split(',').map(Number); nudge(x * 4 * f, y * 4 * f); }
    else if (d.rt) { rot = Math.max(-180, Math.min(180, rot + +d.rt * (big ? 2 : 0.25))); live(); }
    else if (d.kk) { k = Math.max(0.3, Math.min(3, k * (1 + +d.kk * (big ? 0.03 : 0.005)))); live(); }
  };
  bar.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-mv],[data-rt],[data-kk]'); if (!t) return;
    e.preventDefault(); act(t); clearInterval(rep); let n = 0; rep = setInterval(() => { if (++n > 4) act(t); }, 70);
  });
  const stop = () => { clearInterval(rep); rep = null; };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bar.addEventListener(ev, stop));
  bar.addEventListener('click', (e) => {
    e.stopPropagation();
    const t = e.target.closest('button, [data-step]'); if (!t) return;
    if (t.dataset.pmadm !== undefined) { open(); return; }
    if (t.dataset.step !== undefined) { big = !big; outs(); return; }
    if (t.dataset.pmmin !== undefined) { bar.querySelector('.pmap-admf').classList.toggle('min'); return; }
    const slug = cur();
    if (t.dataset.pmx2 !== undefined) { bar.innerHTML = closed(); if (tmp) { map.removeLayer(tmp); tmp = null; } return; }
    if (t.dataset.pmsave !== undefined) { if (!pos) return; t.disabled = true; send({ slug, lat: pos[0], lng: pos[1], rot, k }, 'تم حفظ موقع المشروع ✓'); return; }
    if (t.dataset.pmclr !== undefined) send({ slug, clear: 1 }, 'رجع الموقع من رابط المشروع');
  });
  L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
}

/* ---- «أنا فين؟»: a place on earth → the point of the project's plan under it (the plan as the admin laid it on the map) ---- */
const merc = (lat, lng, z) => { const n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180); return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
function toPlan(p, g, lat, lng) {
  const mpp = planMpp(p); if (!mpp || !p.map || !g) return null;
  const z = 18, mppMap = 40075016.686 * Math.cos(g.c[0] * Math.PI / 180) / (256 * Math.pow(2, z)), k = (g.k || 1) * mpp / mppMap;
  const a = merc(lat, lng, z), o = merc(g.c[0], g.c[1], z), dx = a[0] - o[0], dy = a[1] - o[1], r = (g.rot || 0) * Math.PI / 180;
  return [p.map.w / 2 + (dx * Math.cos(r) + dy * Math.sin(r)) / k, p.map.h / 2 + (-dx * Math.sin(r) + dy * Math.cos(r)) / k];
}
/** → async (lat, lng) → [x, y] on the plan (or null when the project is not placed on the map yet) */
export async function planLocator(p) {
  const items = mapItems([p]); const have = await coords(items);
  const placed = items.map((it) => { const v = have[it.key] && have[it.key].c; return v ? { it, g: { c: [v[0], v[1]], rot: +v[2] || 0, k: +v[3] || 1 } } : null; }).filter(Boolean);
  if (!placed.length) return null;
  const box = (it) => { const C = [...(it.lands || []).map((l) => l.pc), ...(it.na || []).map((q) => q[3])].filter(Boolean); if (!C.length) return null; const xs = C.map((c) => c[0]), ys = C.map((c) => c[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  return (lat, lng) => {
    let best = null, bd = Infinity;
    for (const { it, g } of placed) {
      const q = toPlan({ ...it, all: p.lands, lands: it.lands }, g, lat, lng); if (!q) continue;
      const b = it.part ? box(it) : null; const d = b ? Math.hypot(Math.max(b[0] - q[0], 0, q[0] - b[2]), Math.max(b[1] - q[1], 0, q[1] - b[3])) : 0;   // a part: the one whose plots are nearest
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };
}
