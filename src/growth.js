// «أرضي» (lands the client bought from the company, with their payments), «ادعُ أصدقاءك» (the member's invitation code),
// and the Google Play rating request after a good experience.
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { api, session } from './owner.js';
import { ei } from './icons.js';

let H = null;
export function initGrowth(h) { H = h; }
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem('oay:' + k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem('oay:' + k, JSON.stringify(v)); } catch { /* private mode */ } };
const DAY = 864e5;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : s; };
const daysTo = (s) => Math.round((new Date(s + 'T00:00:00') - new Date(today() + 'T00:00:00')) / DAY);

/* ================= «أرضي» ================= */
export function mylandsPage() { return '<div class="pad myl"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export async function initMylands(pg) {
  const el = pg.querySelector('.myl'); const { esc, money, I } = H;
  if (!session.token()) {
    el.innerHTML = `<div class="empty">${I.home || ''}<p>سجّل الدخول لعرض أرضك</p><p class="sub">إذا اشتريت أرضاً من عمر الياسي للعقارات، تظهر هنا مع جدول دفعاتها وتذكير قبل كل قسط.</p><button class="btn primary" data-account="">تسجيل الدخول</button></div>`;
    return;
  }
  let items = [];
  try { items = (await api('mylands_get')).items || []; } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  lsSet('myl_n', items.length);
  if (!items.length) {
    el.innerHTML = `<div class="empty">${ei('home')}<p>لا توجد أراضٍ مرتبطة بحسابك</p><p class="sub">اشتريت أرضاً من عمر الياسي للعقارات؟ اطلب من المكتب ربطها بحسابك لتتابع دفعاتها ويصلك تذكير قبل كل قسط.</p>
      <button class="btn primary" data-mylreq>${ei('chat')} اطلب ربط أرضي</button></div>`;
    el.querySelector('[data-mylreq]').onclick = () => { H.quoteToOffice('مرحباً، اشتريت أرضاً من عمر الياسي للعقارات وأرغب بربطها بحسابي في التطبيق.\nالمشروع: \nرقم القطعة: '); H.pushPage('mychat'); };
    return;
  }
  const t = today();
  el.innerHTML = items.map((p) => {
    const l = H.findLand(p.id);
    const inst = (p.inst || []).map(([d, a]) => ({ d, a: +a || 0 }));
    const next = inst.filter((x) => x.d >= t), past = inst.filter((x) => x.d < t);
    const nx = next[0], left = next.reduce((s, x) => s + x.a, 0), paidish = (p.total || 0) - left;
    const pct = p.total ? Math.max(0, Math.min(100, Math.round((paidish / p.total) * 100))) : 0;
    const dd = nx ? daysTo(nx.d) : 0;
    return `<article class="ccard mylc">
      <div class="mylh">${l && (l.poly || l.pc) ? `<div class="mylth"><canvas class="cardloc" data-loc="${esc(l.id)}"></canvas></div>` : ''}
        <div><b>قطعة ${esc(p.n || '')}</b><span>${esc(p.name || '')}${p.ft ? ' · ' + money(p.ft) + ' قدم²' : ''}</span>${p.total ? `<em>${money(p.total)} د.إ</em>` : ''}</div></div>
      ${nx ? `<div class="mylnext ${dd <= 3 ? 'soon' : ''}"><span>${ei('calendar')} القسط القادم</span><b>${money(nx.a)} د.إ</b><small><bdi>${dmy(nx.d)}</bdi> · ${dd === 0 ? 'اليوم' : dd === 1 ? 'غداً' : `بعد ${dd} ${dd <= 10 ? 'أيام' : 'يوماً'}`}</small></div>` : '<div class="mylnext done"><b>لا توجد أقساط قادمة</b></div>'}
      ${p.total && inst.length ? `<div class="mylbar"><i style="width:${pct}%"></i></div><div class="mylsum"><span>حسب الجدول: <b>${money(paidish)}</b> د.إ</span><span>المتبقي: <b>${money(left)}</b> د.إ</span></div>` : ''}
      ${inst.length ? `<details class="myldet"><summary>جدول الدفعات (${inst.length})</summary><div class="inst">
        ${p.first ? `<div class="r head"><span>الدفعة الأولى</span><b>${money(p.first)} د.إ</b></div>` : ''}
        ${inst.map((x, i) => `<div class="r${x.d < t ? ' past' : ''}${nx && x.d === nx.d ? ' cur' : ''}"><span>القسط ${i + 1} · <bdi>${dmy(x.d)}</bdi></span><b>${money(x.a)} د.إ</b></div>`).join('')}</div></details>` : ''}
      <div class="mylbtns"><button class="btn ghost" data-land="${esc(p.id)}">${I.building || ''} تفاصيل الأرض</button><a class="btn wa" data-ext href="${H.waLink(`مرحباً، بخصوص أرضي: قطعة ${p.n} · ${p.name}${nx ? `\nالقسط القادم ${money(nx.a)} د.إ بتاريخ ${dmy(nx.d)}` : ''}`)}">${I.wa} تواصل بخصوصها</a></div>
      ${past.length ? '<p class="muted cnote">الجدول من خطة الدفع المعتمدة — لتأكيد ما تم سداده تواصل مع المكتب.</p>' : ''}
    </article>`;
  }).join('') + '<p class="muted cnote">يصلك إشعار تذكير قبل كل قسط بـ 3 أيام وبيوم.</p>';
}

