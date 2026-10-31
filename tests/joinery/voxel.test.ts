import { contactArea, loosePieces, preset, report, setCell, slideDirs, unreachable, weakSlices, type Grid } from '../../src/joinery/voxel'

test('a half lap end to end: B lifts out, pulls out or slides sideways; nothing loose or unreachable', () => {
  const g = preset('lap', 'inline', 4)
  expect(slideDirs(g).sort()).toEqual(['x+', 'y+', 'y-', 'z+'].sort())
  const r = report(g, 4)
  expect(r.ok).toBe(true)
  // The lap's glue face: 4 × 4 cells of 1" each.
  expect(contactArea(g, 4)).toBeCloseTo(16, 6)
})

test('B locked inside A cannot go together, and is loose', () => {
  let g: Grid = preset('empty', 'inline', 3)
  g = setCell(g, 1, 1, 1, '1')
  expect(slideDirs(g)).toEqual([])
  expect(loosePieces(g, '1')).toEqual({ loose: [13], pieces: 1 })
  // The hole in A for it can't be reached by a tool either.
  expect(unreachable(g, '0')).toEqual([13])
  expect(report(g, 3).ok).toBe(false)
})

test('a tenon on B through A: a thin neck where it is a single cell', () => {
  let g: Grid = preset('empty', 'inline', 4)
  for (let i = 0; i < 4; i++) g = setCell(g, i, 1, 1, '1')
  const weak = weakSlices(g, '1')
  expect(weak.length).toBeGreaterThan(0)
  expect(weak[0].fraction).toBeCloseTo(1 / 16, 6)
  expect(slideDirs(g)).toContain('x+')
})

test('crossing beams: a cross lap lifts out upward only', () => {
  const g = preset('lap', 'cross', 4)
  expect(slideDirs(g)).toEqual(['z+'])
  expect(report(g, 3.5).ok).toBe(true)
})
