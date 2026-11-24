// Game data: attacks, weapons, enemies, stats. Systems read these tables; nothing is special-cased by id.

/* The three attacks. Each colour belongs to the attacks only: the world never uses red, yellow or purple. */
export const ATTACKS = {
  slash: { name: 'SLASH', color: '#ff3b4e', rgb: '255,59,78', valid: ['duck', 'block'] },
  sweep: { name: 'SWEEP', color: '#ffd83a', rgb: '255,216,58', valid: ['jump', 'block'] },
  slam: { name: 'SLAM', color: '#b44dff', rgb: '180,77,255', valid: ['dodge', 'block'] },
};
export const LETTER = { R: 'slash', Y: 'sweep', P: 'slam' };
export const ACT_NAME = { block: 'BLOCK', duck: 'DUCK', jump: 'JUMP', dodge: 'STEP' };

/* timing */
export const BASE_WIN = { perfect: 0.075, good: 0.16 };   // seconds either side of the impact
export const FAST_PAIR = 0.25;                            // the guard can't take two strikes closer than this
export const MIN_GAP = 0.2;                               // no two strikes (from anyone) closer than this
export const JUMP_AIR = 0.6;                              // a combat jump keeps you in the air this long
export const DUR = { block: 0.26, duck: 0.34, dodge: 0.36 };
export const LEAD = 1.5;                                  // pips appear this long before the strike lands

/*
 * Swords. block/evade multiply the timing windows for each attack (block) or each move (evade).
 * A weapon that blocks well is heavy to move in; a light one dodges well and blocks poorly. `weight` is the label the
 * beacon shows for that: Heavy (guards better than it moves), Light (moves better than it guards), Medium (even).
 * str/fin are how much each point of Strength/Finesse adds to its damage; a Medium sword gains from both equally.
 */
