import type { Board, Joint, Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'

export function board(over: Partial<Board> & { id: string }): Board {
  return {
    name: over.id,
    woodId: 'hw-4-4',
    thickness: 0.75,
    width: 10,
    length: 36,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    grain: 'length',
    holes: [],
    endCuts: { start: { miter: 0, bevel: 0 }, end: { miter: 0, bevel: 0 } },
    edgeBevels: { left: 0, right: 0 },
    ...over
  }
}

export function project(boards: Board[], joints: Joint[] = []): Project {
  return { ...emptyProject('Test'), boards, joints }
}
