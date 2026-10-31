import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { worldBox, type Box } from '../../model/geometry'
import { cutGeometry, type Cut } from '../../model/joints'
import { boardForm } from './boardForm'
import { useStudio, studio } from '../store'
import { BoardMesh } from './BoardMesh'
import { MeasureTool } from './MeasureTool'
import { MoveGizmo } from './MoveGizmo'
import { ViewControls } from './ViewControls'
import { designBox, explodeOffsets } from '../../checks/explode'
import { pickOnModel } from '../../checks/pick'
import { moverOf, swingDeg } from '../../cabinet/motion'
import { addDimension } from '../../checks/annotations'
import { Annotations3D } from '../../checks/ui/Annotations3D'
import { References3D } from '../../shop/ui/References3D'
import { worldAt } from '../../shop/references'
import { Models3D } from '../../exchange/ui/Models3D'
import { modelBox } from '../../exchange/models'
import { useRender } from '../../render/renderStore'
import { finishLook, grainFrame, LIGHTS, seedOf, varied, woodLook } from '../../render/materials'
import type { WoodUniformsIn } from '../../render/woodMaterial'
import { CAD_BACKGROUND, Camera, RealStage } from '../../render/ui/Stage'

export default function Scene() {
  const project = useStudio(s => s.project)
  const selection = useStudio(s => s.selection)
  const warnings = useStudio(s => s.warnings)
  const view = useStudio(s => s.view)
  const measuring = useStudio(s => s.measuring)
  const projectKey = useStudio(s => s.projectKey)
  const explode = useStudio(s => s.explode)
  const section = useStudio(s => s.section)
  const kidsMode = useStudio(s => s.kidsMode)
  const openAmount = useStudio(s => s.openAmount)
  const offsets = useMemo(() => explodeOffsets(project, explode), [project, explode])
  const clip = useMemo(() => {
    const box = section ? designBox(project.boards) : null
    if (!section || !box) return undefined
    const v = box.min[section.axis] + section.at * (box.max[section.axis] - box.min[section.axis])
    const n = new THREE.Vector3(section.axis === 'x' ? 1 : 0, section.axis === 'y' ? 1 : 0, section.axis === 'z' ? 1 : 0)
    // Keep the low side (or the high side when flipped).
    return [section.flip ? new THREE.Plane(n, -v) : new THREE.Plane(n.negate(), v)]
  }, [section, project.boards])
  const hidden = useStudio(s => s.hidden)
  const isolated = useStudio(s => s.isolated)
  const shown = useMemo(() => {
    const h = new Set(hidden), iso = isolated ? new Set(isolated) : null
    return project.boards.filter(b => !h.has(b.id) && (!iso || iso.has(b.id)))
  }, [project.boards, hidden, isolated])
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const groups = useRef(new Map<string, THREE.Group>())
  const [selectedGroup, setSelectedGroup] = useState<THREE.Group | null>(null)

  const cutsByBoard = useMemo(() => {
    const m = new Map<string, Cut[]>()
    for (const c of cutGeometry(project)) m.set(c.boardId, [...(m.get(c.boardId) ?? []), c])
    return m
  }, [project])
  const forms = useMemo(() => new Map(project.boards.map(b => [b.id, boardForm(project, b)])), [project])
  const warned = useMemo(() => new Set(warnings.flatMap(w => w.boardIds)), [warnings])
  const bounds: Box | null = useMemo(() => {
    // Parts, and the pictures being designed over (so Fit shows them).
    const pics = (project.references ?? []).filter(r => !r.hidden).map(r => ({ min: r.position, max: worldAt(r, { u: 1, v: 1 }) }))
    const bs = [...project.boards.map(worldBox), ...pics, ...(kidsMode ? [] : (project.models ?? []).filter(m => !m.hidden).map(modelBox))]
    if (bs.length === 0) return null
    return {
      min: { x: Math.min(...bs.map(b => b.min.x)), y: Math.min(...bs.map(b => b.min.y)), z: Math.min(...bs.map(b => b.min.z)) },
      max: { x: Math.max(...bs.map(b => b.max.x)), y: Math.max(...bs.map(b => b.max.y)), z: Math.max(...bs.map(b => b.max.z)) }
    }
  }, [project.boards, project.references, project.models, kidsMode])

  useEffect(() => {
    if (!measuring) setPoints([])
  }, [measuring])
  useEffect(() => {
    // No move arrows on a hidden part.
    setSelectedGroup(explode === 0 && openAmount === 0 && selection.length === 1 && shown.some(b => b.id === selection[0]) ? groups.current.get(selection[0]) ?? null : null)
  }, [selection, project, shown, explode, openAmount])

  const onSelect = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    // Picking scale points on a picture: the click goes through the parts to the picture.
    if (studio.getState().refPick) return
    // A click that only touched the cut-away half of a part in a section belongs to the next part along the ray.
    const b = project.boards.find(x => x.id === id)
    const off = offsets.get(id)
    const wb = b ? worldBox(b) : null
    const drawn = wb && off ? { min: { x: wb.min.x + off.x, y: wb.min.y + off.y, z: wb.min.z + off.z }, max: { x: wb.max.x + off.x, y: wb.max.y + off.y, z: wb.max.z + off.z } } : wb
    const at = drawn ? pickOnModel(e.point, e.ray, drawn, clip?.[0], off) : e.point
    if (!at) return
    e.stopPropagation()
    const s = studio.getState()
    if (s.placingNote) {
      s.setView({ placingNote: false, pendingNote: { x: at.x, y: at.y, z: at.z } })
      return
    }
    if (s.measuring) {
      const v = new THREE.Vector3(at.x, at.y, at.z)
      setPoints(pts => (pts.length >= 2 ? [v] : [...pts, v]))
      return
    }
    const multi = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey
    s.select(multi ? (s.selection.includes(id) ? s.selection.filter(x => x !== id) : [...s.selection, id]) : [id])
  }
  const mode = useRender(r => r.mode)
  const light = useRender(r => r.light)
  const real = mode === 'real'
  // Each part's wood, grain and finish for the realistic look.
  const looks = useMemo(() => {
    if (!real) return null
    const fin = finishLook(project.finish)
    const byWood = new Map(project.woods.map(w => [w.id, woodLook(w)]))
    return new Map(project.boards.map((b): [string, WoodUniformsIn] => {
      const g = grainFrame(b)
      return [b.id, { look: varied(byWood.get(b.woodId) ?? woodLook(undefined), b.id), finish: fin, seed: seedOf(b.id), alongY: g.along === 'y', pith: g.pith, thickness: b.thickness }]
    }))
  }, [real, project.boards, project.woods, project.finish])
  const kindOf = (woodId: string) => project.woods.find(w => w.id === woodId)?.kind ?? 'lumber'
  const gridSize = bounds ? Math.ceil(Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, 24) / 12) * 12 + 24 : 48

  return (
    <Canvas
      onCreated={({ gl }) => { gl.localClippingEnabled = true }}
      data-testid="scene"
      onPointerMissed={() => !studio.getState().measuring && studio.getState().select([])}
      gl={{ preserveDrawingBuffer: true }}
      shadows="soft"
      style={{ background: real ? LIGHTS[light].background : CAD_BACKGROUND }}
    >
      <ViewControls view={view} bounds={bounds} projectKey={projectKey} boardCount={project.boards.length} />
      <Camera real={real} />
      {real ? <RealStage bounds={bounds} /> : (
        <>
          <ambientLight intensity={0.6} />
          <directionalLight position={[-40, -60, 90]} intensity={1.6} />
          <directionalLight position={[50, 40, 30]} intensity={0.5} />
          <gridHelper name="cad-grid" args={[gridSize, gridSize, '#c8bba8', '#e3dacd']} rotation={[Math.PI / 2, 0, 0]} position={[gridSize / 2 - 12, gridSize / 2 - 12, -0.01]} />
        </>
      )}
      {shown.map(b => {
        // Doors swing about their hinge line and drawers slide out when "Open doors & drawers" is up.
        const mover = openAmount > 0 ? moverOf(project, b) : undefined
        const m = mover?.motion
        const ex = offsets.get(b.id)
        const slide = m?.kind === 'slide' ? { x: m.dir.x * m.travel * openAmount, y: m.dir.y * m.travel * openAmount, z: m.dir.z * m.travel * openAmount } : null
        const offset = slide ? { x: (ex?.x ?? 0) + slide.x, y: (ex?.y ?? 0) + slide.y, z: (ex?.z ?? 0) + slide.z } : ex
        const mesh = (
          <BoardMesh
            key={b.id}
            ref={g => {
              if (g) groups.current.set(b.id, g)
              else groups.current.delete(b.id)
            }}
            board={b}
            cuts={cutsByBoard.get(b.id) ?? []}
            kind={kindOf(b.woodId)}
            shape={forms.get(b.id)?.shape}
            turned={forms.get(b.id)?.turned}
            selected={selection.includes(b.id)}
            warned={warned.has(b.id)}
            onSelect={onSelect(b.id)}
            offset={offset}
            clip={clip}
            real={looks?.get(b.id)}
          />
        )
        if (m?.kind !== 'swing') return mesh
        const o = m.origin
        return (
          <group key={b.id} position={[o.x, o.y, o.z]} rotation={[0, 0, (swingDeg(m, openAmount) * Math.PI) / 180]}>
            <group position={[-o.x, -o.y, -o.z]}>{mesh}</group>
          </group>
        )
      })}
      {selectedGroup && !measuring && <MoveGizmo key={selection[0]} object={selectedGroup} boardId={selection[0]} />}
      <MeasureTool points={points} onKeep={kidsMode || points.length < 2 ? undefined : () => {
        const [a, b] = points
        studio.getState().apply(p => { const r = addDimension(p, a, b); return 'error' in r ? r : r.project })
        setPoints([])
        studio.getState().setView({ checksOpen: 'notes' })
      }} />
      {!kidsMode && <Annotations3D />}
      {!kidsMode && <References3D />}
      {!kidsMode && <Models3D />}
    </Canvas>
  )
}
