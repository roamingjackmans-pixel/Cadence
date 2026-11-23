// Side-view skeletons, drawn as neon line figures. Units: 100 = standing height, feet at 0, facing right.
const mk = (o) => { const r = {}; for (const k in o) { const v = o[k]; if (Array.isArray(v)) { r[k + 'x'] = v[0]; r[k + 'y'] = v[1]; } else r[k] = v; } return r; };
const BASE = { hip: [0, -48], chest: [2, -74], head: [4, -90], sh: [2, -72], eF: [12, -58], hF: [20, -56], eB: [-6, -58], hB: [6, -54], kF: [8, -25], fF: [12, 0], kB: [-6, -25], fB: [-10, 0], sa: -1.05, sl: 1, sa2: -0.6 };
const P = (o) => mk({ ...BASE, ...o });

export const POSES = {
  idle: P({}),
  run1: P({ chest: [6, -73], head: [9, -89], kF: [16, -28], fF: [24, -6], kB: [-8, -22], fB: [-20, -4], eB: [-12, -60], hB: [-6, -52] }),
  run2: P({ chest: [6, -73], head: [9, -89], kF: [4, -26], fF: [-6, 0], kB: [10, -30], fB: [6, -10], eF: [16, -60], hF: [26, -58] }),
  jump: P({ hip: [0, -52], chest: [2, -78], head: [4, -94], sh: [2, -76], kF: [14, -36], fF: [8, -16], kB: [-2, -32], fB: [-12, -16], eF: [14, -66], hF: [22, -70], eB: [-10, -66], hB: [-4, -72], sa: -1.3 }),
  fall: P({ hip: [0, -50], kF: [12, -30], fF: [14, -8], kB: [-6, -28], fB: [-14, -6], eB: [-14, -68], hB: [-18, -78], sa: -0.7 }),
  // a ninja crouch: folded low over the front knee, back leg stretched out behind, a hand on the floor,
  // the blade trailing back
  duck: P({ hip: [-6, -16], chest: [12, -30], head: [26, -34], sh: [12, -28], eF: [26, -20], hF: [34, -14], eB: [16, -14], hB: [20, -2], kF: [14, -12], fF: [20, 0], kB: [-24, -6], fB: [-44, 0], sa: -3.0 }),
  // a bullet-time lean: feet planted, knees forward, the body arched back under the strike
  dodge: P({ hip: [8, -36], chest: [-16, -45], head: [-33, -46], sh: [-16, -43], eF: [-10, -59], hF: [-3, -68], eB: [-29, -35], hB: [-41, -29], kF: [24, -20], fF: [19, 0], kB: [18, -16], fB: [0, 0], sa: -2.15 }),
  // blocks, one for each strike
  blockSlash: P({ eF: [16, -66], hF: [20, -72], eB: [4, -66], hB: [14, -70], sa: -1.62, sl: 1, kF: [10, -24], fF: [16, 0], kB: [-8, -24], fB: [-14, 0] }),
  blockSweep: P({ hip: [-2, -42], chest: [4, -68], head: [7, -84], sh: [4, -66], eF: [16, -50], hF: [22, -44], eB: [6, -50], hB: [16, -44], sa: 1.62, sl: 1, kF: [12, -22], fF: [18, 0], kB: [-10, -20], fB: [-16, 0] }),
  blockSlam: P({ eF: [14, -86], hF: [10, -102], eB: [-6, -86], hB: [-4, -100], sa: 0.12, sl: 1, kF: [10, -24], fF: [16, 0], kB: [-8, -24], fB: [-14, 0] }),
  attackW: P({ chest: [-2, -74], head: [-2, -90], eF: [-6, -84], hF: [-12, -96], eB: [-14, -66], hB: [-8, -78], sa: -2.5, kF: [10, -24], fF: [18, 0], kB: [-8, -24], fB: [-16, 0] }),
  attack: P({ hip: [6, -46], chest: [14, -71], head: [18, -86], sh: [14, -70], eF: [28, -66], hF: [40, -62], eB: [2, -60], hB: [10, -56], sa: 0.28, sl: 1.05, kF: [20, -24], fF: [30, 0], kB: [-8, -22], fB: [-20, 0], sa2: 0.5 }),
  attack2: P({ hip: [6, -46], chest: [14, -71], head: [18, -86], sh: [14, -70], eF: [26, -78], hF: [36, -88], eB: [24, -60], hB: [38, -58], sa: -0.4, sl: 1.05, kF: [20, -24], fF: [30, 0], kB: [-8, -22], fB: [-20, 0], sa2: 0.1 }),
  lethal: P({ hip: [12, -38], chest: [24, -60], head: [30, -74], sh: [24, -58], eF: [40, -52], hF: [56, -50], eB: [12, -46], hB: [30, -50], sa: 0.05, sl: 1.15, kF: [30, -18], fF: [40, 0], kB: [-14, -14], fB: [-30, 0] }),
  hurt: P({ chest: [-8, -72], head: [-12, -86], sh: [-8, -70], eF: [6, -60], hF: [10, -48], eB: [-20, -60], hB: [-24, -50], sa: 0.9 }),
  stun: P({ hip: [0, -34], chest: [4, -56], head: [10, -68], sh: [4, -54], eF: [10, -36], hF: [14, -22], eB: [-4, -36], hB: [0, -24], kF: [14, -18], fF: [18, 0], kB: [-8, -6], fB: [-22, 0], sa: 1.3 }),
  heal: P({ eB: [8, -70], hB: [8, -84], head: [4, -88], sa: -1.3 }),
  rest: P({ hip: [0, -30], chest: [4, -54], head: [8, -70], sh: [4, -52], eF: [14, -40], hF: [18, -28], kF: [16, -16], fF: [20, 0], kB: [-4, -4], fB: [-20, 0], sa: -1.57, sl: 1 }),
  dead: P({ hip: [0, -8], chest: [-24, -10], head: [-40, -10], sh: [-22, -12], eF: [-30, -4], hF: [-38, 0], eB: [-10, -4], hB: [-2, 0], kF: [16, -8], fF: [32, 0], kB: [14, -4], fB: [30, -2], sa: 0, sl: 1 }),
  // enemy strikes: W = wind-up, S = strike
  slashW: P({ chest: [-4, -74], head: [-4, -90], eF: [-12, -70], hF: [-24, -72], eB: [-16, -62], hB: [-20, -66], sa: 3.0, kF: [12, -24], fF: [18, 0], kB: [-10, -24], fB: [-18, 0] }),
  slashS: P({ hip: [6, -48], chest: [14, -73], head: [16, -89], sh: [14, -72], eF: [30, -70], hF: [42, -70], eB: [4, -62], hB: [14, -64], sa: 0.02, sl: 1.1, kF: [20, -24], fF: [30, 0], kB: [-10, -24], fB: [-20, 0] }),
  sweepW: P({ hip: [-4, -38], chest: [-8, -62], head: [-8, -78], sh: [-8, -60], eF: [-16, -40], hF: [-26, -28], eB: [-18, -46], hB: [-24, -34], sa: 2.9, kF: [10, -22], fF: [18, 0], kB: [-16, -18], fB: [-22, 0] }),
  sweepS: P({ hip: [8, -36], chest: [18, -58], head: [22, -72], sh: [18, -56], eF: [30, -34], hF: [42, -18], eB: [10, -36], hB: [22, -24], sa: 0.12, sl: 1.1, kF: [22, -20], fF: [30, 0], kB: [-12, -14], fB: [-24, 0] }),
  slamW: P({ hip: [-2, -50], chest: [-4, -78], head: [-4, -94], sh: [-4, -76], eF: [-2, -98], hF: [-6, -116], eB: [-10, -96], hB: [-8, -114], sa: -2.2, kF: [10, -26], fF: [16, 0], kB: [-8, -24], fB: [-16, 0] }),
  slamS: P({ hip: [8, -34], chest: [18, -56], head: [24, -70], sh: [18, -54], eF: [30, -40], hF: [38, -30], eB: [24, -40], hB: [34, -32], sa: 1.2, sl: 1.1, kF: [24, -18], fF: [30, 0], kB: [-10, -12], fB: [-22, 0] }),
  open: P({ hip: [2, -44], chest: [10, -66], head: [16, -78], sh: [10, -64], eF: [16, -46], hF: [20, -30], eB: [4, -48], hB: [8, -34], sa: 1.35, kF: [12, -22], fF: [18, 0], kB: [-8, -22], fB: [-16, 0] }),
  broken: P({ hip: [0, -30], chest: [6, -52], head: [12, -64], sh: [6, -50], eF: [12, -32], hF: [14, -16], eB: [0, -34], hB: [2, -18], kF: [14, -18], fF: [18, 0], kB: [-8, -4], fB: [-24, 0], sa: 1.5 }),
};

