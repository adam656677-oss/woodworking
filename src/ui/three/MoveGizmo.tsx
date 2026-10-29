import { Html, TransformControls } from '@react-three/drei'
import { useRef, useState } from 'react'
import type * as THREE from 'three'
import { moveBoard } from '../../model/ops'
import { snapPosition } from '../../model/snap'
import { studio } from '../store'
import { controlledBy, ruleLabel } from '../../formulas/rules'

const SNAP = { tolerance: 0.25, grid: 1 / 16 }
const KIDS_SNAP = { tolerance: 0.25, grid: 1 / 8 }

/** Drag handle on the selected board: snaps to faces/edges/corners or the 1/16" grid; one undo step per drag. */
export function MoveGizmo({ object, boardId }: { object: THREE.Object3D; boardId: string }) {
  const [label, setLabel] = useState<string | null>(null)
  const dragging = useRef(false)

  const onChange = () => {
    if (!dragging.current) return
    const r = snapPosition(studio.getState().project, boardId, { x: object.position.x, y: object.position.y, z: object.position.z }, studio.getState().kidsMode ? KIDS_SNAP : SNAP)
    object.position.set(r.position.x, r.position.y, r.position.z)
    setLabel(r.snaps.includes('face') ? 'Snapped to face' : studio.getState().kidsMode ? 'Grid 1/8"' : 'Grid 1/16"')
  }

  return (
    <>
      <TransformControls
        object={object}
        mode="translate"
        size={0.8}
        onMouseDown={() => { dragging.current = true }}
        onObjectChange={onChange}
        onMouseUp={() => {
          dragging.current = false
          setLabel(null)
          const p = { x: object.position.x, y: object.position.y, z: object.position.z }
          const st = studio.getState()
          const b = st.project.boards.find(x => x.id === boardId)
          // A direction held by a formula or rule snaps back; say why.
          const held = b ? (['x', 'y', 'z'] as const).filter(a => Math.abs(p[a] - b.position[a]) > 1e-6).map(a => {
            const r = controlledBy(st.project, boardId, a)
            return r ? `a rule (${ruleLabel(st.project, r)})` : b.formulas?.[a] ? `its ${a.toUpperCase()} formula (=${b.formulas[a]})` : null
          }).filter(Boolean) : []
          st.apply(pr => moveBoard(pr, boardId, p))
          if (held.length && !st.kidsMode) st.setError(`This part is placed by ${held.join(' and ')} — change or remove that to move it this way.`)
        }}
      />
      {label && (
        <Html position={object.position} center>
          <div className="whitespace-nowrap rounded bg-black/70 px-2 py-0.5 text-xs text-white">{label}</div>
        </Html>
      )}
    </>
  )
}
