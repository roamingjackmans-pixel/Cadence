// Drawing the side-scrolling world. Everything static is drawn once into cached canvases; a frame only blits.
import { W, H, makeCanvas, bitmapify } from './util.js';
import { T } from './level.js';

export const NEON = '#3dff9a', NEON2 = '#19e0b0', NEON_RGB = '61,255,154';
export const Z = 1.375;   // camera zoom; 256 * Z * q is a whole number for every quality step q
const CH = 256;           // chunk size in world pixels
const KEEP = 90;          // chunks kept in the cache

function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/*
 * Everything big is drawn into caches at the exact device scale, then copied at whole-pixel offsets. A scaled or
 * sub-pixel drawImage makes the rasteriser resample every pixel, which is what made the first build slow.
 */
export class LevelArt {
  constructor(L) {
    this.L = L;
    this.cw = Math.ceil(L.cols * T / CH); this.chh = Math.ceil(L.rows * T / CH);
    this.q = 0;
    this.setScale(1);
  }
  setScale(q) {
    if (q === this.q) return;
    this.q = q; this.S = q * Z; this.CHD = Math.round(CH * this.S);
    this.chunks = new Map();
    this.makeBackdrops();
  }
  tile(c, r) { const L = this.L; if (c < 0 || c >= L.cols || r < 0) return 1; if (r >= L.rows) return 0; const v = L.tiles[r * L.cols + c]; return v === 3 ? 0 : v; }