/** A block held from another stance (the duck): the body stays put, the arms and blade come up from its shoulders. */
const ARMS = ['eFx', 'eFy', 'hFx', 'hFy', 'eBx', 'eBy', 'hBx', 'hBy'];
export function withGuard(base, g) {
  const r = { ...base }, dx = base.shx - g.shx, dy = base.shy - g.shy;
  for (const k of ARMS) r[k] = g[k] + (k.endsWith('x') ? dx : dy);
  r.sa = g.sa; r.sl = g.sl; r.sa2 = g.sa2;
  return r;
}
// blocks from the crouch; a low guard holds the blade flat instead of down into the floor
POSES.duckBlockSlash = withGuard(POSES.duck, POSES.blockSlash);
POSES.duckBlockSlam = withGuard(POSES.duck, POSES.blockSlam);
POSES.duckBlockSweep = { ...withGuard(POSES.duck, POSES.blockSweep), eFx: 26, eFy: -20, hFx: 36, hFy: -14, sa: 0.05 };

export function lerpPose(cur, tgt, k) { for (const key in tgt) { const d = tgt[key] - cur[key]; cur[key] += (key === 'sa' || key === 'sa2' ? Math.atan2(Math.sin(d), Math.cos(d)) : d) * k; } }
export function copyPose(p) { return { ...p }; }

