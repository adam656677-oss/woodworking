import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { worldBox, type Box } from '../../model/geometry'
import { cutGeometry, type Cut } from '../../model/joints'
import { outlinePolygons } from '../../model/shaped'
import { useStudio, studio } from '../store'
import { BoardMesh } from './BoardMesh'
import { MeasureTool } from './MeasureTool'
import { MoveGizmo } from './MoveGizmo'
import { ViewControls } from './ViewControls'

export default function Scene() {
  const project = useStudio(s => s.project)
  const selection = useStudio(s => s.selection)
  const warnings = useStudio(s => s.warnings)
  const view = useStudio(s => s.view)
  const measuring = useStudio(s => s.measuring)
  const projectKey = useStudio(s => s.projectKey)
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const groups = useRef(new Map<string, THREE.Group>())
  const [selectedGroup, setSelectedGroup] = useState<THREE.Group | null>(null)

  const cutsByBoard = useMemo(() => {
    const m = new Map<string, Cut[]>()
    for (const c of cutGeometry(project)) m.set(c.boardId, [...(m.get(c.boardId) ?? []), c])
    return m
  }, [project])
  const shapes = useMemo(() => new Map(project.boards.map(b => [b.id, outlinePolygons(project, b)])), [project])
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
    setSelectedGroup(selection.length === 1 ? groups.current.get(selection[0]) ?? null : null)
  }, [selection, project])

  const onSelect = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = studio.getState()
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
      {project.boards.map(b => (
        <BoardMesh
          key={b.id}
          ref={g => {
            if (g) groups.current.set(b.id, g)
            else groups.current.delete(b.id)
          }}
          board={b}
          cuts={cutsByBoard.get(b.id) ?? []}
          kind={kindOf(b.woodId)}
          shape={shapes.get(b.id)}
          selected={selection.includes(b.id)}
          warned={warned.has(b.id)}
          onSelect={onSelect(b.id)}
        />
      ))}
      {selectedGroup && !measuring && <MoveGizmo key={selection[0]} object={selectedGroup} boardId={selection[0]} />}
      <MeasureTool points={points} />
    </Canvas>
  )
}
