// Boot, the frame loop, saving, and moving between the world, the boss duel and the menus.
import { W, H } from './util.js';
import { WEAPONS, WEAPON_ORDER, STATS, STAT_ORDER, BOSS, UPGRADE_MAX, upgradeCost, levelOf, levelCost, maxHP, BASE_STAT } from './data.js';
import { input, btn } from './input.js';
import { audioInit, sfx, playMusic, updateMusic, muffle, toggleMute, isMuted, suspendAudio } from './audio.js';
import { World } from './world.js';
import { Tutorial } from './tutorial.js';
import { BossFight } from './boss.js';
import { Menus } from './ui.js';

export const VERSION = '0.1.0';
const KEY = 'cadence-save-v1';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d', { alpha: false });

function freshSave() {
  return { v: 1, stats: { vit: BASE_STAT, guard: BASE_STAT, str: BASE_STAT, fin: BASE_STAT, focus: BASE_STAT }, echoes: 0, upgrades: { arming: 0 }, equipped: 'arming', flasks: 3, flasksMax: 3, lit: [], beacon: 'b1', taken: [], gateOpen: false, bossDead: false, shade: null, hints: true, deaths: 0, kills: 0 };
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return { ...freshSave(), ...s }; } catch (e) { /* none or blocked */ }
  return null;
}
let settings = { quality: 'auto' };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('cadence-settings') || '{}') }; } catch (e) { /* ignore */ }

