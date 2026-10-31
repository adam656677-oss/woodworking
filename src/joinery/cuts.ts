// Cut joints: what each joinery style removes from its two parts, worked out from where the parts are now
// (the overlap the joint made when it lengthened or moved the partner), plus its checks and shop notes.
import { boxInLocal, localAxes, toLocal, worldBox, type Axis, type Box } from '../model/geometry'
import type { BoreCut, Cut, PocketCut, PrismCut } from '../model/joints'
import type { Board, CustomJoint, Joint, JoineryParams, Project, Vec3 } from '../model/types'
import { formatInches } from '../model/units'

const AX: Axis[] = ['x', 'y', 'z']
const UV: Record<Axis, [Axis, Axis]> = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] }
const E = 1e-6
const inch = (n: number) => formatInches(n, { sixtyFourths: true })

export const STYLE_NAMES: Record<JoineryParams['style'], string> = {
  halfLap: 'Half lap', dowel: 'Dowels', biscuit: 'Biscuits', looseTenon: 'Loose tenons', boxJoint: 'Box joint', dovetail: 'Through dovetails',
  halfBlindDovetail: 'Half-blind dovetails', mortiseTenon: 'Mortise and tenon', bridle: 'Bridle joint', tongueGroove: 'Tongue and groove', spline: 'Spline',
  kanawa: 'Kanawa tsugi', okkakeDaisen: 'Okkake daisen tsugi', koshikakeAri: 'Koshikake ari tsugi', kama: 'Kama tsugi', watariAgo: 'Watari ago',
  hozoSashi: 'Hozo sashi (wedged stub tenon)', shachiSen: 'Shachi sen (keyed through tenon)', custom: 'Custom joint'
}

/** A world box clipped to a board and turned into the board's own coordinates. */
function pocket(b: Board, w: Box): PocketCut | null {
  const l = boxInLocal(b, w)
  const min = { x: Math.max(0, l.min.x), y: Math.max(0, l.min.y), z: Math.max(0, l.min.z) }
  const max = { x: Math.min(b.width, l.max.x), y: Math.min(b.length, l.max.y), z: Math.min(b.thickness, l.max.z) }
  if (AX.some(a => max[a] - min[a] <= E)) return null
  // A hair past any face the cut opens onto, so the cut is clean.
  const pad = (a: Axis, lo: number, hi: number, size: number): [number, number] => [lo <= E ? -0.002 : lo, hi >= size - E ? size + 0.002 : hi]
  const [x0, x1] = pad('x', min.x, max.x, b.width), [y0, y1] = pad('y', min.y, max.y, b.length), [z0, z1] = pad('z', min.z, max.z, b.thickness)
  return { boardId: b.id, kind: 'pocket', min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } }
}

/** The local axis of a board lying along a world axis. */
function localAxisOf(b: Board, world: Axis): Axis {
  const a = localAxes(b)
  return a.width.axis === world ? 'x' : a.length.axis === world ? 'y' : 'z'
}

/** A straight-sided shape in world coordinates (polygon in the world axes UV[axis], from–to along `axis`) in a board's coordinates. */
function prism(b: Board, axis: Axis, from: number, to: number, poly: [number, number][]): PrismCut {
  const la = localAxisOf(b, axis)
  const [u, v] = UV[axis], [lu, lv] = UV[la]
  const pt = (pu: number, pv: number, w: number) => toLocal(b, { [u]: pu, [v]: pv, [axis]: w } as unknown as Vec3)
  let lp = poly.map(([pu, pv]) => { const q = pt(pu, pv, from); return [q[lu], q[lv]] as [number, number] })
  // Keep the outline counter-clockwise.
  const area = lp.reduce((s, [x, y], i) => { const [x2, y2] = lp[(i + 1) % lp.length]; return s + x * y2 - x2 * y }, 0)
  if (area < 0) lp = [...lp].reverse()
  const f = pt(poly[0][0], poly[0][1], from)[la], t = pt(poly[0][0], poly[0][1], to)[la]
  // Through the board's faces, a hair past them.
  const size = la === 'x' ? b.width : la === 'y' ? b.length : b.thickness
  const lo = Math.min(f, t), hi = Math.max(f, t)
  return { boardId: b.id, kind: 'prism', axis: la, from: lo <= E ? -0.002 : lo, to: hi >= size - E ? size + 0.002 : hi, poly: lp }
}

