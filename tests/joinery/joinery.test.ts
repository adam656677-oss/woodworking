import { emptyProject } from '../../src/model/woods'
import { makeBoard, ORIENT } from '../../src/templates/place'
import { addJoint, removeJoint, updateJoint } from '../../src/model/ops'
import { contactBetween } from '../../src/model/contact'
import { localSolids, volumeAndCentroid } from '../../src/checks/solids'
import { cutGeometry, pointRemovedBy } from '../../src/model/joints'
import { toLocal, worldBox } from '../../src/model/geometry'
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

/** Samples the overlap of two parts: how many points both keep, and how many neither keeps (outside `skip`). */
function balance(q: Project, aId: string, bId: string, skip: (p: { x: number; y: number; z: number }) => boolean = () => false) {
  const cuts = cutGeometry(q)
  const A = q.boards.find(b => b.id === aId)!, B = q.boards.find(b => b.id === bId)!
  const kept = (b: typeof A, w: { x: number; y: number; z: number }) => {
    const l = toLocal(b, w)
    const inside = l.x > 1e-6 && l.y > 1e-6 && l.z > 1e-6 && l.x < b.width - 1e-6 && l.y < b.length - 1e-6 && l.z < b.thickness - 1e-6
    return inside && !cuts.some(c => c.boardId === b.id && pointRemovedBy(c, l, b))
  }
  const a = worldBox(A), b = worldBox(B)
  const lo = { x: Math.max(a.min.x, b.min.x), y: Math.max(a.min.y, b.min.y), z: Math.max(a.min.z, b.min.z) }
  const hi = { x: Math.min(a.max.x, b.max.x), y: Math.min(a.max.y, b.max.y), z: Math.min(a.max.z, b.max.z) }
  let both = 0, neither = 0, n = 0
  const N = Number(process.env.SAMPLES ?? 16)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    const w = { x: lo.x + ((i + 0.5) / N) * (hi.x - lo.x), y: lo.y + ((j + 0.5) / N) * (hi.y - lo.y), z: lo.z + ((k + 0.5) / N) * (hi.z - lo.z) }
    if (skip(w)) continue
    n++
    const ka = kept(A, w), kb = kept(B, w)
    if (ka && kb) both++
    if (!ka && !kb) { neither++; if (process.env.DBG && neither < 6) console.log('neither', w) }
  }
  return { both: both / n, neither: neither / n }
}

test.each(['okkakeDaisen', 'kanawa', 'koshikakeAri', 'kama'] as const)('%s splice: every bit of the overlap belongs to exactly one beam (outside the key slot)', style => {
  const p = base()
  p.woods.push({ ...wood(p, 'hw-4-4'), id: 'beam', name: 'Beam', thickness: 3.5, width: 3.5, builtIn: false })
  const a = makeBoard('A', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 30, y: 0, z: 0 })
  const p0 = { ...p, boards: [a, b] }
  const c = contactBetween(p0, a.id, b.id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style }))
  const A = worldBox(q.boards[0]), B = worldBox(q.boards[1])
  const x0 = Math.max(A.min.x, B.min.x), x1 = Math.min(A.max.x, B.max.x), mid = (x0 + x1) / 2
  // The key slot sits in the middle of the scarf.
  const r = balance(q, a.id, b.id, w => Math.abs(w.x - mid) < (x1 - x0) * 0.06)
  expect(r.both).toBe(0)
  expect(r.neither).toBeLessThan(0.02)
}, 60000)

test('a tenon longer than the post is thick, not through: a problem', () => {
  const p0 = legAndRail()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  const r = addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon', depth: 2.5 })
  expect('error' in r ? r.error : 'added').toMatch(/added|longer than/)
  if (!('error' in r)) {
    const ws = validate(r.project).filter(w => w.kind === 'badJoint').map(w => w.message).join(' ')
    expect(ws).toMatch(/longer than|Through/i)
  }
})

