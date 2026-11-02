// «محفظتي» — the broker / office wallet: their listings, their deals (lands bought → instalments they pay, lands sold →
// instalments they receive + their commission), the next payment, upcoming instalments, a 12-month cash-flow chart and
// their earnings. The broker keeps it; the office (permission «listings») can open anyone's wallet and add or edit.
import { api } from './owner.js';

let H = null;
export function initWallet(h) { H = h; }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nf = new Intl.NumberFormat('en-US');
const m = (n) => nf.format(Math.round(n || 0));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const addMonths = (s, k) => { const [y, mo, d] = s.split('-').map(Number); const t = new Date(y, mo - 1 + k, 1); t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return iso(t); };
const dmy = (s) => { const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return x ? `${x[3]}/${x[2]}/${x[1]}` : s; };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const num = (v) => +String(v || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.]/g, '') || 0;
export const commOf = (d) => (d.type === 'sell' ? (d.comm || Math.round(d.price * (d.pct || 0) / 100)) : 0);

/** everything the screen shows, from the deals */
function summary(deals) {
  const t = today(), year = t.slice(0, 4), rows = [];
  let inLeft = 0, outLeft = 0, inPaid = 0, outPaid = 0, earn = 0, earnYear = 0, active = 0;
  deals.forEach((d) => {
    const left = d.sched.filter((r) => !r.p).reduce((a, r) => a + r.a, 0), paid = d.sched.filter((r) => r.p).reduce((a, r) => a + r.a, 0);
    if (d.type === 'sell') { inLeft += left; inPaid += paid; const c = commOf(d); earn += c; if ((d.date || '').startsWith(year)) earnYear += c; }
    else { outLeft += left; outPaid += paid; }
    if (!d.done && left > 0) active++;
    d.sched.forEach((r, i) => { if (!r.p) rows.push({ ...r, i, deal: d }); });
  });
  rows.sort((a, b) => a.d.localeCompare(b.d));
  const next = rows[0] || null, late = rows.filter((r) => r.d < t);
  // next 12 months: money in (sold lands) and out (bought lands), late ones counted in this month
  const months = Array.from({ length: 12 }, (_, k) => { const s = addMonths(t.slice(0, 8) + '01', k); return { key: s.slice(0, 7), label: MONTHS[+s.slice(5, 7) - 1], in: 0, out: 0 }; });
  rows.forEach((r) => { const key = r.d < t ? months[0].key : r.d.slice(0, 7); const mo = months.find((x) => x.key === key); if (mo) mo[r.deal.type === 'sell' ? 'in' : 'out'] += r.a; });
  return { rows, next, late, inLeft, outLeft, inPaid, outPaid, earn, earnYear, active, months };
}
function chart(months) {
  const W = 340, Hh = 130, max = Math.max(1, ...months.map((x) => Math.max(x.in, x.out))), bw = W / months.length;
  const bars = months.map((x, i) => {
    const hi = Math.round(x.in / max * (Hh - 6)), ho = Math.round(x.out / max * (Hh - 6)), x0 = (months.length - 1 - i) * bw;   // right to left, like the page
    return `<rect x="${(x0 + bw * 0.12).toFixed(1)}" y="${Hh - hi}" width="${(bw * 0.36).toFixed(1)}" height="${hi}" rx="2" fill="#16a34a"><title>${x.label}: لك ${m(x.in)}</title></rect>
      <rect x="${(x0 + bw * 0.52).toFixed(1)}" y="${Hh - ho}" width="${(bw * 0.36).toFixed(1)}" height="${ho}" rx="2" fill="#dc2626"><title>${x.label}: عليك ${m(x.out)}</title></rect>
      <text x="${(x0 + bw / 2).toFixed(1)}" y="${Hh + 13}" text-anchor="middle">${x.label.slice(0, 3)}</text>`;
  }).join('');
  return `<div class="wchart"><svg viewBox="0 0 ${W} ${Hh + 18}">${bars}</svg><div class="stleg"><span><i style="background:#16a34a"></i>أقساط لك</span><span><i style="background:#dc2626"></i>أقساط عليك</span><span class="muted">آخر 12 شهراً قادمة</span></div></div>`;
}

