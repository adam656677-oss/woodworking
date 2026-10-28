import { contactBetween, jointOffers } from '../../src/model/contact'
import { cutList } from '../../src/model/cutlist'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate, TEMPLATES, unlock, updateTemplateParams } from '../../src/templates'

const rowsOf = (p: Project) => cutList(p).rows.map(r => ({ qty: r.qty, part: r.part, t: r.thickness, w: r.width, l: r.length }))

describe('box', () => {
  const p = applyTemplate(emptyProject('Box'), 'box')

  test('default cut list (hand-checked)', () => {
    expect(rowsOf(p)).toEqual([
      { qty: 2, part: 'Front / Back', t: 0.75, w: 6, l: 12 },
      { qty: 1, part: 'Bottom', t: 0.75, w: 6.5, l: 10.5 },
      { qty: 2, part: 'Side', t: 0.75, w: 6, l: 6.5 }
    ])
  })

  test('lid adds a 3/4 x 8 x 12 lid', () => {
    const withLid = applyTemplate(emptyProject('Box'), 'box', { lid: true })
    expect(rowsOf(withLid)).toContainEqual({ qty: 1, part: 'Lid', t: 0.75, w: 8, l: 12 })
  })

  test('rabbeted corners: 3/4 wide x 3/8 deep rabbets, sides 7-1/4 long', () => {
    const r = applyTemplate(emptyProject('Box'), 'box', { corners: 'rabbet' })
    expect(rowsOf(r)).toContainEqual({ qty: 2, part: 'Side', t: 0.75, w: 6, l: 7.25 })
    const fb = cutList(r).rows.find(x => x.part === 'Front / Back')!
    expect(fb.qty).toBe(2)
    expect(fb.notes).toContain('3/4" rabbet × 3/8" deep, both ends')
  })
})

describe('bookshelf', () => {
  const p = applyTemplate(emptyProject('Shelf'), 'bookshelf')
  const { rows, totals } = cutList(p)

  test('default cut list (hand-checked)', () => {
    expect(rowsOf(p)).toEqual([
      { qty: 1, part: 'Back', t: 0.21875, w: 29.1875, l: 36 },
      { qty: 2, part: 'Side', t: 0.71875, w: 10, l: 36 },
      { qty: 5, part: 'Top / Bottom / Shelf', t: 0.71875, w: 9.78125, l: 29.0625 }
    ])
  })

  test('sides carry 5 dado notes and the back rabbet note', () => {
    const side = rows.find(r => r.part === 'Side')!
    expect(side.notes.filter(n => n.startsWith('23/32" dado × 1/4" deep'))).toHaveLength(5)
    expect(side.notes).toContain('23/32" dado × 1/4" deep, 3/4" from end')
    expect(side.notes).toContain('7/32" rabbet × 5/16" deep')
  })

  test('one sheet of each plywood', () => {
    expect(totals.sheetsByWood).toEqual({ '3/4" Plywood': 1, '1/4" Plywood': 1 })
  })
})

describe('birdhouse', () => {
  const p = applyTemplate(emptyProject('Bird'), 'birdhouse')

  test('default cut list (hand-checked)', () => {
    const r = rowsOf(p)
    expect(r).toContainEqual({ qty: 1, part: 'Front', t: 0.75, w: 6.5, l: 8 })
    expect(r).toContainEqual({ qty: 1, part: 'Back', t: 0.75, w: 6.5, l: 8 })
    expect(r).toContainEqual({ qty: 2, part: 'Side', t: 0.75, w: 5, l: 8 })
    expect(r).toContainEqual({ qty: 1, part: 'Floor', t: 0.75, w: 5, l: 5 })
    expect(r).toContainEqual({ qty: 1, part: 'Roof', t: 0.75, w: 8.5, l: 8.5 })
    expect(r).toHaveLength(5)
  })

  test('front has the entry hole; joints are butt with 2 screws', () => {
    const front = cutList(p).rows.find(x => x.part === 'Front')!
    expect(front.notes).toContain('1-1/4" hole, 6" from end, centered')
    expect(p.joints.every(j => j.type === 'butt' && (j.params as any).fastener === 'screws' && (j.params as any).count === 2)).toBe(true)
  })
})

test('all three defaults have no warnings', () => {
  for (const t of TEMPLATES) expect(validate(applyTemplate(emptyProject(t.name), t.id))).toEqual([])
})

test('every template joint matches a contact that offers it', () => {
  for (const t of TEMPLATES) {
    for (const opts of [{}, { corners: 'rabbet', lid: true }] as Record<string, string | boolean>[]) {
      const p = applyTemplate(emptyProject(t.name), t.id, opts)
      for (const j of p.joints) {
        const c = contactBetween(p, j.hostBoardId, j.partnerBoardId)
        expect(c, `${t.id} ${j.type} ${j.hostBoardId}-${j.partnerBoardId}`).not.toBeNull()
        expect(c!.host).toBe(j.hostBoardId)
        expect(jointOffers(c!)).toContain(j.type)
      }
    }
  }
})

test('live template regenerates; unlocked does not', () => {
  const live = applyTemplate(emptyProject('Box'), 'box')
  const wider = updateTemplateParams(live, { W: 14 })
  expect(rowsOf(wider)[0]).toEqual({ qty: 2, part: 'Front / Back', t: 0.75, w: 6, l: 14 })

  const unlocked = unlock(wider)
  expect(unlocked.template).toBeUndefined()
  const moved = { ...unlocked, boards: unlocked.boards.map((b, i) => (i === 0 ? { ...b, position: { ...b.position, z: 5 } } : b)) }
  expect(updateTemplateParams(moved, { W: 20 })).toBe(moved)
})

test('out-of-range parameters are clamped and reported', () => {
  const p = applyTemplate(emptyProject('Box'), 'box', { W: 500 })
  expect(p.template!.params.W).toBe(96)
  const s = applyTemplate(emptyProject('Shelf'), 'bookshelf', { shelves: 40 })
  expect(s.template!.params.shelves).toBe(12)
  const z = applyTemplate(emptyProject('Shelf'), 'bookshelf', { shelves: 0 })
  expect(cutList(z).rows.find(r => r.part.startsWith('Top'))!.qty).toBe(2)
})
