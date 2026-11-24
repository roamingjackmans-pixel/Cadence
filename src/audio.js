// Synthesised sound: effects and a synthwave score. Nothing is loaded from files.
let AC = null, MASTER = null, SFXB = null, MUS = null, MUSF = null, NB = null;
let muted = false;
try { muted = localStorage.getItem('cadence-mute') === '1'; } catch (e) { /* storage blocked */ }

export function audioInit() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      MASTER = AC.createGain(); MASTER.gain.value = muted ? 0 : 0.8; MASTER.connect(AC.destination);
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      comp.connect(MASTER);
      SFXB = AC.createGain(); SFXB.gain.value = 0.9; SFXB.connect(comp);
      MUSF = AC.createBiquadFilter(); MUSF.type = 'lowpass'; MUSF.frequency.value = 18000; MUSF.connect(comp);
      MUS = AC.createGain(); MUS.gain.value = 0.42; MUS.connect(MUSF);
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { AC = null; }
}
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('cadence-mute', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  if (MASTER) MASTER.gain.value = muted ? 0 : 0.8;
  return muted;
}
export const isMuted = () => muted;
export function suspendAudio(v) { if (!AC) return; try { v ? AC.suspend() : AC.resume(); } catch (e) { /* ignore */ } }
/** Muffles the music while a menu is open. */
export function muffle(on) { if (MUSF) MUSF.frequency.setTargetAtTime(on ? 700 : 18000, AC.currentTime, 0.15); }

function osc(type, f, T, dur, vol, dest, f2, att) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, T);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), T + dur * 0.6);
  g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(vol, T + (att || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
  o.connect(g); g.connect(dest); o.start(T); o.stop(T + dur + 0.03);
}
function nz(T, dur, vol, ft, freq, dest, q, f2) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NB; f.type = ft; f.frequency.setValueAtTime(freq, T); f.Q.value = q || 0.8;
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, T + dur);
  g.gain.setValueAtTime(vol, T); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(T, Math.random() * 0.5); s.stop(T + dur + 0.03);
}
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

const FX = {
  deflect(T) { osc('triangle', 2300, T, 0.3, 0.14, SFXB, 2000); osc('sine', 3450, T, 0.22, 0.08, SFXB); osc('square', 1500, T, 0.14, 0.03, SFXB); nz(T, 0.08, 0.32, 'highpass', 5500, SFXB); },
  block(T) { osc('triangle', 760, T, 0.13, 0.11, SFXB, 560); nz(T, 0.07, 0.28, 'bandpass', 2400, SFXB, 2); },
  hit(T) { nz(T, 0.25, 0.6, 'lowpass', 1200, SFXB, 1, 280); osc('sawtooth', 150, T, 0.22, 0.1, SFXB, 55); },
  evade(T) { nz(T, 0.2, 0.16, 'bandpass', 700, SFXB, 1.5, 2800); },
  perfect(T) { nz(T, 0.22, 0.2, 'bandpass', 900, SFXB, 2, 4400); osc('sine', 1320, T, 0.25, 0.06, SFXB, 1760); },
  cut(T) { nz(T, 0.08, 0.32, 'highpass', 3400, SFXB); osc('square', 540, T, 0.07, 0.04, SFXB, 260); },
  swing(T) { nz(T, 0.12, 0.12, 'bandpass', 1400, SFXB, 1.2, 3600); },
  guarded(T) { osc('square', 1050, T, 0.09, 0.045, SFXB, 800); },
  tooFast(T) { osc('square', 220, T, 0.1, 0.05, SFXB, 180); },
  brk(T) { osc('sawtooth', 230, T, 0.6, 0.09, SFXB, 55); nz(T, 0.5, 0.3, 'bandpass', 1500, SFXB, 0.8, 200); },
  lethal(T) { osc('sine', 70, T, 1, 0.55, SFXB, 30); nz(T, 0.7, 0.5, 'lowpass', 900, SFXB, 1, 90); osc('triangle', 2600, T, 0.7, 0.06, SFXB, 1800); osc('sawtooth', 110, T, 0.5, 0.08, SFXB, 40); },
  shatter(T) { for (let i = 0; i < 5; i++) osc('triangle', 1800 + i * 430, T + i * 0.025, 0.25, 0.035, SFXB, 900); nz(T, 0.4, 0.25, 'highpass', 3000, SFXB); },
  jump(T) { osc('sine', 320, T, 0.12, 0.05, SFXB, 520); },
  land(T) { nz(T, 0.06, 0.12, 'lowpass', 500, SFXB); },
  heal(T) { [0, 4, 7, 12].forEach((s, i) => osc('sine', mf(72 + s), T + i * 0.06, 0.5, 0.05, SFXB)); },
  pickup(T) { [0, 7, 12, 19].forEach((s, i) => osc('triangle', mf(76 + s), T + i * 0.05, 0.3, 0.05, SFXB)); },
  beacon(T) { [0, 3, 7, 10, 15].forEach((s, i) => osc('sine', mf(64 + s), T + i * 0.09, 1.2, 0.05, SFXB)); nz(T, 1.2, 0.08, 'bandpass', 2000, SFXB, 3, 6000); },
  death(T) { osc('sawtooth', 220, T, 1.6, 0.12, SFXB, 40); nz(T, 1.4, 0.25, 'lowpass', 1200, SFXB, 1, 80); },
  levelup(T) { [0, 4, 7, 11, 14].forEach((s, i) => osc('triangle', mf(67 + s), T + i * 0.04, 0.5, 0.05, SFXB)); },
  gate(T) { osc('sine', 55, T, 1.2, 0.35, SFXB, 40); nz(T, 1, 0.25, 'lowpass', 400, SFXB); },
  ui(T) { osc('triangle', 1400, T, 0.05, 0.03, SFXB); },
  focus(T) { osc('sine', 880, T, 0.4, 0.05, SFXB, 1760); },
  /* each strike sounds when it lands */
  slash(T) { nz(T, 0.14, 0.22, 'bandpass', 2600, SFXB, 1.2, 1200); },
  sweep(T) { nz(T, 0.2, 0.25, 'bandpass', 600, SFXB, 1, 1600); osc('sine', 110, T, 0.2, 0.15, SFXB, 60); },
  slam(T) { osc('sine', 70, T, 0.7, 0.55, SFXB, 30); nz(T, 0.45, 0.45, 'lowpass', 700, SFXB, 0.7, 90); },
};
export function sfx(name) { if (!AC || muted) return; try { FX[name](AC.currentTime); } catch (e) { /* ignore */ } }

