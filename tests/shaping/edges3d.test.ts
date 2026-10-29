import * as THREE from 'three'
import { cutGeometry } from '../../src/model/joints'
import { addBoard, addJoint, rotateBoard } from '../../src/model/ops'
import { addSketch, outlinePolygons, shapeBoard } from '../../src/model/shaped'
import type { Project } from '../../src/model/types'
import { emptyProject } from '../../src/model/woods'
import { addEdgeProfile } from '../../src/shaping/edges'
import { boardForm } from '../../src/ui/three/boardForm'
import { buildBoardGeometry } from '../../src/ui/three/BoardMesh'
import { meshVolume } from '../../src/ui/three/turnedGeometry'
import { apron } from '../sketch/fixtures'

const ok = (r: Project | { error: string }): Project => { if ('error' in r) throw new Error(r.error); return r }
const geo = (p: Project, id: string) => {
  const b = p.boards.find(x => x.id === id)!
  const f = boardForm(p, b)
  return buildBoardGeometry(b, cutGeometry(p).filter(c => c.boardId === id), f.shape, f.turned)
}

test('a 1/4" roundover round the top of a 10 × 20 × 3/4 board takes away the right volume', () => {
  const r = addBoard(emptyProject('T'), { woodId: '1x12', name: 'Top', width: 10, length: 20 })
  const p = ok(addEdgeProfile(r.project, r.id, { profile: 'roundover', size: 0.25, face: 'top', sides: ['left', 'right', 'start', 'end'] }))
  const s = 0.25
  const want = 10 * 20 * 0.75 - 60 * (s * s - (Math.PI * s * s) / 4)
  const got = meshVolume(geo(p, r.id))
  expect(Math.abs(got - want) / (10 * 20 * 0.75 - want)).toBeLessThan(0.02)
})

/** Area of the faces looking straight up at the very top. */
function topArea(g: THREE.BufferGeometry, zTop: number) {
  const pos = g.getAttribute('position')
  let a = 0
  for (let i = 0; i < pos.count; i += 3) {
    const v = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(pos, i + k))
    if (v.some(q => Math.abs(q.z - zTop) > 1e-6)) continue
    const c = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0]))
    if (c.z > 0) a += c.length() / 2
  }
  return a
}

test('a roundover round a shaped part\'s top outline sets its top in by the bit\'s size', () => {
  const s = shapeBoard(addSketch(emptyProject('T'), apron()), null, 'k1', '1x6')
  if ('error' in s) throw new Error(s.error)
  const p = ok(addEdgeProfile(s.project, s.id, { profile: 'roundover', size: 0.25, face: 'top', sides: ['outline'] }))
  const poly = outlinePolygons(p, p.boards[0])!.outer
  let per = 0, area = 0
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; per += Math.hypot(b.x - a.x, b.y - a.y); area += (a.x * b.y - b.x * a.y) / 2 }
  const g = geo(p, s.id)
  // The top layer (the first of 8) is set in by how far the bit reaches half-way through it.
  const reach = 0.25 - Math.sqrt(0.25 ** 2 - (0.25 - 0.25 / 16) ** 2)
  const shrink = Math.abs(area) - topArea(g, 0.75)
  expect(Math.abs(shrink - per * reach) / (per * reach)).toBeLessThan(0.05)
  expect(shrink).toBeGreaterThan(0)
})

test('a profile and a dado on the same board both cut cleanly', () => {
  const r = addBoard(emptyProject('T'), { woodId: '1x12', name: 'Side', width: 11.25, length: 30 })
  let p = r.project
  const shelf = addBoard(p, { woodId: '1x12', name: 'Shelf', width: 11.25, length: 10, position: { x: 0, y: 10.75, z: 0.75 } })
  p = rotateBoard(shelf.project, shelf.id, 'x', 90)
  const j = addJoint(p, 'dado', r.id, shelf.id)
  p = 'error' in j ? p : j.project
  p = ok(addEdgeProfile(p, r.id, { profile: 'chamfer', size: 0.25, face: 'top', sides: ['left'] }))
  const v = meshVolume(geo(p, r.id))
  expect(Number.isFinite(v)).toBe(true)
  expect(v).toBeLessThan(11.25 * 30 * 0.75 - 30 * 0.25 * 0.25 / 2 + 0.01)
  expect(v).toBeGreaterThan(11.25 * 30 * 0.75 * 0.9)
})
