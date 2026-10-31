import type { ThreeEvent } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo } from 'react'
import { bandOf } from '../../optimize/banding'
import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { PRISM_UV, type Cut, type PlaneCut } from '../../model/joints'
import type { Board, WoodKind } from '../../model/types'
import type { Pt } from '../../sketch/types'
import { extrudeOutline, type OutlineProfile } from './shapeGeometry'
import { profileBrush } from './profileCutter'
import { turnedLeg, type TurnedLeg } from './turnedGeometry'
import { woodMaterial, type WoodUniformsIn } from '../../render/woodMaterial'

export type BoardShape = { outer: Pt[]; holes: Pt[][]; profiles?: OutlineProfile[] }

const COLORS: Record<WoodKind, string> = { lumber: '#e9cf9f', hardwood: '#b07246', sheet: '#d8b98c' }
const evaluator = new Evaluator()
evaluator.useGroups = false

function brushFor(cut: Cut, board: Board): Brush | null {
  const big = 4 * Math.max(board.width, board.length, board.thickness) + 10
  if (cut.kind === 'dado' || cut.kind === 'rabbet') {
    const e = 0.002 // a hair past the faces so the cut is clean
    const size = new THREE.Vector3(cut.max.x - cut.min.x + 2 * e, cut.max.y - cut.min.y + 2 * e, cut.max.z - cut.min.z + 2 * e)
    const b = new Brush(new THREE.BoxGeometry(size.x, size.y, size.z))
    b.position.set((cut.min.x + cut.max.x) / 2, (cut.min.y + cut.max.y) / 2, (cut.min.z + cut.max.z) / 2)
    b.updateMatrixWorld()
    return b
  }
  if (cut.kind === 'profile') return profileBrush(cut, board)
  if (cut.kind === 'pocket') {
    const b = new Brush(new THREE.BoxGeometry(cut.max.x - cut.min.x, cut.max.y - cut.min.y, cut.max.z - cut.min.z))
    b.position.set((cut.min.x + cut.max.x) / 2, (cut.min.y + cut.max.y) / 2, (cut.min.z + cut.max.z) / 2)
    b.updateMatrixWorld()
    return b
  }
  if (cut.kind === 'prism') {
    // The outline in its two axes, pushed along the third.
    const shape = new THREE.Shape(cut.poly.map(([u, v]) => new THREE.Vector2(u, v)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: cut.to - cut.from, bevelEnabled: false })
    g.translate(0, 0, cut.from)
    const [ua, va] = PRISM_UV[cut.axis]
    const col = (a: 'x' | 'y' | 'z') => new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0)
    g.applyMatrix4(new THREE.Matrix4().makeBasis(col(ua), col(va), col(cut.axis)))
    // A basis that mirrors turns the faces inside out; flip them back.
    if (new THREE.Matrix4().makeBasis(col(ua), col(va), col(cut.axis)).determinant() < 0) {
      const idx = g.getIndex()
      if (idx) for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t) }
      else {
        const pos = g.getAttribute('position')
        for (let i = 0; i < pos.count; i += 3) for (const k of [0, 1, 2]) { const t = pos.getComponent(i + 1, k); pos.setComponent(i + 1, k, pos.getComponent(i + 2, k)); pos.setComponent(i + 2, k, t) }
      }
      g.computeVertexNormals()
    }
    const b = new Brush(g)
    b.updateMatrixWorld()
    return b
  }
  if (cut.kind === 'bore') {
    const pad = 0.05
    const len = cut.depth + pad
    const b = new Brush(new THREE.CylinderGeometry(cut.diameter / 2, cut.diameter / 2, len, 32))
    // The cylinder runs along y; turn it to the cut's axis, from just outside the surface into the board.
    if (cut.axis === 'x') b.rotation.z = Math.PI / 2
    if (cut.axis === 'z') b.rotation.x = Math.PI / 2
    const c = { ...cut.center }
    c[cut.axis] = cut.center[cut.axis] + cut.dir * (cut.depth - pad) / 2
    b.position.set(c.x, c.y, c.z)
    b.updateMatrixWorld()
    return b
  }
  if (cut.kind === 'hole') {
    // Through holes run a hair past both faces; a stopped hole only past the face it's drilled from.
    const through = cut.depth >= board.thickness - 1e-9
    const fromTop = cut.center.z > 1e-9
    const pad = 0.1
    const len = cut.depth + (through ? 2 * pad : pad)
    const z0 = through ? -pad : fromTop ? cut.center.z : -pad
    const b = new Brush(new THREE.CylinderGeometry(cut.diameter / 2, cut.diameter / 2, len, 32))
    b.rotation.x = Math.PI / 2
    b.position.set(cut.center.x, cut.center.y, z0 + len / 2)
    b.updateMatrixWorld()
    return b
  }
  // Plane cut: a big box sitting entirely on the removed side of the plane.
  const { plane } = cut as PlaneCut
  const n = new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z).normalize()
  const b = new Brush(new THREE.BoxGeometry(big, big, big))
  b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  const p = new THREE.Vector3(plane.point.x, plane.point.y, plane.point.z).addScaledVector(n, big / 2)
  b.position.copy(p)
  b.updateMatrixWorld()
  return b
}

/** Board geometry in local coordinates (origin at the board's corner), with its cuts subtracted. */
export function buildBoardGeometry(board: Board, cuts: Cut[], shape?: BoardShape | null, turned?: TurnedLeg | null): THREE.BufferGeometry {
  let box: THREE.BufferGeometry
  if (turned) box = turnedLeg(turned)
  else if (shape) box = extrudeOutline(shape, board.thickness, shape.profiles)
  else {
    box = new THREE.BoxGeometry(board.width, board.length, board.thickness)
    box.translate(board.width / 2, board.length / 2, board.thickness / 2)
  }
  if (cuts.length === 0) return box
  let result = new Brush(box)
  result.updateMatrixWorld()
  for (const c of cuts) {
    const b = brushFor(c, board)
    if (!b) continue
    result = evaluator.evaluate(result, b, SUBTRACTION) as Brush
  }
  return result.geometry
}

