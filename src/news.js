// «شريط الأخبار»: real-estate news scrolling right → left at the top of the app, the company emblem between items.
// The office adds and removes news from the app (الأخبار العقارية page) — stored on the website.
import { api, session } from './owner.js';

let H = null, items = [];
const LS = 'oay:news';
// shown until the website answers (and if it has not been updated yet)
const START = [{ id: 1, t: Date.UTC(2026, 9, 29, 7), text: 'افتتاح الفرع الجديد لدائرة التسجيل العقاري بالشارقة "فرع مويلح"، لنكون أقرب إليكم ونقدم خدماتنا بكفاءة وسهولة', link: '' }];
try { items = JSON.parse(localStorage.getItem(LS) || 'null') || START; } catch { items = START; }
let speed = 50;   // pixels per second — set by the office
try { speed = +localStorage.getItem(LS + ':speed') || 50; } catch { /* ignore */ }
export function initNews(h) { H = h; }
const keep = (j) => {
  items = j.items || []; if (j.speed) speed = j.speed;
  try { localStorage.setItem(LS, JSON.stringify(items)); localStorage.setItem(LS + ':speed', String(speed)); } catch { /* ignore */ }
};
function setDuration(track) { const w = parseFloat(track.style.getPropertyValue('--tk-w')) || 0; if (w) track.style.animationDuration = Math.max(4, w / speed) + 's'; }

const SEP = '<img class="tk-sep" src="icons/icon-192.png" alt="">';
export async function loadNews() {
  try { keep(await api('news')); } catch { /* keep cached */ }
  renderTicker();
  return items;
}
export function renderTicker() {
  const el = document.getElementById('ticker'); if (!el) return;
  const home = document.getElementById('home');
  if (!items.length) { el.hidden = true; home.classList.remove('has-tk'); return; }
  el.hidden = false; home.classList.add('has-tk');
  const set = items.map((n) => `<button class="tk-item notr" data-news>${H.esc(n.text)}</button>${SEP}`).join('');
  el.innerHTML = `<div class="tk-lbl" data-news><span class="tk-live"></span>أخبار عقارية</div><div class="tk-view"><div class="tk-track"><div class="tk-set">${set}</div></div></div>`;
  requestAnimationFrame(() => {
    const view = el.querySelector('.tk-view'), track = el.querySelector('.tk-track'), one = track.firstElementChild;
    // repeat the set until it is wider than the bar, then twice over so the loop is seamless
    let copies = 1; while (one.scrollWidth * copies < view.clientWidth + 40 && copies < 12) copies++;
    const html = one.innerHTML.repeat(copies); one.innerHTML = html;
    track.innerHTML = `<div class="tk-set">${html}</div><div class="tk-set" aria-hidden="true">${html}</div>`;
    const w = track.firstElementChild.scrollWidth;
    track.style.setProperty('--tk-w', w + 'px');
    setDuration(track);
    track.classList.add('run');
  });
}

