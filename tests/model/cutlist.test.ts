import { cutList, cutListCsv } from '../../src/model/cutlist'
import type { Joint } from '../../src/model/types'
import { board, project } from './helpers'

test('identical parts group and distinct names join in first-seen order', () => {
  const p = project([
    board({ id: 't', name: 'Top', woodId: 'ply-3-4', thickness: 0.71875, width: 9.78125, length: 29.0625 }),
    board({ id: 'b', name: 'Bottom', woodId: 'ply-3-4', thickness: 0.71875, width: 9.78125, length: 29.0625 }),
    board({ id: 's1', name: 'Shelf', woodId: 'ply-3-4', thickness: 0.71875, width: 9.78125, length: 29.0625 }),
    board({ id: 's2', name: 'Shelf', woodId: 'ply-3-4', thickness: 0.71875, width: 9.78125, length: 29.0625 })
  ])
  const { rows } = cutList(p)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ qty: 4, part: 'Top / Bottom / Shelf', thickness: 0.71875, width: 9.78125, length: 29.0625, woodName: '3/4" Plywood', grain: 'length', notes: [] })
})

test('different notes keep parts apart', () => {
  const front = board({ id: 'f', name: 'Front', width: 6.5, length: 8, holes: [{ diameter: 1.25, u: 3.25, v: 6 }] })
  const back = board({ id: 'k', name: 'Back', width: 6.5, length: 8 })
  expect(cutList(project([front, back])).rows.map(r => r.qty)).toEqual([1, 1])
})

test('different end cuts never group; mitered length is the long point', () => {
  const mitered = board({ id: 'a', name: 'Rail', width: 2, length: 14, endCuts: { start: { miter: 45, bevel: 0 }, end: { miter: -45, bevel: 0 } } })
  const square = board({ id: 'b', name: 'Rail', width: 2, length: 14 })
  const { rows } = cutList(project([mitered, square]))
  expect(rows).toHaveLength(2)
  const m = rows.find(r => r.notes.length)!
  expect(m.length).toBe(14)
  expect(m.notes).toEqual(['45° miter both ends'])
})

test('rows sort by wood name, then thickness desc, then length desc', () => {
  const p = project([
    board({ id: 'a', name: 'A', woodId: 'hw-4-4', length: 10 }),
    board({ id: 'b', name: 'B', woodId: '1x4', thickness: 0.75, width: 3.5, length: 20 }),
    board({ id: 'c', name: 'C', woodId: 'hw-4-4', length: 30 }),
    board({ id: 'd', name: 'D', woodId: 'hw-8-4', thickness: 1.75, length: 5 })
  ])
  expect(cutList(p).rows.map(r => r.part)).toEqual(['B', 'C', 'A', 'D'])
})

test('totals: board feet for solid wood, sheet count for sheet goods, no cost without prices', () => {
  const p = project([
    board({ id: 'a', woodId: '1x6', thickness: 0.75, width: 5.5, length: 96 }),
    board({ id: 's1', woodId: 'ply-3-4', thickness: 0.71875, width: 10, length: 36 }),
    board({ id: 's2', woodId: 'ply-3-4', thickness: 0.71875, width: 10, length: 36 })
  ])
  const { totals } = cutList(p)
  expect(totals.boardFeetByWood).toEqual({ '1x6': 2.75 })
  expect(totals.sheetsByWood).toEqual({ '3/4" Plywood': 1 })
  expect(totals.cost).toBeUndefined()
})

test('sheet estimate rounds up past one sheet', () => {
  const big = Array.from({ length: 3 }, (_, i) => board({ id: `s${i}`, woodId: 'ply-3-4', thickness: 0.71875, width: 24, length: 96 }))
  expect(cutList(project(big)).totals.sheetsByWood).toEqual({ '3/4" Plywood': 2 })
})

test('cost appears only when every used wood has a price', () => {
  const p = project([board({ id: 'a', woodId: '1x6', thickness: 0.75, width: 5.5, length: 96 })])
  p.woods.find(w => w.id === '1x6')!.pricePerBoardFoot = 4
  expect(cutList(p).totals.cost).toBe(11)
  const p2 = project([...p.boards, board({ id: 's', woodId: 'ply-3-4', thickness: 0.71875, width: 10, length: 10 })])
  p2.woods = p.woods
  expect(cutList(p2).totals.cost).toBeUndefined()
  p2.woods.find(w => w.id === 'ply-3-4')!.pricePerSheet = 60
  expect(cutList(p2).totals.cost).toBe(71)
})

test('CSV export', () => {
  const side = board({ id: 's', name: 'Side, left', width: 10, length: 36 })
  const shelf = board({ id: 'h', name: 'Shelf', width: 9, length: 28 })
  const j: Joint = { id: 'j', type: 'dado', hostBoardId: 's', partnerBoardId: 'h', params: { width: 0.75, depth: 0.25, offset: 6, face: 'top' } }
  const csv = cutListCsv(project([side, shelf], [j]))
  const lines = csv.trim().split('\n')
  expect(lines[0]).toBe('Qty,Part,Thickness,Width,Length,Wood,Grain,Notes')
  expect(lines).toContain('1,"Side, left","3/4""","10""","36""",Hardwood 4/4,length,"3/4"" dado × 1/4"" deep, 6"" from end"')
})
