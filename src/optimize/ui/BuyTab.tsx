// The Buy tab: everything to buy, with prices and a total.
import { useEffect, useMemo } from 'react'
import { tools, useTools } from '../../tools/store'
import { studio, useStudio } from '../../ui/store'
import { setCutOption } from '../settings'
import { shoppingList } from '../shopping'
import { useStock } from '../stockStore'

const money = (n: number) => `$${n.toFixed(2)}`
const SECTIONS = [['wood', 'Wood'], ['banding', 'Edge banding'], ['hardware', 'Hardware'], ['finish', 'Finishes']] as const

export function BuyTab() {
  const project = useStudio(s => s.project)
  const items = useStock(s => s.items)
  const inventory = useTools(s => s.inventory)
  useEffect(() => { if (!tools.getState().loaded) void tools.getState().load() }, [])
  const list = useMemo(() => shoppingList(project, items, inventory), [project, items, inventory])
  const tax = project.cutSettings?.tax ?? 0
  const waste = Math.round((project.cutSettings?.hardwoodWaste ?? 0.2) * 100)
  return (
    <section aria-label="Shopping list" className="flex flex-col gap-3">
      {SECTIONS.map(([k, title]) => {
        const lines = list.lines.filter(l => l.section === k)
        if (!lines.length) return null
        return (
          <div key={k}>
            <h3 className="mb-1 font-bold">{title}</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-stone-200">
                    <td className="w-20 px-2 py-1 font-semibold">{l.qty} {l.unit}{l.qty === 1 || l.unit === 'bd ft' || l.unit === 'ft' ? '' : 's'}</td>
                    <td className="px-2 py-1">{l.what}</td>
                    <td className="w-24 px-2 py-1 text-right">{l.each !== undefined ? money(l.each) : '—'}</td>
                    <td className="w-24 px-2 py-1 text-right">{l.total !== undefined ? money(l.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
      <div className="flex flex-wrap items-end gap-4 text-sm print:hidden">
        <label className="flex flex-col text-xs">Sales tax %<input aria-label="Sales tax" type="number" min={0} step={0.25} value={tax} onChange={e => studio.getState().apply(p => setCutOption(p, { tax: Math.max(0, Number(e.target.value) || 0) }))} className="w-20 rounded border border-stone-300 px-1" /></label>
        <label className="flex flex-col text-xs">Hardwood waste %<input aria-label="Hardwood waste" type="number" min={0} max={200} value={waste} onChange={e => studio.getState().apply(p => setCutOption(p, { hardwoodWaste: Math.max(0, Number(e.target.value) || 0) / 100 }))} className="w-20 rounded border border-stone-300 px-1" /></label>
      </div>
      <div aria-label="Totals" className="ml-auto flex w-72 flex-col gap-0.5 text-sm">
        {SECTIONS.map(([k, title]) => (list.byKind[k] ? <div key={k} className="flex justify-between"><span>{title}</span><span>{money(list.byKind[k])}</span></div> : null))}
        {tax > 0 && <div className="flex justify-between"><span>Tax ({tax}%)</span><span>{money(list.tax)}</span></div>}
        <div className="flex justify-between border-t border-stone-400 pt-1 font-bold"><span>Total</span><span data-testid="buy-total">{money(list.total)}</span></div>
        {list.missing > 0 && <p className="text-xs text-amber-800">{list.missing} item{list.missing === 1 ? " has" : 's have'} no price (—) and {list.missing === 1 ? "isn't" : "aren't"} in the total. Add prices in Woods.</p>}
      </div>
    </section>
  )
}
