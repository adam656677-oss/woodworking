import { createDrawStore } from '../../src/sketch/drawStore'
import { initSolver } from '../../src/sketch/solver'
import { newSketch } from '../../src/sketch/types'
import { deserialize, serialize } from '../../src/model/fileFormat'
import { emptyProject } from '../../src/model/woods'

beforeAll(async () => { await initSolver() })
const ref = { dataUrl: 'data:image/png;base64,AAAA', x: 0, y: 0, width: 24, height: 12, opacity: 0.5 }

test('the tracing picture stays with the drawing through drawing, undo and saving', () => {
  const s = createDrawStore()
  s.getState().begin(newSketch('k1', 'Chair back', 'precise'), { isNew: true })
  s.getState().replace({ ...s.getState().sketch, reference: ref })
  const [bottom] = s.getState().addRect({ x: 0, y: 0 }, { x: 9.5, y: 3.8 })
  s.getState().addConstraint('distance', [bottom], 10)
  expect(s.getState().sketch.reference).toEqual(ref)
  s.getState().undo()
  expect(s.getState().sketch.reference).toEqual(ref)
  const p = { ...emptyProject('T'), sketches: [s.getState().sketch] }
  expect(deserialize(serialize(p)).sketches![0].reference).toEqual(ref)
  const bad = JSON.parse(serialize(p)); bad.sketches[0].reference = { dataUrl: 'http://x', x: 0 }
  expect(deserialize(JSON.stringify(bad)).sketches![0].reference).toBeUndefined()
})

test('picking points: begin clears it', () => {
  const s = createDrawStore()
  s.getState().begin(newSketch('k1', 'A', 'precise'))
  s.getState().setRefPick([{ x: 1, y: 1 }])
  s.getState().begin(newSketch('k2', 'B', 'precise'))
  expect(s.getState().refPick).toBeNull()
})

test('reference pictures round-trip in the project file; a damaged one is dropped and the design opens', async () => {
  const { addReference } = await import('../../src/shop/references')
  const p = addReference(emptyProject('T'), { name: 'Chair', dataUrl: ref.dataUrl, aspect: 2, plane: 'side' }).project
  expect(deserialize(serialize(p)).references).toEqual(p.references)
  const bad = JSON.parse(serialize(p)); bad.references[0].plane = 'diagonal'
  expect(deserialize(JSON.stringify(bad)).references).toBeUndefined()
})
