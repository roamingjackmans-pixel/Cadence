// The rhythm of a fight: phrases, the conductor that keeps every attacker's strikes answerable, and timing.
import { ATTACKS, LETTER, FAST_PAIR, MIN_GAP, JUMP_AIR } from './data.js';

/** "RrY-P" at a beat -> [{type, dt}] (dt from the first strike). */
export function parsePhrase(str, beat) {
  const out = []; let t = 0, hold = 0;
  for (const ch of str) {
    if (ch === '-') { hold += beat; continue; }
    const type = LETTER[ch.toUpperCase()]; if (!type) continue;
    if (out.length) t += (ch === ch.toLowerCase() ? beat / 2 : beat) + hold;
    hold = 0; out.push({ type, dt: t });
  }
  return out;
}

/**
 * Can one sequence of answers meet every strike perfectly? In the air only a block works, a jump keeps you up for
 * JUMP_AIR, and the guard can't take two strikes closer than FAST_PAIR. Strikes already answered keep their answer.
 */
export function survivable(list) {
  const n = list.length;
  const go = (i, air, prevBlockT) => {
    if (i === n) return true;
    const s = list[i], t = s.time;
    const valid = s.action && s.result && s.result !== 'miss' ? [s.action] : ATTACKS[s.type].valid;
    for (const a of valid) {
      if (t < air && a !== 'block') continue;
      if (a === 'block' && t - prevBlockT < FAST_PAIR) continue;
      if (go(i + 1, a === 'jump' ? t + JUMP_AIR : air, a === 'block' ? t : prevBlockT)) return true;
    }
    return false;
  };
  return go(0, -1, -9);
}

/**
 * Keeps all strikes aimed at the player. Up to two attackers (one each side, or the boss) ask it to fit a phrase in;
 * it slides the phrase later until it interleaves with the other attacker's strikes into something answerable.
 */
export class Conductor {
  constructor() { this.notes = []; }

  /**
   * Strikes that still matter for planning: anything not yet landed, and anything landed recently enough that its
   * answer still binds you (a jump keeps you up JUMP_AIR, a block refuses another for FAST_PAIR).
   */
  live(now) { return this.notes.filter((n) => !n.cancelled && (!n.applied || n.time > now - JUMP_AIR - FAST_PAIR - 0.1)); }

  /**
   * Fits `phrase` for `owner` starting no earlier than t0. Returns the new notes (already added) or null.
   * opts: { side, chamber(type, gap), maxShift, extra }
   */
  plan(owner, phrase, beat, t0, now, opts = {}) {
    const rel = parsePhrase(phrase, beat);
    if (!rel.length) return null;
    const others = this.live(now);
    const maxShift = opts.maxShift ?? 1.6;
    for (let shift = 0; shift <= maxShift + 1e-6; shift += 0.05) {
      let cand = rel.map((r) => ({ type: r.type, time: t0 + shift + r.dt }));
      let ok = this.fits(others, cand);
      // a phrase that can't be answered: soften its latest sweeps and slams into slashes, as the prototype did
      if (!ok && shift === 0) {
        for (let i = cand.length - 1; i >= 0 && !ok; i--) {
          if (cand[i].type !== 'slash') { cand = cand.map((c, j) => (j === i ? { ...c, type: 'slash' } : c)); ok = this.fits(others, cand); }
        }
      }
      if (!ok) continue;
      const seg = { n: cand.length, done: 0, perfect: 0, owner };
      const notes = cand.map((c, i) => {
        const gap = i ? c.time - cand[i - 1].time : 0.7;
        return {
          owner, type: c.type, time: c.time, side: opts.side ?? 0, seg, idx: i,
          chamber: opts.chamber ? opts.chamber(c.type, gap) : Math.min(0.5, Math.max(0.16, gap * 0.8)),
          result: null, action: null, applied: false, struck: false, cancelled: false, born: now, ...(opts.extra || {}),
        };
      });
      this.notes.push(...notes);
      this.notes.sort((a, b) => a.time - b.time);
      return notes;
    }
    return null;
  }

  fits(others, cand) {
    const merged = others.concat(cand).sort((a, b) => a.time - b.time);
    for (let i = 1; i < merged.length; i++) if (merged[i].time - merged[i - 1].time < MIN_GAP - 1e-6) return false;
    return survivable(merged);
  }

  /** Drops an attacker's strikes that haven't started to swing yet (it was staggered, killed or lost its side). */
  cancelOwner(owner, now, all = false) {
    for (const n of this.notes) if (n.owner === owner && !n.result && (all || n.time - n.chamber > now)) n.cancelled = true;
    this.notes = this.notes.filter((n) => !n.cancelled);
  }
  prune(now) {
    let j = 0;
    for (const n of this.notes) if (!(n.applied && now > n.time + 0.8)) this.notes[j++] = n;
    this.notes.length = j;
  }
  /** The last strike before n that was answered. */
  prevAnswered(n) {
    let pv = null;
    for (const m of this.notes) { if (m === n) break; if (m.result && m.result !== 'miss' && m.result !== 'whiff') pv = m; }
    return pv;
  }
  blockRefused(n) {
    const pv = this.prevAnswered(n);
    return !!(pv && pv.action === 'block' && n.time - pv.time < FAST_PAIR);
  }

  /**
   * Which strike does pressing `action` at time t answer? win(action, type) -> {perfect, good}.
   * okSide(note) says whether a block can face that strike's attacker.
   */
  target(action, t, win, okSide) {
    for (const n of this.notes) {
      if (n.result || n.cancelled) continue;
      if (n.time - t > 0.5) break;
      if (!ATTACKS[n.type].valid.includes(action)) continue;
      const w = win(action, n.type);
      if (Math.abs(t - n.time) > w.good) continue;
      if (action === 'block' && okSide && !okSide(n)) continue;
      return { n, perfect: Math.abs(t - n.time) <= w.perfect };
    }
    return null;
  }
}
