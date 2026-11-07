// A two-thumb slider under a «from / to» pair of number boxes (filter sheet): drag to pick a range, or type it.
// The boxes stay the source of truth (empty = no limit), so the rest of the filter code is unchanged.
const nf = new Intl.NumberFormat('en-US');
const short = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(n % 1e6 ? 2 : 0) + ' مليون' : n >= 1e3 ? nf.format(Math.round(n / 1e3)) + ' ألف' : nf.format(n));

/** box: an empty element under the two inputs; lo/hi: the inputs; max: top of the scale; unit: shown after the numbers */
export function mountRange(box, lo, hi, max, step, unit) {
  max = Math.max(step, Math.ceil(max / step) * step);
  box.className = 'rng';
  box.innerHTML = `<div class="rng-v"><span></span><span></span></div><div class="rng-t"><i></i><input type="range" min="0" max="${max}" step="${step}" aria-label="من"><input type="range" min="0" max="${max}" step="${step}" aria-label="إلى"></div>`;
  const [a, b] = box.querySelectorAll('input'), fill = box.querySelector('i'), [va, vb] = box.querySelectorAll('.rng-v span');
  const num = (inp) => +String(inp.value || '').replace(/[^\d]/g, '') || 0;
  const paint = () => {
    const x = +a.value, y = +b.value;
    fill.style.right = (x / max) * 100 + '%'; fill.style.left = 100 - (y / max) * 100 + '%';
    va.textContent = x ? short(x) + ' ' + unit : 'من 0';
    vb.textContent = y >= max ? 'بدون حد' : short(y) + ' ' + unit;
  };
  const fromBoxes = () => { a.value = Math.min(num(lo), max); b.value = num(hi) ? Math.min(num(hi), max) : max; paint(); };
  const toBoxes = (moved) => {
    if (+a.value > +b.value) { if (moved === a) a.value = b.value; else b.value = a.value; }
    lo.value = +a.value ? a.value : ''; hi.value = +b.value < max ? b.value : ''; paint();
  };
  a.oninput = () => toBoxes(a); b.oninput = () => toBoxes(b);
  lo.oninput = hi.oninput = fromBoxes;
  fromBoxes();
  return fromBoxes;
}
