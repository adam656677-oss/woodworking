// Checks: interference, weight & balance, and the design's dimensions and notes.
import { useEffect, useMemo, useState } from 'react'
import type { Annotation } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../../ui/store'
import { dimensionLength, editAnnotation, removeAnnotation } from '../annotations'
import { interferences, weigh, type Interference } from '../solids'

const nameOf = (id: string) => studio.getState().project.boards.find(b => b.id === id)?.name ?? '?'
const lb = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} lb`

export function ChecksPanel() {
  const open = useStudio(s => s.checksOpen)
  if (!open) return null
  const close = () => studio.getState().setView({ checksOpen: null })
  const title = open === 'interference' ? 'Interference' : open === 'weight' ? 'Weight & balance' : 'Dimensions & notes'
  return (
    <section aria-label={title} className="mb-3 flex flex-col gap-2 rounded border border-sky-300 bg-sky-50 p-2 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{title}</h3>
        <button aria-label="Close checks" onClick={close} className="px-1 text-stone-500 hover:text-stone-800">✕</button>
      </div>
      {open === 'interference' && <InterferenceCheck />}
      {open === 'weight' && <WeightCheck />}
      {open === 'notes' && <NotesList />}
    </section>
  )
}

function InterferenceCheck() {
  const project = useStudio(s => s.project)
  const [result, setResult] = useState<{ for: typeof project; hits: Interference[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const fresh = result && result.for === project ? result.hits : null
  const run = () => {
    setBusy(true)
    // Let the button show "Checking…" before the solids are worked out.
    setTimeout(() => { setResult({ for: studio.getState().project, hits: interferences(studio.getState().project) }); setBusy(false) }, 0)
  }
  return (
    <>
      <p className="text-xs text-stone-600">Finds parts that run into each other, using their finished shapes. A shelf seated in its dado is fine.</p>
      <button onClick={run} disabled={busy} className="self-start rounded bg-sky-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Check for interference'}</button>
      {result && !fresh && <p className="text-xs text-stone-500">The design has changed — check again.</p>}
      {fresh && fresh.length === 0 && <p role="status" className="text-xs font-semibold text-green-800">✓ No parts run into each other.</p>}
      {fresh && fresh.length > 0 && (
        <ul aria-label="Interferences" className="flex flex-col gap-1">
          {fresh.map(h => (
            <li key={`${h.a}-${h.b}`}>
              <button onClick={() => studio.getState().select([h.a, h.b])} className="w-full rounded bg-red-50 px-2 py-1 text-left text-xs text-red-800 hover:bg-red-100">
                {nameOf(h.a)} and {nameOf(h.b)} run into each other — {h.volume < 0.1 ? h.volume.toFixed(3) : h.volume.toFixed(2)} cu in
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function WeightCheck() {
  const project = useStudio(s => s.project)
  const report = useMemo(() => weigh(project), [project])
  return (
    <>
      <p className="text-lg font-bold" data-testid="total-weight">{lb(report.pounds)}{report.estimated && <span className="text-xs font-normal text-stone-500"> (some woods estimated)</span>}</p>
      {report.centre && <p className="text-xs text-stone-600">Centre of mass (● in the view): X {formatInches(report.centre.x)}, Y {formatInches(report.centre.y)}, Z {formatInches(report.centre.z)}</p>}
      {report.tipping && <p role="alert" className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">⚠ {report.tipping}</p>}
      <table className="text-xs">
        <tbody>
          {[...report.parts].sort((a, b) => b.pounds - a.pounds).map(x => (
            <tr key={x.boardId}><td className="pr-2">{nameOf(x.boardId)}</td><td className="text-right">{lb(x.pounds)}{x.estimated ? '*' : ''}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-stone-500">From each part&apos;s finished shape and its wood&apos;s typical dry weight. Hardware isn&apos;t counted.</p>
    </>
  )
}

function NotesList() {
  const list = useStudio(s => s.project.annotations) ?? []
  const placing = useStudio(s => s.placingNote)
  const pending = useStudio(s => s.pendingNote)
  const [text, setText] = useState('')
  const apply = studio.getState().apply
  return (
    <>
      <p className="text-xs text-stone-600">Use Measure, then <b>Keep</b>, to keep a dimension. Add a note, then click the model where it goes.</p>
      {pending ? (
        <form className="flex gap-1" onSubmit={e => { e.preventDefault(); studio.getState().finishNote(text); setText('') }}>
          <input autoFocus aria-label="Note text" value={text} onChange={e => setText(e.target.value)} className="min-w-0 flex-1 rounded border border-stone-300 px-1" />
          <button type="submit" className="rounded bg-sky-700 px-2 text-xs font-semibold text-white">Add</button>
          <button type="button" onClick={() => studio.getState().finishNote(null)} className="px-1 text-xs">Cancel</button>
        </form>
      ) : (
        <button onClick={() => studio.getState().setView({ placingNote: !placing })} className={`self-start rounded px-3 py-1 text-xs font-semibold ${placing ? 'bg-sky-700 text-white' : 'bg-white ring-1 ring-sky-300'}`}>
          {placing ? 'Click the model…' : 'Add note'}
        </button>
      )}
      <ul aria-label="Dimensions and notes" className="flex flex-col gap-1">
        {list.map(a => (
          <li key={a.id} className="flex items-center gap-1 text-xs">
            <span className="shrink-0">{a.kind === 'note' ? '📝' : '↔'}</span>
            <AnnotationText a={a} />
            {a.kind === 'dimension' && <span className="shrink-0 text-stone-500">{formatInches(dimensionLength(a))}</span>}
            <button aria-label={`Delete ${a.kind}`} onClick={() => apply(p => removeAnnotation(p, a.id))} className="px-1 text-stone-400 hover:text-red-700">✕</button>
          </li>
        ))}
      </ul>
    </>
  )
}

/** A note's text or a dimension's label: follows undo and other changes unless it's being typed in. */
function AnnotationText({ a }: { a: Annotation }) {
  const cur = a.kind === 'note' ? a.text : a.label ?? ''
  const [text, setText] = useState(cur)
  const [typing, setTyping] = useState(false)
  useEffect(() => { if (!typing) setText(cur) }, [cur, typing])
  return (
    <input aria-label={a.kind === 'note' ? 'Note' : 'Dimension label'} value={text} placeholder={a.kind === 'dimension' ? formatInches(dimensionLength(a)) : ''}
      onFocus={() => setTyping(true)} onChange={e => setText(e.target.value)}
      onBlur={() => { setTyping(false); if (text !== cur) studio.getState().apply(p => editAnnotation(p, a.id, text)) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className="min-w-0 flex-1 rounded border border-transparent px-1 hover:border-stone-300" />
  )
}
