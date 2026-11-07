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
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(map);
  const show = (p) => {
    const av = p.available || 0;
    card.innerHTML = `<button class="pmap-x" data-pmx aria-label="إغلاق">✕</button><img src="${esc(p.poster)}" alt="" onerror="this.remove()"><div class="pmap-i"><b>${esc(p.name)}</b><span>${av ? `<em>${av}</em> أرض متاحة` : 'لا توجد أراضٍ متاحة حالياً'}</span>
      <div class="pmap-b"><button class="btn primary" data-project="${esc(p.slug)}">${I.building} تفاصيل المشروع</button>${p.map ? `<button class="btn ghost" data-pview="${esc(p.slug)}">${I.grid} المخطط</button>` : ''}</div></div>`;
    card.hidden = false;
  };
  const bounds = [];
  for (const { p, c } of pins) {
    const av = p.available || 0;
    const icon = L.divIcon({ className: 'pmk-w', html: `<div class="pmk${av ? '' : ' none'}"><b>${esc(p.name)}</b>${av ? `<i>${av}</i>` : ''}</div>`, iconSize: null, iconAnchor: [0, 0] });
    L.marker(c, { icon }).addTo(map).on('click', () => { show(p); map.panTo(c); });
    bounds.push(c);
  }
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
  map.on('click', () => { card.hidden = true; });
  card.addEventListener('click', (e) => { if (e.target.closest('[data-pmx]')) { e.stopPropagation(); card.hidden = true; } });
  setTimeout(() => map.invalidateSize(), 300);
}
