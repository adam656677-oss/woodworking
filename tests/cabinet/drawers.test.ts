import { worldBox } from '../../src/model/geometry'
import { cutList } from '../../src/model/cutlist'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { addDrawer, boxSize, DRAWER_DEFAULTS, SLIDE_NOTE } from '../../src/cabinet/drawers'
import { hardwareList } from '../../src/cabinet/hardware'
import { interferences } from '../../src/checks/solids'
import type { Project } from '../../src/model/types'

const opening = { x: 0, y: 0, z: 0, width: 16, height: 6, depth: 22 }
const rows = (p: Project) => cutList(p).rows.map(r => [r.qty, r.part, r.width, r.length])
function drawer(opts = {}) {
  const r = addDrawer(emptyProject('T'), opening, { ...DRAWER_DEFAULTS, ...opts })
  if ('error' in r) throw new Error(r.error)
  return r.project
}

test('box sizes for each kind of slide in a 16 × 6 × 22 opening', () => {
  expect(boxSize(opening, 'side')).toEqual({ width: 15, height: 5, depth: 20, slide: 20 })
  expect(boxSize(opening, 'under')).toEqual({ width: 15.625, height: 5.1875, depth: 21, slide: 21 })
  expect(boxSize(opening, 'runners')).toEqual({ width: 15.875, height: 5.875, depth: 21 })
  expect(boxSize({ ...opening, depth: 9 }, 'side')).toEqual({ error: 'The opening is too shallow for drawer slides (it needs to be at least 11" deep)' })
})

test('a rabbeted drawer on side-mount slides with a full-overlay face', () => {
  const p = drawer()
  expect(rows(p)).toEqual(expect.arrayContaining([
    [2, 'Drawer side', 5, 20],
    // In 15/32" plywood the bottom groove is 7/32" deep, so the bottom reaches 3/16" into it.
    [1, 'Drawer bottom', 14.4375, 19.4375],
    [2, 'Drawer front / Drawer back', 5, 14.53125],
    [1, 'Drawer face', 17, 7]
  ]))
  expect(validate(p)).toEqual([])
  expect(interferences(p)).toEqual([])
  expect(hardwareList(p).rows.map(r => [r.name, r.qty])).toEqual(expect.arrayContaining([['Side-mount ball-bearing slides 20" (pair)', 1], ['Bar pull 96 mm centres', 1]]))
  expect(p.annotations!.some(a => a.kind === 'note' && a.text.endsWith(SLIDE_NOTE))).toBe(true)
  expect(p.groups![0].motion).toEqual({ kind: 'slide', dir: { x: 0, y: -1, z: 0 }, travel: 20 })
  // The box is centred in the opening.
  const sides = p.boards.filter(b => b.name === 'Drawer side').map(worldBox)
  expect(Math.min(...sides.map(b => b.min.x))).toBe(0.5)
})

test('butt and dado boxes, undermount and runners, inset and no face are all sound', () => {
  for (const joinery of ['butt', 'dado'] as const) for (const slides of ['under', 'runners'] as const) for (const front of ['inset', 'none'] as const) {
    const p = drawer({ joinery, slides, front })
    expect([joinery, slides, front, validate(p).map(w => w.message), interferences(p).length]).toEqual([joinery, slides, front, [], 0])
  }
})