/* ---------- music ---------- */
const TRACKS = {
  explore: { bpm: 92, prog: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], drums: 'soft', arp: 'triangle', bassVol: 0.11 },
  boss: { bpm: 128, prog: [[38, 41, 45], [34, 38, 41], [36, 40, 43], [33, 37, 40]], drums: 'drive', arp: 'square', bassVol: 0.13 },
  victory: { bpm: 84, prog: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], drums: 'none', arp: 'sine', bassVol: 0.08 },
};
let mus = null;   // { track, step, t0, intensity }
/** v: a zone's variation, { shift: semitones, bpm: added tempo }, so every zone has its own key and pace. */
export function playMusic(name, intensity = 0, v = null) {
  if (!AC) return;
  const key = name + (v ? ':' + (v.shift || 0) + ':' + (v.bpm || 0) : '');
  if (mus && mus.key === key) { mus.intensity = intensity; return; }
  const base = TRACKS[name], tr = v ? { ...base, bpm: base.bpm + (v.bpm || 0), prog: base.prog.map((ch) => ch.map((m) => m + (v.shift || 0))) } : base;
  mus = { name, key, tr, step: 0, next: AC.currentTime + 0.1, intensity };
}
export function setIntensity(v) { if (mus) mus.intensity = v; }
export function stopMusic() { mus = null; }

function musicStep(k, T) {
  const tr = mus.tr, sd = 60 / (tr.bpm + Math.min(3, mus.intensity) * 10) / 4, i = k % 16, bar = Math.floor(k / 16), ch = tr.prog[bar % tr.prog.length], I = mus.intensity;
  if (tr.drums === 'soft') {
    if (i === 0 || i === 8) osc('sine', 120, T, 0.3, 0.32, MUS, 45);
    if (i % 4 === 2) nz(T, 0.03, 0.05, 'highpass', 8000, MUS);
    if (i === 12 && bar % 2) nz(T, 0.12, 0.08, 'bandpass', 1800, MUS);
  } else if (tr.drums === 'drive') {
    if (i % 4 === 0) osc('sine', 150, T, 0.3, 0.5, MUS, 42);
    if (i === 4 || i === 12) { nz(T, 0.16, 0.3, 'bandpass', 1900, MUS, 0.7); osc('triangle', 200, T, 0.1, 0.12, MUS, 150); }
    nz(T, 0.03, i % 2 ? 0.04 : 0.07, 'highpass', 8200, MUS);
    if (I >= 2 && i === 14) nz(T, 0.2, 0.1, 'highpass', 6000, MUS);
  }
  // bass
  if (tr.drums === 'drive') { if (i % 2 === 0 || I >= 1) osc('sawtooth', mf(ch[0] - 12), T, sd * 0.9, tr.bassVol, MUS); }
  else if (i % 2 === 0) osc('sawtooth', mf(ch[0] - 12), T, sd * 1.8, tr.bassVol * (i % 4 === 0 ? 1 : 0.6), MUS);
  // arpeggio
  const arp = [0, 1, 2, 1, 0, 2, 1, 2];
  if (tr.drums !== 'none' || i % 2 === 0) {
    const m = ch[arp[i % 8]] + 12 + (i >= 8 && I >= 1 ? 12 : 0);
    osc(tr.arp, mf(m), T, sd * 0.9, tr.drums === 'drive' ? 0.035 : 0.04, MUS);
  }
  // pad, one chord a bar
  if (i === 0) for (const m of ch) { osc('sawtooth', mf(m), T, sd * 15, 0.018, MUS, 0, 0.4); osc('sawtooth', mf(m) * 1.006, T, sd * 15, 0.014, MUS, 0, 0.4); }
  if (tr.drums === 'drive' && I >= 2 && i % 4 === 0) osc('square', mf(ch[2] + 24), T, sd * 2, 0.025, MUS);
  return sd;
}
export function updateMusic() {
  if (!AC || !mus) return;
  const ahead = AC.currentTime + 0.2;
  while (mus.next < ahead) {
    const T = Math.max(mus.next, AC.currentTime);
    const sd = musicStep(mus.step, T);
    mus.step++; mus.next = T + sd;
  }
}
