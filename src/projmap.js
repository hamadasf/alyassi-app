// «الخريطة»: every project as a pin on a map (Leaflet, loaded only when the page opens). The website works out each
// project's coordinates once from its Google Maps link (proj_geo) and the phone keeps them.
import { api } from './owner.js';
import { loadPlan, drawPlanView } from './planloc.js';

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
  const stale = force || Date.now() - at > 3600e3 || projects.some((p) => !have[p.slug] || have[p.slug].loc !== (p.loc || ''));
  if (stale) {
    try {
      const j = await api('proj_geo', { items: projects.slice(0, 60).map((p) => ({ slug: p.slug, loc: p.loc || '' })) });
      for (const p of projects) { const c = (j.items || {})[p.slug]; have[p.slug] = { loc: p.loc || '', c: c || (have[p.slug] && have[p.slug].loc === (p.loc || '') ? have[p.slug].c : null) }; }
      lsSet('pgeo2', have); lsSet('pgeoAt', Date.now());
    } catch { /* offline: show what we have */ }
  }
  return have;
}

/* ---- the project's own plan laid on the map at its real size (from the plots' areas), turned as the admin set it ---- */
function planMpp(p) {   // metres per plan unit, from the plots whose area is known
  const r = [];
  for (const l of p.lands || []) {
    if (!l.poly || l.poly.length < 3 || !(+l.ft > 0)) continue;
    let a = 0; for (let i = 0, j = l.poly.length - 1; i < l.poly.length; j = i++) a += (l.poly[j][0] + l.poly[i][0]) * (l.poly[j][1] - l.poly[i][1]);
    a = Math.abs(a / 2); if (a > 4) r.push(Math.sqrt(l.ft * 0.09290304 / a));
  }
  if (!r.length) return 0; r.sort((a, b) => a - b); return r[r.length >> 1];
}
async function planPicture(p) {
  const P = await loadPlan(p.slug, p.map); const m = p.map;
  const s = Math.min(1, 2000 / Math.max(m.w, m.h)), cv = document.createElement('canvas');
  cv.width = Math.round(m.w * s); cv.height = Math.round(m.h * s);
  drawPlanView(cv.getContext('2d'), P, p.lands || [], m, { w: cv.width, h: cv.height, ppu: s, x0: 0, y0: 0, labels: false });
  return cv.toDataURL('image/jpeg', 0.82);
}
function planLayer(L, p, g) {   // g: { c: [lat, lng], rot, k }
  const mpp = planMpp(p); if (!p.map || !mpp) return null;
  const Lay = L.Layer.extend({
    onAdd(map) {
      this._map = map; const el = this._el = L.DomUtil.create('img', 'pplan'); el.alt = ''; el.style.opacity = 0;
      map.getPanes().overlayPane.appendChild(el);
      planPicture(p).then((src) => { el.src = src; this._ok = 1; this._reset(); }).catch(() => el.remove());
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
      const k = (g.k || 1) * mpp / mppMap, w = p.map.w * k, h = p.map.h * k, pt = map.latLngToLayerPoint(g.c);
      Object.assign(el.style, { width: w + 'px', height: h + 'px', left: pt.x - w / 2 + 'px', top: pt.y - h / 2 + 'px', transform: `rotate(${g.rot || 0}deg)`, opacity: z >= 15 ? 0.92 : 0.8, pointerEvents: 'auto' });
    },
  });
  return new Lay();
}

