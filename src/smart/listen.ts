// Hands-free "next step": a double clap (or two quick knocks on the bench) moves Shop Mode on. One bang — a hammer
// blow, a dropped board, a shout — doesn't, and nor does fast hammering. Works from the microphone's
// loudness only — nothing is recorded or sent anywhere.
export type ClapOptions = { /** 1 (needs a loud clap) to 10 (picks up a firm word). */ sensitivity: number; pauseMs: number }

/** A sound counts when it jumps well above the room's steady sound and dies away again within this long. */
const SHORT_MS = 450
/** The second clap has to come this soon after the first (but not sooner: that's one sound ringing). */
const PAIR_MIN = 150, PAIR_MAX = 600
/** …and no third may follow within this long (hammering is many bangs). */
const SETTLE = 400

export class ClapDetector {
  private background = 0.01
  private last = -Infinity
  private onset: number | null = null
  /** When the short sounds ended, latest last (only the recent ones are kept). */
  private bangs: number[] = []
  private pending: number | null = null
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
      // It died away: short enough is a clap or a knock; long was a machine starting or a word.
      if (t - this.onset <= SHORT_MS) {
        this.bangs = [...this.bangs.filter(b => t - b <= 1200), t]
        const n = this.bangs.length, gap = n >= 2 ? t - this.bangs[n - 2] : 0
        // Exactly two, the right distance apart, nothing just before them; a third cancels it.
        this.pending = n === 2 && gap >= PAIR_MIN && gap <= PAIR_MAX ? t : null
      }
      this.onset = null
    } else if (t - this.onset > SHORT_MS) {
      // Still loud: the room got louder (a dust collector). Follow it quickly.
      this.background += (level - this.background) * 0.2
    }
    if (this.pending !== null && this.onset === null && t - this.pending > SETTLE) {
      if (t - this.last >= this.opts.pauseMs) { hit = true; this.last = t }
      this.pending = null; this.bangs = []
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
