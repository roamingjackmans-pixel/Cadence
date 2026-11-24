// Drawing the side-scrolling world. Everything static is drawn once into cached canvases; a frame only blits.
import { W, H, makeCanvas, bitmapify, rgbOf } from './util.js';
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
    this.th = themeOf(L.theme);
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
    const rand = seeded(c0 * 7919 + r0 * 104729 + 1), th = this.th;
    // rock: near-black with a faint grid
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
      if (this.tile(c, r) !== 1) continue;
      g.fillStyle = (c + r) % 2 ? th.rock : th.rock2;
      g.fillRect(c * T, r * T, T, T);
    }
    // faint circuit traces running through the rock near open space
    g.strokeStyle = th.a(0.11); g.lineWidth = 1.5; g.fillStyle = th.a(0.22);
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
    g.strokeStyle = th.a(0.08); g.lineWidth = 16; g.stroke(edges);
    g.strokeStyle = th.a(0.16); g.lineWidth = 7; g.stroke(edges);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = th.neon; g.lineWidth = 2; g.stroke(edges);
    // a second, inset line along floors, like a lit seam
    g.strokeStyle = th.a(0.35); g.lineWidth = 1;
    g.beginPath();
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) if (this.tile(c, r) === 1 && this.tile(c, r - 1) !== 1) { g.moveTo(c * T, r * T + 6); g.lineTo(c * T + T, r * T + 6); }
    g.stroke();
    // one-way platforms: thin bars of light
    for (let r = r0; r < r0 + n; r++) for (let c = c0; c < c0 + n; c++) {
      if (this.tile(c, r) !== 2) continue;
      const x = c * T, y = r * T;
      g.fillStyle = th.b(0.18); g.fillRect(x, y - 3, T, 12);
      g.fillStyle = th.plat; g.fillRect(x + 1, y, T - 2, 6);
      g.fillStyle = th.neon2; g.fillRect(x, y, T, 2);
      if (this.tile(c - 1, r) !== 2) g.fillRect(x, y, 2, 8);
      if (this.tile(c + 1, r) !== 2) g.fillRect(x + T - 2, y, 2, 8);
    }
  }

  /** Draws with an identity transform. ox, oy: the camera in device pixels (whole numbers). */
  drawTiles(ctx, ox, oy, vw, vh) {
    const D = this.CHD, cx = ox / this.S, cy = oy / this.S;
    const i0 = Math.max(0, Math.floor(cx / CH)), i1 = Math.min(this.cw - 1, Math.floor((cx + vw) / CH));
    const j0 = Math.max(0, Math.floor(cy / CH)), j1 = Math.min(this.chh - 1, Math.floor((cy + vh) / CH));
    ctx.fillStyle = this.th.rock;
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
    const q = this.q, BW = 2048, FH = H + 140, base = FH * 0.74, th = this.th;
    this.BW = BW; this.FH = FH;
    // far: sky, horizon, the zone's skyline and a receding floor grid, in one opaque layer at device scale
    const far = document.createElement('canvas'); far.width = Math.round(BW * q); far.height = Math.round(FH * q);
    const g2 = far.getContext('2d', { alpha: false });
    g2.scale(q, q);
    const sky = g2.createLinearGradient(0, 0, 0, FH);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);
    g2.fillStyle = sky; g2.fillRect(0, 0, BW, FH);
    const hz = g2.createLinearGradient(0, base - 160, 0, base + 40);
    hz.addColorStop(0, th.a(0)); hz.addColorStop(0.7, th.a(0.08)); hz.addColorStop(1, th.a(0));
    g2.fillStyle = hz; g2.fillRect(0, base - 160, BW, 200);
    const rs = seeded(3);
    for (let x = 80; x < BW - 80; x += 260 + rs() * 300) {
      const w = 50 + rs() * 70, lg = g2.createLinearGradient(x, 0, x + w, 0);
      lg.addColorStop(0, th.b(0)); lg.addColorStop(0.5, th.b(0.06)); lg.addColorStop(1, th.b(0));
      g2.fillStyle = lg; g2.fillRect(x, 0, w, FH);
    }
    SKYLINES[th.style](g2, BW, base, th, seeded(42 + th.seed));
    g2.fillStyle = th.ground; g2.fillRect(0, base, BW, FH - base);
    g2.strokeStyle = th.a(0.12); g2.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const y = base + Math.pow(k / 8, 1.8) * (FH - base); g2.beginPath(); g2.moveTo(0, y); g2.lineTo(BW, y); g2.stroke(); }
    for (let x = 0; x < BW; x += 64) { g2.beginPath(); g2.moveTo(x, base); g2.lineTo(x + (x % 128 ? -40 : 40), FH); g2.stroke(); }
    this.far = far;
    bitmapify(far, (bm) => { if (this.far === far) this.far = bm; });
    // mid: a few pylons, plain rectangles (a translucent sprite here cost 12 ms a frame on software canvas)
    const r2 = seeded(7);
    this.pylons = [];
    for (let x = 60; x < BW - 40; x += 220 + r2() * 260) this.pylons.push({ x, w: 14 + r2() * 18, top: H * 0.25 + r2() * 120 });
    this.vig = makeVignette(q);
    const v = this.vig; bitmapify(v, (bm) => { if (this.vig === v) this.vig = bm; });
  }

  /** Identity transform, device pixels. */
  drawBG(ctx, camX, camY) {
    const q = this.q, BW = this.BW, BWD = this.far.width;
    const fx = Math.round(-((((camX * 0.12) % BW) + BW) % BW) * q), fy = Math.round(Math.max(H - this.FH, Math.min(0, -60 - camY * 0.04)) * q);
    ctx.drawImage(this.far, fx, fy);
    if (fx + BWD < W * q) ctx.drawImage(this.far, fx + BWD, fy);
    const mo = (((camX * 0.3) % BW) + BW) % BW, my = 60 - camY * 0.1;
    ctx.strokeStyle = this.th.b(0.3); ctx.lineWidth = 1.2 * q;
    for (const p of this.pylons) for (const k of [0, BW]) {
      const x = p.x - mo + k;
      if (x < -p.w * 3 || x > W + p.w * 2) continue;
      const X = Math.round(x * q), top = Math.round(Math.max(0, p.top + my) * q), w = Math.round(p.w * q);
      ctx.fillStyle = this.th.deep; ctx.fillRect(X, top, w, H * q - top);
      ctx.strokeRect(X + 0.5, top + 0.5, w, H * q);
    }
  }
}

