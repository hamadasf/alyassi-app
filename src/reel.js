/* global VideoEncoder, VideoFrame */
// «ريل فيديو» (the admin only): a 9:16 video of about 10 seconds made from a plot's post, on the phone itself —
// the plan of the project zooming in to the plot, then the post, then the company's card with the phone number.
// Encoded to MP4 with WebCodecs (+ mp4-muxer); where that is missing, recorded from the canvas (MediaRecorder).
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { drawPlanView, plotCentre } from './planloc.js';

const W = 1080, H = 1920, FPS = 30;
const NAVY = '#14183C', GOLD = '#C9A55A';
const T1 = 3.8, T2 = 8.2, T3 = 10.4;   // scene ends (seconds): the plan · the post · the company's card
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const F = (w, px) => `${w} ${Math.round(px)}px Tajawal, "Noto Kufi Arabic", sans-serif`;

function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function pill(c, text, x, y, px, bg, fg) {
  c.save(); c.direction = 'rtl'; c.font = F(800, px); const w = c.measureText(text).width + px * 1.3, h = px * 1.75;
  c.fillStyle = bg; rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill();
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + px * 0.06); c.restore();
}
/** the post on a blurred copy of itself, as tall as the frame allows */
function storyFrame(post) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const bs = Math.max(W / post.width, H / post.height) * 1.15;
  c.save(); c.filter = 'blur(38px) brightness(.6)'; c.drawImage(post, (W - post.width * bs) / 2, (H - post.height * bs) / 2, post.width * bs, post.height * bs); c.restore();
  let w = W - 60, h = w * post.height / post.width; if (h > H - 300) { h = H - 300; w = h * post.width / post.height; }
  const x = (W - w) / 2, y = (H - h) / 2;
  c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 60; c.shadowOffsetY = 18; rr(c, x, y, w, h, 30); c.fillStyle = '#fff'; c.fill(); c.restore();
  c.save(); rr(c, x, y, w, h, 30); c.clip(); c.drawImage(post, x, y, w, h); c.restore();
  return cv;
}

/**
 * @param o { post: canvas, P, lands, map, land, proj: project name, title, info: «2,800 قدم² · 415,000 درهم», phone, logo: image, onStep(0..1) }
 * @returns Promise<Blob> (video/mp4, or video/webm where MP4 can't be made)
 */
