// Drawings (sketches): points, lines, arcs, circles, curves and text, with dimensions and constraints. Inches.

export type Pt = { x: number; y: number }

export type SketchPoint = { id: string; x: number; y: number; fixed?: boolean }

export type SketchEntity =
  | { id: string; kind: 'line'; a: string; b: string; construction?: boolean }
  /** Counter-clockwise from start to end around center. */
  | { id: string; kind: 'arc'; center: string; start: string; end: string; construction?: boolean }
  | { id: string; kind: 'circle'; center: string; r: number; construction?: boolean }
  /** A smooth curve passing through its points, in order. */
  | { id: string; kind: 'spline'; points: string[]; construction?: boolean }
  | { id: string; kind: 'text'; at: string; text: string; height: number }

export type ConstraintKind =
  | 'horizontal' | 'vertical' | 'perpendicular' | 'parallel' | 'equal' | 'tangent' | 'concentric'
  | 'coincident' | 'fixed' | 'symmetric'
  | 'distance' | 'hdistance' | 'vdistance' | 'radius' | 'diameter' | 'angle'

/** A rule on the drawing. Dimension kinds carry a `value` (inches, or degrees for angle). */
export type SketchConstraint = { id: string; kind: ConstraintKind; refs: string[]; value?: number }

export type Sketch = {
  id: string
  name: string
  mode: 'precise' | 'freehand'
  points: SketchPoint[]
  entities: SketchEntity[]
  constraints: SketchConstraint[]
}

/** A board's shape: the outer loop and inner loops (cutouts) as entity ids, plus circles that are holes. */
export type Outline = { sketchId: string; outer: string[]; holes: string[][]; circles: string[] }

export const CONSTRAINT_KINDS: ConstraintKind[] = [
  'horizontal', 'vertical', 'perpendicular', 'parallel', 'equal', 'tangent', 'concentric', 'coincident', 'fixed', 'symmetric',
  'distance', 'hdistance', 'vdistance', 'radius', 'diameter', 'angle'
]

export function newSketch(id: string, name: string, mode: Sketch['mode']): Sketch {
  return { id, name, mode, points: [], entities: [], constraints: [] }
}
