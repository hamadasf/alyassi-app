// «استوديو الفيديو» (management only): the website's motion studio running inside the app, on its own full screen.
// The studio's code, styles and fonts come from the website (so it is always the newest one); every call it makes goes
// through the app's own sign-in (alyassi-app-studio.php), and the finished video is saved / shared with the phone's sheet.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const native = Capacitor.isNativePlatform();
let root = null, opening = false;
const loaded = new Set();

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const base = (u) => String(u).split('?')[0];

function addCss(href) {
  if (loaded.has(base(href))) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.oayStudio = '1'; document.head.appendChild(l); loaded.add(base(href));
}
function addJs(src, always) {
  return new Promise((ok, no) => {
    if (!always && loaded.has(base(src))) { ok(); return; }
    const s = document.createElement('script'); s.src = src; s.async = false; s.dataset.oayStudio = '1';
    s.onload = () => { loaded.add(base(src)); ok(); }; s.onerror = () => no(new Error('تعذّر تحميل الاستوديو — تحقق من الإنترنت'));
    document.head.appendChild(s);
  });
}

/** the finished video: the phone's share sheet (WhatsApp, Instagram, «Save video»…), or a download on the web version */
async function saveVideo(blob, name, toast) {
  const file = String(name || 'video.mp4').replace(/[\\/:*?"<>|]+/g, '-');
  if (!native) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); a.remove(); return; }
  try {
    toast('جاري التجهيز…');
    const u8 = new Uint8Array(await blob.arrayBuffer());
    const w = await Filesystem.writeFile({ path: file, data: b64(u8), directory: Directory.Cache });
    await Share.share({ title: file, files: [w.uri], dialogTitle: 'حفظ / مشاركة الفيديو' });
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return;
    try {   // no share sheet: keep it in the phone's files
      const u8 = new Uint8Array(await blob.arrayBuffer());
      await Filesystem.writeFile({ path: 'عمر الياسي/' + file, data: b64(u8), directory: Directory.Documents, recursive: true });
      toast('اتحفظ في الملفات ← Documents ← عمر الياسي ✓');
    } catch { toast('تعذّر حفظ الفيديو'); }
  }
}

export function studioOpen() { return !!root; }
export function closeStudio() {
  if (!root) return false;
  const h = window.DNP_STUDIO_HOST;
  try { if (h && h.dispose) h.dispose(); } catch { /* already gone */ }
  root.remove(); root = null; document.documentElement.classList.remove('oay-studio-on');
  return true;
}

/** opens the studio; `api` is the app's signed-in call (owner.js), `toast` the app's message */
export async function openStudio({ api, toast }) {
  if (root || opening) return;
  opening = true;
  const shell = document.createElement('div');
  shell.className = 'oay-studio-boot';
  shell.innerHTML = '<div class="oay-studio-spin"></div><p>جاري فتح استوديو الفيديو…</p>';
  document.body.appendChild(shell);
  try {
    const { boot } = await api('studio', { a: 'boot' });
    (boot.css || []).forEach(addCss);
    if (!document.getElementById('oayStudioFonts') && boot.fonts) {
      const st = document.createElement('style'); st.id = 'oayStudioFonts';
      st.textContent = `@font-face{font-family:"DNP Tajawal";src:url(${boot.fonts[0]}) format("woff2");font-weight:400}@font-face{font-family:"DNP Tajawal";src:url(${boot.fonts[1]}) format("woff2");font-weight:700 800}`;
      document.head.appendChild(st);
    }
    root = document.createElement('div'); root.className = 'oay-studio';
    window.DNP_MAP = boot.map || []; window.DNP_MAP_AJAX = ''; window.DNP_LOGO = boot.logo || ''; window.DNP_MAP_URL = '';
    window.DNP_AI = { nonce: '', conf: boot.ai || { use: 'openai', list: [] } };
    window.DNP_MEDIA = { nonce: '', conf: boot.media || { use: 'elevenlabs', list: [] } };
    window.DNP_STUDIO_HOST = {
      root, app: true,
      call: (action, data) => api('studio', { a: action, d: data || {} }).then((j) => j.j),
      save: (blob, name) => saveVideo(blob, name, toast),
      close: () => closeStudio(),
    };
    const js = boot.js || [];
    for (let i = 0; i < js.length - 1; i++) await addJs(js[i], false);   // the map engine and the MP4 writer: once
    document.body.appendChild(root); document.documentElement.classList.add('oay-studio-on');
    await addJs(js[js.length - 1], true);   // the studio itself starts afresh each time
  } catch (e) {
    if (root) { root.remove(); root = null; }
    document.documentElement.classList.remove('oay-studio-on');
    toast(e.message || 'تعذّر فتح الاستوديو');
  } finally { shell.remove(); opening = false; }
}