export const WEAPONS = {
  arming: {
    name: 'Arming Sword', cls: 'Longsword', weight: 'Medium', desc: 'A plain, honest blade. Blocks and moves equally well.',
    dmg: 14, hits: [0.14], dur: 0.42, poise: 5, reach: 82, str: 0.55, fin: 0.55, len: 60, width: 3.4,
    block: { slash: 1, sweep: 1, slam: 1 }, evade: { duck: 1, jump: 1, dodge: 1 }, perfect: 1, guardCost: 1,
  },
  monolith: {
    name: 'Monolith', cls: 'Greatsword', weight: 'Heavy', desc: 'A slab of light. Its guard takes anything, best against sweeps and slams, but it is slow to duck and jump with. Blocks cost less poise.',
    dmg: 30, hits: [0.26], dur: 0.72, poise: 12, reach: 104, str: 1.35, fin: 0.15, len: 92, width: 7,
    block: { slash: 1.15, sweep: 1.4, slam: 1.55 }, evade: { duck: 0.72, jump: 0.68, dodge: 0.75 }, perfect: 1, guardCost: 0.65,
  },
  fangs: {
    name: 'Twin Fangs', cls: 'Twinblades', weight: 'Light', desc: 'Two short blades, two quick cuts. A poor guard, but ducks, jumps and steps come easy. A perfect evade sharpens your focus for a moment.',
    dmg: 8, hits: [0.09, 0.19], dur: 0.34, poise: 3, reach: 70, str: 0.15, fin: 1.25, len: 40, width: 2.8, twin: true,
    block: { slash: 0.72, sweep: 0.7, slam: 0.7 }, evade: { duck: 1.45, jump: 1.35, dodge: 1.45 }, perfect: 1, guardCost: 1.2, focus: true,
  },
  nightedge: {
    name: 'Nightedge', cls: 'Katana', weight: 'Light', desc: 'Rewards exact timing: a wide perfect-deflect window, and a riposte after every deflect that cuts through the guard.',
    dmg: 18, hits: [0.13], dur: 0.44, poise: 6, reach: 86, str: 0.45, fin: 1.0, len: 70, width: 2.6,
    block: { slash: 1.05, sweep: 0.92, slam: 0.9 }, evade: { duck: 1, jump: 1, dodge: 1 }, perfect: 1.65, guardCost: 1, riposte: true,
  },
  crescent: {
    name: 'Crescent', cls: 'Sabre', weight: 'Light', desc: 'Taken from the Twin Dancer. Turns aside slashes like nothing else and leaps lightly, but meets sweeps poorly.',
    dmg: 17, hits: [0.12], dur: 0.38, poise: 6, reach: 84, str: 0.55, fin: 0.95, len: 64, width: 3, curved: true,
    block: { slash: 1.55, sweep: 0.82, slam: 1.05 }, evade: { duck: 1, jump: 1.3, dodge: 1.1 }, perfect: 1.1, guardCost: 0.9,
  },
  // the wardens' blades, one from each boss after the first
  undertow: {
    name: 'Undertow', cls: 'Glaive', weight: 'Heavy', desc: 'Taken from the Drowned Herald. A long blade on a long haft: it reaches far and meets slams like a sea wall, but ducking in it is slow.',
    dmg: 24, hits: [0.22], dur: 0.62, poise: 10, reach: 116, str: 1.2, fin: 0.3, len: 100, width: 4,
    block: { slash: 1.05, sweep: 1.25, slam: 1.5 }, evade: { duck: 0.75, jump: 0.85, dodge: 0.85 }, perfect: 1, guardCost: 0.75,
  },
  glasspin: {
    name: 'Glasspin', cls: 'Rapier', weight: 'Light', desc: 'Taken from the Glass Duchess. Quick and exact: a fast cut, a wide perfect window and easy footwork, but a thin guard against sweeps and slams.',
    dmg: 15, hits: [0.08], dur: 0.3, poise: 4, reach: 92, str: 0.2, fin: 1.3, len: 66, width: 2,
    block: { slash: 0.95, sweep: 0.82, slam: 0.8 }, evade: { duck: 1.25, jump: 1.2, dodge: 1.3 }, perfect: 1.45, guardCost: 1.05,
  },
  anvilheart: {
    name: 'Anvilheart', cls: 'Greatsword', weight: 'Heavy', desc: 'Taken from the Forge Colossus. The heaviest blade there is: it guards against anything and hits like a falling wall, but you move in it like stone.',
    dmg: 40, hits: [0.3], dur: 0.8, poise: 16, reach: 108, str: 1.5, fin: 0.1, len: 96, width: 8,
    block: { slash: 1.3, sweep: 1.5, slam: 1.6 }, evade: { duck: 0.62, jump: 0.6, dodge: 0.66 }, perfect: 1, guardCost: 0.5,
  },
  rimefang: {
    name: 'Rimefangs', cls: 'Twinblades', weight: 'Light', desc: 'Taken from the Frost Regent. Two cold blades that never stop moving: superb ducks, jumps and steps, focus on every perfect evade, and almost no guard.',
    dmg: 12, hits: [0.08, 0.17], dur: 0.32, poise: 4, reach: 72, str: 0.15, fin: 1.3, len: 44, width: 2.8, twin: true,
    block: { slash: 0.72, sweep: 0.75, slam: 0.68 }, evade: { duck: 1.5, jump: 1.5, dodge: 1.5 }, perfect: 1, guardCost: 1.15, focus: true,
  },
  verdict: {
    name: 'Cobalt Verdict', cls: 'Executioner', weight: 'Heavy', desc: 'Taken from the Cobalt Executioner. A broad, square blade: unmatched against sweeps, strong against slams, slow at everything else.',
    dmg: 34, hits: [0.26], dur: 0.7, poise: 14, reach: 104, str: 1.4, fin: 0.2, len: 90, width: 9,
    block: { slash: 1.1, sweep: 1.6, slam: 1.35 }, evade: { duck: 0.7, jump: 0.7, dodge: 0.72 }, perfect: 1, guardCost: 0.6,
  },
  ashenthread: {
    name: 'Ashen Thread', cls: 'Katana', weight: 'Light', desc: 'Taken from the Ashen Weaver. A wire-thin edge: the widest deflect window yet, a riposte after every deflect, and focus from perfect evades.',
    dmg: 22, hits: [0.12], dur: 0.42, poise: 7, reach: 88, str: 0.4, fin: 1.15, len: 72, width: 2.2,
    block: { slash: 1.05, sweep: 0.9, slam: 0.88 }, evade: { duck: 1.1, jump: 1.05, dodge: 1.1 }, perfect: 1.8, guardCost: 1, riposte: true, focus: true,
  },
  mercy: {
    name: "Saint's Mercy", cls: 'Longsword', weight: 'Medium', desc: 'Taken from the Cloister Saint. A plain blade, perfectly balanced: it blocks and moves better than the Arming Sword in every way.',
    dmg: 26, hits: [0.14], dur: 0.42, poise: 8, reach: 86, str: 0.85, fin: 0.85, len: 64, width: 3.6,
    block: { slash: 1.15, sweep: 1.15, slam: 1.15 }, evade: { duck: 1.15, jump: 1.15, dodge: 1.15 }, perfect: 1.15, guardCost: 0.9,
  },
  thornbrand: {
    name: 'Thornbrand', cls: 'Sabre', weight: 'Light', desc: 'Taken from the Thorned Knight. A hooked, curving edge: it turns slashes aside, leaps and steps lightly, and meets slams poorly.',
    dmg: 26, hits: [0.12], dur: 0.38, poise: 7, reach: 86, str: 0.5, fin: 1.1, len: 66, width: 3, curved: true,
    block: { slash: 1.5, sweep: 1.0, slam: 0.82 }, evade: { duck: 1.05, jump: 1.35, dodge: 1.3 }, perfect: 1.15, guardCost: 0.9,
  },
  sovereign: {
    name: 'Sovereign Pair', cls: 'Twinblades', weight: 'Medium', desc: 'Taken from the Azure Sovereign. Two long blades, as good on guard as on the move: twin cuts with a real block behind them.',
    dmg: 17, hits: [0.1, 0.2], dur: 0.38, poise: 6, reach: 84, str: 0.95, fin: 0.95, len: 58, width: 3.2, twin: true,
    block: { slash: 1.15, sweep: 1.15, slam: 1.1 }, evade: { duck: 1.2, jump: 1.2, dodge: 1.2 }, perfect: 1.1, guardCost: 0.9,
  },
  hollow: {
    name: 'Hollow Crown', cls: 'Katana', weight: 'Light', desc: 'Taken from the Hollow King. A blade of nothing: the perfect deflect window is enormous and every deflect sets up a riposte.',
    dmg: 32, hits: [0.12], dur: 0.44, poise: 9, reach: 92, str: 0.5, fin: 1.25, len: 78, width: 2.6,
    block: { slash: 1.1, sweep: 1.0, slam: 1.0 }, evade: { duck: 1.1, jump: 1.1, dodge: 1.1 }, perfect: 2.1, guardCost: 0.95, riposte: true,
  },
  measure: {
    name: 'The First Measure', cls: 'Longsword', weight: 'Medium', desc: 'Taken from the Conductor. The blade the first rhythm was kept with: the best guard, the best footing and the hardest cut of any sword.',
    dmg: 40, hits: [0.14], dur: 0.42, poise: 12, reach: 92, str: 1.05, fin: 1.05, len: 70, width: 4,
    block: { slash: 1.3, sweep: 1.3, slam: 1.3 }, evade: { duck: 1.3, jump: 1.3, dodge: 1.3 }, perfect: 1.35, guardCost: 0.75, riposte: true,
  },
};
export const WEAPON_ORDER = ['arming', 'monolith', 'fangs', 'nightedge', 'crescent', 'undertow', 'glasspin', 'anvilheart', 'rimefang', 'verdict', 'ashenthread', 'mercy', 'thornbrand', 'sovereign', 'hollow', 'measure'];
export const UPGRADE_MAX = 5;
export const upgradeCost = (lvl) => [300, 700, 1400, 2600, 4200][lvl] ?? Infinity;

