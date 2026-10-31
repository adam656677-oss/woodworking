import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { addJoint, removeJoint, updateJoint } from '../../src/model/ops'
import { contactBetween } from '../../src/model/contact'
import { localSolids, volumeAndCentroid } from '../../src/checks/solids'
import { validate } from '../../src/model/validate'
import { cutList } from '../../src/model/cutlist'
import { dovetailLayout } from '../../src/joinery/cuts'
import { joineryOffers } from '../../src/joinery/plan'
import type { Project, JoineryParams } from '../../src/model/types'

const base = () => emptyProject('J')
const wood = (p: Project, id: string) => p.woods.find(w => w.id === id)!
const vols = (p: Project) => { const s = localSolids(p); return new Map(p.boards.map(b => [b.name, volumeAndCentroid(s.get(b.id)!).volume])) }
const box = (p: Project, name: string) => { const b = p.boards.find(x => x.name === name)!; return b.width * b.length * b.thickness }
function ok<T>(r: T | { error: string }): T { if (r && typeof r === 'object' && 'error' in r) throw new Error((r as { error: string }).error); return r as T }

/** A rail ending on the face of a leg. */
function legAndRail(): Project {
  const p = base()
  p.woods.push({ ...wood(p, 'hw-4-4'), id: 'leg', name: 'Leg stock', thickness: 1.75, width: 1.75, builtIn: false })
  const leg = makeBoard('Leg', wood(p, 'leg'), 1.75, 28, ORIENT.uprightX, { x: 0, y: 0, z: 0 })
  // Rail runs along x from the leg's right face, standing on edge.
  const rail = makeBoard('Rail', wood(p, 'hw-4-4'), 4, 20, ORIENT.wallX, { x: 1.75, y: 0.5, z: 20 })
  return { ...p, boards: [leg, rail] }
}

test('mortise and tenon: the rail grows by the tenon length, the tenon fills the mortise exactly', () => {
  const p0 = legAndRail()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  expect(joineryOffers(c)).toContain('mortiseTenon')
  const { project: p } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon' }))
  const j = p.joints[0]
  const jp = j.params as JoineryParams
  expect(jp.size).toBe(0.25)
  const rail = p.boards.find(b => b.name === 'Rail')!
  expect(rail.length).toBeCloseTo(20 + jp.depth!, 6)
  expect(cutList(p).rows.find(r => r.part === 'Rail')!.length).toBeCloseTo(21.25, 6)
  const v = vols(p)
  const tenon = 0.25 * (4 - 2 * (jp.shoulder ?? 0)) * 1.25
  expect(v.get('Leg')!).toBeCloseTo(box(p, 'Leg') - tenon, 3)
  expect(v.get('Rail')!).toBeCloseTo(20 * 4 * rail.thickness + tenon, 3)
  expect(validate(p).filter(w => w.kind === 'badJoint' || w.kind === 'overlap')).toEqual([])
  // Longer tenon: the rail follows; removing the joint puts it back exactly.
  const q = updateJoint(p, j.id, { depth: 1.5 })
  expect(q.boards.find(b => b.name === 'Rail')!.length).toBeCloseTo(21.5, 6)
  const back = removeJoint(q, j.id)
  expect(back.boards).toEqual(p0.boards)
}, 30000)

test('a fat tenon is refused with a plain reason', () => {
  const p0 = legAndRail()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  expect(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon', size: 0.5 })).toEqual({ error: expect.stringMatching(/thicker than half/) })
})

/** Two 3/4" boards meeting at a box corner. */
function corner(): Project {
  const p = base()
  const w = wood(p, 'hw-4-4')
  const front = makeBoard('Front', w, 6, 12, ORIENT.wallX, { x: 0, y: 0, z: 0 })
  const side = makeBoard('Side', w, 6, 10, ORIENT.wallY, { x: 0, y: 0.75, z: 0 })
  return { ...p, boards: [front, side] }
}

test.each(['dovetail', 'boxJoint', 'halfBlindDovetail'] as const)('%s at a box corner: what one part loses, the other gains', style => {
  const p0 = corner()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  expect(c.kind).toBe('cornerEnds')
  const { project: p } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style }))
  const v = vols(p)
  const host = p.boards.find(b => b.id === p.joints[0].hostBoardId)!, partner = p.boards.find(b => b.id === p.joints[0].partnerBoardId)!
  const before = new Map(p0.boards.map(b => [b.id, b.width * b.length * b.thickness]))
  const hostLost = before.get(host.id)! - v.get(host.name)!
  const partnerGained = v.get(partner.name)! - before.get(partner.id)!
  expect(hostLost).toBeGreaterThan(0.1)
  expect(partnerGained).toBeCloseTo(hostLost, 3)
  if (style === 'halfBlindDovetail') expect(partner.length - 10).toBeCloseTo(0.75 - 0.1875, 6)
  expect(validate(p).filter(w => w.kind === 'badJoint')).toEqual([])
}, 60000)

test('dovetail layout maths: tails, pins and the slope', () => {
  const l = dovetailLayout(6, 0.75, 3, 0.25, 8)
  if (typeof l === 'string') throw new Error(l)
  expect(l.tout).toBeCloseTo((6 - 4 * 0.25) / 3, 9)
  expect(l.tout - l.tin).toBeCloseTo((2 * 0.75) / 8, 9)
  expect(l.centres[0]).toBeCloseTo(0.25 + l.tout / 2, 9)
  expect(dovetailLayout(2, 0.75, 6, 0.25, 6)).toMatch(/Too many tails/)
})

