// Reading sizes the way plans write them: 5-1/2, 5 1/2, 5½, 5.5, 24", 2', and nominal lumber like 1x6.

const VULGAR: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }

/** Inches from one written size, or null if it isn't one. */
export function parseDim(token: string): number | null {
  let t = token.trim().replace(/(inches|inch|in\.?|")$/i, '').trim()
  let feet = false
  if (/'$/.test(t)) {
    feet = true
    t = t.slice(0, -1).trim()
  }
  let v: number | null = null
  let m: RegExpMatchArray | null
  if ((m = /^(\d+)?\s*([¼½¾⅛⅜⅝⅞])$/.exec(t))) v = Number(m[1] ?? 0) + VULGAR[m[2]]
  else if ((m = /^(\d+)\s*[- ]\s*(\d+)\/(\d+)$/.exec(t))) v = Number(m[3]) ? Number(m[1]) + Number(m[2]) / Number(m[3]) : null
  else if ((m = /^(\d+)\/(\d+)$/.exec(t))) v = Number(m[2]) ? Number(m[1]) / Number(m[2]) : null
  else if ((m = /^(\d+(?:\.\d+)?)$/.exec(t))) v = Number(m[1])
  if (v === null) return null
  return feet ? v * 12 : v
}

/** Nominal lumber → [actual thickness, actual width] in inches. */
export const NOMINAL: Record<string, [number, number]> = {
  '1x2': [0.75, 1.5], '1x3': [0.75, 2.5], '1x4': [0.75, 3.5], '1x6': [0.75, 5.5], '1x8': [0.75, 7.25],
  '1x10': [0.75, 9.25], '1x12': [0.75, 11.25], '2x2': [1.5, 1.5], '2x4': [1.5, 3.5], '2x6': [1.5, 5.5]
}

export function metricToInches(n: number, unit: 'mm' | 'cm'): number {
  const inches = (unit === 'cm' ? n * 10 : n) / 25.4
  return Math.round(inches * 32) / 32
}
