import { BUILTIN_WOODS, boardFeet, emptyProject, findWood } from '../../src/model/woods'
import { newId } from '../../src/model/ids'

const byId = (id: string) => BUILTIN_WOODS.find(w => w.id === id)!

test('dimensional lumber at actual sizes', () => {
  const widths: Record<string, number> = { '1x2': 1.5, '1x3': 2.5, '1x4': 3.5, '1x6': 5.5, '1x8': 7.25, '1x10': 9.25, '1x12': 11.25 }
  for (const [id, w] of Object.entries(widths)) {
    expect(byId(id)).toMatchObject({ kind: 'lumber', thickness: 0.75, width: w, length: 144, availableLengths: [96, 120, 144] })
  }
  expect(byId('2x2')).toMatchObject({ thickness: 1.5, width: 1.5, length: 144 })
  expect(byId('2x4')).toMatchObject({ thickness: 1.5, width: 3.5, length: 144 })
  expect(byId('2x6')).toMatchObject({ thickness: 1.5, width: 5.5, length: 144 })
})

test('hardwood boards by quarter thickness', () => {
  expect(byId('hw-4-4')).toMatchObject({ kind: 'hardwood', species: 'Hardwood', thickness: 0.75, width: 12, length: 144 })
  expect(byId('hw-5-4')).toMatchObject({ thickness: 1.0 })
  expect(byId('hw-8-4')).toMatchObject({ thickness: 1.75 })
})

test('sheet goods are 48 x 96 at real thicknesses', () => {
  const t: Record<string, number> = { 'ply-1-4': 0.21875, 'ply-1-2': 0.46875, 'ply-3-4': 0.71875, 'mdf-1-2': 0.5, 'mdf-3-4': 0.75 }
  for (const [id, th] of Object.entries(t)) {
    expect(byId(id)).toMatchObject({ kind: 'sheet', thickness: th, width: 48, length: 96 })
  }
})

test('the built-in list is exactly the spec set', () => {
  expect(BUILTIN_WOODS.map(w => w.id).sort()).toEqual([
    '1x10', '1x12', '1x2', '1x3', '1x4', '1x6', '1x8', '2x2', '2x4', '2x6',
    'hw-4-4', 'hw-5-4', 'hw-8-4', 'mdf-1-2', 'mdf-3-4', 'ply-1-2', 'ply-1-4', 'ply-3-4'
  ].sort())
  expect(BUILTIN_WOODS.every(w => w.builtIn)).toBe(true)
})

test('board feet = T x W x L / 144', () => {
  expect(boardFeet(0.75, 5.5, 96)).toBe(2.75)
})

test('emptyProject deep-copies the wood library', () => {
  const p = emptyProject('X')
  expect(p).toMatchObject({ formatVersion: 2, sketches: [], name: 'X', units: 'in', boards: [], joints: [] })
  p.woods[0].width = 999
  expect(BUILTIN_WOODS[0].width).not.toBe(999)
  expect(findWood(p, '1x4')?.width).toBe(3.5)
  expect(findWood(p, 'nope')).toBeUndefined()
})

test('newId makes unique prefixed ids', () => {
  const a = newId('b')
  const b = newId('b')
  expect(a).toMatch(/^b_/)
  expect(a).not.toBe(b)
})
