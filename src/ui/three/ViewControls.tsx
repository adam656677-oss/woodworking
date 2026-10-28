import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Box } from '../../model/geometry'
import type { View } from '../store'

const UP = new THREE.Vector3(0, 0, 1)

/** Camera for each view: orbit 3D (perspective) or flat Front / Side / Top (orthographic, no rotation). */
export function ViewControls({ view, bounds, projectKey }: { view: View; bounds: Box | null; projectKey: number }) {
  const controls = useRef<any>(null)
  const { camera, size } = useThree()

  const fit = useCallback(() => {
    const b = bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 24, y: 24, z: 24 } }
    const c = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
    const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z, 6)
    const dist = span * 2.2
    const dirs: Record<View, THREE.Vector3> = {
      '3d': new THREE.Vector3(-0.9, -1.3, 0.9).normalize(),
      front: new THREE.Vector3(0, -1, 0),
      side: new THREE.Vector3(1, 0, 0),
      top: new THREE.Vector3(0, 0, 1)
    }
    camera.up.copy(view === 'top' ? new THREE.Vector3(0, 1, 0) : UP)
    camera.position.copy(c).addScaledVector(dirs[view], dist)
    camera.lookAt(c)
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width, size.height) / (span * 1.4)
      camera.updateProjectionMatrix()
    }
    if (controls.current) {
      controls.current.target.copy(c)
      controls.current.update()
    }
  }, [bounds, camera, size.width, size.height, view])

  // Refit when the view changes; refit on demand from the Fit button.
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, camera, projectKey])
  useEffect(() => {
    const onFit = () => fit()
    window.addEventListener('aa:zoom-fit', onFit)
    return () => window.removeEventListener('aa:zoom-fit', onFit)
  }, [fit])

  return (
    <>
      {view === '3d' ? (
        <PerspectiveCamera makeDefault fov={40} near={0.1} far={5000} up={[0, 0, 1]} />
      ) : (
        <OrthographicCamera makeDefault near={-5000} far={5000} up={view === 'top' ? [0, 1, 0] : [0, 0, 1]} />
      )}
      <OrbitControls ref={controls} makeDefault enableRotate={view === '3d'} enableDamping={false} />
    </>
  )
}
