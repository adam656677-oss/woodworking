// Shop calculators. Inches with fractions throughout; each answer comes with how it was worked out.
import { formatInches } from '../model/units'

const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180

/** Board feet of one piece: thickness × width × length (inches) ÷ 144. */
export const boardFeet = (t: number, w: number, l: number, qty = 1) => (t * w * l * qty) / 144

/** The nearest fraction with this denominator, as tape text. */
export function nearest(n: number, den: 16 | 32 | 64): string {
  const v = Math.round(n * den) / den
  return formatInches(v, { sixtyFourths: den === 64 }).replace('"', '') + '"'
}

// One amount: feet and/or inches. Inches may be a whole number, a fraction, a mixed number (3-1/2 or 3 1/2) or
// a decimal. Feet may be followed by inches after a space or a dash with no spaces (6'-2", 2' 6).
const INCH = String.raw`(\d+(?:-|\s+)\d+/\d+|\d+/\d+|\d*\.\d+|\d+)`
const AMOUNT = new RegExp(String.raw`^(?:(\d*\.?\d+)\s*(?:'|ft\b)(?:(?:-|\s+)${INCH}(?!\s*')(?!\s*ft))?|${INCH})\s*(?:"|in\b)?`)

function inchValue(t: string): number {
  const m = /^(\d+)(?:-|\s+)(\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3])
  const f = /^(\d+)\/(\d+)$/.exec(t)
  if (f) return Number(f[1]) / Number(f[2])
  return Number(t)
}

/**
 * A tape-measure sum: amounts like 3' 4-1/2", 6'-2", 7/8, .375 with + − × ÷ (× and ÷ take a plain number on the
 * right). × and ÷ go before + and −, as usual. Returns inches, or the reason it can't be read.
 */