const game = {
  save: loadSave() || freshSave(),
  hasSave: !!loadSave(),
  scene: 'title', world: null, boss: null, menus: new Menus(), autoplay: false, paused: false,
  get menuOpen() { return this.menus.open || this.paused || this.scene === 'title'; },
  persist() { try { localStorage.setItem(KEY, JSON.stringify(this.save)); this.hasSave = true; } catch (e) { /* storage blocked: play on */ } },

  newGame() { this.save = freshSave(); this.persist(); this.enterWorld(); this.world.areaName = { s: 'The Verdant Circuit', t0: 0.3 }; this.world.tut = new Tutorial(this.world); },
  enterWorld() {
    this.menus.hideTitle(); this.menus.hide();
    this.world = new World(this);
    this.world.spawn(this.save.beacon);
    this.scene = 'world'; this.boss = null;
    playMusic('explore'); muffle(false);
  },
  onDeath() {
    const s = this.save, p = this.world.p;
    s.deaths++;
    s.shade = s.echoes > 0 ? { x: p.safeX ?? p.x, y: p.safeY ?? p.y, amount: s.echoes } : null;
    s.echoes = 0;
    this.persist();
    this.world.spawn(s.beacon);
  },
  startBoss() {
    this.boss = new BossFight(this, this.world.p.hp, this.world.snapshot());
    this.scene = 'boss';
    playMusic('boss', 0);
  },
  onBossEnd(result, hp) {
    const s = this.save, w = this.world;
    this.scene = 'world'; this.boss = null;
    if (result === 'win') {
      s.bossDead = true; s.echoes += BOSS.echoes; s.upgrades.crescent = s.upgrades.crescent || 0;
      this.persist();
      w.cut = null; w.p.hp = Math.max(1, hp); w.p.x = w.L.arena.x0 + 8 * 32; w.p.y = w.L.arena.floor;
      w.enemies.forEach((e) => { e.dead = true; });
      playMusic('victory');
      this.menu(`<h2>SECTOR CLEARED</h2>
        <p class="sub">The Twin Dancer falls, and the Verdant Circuit goes quiet. This is the end of the first area of <b>Cadence</b>.</p>
        <div class="wcard"><b>Crescent</b> (Sabre) is yours, and <b>${BOSS.echoes}</b> echoes. Equip it at any beacon.</div>
        <p class="rule">You died ${s.deaths} time${s.deaths === 1 ? '' : 's'}. Keep exploring, level up, try the other blades, or start again.</p>
        <div class="mlist"><button class="mbtn" data-act="ok">Keep exploring</button><button class="mbtn" data-act="title">Back to the title</button></div>`,
      { ok: () => this.closeMenu(), title: () => this.toTitle() });
    } else {
      s.deaths++;
      s.shade = s.echoes > 0 ? { x: w.L.bossDoor.x - 70, y: w.L.bossDoor.y1, amount: s.echoes } : null;
      s.echoes = 0; this.persist();
      w.cut = null;
      for (let r = 30; r <= 33; r++) w.L.tiles[r * w.L.cols + w.L.bossDoor.c] = 3;
      w.spawn(s.beacon);
      playMusic('explore');
    }
  },
  toTitle() {
    this.closeMenu(); this.paused = false; this.scene = 'title';
    this.hasSave = !!loadSave();
    showTitle();
  },

  /* ---------- menus ---------- */
  menu(html, acts, back) { this.menus.show(html, acts, back); muffle(true); },
  closeMenu() { this.menus.hide(); muffle(false); if (this.world && this.world.p) this.world.leaveRest(); },
  openBeaconMenu(b) {
    const s = this.save, lvl = levelOf(s.stats), cost = levelCost(lvl);
    const others = this.world.L.beacons.filter((x) => x.id !== b.id && s.lit.includes(x.id));
    this.menu(`<h2>${b.name.toUpperCase()}</h2>
      <p class="hint">Rested. Health and flasks restored; the circuit's sentinels have returned.</p>
      <div class="stats"><span>Level <b>${lvl}</b></span><span>Echoes <b>${s.echoes}</b></span><span>Health <b>${maxHP(s.stats)}</b></span><span>Flasks <b>${s.flasksMax}</b></span></div>
      <div class="mlist">
        <button class="mbtn" data-act="level">Level up <small>next level: ${cost} echoes</small></button>
        <button class="mbtn" data-act="weapons">Swords <small>${WEAPONS[s.equipped].name}${s.upgrades[s.equipped] ? ' +' + s.upgrades[s.equipped] : ''}</small></button>
        ${others.length ? '<button class="mbtn" data-act="travel">Travel <small>to another beacon</small></button>' : ''}
        <button class="mbtn" data-act="leave">Leave</button>
      </div>`,
    { level: () => this.levelMenu(b), weapons: () => this.weaponMenu(b), travel: () => this.travelMenu(b), leave: () => this.closeMenu() }, () => this.closeMenu());
  },
  levelMenu(b, keep) {
    const s = this.save, lvl = levelOf(s.stats), cost = levelCost(lvl), can = s.echoes >= cost;
    const rows = STAT_ORDER.map((k) => `<button class="mbtn ${can ? '' : 'off'}" data-act="stat" data-k="${k}">${STATS[k].name} <small>${s.stats[k]} · ${STATS[k].desc}</small></button>`).join('');
    this.menus.show(`<h2>LEVEL ${lvl}</h2>
      <div class="stats"><span>Echoes <b>${s.echoes}</b></span><span>Next level <b>${cost}</b></span><span>Health <b>${maxHP(s.stats)}</b></span><span>Timing <b>+${Math.round((s.stats.focus - BASE_STAT) * 1.5)}%</b></span></div>
      <div class="mlist">${rows}<button class="mbtn" data-act="back">Back</button></div>
      <p class="hint">${can ? 'Each point is one level.' : 'Not enough echoes. Defeat enemies to earn more.'}</p>`,
    {
      stat: (el) => { const c = levelCost(levelOf(s.stats)); if (s.echoes < c) return; s.echoes -= c; s.stats[el.dataset.k]++; this.world.p.hp = maxHP(s.stats); this.persist(); sfx('levelup'); this.levelMenu(b, true); },
      back: () => this.openBeaconMenu(b),
    }, () => this.openBeaconMenu(b), keep);
  },
  weaponMenu(b, sel, keep) {
    const s = this.save, owned = WEAPON_ORDER.filter((id) => s.upgrades[id] !== undefined);
    sel = sel || s.equipped;
    const w = WEAPONS[sel], up = s.upgrades[sel] || 0, uc = upgradeCost(up);
    const pct = (v) => Math.round(Math.min(1, v / 1.6) * 100);
    const row = (label, v) => `<div class="row"><span>${label}</span><div class="bar"><i style="width:${pct(v)}%"></i></div><span>${Math.round(v * 100)}%</span></div>`;
    // how much each stat point adds to this sword's damage, as a souls-style letter
    const grade = (v) => (v >= 1.2 ? 'A' : v >= 0.9 ? 'B' : v >= 0.5 ? 'C' : 'D');
    const scale = (label, v) => `<div class="row"><span>${label}</span><div class="bar"><i style="width:${Math.round(Math.min(1, v / 1.4) * 100)}%"></i></div><span>${grade(v)}</span></div>`;
    const scaling = w.weight === 'Medium' ? 'Medium: Strength and Finesse both raise its damage, equally.'
      : 'Mostly scales with ' + (w.str >= w.fin ? 'Strength' : 'Finesse') + '.';
    const list = owned.map((id) => `<button class="mbtn ${id === s.equipped ? 'eq' : ''}" data-act="pick" data-id="${id}">${WEAPONS[id].name}${s.upgrades[id] ? ' +' + s.upgrades[id] : ''} <small>${WEAPONS[id].weight} ${WEAPONS[id].cls.toLowerCase()}${id === s.equipped ? ' · equipped' : ''}</small></button>`).join('');
    this.menus.show(`<h2>SWORDS</h2><div class="wgrid"><div>
      <div class="mlist">${list}</div>
      <div class="mlist" style="margin-top:.8em">
        ${sel !== s.equipped ? '<button class="mbtn" data-act="equip">Equip</button>' : ''}
        <button class="mbtn ${up < UPGRADE_MAX && s.echoes >= uc ? '' : 'off'}" data-act="upgrade">${up < UPGRADE_MAX ? 'Reforge to +' + (up + 1) : 'Fully reforged'} <small>${up < UPGRADE_MAX ? uc + ' echoes · you have ' + s.echoes : ''}</small></button>
        <button class="mbtn" data-act="back">Back</button>
      </div></div>
      <div class="wcard"><b>${w.name}${up ? ' +' + up : ''}</b> · ${w.cls} <span class="wt wt-${w.weight.toLowerCase()}">${w.weight.toUpperCase()}</span><br><small>${w.desc}</small>
        <h3>BLOCK WINDOW</h3>${row('Slash', w.block.slash)}${row('Sweep', w.block.sweep)}${row('Slam', w.block.slam)}
        <h3>EVADE WINDOW</h3>${row('Duck', w.evade.duck)}${row('Jump', w.evade.jump)}${row('Step', w.evade.dodge)}
        <h3>BLADE</h3>${row('Damage', w.dmg * (1 + 0.12 * up) / 20)}${row('Speed', 0.42 / w.dur)}${row('Perfect', w.perfect)}
        <h3>SCALING</h3>${scale('Strength', w.str)}${scale('Finesse', w.fin)}
        <small>${scaling}${w.riposte ? ' Riposte after a deflect.' : ''}${w.focus ? ' Perfect evades sharpen focus.' : ''}</small></div></div>`,
    {
      pick: (el) => this.weaponMenu(b, el.dataset.id, true),
      equip: () => { s.equipped = sel; this.world.p.weapon = WEAPONS[sel]; this.persist(); sfx('pickup'); this.weaponMenu(b, sel, true); },
      upgrade: () => { if (up >= UPGRADE_MAX || s.echoes < uc) return; s.echoes -= uc; s.upgrades[sel] = up + 1; this.persist(); sfx('levelup'); this.weaponMenu(b, sel, true); },
      back: () => this.openBeaconMenu(b),
    }, () => this.openBeaconMenu(b), keep);
  },
  travelMenu(b) {
    const s = this.save, others = this.world.L.beacons.filter((x) => x.id !== b.id && s.lit.includes(x.id));
    this.menus.show(`<h2>TRAVEL</h2><div class="mlist">${others.map((x) => `<button class="mbtn" data-act="go" data-id="${x.id}">${x.name}</button>`).join('')}<button class="mbtn" data-act="back">Back</button></div>`,
      { go: (el) => { s.beacon = el.dataset.id; this.persist(); this.closeMenu(); this.world.spawn(el.dataset.id); sfx('beacon'); }, back: () => this.openBeaconMenu(b) }, () => this.openBeaconMenu(b));
  },
  pause(on) {
    if (this.scene === 'title') return;
    if (on && this.menus.open) return;
    this.paused = on;
    if (!on) { this.closeMenu(); return; }
    const s = this.save;
    this.menu(`<h2>PAUSED</h2><div class="mlist">
      <button class="mbtn" data-act="resume">Resume</button>
      <button class="mbtn" data-act="controls">Controls</button>
      ${this.world && this.world.tut ? '<button class="mbtn" data-act="skiptut">Skip tutorial</button>' : ''}
      <button class="mbtn" data-act="hints">Answer hints <small>${s.hints ? 'on' : 'off'}</small></button>
      <button class="mbtn" data-act="quality">Resolution <small>${settings.quality}</small></button>
      <button class="mbtn" data-act="mute">Sound <small>${isMuted() ? 'off' : 'on'}</small></button>
      <button class="mbtn" data-act="title">Quit to title</button></div>`,
    {
      resume: () => this.pause(false),
      controls: () => controlsMenu(() => this.pause(true)),
      skiptut: () => { if (this.world.tut) this.world.tut.end(); this.pause(false); },
      hints: () => { s.hints = !s.hints; this.persist(); this.pause(true); },
      quality: () => { settings.quality = { auto: 'high', high: 'low', low: 'auto' }[settings.quality]; saveSettings(); applyQuality(true); this.pause(true); },
      mute: () => { toggleMute(); this.pause(true); },
      title: () => this.toTitle(),
    }, () => this.pause(false));
  },
};
window.__cadence = game;

