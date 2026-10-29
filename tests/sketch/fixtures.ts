import { newSketch, type Sketch } from '../../src/sketch/types'

/** An arched apron: 30" long, 4" tall at the ends, the bottom arch rising 2" in the middle. */
export function apron(): Sketch {
  const s = newSketch('k1', 'Apron', 'precise')
  s.points = [
    { id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 0, y: 4 }, { id: 'p3', x: 30, y: 4 }, { id: 'p4', x: 30, y: 0 },
    { id: 'c', x: 15, y: 2 - 57.25 }
  ]
  s.entities = [
    { id: 'e1', kind: 'line', a: 'p1', b: 'p2' },
    { id: 'e2', kind: 'line', a: 'p2', b: 'p3' },
    { id: 'e3', kind: 'line', a: 'p3', b: 'p4' },
    { id: 'e4', kind: 'arc', center: 'c', start: 'p4', end: 'p1' }
  ]
  return s
}

