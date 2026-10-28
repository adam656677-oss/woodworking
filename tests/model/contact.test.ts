import { contactBetween, jointOffers } from '../../src/model/contact'
import { worldBox } from '../../src/model/geometry'
import { board, project } from './helpers'

// A vertical side panel: rotated so its length runs up (world z) and its face looks along world x.
// Local x (width) → world y, local y (length) → world z, local z (thickness) → world x.
const side = board({ id: 'side', thickness: 0.75, width: 10, length: 36, rotation: { x: 90, y: 90, z: 0 } })

test('worldBox of the rotated side', () => {
  const b = worldBox(side)
  expect(b.min).toEqual({ x: 0, y: 0, z: 0 })
  expect(b.max).toEqual({ x: 0.75, y: 10, z: 36 })
})

// A horizontal shelf whose length runs along world x, starting at the side's inner face.
// Rotated -90° about z: length → world +x, width → world -y (so y = 9 puts it at 0..9), thickness → world z.
const shelfAt = (z: number, x = 0.75) => board({ id: 'shelf', thickness: 0.75, width: 9, length: 28, position: { x, y: 9, z }, rotation: { x: 0, y: 0, z: -90 } })

test('shelf end against the side face → endToFace, side is host', () => {
  const c = contactBetween(project([side, shelfAt(10)]), 'side', 'shelf')
  expect(c).toMatchObject({ kind: 'endToFace', host: 'side', partner: 'shelf', nearHostEnd: false })
  expect(jointOffers(c!)).toEqual(['butt', 'dado', 'pocketScrew'])
})

test('shelf within the side thickness of the side end → nearHostEnd adds rabbet', () => {
  const c = contactBetween(project([side, shelfAt(35)]), 'shelf', 'side')
  expect(c).toMatchObject({ kind: 'endToFace', host: 'side', nearHostEnd: true })
  expect(jointOffers(c!)).toEqual(['butt', 'dado', 'pocketScrew', 'rabbet'])
})

test('back panel edge against the side face → edgeToFace', () => {
  // Back panel standing up: width → world x, length → world z, thickness → world -y (y 9.75..10, inside the side's depth).
  const back = board({ id: 'back', thickness: 0.25, width: 28, length: 36, position: { x: 0.75, y: 10, z: 0 }, rotation: { x: 90, y: 0, z: 0 } })
  const c = contactBetween(project([side, back]), 'side', 'back')
  expect(c).toMatchObject({ kind: 'edgeToFace', host: 'side', partner: 'back' })
  expect(jointOffers(c!)).toEqual(['butt', 'dado', 'rabbet'])
})

test('boards stacked face to face → faceToFace', () => {
  const a = board({ id: 'a', width: 4, length: 10 })
  const b = board({ id: 'b', width: 4, length: 10, position: { x: 0, y: 0, z: 0.75 } })
  const c = contactBetween(project([a, b]), 'a', 'b')
  expect(c).toMatchObject({ kind: 'faceToFace' })
  expect(jointOffers(c!)).toEqual(['butt'])
})

test('boards 1/8" apart → no contact', () => {
  expect(contactBetween(project([side, shelfAt(10, 0.875)]), 'side', 'shelf')).toBeNull()
})

test('a non-90° rotation → no contact', () => {
  const tilted = board({ id: 'shelf', rotation: { x: 0, y: 0, z: 30 }, position: { x: 0.75, y: 0, z: 10 } })
  expect(contactBetween(project([side, tilted]), 'side', 'shelf')).toBeNull()
})

describe('corners', () => {
  // Flat picture frame: rails run along world x, stiles along world y, between the rails.
  const rail = board({ id: 'rail', width: 2, length: 14, rotation: { x: 0, y: 0, z: 90 }, position: { x: 14, y: 0, z: 0 } })
  const stile = board({ id: 'stile', width: 2, length: 10, position: { x: 0, y: 2, z: 0 } })

  test('frame corner (end against edge at the other board end) → cornerEnds', () => {
    expect(worldBox(rail).min).toEqual({ x: 0, y: 0, z: 0 })
    expect(worldBox(rail).max).toEqual({ x: 14, y: 2, z: 0.75 })
    const c = contactBetween(project([rail, stile]), 'rail', 'stile')
    expect(c).toMatchObject({ kind: 'cornerEnds', host: 'rail', partner: 'stile', cornerAngle: 90 })
    expect(jointOffers(c!)).toEqual(['butt', 'miter'])
  })

  test('already-mitered corner is still cornerEnds', () => {
    const r = { ...rail, endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 45, bevel: 0 } } }
    const s = { ...stile, position: { x: 0, y: 0, z: 0 }, length: 12, endCuts: { start: { miter: -45, bevel: 0 }, end: { miter: 0, bevel: 0 } } }
    const c = contactBetween(project([r, s]), 'rail', 'stile')
    expect(c).toMatchObject({ kind: 'cornerEnds', cornerAngle: 90 })
  })
})
