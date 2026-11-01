// Android: tells the user when a newer version of the app is out (the newest GitHub release), with a button that
// downloads it. Checked when the app opens and when it comes back to the front (at most every 30 minutes).
import { Capacitor } from '@capacitor/core';

const REPO = 'hamadasf/alyassi-app';
const VER = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '';
const num = (v) => { const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? (+m[1]) * 1e8 + (+m[2]) * 1e5 + (+m[3]) : 0; };
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let open = false;

/** → 'shown' · 'latest' (already the newest) · '' (not checked / no connection) */
export const canCheckUpdate = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && !!num(VER);
export async function checkUpdate(openExternal, force = false) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !num(VER) || open) return '';
  const last = +get('oay:upd:t') || 0;
  if (!force && Date.now() - last < 30 * 60e3) return '';
  set('oay:upd:t', String(Date.now()));
  let rel;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return ''; rel = await r.json();
  } catch { return ''; }
  const latest = String(rel.tag_name || '').replace(/^v/, '');
  if (num(latest) <= num(VER)) return 'latest';
  if (!force && get('oay:upd:skip') === latest && Date.now() - (+get('oay:upd:skipt') || 0) < 24 * 3600e3) return '';   // «لاحقاً»: asked again the next day
  const apk = (rel.assets || []).find((a) => /\.apk$/i.test(a.name || ''));
  const url = apk ? apk.browser_download_url : (rel.html_url || `https://github.com/${REPO}/releases/latest`);
  show(latest, url, openExternal);
  return 'shown';
}
function show(latest, url, openExternal) {
  open = true;
  const d = document.createElement('div'); d.className = 'exitdlg upddlg';
  d.innerHTML = `<div class="exitbox"><div class="updic">⬆️</div><b>تحديث جديد للتطبيق</b>
    <p>النسخة <span dir="ltr">${latest}</span> متوفرة — فيها تحسينات وإصلاحات جديدة. نسختك الحالية <span dir="ltr">${VER}</span>.</p>
    <small>بعد التحميل افتح الملف واضغط «تثبيت» — بياناتك وحسابك يبقون كما هم.</small>
    <div class="exitbtns"><button class="btn primary" data-upd="1">تحديث الآن</button><button class="btn ghost" data-upd="0">لاحقاً</button></div></div>`;
  d.onclick = (e) => {
    const b = e.target.closest('[data-upd]'); if (!b && e.target !== d) return;
    d.remove(); open = false;
    if (b && b.dataset.upd === '1') openExternal(url);
    else { set('oay:upd:skip', latest); set('oay:upd:skipt', String(Date.now())); }
  };
  document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('in'));
}
