// Text and bars shared by both views. No strokeText or shadows: a dark offset copy reads well and costs little.
const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
const fonts = new Map();
const fontOf = (size, weight) => { const k = size * 10 + weight; let f = fonts.get(k); if (!f) { f = `${weight} ${Math.round(size)}px ${FONT}`; fonts.set(k, f); } return f; };

export function txt(ctx, s, x, y, size, color, align = 'center', weight = 700) {
  // allow txt(s, x, y, ...) when bound
  ctx.font = fontOf(size, weight); ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillText(s, x + 1.5, y + 1.5);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
export function bar(ctx, x, y, w, h, frac, color, bg) {
  frac = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, y, w * frac, 1);
}