/* ---------- zone colours ---------- */
const mul = (hex, k) => { const [r, g, b] = rgbOf(hex).split(',').map(Number); return '#' + [r, g, b].map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join(''); };
/** A zone's theme ({neon, neon2, style}) with everything the renderers derive from it. */
export function themeOf(t = { neon: NEON, neon2: NEON2, style: 'towers' }) {
  if (t.a) return t;
  const R = rgbOf(t.neon), R2 = rgbOf(t.neon2);
  return {
    ...t, rgb: R, rgb2: R2, a: (k) => `rgba(${R},${k})`, b: (k) => `rgba(${R2},${k})`,
    rock: mul(t.neon, 0.034), rock2: mul(t.neon, 0.05), plat: mul(t.neon, 0.085), deep: mul(t.neon, 0.05), ground: mul(t.neon, 0.04),
    sky: [mul(t.neon, 0.012), mul(t.neon, 0.06), mul(t.neon, 0.094)], body: mul(t.neon, 0.045), horizon: mul(t.neon, 0.23),
    floorTop: mul(t.neon, 0.1), floorBot: mul(t.neon, 0.02), hz: (k) => `rgba(${rgbOf(mul(t.neon, 0.1))},${k})`,
    seed: [...t.neon].reduce((a, ch) => a + ch.charCodeAt(0), 0),
  };
}