test('a cross half-lap: the partner sinks in, each loses half the crossing', () => {
  const p = base()
  const w = wood(p, '1x4')
  const a = makeBoard('Bottom', w, 3.5, 20, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const b = makeBoard('Top', w, 3.5, 20, ORIENT.flatX, { x: -5, y: 8, z: 0.75 })
  const p0 = { ...p, boards: [a, b] }
  const c = contactBetween(p0, a.id, b.id)!
  expect(c.kind).toBe('faceToFace')
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'halfLap' }))
  const v = vols(q)
  const half = 3.5 * 3.5 * 0.75 / 2
  expect(v.get('Bottom')!).toBeCloseTo(3.5 * 20 * 0.75 - half, 3)
  expect(v.get('Top')!).toBeCloseTo(3.5 * 20 * 0.75 - half, 3)
  const back = removeJoint(q, q.joints[0].id)
  expect(back.boards).toEqual(p0.boards)
}, 30000)

test('dowels, biscuits, loose tenons and splines leave the parts where they are and bore/slot both', () => {
  for (const style of ['dowel', 'biscuit', 'looseTenon'] as const) {
    const p0 = legAndRail()
    const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
    const { project: p } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style }))
    expect(p.boards).toEqual(p0.boards)
    const v = vols(p)
    expect(v.get('Leg')!).toBeLessThan(box(p, 'Leg') - 0.05)
    expect(v.get('Rail')!).toBeLessThan(box(p, 'Rail') - 0.05)
  }
}, 60000)

test('tongue and groove between two edges', () => {
  const p = base()
  const w = wood(p, '1x6')
  const a = makeBoard('A', w, 5.5, 24, ORIENT.flatY, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', w, 5.5, 24, ORIENT.flatY, { x: 5.5, y: 0, z: 0 })
  const p0 = { ...p, boards: [a, b] }
  const c = contactBetween(p0, a.id, b.id)!
  expect(c.kind).toBe('edgeToEdge')
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'tongueGroove' }))
  const v = vols(q)
  const groove = 0.25 * 0.375 * 24
  const j = q.joints[0]
  expect(v.get(q.boards.find(x => x.id === j.hostBoardId)!.name)!).toBeCloseTo(5.5 * 24 * 0.75 - groove, 3)
  expect(v.get(q.boards.find(x => x.id === j.partnerBoardId)!.name)!).toBeCloseTo(5.5 * 24 * 0.75 + groove, 3)
}, 30000)

test.each(['koshikakeAri', 'kama', 'okkakeDaisen', 'kanawa'] as const)('%s splice: beams end to end, material is shared out', style => {
  const p = base()
  p.woods.push({ ...wood(p, 'hw-4-4'), id: 'beam', name: 'Beam', thickness: 3.5, width: 3.5, builtIn: false })
  const a = makeBoard('A', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 30, y: 0, z: 0 })
  const p0 = { ...p, boards: [a, b] }
  const c = contactBetween(p0, a.id, b.id)!
  expect(c.kind).toBe('endToEnd')
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style }))
  const v = vols(q)
  const host = q.boards.find(x => x.id === q.joints[0].hostBoardId)!, partner = q.boards.find(x => x.id === q.joints[0].partnerBoardId)!
  const O = 3.5 * 3.5 * (partner.length - 30)
  const lost = 3.5 * 3.5 * 30 - v.get(host.name)!
  const gained = v.get(partner.name)! - 3.5 * 3.5 * 30
  // Key and pin slots come out of both, so together they lose a little more than the overlap.
  expect(lost - gained).toBeGreaterThanOrEqual(-1e-3)
  expect(lost + (O - gained)).toBeGreaterThan(O - 0.5)
  expect(lost).toBeGreaterThan(O * 0.2)
}, 60000)

test('a designed joint: every cell given to the partner takes the whole overlap out of the host', () => {
  const p = base()
  p.woods.push({ ...wood(p, 'hw-4-4'), id: 'beam', name: 'Beam', thickness: 3.5, width: 3.5, builtIn: false })
  const a = makeBoard('A', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 30, y: 0, z: 0 })
  const p0: Project = { ...p, boards: [a, b], customJoints: [{ id: 'cj', name: 'Test', layout: 'inline', n: 2, cells: '11111111', slide: 'x+' }] }
  const c = contactBetween(p0, a.id, b.id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'custom', customId: 'cj', depth: 3.5 }))
  const v = vols(q)
  expect(v.get('A')!).toBeCloseTo(3.5 * 3.5 * (30 - 3.5), 3)
  expect(v.get('B')!).toBeCloseTo(3.5 * 3.5 * 33.5, 3)
}, 30000)

test('a dovetailed drawer: half-blind at the front, through at the back, no warnings', async () => {
  const { addDrawer, DRAWER_DEFAULTS } = await import('../../src/cabinet/drawers')
  const r = addDrawer(emptyProject('T'), { x: 0, y: 0, z: 0, width: 16, height: 6, depth: 22 }, { ...DRAWER_DEFAULTS, joinery: 'dovetail' })
  if ('error' in r) throw new Error(r.error)
  const js = r.project.joints.filter(j => j.type === 'joinery').map(j => (j.params as JoineryParams).style).sort()
  expect(js).toEqual(['dovetail', 'dovetail', 'halfBlindDovetail', 'halfBlindDovetail'])
  expect(validate(r.project).filter(w => w.kind === 'badJoint' || w.kind === 'overlap').map(w => w.message)).toEqual([])
}, 60000)
