// The duel with the Twin Dancer, seen from behind you: the prototype's view, restyled and without the music chart.
import { W, H, clamp, rnd, pick, smooth, wrapA, makeCanvas, bitmapify } from './util.js';
import { ATTACKS, WEAPONS, BASE_WIN, JUMP_AIR, ACT_NAME, maxHP, swordDmg, powerDmg, COMBO_REST, fightWords } from './data.js';
import { Conductor } from './combat.js';
import { FX, glowSprite } from './fx.js';
import { input, btn } from './input.js';
import { sfx, setIntensity } from './audio.js';
import { txt as txtC, bar } from './hud.js';
import { makeVignette, drawVignette, themeOf } from './render2d.js';

let CTX = null;
const txt = (s, x, y, size, c, align, weight) => txtC(CTX, s, x, y, size, c, align, weight);

const HORIZON = 300, VPX = 640;
const PX = 560, PY = 700, PS = 1.42;
const BXc = 720, BY = 452, BS = 1.12;
const DUR = { block: 0.26, duck: 0.34, jump: JUMP_AIR, side: 0.36 };
const PLAYER_C = '#5ff3ff', PLAYER_RGB = '95,243,255';
const CP = { slash: { x: PX - 10, y: PY - 300 }, sweep: { x: PX - 40, y: PY - 20 }, slam: { x: PX + 10, y: PY - 330 } };

/* skeletons in screen units (~190 tall, feet at 0) */
const mk = (o) => { const r = {}; for (const k in o) { const v = o[k]; if (Array.isArray(v)) { r[k + 'x'] = v[0]; r[k + 'y'] = v[1]; } else r[k] = v; } return r; };
const PBASE = { hip: [0, -92], chest: [0, -140], head: [0, -178], lS: [-26, -150], rS: [26, -150], lE: [-32, -116], rE: [34, -116], lH: [6, -102], rH: [16, -104], lK: [-22, -48], rK: [22, -48], lF: [-30, 0], rF: [30, 0], sa: -1.15, sl: 0.85 };
const PV = (o) => mk({ ...PBASE, ...o });
const PP = {
  idle: PV({}),
  blockSlam: PV({ hip: [0, -86], chest: [0, -136], head: [0, -172], lS: [-26, -146], rS: [26, -146], lE: [-44, -172], rE: [44, -172], lH: [-26, -204], rH: [30, -206], lK: [-28, -44], rK: [28, -44], lF: [-36, 0], rF: [36, 0], sa: Math.PI + 0.08, sl: 1 }),
  blockSlash: PV({ lE: [-36, -118], rE: [40, -112], lH: [-2, -130], rH: [10, -126], sa: -2.3, sl: 1 }),
  blockSweep: PV({ hip: [0, -80], chest: [0, -128], head: [0, -164], lS: [-26, -138], rS: [26, -138], lE: [-30, -104], rE: [38, -100], lH: [10, -92], rH: [22, -90], lK: [-28, -40], rK: [28, -40], lF: [-36, 0], rF: [36, 0], sa: 2.35, sl: 1 }),
  // a ninja crouch: one knee nearly down, a hand on the floor
  duck: PV({ hip: [0, -26], chest: [4, -54], head: [8, -78], lS: [-22, -60], rS: [30, -60], lE: [-34, -36], rE: [44, -42], lH: [-30, -8], rH: [26, -44], lK: [-50, -14], rK: [42, -28], lF: [-62, 0], rF: [34, 0], sa: -0.35, sl: 0.8 }),
  // the leap: a little rise, the legs thrown out into the splits, the blade up
  jump: PV({ hip: [0, -98], chest: [0, -146], head: [0, -182], lS: [-26, -156], rS: [26, -156], lE: [-48, -168], rE: [42, -178], lH: [-72, -186], rH: [34, -206], lK: [-56, -92], rK: [56, -92], lF: [-102, -86], rF: [102, -86], sa: -1.4, sl: 0.9 }),
  sideR: PV({ hip: [0, -88], chest: [14, -136], head: [22, -172], lS: [-12, -146], rS: [38, -144], lE: [-24, -112], rE: [48, -110], lH: [6, -100], rH: [18, -102], lK: [-30, -44], rK: [30, -48], lF: [-50, -4], rF: [40, 0], sa: -0.9, sl: 0.8 }),
  attack: PV({ hip: [0, -90], chest: [-4, -142], head: [-4, -180], lS: [-30, -152], rS: [22, -152], lE: [-40, -176], rE: [10, -180], lH: [-36, -196], rH: [-26, -198], lF: [-36, 0], rF: [26, -4], sa: -2.5, sl: 1 }),
  attackW: PV({ chest: [6, -140], head: [4, -178], lS: [-22, -150], rS: [30, -150], lE: [0, -168], rE: [50, -172], lH: [24, -192], rH: [34, -196], lF: [-34, 0], rF: [34, 0], sa: -0.35, sl: 1 }),
  hurt: PV({ chest: [0, -144], head: [0, -184], lE: [-48, -128], rE: [50, -128], lH: [-60, -104], rH: [62, -100], lK: [-24, -46], rK: [26, -48], sa: -0.25, sl: 0.9 }),
  stun: PV({ hip: [0, -56], chest: [6, -100], head: [10, -132], lS: [-20, -108], rS: [32, -108], lE: [-14, -70], rE: [40, -70], lH: [18, -44], rH: [30, -40], lK: [-32, -28], rK: [30, -8], lF: [-34, 0], rF: [44, 0], sa: 0.8, sl: 0.9 }),
  heal: PV({ lE: [-20, -150], lH: [-4, -172], sa: -1.3 }),
};
PP.sideL = (() => { const r = {}; for (const k in PP.sideR) r[k] = k.endsWith('x') ? -PP.sideR[k] : PP.sideR[k]; r.sa = Math.PI - PP.sideR.sa; return r; })();

const BBASE = { hip: [0, -96], chest: [0, -152], head: [0, -194], lS: [-36, -162], rS: [36, -162], lE: [-42, -124], rE: [42, -122], lH: [-6, -110], rH: [6, -106], lK: [-26, -50], rK: [26, -50], lF: [-34, 0], rF: [34, 0], sa: -2.15, sl: 0.95 };
const BV = (o) => mk({ ...BBASE, ...o });
const BP = {
  idle: BV({}),
  slashW: BV({ chest: [8, -152], head: [6, -192], lE: [14, -186], rE: [64, -176], lH: [40, -206], rH: [50, -208], sa: -0.2, sl: 0.95 }),
  slashS: BV({ hip: [0, -92], chest: [-8, -150], head: [-8, -190], lE: [-48, -152], rE: [-36, -142], lH: [-76, -150], rH: [-64, -152], lK: [-38, -48], lF: [-48, 0], rF: [42, 0], sa: Math.PI + 0.05, sl: 1.05 }),
  sweepW: BV({ hip: [0, -84], chest: [10, -138], head: [10, -176], lS: [-26, -148], rS: [44, -146], lE: [30, -112], rE: [56, -110], lH: [44, -80], rH: [52, -76], lK: [-32, -44], rK: [32, -44], lF: [-42, 0], rF: [42, 0], sa: 0.3, sl: 1 }),
  sweepS: BV({ hip: [0, -70], chest: [-10, -122], head: [-12, -160], lS: [-46, -132], rS: [24, -132], lE: [-50, -96], rE: [-20, -92], lH: [-66, -54], rH: [-56, -50], lK: [-42, -34], rK: [38, -36], lF: [-54, 0], rF: [50, 0], sa: Math.PI - 0.1, sl: 1.05 }),
  slamW: BV({ chest: [-4, -150], head: [-4, -190], lE: [-26, -186], rE: [30, -184], lH: [-6, -206], rH: [4, -208], lK: [-34, -44], rK: [34, -44], lF: [-46, 0], rF: [46, 0], hip: [0, -84], sa: -2.25, sl: 0.62 }),
  slamS: BV({ hip: [0, -70], chest: [0, -120], head: [0, -156], lS: [-36, -130], rS: [36, -130], lE: [-36, -100], rE: [36, -100], lH: [-6, -86], rH: [4, -84], lK: [-40, -36], rK: [40, -36], lF: [-52, 0], rF: [52, 0], sa: Math.PI / 2, sl: 0.55 }),
  open: BV({ hip: [6, -88], chest: [20, -138], head: [28, -172], lS: [-12, -148], rS: [52, -144], lE: [30, -108], rE: [60, -106], lH: [44, -80], rH: [52, -74], lK: [-22, -46], rK: [34, -40], lF: [-30, 0], rF: [48, 0], sa: 0.95, sl: 1 }),
  hurt: BV({ chest: [0, -150], head: [0, -196], lE: [-56, -140], rE: [56, -140], lH: [-70, -120], rH: [64, -118], sa: -0.4, sl: 0.9 }),
  broken: BV({ hip: [0, -72], chest: [0, -126], head: [0, -162], lS: [-34, -136], rS: [34, -136], lE: [-40, -100], rE: [-10, -96], lH: [-30, -78], rH: [-24, -76], lK: [-36, -36], rK: [30, -12], lF: [-40, 0], rF: [42, 0], sa: Math.PI / 2, sl: 0.5 }),
  knocked: BV({ hip: [4, -92], chest: [8, -150], head: [12, -184], lS: [-32, -158], rS: [44, -160], lE: [-66, -182], rE: [70, -186], lH: [-84, -206], rH: [86, -214], lK: [-30, -50], rK: [36, -44], lF: [-48, 0], rF: [56, -10], sa: -0.75, sl: 0.95 }),
  flourish: BV({ lE: [-60, -170], rE: [60, -170], lH: [-90, -200], rH: [90, -200], sa: -0.6, sl: 1 }),
};
const BOFF = { knocked: [26, -46, 0.84], idle: [0, 0, 1], slashW: [10, 0, 1], slashS: [-30, 30, 1.12], sweepW: [10, 0, 1], sweepS: [-20, 34, 1.12], slamW: [-30, 6, 1.04], slamS: [-120, 100, 1.32], open: [-40, 40, 1.1], hurt: [0, -6, 1], broken: [-60, 4, 1.04], flourish: [0, 0, 1.02] };
const mirrorPose = (p) => { const r = {}; for (const k in p) r[k] = k.endsWith('x') ? -p[k] : p[k]; r.sa = Math.PI - p.sa; return r; };
for (const k of ['slashW', 'slashS', 'sweepW', 'sweepS']) { BP[k + 'L'] = mirrorPose(BP[k]); const o = BOFF[k]; BOFF[k + 'L'] = [-o[0], o[1], o[2]]; }
const SIDED = { slash: true, sweep: true };
const sfxOf = (n) => (SIDED[n.type] && n.side < 0 ? 'L' : '');
const pk = (n, ph) => n.type + ph + sfxOf(n);

