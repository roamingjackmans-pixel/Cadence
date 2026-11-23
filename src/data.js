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
 * A weapon that blocks well is heavy to move in; a light one dodges well and blocks poorly.
 */
export const WEAPONS = {
  arming: {
    name: 'Arming Sword', cls: 'Longsword', desc: 'A plain, honest blade. Blocks and moves equally well.',
    dmg: 14, hits: [0.14], dur: 0.42, poise: 5, reach: 82, str: 0.55, fin: 0.55, len: 60, width: 3.4,
    block: { slash: 1, sweep: 1, slam: 1 }, evade: { duck: 1, jump: 1, dodge: 1 }, perfect: 1, guardCost: 1,
  },
  monolith: {
    name: 'Monolith', cls: 'Greatsword', desc: 'A slab of light. Its guard takes anything, best against sweeps and slams, but it is slow to duck and jump with. Blocks cost less poise.',
    dmg: 30, hits: [0.26], dur: 0.72, poise: 12, reach: 104, str: 1.35, fin: 0.15, len: 92, width: 7,
    block: { slash: 1.15, sweep: 1.4, slam: 1.55 }, evade: { duck: 0.72, jump: 0.68, dodge: 0.75 }, perfect: 1, guardCost: 0.65,
  },
  fangs: {
    name: 'Twin Fangs', cls: 'Twinblades', desc: 'Two short blades, two quick cuts. A poor guard, but ducks, jumps and steps come easy. A perfect evade sharpens your focus for a moment.',
    dmg: 8, hits: [0.09, 0.19], dur: 0.34, poise: 3, reach: 70, str: 0.15, fin: 1.25, len: 40, width: 2.8, twin: true,
    block: { slash: 0.72, sweep: 0.7, slam: 0.7 }, evade: { duck: 1.45, jump: 1.35, dodge: 1.45 }, perfect: 1, guardCost: 1.2, focus: true,
  },
  nightedge: {
    name: 'Nightedge', cls: 'Katana', desc: 'Rewards exact timing: a wide perfect-deflect window, and a riposte after every deflect that cuts through the guard.',
    dmg: 18, hits: [0.13], dur: 0.44, poise: 6, reach: 86, str: 0.45, fin: 1.0, len: 70, width: 2.6,
    block: { slash: 1.05, sweep: 0.92, slam: 0.9 }, evade: { duck: 1, jump: 1, dodge: 1 }, perfect: 1.65, guardCost: 1, riposte: true,
  },
  crescent: {
    name: 'Crescent', cls: 'Sabre', desc: 'Taken from the Twin Dancer. Turns aside slashes like nothing else and leaps lightly, but meets sweeps poorly.',
    dmg: 17, hits: [0.12], dur: 0.38, poise: 6, reach: 84, str: 0.55, fin: 0.95, len: 64, width: 3, curved: true,
    block: { slash: 1.55, sweep: 0.82, slam: 1.05 }, evade: { duck: 1, jump: 1.3, dodge: 1.1 }, perfect: 1.1, guardCost: 0.9,
  },
};
export const WEAPON_ORDER = ['arming', 'monolith', 'fangs', 'nightedge', 'crescent'];
export const UPGRADE_MAX = 3;
export const upgradeCost = (lvl) => [300, 700, 1400][lvl] ?? Infinity;

/* Character stats. Every point is one level. */
export const STATS = {
  vit: { name: 'Vitality', desc: '+9 health' },
  guard: { name: 'Guard', desc: 'Blocks fill your poise 4% less' },
  str: { name: 'Strength', desc: 'Damage with heavy blades' },
  fin: { name: 'Finesse', desc: 'Damage with light blades' },
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
    phrases: ['R', 'Y', 'P', 'RY', 'YR', 'RP', 'R-R', 'PY', 'YRY'], reach: 96, engage: 78, speed: 95, h: 64, w: 22, echoes: 45,
    blade: 58, look: 'blade',
  },
  shardling: {
    name: 'Shardling', hp: 38, poise: 30, dmg: 8, slamDmg: 12, beat: 0.46, open: 0.8, rest: [0.6, 1.0],
    phrases: ['Yy', 'RY', 'Yr', 'YyR', 'RyY', 'P'], reach: 80, engage: 62, speed: 150, h: 42, w: 20, echoes: 30,
    blade: 34, look: 'claw',
  },
  duelist: {
    name: 'Mirror Duelist', hp: 92, poise: 62, dmg: 14, slamDmg: 20, beat: 0.5, open: 0.85, rest: [0.6, 1.1],
    phrases: ['Rr', 'Yy', 'RyP', 'PrY', 'RrY', 'YyR', 'R-Pp', 'RYrY'], reach: 98, engage: 80, speed: 115, h: 64, w: 20, echoes: 95,
    blade: 64, look: 'rapier',
  },
  hammer: {
    name: 'Hammerframe', hp: 170, poise: 95, dmg: 18, slamDmg: 27, beat: 0.72, open: 1.1, rest: [0.9, 1.5],
    phrases: ['P', 'PP', 'YP', 'P-Pp', 'RYP', 'PyR', 'YP-P'], reach: 112, engage: 92, speed: 62, h: 86, w: 34, echoes: 160,
    blade: 80, look: 'hammer',
  },
};

/* The first boss, fought in the third-person duel view. */
export const BOSS = {
  name: 'THE TWIN DANCER', sub: 'Warden of the Verdant Circuit', hp: 120, poise: 100, dmg: 15, slamDmg: 22, echoes: 2400,
  phases: [
    { beat: 0.56, open: 0.85, rest: [0.5, 0.9], phrases: ['RY', 'Rr', 'YyR', 'P-R', 'RYP', 'Yy', 'RrY', 'PY'] },
    { beat: 0.5, open: 0.72, rest: [0.4, 0.75], phrases: ['RrYy', 'YyRr', 'PrY', 'RyPr', 'YRyP', 'RrP', 'YyYR'] },
    { beat: 0.44, open: 0.62, rest: [0.3, 0.6], phrases: ['RrYyP', 'YyRrY', 'PpRY', 'RyRyP', 'YRrYy', 'PrYyR', 'RrPpY'] },
  ],
};

export const ITEMS = {
  flask: { name: 'Lumen Shard', desc: 'One more healing flask.' },
  echoes: { name: 'Echo Cache', desc: 'A store of echoes.' },
};
