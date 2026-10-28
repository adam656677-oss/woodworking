import type { ThreeEvent } from '@react-three/fiber'
import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import type { Cut, PlaneCut } from '../../model/joints'
import type { Board, WoodKind } from '../../model/types'

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
  if (cut.kind === 'hole') {
    const b = new Brush(new THREE.CylinderGeometry(cut.diameter / 2, cut.diameter / 2, cut.depth + 0.2, 32))
    b.rotation.x = Math.PI / 2
    b.position.set(cut.center.x, cut.center.y, cut.center.z + cut.depth / 2)
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
export function useBoardGeometry(board: Board, cuts: Cut[]): THREE.BufferGeometry {
  const key = JSON.stringify([board.width, board.length, board.thickness, cuts])
  return useMemo(() => {
    const box = new THREE.BoxGeometry(board.width, board.length, board.thickness)
    box.translate(board.width / 2, board.length / 2, board.thickness / 2)
    if (cuts.length === 0) return box
    let result = new Brush(box)
    result.updateMatrixWorld()
    for (const c of cuts) {
      const b = brushFor(c, board)
      if (!b) continue
      result = evaluator.evaluate(result, b, SUBTRACTION) as Brush
    }
    return result.geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

type Props = {
  board: Board
  cuts: Cut[]
  kind: WoodKind
  selected: boolean
  warned: boolean
  onSelect(e: ThreeEvent<MouseEvent>): void
}

const deg = (d: number) => (d * Math.PI) / 180

export const BoardMesh = forwardRef<THREE.Group, Props>(function BoardMesh({ board, cuts, kind, selected, warned, onSelect }, ref) {
  const geometry = useBoardGeometry(board, cuts)
  // Outline the board's overall shape (cut seams would show triangulation lines across flat faces).
  const outline = useMemo(() => {
    const box = new THREE.BoxGeometry(board.width, board.length, board.thickness)
    box.translate(board.width / 2, board.length / 2, board.thickness / 2)
    return new THREE.EdgesGeometry(box)
  }, [board.width, board.length, board.thickness])
  const color = warned ? '#e57373' : COLORS[kind]
  return (
    <group
      ref={ref}
      name={board.id}
      position={[board.position.x, board.position.y, board.position.z]}
      rotation={new THREE.Euler(deg(board.rotation.x), deg(board.rotation.y), deg(board.rotation.z), 'XYZ')}
    >
      <mesh geometry={geometry} onClick={onSelect} userData={{ boardId: board.id }}>
        <meshStandardMaterial flatShading color={color} roughness={0.85} emissive={selected ? '#ff9800' : '#000000'} emissiveIntensity={selected ? 0.35 : 0} />
      </mesh>
      <lineSegments geometry={outline} raycast={() => null}>
        <lineBasicMaterial color={selected ? '#e65100' : '#5d4037'} />
      </lineSegments>
    </group>
  )
})
