// Tiny WebAudio synth blips (no audio files): coin, spend, unlock, level-up, tap, error.
// Muting is remembered in localStorage; the AudioContext is created on the first sound.
const KEY = 'kayboro.muted';
const subs = new Set();
let ac = null, out = null, muted = false, lastAt = {};
try { muted = localStorage.getItem(KEY) === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(on) {
  muted = !!on;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
  for (const f of subs) { try { f(muted); } catch {} }
}
export const toggleMuted = () => setMuted(!muted);
export function onMuteChange(cb) { subs.add(cb); return () => subs.delete(cb); }

function audio() {
  if (ac) return ac;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    out = ac.createGain();
    out.gain.value = 0.16;
    const soft = ac.createBiquadFilter(); // takes the fizz off square waves
    soft.type = 'lowpass';
    soft.frequency.value = 4200;
    out.connect(soft).connect(ac.destination);
  } catch { ac = null; }
  return ac;
}

// One enveloped note: frequency f (optionally sliding to f2) starting at t for dur seconds.
function tone(f, t, dur, type = 'square', vol = 0.5, f2 = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.03);
}

const SOUNDS = {
  coin: t => { tone(988, t, 0.07, 'square', 0.35); tone(1319, t + 0.065, 0.3, 'square', 0.35); },
  spend: t => [1568, 1319, 1047, 784].forEach((f, i) => tone(f, t + i * 0.05, 0.1, 'square', 0.28)),
  unlock: t => {
    [659, 831, 988, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.24, 'triangle', 0.7));
    tone(2637, t + 0.3, 0.45, 'sine', 0.18);
  },
  levelUp: t => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.085, 0.14, 'square', 0.3));
    [1047, 1319, 1568].forEach(f => tone(f, t + 0.52, 0.8, 'triangle', 0.4));
  },
  tap: t => tone(880, t, 0.04, 'triangle', 0.3),
  error: t => { tone(220, t, 0.1, 'square', 0.25); tone(165, t + 0.09, 0.18, 'square', 0.25); },
};
export const SOUND_NAMES = Object.keys(SOUNDS);

export function play(name) {
  if (muted || !SOUNDS[name]) return;
  const now = performance.now();
  if (now - (lastAt[name] || 0) < 80) return; // a burst of events plays once
  lastAt[name] = now;
  const a = audio();
  if (!a) return;
  try {
    if (a.state === 'suspended') a.resume().catch(() => {});
    SOUNDS[name](a.currentTime + 0.01);
  } catch {}
}
