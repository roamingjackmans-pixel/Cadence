// Particles and flashes. A fixed pool, no per-frame allocation, glows drawn from cached sprites (no shadowBlur).
import { rnd, makeCanvas, rgbOf, bitmapify } from './util.js';

const sprites = new Map();
/** A soft round glow of `color`, 64px, cached. */
export function glowSprite(color) {
  let c = sprites.get(color);
  if (c) return c;
  const [cv, g] = makeCanvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const rgb = rgbOf(color);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  sprites.set(color, cv);
  bitmapify(cv, (bm) => sprites.set(color, bm));
  return cv;
}

export class FX {
  constructor(cap = 600) {
    this.cap = cap; this.parts = []; this.free = [];
    for (let i = 0; i < cap; i++) this.free.push({});
    this.fx = [];      // rings, flares, cuts, floats: few, short-lived
    this.t = 0;
  }
  get count() { return this.parts.length; }
  _p() { return this.free.length ? this.free.pop() : null; }
  /** k: 's' streak spark, 'm' glowing mote, 'h' shard. */
  emit(k, x, y, vx, vy, life, color, size, grav = 0) {
    const p = this._p(); if (!p) return;
    p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.age = 0; p.c = color; p.s = size; p.g = grav; p.r = rnd(0, 6); p.vr = rnd(-12, 12);
    this.parts.push(p);
  }
  sparks(x, y, n, color, speed = 600) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(0.25, 1) * speed; this.emit('s', x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.12, rnd(0.15, 0.42), color, rnd(1.4, 3), 900); }
  }
  motes(x, y, n, color, speed = 160, up = 90) {
    for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(0.2, 1) * speed; this.emit('m', x, y, Math.cos(a) * s, Math.sin(a) * s - up, rnd(0.5, 1.2), color, rnd(5, 11), -40); }
  }
  shards(x, y, n, color, speed = 420, spreadY = 30) {
    for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0), s = rnd(0.3, 1) * speed; this.emit('h', x + rnd(-8, 8), y + rnd(-spreadY, spreadY), Math.cos(a) * s, Math.sin(a) * s, rnd(0.5, 1.1), color, rnd(3, 7), 1100); }
  }
  ring(x, y, color, r = 90, dur = 0.3, w = 5) { this.fx.push({ k: 'ring', x, y, c: color, r, dur, w, t0: this.t }); }
  flare(x, y, color, len = 300, dur = 0.22) { this.fx.push({ k: 'flare', x, y, c: color, rgb: rgbOf(color), len, dur, t0: this.t }); }
  cut(x, y, ang, len, color, dur = 0.28, w = 8) { this.fx.push({ k: 'cut', x, y, ang, len, c: color, dur, w, t0: this.t }); }
  arc(x, y, r, a0, a1, color, dur = 0.2, w = 14) { this.fx.push({ k: 'arc', x, y, r, a0, a1, c: color, dur, w, t0: this.t }); }
  float(s, x, y, color, size = 18, dur = 0.75) { this.fx.push({ k: 'text', s, x, y, c: color, size, dur, t0: this.t }); }
  clear() { for (const p of this.parts) this.free.push(p); this.parts.length = 0; this.fx.length = 0; }

  update(dt) {
    this.t += dt;
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); this.free.push(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - 2 * dt; p.r += p.vr * dt;
    }
    let j = 0;
    for (const f of this.fx) if (this.t - f.t0 < f.dur) this.fx[j++] = f;
    this.fx.length = j;
  }

  /** Draws in the current transform. text(): the scene's text drawer for floats. */
  draw(ctx, text) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.parts) {
      const a = 1 - p.age / p.life;
      if (p.k === 's') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.s;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.k === 'm') {
        ctx.globalAlpha = a * 0.9; const s = p.s * (0.6 + 0.4 * a);
        ctx.drawImage(glowSprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.c; const s = p.s, c = Math.cos(p.r), sn = Math.sin(p.r);
        ctx.beginPath(); ctx.moveTo(p.x + c * s, p.y + sn * s); ctx.lineTo(p.x - sn * s * 0.5, p.y + c * s * 0.5); ctx.lineTo(p.x - c * s * 0.7, p.y - sn * s * 0.7); ctx.closePath(); ctx.fill();
      }
    }
    for (const f of this.fx) {
      const k = (this.t - f.t0) / f.dur, e = 1 - k;
      if (k < 0) continue;
      if (f.k === 'ring') {
        ctx.globalAlpha = e; ctx.strokeStyle = f.c; ctx.lineWidth = f.w * e + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, 8 + k * f.r, 0, 6.283); ctx.stroke();
      } else if (f.k === 'flare') {
        const l = f.len * (0.4 + 0.6 * Math.min(1, k * 4));
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(${f.rgb},${0.35 * e})`; ctx.fillRect(f.x - l, f.y - 4 * e - 1, l * 2, 8 * e + 2);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * e})`; ctx.fillRect(f.x - l * 0.4, f.y - 1, l * 0.8, 2);
        ctx.fillStyle = `rgba(${f.rgb},${0.3 * e})`; ctx.fillRect(f.x - 2, f.y - l * 0.22, 4, l * 0.44);
        const s = 50 * e + 10; ctx.globalAlpha = e; ctx.drawImage(glowSprite('#ffffff'), f.x - s, f.y - s, s * 2, s * 2);
      } else if (f.k === 'cut') {
        const l = f.len * Math.min(1, k * 3.5), dx = Math.cos(f.ang), dy = Math.sin(f.ang);
        ctx.globalAlpha = e; ctx.strokeStyle = f.c; ctx.lineWidth = f.w * e + 1;
        ctx.beginPath(); ctx.moveTo(f.x - dx * l / 2, f.y - dy * l / 2); ctx.lineTo(f.x + dx * l / 2, f.y + dy * l / 2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(f.x - dx * l / 2, f.y - dy * l / 2); ctx.lineTo(f.x + dx * l / 2, f.y + dy * l / 2); ctx.stroke();
      } else if (f.k === 'arc') {
        const sw = Math.min(1, k * 4), a1 = f.a0 + (f.a1 - f.a0) * sw;
        ctx.globalAlpha = 0.55 * e; ctx.strokeStyle = f.c; ctx.lineWidth = f.w * e + 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, Math.min(f.a0, a1), Math.max(f.a0, a1)); ctx.stroke();
        ctx.globalAlpha = e; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, Math.min(f.a0, a1), Math.max(f.a0, a1)); ctx.stroke();
      }
    }
    ctx.restore();
    if (text) for (const f of this.fx) if (f.k === 'text') {
      const k = (this.t - f.t0) / f.dur;
      ctx.globalAlpha = 1 - k * k;
      text(f.s, f.x, f.y - k * 36, f.size, f.c);
      ctx.globalAlpha = 1;
    }
  }
}
