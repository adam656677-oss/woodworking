import { deserialize, FORMAT_VERSION, serialize } from '../../src/model/fileFormat'
import { emptyProject } from '../../src/model/woods'
import type { Sketch } from '../../src/sketch/types'

const rect: Sketch = {
  id: 'k1', name: 'Apron', mode: 'precise',
  points: [{ id: 'a', x: 0, y: 0, fixed: true }, { id: 'b', x: 30, y: 0 }, { id: 'c', x: 30, y: 4 }, { id: 'd', x: 0, y: 4 }],
  entities: [
    { id: 'l1', kind: 'line', a: 'a', b: 'b' }, { id: 'l2', kind: 'line', a: 'b', b: 'c' },
    { id: 'l3', kind: 'line', a: 'c', b: 'd' }, { id: 'l4', kind: 'line', a: 'd', b: 'a' }
  ],
  constraints: [{ id: 'k_w', kind: 'distance', refs: ['a', 'b'], value: 30 }]
}

test('the file format is now version 3 (drawings came in 2)', () => {
  expect(FORMAT_VERSION).toBe(3)
  expect(emptyProject('P').formatVersion).toBe(3)
  expect(emptyProject('P').sketches).toEqual([])
})

test('a version 1 file opens, gains an empty drawings list, and keeps everything else', () => {
  const v1 = { ...emptyProject('Old'), formatVersion: 1 } as Record<string, unknown>
  delete v1.sketches
  const p = deserialize(JSON.stringify(v1))
  expect(p.formatVersion).toBe(3)
  expect(p.sketches).toEqual([])
  expect(p.name).toBe('Old')
  expect(p.woods.length).toBe(emptyProject('x').woods.length)
})

test('a drawing and a shaped board round-trip', () => {
  const p = emptyProject('P')
  p.sketches = [rect]
  p.boards = [{
    id: 'b1', name: 'Apron', woodId: '1x6', thickness: 0.75, width: 4, length: 30,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, grain: 'length', holes: [],
    endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } }, edgeBevels: { left: 0, right: 0 },
    outline: { sketchId: 'k1', outer: ['l1', 'l2', 'l3', 'l4'], holes: [], circles: [] }
  }]
  expect(deserialize(serialize(p))).toEqual(p)
})

test.each([
  ['a point that is not a number', (s: Sketch) => { s.points[0].x = NaN as number }],
  ['a line to a point that does not exist', (s: Sketch) => { (s.entities[0] as { b: string }).b = 'zz' }],
  ['an unknown kind of shape', (s: Sketch) => { (s.entities[0] as { kind: string }).kind = 'blob' }]
])('a damaged drawing (%s) is refused with a plain message', (_name, damage) => {
  const p = emptyProject('P')
  const s = structuredClone(rect)
  damage(s)
  p.sketches = [s]
  expect(() => deserialize(JSON.stringify(p).replace('"x":null', '"x":"oops"'))).toThrow(/isn't a valid A&A project/)
})

test('a shaped board pointing at a missing drawing opens as a rectangle; a damaged shape is refused', () => {
  const p = emptyProject('P')
  p.boards = [{
    id: 'b1', name: 'Apron', woodId: '1x6', thickness: 0.75, width: 4, length: 30,
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, grain: 'length', holes: [],
    endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } }, edgeBevels: { left: 0, right: 0 },
    outline: { sketchId: 'gone', outer: ['l1'], holes: [], circles: [] }
  }]
  expect(deserialize(JSON.stringify(p)).boards[0].outline).toBeUndefined()
  ;(p.boards[0] as any).outline = { sketchId: 'gone', outer: 'l1' }
  expect(() => deserialize(JSON.stringify(p))).toThrow(/damaged shape/)
})
