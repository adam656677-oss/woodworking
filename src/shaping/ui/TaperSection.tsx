import { useState } from 'react'
import type { Board } from '../../model/types'
import { formatInches, snap64 } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { defaultStart, FACE_NAMES, insideFaces, MSG_TURNED, removedPerFace, taperAngle, taperBoard, untaperBoard } from '../taper'
import type { Face, Taper } from '../types'

export function TaperSection({ board, onSheet }: { board: Board; onSheet(): void }) {
  const project = useStudio(s => s.project)
  const [error, setError] = useState<string | null>(null)
  const t = board.taper
  const set = (next: Taper) => {
    const r = taperBoard(studio.getState().project, board.id, next)
    if ('error' in r) return setError(r.error)
    setError(null)
    studio.getState().apply(() => r)
  }
  if (board.turning) {
    return (
      <details className="rounded border border-stone-200 p-2">
        <summary className="cursor-pointer text-sm font-semibold">Taper</summary>
        <p className="mt-1 text-xs text-stone-600">{MSG_TURNED}.</p>
      </details>
    )
  }
  const start = () => set({ faces: insideFaces(project, board), start: defaultStart(project, board), foot: snap64(Math.min(board.width, board.thickness) * 0.6) })
  const toggle = (f: Face) => t && set({ ...t, faces: t.faces.includes(f) ? t.faces.filter(x => x !== f) : [...t.faces, f] })
  const face = (f: Face, cls: string) => (
    <button aria-label={`Taper the ${FACE_NAMES[f]}`} aria-pressed={!!t?.faces.includes(f)} onClick={() => toggle(f)}
      className={`absolute ${cls} rounded text-[10px] ${t?.faces.includes(f) ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'}`}>{f}</button>
  )
  const removed = t ? removedPerFace(board, t) : null
  return (
    <details open={!!t || undefined} className="rounded border border-stone-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Taper</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {!t && <button onClick={start} className="self-start rounded bg-amber-700 px-3 py-1 font-semibold text-white">Taper this part</button>}
        {t && (
          <>
            <div className="flex flex-wrap gap-1 text-xs">
              <button onClick={() => set({ ...t, faces: insideFaces(project, board) })} className="rounded border border-stone-300 px-2 py-0.5">Two inside faces</button>
              <button onClick={() => set({ ...t, faces: ['left', 'right', 'top', 'bottom'] })} className="rounded border border-stone-300 px-2 py-0.5">All four faces</button>
              <button onClick={() => set({ ...t, faces: [insideFaces(project, board)[0]] })} className="rounded border border-stone-300 px-2 py-0.5">One face</button>
            </div>
            <div className="flex items-center gap-3">
              <div aria-label="End view" className="relative h-24 w-24 shrink-0">
                <div className="absolute inset-5 border-2 border-stone-500 bg-amber-100" />
                {face('top', 'left-5 right-5 top-0 h-4')}
                {face('bottom', 'bottom-0 left-5 right-5 h-4')}
                {face('left', 'bottom-5 left-0 top-5 w-4')}
                {face('right', 'bottom-5 right-0 top-5 w-4')}
              </div>
              <p className="text-xs text-stone-600">Click the faces to taper. Looking at the leg&apos;s end.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InchInput label="Starts from the top" allowZero value={t.start} onChange={v => set({ ...t, start: v })} />
              <InchInput label="Size at the foot" value={t.foot} onChange={v => set({ ...t, foot: v })} />
            </div>
            {removed && t.faces.length > 0 && (
              <p className="text-xs text-stone-600">{formatInches(removed[t.faces[0]], { sixtyFourths: true })} off each face at the foot · {taperAngle(board, t).toFixed(1)}°</p>
            )}
            <div className="flex flex-wrap gap-1">
              <button onClick={onSheet} className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100">Taper sheet</button>
              <button onClick={() => studio.getState().apply(p => untaperBoard(p, board.id))} className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100">Remove taper</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
    </details>
  )
}
