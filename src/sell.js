// «لدي أرض للبيع»: a short form anyone may send (signed in or not). It reaches the office's contact log with a push.
import { api, session, resizePhoto } from './owner.js';

let H = null;
export function initSellMod(h) { H = h; }
const CITIES = ['الشارقة', 'عجمان', 'دبي', 'أبوظبي', 'رأس الخيمة', 'أم القيوين', 'الفجيرة'];
const KINDS = ['أرض', 'فيلا', 'بناية', 'محل / معرض', 'مستودع'];
const USES = ['سكني', 'تجاري', 'سكني تجاري', 'استثماري', 'صناعي', 'زراعي'];
const opt = (list, cur) => list.map((x) => `<option${x === cur ? ' selected' : ''}>${x}</option>`).join('');

export function sellPage() {
  const u = session.user() || {}, esc = H.esc;
  return `<div class="pad sellpg">
    <div class="sellcard">
      <h2>لدي أرض للبيع</h2><p class="muted">عبّئ بيانات الأرض وسنتواصل معك</p>
      <form id="sellF" novalidate>
        <div class="sgrid">
          <label><span>الاسم <i>*</i></span><input name="name" placeholder="الاسم الكامل" autocomplete="name" value="${esc(u.name || '')}"></label>
          <label><span>رقم الهاتف <i>*</i></span><input name="phone" type="tel" dir="ltr" inputmode="tel" placeholder="05X XXX XXXX" autocomplete="tel" value="${esc(u.phone || '')}"></label>
          <label><span>المنطقة <i>*</i></span><input name="region" placeholder="اسم المنطقة"></label>
          <label><span>المدينة</span><select name="city">${opt(CITIES, 'الشارقة')}</select></label>
          <label><span>نوع العقار</span><select name="ptype">${opt(KINDS, 'أرض')}</select></label>
          <label><span>الاستخدام</span><select name="use">${opt(USES, 'سكني')}</select></label>
          <label><span>المساحة (قدم²)</span><input name="ft" inputmode="numeric" dir="ltr" placeholder="5,000"></label>
          <label><span>السعر المطلوب (درهم) <i>*</i></span><input name="price" inputmode="numeric" dir="ltr" placeholder="1,000,000"></label>
        </div>
        <label><span>تفاصيل إضافية</span><textarea name="msg" rows="3" placeholder="الترخيص، التملك، ملاحظات أخرى..."></textarea></label>
        <div class="sphotos"><span>صور (اختياري)</span><button type="button" class="sadd" id="sellAdd">🖼️ إضافة صور</button><input type="file" id="sellFile" accept="image/*" multiple hidden></div>
        <div class="sthumbs" id="sellThumbs"></div>
        <p class="ferr" id="sellErr" hidden></p>
        <button class="btn sellgo block" type="submit" id="sellGo">إرسال ➤</button>
      </form>
      <div class="selldone" id="sellDone" hidden><div class="ok">✓</div><h3>تم استلام بيانات أرضك</h3><p class="muted">سيتواصل معك فريق عمر الياسي للعقارات قريباً.</p><button class="btn ghost block" id="sellAgain">إرسال أرض أخرى</button></div>
    </div>
    ${session.token() ? '<button class="btn ghost block sellfull" data-addfull>أو اعرضها بنفسك كإعلان في التطبيق ←</button>' : ''}
  </div>`;
}
export function initSell(pg) {
  const f = pg.querySelector('#sellF'), err = pg.querySelector('#sellErr'), go = pg.querySelector('#sellGo'), file = pg.querySelector('#sellFile'), th = pg.querySelector('#sellThumbs');
  const photos = [];
  const draw = () => { th.innerHTML = photos.map((p, i) => `<div class="pth"><img src="${p}" alt=""><button type="button" data-rm="${i}" aria-label="حذف">✕</button></div>`).join(''); pg.querySelector('#sellAdd').hidden = photos.length >= 4; };
  pg.querySelector('#sellAdd').onclick = () => file.click();
  file.onchange = async () => { for (const x of [...file.files].slice(0, 4 - photos.length)) { try { photos.push(await resizePhoto(x, 1280, 0.8)); } catch { H.toast('تعذّر قراءة إحدى الصور'); } } file.value = ''; draw(); };
  th.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { photos.splice(+b.dataset.rm, 1); draw(); } };
  const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  ['ft', 'price'].forEach((k) => { f[k].oninput = () => { const d = digits(f[k].value); f[k].value = d ? (+d).toLocaleString('en-US') : ''; }; });
  f.onsubmit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const v = { name: f.name.value.trim(), phone: f.phone.value.trim(), region: f.region.value.trim(), city: f.city.value, ptype: f.ptype.value, use: f.use.value, ft: digits(f.ft.value), price: digits(f.price.value), msg: f.msg.value.trim() };
    const bad = !v.name ? 'اكتب الاسم' : digits(v.phone).length < 9 ? 'اكتب رقم هاتف صحيح' : !v.region ? 'اكتب المنطقة' : !(+v.price >= 1000) ? 'اكتب السعر المطلوب' : '';
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    go.disabled = true; go.textContent = 'جارِ الإرسال…';
    try { await api('sell_req', { ...v, photos }); f.hidden = true; pg.querySelector('#sellDone').hidden = false; pg.scrollTop = 0; }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
    go.disabled = false; go.textContent = 'إرسال ➤';
  };
  pg.querySelector('#sellAgain').onclick = () => { f.reset(); photos.length = 0; draw(); f.hidden = false; pg.querySelector('#sellDone').hidden = true; };
}
