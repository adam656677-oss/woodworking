// Opening and leaving the drawing board, and keeping drawings in the project.
import wasmUrl from '@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url'
import { newId } from '../../model/ids'
import { addSketch, deleteSketch, shapeBoard, updateSketch } from '../../model/shaped'
import type { Board } from '../../model/types'
import { studio } from '../../ui/store'
import { draw, type DrawContext } from '../drawStore'
import { initSolver } from '../solver'
import { newSketch, type Sketch } from '../types'

export const ensureSolver = () => initSolver(() => wasmUrl)

export type ReturnTo = 'master' | 'kids'
let returnTo: ReturnTo = 'master'
export const backTo = () => returnTo

export async function openDrawing(sk: Sketch, ctx: Partial<DrawContext> = {}, back: ReturnTo = 'master'): Promise<void> {
  try {
    await ensureSolver()
  } catch {
    // Without the solver the board still draws; dimensions just won't solve.
  }
  returnTo = back
  draw.getState().begin(sk, ctx)
  studio.getState().goto('draw')
}

export function newDrawing(mode: 'precise' | 'freehand' = 'precise', back: ReturnTo = 'master') {
  const n = (studio.getState().project.sketches?.length ?? 0) + 1
  return openDrawing(newSketch(newId('k'), mode === 'freehand' ? 'My drawing' : `Drawing ${n}`, mode), { isNew: true, kids: back === 'kids' }, back)
}

/** "Edit shape" for a board: its drawing, or a new drawing that starts as the board's rectangle (long side across). */
export function editShape(b: Board) {
  const p = studio.getState().project
  const existing = b.outline && p.sketches?.find(s => s.id === b.outline!.sketchId)
  if (existing) return openDrawing(existing, { boardId: b.id, isNew: false })
  const L = b.length, W = b.width
  const sk = newSketch(newId('k'), `${b.name} shape`, 'precise')
  sk.points = [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: L, y: 0 }, { id: 'p3', x: L, y: W }, { id: 'p4', x: 0, y: W }]
  sk.entities = [
    { id: 'e1', kind: 'line', a: 'p1', b: 'p2' }, { id: 'e2', kind: 'line', a: 'p2', b: 'p3' },
    { id: 'e3', kind: 'line', a: 'p3', b: 'p4' }, { id: 'e4', kind: 'line', a: 'p4', b: 'p1' }
  ]
  sk.constraints = [
    { id: 'c1', kind: 'horizontal', refs: ['e1'] }, { id: 'c2', kind: 'horizontal', refs: ['e3'] },
    { id: 'c3', kind: 'vertical', refs: ['e2'] }, { id: 'c4', kind: 'vertical', refs: ['e4'] },
    { id: 'c5', kind: 'fixed', refs: ['p1'] }
  ]
  return openDrawing(sk, { boardId: b.id, isNew: true })
}

/** Puts the drawing into the project (one undo step). Returns false if the project refused it. */
export function saveDrawing(force = false): boolean {
  const d = draw.getState()
  const sk = d.sketch
  const s = studio.getState()
  const exists = s.project.sketches?.some(x => x.id === sk.id) ?? false
  if (exists && !d.dirty) return true
  if (!exists && sk.entities.length === 0) return true
  // A drawing opened and left untouched (like Edit shape's starting rectangle) isn't kept.
  if (!exists && !d.dirty && !force) return true
  s.apply(p => (exists ? updateSketch(p, sk) : addSketch(p, sk)))
  if (studio.getState().error) return false
  draw.setState({ dirty: false, context: { ...d.context, isNew: false } })
  return true
}

/** Saves the drawing and cuts a board to it: a new board from `woodId`, or the board being shaped. */
export function cutBoardFromDrawing(woodId: string | null): string | null {
  const d = draw.getState()
  if (!saveDrawing(true)) return null
  let made: string | null = null
  studio.getState().apply(p => {
    const target = d.context.boardId && p.boards.some(b => b.id === d.context.boardId) ? d.context.boardId : null
    const r = shapeBoard(p, target, d.sketch.id, woodId ?? undefined)
    if ('error' in r) return r
    made = r.id
    return r.project
  })
  if (made) {
    studio.getState().select([made])
    draw.setState({ context: { ...draw.getState().context, boardId: made } })
  }
  return made
}

/** Before the project is saved or autosaved, a drawing being worked on goes into it. */
export function flushDrawing() {
  if (studio.getState().screen === 'draw') saveDrawing()
}

// Work on the drawing board counts as unsaved work in the window (so closing asks first).
draw.subscribe((s, prev) => {
  if (s.dirty && !prev.dirty) window.aa?.setDirty(true)
})

/** Deletes the open drawing from the project (its parts become rectangles) and leaves the board. */
export function deleteDrawing() {
  const id = draw.getState().sketch.id
  studio.getState().apply(p => deleteSketch(p, id))
  draw.setState({ dirty: false })
  studio.getState().goto(returnTo)
}

export function leaveDrawing() {
  saveDrawing()
  studio.getState().goto(returnTo)
}
