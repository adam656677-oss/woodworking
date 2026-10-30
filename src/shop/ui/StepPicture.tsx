// The design in 3D with this step's parts picked out (the rest faint).
import { Bounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { cutGeometry, type Cut } from '../../model/joints'
import { BoardMesh } from '../../ui/three/BoardMesh'
import { boardForm } from '../../ui/three/boardForm'
import { useStudio } from '../../ui/store'

export default function StepPicture({ boardIds }: { boardIds: string[] }) {
  const project = useStudio(s => s.project)
  const cuts = useMemo(() => {
    const m = new Map<string, Cut[]>()
    for (const c of cutGeometry(project)) m.set(c.boardId, [...(m.get(c.boardId) ?? []), c])
    return m
  }, [project])
  const show = new Set(boardIds)
  return (
    <Canvas data-testid="step-picture" camera={{ position: [-60, -90, 70], up: [0, 0, 1], fov: 35 }} style={{ background: '#fafaf9' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[-40, -60, 90]} intensity={1.5} />
      <Bounds fit clip margin={1.2}>
        {project.boards.map(b => {
          const f = boardForm(project, b)
          return (
            <BoardMesh key={b.id} board={b} cuts={cuts.get(b.id) ?? []} kind={project.woods.find(w => w.id === b.woodId)?.kind ?? 'lumber'} shape={f.shape} turned={f.turned}
                selected={show.has(b.id) && boardIds.length < project.boards.length} warned={false} onSelect={() => {}} />
          )
        })}
      </Bounds>
    </Canvas>
  )
}
