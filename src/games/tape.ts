// Read the Tape: rounds for reading a tape measure, from whole inches down to sixteenths.
import { formatInches } from '../model/units'
import { shuffle, type Rng } from './rng'

export const TAPE_LEVELS = [
  { den: 1, label: 'Whole inches' },
  { den: 2, label: 'Halves' },
  { den: 4, label: 'Quarters' },
  { den: 8, label: 'Eighths' },
  { den: 16, label: 'Sixteenths' }
] as const
const NAMES: Record<number, [string, string]> = { 2: ['half', 'halves'], 4: ['quarter', 'quarters'], 8: ['eighth', 'eighths'], 16: ['sixteenth', 'sixteenths'] }

export const tapeText = (v: number) => formatInches(v)

/** The kind of mark a reading sits on: the longest tick at that spot. */
export function tickOf(v: number): 'inch' | 'half' | 'quarter' | 'eighth' | 'sixteenth' {
  for (const [d, n] of [[1, 'inch'], [2, 'half'], [4, 'quarter'], [8, 'eighth'], [16, 'sixteenth']] as const) if (Math.abs(v * d - Math.round(v * d)) < 1e-9) return n
  return 'sixteenth'
}

/** How to count it: "3 inches and 5 eighths". */
export function explainTape(v: number, den: number): string {
  const whole = Math.floor(v + 1e-9)
  let num = Math.round((v - whole) * den), d = den
  while (num > 0 && num % 2 === 0 && d > 1) { num /= 2; d /= 2 }
  const inches = `${whole} inch${whole === 1 ? '' : 'es'}`
  if (num === 0) return `${inches} — right on the big inch mark`
  return `${whole ? `${inches} and ` : ''}${num} ${NAMES[d][num === 1 ? 0 : 1]}: count the ${NAMES[d][1]} past the ${whole || 0} mark`
}

export type TapeRound = { answer: number; choices: number[]; den: number }

/** A reading on this level's marks (most of the time a mark only this level has), and three wrong ones near it. */
export function tapeRound(level: number, r: Rng): TapeRound {
  const den = TAPE_LEVELS[level].den
  const hard = den > 1 && r() < 0.7
  let answer = 0
  do {
    const whole = 1 + Math.floor(r() * 10)
    const k = den === 1 ? 0 : Math.floor(r() * den)
    answer = whole + k / den
  } while (answer > 12 || (hard && den > 1 && tickOf(answer) !== tickOf(1 / den)))
  const step = 1 / den
  // Likely mistakes: one or two marks off, counting from the wrong inch, mirrored fraction.
  const frac = answer - Math.floor(answer)
  const near = [answer + step, answer - step, answer + 2 * step, answer - 2 * step, answer + 1, answer - 1, Math.floor(answer) + (1 - frac)]
  // Further out, only if those run off the tape.
  const spare = [3, -3, 4, -4, 5].map(k => answer + k * step)
  const wrong: number[] = []
  for (const w of [...shuffle(r, near), ...spare]) {
    const v = Math.round(w * den) / den
    if (v > 0 && v <= 12 && Math.abs(v - answer) > 1e-9 && !wrong.some(x => Math.abs(x - v) < 1e-9)) wrong.push(v)
    if (wrong.length === 3) break
  }
  return { answer, den, choices: shuffle(r, [answer, ...wrong]) }
}

/** Find it: a tap counts within half a mark of the answer. */
export const findOk = (answer: number, tapped: number, den: number) => Math.abs(tapped - answer) <= 0.5 / den + 1e-9