  chunk(i, j) {
    const k = j * this.cw + i, M = this.chunks;
    if (M.has(k)) { const v = M.get(k); M.delete(k); M.set(k, v); return v; }
    const c0 = Math.floor(i * CH / T), r0 = Math.floor(j * CH / T), n = CH / T;
    let air = 0, solid = 0, plat = false;
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) { const v = this.tile(c, r); if (v === 1) solid++; else { air++; if (v === 2) plat = true; } }
    let edge = false;
    if (!air) for (let r = r0 - 1; r <= r0 + n && !edge; r++) for (let c = c0 - 1; c <= c0 + n; c++) if (this.tile(c, r) !== 1) { edge = true; break; }
    let out;
    if (!air && !edge) out = 'solid';
    else if (!solid && !plat) out = null;
    else {
      const [cv, g] = makeCanvas(this.CHD, this.CHD);
      g.scale(this.S, this.S); g.translate(-i * CH, -j * CH);
      this.paintTiles(g, c0, r0, n);
      out = cv;
      bitmapify(cv, (bm) => { if (M.get(k) === cv) M.set(k, bm); });
    }
    M.set(k, out);
    if (M.size > KEEP) M.delete(M.keys().next().value);
    return out;
  }
  paintTiles(g, c0, r0, n) {
    const rand = seeded(c0 * 7919 + r0 * 104729 + 1);
    // rock: near-black with a faint grid
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
      if (this.tile(c, r) !== 1) continue;
      g.fillStyle = (c + r) % 2 ? '#020c08' : '#030f0a';
      g.fillRect(c * T, r * T, T, T);
    }
    // faint circuit traces running through the rock near open space
    g.strokeStyle = 'rgba(61,255,154,.11)'; g.lineWidth = 1.5; g.fillStyle = 'rgba(61,255,154,.22)';
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
      if (this.tile(c, r) !== 1 || rand() > 0.18) continue;
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) if (this.tile(c + dc, r + dr) !== 1) { near = true; break; }
      if (!near) continue;
      const x = c * T + 6 + rand() * 20, y = r * T + 6 + rand() * 20, horiz = rand() < 0.5, len = 12 + rand() * 30;
      g.beginPath(); g.moveTo(x, y);
      if (horiz) { g.lineTo(x + len, y); g.lineTo(x + len + 8, y + 8); } else { g.lineTo(x, y + len); g.lineTo(x + 8, y + len + 8); }
      g.stroke();
      g.beginPath(); g.arc(x, y, 2.2, 0, 6.283); g.fill();
    }
    // edges: every rock face that touches open space glows
    const edges = new Path2D();
    for (let r = r0 - 1; r <= r0 + n; r++) for (let c = c0 - 1; c <= c0 + n; c++) {
      if (this.tile(c, r) !== 1) continue;
      const x = c * T, y = r * T;
      if (this.tile(c, r - 1) !== 1) { edges.moveTo(x, y); edges.lineTo(x + T, y); }
      if (this.tile(c, r + 1) !== 1) { edges.moveTo(x, y + T); edges.lineTo(x + T, y + T); }
      if (this.tile(c - 1, r) !== 1) { edges.moveTo(x, y); edges.lineTo(x, y + T); }
      if (this.tile(c + 1, r) !== 1) { edges.moveTo(x + T, y); edges.lineTo(x + T, y + T); }
    }
    g.lineCap = 'square';
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(61,255,154,.08)'; g.lineWidth = 16; g.stroke(edges);
    g.strokeStyle = 'rgba(61,255,154,.16)'; g.lineWidth = 7; g.stroke(edges);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = NEON; g.lineWidth = 2; g.stroke(edges);
    // a second, inset line along floors, like a lit seam
    g.strokeStyle = 'rgba(61,255,154,.35)'; g.lineWidth = 1;
    g.beginPath();
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) if (this.tile(c, r) === 1 && this.tile(c, r - 1) !== 1) { g.moveTo(c * T, r * T + 6); g.lineTo(c * T + T, r * T + 6); }
    g.stroke();
    // one-way platforms: thin bars of light
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
      if (this.tile(c, r) !== 2) continue;
      const x = c * T, y = r * T;
      g.fillStyle = 'rgba(25,224,176,.18)'; g.fillRect(x, y - 3, T, 12);
      g.fillStyle = '#041a12'; g.fillRect(x + 1, y, T - 2, 6);
      g.fillStyle = NEON2; g.fillRect(x, y, T, 2);
      if (this.tile(c - 1, r) !== 2) g.fillRect(x, y, 2, 8);
      if (this.tile(c + 1, r) !== 2) g.fillRect(x + T - 2, y, 2, 8);
    }
  }

  /** Draws with an identity transform. ox, oy: the camera in device pixels (whole numbers). */
  drawTiles(ctx, ox, oy, vw, vh) {
    const D = this.CHD, cx = ox / this.S, cy = oy / this.S;
    const i0 = Math.max(0, Math.floor(cx / CH)), i1 = Math.min(this.cw - 1, Math.floor((cx + vw) / CH));
    const j0 = Math.max(0, Math.floor(cy / CH)), j1 = Math.min(this.chh - 1, Math.floor((cy + vh) / CH));
    ctx.fillStyle = '#020c08';
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = this.chunk(i, j);
      if (c === 'solid') ctx.fillRect(i * D - ox, j * D - oy, D, D);
      else if (c) ctx.drawImage(c, i * D - ox, j * D - oy);
    }
    // build one chunk of the ring just outside the view each frame, so scrolling never waits on painting
    for (let j = j0 - 1; j <= j1 + 1; j++) for (let i = i0 - 1; i <= i1 + 1; i++) {
      if (i < 0 || j < 0 || i >= this.cw || j >= this.chh || this.chunks.has(j * this.cw + i)) continue;
      this.chunk(i, j); return;
    }
  }

  /** Warms the chunk cache around a point so the first frames don't hitch. */
  warm(x, y) {
    const i0 = Math.floor((x - 700) / CH), j0 = Math.floor((y - 400) / CH);
    for (let j = j0; j <= j0 + 4; j++) for (let i = i0; i <= i0 + 6; i++) if (i >= 0 && j >= 0 && i < this.cw && j < this.chh) this.chunk(i, j);
  }
  makeBackdrops() {
    const q = this.q, BW = 2048, FH = H + 140, base = FH * 0.74;
    this.BW = BW; this.FH = FH;
    // far: sky, horizon, towers and a receding floor grid, in one opaque layer at device scale
    const far = document.createElement('canvas'); far.width = Math.round(BW * q); far.height = Math.round(FH * q);
    const g2 = far.getContext('2d', { alpha: false });
    g2.scale(q, q);
    const sky = g2.createLinearGradient(0, 0, 0, FH);
    sky.addColorStop(0, '#000302'); sky.addColorStop(0.6, '#021008'); sky.addColorStop(1, '#03180e');
    g2.fillStyle = sky; g2.fillRect(0, 0, BW, FH);
    const hz = g2.createLinearGradient(0, base - 160, 0, base + 40);
    hz.addColorStop(0, 'rgba(61,255,154,0)'); hz.addColorStop(0.7, 'rgba(61,255,154,.08)'); hz.addColorStop(1, 'rgba(61,255,154,0)');
    g2.fillStyle = hz; g2.fillRect(0, base - 160, BW, 200);
    const rs = seeded(3);
    for (let x = 80; x < BW - 80; x += 260 + rs() * 300) {
      const w = 50 + rs() * 70, lg = g2.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0, 'rgba(25,224,176,0)'); lg.addColorStop(0.5, 'rgba(25,224,176,.06)'); lg.addColorStop(1, 'rgba(25,224,176,0)');
      g2.fillStyle = lg; g2.fillRect(x, 0, w, FH);
    }
    const rand = seeded(42);
    for (let x = 0; x < BW - 60;) {
      const w = 40 + rand() * 90, h = 140 + rand() * 320, y = base - h;
      g2.fillStyle = '#020e09'; g2.fillRect(x, y, w, h);
      g2.strokeStyle = 'rgba(61,255,154,.22)'; g2.lineWidth = 1.5; g2.strokeRect(x + 0.5, y + 0.5, w, h + 4);
      g2.fillStyle = 'rgba(61,255,154,.16)';
      for (let wy = y + 12; wy < base; wy += 14) for (let wx = x + 6; wx < x + w - 6; wx += 10) if (rand() < 0.16) g2.fillRect(wx, wy, 4, 2);
      if (rand() < 0.4) { g2.fillStyle = 'rgba(25,224,176,.5)'; g2.fillRect(x + w / 2 - 1, y - 30, 2, 30); }
      x += w + 10 + rand() * 50;
    }
    g2.fillStyle = '#010c07'; g2.fillRect(0, base, BW, FH - base);
    g2.strokeStyle = 'rgba(61,255,154,.12)'; g2.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const y = base + Math.pow(k / 8, 1.8) * (FH - base); g2.beginPath(); g2.moveTo(0, y); g2.lineTo(BW, y); g2.stroke(); }
    for (let x = 0; x < BW; x += 64) { g2.beginPath(); g2.moveTo(x, base); g2.lineTo(x + (x % 128 ? -40 : 40), FH); g2.stroke(); }
    this.far = far;
    bitmapify(far, (bm) => { if (this.far === far) this.far = bm; });
    // mid: a few pylons, plain rectangles (a translucent sprite here cost 12 ms a frame on software canvas)
    const r2 = seeded(7);
    this.pylons = [];
    for (let x = 60; x < BW - 40; x += 220 + r2() * 260) this.pylons.push({ x, w: 14 + r2() * 18, top: H * 0.25 + r2() * 120 });    this.vig = makeVignette(q);
    const v = this.vig; bitmapify(v, (bm) => { if (this.vig === v) this.vig = bm; });
  }

  /** Identity transform, device pixels. */
  drawBG(ctx, camX, camY) {
    const q = this.q, BW = this.BW, BWD = this.far.width;
    const fx = Math.round(-((((camX * 0.12) % BW) + BW) % BW) * q), fy = Math.round(Math.max(H - this.FH, Math.min(0, -60 - camY * 0.04)) * q);
    ctx.drawImage(this.far, fx, fy);
    if (fx + BWD < W * q) ctx.drawImage(this.far, fx + BWD, fy);
    const mo = (((camX * 0.3) % BW) + BW) % BW, my = 60 - camY * 0.1;
    ctx.strokeStyle = 'rgba(25,224,176,.3)'; ctx.lineWidth = 1.2 * q;
    for (const p of this.pylons) for (const k of [0, BW]) {
      const x = p.x - mo + k;
      if (x < -p.w * 3 || x > W + p.w * 2) continue;
      const X = Math.round(x * q), top = Math.round(Math.max(0, p.top + my) * q), w = Math.round(p.w * q);
      ctx.fillStyle = '#01100a'; ctx.fillRect(X, top, w, H * q - top);
      ctx.strokeRect(X + 0.5, top + 0.5, w, H * q);
    }
  }
}

/** A vignette that only touches the edges of the frame: the middle is never blended. Built at device scale. */
export function makeVignette(q = 1) {
  const [c, g] = makeCanvas(W * q, H * q);
  g.scale(q, q);
  const r = g.createRadialGradient(W / 2, H / 2, H * 0.56, W / 2, H / 2, H * 1.02);
  r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.62)');
  g.fillStyle = r; g.fillRect(0, 0, W, H);
  c.q = q;
  return c;
}
const VB = [[0, 0, W, 150], [0, H - 150, W, 150], [0, 150, 300, H - 300], [W - 300, 150, 300, H - 300]];
/** Identity transform. */
export function drawVignette(ctx, v) {
  const q = v.q;
  for (const [x, y, w, h] of VB) { const X = Math.round(x * q), Y = Math.round(y * q), Wd = Math.round(w * q), Hd = Math.round(h * q); ctx.drawImage(v, X, Y, Wd, Hd, X, Y, Wd, Hd); }
}