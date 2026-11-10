// Management: «استيراد من Excel» — the partners' land sheet (رقم الأرض · الشريك المسؤول · المنطقة · السعر · الحالة).
// Every plot gets its owner (seen by staff only); plots not yet on the plan are added with their status and total price;
// plots already on the plan stay exactly as they are. Buyers' names and phones in the sheet are never read.
import { api } from './owner.js';
import { readXlsx } from './xlsx.js';
import { uiConfirm, uiPrompt } from './dialog.js';

let H = null;
export function initLandImport(h) { H = h; }
const norm = (s) => String(s ?? '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[()\-–_.,]/g, ' ').replace(/^ال|\sال/g, ' ').replace(/\s+/g, ' ').trim();
// sheet area names that differ from the project names
const ALIAS = [[/قاسم/, 'الصناعية'], [/مروان/, 'طرح المروان'], [/فلاح|مويلح/, 'الفلاح'], [/رحمانيه/, 'الدبدبة شمال']];
const OWNER = (o) => (/^(ال)?شرك[هة]$/.test(String(o || '').trim()) ? 'الشركة' : String(o || '').trim());
const STATUS = (s) => (/مباع/.test(s || '') ? 'sold' : /محجوز/.test(s || '') ? 'res' : 'av');
const SL = { av: 'متاحة', res: 'محجوزة', sold: 'مباعة' };

function matchProject(area, projects) {
  const a = norm(area); if (!a) return null;
  for (const [re, name] of ALIAS) if (re.test(a)) { const p = projects.find((x) => norm(x.name).includes(norm(name))); if (p) return p; }
  const sq = (x) => norm(x).replace(/\s/g, ''), A = a.replace(/\s/g, '');
  return projects.find((p) => norm(p.name) === a) || projects.find((p) => sq(p.name) === A)
    || (() => { const m = projects.filter((p) => sq(p.name).startsWith(A) || A.startsWith(sq(p.name))); return m.length === 1 ? m[0] : null; })();
}

export function importPage() {
  return `<div class="pad limp"><div class="ccard">
    <h3>${H.I.doc || ''} استيراد ملف الأراضي (Excel)</h3>
    <p class="muted">ارفع ملف «سجل الأراضي». يُقرأ منه: رقم الأرض، الشريك المسؤول، المنطقة، المساحة، السعر، الحالة — ولا تُقرأ أسماء المشترين أو أرقامهم.</p>
    <ul class="muted limp-r"><li>كل قطعة يُحفظ لها اسم المالك (يراه الموظفون فقط).</li><li>القطع غير الموجودة في التطبيق تُضاف بحالتها وسعرها الإجمالي.</li><li>القطع الموجودة في التطبيق تبقى كما هي.</li></ul>
    <label class="btn primary block limp-f">${H.I.upload || ''} اختيار ملف Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>
    <div id="limpOut"></div></div>`;
}
export function initImportPage(pg) {
  const { esc, money } = H; const out = pg.querySelector('#limpOut'); let rows = [];
  const listHTML = (title, items, cls, open) => (items.length ? `<details class="limp-g ${cls}"${open ? ' open' : ''}><summary><b>${items.length}</b> ${title}</summary><div>${items.map((x) => `<span>${x}</span>`).join('')}</div></details>` : '');
  const show = (j, applied) => {
    const by = (r) => j.items.filter((x) => x.r === r);
    const row = (x) => rows.find((r) => r.p + ':' + r.n === x.k);
    const lab = (x) => { const r = row(x); return `${esc(r ? r.n : x.k)} · ${esc(r ? r.area : '')}${r && r.o ? ' · ' + esc(r.o) : ''}`; };
    const add = by('add'), ex = by('exists'), np = by('noplot'), nj = by('noproj'), dup = by('dup');
    const owners = new Set(rows.map((r) => r.o).filter(Boolean));
    out.innerHTML = `<div class="ccard limp-sum"><h3>${applied ? '✓ تم الاستيراد' : 'ملخص قبل الاستيراد'}</h3>
        <div class="limp-k"><div><b>${add.length}</b><span>${applied ? 'أُضيفت' : 'ستُضاف'}</span></div><div><b>${ex.length}</b><span>موجودة — تبقى كما هي</span></div><div><b>${owners.size}</b><span>مالك</span></div><div><b>${np.length + nj.length}</b><span>لم تُطابق</span></div></div>
        ${add.length ? `<p class="muted">${['av', 'res', 'sold'].map((s) => { const k = add.filter((x) => x.s === s).length; return k ? `${k} ${SL[s]}` : ''; }).filter(Boolean).join(' · ')}</p>` : ''}
        ${listHTML(applied ? 'قطعة أُضيفت' : 'قطعة ستُضاف', add.map((x) => `${lab(x)} · <i class="st ${x.s}">${SL[x.s]}</i>${x.t ? ' · ' + money(x.t) + ' د.إ' : ''}`), 'add', !applied)}
        ${listHTML('موجودة في التطبيق — أُضيف لها اسم المالك فقط', ex.map(lab), 'ex')}
        ${listHTML('رقمها غير موجود في مخطط المشروع', np.map(lab), 'bad', true)}
        ${listHTML('منطقة بدون مشروع في التطبيق', nj.map((x) => { const r = row(x) || rows.find((y) => (y.p || '?') + ':' + y.n === x.k); return r ? `${esc(r.n)} · ${esc(r.area || '—')}` : esc(x.k); }), 'bad')}
        ${listHTML('مكررة في الملف — أُخذت مرة واحدة', dup.map(lab), 'ex')}
        ${applied ? '' : `<button class="btn primary block" data-limpgo>${H.I.check || ''} تطبيق الاستيراد</button><p class="muted cnote">لا تصل إشعارات للعملاء عن هذه الإضافة الجماعية.</p>`}</div>`;
  };
  const run = async (dry) => {
    const j = await api('adm_import', { dry: dry ? 1 : 0, rows: rows.map((r) => ({ p: r.p, n: r.n, o: r.o, s: r.s, t: r.t })) });
    show(j, !dry); if (!dry) { H.toast('تم الاستيراد ✓'); H.refreshData(); H.reloadOwners(); }
  };
  pg.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    out.innerHTML = '<div class="ss-state"><i class="spin"></i><span>جارِ قراءة الملف…</span></div>';
    try {
      const sheets = await readXlsx(f);
      let sh = null, hi = -1;
      for (const s of sheets) { const i = s.rows.findIndex((r) => r.some((c) => /رقم\s*الأرض/.test(String(c ?? ''))) && r.some((c) => /الشريك/.test(String(c ?? '')))); if (i >= 0) { sh = s; hi = i; break; } }
      if (!sh) throw new Error('لم أجد ورقة فيها «رقم الأرض» و«الشريك المسؤول»');
      const head = sh.rows[hi].map((c) => String(c ?? '').trim());
      const ix = (re) => head.findIndex((h) => re.test(h));
      const cN = ix(/رقم\s*الأرض/), cO = ix(/الشريك/), cA = ix(/المنطقة/), cP = ix(/السعر/), cS = ix(/الحالة/);
      const projects = H.DATA().projects;
      rows = sh.rows.slice(hi + 1).filter((r) => r && r[cN] != null && String(r[cN]).trim() !== '').map((r) => {
        const area = String(r[cA] ?? '').trim(), p = matchProject(area, projects);
        return { n: String(r[cN]).trim().replace(/\.0$/, ''), o: OWNER(r[cO]), area, p: p ? p.slug : '', s: STATUS(r[cS]), t: +String(r[cP] ?? '').replace(/[^\d.]/g, '') || 0 };
      });
      if (!rows.length) throw new Error('الورقة فارغة');
      out.innerHTML = `<div class="ss-state"><i class="spin"></i><span>جارِ مطابقة ${rows.length} قطعة مع المخططات…</span></div>`;
      await run(true);
    } catch (ex) { out.innerHTML = `<div class="ccard"><p class="bad">${esc(ex.message || 'تعذّر قراءة الملف')}</p></div>`; }
  });
  out.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-limpgo]'); if (!b) return;
    if (!(await uiConfirm('تطبيق الاستيراد على الموقع والتطبيق؟', { ok: 'تطبيق الاستيراد' }))) return;
    b.disabled = true; b.innerHTML = '<i class="spin"></i> جارِ الاستيراد…';
    try { await run(false); } catch (ex) { H.toast(ex.message); b.disabled = false; b.textContent = 'تطبيق الاستيراد'; }
  });
}
