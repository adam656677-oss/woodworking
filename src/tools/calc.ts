// Shop calculators. Inches with fractions throughout; each answer comes with how it was worked out.
import { formatInches, parseInches } from '../model/units'

const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180

/** Board feet of one piece: thickness × width × length (inches) ÷ 144. */
export const boardFeet = (t: number, w: number, l: number, qty = 1) => (t * w * l * qty) / 144

/** The nearest fraction with this denominator, as tape text. */
export function nearest(n: number, den: 16 | 32 | 64): string {
  const v = Math.round(n * den) / den
  return formatInches(v, { sixtyFourths: den === 64 }).replace('"', '') + '"'
}

/**
 * A tape-measure sum: amounts like 3' 4-1/2", 7/8, 12.375 with + − × ÷ (× and ÷ take a plain number on the
 * right). Returns inches, or the reason it can't be read.
 */
export function tapeMath(expr: string): { value: number } | { error: string } {
  const src = expr.replace(/×|x(?=\s*\d)|\*/g, '*').replace(/÷/g, '/').replace(/−|–/g, '-')
  // Split into terms at + and - (not a - inside a mixed number like 3-1/2), and *, / between a term and a number.
  const tokens: string[] = []
  let cur = ''
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    const prev = cur.trim()
    // A '-' right after digits with no space and followed by digits is part of a mixed number (3-1/2).
    const mixed = ch === '-' && /\d$/.test(cur) && /^\d/.test(src.slice(i + 1)) && !/\s$/.test(cur)
    if ((ch === '+' || (ch === '-' && !mixed && prev !== '')) || ch === '*' || (ch === '/' && /\s$/.test(cur))) {
      if (prev) tokens.push(prev)
      tokens.push(ch)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) tokens.push(cur.trim())
  if (!tokens.length) return { error: 'Type a sum, like 3-1/2 + 7/8' }
  const amount = (t: string): number | null => { const r = parseInches(t, { allowZero: true }); return r.ok ? r.value : null }
  const plain = (t: string): number | null => (/^\d+(\.\d+)?$/.test(t) ? Number(t) : /^\d+\/\d+$/.test(t) ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : null)
  let total = amount(tokens[0])
  if (total === null) return { error: `Can't read "${tokens[0]}"` }
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i], t = tokens[i + 1]
    if (t === undefined) return { error: 'The sum ends with an operator' }
    if (op === '+' || op === '-') {
      const v = amount(t)
      if (v === null) return { error: `Can't read "${t}"` }
      total = op === '+' ? total + v : total - v
    } else {
      const v = plain(t)
      if (v === null) return { error: `× and ÷ need a plain number after them ("${t}")` }
      if (op === '/' && v === 0) return { error: "Can't divide by zero" }
      total = op === '*' ? total * v : total / v
    }
  }
  return { value: total }
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
export const shellacThin = (fromCut: number, toCut: number, oz: number) => (toCut >= fromCut ? 0 : (oz * (fromCut - toCut)) / toCut)

/** Epoxy for a pour: volume of L × W × depth plus 10%, in fluid ounces, and split by a resin:hardener ratio. */
export function epoxy(l: number, w: number, depth: number, resin: number, hardener: number): { cubicIn: number; flOz: number; resinOz: number; hardenerOz: number } {
  const cubicIn = l * w * depth * 1.1
  const flOz = cubicIn / 1.8046875
  return { cubicIn, flOz, resinOz: (flOz * resin) / (resin + hardener), hardenerOz: (flOz * hardener) / (resin + hardener) }
}