function bore(b: Board, at: Vec3, axis: Axis, dirWorld: 1 | -1, diameter: number, depth: number): BoreCut {
  const la = localAxisOf(b, axis)
  const c = toLocal(b, at)
  const ahead = toLocal(b, { ...at, [axis]: at[axis] + dirWorld } as Vec3)
  return { boardId: b.id, kind: 'bore', axis: la, dir: ahead[la] > c[la] ? 1 : -1, center: c, diameter, depth }
}

function intersect(a: Box, b: Box): Box | null {
  const min = { x: Math.max(a.min.x, b.min.x), y: Math.max(a.min.y, b.min.y), z: Math.max(a.min.z, b.min.z) }
  const max = { x: Math.min(a.max.x, b.max.x), y: Math.min(a.max.y, b.max.y), z: Math.min(a.max.z, b.max.z) }
  return AX.every(k => max[k] - min[k] > -1e-9) ? { min, max } : null
}
const vol = (b: Box) => AX.reduce((v, a) => v * Math.max(0, b.max[a] - b.min[a]), 1)
const sub = (b: Box, a: Axis, lo: number, hi: number): Box => ({ min: { ...b.min, [a]: lo }, max: { ...b.max, [a]: hi } })

export type Built = { cuts: Cut[]; notes: { boardId: string; text: string }[]; problem?: string; hardware?: string }
const none = (problem: string): Built => ({ cuts: [], notes: [], problem })

/** The cuts a joinery joint makes on its two parts. */
export function joineryCuts(p: Project, j: Joint): Built {
  const host = p.boards.find(b => b.id === j.hostBoardId), partner = p.boards.find(b => b.id === j.partnerBoardId)
  if (!host || !partner) return none('This joint refers to a part that no longer exists')
  const jp = j.params as JoineryParams
  try {
    const r = BUILD[jp.style](p, host, partner, jp)
    return { ...r, cuts: r.cuts.filter(Boolean) as Cut[] }
  } catch (e) {
    return none((e as Error).message)
  }
}
export const joineryProblem = (p: Project, j: Joint) => joineryCuts(p, j).problem ?? null
export function joineryNotes(p: Project, j: Joint, boardId: string): string[] {
  const b = joineryCuts(p, j)
  return b.notes.filter(n => n.boardId === boardId).map(n => n.text)
}

type Builder = (p: Project, host: Board, partner: Board, jp: JoineryParams) => Built
const fail = (m: string): never => { throw new Error(m) }

/** The region both parts fill (the partner went into the host), and the axis it went in along. */
function overlap(host: Board, partner: Board, along: 'length' | 'width'): { O: Box; L: Axis; inSign: 1 | -1 } {
  const H = worldBox(host), P = worldBox(partner)
  const O = intersect(H, P)
  if (!O || vol(O) < 1e-6) fail(`${partner.name} no longer reaches into ${host.name} — move them back together or remove the joint`)
  const L = localAxes(partner)[along].axis
  // Which way the partner goes into the host along L: away from the partner's body.
  const pMid = (P.min[L] + P.max[L]) / 2, oMid = (O!.min[L] + O!.max[L]) / 2
  return { O: O!, L, inSign: oMid >= pMid ? 1 : -1 }
}

/** Cuts the partner keeps a box `keep` of, inside region R: everything else in R comes off (as up to 6 boxes). */
function allBut(b: Board, R: Box, keep: Box): (PocketCut | null)[] {
  const out: (PocketCut | null)[] = []
  let rest = R
  for (const a of AX) {
    if (keep.min[a] > rest.min[a] + E) out.push(pocket(b, sub(rest, a, rest.min[a], keep.min[a])))
    if (keep.max[a] < rest.max[a] - E) out.push(pocket(b, sub(rest, a, keep.max[a], rest.max[a])))
    rest = sub(rest, a, Math.max(rest.min[a], keep.min[a]), Math.min(rest.max[a], keep.max[a]))
  }
  return out
}

