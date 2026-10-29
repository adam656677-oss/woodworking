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
import { addDimension } from '../../checks/annotations'
import { Annotations3D } from '../../checks/ui/Annotations3D'

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
    if (project.boards.length === 0) return null
    const bs = project.boards.map(worldBox)
    return {
      min: { x: Math.min(...bs.map(b => b.min.x)), y: Math.min(...bs.map(b => b.min.y)), z: Math.min(...bs.map(b => b.min.z)) },
      max: { x: Math.max(...bs.map(b => b.max.x)), y: Math.max(...bs.map(b => b.max.y)), z: Math.max(...bs.map(b => b.max.z)) }
    }
  }, [project.boards])

  useEffect(() => {
    if (!measuring) setPoints([])
  }, [measuring])
  useEffect(() => {
    // No move arrows on a hidden part.
    setSelectedGroup(explode === 0 && selection.length === 1 && shown.some(b => b.id === selection[0]) ? groups.current.get(selection[0]) ?? null : null)
  }, [selection, project, shown, explode])

  const onSelect = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = studio.getState()
    if (s.placingNote) {
      s.setView({ placingNote: false, pendingNote: { x: e.point.x, y: e.point.y, z: e.point.z } })
      return
    }
    if (s.measuring) {
      setPoints(pts => (pts.length >= 2 ? [e.point.clone()] : [...pts, e.point.clone()]))
      return
    }
    const multi = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey
    s.select(multi ? (s.selection.includes(id) ? s.selection.filter(x => x !== id) : [...s.selection, id]) : [id])
  }
  const kindOf = (woodId: string) => project.woods.find(w => w.id === woodId)?.kind ?? 'lumber'
  const gridSize = bounds ? Math.ceil(Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, 24) / 12) * 12 + 24 : 48

  return (
    <Canvas
      onCreated={({ gl }) => { gl.localClippingEnabled = true }}
      data-testid="scene"
      onPointerMissed={() => !studio.getState().measuring && studio.getState().select([])}
      gl={{ preserveDrawingBuffer: true }}
      style={{ background: '#f5f1ea' }}
    >
      <ViewControls view={view} bounds={bounds} projectKey={projectKey} boardCount={project.boards.length} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[-40, -60, 90]} intensity={1.6} />
      <directionalLight position={[50, 40, 30]} intensity={0.5} />
      <gridHelper args={[gridSize, gridSize, '#c8bba8', '#e3dacd']} rotation={[Math.PI / 2, 0, 0]} position={[gridSize / 2 - 12, gridSize / 2 - 12, -0.01]} />
      {shown.map(b => (
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
          offset={offsets.get(b.id)}
          clip={clip}
        />
      ))}
      {selectedGroup && !measuring && <MoveGizmo key={selection[0]} object={selectedGroup} boardId={selection[0]} />}
      <MeasureTool points={points} onKeep={kidsMode || points.length < 2 ? undefined : () => {
        const [a, b] = points
        studio.getState().apply(p => { const r = addDimension(p, a, b); return 'error' in r ? r : r.project })
        setPoints([])
        studio.getState().setView({ checksOpen: 'notes' })
      }} />
      {!kidsMode && <Annotations3D />}
    </Canvas>
  )
}
