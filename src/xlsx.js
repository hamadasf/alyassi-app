// A small .xlsx reader (no library): unzips the workbook with the browser's own DecompressionStream and returns
// every sheet as rows of cell values. Enough for the office's land sheet (text, numbers, cached formula results).
const td = new TextDecoder();
async function inflate(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); const files = {};
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;   // end of central directory
  if (e < 0) throw new Error('الملف ليس ملف Excel صالحاً (xlsx)');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), start = off + 30 + lnl + lxl;
    files[name] = { method, data: u8.subarray(start, start + csize) };
    p += 46 + nl + xl + cl;
  }
  return async (name) => { const f = files[name]; if (!f) return null; return td.decode(f.method === 8 ? await inflate(f.data) : f.data); };
}
const col = (ref) => { let c = 0; for (const ch of ref.replace(/\d+/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');

/** → [{ name, rows: [[v, v, …], …] }] */
export async function readXlsx(file) {
  const get = await unzip(await file.arrayBuffer());
  const shared = []; const ss = await get('xl/sharedStrings.xml');
  if (ss) for (const si of xml(ss).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''));
  const wb = xml(await get('xl/workbook.xml')); const rels = xml(await get('xl/_rels/workbook.xml.rels'));
  const target = {}; for (const r of rels.getElementsByTagName('Relationship')) target[r.getAttribute('Id')] = r.getAttribute('Target');
  const out = [];
  for (const sh of wb.getElementsByTagName('sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let t = target[rid] || ''; t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    const src = await get(t); if (!src) continue;
    const rows = [];
    for (const r of xml(src).getElementsByTagName('row')) {
      const ri = +r.getAttribute('r') - 1; const row = rows[ri] = [];
      for (const c of r.getElementsByTagName('c')) {
        const ty = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]; let val = v ? v.textContent : null;
        if (ty === 's' && val != null) val = shared[+val];
        else if (ty === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
        else if (ty !== 'str' && ty !== 'e' && val != null && val !== '' && !isNaN(+val)) val = +val;
        row[col(c.getAttribute('r'))] = val;
      }
    }
    out.push({ name: sh.getAttribute('name'), rows: Array.from(rows, (r) => r || []) });
  }
  return out;
}