const mortiseTenon: Builder = (p, host, partner, jp) => {
  const { O } = overlap(host, partner, 'length')
  const ax = localAxes(partner)
  const T = ax.thickness.axis, W = ax.width.axis
  const P = worldBox(partner)
  const t = jp.size ?? partner.thickness / 3
  const sh = jp.shoulder ?? 0
  if (t > partner.thickness / 2 + E) fail(`The tenon is thicker than half of ${partner.name} — that leaves weak cheeks; make it about a third`)
  if (2 * sh >= partner.width - E) fail('The shoulders leave no tenon')
  const mid = (P.min[T] + P.max[T]) / 2
  const tenon = sub(sub(O, T, mid - t / 2, mid + t / 2), W, P.min[W] + sh, P.max[W] - sh)
  // The mortise walls must be strong enough.
  const H = worldBox(host)
  const wall = Math.min(tenon.min[T] - H.min[T], H.max[T] - tenon.max[T])
  const notes: Built['notes'] = []
  const dep = O.max[localAxes(partner).length.axis] - O.min[localAxes(partner).length.axis]
  const name = jp.style === 'hozoSashi' ? 'wedged stub tenon' : jp.style === 'shachiSen' ? 'keyed through tenon' : jp.through ? 'through tenon' : 'tenon'
  notes.push({ boardId: partner.id, text: `${name[0].toUpperCase()}${name.slice(1)} ${inch(t)} thick × ${inch(partner.width - 2 * sh)} wide × ${inch(dep)} long${sh ? `, ${inch(sh)} shoulders` : ''}` })
  notes.push({ boardId: host.id, text: `Mortise ${inch(t)} × ${inch(partner.width - 2 * sh)} × ${inch(dep)} deep${jp.through ? ' (through)' : ''} for ${partner.name}` })
  if (jp.style === 'hozoSashi') notes.push({ boardId: partner.id, text: 'Saw two kerfs in the tenon for wedges; flare the far end of the mortise a little so the wedges lock it' })
  if (jp.haunch) notes.push({ boardId: partner.id, text: 'Leave a short haunch at the top of the tenon to fill the panel groove' })
  const cuts: (Cut | null)[] = [pocket(host, tenon), ...allBut(partner, O, tenon)]
  if (wall < 0.1875 - E && wall >= 0) return { cuts: cuts as Cut[], notes, problem: `The mortise walls in ${host.name} are only ${inch(Math.max(0, wall))} — move or thin the tenon` }
  return { cuts: cuts as Cut[], notes }
}

/** Splits the overlap across an axis: the host gives up one part, the partner the other. */
function split(host: Board, partner: Board, O: Box, S: Axis, at: number, hostTakesHigh: boolean): (Cut | null)[] {
  const lo = sub(O, S, O.min[S], at), hi = sub(O, S, at, O.max[S])
  return hostTakesHigh ? [pocket(host, hi), pocket(partner, lo)] : [pocket(host, lo), pocket(partner, hi)]
}

const halfLap: Builder = (p, host, partner, jp) => {
  const H = worldBox(host), P = worldBox(partner)
  const O = intersect(H, P)
  if (!O || vol(O) < 1e-6) fail(`${partner.name} no longer overlaps ${host.name}`)
  // The thinnest direction of the overlap is the one the two halves stack in.
  const S = localAxes(host).thickness.axis
  const pAbove = (P.min[S] + P.max[S]) / 2 >= (H.min[S] + H.max[S]) / 2
  const at = (O!.min[S] + O!.max[S]) / 2
  const notes = [
    { boardId: host.id, text: `Half-lap notch ${inch(O!.max[S] - at)} deep where ${partner.name} crosses` },
    { boardId: partner.id, text: `Half-lap notch ${inch(at - O!.min[S])} deep where ${host.name} crosses` }
  ]
  return { cuts: split(host, partner, O!, S, at, pAbove) as Cut[], notes }
}

const watariAgo: Builder = (p, host, partner, jp) => {
  const H = worldBox(host), P = worldBox(partner)
  const O = intersect(H, P)
  if (!O || vol(O) < 1e-6) fail(`${partner.name} no longer sits down into ${host.name}`)
  // The lower beam keeps a central cog a third of its width; the upper beam is notched over it.
  const W = localAxes(host).width.axis
  const w0 = O!.min[W], w1 = O!.max[W], c = (w0 + w1) / 2, cw = (w1 - w0) / 3
  const cog = sub(O!, W, c - cw / 2, c + cw / 2)
  return {
    cuts: [pocket(host, sub(O!, W, w0, c - cw / 2)), pocket(host, sub(O!, W, c + cw / 2, w1)), pocket(partner, cog)].filter(Boolean) as Cut[],
    notes: [{ boardId: host.id, text: `Watari ago: notch ${inch(O!.max[localAxes(host).thickness.axis] - O!.min[localAxes(host).thickness.axis])} deep each side of a ${inch(cw)} cog for ${partner.name}` },
      { boardId: partner.id, text: `Watari ago: cog slot ${inch(cw)} wide to sit over ${host.name}` }]
  }
}

