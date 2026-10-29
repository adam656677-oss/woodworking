import { evalFormula, namesIn, parseFormula } from '../../src/formulas/expr'

const vals: Record<string, number> = { h: 36, t: 0.75, w: 30, 'side#2.length': 34.5, 'wood.ply_3_4.t': 0.71875 }
function calc(text: string) {
  const p = parseFormula(text)
  if (!p.ok) return p
  return evalFormula(p.expr, n => vals[n])
}
const v = (text: string) => { const r = calc(text); if (!r.ok) throw new Error(r.error); return r.value }

test('tape-measure amounts', () => {
  expect(v('11-3/4')).toBe(11.75)
  expect(v('11 3/4')).toBe(11.75)
  expect(v(`1' 2"`)).toBe(14)
  expect(v('12"')).toBe(12)
  expect(v(`2'`)).toBe(24)
  expect(v('3/4')).toBe(0.75)
})

test('arithmetic and precedence', () => {
  expect(v('3/4*2')).toBe(1.5)
  expect(v('H - 2*T')).toBe(34.5)
  expect(v('-(2+3)')).toBe(-5)
  expect(v('11 - 3/4')).toBe(10.25)
  expect(v('(H - 2*T) / 4')).toBeCloseTo(8.625, 9)
})

test('functions', () => {
  expect(v('max(W/3, 6)')).toBe(10)
  expect(v('min(W, H)')).toBe(30)
  expect(v('round8(1.3)')).toBe(1.25)
  expect(v('round16(1.3)')).toBe(1.3125)
  expect(v('floor(13/4)')).toBe(3)
  expect(v('ceil(1.1)')).toBe(2)
  expect(v('abs(-2)')).toBe(2)
  expect(v('round(2.5)')).toBe(3)
})

test('part and wood names', () => {
  expect(v('Side#2.Length')).toBe(34.5)
  expect(v('Wood.ply_3_4.T')).toBe(0.71875)
  expect(v('h + T')).toBe(36.75)
})

test('plain messages', () => {
  expect(calc('Hight + 1')).toEqual({ ok: false, error: "Unknown size 'Hight'" })
  expect(calc('H * (2')).toEqual({ ok: false, error: "Can't read this formula near '(2'" })
  expect(calc('1/0')).toEqual({ ok: false, error: 'Dividing by zero' })
  expect(calc('H +')).toEqual({ ok: false, error: "Can't read this formula near '+'" })
  expect(calc('')).toEqual({ ok: false, error: 'Type a formula after =' })
  expect(calc('sqrt(4)')).toEqual({ ok: false, error: "Unknown size 'sqrt'" })
})

test('the names a formula uses', () => {
  const p = parseFormula('H - 2*t + max(W, Side#2.Length)')
  if (!p.ok) throw new Error(p.error)
  expect(namesIn(p.expr).sort()).toEqual(['h', 'side#2.length', 't', 'w'])
})
