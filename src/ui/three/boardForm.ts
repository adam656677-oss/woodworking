import { outlinePolygons } from '../../model/shaped'
import type { Board, Project } from '../../model/types'
import { profileRadii, topEnd, turningProblem } from '../../shaping/turning'
import { edgeProblemFor, profileSection } from '../../shaping/edges'
import type { BoardShape } from './BoardMesh'
import type { TurnedLeg } from './turnedGeometry'

/** What a board looks like beyond its rectangle: a drawn outline, or a turned leg (when it can be made). */
export function boardForm(p: Project, b: Board): { shape: BoardShape | null; turned: TurnedLeg | null } {
  const outline = outlinePolygons(p, b)
  const list = b.edges ?? []
  const profiles = list.filter(e => e.sides.includes('outline') && !edgeProblemFor(b, list, e)).map(e => ({ face: e.face, size: e.size, section: profileSection(e.profile, e.size) }))
  const shape = outline ? { ...outline, profiles } : null
  let turned: TurnedLeg | null = null
  if (b.turning && !turningProblem(p, b)) {
    turned = { blank: b.width, length: b.length, top: b.turning.top, bottom: b.turning.bottom, radii: profileRadii(p, b)!, fromStart: topEnd(b) === 'start' }
  }
  return { shape, turned }
}
