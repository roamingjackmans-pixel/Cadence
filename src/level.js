// The areas, carved out of solid rock tile by tile. A Builder walks a cursor left to right (column c, floor row f:
// the first solid row under your feet) and each segment carves its piece and moves the cursor on. Every zone is a
// list of segments in src/zones.js; the start of the Verdant Circuit is drawn by hand below.
// Tiles: 0 air, 1 solid, 2 one-way platform (stand on it, jump up through it), 3 a closed door or gate.
//
// Rules the segments keep, so every zone can be walked both ways:
//   a full jump rises about 3.6 tiles and carries about 4.5 across; near an enemy every jump is a hop (about 1.1 tiles
//   up, 2.6 across). So platforms are 3 rows apart, steps are 1 tile, pits are 3 wide and no enemy stands within
//   8 tiles of one.
export const T = 32;
const BW = 1600, BH = 160, START_F = 80;

export class Builder {
  constructor(zone) {
    this.zone = zone;
    this.tiles = new Uint8Array(BW * BH).fill(1);
    this.c = 0; this.f = START_F; this.maxC = 0;
    this.enemies = []; this.items = []; this.beacons = []; this.gates = []; this.regions = []; this.pits = []; this.exits = [];
    this.spawns = {}; this.gaps = []; this.n = 0; this.open = null;
  }
  set(c, r, v) { if (c >= 0 && c < BW && r >= 0 && r < BH) { this.tiles[r * BW + c] = v; if (v !== 1 && c > this.maxC) this.maxC = c; } }
  carve(c0, r0, c1, r1) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, 0); return this; }
  fill(c0, r0, c1, r1) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, 1); return this; }
  plat(c0, c1, r) { for (let c = c0; c <= c1; c++) this.set(c, r, 2); return this; }
  at(c, r) { return c < 0 || c >= BW || r < 0 || r >= BH ? 1 : this.tiles[r * BW + c]; }
  /** First non-air row at or below r. */
  ground(c, r) { while (r < BH && this.at(c, r) === 0) r++; return r; }

  foe(type, c, r = this.f, extra) { this.enemies.push({ type, c, r, ...extra }); return this; }
  item(it, c, r = this.f) { this.items.push({ id: it.id || `z${this.zone}-i${this.n++}`, ...it, c, r }); return this; }
  /** Names the stretch from here to the next region() call; the HUD shows it the first time you walk in. */
  region(name) { this.closeRegion(); this.open = { name, c0: this.c }; return this; }
  closeRegion() { if (this.open) { this.regions.push({ ...this.open, c1: this.c, band: false }); this.open = null; } }
  /** Foes spread evenly along [c0, c1], never within 8 tiles of a pit. */
  spread(types, c0, c1, r = this.f) {
    types.forEach((t, i) => {
      let c = Math.round(c0 + (i + 1) * (c1 - c0) / (types.length + 1));
      for (const g of this.gaps) if (Math.abs(c - g) < 8) c = g < c ? g + 8 : g - 8;
      this.foe(t, c, r);
    });
  }

  /* ---------- segments ---------- */
  /** A corridor: o.h tall (7), o.foes spread along it, o.items at o.items[i].at (0..1 along it). */
  room(len, o = {}) {
    const c = this.c, f = this.f, h = o.h || 7;
    this.carve(c, f - h, c + len - 1, f - 1);
    this.c += len;
    if (o.foes) this.spread(o.foes, c, c + len - 1);
    for (const it of o.items || []) this.item(it, c + Math.round((it.at ?? 0.5) * (len - 1)));
    return this;
  }
  /** n one-tile steps, 3 wide each: dir -1 climbs, +1 descends. */
  stairs(n, dir, h = 7) {
    for (let i = 0; i < n; i++) { this.f += dir; this.carve(this.c, this.f - h, this.c + 2, this.f - 1); this.c += 3; }
    return this;
  }
  /** A pit into the dark, w wide (3 at most). */
  gap(w = 3, h = 7) {
    this.carve(this.c, this.f - h, this.c + w - 1, this.f + 1);
    this.pits.push({ c0: this.c, c1: this.c + w - 1, r: this.f });
    this.gaps.push(this.c, this.c + w - 1);
    this.c += w;
    return this;
  }
  /** A shaft up: one-way ledges 3 rows apart, alternating sides, the top one on the way out. rise: rows, 3 per ledge. */
  climb(rise, h = 7) {
    const c = this.c, f = this.f, n = rise / 3;
    this.carve(c, f - rise - h, c + 4, f - 1);
    for (let k = 1; k <= n; k++) { const right = (n - k) % 2 === 0; this.plat(right ? c + 2 : c, right ? c + 4 : c + 2, f - 3 * k); }
    this.c += 5; this.f -= rise;
    return this;
  }
  /** A shaft down, with ledges to climb back up by. */
  descend(depth, h = 7) {
    const c = this.c, f = this.f, n = depth / 3;
    this.carve(c, f - h, c + 4, f + depth - 1);
    for (let k = 1; k < n; k++) { const left = k % 2 === 1; this.plat(left ? c : c + 2, left ? c + 2 : c + 4, f + 3 * k); }
    this.c += 5; this.f += depth;
    return this;
  }
  /** A climb out of the corridor's ceiling to a small room above with something in it. The corridor runs on under. */
  vault(it, o = {}) {
    const c = this.c, f = this.f, left = !!o.left;
    this.carve(c, f - 15, c + 4, f - 1);
    this.plat(c, c + 2, f - 3); this.plat(c + 2, c + 4, f - 6); this.plat(left ? c : c + 2, left ? c + 2 : c + 4, f - 9);
    if (left) { this.carve(c - 8, f - 14, c - 1, f - 10); this.item(it, c - 6, f - 9); }
    else { this.carve(c + 5, f - 14, c + 12, f - 10); this.item(it, c + 10, f - 9); }
    this.c += 5;
    return this;
  }
  /** The floor gives way into a lower passage that runs under the corridor and climbs back up at its far end. */
  under(len, o = {}) {
    const c = this.c, f = this.f, x = c + len - 6;
    this.carve(c, f - 7, c + len - 1, f - 1);
    this.carve(c + 4, f, c + 6, f + 2);                   // the hole
    this.gaps.push(c + 4, c + 6);
    this.carve(c + 2, f + 3, c + len - 2, f + 8);         // the lower passage (floor f + 9)
    this.carve(x, f, x + 2, f + 2);                       // the way back up, flush with the corridor's floor
    this.plat(x, x + 2, f); this.plat(x, x + 2, f + 3); this.plat(x, x + 2, f + 6);
    this.c += len;
    if (o.foes) this.spread(o.foes, c + 8, x - 1);
    if (o.lower) this.spread(o.lower, c + 8, x - 2, f + 9);
    for (const it of o.items || []) this.item(it, c + 8 + Math.round((it.at ?? 0.5) * (len - 18)), f + 9);
    return this;
  }
  /** A tall room with a ledge near its start: something waits on it and drops behind you once you pass. */
  ambush(len, o = {}) {
    const c = this.c, f = this.f;
    this.carve(c, f - 9, c + len - 1, f - 1);
    this.plat(c + 5, c + 11, f - 6);
    this.foe(o.perched || 'sentinel', c + 8, f - 6, { ambush: c + 14 });
    this.c += len;
    if (o.foes) this.spread(o.foes, c + 18, c + len - 1);
    return this;
  }
  beacon(id, name, o = {}) {
    const c = this.c, f = this.f, len = o.len || 14;
    this.carve(c, f - (o.h || 7), c + len - 1, f - 1);
    this.beacons.push({ id, name, c: c + (len >> 1), r: f });
    this.c += len;
    return this;
  }
  /** Where a zone begins: a passage back to the last one, and room to arrive. */
  entry(prev) {
    const f = this.f;
    this.carve(0, f - 6, 11, f - 1);
    if (prev) this.exits.push({ c0: -2, c1: 1, r0: f - 6, r1: f, to: prev, spawn: 'back' });
    this.spawns.entry = { c: 5, r: f, face: 1 };
    this.c = 12;
    return this;
  }
  /** The antechamber and its beacon, the arena door, the arena, and (past a second door) the way on to `next`. */
  arena(beaconId, next, o = {}) {
    this.beacon(beaconId, o.name || 'Antechamber', { h: 8 });
    const f = this.f, d = this.c;
    for (let r = f - 4; r <= f - 1; r++) this.set(d, r, 3);
    this.carve(d + 1, f - 18, d + 19, f - 1);
    this.door = { c: d, r0: f - 4, r1: f - 1 };
    this.arenaDef = { c0: d + 1, c1: d + 20, floor: f, bossC: d + 14 };
    const e = d + 20;
    if (next) {
      for (let r = f - 4; r <= f - 1; r++) this.set(e, r, 3);
      this.carve(e + 1, f - 5, e + 13, f - 1);
      this.exitDoor = { c: e, r0: f - 4, r1: f - 1 };
      this.exits.push({ c0: e + 12, c1: e + 16, r0: f - 6, r1: f, to: next, spawn: 'entry' });
      this.spawns.back = { c: e + 6, r: f, face: -1 };
    }
    this.closeRegion();
    this.c = e + (next ? 14 : 1);
    return this;
  }

  /** Packs the buffer into the level: trims the rock around the open space and turns tiles into pixels. */
  finish(o = {}) {
    this.closeRegion();
    let r0 = BH, r1 = 0;
    for (let r = 0; r < BH; r++) for (let c = 0; c <= this.maxC; c++) if (this.tiles[r * BW + c] !== 1) { if (r < r0) r0 = r; if (r > r1) r1 = r; }
    const top = o.keepTop ? 0 : Math.max(0, r0 - 6), rows = r1 - top + 1 + 6, cols = this.maxC + 2;
    const tiles = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles[r * cols + c] = this.at(c, r + top);
    // pits open all the way to the bottom of the map: below it is the dark
    for (const p of this.pits) for (let r = p.r - top; r < rows; r++) for (let c = p.c0; c <= p.c1; c++) tiles[r * cols + c] = 0;
    const X = (c) => c * T + T / 2, Y = (r) => (r - top) * T;
    const foot = (e) => ({ x: X(e.c), y: Y(this.ground(e.c, e.r)) });
    const door = (d) => d && { c: d.c, r0: d.r0 - top, r1: d.r1 - top, x: d.c * T, y0: (d.r0 - top) * T, y1: (d.r1 - top + 1) * T };
    const A = this.arenaDef;
    const L = {
      zone: this.zone, tiles, cols, rows,
      enemies: this.enemies.map((e, i) => ({ id: 'e' + i, type: e.type, ...foot(e), ...(e.ambush ? { ambush: e.ambush * T } : {}) })),
      items: this.items.map(({ c, r, ...it }) => ({ ...it, ...foot({ c, r }) })),
      beacons: this.beacons.map((b) => ({ id: b.id, name: b.name, ...foot(b) })),
      gates: this.gates.map((g) => ({ ...door(g), id: g.id, openFrom: g.openFrom })),
      bossDoor: door(this.door), exitDoor: door(this.exitDoor),
      arena: A && { x0: A.c0 * T, x1: A.c1 * T, floor: Y(A.floor), bossX: A.bossC * T },
      exits: this.exits.map((e) => ({ to: e.to, spawn: e.spawn, x0: e.c0 * T, x1: (e.c1 + 1) * T, y0: Y(e.r0), y1: Y(e.r1 + 1) })),
      spawns: Object.fromEntries(Object.entries(this.spawns).map(([k, s]) => [k, { x: X(s.c), y: Y(s.r), face: s.face }])),
      regions: this.regions.map((g) => (g.band
        ? { name: g.name, x0: g.c0 * T, x1: g.c1 * T, y0: Y(g.r0), y1: Y(g.r1) }
        : { name: g.name, x0: g.c0 * T, x1: g.c1 * T, y0: -1e9, y1: 1e9 })),
    };
    L.start = L.beacons[0];
    return L;
  }
}

