import { cutList } from '../../src/model/cutlist'
import { addBoard, changeWood, duplicateBoards, rotateBoard } from '../../src/model/ops'
import { updateSketch, sketchOf } from '../../src/model/shaped'
import type { Project } from '../../src/model/types'
import { validate } from '../../src/model/validate'
import { emptyProject, findWood } from '../../src/model/woods'
import { MSG_SQUARE, profileRadii, stations, styleProfile, topEnd, turnBoard, unturnBoard } from '../../src/shaping/turning'
import { radiiOf } from '../../src/shaping/turning'

function blankProject(): { p: Project; id: string } {
  const p = emptyProject('T')
  p.woods.push({ ...findWood(p, '2x2')!, id: 'blank175', name: '1-3/4 blank', thickness: 1.75, width: 1.75, builtIn: false })
  const r = addBoard(p, { woodId: 'blank175', name: 'Leg', width: 1.75, length: 29 })
  return { p: r.project, id: r.id }
}
function turned(style: 'taper' | 'beadCove' | 'vase' | 'ballFoot' = 'vase', shoulder: 'crisp' | 'lambsTongue' = 'crisp') {
  const { p, id } = blankProject()
  const r = turnBoard(p, id, { style, top: 5, bottom: 1, shoulder })
  if ('error' in r) throw new Error(r.error)
  return { p: r.project, id, sketchId: r.sketchId }
}

test.each(['taper', 'beadCove', 'vase', 'ballFoot'] as const)('the %s style stays inside a 1-3/4" blank and runs from the pommel to the foot', style => {
  for (const shoulder of ['crisp', 'lambsTongue'] as const) {
    const { p } = turned(style, shoulder)
    const radii = profileRadii(p, p.boards[0])!
    expect(radii).not.toBeNull()
    for (const q of radii) { expect(q.r).toBeGreaterThan(0); expect(q.r).toBeLessThanOrEqual(0.875) }
    expect(radii[0].x).toBeCloseTo(5, 6)
    expect(radii[radii.length - 1].x).toBeCloseTo(28, 6)
  }
})

test('stations include the pommel and foot, no more than 2" apart', () => {
  const { p } = turned('vase')
  const st = stations(p, p.boards[0])
  expect(st[0].at).toBe(5)
  expect(st[st.length - 1].at).toBe(28)
  for (let i = 1; i < st.length; i++) expect(st[i].at - st[i - 1].at).toBeLessThanOrEqual(2 + 1e-9)
  for (const s of st) expect(Math.round(s.diameter * 32)).toBe(s.diameter * 32)
})

test('a board that isn\'t square can\'t be turned; nor wider than the blank', () => {
  const p = emptyProject('T')
  const r = addBoard(p, { woodId: '1x4', name: 'Rail', width: 3.5, length: 20 })
  expect(turnBoard(r.project, r.id, { style: 'taper' })).toEqual({ error: MSG_SQUARE })
  const b = blankProject()
  expect(turnBoard(b.p, b.id, { style: 'taper', maxD: 2 })).toEqual({ error: 'The turning is wider than the blank (max 1-3/4")' })
})

test('a profile edited to have a gap warns, shows square, and the cut list still lists the blank', () => {
  const { p, sketchId } = turned('taper')
  const sk = sketchOf(p, sketchId)!
  const broken = { ...sk, points: sk.points.map(q => (q.id === 'k1' ? { ...q, x: 20 } : q)) }
  const q = updateSketch(p, broken)
  expect(profileRadii(q, q.boards[0])).toBeNull()
  expect(validate(q).map(w => w.message)).toContain("Leg's turning profile must run from the pommel to the foot without gaps")
  expect(cutList(q).rows[0]).toMatchObject({ thickness: 1.75, width: 1.75, length: 29 })
})

test('the cut list notes the turning', () => {
  const { p } = turned()
  expect(cutList(p).rows[0].notes).toContain('Turned — 5" pommel, 1" foot (see turning sheet)')
  const noFoot = turnBoard(blankProject().p, blankProject().id, { style: 'taper', top: 5, bottom: 0 })
  void noFoot
})

test('the top end: a flat board\'s is its start; an upright leg\'s is whichever end is up', () => {
  const { p, id } = blankProject()
  expect(topEnd(p.boards[0])).toBe('start')
  const up = rotateBoard(p, id, 'x', 90)
  expect(topEnd(up.boards[0])).toBe('end')
  const down = rotateBoard(p, id, 'x', -90)
  expect(topEnd(down.boards[0])).toBe('start')
})

test('changing the blank to a stock that isn\'t square warns, and keeps the turning', () => {
  const { p, id } = turned()
  const q = changeWood(p, id, '1x4')
  expect(q.boards[0].turning).toBeDefined()
  expect(validate(q).some(w => /turning needs a square blank/.test(w.message))).toBe(true)
})

test('a duplicated leg shares the profile; un-turning one keeps the drawing for the other', () => {
  const { p, id, sketchId } = turned()
  const d = duplicateBoards(p, [id])
  expect(d.project.boards[1].turning?.sketchId).toBe(sketchId)
  expect(d.project.sketches).toHaveLength(1)
  const one = unturnBoard(d.project, id)
  expect(one.sketches).toHaveLength(1)
  const none = unturnBoard(one, d.ids[0])
  expect(none.sketches).toEqual([])
})

test('a profile that doubles back can\'t be turned', () => {
  const sk = styleProfile({ style: 'taper', length: 29, blank: 1.75, top: 5, bottom: 1, shoulder: 'crisp', maxD: 1.5, minD: 0.75 }, 'k', 'P')
  sk.points.push({ id: 'z1', x: 25, y: 0.5 }, { id: 'z2', x: 15, y: 0.4 })
  sk.entities = sk.entities.map(e => (e.id === 'profile' && e.kind === 'line' ? { ...e, b: 'z1' } : e))
  sk.entities.push({ id: 'back', kind: 'line', a: 'z1', b: 'z2' }, { id: 'on', kind: 'line', a: 'z2', b: 'k1' })
  expect(radiiOf(sk, 29, { top: 5, bottom: 1 })).toBeNull()
})
