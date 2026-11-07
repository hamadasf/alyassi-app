// «حاسبة الأقساط»: down payment, number of instalments and how often → a dated schedule the client can share
// or send to the office. Opened from a land's page (its price and the developer's plan filled in) or from «المزيد».
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { api, session } from './owner.js';

let H = null;
export function initCalc(h) { H = h; }

const FREQ = [[1, 'شهري'], [3, 'كل 3 أشهر'], [6, 'كل 6 أشهر'], [12, 'سنوي']];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };
const addMonths = (s, k) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1 + k, 1); t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return iso(t); };
const num = (v) => +String(v || '').replace(/[^\d.]/g, '') || 0;

/** The developer's plan of a land, if it has one: first payment + dated instalments. */
function devPlan(l) { return l && l.inst && l.inst.length && l.total ? { first: l.first, inst: l.inst.map((x) => [x[0], +x[1] || 0]) } : null; }
function guessFreq(inst) {
  if (inst.length < 2) return 6;
  const a = new Date(inst[0][0]), b = new Date(inst[1][0]); const m = Math.round((b - a) / (30.44 * 864e5));
  return FREQ.map((f) => f[0]).reduce((best, f) => (Math.abs(f - m) < Math.abs(best - m) ? f : best), 6);
}

export function calcPage(l) {
  const { esc, money } = H;
  const dp = devPlan(l);
  const price = l ? l.total : 0;
  const downPct = dp ? Math.round((dp.first / price) * 100) : 20;
  const count = dp ? dp.inst.length : 12;
  const freq = dp ? guessFreq(dp.inst) : 1;
  const start = dp ? dp.inst[0][0] : addMonths(iso(new Date()), 1);
  return `<div class="pad calc">
    ${l ? `<div class="ccard chead2"><b>قطعة رقم ${esc(l.n)}</b><span>${esc(l.projectName)}${l.ft ? ' · ' + money(l.ft) + ' قدم²' : ''}</span></div>` : ''}
    ${dp ? `<div class="cseg"><button class="on" data-mode="dev">خطة المطوّر</button><button data-mode="own">خطة مخصّصة</button></div>` : ''}
    <div class="ccard cform" ${dp ? 'hidden' : ''}>
      <label>سعر الأرض (درهم)<input id="cPrice" inputmode="numeric" value="${price ? money(price) : ''}" placeholder="مثال: 650,000"></label>
      <label>الدفعة الأولى <b id="cDownL"></b><input id="cDown" type="range" min="0" max="90" step="5" value="${Math.min(90, Math.max(0, Math.round(downPct / 5) * 5))}"></label>
      <div class="cgrid"><label>عدد الأقساط<input id="cCount" type="number" min="1" max="120" value="${count}"></label>
        <label>تكرار القسط<select id="cFreq">${FREQ.map(([v, t]) => `<option value="${v}"${v === freq ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label>تاريخ أول قسط<input id="cStart" type="date" value="${start}"></label>
    </div>
    <div class="csum" id="cSum"></div>
    <div class="ccard ccost" id="cCost"></div>
    <h2 class="h2">جدول الدفعات</h2>
    <div class="inst" id="cTable"></div>
    <p class="muted cnote">الحاسبة تقديرية — الخطة المعتمدة والأسعار النهائية تؤكدها الإدارة.</p>
    <div class="cbtns"><a class="btn wa" id="cSend" data-ext href="#">${H.I.wa} أرسل الخطة للإدارة</a><button class="btn ghost" id="cShare">${H.I.share} مشاركة الجدول</button></div>
  </div>`;
}

export function initCalc2(pg, l) {
  const { money, esc } = H;
  const dp = devPlan(l);
  let mode = dp ? 'dev' : 'own';
  const $ = (s) => pg.querySelector(s);
  const plan = () => {
    if (mode === 'dev') return { price: dp.first + dp.inst.reduce((a, x) => a + x[1], 0), first: dp.first, rows: dp.inst };
    const price = num($('#cPrice').value), pct = +$('#cDown').value, n = Math.max(1, Math.min(120, Math.round(+$('#cCount').value || 1)));
    const f = +$('#cFreq').value, start = $('#cStart').value || addMonths(iso(new Date()), 1);
    const first = Math.round(price * pct / 100), rest = price - first, each = Math.floor(rest / n);
    const rows = []; for (let i = 0; i < n; i++) rows.push([addMonths(start, i * f), i === n - 1 ? rest - each * (n - 1) : each]);
    return { price, first, rows };
  };
  const text = (p) => {
    const lines = [`🧮 خطة سداد${l ? ` — قطعة رقم ${l.n} · ${l.projectName}` : ''}`, `السعر: ${money(p.price)} درهم`, `الدفعة الأولى: ${money(p.first)} درهم`,
      `${p.rows.length} أقساط:`, ...p.rows.map((r, i) => `${i + 1}) ${dmy(r[0])} — ${money(r[1])} درهم`), `الإجمالي: ${money(p.first + p.rows.reduce((a, r) => a + r[1], 0))} درهم`];
    return lines.join('\n');
  };
  const draw = () => {
    const p = plan();
    if ($('#cDownL')) $('#cDownL').textContent = `${$('#cDown').value}% · ${money(Math.round(num($('#cPrice').value) * $('#cDown').value / 100))} د.إ`;
    const each = p.rows.length ? p.rows[0][1] : 0, total = p.first + p.rows.reduce((a, r) => a + r[1], 0);
    $('#cSum').innerHTML = `<div><span>الدفعة الأولى</span><b>${money(p.first)}</b><small>د.إ</small></div>
      <div class="gold"><span>القسط</span><b>${money(each)}</b><small>د.إ × ${p.rows.length}</small></div>
      <div><span>الإجمالي</span><b>${money(total)}</b><small>د.إ</small></div>`;
    $('#cTable').innerHTML = p.price ? `<div class="r head"><span>الدفعة الأولى · عند الحجز</span><b>${money(p.first)} د.إ</b></div>
      ${p.rows.map((r, i) => `<div class="r"><span>القسط ${i + 1} · <bdi>${esc(dmy(r[0]))}</bdi></span><b>${money(r[1])} د.إ</b></div>`).join('')}
      <div class="r total"><span>الإجمالي</span><b>${money(total)} د.إ</b></div>` : '<div class="r"><span>أدخل سعر الأرض لعرض الجدول</span></div>';
    if ($('#cCost') && typeof drawCost === 'function') drawCost();
    $('#cSend').href = H.waLink((l ? 'مرحباً، أرغب بهذه الخطة:\n' : 'مرحباً، أرغب بالاستفسار عن خطة السداد التالية:\n') + text(p));
  };
  // «التكلفة الكاملة»: the price + the registration fee + the commission + fixed fees (the admin sets them; kept on the phone)
  let cfg = (() => { try { return JSON.parse(localStorage.getItem('oay:costcfg')) || null; } catch { return null; } })() || { reg: 2, comm: 2, fixed: [], note: 'النسب تقديرية — تؤكدها الإدارة قبل التوقيع.' };
  let withComm = true;
  const isAdmin = !!(session.user() || {}).admin;
  const drawCost = () => {
    const box = $('#cCost'); const p = plan(); const price = p.price || 0;
    const reg = Math.round(price * (+cfg.reg || 0) / 100), comm = withComm ? Math.round(price * (+cfg.comm || 0) / 100) : 0;
    const fixed = (cfg.fixed || []).filter((f) => f[0] && +f[1] > 0);
    const total = price + reg + comm + fixed.reduce((a, f) => a + (+f[1] || 0), 0);
    box.innerHTML = `<h3>${H.I.calc} التكلفة الكاملة</h3>
      <div class="inst"><div class="r"><span>سعر الأرض</span><b>${money(price)} د.إ</b></div>
        ${+cfg.reg ? `<div class="r"><span>رسوم التسجيل ونقل الملكية · ${cfg.reg}%</span><b>${money(reg)} د.إ</b></div>` : ''}
        ${+cfg.comm ? `<div class="r"><label class="cchk"><input type="checkbox" id="cComm" ${withComm ? 'checked' : ''}> عمولة الوساطة · ${cfg.comm}%</label><b>${money(comm)} د.إ</b></div>` : ''}
        ${fixed.map((f) => `<div class="r"><span>${esc(f[0])}</span><b>${money(+f[1])} د.إ</b></div>`).join('')}
        <div class="r total"><span>الإجمالي التقريبي</span><b>${money(total)} د.إ</b></div></div>
      ${price && p.first ? `<p class="cfirst">المطلوب عند الشراء تقريباً: <b>${money(p.first + reg + comm + fixed.reduce((a, f) => a + (+f[1] || 0), 0))} د.إ</b> <small>(الدفعة الأولى + الرسوم)</small></p>` : ''}
      <p class="muted cnote">${esc(cfg.note || '')}</p>
      ${isAdmin ? `<button class="btn ghost block" data-costedit>${H.I.gear || ''} تعديل الرسوم (للإدارة)</button>` : ''}`;
  };
  api('cost_cfg').then((j) => { if (j && j.cfg) { cfg = j.cfg; try { localStorage.setItem('oay:costcfg', JSON.stringify(cfg)); } catch { /* private mode */ } drawCost(); } }).catch(() => {});
  pg.addEventListener('change', (e) => { if (e.target.id === 'cComm') { withComm = e.target.checked; drawCost(); } });
  pg.addEventListener('click', async (e) => {
    if (e.target.closest('[data-costedit]')) {
      const box = $('#cCost'); const fx = [...(cfg.fixed || []), ['', 0], ['', 0]].slice(0, 4);
      box.innerHTML = `<h3>${H.I.calc} رسوم التكلفة الكاملة</h3><div class="cform">
        <div class="cgrid"><label>رسوم التسجيل %<input id="eReg" inputmode="decimal" value="${cfg.reg}"></label><label>عمولة الوساطة %<input id="eComm" inputmode="decimal" value="${cfg.comm}"></label></div>
        ${fx.map((f, i) => `<div class="cgrid"><label>رسوم ثابتة ${i + 1}<input data-fxn="${i}" value="${esc(f[0])}" placeholder="مثال: رسوم إصدار سند"></label><label>المبلغ (د.إ)<input data-fxa="${i}" inputmode="numeric" value="${+f[1] || ''}"></label></div>`).join('')}
        <label>ملاحظة تظهر للعميل<input id="eNote" value="${esc(cfg.note || '')}"></label>
        <button class="btn primary block" data-costsave>حفظ</button></div>`;
      return;
    }
    if (e.target.closest('[data-costsave]')) {
      const box = $('#cCost'); const fixed = [...box.querySelectorAll('[data-fxn]')].map((n) => [n.value.trim(), num(box.querySelector(`[data-fxa="${n.dataset.fxn}"]`).value)]).filter((f) => f[0]);
      try { const j = await api('adm_cost_save', { reg: +String($('#eReg').value).replace(/[^\d.]/g, '') || 0, comm: +String($('#eComm').value).replace(/[^\d.]/g, '') || 0, fixed, note: $('#eNote').value.trim() }); cfg = j.cfg; try { localStorage.setItem('oay:costcfg', JSON.stringify(cfg)); } catch { /* private mode */ } H.toast('تم حفظ الرسوم ✓'); drawCost(); }
      catch (ex) { H.toast(ex.message); }
    }
  });
  pg.querySelectorAll('.cform input, .cform select').forEach((el) => el.addEventListener('input', draw));
  $('#cPrice').addEventListener('blur', () => { const v = num($('#cPrice').value); if (v) $('#cPrice').value = money(v); });
  pg.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; pg.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b)); $('.cform').hidden = mode === 'dev'; draw(); }; });
  $('#cShare').onclick = async () => {
    const t = text(plan());
    try { if (Capacitor.isNativePlatform()) { await Share.share({ text: t }); return; } if (navigator.share) { await navigator.share({ text: t }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(t); H.toast('تم نسخ الجدول ✓'); } catch { H.toast('تعذّر النسخ'); }
  };
  draw();
}
