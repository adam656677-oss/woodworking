import { feetInches, boardFeet, compoundMiter, crownFlat, epoxy, evenSpacing, fibonacciHeights, graduated, GOLDEN, nearest, shellacFlakes, shellacThin, tapeMath } from '../../src/tools/calc'

test('board feet', () => {
  expect(boardFeet(1, 6, 96)).toBe(4)
  expect(boardFeet(0.75, 12, 144, 2)).toBe(18)
})

test('tape math and nearest fractions', () => {
  expect(tapeMath('3-1/2 + 7/8')).toEqual({ value: 4.375 })
  expect(tapeMath("2' 6 - 1-1/4")).toEqual({ value: 28.75 })
  expect(tapeMath('10 * 3')).toEqual({ value: 30 })
  expect(tapeMath('29-3/4 / 2')).toEqual({ value: 14.875 })
  expect(tapeMath('5 / 0')).toEqual({ error: "Can't divide by zero" })
  expect('error' in tapeMath('abc')).toBe(true)
  // Feet-dash-inches as written on drawings, and the other dash cases.
  expect(tapeMath(`6'-2"`)).toEqual({ value: 74 })
  expect(tapeMath(`3'-4-1/2"`)).toEqual({ value: 40.5 })
  expect(tapeMath(`2' - 3`)).toEqual({ value: 21 })
  expect(tapeMath('5-3')).toEqual({ value: 2 })
  expect(tapeMath('1/2-1/4')).toEqual({ value: 0.25 })
  expect(tapeMath('2-1/2-1/4')).toEqual({ value: 2.25 })
  expect(tapeMath('-3 + 5')).toEqual({ value: 2 })
  expect(tapeMath('1 + 2 * 3')).toEqual({ value: 7 })
  expect(tapeMath('.5 + .25')).toEqual({ value: 0.75 })
  expect(tapeMath('3 1/2 + 1')).toEqual({ value: 4.5 })
  expect(tapeMath('5 / 0/0')).toEqual({ error: "Can't divide by zero" })
  expect(tapeMath('5 +')).toEqual({ error: 'The sum ends with an operator' })
  expect('error' in tapeMath(`10 * 3"`)).toBe(true)
  expect(feetInches(23.99)).toBe(`2' 0"`)
  expect(feetInches(-14)).toBe(`-1' 2"`)
  expect(feetInches(40.5)).toBe(`3' 4-1/2"`)
  expect(nearest(0.3, 16)).toBe('5/16"')
  expect(nearest(2.51, 32)).toBe('2-1/2"')
  expect(nearest(0.1094, 64)).toBe('7/64"')
})

test('even spacing: balusters with gaps at both ends, and flush', () => {
  const r = evenSpacing(36, 8, 1.5, 'gaps')
  if ('error' in r) throw new Error(r.error)
  expect(r.gap).toBeCloseTo((36 - 12) / 9, 9)
  expect(r.positions[0]).toBeCloseTo(r.gap, 9)
  expect(r.positions[7] + 1.5 + r.gap).toBeCloseTo(36, 9)
  const f = evenSpacing(30, 4, 3, 'flush')
  if ('error' in f) throw new Error(f.error)
  expect(f.gap).toBe(6)
  expect(f.positions).toEqual([0, 9, 18, 27])
  expect('error' in evenSpacing(10, 4, 3, 'gaps')).toBe(true)
})

test('compound miters for 4, 6 and 8 sides, and crown at 38° and 52° spring', () => {
  const r = (x: { miter: number; bevel: number }) => [Math.round(x.miter * 100) / 100, Math.round(x.bevel * 100) / 100]
  expect(r(compoundMiter(4, 0))).toEqual([0, 45])
  expect(r(compoundMiter(4, 90))).toEqual([45, 0])
  expect(r(compoundMiter(4, 30))).toEqual([26.57, 37.76])
  expect(r(compoundMiter(6, 30))).toEqual([16.1, 25.66])
  expect(r(compoundMiter(8, 30))).toEqual([11.7, 19.35])
  expect(r(crownFlat(38))).toEqual([31.62, 33.86])
  expect(r(crownFlat(52))).toEqual([38.24, 25.81])
  expect(r(crownFlat(45))).toEqual([35.26, 30])
})

test('proportions, shellac and epoxy', () => {
  const g = graduated(30, 3, GOLDEN)
  expect(g.reduce((a, b) => a + b, 0)).toBeCloseTo(30, 9)
  expect(g[1] / g[0]).toBeCloseTo(GOLDEN, 9)
  expect(fibonacciHeights(22, 4)).toEqual([2, 4, 6, 10])
  // A 2-lb cut in a pint (16 fl oz) of alcohol: 4 oz of flakes.
  expect(shellacFlakes(2, 16)).toBe(4)
  // 8 oz of 2-lb cut thinned to 1-lb: add 8 oz of alcohol.
  expect(shellacThin(2, 1, 8)).toBe(8)
  const e = epoxy(24, 12, 0.25, 1, 1)
  expect(e.cubicIn).toBeCloseTo(79.2, 6)
  expect(e.resinOz).toBeCloseTo(e.hardenerOz, 9)
  expect(e.flOz).toBeCloseTo(79.2 / 1.8046875, 6)
})
