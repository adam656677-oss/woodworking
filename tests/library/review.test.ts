// Piece 11 final-review fixes.
import { densityOf } from '../../src/checks/density'
import { findSpecies } from '../../src/library/species'
import { movement } from '../../src/library/calc'
import { crossGrainWarnings, sagWarnings } from '../../src/library/advice'
import { GLUES } from '../../src/library/reference'
import { emptyProject } from '../../src/model/woods'
import { butt, groove, makeBoard, ORIENT } from '../../src/templates/place'
import type { Project } from '../../src/model/types'

test('generic Pine keeps its own density; cherry and ponderosa use the Handbook coefficients; plain yellow glue is for indoors', () => {
  expect(densityOf('Pine').lbPerCuFt).toBe(28)
  expect(findSpecies('pine')).toBeUndefined()
  expect(movement(10, findSpecies('black cherry')!, 6, 12).inches).toBeCloseTo(10 * 0.00248 * 6, 6)
  expect(movement(10, findSpecies('ponderosa pine')!, 6, 12).inches).toBeCloseTo(10 * 0.00216 * 6, 6)
  expect(GLUES[0].water).toMatch(/Not water-resistant/)
})

const p0 = () => emptyProject('T')
const hw = (p: Project) => p.woods.find(w => w.kind === 'hardwood')!

test('a bottom floating in grooves along the sides is not cross-grain', () => {
  const p = p0()
  const w = hw(p)
  const side = makeBoard('Side', w, 4, 16, ORIENT.wallY, { x: 0, y: 0, z: 0 })
  const bottom = makeBoard('Bottom', w, 16, 20, ORIENT.flatX, { x: 0.5, y: 0, z: 0.5 })
  const j = groove('dado', side, bottom, { width: 0.75, depth: 0.25, offset: 0.5, along: 'length' })
  expect(crossGrainWarnings({ ...p, boards: [side, bottom], joints: [j] })).toEqual([])
})

test('a top whose grain runs front to back does not warn against a side apron', () => {
  const p = p0()
  const w = hw(p)
  const top = { ...makeBoard('Top', w, 16, 30, ORIENT.flatX, { x: 0, y: 0, z: 10 }), grain: 'width' as const }
  const apron = makeBoard('Apron', w, 3, 16, ORIENT.wallY, { x: 1, y: 0, z: 7 })
  expect(crossGrainWarnings({ ...p, boards: [top, apron], joints: [butt(top, apron, { fastener: 'glue', count: 0 })] })).toEqual([])
})

function shelfBetween(ups: number[], len: number, extra: (p: Project, s: ReturnType<typeof makeBoard>) => Project = p => p): Project {
  const p = p0()
  const pine = p.woods.find(w => w.id === '1x12')!
  const posts = ups.map((x, i) => makeBoard(`Up ${i}`, pine, 11.25, 20, ORIENT.uprightY, { x, y: 0, z: 0 }))
  const shelf = makeBoard('Shelf', pine, 11.25, len, ORIENT.flatX, { x: 0.75, y: 0, z: 10 })
  return extra({ ...p, boards: [...posts, shelf], joints: posts.map(u => butt(u, shelf, { fastener: 'screws', count: 2 })) }, shelf)
}

test('sag: a centre divider halves the span; an apron along the shelf carries it', () => {
  expect(sagWarnings(shelfBetween([0, 36.75], 36))).toHaveLength(1)
  expect(sagWarnings(shelfBetween([0, 18.375, 36.75], 36))).toEqual([])
  const carried = shelfBetween([0, 36.75], 36, (p, s) => {
    const rail = makeBoard('Rail', p.woods.find(w => w.id === '1x4')!, 3.5, 36, ORIENT.wallX, { x: 0.75, y: 0, z: 6.5 })
    return { ...p, boards: [...p.boards, rail], joints: [...p.joints, butt(s, rail, { fastener: 'screws', count: 4 })] }
  })
  expect(sagWarnings(carried)).toEqual([])
})

test('identical shelves give one warning that names how many', () => {
  const p = shelfBetween([0, 36.75], 36, (q, s) => {
    const s2 = { ...s, id: 's2', name: 'Shelf', position: { ...s.position, z: 15 } }
    return { ...q, boards: [...q.boards, s2], joints: [...q.joints, ...q.boards.filter(b => b.name.startsWith('Up')).map(u => butt(u, s2, { fastener: 'screws', count: 2 }))] }
  })
  const ws = sagWarnings(p)
  expect(ws).toHaveLength(1)
  expect(ws[0].boardIds).toHaveLength(2)
  expect(ws[0].message).toMatch(/Shelf and 1 like it/)
})
