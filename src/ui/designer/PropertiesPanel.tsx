import { unshapeBoard } from '../../model/shaped'
import { worldBox } from '../../model/geometry'
import { changeWood, moveBoard, rotateBoard, setEdgeBevel, setEndCut, updateBoard } from '../../model/ops'
import type { Board, EndCut, Vec3 } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'
import { NumberInput } from '../common/NumberInput'
import { KID_WOODS, round8 } from '../../kids/kidWords'
import { InchInput } from './InchInput'
import { FormulaInput, type FormulaSet } from '../../formulas/ui/FormulaInput'
import { RulesOnPart } from '../../formulas/ui/RuleDialog'
import { setBoardFormula } from '../../formulas/ops'
import { controlledBy, removeRule, ruleLabel } from '../../formulas/rules'
import type { Project } from '../../model/types'
import { useState } from 'react'
import { TurningSection } from '../../shaping/ui/TurningSection'
import { TaperSection } from '../../shaping/ui/TaperSection'
import { EdgesSection } from '../../shaping/ui/EdgesSection'
import { TurningSheet } from '../../shaping/ui/TurningSheet'
import { TaperSheet } from '../../shaping/ui/TaperSheet'

function AngleInput({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return <NumberInput label={label} value={value} onChange={onChange} min={-60} max={60} step={0.5} />
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
  const live = useStudio(s => s.project.template !== undefined)
  const kidsMode = useStudio(s => s.kidsMode)
  const [sheet, setSheet] = useState<'turning' | 'taper' | null>(null)
  const formulaErrors = useStudio(s => s.formulaErrors)
  const project = useStudio(s => s.project)
  if (selection.length === 0) return <p className="text-sm text-stone-500">Select a part to edit it. Ctrl-click two touching parts to join them.</p>
  if (!board) return <p className="text-sm text-stone-600">{selection.length} parts selected. Use Align, Mirror or Duplicate in the toolbar.</p>

  const apply = studio.getState().apply
  const wb = worldBox(board)
  /** In the Simple Designer every typed size goes to the nearest 1/8". */
  const size = (v: number) => (kidsMode ? round8(v) : v)
  const pos = (v: number) => (kidsMode ? Math.round(v * 8) / 8 : v)
  const woodChoices = kidsMode ? woods.filter(w => KID_WOODS.includes(w.id) || w.id === board.woodId) : woods
  const moveTo = (axis: keyof Vec3, raw: number) => {
    const v = pos(raw)
    const delta = v - wb.min[axis]
    apply(p => moveBoard(p, board.id, { ...board.position, [axis]: board.position[axis] + delta }))
  }

  /** A size or position box that also takes formulas (Master Shop). */
  const formulaBox = (path: 'width' | 'length' | 'x' | 'y' | 'z', label: string, value: number) => {
    const rule = path === 'x' || path === 'y' || path === 'z' ? controlledBy(project, board.id, path) : null
    const plain = (q: Project, v: number): Project => {
      if (path === 'width' || path === 'length') return updateBoard(q, board.id, { [path]: size(v) })
      const b = q.boards.find(x => x.id === board.id)!
      const min = worldBox(b).min[path]
      return moveBoard(q, board.id, { ...b.position, [path]: b.position[path] + v - min })
    }
    const onSet = (s: FormulaSet) => apply(p => {
      if ('formula' in s) return setBoardFormula(p, board.id, path, s.formula)
      let q = setBoardFormula(p, board.id, path, null)
      if (rule) q = removeRule(q, rule.id)
      return plain(q, s.value)
    })
    return (
      <FormulaInput key={path} label={label} value={value} allowZero={path !== 'width' && path !== 'length'}
        disabled={(path === 'width' || path === 'length') && !!board.outline}
        formula={board.formulas?.[path]} error={formulaErrors[`board:${board.id}:${path}`]}
        ruleNote={rule ? `This part is placed by a rule (${ruleLabel(project, rule)}).` : undefined} onSet={onSet} />
    )
  }

  return (
    <div className="flex flex-col gap-3" aria-label="Properties">
      <h2 className="text-sm font-bold">{board.name}</h2>
      {live && (
        <p role="note" className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
          This part belongs to a live template. Change its sizes in the template panel, or Unlock to edit parts freely.
        </p>
      )}
      <label className="flex flex-col gap-0.5 text-xs text-stone-600">
        Wood
        <select
          aria-label="Wood"
          value={board.woodId}
          onChange={e => apply(p => changeWood(p, board.id, e.target.value))}
          className="rounded border border-stone-300 px-1 py-1 text-sm"
        >
          {woodChoices.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-stone-600">Thickness</span>
          <span className="rounded bg-stone-100 px-2 py-1 text-sm" title="Set by the wood">{formatInches(board.thickness)}</span>
        </div>
        {kidsMode ? (
          <>
            <InchInput label="Width" disabled={!!board.outline} value={board.width} onChange={v => apply(p => updateBoard(p, board.id, { width: size(v) }))} />
            <InchInput label="Length" disabled={!!board.outline} value={board.length} onChange={v => apply(p => updateBoard(p, board.id, { length: size(v) }))} />
          </>
        ) : (
          <>
            {formulaBox('width', 'Width', board.width)}
            {formulaBox('length', 'Length', board.length)}
          </>
        )}
      </div>
      {board.outline && (
        <div className="flex flex-col gap-1 text-xs text-stone-600">
          <p>Shaped part — its size comes from its drawing. Use <strong>Edit shape</strong> to change it.</p>
          <button onClick={() => apply(p => unshapeBoard(p, board.id))} className="self-start rounded border border-stone-300 px-2 py-0.5 hover:bg-stone-100">Make it a rectangle again</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {kidsMode ? (
          <>
            <InchInput label="X" allowZero value={wb.min.x} onChange={v => moveTo('x', v)} />
            <InchInput label="Y" allowZero value={wb.min.y} onChange={v => moveTo('y', v)} />
            <InchInput label="Z" allowZero value={wb.min.z} onChange={v => moveTo('z', v)} />
          </>
        ) : (
          <>
            {formulaBox('x', 'X', wb.min.x)}
            {formulaBox('y', 'Y', wb.min.y)}
            {formulaBox('z', 'Z', wb.min.z)}
          </>
        )}
      </div>
      {!kidsMode && <div className="grid grid-cols-3 gap-2" aria-label="Rotation">
        {(['x', 'y', 'z'] as const).map(axis => (
          <NumberInput
            key={axis}
            label={`Turn ${axis.toUpperCase()}°`}
            value={board.rotation[axis]}
            min={-180}
            max={180}
            step={1}
            width="w-14"
            onChange={v => apply(p => rotateBoard(p, board.id, axis, v - board.rotation[axis]))}
          />
        ))}
      </div>}
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
      {!kidsMode && <RulesOnPart key={`r${board.id}`} board={board} />}
      {!kidsMode && <TurningSection key={`t${board.id}`} board={board} onSheet={() => setSheet('turning')} />}
      {!kidsMode && <TaperSection key={`p${board.id}`} board={board} onSheet={() => setSheet('taper')} />}
      <EdgesSection key={`e${board.id}`} board={board} kids={kidsMode} />
      {sheet === 'turning' && board.turning && <TurningSheet board={board} onClose={() => setSheet(null)} />}
      {sheet === 'taper' && board.taper && <TaperSheet board={board} onClose={() => setSheet(null)} />}
      {!kidsMode && <details open={board.endCuts.start.miter !== 0 || board.endCuts.end.miter !== 0 || undefined}>
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
      </details>}
    </div>
  )
}
