// The side-scrolling world: movement, enemies, the rhythm combat, beacons, items and death.
import { W, H, clamp, rnd, pick, sign } from './util.js';
import { ATTACKS, ENEMIES, WEAPONS, BASE_WIN, DUR, LEAD, ACT_NAME, maxHP } from './data.js';
import { Conductor } from './combat.js';
import { buildLevel, T } from './level.js';
import { LevelArt, NEON, NEON2, Z, drawVignette } from './render2d.js';
import { POSES, lerpPose, copyPose, drawFigure } from './rig.js';
import { FX, glowSprite } from './fx.js';
import { input, btn } from './input.js';
import { sfx } from './audio.js';
import { txt as txtC, bar } from './hud.js';

let CTX = null;
const txt = (s, x, y, size, c, align, weight) => txtC(CTX, s, x, y, size, c, align, weight);

const VW = W / Z, VH = H / Z;
// JV is the full jump (held for height), HOP the small jump on RT: about a tile and a quarter
const RUN = 255, JV = 780, HOP = 440, NEAR_FOE = 155, GRAV = 2600, MAXFALL = 1100, STEP = 1 / 120;
const wrap = (s, n) => { const out = []; let cur = ''; for (const w of s.split(' ')) { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) out.push(cur); return out; };
const PLAYER_C = '#5ff3ff', PLAYER_RGB = '95,243,255';
const ENEMY_C = '#e9fbff', ENEMY_RGB = '233,251,255';
const CLASH_Y = { slash: 40, sweep: 10, slam: 62 };

export class World {
  constructor(game) {
    this.g = game;
    this.L = buildLevel();
    this.art = new LevelArt(this.L);
    this.fx = new FX(700);
    this.cond = new Conductor();
    this.t = 0; this.acc = 0; this.hitstop = 0; this.shake = 0; this.flash = null;
    this.cam = { x: 0, y: 0 };
    this.banner = null; this.grade = null; this.seenRegion = new Set(); this.prompt = null;
    this.cut = null;            // the walk into the arena
    this.autoplay = false;      // for recordings: answers every strike
    this.applySave();
  }

  /* ---------- setup ---------- */
  applySave() {
    const s = this.g.save;
    if (s.gateOpen) this.openGateTiles();
    if (s.bossDead) for (let r = 30; r <= 33; r++) this.L.tiles[r * this.L.cols + this.L.bossDoor.c] = 0;
  }
  openGateTiles() { const G = this.L.gate; for (let r = G.r0; r <= G.r1; r++) this.L.tiles[r * this.L.cols + G.c] = 0; }

  /** Puts the player at a beacon (or the start), refills, and brings every enemy back. */
  spawn(beaconId, refill = true) {
    const s = this.g.save, b = this.L.beacons.find((x) => x.id === beaconId) || this.L.start;
    if (this.tut && b.id !== 'b1') this.tut.end();
    this.cond = new Conductor();
    this.fx.clear();
    this.enemies = this.L.enemies.map((d) => this.makeEnemy(d));
    const wp = WEAPONS[s.equipped];
    this.p = {
      x: b.x + 40, y: b.y, vx: 0, vy: 0, w: 20, h: 62, onGround: true, face: 1, coyote: 0,
      hp: refill ? maxHP(s.stats) : this.p?.hp ?? maxHP(s.stats), poise: 0, pose: copyPose(POSES.idle), weapon: wp,
      move: null, guardUntil: -9, blockKind: 'slash', atk: null, atkReady: 0, lockUntil: 0, stunUntil: 0, hurtUntil: 0,
      heal: null, focusUntil: 0, riposteUntil: 0, dead: false, deadT: 0, lastLand: 0, ghostT: 0, walkPh: 0, rest: false,
    };
    if (refill) s.flasks = s.flasksMax;
    this.t = 0; this.grade = null; this.areaName = null;   // the clock restarts, so anything timed by it goes too
    this.cam.x = this.p.x - VW / 2; this.cam.y = this.p.y - VH * 0.6;
    this.clampCam();
    this.art.warm(this.p.x, this.p.y);
  }
  makeEnemy(d) {
    const def = d.def || ENEMIES[d.type];
    return {
      d, def, type: d.type, x: d.x, y: d.y, vx: 0, vy: 0, onGround: true, face: -1, hp: def.hp, poise: 0, lastPoise: -9,
      state: d.ambush ? 'perched' : 'idle', slot: 0, nextPlan: 0, openStart: -9, openEnd: -9, brokenUntil: 0, dead: false,
      pose: copyPose(POSES.idle), recoilT: -9, flinchT: -9, knockUntil: 0, walkPh: rnd(0, 6), deathT: 0, hp0: def.hp,
      weapon: { len: def.blade, width: def.look === 'hammer' ? 5 : def.look === 'rapier' ? 2 : 3.4, claw: def.look === 'claw', hammer: def.look === 'hammer' },
      s: def.h / 100, w: def.w, h: def.h, home: d.x,
    };
  }

  /* ---------- timing windows ---------- */
  win(action, type) {
    const s = this.g.save, w = this.p.weapon;
    const mult = action === 'block' ? w.block[type] : w.evade[action];
    const focus = (1 + 0.015 * (s.stats.focus - 8)) * (this.t < this.p.focusUntil ? 1.25 : 1);
    const good = BASE_WIN.good * mult * focus;
    const perfect = Math.min(good * 0.85, BASE_WIN.perfect * mult * (action === 'block' ? w.perfect : 1) * focus);
    return { perfect, good };
  }
  lateFor(type) { let m = 0; for (const a of ATTACKS[type].valid) m = Math.max(m, this.win(a, type).good); return m; }
  attackers() { return this.enemies.filter((e) => e.slot !== 0 && !e.dead); }

  /* ---------- main update ---------- */
  update(dt, presses, nowMs) {
    if (this.g.menuOpen) return;
    this.acc += dt;
    // presses are judged at the moment they happened
    for (const pr of presses) this.press(pr.a, Math.max(this.t - 0.05, this.t - (nowMs - pr.t) / 1000));
    let n = 0;
    while (this.acc >= STEP && n < 10) { this.step(STEP); this.acc -= STEP; n++; }
    if (n === 10) this.acc = 0;
    this.updateCamera(dt);
    this.fx.update(this.hitstop > 0 ? dt * 0.25 : dt);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.shake *= Math.exp(-dt * 10);
    if (this.flash) { this.flash.a -= dt * 2.4; if (this.flash.a <= 0) this.flash = null; }
  }

  step(dt) {
    this.t += dt;
    const t = this.t, p = this.p;
    if (this.cut) { this.stepCut(dt); return; }
    this.stepPlayer(dt);
    for (const e of this.enemies) if (!e.dead) this.stepEnemy(e, dt);
    this.assignSlots();
    this.stepNotes();
    if (this.autoplay) this.auto();
    // poise recovers
    if (t >= p.stunUntil) p.poise = Math.max(0, p.poise - (this.attackers().length ? 9 : 22) * dt);
    if (this.tut) this.tut.step(dt);
    this.cond.prune(t);
    this.checkPickups();
    this.regionBanner();
  }

