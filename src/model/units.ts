// Inch measurements: parsing what people type and showing sizes the way a tape measure reads.

export type ParseResult = { ok: true; value: number } | { ok: false; reason: string }

const REASON_FORMAT = 'Enter a size like 11-3/4"'
const REASON_ZERO = 'Size must be more than 0'
const REASON_METRIC = "Metric isn't supported — use inches"

/** Round to the nearest 1/64" — every size stored in the model passes through this. */
export function snap64(n: number): number {
  return Math.round(n * 64) / 64
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Format inches to the nearest 1/32", reduced: 11-3/4", 3/4", 6", 23/32". Never shows feet. */
export function formatInches(n: number): string {
  const negative = n < 0
  const thirtySeconds = Math.round(Math.abs(n) * 32)
  const whole = Math.floor(thirtySeconds / 32)
  const rem = thirtySeconds % 32
  let text: string
  if (rem === 0) {
    text = `${whole}`
  } else {
    const g = gcd(rem, 32)
    const frac = `${rem / g}/${32 / g}`
    text = whole === 0 ? frac : `${whole}-${frac}`
  }
  return `${negative ? '-' : ''}${text}"`
}

/** Parse one inch amount: "11", "11.75", "3/4", "11 3/4", "11-3/4". Returns null if malformed. */
function parseInchPart(text: string): number | null {
  const t = text.trim()
  if (t === '') return 0
  let m = /^(\d+(?:\.\d+)?)$/.exec(t)
  if (m) return Number(m[1])
  m = /^(\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2])
  m = /^(\d+)(?:\s+|-)(\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3])
  return null
}

/** Parse a typed size in inches (optionally with feet). Sizes must be > 0 unless allowZero. */
export function parseInches(text: string, opts: { allowZero?: boolean } = {}): ParseResult {
  const t = text.trim()
  if (t === '') return { ok: false, reason: REASON_FORMAT }
  if (/\d\s*(mm|cm|m)\s*$/i.test(t)) return { ok: false, reason: REASON_METRIC }

  let feet = 0
  let rest = t
  const feetMatch = /^(\d+(?:\.\d+)?)\s*'\s*(.*)$/.exec(t)
  if (feetMatch) {
    feet = Number(feetMatch[1])
    rest = feetMatch[2]
  }
  rest = rest.replace(/"\s*$/, '')
  if (feetMatch === null && rest.trim() === '') return { ok: false, reason: REASON_FORMAT }

  const inches = parseInchPart(rest)
  if (inches === null) return { ok: false, reason: REASON_FORMAT }

  const value = feet * 12 + inches
  if (!Number.isFinite(value)) return { ok: false, reason: REASON_FORMAT }
  if (value === 0 && !opts.allowZero) return { ok: false, reason: REASON_ZERO }
  return { ok: true, value }
}
