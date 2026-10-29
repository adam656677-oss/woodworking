// Using a drawing: cut a board to it, print it full size, or save it for a CNC or laser.
import { useMemo, useState } from 'react'
import { KID_WOODS } from '../../kids/kidWords'
import { studio, useStudio } from '../../ui/store'
import { toDxf } from '../dxf'
import { useDraw } from '../drawStore'
import { outlineFromSketch } from '../geometry'
import { toSvg } from '../svg'
import { FullSizePrint } from './FullSizePrint'
import { cutBoardFromDrawing, deleteDrawing, saveDrawing } from './session'

export function Outputs({ kids = false }: { kids?: boolean }) {
  const sketch = useDraw(s => s.sketch)
  const boardId = useDraw(s => s.context.boardId)
  const woods = useStudio(s => s.project.woods)
  const saved = useStudio(s => s.project.sketches?.some(k => k.id === sketch.id) ?? false)
  const target = useStudio(s => (boardId ? s.project.boards.find(b => b.id === boardId) : undefined))
  const [choosing, setChoosing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const result = useMemo(() => outlineFromSketch(sketch), [sketch])
  const problem = 'error' in result ? result.error : null
  const choices = kids ? woods.filter(w => KID_WOODS.includes(w.id)) : woods
  const [wood, setWood] = useState(() => (choices.find(w => w.id === (kids ? '1x8' : '1x6')) ?? choices[0])?.id ?? '')

  const cut = (woodId: string | null) => {
    const id = cutBoardFromDrawing(woodId)
    setChoosing(false)
    if (!id) {
      setNote(studio.getState().error ?? "That part couldn't be made")
      studio.getState().setError(null)
      return
    }
    // Off to the design, with the new part picked out.
    studio.getState().goto('master')
  }
  const exportAs = async (kind: 'dxf' | 'svg') => {
    saveDrawing()
    const text = kind === 'dxf' ? toDxf(sketch) : toSvg(sketch)
    const where = await window.aa?.exportShape(kind, text, sketch.name)
    if (where) setNote(`Saved ${where}`)
  }
  const btn = kids
    ? 'rounded-xl px-5 py-2 text-lg font-bold shadow disabled:opacity-40'
    : 'rounded px-3 py-1 text-sm font-semibold disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {problem && sketch.entities.length > 0 && <span role="note" className="text-sm text-red-700">{problem}</span>}
      {note && <span role="status" className="text-sm text-stone-600">{note}</span>}
      <div className="relative">
        <button
          disabled={!!problem}
          title={problem ?? undefined}
          onClick={() => (target ? cut(null) : setChoosing(c => !c))}
          className={`${btn} bg-amber-700 text-white`}
        >
          {target ? `Shape ${target.name}` : kids ? 'Make it a part!' : 'Cut a board to this shape'}
        </button>
        {choosing && (
          <div role="dialog" aria-label="Choose the wood" className="absolute right-0 top-full z-40 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-stone-300 bg-white p-3 text-stone-900 shadow-xl">
            <label className="flex flex-col text-sm">Cut it from
              <select aria-label="Wood" value={wood} onChange={e => setWood(e.target.value)} className="rounded border border-stone-300 px-2 py-1">
                {choices.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setChoosing(false)} className="rounded px-3 py-1 text-sm hover:bg-stone-100">Cancel</button>
              <button onClick={() => cut(wood)} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Cut it</button>
            </div>
          </div>
        )}
      </div>
      <button disabled={sketch.entities.length === 0} onClick={() => setPrinting(true)} className={`${btn} ${kids ? 'bg-sky-500 text-white' : 'border border-stone-300 bg-white hover:bg-stone-100'}`}>
        {kids ? 'Print it' : 'Print full size'}
      </button>
      {!kids && (
        <>
          <button disabled={sketch.entities.length === 0} onClick={() => void exportAs('dxf')} className={`${btn} border border-stone-300 bg-white hover:bg-stone-100`} title="For a CNC router">Export DXF</button>
          <button disabled={sketch.entities.length === 0} onClick={() => void exportAs('svg')} className={`${btn} border border-stone-300 bg-white hover:bg-stone-100`} title="For a laser or vinyl cutter">Export SVG</button>
        </>
      )}
      {!kids && saved && (
        <button onClick={deleteDrawing} className={`${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`} title="Delete this drawing; parts cut from it become rectangles again (Undo brings it back)">Delete drawing</button>
      )}
      {printing && <FullSizePrint sketch={sketch} onBack={() => setPrinting(false)} />}
    </div>
  )
}
