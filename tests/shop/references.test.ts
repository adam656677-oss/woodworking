import { emptyProject } from '../../src/model/woods'
import { addReference, removeReference, scaleBetween, scaleReference, updateReference, uvAt, worldAt } from '../../src/shop/references'

const pic = 'data:image/png;base64,AAAA'

test('a picture is added 24" wide, keeping its shape, on the plane asked for', () => {
  const r = addReference(emptyProject('T'), { name: 'Chair', dataUrl: pic, aspect: 2, plane: 'front' })
  const ref = r.project.references![0]
  expect(ref).toMatchObject({ id: r.id, name: 'Chair', plane: 'front', width: 24, height: 12, opacity: 0.6 })
})

test('scaling from two points makes that distance true, keeping the low corner', () => {
  let p = addReference(emptyProject('T'), { name: 'A', dataUrl: pic, aspect: 1, plane: 'front' }).project
  const id = p.references![0].id
  p = updateReference(p, id, { position: { x: 5, y: 0, z: 2 } })
  // Two points a quarter of the picture apart across: 6" now; really 30".
  const r = scaleReference(p, id, { u: 0.25, v: 0.5 }, { u: 0.5, v: 0.5 }, 30)
  if ('error' in r) throw new Error(r.error)
  const ref = r.references![0]
  expect([ref.width, ref.height]).toEqual([120, 120])
  expect(ref.position).toEqual({ x: 5, y: 0, z: 2 })
  expect(scaleReference(p, id, { u: 0.2, v: 0.2 }, { u: 0.2, v: 0.2 }, 10)).toEqual({ error: 'Pick two different points on the picture' })
  expect(scaleReference(p, id, { u: 0, v: 0 }, { u: 1, v: 0 }, 0)).toEqual({ error: 'Type the real distance between the two points' })
})

test('points on each plane map to the picture and back', () => {
  for (const plane of ['front', 'side', 'top'] as const) {
    let p = addReference(emptyProject('T'), { name: 'A', dataUrl: pic, aspect: 2, plane }).project
    const id = p.references![0].id
    p = updateReference(p, id, { position: { x: 1, y: 2, z: 3 } })
    const ref = p.references![0]
    const w = worldAt(ref, { u: 0.5, v: 0.25 })
    const back = uvAt(ref, w)
    expect(back.u).toBeCloseTo(0.5)
    expect(back.v).toBeCloseTo(0.25)
  }
  const ref = addReference(emptyProject('T'), { name: 'A', dataUrl: pic, aspect: 2, plane: 'front' }).project.references![0]
  expect(worldAt(ref, { u: 1, v: 1 })).toEqual({ x: 24, y: 0, z: 12 })
})

test('removing a picture', () => {
  const r = addReference(emptyProject('T'), { name: 'A', dataUrl: pic, aspect: 1, plane: 'top' })
  expect(removeReference(r.project, r.id).references).toBeUndefined()
})

test('the drawing board scales its picture the same way (2D)', () => {
  const ref = { dataUrl: pic, x: 0, y: 0, width: 10, height: 5, opacity: 0.5 }
  const s = scaleBetween(ref, { x: 2, y: 1 }, { x: 4, y: 1 }, 5)
  if ('error' in s) throw new Error(s.error)
  expect(s).toMatchObject({ x: 0, y: 0, width: 25, height: 12.5 })
})
