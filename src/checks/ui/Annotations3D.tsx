// Kept dimensions, notes, the overall size and the centre-of-mass marker, drawn in the 3D view.
import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { groupBox, wholeGroup } from '../../assemblies/ops'
import type { Box } from '../../model/geometry'
import { formatInches } from '../../model/units'
import { useStudio } from '../../ui/store'
import { dimensionLength } from '../annotations'
import { designBox } from '../explode'
import { weigh } from '../solids'

const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z)
const label = 'whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold shadow'

export function Annotations3D() {
  const project = useStudio(s => s.project)
  const showDims = useStudio(s => s.showDims)
  const overall = useStudio(s => s.overallSize)
  const selection = useStudio(s => s.selection)
  const checks = useStudio(s => s.checksOpen)
  const list = project.annotations ?? []
  const box: Box | null = useMemo(() => {
    if (!overall) return null
    const g = wholeGroup(project, selection)
    return g ? groupBox(project, g.id) : designBox(project.boards)
  }, [overall, project, selection])
  const centre = useMemo(() => (checks === 'weight' ? weigh(project).centre : null), [checks, project])
  return (
    <group>
      {showDims && list.map(a => a.kind === 'dimension' ? (
        <group key={a.id}>
          <Line points={[v(a.a), v(a.b)]} color="#0b5394" lineWidth={1.5} />
          <Html position={v(a.a).add(v(a.b)).multiplyScalar(0.5)} center>
            <div data-testid="dimension-label" className={`${label} bg-white text-sky-900 ring-1 ring-sky-700`}>{a.label ? `${a.label}: ` : ''}{formatInches(dimensionLength(a))}</div>
          </Html>
        </group>
      ) : (
        <Html key={a.id} position={v(a.at)}>
          <div data-testid="note-label" className={`${label} -translate-y-full bg-yellow-100 text-stone-800 ring-1 ring-yellow-500`}>📝 {a.text}</div>
        </Html>
      ))}
      {box && <OverallSize box={box} />}
      {centre && (
        <group position={v(centre)}>
          <mesh><sphereGeometry args={[0.6, 16, 16]} /><meshBasicMaterial color="#c62828" depthTest={false} /></mesh>
          <Html center><div className={`${label} translate-y-4 bg-red-700 text-white`}>centre of mass</div></Html>
        </group>
      )}
    </group>
  )
}

function OverallSize({ box }: { box: Box }) {
  const { min, max } = box
  const o = 2
  const w: [THREE.Vector3, THREE.Vector3] = [v({ x: min.x, y: min.y - o, z: min.z }), v({ x: max.x, y: min.y - o, z: min.z })]
  const d: [THREE.Vector3, THREE.Vector3] = [v({ x: max.x + o, y: min.y, z: min.z }), v({ x: max.x + o, y: max.y, z: min.z })]
  const h: [THREE.Vector3, THREE.Vector3] = [v({ x: min.x - o, y: min.y, z: min.z }), v({ x: min.x - o, y: min.y, z: max.z })]
  const tag = (pts: [THREE.Vector3, THREE.Vector3], text: string, id: string) => (
    <group key={id}>
      <Line points={pts} color="#6d4c41" lineWidth={1.5} />
      <Html position={pts[0].clone().add(pts[1]).multiplyScalar(0.5)} center>
        <div data-testid={`overall-${id}`} className={`${label} bg-stone-700 text-white`}>{text}</div>
      </Html>
    </group>
  )
  return (
    <group>
      {tag(w, `${formatInches(max.x - min.x)} W`, 'w')}
      {tag(d, `${formatInches(max.y - min.y)} D`, 'd')}
      {tag(h, `${formatInches(max.z - min.z)} H`, 'h')}
    </group>
  )
}