/* ---------- skylines: one per zone style, drawn once into the far backdrop ---------- */
const SKYLINES = {
  // the Verdant Circuit's towers, windows lit here and there
  towers(g, BW, base, th, rand) {
    for (let x = 0; x < BW - 60;) {
      const w = 40 + rand() * 90, h = 140 + rand() * 320, y = base - h;
      g.fillStyle = th.body; g.fillRect(x, y, w, h);
      g.strokeStyle = th.a(0.22); g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, w, h + 4);
      g.fillStyle = th.a(0.16);
      for (let wy = y + 12; wy < base; wy += 14) for (let wx = x + 6; wx < x + w - 6; wx += 10) if (rand() < 0.16) g.fillRect(wx, wy, 4, 2);
      if (rand() < 0.4) { g.fillStyle = th.b(0.5); g.fillRect(x + w / 2 - 1, y - 30, 2, 30); }
      x += w + 10 + rand() * 50;
    }
  },
  // needles of glass, tall and thin
  spires(g, BW, base, th, rand) {
    for (let x = 0; x < BW;) {
      const w = 20 + rand() * 46, h = 220 + rand() * 330, m = x + w * 0.5;
      g.fillStyle = th.body; g.strokeStyle = th.a(0.26); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, base); g.lineTo(m, base - h); g.lineTo(x + w, base); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = th.a(0.12); g.beginPath(); g.moveTo(m, base - h); g.lineTo(m, base);
      for (let k = 1; k < 5; k++) { const yy = base - h * k / 5, hw = w * 0.5 * (1 - k / 5); g.moveTo(m - hw, yy); g.lineTo(m + hw, yy); }
      g.stroke();
      if (rand() < 0.5) { g.fillStyle = th.b(0.6); g.fillRect(m - 1, base - h - 24, 2, 24); }
      x += w * 0.7 + rand() * 60;
    }
  },
  // the foundry's domes and stacks
  domes(g, BW, base, th, rand) {
    for (let x = 0; x < BW;) {
      const r = 50 + rand() * 90, cx = x + r;
      if (rand() < 0.6) {
        const sw = 12 + rand() * 10, sh = r + 60 + rand() * 120;
        g.fillStyle = th.body; g.fillRect(cx + r * 0.4, base - sh, sw, sh); g.strokeStyle = th.a(0.22); g.lineWidth = 1.5; g.strokeRect(cx + r * 0.4, base - sh, sw, sh);
        g.fillStyle = th.b(0.5); g.fillRect(cx + r * 0.4, base - sh - 3, sw, 2);
      }
      g.fillStyle = th.body; g.strokeStyle = th.a(0.24); g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, base, r, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = th.a(0.12); g.beginPath();
      for (let k = 1; k < 4; k++) g.ellipse(cx, base, r * k / 4, r, 0, Math.PI, 0);
      g.stroke();
      x += r * 2 + 10 + rand() * 70;
    }
  },
  // jagged crystal shards
  shards(g, BW, base, th, rand) {
    for (let x = 0; x < BW;) {
      const w = 40 + rand() * 80, h = 120 + rand() * 300, lean = (rand() - 0.5) * 40;
      g.fillStyle = th.body; g.strokeStyle = th.a(0.3); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x + w * 0.2, base - h * 0.6); g.lineTo(x + w * 0.5 + lean, base - h); g.lineTo(x + w * 0.8, base - h * 0.5); g.lineTo(x + w, base); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = th.a(0.14); g.beginPath(); g.moveTo(x + w * 0.5 + lean, base - h); g.lineTo(x + w * 0.45, base); g.stroke();
      x += w * 0.8 + rand() * 40;
    }
  },
  // arcades and aqueducts
  arches(g, BW, base, th, rand) {
    for (let x = 0; x < BW;) {
      const n = 3 + Math.floor(rand() * 4), w = 50 + rand() * 30, h = 120 + rand() * 200, top = base - h;
      g.fillStyle = th.body; g.fillRect(x, top, n * w, h);
      g.strokeStyle = th.a(0.24); g.lineWidth = 1.5; g.strokeRect(x + 0.5, top + 0.5, n * w, h);
      g.fillStyle = th.sky[1];
      for (let k = 0; k < n; k++) {
        const ax = x + k * w + w * 0.18, aw = w * 0.64, ah = h * 0.62;
        g.beginPath(); g.moveTo(ax, base); g.lineTo(ax, base - ah + aw / 2); g.arc(ax + aw / 2, base - ah + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, base); g.closePath(); g.fill(); g.stroke();
      }
      x += n * w + 30 + rand() * 90;
    }
  },
  // girders crossing the sky
  lattice(g, BW, base, th, rand) {
    g.lineWidth = 1.5;
    for (let x = 0; x < BW;) {
      const w = 26 + rand() * 20, h = 200 + rand() * 300, top = base - h;
      g.fillStyle = th.body; g.fillRect(x, top, w, h); g.strokeStyle = th.a(0.22); g.strokeRect(x, top, w, h);
      g.strokeStyle = th.a(0.13); g.beginPath();
      for (let y = top; y < base - 26; y += 26) { g.moveTo(x, y); g.lineTo(x + w, y + 26); g.moveTo(x + w, y); g.lineTo(x, y + 26); }
      g.stroke();
      x += w + 60 + rand() * 120;
    }
    g.strokeStyle = th.a(0.1); g.beginPath();
    for (let y = base - 420; y < base - 60; y += 70 + rand() * 40) { g.moveTo(0, y); g.lineTo(BW, y + (rand() - 0.5) * 60); }
    g.stroke();
  },
  // rings hung in the sky over low blocks
  rings(g, BW, base, th, rand) {
    for (let k = 0; k < 5; k++) {
      const cx = (k + 0.5) * BW / 5 + (rand() - 0.5) * 120, cy = base - 260 - rand() * 120, r = 60 + rand() * 90;
      g.strokeStyle = th.a(0.1); g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
      g.strokeStyle = th.a(0.3); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.62, 0, 6.283); g.stroke();
    }
    for (let x = 0; x < BW;) {
      const w = 60 + rand() * 120, h = 40 + rand() * 120;
      g.fillStyle = th.body; g.fillRect(x, base - h, w, h); g.strokeStyle = th.a(0.22); g.lineWidth = 1.5; g.strokeRect(x + 0.5, base - h + 0.5, w, h);
      x += w + 20 + rand() * 60;
    }
  },
  // almost nothing: a horizon, a few far marks, a pale ring
  void(g, BW, base, th, rand) {
    g.strokeStyle = th.a(0.2); g.lineWidth = 1; g.beginPath();
    for (let x = 0; x < BW; x += 90 + rand() * 200) { const h = 20 + rand() * 90; g.moveTo(x, base); g.lineTo(x, base - h); }
    g.stroke();
    g.fillStyle = th.a(0.5);
    for (let k = 0; k < 80; k++) g.fillRect(rand() * BW, rand() * (base - 120), 1.5, 1.5);
    g.strokeStyle = th.a(0.18); g.lineWidth = 2; g.beginPath(); g.arc(BW * 0.62, base - 300, 140, 0, 6.283); g.stroke();
  },
};

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