test('loose tenon mortises never run out the far face of thin stock; biscuits that do not fit are refused', () => {
  const p = base()
  const w = wood(p, 'ply-3-4')
  const side = makeBoard('Side', w, 12, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const shelf = makeBoard('Shelf', w, 12, 20, ORIENT.flatX, { x: 0.71875, y: 0, z: 10 })
  const p0 = { ...p, boards: [side, shelf] }
  const c = contactBetween(p0, side.id, shelf.id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'looseTenon' }))
  const host = q.boards.find(b => b.id === q.joints[0].hostBoardId)!
  for (const cut of cutGeometry(q).filter(x => x.boardId === host.id && x.kind === 'pocket')) {
    if (cut.kind !== 'pocket') continue
    // In the host's own axes z is the thickness: the mortise stops inside it.
    expect(cut.max.z - cut.min.z).toBeLessThan(host.thickness * 0.8)
  }
  // A 2-1/2" rail can't take two #20 biscuits.
  const p1 = base()
  const rw = wood(p1, '1x3')
  const stile = makeBoard('Stile', rw, 2.5, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const rail = makeBoard('Rail', rw, 2.5, 20, ORIENT.flatX, { x: 0.75, y: 0, z: 10 })
  const p2 = { ...p1, boards: [stile, rail] }
  const c2 = contactBetween(p2, stile.id, rail.id)
  expect(c2).toBeTruthy()
  if (c2) {
    const r2 = addJoint(p2, 'joinery', c2.host, c2.partner, { style: 'biscuit', count: 2, biscuit: '20' })
    const msg = 'error' in r2 ? r2.error : validate(r2.project).filter(w => w.kind === 'badJoint').map(w => w.message).join(' ')
    expect(msg).toMatch(/biscuit/i)
  }
})

test('a cut joint is not reported as interference (shelf mortise and tenon with shoulders, koshikake splice)', async () => {
  const { interferences } = await import('../../src/checks/solids')
  const p = base()
  const w = wood(p, '1x12')
  const side = makeBoard('Side', w, 11.25, 30, ORIENT.uprightY, { x: 0, y: 0, z: 0 })
  const shelf = makeBoard('Shelf', w, 11.25, 20, ORIENT.flatX, { x: 0.75, y: 0, z: 10 })
  const p0 = { ...p, boards: [side, shelf] }
  const c = contactBetween(p0, side.id, shelf.id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon', shoulder: 1, size: 0.25 }))
  expect(interferences(q).map(x => x.volume)).toEqual([])
  p.woods.push({ ...wood(p, 'hw-4-4'), id: 'beam', name: 'Beam', thickness: 3.5, width: 3.5, builtIn: false })
  const a = makeBoard('A', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 0, y: 0, z: 0 })
  const b = makeBoard('B', wood(p, 'beam'), 3.5, 30, ORIENT.flatX, { x: 30, y: 0, z: 0 })
  const p1 = { ...p, boards: [a, b] }
  const c1 = contactBetween(p1, a.id, b.id)!
  for (const style of ['koshikakeAri', 'okkakeDaisen', 'kanawa', 'kama'] as const) {
    const { project: r } = ok(addJoint(p1, 'joinery', c1.host, c1.partner, { style }))
    expect([style, interferences(r).map(x => x.volume)]).toEqual([style, []])
  }
}, 60000)

test('flat patterns (DXF) show the cut joints on their own layer', async () => {
  const { flatPatterns } = await import('../../src/exchange/flat')
  const { addDrawer, DRAWER_DEFAULTS } = await import('../../src/cabinet/drawers')
  const r = addDrawer(emptyProject('T'), { x: 0, y: 0, z: 0, width: 16, height: 6, depth: 22 }, { ...DRAWER_DEFAULTS, joinery: 'dovetail' })
  if ('error' in r) throw new Error(r.error)
  const dxf = flatPatterns(r.project)
  expect(dxf).toContain('2\nJOINERY')
  expect((dxf.match(/8\nJOINERY/g) ?? []).length).toBeGreaterThan(8)
}, 30000)

test('changing settings keeps them sensible: whole counts, a slope, a lap thinner than the part', () => {
  const p0 = legAndRail()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon' }))
  const id = q.joints[0].id
  const r = updateJoint(q, id, { count: 0, slope: 0, lap: 9, depth: -1 })
  const jp = r.joints[0].params as JoineryParams
  expect(jp.count).toBe(1)
  expect(jp.slope).toBe(2)
  expect(jp.lap).toBeLessThan(q.boards.find(b => b.id === q.joints[0].hostBoardId)!.thickness)
  expect(jp.depth).toBeGreaterThan(0)
  expect('count' in (updateJoint(r, id, { count: undefined }).joints[0].params as object)).toBe(false)
})

test('a haunched tenon: the stub over the top shoulder fills its own socket; the wood is shared out exactly', () => {
  const p0 = legAndRail()
  const c = contactBetween(p0, p0.boards[0].id, p0.boards[1].id)!
  const { project: q } = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon', shoulder: 0.75, haunch: true }))
  const r = balance(q, q.boards[0].id, q.boards[1].id)
  expect(r.both).toBe(0)
  expect(r.neither).toBe(0)
  const plain = ok(addJoint(p0, 'joinery', c.host, c.partner, { style: 'mortiseTenon', shoulder: 0.75 })).project
  const rail = (x: Project) => vols(x).get('Rail')!
  expect(rail(q)).toBeGreaterThan(rail(plain) + 0.01)
}, 30000)
