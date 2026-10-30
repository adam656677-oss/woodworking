// Reference models in the 3D view: neutral grey, see-through as set.
import { useMemo } from 'react'
import * as THREE from 'three'
import type { RefModel } from '../../model/types'
import { useStudio } from '../../ui/store'
import { modelGeometry, modelMatrix } from '../models'

function Model({ m }: { m: RefModel }) {
  const geometry = modelGeometry(m)
  const matrix = useMemo(() => modelMatrix(m), [m])
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
  matrix.decompose(pos, q, s)
  return (
    <mesh name={`model-${m.name}`} geometry={geometry} position={pos} quaternion={q} scale={s}>
      <meshStandardMaterial color="#9ca3af" transparent={m.opacity < 1} opacity={m.opacity} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function Models3D() {
  const models = useStudio(s => s.project.models)
  if (!models?.length) return null
  return <>{models.filter(m => !m.hidden).map(m => <Model key={m.id} m={m} />)}</>
}
