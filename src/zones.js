// The twelve zones of the Circuit, each ending in a warden fought in the duel view, each harder than the last.
// A zone is a theme (the world's neon: never red, yellow or purple, which belong to the attacks), a backdrop style,
// its enemies (scaled up zone by zone), a layout built from src/level.js segments, and its boss.
import { Builder, verdantPrefix } from './level.js';
import { ENEMIES, BOSS1_PHASES } from './data.js';
import { parsePhrase, survivable } from './combat.js';
import { rgbOf } from './util.js';

const tint = (hex, k) => '#' + rgbOf(hex).split(',').map((v) => Math.round(+v + (255 - v) * k).toString(16).padStart(2, '0')).join('');
function seeded(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ---------- enemies, zone by zone ---------- */
/** An enemy's stats in zone z (1..12): tougher, harder hitting, a little quicker, worth more. */
export function foeDef(type, z) {
  const d = ENEMIES[type], i = z - 1;
  return {
    ...d,
    hp: Math.round(d.hp * (1 + 0.22 * i)), poise: Math.round(d.poise * (1 + 0.1 * i)),
    dmg: Math.round(d.dmg * (1 + 0.11 * i)), slamDmg: Math.round(d.slamDmg * (1 + 0.11 * i)),
    beat: Math.max(0.42, d.beat * Math.max(0.85, 1 - 0.015 * i)), open: Math.max(0.55, d.open * (1 - 0.025 * i)),
    rest: d.rest.map((r) => r * Math.max(0.7, 1 - 0.03 * i)), echoes: Math.round(d.echoes * (1 + 0.4 * i)),
  };
}

/* ---------- bosses ---------- */
/**
 * Phrases for a boss phase: n distinct, each one answerable alone, `len` strikes long, with fast follow-ups
 * (lower case) at rate `fast` and at most `run` in a row. w: how much it favours slash, sweep, slam.
 */
function genPhrases(seed, n, len, fast, run, w) {
  const r = seeded(seed), out = new Set(), keys = ['R', 'Y', 'P'], tot = w[0] + w[1] + w[2];
  const pickL = () => { let x = r() * tot; for (let i = 0; i < 3; i++) { x -= w[i]; if (x <= 0) return keys[i]; } return 'R'; };
  for (let tries = 0; out.size < n && tries < 2000; tries++) {
    const L = len[0] + Math.floor(r() * (len[1] - len[0] + 1));
    let s = '', inRun = 0;
    for (let i = 0; i < L; i++) {
      const ch = pickL();
      if (i && inRun < run && r() < fast) { s += ch.toLowerCase(); inRun++; }
      else { if (i && r() < 0.1) s += '-'; s += ch; inRun = 0; }
    }
    if (survivable(parsePhrase(s, 0.42).map((x) => ({ type: x.type, time: x.dt })))) out.add(s);
  }
  return [...out];
}
/** Boss i (0..11): more phases, faster beats, longer phrases, shorter openings and less warning, the later it is. */
function bossDef(i, o) {
  const np = o.phases ? o.phases.length : i < 7 ? 3 : i < 11 ? 4 : 5;
  const phases = o.phases || Array.from({ length: np }, (_, k) => ({
    beat: Math.max(0.42, (0.56 - 0.009 * i) * Math.pow(0.91, k)),
    open: Math.max(0.42, 0.85 - 0.028 * i - 0.1 * k),
    rest: [Math.max(0.2, 0.5 - 0.022 * i - 0.08 * k), Math.max(0.38, 0.9 - 0.035 * i - 0.12 * k)],
    phrases: genPhrases(1000 * (i + 1) + 17 * k, 8,
      [Math.min(6, 2 + k + Math.floor(i / 4)), Math.min(7, 3 + k + Math.floor(i / 3))],
      Math.min(0.62, 0.24 + 0.032 * i + 0.06 * k), i < 6 ? 1 : 2, o.w || [1, 1, 1]),
  }));
  const leads = phases.map((_, k) => Math.max(0.85, [1.6, 1.25, 1.0, 0.95, 0.9][k] * (1 - 0.018 * i)));
  return {
    hp: 120 + 16 * i, poise: 100 + 8 * i, dmg: Math.round(15 + 2.2 * i), slamDmg: Math.round(22 + 3.2 * i),
    echoes: Math.round(2400 * (1 + 0.55 * i) / 100) * 100, ...o, phases, leads,
  };
}

/* ---------- area recipes: a zone's layout is a list of these ---------- */
// Each takes the builder and the zone's enemy picker; foes(n) draws n from the zone's roster, elite() its strongest.
const AREAS = {
  hall: (b, R) => b.room(22, { foes: R.foes(2) }).stairs(2, -1).room(18, { foes: R.foes(1), items: [R.cache(0.7)] }),
  pits: (b, R) => b.room(10).gap(3).room(18, { foes: R.foes(1) }).gap(3).room(10),
  rise: (b, R) => b.room(8).climb(9).room(20, { foes: R.foes(2) }),
  tower: (b, R) => b.room(8).climb(12).room(14, { foes: R.foes(1) }),
  drop: (b, R) => b.room(8).descend(9).room(24, { foes: R.foes(2), items: [R.cache(0.85)] }),
  deep: (b, R) => b.room(8).descend(12).room(18, { foes: R.foes(1) }),
  under: (b, R) => b.under(42, { foes: R.foes(1), lower: R.foes(2), items: [R.cache(0.5)] }),
  vault: (b, R, it) => b.room(14, { foes: R.foes(1) }).vault(it || R.cache()).room(16, { foes: R.foes(1) }),
  ambush: (b, R) => b.ambush(32, { perched: R.foes(1)[0], foes: R.foes(1) }),
  duel: (b, R) => b.room(26, { h: 9, foes: [R.elite()] }),
  steps: (b, R) => b.stairs(3, 1).room(16, { foes: R.foes(1) }).stairs(3, -1),
  gauntlet: (b, R) => b.room(38, { h: 8, foes: R.foes(3) }),
  bridge: (b, R) => b.room(20, { foes: R.foes(1) }).gap(3).room(8).gap(3).room(20, { foes: R.foes(1) }),
};

/** Builds a zone from its recipe: an entry, beacons, named areas, and the arena. */
function recipe(z) {
  return (b) => {
    const r = seeded(z.id * 7919), roster = z.foes, strong = z.elite;
    let k = 0;
    const R = {
      foes: (n) => Array.from({ length: n }, () => roster[Math.floor(r() * roster.length)]),
      elite: () => strong,
      cache: (at = 0.6) => ({ kind: 'echoes', amount: Math.round(z.cache * (0.8 + r() * 0.5) / 10) * 10, at }),
    };
    b.entry(z.id - 1);
    for (const [name, ...parts] of z.areas) {
      b.region(name);
      for (const p of parts) {
        if (p.startsWith('beacon:')) { k++; b.beacon(`z${z.id}b${k}`, p.slice(7)); continue; }
        if (p === 'shard') { AREAS.vault(b, R, { kind: 'flask', id: `z${z.id}-shard` }); continue; }
        // (owner) every second Lumen Shard is gone: its vault holds echoes instead, so the layout stays the same
        if (p === 'shardless') { AREAS.vault(b, R, { kind: 'echoes', amount: z.cache, id: `z${z.id}-shardless` }); continue; }
        AREAS[p](b, R);
      }
    }
    b.region('Antechamber');
    b.arena(`z${z.id}b${k + 1}`, z.id < 12 ? z.id + 1 : 0, { name: z.ante || 'Antechamber' });
  };
}

/* ---------- the zones ---------- */
const P = (neon, neon2, style) => ({ neon, neon2, style });
export const ZONES = [
  {
    id: 1, name: 'The Verdant Circuit', theme: P('#3dff9a', '#19e0b0', 'towers'), music: { shift: 0, bpm: 0 },
    // the start, drawn by hand, then the far circuit beyond the Spans
    build: (b) => {
      verdantPrefix(b);
      b.region('The Overpass').room(8).climb(9).room(26, { foes: ['sentinel', 'duelist'] }).stairs(2, -1)
        .room(18, { foes: ['shardling'], items: [{ id: 'z1-cache4', kind: 'echoes', amount: 320, at: 0.8 }] });
      b.region('Signal Gardens').beacon('b4', 'Signal Gardens').room(20, { foes: ['hammer'] }).gap(3).room(12).gap(3)
        .room(22, { foes: ['sentinel', 'shardling'] }).vault({ id: 'shard3', kind: 'flask' }).room(16, { foes: ['duelist'] });
      b.region('The Deep Relay').room(6).descend(12)
        .under(42, { foes: ['sentinel'], lower: ['hammer', 'shardling'], items: [{ id: 'z1-cache5', kind: 'echoes', amount: 420 }] })
        .room(20, { foes: ['duelist', 'sentinel'] }).ambush(32, { perched: 'shardling', foes: ['sentinel'] });
      b.region('Relay Depths').beacon('b5', 'Relay Depths').room(12);
      b.region('Lantern Stair').climb(12).room(14, { foes: ['shardling'] }).climb(6).room(24, { foes: ['hammer', 'duelist'] })
        .stairs(3, 1).room(10).descend(6).room(8);
      b.region('Antechamber');
      b.arena('b3', 2);
    },
    keepTop: true,
    boss: {
      name: 'THE TWIN DANCER', sub: 'Warden of the Verdant Circuit', short: 'The Twin Dancer',
      look: { twin: true, sword: 150, bladeW: 4.5, headR: 15 }, reward: 'crescent',
      lines: ['She draws her second wind', 'The last dance'], quiet: 'The Verdant Circuit is quiet',
    },
  },
  {
    id: 2, name: 'The Sunken Relay', theme: P('#33ffc8', '#14c9a6', 'arches'), music: { shift: -2, bpm: -4 },
    foes: ['sentinel', 'shardling', 'lancer', 'sentinel'], elite: 'hammer', cache: 380,
    areas: [['Floodgate', 'beacon:Floodgate', 'hall'], ['The Sluice', 'pits', 'drop'], ['Drowned Stacks', 'vault', 'ambush'],
      ['Pump Hall', 'beacon:Pump Hall', 'gauntlet', 'rise'], ['The Outflow', 'under', 'duel', 'steps']],
    boss: {
      name: 'THE DROWNED HERALD', sub: 'Warden of the Sunken Relay', short: 'The Drowned Herald', w: [1, 0.8, 1.6],
      look: { sword: 190, bladeW: 5.5, headR: 16 }, reward: 'undertow',
      lines: ['The water rises with him', 'He calls the tide down'], quiet: 'The Relay drains and falls still',
    },
  },
  {
    id: 3, name: 'The Glasswork Spires', theme: P('#4fc3ff', '#2a8cff', 'spires'), music: { shift: 3, bpm: 4 },
    foes: ['lancer', 'duelist', 'wisp', 'sentinel'], elite: 'duelist', cache: 520,
    areas: [['Prism Gate', 'beacon:Prism Gate', 'rise'], ['The Needles', 'tower', 'bridge'], ['Refraction Hall', 'gauntlet', 'shardless'],
      ['Mirror Court', 'beacon:Mirror Court', 'duel', 'drop'], ['The Upper Panes', 'tower', 'ambush', 'pits']],
    boss: {
      name: 'THE GLASS DUCHESS', sub: 'Warden of the Glasswork Spires', short: 'The Glass Duchess', w: [1.7, 0.9, 0.7],
      look: { sword: 170, bladeW: 2.6, headR: 14 }, reward: 'glasspin',
      lines: ['Her edges multiply', 'Every pane a blade'], quiet: 'The Spires stop ringing',
    },
  },
  {
    id: 4, name: 'The Hollow Foundry', theme: P('#4dff6a', '#1fcf4a', 'domes'), music: { shift: -5, bpm: -6 },
    foes: ['hammer', 'warden', 'sentinel', 'shardling'], elite: 'warden', cache: 680,
    areas: [['Slag Gate', 'beacon:Slag Gate', 'hall'], ['The Crucibles', 'deep', 'gauntlet'], ['Anvil Row', 'steps', 'vault'],
      ['The Bellows', 'beacon:The Bellows', 'under', 'rise'], ['Pour Floor', 'duel', 'bridge', 'ambush']],
    boss: {
      name: 'THE FORGE COLOSSUS', sub: 'Warden of the Hollow Foundry', short: 'The Forge Colossus', w: [0.8, 1.3, 1.6],
      look: { sword: 175, bladeW: 9, headR: 18 }, reward: 'anvilheart',
      lines: ['The furnace in him roars', 'He pours himself out'], quiet: 'The Foundry cools',
    },
  },
  {
    id: 5, name: 'The Frostline Array', theme: P('#c8f4ff', '#7fd8ff', 'shards'), music: { shift: 5, bpm: 2 },
    foes: ['wisp', 'duelist', 'lancer', 'warden'], elite: 'warden', cache: 860,
    areas: [['Rime Gate', 'beacon:Rime Gate', 'rise', 'pits'], ['The Icefall', 'deep', 'ambush'], ['Frozen Relays', 'gauntlet', 'vault'],
      ['Whiteout', 'beacon:Whiteout', 'bridge', 'tower'], ['The Glacier Stair', 'steps', 'duel', 'under']],
    boss: {
      name: 'THE FROST REGENT', sub: 'Warden of the Frostline Array', short: 'The Frost Regent', w: [0.9, 1.7, 0.8],
      look: { twin: true, sword: 135, bladeW: 4, headR: 15 }, reward: 'rimefang',
      lines: ['The cold bites deeper', 'Winter without end'], quiet: 'The Array thaws',
    },
  },
  {
    id: 6, name: 'The Cobalt Depths', theme: P('#4d7bff', '#2f55e0', 'rings'), music: { shift: -3, bpm: -2 },
    foes: ['warden', 'hammer', 'blademaster', 'shardling'], elite: 'blademaster', cache: 1060,
    areas: [['Trench Gate', 'beacon:Trench Gate', 'drop'], ['The Abyssal Walk', 'deep', 'gauntlet'], ['Pressure Halls', 'under', 'shard'],
      ['The Lightless', 'beacon:The Lightless', 'ambush', 'steps'], ['Cobalt Throne Road', 'duel', 'rise', 'pits']],
    boss: {
      name: 'THE COBALT EXECUTIONER', sub: 'Warden of the Cobalt Depths', short: 'The Cobalt Executioner', w: [1.2, 1, 1.5],
      look: { sword: 200, bladeW: 8, headR: 17 }, reward: 'verdict',
      lines: ['The verdict is read', 'Sentence is passed'], quiet: 'The Depths go dark and calm',
    },
  },
  {
    id: 7, name: 'The Ashen Lattice', theme: P('#cfe0e8', '#8aa4b0', 'lattice'), music: { shift: 1, bpm: 6 },
    foes: ['wisp', 'blademaster', 'duelist', 'lancer'], elite: 'blademaster', cache: 1280,
    areas: [['Cinder Gate', 'beacon:Cinder Gate', 'bridge'], ['The Girders', 'tower', 'pits'], ['Weaving Floor', 'gauntlet', 'vault'],
      ['Ash Choir', 'beacon:Ash Choir', 'ambush', 'drop'], ['The Loom', 'duel', 'under', 'steps']],
    boss: {
      name: 'THE ASHEN WEAVER', sub: 'Warden of the Ashen Lattice', short: 'The Ashen Weaver', w: [1.4, 1.3, 0.8],
      look: { twin: true, sword: 110, bladeW: 3, headR: 14 }, reward: 'ashenthread',
      lines: ['She pulls the threads tight', 'The pattern closes', 'The last stitch'], quiet: 'The Lattice unravels',
    },
  },
  {
    id: 8, name: 'The Tidewater Cloister', theme: P('#2ff0e0', '#12b8b0', 'arches'), music: { shift: -4, bpm: 0 },
    foes: ['lancer', 'warden', 'sentinel', 'blademaster'], elite: 'warden', cache: 1500,
    areas: [['Cloister Gate', 'beacon:Cloister Gate', 'hall'], ['The Nave', 'gauntlet', 'rise'], ['Tidal Chapels', 'under', 'ambush'],
      ['The Bell Tower', 'beacon:The Bell Tower', 'tower', 'pits'], ['Saint\'s Walk', 'duel', 'drop', 'vault']],
    boss: {
      name: 'THE CLOISTER SAINT', sub: 'Warden of the Tidewater Cloister', short: 'The Cloister Saint', w: [1.2, 1.2, 1.2],
      look: { sword: 160, bladeW: 4.5, headR: 15, curved: true }, reward: 'mercy',
      lines: ['The bells ring for you', 'Her hymn quickens', 'Vespers'], quiet: 'The bells go quiet',
    },
  },
  {
    id: 9, name: 'The Overgrowth', theme: P('#2fe07a', '#13a85a', 'spires'), music: { shift: 2, bpm: -4 },
    foes: ['shardling', 'wisp', 'hammer', 'blademaster'], elite: 'hammer', cache: 1750,
    areas: [['Root Gate', 'beacon:Root Gate', 'drop'], ['The Tangle', 'ambush', 'gauntlet'], ['Thorn Galleries', 'steps', 'shardless'],
      ['The Canopy', 'beacon:The Canopy', 'tower', 'bridge'], ['Bramble Court', 'duel', 'under', 'pits']],
    boss: {
      name: 'THE THORNED KNIGHT', sub: 'Warden of the Overgrowth', short: 'The Thorned Knight', w: [1.1, 1.6, 1],
      look: { sword: 185, bladeW: 6, headR: 16 }, reward: 'thornbrand',
      lines: ['The thorns grow back', 'He takes root', 'Bloom'], quiet: 'The Overgrowth withers',
    },
  },
  {
    id: 10, name: 'The Azure Reach', theme: P('#3aa8ff', '#1f6fe0', 'towers'), music: { shift: 4, bpm: 6 },
    foes: ['blademaster', 'lancer', 'warden', 'duelist'], elite: 'blademaster', cache: 2000,
    areas: [['Sky Gate', 'beacon:Sky Gate', 'rise', 'bridge'], ['The High Spans', 'pits', 'tower'], ['Sovereign Halls', 'gauntlet', 'vault'],
      ['The Zenith', 'beacon:The Zenith', 'ambush', 'deep'], ['Crown Road', 'duel', 'under', 'steps']],
    boss: {
      name: 'THE AZURE SOVEREIGN', sub: 'Warden of the Azure Reach', short: 'The Azure Sovereign', w: [1.3, 1.1, 1.3],
      look: { twin: true, sword: 165, bladeW: 5, headR: 16 }, reward: 'sovereign',
      lines: ['The sky answers him', 'Both crowns drawn', 'The Reach is his'], quiet: 'The Reach falls silent',
    },
  },
  {
    id: 11, name: 'The Null Expanse', theme: P('#e8f2ff', '#9fb4c8', 'void'), music: { shift: -6, bpm: -8 },
    foes: ['blademaster', 'warden', 'lancer', 'wisp', 'duelist'], elite: 'warden', cache: 2300,
    areas: [['Edge of Nothing', 'beacon:Edge of Nothing', 'pits', 'drop'], ['The Blank', 'gauntlet', 'ambush'], ['Silent Stacks', 'under', 'tower'],
      ['The Hollow', 'beacon:The Hollow', 'bridge', 'duel'], ['Null Road', 'steps', 'gauntlet', 'shard']],
    boss: {
      name: 'THE HOLLOW KING', sub: 'Warden of the Null Expanse', short: 'The Hollow King', w: [1.2, 1.2, 1.4],
      look: { sword: 210, bladeW: 7, headR: 17 }, reward: 'hollow',
      lines: ['Nothing answers him', 'The crown empties', 'He is the silence'], quiet: 'The Expanse is empty at last',
    },
  },
  {
    id: 12, name: 'The Heart of the Circuit', theme: P('#eafff3', '#3dff9a', 'rings'), music: { shift: 0, bpm: 10 },
    foes: ['blademaster', 'warden', 'lancer', 'wisp', 'duelist', 'hammer'], elite: 'blademaster', cache: 2700,
    areas: [['The Pulse', 'beacon:The Pulse', 'rise', 'gauntlet'], ['Arteries', 'pits', 'under'], ['The Chambers', 'ambush', 'duel'],
      ['The Core Stair', 'beacon:The Core Stair', 'tower', 'shardless'], ['The Last Measure', 'bridge', 'gauntlet', 'duel', 'steps']],
    ante: 'The Podium',
    boss: {
      name: 'THE CONDUCTOR', sub: 'Keeper of the First Rhythm', short: 'The Conductor', w: [1, 1, 1],
      look: { twin: true, sword: 180, bladeW: 5, headR: 16 }, reward: 'measure',
      lines: ['The tempo rises', 'Every warden in one', 'The rhythm turns on you', 'Fortissimo'], quiet: 'The Circuit keeps your rhythm now',
    },
  },
];
for (const z of ZONES) {
  if (!z.build) z.build = recipe(z);
  const i = z.id - 1;
  z.boss = bossDef(i, i === 0 ? { ...z.boss, phases: BOSS1_PHASES } : z.boss);
  // the warden glows nearly white, with a breath of its zone's colour
  const lk = z.boss.look, col = lk.color || (i === 0 ? '#f2fbff' : tint(z.theme.neon, 0.72));
  z.boss.look = { ...lk, color: col, rgb: rgbOf(col) };
}
export const LAST_ZONE = ZONES.length;
export const zoneById = (id) => ZONES[id - 1] || ZONES[0];

/** Builds a zone's level fresh (doors and gates are opened on the copy as you play). */
export function buildZone(id) {
  const z = zoneById(id), b = new Builder(z.id);
  if (!z.keepTop) b.f = 80;
  z.build(b);
  const L = b.finish({ keepTop: z.keepTop });
  L.theme = z.theme;
  return L;
}

/** Which zone a beacon is in: zone 1 keeps its first ids (b1..b5), the rest are z<zone>b<n>. */
export const zoneOfBeacon = (id) => { const m = /^z(\d+)b/.exec(id || ''); return m ? +m[1] : 1; };

let INDEX = null;
/** Every beacon in every zone: id, name, zone. */
export function beaconIndex() {
  if (!INDEX) { INDEX = []; for (const z of ZONES) for (const b of buildZone(z.id).beacons) INDEX.push({ id: b.id, name: b.name, zone: z.id }); }
  return INDEX;
}
