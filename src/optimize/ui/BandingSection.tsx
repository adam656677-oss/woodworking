// Properties → Edge banding (sheet goods): which edges, and which banding.
import type { Banding, Board } from '../../model/types'
import { studio, useStudio } from '../../ui/store'
import { BANDINGS, cutSizeText, setBanding } from '../banding'

const EDGES: [Banding['edges'][number], string][] = [['left', 'Left edge'], ['right', 'Right edge'], ['start', 'Start end'], ['end', 'Far end']]

export function BandingSection({ board }: { board: Board }) {
  const wood = useStudio(s => s.project.woods.find(w => w.id === board.woodId))
  if (wood?.kind !== 'sheet') return null
  const b = board.banding
  const set = (next: Banding | null) => studio.getState().apply(p => setBanding(p, [board.id], next))
  const edges = b?.edges ?? []
  const toggle = (e: Banding['edges'][number]) => set({ edges: edges.includes(e) ? edges.filter(x => x !== e) : [...edges, e], bandId: b?.bandId ?? BANDINGS[0].id })
  return (
    <details open={!!b || undefined} className="rounded border border-stone-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Edge banding</summary>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <div className="grid grid-cols-2 gap-1">
          {EDGES.map(([e, l]) => <label key={e} className="flex items-center gap-1"><input type="checkbox" checked={edges.includes(e)} onChange={() => toggle(e)} />{l}</label>)}
        </div>
        <select aria-label="Banding" value={b?.bandId ?? BANDINGS[0].id} disabled={!b} onChange={e => set({ edges, bandId: e.target.value })} className="rounded border border-stone-300 px-1 py-0.5 text-sm">
          {BANDINGS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {b && <span className="text-stone-600">Cut size {cutSizeText(board)} (finished size stays)</span>}
      </div>
    </details>
  )
}
