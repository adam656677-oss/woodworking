import { contactBetween, jointOffers } from '../../src/model/contact'
import { cutList } from '../../src/model/cutlist'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate, TEMPLATES, unlock, updateTemplateParams, woodAllowed } from '../../src/templates'

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

test('every template has no warnings at its defaults', () => {
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

// Every setting each template has: defaults, each on/off flipped, each choice, the smallest and largest of every
// number, a middle value of every number, and every wood each wood setting allows.
function variants(t: (typeof TEMPLATES)[number]): Record<string, string | boolean | number>[] {
  const woods = emptyProject('x').woods
  return [
    {},
    ...t.params.filter(p => p.kind === 'bool').map(p => ({ [p.key]: !p.default })),
    ...t.params.filter(p => p.kind === 'choice').flatMap(p => p.options!.map(o => ({ [p.key]: o }))),
    ...t.params.filter(p => p.kind === 'count' || p.kind === 'inches').flatMap(p => [{ [p.key]: p.min! }, { [p.key]: p.max! }, { [p.key]: p.kind === 'count' ? Math.round((p.min! + p.max!) / 2) : Math.round(((p.min! + p.max!) / 2 + 0.37) * 8) / 8 }]),
    ...t.params.filter(p => p.kind === 'wood').flatMap(p => woods.filter(w => woodAllowed(p, w)).map(w => ({ [p.key]: w.id })))
  ]
}

describe('every template', () => {
  test('unlocking keeps every part the same size and place (the formulas rebuild the design exactly)', async () => {
    const { worldBox } = await import('../../src/model/geometry')
    for (const t of TEMPLATES) {
      for (const v of [...variants(t), ...(t.id === 'table' ? [{ D: 23, boards: 3 }] : t.id === 'wallShelf' ? [{ n: 6, H: 31 }] : [])]) {
        const live = applyTemplate(emptyProject(t.name), t.id, v)
        const open = unlock(live)
        expect([t.id, v, open.boards.length]).toEqual([t.id, v, live.boards.length])
        live.boards.forEach((b, i) => {
          const a = worldBox(b), c = worldBox(open.boards[i])
          for (const k of ['x', 'y', 'z'] as const) {
            expect([t.id, v, b.name, k, Math.abs(c.min[k] - a.min[k]) < 1e-6, Math.abs(c.max[k] - a.max[k]) < 1e-6]).toEqual([t.id, v, b.name, k, true, true])
          }
        })
      }
    }
  })
  test('no warnings, and every joint matches a contact that offers it, at every setting', () => {
    for (const t of TEMPLATES) {
      for (const v of variants(t)) {
        const p = applyTemplate(emptyProject(t.name), t.id, v)
        // At extreme sizes a part can honestly be bigger than the stock (that warning teaches); nothing may overlap or
        // fail to join, ever.
        const extreme = Object.keys(v).some(k => { const d = t.params.find(x => x.key === k); return d && (d.kind === 'inches' || d.kind === 'count' || d.kind === 'wood') })
        expect([t.id, v, validate(p).filter(w => !extreme || (w.kind !== 'exceedsStock' && w.kind !== 'sag')).map(w => w.message)]).toEqual([t.id, v, []])
        for (const j of p.joints) {
          const c = contactBetween(p, j.hostBoardId, j.partnerBoardId)
          expect([t.id, v, j.type, !!c && c.host === j.hostBoardId && jointOffers(c).includes(j.type)]).toEqual([t.id, v, j.type, true])
        }
      }
    }
  })
  test('a wood a setting does not allow is replaced by its default', () => {
    const p = applyTemplate(emptyProject('T'), 'table', { legWood: '1x2' })
    expect(p.template!.params.legWood).toBe('hw-8-4')
    const c = applyTemplate(emptyProject('C'), 'cuttingBoard', { wood: '1x6' })
    expect(c.template!.params.wood).toBe('hw-4-4')
  })
  test('the side table lists tabletop fasteners; the cabinet lists shelf pins; rebuilding replaces them', () => {
    const t = applyTemplate(emptyProject('T'), 'table')
    expect(t.hardware!.filter(h => h.itemId === 'tabletop-fastener').reduce((n, h) => n + h.qty, 0)).toBe(8)
    const again = applyTemplate(t, 'table', { W: 30 })
    expect(again.hardware!.filter(h => h.itemId === 'tabletop-fastener')).toHaveLength(4)
    const c = applyTemplate(emptyProject('C'), 'cabinet', { shelf: false })
    expect(c.hardware ?? []).toEqual([])
  })
})