function bladeAt(k) {
  const p = BP[k], o = BOFF[k], sc = BS * o[2], x = BXc + o[0], y = BY + o[1];
  const g = { x: x + p.rHx * sc, y: y + p.rHy * sc }, L = 150 * p.sl * sc;
  return { g, t: { x: g.x + Math.cos(p.sa) * L, y: g.y + Math.sin(p.sa) * L } };
}
const BLADES = {};
for (const k of ['slash', 'slashL', 'sweep', 'sweepL', 'slam']) { const ty = k.replace('L', ''), su = k.endsWith('L') ? 'L' : ''; BLADES[k] = { w: bladeAt(ty + 'W' + su), s: bladeAt(ty + 'S' + su) }; }

/** Front or back view figure, neon on dark. */
function drawRig(ctx, o) {
  const p = o.pose, s = o.s;
  const J = (k) => ({ x: o.x + p[k + 'x'] * s, y: o.y + p[k + 'y'] * s });
  const hip = J('hip'), chest = J('chest'), head = J('head'), lS = J('lS'), rS = J('rS'), lE = J('lE'), rE = J('rE'), lH = J('lH'), rH = J('rH'), lK = J('lK'), rK = J('rK'), lF = J('lF'), rF = J('rF');
  const lHip = { x: hip.x - 13 * s, y: hip.y }, rHip = { x: hip.x + 13 * s, y: hip.y };
  const sdx = Math.cos(p.sa), sdy = Math.sin(p.sa), L = o.sword * p.sl * s;
  const tip = { x: rH.x + sdx * L, y: rH.y + sdy * L };
  const sa2 = p.sa2 ?? Math.PI - p.sa, L2 = p.sl2 !== undefined ? o.sword * p.sl2 * s : L * 0.92;
  const tip2 = o.twin ? { x: lH.x + Math.cos(sa2) * L2, y: lH.y + Math.sin(sa2) * L2 } : null;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const limbs = () => { ctx.beginPath(); for (const ch of [[lHip, lK, lF], [rHip, rK, rF], [lS, lE, lH], [rS, rE, rH]]) { ctx.moveTo(ch[0].x, ch[0].y); ctx.lineTo(ch[1].x, ch[1].y); ctx.lineTo(ch[2].x, ch[2].y); } };
  const torso = () => { ctx.beginPath(); ctx.moveTo(lHip.x, lHip.y); ctx.lineTo(rHip.x, rHip.y); ctx.lineTo(rS.x, rS.y); ctx.lineTo(lS.x, lS.y); ctx.closePath(); };
  const hr = o.headR * s;
  if (!o.tint) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${o.rgb},${0.14 + 0.3 * (o.hot || 0)})`; ctx.lineWidth = 24 * s; limbs(); ctx.stroke(); torso(); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#020a07'; ctx.lineWidth = 12 * s; limbs(); ctx.stroke();
    ctx.fillStyle = '#020a07'; torso(); ctx.fill(); ctx.lineWidth = 6 * s; ctx.stroke();
    ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, 6.283); ctx.fill();
  }
  ctx.strokeStyle = o.tint || o.color; ctx.lineWidth = Math.max(1.5, 2 * s);
  limbs(); ctx.stroke(); torso(); ctx.stroke();
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, 6.283); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(chest.x, chest.y - 4 * s); ctx.lineTo(hip.x, hip.y - 6 * s); ctx.stroke();
  if (o.view === 'front') { ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(head.x - 8 * s, head.y); ctx.lineTo(head.x + 8 * s, head.y); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(lS.x, lS.y + 10 * s); ctx.lineTo(rS.x, rS.y + 10 * s); ctx.stroke(); }
  // blades
  const bc = o.blade || '#eafffb', brgb = o.bladeRGB || '234,255,251';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${brgb},${o.bladeGlow ?? 0.3})`; ctx.lineWidth = (o.bladeW + 12) * s;
  ctx.beginPath(); ctx.moveTo(rH.x, rH.y); ctx.lineTo(tip.x, tip.y); if (tip2) { ctx.moveTo(lH.x, lH.y); ctx.lineTo(tip2.x, tip2.y); } ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = o.tint || bc; ctx.lineWidth = o.bladeW * s;
  ctx.beginPath(); ctx.moveTo(rH.x, rH.y); ctx.lineTo(tip.x, tip.y); if (tip2) { ctx.moveTo(lH.x, lH.y); ctx.lineTo(tip2.x, tip2.y); } ctx.stroke();
  if (!o.tint) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(rH.x, rH.y); ctx.lineTo(rH.x + sdx * L * 0.75, rH.y + sdy * L * 0.75); ctx.stroke(); }
  ctx.restore();
  return { tip, rH, head };
}

export class BossFight {
  /** zone: the zone whose warden this is (its boss table and its colours). */
  constructor(game, hp, snap, zone) {
    this.g = game; this.zone = zone; this.B = zone.boss; this.th = themeOf(zone.theme);
    const s = game.save;
    this.w = WEAPONS[s.equipped];
    this.cond = new Conductor();
    this.fx = new FX(700);
    this.t = 0; this.mode = 'intro'; this.phase = 0; this.hitstop = 0; this.shake = 0; this.flash = null; this.zoom = null;
    this.bossHP = this.B.hp; this.bossShow = this.B.hp; this.bossPost = 0; this.lastPost = -9; this.nextPlan = 0; this.openings = []; this.knock = null;
    this.brokenAt = 0; this.alt = 1;
    this.pHP = hp; this.pShow = hp; this.pPost = 0;
    this.player = { move: null, guardUntil: -9, blockKind: 'slash', atk: null, atkReady: 0, lockUntil: 0, stunUntil: 0, hurtUntil: 0, heal: null, focusUntil: 0, riposteUntil: 0, pose: { ...PP.idle }, x: 0, y: 0, s: 1, sideDir: 1, ghosts: [] };
    this.boss = { pose: { ...BP.idle }, x: 0, y: 0, s: 1, flinchUntil: 0, recoil: null };
    this.banner = null; this.grade = null; this.result = null;
    this.q = 1; this.makeBG();
    this.snap = snap || null; this.introStart(this.snap);
  }

  win(action, type) {
    const s = this.g.save, w = this.w, a = action === 'side' ? 'dodge' : action;
    const mult = a === 'block' ? w.block[type] : w.evade[a];
    const focus = (1 + 0.015 * (s.stats.focus - 8)) * (this.t < this.player.focusUntil ? 1.25 : 1);
    const good = BASE_WIN.good * mult * focus;
    return { good, perfect: Math.min(good * 0.85, BASE_WIN.perfect * mult * (a === 'block' ? w.perfect : 1) * focus) };
  }
  late(type) { let m = 0; for (const a of ATTACKS[type].valid) m = Math.max(m, this.win(a, type).good); return m; }

  /* ---------- input ---------- */
  press(a, t) {
    const p = this.player;
    if (a === 'hints') { this.g.save.hints = !this.g.save.hints; return; }
    if (this.mode === 'intro') { if (a === 'interact' || a === 'padA' || a === 'attack') this.skipIntro = true; return; }
    if (a === 'padA' || a === 'hop') a = 'jump';
    if (this.mode === 'over' || t < p.stunUntil) return;
    if (a === 'attack') { this.attack(); return; }
    if (a === 'heal') { this.heal(); return; }
    let dir = 0;
    if (a === 'left' || a === 'right') { dir = a === 'left' ? -1 : 1; a = 'side'; }
    else if (a === 'dodge') { a = 'side'; dir = Math.sign(input.axisX()) || -p.sideDir || 1; }
    if (!['block', 'duck', 'jump', 'side'].includes(a)) return;
    if (t < p.lockUntil) return;
    const air = p.move && p.move.kind === 'jump' && this.t < p.move.until;
    if (a !== 'block' && air) return;
    const act = a === 'side' ? 'dodge' : a;
    const tg = this.cond.target(act, t, (x, y) => this.win(x, y));
    if (a === 'block' && tg && this.cond.blockRefused(tg.n)) { this.fx.float('TOO FAST TO BLOCK', PX - 240, 430, '#cfe9e0', 16); p.lockUntil = t + 0.06; sfx('tooFast'); return; }
    p.heal = null; p.atk = null;
    if (a === 'block') {
      p.blockKind = tg ? tg.n.type : (this.cond.notes.find((n) => !n.result && n.time > this.t - 0.1) || {}).type || 'slash';
      p.guardUntil = this.t + DUR.block;
      if (p.move && p.move.kind === 'duck' && this.t < p.move.until) p.move.until = Math.max(p.move.until, p.guardUntil);   // stay down through the block
      if (!tg) p.lockUntil = t + 0.2;
    } else {
      if (a === 'side') { p.sideDir = dir; sfx('evade'); }
      if (a === 'jump') sfx('jump');
      p.move = { kind: a, t0: this.t, until: this.t + DUR[a], dir };
      p.guardUntil = -9;
    }
    if (!tg) return;
    tg.n.result = tg.perfect ? 'perfect' : 'good'; tg.n.action = act;
    if (t >= tg.n.time) this.apply(tg.n);
  }
  attack() {
    const p = this.player, t = this.t;
    if (t < p.atkReady || p.heal) return;
    const big = this.mode === 'broken';
    p.atk = { t0: t, dur: big ? 0.6 : this.w.dur + 0.06, hit: big ? 0.2 : this.w.hits[0] + 0.03, hits: big ? [0.2] : this.w.hits.map((h) => h + 0.03), done: 0, big };
    p.atkReady = t + p.atk.dur; p.lockUntil = t + 0.2; p.move = null; p.guardUntil = -9;
    sfx('swing');
  }
  heal() {
    const p = this.player, s = this.g.save;
    if (p.heal || p.atk || s.flasks <= 0) return;
    p.heal = { t0: this.t, at: this.t + 0.5, until: this.t + 0.9, done: false };
  }

