import { metricToInches, NOMINAL, parseDim } from '../../src/plans/dims'

test.each([
  ['5-1/2', 5.5], ['5 1/2', 5.5], ['5½', 5.5], ['5.5', 5.5], ['24"', 24], ["2'", 24], ['3/4', 0.75], ['3/4"', 0.75], ['11-1/4"', 11.25], ['abc', null]
])('parseDim(%s) = %s', (t, v) => {
  expect(parseDim(t as string)).toBe(v)
})

test('nominal lumber is its actual size', () => {
  expect(NOMINAL['1x6']).toEqual([0.75, 5.5])
  expect(NOMINAL['2x4']).toEqual([1.5, 3.5])
})

test('metric converts to the nearest 1/32"', () => {
  expect(metricToInches(19, 'mm')).toBe(0.75)
  expect(metricToInches(45, 'cm')).toBe(17.71875)
})
