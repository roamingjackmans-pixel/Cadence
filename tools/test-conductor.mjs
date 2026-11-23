// The conductor's promise: whatever phrases two attackers ask for, the strikes it schedules can all be answered
// perfectly. Fuzzes every enemy's phrases (and the boss's) against each other and checks the merged timeline.
//   node tools/test-conductor.mjs
import { Conductor, parsePhrase, survivable } from '../src/combat.js';
import { ENEMIES, BOSS, MIN_GAP, FAST_PAIR, JUMP_AIR } from '../src/data.js';

let fails = 0, planned = 0;
const fail = (msg) => { fails++; if (fails <= 10) console.error('FAIL ' + msg); };
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rand() * a.length)];

// parsePhrase basics
const p = parsePhrase('RrY-P', 0.5);
const want = [['slash', 0], ['slash', 0.25], ['sweep', 0.75], ['slam', 1.75]];
if (p.length !== 4 || p.some((n, i) => n.type !== want[i][0] || Math.abs(n.dt - want[i][1]) > 1e-9)) fail('parsePhrase RrY-P: ' + JSON.stringify(p));

// survivable knows the rules
if (survivable([{ type: 'sweep', time: 0 }, { type: 'sweep', time: 0.2 }]) !== true) fail('jump then air-block two fast sweeps');
if (survivable([{ type: 'sweep', time: 0 }, { type: 'sweep', time: 0.2 }, { type: 'sweep', time: 0.4 }]) !== true) fail('three fast sweeps: block, jump, air-block');
if (survivable([0, 0.2, 0.4, 0.6].map((time) => ({ type: 'sweep', time }))) !== false) fail('four fast sweeps can not all be answered');
if (survivable([{ type: 'slash', time: 0, action: 'block', result: 'good' }, { type: 'slash', time: 0.2 }]) !== true) fail('a duck follows a block');
if (survivable([{ type: 'sweep', time: 0, action: 'jump', result: 'good' }, { type: 'slash', time: 0.3 }]) !== true) fail('air-block a slash after a jump');
if (survivable([{ type: 'sweep', time: 0, action: 'jump', result: 'good' }, { type: 'slam', time: 0.3 }, { type: 'slash', time: 0.45 }]) !== false) fail('two strikes in the air, too close to block both');

/** Checks a timeline the way a player meets it. */
function check(notes, label) {
  const s = [...notes].sort((a, b) => a.time - b.time);
  for (let i = 1; i < s.length; i++) if (s[i].time - s[i - 1].time < MIN_GAP - 1e-6) return fail(`${label}: strikes ${(s[i].time - s[i - 1].time).toFixed(3)}s apart`);
  if (!survivable(s)) fail(`${label}: no perfect answer for ${s.map((n) => n.type[1] + n.time.toFixed(2)).join(' ')}`);
}

const kinds = Object.values(ENEMIES);
for (let round = 0; round < 3000; round++) {
  const c = new Conductor();
  const A = pick(kinds), B = pick(kinds), a = { n: 'A' }, b = { n: 'B' };
  let t = 0;
  for (let k = 0; k < 6; k++) {
    const who = rand() < 0.5 ? [a, A] : [b, B];
    const got = c.plan(who[0], pick(who[1].phrases), who[1].beat, t + 1 + rand() * 0.8, t, { maxShift: 1.4 });
    if (got) planned++;
    t += rand() * 0.9;
  }
  check(c.notes, `round ${round} ${A.name} + ${B.name}`);
}
for (const ph of BOSS.phases) for (let round = 0; round < 300; round++) {
  const c = new Conductor(), boss = {};
  let t = 0;
  for (let k = 0; k < 4; k++) { if (c.plan(boss, pick(ph.phrases), ph.beat, t + 1, t, { maxShift: 0.6 })) planned++; t += 1.5 + rand(); }
  check(c.notes, `boss beat ${ph.beat} round ${round}`);
}
console.log(`${planned} phrases planned; FAST_PAIR ${FAST_PAIR}s, JUMP_AIR ${JUMP_AIR}s, MIN_GAP ${MIN_GAP}s`);
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log('conductor: every schedule answerable');
