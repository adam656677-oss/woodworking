// Lathe Turning: a spinning blank, a target shape, and a gouge that takes wood off where it touches.
// Radii are fractions of the blank's radius (1 = the square blank's size), along the blank from 0 to 1.
export const SAMPLES = 61
/** The tool rest: the gouge can't reach in closer than this to the centre. */
export const TOOL_REACH = 0.12
export type Blank = { radii: number[] }
export type Target = { id: string; name: string; radii: number[] }

const shape = (f: (t: number) => number) => Array.from({ length: SAMPLES }, (_, i) => Math.min(1, Math.max(TOOL_REACH, f(i / (SAMPLES - 1)))))
const bump = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2))

export const LATHE_TARGETS: Target[] = [
  // A pen: a slim barrel with a raised centre band, tapering to the nib.
  { id: 'pen', name: 'Pen', radii: shape(t => 0.24 + 0.16 * bump(t, 0.5, 0.05) + 0.04 * Math.sin(t * Math.PI) - 0.12 * Math.max(0, t - 0.8) / 0.2) },
  { id: 'bowl', name: 'Little bowl', radii: shape(t => 0.25 + 0.7 * Math.sqrt(Math.max(0, Math.sin(Math.min(1, t * 1.05) * Math.PI / 2)))) },
  { id: 'candle', name: 'Candlestick', radii: shape(t => 0.75 * bump(t, 0.05, 0.12) + 0.32 + 0.22 * bump(t, 0.45, 0.07) + 0.45 * bump(t, 0.95, 0.08) - 0.12 * bump(t, 0.25, 0.1)) }
]

export const newBlank = (_t?: Target): Blank => ({ radii: Array(SAMPLES).fill(1) })

/** One pass of the gouge at `at` (0–1 along the blank) with this much pressure (0–1): a little wood comes off near it. */
export function cut(b: Blank, at: number, pressure: number, seconds = 1 / 60): Blank {
  const c = at * (SAMPLES - 1)
  // The same speed at any screen refresh rate: 0.05 a frame at 60 frames a second.
  const take = 3 * Math.min(seconds, 0.1) * Math.max(0, Math.min(1, pressure))
  return { radii: b.radii.map((r, i) => {
    const d = Math.abs(i - c)
    if (d > 2.5) return r
    return Math.max(TOOL_REACH, r - take * Math.exp(-((d / 1.2) ** 2)))
  }) }
}

/**
 * How close the turning is to the target (100 = exactly), and where it went too deep (0–1 along). Wood taken
 * past the line counts double — it can't be put back — and each spot is measured against the worst it could be.
 */
export function score(b: Blank, t: Target): { percent: number; tooDeep: number[] } {
  let miss = 0
  const tooDeep: number[] = []
  b.radii.forEach((r, i) => {
    const want = t.radii[i]
    // Each spot: 0 when right on the line, 1 when as far off as it could be. Wood left on is measured against
    // the uncut blank; wood taken past the line counts double against what was there to lose.
    miss += r >= want ? (r - want) / Math.max(1 - want, 1e-9) : Math.min(1, (2 * (want - r)) / Math.max(want - TOOL_REACH, 1e-9))
    if (r < want - 0.03) tooDeep.push(i / (SAMPLES - 1))
  })
  return { percent: Math.round(100 * Math.max(0, 1 - miss / b.radii.length)), tooDeep }
}
