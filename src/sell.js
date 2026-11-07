// «لدي أرض للبيع»: a short form anyone may send (signed in or not). It reaches the office's contact log with a push.
import { api, session, resizePhoto } from './owner.js';
import { phoneField } from './phone.js';

let H = null;
export function initSellMod(h) { H = h; }
const CITIES = ['الشارقة', 'عجمان', 'دبي', 'أبوظبي', 'رأس الخيمة', 'أم القيوين', 'الفجيرة'];
const KINDS = ['أرض', 'فيلا', 'بناية', 'محل / معرض', 'مستودع'];
const USES = ['سكني', 'تجاري', 'سكني تجاري', 'استثماري', 'صناعي', 'زراعي'];
const opt = (list, cur) => list.map((x) => `<option${x === cur ? ' selected' : ''}>${x}</option>`).join('');

const chips = (name, list, cur) => `<div class="schips">${list.map((x) => `<label class="schip"><input type="radio" name="${name}" value="${x}"${x === cur ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div>`;
const IC = {
  user: '<svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M9 4 7.5 6H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3.5L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M21.4 3.6 2.9 10.4c-.8.3-.8 1.4 0 1.7l6.7 2.4 2.4 6.7c.3.8 1.4.8 1.7 0l6.8-18.5c.2-.7-.4-1.3-1.1-1.1zM10.3 13l6.2-6.2-4.6 7.8z" transform="scale(-1,1) translate(-24,0)"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>',
};
const SEND_LABEL = `<span>إرسال الطلب</span>${IC.send}`;

export function sellPage() {
  const u = session.user() || {}, esc = H.esc;
  return `<div class="pad sellpg">
    <div class="sellhero"><div class="shic">${IC.home}</div><div><h2>بيع أرضك معنا</h2><p>عبّئ البيانات وفريقنا يتواصل معك خلال يوم عمل</p></div></div>
    <ol class="ssteps"><li class="on"><b>1</b>بيانات الأرض</li><li><b>2</b>نراجعها</li><li><b>3</b>نتواصل معك</li></ol>
    <div class="sellcard">
      <form id="sellF" novalidate>
        <div class="ssec"><h3>${IC.user}بياناتك</h3>
          <div class="sgrid">
            <label class="full"><span>الاسم <i>*</i></span><input name="name" placeholder="الاسم الكامل" autocomplete="name" value="${esc(u.name || '')}"></label>
            <label class="full"><span>رقم الهاتف <i>*</i></span>${phoneField('phone', u.phone || '')}</label>
          </div>
        </div>
        <div class="ssec"><h3>${IC.home}بيانات العقار</h3>
          <label><span>نوع العقار</span>${chips('ptype', KINDS, 'أرض')}</label>
          <label><span>الاستخدام</span>${chips('use', USES, 'سكني')}</label>
          <div class="sgrid">
            <label><span>المدينة</span><select name="city">${opt(CITIES, 'الشارقة')}</select></label>
            <label><span>المنطقة <i>*</i></span><input name="region" placeholder="مثال: الرحمانية"></label>
            <label><span>المساحة</span><div class="sunit"><input name="ft" inputmode="numeric" dir="ltr" placeholder="5,000"><em>قدم²</em></div></label>
            <label><span>السعر المطلوب <i>*</i></span><div class="sunit"><input name="price" inputmode="numeric" dir="ltr" placeholder="1,000,000"><em>درهم</em></div></label>
          </div>
          <label><span>تفاصيل إضافية</span><textarea name="msg" rows="3" placeholder="رقم القطعة، التملك، الترخيص، أي ملاحظات..."></textarea></label>
        </div>
        <div class="ssec"><h3>${IC.cam}صور العقار <small>اختياري · حتى 4 صور</small></h3>
          <div class="sthumbs" id="sellThumbs"></div>
          <button type="button" class="sadd" id="sellAdd">${IC.cam}<span>اضغط لإضافة صور</span></button><input type="file" id="sellFile" accept="image/*" multiple hidden>
        </div>
        <p class="ferr" id="sellErr" hidden></p>
        <button class="sellgo" type="submit" id="sellGo">${SEND_LABEL}</button>
        <p class="snote">${IC.lock}بياناتك تصل لمكتب عمر الياسي للعقارات فقط ولا تُشارك مع أي جهة</p>
      </form>
      <div class="selldone" id="sellDone" hidden><div class="ok">✓</div><h3>تم استلام بيانات أرضك</h3><p class="muted">سيتواصل معك فريق عمر الياسي للعقارات قريباً.</p><button class="btn ghost block" id="sellAgain">إرسال أرض أخرى</button></div>
    </div>
    ${session.token() ? '<button class="sellfull" data-addfull>أو اعرضها بنفسك كإعلان في التطبيق <span>←</span></button>' : ''}
  </div>`;
}
export function initSell(pg) {
  const f = pg.querySelector('#sellF'), err = pg.querySelector('#sellErr'), go = pg.querySelector('#sellGo'), file = pg.querySelector('#sellFile'), th = pg.querySelector('#sellThumbs');
  const photos = [];
  const draw = () => { th.innerHTML = photos.map((p, i) => `<div class="pth"><img src="${p}" alt=""><button type="button" data-rm="${i}" aria-label="حذف">✕</button></div>`).join(''); pg.querySelector('#sellAdd').hidden = photos.length >= 4; pg.querySelector('#sellAdd span').textContent = photos.length ? `إضافة صور (${photos.length}/4)` : 'اضغط لإضافة صور'; };
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
    try { await api('sell_req', { ...v, photos }); f.hidden = true; pg.querySelector('#sellDone').hidden = false; pg.querySelectorAll('.ssteps li').forEach((li) => li.classList.add('on')); pg.scrollTop = 0; }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
    go.disabled = false; go.innerHTML = SEND_LABEL;
  };
  pg.querySelector('#sellAgain').onclick = () => { f.reset(); photos.length = 0; draw(); f.hidden = false; pg.querySelector('#sellDone').hidden = true; pg.querySelectorAll('.ssteps li').forEach((li, i) => li.classList.toggle('on', !i)); };
}
