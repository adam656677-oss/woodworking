// Flat patterns for laser, CNC and cutting templates: each part's outline, holes and grooves, laid out in rows (DXF R12, inches).
import { cutGeometry, type BoxCut } from '../model/joints'
import { outlinePolygons } from '../model/shaped'
import type { Board, Project } from '../model/types'
import { formatInches } from '../model/units'

type Pt = { x: number; y: number }
const n = (v: number) => String(Math.round(v * 1e6) / 1e6 + 0)
const pair = (code: number, v: string | number) => `${code}\n${typeof v === 'number' ? n(v) : v}`
const ROW = 96
const GAP = 1
const TEXT_H = 0.5

function line(a: Pt, b: Pt, layer: string): string[] {
  return ['0\nLINE', pair(8, layer), ...(layer === 'GROOVES' ? [pair(6, 'DASHED')] : []), pair(10, a.x), pair(20, a.y), pair(30, 0), pair(11, b.x), pair(21, b.y), pair(31, 0)]
}
const loop = (pts: Pt[], layer: string) => pts.flatMap((p, i) => line(p, pts[(i + 1) % pts.length], layer))

/** One part's drawing in its own flat coordinates: length across (x), width up (y). */
function partEntities(p: Project, b: Board, at: Pt, cuts: BoxCut[]): string[] {
  // Seen from the top face: local (u across the width, v along the length) → flat (v, width − u), a turn, not a mirror.
  const P = (u: number, v: number): Pt => ({ x: at.x + v, y: at.y + b.width - u })
  const out: string[] = []
  const shape = outlinePolygons(p, b)
  if (shape) {
    out.push(...loop(shape.outer.map(q => P(q.x, q.y)), 'OUTLINE'))
    for (const h of shape.holes) out.push(...loop(h.map(q => P(q.x, q.y)), 'CUTOUTS'))
  } else out.push(...loop([P(0, 0), P(b.width, 0), P(b.width, b.length), P(0, b.length)], 'OUTLINE'))
  for (const h of b.holes) { const c = P(h.u, h.v); out.push('0\nCIRCLE', pair(8, h.depth !== undefined ? 'GROOVES' : 'CUTOUTS'), pair(10, c.x), pair(20, c.y), pair(30, 0), pair(40, h.diameter / 2)) }
  // Grooves and rabbets as dashed outlines of where they're cut (seen from the face).
  for (const c of cuts) {
    const u0 = Math.max(0, c.min.x), u1 = Math.min(b.width, c.max.x), v0 = Math.max(0, c.min.y), v1 = Math.min(b.length, c.max.y)
    if (u1 - u0 < 1e-9 || v1 - v0 < 1e-9) continue
    out.push(...loop([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], 'GROOVES'))
  }
  out.push('0\nTEXT', pair(8, 'TEXT'), pair(10, at.x), pair(20, at.y - TEXT_H - 0.25), pair(30, 0), pair(40, TEXT_H), pair(1, `${b.name} ${formatInches(b.width)} x ${formatInches(b.length)}`))
  return out
}

/** Every part (or the chosen ones) laid out in rows 1" apart, labelled. */
export function flatPatterns(p: Project, ids?: string[]): string {
  const boards = ids ? p.boards.filter(b => ids.includes(b.id)) : p.boards
  const cuts = cutGeometry(p).filter((c): c is BoxCut => c.kind === 'dado' || c.kind === 'rabbet')
  const ents: string[] = []
  let x = 0, y = 0, rowH = 0
  for (const b of boards) {
    const w = b.length, h = b.width
    if (x > 0 && x + w > ROW) { x = 0; y += rowH + GAP + TEXT_H + 0.5; rowH = 0 }
    ents.push(...partEntities(p, b, { x, y: y + TEXT_H + 0.5 }, cuts.filter(c => c.boardId === b.id)))
    x += w + GAP
    rowH = Math.max(rowH, h)
  }
  const layers = ['OUTLINE', 'CUTOUTS', 'GROOVES', 'TEXT']
  const layerTable = layers.flatMap((name, i) => ['0\nLAYER', pair(2, name), pair(70, 0), pair(62, i + 1), pair(6, name === 'GROOVES' ? 'DASHED' : 'CONTINUOUS')])
  const ltypes = ['0\nLTYPE', pair(2, 'CONTINUOUS'), pair(70, 0), pair(3, 'Solid line'), pair(72, 65), pair(73, 0), pair(40, 0),
    '0\nLTYPE', pair(2, 'DASHED'), pair(70, 0), pair(3, '__ __ __'), pair(72, 65), pair(73, 2), pair(40, 0.375), pair(49, 0.25), pair(49, -0.125)]
  return [
    '0\nSECTION', '2\nHEADER', '9\n$ACADVER', '1\nAC1009', '9\n$INSUNITS', '70\n1', '0\nENDSEC',
    '0\nSECTION', '2\nTABLES', '0\nTABLE', '2\nLTYPE', pair(70, 2), ...ltypes, '0\nENDTAB', '0\nTABLE', '2\nLAYER', pair(70, layers.length), ...layerTable, '0\nENDTAB', '0\nENDSEC',
    '0\nSECTION', '2\nENTITIES', ...ents, '0\nENDSEC', '0\nEOF'
  ].join('\n') + '\n'
}