/** Corner joints where the partner runs through the host's thickness (box, dovetail) or width (bridle, lap). */
function cornerRegion(host: Board, partner: Board) {
  const { O, L, inSign } = overlap(host, partner, 'length')
  const pa = localAxes(partner), ha = localAxes(host)
  // The direction both parts span (the box's height): the axis that is neither part's length nor L.
  const Wd = AX.find(a => a !== L && a !== pa.thickness.axis)!
  return { O, L, inSign, W: Wd, X: pa.thickness.axis, hostAxes: ha }
}

const boxJoint: Builder = (p, host, partner, jp) => {
  const { O, W } = cornerRegion(host, partner)
  const span = O.max[W] - O.min[W]
  let n = jp.count ?? Math.max(3, Math.round(span / (jp.size ?? Math.max(0.25, partner.thickness))))
  if (n % 2 === 0) n += 1
  const fw = span / n
  if (fw < 0.125) fail('The fingers are thinner than 1/8"')
  const cuts: (Cut | null)[] = []
  for (let k = 0; k < n; k++) {
    const r = sub(O, W, O.min[W] + k * fw, O.min[W] + (k + 1) * fw)
    cuts.push(k % 2 === 0 ? pocket(host, r) : pocket(partner, r))
  }
  const note = `${n} fingers, ${inch(fw)} wide`
  return { cuts: cuts as Cut[], notes: [{ boardId: host.id, text: `Box joint: ${note}` }, { boardId: partner.id, text: `Box joint: ${note}` }] }
}

/** Dovetail layout across a width: tails' centres and widths at the baseline (inner) and the end (outer). */
export function dovetailLayout(width: number, depth: number, n: number, pin: number, slope: number): { centres: number[]; tin: number; tout: number } | string {
  const tout = (width - (n + 1) * pin) / n
  const tin = tout - (2 * depth) / slope
  if (tin <= 0.0625) return 'Too many tails for this width — use fewer tails or narrower pins'
  const centres = Array.from({ length: n }, (_, k) => pin + tout / 2 + k * (tout + pin))
  return { centres, tin, tout }
}

const dovetail: Builder = (p, host, partner, jp) => {
  const { O, L, inSign, W, X } = cornerRegion(host, partner)
  const span = O.max[W] - O.min[W]
  const depth = O.max[L] - O.min[L]
  const slope = jp.slope ?? 8
  const pin = jp.size ?? 0.25
  const n = jp.count ?? Math.max(1, Math.round(span / 2.5))
  const lay = dovetailLayout(span, depth, n, pin, slope)
  if (typeof lay === 'string') fail(lay)
  const { centres, tin, tout } = lay as Exclude<typeof lay, string>
  // l runs from the baseline (where the tail board's body is) to the end; w across the width.
  const lIn = inSign > 0 ? O.min[L] : O.max[L], lOut = inSign > 0 ? O.max[L] : O.min[L]
  const [u, v] = UV[X]
  const pt = (w: number, l: number): [number, number] => (u === W ? [O.min[W] + w, l] : [l, O.min[W] + w])
  const tails = centres.map(c => [pt(c - tin / 2, lIn), pt(c + tin / 2, lIn), pt(c + tout / 2, lOut), pt(c - tout / 2, lOut)])
  const edges = [0, ...centres.flatMap(c => [c - tin / 2, c + tin / 2]), span]
  const edgesOut = [0, ...centres.flatMap(c => [c - tout / 2, c + tout / 2]), span]
  const pins: [number, number][][] = []
  for (let k = 0; k < edges.length; k += 2) pins.push([pt(edges[k], lIn), pt(edges[k + 1], lIn), pt(edgesOut[k + 1], lOut), pt(edgesOut[k], lOut)])
  void v
  const cuts: Cut[] = [
    ...tails.map(poly => prism(host, X, O.min[X], O.max[X], poly)),
    ...pins.map(poly => prism(partner, X, O.min[X], O.max[X], poly))
  ]
  const kind = jp.style === 'halfBlindDovetail' ? 'Half-blind dovetails' : 'Through dovetails'
  const lay1 = `${n} tail${n === 1 ? '' : 's'}, 1:${slope} slope, pins ${inch(pin)} at the narrow end, ${inch(depth)} deep`
  return { cuts, notes: [{ boardId: partner.id, text: `${kind} (tails): ${lay1}` }, { boardId: host.id, text: `${kind} (pins): ${lay1}${jp.style === 'halfBlindDovetail' ? `, ${inch(jp.lap ?? 0.1875)} lap left on the face` : ''}` }] }
}

