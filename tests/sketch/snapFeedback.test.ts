import { describe, expect, it } from 'vitest'
import { alignHint, drawReadout, sketchSnapLabel } from '../../src/sketch/snapFeedback'

describe('sketch snap labels', () => {
  it('uses plain words for each kind of snap', () => {
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'endpoint' }, 1 / 8)).toBe('Endpoint')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'midpoint' }, 1 / 8)).toBe('Midpoint')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'center' }, 1 / 8)).toBe('Center')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'intersection' }, 1 / 8)).toBe('Crossing')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'tangent' }, 1 / 8)).toBe('Tangent')
  })
  it('names the grid by its spacing', () => {
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'grid' }, 1 / 8)).toBe('1/8" grid')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'grid' }, 1 / 2)).toBe('1/2" grid')
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'grid' }, 1)).toBe('1" grid')
  })
  it('says nothing for a free point and "Snap off" when snapping is switched off', () => {
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'none' }, 1 / 8)).toBeNull()
    expect(sketchSnapLabel({ pt: { x: 0, y: 0 }, kind: 'none' }, 1 / 8, true)).toBe('Snap off')
  })
})

describe('alignment guides', () => {
  const from = { x: 2, y: 3 }
  it('calls a flat run level and a straight-up run upright', () => {
    expect(alignHint(from, { x: 9, y: 3 })).toMatchObject({ kind: 'level', label: 'Level' })
    expect(alignHint(from, { x: 2, y: -4 })).toMatchObject({ kind: 'upright', label: 'Upright' })
  })
  it('runs the guide line through both points', () => {
    const h = alignHint(from, { x: 9, y: 3 })!
    expect(h.guide.from.y).toBe(3)
    expect(h.guide.to.y).toBe(3)
    expect(h.guide.from.x).toBeLessThanOrEqual(2)
    expect(h.guide.to.x).toBeGreaterThanOrEqual(9)
  })
  it('gives nothing for a slanted run, a tiny run, or no start', () => {
    expect(alignHint(from, { x: 9, y: 4 })).toBeNull()
    expect(alignHint(from, from)).toBeNull()
    expect(alignHint(undefined, from)).toBeNull()
  })
})

describe('live drawing readout', () => {
  it('shows length and angle for a line', () => {
    expect(drawReadout('line', { x: 0, y: 0 }, { x: 3.5, y: 0 })).toBe('3-1/2" at 0°')
    expect(drawReadout('line', { x: 0, y: 0 }, { x: 0, y: 4 })).toBe('4" at 90°')
    expect(drawReadout('construction', { x: 0, y: 0 }, { x: 3, y: 3 })).toBe('4-1/4" at 45°')
  })
  it('shows width and height for a rectangle and the radius for a circle', () => {
    expect(drawReadout('rect', { x: 0, y: 0 }, { x: 10, y: -4 })).toBe('10" wide × 4" high')
    expect(drawReadout('circle', { x: 0, y: 0 }, { x: 1.5, y: 0 })).toBe('Radius 1-1/2"')
  })
  it('shows nothing for tools without a simple size', () => {
    expect(drawReadout('select', { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
    expect(drawReadout('spline', { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
  })
})
