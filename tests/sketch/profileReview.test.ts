import { describe, expect, it } from 'vitest'
import { reviewProfile } from '../../src/sketch/profileReview'
import { newSketch, type Sketch } from '../../src/sketch/types'

function rectangle(): Sketch {
  const sk = newSketch('test', 'Panel', 'precise')
  sk.points = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 12, y: 0 }, { id: 'c', x: 12, y: 24 }, { id: 'd', x: 0, y: 24 }]
  sk.entities = [{ id: 'ab', kind: 'line', a: 'a', b: 'b' }, { id: 'bc', kind: 'line', a: 'b', b: 'c' }, { id: 'cd', kind: 'line', a: 'c', b: 'd' }, { id: 'da', kind: 'line', a: 'd', b: 'a' }]
  return sk
}

describe('custom profile review', () => {
  it('calculates the sketch-axis dimensions of a closed panel', () => {
    expect(reviewProfile(rectangle())).toEqual({ ok: true, across: 12, up: 24, cutouts: 0 })
  })
  it('reports an open outline instead of approving it', () => {
    const sk = rectangle(); sk.entities.pop()
    expect(reviewProfile(sk)).toMatchObject({ ok: false, problem: expect.stringContaining('gap') })
  })
  it('handles an empty sketch', () => {
    expect(reviewProfile(newSketch('empty', 'Empty', 'precise')).ok).toBe(false)
  })
  it('handles missing geometry without throwing', () => {
    const sk = rectangle(); sk.points.pop()
    expect(reviewProfile(sk).ok).toBe(false)
  })
  it('rejects non-finite coordinates', () => {
    const sk = rectangle(); sk.points[0].x = NaN
    expect(reviewProfile(sk).ok).toBe(false)
  })
  it('counts an internal circular cutout', () => {
    const sk = rectangle()
    sk.points.push({ id: 'center', x: 6, y: 12 })
    sk.entities.push({ id: 'hole', kind: 'circle', center: 'center', r: 1 })
    expect(reviewProfile(sk)).toEqual({ ok: true, across: 12, up: 24, cutouts: 1 })
  })
  it('uses exact circle bounds rather than tessellation extrema', () => {
    const sk = newSketch('circle', 'Disk', 'precise')
    sk.points = [{ id: 'center', x: 0, y: 0 }]
    sk.entities = [{ id: 'edge', kind: 'circle', center: 'center', r: 1 }]
    expect(reviewProfile(sk)).toEqual({ ok: true, across: 2, up: 2, cutouts: 0 })
  })
  it('rejects invalid circle radii', () => {
    const sk = rectangle()
    sk.entities.push({ id: 'bad', kind: 'circle', center: 'a', r: Infinity })
    expect(reviewProfile(sk).ok).toBe(false)
  })
})
