// A read-only 3D view of a project: spin and zoom only. Can hand back a picture of itself for printing.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { worldBox } from '../../model/geometry'
import { cutGeometry, type Cut } from '../../model/joints'
import { boardForm } from '../../ui/three/boardForm'
import type { Project } from '../../model/types'
import { SceneBoundary } from '../../ui/three/SceneBoundary'
import { BoardMesh } from '../../ui/three/BoardMesh'
import { ViewControls } from '../../ui/three/ViewControls'

function Snapshot({ onSnapshot }: { onSnapshot(url: string): void }) {
  const { gl } = useThree()
  const frames = useRef(0)
  const done = useRef(false)
  useFrame(() => {
    frames.current += 1
    if (!done.current && frames.current > 5) {
      done.current = true
      onSnapshot(gl.domElement.toDataURL('image/png'))
    }
  })
  return null
}

export function ProjectViewer({ project, onSnapshot, className }: { project: Project; onSnapshot?(url: string): void; className?: string }) {
  const cuts = useMemo(() => {
    const m = new Map<string, Cut[]>()
    for (const c of cutGeometry(project)) m.set(c.boardId, [...(m.get(c.boardId) ?? []), c])
    return m
  }, [project])
  const bounds = useMemo(() => {
    const bs = project.boards.map(worldBox)
    if (bs.length === 0) return null
    return {
      min: { x: Math.min(...bs.map(b => b.min.x)), y: Math.min(...bs.map(b => b.min.y)), z: Math.min(...bs.map(b => b.min.z)) },
      max: { x: Math.max(...bs.map(b => b.max.x)), y: Math.max(...bs.map(b => b.max.y)), z: Math.max(...bs.map(b => b.max.z)) }
    }
  }, [project])
  const kind = (woodId: string) => project.woods.find(w => w.id === woodId)?.kind ?? 'lumber'
  return (
    <div className={className} data-testid="project-viewer">
      <SceneBoundary>
        <Canvas gl={{ preserveDrawingBuffer: true }} style={{ background: '#f5f1ea' }}>
          <ViewControls view="3d" bounds={bounds} projectKey={0} boardCount={project.boards.length} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[-40, -60, 90]} intensity={1.6} />
          <directionalLight position={[50, 40, 30]} intensity={0.5} />
          {project.boards.map(b => (
            <BoardMesh key={b.id} board={b} cuts={cuts.get(b.id) ?? []} kind={kind(b.woodId)} {...boardForm(project, b)} selected={false} warned={false} onSelect={() => {}} />
          ))}
          {onSnapshot && <Snapshot onSnapshot={onSnapshot} />}
        </Canvas>
      </SceneBoundary>
    </div>
  )
}
