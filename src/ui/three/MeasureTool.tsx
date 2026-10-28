import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { formatInches } from '../../model/units'

/** Draws the measured line and its distance. Points are picked by the Scene while measuring. */
export function MeasureTool({ points }: { points: THREE.Vector3[] }) {
  if (points.length === 0) return null
  const [a, b] = points
  return (
    <group>
      <mesh position={a}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#1565c0" />
      </mesh>
      {b && (
        <>
          <mesh position={b}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color="#1565c0" />
          </mesh>
          <Line points={[a, b]} color="#1565c0" lineWidth={2} />
          <Html position={a.clone().add(b).multiplyScalar(0.5)} center>
            <div data-testid="measure-label" className="whitespace-nowrap rounded bg-blue-700 px-2 py-0.5 text-sm font-semibold text-white shadow">
              {formatInches(a.distanceTo(b))}
            </div>
          </Html>
        </>
      )}
    </group>
  )
}
