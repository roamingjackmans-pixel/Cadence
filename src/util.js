// Small shared helpers.
export const W = 1280, H = 720;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[(Math.random() * a.length) | 0];
export const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const sign = (v) => (v < 0 ? -1 : 1);

/** Removes items for which keep() is false, in place, without allocating. */
export function prune(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (keep(v)) arr[j++] = v; }
  arr.length = j;
  return arr;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')];
}

/** Hex colour to "r,g,b" for rgba() strings. */
export function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Turns a finished cache canvas into an ImageBitmap. Drawing a canvas makes Chrome snapshot it every time, which
 * costs a full copy per frame for a big backdrop; an ImageBitmap is immutable and draws straight away.
 * Calls done(bitmap) when ready; until then the canvas itself is used.
 */
export function bitmapify(canvas, done) {
  if (typeof createImageBitmap !== 'function') return;
  createImageBitmap(canvas).then((bm) => { for (const k of ['q']) if (canvas[k] !== undefined) bm[k] = canvas[k]; done(bm); }, () => {});
}