export function mapPage() {
  return `<div class="pmap"><div id="pmapEl"></div><div class="pmap-load">${H.I.map}<span>جارِ تحميل الخريطة…</span></div><div class="pmap-card" hidden></div></div>`;
}
export async function initMapPage(pg) {
  const { esc, I } = H; const projects = H.projects(); const admin = H.isAdmin && H.isAdmin();
  const loadEl = pg.querySelector('.pmap-load'), card = pg.querySelector('.pmap-card');
  let L, have;
  try { [L, have] = await Promise.all([loadLeaflet(), coords(projects)]); } catch { loadEl.innerHTML = `${I.wifi}<span>تعذّر تحميل الخريطة — تأكد من الاتصال بالإنترنت</span>`; return; }
  const pins = projects.map((p) => { const v = have[p.slug] && have[p.slug].c; return v ? { p, c: [v[0], v[1]], g: { c: [v[0], v[1]], rot: +v[2] || 0, k: +v[3] || 1 } } : null; }).filter(Boolean);
  if (!pins.length && !admin) { loadEl.innerHTML = `${I.map}<span>مواقع المشاريع غير متوفرة بعد — حاول لاحقاً</span>`; return; }
  loadEl.remove();
  const map = L.map(pg.querySelector('#pmapEl'), { zoomControl: false, attributionControl: true }).setView(pins.length ? pins[0].c : [25.33, 55.55], 11);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  // Esri tiles: no key needed (CARTO now answers apps with an «API KEY REQUIRED» picture). Street map + satellite toggle.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const street = L.tileLayer(ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' });
  const sat = L.layerGroup([
    L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }),
    L.tileLayer(ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  ]);
  let isSat = lsGet('pmapSat', false);
  (isSat ? sat : street).addTo(map);
  const tg = document.createElement('button'); tg.className = 'pmap-tg';
  const tgLbl = () => { tg.innerHTML = isSat ? `${I.map}<span>خريطة</span>` : `${I.globe || I.map}<span>قمر صناعي</span>`; };
  tgLbl(); pg.querySelector('.pmap').appendChild(tg);
  tg.addEventListener('click', () => { map.removeLayer(isSat ? sat : street); isSat = !isSat; (isSat ? sat : street).addTo(map); lsSet('pmapSat', isSat); tgLbl(); });
  const show = (p) => {
    const av = p.available || 0;
    card.innerHTML = `<button class="pmap-x" data-pmx aria-label="إغلاق">✕</button><img src="${esc(p.poster)}" alt="" onerror="this.remove()"><div class="pmap-i"><b>${esc(p.name)}</b><span>${av ? `<em>${av}</em> أرض متاحة` : 'لا توجد أراضٍ متاحة حالياً'}</span>
      <div class="pmap-b"><button class="btn primary" data-project="${esc(p.slug)}">${I.building} تفاصيل المشروع</button>${p.map ? `<button class="btn ghost" data-pview="${esc(p.slug)}">${I.grid} المخطط</button>` : ''}</div></div>`;
    card.hidden = false;
  };
  const bounds = [], marks = [];
  const layers = {};
  for (const { p, c, g } of pins) {
    const lay = planLayer(L, p, g); if (lay) { lay.addTo(map).on('click', () => show(p)); layers[p.slug] = lay; }
    const av = p.available || 0;
    const icon = L.divIcon({ className: 'pmk-w', html: `<div class="pmk${av ? '' : ' none'}"><b>${esc(p.name)}</b>${av ? `<i>${av}</i>` : ''}</div>`, iconSize: null, iconAnchor: [0, 0] });
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
  card.addEventListener('click', (e) => { if (e.target.closest('[data-pmx]')) { e.stopPropagation(); card.hidden = true; } });
  setTimeout(() => map.invalidateSize(), 300);
  if (admin) adminPins(pg, map, L, projects, have, layers);
}