  /* ---------- player ---------- */
  press(a, t, from) {
    const p = this.p, s = this.g.save;
    if (p.dead || this.cut || p.rest) return;
    if (a === 'hints') { s.hints = !s.hints; this.g.persist(); return; }
    if (t < p.stunUntil) return;
    if (a === 'interact') { this.interact(); return; }
    // the pad's A: interact when nothing is attacking you and there is something to use, otherwise jump
    if (a === 'hop') { this.press('jump', t, 'hop'); return; }
    if (a === 'padA') { if (this.attackers().length || !this.interact()) this.press('jump', t, 'padA'); return; }
    if (a === 'heal') { this.startHeal(); return; }
    if (a === 'attack') { this.startAttack(); return; }
    if (a !== 'block' && a !== 'jump' && a !== 'duck' && a !== 'dodge') return;
    if (t < p.lockUntil) return;
    const air = !p.onGround && p.coyote <= 0;
    if (a !== 'block' && air) return;
    // aim: the stick (or keys) held at the moment of a block chooses which attacker it faces
    const ax = input.axisX();
    if (a === 'block' && Math.abs(ax) > 0.3) p.face = sign(ax);
    const atk = this.attackers();
    const tg = this.cond.target(a, t, (x, y) => this.win(x, y), (n) => atk.length < 2 || sign(n.owner.x - p.x) === p.face);
    if (a === 'block' && tg && this.cond.blockRefused(tg.n)) {
      this.fx.float('TOO FAST TO BLOCK', p.x, p.y - 96, '#cfe9e0', 15); sfx('tooFast'); p.lockUntil = t + 0.08; return;
    }
    p.atk = null; p.heal = null;
    if (a === 'block') {
      if (tg && atk.length < 2) p.face = sign(tg.n.owner.x - p.x);
      p.blockKind = tg ? tg.n.type : this.nextType() || 'slash';
      p.guardUntil = this.t + DUR.block;
      if (p.move && p.move.kind === 'duck' && this.t < p.move.until) p.move.until = Math.max(p.move.until, p.guardUntil);   // stay down through the block
      if (!tg) p.lockUntil = t + 0.2;   // spamming the guard leaves you open
    } else if (a === 'jump') {
      if (input.down() && this.onPlatform()) { p.y += 3; p.dropUntil = this.t + 0.2; p.onGround = false; return; }
      // the tall jump is for getting around: in a fight, or within about 15 ft of an enemy, every jump is the small one
      const hop = from === 'hop' || this.nearFoe();
      p.vy = hop ? -HOP : -JV; p.onGround = false; p.coyote = 0; p.jumpHeld = !hop; p.jumpKey = from === 'padA' ? 'padA' : 'jump'; p.move = null; p.guardUntil = -9; sfx('jump');
    } else {
      p.move = { kind: a, t0: this.t, until: this.t + DUR[a] };
      p.guardUntil = -9;
      if (a === 'dodge') sfx('evade');
    }
    if (!tg) return;
    tg.n.result = tg.perfect ? 'perfect' : 'good'; tg.n.action = a;
    if (t >= tg.n.time) this.apply(tg.n);
  }
  nextType() { const n = this.cond.notes.find((m) => !m.result && m.time > this.t - 0.1); return n && n.type; }
  /** In combat, or a living enemy within about 15 ft (the player is 62 px, about 6 ft). */
  nearFoe() { const p = this.p; return this.attackers().length > 0 || this.enemies.some((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < NEAR_FOE); }
  onPlatform() { const p = this.p; return this.tileAt(p.x, p.y + 2) === 2 && this.tileAt(p.x, p.y - 2) !== 2; }

  startAttack() {
    const p = this.p, t = this.t;
    if (t < p.atkReady || p.heal || t < p.stunUntil) return;
    const w = p.weapon, broken = this.lethalTarget();
    p.atk = { t0: t, dur: w.dur * (broken ? 1.2 : 1), hits: broken ? [0.18] : w.hits.slice(), done: 0, lethal: !!broken, target: broken };
    p.atkReady = t + p.atk.dur * 0.92; p.move = null; p.guardUntil = -9;
    sfx('swing');
  }
  startHeal() {
    const p = this.p, s = this.g.save;
    if (p.heal || p.atk || s.flasks <= 0 || !p.onGround || this.t < p.stunUntil) return;
    p.heal = { t0: this.t, at: this.t + 0.5, until: this.t + 0.9, done: false };
  }

  stepPlayer(dt) {
    const p = this.p, t = this.t, s = this.g.save;
    if (p.dead) { p.vx *= 0.9; this.physics(p, dt, false); this.poseTo(p, POSES.dead, 10, dt); if (t - p.deadT > 2.4 && !p.reported) { p.reported = true; this.g.onDeath(); } return; }
    if (p.rest) { p.vx = 0; this.physics(p, dt, false); this.poseTo(p, POSES.rest, 8, dt); return; }
    const ax = input.axisX();
    const busy = t < p.stunUntil || (p.move && t < p.move.until) || (p.heal && t < p.heal.until);
    let speed = RUN;
    if (this.attackers().length) speed *= 0.7;
    if (p.atk) speed *= 0.25;
    if (t < p.guardUntil) speed *= 0.3;
    if (p.heal) speed *= 0.3;
    const target = busy && !(p.heal) ? 0 : ax * speed;
    p.vx += (target - p.vx) * Math.min(1, dt * (p.onGround ? 18 : 7));
    if (ax && !p.atk && t >= p.stunUntil) p.face = sign(ax);
    // variable jump height
    if (p.jumpHeld && !input.held(p.jumpKey || 'jump') && p.vy < -260) { p.vy *= 0.55; p.jumpHeld = false; }
    const wasGround = p.onGround;
    this.physics(p, dt, true);
    if (p.onGround) { p.coyote = 0.08; if (this.tileAt(p.x - 8, p.y + 2) && this.tileAt(p.x + 8, p.y + 2)) { p.safeX = p.x; p.safeY = p.y; } } else p.coyote -= dt;
    if (!wasGround && p.onGround) { p.jumpHeld = false; if (t - p.lastLand > 0.2) sfx('land'); p.lastLand = t; }
    // body contact with enemies: you can only pass them in the air
    for (const e of this.enemies) {
      if (e.dead || e.state === 'perched' || !p.onGround || !e.onGround) continue;
      const min = (p.w + e.w) / 2, dx = p.x - e.x;
      if (Math.abs(dx) < min && Math.abs(p.y - e.y) < 40) { const push = (min - Math.abs(dx)) * sign(dx || -e.face); p.x += push; }
    }
    // attack
    if (p.atk) {
      const a = p.atk, k = t - a.t0;
      while (a.done < a.hits.length && k >= a.hits[a.done]) { this.resolveHit(a); a.done++; }
      if (k >= a.dur) p.atk = null;
    }
    // heal
    if (p.heal && !p.heal.done && t >= p.heal.at) {
      p.heal.done = true; s.flasks--; p.hp = Math.min(maxHP(s.stats), p.hp + maxHP(s.stats) * 0.45);
      this.fx.motes(p.x, p.y - 40, 16, NEON2, 90, 60); sfx('heal');
    }
    if (p.heal && t >= p.heal.until) p.heal = null;
    if (p.y > this.L.rows * T + 120) this.kill('FELL INTO THE DARK');
    this.animPlayer(dt);
  }

  animPlayer(dt) {
    const p = this.p, t = this.t;
    let pose = POSES.idle, rate = 14;
    if (t < p.stunUntil) { pose = POSES.stun; rate = 12; }
    else if (t < p.hurtUntil) { pose = POSES.hurt; rate = 30; }
    else if (p.atk) {
      const k = t - p.atk.t0, h0 = p.atk.hits[0];
      if (p.atk.lethal) { pose = k < 0.15 ? POSES.attackW : POSES.lethal; rate = k < 0.15 ? 26 : 50; }
      else if (k < h0) { pose = POSES.attackW; rate = 30; }
      else { pose = p.weapon.twin && p.atk.done > 1 ? POSES.attack2 : POSES.attack; rate = 60; }
    } else if (t < p.guardUntil) {
      // blocking from a duck keeps the crouch and brings the blade up from it
      const low = p.move && p.move.kind === 'duck' && t < p.move.until, k = p.blockKind === 'sweep' ? 'Sweep' : p.blockKind === 'slam' ? 'Slam' : 'Slash';
      pose = POSES[(low ? 'duckBlock' : 'block') + k]; rate = 50;
    }
    else if (p.move && t < p.move.until) { pose = p.move.kind === 'duck' ? POSES.duck : POSES.dodge; rate = 45; }
    else if (p.heal) { pose = POSES.heal; rate = 14; }
    else if (!p.onGround) { pose = p.vy < 0 ? POSES.jump : POSES.fall; rate = 16; }
    else if (Math.abs(p.vx) > 30) { p.walkPh += dt * Math.abs(p.vx) / 26; pose = Math.sin(p.walkPh) > 0 ? POSES.run1 : POSES.run2; rate = 16; }
    this.poseTo(p, pose, rate, dt);
  }
  poseTo(o, pose, rate, dt) { lerpPose(o.pose, pose, 1 - Math.exp(-rate * (this.hitstop > 0 ? dt * 0.2 : dt))); }

  /** Moves a body and resolves it against the tiles. */
  physics(o, dt, isPlayer) {
    o.vy = Math.min(MAXFALL, o.vy + GRAV * dt);
    // x
    o.x += o.vx * dt;
    const hw = o.w / 2;
    for (const yy of [o.y - 4, o.y - o.h / 2, o.y - o.h + 2]) {
      if (this.solid(o.x + hw, yy)) { o.x = Math.floor((o.x + hw) / T) * T - hw - 0.01; o.vx = 0; }
      if (this.solid(o.x - hw, yy)) { o.x = Math.floor((o.x - hw) / T) * T + T + hw + 0.01; o.vx = 0; }
    }
    // y
    const prevY = o.y;
    o.y += o.vy * dt;
    o.onGround = false;
    if (o.vy >= 0) {
      const top = Math.floor(o.y / T) * T;
      for (const xx of [o.x - hw + 2, o.x + hw - 2]) {
        const v = this.tileAt(xx, o.y);
        if (v === 1 || v === 3 || (v === 2 && prevY <= top + 0.5 && !(this.t < (o.dropUntil || 0)))) {
          o.y = top; o.vy = 0; o.onGround = true; break;
        }
      }
    } else {
      for (const xx of [o.x - hw + 2, o.x + hw - 2]) if (this.solid(xx, o.y - o.h)) { o.y = Math.floor((o.y - o.h) / T) * T + T + o.h; o.vy = 0; break; }
    }
  }
  tileAt(x, y) {
    const L = this.L, c = Math.floor(x / T), r = Math.floor(y / T);
    if (c < 0 || c >= L.cols || r < 0) return 1;
    if (r >= L.rows) return 0;
    return L.tiles[r * L.cols + c];
  }
  solid(x, y) { const v = this.tileAt(x, y); return v === 1 || v === 3; }

  /* ---------- enemies ---------- */
  stepEnemy(e, dt) {
    const p = this.p, t = this.t, def = e.def;
    const dx = p.x - e.x, dist = Math.abs(dx), dy = p.y - e.y;
    if (e.state === 'perched') {
      this.poseTo(e, POSES.idle, 6, dt);
      e.face = sign(dx) || -1;
      if (!p.dead && p.x > e.d.ambush && Math.abs(p.y - (e.y + 6 * T)) < 80) {
        e.state = 'aggro'; e.vy = -520; e.leapTo = p.x - 120; e.vx = (e.leapTo - e.x) / 0.85; e.leaping = true; e.dropUntil = t + 2; sfx('evade');
        this.fx.float('!', e.x, e.y - e.h - 20, '#ffffff', 26);
      }
      return;
    }
    if (e.leaping) {
      this.physics(e, dt, false);
      this.poseTo(e, POSES.jump, 12, dt);
      if (e.onGround && e.vy === 0 && t > 0.1) { e.leaping = false; e.vx = 0; this.fx.ring(e.x, e.y, NEON2, 60, 0.3, 4); this.shake = Math.max(this.shake, 4); }
      return;
    }
    // awareness
    if (e.state === 'idle' && !p.dead && dist < 380 && Math.abs(dy) < 110) e.state = 'aggro';
    if (e.state === 'aggro' && (p.dead || dist > 760 || Math.abs(dy) > 260)) { e.state = 'idle'; this.cond.cancelOwner(e, t); e.slot = 0; }
    // broken: waiting for a lethal strike
    if (e.brokenUntil > t) { e.vx = 0; this.physics(e, dt, false); this.poseTo(e, POSES.broken, 10, dt); return; }
    if (e.brokenUntil && t >= e.brokenUntil) { e.brokenUntil = 0; e.poise = def.poise * 0.6; if (e.hp <= 0) e.hp = def.hp * 0.15; this.fx.float('RECOVERED', e.x, e.y - e.h - 30, '#cfe9e0', 14); }
    // poise drains when you stop pressing, fast when you back away
    const backing = e.state === 'aggro' && dist > def.engage + 70;
    if (t - e.lastPoise > 1.6 || backing) e.poise = Math.max(0, e.poise - (backing ? 18 : 4) * dt);
    // movement
    let want = 0;
    const striking = this.cond.notes.some((n) => n.owner === e && !n.applied && t >= n.time - n.chamber - 0.05);
    if (e.state === 'aggro') {
      e.face = sign(dx) || e.face;
      const hold = e.slot ? def.engage : def.engage + 95;
      // enemies close in and then hold their ground: walking into one never shoves it back (owner)
      if (!striking && t > e.knockUntil && dist > hold + 8) want = sign(dx) * def.speed * (e.slot ? 1 : 0.8);
    } else if (Math.abs(e.x - e.home) > 8) { want = sign(e.home - e.x) * def.speed * 0.5; e.face = sign(want); }
    // don't walk off ledges
    if (want && e.onGround) { const ahead = e.x + sign(want) * (e.w / 2 + 4), v = this.tileAt(ahead, e.y + 4); if (v === 0) want = 0; }
    e.vx += (want - e.vx) * Math.min(1, dt * 10);
    this.physics(e, dt, false);
    if (e.y > this.L.rows * T + 80) { e.dead = true; this.cond.cancelOwner(e, t, true); return; }
    // plan the next phrase
    if (e.slot && t >= e.nextPlan && !this.cond.notes.some((n) => n.owner === e && !n.applied) && dist < def.engage + 60 && Math.abs(dy) < 50 && !this.p.dead) {
      const twoOn = this.attackers().length > 1;
      let phrases = e.force ? [e.force] : def.phrases;   // the tutorial's echo plays one phrase on repeat
      if (twoOn) phrases = phrases.filter((x) => x.replace(/-/g, '').length <= 2);
      const ph = pick(phrases.length ? phrases : def.phrases);
      const notes = this.cond.plan(e, ph, def.beat, t + 1.05, t, {
        side: sign(e.x - p.x), maxShift: twoOn ? 1.4 : 0.6,
        chamber: (type, gap) => Math.min(type === 'slam' ? 0.5 : 0.42, Math.max(0.17, gap * 0.85)),
      });
      if (notes) {
        const last = notes[notes.length - 1].time;
        e.openStart = last + 0.14; e.openEnd = e.openStart + def.open; e.nextPlan = e.openEnd + rnd(def.rest[0], def.rest[1]) * (twoOn ? 1.3 : 1);
      } else e.nextPlan = t + 0.3;
    }
    this.animEnemy(e, dt, striking);
  }

  animEnemy(e, dt, striking) {
    const t = this.t;
    let pose = POSES.idle, rate = 8;
    e.tel = null;
    if (t - e.flinchT < 0.16) { pose = POSES.hurt; rate = 30; }
    else if (t - e.recoilT < 0.14) { pose = POSES.hurt; rate = 40; }
    else {
      const mine = this.cond.notes.filter((n) => n.owner === e && !n.cancelled);
      let done = false;
      for (let i = 0; i < mine.length && !done; i++) {
        const n = mine[i], nx = mine[i + 1];
        if (t > n.time + 0.16) continue;
        if (t >= n.time) { if (nx && t >= nx.time - nx.chamber) continue; pose = POSES[n.type + 'S']; rate = 50; done = true; break; }
        const cs = n.time - n.chamber;
        if (t >= cs) { pose = POSES[n.type + 'W']; rate = n.chamber < 0.25 ? 55 : 30; e.tel = { type: n.type, k: (t - cs) / n.chamber }; done = true; break; }
        if (n.time - t < LEAD) { e.tel = { type: n.type, k: 0 }; }
        break;
      }
      if (!done && t >= e.openStart && t <= e.openEnd) { pose = POSES.open; rate = 12; }
      else if (!done && Math.abs(e.vx) > 20) { e.walkPh += dt * Math.abs(e.vx) / 22; pose = Math.sin(e.walkPh) > 0 ? POSES.run1 : POSES.run2; rate = 14; }
    }
    this.poseTo(e, pose, rate, dt);
  }

  /** One attacker each side of you: the nearest that can reach you. The rest hang back. */
  assignSlots() {
    const p = this.p, t = this.t;
    const best = { '-1': null, '1': null };
    for (const e of this.enemies) {
      if (e.dead || e.state !== 'aggro' || e.leaping || e.brokenUntil > t) continue;
      const d = Math.abs(e.x - p.x);
      if (d > e.def.engage + 110 || Math.abs(e.y - p.y) > 50) continue;
      const side = sign(e.x - p.x);
      if (!best[side] || d < Math.abs(best[side].x - p.x)) best[side] = e;
    }
    for (const e of this.enemies) {
      const side = e === best['-1'] ? -1 : e === best['1'] ? 1 : 0;
      if (e.slot && !side) this.cond.cancelOwner(e, t);
      else if (e.slot && side && side !== e.slot) this.cond.cancelOwner(e, t);
      e.slot = side;
    }
  }

  /* ---------- strikes landing ---------- */
  stepNotes() {
    const t = this.t, p = this.p;
    for (const n of this.cond.notes) {
      if (n.cancelled || n.applied) continue;
      const e = n.owner;
      if (!n.struck && t >= n.time) {
        n.struck = true; sfx(n.type);
        const dir = sign(p.x - e.x), y = e.y - CLASH_Y[n.type] * (e.h / 64);
        if (n.type === 'slam') { this.fx.cut(e.x + dir * 50, e.y - e.h * 0.9, Math.PI / 2 + dir * 0.35, e.h * 1.4, ATTACKS.slam.color, 0.26, 10); this.fx.ring(e.x + dir * 60, e.y, ATTACKS.slam.color, 120, 0.4, 6); this.shake = Math.max(this.shake, 6); }
        else this.fx.cut(e.x + dir * 50, n.type === 'sweep' ? e.y - 10 : y, dir > 0 ? 0.08 : -0.08, 130, ATTACKS[n.type].color, 0.22, 9);
      }
      if (n.result && t >= n.time) this.apply(n);
      else if (!n.result && t > n.time + this.lateFor(n.type)) {
        n.result = this.inReach(e) && !p.dead ? 'miss' : 'whiff';
        this.apply(n);
      }
    }
  }
  inReach(e) { const p = this.p; return Math.abs(p.x - e.x) <= e.def.reach + 12 && Math.abs(p.y - e.y) < 70; }

  apply(n) {
    if (n.applied) return;
    n.applied = true;
    const p = this.p, e = n.owner, def = e.def, w = p.weapon, s = this.g.save, t = this.t;
    const cx = p.x + sign(e.x - p.x) * 18, cy = p.y - CLASH_Y[n.type];
    const evade = n.action && n.action !== 'block';
    if (n.result === 'perfect') {
      if (!evade) {
        const chain = n.seg.perfect + 1;
        this.fx.sparks(cx, cy, 30 + chain * 6, '#ffffff', 700); this.fx.sparks(cx, cy, 14, PLAYER_C, 500);
        this.fx.flare(cx, cy, '#bff9ff', 220 + chain * 30); this.fx.ring(cx, cy, '#ffffff', 80, 0.26, 5);
        this.gainPoise(e, 7.5); p.poise += 2; this.hitstop = 0.06; this.shake = Math.max(this.shake, 6); e.recoilT = t;
        this.gradeText(chain > 1 ? 'DEFLECT ×' + chain : 'DEFLECT', '#ffffff'); sfx('deflect');
        if (w.riposte) { p.riposteUntil = t + 0.6; }
      } else {
        this.gainPoise(e, 9.75); this.gradeText('PERFECT ' + ACT_NAME[n.action], '#bff9ff'); sfx('perfect');
        p.ghostT = t; this.fx.motes(p.x, p.y - 30, 6, PLAYER_C, 80, 40);
        if (w.focus) { p.focusUntil = t + 2.2; this.fx.float('FOCUS', p.x, p.y - 100, PLAYER_C, 15); sfx('focus'); }
      }
    } else if (n.result === 'good') {
      if (!evade) {
        this.fx.sparks(cx, cy, 14, '#d8fff4', 420); this.fx.ring(cx, cy, '#d8fff4', 50, 0.2, 3);
        p.poise += 13 * w.guardCost * (1 - 0.04 * (s.stats.guard - 8)); this.gainPoise(e, 2.5); sfx('block'); this.gradeText('BLOCK', '#d8fff4');
        this.shake = Math.max(this.shake, 3);
      } else { this.gainPoise(e, 3.25); this.gradeText(ACT_NAME[n.action], '#bfe9e0'); }
    } else if (n.result === 'miss') {
      this.hurt(n.type === 'slam' ? def.slamDmg : def.dmg, n.type);
    }
    // a whole phrase answered perfectly staggers the attacker where it stands and leaves it open
    const sg = n.seg; sg.done++; if (n.result === 'perfect') sg.perfect++;
    if (sg.done === sg.n && sg.perfect === sg.n && sg.n >= 2 && !e.dead && !e.brokenUntil) {
      this.gainPoise(e, 10); e.knockUntil = t + 0.35; e.openEnd = Math.max(e.openEnd, t + 1.0); e.openStart = Math.min(e.openStart, t);
      this.fx.float('FLAWLESS', e.x, e.y - e.h - 34, '#ffffff', 22); this.fx.ring(e.x, e.y - e.h / 2, '#ffffff', 160, 0.4, 6); sfx('perfect');
    }
    if (p.poise >= 100 && t >= p.stunUntil) { p.poise = 50; p.stunUntil = t + 0.9; this.showBanner('GUARD BROKEN', '', '#ffffff', 1); sfx('brk'); }
    this.checkBreak(e);
  }
  gainPoise(e, v) { e.poise += v; e.lastPoise = this.t; }
  checkBreak(e) {
    if (e.dead || e.brokenUntil > this.t) return;
    if (e.poise >= e.def.poise || e.hp <= 0) {
      e.poise = e.def.poise; e.brokenUntil = this.t + 2.6; this.cond.cancelOwner(e, this.t, true);
      this.fx.sparks(e.x, e.y - e.h * 0.6, 26, '#ffffff', 600); this.fx.ring(e.x, e.y - e.h * 0.6, '#ffffff', 110, 0.35, 5);
      sfx('brk'); this.fx.float('POISE BROKEN', e.x, e.y - e.h - 40, '#ffffff', 16);
    }
  }
  hurt(dmg, type) {
    const p = this.p, t = this.t;
    p.hp -= dmg; p.hurtUntil = t + 0.3; p.atk = null; p.heal = null; p.move = null; p.guardUntil = -9;
    this.fx.shards(p.x, p.y - 36, 14, PLAYER_C, 380, 18); this.fx.sparks(p.x, p.y - CLASH_Y[type], 10, ATTACKS[type].color, 500);
    this.shake = Math.max(this.shake, 12); this.hitstop = 0.05; this.flash = { c: '255,255,255', a: 0.18 };
    this.gradeText(type === 'slam' ? 'CRUSHED' : 'HIT', ATTACKS[type].color); sfx('hit');
    if (p.hp <= 0) this.kill('YOU FELL');
  }
  kill(msg) {
    const p = this.p;
    if (p.dead) return;
    p.dead = true; p.deadT = this.t; p.hp = 0; p.atk = null;
    for (const e of this.enemies) this.cond.cancelOwner(e, this.t, true);
    this.showBanner(msg, 'The rhythm breaks', '#ffffff', 2.2); sfx('death');
    this.fx.shards(p.x, p.y - 30, 40, PLAYER_C, 500, 24);
  }

  /* ---------- your strikes ---------- */
  lethalTarget() {
    const p = this.p;
    let best = null;
    for (const e of this.enemies) {
      if (e.dead || !(e.brokenUntil > this.t)) continue;
      const d = Math.abs(e.x - p.x);
      if (d < p.weapon.reach + 40 && Math.abs(e.y - p.y) < 60 && (!best || d < Math.abs(best.x - p.x))) best = e;
    }
    return best;
  }
  resolveHit(a) {
    const p = this.p, t = this.t, w = p.weapon, s = this.g.save;
    if (a.lethal) {
      const e = a.target;
      if (!e || e.dead) return;
      p.face = sign(e.x - p.x);
      this.killEnemy(e, true);
      return;
    }
    // nearest enemy in front, in reach
    let e = null;
    for (const x of this.enemies) {
      if (x.dead || x.state === 'perched' || x.leaping) continue;
      const dx = (x.x - p.x) * p.face;
      if (dx < -10 || dx > w.reach + x.w / 2 || Math.abs(x.y - p.y) > 60) continue;
      if (!e || Math.abs(x.x - p.x) < Math.abs(e.x - p.x)) e = x;
    }
    const tipX = p.x + p.face * w.reach * 0.7, tipY = p.y - 44;
    this.fx.arc(p.x + p.face * 10, p.y - 40, w.reach * 0.75, p.face > 0 ? -1.4 : Math.PI + 1.4, p.face > 0 ? 0.6 : Math.PI - 0.6, PLAYER_C, 0.18, 10);
    if (!e) return;
    if (e.brokenUntil > t) { this.killEnemy(e, true); return; }
    const open = (t >= e.openStart - 0.05 && t <= e.openEnd) || e.state !== 'aggro' || t < e.knockUntil;
    const rip = t < p.riposteUntil;
    if (open || rip) {
      const dmg = (w.dmg * (1 + 0.12 * (s.upgrades[s.equipped] || 0)) + w.str * (s.stats.str - 8) * 1.1 + w.fin * (s.stats.fin - 8) * 1.1) * (rip && !open ? 1.4 : 1) * (e.state !== 'aggro' ? 1.5 : 1);
      e.hp -= dmg; this.gainPoise(e, w.poise); e.flinchT = t;
      if (e.state !== 'aggro') e.state = 'aggro';
      this.fx.sparks(e.x, tipY, 16, '#ffffff', 560); this.fx.sparks(e.x, tipY, 8, PLAYER_C, 400); this.fx.cut(e.x, e.y - e.h * 0.55, p.face > 0 ? -0.7 : 0.7, 90, PLAYER_C, 0.22, 7);
      this.fx.float(String(Math.round(dmg)), e.x + rnd(-20, 20), e.y - e.h - 14, '#ffffff', 18);
      this.hitstop = Math.max(this.hitstop, 0.05); this.shake = Math.max(this.shake, 5); sfx('cut');
      if (rip && !open) { p.riposteUntil = 0; this.fx.float('RIPOSTE', e.x, e.y - e.h - 40, PLAYER_C, 16); }
      this.checkBreak(e);
    } else {
      // into the guard: a little poise for them, more for you, and they may answer
      this.gainPoise(e, 1.2); p.poise += 5 * w.guardCost; p.atkReady = Math.max(p.atkReady, t + 0.22);
      this.fx.sparks(tipX, tipY, 10, '#ffffff', 420); this.fx.float('GUARDED', e.x, e.y - e.h - 16, '#cfe9e0', 14); sfx('guarded');
      if (e.slot && Math.random() < 0.6 && !this.cond.notes.some((n) => n.owner === e && !n.applied && n.time < t + 1.1)) {
        this.cond.plan(e, pick(['R', 'Y', 'R']), e.def.beat, t + 0.55, t, { side: sign(e.x - p.x), maxShift: 0.3, chamber: () => 0.3 });
      }
      this.checkBreak(e);
    }
  }
  killEnemy(e, lethal) {
    const t = this.t, s = this.g.save;
    e.dead = true; e.deathT = t; this.cond.cancelOwner(e, t, true); e.slot = 0;
    if (lethal) {
      this.fx.flare(e.x, e.y - e.h * 0.55, '#ffffff', 500, 0.35); this.fx.cut(e.x, e.y - e.h * 0.55, -0.6, 260, '#ffffff', 0.4, 10);
      this.hitstop = 0.14; this.shake = 16; this.flash = { c: '220,255,240', a: 0.35 }; sfx('lethal');
      this.showBanner('LETHAL STRIKE', '', '#ffffff', 1.1);
    }
    this.fx.shards(e.x, e.y - e.h / 2, 46, ENEMY_C, 520, e.h / 2.5); this.fx.motes(e.x, e.y - e.h / 2, 20, NEON2, 160, 120); sfx('shatter');
    s.echoes += e.def.echoes; this.fx.float('+' + e.def.echoes, e.x, e.y - e.h - 50, NEON, 18);
    this.g.persist();
  }

  /* ---------- the world ---------- */
  interactables() {
    const p = this.p, s = this.g.save, L = this.L, out = [];
    for (const b of L.beacons) if (Math.abs(p.x - b.x) < 60 && Math.abs(p.y - b.y) < 50) out.push({ kind: 'beacon', b, label: s.lit.includes(b.id) ? 'Rest at beacon' : 'Kindle beacon' });
    const G = L.gate;
    if (!s.gateOpen && Math.abs(p.x - (G.x + T / 2)) < 70 && p.y > G.y0 && p.y <= G.y1 + 2) out.push({ kind: 'gate', label: p.x > G.x ? 'Open gate' : 'Opens from the other side' });
    const D = L.bossDoor;
    if (!s.bossDead && Math.abs(p.x - D.x) < 70 && p.y > D.y0 && p.y <= D.y1 + 2 && p.x < D.x) out.push({ kind: 'boss', label: 'Enter the arena' });
    return out;
  }
  interact() {
    const it = this.interactables()[0], s = this.g.save;
    if (!it || this.attackers().length) return false;
    if (it.kind === 'beacon') { this.rest(it.b); return true; }
    if (it.kind === 'gate') {
      if (this.p.x < this.L.gate.x) { this.fx.float('It will not open from this side', this.p.x, this.p.y - 90, '#cfe9e0', 14); return true; }
      s.gateOpen = true; this.openGateTiles(); this.g.persist(); sfx('gate'); this.showBanner('SHORTCUT OPENED', '', NEON, 1.6);
      this.fx.motes(this.L.gate.x + T / 2, this.p.y - 60, 30, NEON, 140, 40); return true;
    }
    if (it.kind === 'boss') { this.startCut(); return true; }
    return false;
  }
  rest(b) {
    const s = this.g.save, p = this.p;
    if (!s.lit.includes(b.id)) { s.lit.push(b.id); this.showBanner('BEACON KINDLED', b.name, NEON, 2); sfx('beacon'); this.fx.motes(b.x, b.y - 60, 40, NEON2, 220, 140); }
    else sfx('beacon');
    s.beacon = b.id;
    p.hp = maxHP(s.stats); s.flasks = s.flasksMax; p.poise = 0; p.rest = true;
    // enemies return
    this.cond = new Conductor();
    this.enemies = this.L.enemies.map((d) => this.makeEnemy(d));
    this.g.persist();
    this.g.openBeaconMenu(b);
  }
  leaveRest() { this.p.rest = false; }

  checkPickups() {
    const p = this.p, s = this.g.save;
    for (const it of this.L.items) {
      if (s.taken.includes(it.id)) continue;
      if (Math.abs(p.x - it.x) < 30 && Math.abs(p.y - it.y) < 50) {
        s.taken.push(it.id);
        if (it.kind === 'weapon') { s.upgrades[it.weapon] = s.upgrades[it.weapon] || 0; this.showBanner(WEAPONS[it.weapon].name.toUpperCase(), WEAPONS[it.weapon].cls + ' found · equip it at a beacon', '#ffffff', 2.6); }
        else if (it.kind === 'flask') { s.flasksMax++; s.flasks++; this.showBanner('LUMEN SHARD', 'One more healing flask', NEON2, 2.2); }
        else { s.echoes += it.amount; this.fx.float('+' + it.amount + ' echoes', it.x, it.y - 60, NEON, 18); }
        this.fx.motes(it.x, it.y - 20, 24, NEON2, 160, 100); sfx('pickup'); this.g.persist();
      }
    }
    const sh = s.shade;
    if (sh && Math.abs(p.x - sh.x) < 34 && Math.abs(p.y - sh.y) < 60 && !p.dead) {
      s.echoes += sh.amount; this.fx.float('+' + sh.amount + ' echoes recovered', sh.x, sh.y - 70, NEON, 18);
      this.fx.motes(sh.x, sh.y - 30, 30, PLAYER_C, 200, 80); s.shade = null; sfx('pickup'); this.g.persist();
    }
  }
  regionBanner() {
    const p = this.p;
    for (const r of this.L.regions) if (p.x >= r.x0 && p.x < r.x1 && p.y >= r.y0 && p.y < r.y1) {
      if (this.region !== r.name) { this.region = r.name; if (!this.seenRegion.has(r.name)) { this.seenRegion.add(r.name); if (this.t > 0.5) this.areaName = { s: r.name, t0: this.t }; } }
      break;
    }
  }

  /* ---------- walking into the arena ---------- */
  startCut() {
    const p = this.p;
    p.atk = null; p.heal = null; p.vx = 0;
    for (let r = 30; r <= 33; r++) this.L.tiles[r * this.L.cols + this.L.bossDoor.c] = 0;
    this.cut = { t0: this.t, phase: 0 };
    sfx('gate');
  }
  stepCut(dt) {
    const p = this.p, c = this.cut, k = this.t - c.t0, A = this.L.arena;
    const targetX = A.x0 + 6 * T;
    if (p.x < targetX) { p.vx = 120; p.face = 1; p.walkPh += dt * 4.6; this.poseTo(p, Math.sin(p.walkPh) > 0 ? POSES.run1 : POSES.run2, 10, dt); }
    else { p.vx = 0; this.poseTo(p, POSES.idle, 8, dt); }
    this.physics(p, dt, true);
    if (k > 3.2 && !c.done) { c.done = true; this.g.startBoss(); }
  }

  /* ---------- autoplay (recordings) ---------- */
  auto() {
    const p = this.p, t = this.t;
    if (p.dead) return;
    const pending = this.cond.notes.filter((n) => !n.result && !n.cancelled);
    const n = pending[0];
    if (n && t >= n.time - 0.02) {
      const air = !p.onGround;
      const atk = this.attackers();
      let order = n.type === 'slash' ? ['duck', 'block'] : n.type === 'sweep' ? ['jump', 'block'] : ['dodge', 'block'];
      if (Math.random() < 0.4) order = order.reverse();
      for (const a of order) {
        if (air && a !== 'block') continue;
        if (a === 'block' && this.cond.blockRefused(n)) continue;
        if (a === 'jump') { const after = pending.filter((m) => m !== n && m.time - n.time < 0.62); if (after.some((m, i) => m.type !== 'sweep' && (i > 0 && m.time - after[i - 1].time < 0.25))) continue; }
        if (a === 'block' && atk.length > 1) p.face = sign(n.owner.x - p.x);
        this.press(a, t); break;
      }
    }
    const lt = this.lethalTarget();
    if (lt && t >= p.atkReady) { p.face = sign(lt.x - p.x); this.startAttack(); return; }
    for (const e of this.attackers()) {
      const hitAt = t + p.weapon.hits[0];
      const next = pending[0];
      if (hitAt >= e.openStart && hitAt <= e.openEnd - 0.05 && (!next || next.time - t > 0.5) && t >= p.atkReady && Math.abs(e.x - p.x) < p.weapon.reach + 10) { p.face = sign(e.x - p.x); this.startAttack(); break; }
    }
  }

  /* ---------- camera ---------- */
  updateCamera(dt) {
    const p = this.p, atk = this.attackers();
    let fx = p.x + p.face * 70, fy = p.y - 40;
    if (atk.length) { fx = (p.x + atk.reduce((a, e) => a + e.x, 0)) / (atk.length + 1); }
    if (this.cut) fx = p.x + 260;
    const tx = fx - VW / 2, ty = fy - VH * 0.6;
    const k = 1 - Math.exp(-dt * 5);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * (1 - Math.exp(-dt * 4));
    this.clampCam();
  }
  clampCam() { this.cam.x = clamp(this.cam.x, 0, this.L.cols * T - VW); this.cam.y = clamp(this.cam.y, 0, this.L.rows * T - VH); }

  showBanner(s, sub, c, dur = 1.6) { this.banner = { s, sub, c, t0: performance.now() / 1000, dur }; }
  gradeText(s, c) { this.grade = { s, c, t0: this.t }; }

  /* ---------- drawing ---------- */
  render(ctx, Q = 1) {
    CTX = ctx;
    const cam = this.cam, art = this.art;
    art.setScale(Q);
    const sx = (Math.random() - 0.5) * this.shake * 2, sy = (Math.random() - 0.5) * this.shake * 2;
    // backdrop and tiles: identity transform, whole device pixels
    const S = art.S, ox = Math.round((cam.x + sx) * S), oy = Math.round((cam.y + sy) * S);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    art.drawBG(ctx, cam.x, cam.y);
    art.drawTiles(ctx, ox, oy, VW, VH);
    // everything that moves: the world transform, lined up with the tiles
    ctx.save();
    ctx.setTransform(S, 0, 0, S, -ox, -oy);
    this.drawProps(ctx);
    for (const e of this.enemies) if (!e.dead && this.onScreen(e.x, e.y)) this.drawEnemy(ctx, e);
    this.drawPlayer(ctx);
    this.fx.draw(ctx, txt);
    for (const e of this.enemies) if (!e.dead && this.onScreen(e.x, e.y)) this.drawEnemyUI(ctx, e);
    this.drawPrompt(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawVignette(ctx, art.vig);
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    if (this.flash) { ctx.fillStyle = `rgba(${this.flash.c},${Math.max(0, this.flash.a)})`; ctx.fillRect(0, 0, W, H); }
    this.drawHUD(ctx);
  }
  onScreen(x, y) { return x > this.cam.x - 200 && x < this.cam.x + VW + 200 && y > this.cam.y - 100 && y < this.cam.y + VH + 200; }

  drawProps(ctx) {
    const s = this.g.save, L = this.L, t = performance.now() / 1000;
    // beacons: a pillar of light, brighter once kindled
    for (const b of L.beacons) {
      if (!this.onScreen(b.x, b.y)) continue;
      const lit = s.lit.includes(b.id), a = lit ? 1 : 0.35, pulse = 0.8 + 0.2 * Math.sin(t * 2.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 * a * pulse; ctx.fillStyle = NEON2; ctx.fillRect(b.x - 18, b.y - 220, 36, 220);
      ctx.globalAlpha = 0.5 * a; ctx.fillRect(b.x - 3, b.y - 220, 6, 220);
      ctx.globalAlpha = a * pulse; const gs = glowSprite(NEON2); ctx.drawImage(gs, b.x - 40, b.y - 110, 80, 80);
      ctx.restore();
      ctx.strokeStyle = NEON2; ctx.lineWidth = 2; ctx.fillStyle = '#021710';
      ctx.beginPath(); ctx.moveTo(b.x - 22, b.y); ctx.lineTo(b.x - 12, b.y - 36); ctx.lineTo(b.x + 12, b.y - 36); ctx.lineTo(b.x + 22, b.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 72 - 10 * pulse); ctx.lineTo(b.x + 12, b.y - 58); ctx.lineTo(b.x, b.y - 44); ctx.lineTo(b.x - 12, b.y - 58); ctx.closePath(); ctx.stroke();
    }
    // items
    for (const it of L.items) {
      if (s.taken.includes(it.id) || !this.onScreen(it.x, it.y)) continue;
      const by = it.y - 26 + Math.sin(t * 2 + it.x) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7;
      ctx.drawImage(glowSprite(it.kind === 'weapon' ? '#ffffff' : NEON2), it.x - 26, by - 26, 52, 52); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      if (it.kind === 'weapon') { ctx.beginPath(); ctx.moveTo(it.x - 12, by + 12); ctx.lineTo(it.x + 12, by - 12); ctx.moveTo(it.x - 12, by + 4); ctx.lineTo(it.x - 4, by + 12); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(it.x, by - 9); ctx.lineTo(it.x + 7, by); ctx.lineTo(it.x, by + 9); ctx.lineTo(it.x - 7, by); ctx.closePath(); ctx.stroke(); }
    }
    // the shortcut gate and the arena door
    const G = L.gate;
    if (!s.gateOpen && this.onScreen(G.x, G.y0)) this.drawBars(ctx, G.x, G.y0, G.y1, NEON2);
    const D = L.bossDoor;
    if (L.tiles[30 * L.cols + D.c] === 3 && this.onScreen(D.x, D.y0)) this.drawBars(ctx, D.x, D.y0, D.y1, '#ffffff', true);
    // the boss waiting in the arena during the walk in
    if (this.cut || (!s.bossDead && this.onScreen(L.arena.bossX, L.arena.floor))) {
      const fig = { pose: POSES.idle, x: L.arena.bossX, y: L.arena.floor, s: 0.86, face: -1, color: '#ffffff', rgb: '255,255,255', weapon: { len: 52, width: 3, claw: true }, body: 6, alpha: this.cut ? 1 : 0.5 };
      drawFigure(ctx, fig);
    }
    // your lost echoes
    if (s.shade && this.onScreen(s.shade.x, s.shade.y)) {
      const sh = s.shade, k = Math.sin(t * 3) * 6;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
      ctx.drawImage(glowSprite(PLAYER_C), sh.x - 30, sh.y - 70 + k, 60, 60);
      ctx.globalAlpha = 0.4; ctx.drawImage(glowSprite('#ffffff'), sh.x - 12, sh.y - 52 + k, 24, 24); ctx.restore();
    }
  }
  drawBars(ctx, x, y0, y1, c, door) {
    ctx.fillStyle = 'rgba(2,12,8,.85)'; ctx.fillRect(x, y0, T, y1 - y0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = door ? 'rgba(255,255,255,.08)' : 'rgba(25,224,176,.12)'; ctx.fillRect(x - 6, y0, T + 12, y1 - y0);
    ctx.restore();
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const xx = x + 4 + i * 8; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y0 + 8); ctx.lineTo(x + T, y0 + 8); ctx.moveTo(x, y1 - 8); ctx.lineTo(x + T, y1 - 8); ctx.stroke();
  }

  drawPlayer(ctx) {
    const p = this.p, t = this.t, w = p.weapon;
    const lean = p.move && p.move.kind === 'dodge' && t < p.move.until ? Math.sin(clamp((t - p.move.t0) / DUR.dodge, 0, 1) * Math.PI) : 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 18, 4, 0, 0, 6.283); ctx.fill();
    if (t - p.ghostT < 0.3) {
      const a = 1 - (t - p.ghostT) / 0.3;
      drawFigure(ctx, { pose: p.pose, x: p.x - p.face * 16, y: p.y, s: 0.62, face: p.face, color: PLAYER_C, rgb: PLAYER_RGB, alpha: 0.3 * a, weapon: w });
    }
    // the lean leaves a bullet-time trail: faint copies of the body between upright and the arch
    if (lean > 0.05) {
      const g = this.leanGhost || (this.leanGhost = copyPose(POSES.idle));
      for (const k of [0.35, 0.65]) {
        for (const key in g) g[key] = POSES.idle[key];
        lerpPose(g, p.pose, k);
        drawFigure(ctx, { pose: g, x: p.x, y: p.y, s: 0.62, face: p.face, color: PLAYER_C, rgb: PLAYER_RGB, alpha: 0.22 * lean * k, weapon: w });
      }
    }
    const guard = t < p.guardUntil, hot = t < p.riposteUntil ? 0.8 : guard ? 0.4 : 0;
    drawFigure(ctx, {
      pose: p.pose, x: p.x, y: p.y, s: 0.62, face: p.face, color: PLAYER_C, rgb: PLAYER_RGB, alpha: p.dead ? 0.6 : 1,
      weapon: w, hot, blade: t < p.riposteUntil ? '#ffffff' : '#dffcff', bladeGlow: t < p.focusUntil ? 0.45 : 0.25,
    });
    if (t < p.focusUntil) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(glowSprite(PLAYER_C), p.x - 50, p.y - 90, 100, 100); ctx.restore(); }
    // with two attackers, show which way your guard faces
    if (this.attackers().length > 1 && !p.dead && !this.cut) {
      const x = p.x + p.face * 26, y = p.y - 70;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + p.face * 8, y); ctx.lineTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
    }
  }

