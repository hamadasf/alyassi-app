// Anonymous usage numbers for the office's weekly report: a random id per phone and what was opened —
// no names, numbers or anything personal. Sent in small batches.
import { api } from './owner.js';

let dev = '';
try { dev = localStorage.getItem('oay:dev') || ''; if (!dev) { dev = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('oay:dev', dev); } } catch { dev = 'x' + Math.random().toString(16).slice(2); }
export const deviceId = () => dev;
let q = [], t = 0;
function flush() {
  if (!q.length) return;
  const ev = q.splice(0, 40);
  api('track', { dev, ev }).catch(() => {});
}
export function track(e, id = '') {
  q.push({ e, id: String(id || '') });
  clearTimeout(t); t = setTimeout(flush, q.length >= 20 ? 0 : 8000);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
