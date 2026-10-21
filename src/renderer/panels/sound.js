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
  // Fandom Clash (src/renderer/clash): the versus slam, a counter tick, right/miss (the miss is soft on
  // purpose: no buzzer), a combo arpeggio and a card whoosh.
  slam: t => { tone(150, t, 0.32, 'sine', 0.9, 45); tone(75, t, 0.4, 'triangle', 0.6, 40); noise(t, 0.18, 0.5, 900); },
  tick: t => tone(1760, t, 0.018, 'square', 0.1),
  right: t => { tone(784, t, 0.08, 'triangle', 0.6); tone(1175, t + 0.07, 0.22, 'triangle', 0.6); tone(2349, t + 0.12, 0.25, 'sine', 0.15); },
  miss: t => { tone(392, t, 0.16, 'sine', 0.35, 330); tone(294, t + 0.13, 0.26, 'sine', 0.3, 262); },
  combo: t => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.045, 0.09, 'square', 0.22)),
  whoosh: t => noise(t, 0.22, 0.35, 2400, 500),
};

// A burst of filtered white noise (slams, whooshes): band-pass at f, optionally sweeping to f2.
function noise(t, dur, vol, f, f2 = 0) {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur)), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf;
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(f, t);
  if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}
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
