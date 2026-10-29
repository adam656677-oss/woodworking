import { localAxes } from '../model/geometry'
import type { Board } from '../model/types'

/** Which end of the board is its top: the higher end when it stands upright, else the start (y = 0) end. */
export function topEnd(b: Board): 'start' | 'end' {
  const l = localAxes(b).length
  return l.axis === 'z' && l.sign > 0 ? 'end' : 'start'
}