const bridle: Builder = (p, host, partner, jp) => {
  const { O } = overlap(host, partner, 'length')
  const S = localAxes(partner).thickness.axis
  const third = (O.max[S] - O.min[S]) / 3
  const a = O.min[S] + third, b = O.max[S] - third
  const cuts = [pocket(host, sub(O, S, O.min[S], a)), pocket(host, sub(O, S, b, O.max[S])), pocket(partner, sub(O, S, a, b))]
  return { cuts: cuts.filter(Boolean) as Cut[], notes: [{ boardId: partner.id, text: `Bridle: open mortise ${inch(third)} wide in the end` }, { boardId: host.id, text: `Bridle: tenon ${inch(third)} thick on the end (cheeks ${inch(third)})` }] }
}

const tongueGroove: Builder = (p, host, partner, jp) => {
  const { O } = overlap(host, partner, 'width')
  const T = localAxes(partner).thickness.axis
  const t = jp.size ?? partner.thickness / 3
  const mid = (O.min[T] + O.max[T]) / 2
  const tongue = sub(O, T, mid - t / 2, mid + t / 2)
  return {
    cuts: [pocket(host, tongue), ...allBut(partner, O, tongue)].filter(Boolean) as Cut[],
    notes: [{ boardId: host.id, text: `Groove ${inch(t)} wide × ${inch(O.max[localAxes(partner).width.axis] - O.min[localAxes(partner).width.axis])} deep along the edge` }, { boardId: partner.id, text: `Tongue ${inch(t)} thick along the edge` }]
  }
}

/** The patch where two parts touch, the axis across it, and which side each part is on. */
function patch(host: Board, partner: Board): { box: Box; t: Axis; c: number; hostSide: 1 | -1 } {
  const H = worldBox(host), P = worldBox(partner)
  const I = intersect({ min: { x: H.min.x - 1 / 64, y: H.min.y - 1 / 64, z: H.min.z - 1 / 64 }, max: { x: H.max.x + 1 / 64, y: H.max.y + 1 / 64, z: H.max.z + 1 / 64 } }, P)
  if (!I) fail(`${partner.name} no longer touches ${host.name}`)
  // The touch axis: where the overlap is thinnest.
  const t = AX.reduce((m, a) => (I!.max[a] - I!.min[a] < I!.max[m] - I!.min[m] ? a : m), 'x' as Axis)
  const hMid = (H.min[t] + H.max[t]) / 2, pMid = (P.min[t] + P.max[t]) / 2
  const hostSide: 1 | -1 = hMid > pMid ? 1 : -1
  const c = hostSide > 0 ? H.min[t] : H.max[t]
  return { box: I!, t, c, hostSide }
}

/** Positions spaced evenly along the patch's long direction, centred across it. */
function spots(box: Box, t: Axis, n: number, margin: number): { long: Axis; across: Axis; at: number[]; mid: number } {
  const [a, b] = UV[t]
  const long = box.max[a] - box.min[a] >= box.max[b] - box.min[b] ? a : b
  const across = long === a ? b : a
  const len = box.max[long] - box.min[long]
  const m = Math.min(margin, len / (2 * n))
  const at = n === 1 ? [box.min[long] + len / 2] : Array.from({ length: n }, (_, k) => box.min[long] + m + (k * (len - 2 * m)) / (n - 1))
  return { long, across, at, mid: (box.min[across] + box.max[across]) / 2 }
}

const dowel: Builder = (p, host, partner, jp) => {
  const { box, t, c, hostSide } = patch(host, partner)
  const d = jp.size ?? 0.375
  const n = jp.count ?? 2
  const s = spots(box, t, n, 1)
  const thin = Math.min(box.max[s.across] - box.min[s.across], host.thickness, partner.thickness)
  if (d > thin / 2 + E) fail(`A ${inch(d)} dowel is too big for ${inch(thin)} stock — use one no more than half as thick`)
  const H = worldBox(host), P = worldBox(partner)
  const dh = Math.min(jp.depth ?? 1, (H.max[t] - H.min[t]) * 0.75), dp = Math.min(jp.depth ?? 1, (P.max[t] - P.min[t]) * 0.9)
  const cuts: Cut[] = []
  for (const x of s.at) {
    const at = { [t]: c, [s.long]: x, [s.across]: s.mid } as unknown as Vec3
    cuts.push(bore(host, at, t, hostSide, d, dh), bore(partner, at, t, (-hostSide) as 1 | -1, d, dp))
  }
  const hw = `${n} × ${inch(d)} dowels, ${inch(dh + dp - 0.0625)} long`
  return { cuts, hardware: hw, notes: [{ boardId: host.id, text: `${n} × ${inch(d)} dowel holes, ${inch(dh)} deep` }, { boardId: partner.id, text: `${n} × ${inch(d)} dowel holes, ${inch(dp)} deep` }] }
}

