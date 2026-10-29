// Joints follow their parts: after formulas and rules move things, each dado or rabbet is measured again
// from where its partner now sits (the same way it was measured when it was made).
import { boxInLocal, worldBox } from '../model/geometry'
import type { GrooveParams, Joint, Project } from '../model/types'
import { snap64 } from '../model/units'

export function reseatGrooves(p: Project): Project {
  let changed = false
  const joints = p.joints.map((j): Joint => {
    if (j.type !== 'dado' && j.type !== 'rabbet') return j
    const host = p.boards.find(b => b.id === j.hostBoardId)
    const partner = p.boards.find(b => b.id === j.partnerBoardId)
    if (!host || !partner) return j
    const g = j.params as GrooveParams
    const along = g.along ?? 'width'
    const pl = boxInLocal(host, worldBox(partner))
    const extent = along === 'width' ? host.length : host.width
    const lo = along === 'width' ? pl.min.y : pl.min.x
    const hi = along === 'width' ? pl.max.y : pl.max.x
    // A partner that has left the host keeps its joint as it was (the design warning says so).
    if (hi <= 1e-9 || lo >= extent - 1e-9) return j
    let offset = lo, width = hi - lo
    if (j.type === 'rabbet') {
      if (lo < extent - hi) { offset = 0; width = hi } else { width = extent - lo; offset = extent - width }
    }
    const f = j.formulas ?? {}
    const next: GrooveParams = {
      ...g,
      offset: f.offset !== undefined ? g.offset : snap64(Math.max(0, offset)),
      width: f.width !== undefined ? g.width : snap64(Math.max(0, width))
    }
    if (next.offset === g.offset && next.width === g.width) return j
    changed = true
    return { ...j, params: next }
  })
  return changed ? { ...p, joints } : p
}