/* management: put a project on the map by hand — pick it, tap its place on the map, save */
function adminPins(pg, map, L, projects, have, layers) {
  const { esc, I } = H;
  const missing = projects.filter((p) => !(have[p.slug] && have[p.slug].c));
  const bar = document.createElement('div'); bar.className = 'pmap-adm';
  const closed = () => `<button class="pmap-admb" data-pmadm>${I.pin || I.map} تحديد موقع مشروع${missing.length ? ` <em>${missing.length} بدون موقع</em>` : ''}</button>`;
  bar.innerHTML = closed(); pg.querySelector('.pmap').appendChild(bar);
  let pick = null, tmp = null;
  const open = () => {
    const first = (missing[0] || projects[0] || {}).slug;
    bar.innerHTML = `<div class="pmap-admf"><b>تحديد موقع مشروع <small>للإدارة</small></b>
      <select data-pmsel>${projects.map((p) => `<option value="${esc(p.slug)}"${p.slug === first ? ' selected' : ''}>${esc(p.name)}${have[p.slug] && have[p.slug].c ? '' : ' — بدون موقع'}</option>`).join('')}</select>
      <p class="muted" data-pmhint>اضغط على الخريطة في وسط المشروع، ثم لفّ المخطط وكبّره حتى ينطبق على الشوارع</p>
      <label class="pmap-rng">تدوير المخطط <input type="range" min="-180" max="180" step="1" value="0" data-pmrot><output data-pmrv>0°</output></label>
      <label class="pmap-rng">حجم المخطط <input type="range" min="50" max="200" step="1" value="100" data-pmk><output data-pmkv>100%</output></label>
      <div class="pmap-admr"><button class="btn primary" data-pmsave disabled>حفظ الموقع</button><button class="btn ghost" data-pmclr>إزالة التحديد اليدوي</button><button class="btn ghost" data-pmx2>إغلاق</button></div></div>`;
    pick = null; sync();
  };
  const cur = () => { const sl = bar.querySelector('[data-pmsel]'); return sl ? sl.value : ''; };
  const sync = () => {   // the sliders follow the chosen project's saved turn and size
    const v = have[cur()] && have[cur()].c; const r = bar.querySelector('[data-pmrot]'), k = bar.querySelector('[data-pmk]'); if (!r) return;
    r.value = v ? +v[2] || 0 : 0; k.value = Math.round((v ? +v[3] || 1 : 1) * 100); outs();
    if (v) { pick = null; map.flyTo([v[0], v[1]], Math.max(map.getZoom(), 15), { duration: .5 }); bar.querySelector('[data-pmsave]').disabled = false; }
  };
  const outs = () => { bar.querySelector('[data-pmrv]').textContent = bar.querySelector('[data-pmrot]').value + '°'; bar.querySelector('[data-pmkv]').textContent = bar.querySelector('[data-pmk]').value + '%'; };
  const live = () => { let lay = layers[cur()]; outs();
    if (!lay && pick) { const p = projects.find((x) => x.slug === cur()); lay = p && planLayer(L, p, { c: [pick.lat, pick.lng], rot: 0, k: 1 }); if (lay) { lay.addTo(map); layers[cur()] = lay; } } if (lay) lay.set({ rot: +bar.querySelector('[data-pmrot]').value, k: bar.querySelector('[data-pmk]').value / 100, ...(pick ? { c: [pick.lat, pick.lng] } : {}) }); };
  bar.addEventListener('input', (e) => { if (e.target.matches('[data-pmrot],[data-pmk]')) live(); });
  bar.addEventListener('change', (e) => { if (e.target.matches('[data-pmsel]')) { if (tmp) { map.removeLayer(tmp); tmp = null; } sync(); } });
  const onMap = (e) => {
    if (!bar.querySelector('[data-pmsave]')) return;
    pick = e.latlng; if (tmp) tmp.setLatLng(pick); else tmp = L.marker(pick, { icon: L.divIcon({ className: 'pmk-w', html: '<div class="pmk new"><b>هنا</b></div>', iconSize: null, iconAnchor: [0, 0] }) }).addTo(map);
    bar.querySelector('[data-pmsave]').disabled = false; live();
    bar.querySelector('[data-pmhint]').textContent = `${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)} — اضغط «حفظ الموقع»`;
  };
  map.on('click', onMap);
  const send = async (body, msg) => {
    try { await api('adm_proj_pin', body); H.toast(msg); lsSet('pgeoAt', 0); H.reopen && H.reopen(); }
    catch (ex) { H.toast(ex.message); }
  };
  bar.addEventListener('click', (e) => {
    e.stopPropagation(); L.DomEvent && L.DomEvent.stopPropagation(e);
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.pmadm !== undefined) { open(); return; }
    const slug = cur();
    if (t.dataset.pmx2 !== undefined) { bar.innerHTML = closed(); if (tmp) { map.removeLayer(tmp); tmp = null; } return; }
    if (t.dataset.pmsave !== undefined) {
      const v = have[slug] && have[slug].c, c = pick ? [pick.lat, pick.lng] : v ? [v[0], v[1]] : null; if (!c) return;
      t.disabled = true; send({ slug, lat: c[0], lng: c[1], rot: +bar.querySelector('[data-pmrot]').value, k: bar.querySelector('[data-pmk]').value / 100 }, 'تم حفظ موقع المشروع ✓'); return;
    }
    if (t.dataset.pmclr !== undefined) send({ slug, clear: 1 }, 'رجع الموقع من رابط المشروع');
  });
  L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
}
