import { useState } from 'react'
import { findTemplate, unlock, updateTemplateParams } from '../../templates'
import { studio, useStudio } from '../store'
import { InchInput } from './InchInput'

/** Live template sizes, plus Unlock to switch to free-form editing. */
export function TemplatePanel() {
  const template = useStudio(s => s.project.template)
  const woods = useStudio(s => s.project.woods)
  const [confirming, setConfirming] = useState(false)
  if (!template) return null
  const def = findTemplate(template.templateId)
  if (!def) return null
  const apply = studio.getState().apply
  const set = (key: string, value: number | boolean | string) => apply(p => updateTemplateParams(p, { [key]: value }))

  return (
    <section aria-label="Template" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <h2 className="mb-2 text-sm font-bold">{def.name} template</h2>
      <div className="flex flex-col gap-2">
        {def.params.map(p => {
          const v = template.params[p.key]
          if (p.kind === 'inches') return <InchInput key={p.key} label={p.label} value={v as number} allowZero={p.min === 0} onChange={x => set(p.key, x)} />
          if (p.kind === 'count') {
            return (
              <label key={p.key} className="flex items-center justify-between text-xs text-stone-600">
                {p.label}
                <input type="number" aria-label={p.label} min={p.min} max={p.max} value={v as number}
                  onChange={e => set(p.key, Number(e.target.value))} className="w-16 rounded border border-stone-300 px-1 text-right text-sm" />
              </label>
            )
          }
          if (p.kind === 'bool') {
            return (
              <label key={p.key} className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={Boolean(v)} onChange={e => set(p.key, e.target.checked)} /> {p.label}
              </label>
            )
          }
          const options = p.kind === 'wood' ? woods.map(w => ({ value: w.id, label: w.name })) : (p.options ?? []).map(o => ({ value: o, label: o }))
          return (
            <label key={p.key} className="flex flex-col gap-0.5 text-xs text-stone-600">
              {p.label}
              <select aria-label={p.label} value={String(v)} onChange={e => set(p.key, e.target.value)} className="rounded border border-stone-300 px-1 py-1 text-sm">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )
        })}
      </div>
      {confirming ? (
        <div className="mt-3 rounded bg-white p-2 text-xs">
          <p>Unlock to edit boards freely? The template sizes will stop updating. (You can undo.)</p>
          <div className="mt-2 flex gap-2">
            <button className="rounded bg-amber-700 px-3 py-1 text-white" onClick={() => { apply(unlock); setConfirming(false) }}>Unlock</button>
            <button className="rounded border px-3 py-1" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="mt-3 w-full rounded border border-amber-700 py-1 text-sm hover:bg-amber-100" onClick={() => setConfirming(true)}>Unlock for free-form editing</button>
      )}
    </section>
  )
}
