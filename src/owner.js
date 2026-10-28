// Accounts (email/password or Google) and lands added by users — shown only after the office approves them.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { InAppBrowser, DefaultSystemBrowserOptions } from '@capacitor/inappbrowser';
import { SITE } from './config.js';

const native = Capacitor.isNativePlatform();
const AJAX = SITE + '/wp-admin/admin-ajax.php?action=oay_acc_';
const NS = 'oay:';
const ls = { get: (k) => { try { return JSON.parse(localStorage.getItem(NS + k)); } catch { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(NS + k); else localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* ignore */ } } };

/* ---------- API: JSON sent as text/plain (no CORS preflight) ---------- */
export async function api(action, body = {}) {
  const tok = session.token();
  const r = await fetch(AJAX + action, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(tok ? { token: tok, ...body } : body), cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!j) throw new Error('تعذّر الاتصال — تحقق من الإنترنت');
  if (r.status === 401 && tok) session.clear();
  if (!j.ok) throw new Error(j.error || 'حدث خطأ');
  return j;
}

export const session = {
  token: () => ls.get('acc_token'),
  user: () => ls.get('acc_user'),
  set(token, user) { ls.set('acc_token', token); ls.set('acc_user', user); session.emit(); },
  clear() { ls.set('acc_token', null); ls.set('acc_user', null); session.emit(); },
  subs: new Set(),
  emit() { session.subs.forEach((f) => { try { f(session.user()); } catch { /* ignore */ } }); },
};
export async function refreshMe() { if (!session.token()) return null; try { const j = await api('me'); ls.set('acc_user', j.user); return j.user; } catch { return session.user(); } }
export async function logout() { try { await api('logout'); } catch { /* ignore */ } session.clear(); }

/* ---------- options for the form (projects, land types, Google client id) ---------- */
let metaP = null;
export function meta() { if (!metaP) metaP = api('meta').catch((e) => { metaP = null; throw e; }); return metaP; }

/* ---------- Google ---------- */
// Android: Google does not allow sign-in inside an app's web view, so the website's sign-in page opens in the phone's browser
// and hands the session back through the app's link (com.omaralyassi.realestate://auth?token=…).
let googleWait = null;
if (native) {
  App.addListener('appUrlOpen', async ({ url }) => {
    const m = /^com\.omaralyassi\.realestate:\/\/auth\?token=([^&#]+)/.exec(url || '');
    if (!m) return;
    try { await InAppBrowser.close(); } catch { /* already closed */ }
    session.set(decodeURIComponent(m[1]), null);
    const u = await refreshMe();
    session.set(session.token(), u);
    if (googleWait) { googleWait(u); googleWait = null; }
  });
}
export function googleNative() {
  return new Promise((ok) => {
    googleWait = ok;
    InAppBrowser.openInSystemBrowser({ url: SITE + '/?oay_app_google=1', options: DefaultSystemBrowserOptions }).catch(() => { googleWait = null; ok(null); });
  });
}
// Web / iPhone: Google's own button, shown inside the page.
let gsiP = null;
function loadGsi() {
  if (!gsiP) gsiP = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = () => { gsiP = null; no(new Error('gsi')); }; document.head.appendChild(s); });
  return gsiP;
}
export async function googleWebButton(el, clientId, onDone, onErr) {
  await loadGsi();
  window.google.accounts.id.initialize({
    client_id: clientId, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true,
    callback: async (res) => { try { const j = await api('google', { credential: res.credential }); session.set(j.token, j.user); onDone(j.user); } catch (e) { onErr(e); } },
  });
  window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', locale: 'ar', width: Math.min(360, el.clientWidth || 320) });
}

/* ---------- photos: resized on the phone, then sent one by one ---------- */
export function resizePhoto(file, max = 1600, q = 0.82) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('صورة غير صالحة')); };
    img.src = url;
  });
}

/* ---------- approved lands from owners ---------- */
let pub = ls.get('olands') || [];
export const ownerLands = () => pub;
export async function loadOwnerLands() {
  try { const j = await api('public'); pub = j.items || []; ls.set('olands', pub); } catch { /* keep cached */ }
  return pub;
}
