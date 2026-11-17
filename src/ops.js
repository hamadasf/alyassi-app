// Office tools: «سجل العمليات» (the admin), «طلبات الموافقة» (the admin), «أراضٍ تحتاج تسويقاً» (designers / marketing),
// the chat's ready replies, monthly targets helpers. All wording in Modern Standard Arabic.
import { api, session, can } from './owner.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null;
export function initOps(h) { H = h; }
const when = (ms) => new Date(ms).toLocaleString('ar-AE', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' });
const loadingHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';

/* ---------------- «سجل العمليات» ---------------- */
export function auditPage() { return `<div class="pad ops"><div class="seg ops-k" data-akinds></div><div class="ops-list">${loadingHTML}</div></div>`; }
export async function initAudit(pg) {
  const { esc } = H; const list = pg.querySelector('.ops-list'), seg = pg.querySelector('[data-akinds]'); let kind = '';
  const GROUPS = [['', 'الكل'], ['price', 'الأسعار'], ['status', 'الحالات'], ['verify', 'التوثيق'], ['staff', 'الصلاحيات'], ['approval', 'الموافقات'], ['hold', 'الحجوزات']];
  seg.innerHTML = GROUPS.map(([k, l]) => `<button data-ak="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('');
  const match = { verify: ['verify', 'unverify'], approval: ['approval', 'approved', 'rejected'], staff: ['staff', 'ban', 'unban', 'points', 'settings', 'chat'] };
  const load = async () => {
    list.innerHTML = loadingHTML;
    try {
      const j = await api('adm_audit', {}); const ks = kind ? (match[kind] || [kind]) : null;
      const items = j.items.filter((e) => !ks || ks.includes(e.k));
      list.innerHTML = items.length ? items.map((e) => `<div class="op-row k-${esc(e.k)}"${e.r && e.r.includes(':') && !e.r.startsWith('user:') ? ` data-land="${esc(e.r)}"` : e.r && e.r.startsWith('user:') ? ` data-auser="${esc(e.r.slice(5))}"` : ''}>
          <div><b>${esc(j.kinds[e.k] || e.k)}</b><span class="notr">${esc(e.x)}</span></div><small><span class="notr">${esc(e.by)}</span><br>${when(e.t)}</small></div>`).join('')
        : '<p class="muted">لا توجد عمليات مسجلة بعد.</p>';
    } catch (e) { list.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
  };
  seg.onclick = (e) => { const b = e.target.closest('[data-ak]'); if (!b) return; kind = b.dataset.ak; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); load(); };
  load();
}

/* ---------------- «طلبات الموافقة» ---------------- */
export function approvalsPage() { return `<div class="pad ops"><div class="ccard ops-pct"></div><div class="ops-list">${loadingHTML}</div></div>`; }
export async function initApprovals(pg) {
  const { esc, money } = H; const list = pg.querySelector('.ops-list'), top = pg.querySelector('.ops-pct');
  const draw = (j) => {
    top.innerHTML = `<b>متى يحتاج التعديل موافقتك؟</b><p class="muted">عند تحويل أي قطعة إلى «مباعة»، أو عند تخفيض السعر بأكثر من <b>${j.pct}%</b> من قِبل أحد أعضاء الفريق. تبقى القطعة كما هي حتى توافق.</p><button class="btn ghost sm" data-pct>تغيير النسبة</button>`;
    list.innerHTML = j.items.length ? j.items.map((x) => `<div class="ccard op-apr">
        <div class="op-h"><b>قطعة ${esc(x.n)} · ${esc(x.proj)}</b><small>${when(x.t)}</small></div>
        <p>${esc(x.why)}</p><p class="muted">طلب: <span class="notr">${esc(x.by)}</span>${x.in && x.in.total ? ` · السعر الجديد ${money(+x.in.total)} د.إ` : ''}</p>
        <div class="hold-b"><button class="btn primary sm" data-aok="${esc(x.id)}">موافقة</button><button class="btn ghost sm" data-ano="${esc(x.id)}">رفض</button><button class="btn ghost sm" data-land="${esc(x.id)}">عرض القطعة</button></div></div>`).join('')
      : '<div class="cempty"><p>لا توجد طلبات بانتظار موافقتك</p></div>';
  };
  const load = async (body = {}) => { try { draw(await api('adm_approvals', body)); } catch (e) { list.innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  pg.querySelector('.ops').onclick = async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.pct !== undefined) { const v = await uiPrompt('النسبة المئوية للتخفيض التي تحتاج موافقتك (من 1 إلى 90)', '', { title: 'حد التخفيض', inputmode: 'numeric' }); if (v && +v > 0) load({ pct: +v }); return; }
    const id = t.dataset.aok || t.dataset.ano; if (!id) return;
    const ok = !!t.dataset.aok;
    if (!(await uiConfirm(ok ? 'الموافقة على التعديل وتطبيقه على القطعة؟' : 'رفض التعديل؟ تبقى القطعة كما هي.', { ok: ok ? 'موافقة' : 'رفض', danger: !ok }))) return;
    try { await api('adm_approval_do', { id, ok: ok ? '1' : '0' }); H.toast(ok ? 'تمت الموافقة وطُبّق التعديل ✓' : 'تم رفض التعديل'); H.refreshData && H.refreshData(); load(); } catch (ex) { H.toast(ex.message); }
  };
  load();
}

/* ---------------- «أراضٍ تحتاج تسويقاً» ---------------- */
export function needMktPage() { return `<div class="pad ops"><p class="muted ops-hint">الأراضي المتاحة التي لم يصمّم لها أحد من الفريق منشوراً ولم يشاركها منذ 7 أيام — الأقدم أولاً.</p><div class="ops-list">${loadingHTML}</div></div>`; }
export async function initNeedMkt(pg) {
  const { esc, money } = H; const list = pg.querySelector('.ops-list');
  try {
    const j = await api('need_mkt', {}); const last = j.last || {}, cut = Date.now() - (j.days || 7) * 864e5;
    const items = H.DATA().lands.filter((l) => l.status === 'av' && !(last[l.id] > cut)).sort((a, b) => (last[a.id] || 0) - (last[b.id] || 0));
    list.innerHTML = items.length ? `<p class="ops-n"><b>${items.length}</b> أرض</p>` + items.slice(0, 150).map((l) => `<div class="ccard op-mk">
        <div><b>قطعة ${esc(l.n)} · ${esc(l.projectName)}</b><span>${l.ft ? money(l.ft) + ' قدم²' : ''}${l.total ? ' · ' + money(l.total) + ' د.إ' : ''}</span>
        <small>${last[l.id] ? 'آخر تسويق: ' + new Date(last[l.id]).toLocaleDateString('ar-AE') : 'لم تُسوَّق من التطبيق بعد'}</small></div>
        <div class="hold-b">${can('design') && (l.poly || l.pc) ? `<button class="btn primary sm" data-adgen="${esc(l.id)}">صمّم منشوراً</button>` : ''}<button class="btn ghost sm" data-land="${esc(l.id)}">التفاصيل</button></div></div>`).join('')
      : '<div class="cempty"><p>ممتاز — كل الأراضي المتاحة سُوِّقت خلال الأسبوع</p></div>';
  } catch (e) { list.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
}

/* ---------------- ready replies in the office chat ---------------- */
let quick = null;
async function quickList() { if (!quick) { const j = await api('quick_replies', {}); quick = j; } return quick; }
/** opens the list; pick → the text goes into the message box. The admin can edit the list and the working hours here. */
export async function openQuick(input) {
  const { esc } = H; const me = session.user() || {};
  let j; try { j = await quickList(); } catch (e) { H.toast(e.message); return; }
  const wrap = document.createElement('div'); wrap.className = 'qsheet';
  const draw = () => {
    wrap.innerHTML = `<div class="qbox"><div class="qh"><b>ردود جاهزة</b><button data-qx aria-label="إغلاق">✕</button></div>
      <div class="qlist">${j.items.map((t, i) => `<button class="qitem" data-qi="${i}">${esc(t)}</button>`).join('')}</div>
      ${me.admin ? `<div class="qadm"><button class="btn ghost sm" data-qedit>تعديل الردود</button><button class="btn ghost sm" data-qhours>الرد التلقائي خارج الدوام</button></div>` : ''}</div>`;
  };
  draw(); document.body.appendChild(wrap);
  wrap.onclick = async (e) => {
    if (e.target === wrap || e.target.closest('[data-qx]')) { wrap.remove(); return; }
    const it = e.target.closest('[data-qi]');
    if (it) { input.value = (input.value ? input.value + ' ' : '') + j.items[+it.dataset.qi]; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); wrap.remove(); return; }
    if (e.target.closest('[data-qedit]')) {
      const v = await uiPrompt('رد واحد في كل سطر', j.items.join('\n'), { title: 'الردود الجاهزة', multiline: true }); if (v === null) return;
      try { j = await api('adm_quick_save', { items: v.split('\n').map((x) => x.trim()).filter(Boolean) }); quick = j; draw(); H.toast('تم حفظ الردود ✓'); } catch (ex) { H.toast(ex.message); }
      return;
    }
    if (e.target.closest('[data-qhours]')) {
      const h = j.hours;
      const t = await uiPrompt(`يُرسل تلقائياً مرة واحدة عند وصول رسالة من عميل خارج الدوام (من ${h.from}:00 إلى ${h.to}:00). اترك النص فارغاً لإيقافه.`, h.on ? h.text : '', { title: 'الرد التلقائي خارج الدوام', multiline: true }); if (t === null) return;
      const hr = await uiPrompt('ساعات الدوام بالشكل «من-إلى» بنظام 24 ساعة', `${h.from}-${h.to}`, { title: 'ساعات الدوام' }); if (hr === null) return;
      const m = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(hr) || [0, h.from, h.to];
      try { j = await api('adm_quick_save', { hours: { from: +m[1], to: +m[2], on: t.trim() ? 1 : 0, text: t.trim() || h.text } }); quick = j; H.toast(t.trim() ? 'تم حفظ الرد التلقائي ✓' : 'تم إيقاف الرد التلقائي'); } catch (ex) { H.toast(ex.message); }
    }
  };
}
