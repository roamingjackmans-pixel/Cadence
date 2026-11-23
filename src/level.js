// The first area, the Verdant Circuit, carved out of solid rock tile by tile.
// Tiles: 0 air, 1 solid, 2 one-way platform (stand on it, jump up through it).
export const T = 32;
export const COLS = 236, ROWS = 50;

export function buildLevel() {
  const tiles = new Uint8Array(COLS * ROWS).fill(1);
  const set = (c, r, v) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tiles[r * COLS + c] = v; };
  const carve = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(c, r, 0); };
  const fill = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(c, r, 1); };
  const plat = (c0, c1, r) => { for (let c = c0; c <= c1; c++) set(c, r, 2); };

  // A. Boot Chamber and the upper corridor
  carve(2, 14, 14, 29);
  carve(15, 20, 58, 29);
  fill(24, 28, 26, 29);                 // a low step
  // the shaft down to the galleries; jumpable, but the ledge beyond ends at a gate
  carve(56, 30, 58, 41);
  carve(59, 26, 118, 29);               // Sentinel Walk: the shortcut corridor (gate at col 63)
  // B. Lower Galleries
  carve(50, 33, 120, 41);
  carve(84, 42, 86, ROWS - 1);          // a pit into the dark
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
  // E. Antechamber and F. the arena
  carve(201, 26, 214, 33);
  carve(216, 16, 234, 33);
  carve(215, 30, 215, 33);              // the arena door

  const ground = (c, r) => { while (r < ROWS && tiles[r * COLS + c] === 0) r++; return r; };   // first non-air row at or below r
  const foot = (c, r) => ({ x: c * T + T / 2, y: ground(c, r) * T });

  const enemies = [
    ['sentinel', 34, 25], ['shardling', 48, 25],
    ['sentinel', 68, 36], ['shardling', 78, 36], ['sentinel', 94, 36], ['duelist', 110, 36],
    ['hammer', 90, 14],
    ['sentinel', 76, 27], ['duelist', 90, 27],
    ['duelist', 166, 30], ['sentinel', 157, 26, { ambush: 162 }], ['shardling', 180, 30], ['sentinel', 196, 30],
    ['hammer', 165, 42], ['shardling', 177, 42],
  ].map(([type, c, r, extra], i) => ({ id: 'e' + i, type, ...foot(c, r), ...(extra ? { ambush: extra.ambush * T } : {}) }));

  const items = [
    { id: 'cache1', kind: 'echoes', amount: 120, ...foot(51, 38) },
    { id: 'monolith', kind: 'weapon', weapon: 'monolith', ...foot(84, 14) },
    { id: 'shard1', kind: 'flask', ...foot(95, 14) },
    { id: 'fangs', kind: 'weapon', weapon: 'fangs', ...foot(115, 27) },
    { id: 'cache2', kind: 'echoes', amount: 200, ...foot(70, 27) },
    { id: 'nightedge', kind: 'weapon', weapon: 'nightedge', ...foot(150, 42) },
    { id: 'cache3', kind: 'echoes', amount: 260, ...foot(160, 42) },
    { id: 'shard2', kind: 'flask', ...foot(183, 29) },
  ];
  const beacons = [
    { id: 'b1', name: 'Boot Chamber', ...foot(9, 25) },
    { id: 'b2', name: 'Junction', ...foot(132, 38) },
    { id: 'b3', name: 'Antechamber', ...foot(205, 30) },
  ];
  // the shortcut gate: opens only from the right
  const gate = { id: 'gate1', c: 63, r0: 26, r1: 29, x: 63 * T, y0: 26 * T, y1: 30 * T, openFrom: 1 };
  for (let r = gate.r0; r <= gate.r1; r++) set(gate.c, r, 3);
  const bossDoor = { x: 215 * T, y0: 30 * T, y1: 34 * T, c: 215 };
  for (let r = 30; r <= 33; r++) set(215, r, 3);
  const arena = { x0: 216 * T, x1: 235 * T, floor: 34 * T, bossX: 229 * T };
  const regions = [
    { name: 'Boot Chamber', x0: 0, x1: 59 * T, y0: 0, y1: 31 * T },
    { name: 'Sentinel Walk', x0: 59 * T, x1: 119 * T, y0: 0, y1: 31 * T },
    { name: 'Lower Galleries', x0: 0, x1: 119 * T, y0: 31 * T, y1: ROWS * T },
    { name: 'Junction', x0: 119 * T, x1: 141 * T, y0: 0, y1: ROWS * T },
    { name: 'The Undercroft', x0: 141 * T, x1: 201 * T, y0: 36 * T, y1: ROWS * T },
    { name: 'The Spans', x0: 141 * T, x1: 201 * T, y0: 0, y1: 36 * T },
    { name: 'Antechamber', x0: 201 * T, x1: 236 * T, y0: 0, y1: ROWS * T },
  ];
  return { tiles, cols: COLS, rows: ROWS, enemies, items, beacons, gate, bossDoor, arena, regions, start: beacons[0] };
}

/** Tile at pixel coordinates (outside the map counts as solid, except below it). */
export function tileAt(L, px, py) {
  const c = Math.floor(px / T), r = Math.floor(py / T);
  if (c < 0 || c >= L.cols || r < 0) return 1;
  if (r >= L.rows) return 0;
  return L.tiles[r * L.cols + c];
}