export function useBoardGeometry(board: Board, cuts: Cut[], shape?: BoardShape | null, turned?: TurnedLeg | null): THREE.BufferGeometry {
  const key = JSON.stringify([board.width, board.length, board.thickness, cuts, shape ?? null, turned ?? null])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildBoardGeometry(board, cuts, shape, turned), [key])
}

type Props = {
  board: Board
  cuts: Cut[]
  kind: WoodKind
  /** A shaped part's outline (board coordinates); none for a plain rectangle. */
  shape?: BoardShape | null
  /** A turned leg's form (board coordinates); none for a square blank. */
  turned?: TurnedLeg | null
  selected: boolean
  warned: boolean
  onSelect(e: ThreeEvent<MouseEvent>): void
  /** Exploded-view offset (display only). */
  offset?: { x: number; y: number; z: number }
  /** Section planes: the cut-away side is hidden and the inside shows as a solid cap colour. */
  clip?: THREE.Plane[]
  /** The realistic look: grown wood grain and the finish, with shadows. CAD colours when absent. */
  real?: WoodUniformsIn
}

const deg = (d: number) => (d * Math.PI) / 180

export const BoardMesh = forwardRef<THREE.Group, Props>(function BoardMesh({ board, cuts, kind, shape, turned, selected, warned, onSelect, offset, clip, real }, ref) {
  const geometry = useBoardGeometry(board, cuts, shape, turned)
  // Outline the board's overall shape (cut seams would show triangulation lines across flat faces).
  const shapeKey = JSON.stringify([shape ?? null, turned ?? null])
  const outline = useMemo(() => {
    if (turned) return new THREE.EdgesGeometry(turnedLeg(turned), 25)
    // The plain outline: the profile's thin layers would draw a line at every step.
    if (shape) return new THREE.EdgesGeometry(extrudeOutline({ outer: shape.outer, holes: shape.holes }, board.thickness), 25)
    const box = new THREE.BoxGeometry(board.width, board.length, board.thickness)
    box.translate(board.width / 2, board.length / 2, board.thickness / 2)
    return new THREE.EdgesGeometry(box)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.width, board.length, board.thickness, shapeKey])
  const color = warned ? '#e57373' : COLORS[kind]
  const realKey = real ? JSON.stringify(real) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const realMat = useMemo(() => (real ? woodMaterial(real) : null), [realKey])
  useEffect(() => () => realMat?.dispose(), [realMat])
  if (realMat) {
    realMat.clippingPlanes = clip ?? []
    realMat.emissive.set(selected ? '#ff9800' : '#000000')
    realMat.emissiveIntensity = selected ? 0.3 : 0
  }
  return (
    <group
      ref={ref}
      name={board.id}
      position={[board.position.x + (offset?.x ?? 0), board.position.y + (offset?.y ?? 0), board.position.z + (offset?.z ?? 0)]}
      rotation={new THREE.Euler(deg(board.rotation.x), deg(board.rotation.y), deg(board.rotation.z), 'XYZ')}
    >
      {realMat ? (
        <mesh key="real" geometry={geometry} onClick={onSelect} userData={{ boardId: board.id }} material={realMat} castShadow receiveShadow />
      ) : (
        <mesh key="cad" geometry={geometry} onClick={onSelect} userData={{ boardId: board.id }}>
          <meshStandardMaterial flatShading color={color} roughness={0.85} emissive={selected ? '#ff9800' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} clippingPlanes={clip ?? []} />
        </mesh>
      )}
      {clip && clip.length > 0 && (
        // Inside faces seen through the cut read as the solid cut face.
        <mesh geometry={geometry} raycast={() => null}>
          <meshBasicMaterial color="#8d6e63" side={THREE.BackSide} clippingPlanes={clip} />
        </mesh>
      )}
      {board.banding && !shape && !turned && <BandStrips board={board} clip={clip} />}
      {/* Realistic: no drawn edges, except round the selected part. */}
      {(!real || selected) && (
        <lineSegments geometry={outline} raycast={() => null}>
          <lineBasicMaterial color={selected ? '#e65100' : '#5d4037'} clippingPlanes={clip ?? []} />
        </lineSegments>
      )}
    </group>
  )
})

/** Edge banding drawn as a thin coloured strip on each banded edge (a little proud so it shows). */
function BandStrips({ board, clip }: { board: Board; clip?: THREE.Plane[] }) {
  const band = bandOf(board.banding!.bandId)
  const t = Math.max(band?.thickness ?? 0.02, 0.03)
  const W = board.width, L = board.length, T = board.thickness
  const boxes: [number, number, number, number, number, number][] = []
  for (const e of board.banding!.edges) {
    if (e === 'left') boxes.push([0, L / 2, T / 2, t, L, T])
    if (e === 'right') boxes.push([W, L / 2, T / 2, t, L, T])
    if (e === 'start') boxes.push([W / 2, 0, T / 2, W, t, T])
    if (e === 'end') boxes.push([W / 2, L, T / 2, W, t, T])
  }
  return (
    <>
      {boxes.map((b, i) => (
        <mesh key={i} position={[b[0], b[1], b[2]]} raycast={() => null}>
          <boxGeometry args={[b[3], b[4], b[5]]} />
          <meshStandardMaterial color={band?.colour ?? '#e3c9a0'} roughness={0.6} clippingPlanes={clip ?? []} />
        </mesh>
      ))}
    </>
  )
}
