import { cutGeometry, jointNotes, pointRemovedBy, validateBoard, validateJoint } from '../../src/model/joints'
import type { Joint } from '../../src/model/types'
import { board, project } from './helpers'

const host = board({ id: 'side', thickness: 0.75, width: 10, length: 36 })
const shelf = board({ id: 'shelf', width: 9, length: 28 })

function dado(params: Partial<{ width: number; depth: number; offset: number }> = {}): Joint {
  return { id: 'j1', type: 'dado', hostBoardId: 'side', partnerBoardId: 'shelf', params: { width: 0.75, depth: 0.25, offset: 6, face: 'top', ...params } }
}

describe('dado', () => {
  test('cuts a groove across the full host width at the offset', () => {
    const cuts = cutGeometry(project([host, shelf], [dado()]))
    expect(cuts).toEqual([
      { boardId: 'side', kind: 'dado', min: { x: 0, y: 6, z: 0.5 }, max: { x: 10, y: 6.75, z: 0.75 } }
    ])
  })
  test('host note', () => {
    expect(jointNotes(project([host, shelf], [dado()]), 'side')).toEqual(['3/4" dado × 1/4" deep, 6" from end'])
  })
  test('validation', () => {
    const p = project([host, shelf])
    expect(validateJoint(p, dado())).toBeNull()
    expect(validateJoint(p, dado({ depth: 0.5 }))).toMatch(/half/)
    expect(validateJoint(p, dado({ width: 0 }))).toMatch(/width/i)
    expect(validateJoint(p, dado({ offset: 35.5 }))).toMatch(/past the end/)
  })
})

describe('rabbet', () => {
  const rabbet: Joint = { id: 'j2', type: 'rabbet', hostBoardId: 'side', partnerBoardId: 'shelf', params: { width: 0.21875, depth: 0.375, offset: 0, face: 'top', along: 'length' } }
  test('sits at the host edge, running along the length', () => {
    const cuts = cutGeometry(project([host, shelf], [rabbet]))
    expect(cuts).toEqual([
      { boardId: 'side', kind: 'rabbet', min: { x: 0, y: 0, z: 0.375 }, max: { x: 0.21875, y: 36, z: 0.75 } }
    ])
  })
  test('note has no offset clause at an edge', () => {
    expect(jointNotes(project([host, shelf], [rabbet]), 'side')).toEqual(['7/32" rabbet × 3/8" deep'])
  })
  test('must touch an edge', () => {
    const p = project([host, shelf])
    expect(validateJoint(p, { ...rabbet, params: { ...rabbet.params, offset: 2 } as any })).toMatch(/edge/)
  })
})

describe('holes', () => {
  test('centered hole note and cut', () => {
    const front = board({ id: 'front', width: 6.5, length: 8, holes: [{ diameter: 1.25, u: 3.25, v: 6 }] })
    const p = project([front])
    expect(jointNotes(p, 'front')).toEqual(['1-1/4" hole, 6" from end, centered'])
    expect(cutGeometry(p)).toEqual([{ boardId: 'front', kind: 'hole', center: { x: 3.25, y: 6, z: 0 }, diameter: 1.25, depth: 0.75 }])
  })
  test('off-center hole note', () => {
    const front = board({ id: 'front', width: 6.5, length: 8, holes: [{ diameter: 0.5, u: 2, v: 3 }] })
    expect(jointNotes(project([front]), 'front')).toEqual(['1/2" hole, 3" from end, 2" from edge'])
  })
})

describe('fastener notes', () => {
  test('pocket screws note on the partner', () => {
    const j: Joint = { id: 'j', type: 'pocketScrew', hostBoardId: 'side', partnerBoardId: 'shelf', params: { count: 2, spacing: 4, screwLength: 1.25 } }
    expect(jointNotes(project([host, shelf], [j]), 'shelf')).toEqual(['2 pocket screws (1-1/4"), 4" apart'])
  })
  test('butt joint notes', () => {
    const screws: Joint = { id: 'j', type: 'butt', hostBoardId: 'side', partnerBoardId: 'shelf', params: { fastener: 'screws', count: 2 } }
    expect(jointNotes(project([host, shelf], [screws]), 'shelf')).toEqual(['Butt joint: 2 screws'])
    const glue: Joint = { ...screws, params: { fastener: 'glue', count: 0 } }
    expect(jointNotes(project([host, shelf], [glue]), 'shelf')).toEqual(['Butt joint: glue'])
  })
})

