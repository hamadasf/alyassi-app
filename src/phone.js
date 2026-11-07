// Phone field with a country-code list: the UAE (+971) is picked by default, other countries are one tap away.
// The form still sends a single «phone» value (a hidden input kept in sync): +<code><number without the leading 0>.

export const CODES = [
  ['971', '🇦🇪', 'الإمارات'], ['966', '🇸🇦', 'السعودية'], ['968', '🇴🇲', 'عُمان'], ['974', '🇶🇦', 'قطر'], ['965', '🇰🇼', 'الكويت'], ['973', '🇧🇭', 'البحرين'],
  ['20', '🇪🇬', 'مصر'], ['962', '🇯🇴', 'الأردن'], ['961', '🇱🇧', 'لبنان'], ['963', '🇸🇾', 'سوريا'], ['964', '🇮🇶', 'العراق'], ['970', '🇵🇸', 'فلسطين'],
  ['967', '🇾🇪', 'اليمن'], ['249', '🇸🇩', 'السودان'], ['218', '🇱🇾', 'ليبيا'], ['216', '🇹🇳', 'تونس'], ['213', '🇩🇿', 'الجزائر'], ['212', '🇲🇦', 'المغرب'],
  ['222', '🇲🇷', 'موريتانيا'], ['252', '🇸🇴', 'الصومال'], ['253', '🇩🇯', 'جيبوتي'], ['269', '🇰🇲', 'جزر القمر'],
  ['91', '🇮🇳', 'الهند'], ['92', '🇵🇰', 'باكستان'], ['880', '🇧🇩', 'بنغلاديش'], ['63', '🇵🇭', 'الفلبين'], ['98', '🇮🇷', 'إيران'], ['90', '🇹🇷', 'تركيا'],
  ['44', '🇬🇧', 'بريطانيا'], ['1', '🇺🇸', 'أمريكا / كندا'], ['7', '🇷🇺', 'روسيا'], ['86', '🇨🇳', 'الصين'], ['49', '🇩🇪', 'ألمانيا'], ['33', '🇫🇷', 'فرنسا'],
];
const DEF = '971';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** a stored number → [code, local number] (05xxxxxxxx / 5xxxxxxxx are the UAE) */
export function splitPhone(v) {
  let d = String(v || '').trim(); const plus = /^(\+|00)/.test(d); d = d.replace(/\D/g, ''); if (/^00/.test(String(v || '').trim())) d = d.slice(2);
  if (!d) return [DEF, ''];
  if (plus || d.length > 10) {
    const hit = [...CODES].sort((a, b) => b[0].length - a[0].length).find(([c]) => d.startsWith(c));
    if (hit) return [hit[0], d.slice(hit[0].length)];
  }
  return [DEF, d];
}
function joinPhone(cc, n) {
  let d = String(n || '').replace(/\D/g, ''); if (!d) return '';
  if (d.startsWith('00')) { return '+' + d.slice(2); }          // typed a full international number
  if (d.startsWith(cc) && d.length > cc.length + 6) d = d.slice(cc.length);
  return '+' + cc + d.replace(/^0+/, '');
}

/** the field: <select> of codes + the number; `attrs` go on the visible number input */
export function phoneField(name, value = '', attrs = '') {
  const [cc, n] = splitPhone(value);
  const cur = CODES.find((x) => x[0] === cc) || CODES[0];
  return `<span class="telf" dir="ltr"><span class="telcc-w"><b>${cur[1]} +${cur[0]}</b><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
    <select class="telcc" aria-label="مفتاح الدولة">${CODES.map(([c, f, nm]) => `<option value="${c}"${c === cc ? ' selected' : ''}>${f} ${esc(nm)} (+${c})</option>`).join('')}</select></span>
    <input class="telno" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="${cc === DEF ? '5X XXX XXXX' : ''}" value="${esc(n)}" ${attrs}><input type="hidden" name="${esc(name)}" value="${esc(joinPhone(cc, n))}"></span>`;
}
// keep the hidden value in sync (any field on any page), and show the short code in the closed list
const sync = (box) => {
  const sel = box.querySelector('.telcc'), no = box.querySelector('.telno'), h = box.querySelector('input[type=hidden]');
  h.value = joinPhone(sel.value, no.value); no.placeholder = sel.value === DEF ? '5X XXX XXXX' : '';
  const cur = CODES.find((x) => x[0] === sel.value); if (cur) box.querySelector('.telcc-w b').textContent = `${cur[1]} +${cur[0]}`;
};
document.addEventListener('input', (e) => { const b = e.target.closest && e.target.closest('.telf'); if (b) sync(b); });
document.addEventListener('change', (e) => { const b = e.target.closest && e.target.closest('.telf'); if (b) sync(b); });