  drawEnemy(ctx, e) {
    const t = this.t;
    const broken = e.brokenUntil > t, open = t >= e.openStart && t <= e.openEnd && !broken;
    let blade = '#e9fbff', brgb = ENEMY_RGB, bg = 0.2;
    if (e.tel && e.tel.k > 0) { const A = ATTACKS[e.tel.type]; blade = A.color; brgb = A.rgb; bg = 0.25 + 0.55 * e.tel.k; }
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, e.w * 0.9, 4, 0, 0, 6.283); ctx.fill();
    const fl = broken ? 0.5 + 0.5 * Math.sin(t * 22) : 0;
    drawFigure(ctx, {
      pose: e.pose, x: e.x, y: e.y, s: e.s, face: e.face, color: e.state === 'perched' ? '#bfe9e0' : ENEMY_C, rgb: ENEMY_RGB,
      weapon: e.weapon, blade, bladeRGB: brgb, bladeGlow: bg, hot: open ? 0.5 : fl, body: e.def.look === 'hammer' ? 10 : e.def.look === 'claw' ? 8 : 7,
    });
  }

  /** The cadence track over each attacker: pips slide in toward the beat marker and land with the strike. */
  drawEnemyUI(ctx, e) {
    const t = this.t, p = this.p, s = this.g.save;
    const dir = sign(p.x - e.x) || 1, top = e.y - e.h - 30;
    const mine = this.cond.notes.filter((n) => n.owner === e && !n.cancelled && !n.applied && n.time - t < LEAD && n.time - t > -0.12);
    const broken = e.brokenUntil > t;
    if (e.state === 'aggro' && (e.slot || mine.length)) {
      const len = 150, mx = e.x + dir * 30, x0 = mx - dir * len;
      ctx.strokeStyle = 'rgba(233,251,255,.22)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(mx, top); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, top - 11); ctx.lineTo(mx, top + 11); ctx.stroke();
      for (let i = mine.length - 1; i >= 0; i--) {
        const n = mine[i], u = (n.time - t) / LEAD, x = mx - dir * len * Math.max(0, u), A = ATTACKS[n.type];
        const a = u > 0.85 ? (1 - u) / 0.15 : 1, r = 9 + (u < 0.08 ? 3 : 0);
        ctx.globalAlpha = a;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(A.color), x - r * 2.4, top - r * 2.4, r * 4.8, r * 4.8); ctx.restore();
        ctx.fillStyle = A.color; ctx.beginPath(); ctx.arc(x, top, r, 0, 6.283); ctx.fill();
        // the shape says the answer too: a line high, a line low, or an arrow down
        ctx.strokeStyle = '#140308'; ctx.fillStyle = '#140308'; ctx.lineWidth = 2.5;
        if (n.type === 'slash') { ctx.beginPath(); ctx.moveTo(x - 5, top - 3); ctx.lineTo(x + 5, top - 3); ctx.stroke(); }
        else if (n.type === 'sweep') { ctx.beginPath(); ctx.moveTo(x - 5, top + 4); ctx.lineTo(x + 5, top + 4); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(x - 5, top - 3); ctx.lineTo(x + 5, top - 3); ctx.lineTo(x, top + 5); ctx.closePath(); ctx.fill(); }
        if (s.hints && u < 0.6 && i === 0) txt(A.valid.map((v) => ({ duck: 'DUCK', jump: 'JUMP', dodge: 'STEP', block: 'BLOCK' }[v])).join(' · '), x, top - 22, 12, A.color);
        ctx.globalAlpha = 1;
      }
    }
    // health and poise
    if (e.state === 'aggro' || e.hp < e.def.hp) {
      const bw = Math.max(46, e.w * 2.2), y = top + 18;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - bw / 2 - 1, y - 1, bw + 2, 5);
      ctx.fillStyle = '#d8fff4'; ctx.fillRect(e.x - bw / 2, y, bw * clamp(e.hp / e.def.hp, 0, 1), 3);
      const pf = clamp(e.poise / e.def.poise, 0, 1);
      if (pf > 0.01) {
        const pw = bw * 0.9 * pf;
        ctx.fillStyle = broken && Math.sin(t * 20) > 0 ? '#ffffff' : pf > 0.75 ? '#ffffff' : '#9fe8d4';
        ctx.fillRect(e.x - pw / 2, y + 6, pw, 3);
      }
    }
    if (broken && Math.abs(p.x - e.x) < 220) {
      const x = e.x, y = top - 4, k = 1 + 0.08 * Math.sin(t * 12);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite('#ffffff'), x - 30 * k, y - 30 * k, 60 * k, 60 * k); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y - 14 * k); ctx.lineTo(x + 14 * k, y); ctx.lineTo(x, y + 14 * k); ctx.lineTo(x - 14 * k, y); ctx.closePath(); ctx.stroke();
      txt(btn('attack') + '  LETHAL STRIKE', x, y - 28, 13, '#ffffff');
    }
  }

  drawPrompt(ctx) {
    const it = this.interactables()[0], p = this.p;
    if (!it || p.rest || this.cut || p.dead) return;
    txt((it.label.startsWith('Opens') || it.label.startsWith('It') ? '' : btn('interact') + '  ') + it.label, p.x, p.y - 96, 15, '#eafff3');
  }

  drawHUD(ctx) {
    const p = this.p, s = this.g.save, mh = maxHP(s.stats), now = performance.now() / 1000;
    const hw = 220 + (mh - 90) * 1.2;
    bar(ctx, 36, 32, hw, 10, p.hp / mh, NEON, 'rgba(61,255,154,.15)');
    const pf = clamp(p.poise / 100, 0, 1);
    if (pf > 0.01) bar(ctx, 36, 48, hw * 0.75, 5, pf, t2col(pf, p.stunUntil > this.t), 'rgba(255,255,255,.08)');
    // flasks
    for (let i = 0; i < s.flasksMax; i++) {
      const x = 44 + i * 20, y = 74, full = i < s.flasks;
      ctx.strokeStyle = full ? NEON2 : 'rgba(25,224,176,.35)'; ctx.lineWidth = 2; ctx.fillStyle = full ? 'rgba(25,224,176,.55)' : 'transparent';
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 6, y); ctx.closePath(); if (full) ctx.fill(); ctx.stroke();
    }
    txt(btn('heal'), 46 + s.flasksMax * 20, 75, 11, 'rgba(223,251,234,.6)', 'left');
    txt(p.weapon.name.toUpperCase() + (s.upgrades[s.equipped] ? ' +' + s.upgrades[s.equipped] : ''), 36, H - 34, 13, '#dffbea', 'left');
    txt(p.weapon.cls, 36, H - 16, 11, 'rgba(223,251,234,.55)', 'left');
    txt(String(s.echoes), W - 40, H - 30, 22, '#eafff3', 'right');
    txt('ECHOES', W - 40, H - 12, 10, NEON2, 'right');
    if (s.hints) txt('I  hints on', W - 40, 30, 10, 'rgba(223,251,234,.4)', 'right');
    // the tutorial's lesson
    const tp = this.tut && !this.cut && this.tut.panel();
    if (tp) {
      const lines = wrap(tp.line, 74), y0 = 150, hgt = 58 + lines.length * 20 + (tp.need ? 16 : 0);
      ctx.globalAlpha = 1 - tp.fade * 0.6;
      ctx.fillStyle = 'rgba(2,12,8,.78)'; ctx.fillRect(W / 2 - 330, y0, 660, hgt);
      ctx.fillStyle = tp.color; ctx.fillRect(W / 2 - 330, y0, 660, 2);
      txt('TUTORIAL ' + tp.n + ' / ' + tp.of, W / 2 + 318, y0 + 18, 10, 'rgba(223,251,234,.45)', 'right');
      txt(tp.title, W / 2, y0 + 30, 20, tp.color);
      lines.forEach((l, i) => txt(l, W / 2, y0 + 56 + i * 20, 14, '#eafff3', 'center', 500));
      for (let i = 0; i < tp.need; i++) {
        ctx.fillStyle = i < tp.ok ? tp.color : 'rgba(223,251,234,.2)';
        ctx.beginPath(); ctx.arc(W / 2 + (i - (tp.need - 1) / 2) * 18, y0 + hgt - 14, 5, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // grade
    if (this.grade) {
      const age = this.t - this.grade.t0;
      if (age >= 0 && age < 0.7) { ctx.globalAlpha = age < 0.45 ? 1 : 1 - (age - 0.45) / 0.25; txt(this.grade.s, W / 2, H - 150 - age * 16, 26 * (1 + 0.35 * Math.max(0, 1 - age * 9)), this.grade.c); ctx.globalAlpha = 1; }
    }
    // area names
    if (this.areaName) {
      const age = this.t - this.areaName.t0;
      if (age >= 0 && age < 3) { ctx.globalAlpha = age < 0.4 ? age / 0.4 : age > 2.3 ? (3 - age) / 0.7 : 1; txt(this.areaName.s.toUpperCase(), W / 2, 110, 22, '#eafff3'); ctx.fillStyle = NEON; ctx.fillRect(W / 2 - 120, 126, 240, 1); ctx.globalAlpha = 1; }
    }
    if (this.banner) {
      const age = now - this.banner.t0, d = this.banner.dur;
      if (age < d) {
        const a = age < 0.15 ? age / 0.15 : age > d - 0.4 ? (d - age) / 0.4 : 1;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,8,4,.6)'; ctx.fillRect(0, H / 2 - 70, W, 120);
        ctx.fillStyle = this.banner.c; ctx.fillRect(W / 2 - 280, H / 2 - 56, 560, 1); ctx.fillRect(W / 2 - 280, H / 2 + 36, 560, 1);
        txt(this.banner.s, W / 2, H / 2 - 18, 46, this.banner.c);
        if (this.banner.sub) txt(this.banner.sub, W / 2, H / 2 + 20, 16, '#cfeedd');
        ctx.globalAlpha = 1;
      }
    }
    if (this.cut) { const k = clamp((this.t - this.cut.t0 - 2.4) / 0.8, 0, 1); if (k > 0) { ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillRect(0, 0, W, H); } }
  }
}
function t2col(f, stun) { return stun ? '#ffffff' : f > 0.75 ? '#ffffff' : '#bfe9e0'; }
