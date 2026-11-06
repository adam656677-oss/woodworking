import { interferences } from '../../src/checks/solids'
import { hardwareList } from '../../src/cabinet/hardware'
import { addCase, CASE_DEFAULTS, jointsCheckOut, planCase, previewCase, type CaseKind, type CaseSpec, type Construction } from '../../src/generator/caseGenerator'
import { cutList } from '../../src/model/cutlist'
import { worldBox } from '../../src/model/geometry'
import { validate } from '../../src/model/validate'
import { emptyProject } from '../../src/model/woods'
import { applyTemplate } from '../../src/templates'

const rows = (spec: CaseSpec) => {
  const r = previewCase(emptyProject('t'), spec)
  if ('error' in r) throw new Error(r.error)
  return cutList(r.project).rows.map(x => `${x.qty} ${x.part} ${x.thickness} x ${x.width} x ${x.length}`)
}

describe('every kind, construction and shelf mode', () => {
  const kinds: CaseKind[] = ['bookcase', 'base', 'wall']
  const styles: Construction[] = ['dado', 'rabbet', 'screws', 'pocket']
  for (const kind of kinds) for (const construction of styles) for (const shelfMode of ['fixed', 'adjustable'] as const) for (const back of ['ply-1-4', null]) {
    test(`${kind} / ${construction} / ${shelfMode} / ${back ? 'back' : 'no back'}: no overlaps, every joint checks out, no warnings`, () => {
      const r = previewCase(emptyProject('t'), { ...CASE_DEFAULTS[kind], construction, shelfMode, back })
      if ('error' in r) throw new Error(r.error)
      expect(r.warnings).toEqual([])
      expect(jointsCheckOut(r.project)).toBe(true)
      expect(interferences(r.project).map(x => x.volume)).toEqual([])
    })
  }
})

test('bookcase, dados, 2 adjustable shelves: hand-checked cut list', () => {
  // "3/4" plywood is really 23/32 thick and "1/4" is 7/32. 30 wide: inside 30 − 2 × 23/32 = 28-9/16;
  // top and bottom 28-9/16 + 2 × 1/4 dado = 29-1/16 by 11-1/4 − 7/32 = 11-1/32. Back 28-9/16 + 2 × 5/16 = 29-3/16
  // by the full 36. Shelves 28-9/16 − 1/16 = 28-1/2 by 11-1/32 − 1/2 = 10-17/32. The sides are mirror images
  // (pin holes on the inside faces), so they list on two lines.
  expect(rows(CASE_DEFAULTS.bookcase).sort()).toEqual([
    '1 Back 0.21875 x 29.1875 x 36',
    '1 Side 0.71875 x 11.25 x 36',
    '1 Side 0.71875 x 11.25 x 36',
    '2 Bottom / Top 0.71875 x 11.03125 x 29.0625',
    '2 Shelf 0.71875 x 10.53125 x 28.5'
  ].sort())
})

test('base cabinet, screws: sides stand on the toe kick, back overlays, hardware counted', () => {
  const r = previewCase(emptyProject('t'), CASE_DEFAULTS.base)
  if ('error' in r) throw new Error(r.error)
  const part = (n: string) => r.project.boards.filter(b => b.name === n)
  // 24 deep less the 7/32 back that covers the back edges.
  expect(part('Side').map(b => [b.width, b.length])).toEqual([[23.78125, 30.5], [23.78125, 30.5]])
  expect(part('Side').every(b => worldBox(b).min.z === 4)).toBe(true)
  expect(part('Top rail')).toHaveLength(2)
  expect(part('Back')[0].width).toBe(24)
  const hw = hardwareList(r.project).rows.map(x => [x.itemId, x.qty])
  // Bottom + 2 rails into 2 sides (3 each) = 18; back into sides and bottom = 9; 2 kicks × 3 parts × 2 = 12.
  expect(hw).toContainEqual(['screw-8-114', 39])
  expect(hw).toContainEqual(['pin-5mm', 4])
})

test('pocket screws join the shelves from underneath; the hardware list has pocket screws', () => {
  const r = previewCase(emptyProject('t'), { ...CASE_DEFAULTS.bookcase, construction: 'pocket', shelfMode: 'fixed' })
  if ('error' in r) throw new Error(r.error)
  expect(r.project.joints.filter(j => j.type === 'pocketScrew')).toHaveLength(8)
  expect(hardwareList(r.project).rows.find(x => x.itemId === 'pocket-114')?.qty).toBe(24)
})

test('a wall cabinet has a hanging rail and says to screw it into studs', () => {
  const r = previewCase(emptyProject('t'), CASE_DEFAULTS.wall)
  if ('error' in r) throw new Error(r.error)
  expect(r.project.boards.some(b => b.name === 'Hanging rail')).toBe(true)
  expect(r.notes.join(' ')).toContain('studs')
})

test('changing a size changes the parts (the preview follows every setting)', () => {
  const a = rows(CASE_DEFAULTS.bookcase), b = rows({ ...CASE_DEFAULTS.bookcase, W: 36 })
  expect(b).not.toEqual(a)
  expect(b.join()).toContain('x 35')
})

test('a long shelf span warns about sag, in plain words, fixed or adjustable', () => {
  for (const shelfMode of ['fixed', 'adjustable'] as const) {
    const r = previewCase(emptyProject('t'), { ...CASE_DEFAULTS.bookcase, W: 44, shelfMode })
    if ('error' in r) throw new Error(r.error)
    expect([shelfMode, r.warnings.join(' ')]).toEqual([shelfMode, expect.stringMatching(/^Sag: loaded with books/)])
  }
  const ok = previewCase(emptyProject('t'), CASE_DEFAULTS.bookcase)
  expect('error' in ok ? ok.error : ok.warnings).toEqual([])
})

test('impossible settings are refused with a reason, never built', () => {
  const e = (s: Partial<CaseSpec>) => { const r = planCase({ ...CASE_DEFAULTS.bookcase, ...s }, emptyProject('t').woods); return 'error' in r ? r.error : '' }
  expect(e({ W: 2 })).toMatch(/Width/)
  expect(e({ H: 12, shelves: 6 })).toMatch(/shelves/)
  expect(e({ wood: 'nope' })).toMatch(/wood/)
})

test('adding to a design keeps what is there, places the case beside it as one named group', () => {
  const start = applyTemplate(emptyProject('t'), 'box')
  const r = addCase(start, CASE_DEFAULTS.bookcase)
  if ('error' in r) throw new Error(r.error)
  expect(r.project.boards.length).toBe(start.boards.length + 7)
  for (const b of start.boards) expect(r.project.boards.find(x => x.id === b.id)).toEqual(b)
  const boxRight = Math.max(...start.boards.map(b => worldBox(b).max.x))
  const caseBoards = r.project.boards.filter(b => b.groupId === r.groupId)
  expect(Math.min(...caseBoards.map(b => worldBox(b).min.x))).toBeGreaterThan(boxRight)
  expect(r.project.groups?.find(g => g.id === r.groupId)?.name).toBe('Bookcase 1')
  expect(validate(r.project)).toEqual([])
  const again = addCase(r.project, CASE_DEFAULTS.bookcase)
  if ('error' in again) throw new Error(again.error)
  expect(again.project.groups?.find(g => g.id === again.groupId)?.name).toBe('Bookcase 2')
})
