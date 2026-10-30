import { SPECIES, findSpecies } from '../../src/library/species'
import { movement, sag, stiffnessOf } from '../../src/library/calc'
import { crossGrainWarnings, sagWarnings } from '../../src/library/advice'
import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT, butt } from '../../src/templates/place'
import { applyTemplate, TEMPLATES } from '../../src/templates'
import type { Project } from '../../src/model/types'

test('species data: about 60, every field present, values in range', () => {
  expect(SPECIES.length).toBeGreaterThanOrEqual(55)
  expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
  for (const s of SPECIES) {
    expect(s.density).toBeGreaterThan(15); expect(s.density).toBeLessThan(80)
    expect(s.janka).toBeGreaterThan(200); expect(s.janka).toBeLessThan(4000)
    expect(s.shrinkT).toBeGreaterThan(s.shrinkR)
    expect(s.moe).toBeGreaterThan(0.5); expect(s.moe).toBeLessThan(3.5)
    expect(s.price[0]).toBeLessThan(s.price[1])
    expect(s.colour).toMatch(/^#[0-9a-f]{6}$/)
    for (const f of [s.work, s.finish, s.uses]) expect(f.length).toBeGreaterThan(5)
  }
  expect(findSpecies('Walnut')!.id).toBe('black-walnut')
  expect(findSpecies('red oak')!.id).toBe('red-oak')
})

test('wood movement: the Handbook method (width × coefficient × moisture change)', () => {
  const oak = findSpecies('red oak')!
  // 10" flat-sawn red oak, 6% → 12%: 10 × 0.00369 × 6.
  expect(movement(10, oak, 6, 12).inches).toBeCloseTo(0.2214, 4)
  expect(movement(10, oak, 6, 12, 'quarter').inches).toBeCloseTo(10 * 0.00158 * 6, 4)
  expect(movement(10, oak, 12, 6).inches).toBeCloseTo(-0.2214, 4)
  // Above fibre saturation nothing more happens.
  expect(movement(10, oak, 28, 40).inches).toBe(0)
  expect(movement(10, findSpecies('teak')!, 6, 12).estimated).toBe(true)
})

test('shelf sag against a hand calculation', () => {
  // 36" × 11-1/4" × 3/4" white pine (E 1.24 Mpsi), books 20 lb/ft:
  // w = 1.667 lb/in, I = 11.25 × 0.75³ / 12 = 0.3955 in⁴, δ = 5wL⁴/384EI = 0.0743".
  const r = sag({ span: 36, depth: 11.25, thickness: 0.75, moe: 1.24, lbPerFt: 20 })
  expect(r.inches).toBeCloseTo(0.0743, 3)
  expect(r.limit).toBeCloseTo(0.06, 6)
  expect(r.ok).toBe(false)
  expect(sag({ span: 24, depth: 11.25, thickness: 0.75, moe: 1.24, lbPerFt: 20 }).ok).toBe(true)
})

const p0 = () => emptyProject('T')
function tableTop(woodId: string): Project {
  const p = p0()
  const w = p.woods.find(x => x.id === woodId)!
  // Top: length left to right, width front to back.
  const top = makeBoard('Top', w, 16, 30, ORIENT.flatX, { x: 0, y: 0, z: 10 })
  // A side apron running front to back under the top: its length lies along the top's width.
  const apron = makeBoard('Apron', w, 3, 16, ORIENT.wallY, { x: 1, y: 0, z: 7 })
  apron.length = 16
  return { ...p, boards: [top, apron], joints: [butt(top, apron, { fastener: 'glue', count: 0 })] }
}

test('cross-grain: a glued solid top warns with its movement; plywood does not', () => {
  const hw = p0().woods.find(w => w.kind === 'hardwood')!.id
  const ws = crossGrainWarnings(tableTop(hw))
  expect(ws).toHaveLength(1)
  expect(ws[0].message).toMatch(/Top will move about .* across its 16" width/)
  expect(ws[0].link).toMatchObject({ page: 'movement', width: 16 })
  expect(crossGrainWarnings(tableTop('ply-3-4'))).toHaveLength(0)
})

test('sag: a 36" pine shelf between two sides warns; the bookshelf and the other templates do not', () => {
  const p = p0()
  const pine = p.woods.find(w => w.id === '1x12')!
  const l = makeBoard('Left', pine, 11.25, 20, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const r = makeBoard('Right', pine, 11.25, 20, ORIENT.uprightY, { x: 36.75, y: 0, z: 0 })
  const shelf = makeBoard('Shelf', pine, 11.25, 36, ORIENT.flatX, { x: 0.75, y: 0, z: 10 })
  const q: Project = { ...p, boards: [l, r, shelf], joints: [butt(l, shelf, { fastener: 'screws', count: 2 }), butt(r, shelf, { fastener: 'screws', count: 2 })] }
  const ws = sagWarnings(q)
  expect(ws).toHaveLength(1)
  expect(ws[0].link).toMatchObject({ page: 'sag', span: 36, depth: 11.25 })
  for (const t of TEMPLATES) {
    const d = applyTemplate(p0(), t.id, {})
    expect([...sagWarnings(d), ...crossGrainWarnings(d)].map(w => w.message)).toEqual([])
  }
  expect(stiffnessOf(p.woods.find(w => w.id === 'ply-3-4')!).moe).toBe(1.2)
})
