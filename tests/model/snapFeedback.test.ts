import { describe, expect, it } from 'vitest'
import { snapPosition } from '../../src/model/snap'
import { snapFeedback } from '../../src/model/snapFeedback'
import { board, project } from './helpers'

const opts = { tolerance: 0.25, grid: 1 / 16 }
const a = board({ id: 'a', name: 'Left side', width: 4, length: 10, thickness: 1 })
const mover = (over = {}) => board({ id: 'b', name: 'Shelf', width: 4, length: 10, thickness: 1, position: { x: 30, y: 0, z: 0 }, ...over })

function feedback(proposed: { x: number; y: number; z: number }, extra: Partial<Parameters<typeof snapPosition>[3]> = {}, m = mover()) {
  const p = project([a, m])
  const result = snapPosition(p, 'b', proposed, { ...opts, ...extra })
  return { result, fb: snapFeedback(p, 'b', result, { grid: extra.grid ?? opts.grid, start: m.position }) }
}

describe('snap result to feedback', () => {
  it('names one flush face "Face" and points at the board it met', () => {
    const { fb } = feedback({ x: 4.1, y: 40, z: 40 })
    expect(fb.kind).toBe('face')
    expect(fb.label).toBe('Face')
    expect(fb.targetIds).toEqual(['a'])
    expect(fb.highlights).toHaveLength(1)
    expect(fb.highlights[0]).toMatchObject({ boardId: 'a', axis: 'x', at: 4 })
  })

  it('names two flush faces "Edge" and three "Corner"', () => {
    expect(feedback({ x: 4.1, y: 0.1, z: 40 }).fb.label).toBe('Edge')
    const corner = feedback({ x: 4.1, y: 0.1, z: 0.1 }).fb
    expect(corner.label).toBe('Corner')
    expect(corner.kind).toBe('corner')
    expect(corner.marker).toEqual({ x: 4, y: 0, z: 0 })
  })

  it('names a lined-up centre "Midpoint" and draws a guide through it', () => {
    const narrow = mover({ width: 2 })
    const { fb } = feedback({ x: 1.1, y: 40, z: 40 }, {}, narrow)
    expect(fb.label).toBe('Midpoint')
    expect(fb.highlights).toEqual([])
    const guide = fb.guides.find(g => g.axis === 'x')!
    expect(guide.from.x).toBe(2)
    expect(guide.to.x).toBe(2)
  })

  it('names the grid by its size when nothing else is close', () => {
    expect(feedback({ x: 20.03, y: 40, z: 40 }).fb.label).toBe('1/16" grid')
    expect(feedback({ x: 20.03, y: 40, z: 40 }, { grid: 1 / 8 }).fb.label).toBe('1/8" grid')
    expect(feedback({ x: 20.03, y: 40, z: 40 }).fb.guides).toEqual([])
  })

  it('draws one guide line per aligned axis, lying in the shared plane', () => {
    const { fb } = feedback({ x: 4.1, y: 0.1, z: 40 })
    expect(fb.guides.map(g => g.axis).sort()).toEqual(['x', 'y'])
    const gx = fb.guides.find(g => g.axis === 'x')!
    expect(gx.from.x).toBe(4)
    expect(gx.to.x).toBe(4)
  })

  it('reads out how far the board moved, in tape-measure inches', () => {
    const { fb } = feedback({ x: 4.1, y: 0.01, z: 0 })
    expect(fb.readout).toContain('X -26"')
    expect(fb.readout).not.toContain('Y')
    expect(fb.readout).toContain('Left side')
  })

  it('says so when the board has not moved', () => {
    const { fb } = feedback({ x: 30, y: 0, z: 0 })
    expect(fb.readout).toMatch(/Not moved/)
  })

  it('shows nothing when snapping was switched off', () => {
    const p = project([a, mover()])
    const result = snapPosition(p, 'b', { x: 4.1, y: 0, z: 0 }, { ...opts, enabled: false })
    const fb = snapFeedback(p, 'b', result, { grid: opts.grid, start: { x: 30, y: 0, z: 0 } })
    expect(fb.kind).toBe('off')
    expect(fb.label).toBe('Snap off')
    expect(fb.guides).toEqual([])
  })
})
