import { worldBox } from '../../model/geometry'
import { moveBoard, setEdgeBevel, setEndCut, updateBoard } from '../../model/ops'
import type { Board, EndCut, Vec3 } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'
import { InchInput } from './InchInput'

function AngleInput({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-stone-600">
      {label}
      <input
        type="number"
        min={-60}
        max={60}
        step={0.5}
        aria-label={label}
        defaultValue={value}
        key={value}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onBlur={e => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v !== value) onChange(v)
        }}
        className="w-20 rounded border border-stone-300 px-1 py-0.5 text-right text-sm"
      />
    </label>
  )
}

function EndControls({ board, end }: { board: Board; end: 'start' | 'end' }) {
  const cut = board.endCuts[end]
  const set = (patch: Partial<EndCut>) => studio.getState().apply(p => setEndCut(p, board.id, end, patch))
  const label = end === 'start' ? 'Start end' : 'Far end'
  return (
    <div className="rounded border border-stone-200 p-2">
      <div className="mb-1 text-xs font-semibold">{label}</div>
      <AngleInput label={`${label} miter°`} value={cut.miter} onChange={v => set({ miter: v })} />
      <AngleInput label={`${label} bevel°`} value={cut.bevel} onChange={v => set({ bevel: v })} />
      <div className="mt-1 flex gap-1">
        <button className="rounded bg-stone-200 px-2 text-xs hover:bg-stone-300" onClick={() => set({ miter: 45 })}>45°</button>
        <button className="rounded bg-stone-200 px-2 text-xs hover:bg-stone-300" onClick={() => set({ miter: 22.5 })}>22-1/2°</button>
        <button className="rounded bg-stone-200 px-2 text-xs hover:bg-stone-300" onClick={() => set({ miter: 0, bevel: 0 })}>Square</button>
      </div>
    </div>
  )
}

export function PropertiesPanel() {
  const selection = useStudio(s => s.selection)
  const board = useStudio(s => (s.selection.length === 1 ? s.project.boards.find(b => b.id === s.selection[0]) : undefined))
  const woods = useStudio(s => s.project.woods)
  if (selection.length === 0) return <p className="text-sm text-stone-500">Select a part to edit it. Ctrl-click two touching parts to join them.</p>
  if (!board) return <p className="text-sm text-stone-600">{selection.length} parts selected. Use Align, Mirror or Duplicate in the toolbar.</p>

  const apply = studio.getState().apply
  const wb = worldBox(board)
  const moveTo = (axis: keyof Vec3, v: number) => {
    const delta = v - wb.min[axis]
    apply(p => moveBoard(p, board.id, { ...board.position, [axis]: board.position[axis] + delta }))
  }

  return (
    <div className="flex flex-col gap-3" aria-label="Properties">
      <h2 className="text-sm font-bold">{board.name}</h2>
      <label className="flex flex-col gap-0.5 text-xs text-stone-600">
        Wood
        <select
          aria-label="Wood"
          value={board.woodId}
          onChange={e => {
            const w = woods.find(x => x.id === e.target.value)
            if (w) apply(p => updateBoard(p, board.id, { woodId: w.id, thickness: w.thickness }))
          }}
          className="rounded border border-stone-300 px-1 py-1 text-sm"
        >
          {woods.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-stone-600">Thickness</span>
          <span className="rounded bg-stone-100 px-2 py-1 text-sm" title="Set by the wood">{formatInches(board.thickness)}</span>
        </div>
        <InchInput label="Width" value={board.width} onChange={v => apply(p => updateBoard(p, board.id, { width: v }))} />
        <InchInput label="Length" value={board.length} onChange={v => apply(p => updateBoard(p, board.id, { length: v }))} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <InchInput label="X" allowZero value={wb.min.x} onChange={v => moveTo('x', v)} />
        <InchInput label="Y" allowZero value={wb.min.y} onChange={v => moveTo('y', v)} />
        <InchInput label="Z" allowZero value={wb.min.z} onChange={v => moveTo('z', v)} />
      </div>
      <label className="flex items-center justify-between text-xs text-stone-600">
        Grain runs along
        <select
          aria-label="Grain"
          value={board.grain}
          onChange={e => apply(p => updateBoard(p, board.id, { grain: e.target.value as Board['grain'] }))}
          className="rounded border border-stone-300 px-1 text-sm"
        >
          <option value="length">length</option>
          <option value="width">width</option>
        </select>
      </label>
      <details open={board.endCuts.start.miter !== 0 || board.endCuts.end.miter !== 0 || undefined}>
        <summary className="cursor-pointer text-sm font-semibold">Ends &amp; edges</summary>
        <div className="mt-2 flex flex-col gap-2">
          <EndControls board={board} end="start" />
          <EndControls board={board} end="end" />
          <div className="rounded border border-stone-200 p-2">
            <div className="mb-1 text-xs font-semibold">Edge bevels</div>
            <AngleInput label="Left edge bevel°" value={board.edgeBevels.left} onChange={v => apply(p => setEdgeBevel(p, board.id, 'left', v))} />
            <AngleInput label="Right edge bevel°" value={board.edgeBevels.right} onChange={v => apply(p => setEdgeBevel(p, board.id, 'right', v))} />
          </div>
        </div>
      </details>
    </div>
  )
}
