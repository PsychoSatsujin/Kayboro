// One shared requestAnimationFrame loop for every running effect (screensavers, animated finishes).
// Each entry may have read(t) and write(t, dt): all reads run before any write, so effects that
// measure the DOM (pointer parallax) never force a layout in the middle of another effect's writes.
const live = new Set();
let raf = 0, last = 0;

function loop(t) {
  raf = 0;
  const dt = Math.min(50, last ? t - last : 16); // clamp: no jumps after a hidden tab or a stall
  last = t;
  if (!document.hidden) {
    for (const e of live) e.read?.(t);
    for (const e of live) e.write?.(t, dt);
  }
  if (live.size) raf = requestAnimationFrame(loop);
  else last = 0;
}

export function onFrame(entry) {
  live.add(entry);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => { live.delete(entry); };
}

// Running effects, for tests and leak checks
export const liveCount = () => live.size;

const RM = '(prefers-reduced-motion: reduce)';
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia(RM).matches;
export function onReducedMotionChange(cb) {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(RM), f = () => cb(mq.matches);
  mq.addEventListener('change', f);
  return () => mq.removeEventListener('change', f);
}
