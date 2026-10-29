// SVG at true size (inches), for laser cutters, vinyl cutters and printing elsewhere.
import { sketchBounds } from './freehand'
import { arcAngles, pointOf, tessellateEntity } from './geometry'
import { layersOf } from './dxf'
import type { Pt, Sketch, SketchEntity } from './types'

const n = (v: number) => String(Math.round(v * 1e6) / 1e6 + 0)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function toSvg(sk: Sketch): string {
  const b = sketchBounds(sk)
  const W = b.maxX - b.minX, H = b.maxY - b.minY
  // Y runs down in SVG, so flip it to keep the drawing the same way up.
  const f = (p: Pt) => `${n(p.x - b.minX)} ${n(b.maxY - p.y)}`
  const layers = layersOf(sk)
  const P = (id: string) => pointOf(sk, id)
  const shape = (e: SketchEntity): string => {
    switch (e.kind) {
      case 'line': return `<path d="M ${f(P(e.a))} L ${f(P(e.b))}"/>`
      case 'arc': {
        const c = P(e.center), s = P(e.start), end = P(e.end)
        const { sweep, r } = arcAngles(c, s, end)
        // Counter-clockwise in the drawing stays counter-clockwise on screen once flipped: sweep flag 0.
        return `<path d="M ${f(s)} A ${n(r)} ${n(r)} 0 ${sweep > Math.PI ? 1 : 0} 0 ${f(end)}"/>`
      }
      case 'circle': {
        const c = P(e.center)
        return `<circle cx="${n(c.x - b.minX)}" cy="${n(b.maxY - c.y)}" r="${n(e.r)}"/>`
      }
      case 'spline': return `<path d="M ${tessellateEntity(sk, e, 1 / 32).map(f).join(' L ')}"/>`
      case 'text': {
        const a = P(e.at)
        return `<text x="${n(a.x - b.minX)}" y="${n(b.maxY - a.y)}" font-size="${n(e.height)}" font-family="Arial" fill="black" stroke="none">${esc(e.text)}</text>`
      }
    }
  }
  const group = (name: string) => {
    const items = sk.entities.filter(e => layers.get(e.id) === name).map(shape)
    return items.length ? `  <g id="${name}">\n    ${items.join('\n    ')}\n  </g>\n` : ''
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}in" height="${n(H)}in" viewBox="0 0 ${n(W)} ${n(H)}" fill="none" stroke="black" stroke-width="0.01">
  <title>${esc(sk.name)}</title>
${group('OUTLINE')}${group('CUTOUTS')}${group('TEXT')}</svg>
`
}
