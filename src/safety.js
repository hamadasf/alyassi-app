// Management: «النسخ الاحتياطية» (daily backups of the app's data, restore, download), «أعطال التطبيق» (what broke on
// people's phones) and the error reporter itself.
import { api, session } from './owner.js';
import { uiConfirm } from './dialog.js';

let H = null;
export function initSafety(h) { H = h; }
const loading = '<div class="ss-state"><i class="spin"></i><span>جارِ التحميل…</span></div>';
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب');
const when = (ms) => new Date(ms).toLocaleString('ar-AE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const WHY = { auto: 'تلقائية', manual: 'يدوية', beforerestore: 'قبل الاسترجاع' };

/* ---------- the error reporter: every uncaught error, once per kind per session ---------- */
export function startErrorReports(version, platform) {
  const seen = new Set(); let n = 0;
  const send = (m, s) => {
    m = String(m || '').slice(0, 300); if (!m || /ResizeObserver|Script error\.?$|cancel/i.test(m)) return;
    const k = m.replace(/\d+/g, '#'); if (seen.has(k) || n >= 8) return; seen.add(k); n++;
    try { api('err_report', { m, s: String(s || '').slice(0, 1800), v: version, plat: platform, url: (location.hash || '').slice(0, 120) }).catch(() => {}); } catch { /* never in the way */ }
  };
  window.addEventListener('error', (e) => send(e.message, e.error && e.error.stack ? e.error.stack : `${e.filename || ''}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', (e) => { const r = e.reason; send(r && r.message ? r.message : String(r), r && r.stack); });
}

/* ---------- «النسخ الاحتياطية» ---------- */
export function backupsPage() { return `<div class="pad bkp">${loading}</div>`; }
export function initBackups(pg) {
  const { esc, I, toast } = H; const el = pg.querySelector('.bkp');
  const draw = (items) => {
    const last = items[0];
    el.innerHTML = `<div class="bk-hero"><span class="bk-ic">${I.shield}</span><div><b>${last ? 'آخر نسخة: ' + when(last.t) : 'لا توجد نسخ بعد'}</b>
        <small>نسخة تلقائية كل يوم (2:30 فجراً) · تُحفظ آخر 30 يوماً · نسخة كل جمعة تصل لبريد الإدارة</small></div></div>
      <button class="btn primary block" data-bknow>${I.plusc || ''} نسخة احتياطية الآن</button>
      <p class="muted bk-what">تشمل: حالات وأسعار ودفعات كل القطع في كل المخططات، أسماء الملاك، التصاميم المحفوظة، العروض، إعدادات التطبيق، وصلاحيات الفريق وصفاتهم.</p>
      <h3 class="msec">النسخ المحفوظة<small>${items.length}</small></h3>
      <div class="bk-list">${items.map((x) => `<div class="bk-row"><span class="bk-d"><b>${esc(x.day.split('-').reverse().join('/'))}</b><small>${esc(x.time)}</small></span>
          <span class="bk-i"><i class="bk-w ${esc(x.why)}">${WHY[x.why] || esc(x.why)}</i><small>${kb(x.size)}</small></span>
          <button class="btn ghost sm" data-bkget="${esc(x.name)}" aria-label="تنزيل">${I.download || '⬇'}</button><button class="btn ghost sm danger" data-bkrest="${esc(x.name)}">استرجاع</button></div>`).join('') || '<p class="muted">ستظهر النسخ هنا.</p>'}</div>
      <details class="ccard bk-links"><summary>روابط تفتح التطبيق مباشرة (أندرويد)</summary><p class="muted">الصق بصمة SHA-256 لمفتاح التوقيع من Google Play Console ← App integrity ← App signing key certificate، ثم احفظ.</p>
        <textarea id="bkSha" rows="3" dir="ltr" placeholder="AB:CD:…"></textarea><button class="btn ghost block" data-bksha>حفظ البصمة</button></details>`;
    api('adm_applinks').then((j) => { const t = el.querySelector('#bkSha'); if (t) t.value = (j.sha || '').split(',').filter(Boolean).join('\n'); }).catch(() => {});
  };
  const load = async () => { try { draw((await api('adm_backups')).items); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.bknow !== undefined) { b.disabled = true; try { draw((await api('adm_backup_now')).items); toast('تم إنشاء نسخة احتياطية ✓'); } catch (ex) { toast(ex.message); b.disabled = false; } return; }
    if (d.bkget) {
      try {
        const j = await api('adm_backup_get', { name: d.bkget });
        const blob = new Blob([JSON.stringify(j.data)], { type: 'application/json' });
        if (H.saveFile) await H.saveFile(blob, j.name); else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = j.name; document.body.appendChild(a); a.click(); a.remove(); }
      } catch (ex) { toast(ex.message); }
      return;
    }
    if (d.bkrest) {
      if (!(await uiConfirm('ستعود حالات وأسعار ودفعات القطع وإعدادات التطبيق كما كانت في هذه النسخة. تُحفظ نسخة من الوضع الحالي أولاً فتستطيع الرجوع إليه.', { title: 'استرجاع هذه النسخة؟', danger: true, ok: 'استرجاع' }))) return;
      const team = await uiConfirm('هل تريد أيضاً إرجاع صلاحيات الموظفين وصفاتهم كما كانت في هذه النسخة؟', { title: 'صلاحيات الفريق', ok: 'نعم، أرجعها', cancel: 'لا، اتركها كما هي' });
      b.disabled = true;
      try { const j = await api('adm_backup_restore', { name: d.bkrest, team: team ? 1 : 0 }); draw(j.items); toast(`تم الاسترجاع ✓ (${j.projects} مشروع)`); H.refreshData && H.refreshData(); }
      catch (ex) { toast(ex.message); b.disabled = false; }
      return;
    }
    if (d.bksha !== undefined) { try { await api('adm_applinks', { sha: el.querySelector('#bkSha').value }); toast('تم الحفظ ✓'); } catch (ex) { toast(ex.message); } }
  });
  load();
}

/* ---------- «أعطال التطبيق» ---------- */
export function errsPage() { return `<div class="pad errp">${loading}</div>`; }
export function initErrs(pg) {
  const { esc, I, toast } = H; const el = pg.querySelector('.errp');
  const draw = (items) => {
    el.innerHTML = items.length ? `<p class="muted">أخطاء ظهرت عند المستخدمين — مجمّعة حسب النوع. أرسل لقطة منها لمن يطوّر التطبيق.</p>
        <div class="er-list">${items.map((x) => `<details class="er-row"><summary><span class="er-n">${x.n}</span><span class="er-m"><b dir="auto">${esc(x.m)}</b>
            <small>آخر مرة ${when(x.last)} · ${Object.keys(x.p || {}).map((p) => ({ android: 'أندرويد', ios: 'آيفون', web: 'الويب' }[p] || p)).join('، ')} · إصدار ${Object.keys(x.v || {}).slice(-3).join('، ')}</small></span></summary>
            <pre dir="ltr">${esc(x.s || '')}${x.url ? '\n\n' + esc(x.url) : ''}</pre><button class="btn ghost sm" data-erdel="${esc(x.k)}">تمّ إصلاحه — احذفه</button></details>`).join('')}</div>
        <button class="btn ghost block danger" data-erall>مسح الكل</button>`
      : `<div class="stempty">${I.check || '✓'}<b>لا توجد أعطال مسجّلة — التطبيق يعمل بلا مشاكل</b></div>`;
  };
  const load = async () => { try { draw((await api('adm_errs')).items); } catch (e) { el.innerHTML = `<p class="muted">${esc(e.message)}</p>`; } };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.erdel) { try { await api('adm_errs_clear', { k: b.dataset.erdel }); load(); } catch (ex) { toast(ex.message); } }
    if (b.dataset.erall !== undefined && (await uiConfirm('مسح كل الأعطال المسجّلة؟', { danger: true, ok: 'مسح' }))) { try { await api('adm_errs_clear', {}); load(); } catch (ex) { toast(ex.message); } }
  });
  load();
}
export const isAdmin = () => !!(session.user() || {}).admin;
