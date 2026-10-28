import { KID_WOODS, kidMessage, round8 } from '../../src/kids/kidWords'
import { addBoard } from '../../src/model/ops'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'

test('sizes round to the nearest 1/8", never below 1/8"', () => {
  expect(round8(3.3)).toBe(3.25)
  expect(round8(10.1)).toBe(10.125)
  expect(round8(0.01)).toBe(0.125)
  expect(round8(12)).toBe(12)
})

test('the kids wood list is standard boards and two plywoods', () => {
  expect(KID_WOODS).toEqual(['1x2', '1x3', '1x4', '1x6', '1x8', '1x10', '1x12', 'ply-1-2', 'ply-3-4'])
})

test('a board longer than the stock gets the kid sentence', () => {
  const r = addBoard(emptyProject('K'), { woodId: '1x4', length: 200, name: 'Shelf' })
  const w = validate(r.project).find(x => x.kind === 'exceedsStock')!
  expect(kidMessage(w, r.project)).toBe('Shelf is longer than the longest board you can buy (144") — make it shorter')
})

test('two boards bumping into each other get the kid sentence', () => {
  let p = emptyProject('K')
  p = addBoard(p, { woodId: '1x4', length: 12, name: 'A' }).project
  p = addBoard(p, { woodId: '1x4', length: 12, name: 'B' }).project
  const w = validate(p).find(x => x.kind === 'overlap')!
  expect(kidMessage(w, p)).toBe('A and B are bumping into each other — move one')
})
