import { meshVolume, turnedLeg } from '../../src/ui/three/turnedGeometry'

const taper = (n = 200) => Array.from({ length: n + 1 }, (_, i) => ({ x: 5 + (24 * i) / n, r: 0.75 - (0.375 * i) / n }))

test('a straight-taper leg has the volume of its pommel plus a frustum (within 1%)', () => {
  const g = turnedLeg({ blank: 1.75, length: 29, top: 5, bottom: 0, radii: taper(), fromStart: true })
  const R = 0.75, r = 0.375, h = 24
  const want = 1.75 * 1.75 * 5 + (Math.PI * h * (R * R + R * r + r * r)) / 3
  expect(Math.abs(meshVolume(g) - want) / want).toBeLessThan(0.01)
})

test('the leg fills its blank: 1-3/4 × 29 × 1-3/4', () => {
  const g = turnedLeg({ blank: 1.75, length: 29, top: 5, bottom: 0, radii: taper(), fromStart: true })
  g.computeBoundingBox()
  const b = g.boundingBox!
  expect(b.max.x - b.min.x).toBeCloseTo(1.75, 3)
  expect(b.max.y - b.min.y).toBeCloseTo(29, 3)
  expect(b.max.z - b.min.z).toBeCloseTo(1.75, 3)
})

test('with the top at the far end the pommel is at y = length', () => {
  const g = turnedLeg({ blank: 1.75, length: 29, top: 5, bottom: 0, radii: taper(), fromStart: false })
  const pos = g.getAttribute('position')
  // Square corners (x = 0, z = 0) only exist on the pommel.
  let minY = Infinity
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6) minY = Math.min(minY, pos.getY(i))
  expect(minY).toBeCloseTo(24, 2)
  expect(meshVolume(g)).toBeGreaterThan(0)
})
