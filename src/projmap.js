// «الخريطة»: every project as a pin on a map (Leaflet, loaded only when the page opens). The website works out each
// project's coordinates once from its Google Maps link (proj_geo) and the phone keeps them.
import { api } from './owner.js';

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
/** coordinates of the projects: [slug] → [lat, lng] (from this phone first, then the website for the missing ones) */
async function coords(projects) {
  const have = lsGet('pgeo', {});
  const want = projects.filter((p) => p.loc && !(have[p.slug] && have[p.slug].loc === p.loc));
  if (want.length) {
    try {
      const j = await api('proj_geo', { items: want.slice(0, 40).map((p) => ({ slug: p.slug, loc: p.loc })) });
      for (const p of want) { const c = (j.items || {})[p.slug]; if (c) have[p.slug] = { loc: p.loc, c }; }
      lsSet('pgeo', have);
    } catch { /* offline: show what we have */ }
  }
  return have;
}

export function mapPage() {
  return `<div class="pmap"><div id="pmapEl"></div><div class="pmap-load">${H.I.map}<span>جارِ تحميل الخريطة…</span></div><div class="pmap-card" hidden></div></div>`;
}
export async function initMapPage(pg) {
  const { esc, I } = H; const projects = H.projects().filter((p) => p.loc);
  const loadEl = pg.querySelector('.pmap-load'), card = pg.querySelector('.pmap-card');
  let L, have;
  try { [L, have] = await Promise.all([loadLeaflet(), coords(projects)]); } catch { loadEl.innerHTML = `${I.wifi}<span>تعذّر تحميل الخريطة — تأكد من الاتصال بالإنترنت</span>`; return; }
  const pins = projects.map((p) => ({ p, c: have[p.slug] && have[p.slug].c })).filter((x) => x.c);
  if (!pins.length) { loadEl.innerHTML = `${I.map}<span>مواقع المشاريع غير متوفرة بعد — حاول لاحقاً</span>`; return; }
  loadEl.remove();
  const map = L.map(pg.querySelector('#pmapEl'), { zoomControl: false, attributionControl: true }).setView(pins[0].c, 11);
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
  for (const { p, c } of pins) {
    const av = p.available || 0;
    const icon = L.divIcon({ className: 'pmk-w', html: `<div class="pmk${av ? '' : ' none'}"><b>${esc(p.name)}</b>${av ? `<i>${av}</i>` : ''}</div>`, iconSize: null, iconAnchor: [0, 0] });
    const m = L.marker(c, { icon, riseOnHover: true }).addTo(map).on('click', () => { show(p); map.flyTo(c, Math.max(map.getZoom(), 14), { duration: .6 }); });
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
}