export function tapeMath(expr: string): { value: number } | { error: string } {
  const src = expr.replace(/×|\*/g, '*').replace(/÷/g, '/').replace(/−|–/g, '-').trim()
  if (!src) return { error: 'Type a sum, like 3-1/2 + 7/8' }
  let i = 0
  const space = () => { while (i < src.length && /\s/.test(src[i])) i++ }
  const amount = (): { value: number; plain: boolean } | { error: string } => {
    space()
    const m = AMOUNT.exec(src.slice(i))
    if (!m || !m[0].trim()) return { error: `Can't read "${src.slice(i).split(/\s+[-+*/x]\s+/)[0] || src.slice(i)}"` }
    i += m[0].length
    const [, feet, inchAfterFeet, inch] = m
    if (feet !== undefined) return { value: Number(feet) * 12 + (inchAfterFeet ? inchValue(inchAfterFeet.trim()) : 0), plain: false }
    const t = inch.trim()
    if (/^\d+\/0$/.test(t)) return { error: "Can't divide by zero" }
    return { value: inchValue(t), plain: !/["]|in\b/.test(m[0]) }
  }
  const op = (): string | null => { space(); const c = src[i]; if (c && '+-*/x'.includes(c)) { i++; return c === 'x' ? '*' : c } return null }
  // A sum of products: each product is an amount times or divided by plain numbers.
  let total = 0
  let sign = 1
  space()
  if (src[i] === '-') { sign = -1; i++ } else if (src[i] === '+') i++
  for (;;) {
    const a = amount()
    if ('error' in a) return a
    let term = a.value
    let next = op()
    while (next === '*' || next === '/') {
      const b = amount()
      if ('error' in b) return /Can't read ""/.test(b.error) ? { error: 'The sum ends with an operator' } : b
      if (!b.plain) return { error: `× and ÷ need a plain number after them` }
      if (next === '/' && b.value === 0) return { error: "Can't divide by zero" }
      term = next === '*' ? term * b.value : term / b.value
      next = op()
    }
    total += sign * term
    if (next === null) {
      space()
      return i < src.length ? { error: `Can't read "${src.slice(i)}"` } : { value: total }
    }
    space()
    if (i >= src.length) return { error: 'The sum ends with an operator' }
    sign = next === '-' ? -1 : 1
  }
}

/** Inches as feet and inches, rounded to 1/16", the sign in front: -14 → -1' 2". */
export function feetInches(v: number): string {
  const r = Math.round(Math.abs(v) * 16) / 16
  const ft = Math.floor(r / 12)
  const inch = r - ft * 12
  return `${v < 0 && r > 0 ? '-' : ''}${ft}' ${formatInches(inch)}`
}

/** Even spacing: n pieces of width w in a space; gaps at both ends too (balusters) or pieces flush at the ends. */
export function evenSpacing(space: number, n: number, w: number, ends: 'gaps' | 'flush'): { gap: number; positions: number[] } | { error: string } {
  if (!(n >= 1) || !Number.isInteger(n)) return { error: 'Give a whole number of pieces' }
  const gaps = ends === 'gaps' ? n + 1 : n - 1
  if (gaps === 0) return { gap: 0, positions: [(space - w) / 2] }
  const gap = (space - n * w) / gaps
  if (gap < 0) return { error: `${n} pieces of ${formatInches(w)} don't fit in ${formatInches(space)}` }
  const start = ends === 'gaps' ? gap : 0
  return { gap, positions: Array.from({ length: n }, (_, i) => start + i * (w + gap)) }
}

/**
 * Compound miter for an n-sided frame whose sides lean out `tilt` degrees from upright (0 = an upright box,
 * 90 = a flat frame): miter = atan(sin(tilt) · tan(180/n)), bevel = asin(cos(tilt) · sin(180/n)).
 * Crown moulding in a 90° corner is the same with n = 4 and tilt = the spring angle.
 */
export function compoundMiter(sides: number, tilt: number): { miter: number; bevel: number } {
  const h = Math.PI / sides
  return { miter: deg(Math.atan(Math.sin(rad(tilt)) * Math.tan(h))), bevel: deg(Math.asin(Math.cos(rad(tilt)) * Math.sin(h))) }
}
/** Crown moulding cut flat on the saw, for a corner of `corner` degrees (90 for a square room), spring angle in degrees. */
export function crownFlat(spring: number, corner = 90): { miter: number; bevel: number } {
  const h = rad(corner / 2)
  return { miter: deg(Math.atan(Math.sin(rad(spring)) / Math.tan(h))), bevel: deg(Math.asin(Math.cos(rad(spring)) * Math.cos(h))) }
}

export const GOLDEN = (1 + Math.sqrt(5)) / 2
/** Graduated drawer heights that add up to `total` (top drawer smallest), each `ratio` times the one above. */
export function graduated(total: number, n: number, ratio: number): number[] {
  const parts = Array.from({ length: n }, (_, i) => ratio ** i)
  const sum = parts.reduce((a, b) => a + b, 0)
  return parts.map(p => (total * p) / sum)
}
/** Fibonacci drawer heights (1, 2, 3, 5, 8 … units) scaled to `total`. */
export function fibonacciHeights(total: number, n: number): number[] {
  const f = [1, 2]
  while (f.length < n) f.push(f[f.length - 1] + f[f.length - 2])
  const parts = f.slice(0, n)
  const sum = parts.reduce((a, b) => a + b, 0)
  return parts.map(p => (total * p) / sum)
}

/** Shellac: ounces of flakes for a pound cut in this many fluid ounces of alcohol (1 lb per 128 fl oz per pound of cut). */
export const shellacFlakes = (cut: number, alcoholOz: number) => (cut * 16 * alcoholOz) / 128
/** Alcohol to add to thin `oz` of one cut down to another (flakes' own volume ignored, as is usual). */
export const shellacThin = (fromCut: number, toCut: number, oz: number) => (!(toCut > 0) || toCut >= fromCut ? 0 : (oz * (fromCut - toCut)) / toCut)

/** Epoxy for a pour: volume of L × W × depth plus 10%, in fluid ounces, and split by a resin:hardener ratio. */
export function epoxy(l: number, w: number, depth: number, resin: number, hardener: number): { cubicIn: number; flOz: number; resinOz: number; hardenerOz: number } {
  const cubicIn = l * w * depth * 1.1
  const flOz = cubicIn / 1.8046875
  return { cubicIn, flOz, resinOz: (flOz * resin) / (resin + hardener), hardenerOz: (flOz * hardener) / (resin + hardener) }
}
