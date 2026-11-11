// Management: add / edit a company plot on a project's plan — status, price, area, «مميزة» and the payment plan.
// Saved to the website's plan data (the same the website's plan editor uses), so the website, the app and the
// notifications all follow.
import { api } from './owner.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null;
export function initPlotEdit(h) { H = h; }
const n0 = (v) => +String(v ?? '').replace(/[^\d.]/g, '') || 0;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addMonths = (s, k) => { const d = new Date(s + 'T00:00:00'); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return ymd(d); };
const ST = [['av', 'متاحة', 'ok'], ['res', 'محجوزة', 'res'], ['sold', 'مباعة', 'sold'], ['', 'غير معروضة', 'off']];

export function plotEditPage() { return '<div class="pad pled"></div>'; }
export function initPlotEditPage(pg, id = '') {
  const { esc, money, I } = H; const el = pg.querySelector('.pled');
  const [slug0, n0s] = String(id || '').split('|');
  const projects = H.DATA().projects;
  let cur = null, inst = [], stt = 'av', quiet = false;   // «حفظ بدون إشعار» stays on for the next plots until turned off
  el.innerHTML = `<div class="ccard">
      <div class="cgrid"><label>المشروع<select id="peProj">${projects.map((p) => `<option value="${esc(p.slug)}"${p.slug === slug0 ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>رقم القطعة<span class="pe-n"><input id="peN" inputmode="numeric" value="${esc(n0s || '')}" placeholder="مثال: 4701"><button class="btn primary" data-peload>عرض</button></span></label></div>
      <p class="muted pe-info" id="peInfo">اكتب رقم القطعة كما في مخطط المشروع ثم اضغط «عرض».</p></div>
    <div id="peForm" hidden></div><div id="peHist"></div>`;
  const $ = (s) => el.querySelector(s);
  const area = () => n0($('#peFt') && $('#peFt').value) || (cur && cur.planFt) || 0;
  const total = () => n0($('#peTotal') && $('#peTotal').value);
  const drawSum = () => {
    if (!$('#peSum')) return;
    const sum = inst.reduce((a, x) => a + (n0(x[1]) || 0), 0), t = total(), first = t ? t - sum : 0;
    $('#peSum').innerHTML = t ? `<span>الدفعة الأولى: <b class="${first < 0 ? 'bad' : ''}">${money(Math.max(0, first))} د.إ</b>${t ? ` <small>(${Math.round(Math.max(0, first) / t * 100)}%)</small>` : ''}</span><span>الأقساط: <b>${money(sum)} د.إ</b> · ${inst.length} قسط</span>${first < 0 ? '<em class="bad">مجموع الأقساط أكبر من السعر</em>' : ''}` : '<span class="muted">اكتب السعر لحساب الدفعة الأولى</span>';
  };
  const drawInst = () => {
    const box = $('#peInst'); if (!box) return;
    box.innerHTML = inst.map((x, i) => `<div class="pe-row"><span class="pe-i">${i + 1}</span><input type="date" data-id="${i}" value="${esc(x[0] || '')}"><input data-ia="${i}" inputmode="numeric" value="${x[1] ? money(n0(x[1])) : ''}" placeholder="المبلغ"><button data-idel="${i}" aria-label="حذف">✕</button></div>`).join('')
      || '<p class="muted">لا توجد أقساط — السعر يُدفع مرة واحدة.</p>';
    drawSum();
  };
  const form = () => {
    const c = cur;
    $('#peForm').hidden = false;
    $('#peForm').innerHTML = `<div id="peCopy" class="pe-copy"></div><div class="ccard">
        <h3>الحالة</h3><div class="pe-st">${ST.map(([k, l, cls]) => `<button class="${cls}${k === stt ? ' on' : ''}" data-pst="${k}">${l}</button>`).join('')}</div>
        <h3>السعر والمساحة</h3>
        <div class="cgrid"><label>سعر الأرض (د.إ)<input id="peTotal" inputmode="numeric" value="${c.total ? money(c.total) : ''}"></label>
          <label>سعر القدم (د.إ)<input id="pePpf" inputmode="decimal" value="${c.ppf || ''}"></label></div>
        <div class="cgrid"><label>المساحة (قدم²) <small>اختياري</small><input id="peFt" inputmode="decimal" value="${c.ft || ''}" placeholder="${c.planFt ? 'من المخطط: ' + money(c.planFt) : ''}"></label>
          <label class="pe-chk"><input type="checkbox" id="peFe" ${c.fe ? 'checked' : ''}> أرض مميزة ⭐</label></div>
        <label>رابط موقع القطعة <small>اختياري</small><input id="peLo" dir="ltr" value="${esc(c.lo || '')}" placeholder="https://maps.app.goo.gl/..."></label></div>
      <div class="ccard"><h3>خطة السداد</h3>
        <div class="pe-sum" id="peSum"></div>
        <details class="pe-gen"><summary>${I.calc} توليد الأقساط تلقائياً</summary>
          <div class="cgrid"><label>الدفعة الأولى %<input id="gFirst" inputmode="decimal" value="20"></label><label>عدد الأقساط<input id="gN" inputmode="numeric" value="12"></label></div>
          <div class="cgrid"><label>كل<select id="gEvery">${Array.from({ length: 12 }, (_, i) => i + 1).map((m) => `<option value="${m}"${m === 3 ? ' selected' : ''}>${m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m === 12 ? 'سنة (12 شهر)' : m <= 10 ? m + ' أشهر' : m + ' شهراً'}</option>`).join('')}</select></label>
            <label>تاريخ أول قسط<input type="date" id="gStart" value="${addMonths(ymd(new Date()), 1)}"></label></div>
          <button class="btn ghost block" data-pegen>توليد</button></details>
        <div id="peInst"></div>
        <button class="btn ghost block" data-iadd>+ إضافة قسط</button></div>
      <label class="pe-quiet"><input type="checkbox" id="peQuiet"><span><b>حفظ بدون إشعار</b><small>لا يصل إشعار للعملاء ولا للفريق عن هذا الحفظ</small></span></label>
      <button class="btn primary block pe-save" data-pesave>${I.check || ''} حفظ القطعة على المخطط</button>
      <p class="muted cnote" id="peNote">يظهر التعديل في الموقع والتطبيق خلال دقائق، ويصل إشعار للعملاء عند إضافة أرض متاحة أو تغيّر الحالة أو السعر.</p>`;
    const q = $('#peQuiet'); q.checked = quiet; const qn = () => { $('#peNote').textContent = q.checked ? 'سيظهر التعديل في الموقع والتطبيق خلال دقائق — بدون أي إشعار.' : 'يظهر التعديل في الموقع والتطبيق خلال دقائق، ويصل إشعار للعملاء عند إضافة أرض متاحة أو تغيّر الحالة أو السعر.'; $('[data-pesave]').innerHTML = `${I.check || ''} ${q.checked ? 'حفظ بدون إشعار' : 'حفظ القطعة على المخطط'}`; };
    q.onchange = () => { quiet = q.checked; qn(); }; qn();
    drawInst(); drawCopy();
  };
  /* ---- «نسخ من قطعة»: a plot of the same size in the project is offered; any plot can be copied by its number ---- */
  const RK = 'oay:pe_recent';
  const recent = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]'); } catch { return []; } };
  const remember = (slug, n) => { try { localStorage.setItem(RK, JSON.stringify([slug + ':' + n, ...recent().filter((x) => x !== slug + ':' + n)].slice(0, 8))); } catch { /* private */ } };
  const twins = () => {   // listed plots of this project with the same area (±1%), same kind first, nearest number first
    const slug = $('#peProj').value, ft = (cur && (cur.ft || cur.planFt)) || 0; if (!ft) return [];
    const p = projects.find((x) => x.slug === slug); const me = H.findLand(slug + ':' + cur.n) || {};
    return ((p && p.lands) || []).filter((l) => String(l.n) !== String(cur.n) && l.total > 0 && l.ft && Math.abs(l.ft - ft) <= ft * 0.01 && l.status !== 'sold')
      .sort((a, b) => ((a.t === (cur.type || me.t) ? 0 : 1) - (b.t === (cur.type || me.t) ? 0 : 1)) || ((b.inst || []).length - (a.inst || []).length) || (Math.abs(+a.n - +cur.n) - Math.abs(+b.n - +cur.n)))
      .slice(0, 3);
  };
  const instTxt = (k, first, total) => (k ? `${total ? Math.round(first / total * 100) + '% مقدم + ' : ''}${k} قسط` : 'دفعة واحدة');
  const drawCopy = () => {
    const box = $('#peCopy'); if (!box || !cur) return;
    const slug = $('#peProj').value, T = twins();
    const rec = recent().filter((x) => x.startsWith(slug + ':') && x !== slug + ':' + cur.n).slice(0, 4);
    box.innerHTML = `${T.length ? `<div class="pe-twin"><b>${I.copy || '⧉'} قطع بنفس المساحة (${money(T[0].ft)} قدم²)</b>${T.map((l) => {
        const k = (l.inst || []).length, first = l.total - (l.inst || []).reduce((a, x) => a + (+x[1] || 0), 0);
        return `<button class="pe-tw" data-pecopy="${esc(l.n)}"><span><b>قطعة ${esc(l.n)}</b><small>${money(l.total)} د.إ · ${instTxt(k, first, l.total)}${l.status === 'res' ? ' · محجوزة' : ''}</small></span><em>نسخ بياناتها</em></button>`;
      }).join('')}</div>` : ''}
      <div class="pe-cpbar"><button class="btn ghost sm" data-pecopyask>${I.copy || '⧉'} نسخ من قطعة أخرى</button>${rec.length ? `<span class="pe-rec">آخر القطع: ${rec.map((x) => `<button class="linkbtn" data-pecopy="${esc(x.split(':')[1])}">${esc(x.split(':')[1])}</button>`).join(' · ')}</span>` : ''}</div>`;
  };
  const copyFrom = async (n, btn) => {
    const slug = $('#peProj').value; n = String(n || '').trim(); if (!n || !cur) return;
    if (n === String(cur.n)) { H.toast('هذه نفس القطعة'); return; }
    if (btn) btn.disabled = true;
    try {
      const j = await api('adm_plot_get', { project: slug, n }); const src = j.plot;
      if (!src.listed && !src.total && !(src.inst || []).length) { H.toast(`القطعة ${n} ليس لها بيانات لنسخها`); return; }
      const myFt = (cur.ft || cur.planFt) || 0, srcFt = (src.ft || src.planFt) || 0, same = !myFt || !srcFt || Math.abs(myFt - srcFt) <= myFt * 0.01;
      let total = src.total || 0; const ppf = src.ppf || (total && srcFt ? Math.round(total / srcFt) : 0);
      if (!same && ppf && myFt) total = Math.round(ppf * myFt / 1000) * 1000;   // another size: the same price per sq ft
      const scale = same || !src.total ? 1 : total / src.total;
      inst = (src.inst || []).map((x) => [x[0], Math.round((+x[1] || 0) * scale / 100) * 100]);
      stt = src.listed && src.s !== 'sold' ? src.s : 'av';
      cur = Object.assign({}, cur, { total, ppf, fe: !!src.fe });
      form();
      H.toast(same ? `تم نسخ بيانات القطعة ${n} ✓ راجعها ثم احفظ` : `تم النسخ بنفس سعر القدم (المساحة مختلفة) ✓ راجعها ثم احفظ`);
      const f = $('#peForm'); if (f) f.classList.add('pe-flash'), setTimeout(() => f.classList.remove('pe-flash'), 1200);
    } catch (ex) { H.toast(ex.message); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  };
  const SL = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة', '': 'غير معروضة' };
  const brief = (x) => (x ? `<i class="ph-s ${x.s || 'off'}">${SL[x.s] || x.s}</i>${x.s && x.s !== 'sold' && x.total ? ` ${money(x.total)} د.إ` : ''}${x.inst ? ` · ${x.inst} قسط` : ''}` : '—');
  /** «سجل التغييرات»: this plot's changes (or the latest everywhere) — who, when, before → after, and «تراجع» */
  const history = async (id) => {
    const box = $('#peHist'); box.innerHTML = '';
    try {
      const j = await api('adm_plot_history', id ? { id } : {});
      if (!j.items.length) { box.innerHTML = id ? '<div class="ccard ph-box"><h3>سجل التغييرات</h3><p class="muted">لا توجد تعديلات مسجّلة على هذه القطعة بعد.</p></div>' : ''; return; }
      box.innerHTML = `<div class="ccard ph-box"><h3>${id ? 'سجل التغييرات' : 'آخر التعديلات على القطع'}</h3>${j.items.map((x) => `<div class="ph-row${x.undone ? ' undone' : ''}">
          <div class="ph-top">${id ? '' : `<b class="notr">${esc(x.name)}</b>`}<small>${new Date(x.k).toLocaleString('ar-AE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${esc(x.by)}</small></div>
          <div class="ph-ch">${x.b ? `<span>${brief(x.b)}</span><em>←</em>` : ''}<span>${brief(x.a)}</span></div>
          ${x.undo ? `<button class="btn ghost sm" data-peundo="${x.k}" data-peid="${esc(x.id)}">↶ تراجع</button>` : x.undone ? '<small class="ph-u">تم التراجع عنه</small>' : ''}</div>`).join('')}</div>`;
    } catch { /* no permission: nothing */ }
  };
  const load = async () => {
    const n = $('#peN').value.trim(); if (!n) { H.toast('اكتب رقم القطعة'); return; }
    $('#peInfo').innerHTML = '<i class="spin"></i> جارِ التحميل…';
    try {
      const j = await api('adm_plot_get', { project: $('#peProj').value, n });
      cur = j.plot; inst = (cur.inst || []).map((x) => [x[0], +x[1] || 0]); stt = cur.listed ? cur.s : 'av';
      const p = projects.find((x) => x.slug === $('#peProj').value), l = H.findLand($('#peProj').value + ':' + n);
      $('#peInfo').innerHTML = `<b>قطعة ${esc(cur.n)}</b> · ${esc(p ? p.name : '')}${l && l.use ? ' · ' + esc(l.use) : ''}${cur.planFt ? ` · ${money(cur.planFt)} قدم² في المخطط` : ''}<br>${cur.listed ? `معروضة حالياً: <b>${{ av: 'متاحة', res: 'محجوزة', sold: 'مباعة' }[cur.s] || cur.s}</b>` : '<b class="newp">غير معروضة — ستُضاف للمخطط عند الحفظ</b>'}`;
      form(); history($('#peProj').value + ':' + cur.n);
    } catch (e) { $('#peInfo').innerHTML = `<span class="bad">${esc(e.message)}</span>`; $('#peForm').hidden = true; }
  };
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    if (d.peundo) {
      if (!(await uiConfirm('ترجع القطعة كما كانت قبل هذا التعديل (الحالة والسعر والدفعات).', { title: 'التراجع عن التعديل؟', ok: 'تراجع' }))) return;
      t.disabled = true;
      try { await api('adm_plot_undo', { k: d.peundo, id: d.peid }); H.toast('تم التراجع ✓'); H.refreshData(); const [sl, nn] = d.peid.split(':'); if (cur && $('#peProj').value === sl && String(cur.n) === nn) load(); else history(cur ? $('#peProj').value + ':' + cur.n : ''); }
      catch (ex) { H.toast(ex.message); t.disabled = false; }
      return;
    }
    if (d.peload !== undefined) { load(); return; }
    if (d.pecopy) { copyFrom(d.pecopy, t); return; }
    if (d.pecopyask !== undefined) { const n = await uiPrompt('اكتب رقم القطعة في نفس المشروع لتُنسخ بياناتها (السعر، الدفعات، الحالة) إلى هذه القطعة.', '', { title: 'نسخ من قطعة أخرى', placeholder: 'مثال: 14500', inputmode: 'numeric', ok: 'نسخ', icon: 'edit' }); if (n) copyFrom(n); return; }
    if (d.pst !== undefined) { stt = d.pst; el.querySelectorAll('[data-pst]').forEach((b) => b.classList.toggle('on', b === t)); return; }
    if (d.iadd !== undefined) { const last = inst.length ? inst[inst.length - 1][0] : ''; inst.push([last ? addMonths(last, 3) : addMonths(ymd(new Date()), 1), 0]); drawInst(); return; }
    if (d.idel !== undefined) { inst.splice(+d.idel, 1); drawInst(); return; }
    if (d.pegen !== undefined) {
      const T = total(); if (!T) { H.toast('اكتب سعر الأرض أولاً'); return; }
      const k = Math.max(1, Math.min(120, Math.round(n0($('#gN').value)))), ev = +$('#gEvery').value || 1, start = $('#gStart').value || addMonths(ymd(new Date()), 1);
      const first = Math.round(T * Math.min(100, n0($('#gFirst').value)) / 100), rest = T - first, each = Math.floor(rest / k / 100) * 100;
      inst = [...Array(k)].map((_, i) => [addMonths(start, i * ev), i === k - 1 ? rest - each * (k - 1) : each]);
      el.querySelector('.pe-gen').open = false; drawInst(); return;
    }
    if (d.pesave !== undefined) {
      if (!cur) return;
      const body = { project: $('#peProj').value, n: cur.n, s: stt, total: total(), ppf: n0($('#pePpf').value), ft: n0($('#peFt').value), fe: $('#peFe').checked ? 1 : 0, lo: $('#peLo').value.trim(), inst: inst.filter((x) => x[0] && n0(x[1]) > 0).map((x) => [x[0], n0(x[1])]), quiet: quiet ? 1 : 0 };
      if (stt && stt !== 'sold' && !body.total && !body.ppf && !(await uiConfirm('ستظهر القطعة بعبارة «السعر عند الاستفسار».', { title: 'لم تكتب سعراً', ok: 'حفظ بدون سعر' }))) return;
      if (!stt && !(await uiConfirm('ستختفي من الموقع والتطبيق حتى تعرضها مرة أخرى.', { danger: true, title: 'إزالة القطعة من العرض؟', ok: 'إزالة من العرض' }))) return;
      t.disabled = true; const old = t.innerHTML; t.innerHTML = '<i class="spin"></i> جارِ الحفظ…';
      try { const j = await api('adm_plot_save', body); cur = j.plot; remember(body.project, body.n); H.toast(quiet ? 'تم الحفظ بدون إشعار ✓' : 'تم حفظ القطعة على المخطط ✓'); H.refreshData(); load(); }
      catch (ex) { H.toast(ex.message); }
      finally { t.disabled = false; t.innerHTML = old; }
    }
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.id !== undefined) { inst[+t.dataset.id][0] = t.value; return; }
    if (t.dataset.ia !== undefined) { inst[+t.dataset.ia][1] = n0(t.value); drawSum(); return; }
    if (t.id === 'peTotal') { const a = area(); if (a && total()) $('#pePpf').value = Math.round(total() / a); drawSum(); }
    if (t.id === 'pePpf') { const a = area(); if (a && n0(t.value)) $('#peTotal').value = money(Math.round(n0(t.value) * a)); drawSum(); }
    if (t.id === 'peFt') { const a = area(); if (a && n0($('#pePpf').value)) { $('#peTotal').value = money(Math.round(n0($('#pePpf').value) * a)); drawSum(); } }
  });
  el.addEventListener('keydown', (e) => { if (e.target.id === 'peN' && e.key === 'Enter') load(); });
  if (n0s) load(); else history('');
}