function controlsMenu(back) {
  game.menu(`<h2>CONTROLS</h2>
    <div class="keys">
      <span></span><b>KEYBOARD</b><b>GAMEPAD</b>
      <span>Move · aim</span><span>A / D</span><span>Left stick</span>
      <span>Jump</span><span>W · Space</span><span>A</span>
      <span>Small jump</span><span>tap W</span><span>RT</span>
      <span>Drop through a floor</span><span>S + W</span><span>Down + A</span>
      <span>Duck</span><span>S</span><span>RB</span>
      <span>Block</span><span>J</span><span>LB</span>
      <span>Step aside</span><span>L · Shift</span><span>LT</span>
      <span>Strike</span><span>K</span><span>X</span>
      <span>Heal</span><span>H</span><span>Y</span>
      <span>Interact</span><span>E</span><span>A</span>
      <span>Pause</span><span>Esc</span><span>Start</span>
      <span>Answer hints</span><span>I</span><span>Back</span>
    </div>
    <p class="hint">Two attackers at once: hold the stick (or A / D) toward the one you are blocking. Duck, jump and step work against both.
    In the boss duel, A / D step left and right. In the air you can only block. Your guard can't take two strikes closer than a quarter second.</p>
    <div class="mlist"><button class="mbtn" data-act="back">Back</button></div>`, { back }, back);
}