test('the same rabbet at both ends reads "both ends"', () => {
  const front = board({ id: 'front', width: 6, length: 12 })
  const r = (offset: number): Joint => ({ id: `r${offset}`, type: 'rabbet', hostBoardId: 'front', partnerBoardId: 'shelf', params: { width: 0.75, depth: 0.375, offset, face: 'top' } })
  expect(jointNotes(project([front, shelf], [r(0), r(11.25)]), 'front')).toEqual(['3/4" rabbet × 3/8" deep, both ends'])
  const e = (offset: number): Joint => ({ ...r(offset), params: { width: 0.25, depth: 0.25, offset, face: 'top', along: 'length' } })
  expect(jointNotes(project([front, shelf], [e(0), e(5.75)]), 'front')).toEqual(['1/4" rabbet × 1/4" deep, both edges'])
})

test('identical notes from several joints appear once', () => {
  const other = board({ id: 'other' })
  const j1: Joint = { id: 'a', type: 'butt', hostBoardId: 'side', partnerBoardId: 'shelf', params: { fastener: 'glue', count: 0 } }
  const j2: Joint = { id: 'b', type: 'butt', hostBoardId: 'other', partnerBoardId: 'shelf', params: { fastener: 'glue', count: 0 } }
  expect(jointNotes(project([host, shelf, other], [j1, j2]), 'shelf')).toEqual(['Butt joint: glue'])
})

describe('miters and bevels', () => {
  test('angle notes', () => {
    const both = board({ id: 'r', endCuts: { start: { miter: 45, bevel: 0 }, end: { miter: -45, bevel: 0 } } })
    expect(jointNotes(project([both]), 'r')).toEqual(['45° miter both ends'])
    const one = board({ id: 'r', endCuts: { start: { miter: 45, bevel: 0 }, end: { miter: 0, bevel: 0 } } })
    expect(jointNotes(project([one]), 'r')).toEqual(['45° miter one end'])
    const edge = board({ id: 'r', edgeBevels: { left: 15, right: 0 } })
    expect(jointNotes(project([edge]), 'r')).toEqual(['15° bevel, left edge'])
    const endBevel = board({ id: 'r', endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 30 } } })
    expect(jointNotes(project([endBevel]), 'r')).toEqual(['30° bevel, one end'])
  })
  test('a 45° start miter removes a wedge leaving the short point 2" shorter', () => {
    const rail = board({ id: 'r', width: 2, length: 14, endCuts: { start: { miter: 45, bevel: 0 }, end: { miter: 0, bevel: 0 } } })
    const cuts = cutGeometry(project([rail]))
    expect(cuts).toHaveLength(1)
    const cut = cuts[0]
    expect(cut.kind).toBe('miter')
    expect(pointRemovedBy(cut, { x: 2, y: 1.99, z: 0.3 })).toBe(true)
    expect(pointRemovedBy(cut, { x: 2, y: 2.01, z: 0.3 })).toBe(false)
    expect(pointRemovedBy(cut, { x: 0, y: 0.01, z: 0.3 })).toBe(false)
  })
  test('board validation rejects steep or impossible angles', () => {
    expect(validateBoard(board({ id: 'a', endCuts: { start: { miter: 61, bevel: 0 }, end: { miter: 0, bevel: 0 } } }))).toMatch(/60/)
    expect(validateBoard(board({ id: 'a', width: 2, length: 3, endCuts: { start: { miter: 60, bevel: 0 }, end: { miter: 0, bevel: 0 } } }))).toMatch(/too short/)
    expect(validateBoard(board({ id: 'a' }))).toBeNull()
  })
})