const BISCUIT = { '0': { len: 2.125, half: 0.3125, label: '#0' }, '10': { len: 2.375, half: 0.375, label: '#10' }, '20': { len: 2.5, half: 0.4375, label: '#20' } }
const SLOT_T = 5 / 32
function slots(host: Board, partner: Board, n: number, len: number, deep: number, thick: number, margin: number): Cut[] {
  const { box, t, c, hostSide } = patch(host, partner)
  const s = spots(box, t, n, margin)
  const cuts: Cut[] = []
  for (const x of s.at) {
    const r = { min: { ...box.min }, max: { ...box.max } } as Box
    r.min[s.long] = x - len / 2; r.max[s.long] = x + len / 2
    r.min[s.across] = s.mid - thick / 2; r.max[s.across] = s.mid + thick / 2
    const hostR = sub(r, t, hostSide > 0 ? c : c - deep, hostSide > 0 ? c + deep : c)
    const partR = sub(r, t, hostSide > 0 ? c - deep : c, hostSide > 0 ? c : c + deep)
    cuts.push(...[pocket(host, hostR), pocket(partner, partR)].filter(Boolean) as Cut[])
  }
  return cuts
}

const biscuit: Builder = (p, host, partner, jp) => {
  const b = BISCUIT[jp.biscuit ?? '20']
  const n = jp.count ?? 2
  return { cuts: slots(host, partner, n, b.len, b.half, SLOT_T, 2), hardware: `${n} × ${b.label} biscuits`, notes: [host, partner].map(x => ({ boardId: x.id, text: `${n} × ${b.label} biscuit slots` })) }
}

const looseTenon: Builder = (p, host, partner, jp) => {
  const t = jp.size ?? 0.25
  const n = jp.count ?? 1
  const deep = jp.depth ?? 1
  if (t > Math.min(host.thickness, partner.thickness) / 2 + E) fail('The loose tenon is thicker than half the stock')
  return { cuts: slots(host, partner, n, 4 * t, deep, t, 1.5), hardware: `${n} loose tenon${n === 1 ? '' : 's'} ${inch(t)} × ${inch(4 * t)} × ${inch(2 * deep)}`, notes: [host, partner].map(x => ({ boardId: x.id, text: `${n} mortise${n === 1 ? '' : 's'} ${inch(t)} × ${inch(4 * t)} × ${inch(deep)} deep for loose tenons` })) }
}

const spline: Builder = (p, host, partner, jp) => {
  const t = jp.size ?? 0.25
  const deep = jp.depth ?? 0.375
  const { box, t: ax } = patch(host, partner)
  const [a, b] = UV[ax]
  const long = box.max[a] - box.min[a] >= box.max[b] - box.min[b] ? a : b
  const len = box.max[long] - box.min[long]
  return { cuts: slots(host, partner, 1, len, deep, t, 0), hardware: `Spline ${inch(t)} × ${inch(2 * deep - 0.0625)} × ${inch(len)}`, notes: [host, partner].map(x => ({ boardId: x.id, text: `Spline groove ${inch(t)} wide × ${inch(deep)} deep` })) }
}

/** In-line splices: the region where the two beams' ends overlap, with length, width and height axes. */
function splice(host: Board, partner: Board) {
  const { O, L, inSign } = overlap(host, partner, 'length')
  const ha = localAxes(host)
  const W = ha.width.axis, Hh = ha.thickness.axis
  // From the partner's side (where it enters) to its end inside the host.
  const lIn = inSign > 0 ? O.min[L] : O.max[L], lOut = inSign > 0 ? O.max[L] : O.min[L]
  return { O, L, W, H: Hh, lIn, lOut, len: Math.abs(lOut - lIn), dir: inSign }
}
/** Polygon helpers in a plane (a, b) — points given as (along L from lIn as a fraction, across as a fraction). */
function planeShape(L: Axis, B: Axis, O: Box, lIn: number, dir: number, len: number, pts: [number, number][], ext: Axis): [number, number][] {
  const [u] = UV[ext]
  const to = ([f, g]: [number, number]): [number, number] => {
    const l = lIn + dir * f * len, b = O.min[B] + g * (O.max[B] - O.min[B])
    return u === L ? [l, b] : [b, l]
  }
  return pts.map(to)
}

