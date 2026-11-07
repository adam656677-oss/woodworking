// What the Custom tools draw in the 3D view: the sketch plane's grid, the shape being drawn, the solid being pulled,
// and the face being pushed. Pointer positions are worked out on the plane (a click is a press without a drag, so
// dragging still orbits the view).
import { Line } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { worldBox } from '../../model/geometry'
import type { Vec3 } from '../../model/types'
import type { Pt } from '../../sketch/types'
import { studio, useStudio } from '../../ui/store'
import { planeToWorld, profilePolygon, pushPullFace, worldToPlane, type Profile, type WorkPlane } from '../core'
import { modeling, useModeling } from '../modelStore'

const GRID = 1 / 4
const SNAP_TOL = 0.35
const tv = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z)

/** Corners of parts lying on the plane, in plane coordinates (to snap to). */
function cornersOnPlane(pl: WorkPlane): Pt[] {
  const out: Pt[] = []
  for (const b of studio.getState().project.boards) {
    const w = worldBox(b)
    for (const x of [w.min.x, w.max.x]) for (const y of [w.min.y, w.max.y]) for (const z of [w.min.z, w.max.z]) {
      const { q, h } = worldToPlane(pl, { x, y, z })
      if (Math.abs(h) < 1e-6) out.push(q)
    }
  }
  return out
}

export function snapOnPlane(pl: WorkPlane, q: Pt, extra: Pt[] = []): Pt {
  let best: Pt | null = null, bd = SNAP_TOL
  for (const c of [...extra, ...cornersOnPlane(pl)]) { const d = Math.hypot(c.x - q.x, c.y - q.y); if (d < bd) { bd = d; best = c } }
  return best ?? { x: Math.round(q.x / GRID) * GRID, y: Math.round(q.y / GRID) * GRID }
}

