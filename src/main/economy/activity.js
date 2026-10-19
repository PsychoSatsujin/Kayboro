'use strict';
// Time spent in Kayboro. Every tickMs (and on every window/play change) the time since the last
// tick is credited to the economy when Kayboro was active at the start of that interval: visible
// and not minimized, or in play mode. The hosted game (getApp) collects the same seconds per appid.
class ActivityTracker {
  constructor({ economy, isActive, getApp = () => null, now = Date.now, tickMs = 15e3 }) {
    Object.assign(this, { economy, isActive, getApp, now, tickMs });
    this.last = now();
    this.active = this._sample();
  }

  _sample() {
    try {
      return !!this.isActive();
    } catch {
      return false;
    }
  }

  start() {
    this.stop(false);
    this.last = this.now();
    this.active = this._sample();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
    return this;
  }

  // Credits the interval since the last tick, then samples the current state for the next one.
  // A tick far later than scheduled (sleep, hang) counts as at most two intervals.
  tick() {
    const t = this.now();
    const sec = Math.min((t - this.last) / 1000, (this.tickMs / 1000) * 2);
    this.last = t;
    let delta = null;
    if (this.active && sec > 0) {
      try {
        delta = this.economy.addTime(sec, this.getApp());
      } catch (err) {
        console.error('[shell] time tick failed:', err);
      }
    }
    this.active = this._sample();
    return delta;
  }

  stop(flush = true) {
    if (flush && this.timer) this.tick();
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { ActivityTracker };