const koshikakeAri: Builder = (p, host, partner) => {
  const s = splice(host, partner)
  const midH = (s.O.min[s.H] + s.O.max[s.H]) / 2
  // Plan view (L, W): the dovetail tenon in the upper half; the lower half is the host's seat.
  const tail: [number, number][] = [[0, 0.35], [0, 0.65], [1, 0.8], [1, 0.2]]
  const left: [number, number][] = [[0, 0], [0, 0.35], [1, 0.2], [1, 0]]
  const right: [number, number][] = [[0, 0.65], [0, 1], [1, 1], [1, 0.8]]
  const shape = (pts: [number, number][]) => planeShape(s.L, s.W, s.O, s.lIn, s.dir, s.len, pts, s.H)
  const [a0, a1] = [midH, s.O.max[s.H]]
  return {
    cuts: [prism(host, s.H, a0, a1, shape(tail)), prism(partner, s.H, a0, a1, shape(left)), prism(partner, s.H, a0, a1, shape(right)),
      pocket(partner, sub(s.O, s.H, s.O.min[s.H], midH))].filter(Boolean) as Cut[],
    notes: [{ boardId: partner.id, text: `Koshikake ari tsugi: dovetail tenon ${inch(s.len)} long on the top half` }, { boardId: host.id, text: `Koshikake ari tsugi: dovetail socket and seat ${inch(s.len)} long` }]
  }
}

const kama: Builder = (p, host, partner) => {
  const s = splice(host, partner)
  // Plan view: a narrow neck, then a wider head, full height.
  const neck = 0.45
  const head: [number, number][] = [[0, 0.38], [neck, 0.38], [neck, 0.22], [1, 0.25], [1, 0.75], [neck, 0.78], [neck, 0.62], [0, 0.62]]
  const left: [number, number][] = [[0, 0], [0, 0.38], [neck, 0.38], [neck, 0.22], [1, 0.25], [1, 0]]
  const right: [number, number][] = [[0, 0.62], [neck, 0.62], [neck, 0.78], [1, 0.75], [1, 1], [0, 1]]
  const shape = (pts: [number, number][]) => planeShape(s.L, s.W, s.O, s.lIn, s.dir, s.len, pts, s.H)
  const [a0, a1] = [s.O.min[s.H], s.O.max[s.H]]
  return {
    cuts: [prism(host, s.H, a0, a1, shape(head)), prism(partner, s.H, a0, a1, shape(left)), prism(partner, s.H, a0, a1, shape(right))],
    notes: [{ boardId: partner.id, text: `Kama tsugi: gooseneck tenon ${inch(s.len)} long` }, { boardId: host.id, text: `Kama tsugi: gooseneck socket ${inch(s.len)} long` }]
  }
}

/**
 * Scarf splices seen from the side (L, H), cut straight across the width. `line` is the partner's lower edge
 * from where it enters (f = 0) to its end (f = 1), as (fraction along, fraction of height): the partner keeps
 * what is above it, the host what is below. A key or pin slot goes through both in the middle.
 */
function scarf(host: Board, partner: Board, line: [number, number][], key: { l: number; h: number; dl: number; dh: number } | null, name: string): Built {
  const s = splice(host, partner)
  const shape = (q: [number, number][]) => planeShape(s.L, s.H, s.O, s.lIn, s.dir, s.len, q, s.W)
  const [w0, w1] = [s.O.min[s.W], s.O.max[s.W]]
  const partnerPart: [number, number][] = [[0, 1], [1, 1], ...[...line].reverse()]
  const hostPart: [number, number][] = [[0, 0], ...line, [1, 0]]
  const cuts: Cut[] = [prism(host, s.W, w0, w1, shape(partnerPart)), prism(partner, s.W, w0, w1, shape(hostPart))]
  if (key) {
    const kb = { min: { ...s.O.min }, max: { ...s.O.max } } as Box
    const lc = s.lIn + s.dir * key.l * s.len
    kb.min[s.L] = lc - (key.dl * s.len) / 2; kb.max[s.L] = lc + (key.dl * s.len) / 2
    const hc = s.O.min[s.H] + key.h * (s.O.max[s.H] - s.O.min[s.H]), hh = (key.dh * (s.O.max[s.H] - s.O.min[s.H])) / 2
    kb.min[s.H] = hc - hh; kb.max[s.H] = hc + hh
    cuts.push(...[pocket(host, kb), pocket(partner, kb)].filter(Boolean) as Cut[])
  }
  return { cuts, notes: [{ boardId: partner.id, text: `${name}: scarf ${inch(s.len)} long` }, { boardId: host.id, text: `${name}: scarf ${inch(s.len)} long${key ? '; cut the key slot through both after fitting' : ''}` }] }
}

