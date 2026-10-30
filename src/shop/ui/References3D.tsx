// Reference pictures in the 3D view: flat, see-through, under the parts. Clickable only while picking scale points.
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Reference } from '../../model/types'
import { studio, useStudio } from '../../ui/store'
import { uvAt, worldAt } from '../references'

function Picture({ r, picking }: { r: Reference; picking: boolean }) {
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(r.dataUrl)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [r.dataUrl])
  useEffect(() => () => texture.dispose(), [texture])
  const pick = useStudio(s => s.refPick)
  // The plane's centre, and its turn so the picture reads the right way round on each plane.
  const c = worldAt(r, { u: 0.5, v: 0.5 })
  const rotation: [number, number, number] = r.plane === 'front' ? [Math.PI / 2, 0, 0] : r.plane === 'side' ? [Math.PI / 2, Math.PI / 2, 0] : [0, 0, 0]
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = studio.getState()
    if (!s.refPick || s.refPick.id !== r.id || s.refPick.pts.length >= 2) return
    const uv = uvAt(r, { x: e.point.x, y: e.point.y, z: e.point.z })
    s.setView({ refPick: { id: r.id, pts: [...s.refPick.pts, uv] } })
  }
  return (
    <group>
      <mesh position={[c.x, c.y, c.z]} rotation={rotation} renderOrder={-1} {...(picking ? { onClick } : {})} name={`reference-${r.name}`}>
        <planeGeometry args={[r.width, r.height]} />
        <meshBasicMaterial map={texture} transparent opacity={r.opacity} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {pick?.id === r.id && pick.pts.map((uv, k) => {
        const w = worldAt(r, uv)
        return (
          <mesh key={k} position={[w.x, w.y, w.z]}>
            <sphereGeometry args={[Math.max(r.width, r.height) / 120, 12, 12]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        )
      })}
    </group>
  )
}

export function References3D() {
  const refs = useStudio(s => s.project.references)
  const pick = useStudio(s => s.refPick)
  if (!refs?.length) return null
  return <>{refs.filter(r => !r.hidden).map(r => <Picture key={r.id} r={r} picking={pick?.id === r.id} />)}</>
}
