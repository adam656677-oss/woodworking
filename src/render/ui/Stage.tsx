// The realistic view's surroundings — a soft studio environment made in code (no picture files), the key and
// fill lights with shadows, a floor — the ambient-occlusion pass, and the picture export for both looks.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import type { Box } from '../../model/geometry'
import { exportSize, LIGHTS } from '../materials'
import { render, useRender, type Capture } from '../renderStore'

export const CAD_BACKGROUND = '#f5f1ea'

/** Lights, environment and floor for the realistic look. */
export function RealStage({ bounds }: { bounds: Box | null }) {
  const light = useRender(s => s.light)
  const effects = useRender(s => s.effects)
  const L = LIGHTS[light]
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    // The room is built Y-up; the design is Z-up.
    scene.environmentRotation.set(Math.PI / 2, 0, 0)
    return () => { scene.environment = null; env.dispose(); pm.dispose() }
  }, [gl, scene])
  useEffect(() => { scene.environmentIntensity = L.env }, [scene, L.env])
  useEffect(() => { gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap }, [gl])

  const b = bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 24, y: 24, z: 24 } }
  const c = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2)
  const span = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z, 12)
  const target = useMemo(() => new THREE.Object3D(), [])
  target.position.copy(c)
  const at = (d: [number, number, number], k: number) => {
    const v = new THREE.Vector3(...d).normalize().multiplyScalar(span * k)
    return [c.x + v.x, c.y + v.y, c.z + v.z] as [number, number, number]
  }
  const ext = span * 1.1
  return (
    <>
      <primitive object={target} />
      <ambientLight color={L.ambient.color} intensity={L.ambient.intensity} />
      {L.hemi && <hemisphereLight args={[L.hemi.sky, L.hemi.ground, L.hemi.intensity]} position={[0, 0, 1]} />}
      <directionalLight
        key={`${light}-${effects}`}
        position={at(L.key.dir, 2.5)} target={target} color={L.key.color} intensity={L.key.intensity}
        castShadow={effects} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-ext} shadow-camera-right={ext} shadow-camera-top={ext} shadow-camera-bottom={-ext}
        shadow-camera-near={0.1} shadow-camera-far={span * 6}
      />
      <directionalLight position={at(L.fill.dir, 2.5)} target={target} color={L.fill.color} intensity={L.fill.intensity} />
      <mesh name="render-floor" position={[c.x, c.y, b.min.z - 0.01]} receiveShadow raycast={() => null}>
        <planeGeometry args={[span * 10, span * 10]} />
        <meshStandardMaterial color={L.floor} roughness={0.95} />
      </mesh>
      {/* For a transparent picture: only the shadow shows, on nothing. */}
      <mesh name="render-shadow" position={[c.x, c.y, b.min.z - 0.009]} receiveShadow visible={false} raycast={() => null}>
        <planeGeometry args={[span * 10, span * 10]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </>
  )
}

/** Ambient occlusion: soft darkening where parts meet and in corners. Takes over drawing the frame. */
function Occlusion({ onComposer }: { onComposer(c: EffectComposer | null): void }) {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))
    const ao = new GTAOPass(scene, camera, size.width, size.height)
    // Inches: about an inch and a half of reach.
    ao.updateGtaoMaterial({ radius: 1.5, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 })
    ao.blendIntensity = 0.85
    c.addPass(ao)
    c.addPass(new OutputPass())
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])
  useEffect(() => { composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(size.width, size.height) }, [composer, gl, size.width, size.height])
  useEffect(() => { onComposer(composer); return () => { onComposer(null); composer.dispose() } }, [composer, onComposer])
  useFrame(() => composer.render(), 1)
  return null
}

let current: EffectComposer | null = null
const setComposer = (c: EffectComposer | null) => { current = c }

/** Registers the picture export for whichever look is showing, and the occlusion pass when it's on. */
export function Camera({ real }: { real: boolean }) {
  const effects = useRender(s => s.effects)
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    const capture: Capture = ({ scale, transparent }) => {
      const { width, height, ratio } = exportSize(size.width, size.height, scale)
      const pr = gl.getPixelRatio()
      const bg = scene.background
      const floor = scene.getObjectByName('render-floor')
      const shadow = scene.getObjectByName('render-shadow')
      const grid = scene.getObjectByName('cad-grid')
      const clear = gl.getClearAlpha()
      try {
        gl.setPixelRatio(ratio)
        gl.setSize(size.width, size.height, false)
        if (transparent) {
          scene.background = null
          gl.setClearColor(0x000000, 0)
          if (floor) floor.visible = false
          if (shadow) shadow.visible = real
          if (grid) grid.visible = false
        } else scene.background = new THREE.Color(real ? LIGHTS[render.getState().light].background : CAD_BACKGROUND)
        const useComposer = !transparent && current
        if (useComposer) {
          current!.setPixelRatio(ratio)
          current!.setSize(size.width, size.height)
          current!.render()
        } else gl.render(scene, camera)
        return { dataUrl: gl.domElement.toDataURL('image/png'), width, height }
      } catch {
        return null
      } finally {
        scene.background = bg
        gl.setClearAlpha(clear)
        if (floor) floor.visible = true
        if (shadow) shadow.visible = false
        if (grid) grid.visible = true
        gl.setPixelRatio(pr)
        gl.setSize(size.width, size.height, false)
        if (current) { current.setPixelRatio(pr); current.setSize(size.width, size.height) }
      }
    }
    render.setState({ capture })
    return () => { if (render.getState().capture === capture) render.setState({ capture: null }) }
  }, [gl, scene, camera, size.width, size.height, real])
  return real && effects ? <Occlusion onComposer={setComposer} /> : null
}