/* Character stats. Every point is one level. */
export const STATS = {
  vit: { name: 'Vitality', desc: '+9 health' },
  guard: { name: 'Guard', desc: 'Blocks fill your poise 4% less' },
  str: { name: 'Strength', desc: 'Damage with heavy and medium blades' },
  fin: { name: 'Finesse', desc: 'Damage with light and medium blades' },
  focus: { name: 'Focus', desc: 'Timing windows 1.5% wider' },
};
export const STAT_ORDER = ['vit', 'guard', 'str', 'fin', 'focus'];
export const BASE_STAT = 8;
export const levelOf = (s) => STAT_ORDER.reduce((a, k) => a + s[k], 0) - STAT_ORDER.length * BASE_STAT + 1;
export const levelCost = (lvl) => Math.floor(90 * Math.pow(1.14, lvl - 1));
export const maxHP = (s) => 90 + (s.vit - BASE_STAT) * 9;

/*
 * Enemies. Phrases are written in strikes: R slash, Y sweep, P slam. An upper-case letter lands one beat after the
 * last strike, a lower-case one half a beat after it (a fast follow-up), and '-' holds for an extra beat.
 */
export const ENEMIES = {
  sentinel: {
    name: 'Grid Sentinel', hp: 60, poise: 45, dmg: 12, slamDmg: 17, beat: 0.6, open: 0.95, rest: [0.7, 1.3],
    phrases: ['R', 'Y', 'P', 'RY', 'YR', 'RP', 'R-R', 'PY', 'YRY'], reach: 96, engage: 78, speed: 95, h: 62, w: 22, echoes: 45,
    blade: 58, look: 'blade',
  },
  shardling: {
    name: 'Shardling', hp: 38, poise: 30, dmg: 8, slamDmg: 12, beat: 0.46, open: 0.8, rest: [0.6, 1.0],
    phrases: ['Yy', 'RY', 'Yr', 'YyR', 'RyY', 'P'], reach: 80, engage: 62, speed: 150, h: 60, w: 20, echoes: 30,
    blade: 34, look: 'claw',
  },
  duelist: {
    name: 'Mirror Duelist', hp: 92, poise: 62, dmg: 14, slamDmg: 20, beat: 0.5, open: 0.85, rest: [0.6, 1.1],
    phrases: ['Rr', 'Yy', 'RyP', 'PrY', 'RrY', 'YyR', 'R-Pp', 'RYrY'], reach: 98, engage: 80, speed: 115, h: 62, w: 20, echoes: 95,
    blade: 64, look: 'rapier',
  },
  hammer: {
    name: 'Hammerframe', hp: 170, poise: 95, dmg: 18, slamDmg: 27, beat: 0.72, open: 1.1, rest: [0.9, 1.5],
    phrases: ['P', 'PP', 'YP', 'P-Pp', 'RYP', 'PyR', 'YP-P'], reach: 112, engage: 92, speed: 62, h: 64, w: 28, echoes: 160,
    blade: 108, look: 'hammer',
  },
  // met beyond the Verdant Circuit
  lancer: {
    name: 'Spire Lancer', hp: 80, poise: 55, dmg: 15, slamDmg: 21, beat: 0.62, open: 0.9, rest: [0.7, 1.2],
    phrases: ['P', 'R-P', 'PR', 'RP', 'P-P', 'RRP', 'PyR'], reach: 122, engage: 100, speed: 90, h: 66, w: 20, echoes: 70,
    blade: 96, look: 'spear',
  },
  wisp: {
    name: 'Flicker', hp: 30, poise: 26, dmg: 9, slamDmg: 13, beat: 0.44, open: 0.7, rest: [0.5, 0.9],
    phrases: ['Rr', 'Yy', 'RyR', 'YrY', 'Rr-Yy', 'RY'], reach: 76, engage: 60, speed: 175, h: 52, w: 18, echoes: 40,
    blade: 30, look: 'claw',
  },
  warden: {
    name: 'Bastion Warden', hp: 230, poise: 120, dmg: 20, slamDmg: 30, beat: 0.7, open: 1.0, rest: [0.9, 1.4],
    phrases: ['PY', 'YP', 'P-Yy', 'RPY', 'YyP', 'PRP'], reach: 116, engage: 94, speed: 55, h: 70, w: 30, echoes: 220,
    blade: 100, look: 'hammer',
  },
  blademaster: {
    name: 'Echo Blademaster', hp: 130, poise: 80, dmg: 16, slamDmg: 23, beat: 0.48, open: 0.8, rest: [0.6, 1.0],
    phrases: ['RrY', 'YyRr', 'PrYy', 'RyPr', 'RrPY', 'YRyR'], reach: 96, engage: 80, speed: 120, h: 64, w: 20, echoes: 140,
    blade: 70, look: 'rapier',
  },
};

/* The first boss's phases, as first written. The other wardens' are made in src/zones.js. */
export const BOSS1_PHASES = [
  { beat: 0.56, open: 0.85, rest: [0.5, 0.9], phrases: ['RY', 'Rr', 'YyR', 'P-R', 'RYP', 'Yy', 'RrY', 'PY'] },
  { beat: 0.5, open: 0.72, rest: [0.4, 0.75], phrases: ['RrYy', 'YyRr', 'PrY', 'RyPr', 'YRyP', 'RrP', 'YyYR'] },
  { beat: 0.44, open: 0.62, rest: [0.3, 0.6], phrases: ['RrYyP', 'YyRrY', 'PpRY', 'RyRyP', 'YRrYy', 'PrYyR', 'RrPpY'] },
];

export const ITEMS = {
  flask: { name: 'Lumen Shard', desc: 'One more healing flask.' },
  echoes: { name: 'Echo Cache', desc: 'A store of echoes.' },
};
