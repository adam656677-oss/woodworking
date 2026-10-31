// Hands-free "next step": a clap, a knock or a short loud "next" moves Shop Mode on. Works from the microphone's
// loudness only — nothing is recorded or sent anywhere.
export type ClapOptions = { /** 1 (needs a loud clap) to 10 (picks up a firm word). */ sensitivity: number; pauseMs: number }

/** A sound counts when it jumps well above the room's steady sound and dies away again within this long. */
const SHORT_MS = 450

export class ClapDetector {
  private background = 0.01
  private last = -Infinity
  private onset: number | null = null
  constructor(public opts: ClapOptions = { sensitivity: 5, pauseMs: 1500 }) {}
  private get threshold() {
    const s = Math.max(1, Math.min(10, this.opts.sensitivity))
    return Math.max(this.background * (9 - 0.6 * s), 0.06 - 0.004 * s)
  }
  /** Feed one loudness reading (0–1 RMS) taken at `t` ms; true when a short loud sound has just ended. */
  feed(level: number, t: number): boolean {
    const th = this.threshold
    let hit = false
    if (this.onset === null) {
      if (level > th) this.onset = t
    } else if (level < th / 2) {
      // It died away: short enough is a clap or a word; long was a machine starting.
      if (t - this.onset <= SHORT_MS && t - this.last >= this.opts.pauseMs) { hit = true; this.last = t }
      this.onset = null
    } else if (t - this.onset > SHORT_MS) {
      // Still loud: the room got louder (a dust collector). Follow it quickly.
      this.background += (level - this.background) * 0.2
    }
    if (this.onset === null) this.background = Math.max(0.001, this.background + (level - this.background) * 0.05)
    return hit
  }
  get level() { return this.background }
}

/** Loudness (RMS) of a block of samples. */
export function rms(samples: Float32Array): number {
  let s = 0
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i]
  return Math.sqrt(s / Math.max(1, samples.length))
}
