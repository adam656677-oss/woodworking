import { addDimension, addNote, dimensionLength, editAnnotation, removeAnnotation } from '../../src/checks/annotations'
import { deserialize, FORMAT_VERSION, serialize } from '../../src/model/fileFormat'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'

const ok = <T,>(r: T | { error: string }): T => { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }

test('dimensions and notes: add, label, edit, delete', () => {
  let p: Project = emptyProject('T')
  expect(addDimension(p, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toEqual({ error: 'Pick two different points' })
  const d = ok(addDimension(p, { x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }))
  p = d.project
  expect(dimensionLength(p.annotations![0] as { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } })).toBe(5)
  expect(addNote(p, { x: 1, y: 1, z: 1 }, '  ')).toEqual({ error: 'Type the note' })
  const n = ok(addNote(p, { x: 1, y: 1, z: 1 }, ' Glue here '))
  p = n.project
  expect(p.annotations![1]).toMatchObject({ kind: 'note', text: 'Glue here' })
  p = ok(editAnnotation(p, d.id, 'Height'))
  expect(p.annotations![0]).toMatchObject({ label: 'Height' })
  p = ok(editAnnotation(p, d.id, ''))
  expect('label' in p.annotations![0]).toBe(false)
  expect(editAnnotation(p, n.id, '')).toEqual({ error: 'Type the note' })
  p = removeAnnotation(removeAnnotation(p, d.id), n.id)
  expect(p.annotations).toBeUndefined()
})

test('files: annotations round-trip; v5 opens as current; damaged ones are refused', () => {
  const p = ok(addNote(ok(addDimension(emptyProject('T'), { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).project, { x: 0, y: 0, z: 0 }, 'Hi')).project
  expect(deserialize(serialize(p)).annotations).toEqual(p.annotations)
  const raw = JSON.parse(serialize(p))
  raw.formatVersion = 5
  expect(deserialize(JSON.stringify(raw)).formatVersion).toBe(FORMAT_VERSION)
  raw.annotations[0].a = 'nowhere'
  expect(() => deserialize(JSON.stringify(raw))).toThrow('a dimension or note is damaged')
})