/* ---------- title ---------- */
function backToTitleMenu() { game.closeMenu(); game.menus.bind(game.menus.title, titleActs); game.menus.focus = 0; game.menus.mark(); }
const titleActs = {
  continue: () => { audioInit(); game.enterWorld(); },
  new: () => {
    audioInit();
    if (game.hasSave) game.menu(`<h2>NEW GAME</h2><p class="sub">This erases your current journey.</p><div class="mlist"><button class="mbtn" data-act="yes">Start over</button><button class="mbtn" data-act="no">Cancel</button></div>`,
      { yes: () => game.newGame(), no: backToTitleMenu }, backToTitleMenu);
    else game.newGame();
  },
  controls: () => { audioInit(); controlsMenu(backToTitleMenu); },
};
function showTitle() {
  document.getElementById('btnContinue').style.display = game.hasSave ? '' : 'none';
  document.getElementById('ver').textContent = 'v' + VERSION;
  game.menus.showTitle(titleActs);
  if (!game.world) { game.world = new World(game); game.world.spawn(game.save.beacon); }
}

/* ---------- resolution ---------- */
let Q = 1, slowFrames = 0, frameN = 0;
function saveSettings() { try { localStorage.setItem('cadence-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }
function applyQuality(force) {
  const dpr = window.devicePixelRatio || 1, rect = cv.getBoundingClientRect();
  const fit = Math.max(0.5, (rect.width * dpr) / W);
  const want = settings.quality === 'low' ? 1 : settings.quality === 'high' ? Math.min(2, fit) : Math.min(1.5, fit, settings.autoCap || 1.5);
  const q = Math.max(1, Math.round(want * 4) / 4);
  if (q !== Q || force || cv.width !== Math.round(W * q)) { Q = q; cv.width = Math.round(W * Q); cv.height = Math.round(H * Q); game.dirty = true; }
}
window.addEventListener('resize', () => applyQuality(true));

/* ---------- loop ---------- */
let last = performance.now(), wasFrozen = false;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  input.poll(now);
  // auto resolution: if frames run long, render fewer pixels
  if (settings.quality === 'auto' && game.scene !== 'title') {
    frameN++;
    if (dt > 0.024) slowFrames++;
    if (frameN >= 120) { if (slowFrames > 40 && Q > 1) { settings.autoCap = Q - 0.25; saveSettings(); applyQuality(true); } frameN = 0; slowFrames = 0; }
  }
  const nav = input.takeNav();
  let presses = input.take();
  for (const p of presses) if (p.a === 'mute') toggleMute();
  presses = presses.filter((p) => p.a !== 'mute');
  if (game.menus.open || game.scene === 'title') {
    for (const d of nav) game.menus.nav(d);
    if (presses.some((p) => p.a === 'pause') && game.paused) game.pause(false);
    presses = [];
  } else if (presses.some((p) => p.a === 'pause')) {
    game.pause(true); presses = [];
  }
  const sc = game.scene === 'boss' ? game.boss : game.world;
  const t0 = performance.now();
  if (sc && !game.menuOpen) sc.update(dt, presses, now);
  const t1 = performance.now();
  // under a menu the scene is frozen: draw it once and let the compositor keep the frame
  const frozen = game.menuOpen;
  if (!frozen || !wasFrozen || game.dirty) {
    ctx.setTransform(Q, 0, 0, Q, 0, 0);
    if (sc) sc.render(ctx, Q); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    game.dirty = false;
  }
  wasFrozen = frozen;
  const t2 = performance.now();
  PERF.push(t1 - t0, t2 - t1, now - (PERF.lastNow || now)); PERF.lastNow = now;
  updateMusic();
  requestAnimationFrame(frame);
}
/* frame timing, read by tools/perf.mjs: update ms, render ms, frame interval ms */
const PERF = { u: [], r: [], f: [], push(u, r, f) { this.u.push(u); this.r.push(r); this.f.push(f); if (this.u.length > 600) { this.u.shift(); this.r.shift(); this.f.shift(); } } };
game.perf = (reset) => {
  const st = (a) => { const s = [...a].sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / (a.length || 1)).toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(2) }; };
  const out = { update: st(PERF.u), render: st(PERF.r), frame: st(PERF.f), q: Q, particles: (game.boss || game.world)?.fx?.count };
  if (reset) { PERF.u = []; PERF.r = []; PERF.f = []; }
  return out;
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game.scene !== 'title' && !game.menus.open) game.pause(true); suspendAudio(true); }
  else suspendAudio(false);
});
window.addEventListener('pointerdown', () => audioInit(), { once: true });

applyQuality(true);
showTitle();
requestAnimationFrame(frame);
