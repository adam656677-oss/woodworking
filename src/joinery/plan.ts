// Which cut joints fit how two parts meet, their starting settings, and how the joint changes the parts
// (the partner lengthens into the host, or sinks into it for a lap).
import type { Contact } from '../model/contact'
import { localAxes, worldBox, type Axis } from '../model/geometry'
import type { Board, JoineryParams, JoineryStyle, Project } from '../model/types'
import { snap64 } from '../model/units'

export function joineryOffers(c: Contact): JoineryStyle[] {
  switch (c.kind) {
    case 'endToFace': return ['mortiseTenon', 'dowel', 'looseTenon', 'hozoSashi', 'shachiSen']
    case 'endToEdge': return ['mortiseTenon', 'bridle', 'halfLap', 'dowel', 'looseTenon', 'biscuit']
    case 'edgeToFace': return ['dowel', 'biscuit']
    case 'faceToFace': return ['halfLap', 'watariAgo', 'custom']
    case 'cornerEnds': return c.hostSurface === 'face' ? ['dovetail', 'halfBlindDovetail', 'boxJoint', 'dowel', 'biscuit'] : ['bridle', 'halfLap', 'dowel', 'looseTenon']
    case 'edgeToEdge': return ['tongueGroove', 'spline', 'biscuit', 'dowel']
    case 'endToEnd': return ['koshikakeAri', 'kama', 'okkakeDaisen', 'kanawa', 'custom']
  }
}

const isSoft = (p: Project, b: Board) => p.woods.find(w => w.id === b.woodId)?.kind === 'lumber'
/** How far the host reaches along an axis (its thickness or width, the way the partner goes in). */
const extentAlong = (b: Board, ax: Axis) => { const w = worldBox(b); return w.max[ax] - w.min[ax] }

/** Settings a new joint starts with. */
export function joineryDefaults(p: Project, style: JoineryStyle, host: Board, partner: Board, c: Contact): JoineryParams {
  const L = localAxes(partner).length.axis
  const ext = extentAlong(host, L)
  const T = partner.thickness
  const s16 = (n: number) => Math.max(1 / 16, Math.round(n * 16) / 16)
  switch (style) {
    case 'mortiseTenon': return { style, size: s16(T / 3), depth: snap64(Math.min(1.25, Math.max(0.25, ext - 0.25))), shoulder: c.kind === 'endToEdge' ? snap64(Math.min(0.375, partner.width / 6)) : 0 }
    case 'hozoSashi': return { style, size: s16(T / 3), depth: snap64(Math.max(0.25, ext * 0.6)), shoulder: 0 }
    case 'shachiSen': return { style, size: s16(T / 3), depth: snap64(ext), shoulder: 0, through: true }
    case 'boxJoint': return { style, size: s16(Math.max(0.25, T)) }
    case 'dovetail': return { style, slope: isSoft(p, host) ? 6 : 8, size: 0.25 }
    case 'halfBlindDovetail': return { style, slope: isSoft(p, host) ? 6 : 8, size: 0.25, lap: snap64(Math.max(0.1875, host.thickness / 4)) }
    case 'tongueGroove': return { style, size: s16(T / 3), depth: snap64(Math.min(0.375, host.width / 4)) }
    case 'spline': return { style, size: 0.25, depth: 0.375 }
    case 'dowel': return { style, size: Math.min(0.375, s16(Math.min(host.thickness, partner.thickness) / 2)), count: 2, depth: 1 }
    case 'biscuit': return { style, biscuit: '20' }
    case 'looseTenon': return { style, size: Math.min(0.375, s16(Math.min(host.thickness, partner.thickness) / 3)), count: 1, depth: 1 }
    case 'koshikakeAri': case 'kama': return { style, depth: snap64(1.5 * Math.max(host.thickness, host.width)) }
    case 'okkakeDaisen': case 'kanawa': return { style, depth: snap64(3 * Math.max(host.thickness, host.width)) }
    case 'halfLap': case 'bridle': case 'watariAgo': case 'custom': return { style }
  }
}

/** What the joint changes on the partner: lengthen it into the host (by `extend`), or move it into the host (by `move`). */
export function joineryChange(style: JoineryStyle, jp: JoineryParams, host: Board, partner: Board, c: Contact['kind']): { extend?: { along: 'length' | 'width'; by: number }; move?: number } {
  const L = localAxes(partner).length.axis
  const ext = extentAlong(host, L)
  if (c === 'faceToFace') {
    const m = style === 'watariAgo' ? Math.min(host.thickness, partner.thickness) / 3 : Math.min(host.thickness, partner.thickness)
    return { move: snap64(m) }
  }
  switch (style) {
    case 'mortiseTenon': case 'hozoSashi': return { extend: { along: 'length', by: jp.through ? ext : jp.depth ?? 1 } }
    case 'shachiSen': return { extend: { along: 'length', by: ext } }
    case 'boxJoint': case 'dovetail': case 'bridle': case 'halfLap': return { extend: { along: 'length', by: snap64(ext) } }
    case 'halfBlindDovetail': return { extend: { along: 'length', by: snap64(ext - (jp.lap ?? 0.1875)) } }
    case 'tongueGroove': return { extend: { along: 'width', by: jp.depth ?? 0.375 } }
    case 'koshikakeAri': case 'kama': case 'okkakeDaisen': case 'kanawa': return { extend: { along: 'length', by: jp.depth ?? ext } }
    // A designed in-line joint: a cube-ish overlap as long as the beam is wide or thick.
    case 'custom': return { extend: { along: 'length', by: jp.depth ?? snap64(Math.max(host.width, host.thickness)) } }
    default: return {}
  }
}
