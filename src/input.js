// Keyboard and gamepad. Presses are queued with the time they happened, so timing is judged from the key press,
// not from the next frame.

const KEYS = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'jump', Space: 'jump', ArrowUp: 'jump', KeyS: 'duck', ArrowDown: 'duck',
  KeyJ: 'block', KeyK: 'attack', KeyL: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyH: 'heal', KeyE: 'interact', KeyF: 'interact', Escape: 'pause', KeyP: 'pause', Enter: 'confirm', Backspace: 'back',
  KeyI: 'hints', KeyM: 'mute',
};
/* menu navigation reads these too */
const NAV = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'confirm', Space: 'confirm', KeyE: 'confirm', KeyJ: 'confirm', Escape: 'back', Backspace: 'back', KeyK: 'back' };
/* standard gamepad mapping */
// combat sits on LT step, LB block, RB duck, A jump, X strike (owner); A also interacts when nothing is attacking you
const PAD = { 4: 'block', 5: 'duck', 6: 'dodge', 0: 'padA', 2: 'attack', 3: 'heal', 9: 'pause', 8: 'hints' };
const PADNAV = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'confirm', 1: 'back', 9: 'back' };

export const input = {
  queue: [], nav: [], keys: new Set(), padHeld: new Set(), padPrev: [], stickX: 0, stickY: 0,
  device: 'kb', navRepeat: { dir: null, next: 0 },

  /** Game presses since the last call: [{a, t}] with t in performance.now() milliseconds. */
  take() { const q = this.queue; this.queue = []; return q; },
  takeNav() { const q = this.nav; this.nav = []; return q; },
  held(a) {
    for (const k of this.keys) if (KEYS[k] === a) return true;
    return this.padHeld.has(a);
  },
  /** Holding down: the duck key, or the left stick or d-pad pushed down (drops through one-way floors with jump). */
  down() { return this.held('duck') || this.padHeld.has('down') || this.stickY > 0.5; },
  /** -1..1: keys or the left stick / d-pad. */
  axisX() {
    let x = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (x === 0 && Math.abs(this.stickX) > 0.35) x = this.stickX;
    return Math.max(-1, Math.min(1, x));
  },

  poll(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { this.padHeld.clear(); this.stickX = 0; this.stickY = 0; return; }
    const prev = this.padPrev, cur = [];
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i], on = b.pressed || b.value > 0.45;
      cur[i] = on;
      if (on && !prev[i]) {
        this.device = 'pad';
        if (PAD[i]) this.queue.push({ a: PAD[i], t: now });
        if (PADNAV[i]) this.nav.push(PADNAV[i]);
      }
    }
    this.padPrev = cur;
    this.padHeld.clear();
    for (const i in PAD) if (cur[i]) this.padHeld.add(PAD[i]);
    if (cur[14]) this.padHeld.add('left');
    if (cur[15]) this.padHeld.add('right');
    if (cur[13]) this.padHeld.add('down');
    this.stickX = Math.abs(gp.axes[0] || 0) > 0.2 ? gp.axes[0] : 0;
    this.stickY = Math.abs(gp.axes[1] || 0) > 0.2 ? gp.axes[1] : 0;
    // stick held left/right counts as the direction; flicks also navigate menus (with repeat)
    if (this.stickX || this.stickY) this.device = 'pad';
    const dir = this.stickY < -0.6 ? 'up' : this.stickY > 0.6 ? 'down' : this.stickX < -0.6 ? 'left' : this.stickX > 0.6 ? 'right' : null;
    const r = this.navRepeat;
    if (dir !== r.dir) { r.dir = dir; r.next = now + 380; if (dir) this.nav.push(dir); }
    else if (dir && now >= r.next) { r.next = now + 140; this.nav.push(dir); }
  },
};

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const a = KEYS[e.code], n = NAV[e.code];
  if (a || n) e.preventDefault();
  input.device = 'kb';
  if (n) input.nav.push(n);
  if (e.repeat) return;
  input.keys.add(e.code);
  if (a) input.queue.push({ a, t: performance.now() - Math.max(0, Math.min(40, performance.now() - e.timeStamp)) });
});
window.addEventListener('keyup', (e) => { input.keys.delete(e.code); });
window.addEventListener('blur', () => { input.keys.clear(); });

/** Button names for prompts, following the last device used. */
export function btn(a) {
  const pad = input.device === 'pad';
  const P = { block: 'LB', duck: 'RB', jump: 'A', dodge: 'LT', attack: 'X', heal: 'Y', interact: 'A', pause: 'START' };
  const K = { block: 'J', duck: 'S', jump: 'W', dodge: 'L', attack: 'K', heal: 'H', interact: 'E', pause: 'ESC' };
  return (pad ? P : K)[a] || a;
}
