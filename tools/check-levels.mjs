// Walks every zone's tiles the way the player moves and fails if anything can't be reached, or can't be left.
//   node tools/check-levels.mjs
// A cell is where your feet are: it and the cell above must be open, the one below must hold you. From a cell you can
// walk, fall, drop through a one-way floor, or jump (3 rows up and 3 across at most, or 4 across on the level, 5 down).
// Every beacon, item, the arena, and both passages must be reachable from the zone's first beacon, and the first
// beacon reachable back from each of them. Doors and gates count as open. Enemies must stand at least 8 tiles from a pit.
import { ZONES, buildZone } from '../src/zones.js';
import { T } from '../src/level.js';

let failed = 0;
for (const z of ZONES) {
  const L = buildZone(z.id), C = L.cols, R = L.rows;
  const tile = (c, r) => (c < 0 || c >= C || r < 0 ? 1 : r >= R ? 0 : L.tiles[r * C + c]);
  const open = (c, r) => { const v = tile(c, r); return v === 0 || v === 2 || v === 3; };
  const air = (c, r) => tile(c, r) !== 1;
  const holds = (c, r) => { const v = tile(c, r); return v === 1 || v === 2; };
  const stand = (c, r) => open(c, r) && open(c, r - 1) && tile(c, r) !== 2 && holds(c, r + 1);
  const key = (c, r) => r * C + c;
  /** Falls from (c, r) to where you land, or null into the dark. */
  const fall = (c, r) => { while (r < R + 2) { if (!air(c, r) || !air(c, r - 1)) return null; if (holds(c, r + 1)) return [c, r]; r++; } return null; };
  const moves = (c, r) => {
    const out = [];
    for (const d of [-1, 1]) if (air(c + d, r) && air(c + d, r - 1)) { const f = stand(c + d, r) ? [c + d, r] : fall(c + d, r); if (f) out.push(f); }
    if (tile(c, r + 1) === 2) { const f = fall(c, r + 1); if (f) out.push(f); }
    // jumps: rise, then across
    for (let rise = 0; rise <= 3; rise++) {
      let head = true;
      for (let k = 1; k <= rise + 1 && head; k++) if (!air(c, r - k)) head = false;
      if (!head) break;
      const reach = rise <= 1 ? 4 : 3;
      for (const d of [-1, 1]) {
        for (let k = 1; k <= reach; k++) {
          const x = c + d * k, y = r - rise;
          if (!air(x, y) || !air(x, y - 1)) break;
          if (stand(x, y)) out.push([x, y]);
          else if (k <= reach) { const f = fall(x, y); if (f) out.push(f); }
        }
      }
    }
    return out;
  };
  const reach = (from) => {
    const seen = new Set([key(...from)]), q = [from];
    while (q.length) { const [c, r] = q.pop(); for (const m of moves(c, r)) { const k = key(...m); if (!seen.has(k)) { seen.add(k); q.push(m); } } }
    return seen;
  };
  const cell = (x, y) => [Math.floor(x / T), Math.round(y / T) - 1];
  const targets = [];
  for (const b of L.beacons) targets.push(['beacon ' + b.name, cell(b.x, b.y)]);
  for (const it of L.items) targets.push(['item ' + it.id, cell(it.x, it.y)]);
  targets.push(['arena', cell(L.arena.bossX, L.arena.floor)]);
  for (const [k, s] of Object.entries(L.spawns)) targets.push(['spawn ' + k, cell(s.x, s.y)]);
  const start = cell(L.start.x, L.start.y), errs = [];
  if (!stand(...start)) errs.push('the first beacon is not on the ground');
  const fromStart = reach(start);
  for (const [name, at] of targets) {
    if (!stand(...at)) { errs.push(name + ' is not on solid ground at ' + at); continue; }
    if (!fromStart.has(key(...at))) errs.push(name + ' cannot be reached from the start (' + at + ')');
    else if (!reach(at).has(key(...start))) errs.push('no way back to the start from ' + name + ' (' + at + ')');
  }
  for (const e of L.enemies) {
    const [c, r] = cell(e.x, e.y);
    if (!e.ambush && !stand(c, r)) errs.push('enemy ' + e.id + ' (' + e.type + ') is not on the ground at ' + [c, r]);
    const legacy = z.id === 1 && c < 201;   // the hand-drawn start keeps its first layout
    for (let d = -7; d <= 7; d++) if (!e.ambush && !legacy && tile(c + d, r + 1) === 0 && fall(c + d, r) === null) { errs.push('enemy ' + e.id + ' stands within 8 tiles of a pit at ' + [c, r]); break; }
  }
  console.log(`${z.id}. ${z.name}: ${C}x${R} tiles, ${L.enemies.length} enemies, ${L.items.length} items, ${L.beacons.length} beacons${errs.length ? '' : ', all reachable'}`);
  for (const e of errs) console.log('   ' + e);
  failed += errs.length;
}
if (failed) { console.log(failed + ' problems'); process.exitCode = 1; } else console.log('levels: ok');
