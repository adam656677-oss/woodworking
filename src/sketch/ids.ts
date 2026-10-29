import type { Sketch } from './types'

/** Fresh ids (prefix1, prefix2, …) that aren't used anywhere in the drawing. */
export function idMaker(sk: Sketch, prefix: string): () => string {
  const used = new Set([...sk.points.map(p => p.id), ...sk.entities.map(e => e.id), ...sk.constraints.map(c => c.id)])
  let n = 1
  return () => {
    while (used.has(`${prefix}${n}`)) n++
    used.add(`${prefix}${n}`)
    return `${prefix}${n}`
  }
}
