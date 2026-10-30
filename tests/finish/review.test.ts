// Piece 12 final-review fixes.
import { canGoOver } from '../../src/finish/compat'
import { FINISHES } from '../../src/finish/finishes'
import { rankFinishes } from '../../src/finish/select'
import { fromTemplate, scheduleTime, checkSchedule } from '../../src/finish/schedule'
import { emptyProject } from '../../src/model/woods'
import { deserialize, serialize, FORMAT_VERSION } from '../../src/model/fileFormat'

const films = ['oil-poly', 'wipe-poly', 'water-poly', 'nitro', 'precat', 'postcat', 'latex-paint', 'shellac']

test('oils and mineral oil never go over a film finish (shellac included)', () => {
  for (const top of ['blo', 'tung', 'danish', 'hardwax', 'mineral-oil']) for (const under of films) expect([top, under, canGoOver(top, under).answer]).toEqual([top, under, 'no'])
})

test('colour over films: glaze and gel stain yes; pigment stain and dyes no; over a shellac washcoat they work', () => {
  expect(canGoOver('glaze', 'sanding-sealer').answer).toBe('yes')
  expect(canGoOver('glaze', 'oil-poly').answer).toBe('yes')
  expect(canGoOver('gel-stain', 'oil-poly').answer).toBe('yes')
  for (const c of ['oil-stain', 'water-dye', 'solvent-dye']) for (const f of ['oil-poly', 'nitro', 'water-poly']) expect(canGoOver(c, f).answer).toBe('no')
  expect(canGoOver('oil-stain', 'shellac').why).toMatch(/washcoat/)
  expect(canGoOver('grain-filler', 'sanding-sealer').answer).toBe('yes')
})

test('paint over oil colour or a hard film needs a primer; varnish over glaze seals it first', () => {
  for (const u of ['oil-stain', 'gel-stain', 'oil-poly', 'nitro', 'postcat']) expect(canGoOver('latex-paint', u).answer).toBe('barrier')
  expect(canGoOver('latex-paint', 'oil-stain').barrier).toMatch(/primer/)
  expect(canGoOver('oil-poly', 'glaze').answer).toBe('barrier')
  expect(canGoOver('mineral-oil', 'blo').why).not.toMatch(/Catalysed/)
  for (const a of FINISHES) for (const b of FINISHES) expect(canGoOver(a.id, b.id).wait ?? '').not.toMatch(/\b1 hours/)
})

test('schedules: the spray-lacquer stain waits 24 hours; cure counts the slowest finish', () => {
  const sl = fromTemplate('spray-lacquer')
  expect(sl.steps.find(s => s.finishId === 'oil-stain')!.dryHours).toBe(24)
  expect(scheduleTime(fromTemplate('oil-wax')).cureDays).toBe(21)
  expect(scheduleTime(fromTemplate('shellac')).cureDays).toBeGreaterThan(0)
  const bad = { name: 'x', steps: [{ id: 'a', kind: 'topcoat' as const, title: 'A', finishId: 'nope', coats: 1, dryHours: 1 }, { id: 'b', kind: 'topcoat' as const, title: 'B', finishId: 'nitro', coats: 1, dryHours: 1 }] }
  expect(() => checkSchedule(bad)).not.toThrow()
})

test('an unknown finish in a file is cleared; new projects are saved at the current format', () => {
  const p = { ...emptyProject('T'), finish: { name: 'x', steps: [{ id: 'a', kind: 'topcoat' as const, title: 'A', finishId: 'unobtainium', coats: 1, dryHours: 1 }] } }
  const q = deserialize(serialize(p))
  expect(q.finish!.steps[0].finishId).toBeUndefined()
  expect(emptyProject('T').formatVersion).toBe(FORMAT_VERSION)
})

test('selector: food puts oils first; "stays clear" never picks paint', () => {
  const food = rankFinishes(['food', 'durable'], ['wipe', 'brush', 'spray'])
  expect(['oil', 'oil-varnish', 'non-drying', 'wax']).toContain(food[0].finish.base)
  expect(rankFinishes(['clear'], ['brush', 'spray']).some(r => r.finish.base === 'paint-latex')).toBe(false)
})