/* ---------- a deal started from a land's page: the land, its price and the developer's dated plan filled in ---------- */
let pending = null;
export function dealFromLand(l) {
  const inst = (l.inst || []).map((x) => [String(x[0] || '').slice(0, 10), +x[1] || 0]).filter((x) => x[0] && x[1]);
  const sum = inst.reduce((a, x) => a + x[1], 0), down = inst.length ? Math.max(0, (l.total || 0) - sum) : (l.total || 0);
  const sched = [];
  if (down) sched.push({ d: today(), a: down, p: false, l: inst.length ? 'الدفعة المقدمة' : 'كاش' });
  inst.forEach((x, k) => sched.push({ d: x[0], a: x[1], p: false, l: `القسط ${k + 1}` }));
  pending = { type: 'sell', title: `قطعة ${l.n} · ${l.projectName}`, project: l.project, plot: l.n, price: l.total || 0, sched };
}
/** «محفظتي» card on the home page: this month in / out and the next payment (brokers only) */
export async function homeWalletCard(el) {
  if (!el) return;
  try {
    const j = await api('wallet_get'); const s = summary(j.deals || []);
    if (!(j.deals || []).length) { el.innerHTML = `<button class="whome empty" data-wallet=""><b>💼 محفظتي</b><span>سجّل صفقاتك وأقساطك وتابع أرباحك من مكان واحد</span></button>`; return; }
    const mo = s.months[0], nx = s.next;
    el.innerHTML = `<button class="whome" data-wallet=""><div class="wh1"><b>💼 محفظتي</b><span>هذا الشهر</span></div>
      <div class="wh2"><div class="in"><small>تستلم</small><b>${m(mo.in)}</b></div><div class="out"><small>تدفع</small><b>${m(mo.out)}</b></div><div><small>أرباحي</small><b>${m(s.earn)}</b></div></div>
      ${nx ? `<div class="wh3 ${nx.d < today() ? 'late' : ''}">${nx.d < today() ? '⚠️ متأخرة' : 'الدفعة القادمة'}: <b>${m(nx.a)} د.إ</b> ${nx.deal.type === 'sell' ? 'لك' : 'عليك'} · ${dmy(nx.d)}</div>` : ''}</button>`;
  } catch { el.innerHTML = ''; }
}
export function walletPage() { return '<div class="pad wallet" id="wBox"><div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div></div>'; }
export function initWalletPage(pg, uid) {
  const box = pg.querySelector('#wBox'); let data = null, tab = 'due';
  const call = (action, body = {}) => api(action, uid ? { uid, ...body } : body);
  const draw = () => {
    const s = summary(data.deals), L = data.listings, other = uid && data.who;
    const nx = s.next;
    box.innerHTML = `${other ? `<div class="wwho">💼 محفظة <b>${esc(data.who.name)}</b></div>` : ''}
      <div class="wgrid">
        <div class="wtile"><small>الأراضي المعروضة</small><b>${m(L.live)}</b><span>من ${m(L.all)} إعلان</span></div>
        <div class="wtile"><small>الصفقات النشطة</small><b>${m(s.active)}</b><span>من ${m(data.deals.length)} صفقة</span></div>
        <div class="wtile in"><small>المستحق لك</small><b>${m(s.inLeft)}</b><span>استلمت ${m(s.inPaid)} د.إ</span></div>
        <div class="wtile out"><small>المستحق عليك</small><b>${m(s.outLeft)}</b><span>دفعت ${m(s.outPaid)} د.إ</span></div>
        <div class="wtile earn"><small>أرباحي (العمولات)</small><b>${m(s.earn)}</b><span>هذه السنة ${m(s.earnYear)} د.إ</span></div>
        <div class="wtile"><small>قيمة الأراضي المعروضة</small><b>${m(L.value)}</b><span>درهم</span></div>
      </div>
      ${nx ? `<div class="wnext ${nx.deal.type === 'sell' ? 'in' : 'out'}${nx.d < today() ? ' late' : ''}"><small>${nx.d < today() ? '⚠️ دفعة متأخرة' : 'الدفعة القادمة'}</small>
          <b>${m(nx.a)} د.إ</b><span>${nx.deal.type === 'sell' ? 'لك من' : 'عليك إلى'} ${esc(nx.deal.party || '—')} · ${esc(nx.deal.title)} · ${dmy(nx.d)}</span></div>` : '<div class="wnext none"><span>لا توجد أقساط قادمة</span></div>'}
      ${s.late.length > 1 ? `<p class="wlate">⚠️ ${s.late.length} أقساط متأخرة بإجمالي ${m(s.late.reduce((a, r) => a + r.a, 0))} د.إ</p>` : ''}
      ${chart(s.months)}
      <div class="seg wtabs"><button data-wtab="due" class="${tab === 'due' ? 'on' : ''}">الأقساط القادمة (${s.rows.length})</button><button data-wtab="deals" class="${tab === 'deals' ? 'on' : ''}">الصفقات (${data.deals.length})</button></div>
      <div id="wList">${tab === 'due' ? dueList(s.rows) : dealList(data.deals)}</div>
      <button class="btn gold block share-big" data-wnew>＋ صفقة جديدة</button>`;
  };
  const dueList = (rows) => (rows.length ? rows.slice(0, 80).map((r) => `<div class="wrow ${r.deal.type === 'sell' ? 'in' : 'out'}${r.d < today() ? ' late' : ''}">
      <label class="wchk"><input type="checkbox" data-wpay="${esc(r.deal.id)}|${r.i}"><i></i></label>
      <div><b>${m(r.a)} د.إ</b><span>${r.deal.type === 'sell' ? '⬇️ لك من' : '⬆️ عليك إلى'} ${esc(r.deal.party || '—')} · ${esc(r.deal.title)}${r.l ? ' · ' + esc(r.l) : ''}</span></div>
      <em>${dmy(r.d)}${r.deal.type === 'sell' ? `<button class="wrem" data-wrem="${esc(r.deal.id)}|${r.i}" aria-label="ذكّر العميل">💬 ذكّر</button>` : ''}</em></div>`).join('') : '<p class="muted">لا توجد أقساط قادمة. أضف صفقة بجدول دفعاتها.</p>');
  const dealList = (deals) => (deals.length ? [...deals].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((d) => {
    const tot = d.sched.reduce((a, r) => a + r.a, 0), paid = d.sched.filter((r) => r.p).reduce((a, r) => a + r.a, 0), pc = tot ? Math.round(paid / tot * 100) : 0;
    return `<button class="wdeal" data-wedit="${esc(d.id)}"><div class="wd1"><i class="pill ${d.type === 'sell' ? 'av' : 'sold'}">${d.type === 'sell' ? 'بيع' : 'شراء'}</i><b>${esc(d.title)}</b>${d.done ? '<i class="pill">منتهية</i>' : ''}</div>
      <span>${esc(d.party || '—')} · ${m(d.price)} د.إ${d.type === 'sell' ? ` · عمولة ${m(commOf(d))} د.إ` : ''} · ${dmy(d.date)}</span>
      <div class="wbar"><i style="width:${pc}%"></i></div><small>${d.type === 'sell' ? 'استلمت' : 'دفعت'} ${m(paid)} من ${m(tot)} د.إ (${pc}%)</small></button>`;
  }).join('') : '<p class="muted">لا توجد صفقات بعد.</p>');

  const load = async () => {
    try { data = await call('wallet_get'); draw(); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    if (pending) { const p = pending; pending = null; editDeal(null, p); }   // «سجّلها بيعاً» from a land's page
  };
  box.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-wrem]');
    if (rm) {   // a ready WhatsApp reminder to the client
      const [id, i] = rm.dataset.wrem.split('|'), d = data.deals.find((x) => x.id === id), r = d && d.sched[+i]; if (!r) return;
      const ph = String(d.phone || '').replace(/\D/g, '').replace(/^00/, '').replace(/^0(5\d{8})$/, '971$1');
      const txt = `السلام عليكم ${d.party || ''}،\nتذكير ودّي: ${r.l || 'القسط'} لـ ${d.title} بقيمة ${m(r.a)} درهم ${r.d < today() ? 'كان مستحقاً بتاريخ' : 'مستحق بتاريخ'} ${dmy(r.d)}.\nشكراً لتعاملكم معنا 🌷\n${data.who ? data.who.name : ''}`;
      H.openUrl(`https://wa.me/${ph}?text=${encodeURIComponent(txt)}`); return;
    }
    const t = e.target.closest('[data-wtab], [data-wnew], [data-wedit]'); if (!t) return;
    if (t.dataset.wtab) { tab = t.dataset.wtab; draw(); return; }
    if (t.dataset.wnew !== undefined) { editDeal(null); return; }
    if (t.dataset.wedit) { editDeal(data.deals.find((d) => d.id === t.dataset.wedit)); }
  });
  box.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-wpay]'); if (!c) return;
    const [id, i] = c.dataset.wpay.split('|');
    try { data = await call('wallet_pay', { id, i, paid: c.checked ? '1' : '0' }); H.toast('تم تسجيل الدفعة ✓'); draw(); } catch (ex) { H.toast(ex.message); c.checked = false; }
  });

  /* ---------- add / edit a deal (full-screen form over the wallet) ---------- */
  function editDeal(d0, pre) {
    const d = d0 ? JSON.parse(JSON.stringify(d0)) : { type: 'sell', title: '', party: '', phone: '', price: 0, pct: 2, comm: 0, date: today(), note: '', sched: [], ...(pre || {}) };
    const ov = document.createElement('div'); ov.className = 'walletf';
    const projects = (H.projects() || []).map((p) => `<option value="${esc(p.slug)}" ${d.project === p.slug ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    ov.innerHTML = `<div class="wfbox"><header><button class="back" data-wx aria-label="إغلاق">✕</button><b>${d0 ? 'تعديل الصفقة' : 'صفقة جديدة'}</b></header>
      <div class="wfbody">
        <div class="seg"><button type="button" data-ty="sell" class="${d.type === 'sell' ? 'on' : ''}">⬇️ أرض بعتها لعميل</button><button type="button" data-ty="buy" class="${d.type === 'buy' ? 'on' : ''}">⬆️ أرض اشتريتها</button></div>
        <p class="help" id="tyHelp"></p>
        <label class="fld">الأرض (الاسم أو الوصف) *<input id="fTitle" value="${esc(d.title)}" placeholder="مثال: قطعة 4873 الدبدبة شمال"></label>
        <div class="two"><label class="fld">المشروع<select id="fProj"><option value="">—</option>${projects}</select></label><label class="fld">رقم القطعة<input id="fPlot" value="${esc(d.plot || '')}" dir="ltr"></label></div>
        <div class="two"><label class="fld" id="partyL">اسم العميل<input id="fParty" value="${esc(d.party)}"></label><label class="fld">جواله (للتذكير بالواتساب)<input id="fPhone" type="tel" dir="ltr" inputmode="tel" value="${esc(d.phone || '')}" placeholder="05xxxxxxxx"></label></div>
        <div class="two"><label class="fld">سعر الأرض (درهم) *<input id="fPrice" inputmode="numeric" dir="ltr" value="${d.price || ''}"></label><label class="fld">تاريخ الصفقة<input id="fDate" type="date" value="${esc(d.date)}"></label></div>
        <div class="two sellonly"><label class="fld">العمولة %<input id="fPct" inputmode="decimal" dir="ltr" value="${d.pct || ''}"></label><label class="fld">أو عمولة ثابتة (درهم)<input id="fComm" inputmode="numeric" dir="ltr" value="${d.comm || ''}"></label></div>
        <p class="wcomm sellonly" id="commOut"></p>
        <h4 class="lh">جدول الدفعات</h4>
        <div class="wgen"><div class="two"><label class="fld">الدفعة المقدمة<input id="gDown" inputmode="numeric" dir="ltr"></label><label class="fld">عدد الأقساط<input id="gN" inputmode="numeric" dir="ltr" value="4"></label></div>
          <div class="two"><label class="fld">أول قسط<input id="gFirst" type="date" value="${addMonths(today(), 1)}"></label><label class="fld">كل<select id="gEvery"><option value="1">شهر</option><option value="3">3 شهور</option><option value="4" selected>4 شهور</option><option value="6">6 شهور</option><option value="12">سنة</option></select></label></div>
          <button type="button" class="btn block" id="gMake">إنشاء الجدول تلقائياً</button></div>
        <div id="schedL"></div>
        <button type="button" class="btn sm" id="addRow">＋ دفعة</button>
        <label class="fld">ملاحظات<textarea id="fNote" rows="2">${esc(d.note)}</textarea></label>
        <label class="nrow"><span>صفقة منتهية (مكتملة)</span><input type="checkbox" class="nchk" id="fDone" ${d.done ? 'checked' : ''}></label>
        <button class="btn primary block share-big" id="fSave">حفظ الصفقة</button>
        ${d0 ? '<button class="btn ghost danger block" id="fDel">🗑 حذف الصفقة</button>' : ''}
      </div></div>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
    const $ = (s) => ov.querySelector(s);
    const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 200); };
    const setType = () => {
      ov.querySelectorAll('[data-ty]').forEach((b) => b.classList.toggle('on', b.dataset.ty === d.type));
      ov.querySelectorAll('.sellonly').forEach((el) => { el.hidden = d.type !== 'sell'; });
      $('#partyL').firstChild.textContent = d.type === 'sell' ? 'اسم العميل (المشتري)' : 'اشتريتها من (البائع / المطوّر)';
      $('#tyHelp').textContent = d.type === 'sell' ? 'الأقساط هنا تستلمها من العميل، وعمولتك تُحسب في أرباحك.' : 'الأقساط هنا تدفعها أنت، وتظهر في «المستحق عليك».';
      showComm();
    };
    const showComm = () => { const p = num($('#fPrice').value), c = num($('#fComm').value) || Math.round(p * num($('#fPct').value) / 100); $('#commOut').textContent = c ? `عمولتك: ${m(c)} درهم` : ''; };
    const drawSched = () => {
      const tot = d.sched.reduce((a, r) => a + (+r.a || 0), 0), price = num($('#fPrice').value);
      $('#schedL').innerHTML = d.sched.map((r, i) => `<div class="srow"><input type="date" data-si="${i}" data-sf="d" value="${esc(r.d)}"><input inputmode="numeric" dir="ltr" data-si="${i}" data-sf="a" value="${r.a || ''}" placeholder="المبلغ">
          <input data-si="${i}" data-sf="l" value="${esc(r.l || '')}" placeholder="البيان"><label class="wchk sm"><input type="checkbox" data-si="${i}" data-sf="p" ${r.p ? 'checked' : ''}><i></i></label><button type="button" class="srm" data-srm="${i}">✕</button></div>`).join('')
        + (d.sched.length ? `<p class="help ${price && Math.abs(price - tot) > 1 ? 'warn' : ''}">مجموع الجدول ${m(tot)} من سعر ${m(price)} درهم${price && Math.abs(price - tot) > 1 ? ' — لا يساوي السعر' : ' ✓'}. ✓ = مدفوعة</p>` : '<p class="help">أضف الدفعات أو أنشئ الجدول تلقائياً.</p>');
    };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.wx !== undefined) { close(); return; }
      if (b.dataset.ty) { d.type = b.dataset.ty; setType(); return; }
      if (b.dataset.srm !== undefined) { d.sched.splice(+b.dataset.srm, 1); drawSched(); return; }
      if (b.id === 'addRow') { const last = d.sched[d.sched.length - 1]; d.sched.push({ d: last ? addMonths(last.d, 1) : today(), a: 0, p: false, l: '' }); drawSched(); return; }
      if (b.id === 'gMake') {
        const price = num($('#fPrice').value); if (!price) { H.toast('اكتب سعر الأرض أولاً'); return; }
        const down = Math.min(price, num($('#gDown').value)), n = Math.max(0, Math.min(120, Math.round(num($('#gN').value)))), ev = +$('#gEvery').value, first = $('#gFirst').value || addMonths(today(), 1);
        const rest = price - down, each = n ? Math.floor(rest / n) : 0, s = [];
        if (down) s.push({ d: $('#fDate').value || today(), a: down, p: false, l: 'الدفعة المقدمة' });
        for (let k = 0; k < n; k++) s.push({ d: addMonths(first, k * ev), a: k === n - 1 ? rest - each * (n - 1) : each, p: false, l: `القسط ${k + 1}` });
        if (!n && !down) s.push({ d: $('#fDate').value || today(), a: price, p: false, l: 'كاش' });
        d.sched = s; drawSched(); return;
      }
      if (b.id === 'fDel') {
        if (!confirm('حذف هذه الصفقة نهائياً؟')) return;
        call('wallet_del', { id: d.id }).then((j) => { data = j; draw(); close(); H.toast('تم حذف الصفقة'); }).catch((ex) => H.toast(ex.message)); return;
      }
      if (b.id === 'fSave') {
        const deal = { ...d, title: $('#fTitle').value.trim(), project: $('#fProj').value, plot: $('#fPlot').value.trim(), party: $('#fParty').value.trim(), phone: $('#fPhone').value.trim(), price: num($('#fPrice').value),
          date: $('#fDate').value, pct: num($('#fPct').value), comm: num($('#fComm').value), note: $('#fNote').value.trim(), done: $('#fDone').checked,
          sched: d.sched.map((r) => ({ ...r, a: +r.a || 0 })).filter((r) => r.d && r.a) };
        b.disabled = true; b.textContent = 'جارِ الحفظ…';
        call('wallet_save', { deal }).then((j) => { data = j; draw(); close(); H.toast('تم حفظ الصفقة ✓'); })
          .catch((ex) => { H.toast(ex.message); b.disabled = false; b.textContent = 'حفظ الصفقة'; });
      }
    });
    ov.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.si !== undefined && t.dataset.sf !== 'p') { const r = d.sched[+t.dataset.si]; r[t.dataset.sf] = t.dataset.sf === 'a' ? num(t.value) : t.value; if (t.dataset.sf === 'a') { const tot = d.sched.reduce((a, x) => a + (+x.a || 0), 0); const h = $('#schedL .help'); if (h) h.textContent = `مجموع الجدول ${m(tot)} من سعر ${m(num($('#fPrice').value))} درهم`; } return; }
      if (['fPrice', 'fPct', 'fComm'].includes(t.id)) showComm();
      if (t.id === 'fProj' || t.id === 'fPlot') { const p = (H.projects() || []).find((x) => x.slug === $('#fProj').value); if (p && !d0 && ($('#fPlot').value || '').trim()) $('#fTitle').value = `قطعة ${$('#fPlot').value.trim()} · ${p.name}`; }
    });
    ov.addEventListener('change', (e) => { const t = e.target; if (t.dataset.si !== undefined && t.dataset.sf === 'p') d.sched[+t.dataset.si].p = t.checked; if (t.id === 'fProj') t.dispatchEvent(new Event('input', { bubbles: true })); });
    setType(); drawSched();
  }
  load();
}
