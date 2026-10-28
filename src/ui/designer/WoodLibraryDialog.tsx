import { useState } from 'react'
import type { Wood, WoodKind } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'
import { InchInput } from './InchInput'

type Draft = { name: string; species: string; kind: WoodKind; thickness: number; width: number; length: number; price: string }
const blank: Draft = { name: '', species: '', kind: 'hardwood', thickness: 0.75, width: 6, length: 96, price: '' }

export function WoodLibraryDialog() {
  const projectWoods = useStudio(s => s.project.woods)
  const userWoods = useStudio(s => s.userWoods)
  const [draft, setDraft] = useState<Draft>(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const s = studio.getState()
  const builtIn = projectWoods.filter(w => w.builtIn)

  const priceFields = (d: Draft): Partial<Wood> => {
    const n = Number(d.price)
    if (d.price.trim() === '' || !Number.isFinite(n)) return { pricePerBoardFoot: undefined, pricePerSheet: undefined }
    return d.kind === 'sheet' ? { pricePerSheet: n, pricePerBoardFoot: undefined } : { pricePerBoardFoot: n, pricePerSheet: undefined }
  }
  const submit = async () => {
    if (!draft.name.trim()) return
    const w = { name: draft.name.trim(), species: draft.species.trim() || draft.name.trim(), kind: draft.kind, thickness: draft.thickness, width: draft.width, length: draft.length, ...priceFields(draft) }
    if (editing) await s.updateUserWood(editing, w)
    else await s.addUserWood(w)
    setDraft(blank)
    setEditing(null)
  }

  return (
    <div role="dialog" aria-label="Wood library" className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="max-h-[90%] w-[720px] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Wood library</h2>
          <button aria-label="Close" onClick={() => s.set({ woodsOpen: false })} className="text-xl">✕</button>
        </div>
        <h3 className="text-sm font-semibold">My stock</h3>
        {userWoods.length === 0 && <p className="text-sm text-stone-500">Nothing yet — add the boards you have in the shop below.</p>}
        <ul className="mb-3">
          {userWoods.map(w => (
            <li key={w.id} className="flex items-center justify-between border-b py-1 text-sm">
              <span>{w.name} — {formatInches(w.thickness)} × {formatInches(w.width)} × {formatInches(w.length)}{w.pricePerBoardFoot !== undefined ? ` · $${w.pricePerBoardFoot}/bd ft` : ''}{w.pricePerSheet !== undefined ? ` · $${w.pricePerSheet}/sheet` : ''}</span>
              <span className="flex gap-2">
                <button className="text-amber-800 underline" onClick={() => { setEditing(w.id); setDraft({ ...w, price: String(w.pricePerBoardFoot ?? w.pricePerSheet ?? '') }) }}>Edit</button>
                <button className="text-red-700 underline" onClick={() => void s.removeUserWood(w.id)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-stone-200 p-3">
          <h3 className="mb-2 text-sm font-semibold">{editing ? 'Edit stock' : 'Add stock'}</h3>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col text-xs">Name<input aria-label="Name" className="rounded border px-2 py-1 text-sm" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="flex flex-col text-xs">Species<input aria-label="Species" className="rounded border px-2 py-1 text-sm" value={draft.species} onChange={e => setDraft({ ...draft, species: e.target.value })} /></label>
            <label className="flex flex-col text-xs">Kind
              <select aria-label="Kind" className="rounded border px-1 py-1 text-sm" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as WoodKind })}>
                <option value="hardwood">Hardwood board</option><option value="lumber">Dimensional lumber</option><option value="sheet">Sheet good</option>
              </select>
            </label>
            <InchInput label="Thickness" value={draft.thickness} onChange={v => setDraft({ ...draft, thickness: v })} />
            <InchInput label="Width" value={draft.width} onChange={v => setDraft({ ...draft, width: v })} />
            <InchInput label="Length" value={draft.length} onChange={v => setDraft({ ...draft, length: v })} />
            <label className="flex flex-col text-xs">{draft.kind === 'sheet' ? 'Price per sheet ($)' : 'Price per board foot ($)'}
              <input aria-label="Price" className="rounded border px-2 py-1 text-sm" inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="rounded bg-amber-700 px-4 py-1 text-sm text-white disabled:opacity-40" disabled={!draft.name.trim()} onClick={() => void submit()}>{editing ? 'Save changes' : 'Add to my stock'}</button>
            {editing && <button className="rounded border px-3 py-1 text-sm" onClick={() => { setEditing(null); setDraft(blank) }}>Cancel</button>}
          </div>
        </div>
        <h3 className="mt-4 text-sm font-semibold">Built in</h3>
        <ul className="grid grid-cols-2 gap-x-4 text-xs text-stone-600">
          {builtIn.map(w => <li key={w.id}>{w.name} — {formatInches(w.thickness)} × {formatInches(w.width)} × {formatInches(w.length)}</li>)}
        </ul>
      </div>
    </div>
  )
}
