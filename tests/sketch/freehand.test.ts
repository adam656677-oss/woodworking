import { outlineFromSketch, tessellateEntity } from '../../src/sketch/geometry'
import { presetShape, scaleSketchTo, sketchBounds, smoothStroke } from '../../src/sketch/freehand'
import { newSketch, type Pt } from '../../src/sketch/types'

/** Repeatable wobble, ±amp. */
function wobble(seed: number, amp: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return ((s / 2147483647) * 2 - 1) * amp }
}
const blank = () => newSketch('k', 'Free', 'freehand')

test('a wobbly straight stroke becomes one straight line', () => {
  const w = wobble(7, 0.02)
  const pts: Pt[] = Array.from({ length: 80 }, (_, i) => ({ x: (10 * i) / 79, y: w() }))
  const s = smoothStroke(pts, blank())
  expect(s.entities).toHaveLength(1)
  const e = s.entities[0]
  expect(e.kind).toBe('line')
  const [a, b] = tessellateEntity(s, e)
  expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(10, 1)
})

test('a wobbly circle becomes a true circle, everywhere within 1/16" of the drawn size', () => {
  const w = wobble(3, 0.02)
  const pts: Pt[] = Array.from({ length: 61 }, (_, i) => {
    const a = (2 * Math.PI * i) / 60
    return { x: 5 + (3 + w()) * Math.cos(a), y: 5 + (3 + w()) * Math.sin(a) }
  })
  const s = smoothStroke(pts, blank())
  for (const e of s.entities) {
    expect(['arc', 'circle']).toContain(e.kind)
    for (const p of tessellateEntity(s, e)) expect(Math.abs(Math.hypot(p.x - 5, p.y - 5) - 3)).toBeLessThan(1 / 16)
  }
})

test('a closed heart stroke makes a closed outline', () => {
  const pts: Pt[] = Array.from({ length: 120 }, (_, i) => {
    const t = (2 * Math.PI * i) / 119
    return { x: 0.2 * 16 * Math.sin(t) ** 3, y: 0.2 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) }
  })
  pts[pts.length - 1] = { x: pts[0].x + 0.1, y: pts[0].y - 0.1 }
  const s = smoothStroke(pts, blank())
  const r = outlineFromSketch(s)
  expect('error' in r ? r.error : 'ok').toBe('ok')
})

test('a tap (one point) changes nothing; two points make a line', () => {
  const s0 = blank()
  expect(smoothStroke([{ x: 1, y: 1 }], s0)).toBe(s0)
  const s = smoothStroke([{ x: 0, y: 0 }, { x: 2, y: 1 }], s0)
  expect(s.entities.map(e => e.kind)).toEqual(['line'])
})

test('a second stroke adds to the drawing without reusing names', () => {
  const s1 = smoothStroke([{ x: 0, y: 0 }, { x: 2, y: 0 }], blank())
  const s2 = smoothStroke([{ x: 0, y: 1 }, { x: 2, y: 1 }], s1)
  const ids = [...s2.points.map(p => p.id), ...s2.entities.map(e => e.id)]
  expect(new Set(ids).size).toBe(ids.length)
  expect(s2.entities).toHaveLength(2)
})

test('ready-made shapes come out at the chosen width and the closed ones make parts', () => {
  for (const kind of ['circle', 'heart', 'star'] as const) {
    const s = presetShape(kind, 6)
    const b = sketchBounds(s)
    expect(b.maxX - b.minX).toBeCloseTo(6, 6)
    expect('error' in outlineFromSketch(s)).toBe(false)
  }
  const l = presetShape('letters', 4, 'SAM')
  expect(l.entities[0]).toMatchObject({ kind: 'text', text: 'SAM' })
})

test('the Size box rounds to the nearest 1/8"', () => {
  const s = scaleSketchTo(presetShape('star', 3), 5.3)
  const b = sketchBounds(s)
  expect(b.maxX - b.minX).toBeCloseTo(5.25, 6)
})