// Partner's kept profile in (fraction along, fraction of height): it keeps the top over its own end, stepping down.
const okkakeDaisen: Builder = (p, host, partner) => scarf(host, partner, [[0, 1], [1, 1], [1, 0.3], [0.55, 0.42], [0.55, 0.58], [0, 0.7]], { l: 0.5, h: 0.5, dl: 0.08, dh: 0.9 }, 'Okkake daisen tsugi')
const kanawa: Builder = (p, host, partner) => scarf(host, partner, [[0, 1], [1, 1], [1, 0.25], [0.92, 0.25], [0.92, 0.35], [0.5, 0.42], [0.5, 0.58], [0.08, 0.65], [0.08, 0.75], [0, 0.75]], { l: 0.5, h: 0.5, dl: 0.06, dh: 0.95 }, 'Kanawa tsugi')

const shachiSen: Builder = (p, host, partner, jp) => {
  const r = mortiseTenon(p, host, partner, { ...jp, through: true })
  return { ...r, notes: [...r.notes, { boardId: partner.id, text: 'Cut a key slot across the tenon just outside the post and drive a tapered key to draw the joint tight' }] }
}

/** A joint designed in the joint designer, laid over the overlap. */
const custom: Builder = (p, host, partner, jp) => {
  const cj = (p.customJoints ?? []).find(c => c.id === jp.customId)
  if (!cj) fail('The designed joint is missing from this project')
  const H = worldBox(host), P = worldBox(partner)
  const O = intersect(H, P)
  if (!O || vol(O) < 1e-6) fail(`${partner.name} no longer overlaps ${host.name}`)
  const c = cj as CustomJoint
  // Grid axes: inline — i along the beams, j across the width, k through the thickness; cross — i along the host, j along the partner.
  const ha = localAxes(host), pa = localAxes(partner)
  const I = ha.length.axis, J = c.layout === 'cross' ? pa.length.axis : ha.width.axis, K = AX.find(a => a !== I && a !== J)!
  const n = c.n
  // Cell i = 0 is on the host's side (where its body is), as in the designer.
  const flip = c.layout === 'inline' && H.min[I] >= O!.min[I] - 1e-6
  const cell = (i: number, j: number, k: number) => c.cells[(flip ? n - 1 - i : i) + n * (j + n * k)]
  const cuts: Cut[] = []
  const step = (a: Axis) => (O!.max[a] - O!.min[a]) / n
  for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    // Runs along i of one owner become one cut.
    let i = 0
    while (i < n) {
      const v = cell(i, j, k)
      let e = i
      while (e + 1 < n && cell(e + 1, j, k) === v) e++
      const bx = { min: { ...O!.min }, max: { ...O!.max } } as Box
      bx.min[I] = O!.min[I] + i * step(I); bx.max[I] = O!.min[I] + (e + 1) * step(I)
      bx.min[J] = O!.min[J] + j * step(J); bx.max[J] = O!.min[J] + (j + 1) * step(J)
      bx.min[K] = O!.min[K] + k * step(K); bx.max[K] = O!.min[K] + (k + 1) * step(K)
      const c1 = v === '1' ? pocket(host, bx) : pocket(partner, bx)
      if (c1) cuts.push(c1)
      i = e + 1
    }
  }
  return { cuts, notes: [host, partner].map(x => ({ boardId: x.id, text: `${c.name} (designed joint, ${n}×${n}×${n} grid)` })) }
}

const BUILD: Record<JoineryParams['style'], Builder> = {
  mortiseTenon, hozoSashi: mortiseTenon, shachiSen, halfLap, watariAgo, boxJoint, dovetail, halfBlindDovetail: dovetail, bridle, tongueGroove,
  dowel, biscuit, looseTenon, spline, koshikakeAri, kama, okkakeDaisen, kanawa, custom
}