/** The start of the Verdant Circuit, as first drawn: the Boot Chamber down to the far end of the Spans. */
export function verdantPrefix(b) {
  const { carve, fill, plat } = { carve: b.carve.bind(b), fill: b.fill.bind(b), plat: b.plat.bind(b) };
  // A. Boot Chamber and the upper corridor
  carve(2, 14, 14, 29);
  carve(15, 20, 58, 29);
  fill(24, 28, 26, 29);                 // a low step
  // the shaft down to the galleries; jumpable, but the ledge beyond ends at a gate
  carve(56, 30, 58, 41);
  carve(59, 26, 118, 29);               // Sentinel Walk: the shortcut corridor (gate at col 63)
  // B. Lower Galleries
  carve(50, 33, 120, 41);
  carve(84, 42, 86, 49); b.pits.push({ c0: 84, c1: 86, r: 42 });   // a pit into the dark
  // the climb from the galleries, crossing the corridor, up to the vault
  carve(98, 13, 102, 41);
  for (const [r, a] of [[39, 0], [36, 1], [33, 0], [30, 0], [27, 1], [24, 0], [21, 1], [18, 0]]) plat(a ? 100 : 98, a ? 102 : 100, r);
  plat(98, 102, 18);
  carve(82, 12, 97, 17);                // the Monolith vault
  // C. Junction
  carve(119, 22, 140, 41);
  fill(119, 30, 121, 31);               // where the corridor comes in
  plat(123, 126, 39); plat(127, 130, 36); plat(123, 126, 33); plat(134, 138, 36);
  // D. The Spans: bridges over the Undercroft
  carve(141, 20, 200, 33);
  carve(148, 38, 191, 46);              // Undercroft
  carve(153, 34, 155, 37); carve(171, 34, 173, 37);   // gaps drop into the Undercroft
  carve(187, 34, 191, 46);              // climb back up
  plat(188, 190, 35); plat(187, 189, 38); plat(189, 191, 41); plat(187, 189, 44);
  plat(154, 160, 28);                   // the ambusher's ledge
  plat(181, 185, 31);                   // a ledge with a shard

  for (const [type, c, r, extra] of [
    ['sentinel', 34, 25], ['shardling', 48, 25],
    ['sentinel', 68, 36], ['shardling', 78, 36], ['sentinel', 94, 36], ['duelist', 110, 36],
    ['hammer', 90, 14],
    ['sentinel', 76, 27], ['duelist', 90, 27],
    ['duelist', 166, 30], ['sentinel', 157, 26, { ambush: 162 }], ['shardling', 180, 30], ['sentinel', 196, 30],
    ['hammer', 165, 42], ['shardling', 177, 42],
  ]) b.foe(type, c, r, extra);
  for (const [it, c, r] of [
    [{ id: 'cache1', kind: 'echoes', amount: 120 }, 51, 38],
    [{ id: 'monolith', kind: 'weapon', weapon: 'monolith' }, 84, 14],
    [{ id: 'shard1', kind: 'flask' }, 95, 14],
    [{ id: 'fangs', kind: 'weapon', weapon: 'fangs' }, 115, 27],
    [{ id: 'cache2', kind: 'echoes', amount: 200 }, 70, 27],
    [{ id: 'nightedge', kind: 'weapon', weapon: 'nightedge' }, 150, 42],
    [{ id: 'cache3', kind: 'echoes', amount: 260 }, 160, 42],
    [{ id: 'cache3b', kind: 'echoes', amount: 240 }, 183, 29],   // was the second Lumen Shard
  ]) b.item(it, c, r);
  b.beacons.push({ id: 'b1', name: 'Boot Chamber', c: 9, r: 25 }, { id: 'b2', name: 'Junction', c: 132, r: 38 });
  // the shortcut gate: opens only from the right
  b.gates.push({ id: 'gate1', c: 63, r0: 26, r1: 29, openFrom: 1 });
  for (let r = 26; r <= 29; r++) b.set(63, r, 3);
  const band = (name, c0, c1, r0, r1) => b.regions.push({ name, c0, c1, r0, r1, band: true });
  band('Boot Chamber', 0, 59, -99, 31);
  band('Sentinel Walk', 59, 119, -99, 31);
  band('Lower Galleries', 0, 119, 31, 999);
  band('Junction', 119, 141, -99, 999);
  band('The Undercroft', 141, 201, 36, 999);
  band('The Spans', 141, 201, -99, 36);
  b.c = 201; b.f = 34;
}

/** Tile at pixel coordinates (outside the map counts as solid, except below it). */
export function tileAt(L, px, py) {
  const c = Math.floor(px / T), r = Math.floor(py / T);
  if (c < 0 || c >= L.cols || r < 0) return 1;
  if (r >= L.rows) return 0;
  return L.tiles[r * L.cols + c];
}