  /* ---------- strikes ---------- */
  apply(n) {
    if (n.applied) return;
    n.applied = true;
    const cp = CP[n.type], p = this.player, w = this.w, s = this.g.save;
    const ev = n.action && n.action !== 'block';
    if (n.result === 'perfect') {
      if (!ev) {
        const chain = n.seg.perfect + 1, big = 1 + Math.min(4, chain - 1) * 0.18;
        this.fx.sparks(cp.x, cp.y, 40 + chain * 8, '#ffffff', 1000 * big); this.fx.sparks(cp.x, cp.y, 16, PLAYER_C, 700);
        this.fx.motes(cp.x, cp.y, 10, '#bff9ff', 200, 60);
        this.fx.flare(cp.x, cp.y, '#bff9ff', 520 * big, 0.3); this.fx.ring(cp.x, cp.y, '#ffffff', 130 * big, 0.3, 7); this.fx.ring(cp.x, cp.y, PLAYER_C, 80 * big, 0.28, 4);
        this.hitstop = 0.075; this.shake = Math.max(this.shake, 10); this.flash = { c: '220,255,250', a: 0.2 };
        this.zoomPunch(0.035 * big, cp.x, cp.y); this.boss.recoil = { t0: this.t, amt: 1.1 };
        this.gradeText(chain > 1 ? 'DEFLECT ×' + chain : 'DEFLECT', '#ffffff'); this.gain(7.5); this.pPost += 2; sfx('deflect');
        if (w.riposte) p.riposteUntil = this.t + 0.6;
      } else {
        this.gradeText('PERFECT ' + ACT_NAME[n.action], '#bff9ff'); this.gain(9.75); sfx('perfect');
        p.ghosts.push({ pose: { ...p.pose }, x: p.x, y: p.y, s: p.s, t0: this.t });
        this.fx.flare(PX + p.x, PY - 200, PLAYER_C, 320, 0.22); this.boss.recoil = { t0: this.t, amt: 0.5 };
        if (w.focus) { p.focusUntil = this.t + 2.2; this.fx.float('FOCUS', PX - 240, 400, PLAYER_C, 18); sfx('focus'); }
      }
    } else if (n.result === 'good') {
      if (!ev) {
        this.fx.sparks(cp.x, cp.y, 22, '#d8fff4', 680); this.fx.flare(cp.x, cp.y, '#d8fff4', 240, 0.18); this.fx.ring(cp.x, cp.y, '#d8fff4', 70, 0.22, 4);
        this.shake = Math.max(this.shake, 5); this.zoomPunch(0.012, cp.x, cp.y); this.boss.recoil = { t0: this.t, amt: 0.45 };
        this.gradeText('BLOCK', '#d8fff4'); this.pPost += 13 * w.guardCost * (1 - 0.04 * (s.stats.guard - 8)); this.gain(2.5); sfx('block');
      } else { this.gradeText(ACT_NAME[n.action], '#bfe9e0'); this.gain(3.25); }
    } else {
      this.hurt(n.type === 'slam' ? this.B.slamDmg : this.B.dmg, n.type);
    }
    const sg = n.seg; sg.done++; if (n.result === 'perfect') sg.perfect++;
    if (sg.done === sg.n && sg.perfect === sg.n && sg.n >= 2 && this.mode === 'play') this.knockback(sg);
    this.checkPosture();
  }
  gain(v) { this.bossPost += v; this.lastPost = this.t; }
  knockback(sg) {
    const t = this.t, b = this.bossPos(), cx = b.x, cy = b.y - 130 * b.s;
    const op = this.openings.find((o) => o.seg === sg);
    this.knock = { t0: t, until: Math.max(t + 0.42, op ? op.end : t + 0.6) };
    this.gain(10);
    this.fx.sparks(cx, cy, 70, '#ffffff', 1300); this.fx.motes(cx, cy, 24, '#bff9ff', 240, 60);
    for (let i = 0; i < 3; i++) this.fx.ring(cx, cy, i ? '#ffffff' : PLAYER_C, 240 + i * 60, 0.45, 9 - i * 2);
    this.fx.flare(cx, cy, '#ffffff', 900, 0.4);
    this.showBanner('FLAWLESS', '', '#ffffff', 0.9); this.shake = Math.max(this.shake, 14); this.flash = { c: '220,255,250', a: 0.3 }; this.zoomPunch(0.055, cx, cy);
    sfx('perfect');
  }
  hurt(dmg, type) {
    const p = this.player, t = this.t;
    this.pHP -= dmg; p.hurtUntil = t + 0.28; p.atk = null; p.move = null; p.guardUntil = -9; p.heal = null;
    this.fx.shards(PX + p.x, PY - 230, 18, PLAYER_C, 520, 30); this.fx.sparks(CP[type].x, CP[type].y, 14, ATTACKS[type].color, 600);
    this.fx.cut(PX, PY - 210, rnd(-0.9, -0.5), 260, ATTACKS[type].color, 0.3, 9);
    this.shake = Math.max(this.shake, 15); this.hitstop = 0.05; this.flash = { c: '255,255,255', a: 0.2 };
    this.gradeText(type === 'slam' ? 'CRUSHED' : 'HIT', ATTACKS[type].color); sfx('hit');
    if (this.pHP <= 0) { this.pHP = 0; this.end('lose'); }
  }
  checkPosture() {
    if (this.mode !== 'play') return;
    if (this.pPost >= 100) { this.pPost = 50; this.player.stunUntil = this.t + 0.9; this.showBanner('GUARD BROKEN', 'You are open', '#ffffff', 1.2); sfx('brk'); }
    if (this.bossPost >= this.B.poise || this.bossHP <= 0) this.breakBoss();
  }
  breakBoss() {
    this.bossPost = this.B.poise; this.mode = 'broken'; this.brokenAt = this.t;
    this.cond.cancelOwner(this, this.t, true); this.openings = [];
    const b = this.bossPos(); this.fx.sparks(b.x, b.y - 150 * b.s, 34, '#ffffff', 750);
    this.showBanner('POISE BROKEN', fightWords(this.g.save) ? btn('attack') + '  Power strike' : '', '#ffffff', 1.6); sfx('brk');
  }
  resolveHit(a) {
    const t = this.t, p = this.player, w = this.w, s = this.g.save;
    if (this.mode === 'broken') { this.power(); return; }
    if (this.mode !== 'play') return;
    const op = this.openings.find((o) => t >= o.start && t <= o.end) || (this.knock && t < this.knock.until);
    const rip = t < p.riposteUntil;
    const b = this.bossPos(), hx = b.x - 10, hy = b.y - 130 * b.s;
    if (op || rip) {
      const dmg = swordDmg(w, s) * (rip && !op ? 1.4 : 1) * 0.55;
      this.bossHP -= dmg; this.gain(w.poise); this.boss.flinchUntil = t + 0.16;
      this.fx.sparks(hx, hy, 18, '#ffffff', 640); this.fx.sparks(hx, hy, 8, PLAYER_C, 400);
      this.fx.arc(hx + 40, hy + 30, 150 * b.s / 1.2, -2.5, -0.1, PLAYER_C, 0.22, 20);
      this.shake = Math.max(this.shake, 7); this.hitstop = Math.max(this.hitstop, 0.06); this.zoomPunch(0.02, hx, hy);
      this.fx.float(String(Math.round(dmg * 10)), hx + rnd(-50, 50), hy - 90, '#ffffff', 24);
      if (rip && !op) { p.riposteUntil = 0; this.fx.float('RIPOSTE', hx, hy - 140, PLAYER_C, 24); }
      sfx('cut');
      if (this.bossHP <= 0.5) { this.bossHP = 0; this.breakBoss(); return; }
      this.checkPosture();
    } else {
      p.lockUntil = Math.max(p.lockUntil, t + 0.22); this.pPost += 5 * w.guardCost; this.gain(1.2);
      this.fx.sparks(hx - 40, hy + 30, 12, '#ffffff', 480); this.fx.flare(hx - 40, hy + 30, '#ffffff', 200, 0.16);
      this.boss.recoil = { t0: t, amt: 0.3 }; this.fx.float('GUARDED', hx, hy - 100, '#cfe9e0', 20); sfx('guarded');
      if (Math.random() < 0.75 && !this.cond.notes.some((n) => !n.applied && n.time < t + 1.15) && !this.openings.some((o) => o.end > t - 0.1 && o.start < t + 1.15)) {
        // a quick counter: its blade flies the whole way in, just faster
        this.cond.plan(this, pick(['R', 'Y', 'R']), 0.5, t + 0.75, t, { maxShift: 0.3, chamber: () => 0.34, extra: { lead: 0.75 } });
        this.sideNotes();
      }
      this.checkPosture();
    }
  }
  /** The power strike on a broken warden: heavy damage by the sword. Health left and the warden recovers; none and
   *  the phase ends. */
  power() {
    const t = this.t, b = this.bossPos(), hx = b.x, hy = b.y - 130 * b.s, dmg = powerDmg(this.w, this.g.save);
    this.bossHP -= dmg;
    this.fx.float(String(Math.round(dmg * 10)), hx + rnd(-30, 30), hy - 110, '#ffffff', 34);
    if (this.bossHP > 0.5) {
      this.fx.sparks(hx, hy, 46, '#ffffff', 950); this.fx.cut(hx, hy, -0.6, 380, '#ffffff', 0.32, 10); this.fx.ring(hx, hy, '#ffffff', 180, 0.4, 6);
      this.flash = { c: '230,255,250', a: 0.3 }; this.shake = 15; this.hitstop = 0.12; this.boss.flinchUntil = t + 0.4; this.boss.recoil = { t0: t, amt: 1.2 };
      sfx('lethal');
      this.showBanner('POWER STRIKE', fightWords(this.g.save) ? 'Break its poise again to finish the phase' : '', '#ffffff', 1.4);
      this.mode = 'play'; this.bossPost = 0; this.nextPlan = t + 1;
      return;
    }
    this.bossHP = 0;
    this.fx.sparks(hx, hy, 80, '#ffffff', 1200); this.fx.shards(hx, hy, 30, this.B.look.color, 600, 40);
    this.fx.cut(hx, hy, -0.6, 480, '#ffffff', 0.4, 12); this.fx.ring(hx, hy, '#ffffff', 260, 0.5, 8); this.fx.flare(hx, hy, '#ffffff', 900, 0.4);
    this.flash = { c: '230,255,250', a: 0.55 }; this.shake = 22; this.hitstop = 0.16; this.boss.flinchUntil = t + 0.5;
    sfx('lethal');
    this.phase++;
    if (this.phase >= this.B.phases.length) { this.bossHP = 0; this.end('win'); return; }
    this.showBanner('POWER STRIKE', this.B.lines[this.phase - 1] || '', '#ffffff', 1.8);
    this.mode = 'play'; this.bossHP = this.B.hp; this.bossPost = 0; this.nextPlan = t + 1.4;
    this.pHP = Math.min(maxHP(this.g.save.stats), this.pHP + 10);
    setIntensity(this.phase);
  }
  end(result) {
    this.mode = 'over'; this.result = result; this.endAt = this.t + (result === 'win' ? 3 : 2.4);
    this.cond.cancelOwner(this, this.t, true);
    if (result === 'win') { this.showBanner(this.B.name + ' FALLS', this.B.quiet, '#ffffff', 3); sfx('shatter'); }
    else { this.showBanner('YOU FELL', 'The dance goes on without you', '#ffffff', 2.4); sfx('death'); }
  }

