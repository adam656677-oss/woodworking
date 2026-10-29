import { deserialize, FORMAT_VERSION, serialize } from '../../src/model/fileFormat'
import { addBoard } from '../../src/model/ops'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'

function sample(): Project {
  let p = emptyProject('T')
  const a = addBoard(p, { woodId: '1x6', name: 'A', width: 5.5, length: 20 }); p = a.project
  const b = addBoard(p, { woodId: '1x6', name: 'B', width: 5.5, length: 20, position: { x: 10, y: 0, z: 0 } }); p = b.project
  const c = addBoard(p, { woodId: '1x6', name: 'C', width: 5.5, length: 20, position: { x: 5, y: 0, z: 0 } }); p = c.project
  p.sizes = [{ name: 'W', expr: '30' }, { name: 'Half', expr: 'W/2' }]
  p.boards[0].formulas = { width: 'Half', x: '0' }
  p.joints = []
  p.rules = [
    { id: 'r1', kind: 'spacing', axis: 'x', from: a.id, to: b.id, parts: [c.id] },
    { id: 'r2', kind: 'center', axes: ['y', 'z'], part: c.id, on: a.id },
    { id: 'r3', kind: 'gap', axis: 'x', part: c.id, to: a.id, side: 'max', gap: 0.125, gapExpr: '1/8' },
    { id: 'r4', kind: 'count', expr: 'floor(W/4)', first: c.id, copies: [], axis: 'x', from: a.id, to: b.id }
  ]
  return p
}

test('new projects are the current format', () => {
  expect(FORMAT_VERSION).toBeGreaterThanOrEqual(4)
  expect(emptyProject('X').formatVersion).toBe(FORMAT_VERSION)
})

test('a version 3 file opens unchanged', () => {
  const raw = JSON.parse(serialize(emptyProject('Old')))
  raw.formatVersion = 3
  delete raw.sizes
  expect(deserialize(JSON.stringify(raw)).formatVersion).toBe(FORMAT_VERSION)
})

test('sizes, formulas and every kind of rule round-trip', () => {
  const p = sample()
  p.joints = [{ id: 'j1', type: 'butt', hostBoardId: p.boards[0].id, partnerBoardId: p.boards[1].id, params: { fastener: 'glue', count: 0 }, formulas: { offset: 'W' } }]
  expect(deserialize(serialize(p))).toEqual(p)
})

test.each([
  ['an unknown rule kind', (r: any) => { r.rules[0].kind = 'wobble' }],
  ['a formula that is not text', (r: any) => { r.boards[0].formulas.width = 3 }],
  ['a size without a name', (r: any) => { r.sizes[0].name = 5 }],
  ['a rule with a bad axis', (r: any) => { r.rules[0].axis = 'q' }]
])('%s is refused with the plain message', (_n, damage) => {
  const raw = JSON.parse(serialize(sample()))
  damage(raw)
  expect(() => deserialize(JSON.stringify(raw))).toThrow(/isn't a valid A&A project/)
})

test('a rule pointing at a part that is gone still opens', () => {
  const raw = JSON.parse(serialize(sample()))
  raw.rules[0].from = 'ghost'
  expect(deserialize(JSON.stringify(raw)).rules?.[0]).toMatchObject({ from: 'ghost' })
})
