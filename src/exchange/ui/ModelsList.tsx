// "Reference models" under the parts list: show/hide, lock, settings, remove.
import type { RefModel } from '../../model/types'
import { InchInput } from '../../ui/designer/InchInput'
import { studio, useStudio } from '../../ui/store'
import { modelSize, removeModel, updateModel } from '../models'
import { formatInches } from '../../model/units'

function Settings({ m }: { m: RefModel }) {
  const set = (patch: Parameters<typeof updateModel>[2]) => studio.getState().apply(p => updateModel(p, m.id, patch))
  const size = modelSize(m)
  return (
    <div className="flex flex-col gap-1 bg-stone-50 px-3 pb-2 text-xs" aria-label={`Settings for ${m.name}`}>
      <span className="text-stone-500">{formatInches(size.x)} × {formatInches(size.y)} × {formatInches(size.z)}</span>
      {!m.locked && (
        <>
          <div className="grid grid-cols-3 gap-1">
            {(['x', 'y', 'z'] as const).map(a => <InchInput key={a} label={`${a.toUpperCase()} of ${m.name}`} allowZero value={m.position[a]} onChange={v => set({ position: { ...m.position, [a]: v } })} />)}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['x', 'y', 'z'] as const).map(a => (
              <label key={a} className="flex flex-col">Turn {a.toUpperCase()}°
                <input aria-label={`Turn ${a.toUpperCase()} of ${m.name}`} type="number" step={90} value={m.rotation[a]} onChange={e => set({ rotation: { ...m.rotation, [a]: Number(e.target.value) || 0 } })} className="rounded border border-stone-300 px-1" />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1">Scale
            <input aria-label={`Scale of ${m.name}`} type="number" min={0.01} step={0.1} value={m.scale} onChange={e => { const v = Number(e.target.value); if (v > 0) set({ scale: v }) }} className="w-20 rounded border border-stone-300 px-1" />
          </label>
        </>
      )}
      <label className="flex items-center gap-1">See-through
        <input aria-label={`Opacity of ${m.name}`} type="range" min={0.1} max={1} step={0.05} value={m.opacity} onChange={e => set({ opacity: Number(e.target.value) })} className="flex-1" />
      </label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={!m.noChecks} onChange={e => set({ noChecks: !e.target.checked })} />Include in the interference and clearance checks</label>
    </div>
  )
}

export function ModelsList() {
  const models = useStudio(s => s.project.models)
  const open = useStudio(s => s.modelOpen)
  if (!models?.length) return null
  const s = studio.getState()
  const set = (m: RefModel, patch: Parameters<typeof updateModel>[2]) => s.apply(p => updateModel(p, m.id, patch))
  return (
    <section aria-label="Reference models" className="border-t border-stone-200">
      <h3 className="px-3 pt-2 text-xs font-bold uppercase tracking-wide text-stone-500">Reference models ({models.length})</h3>
      <ul>
        {models.map(m => (
          <li key={m.id}>
            <div className="flex items-center gap-1 px-3 py-1 text-sm">
              <button onClick={() => s.setView({ modelOpen: open === m.id ? null : m.id })} className="flex-1 truncate text-left hover:underline">{m.name}</button>
              <button aria-label={m.hidden ? `Show ${m.name}` : `Hide ${m.name}`} onClick={() => set(m, { hidden: !m.hidden })} className="px-1">{m.hidden ? '🙈' : '👁'}</button>
              <button aria-label={m.locked ? `Unlock ${m.name}` : `Lock ${m.name}`} onClick={() => set(m, { locked: !m.locked })} className="px-1">{m.locked ? '🔒' : '🔓'}</button>
              <button aria-label={`Remove ${m.name}`} onClick={() => s.apply(p => removeModel(p, m.id))} className="px-1 text-stone-400 hover:text-red-700">✕</button>
            </div>
            {open === m.id && <Settings m={m} />}
          </li>
        ))}
      </ul>
    </section>
  )
}