/** The solid a profile makes when pulled `d` along the plane's normal. */
function pullGeometry(pl: WorkPlane, profile: Profile, d: number): THREE.BufferGeometry {
  const poly = profilePolygon(profile)
  const shape = new THREE.Shape(poly.map(p => new THREE.Vector2(p.x, p.y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.abs(d), bevelEnabled: false })
  const m = new THREE.Matrix4().makeBasis(tv(pl.u), tv(pl.v), tv(pl.n))
  m.setPosition(tv(pl.origin).addScaledVector(tv(pl.n), Math.min(0, d)))
  g.applyMatrix4(m)
  return g
}

export function ModelLayer() {
  const s = useModeling(x => x)
  const project = useStudio(x => x.project)
  const { camera, gl } = useThree()

  // Pointer → plane, and pointer → distance along a normal (for pulling).
  useEffect(() => {
    if (!s.active) return
    const el = gl.domElement
    const ray = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      const rc = new THREE.Raycaster()
      rc.setFromCamera(ndc, camera)
      return rc.ray
    }
    const onPlane = (e: PointerEvent): Pt | null => {
      const st = modeling.getState()
      const pl = st.plane
      const hit = new THREE.Vector3()
      if (!ray(e).intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(tv(pl.n), tv(pl.origin)), hit)) return null
      const { q } = worldToPlane(pl, { x: hit.x, y: hit.y, z: hit.z })
      return snapOnPlane(pl, q, st.tool === 'outline' && st.pts.length >= 3 ? [st.pts[0]] : [])
    }
    /** How far along `dir` from `from` the pointer ray passes closest (to 1/16"). */
    const along = (e: PointerEvent, from: THREE.Vector3, dir: THREE.Vector3) => {
      const r = ray(e)
      const w0 = from.clone().sub(r.origin)
      const a = dir.dot(dir), b = dir.dot(r.direction), c = r.direction.dot(r.direction), d = dir.dot(w0), e2 = r.direction.dot(w0)
      const den = a * c - b * b
      if (Math.abs(den) < 1e-9) return null
      const t = (b * e2 - c * d) / den
      return Math.round(t * 16) / 16
    }
    let down: { x: number; y: number } | null = null
    const move = (e: PointerEvent) => {
      const st = modeling.getState()
      if (st.profile) {
        const poly = profilePolygon(st.profile)
        const c = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length }
        const t = along(e, tv(planeToWorld(st.plane, c)), tv(st.plane.n))
        if (t !== null) st.setPull(t)
        return
      }
      if (st.face) {
        const b = studio.getState().project.boards.find(x => x.id === st.face!.boardId)
        if (!b) return
        const w = worldBox(b)
        const ax = st.face.axis, sign = st.face.side === 'max' ? 1 : -1
        const centre = new THREE.Vector3((w.min.x + w.max.x) / 2, (w.min.y + w.max.y) / 2, (w.min.z + w.max.z) / 2)
        centre[ax] = w[st.face.side][ax]
        const t = along(e, centre, new THREE.Vector3(ax === 'x' ? sign : 0, ax === 'y' ? sign : 0, ax === 'z' ? sign : 0))
        if (t !== null) st.setPull(t)
        return
      }
      if (st.tool === 'rect' || st.tool === 'circle' || st.tool === 'outline') st.hoverAt(onPlane(e))
    }
    const press = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY } }
    const release = (e: PointerEvent) => {
      if (e.button !== 0 || !down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 4) return
      const st = modeling.getState()
      if (st.profile || st.face) { st.finishPull(); return }
      if (st.tool === 'rect' || st.tool === 'circle' || st.tool === 'outline') {
        const q = onPlane(e)
        if (q) st.clickAt(q)
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', press)
    el.addEventListener('pointerup', release)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerdown', press); el.removeEventListener('pointerup', release) }
  }, [s.active, camera, gl])

  const grid = useMemo(() => {
    if (!s.active) return null
    const pl = s.plane
    const c = s.hover ?? s.pts[0] ?? { x: 0, y: 0 }
    const cx = Math.round(c.x / 12) * 12, cy = Math.round(c.y / 12) * 12
    const fine: Vec3[] = [], bold: Vec3[] = []
    for (let i = -48; i <= 48; i += 1) {
      const arr = i % 12 === 0 ? bold : fine
      arr.push(planeToWorld(pl, { x: cx + i, y: cy - 48 }, 0.01), planeToWorld(pl, { x: cx + i, y: cy + 48 }, 0.01))
      arr.push(planeToWorld(pl, { x: cx - 48, y: cy + i }, 0.01), planeToWorld(pl, { x: cx + 48, y: cy + i }, 0.01))
    }
    const geo = (pts: Vec3[]) => new THREE.BufferGeometry().setFromPoints(pts.map(tv))
    return { fine: geo(fine), bold: geo(bold) }
    // Re-centre the grid as the pointer moves a foot.
  }, [s.active, s.plane, s.hover && Math.round(s.hover.x / 12), s.hover && Math.round(s.hover.y / 12), s.pts.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.active) return null
  const pl = s.plane
  const W = (q: Pt) => tv(planeToWorld(pl, q, 0.02))
  // The shape being drawn.
  let draft: THREE.Vector3[] | null = null
  if (!s.profile && s.pts.length) {
    const a = s.pts[0], h = s.hover
    if (s.tool === 'rect' && h) draft = profilePolygon({ kind: 'rect', a, b: h }).map(W).concat(W(a))
    else if (s.tool === 'circle' && h) { const r = Math.hypot(h.x - a.x, h.y - a.y); if (r > 0) { const poly = profilePolygon({ kind: 'circle', c: a, r }); draft = poly.map(W).concat(W(poly[0])) } }
    else if (s.tool === 'outline') draft = [...s.pts, ...(h ? [h] : [])].map(W)
  }
  const pullD = s.profile ? s.pull ?? project.woods.find(w => w.id === s.woodId)?.thickness ?? 0.75 : 0
  const solid = s.profile && Math.abs(pullD) > 1e-6 ? pullGeometry(pl, s.profile, pullD) : null
  const outline = s.profile ? profilePolygon(s.profile).map(W) : null
  // Push/Pull preview: the part's new box.
  let faceBox: THREE.Box3 | null = null
  if (s.face && s.pull) {
    const r = pushPullFace(project, s.face.boardId, s.face.axis, s.face.side, s.pull)
    const b = 'error' in r ? null : r.boards.find(x => x.id === s.face!.boardId)
    if (b) { const w = worldBox(b); faceBox = new THREE.Box3(tv(w.min), tv(w.max)) }
  }
  return (
    <group name="modeling">
      {grid && <>
        <lineSegments geometry={grid.fine}><lineBasicMaterial color="#d97706" transparent opacity={0.18} /></lineSegments>
        <lineSegments geometry={grid.bold}><lineBasicMaterial color="#b45309" transparent opacity={0.45} /></lineSegments>
      </>}
      {s.hover && !s.profile && <mesh position={W(s.hover)}><sphereGeometry args={[0.18, 12, 12]} /><meshBasicMaterial color="#1d4ed8" /></mesh>}
      {draft && draft.length > 1 && <Line points={draft} color="#1d4ed8" lineWidth={2} />}
      {s.tool === 'outline' && !s.profile && s.pts.map((q, i) => <mesh key={i} position={W(q)}><sphereGeometry args={[i === 0 ? 0.25 : 0.15, 10, 10]} /><meshBasicMaterial color={i === 0 ? '#16a34a' : '#1d4ed8'} /></mesh>)}
      {outline && <Line points={[...outline, outline[0]]} color="#1d4ed8" lineWidth={2} />}
      {solid && <mesh geometry={solid}><meshStandardMaterial color={pullD < 0 && s.planeBoardId ? '#dc2626' : '#f59e0b'} transparent opacity={0.55} /></mesh>}
      {faceBox && <box3Helper args={[faceBox, new THREE.Color('#1d4ed8')]} />}
    </group>
  )
}