/* ================= «ادعُ أصدقاءك» ================= */
export function invitePage() { return '<div class="pad invp"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export async function initInvite(pg) {
  const el = pg.querySelector('.invp'); const { esc, I, APP_URL } = H;
  if (!session.token()) { el.innerHTML = `<div class="empty">${ei('plusc')}<p>سجّل الدخول للحصول على كود الدعوة الخاص بك</p><button class="btn primary" data-account="">تسجيل الدخول</button></div>`; return; }
  let j; try { j = await api('ref_me'); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  const link = `${APP_URL}?ref=${j.code}`;
  const msg = `أنصحك بتطبيق عمر الياسي للعقارات 🏡\nأراضي الشارقة بالمخططات التفاعلية والأسعار وخطط السداد في مكان واحد.\n\nحمّل التطبيق: ${link}\nكود الدعوة عند التسجيل: ${j.code}`;
  el.innerHTML = `<section class="invhero">${ei('plusc')}<h2>ادعُ أصدقاءك</h2><p>شارك التطبيق مع من يبحث عن أرض — وعند تسجيلهم بكودك يظهرون في حسابك ويعرف المكتب أنهم جاؤوا عن طريقك.</p>
      <div class="invcode" dir="ltr"><b>${esc(j.code)}</b><button data-invcopy aria-label="نسخ">${ei('doc')}</button></div></section>
    <div class="invbtns"><a class="btn wa" data-ext href="https://wa.me/?text=${encodeURIComponent(msg)}">${I.wa} مشاركة عبر واتساب</a><button class="btn ghost" data-invshare>${I.share} مشاركة</button></div>
    <div class="ab-stats invst"><div><b>${j.n}</b><span>سجّلوا بدعوتك</span></div><div><b>${j.won}</b><span>اشتروا</span></div></div>
    ${j.items.length ? `<div class="ccard"><h4 class="lh">من سجّل بدعوتك</h4>${j.items.map((x) => `<div class="gx-row"><span class="notr">${esc(x.name)}</span><small class="muted">${x.t ? new Date(x.t).toLocaleDateString('ar-AE') : ''}</small></div>`).join('')}</div>` : ''}`;
  el.querySelector('[data-invcopy]').onclick = async () => { try { await navigator.clipboard.writeText(j.code); H.toast('تم نسخ الكود ✓'); } catch { H.toast(j.code); } };
  el.querySelector('[data-invshare]').onclick = async () => {
    try { if (Capacitor.isNativePlatform()) { await Share.share({ text: msg }); return; } if (navigator.share) { await navigator.share({ text: msg }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(msg); H.toast('تم نسخ رسالة الدعوة ✓'); } catch { /* ignore */ }
  };
}
/** office: who brought the most members (and buyers) */
export function refsPage() { return '<div class="pad refs"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export async function initRefs(pg) {
  const el = pg.querySelector('.refs'); const { esc } = H;
  let j; try { j = await api('adm_refs'); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
  el.innerHTML = j.items.length ? j.items.map((r, i) => `<div class="ccard refc"><div class="refh"><i>${i + 1}</i><b class="notr">${esc(r.name)}</b><span>${r.n} سجّلوا · ${r.won} اشتروا</span></div>
      <div class="refl">${r.items.map((x) => `<button class="gx-row" data-lead="${x.id}"><span class="notr">${esc(x.name)}</span>${x.won ? '<em class="pill ok">اشترى</em>' : ''}</button>`).join('')}</div></div>`).join('')
    : `<div class="empty">${ei('plusc')}<p>لا توجد دعوات بعد</p><p class="sub">كل عضو له كود دعوة في «المزيد ← ادعُ أصدقاءك»؛ من يسجّل بكوده يظهر هنا.</p></div>`;
}

/* ================= «قيّمنا على جوجل بلاي» ================= */
const PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.omaralyassi.realestate';
/** after a good moment (a 4–5 star service rating, a booked viewing): once, and not again for 90 days if put off */
export function askPlayReview(delay = 1200) {
  if (Capacitor.getPlatform() !== 'android') return;
  const st = lsGet('playrev', {}); if (st.done || (st.later && Date.now() - st.later < 90 * DAY)) return;
  setTimeout(() => {
    if (document.querySelector('.playrev')) return;
    const el = document.createElement('div'); el.className = 'pkgsheet playrev';
    el.innerHTML = `<div class="pkgbox rsbox"><div class="rs-ic">${H.I.star}</div><h3>عجبك التطبيق؟</h3>
      <p class="muted">قيّمنا على Google Play — تقييمك بيساعد ناس أكتر يلاقوا أرضهم معانا</p>
      <div class="rs-st on5">${[1, 2, 3, 4, 5].map(() => `<i>${H.I.star}</i>`).join('')}</div>
      <button class="btn primary block" data-prgo>قيّم التطبيق</button>
      <div class="rs-later"><button type="button" data-prlater>لاحقاً</button></div></div>`;
    const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-prgo]')) { lsSet('playrev', { done: Date.now() }); close(); H.openExternal(PLAY_WEB); return; }
      if (e.target.closest('[data-prlater]') || e.target === el) { lsSet('playrev', { later: Date.now() }); close(); }
    });
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  }, delay);
}
