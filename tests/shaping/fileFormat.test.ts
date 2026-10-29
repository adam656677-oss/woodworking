import { deserialize, FORMAT_VERSION, serialize } from '../../src/model/fileFormat'
import { addBoard } from '../../src/model/ops'
import { addSketch } from '../../src/model/shaped'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { newSketch } from '../../src/sketch/types'

function leg(): Project {
  let p = addSketch(emptyProject('T'), newSketch('k1', 'Leg profile', 'precise'))
  const r = addBoard(p, { woodId: '2x2', name: 'Leg', width: 1.5, length: 29 })
  p = r.project
  p.boards[0] = {
    ...p.boards[0],
    turning: { sketchId: 'k1', style: 'vase', top: 5, bottom: 1, shoulder: 'crisp' },
    taper: { faces: ['left', 'top'], start: 6, foot: 0.875 },
    edges: [{ id: 'x1', profile: 'roundover', size: 0.25, face: 'top', sides: ['start'] }]
  }
  return p
}

test('projects are format 3', () => {
  expect(FORMAT_VERSION).toBe(3)
  expect(emptyProject('X').formatVersion).toBe(3)
})

test('a version 2 file opens unchanged', () => {
  const raw = JSON.parse(serialize(emptyProject('Old')))
  raw.formatVersion = 2
  const p = deserialize(JSON.stringify(raw))
  expect(p.formatVersion).toBe(3)
})

test('turning, taper and edges round-trip', () => {
  const p = leg()
  expect(deserialize(serialize(p))).toEqual(p)
})

test.each([
  ['taper face', (p: any) => { p.boards[0].taper.faces = ['x'] }],
  ['edge size', (p: any) => { p.boards[0].edges[0].size = -1 }],
  ['edge profile', (p: any) => { p.boards[0].edges[0].profile = 'blob' }],
  ['turning top', (p: any) => { p.boards[0].turning.top = '5' }],
  ['turning style', (p: any) => { p.boards[0].turning.style = 'spiral' }]
])('a damaged %s is refused with the plain message', (_n, damage) => {
  const raw = JSON.parse(serialize(leg()))
  damage(raw)
  expect(() => deserialize(JSON.stringify(raw))).toThrow(/isn't a valid A&A project/)
})

test('a turning whose drawing is missing is dropped (the leg is a square blank)', () => {
  const raw = JSON.parse(serialize(leg()))
  raw.sketches = []
  expect(deserialize(JSON.stringify(raw)).boards[0].turning).toBeUndefined()
})

test('a newer format says so', () => {
  const raw = JSON.parse(serialize(emptyProject('X')))
  raw.formatVersion = 4
  expect(() => deserialize(JSON.stringify(raw))).toThrow(/newer version/)
})
