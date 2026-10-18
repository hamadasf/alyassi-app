// Data layer: reads projects, plot sizes/types and live availability straight from the website.
import { SITE, TTL, DEFAULT_TYPES } from './config.js';

const NS = 'oay:';
const now = () => Date.now();

function cacheGet(key) {
  try { const v = localStorage.getItem(NS + key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function cacheSet(key, data) {
  try { localStorage.setItem(NS + key, JSON.stringify({ t: now(), d: data })); } catch { /* storage full — ignore */ }
}
const fresh = (c, ttl) => c && now() - c.t < ttl;

async function getText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
const parseHTML = (t) => new DOMParser().parseFromString(t, 'text/html');
const abs = (u) => { try { return new URL(u, SITE + '/').href; } catch { return ''; } };
const SKIP = /\/(projects|lands|about-us|contact-us|add-property|login|wp-|feed|category|tag)\b/;

/* ---------- 1. project index (from /projects/ and each project page) ---------- */
async function fetchIndex() {
  const doc = parseHTML(await getText(SITE + '/projects/'));
  const pages = [];
  doc.querySelectorAll('a[href*="/projects/"]').forEach((a) => {
    const u = abs(a.getAttribute('href')).split('#')[0];
    if (/\/projects\/[^/]+\/?$/.test(u) && !pages.includes(u)) pages.push(u);
  });
  const projects = await Promise.all(pages.map(async (page, order) => {
    try {
      const d = parseHTML(await getText(page));
      const title = (d.querySelector('h1')?.textContent || '').trim();
      let plan = '', pdf = '';
      d.querySelectorAll('a[href]').forEach((a) => {
        const u = abs(a.getAttribute('href'));
        if (!u.startsWith(SITE)) return;
        if (/\?pdf=1/.test(u)) { pdf = pdf || u; return; }
        const path = u.slice(SITE.length).split(/[?#]/)[0];
        if (/^\/[a-z0-9-]+\/$/.test(path) && !SKIP.test(path) && !plan) plan = SITE + path;
      });
      const poster = [...d.querySelectorAll('img')].map((i) => i.getAttribute('src') || '').find((s) => /poster\.jpg/.test(s)) || '';
      if (!plan) return null;
      const slug = plan.slice(SITE.length).replace(/\//g, '');
      return { slug, page, plan, pdf, poster: abs(poster), title: title.replace(/^مشروع\s+/, ''), order };
    } catch { return null; }
  }));
  return projects.filter(Boolean);
}

export async function getIndex(force = false) {
  const c = cacheGet('index');
  if (!force && fresh(c, TTL.index)) return c.d;
  try { const d = await fetchIndex(); if (d.length) cacheSet('index', d); return d.length ? d : (c?.d || []); }
  catch (e) { if (c) return c.d; throw e; }
}

/* ---------- 2. plan meta: plot numbers, types, sizes (from the plan page) ---------- */
async function fetchPlan(p) {
  const d = parseHTML(await getText(p.plan));
  const plan = JSON.parse(d.getElementById('plan')?.textContent || '{}');
  const assets = JSON.parse(d.getElementById('assets')?.textContent || '{}');
  const cfg = plan.cfg || {};
  const types = cfg.types || DEFAULT_TYPES;
  const plots = (plan.plots || []).map((q) => [q.n, q.t, q.ft || 0, q.m2 || 0, q.d ? 1 : 0]);
  const bldImg = {};
  Object.keys(assets).forEach((k) => { if (/\.(jpe?g|png|webp)/.test(assets[k]) && k !== 'bg') bldImg[k] = assets[k]; });
  return {
    name: cfg.name || p.title, sub: cfg.sub || '', note: cfg.note || '',
    types, order: cfg.order || Object.keys(types), plots, bldImg,
    poster: p.poster || assets.reg || '',
  };
}

async function getPlan(p, force) {
  const key = 'plan:' + p.slug;
  const c = cacheGet(key);
  if (!force && fresh(c, TTL.plan)) return c.d;
  try { const d = await fetchPlan(p); cacheSet(key, d); return d; }
  catch (e) { if (c) return c.d; throw e; }
}

/* ---------- 3. live state: availability, prices, instalments (light ajax call) ---------- */
async function getState(p) {
  const key = 'state:' + p.slug;
  try {
    const r = await fetch(`${SITE}/wp-admin/admin-ajax.php?action=dn_state&project=${encodeURIComponent(p.slug)}`, { cache: 'no-store' });
    const j = await r.json();
    if (j && j.success) { cacheSet(key, j.data.state); return j.data.state; }
    throw new Error('state');
  } catch (e) { const c = cacheGet(key); if (c) return c.d; throw e; }
}

/* ---------- assemble ---------- */
export const STATUS = {
  av: { label: 'متاحة', cls: 'av' },
  res: { label: 'محجوزة', cls: 'res' },
  sold: { label: 'مباعة', cls: 'sold' },
};

export function category(use = '') {
  if (/صناع/.test(use)) return 'صناعي';
  if (/محل/.test(use)) return 'محلات';
  if (/فلل|فيلا/.test(use)) return 'فلل';
  if (/مكاتب/.test(use)) return 'تجاري';
  if (/تجاري/.test(use)) return 'تجاري';
  if (/سكن/.test(use)) return 'سكني';
  return 'أخرى';
}

function buildProject(p, plan, state) {
  const sp = (state && state.plots) || {};
  const bld = (state && state.bld) || {};
  // Only plots the company lists (present in the live state with a status) are shown — same as the website's «الأراضي» page.
  const lands = plan.plots.filter(([n]) => sp[n] && sp[n].s).map(([n, t, ft, m2, exact]) => {
    const s = sp[n];
    const ty = plan.types[t] || DEFAULT_TYPES[t] || { use: 'أرض' };
    const area = s.ft || ft;
    const total = s.total || (s.ppf && area ? Math.round(s.ppf * area) : 0);
    const inst = Array.isArray(s.inst) ? s.inst : [];
    const instSum = inst.reduce((a, x) => a + (+x[1] || 0), 0);
    const sketch = (s.plan && s.plan.sk && s.plan.sk.u) || '';
    const img = (s.img && s.img.u) || (ty.b && bld[ty.b] && bld[ty.b].u) || (ty.b && plan.bldImg[ty.b]) || sketch || plan.bldImg.reg || plan.poster;
    return {
      id: p.slug + ':' + n, n: String(n), t, project: p.slug, projectName: plan.name || p.title,
      status: s.s, featured: !!s.fe, use: ty.use || '', tag: ty.tag || '', loc: ty.loc || '',
      floors: ty.floors || '', color: ty.c || [200, 200, 200], cat: category(ty.use),
      ft: Math.round(area || 0), m2: Math.round((s.ft ? s.ft / 10.7639 : m2) || 0), approx: !exact && !s.ft,
      ppf: s.ppf || 0, total, inst, first: inst.length && total ? Math.max(0, total - instSum) : 0, img, sketch,
      doc: (s.doc && s.doc.u) || '', docTitle: (s.doc && s.doc.t) || '',
    };
  });
  const count = (st) => lands.filter((l) => l.status === st).length;
  return {
    ...p, name: plan.name || p.title, sub: plan.sub, note: plan.note, poster: plan.poster || p.poster,
    loc: (state && state.loc) || '', updated: (state && state.updated) || '',
    lands, available: count('av'), reserved: count('res'), sold: count('sold'),
  };
}

let memo = null;
export function cached() { return memo; }

/** Loads everything. onPartial is called with each finished project so the UI can paint early. */
export async function loadAll({ force = false, onPartial } = {}) {
  const index = await getIndex(force);
  const out = [];
  await Promise.all(index.map(async (p) => {
    try {
      const [plan, state] = await Promise.all([getPlan(p, force), getState(p).catch(() => null)]);
      const proj = buildProject(p, plan, state);
      out.push(proj);
      if (onPartial) { memo = { projects: sorted(out), lands: sorted(out).flatMap((x) => x.lands), at: now(), partial: true }; onPartial(); }
    } catch { /* skip a project that failed */ }
  }));
  memo = { projects: sorted(out), lands: sorted(out).flatMap((p) => p.lands), at: now() };
  return memo;
}
const sorted = (a) => [...a].sort((x, y) => x.order - y.order);

/** Instant start: build from cache only (no network). */
export function loadFromCache() {
  const ic = cacheGet('index'); if (!ic) return null;
  const projects = [];
  for (const p of ic.d) {
    const pc = cacheGet('plan:' + p.slug); if (!pc) continue;
    const sc = cacheGet('state:' + p.slug);
    projects.push(buildProject(p, pc.d, sc && sc.d));
  }
  if (!projects.length) return null;
  memo = { projects: sorted(projects), lands: sorted(projects).flatMap((p) => p.lands), at: ic.t, fromCache: true };
  return memo;
}

/* ---------- favourites ---------- */
export const favs = {
  all() { try { return JSON.parse(localStorage.getItem(NS + 'favs') || '[]'); } catch { return []; } },
  has(id) { return this.all().includes(id); },
  toggle(id) {
    const a = this.all(); const i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.unshift(id);
    try { localStorage.setItem(NS + 'favs', JSON.stringify(a)); } catch { /* ignore */ }
    return i < 0;
  },
};