export async function makeReel(o) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const story = storyFrame(o.post);
  // the views of the plan: the whole project → the plot (140 × 110 plan units around it, like the website's focus)
  const R = { x: 40, y: 400, w: W - 80, h: 1120 };
  const pts = []; for (const l of o.lands) { if (l.poly) l.poly.forEach((q) => pts.push(q)); else if (l.pc) pts.push(l.pc); }
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const bx0 = xs.length ? Math.min(...xs) : 0, bx1 = xs.length ? Math.max(...xs) : o.map.w, by0 = ys.length ? Math.min(...ys) : 0, by1 = ys.length ? Math.max(...ys) : o.map.h;
  const pad = 0.06, bw = (bx1 - bx0) * (1 + pad * 2) || o.map.w, bh = (by1 - by0) * (1 + pad * 2) || o.map.h;
  const A = { ppu: Math.min(R.w / bw, R.h / bh), cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2 };
  const [pcx, pcy] = plotCentre(o.land);
  let vw = 150, vh = 120; if (vw / vh < R.w / R.h) vw = vh * R.w / R.h; else vh = vw * R.h / R.w;
  const B = { ppu: R.w / vw, cx: pcx, cy: pcy };
  let last1 = null;

  const scene1 = (t) => {   // 0 … T1
    c.fillStyle = NAVY; c.fillRect(0, 0, W, H);
    const z = ease(clamp((t - 0.5) / 2.4));
    const ppu = Math.exp(Math.log(A.ppu) + (Math.log(B.ppu) - Math.log(A.ppu)) * z);
    const k = (ppu - A.ppu) / ((B.ppu - A.ppu) || 1);   // the centre follows the zoom, so the plot stays in sight
    const cx = A.cx + (B.cx - A.cx) * k, cy = A.cy + (B.cy - A.cy) * k;
    const x0 = cx - R.w / 2 / ppu, y0 = cy - R.h / 2 / ppu;
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 40; rr(c, R.x, R.y, R.w, R.h, 36); c.fillStyle = '#EFE9DD'; c.fill(); c.restore();
    drawPlanView(c, o.P, o.lands, o.map, { x: R.x, y: R.y, w: R.w, h: R.h, radius: 36, ppu, x0, y0, sel: o.land, labels: z > 0.6 });
    const sx = R.x + (pcx - x0) * ppu, sy = R.y + (pcy - y0) * ppu;
    const ring = clamp((t - 2.7) / 0.5);
    if (ring > 0) {
      const pulse = 1 + 0.12 * Math.sin((t - 2.7) * 7);
      c.save(); c.globalAlpha = ring; c.strokeStyle = '#E3060C'; c.lineWidth = 10;
      c.beginPath(); c.arc(sx, sy, 70 * pulse, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = ring * 0.35; c.beginPath(); c.arc(sx, sy, 110 * pulse, 0, Math.PI * 2); c.stroke(); c.restore();
      c.save(); c.globalAlpha = ring; pill(c, 'قطعة رقم ' + o.land.n, sx, Math.max(R.y + 60, sy - 150), 50, '#E3060C', '#fff'); c.restore();
    }
    // the top: logo and the title; the bottom: the area and the price
    const a = clamp(t / 0.6);
    c.save(); c.globalAlpha = a; c.direction = 'rtl';
    if (o.logo && o.logo.naturalWidth) { const lh = 170, lw = lh * o.logo.naturalWidth / o.logo.naturalHeight; c.save(); c.fillStyle = '#fff'; rr(c, W / 2 - lw / 2 - 24, 40, lw + 48, lh + 24, 26); c.fill(); c.restore(); c.drawImage(o.logo, W / 2 - lw / 2, 52, lw, lh); }
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = F(800, 66); c.fillText(o.title, W / 2, 298, W - 80);
    c.fillStyle = GOLD; c.font = F(900, 54); c.fillText(o.proj + ' · الشارقة', W / 2, 375, W - 80);
    c.restore();
    const b = clamp((t - 1.2) / 0.6);
    if (b > 0 && o.info) { c.save(); c.globalAlpha = b; pill(c, o.info, W / 2, 1640 + (1 - b) * 40, 58, GOLD, NAVY); c.restore(); }
    if (b > 0) { c.save(); c.globalAlpha = b; c.fillStyle = 'rgba(255,255,255,.8)'; c.textAlign = 'center'; c.direction = 'rtl'; c.font = F(700, 42); c.fillText('تملّك حر لجميع الجنسيات العربية', W / 2, 1790); c.restore(); }
  };
  const scene2 = (t) => {   // T1 … T2: the post, slowly drawing nearer
    const u = (t - T1) / (T2 - T1), s = 1.0 + 0.05 * u;
    c.fillStyle = NAVY; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.drawImage(story, 0, 0); c.restore();
    const f = clamp((t - T1) / 0.45); if (f < 1 && last1) { c.save(); c.globalAlpha = 1 - f; c.drawImage(last1, 0, 0); c.restore(); }
  };
  const scene3 = (t) => {   // T2 … T3: the company's card
    const f = clamp((t - T2) / 0.45);
    scene2(T2); c.save(); c.globalAlpha = f; c.fillStyle = NAVY; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, 900); g.addColorStop(0, 'rgba(201,165,90,.22)'); g.addColorStop(1, 'rgba(201,165,90,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const up = (1 - ease(f)) * 40;
    if (o.logo && o.logo.naturalWidth) { const lw = 640, lh = lw * o.logo.naturalHeight / o.logo.naturalWidth; c.fillStyle = '#fff'; rr(c, W / 2 - lw / 2 - 40, 430 + up - 30, lw + 80, lh + 60, 40); c.fill(); c.drawImage(o.logo, W / 2 - lw / 2, 430 + up, lw, lh); }
    c.direction = 'rtl'; c.textAlign = 'center';
    c.fillStyle = '#fff'; c.font = F(700, 52); c.fillText('للتواصل والاستفسار', W / 2, 1120 + up);
    if (o.phone) { c.direction = 'ltr'; c.fillStyle = GOLD; c.font = F(900, 118); c.fillText(o.phone, W / 2, 1270 + up); c.direction = 'rtl'; }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = F(700, 46); c.fillText('شركة عمر الياسي للعقارات', W / 2, 1420 + up); c.font = F(600, 40); c.fillText('الشارقة - شارع مليحة', W / 2, 1480 + up);
    c.restore();
  };
  const frame = (t) => {
    if (t < T1) { scene1(t); if (t + 1 / FPS >= T1) { last1 = document.createElement('canvas'); last1.width = W; last1.height = H; last1.getContext('2d').drawImage(cv, 0, 0); } }
    else if (t < T2) scene2(t); else scene3(t);
  };
  const N = Math.round(T3 * FPS);

  // MP4 with WebCodecs (Android Chrome / WebView, iPhone iOS 16.4+)
  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined') {
    let cfg = null;
    for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a']) {
      const t = { codec, width: W, height: H, bitrate: 7e6, framerate: FPS, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(t)).supported) { cfg = t; break; } } catch { /* next */ }
    }
    if (cfg) {
      const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
      let err = null; const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { err = e; } });
      enc.configure(cfg);
      for (let i = 0; i < N; i++) {
        if (err) throw err;
        frame(i / FPS);
        const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
        enc.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
        while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 5));
        if (o.onStep && i % 6 === 0) { o.onStep(i / N); await new Promise((r) => setTimeout(r, 0)); }
      }
      await enc.flush(); enc.close(); if (err) throw err;
      muxer.finalize();
      return new Blob([muxer.target.buffer], { type: 'video/mp4' });
    }
  }
  // else: record the canvas while it plays (real time)
  if (typeof MediaRecorder === 'undefined' || !cv.captureStream) throw new Error('هذا الجهاز لا يدعم صناعة الفيديو');
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const stream = cv.captureStream(FPS), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 7e6 } : {}), parts = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });
  frame(0); rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => { const t = (performance.now() - t0) / 1000; if (t >= T3) { resolve(); return; } frame(t); if (o.onStep) o.onStep(t / T3); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  rec.stop(); await done; stream.getTracks().forEach((x) => x.stop());
  return new Blob(parts, { type: (mime || 'video/webm').split(';')[0] });
}