/* ---------- the news page (all items; the office adds / removes them here) ---------- */
export function newsPage() {
  const admin = !!(session.user() || {}).admin;
  return `<div class="pad newspg">${admin ? `<form class="ncard nform" id="nform"><h4>إضافة خبر جديد</h4>
      <textarea id="ntext" rows="3" maxlength="400" placeholder="نص الخبر…"></textarea>
      <input id="nlink" type="url" dir="ltr" placeholder="رابط (اختياري) https://">
      <button class="btn primary block">نشر الخبر في الشريط</button></form>
    <div class="ncard nspeed"><h4>سرعة الشريط</h4>
      <div class="nsrow"><span>🐢 بطيء</span><input type="range" id="nspd" min="15" max="150" step="5" value="${speed}"><span>سريع 🐇</span></div>
      <p class="muted" id="nspv"></p><button class="btn ghost block" id="nspsave">حفظ السرعة</button></div>` : ''}
    <div id="nlist"></div></div>`;
}
export function initNewsPage(pg) {
  const admin = !!(session.user() || {}).admin, box = pg.querySelector('#nlist');
  const date = (t) => new Date(t).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-AE', { day: 'numeric', month: 'long', year: 'numeric' });
  const draw = () => {
    box.innerHTML = items.length ? items.map((n, i) => `<article class="ncard nitem"><div class="nhead"><img src="icons/icon-192.png" alt=""><div><b>عمر الياسي للعقارات</b><time>${date(n.t)}</time></div></div>
        <p class="notr">${H.esc(n.text)}</p>${n.link ? `<a class="btn ghost" href="${H.esc(n.link)}" data-ext>التفاصيل</a>` : ''}
        ${admin ? `<div class="nadm"><button data-nedit="${n.id}">تعديل</button><button data-nup="${n.id}" ${i ? '' : 'disabled'}>▲</button><button data-ndown="${n.id}" ${i < items.length - 1 ? '' : 'disabled'}>▼</button><button class="del" data-ndel="${n.id}">حذف</button></div>` : ''}</article>`).join('')
      : `<div class="cempty">${H.I.bell}<p>لا توجد أخبار حالياً</p></div>`;
  };
  const took = (j) => { keep(j); draw(); renderTicker(); };
  const spd = pg.querySelector('#nspd');
  if (spd) {
    const label = () => { pg.querySelector('#nspv').textContent = `${spd.value} — ${spd.value < 40 ? 'بطيء' : spd.value < 80 ? 'متوسط' : 'سريع'}`; };
    label();
    spd.oninput = () => { speed = +spd.value; label(); const t = document.querySelector('.tk-track'); if (t) setDuration(t); };   // live preview on the bar
    pg.querySelector('#nspsave').onclick = async () => { try { took(await api('adm_news_speed', { speed: spd.value })); H.toast('تم حفظ سرعة الشريط ✓'); } catch (ex) { H.toast(ex.message); } };
  }
  draw(); loadNews().then(draw);
  const form = pg.querySelector('#nform');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault(); const b = form.querySelector('button'); b.disabled = true;
    try { took(await api('adm_news_add', { text: pg.querySelector('#ntext').value, link: pg.querySelector('#nlink').value.trim() })); pg.querySelector('#ntext').value = ''; pg.querySelector('#nlink').value = ''; H.toast('تم نشر الخبر في الشريط ✓'); }
    catch (ex) { H.toast(ex.message); }
    b.disabled = false;
  };
  box.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t || !admin) return;
    try {
      if (t.dataset.nedit) {
        const card = t.closest('.nitem'), n = items.find((x) => String(x.id) === t.dataset.nedit); if (!n || card.querySelector('.nedit')) return;
        card.insertAdjacentHTML('beforeend', `<form class="nedit"><textarea rows="3" maxlength="400">${H.esc(n.text)}</textarea><input type="url" dir="ltr" placeholder="رابط (اختياري) https://" value="${H.esc(n.link || '')}"><div class="nadm"><button class="save">حفظ التعديل</button><button type="button" class="cancel">إلغاء</button></div></form>`);
        const f = card.querySelector('.nedit');
        f.querySelector('.cancel').onclick = (ev) => { ev.stopPropagation(); f.remove(); };
        f.onsubmit = async (ev) => { ev.preventDefault(); try { took(await api('adm_news_edit', { id: n.id, text: f.querySelector('textarea').value, link: f.querySelector('input').value.trim() })); H.toast('تم تعديل الخبر ✓'); } catch (ex) { H.toast(ex.message); } };
        f.querySelector('textarea').focus();
        return;
      }
      if (t.closest('.nedit')) return;
      if (t.dataset.ndel) { if (!confirm('حذف هذا الخبر من الشريط؟')) return; took(await api('adm_news_delete', { id: t.dataset.ndel })); }
      else if (t.dataset.nup) took(await api('adm_news_move', { id: t.dataset.nup, up: '1' }));
      else if (t.dataset.ndown) took(await api('adm_news_move', { id: t.dataset.ndown, up: '0' }));
    } catch (ex) { H.toast(ex.message); }
  });
}