const LIMBS = [['hip', 'kB', 'fB'], ['hip', 'kF', 'fF'], ['sh', 'eB', 'hB'], ['sh', 'eF', 'hF']];

/**
 * Draws a figure. o: {pose, x, y (feet), s (pixels per unit), face, color, rgb, alpha, blade, bladeRGB, bladeGlow,
 * weapon: {len, width, twin, curved, hammer, claw}, hot (0..1 extra glow), body}
 */
export function drawFigure(ctx, o) {
  const p = o.pose, s = o.s, f = o.face, X = o.x, Y = o.y;
  const jx = (k) => X + p[k + 'x'] * s * f, jy = (k) => Y + p[k + 'y'] * s;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // blade geometry
  const wp = o.weapon, hx = jx('hF'), hy = jy('hF');
  const sa = f > 0 ? p.sa : Math.PI - p.sa, L = wp.len * p.sl * s;
  const tx = hx + Math.cos(sa) * L, ty = hy + Math.sin(sa) * L;
  const bx = hx - Math.cos(sa) * 9 * s, by = hy - Math.sin(sa) * 9 * s;
  let t2 = null;
  if (wp.twin || wp.claw) {
    const sa2 = f > 0 ? p.sa2 : Math.PI - p.sa2, L2 = (wp.claw ? wp.len : wp.len * 0.9) * s, h2x = jx('hB'), h2y = jy('hB');
    t2 = [h2x, h2y, h2x + Math.cos(sa2) * L2, h2y + Math.sin(sa2) * L2];
  }
  const limbPath = () => {
    ctx.beginPath();
    for (const [a, b, c] of LIMBS) { ctx.moveTo(jx(a), jy(a)); ctx.lineTo(jx(b), jy(b)); ctx.lineTo(jx(c), jy(c)); }
    ctx.moveTo(jx('hip'), jy('hip')); ctx.lineTo(jx('chest'), jy('chest')); ctx.lineTo(jx('sh'), jy('sh'));
  };
  const hr = 8 * s, hxh = jx('head'), hyh = jy('head');
  const body = o.body || 7;
  // 1. glow
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${o.rgb},${0.16 + 0.25 * (o.hot || 0)})`; ctx.lineWidth = (body + 9) * s;
  limbPath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(hxh, hyh, hr + 5 * s, 0, 6.283); ctx.fillStyle = `rgba(${o.rgb},${0.12 + 0.2 * (o.hot || 0)})`; ctx.fill();
  // 2. dark body
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#020a07'; ctx.lineWidth = body * s; limbPath(); ctx.stroke();
  // torso plate
  ctx.lineWidth = (body + 5) * s; ctx.beginPath(); ctx.moveTo(jx('hip'), jy('hip')); ctx.lineTo(jx('chest'), jy('chest')); ctx.stroke();
  ctx.fillStyle = '#020a07'; ctx.beginPath(); ctx.arc(hxh, hyh, hr, 0, 6.283); ctx.fill();
  // 3. neon circuit lines
  ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(1.2, 1.5 * s);
  limbPath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(hxh, hyh, hr, 0, 6.283); ctx.stroke();
  // visor
  ctx.lineWidth = Math.max(1.5, 2.2 * s); ctx.beginPath(); ctx.moveTo(hxh + 1 * s * f, hyh - 1 * s); ctx.lineTo(hxh + 7 * s * f, hyh - 1 * s); ctx.stroke();
  // chest line
  ctx.beginPath(); ctx.moveTo(jx('chest') - 4 * s * f, jy('chest') + 2 * s); ctx.lineTo(jx('chest') + 5 * s * f, jy('chest') + 2 * s); ctx.stroke();
  // 4. blade
  const bc = o.blade || '#e9fffb', brgb = o.bladeRGB || '233,255,251', bg = o.bladeGlow || 0.25;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${brgb},${bg})`; ctx.lineWidth = (wp.width + 10) * s;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); if (t2) { ctx.moveTo(t2[0], t2[1]); ctx.lineTo(t2[2], t2[3]); } ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = bc; ctx.lineWidth = wp.width * s;
  ctx.beginPath();
  if (wp.curved) { const mx = (hx + tx) / 2 - Math.sin(sa) * 6 * s, my = (hy + ty) / 2 + Math.cos(sa) * 6 * s * -1; ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx, my, tx, ty); }
  else { ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); }
  if (t2) { ctx.moveTo(t2[0], t2[1]); ctx.lineTo(t2[2], t2[3]); }
  ctx.stroke();
  if (wp.hammer) {
    // hammer head at the tip
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(sa);
    ctx.fillStyle = '#020a07'; ctx.fillRect(-10 * s, -14 * s, 20 * s, 28 * s);
    ctx.strokeStyle = bc; ctx.lineWidth = 2; ctx.strokeRect(-10 * s, -14 * s, 20 * s, 28 * s);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + (tx - hx) * 0.8, hy + (ty - hy) * 0.8); ctx.stroke();
  // hilt
  ctx.strokeStyle = o.color; ctx.lineWidth = 2.5 * s;
  const gx = -Math.sin(sa) * 5 * s, gy = Math.cos(sa) * 5 * s;
  ctx.beginPath(); ctx.moveTo(hx + gx, hy + gy); ctx.lineTo(hx - gx, hy - gy); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.restore();
  return { tx, ty, hx, hy, head: { x: hxh, y: hyh } };
}
