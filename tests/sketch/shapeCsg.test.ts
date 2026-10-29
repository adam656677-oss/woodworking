import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { extrudeOutline } from '../../src/ui/three/shapeGeometry'

test('cuts can still be taken out of a shaped part', () => {
  const g = extrudeOutline({ outer: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }, { x: 0, y: 10 }], holes: [] }, 0.75)
  const a = new Brush(g)
  a.updateMatrixWorld()
  const cut = new Brush(new THREE.BoxGeometry(5, 0.75, 0.25))
  cut.position.set(2, 5, 0.75)
  cut.updateMatrixWorld()
  const ev = new Evaluator()
  ev.useGroups = false
  const out = ev.evaluate(a, cut, SUBTRACTION)
  out.geometry.computeBoundingBox()
  expect(out.geometry.getAttribute('position').count).toBeGreaterThan(36)
  expect(out.geometry.boundingBox!.max.z).toBeCloseTo(0.75, 6)
})
