// The app's own dialogs, in place of the browser's confirm() / prompt() boxes (which show «hamadasf.github.io says»).
// A bottom sheet on phones, a centred card on wide screens; navy and gold like the rest of the app; Esc / tapping
// outside cancels; Enter confirms.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
};
// a message's first sentence becomes the title when no title is given («حذف هذا الخبر؟» …)
function split(msg) {
  const m = String(msg || '').match(/^(.+?[؟?!.:])\s+(.+)$/s);
  return m && m[1].length <= 70 ? [m[1], m[2]] : [String(msg || ''), ''];
}
let open = null;
function sheet({ title, text, icon, input, ok, cancel, danger }) {
  if (open) open(null);
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'odlg';
    const kind = icon || (danger ? 'danger' : input ? 'edit' : 'ask');
    wrap.innerHTML = `<div class="odlg-card" role="dialog" aria-modal="true" aria-labelledby="odlgT">
      <span class="odlg-ic ${danger ? 'bad' : ''}">${ICON[kind] || ICON.ask}</span>
      <h3 id="odlgT">${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      ${input ? `<label class="odlg-in">${input.label ? `<span>${esc(input.label)}</span>` : ''}${input.multiline
        ? `<textarea rows="3" placeholder="${esc(input.placeholder || '')}">${esc(input.value || '')}</textarea>`
        : `<input type="${esc(input.type || 'text')}" dir="${input.type === 'email' || input.type === 'number' || input.type === 'date' || input.type === 'time' ? 'ltr' : 'auto'}" inputmode="${esc(input.inputmode || (input.type === 'email' ? 'email' : input.type === 'number' ? 'numeric' : 'text'))}" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" autocomplete="${input.type === 'email' ? 'email' : 'off'}">`}</label>` : ''}
      <div class="odlg-b"><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok || 'تأكيد')}</button><button type="button" class="btn ghost" data-no>${esc(cancel || 'إلغاء')}</button></div></div>`;
    document.body.appendChild(wrap);
    const field = wrap.querySelector('input, textarea');
    const done = (v) => {
      if (!wrap.isConnected) return; open = null; document.removeEventListener('keydown', key, true);
      wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 200); resolve(v);
    };
    const yes = () => {
      if (!input) { done(true); return; }
      const v = field.value.trim();
      if (input.required && !v) { field.focus(); field.classList.add('err'); return; }
      if (input.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) { field.focus(); field.classList.add('err'); return; }
      done(v);
    };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(input ? null : false); }
      else if (e.key === 'Enter' && !(field && field.tagName === 'TEXTAREA')) { e.preventDefault(); yes(); }
    };
    open = done;
    document.addEventListener('keydown', key, true);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-no]')) done(input ? null : false);
      else if (e.target.closest('[data-ok]')) yes();
    });
    if (field) field.addEventListener('input', () => field.classList.remove('err'));
    requestAnimationFrame(() => { wrap.classList.add('on'); if (field) { field.focus(); field.select && field.select(); } else wrap.querySelector('[data-ok]').focus(); });
  });
}

/** → true / false. `danger` paints the button red (deletes, bans, cancellations). */
export function uiConfirm(msg, o = {}) {
  const [t, x] = o.title ? [o.title, msg] : split(msg);
  return sheet({ title: t, text: x, ok: o.ok || (o.danger ? 'حذف' : 'تأكيد'), cancel: o.cancel, danger: o.danger, icon: o.icon });
}
/** → the text typed (trimmed; '' when left empty) or null when cancelled */
export function uiPrompt(msg, value = '', o = {}) {
  const [t, x] = o.title ? [o.title, msg] : split(msg);
  return sheet({ title: t, text: o.text || (o.title ? msg : x), icon: o.icon, ok: o.ok || 'حفظ', cancel: o.cancel, danger: o.danger,
    input: { value, type: o.type, placeholder: o.placeholder, required: o.required, multiline: o.multiline, label: o.label, inputmode: o.inputmode } });
}
