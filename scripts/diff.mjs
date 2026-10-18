// Compares the new website snapshot with the previous one and records price / status changes.
// usage: node scripts/diff.mjs <prev data.json> <new data.json> <prev changes.json> <out changes.json> <out new-changes.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [prevPath, nextPath, prevChangesPath, outPath, newOutPath] = process.argv.slice(2);
const read = (p, d) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d; } catch { return d; } };
const prev = read(prevPath, null);
const next = read(nextPath, null);
const history = read(prevChangesPath, { items: [] });
const now = Date.now();
const fresh = [];

if (prev && next && prev.projects?.length && next.projects?.length) {
  const map = (d) => new Map(d.projects.flatMap((p) => p.lands).map((l) => [l.id, l]));
  const before = map(prev);
  const prevProjects = new Set(prev.projects.map((p) => p.slug));
  for (const l of map(next).values()) {
    const o = before.get(l.id);
    const base = { t: now, id: l.id, n: l.n, project: l.project, projectName: l.projectName };
    if (!o) {
      // a plot newly offered in a project we already knew (not a whole new project on first run)
      if (prevProjects.has(l.project) && l.status === 'av') fresh.push({ ...base, kind: 'new', to: l.total || 0 });
      continue;
    }
    if (o.status !== l.status) fresh.push({ ...base, kind: 'status', from: o.status, to: l.status });
    if ((o.total || 0) !== (l.total || 0) && l.status !== 'sold') fresh.push({ ...base, kind: 'price', from: o.total || 0, to: l.total || 0 });
  }
}

const items = [...fresh, ...(history.items || [])].filter((x) => now - x.t < 30 * 24 * 3600e3).slice(0, 300);
writeFileSync(outPath, JSON.stringify({ at: now, items }));
writeFileSync(newOutPath, JSON.stringify(fresh));
console.log(`changes: ${fresh.length} new, ${items.length} kept`);
