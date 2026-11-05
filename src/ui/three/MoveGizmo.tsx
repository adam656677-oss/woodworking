import { Html, TransformControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import type * as THREE from 'three'
import { moveBoard } from '../../model/ops'
import { snapPosition } from '../../model/snap'
import { snapFeedback, type SnapFeedback } from '../../model/snapFeedback'
import { SnapOverlay } from './SnapOverlay'
import { studio } from '../store'
import { controlledBy, ruleLabel } from '../../formulas/rules'

let lastDragEnd = -Infinity
/** True for a moment after a move-arrow drag ends, so letting go over another part does not select it. */
export const justDragged = () => performance.now() - lastDragEnd < 400

const SNAP = { tolerance: 0.25, grid: 1 / 16 }
const KIDS_SNAP = { tolerance: 0.25, grid: 1 / 8 }

/** Drag handle on the selected board: snaps to faces/edges/corners or the 1/16" grid; one undo step per drag. */
export function MoveGizmo({ object, boardId }: { object: THREE.Object3D; boardId: string }) {
  const [feedback, setFeedback] = useState<SnapFeedback | null>(null)
  const dragging = useRef(false)
  const start = useRef({ x: 0, y: 0, z: 0 })
  // Holding Alt turns snapping off for as long as it is held.
  const alt = useRef(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') { alt.current = true; if (dragging.current) onChange() } }
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') alt.current = false }
    const reset = () => { alt.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset) }
  }, [])

  const onChange = () => {
    if (!dragging.current) return
    const st = studio.getState()
    const opts = { ...(st.kidsMode ? KIDS_SNAP : SNAP), enabled: !alt.current }
    const r = snapPosition(st.project, boardId, { x: object.position.x, y: object.position.y, z: object.position.z }, opts)
    object.position.set(r.position.x, r.position.y, r.position.z)
    setFeedback(snapFeedback(st.project, boardId, r, { grid: opts.grid, start: start.current }))
  }

  return (
    <>
      <TransformControls
        object={object}
        mode="translate"
        size={0.8}
        onMouseDown={() => { dragging.current = true; start.current = { x: object.position.x, y: object.position.y, z: object.position.z } }}
        onObjectChange={onChange}
        onMouseUp={() => {
          dragging.current = false
          lastDragEnd = performance.now()
          setFeedback(null)
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
      {feedback && <SnapOverlay feedback={feedback} />}
    </>
  )
}
