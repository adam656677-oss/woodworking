// The hardware list, under the cut list (and printed with it): what to buy, where it goes, and what it costs.
import { useMemo, useState } from 'react'
import type { HardwareKind } from '../../model/types'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../../ui/store'
import { addHardware, addItem, hardwareItems, hardwareList, removeHardware, setHardwareQty, setItemPrice } from '../hardware'

const money = (n: number) => `$${n.toFixed(2)}`
/** Glass is listed by size ("12.125 × 27.125" → 12-1/8" × 27-1/8"). */
export const sizeText = (note?: string) => {
  const m = note ? /^([\d.]+) × ([\d.]+)$/.exec(note) : null
  return m ? `${formatInches(Number(m[1]))} × ${formatInches(Number(m[2]))}` : note
}

export function HardwareList() {
  const project = useStudio(s => s.project)
  const { rows, total } = useMemo(() => hardwareList(project), [project])
  const items = useMemo(() => hardwareItems(project), [project])
  const [pick, setPick] = useState(items[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [own, setOwn] = useState({ name: '', kind: 'other' as HardwareKind, price: '' })
  const apply = studio.getState().apply
  return (
    <section aria-label="Hardware" className="mt-6">
      <h3 className="mb-2 text-lg font-bold">Hardware</h3>
      {rows.length === 0 ? <p className="text-sm text-stone-500">No hardware yet — doors, drawers and shelf pins add theirs.</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-stone-400 text-left">{['Qty', 'Item', 'Where', 'Each', 'Total', ''].map(h => <th key={h} className="px-2 py-1">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.useIds.join()} className="border-b border-stone-200">
                <td className="px-2 py-1 font-semibold">
                  {r.useIds.length === 1 ? (
                    <input aria-label={`How many ${r.name}`} type="number" min={0} defaultValue={r.qty} key={`${r.useIds[0]}:${r.qty}`}
                      onBlur={e => { const t = e.target.value.trim(); const v = Number(t); if (t !== '' && Number.isFinite(v) && v !== r.qty) apply(p => setHardwareQty(p, r.useIds[0], v)); else e.target.value = String(r.qty) }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="w-14 rounded border border-stone-300 px-1 print:border-0" />
                  ) : r.qty}
                </td>
                <td className="px-2 py-1">{r.name}{r.note && <span className="text-stone-600"> — {sizeText(r.note)}</span>}</td>
                <td className="px-2 py-1 text-xs">{r.where}</td>
                <td className="px-2 py-1">
                  <input aria-label={`Price of ${r.name}`} defaultValue={r.unit.toFixed(2)} key={`${r.itemId}:${r.unit}`} onBlur={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== r.unit) apply(p => setItemPrice(p, r.itemId, v)) }}
                    className="w-16 rounded border border-stone-300 px-1 print:border-0" />
                </td>
                <td className="px-2 py-1">{money(r.total)}</td>
                <td className="px-2 py-1 print:hidden"><button aria-label={`Remove ${r.name}`} onClick={() => apply(p => r.useIds.reduce((q, id) => removeHardware(q, id), p))} className="px-1 text-stone-400 hover:text-red-700">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && <p className="mt-2 text-sm"><strong>Hardware total:</strong> {money(total)}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-2 text-xs print:hidden">
        <label className="flex flex-col">Add from the library
          <select aria-label="Hardware item" value={pick} onChange={e => setPick(e.target.value)} className="rounded border border-stone-300 px-1 py-1">
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <input aria-label="Quantity" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className="w-14 rounded border border-stone-300 px-1 py-1" />
        <button onClick={() => { const n = Math.round(Number(qty)); if (n > 0 && pick) apply(p => addHardware(p, { itemId: pick, qty: n })) }} className="rounded bg-amber-700 px-2 py-1 font-semibold text-white">Add</button>
        <span className="mx-2 h-6 w-px bg-stone-300" />
        <label className="flex flex-col">Your own item
          <input aria-label="New item name" placeholder="Name" value={own.name} onChange={e => setOwn({ ...own, name: e.target.value })} className="rounded border border-stone-300 px-1 py-1" />
        </label>
        <input aria-label="New item price" placeholder="Price" value={own.price} onChange={e => setOwn({ ...own, price: e.target.value })} className="w-16 rounded border border-stone-300 px-1 py-1" />
        <button onClick={() => {
          const price = Number(own.price || 0)
          if (!own.name.trim() || !(price >= 0)) return
          let id = ''
          apply(p => { const r = addItem(p, { name: own.name.trim(), kind: own.kind, price }); id = r.id; return r.project })
          setPick(id); setOwn({ name: '', kind: 'other', price: '' })
        }} className="rounded bg-stone-700 px-2 py-1 font-semibold text-white">Add to the library</button>
      </div>
    </section>
  )
}