  noteExtra() { return { lead: this.B.leads[this.phase] }; }
  /** Slashes and sweeps come from one side or the other; slams alternate a slight angle so back-to-back ones stay apart. */
  sideNotes() {
    for (const n of this.cond.notes) if (n.lane === undefined) {
      n.side = SIDED[n.type] ? (Math.random() < 0.5 ? -1 : 1) : 0;
      n.lane = n.side || (this.alt = -this.alt) * 0.45;
    }
  }
  plan() {
    const t = this.t, ph = this.B.phases[this.phase];
    const notes = this.cond.plan(this, pick(ph.phrases), ph.beat, t + this.B.leads[this.phase], t, {
      maxShift: 0.6, extra: this.noteExtra(),
      chamber: (type, gap) => (type === 'slam' ? Math.min(0.7, Math.max(0.24, gap * 0.85)) : Math.min(0.55, Math.max(0.16, gap * 0.8))),
    });
    if (!notes) { this.nextPlan = t + 0.3; return; }
    this.sideNotes();
    const last = notes[notes.length - 1].time;
    const op = { start: last + 0.16, end: last + 0.16 + ph.open, seg: notes[0].seg };
    this.openings.push(op);
    this.nextPlan = op.end + rnd(ph.rest[0], ph.rest[1]) * COMBO_REST - this.B.leads[this.phase] * 0.6;
  }

  /* ---------- update ---------- */
  update(dt, presses, nowMs) {
    if (this.g.menuOpen) return;
    for (const pr of presses) this.press(pr.a, Math.max(this.t - 0.05, this.t + dt - (nowMs - pr.t) / 1000));
    this.t += dt;
    const t = this.t, p = this.player, adt = this.hitstop > 0 ? 0 : dt;
    this.hitstop = Math.max(0, this.hitstop - dt);
    if (this.mode === 'intro') {
      if (t > 1.8 && !this.introBanner) { this.introBanner = true; this.showBanner(this.B.name, this.B.sub, '#ffffff', 2.8); }
      if (t >= INTRO || this.skipIntro) { this.mode = 'play'; this.nextPlan = t + 0.6; }
    }
    if (this.mode === 'play') {
      if (t >= this.nextPlan && !this.cond.notes.some((n) => !n.applied)) this.plan();
      for (const n of this.cond.notes) {
        if (n.applied || n.cancelled) continue;
        if (!n.struck && t >= n.time) {
          n.struck = true; this.fx.fx.push({ k: 'trail', kind: n.type, side: n.side, t0: this.fx.t, dur: 0.24 });
          this.shake = Math.max(this.shake, n.type === 'slam' ? 9 : 3.5); sfx(n.type);
          if (n.type === 'slam') this.fx.fx.push({ k: 'wave', t0: this.fx.t, dur: 0.45 });
        }
        if (n.result && t >= n.time) this.apply(n);
        else if (!n.result && t > n.time + this.late(n.type)) { n.result = 'miss'; this.apply(n); }
        if (this.mode !== 'play') break;
      }
      if (t - this.lastPost > 1.6) this.bossPost = Math.max(0, this.bossPost - 4 * dt);
    }
    if (this.mode === 'broken' && t - this.brokenAt > 3) { this.mode = 'play'; this.bossPost = this.B.poise * 0.6; if (this.bossHP <= 0) this.bossHP = this.B.hp * 0.15; this.nextPlan = t + 0.4; this.showBanner('RECOVERED', 'Too slow', '#cfe9e0', 1); }
    if (this.mode === 'over' && t >= this.endAt && !this.reported) { this.reported = true; this.g.onBossEnd(this.result, this.pHP); }
    this.cond.prune(t);
    this.openings = this.openings.filter((o) => t < o.end + 1);
    if (t >= p.stunUntil) this.pPost = Math.max(0, this.pPost - 9 * dt);
    if (p.atk) { const k = t - p.atk.t0; while (p.atk.done < p.atk.hits.length && k >= p.atk.hits[p.atk.done]) { p.atk.done++; this.resolveHit(p.atk); } if (k >= p.atk.dur) p.atk = null; }
    if (p.heal && !p.heal.done && t >= p.heal.at) { const s = this.g.save; p.heal.done = true; s.flasks--; this.pHP = Math.min(maxHP(s.stats), this.pHP + maxHP(s.stats) * 0.45); this.fx.motes(PX, PY - 150, 16, '#19e0b0', 120, 60); sfx('heal'); }
    if (p.heal && t >= p.heal.until) p.heal = null;
    if (this.g.autoplay) this.auto();
    // poses
    const pt = this.playerTarget(), kp = 1 - Math.exp(-pt.rate * adt);
    lerp(p.pose, pt.pose, kp);
    if (this.mode !== 'intro') { p.x += (pt.x - p.x) * kp; p.y += (pt.y - p.y) * Math.min(1, kp * 1.6); p.s += (pt.s - p.s) * kp; }
    const bt = this.bossTarget(), b = this.boss, kb = 1 - Math.exp(-bt.rate * adt);
    lerp(b.pose, bt.pose, kb); b.x += (bt.x - b.x) * kb; b.y += (bt.y - b.y) * kb; b.s += (bt.s - b.s) * kb;
    this.tel = bt.tel || null;
    this.fx.update(adt || dt * 0.2);
    p.ghosts = p.ghosts.filter((g) => t - g.t0 < 0.36);
    this.shake *= Math.exp(-dt * 10);
    this.bossShow += (this.bossHP - this.bossShow) * (1 - Math.exp(-dt * 3));
    this.pShow += (this.pHP - this.pShow) * (1 - Math.exp(-dt * 3));
    if (this.flash) { this.flash.a -= dt * 2.2; if (this.flash.a <= 0) this.flash = null; }
  }

  auto() {
    const p = this.player, t = this.t;
    if (this.mode === 'broken') { if (t - this.brokenAt > 0.5) this.attack(); return; }
    if (this.mode !== 'play') return;
    const pending = this.cond.notes.filter((n) => !n.result && !n.applied);
    const n = pending[0];
    if (n && t >= n.time - 0.015) {
      const air = p.move && p.move.kind === 'jump' && t < p.move.until;
      let order = n.type === 'slash' ? ['duck', 'block'] : n.type === 'sweep' ? ['jump', 'block'] : ['dodge', 'block'];
      if (Math.random() < 0.35) order.reverse();
      for (const a of order) {
        if (air && a !== 'block') continue;
        if (a === 'block' && this.cond.blockRefused(n)) continue;
        if (a === 'jump') { const after = pending.filter((m) => m !== n && m.time - n.time < JUMP_AIR + 0.05); if (after.some((m, i) => i > 0 && m.time - after[i - 1].time < 0.25)) continue; }
        this.press(a === 'dodge' ? (Math.random() < 0.5 ? 'left' : 'right') : a, t); break;
      }
    }
    const hit = t + this.w.hits[0] + 0.03, op = this.openings.find((o) => hit >= o.start + 0.02 && hit <= o.end - 0.02) || (this.knock && hit < this.knock.until);
    if (op && (!pending[0] || pending[0].time - t > 0.5) && t >= p.atkReady) this.attack();
  }

