import { useState } from 'react'
import type { Board } from '../../model/types'
import { formatInches } from '../../model/units'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { editTurning } from '../../sketch/ui/session'
import { blankOf, isSquareBlank, MSG_SQUARE, profileRadii, turnBoard, turningProblem, unturnBoard, type TurnOptions } from '../turning'
import type { TurnStyle } from '../types'

export const STYLE_NAMES: Record<TurnStyle, string> = { taper: 'Straight taper', beadCove: 'Bead & cove', vase: 'Vase', ballFoot: 'Ball foot', custom: 'Custom (drawn)' }

export function TurningSection({ board, onSheet }: { board: Board; onSheet(): void }) {
  const project = useStudio(s => s.project)
  const [error, setError] = useState<string | null>(null)
  const t = board.turning
  const radii = t ? profileRadii(project, board) : null
  const maxD = t?.maxD ?? (radii ? Math.max(...radii.map(q => q.r)) * 2 : blankOf(board) - 1 / 16)
  const minD = t?.minD ?? (radii ? Math.min(...radii.map(q => q.r)) * 2 : blankOf(board) * 0.4)
  const run = (o: Partial<TurnOptions>) => {
    const style = (o.style ?? (t && t.style !== 'custom' ? t.style : 'vase')) as TurnOptions['style']
    const r = turnBoard(studio.getState().project, board.id, { style, top: t?.top, bottom: t?.bottom, shoulder: t?.shoulder, ...o })
    if ('error' in r) return setError(r.error)
    setError(null)
    studio.getState().apply(() => r.project)
  }
  const problem = t ? turningProblem(project, board) : null
  return (
    <details open={!!t || undefined} className="rounded border border-stone-200 p-2">
      <summary className="cursor-pointer text-sm font-semibold">Turning</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        {!t && (
          <>
            <p className="text-xs text-stone-600">Square at the top where the aprons join, turned round below.</p>
            <button onClick={() => (isSquareBlank(board) ? run({ style: 'vase' }) : setError(MSG_SQUARE))} className="self-start rounded bg-amber-700 px-3 py-1 font-semibold text-white">Turn this leg</button>
          </>
        )}
        {t && (
          <>
            <label className="flex flex-col text-xs text-stone-600">Style
              <select aria-label="Turning style" value={t.style} onChange={e => run({ style: e.target.value as TurnOptions['style'] })} className="rounded border border-stone-300 px-1 py-1 text-sm">
                {(['taper', 'beadCove', 'vase', 'ballFoot'] as const).map(s => <option key={s} value={s}>{STYLE_NAMES[s]}</option>)}
                {t.style === 'custom' && <option value="custom" disabled>{STYLE_NAMES.custom}</option>}
              </select>
            </label>
            {t.style === 'custom' && <p className="text-xs text-stone-600">Drawn by hand — change it with Edit profile. Picking a style starts the profile over.</p>}
            {t.style !== 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <InchInput label="Top pommel" allowZero value={t.top} onChange={v => run({ top: v })} />
                <InchInput label="Square foot" allowZero value={t.bottom} onChange={v => run({ bottom: v })} />
                <InchInput label="Biggest diameter" value={maxD} onChange={v => run({ maxD: v })} />
                <InchInput label="Smallest diameter" value={minD} onChange={v => run({ minD: v })} />
                <label className="col-span-2 flex flex-col text-xs text-stone-600">Shoulder
                  <select aria-label="Shoulder" value={t.shoulder} onChange={e => run({ shoulder: e.target.value as 'crisp' | 'lambsTongue' })} className="rounded border border-stone-300 px-1 py-1 text-sm">
                    <option value="crisp">Crisp shoulder</option>
                    <option value="lambsTongue">Rounded (lamb&apos;s tongue)</option>
                  </select>
                </label>
              </div>
            )}
            <p className="text-xs text-stone-600">Blank {formatInches(board.width)} square · turned from {formatInches(maxD)} down to {formatInches(minD)}</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => void editTurning(board)} className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100">Edit profile</button>
              <button disabled={!!problem} onClick={onSheet} className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100 disabled:opacity-40">Turning sheet</button>
              <button onClick={() => studio.getState().apply(p => unturnBoard(p, board.id))} className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100">Remove turning</button>
            </div>
          </>
        )}
        {(error || problem) && <p role="alert" className="text-xs text-red-700">{error ?? problem}</p>}
      </div>
    </details>
  )
}
