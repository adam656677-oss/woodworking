import { useMemo, useState } from 'react'
import { cutList, cutListCsv } from '../../model/cutlist'
import { formatInches } from '../../model/units'
import { studio, useStudio } from '../store'
import { HardwareList } from '../../cabinet/ui/HardwareList'
import { LayoutTab } from '../../optimize/ui/LayoutTab'
import { BuyTab } from '../../optimize/ui/BuyTab'
import { LabelsTab } from '../../optimize/ui/LabelsTab'

const bf = (n: number) => `${Number(n.toFixed(2))} bd ft`

export function CutListView() {
  const project = useStudio(s => s.project)
  const { rows, totals } = useMemo(() => cutList(project), [project])
  const [message, setMessage] = useState<string | null>(null)
  const [tab, setTab] = useState<'cut' | 'layout' | 'buy' | 'labels'>('cut')
  const s = studio.getState()

  const saveCsv = async () => {
    const path = await window.aa.exportCsv(cutListCsv(project), project.name)
    if (path) setMessage(`Saved ${path}`)
  }

  return (
    <div role="dialog" aria-label="Cut list" className="print-area fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:bg-white print:p-0">
      <div className="w-[1000px] rounded-xl bg-white p-6 shadow-xl print:w-full print:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Cut list — {project.name}</h2>
            <p className="text-xs text-stone-500">A&amp;A Woodworking · finished sizes · lengths are long point to long point</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => void window.aa.print(tab === 'labels' ? { landscape: false } : undefined)}>{tab === 'labels' ? 'Print labels' : 'Print'}</button>
            <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => void saveCsv()}>Save as CSV</button>
            <button className="rounded bg-amber-700 px-3 py-1 text-sm text-white" onClick={() => s.set({ cutListOpen: false })}>Close</button>
          </div>
        </div>
        {message && <p className="mb-2 text-xs text-green-700 print:hidden">{message}</p>}
        {!s.kidsMode && (
          <nav role="tablist" className="mb-3 flex gap-1 border-b border-stone-300 print:hidden">
            {([['cut', 'Cut list'], ['layout', 'Layout'], ['buy', 'Buy'], ['labels', 'Labels']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm ${tab === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>
            ))}
          </nav>
        )}
        {tab === 'layout' && <LayoutTab />}
        {tab === 'buy' && <BuyTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'cut' && <>
        {rows.length === 0 ? (
          <p className="text-stone-500">No parts yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-stone-400 text-left">
                {['Qty', 'Part', 'Thickness', 'Width', 'Length', 'Wood', 'Grain', 'Notes'].map(h => <th key={h} className="px-2 py-1">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-stone-200 align-top">
                  <td className="px-2 py-1 font-semibold">{r.qty}</td>
                  <td className="px-2 py-1">{r.part}</td>
                  <td className="px-2 py-1">{formatInches(r.thickness)}</td>
                  <td className="px-2 py-1">{formatInches(r.width)}{r.cutWidth !== undefined && r.cutWidth !== r.width && <div className="text-xs text-amber-800">cut {formatInches(r.cutWidth)}</div>}</td>
                  <td className="px-2 py-1">{formatInches(r.length)}{r.cutLength !== undefined && r.cutLength !== r.length && <div className="text-xs text-amber-800">cut {formatInches(r.cutLength)}</div>}</td>
                  <td className="px-2 py-1">{r.woodName}</td>
                  <td className="px-2 py-1">{r.grain}</td>
                  <td className="px-2 py-1 text-xs">{r.notes.map((n, k) => <div key={k}>{n}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <section aria-label="Totals" className="mt-4 flex flex-wrap gap-6 text-sm">
          {Object.entries(totals.boardFeetByWood).map(([w, n]) => <span key={w}><strong>{w}:</strong> {bf(n)}</span>)}
          {Object.entries(totals.sheetsByWood).map(([w, n]) => <span key={w}><strong>{w}:</strong> {n} sheet{n === 1 ? '' : 's'} (estimate)</span>)}
          {totals.cost !== undefined && <span><strong>Estimated cost:</strong> ${totals.cost.toFixed(2)}</span>}
        </section>
        {!s.kidsMode && <HardwareList />}
        </>}
      </div>
    </div>
  )
}