  playerTarget() {
    const p = this.player, t = this.t, I = { x: 0, y: 0, s: 1 };
    if (this.mode === 'over' && this.result === 'lose') return { ...I, pose: PP.stun, rate: 6 };
    if (t < p.stunUntil) return { ...I, pose: PP.stun, rate: 10 };
    if (t < p.hurtUntil) return { pose: PP.hurt, x: -10, y: 26, s: 1.08, rate: 26 };
    if (p.atk) {
      const k = t - p.atk.t0, D = p.atk.big ? 1.5 : 1, h = p.atk.hits[0];
      if (k < h) { const e = k / h; return { pose: PP.attackW, x: -12 * e, y: 8 * e, s: 1 + 0.03 * e, rate: 24 }; }
      if (k < h + 0.1) return { pose: PP.attack, x: 125 * D, y: -90 * D, s: 1 - 0.2 * D, rate: 70 };
      const r = smooth(clamp((k - h - 0.1) / Math.max(0.05, p.atk.dur - h - 0.1), 0, 1));
      return { pose: PP.attack, x: 125 * D * (1 - r), y: -90 * D * (1 - r), s: 1 - 0.2 * D * (1 - r), rate: 12 };
    }
    let out = { ...I, pose: p.heal ? PP.heal : PP.idle, rate: 14 };
    if (p.move && t < p.move.until) {
      const m = p.move, k = (t - m.t0) / (m.until - m.t0);
      if (m.kind === 'duck') out = { ...I, pose: PP.duck, rate: 42 };
      else if (m.kind === 'jump') out = { ...I, pose: k < 0.82 ? PP.jump : PP.idle, y: -Math.sin(k * Math.PI) * 62, rate: k < 0.82 ? 40 : 30 };
      else out = { ...I, pose: m.dir > 0 ? PP.sideR : PP.sideL, x: m.dir * 190 * (k < 0.7 ? 1 : (1 - k) / 0.3), rate: 34 };
    }
    if (t < p.guardUntil) {
      const g = p.blockKind === 'sweep' ? PP.blockSweep : p.blockKind === 'slam' ? PP.blockSlam : PP.blockSlash;
      out = { ...out, pose: p.move && t < p.move.until ? withGuard(out.pose, g) : g, rate: 45 };
    }
    return out;
  }
  bossTarget() {
    const t = this.t, b = this.boss;
    const at = (k, rate, extra) => { const o = BOFF[k]; return { pose: BP[k], x: o[0], y: o[1], s: o[2], rate, sway: 1, ...extra }; };
    if (this.mode === 'intro') return at(t > 1.9 && t < 3.8 ? 'flourish' : 'idle', 4);
    if (this.mode === 'over' && this.result === 'win') return at('broken', 6, { sway: 0.2 });
    if (this.mode === 'broken') return at('broken', 10, { sway: 0.5 });
    if (t < b.flinchUntil) return { pose: BP.hurt, x: b.x + 6, y: b.y - 4, s: b.s, rate: 30, sway: 0 };
    let bt = null;
    if (this.knock && t < this.knock.until) {
      const nn = this.cond.notes.find((n) => !n.struck);
      if (!(nn && t >= nn.time - nn.chamber)) {
        const k0 = t - this.knock.t0, d = this.knock.until - this.knock.t0;
        bt = k0 < 0.13 ? at('knocked', 48, { sway: 0 }) : blendTo('knocked', 'idle', smooth(clamp((k0 - 0.13) / Math.max(0.1, d - 0.13), 0, 1)), 14);
      }
    }
    if (!bt) {
      const inOpen = this.openings.find((o) => t >= o.start - 0.08 && t <= o.end);
      const N = this.cond.notes;
      for (let i = 0; i < N.length && !bt; i++) {
        const n = N[i], nx = N[i + 1], pv = N[i - 1];
        if (n.cancelled || t > n.time + 0.16) continue;
        if (t >= n.time) { if (nx && t >= nx.time - nx.chamber) continue; bt = at(pk(n, 'S'), 42, { sway: 0 }); break; }
        const cs = n.time - n.chamber;
        if (t >= cs) {
          const k = clamp((t - cs) / n.chamber + 0.06, 0, 1), chain = pv && cs < pv.time + 0.2, e = chain ? smooth(k) : 0.38 + 0.62 * smooth(k);
          bt = blendTo(chain ? pk(pv, 'S') : 'idle', pk(n, 'W'), e, n.chamber < 0.3 ? 60 : 36, { tel: { type: n.type, k }, sway: 1 - e });
          break;
        }
        if (inOpen) { bt = at('open', 12, { sway: 0.7 }); break; }
        const ps = Math.max(pv ? pv.time + 0.16 : -9, n.time - (n.lead || 1.4));
        const pre = smooth(clamp((t - ps) / Math.max(0.05, cs - ps), 0, 1));
        bt = blendTo('idle', pk(n, 'W'), 0.38 * pre, 5, { sway: 1 - 0.38 * pre });
      }
      if (!bt) bt = inOpen ? at('open', 12, { sway: 0.7 }) : at('idle', 5);
    }
    // recoil from deflects
    const rc = b.recoil;
    if (rc) {
      const e = rc.amt * Math.exp(-(t - rc.t0) / 0.085);
      if (e > 0.02) { const q = { ...bt.pose }; q.rHy -= 30 * e; q.lHy -= 26 * e; q.rEy -= 18 * e; q.lEy -= 16 * e; q.rHx += 16 * e; q.lHx += 12 * e; q.sa += 0.8 * e; q.heady -= 6 * e; bt = { ...bt, pose: q, x: bt.x + 10 * e, y: bt.y - 8 * e, s: bt.s - 0.035 * e }; }
    }
    // always moving, like a dancer
    const A = bt.sway || 0;
    if (A > 0) {
      const q = { ...bt.pose }, a = Math.sin(t * 1.15), r = Math.sin(t * 2.4), w = Math.sin(t * 1.7 + 0.5);
      q.chestx += w * 5 * A; q.headx += w * 6 * A; q.heady += r * 2.5 * A; q.lHy += r * 4 * A; q.rHy += r * 4 * A; q.lHx += w * 3 * A; q.rHx += w * 3 * A; q.lFx += a * 5 * A; q.rFx += a * 5 * A; q.sa += Math.sin(t * 1.3) * 0.09 * A;
      bt = { ...bt, pose: q, x: bt.x + a * 22 * A, y: bt.y + r * 2 * A };
    }
    return bt;
  }
  /** How the boss's figure is drawn: colour, head, blade length and width, one blade or two. */
  rigLook() { const k = this.B.look; return { color: k.color, rgb: k.rgb, headR: k.headR, sword: k.sword, bladeW: k.bladeW, twin: !!k.twin }; }
  bossPos() { return { x: BXc + this.boss.x, y: BY + this.boss.y, s: BS * this.boss.s }; }
  zoomPunch(amt, x, y) { if (!this.zoom || amt >= this.zoom.amt * Math.exp(-(this.t - this.zoom.t0) * 9)) this.zoom = { amt, x, y, t0: this.t }; }
  showBanner(s, sub, c, dur = 1.4) { this.banner = { s, sub, c, t0: performance.now() / 1000, dur }; }
  gradeText(s, c) { this.grade = { s, c, t0: this.t }; }

