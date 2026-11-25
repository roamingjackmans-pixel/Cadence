// A quick tutorial at the start of a new game, in the Boot Chamber: move, jump, then a training echo that throws one
// strike type at a time until you answer it twice in a row, a fast pair, and finally a poise break and power strike.
// Walk on past the chamber (or pick Skip in the pause menu) to leave it.
import { ATTACKS, ENEMIES } from './data.js';
import { input, btn } from './input.js';
import { sfx } from './audio.js';
import { T } from './level.js';

const pad = () => input.device === 'pad';
const DRILL_X = 21 * T;        // where the training echo stands
const LEAVE_X = 29 * T;        // walking past here ends the tutorial

const STEPS = [
  { title: 'MOVE', color: '#eafff3', line: () => (pad() ? 'Left stick' : 'A / D') + ' to move' },
  { title: 'JUMP', color: '#eafff3', line: () => btn('jump') + ' to jump. Hold it to go higher.' },
  { title: 'SLASH', type: 'slash', force: 'R', need: 2, line: () => btn('duck') + ' duck under it, or ' + btn('block') + ' block it' },
  { title: 'SWEEP', type: 'sweep', force: 'Y', need: 2, line: () => btn('jump') + ' jump over it, or ' + btn('block') + ' block it' },
  { title: 'SLAM', type: 'slam', force: 'P', need: 2, line: () => btn('dodge') + ' lean out of the way, or ' + btn('block') + ' block it' },
  { title: 'TOO FAST TO BLOCK TWICE', color: '#eafff3', force: 'Yy', beat: 0.44, need: 2,
    line: () => 'Your guard needs a moment. Jump the first sweep with ' + btn('jump') + ', then block the second with ' + btn('block') + ' on the way down.' },
  { title: 'POWER STRIKE', color: '#eafff3', mixed: true,
    line: () => 'Every answer fills its poise bar. When it breaks, strike with ' + btn('attack') + '. Let up and the bar drains.' },
  { title: 'THE CIRCUIT IS YOURS', color: '#3dff9a', end: 6,
    line: () => 'Rest at beacons (' + btn('interact') + ') to heal, level up and change swords. ' + (pad() ? 'Back' : 'I') + ' hides the answer hints.' },
];

export class Tutorial {
  constructor(world) {
    this.w = world; this.i = 0; this.ok = 0; this.x0 = world.p.x; this.jumped = false;
    this.wait = 0; this.t0 = performance.now() / 1000; this.drill = null; this.done = false;
  }
  get cur() { return STEPS[this.i]; }

  /** The training echo: a Grid Sentinel that never hurts you and can't be broken until the last lesson. */
  makeDrill() {
    const w = this.w, def = { ...ENEMIES.sentinel, name: 'Training Echo', dmg: 0, slamDmg: 0, hp: 40, poise: 24, echoes: 0, beat: 0.8, open: 1.2, rest: [0.9, 1.3], phrases: ['R'] };
    const e = w.makeEnemy({ id: 'drill', type: 'sentinel', def, x: DRILL_X, y: 30 * T });
    e.state = 'aggro'; e.drill = true; e.face = -1;
    w.enemies.push(e); w.fx.ring(e.x, e.y - 30, '#ffffff', 90, 0.4, 4); sfx('evade');
    return e;
  }

  next() {
    this.i++; this.ok = 0; this.wait = 0.9; this.t0 = performance.now() / 1000;
    sfx('perfect');
    if (this.i >= STEPS.length) this.end();
  }
  end() {
    if (this.done) return;
    this.done = true; this.w.tut = null;
    if (this.drill && !this.drill.dead) { this.drill.dead = true; this.w.cond.cancelOwner(this.drill, this.w.t, true); this.drill.slot = 0; }
    this.w.g.save.tutorialDone = true; this.w.g.persist();
  }

  step(dt) {
    const w = this.w, p = w.p, S = this.cur;
    if (p.x > LEAVE_X) { this.end(); return; }
    if (this.wait > 0) { this.wait -= dt; return; }
    if (p.vy < -200 && !p.onGround) this.jumped = true;
    if (this.i === 0) { if (Math.abs(p.x - this.x0) > 80) this.next(); return; }
    if (this.i === 1) { if (this.jumped) this.next(); return; }
    if (S.end) { if (performance.now() / 1000 - this.t0 > S.end) this.next(); return; }
    // the drill lessons: bring the echo back if resting or dying cleared it
    if (!this.drill || (!w.enemies.includes(this.drill) && !this.drill.dead)) this.drill = this.makeDrill();
    const e = this.drill;
    if (S.mixed) {
      e.def.phrases = ['R', 'Y', 'P', 'RY', 'PR']; e.def.beat = 0.7; e.force = null;
      if (e.dead) this.next();
      return;
    }
    e.force = S.force; e.def.beat = S.beat || 0.8;
    e.poise = 0; e.hp = e.def.hp;          // no breaking it early
    for (const n of w.cond.notes) {
      if (n.owner !== e || !n.applied || n.tutSeen) continue;
      n.tutSeen = true;
      if (n.result === 'perfect' || n.result === 'good') { if (++this.ok >= S.need) { this.next(); return; } }
      else if (n.result === 'miss') this.ok = 0;
    }
  }

  /** What the HUD shows: a title in the strike's colour, the instruction, and progress pips. */
  panel() {
    const S = this.cur;
    if (!S) return null;
    const color = S.type ? ATTACKS[S.type].color : S.color;
    return { title: S.title, color, line: S.line(), need: S.need || 0, ok: this.ok, n: this.i, of: STEPS.length - 1, fade: this.wait > 0 ? this.wait / 0.9 : 0 };
  }
}
