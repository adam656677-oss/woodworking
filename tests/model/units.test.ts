import { formatInches, parseInches, snap64 } from '../../src/model/units'

describe('formatInches', () => {
  test('shows tape-measure fractions to 1/32, reduced', () => {
    expect(formatInches(11.75)).toBe('11-3/4"')
    expect(formatInches(0.75)).toBe('3/4"')
    expect(formatInches(6)).toBe('6"')
    expect(formatInches(0.71875)).toBe('23/32"')
    expect(formatInches(9.78125)).toBe('9-25/32"')
    expect(formatInches(29.0625)).toBe('29-1/16"')
  })
  test('never shows feet', () => {
    expect(formatInches(36)).toBe('36"')
  })
  test('rounds to the nearest 1/32', () => {
    expect(formatInches(0.749)).toBe('3/4"')
    expect(formatInches(5.999)).toBe('6"')
  })
})

describe('parseInches', () => {
  test('accepts fraction, hyphen, decimal and quote forms', () => {
    for (const t of ['11 3/4', '11-3/4', '11.75', '11 3/4"']) {
      expect(parseInches(t)).toEqual({ ok: true, value: 11.75 })
    }
  })
  test('accepts feet', () => {
    expect(parseInches("11'")).toEqual({ ok: true, value: 132 })
    expect(parseInches(`1' 2-1/2"`)).toEqual({ ok: true, value: 14.5 })
  })
  test('accepts a bare fraction', () => {
    expect(parseInches('3/4')).toEqual({ ok: true, value: 0.75 })
  })
  test('rejects blank, junk, negative, divide-by-zero, zero and metric', () => {
    for (const t of ['', '   ', 'abc', '-3', '1/0', '0', '298mm']) {
      expect(parseInches(t).ok).toBe(false)
    }
  })
  test('gives user-facing reasons', () => {
    expect(parseInches('abc')).toEqual({ ok: false, reason: 'Enter a size like 11-3/4"' })
    expect(parseInches('0')).toEqual({ ok: false, reason: 'Size must be more than 0' })
    expect(parseInches('298mm')).toEqual({ ok: false, reason: "Metric isn't supported — use inches" })
  })
  test('allowZero lets offsets be 0', () => {
    expect(parseInches('0', { allowZero: true })).toEqual({ ok: true, value: 0 })
  })
})

test('snap64 rounds to the nearest 1/64', () => {
  expect(snap64(0.718)).toBe(46 / 64)
})