  /* ---------- the opening shot: a slow orbit from side-on to behind you ---------- */
  /** Where the opening shot starts: side-on, from wherever puts the two of you exactly where the walk in left you. */
  introStart(snap) {
    const S = { tz: IC.mid.z, d: IC.d0, h: IC.h0 };
    if (snap) {
      const u = snap.player.x - VPX, v = snap.boss.x - VPX;
      if (v - u > 60) {
        const A = Math.max(IC.bx + 600, (FOC * (IC.bz - IC.pz) + v * IC.bx - u * IC.px) / (v - u));
        S.tz = IC.pz - u * (A - IC.px) / FOC; S.d = A - IC.mid.x; S.h = clamp((snap.player.y - HORIZON) * (A - IC.px) / FOC, 120, 1400);
      }
    }
    this.ic0 = S;
    if (!snap) return;
    // what's left over (sizes, the boss's floor line) is taken up on screen and let go as the camera turns
    const c = this.introCam(0), fix = (X, Z, m, at, tall) => { const q = project(c, X, 0, Z); return { dx: at.x - q.x, dy: at.y - q.y, k: (at.h / tall) / (q.s * m) }; };
    this.fix = { player: fix(IC.px, IC.pz, 1, snap.player, 191), boss: fix(IC.bx, IC.bz, IC.bm0, snap.boss, 209) };
    // the play area becomes a flat standing where you both stand (so its floor stays under your feet), filling the view
    const D = c.x - IC.mid.x;
    this.flat = { x: IC.mid.x, z0: c.z - VPX * D / FOC, z1: c.z + (W - VPX) * D / FOC, y1: c.y + HORIZON * D / FOC, y0: c.y - (H - HORIZON) * D / FOC };
  }
  introCam(t = this.t) {
    const S = this.ic0;
    const eR = easeIO(clamp((t - 0.15) / 5.25, 0, 1)), eD = easeIO(clamp(t / 5.1, 0, 1));
    const phi = -Math.PI / 2 * (1 - eR);
    const tx = mix(IC.mid.x, 0, eD), tz = mix(S.tz, IC.pz, eD), d = mix(S.d, IC.pz, eD);
    const fx = Math.sin(phi), fz = Math.cos(phi);
    return { x: tx - d * fx, y: mix(S.h, IC.h, eD), z: tz - d * fz, fx, fz, rx: fz, rz: -fx, eR };
  }
  /** A picture on the flat, cut into thin upright strips so it turns in true perspective. */
  drawFlat(ctx, cam, img, a) {
    const F = this.flat, N = 72, iw = img.width, ih = img.height;
    ctx.save(); ctx.globalAlpha = a;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const z = mix(F.z0, F.z1, i / N), top = project(cam, F.x, F.y1, z), bot = project(cam, F.x, F.y0, z);
      const cur = { x: top.x, top: top.y, bot: bot.y, ok: top.z > 30 };
      if (prev && cur.ok && prev.ok) {
        const dw = cur.x - prev.x, y0 = (prev.top + cur.top) / 2, y1 = (prev.bot + cur.bot) / 2;
        if (dw > 0 && prev.x < W && cur.x > 0) ctx.drawImage(img, (i - 1) / N * iw, 0, iw / N, ih, prev.x, y0, dw + 0.8, y1 - y0);
      }
      prev = cur;
    }
    ctx.restore();
  }
  renderIntro(ctx, Q) {
    const th = this.th;
    CTX = ctx;
    if (this.q !== Q) { this.q = Q; this.makeBG(); }
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    const cam = this.introCam(), t = this.t, w = this.w, P = (X, Y, Z) => project(cam, X, Y, Z), snap = this.snap;
    // the morph: the walk in's own picture gives way to the play area as a flat, which swings off as the arena comes up
    const aS = snap ? 1 - smooth(clamp(t / 0.8, 0, 1)) : 0;
    const aW = snap ? 1 - smooth(clamp((t - 0.6) / 2.2, 0, 1)) : 0;
    const aA = snap ? smooth(clamp((t - 0.15) / 2.3, 0, 1)) : 1;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = aA;
    // sky and floor (the horizon stays put: the camera only turns, never tilts)
    let gr = ctx.createLinearGradient(0, 0, 0, HORIZON);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.7, th.sky[1]); gr.addColorStop(1, th.horizon);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, HORIZON);
    gr = ctx.createLinearGradient(0, HORIZON, 0, H); gr.addColorStop(0, th.floorTop); gr.addColorStop(1, th.floorBot);
    ctx.fillStyle = gr; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    // the ring of pylons, far to near, standing on the horizon like the duel's backdrop
    const py = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * 6.283 + 0.02, X = IC.mid.x + Math.cos(a) * 5000, Z = IC.mid.z + Math.sin(a) * 5000;
      const b = P(X, 0, Z); if (b.z < 300) continue;
      b.y = HORIZON; py.push({ b, h: (380 + ((i * 37) % 60) * 3.4) * 1.56, w: (56 + (i % 3) * 14) * 1.56 });
    }
    py.sort((p1, p2) => p2.b.z - p1.b.z);
    for (const q of py) {
      const s = q.b.s, x = q.b.x, top = q.b.y - q.h * s, hw = q.w * s / 2;
      if (x + hw < -40 || x - hw > W + 40) continue;
      ctx.fillStyle = th.body; ctx.fillRect(x - hw, top, hw * 2, q.h * s);
      ctx.strokeStyle = th.a(0.35); ctx.lineWidth = 1.5; ctx.strokeRect(x - hw, top, hw * 2, q.h * s);
      ctx.fillStyle = th.b(0.6); ctx.fillRect(x - 1, top - 125 * s, 2, 125 * s);
    }
    const hz = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON + 10);
    hz.addColorStop(0, th.a(0)); hz.addColorStop(1, th.a(0.35));
    ctx.fillStyle = hz; ctx.fillRect(0, HORIZON - 40, W, 50);
    // the floor grid, clipped at the lens
    ctx.strokeStyle = th.a(0.3); ctx.lineWidth = 1.2; ctx.beginPath();
    const G = 101, N = 46, cx = 0, cz = IC.mid.z;
    for (let i = -N; i <= N; i++) {
      seg3(ctx, cam, cx + i * G, cz - N * G, cx + i * G, cz + N * G);
      seg3(ctx, cam, cx - N * G, cz + i * G, cx + N * G, cz + i * G);
    }
    ctx.stroke();
    // distance haze over the grid's far lines
    gr = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 80);
    gr.addColorStop(0, th.hz(0.85)); gr.addColorStop(1, th.hz(0));
    ctx.fillStyle = gr; ctx.fillRect(0, HORIZON, W, 80);
    // the duel circle
    ctx.beginPath(); let pen = false;
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * 6.283, q = P(Math.cos(a) * RING.rx, 0, RING.z + Math.sin(a) * RING.rz);
      if (q.z < 40) { pen = false; continue; }
      if (pen) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); pen = true; }
    }
    ctx.strokeStyle = th.b(0.18); ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = th.b(0.7); ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;
    // the play area, turning away
    if (aW > 0.003) {
      this.drawFlat(ctx, cam, snap.back, aW);
      if (aS > 0.003) this.drawFlat(ctx, cam, snap.full, aW * aS);
    }
    // the two of you, nearer one last; at first pinned to where the walk in left you, then let go
    const b = this.boss, p = this.player, bm = mix(IC.bm0, IC.bm, Math.pow(cam.eR, 1.4)) * b.s;
    const fk = this.fix ? 1 - smooth(clamp(t / 2.6, 0, 1)) : 0;
    const figs = [
      { key: 'boss', world: { x: IC.bx + b.x / IC.bk, y: -b.y / IC.bk, z: IC.bz }, pose: b.pose, face: -1, m: bm, zd: BZD, o: { view: 'front', ...this.rigLook() } },
      { key: 'player', world: { x: IC.px, y: 0, z: IC.pz }, pose: p.pose, face: 1, m: 1, zd: PZD, o: { view: 'back', color: PLAYER_C, rgb: PLAYER_RGB, headR: 13, sword: 96 * w.len / 60, bladeW: w.width + 1.2, twin: w.twin, blade: '#dffcff' } },
    ].map((f) => ({ ...f, base: P(f.world.x, f.world.y, f.world.z) })).filter((f) => f.base.z > 60).sort((f1, f2) => f2.base.z - f1.base.z);
    for (const f of figs) {
      const r = figure3D(cam, f), fx = this.fix && this.fix[f.key];
      if (fx && fk > 0) { r.x += fx.dx * fk; r.y += fx.dy * fk; r.s *= Math.pow(fx.k, fk); }
      const fa = 1 - aS, rx = 46 * r.s, ry = rx * clamp(cam.y / f.base.z, 0.12, 0.6);
      ctx.globalAlpha = fa; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(r.x, r.y + 2, rx, ry, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      if (f.face < 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * fa * aA; ctx.drawImage(glowSprite(th.neon2), r.x - 2 * rx, r.y - ry * 2, 4 * rx, ry * 4); ctx.restore(); }
      if (fa > 0.003) drawRig(ctx, { ...f.o, ...r, alpha: fa });
    }
    // drifting motes: their parallax sells the turn
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of MOTES) {
      const y = (m.y + t * m.v) % 520, q = P(m.x, y, m.z); if (q.z < 60) continue;
      const r = clamp(2.6 * q.s, 0.7, 4); ctx.globalAlpha = aA * clamp(m.a * Math.min(1, (520 - y) / 120) * Math.min(1, q.s * 2) * clamp(1.6 - q.s, 0, 1), 0, 1);
      ctx.drawImage(glowSprite(m.c === '#3dff9a' ? th.neon : m.c), q.x - r * 3, q.y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
    // the walk in had its own vignette baked in; ours comes up as that picture goes
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - aS * aW; drawVignette(ctx, this.vig); ctx.globalAlpha = 1; ctx.setTransform(Q, 0, 0, Q, 0, 0);
  }

  /* ---------- drawing ---------- */
  makeBG() {
    const th = this.th;
    const q = this.q || 1;
    const c = document.createElement('canvas'); c.width = Math.round(W * q); c.height = Math.round(H * q);
    const g = c.getContext('2d', { alpha: false });
    g.scale(q, q);
    let gr = g.createLinearGradient(0, 0, 0, HORIZON);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.7, th.sky[1]); gr.addColorStop(1, th.horizon);
    g.fillStyle = gr; g.fillRect(0, 0, W, HORIZON);
    // a ring of pylons around the arena
    for (let i = 0; i < 18; i++) {
      const x = (i + 0.5) * W / 18, h = 110 + ((i * 37) % 60), w = 16 + (i % 3) * 4;
      g.fillStyle = th.body; g.fillRect(x - w / 2, HORIZON - h, w, h);
      g.strokeStyle = th.a(0.35); g.lineWidth = 1.5; g.strokeRect(x - w / 2, HORIZON - h, w, h);
      g.fillStyle = th.b(0.6); g.fillRect(x - 1, HORIZON - h - 26, 2, 26);
    }
    const hz = g.createLinearGradient(0, HORIZON - 40, 0, HORIZON + 10);
    hz.addColorStop(0, th.a(0)); hz.addColorStop(1, th.a(0.35));
    g.fillStyle = hz; g.fillRect(0, HORIZON - 40, W, 50);
    // the floor: a receding grid
    gr = g.createLinearGradient(0, HORIZON, 0, H);
    gr.addColorStop(0, th.floorTop); gr.addColorStop(1, th.floorBot);
    g.fillStyle = gr; g.fillRect(0, HORIZON, W, H - HORIZON);
    g.strokeStyle = th.a(0.28); g.lineWidth = 1.2;
    for (let k = 1; k < 22; k++) { const y = HORIZON + (H - HORIZON) * Math.pow(k / 21, 2.1); g.globalAlpha = 0.3 + 0.7 * (k / 21); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = 1;
    for (let i = -24; i <= 24; i++) { g.beginPath(); g.moveTo(VPX + i * 12, HORIZON); g.lineTo(VPX + i * 150, H); g.stroke(); }
    // the duel circle
    g.strokeStyle = th.b(0.7); g.lineWidth = 3;
    g.beginPath(); g.ellipse(VPX, 560, 560, 150, 0, 0, 6.283); g.stroke();
    g.strokeStyle = th.b(0.18); g.lineWidth = 14; g.stroke();
    this.bg = c;
    this.vig = makeVignette(q);
    bitmapify(this.vig, (bm) => { this.vig = bm; });
    bitmapify(c, (bm) => { if (this.bg === c) this.bg = bm; });
  }

  render(ctx, Q = 1) {
    if (this.mode !== 'intro') { this.renderDuel(ctx, Q); return; }
    this.renderIntro(ctx, Q);
    // the last moments: the orbit has landed on the duel's own framing, so cross into the real view
    const a = clamp((this.t - (INTRO - BLEND)) / BLEND, 0, 1);
    if (a > 0) {
      const off = this.off || (this.off = document.createElement('canvas'));
      if (off.width !== ctx.canvas.width || off.height !== ctx.canvas.height) { off.width = ctx.canvas.width; off.height = ctx.canvas.height; }
      this.renderDuel(off.getContext('2d', { alpha: false }), Q, true);
      CTX = ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = smooth(a); ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1;
    }
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    const bars = 64 * (this.snap ? smooth(clamp((this.t - 0.3) / 1.2, 0, 1)) : 1) * (1 - smooth(clamp((this.t - (INTRO - 0.8)) / 0.8, 0, 1)));
    if (bars > 0.5) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, bars); ctx.fillRect(0, H - bars, W, bars); }
    this.drawBanner(ctx);
  }
  renderDuel(ctx, Q = 1, intro = false) {
    CTX = ctx;
    if (this.q !== Q) { this.q = Q; this.makeBG(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    const sx = (Math.random() - 0.5) * this.shake * 2, sy = (Math.random() - 0.5) * this.shake * 2;
    ctx.save(); ctx.translate(sx, sy);
    if (this.zoom) { const z = this.zoom.amt * Math.exp(-(this.t - this.zoom.t0) * 9); if (z > 0.001) { ctx.translate(this.zoom.x, this.zoom.y); ctx.scale(1 + z, 1 + z); ctx.translate(-this.zoom.x, -this.zoom.y); } }
    this.drawWorld(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawVignette(ctx, this.vig);
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    if (this.flash) { ctx.fillStyle = `rgba(${this.flash.c},${Math.max(0, this.flash.a)})`; ctx.fillRect(0, 0, W, H); }
    this.drawHUD(ctx, intro);
  }
  drawWorld(ctx) {
    const b = this.bossPos(), p = this.player, w = this.w;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(b.x, BY + 2, 62 * b.s, 9 * b.s, 0, 0, 6.283); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(glowSprite(this.th.neon2), b.x - 90 * b.s, BY - 20, 180 * b.s, 40); ctx.restore();
    const broken = this.mode === 'broken';
    let blade = null, brgb = null, bg = 0.3;
    if (this.tel) { const A = ATTACKS[this.tel.type]; blade = A.color; brgb = A.rgb; bg = 0.3 + 0.5 * this.tel.k; }
    this.bossPts = drawRig(ctx, { pose: this.boss.pose, x: b.x, y: b.y, s: b.s, view: 'front', ...this.rigLook(), blade, bladeRGB: brgb, bladeGlow: bg, hot: broken ? 0.5 + 0.5 * Math.sin(this.t * 22) : this.openings.some((o) => this.t >= o.start && this.t <= o.end) ? 0.5 : 0 });
    this.drawGhosts(ctx);
    if (this.tel && this.bossPts) {
      const A = ATTACKS[this.tel.type], k = clamp(this.tel.k, 0, 1), tip = this.bossPts.tip;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const s = 10 + k * 34; ctx.globalAlpha = clamp((k - 0.6) / 0.4, 0, 1);
      ctx.drawImage(glowSprite(A.color), tip.x - s, tip.y - s, s * 2, s * 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y - s); ctx.lineTo(tip.x + s * 0.16, tip.y); ctx.lineTo(tip.x, tip.y + s); ctx.lineTo(tip.x - s * 0.16, tip.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const f of this.fx.fx) if (f.k === 'wave') {
      const a = (this.fx.t - f.t0) / f.dur;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - a; ctx.strokeStyle = ATTACKS.slam.color; ctx.lineWidth = 8 * (1 - a) + 1;
      ctx.beginPath(); ctx.ellipse(PX, PY, 40 + a * 520, 10 + a * 60, 0, 0, 6.283); ctx.stroke(); ctx.restore();
    }
    for (const g of p.ghosts) {
      const a = (this.t - g.t0) / 0.36;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      drawRig(ctx, { pose: g.pose, x: PX + g.x - 30, y: PY + g.y, s: PS * g.s, view: 'back', tint: PLAYER_C, alpha: 0.3 * (1 - a), headR: 13, sword: 96 * w.len / 60, bladeW: w.width + 1, twin: w.twin });
      ctx.restore();
    }
    // the duck and the leap leave a bullet-time trail, as the step does in the side view
    const m = p.move, tr = m && (m.kind === 'duck' || m.kind === 'jump') && this.t < m.until ? Math.sin(clamp((this.t - m.t0) / (m.until - m.t0), 0, 1) * Math.PI) : 0;
    if (tr > 0.05) {
      const g = this.trailPose || (this.trailPose = { ...PP.idle });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const k of [0.35, 0.65]) {
        for (const key in g) g[key] = PP.idle[key];
        lerp(g, p.pose, k);
        drawRig(ctx, { pose: g, x: PX + p.x * k, y: PY + p.y * k, s: PS * p.s, view: 'back', tint: PLAYER_C, alpha: 0.32 * tr * (0.4 + k), headR: 13, sword: 96 * w.len / 60, bladeW: w.width + 1, twin: w.twin });
      }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(PX + p.x, PY + 4, 58 * p.s, 9 * p.s, 0, 0, 6.283); ctx.fill();
    drawRig(ctx, { pose: p.pose, x: PX + p.x, y: PY + p.y, s: PS * p.s, view: 'back', color: PLAYER_C, rgb: PLAYER_RGB, headR: 13, sword: 96 * w.len / 60, bladeW: w.width + 1.2, twin: w.twin, hot: this.t < p.riposteUntil ? 0.8 : this.t < p.guardUntil ? 0.4 : 0, blade: '#dffcff', bladeGlow: this.t < p.focusUntil ? 0.5 : 0.3 });
    for (const f of this.fx.fx) if (f.k === 'trail') this.drawTrail(ctx, f);
    this.fx.draw(ctx, txt);
    if (this.grade) {
      const age = this.t - this.grade.t0;
      if (age < 0.75) { ctx.globalAlpha = age < 0.5 ? 1 : 1 - (age - 0.5) / 0.25; txt(this.grade.s, PX - 240, 470 - age * 20, 34 * (1 + 0.45 * Math.max(0, 1 - age * 9)), this.grade.c); ctx.globalAlpha = 1; }
    }
    if (this.mode === 'broken' && fightWords(this.g.save)) { const h = this.bossPts.head; txt(btn('attack') + '  POWER STRIKE', h.x, h.y - 70, 18, '#ffffff'); }
  }
  /* incoming swings: only the blade, flying in from behind the dancer */
  drawGhosts(ctx) {
    const t = this.t, s = this.g.save;
    const items = this.cond.notes.filter((n) => !n.struck && !n.cancelled && n.time - t > 0 && n.time - t <= (n.lead || 1.4)).sort((a, b) => b.time - a.time);
    for (const n of items) {
      const lead = n.lead || 1.4, u = n.time - t, d = clamp(u / lead, 0, 1), a = Math.pow(1 - d, lead < 1.2 ? 0.8 : 1.15);
      const B = BLADES[n.type + sfxOf(n)], A = ATTACKS[n.type], gs = 1 - 0.55 * d, slam = n.type === 'slam';
      const dx = n.lane * 320 * Math.pow(d, 0.9), dy = (slam ? -25 : -130) * d;
      const map = (q) => ({ x: B.w.g.x + dx + (q.x - B.w.g.x) * gs, y: B.w.g.y + dy + (q.y - B.w.g.y) * gs });
      const g = map(B.w.g), tp = map(B.w.t), es = map(B.s.t);
      ctx.save(); ctx.lineCap = 'round';
      ctx.globalAlpha = a * (slam ? 0.8 : 0.5); ctx.strokeStyle = '#000000'; ctx.lineWidth = (slam ? 20 : 11) * gs + (slam ? 12 : 8);
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      if (slam) { const mx = (g.x + tp.x) / 2, my = (g.y + tp.y) / 2, pr = (70 + 10 * Math.sin(t * 14)) * (0.6 + 0.4 * gs); ctx.globalAlpha = a * 0.7; ctx.drawImage(glowSprite(A.color), mx - pr, my - pr, pr * 2, pr * 2); }
      // the dotted path of the swing, ending in an arrowhead
      const mx = (tp.x + es.x) / 2, my = (tp.y + es.y) / 2;
      let nx = -(es.y - tp.y), ny = es.x - tp.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (ny < 0) { nx = -nx; ny = -ny; }
      const off = Math.hypot(es.x - tp.x, es.y - tp.y) * 0.35, cx = mx + nx * off, cy = my + ny * off;
      ctx.globalAlpha = a * 0.38; ctx.strokeStyle = A.color; ctx.lineWidth = 7 * gs + 3; ctx.setLineDash([1, 12 * gs + 6]);
      ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.quadraticCurveTo(cx, cy, es.x, es.y); ctx.stroke(); ctx.setLineDash([]);
      const ax = es.x - cx, ay = es.y - cy, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al, hs = 14 * gs + 6;
      ctx.globalAlpha = a * 0.6; ctx.fillStyle = A.color;
      ctx.beginPath(); ctx.moveTo(es.x + ux * hs, es.y + uy * hs); ctx.lineTo(es.x - uy * hs * 0.6, es.y + ux * hs * 0.6); ctx.lineTo(es.x + uy * hs * 0.6, es.y - ux * hs * 0.6); ctx.closePath(); ctx.fill();
      // the blade
      ctx.globalAlpha = a * 0.35; ctx.strokeStyle = A.color; ctx.lineWidth = ((slam ? 16 : 11) * gs + 3) * 2.4;
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      ctx.globalAlpha = a; ctx.lineWidth = (slam ? 16 : 11) * gs + 3; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (slam ? 4.5 : 2.5) * gs + 1; ctx.stroke();
      ctx.fillStyle = A.color; ctx.beginPath(); ctx.arc(g.x, g.y, 6 * gs + 2, 0, 6.283); ctx.fill();
      ctx.restore();
      if (s.hints || (this.phase === 0 && fightWords(s))) { ctx.globalAlpha = a; txt(A.valid.map((v) => ({ duck: 'DUCK', jump: 'JUMP', dodge: 'STEP', block: 'BLOCK' }[v])).join(' · '), g.x, Math.min(g.y, tp.y) - 18, 13 + 3 * gs, A.color); ctx.globalAlpha = 1; }
    }
  }
  drawTrail(ctx, f) {
    const a = 1 - (this.fx.t - f.t0) / f.dur, col = ATTACKS[f.kind].color;
    if (a <= 0) return;
    const mx = (x) => (f.side < 0 ? 2 * (PX + 30) - x : x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      if (f.kind === 'slash') { ctx.moveTo(mx(BXc + 170), 250); ctx.quadraticCurveTo(mx(PX + 120), 470, mx(PX - 320), 370); }
      else if (f.kind === 'sweep') { ctx.moveTo(mx(BXc + 180), 600); ctx.quadraticCurveTo(mx(PX + 60), 755, mx(PX - 320), 660); }
      else { ctx.moveTo(PX + 50, 30); ctx.quadraticCurveTo(PX + 160, 380, PX + 10, PY - 2); }
    };
    ctx.globalAlpha = a * 0.5; ctx.strokeStyle = col; ctx.lineWidth = 40 * a + 6; path(); ctx.stroke();
    ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; path(); ctx.stroke();
    ctx.restore();
  }
  drawHUD(ctx, intro) {
    const s = this.g.save, mh = maxHP(s.stats);
    txt(this.B.name, W / 2, 30, 20, '#ffffff', 'center', 800);
    bar(ctx, W / 2 - 300, 50, 600, 9, this.bossHP / this.B.hp, this.B.look.color, 'rgba(255,255,255,.1)');
    for (let i = 0; i < this.B.phases.length; i++) {
      const x = W / 2 + 316 + i * 18, y = 54, left = i >= this.phase;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.fillStyle = left ? '#ffffff' : 'transparent';
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 6, y); ctx.closePath(); if (left) ctx.fill(); ctx.stroke();
    }
    const pf = clamp(this.bossPost / this.B.poise, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - 252, 68, 504, 10);
    ctx.fillStyle = this.mode === 'broken' && Math.sin(this.t * 20) > 0 ? '#ffffff' : pf > 0.75 ? '#ffffff' : '#9fe8d4';
    ctx.fillRect(W / 2 - 250 * pf, 70, 500 * pf, 6);
    ctx.fillStyle = '#19e0b0'; ctx.fillRect(W / 2 - 1, 66, 2, 14);
    bar(ctx, 40, H - 58, 260, 10, this.pHP / mh, '#3dff9a', 'rgba(61,255,154,.15)');
    const pp = clamp(this.pPost / 100, 0, 1);
    if (pp > 0.01) bar(ctx, 40, H - 42, 195, 5, pp, pp > 0.75 || this.player.stunUntil > this.t ? '#ffffff' : '#bfe9e0', 'rgba(255,255,255,.08)');
    for (let i = 0; i < s.flasksMax; i++) {
      const x = 48 + i * 20, y = H - 22, full = i < s.flasks;
      ctx.strokeStyle = full ? '#19e0b0' : 'rgba(25,224,176,.35)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(25,224,176,.55)';
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y); ctx.closePath(); if (full) ctx.fill(); ctx.stroke();
    }
    txt(this.w.name.toUpperCase(), W - 40, H - 40, 13, '#dffbea', 'right');
    if (fightWords(s)) txt(btn('dodge') + ' / ←→ step   ' + btn('jump') + ' jump   ' + btn('duck') + ' duck   ' + btn('block') + ' block   ' + btn('attack') + ' strike', W - 40, H - 20, 11, 'rgba(223,251,234,.45)', 'right', 600);
    if (!intro) this.drawBanner(ctx);
  }
  drawBanner(ctx) {
    const now = performance.now() / 1000;
    if (this.banner) {
      const age = now - this.banner.t0, d = this.banner.dur;
      if (age < d) {
        const a = age < 0.12 ? age / 0.12 : age > d - 0.35 ? (d - age) / 0.35 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,8,4,.55)'; ctx.fillRect(0, 130, W, 120);
        ctx.fillStyle = this.th.neon2; ctx.fillRect(W / 2 - 300, 151, 600, 1); ctx.fillRect(W / 2 - 300, 236, 600, 1);
        txt(this.banner.s, W / 2, 186, 50 * (1 + 0.1 * Math.max(0, 1 - age * 6)), this.banner.c, 'center', 800);
        if (this.banner.sub) txt(this.banner.sub, W / 2, 222, 17, '#cfeedd', 'center', 500);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function lerp(cur, tgt, k) { for (const key in tgt) cur[key] += (key === 'sa' ? wrapA(tgt[key] - cur[key]) : tgt[key] - cur[key]) * k; }
function blendTo(srcKey, dstKey, e, rate, extra) {
  const src = BP[srcKey], dst = BP[dstKey], o0 = BOFF[srcKey], o1 = BOFF[dstKey], pose = {};
  for (const key in dst) pose[key] = src[key] + (key === 'sa' ? wrapA(dst[key] - src[key]) : dst[key] - src[key]) * e;
  return { pose, x: o0[0] + (o1[0] - o0[0]) * e, y: o0[1] + (o1[1] - o0[1]) * e, s: o0[2] + (o1[2] - o0[2]) * e, rate, sway: 1, ...extra };
}
const ARM = ['lEx', 'lEy', 'rEx', 'rEy', 'lHx', 'lHy', 'rHx', 'rHy'];
function withGuard(base, g) {
  const r = { ...base };
  const dx = (base.lSx + base.rSx - g.lSx - g.rSx) / 2, dy = (base.lSy + base.rSy - g.lSy - g.rSy) / 2;
  for (const k of ARM) r[k] = g[k] + (k.endsWith('x') ? dx : dy);
  r.sa = g.sa; r.sl = g.sl; return r;
}

/* ---------- the intro's camera: a pinhole that turns about a point and never tilts ---------- */
const FOC = 900;
// placed so that, from straight behind, everything lands where the duel draws it
const IC = (() => {
  const pz = FOC / PS, h = (PY - HORIZON) / PS, px = (PX - VPX) / PS;
  const bz = FOC * h / (BY - HORIZON), bk = FOC / bz, bx = (BXc - VPX) / bk;
  return { pz, h, px, bz, bk, bx, bm: BS / bk, bm0: 1.25, mid: { x: (px + bx) / 2, z: (pz + bz) / 2 }, d0: 1250, h0: 330 };
})();
const mix = (a, b, k) => a + (b - a) * k;
const easeIO = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
function project(c, X, Y, Z) {
  const dx = X - c.x, dz = Z - c.z, z = dx * c.fx + dz * c.fz, s = FOC / z;
  return { x: VPX + (dx * c.rx + dz * c.rz) * s, y: HORIZON - (Y - c.y) * s, z, s };
}
/** A floor line, cut where it passes behind the lens. */
function seg3(ctx, c, x0, z0, x1, z1) {
  const NEAR = 30, d0 = (x0 - c.x) * c.fx + (z0 - c.z) * c.fz, d1 = (x1 - c.x) * c.fx + (z1 - c.z) * c.fz;
  if (d0 < NEAR && d1 < NEAR) return;
  if (d0 < NEAR) { const k = (NEAR - d0) / (d1 - d0); x0 += (x1 - x0) * k; z0 += (z1 - z0) * k; }
  else if (d1 < NEAR) { const k = (NEAR - d1) / (d0 - d1); x1 += (x0 - x1) * k; z1 += (z0 - z1) * k; }
  const a = project(c, x0, 0, z0), b = project(c, x1, 0, z1);
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
}
// how far each joint sits in front of the body, so the figures have depth when seen side-on
const PZD = { hip: 0, chest: 2, head: 6, lS: -4, rS: -4, lE: 16, rE: 18, lH: 34, rH: 36, lK: 10, rK: 12, lF: -16, rF: 18 };
const BZD = { hip: 0, chest: 4, head: 8, lS: -2, rS: -2, lE: 20, rE: 20, lH: 38, rH: 38, lK: 10, rK: 10, lF: -18, rF: 20 };
const JOINTS = Object.keys(PZD);
/** A flat front/back pose stood up in the arena and photographed from the intro camera. */
function figure3D(c, f) {
  const P = f.pose, B = f.base, m = f.m, s = B.s * m, W3 = f.world, dk = 1 - 0.9 * c.eR * c.eR;   // depth fades as we come round behind
  const out = {}, J = {};
  const at = (k) => ({ x: W3.x + P[k + 'x'] * m, y: W3.y - P[k + 'y'] * m, z: W3.z + f.face * f.zd[k] * m * dk });
  for (const k of JOINTS) {
    const w = at(k), q = project(c, w.x, w.y, w.z);
    J[k] = q; out[k + 'x'] = (q.x - B.x) / s; out[k + 'y'] = (q.y - B.y) / s;
  }
  const blade = (hand, dx, dy, len) => {
    const h = J[hand], L = f.o.sword * len * m, wh = at(hand);
    const tip = project(c, wh.x + dx * L, wh.y - dy * L, wh.z + f.face * 0.35 * dk * L);
    return [Math.atan2(tip.y - h.y, tip.x - h.x), Math.hypot(tip.x - h.x, tip.y - h.y) / (f.o.sword * s)];
  };
  [out.sa, out.sl] = blade('rH', Math.cos(P.sa), Math.sin(P.sa), P.sl);
  if (f.o.twin) [out.sa2, out.sl2] = blade('lH', -Math.cos(P.sa), Math.sin(P.sa), P.sl * 0.92);
  return { pose: out, x: B.x, y: B.y, s };
}
const MOTES = Array.from({ length: 70 }, (_, i) => {
  const r = (n) => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
  const a = r(1) * 6.283, d = 200 + r(2) * 1500;
  return { x: IC.mid.x + Math.cos(a) * d, z: IC.mid.z + Math.sin(a) * d, y: r(3) * 520, v: 12 + r(4) * 26, a: 0.25 + r(5) * 0.5, c: r(6) < 0.3 ? '#bff9ff' : '#3dff9a' };
});
// the floor ring that, from behind, sits where the duel's painted ellipse is
const RING = (() => { const zn = FOC * IC.h / (H - 10 - HORIZON), zf = FOC * IC.h / (410 - HORIZON); return { z: (zn + zf) / 2, rz: (zf - zn) / 2, rx: 1.22 * 560 * IC.h / 260 }; })();
const INTRO = 6, BLEND = 0.5;
