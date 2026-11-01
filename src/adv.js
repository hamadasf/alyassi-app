// The advertiser strip on every listing card, like Property Finder: the advertiser's round photo (over the picture's
// edge) with the name, and the company logo opposite. All current listings are advertised by عمر الياسي.
import { ADVERTISER } from './config.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export function advStrip(a = ADVERTISER) {
  return `<div class="adv">
    <div class="adv-who"><span class="adv-ph"><img src="${esc(a.photo)}" alt="" loading="lazy" decoding="async"></span><span class="adv-nm"><b>${esc(a.name)}</b><small>معلن موثّق ✓</small></span></div>
    <span class="adv-logo"><img src="${esc(a.logo)}" alt="${esc(a.role)}" loading="lazy" decoding="async"></span>
  </div>`;
}
