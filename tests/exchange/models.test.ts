import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'
import { deserialize, serialize } from '../../src/model/fileFormat'
import { addModel, modelBox, packMesh, removeModel, unpackMesh, updateModel } from '../../src/exchange/models'
import { interferences } from '../../src/checks/solids'
import { cutList } from '../../src/model/cutlist'

/** A 10-unit cube as raw triangles. */
function cube(s = 10): Float32Array {
  const c = [[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0], [0, 0, s], [s, 0, s], [s, s, s], [0, s, s]]
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]]
  return new Float32Array(faces.flat().flatMap(i => c[i]))
}

test('meshes pack small and come back exactly', () => {
  const a = cube()
  expect(Array.from(unpackMesh(packMesh(a)))).toEqual(Array.from(a))
})

test('a model in millimetres comes in at its size in inches, low corner at the origin; saved and opened again', () => {
  const r = addModel(emptyProject('T'), 'Box', 'stl', { positions: cube(254).map(v => v + 1000) }, 'mm', { x: 5, y: 0, z: 0 })
  const m = r.project.models![0]
  const b = modelBox(m)
  expect([b.min.x, b.max.x, b.max.z]).toEqual([5, 15, 10])
  const back = deserialize(serialize(r.project))
  expect(back.models).toEqual(r.project.models)
  // Turned and scaled.
  const turned = updateModel(r.project, r.id, { rotation: { x: 0, y: 0, z: 90 }, scale: 2 })
  const tb = modelBox(turned.models![0])
  expect(tb.max.x - tb.min.x).toBeCloseTo(20)
  expect(removeModel(turned, r.id).models).toBeUndefined()
  // A damaged one is dropped when the file opens.
  const bad = JSON.parse(serialize(r.project)); bad.models[0].data = 'nope'
  expect(deserialize(JSON.stringify(bad)).models).toBeUndefined()
})

test('a shelf through a reference model is an interference; left out of the checks it isn\'t; never in the cut list', () => {
  const shelf = applyTemplate(emptyProject('T'), 'bookshelf', {})
  const { template: _t, ...p0 } = shelf
  const rows = cutList(p0).rows
  // A 10" cube sitting in the middle of the bookshelf.
  const q = addModel(p0, 'Microwave', 'stl', { positions: cube() }, 'in', { x: 10, y: 0, z: 10 })
  const hits = interferences(q.project)
  expect(hits.some(h => h.b === q.id)).toBe(true)
  const off = updateModel(q.project, q.id, { noChecks: true })
  expect(interferences(off).some(h => h.b === q.id)).toBe(false)
  expect(cutList(q.project).rows).toEqual(rows)
})
