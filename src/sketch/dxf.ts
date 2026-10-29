// DXF R12 (ASCII) for CNC routers and laser cutters. Inches.
import { arcAngles, outlineFromSketch, pointOf, tessellateEntity } from './geometry'
import type { Sketch, SketchEntity } from './types'

const n = (v: number) => String(Math.round(v * 1e6) / 1e6 + 0)
const pair = (code: number, v: string | number) => `${code}\n${typeof v === 'number' ? n(v) : v}`

/** Which layer each shape goes on: the part's outline, its cutouts and holes, or text. */
export function layersOf(sk: Sketch): Map<string, 'OUTLINE' | 'CUTOUTS' | 'TEXT'> {
  const m = new Map<string, 'OUTLINE' | 'CUTOUTS' | 'TEXT'>()
  const r = outlineFromSketch(sk)
  const cut = new Set('error' in r ? [] : [...r.outline.holes.flat(), ...r.outline.circles])
  for (const e of sk.entities) {
    if ('construction' in e && e.construction) continue
    m.set(e.id, e.kind === 'text' ? 'TEXT' : cut.has(e.id) ? 'CUTOUTS' : 'OUTLINE')
  }
  return m
}

const deg = (r: number) => (r * 180) / Math.PI

function entity(sk: Sketch, e: SketchEntity, layer: string): string[] {
  const P = (id: string) => pointOf(sk, id)
  switch (e.kind) {
    case 'line': {
      const a = P(e.a), b = P(e.b)
      return ['0\nLINE', pair(8, layer), pair(10, a.x), pair(20, a.y), pair(30, 0), pair(11, b.x), pair(21, b.y), pair(31, 0)]
    }
    case 'arc': {
      const c = P(e.center)
      const { a0, sweep, r } = arcAngles(c, P(e.start), P(e.end))
      const s = ((deg(a0) % 360) + 360) % 360
      return ['0\nARC', pair(8, layer), pair(10, c.x), pair(20, c.y), pair(30, 0), pair(40, r), pair(50, s), pair(51, (s + deg(sweep)) % 360)]
    }
    case 'circle': {
      const c = P(e.center)
      return ['0\nCIRCLE', pair(8, layer), pair(10, c.x), pair(20, c.y), pair(30, 0), pair(40, e.r)]
    }
    case 'spline': {
      const pts = tessellateEntity(sk, e, 1 / 16)
      return ['0\nPOLYLINE', pair(8, layer), pair(66, 1), pair(70, 0), ...pts.flatMap(p => ['0\nVERTEX', pair(8, layer), pair(10, p.x), pair(20, p.y), pair(30, 0)]), '0\nSEQEND', pair(8, layer)]
    }
    case 'text': {
      const a = P(e.at)
      return ['0\nTEXT', pair(8, layer), pair(10, a.x), pair(20, a.y), pair(30, 0), pair(40, e.height), pair(1, e.text)]
    }
  }
}

export function toDxf(sk: Sketch): string {
  const layers = layersOf(sk)
  const layerTable = ['OUTLINE', 'CUTOUTS', 'TEXT'].flatMap((name, i) => ['0\nLAYER', pair(2, name), pair(70, 0), pair(62, i + 1), pair(6, 'CONTINUOUS')])
  const out = [
    '0\nSECTION', '2\nHEADER', '9\n$ACADVER', '1\nAC1009', '9\n$INSUNITS', '70\n1', '0\nENDSEC',
    '0\nSECTION', '2\nTABLES', '0\nTABLE', '2\nLAYER', pair(70, 3), ...layerTable, '0\nENDTAB', '0\nENDSEC',
    '0\nSECTION', '2\nENTITIES',
    ...sk.entities.flatMap(e => (layers.has(e.id) ? entity(sk, e, layers.get(e.id)!) : [])),
    '0\nENDSEC', '0\nEOF'
  ]
  return out.join('\n') + '\n'
}
