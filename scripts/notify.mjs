// Sends one push notification (OneSignal) summarising the latest price / status changes.
// Needs ONESIGNAL_APP_ID and ONESIGNAL_REST_KEY; does nothing without them.
import { readFileSync } from 'node:fs';
const { ONESIGNAL_APP_ID: app, ONESIGNAL_REST_KEY: key, APP_URL = 'https://hamadasf.github.io/alyassi-app/' } = process.env;
const fresh = JSON.parse(readFileSync(process.argv[2] || 'new-changes.json', 'utf8'));
if (!fresh.length) { console.log('no changes'); process.exit(0); }
if (!app || !key) { console.log(`${fresh.length} changes — push not configured`); process.exit(0); }
const nf = new Intl.NumberFormat('en-US');
const ST = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة' };
const one = (c) => c.kind === 'price' ? `السعر الجديد ${c.to ? nf.format(c.to) + ' د.إ' : 'للاستفسار'}`
  : c.kind === 'new' ? 'أرض جديدة متاحة' : `أصبحت ${ST[c.to] || c.to}`;
let title, body;
if (fresh.length === 1) {
  const c = fresh[0]; title = `قطعة ${c.n} · ${c.projectName}`; body = one(c);
} else {
  const n = (k) => fresh.filter((c) => c.kind === k).length;
  const parts = [n('price') && `${n('price')} سعر`, n('status') && `${n('status')} حالة`, n('new') && `${n('new')} أرض جديدة`].filter(Boolean);
  const projects = [...new Set(fresh.map((c) => c.projectName))];
  title = 'تحديثات على الأراضي';
  body = `${parts.join(' · ')} — ${projects.slice(0, 3).join('، ')}${projects.length > 3 ? '…' : ''}`;
}
const r = await fetch('https://api.onesignal.com/notifications?c=push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
  body: JSON.stringify({
    app_id: app, target_channel: 'push', included_segments: ['Total Subscriptions'],
    headings: { en: title, ar: title }, contents: { en: body, ar: body },
    url: APP_URL + '#updates', data: { open: 'updates' }, ttl: 86400,
  }),
});
console.log('push', r.status, (await r.text()).slice(0, 200));
