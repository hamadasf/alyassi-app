// The advertiser strip on every listing card, like Property Finder: the advertiser's round photo (over the picture's
// edge) with the name, and the company logo opposite.
// · The office's listings: عمر الياسي — name, photo and logo set by the admin (Settings) and changed on every card at once.
// · Members' listings: their own photo and company logo once the admin has approved them (otherwise the office's).
import { ADVERTISER } from './config.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const KEY = 'oay:brand';
let brand = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } })();

/** the office's advertiser as shown now (the admin's pictures, or the built-in ones) */
export function office() {
  const b = brand || {};
  return { name: b.name || ADVERTISER.name, photo: b.photo || ADVERTISER.photo, logo: b.logo || ADVERTISER.logo, sub: 'معلن موثّق ✓', own: 0 };
}
/** a member's approved advertiser details → strip data; nothing approved → the office's */
function member(a) {
  if (!a || (!a.photo && !a.logo)) return office();
  const o = office();
  return { name: (a.verified && a.company) || a.name || o.name, photo: a.photo || ADVERTISER.photo, logo: a.logo || '', sub: a.verified ? 'معلن موثّق ✓' : 'معلن', own: 1 };
}
export function advStrip(a) {
  const x = a ? member(a) : office();
  return `<div class="adv" data-own="${x.own}">
    <div class="adv-who"><span class="adv-ph"><img src="${esc(x.photo)}" alt="" loading="lazy" decoding="async"></span><span class="adv-nm"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span></div>
    ${x.logo ? `<span class="adv-logo"><img src="${esc(x.logo)}" alt="" loading="lazy" decoding="async"></span>` : ''}
  </div>`;
}
/** puts the office's current pictures on the cards already on screen */
function repaint() {
  const o = office();
  document.querySelectorAll('.adv[data-own="0"]').forEach((el) => {
    const ph = el.querySelector('.adv-ph img'), nm = el.querySelector('.adv-nm b'), lg = el.querySelector('.adv-logo img');
    if (ph && ph.getAttribute('src') !== o.photo) ph.src = o.photo;
    if (nm && nm.textContent !== o.name) nm.textContent = o.name;
    if (lg && lg.getAttribute('src') !== o.logo) lg.src = o.logo;
  });
}
export function setBrand(b) {
  brand = b ? { name: b.name || '', photo: b.photo || '', logo: b.logo || '', v: b.v || 0 } : null;
  try { localStorage.setItem(KEY, JSON.stringify(brand)); } catch { /* private mode */ }
  repaint();
}
/** fetched once at start (and after the admin changes it) */
export async function loadBrand(api) {
  try { const j = await api('brand'); setBrand(j.brand); } catch { /* keep the saved / built-in one */ }
}
