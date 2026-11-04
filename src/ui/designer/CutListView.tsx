import { useMemo, useRef, useState } from 'react'
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
  const kidsMode = useStudio(s => s.kidsMode)
  const { rows, totals } = useMemo(() => cutList(project), [project])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'csv' | 'print' | null>(null)
  const pending = useRef(false)
  const [tab, setTab] = useState<'cut' | 'layout' | 'buy' | 'labels'>('cut')

  const output = async (kind: 'csv' | 'print') => {
    if (pending.current) return
    pending.current = true
    setBusy(kind)
    setMessage(null)
    setError(null)
    try {
      if (kind === 'csv') {
        const path = await window.aa.exportCsv(cutListCsv(project), project.name)
        if (path) setMessage(`Saved ${path}`)
      } else {
        await window.aa.print(tab === 'labels' ? { landscape: false, edgeToEdge: true } : undefined)
      }
    } catch {
      setError(kind === 'csv' ? 'Could not save the CSV. Check the destination and try again.' : 'Could not complete printing. Check the printer or PDF destination and try again.')
    } finally {
      pending.current = false
      setBusy(null)
    }
  }

  return (
    <div role="dialog" aria-label="Cut list" className={`print-area ${tab === 'labels' ? 'labels-print' : ''} fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-6 print:bg-white print:p-0`}>
      <div className="print-sheet w-full max-w-[1000px] rounded-xl bg-white p-6 shadow-xl print:max-w-none print:shadow-none">
        <div className="print-header mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Cut list — {project.name}</h2>
            <p className="text-xs text-stone-500">A&amp;A Woodworking · finished sizes · lengths are long point to long point</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden" aria-busy={busy !== null}>
            <button type="button" disabled={busy !== null} className="rounded border px-3 py-1 text-sm hover:bg-stone-100 disabled:cursor-wait disabled:opacity-50" onClick={() => void output('print')}>{busy === 'print' ? 'Printing…' : tab === 'labels' ? 'Print labels' : 'Print'}</button>
            <button type="button" disabled={busy !== null} className="rounded border px-3 py-1 text-sm hover:bg-stone-100 disabled:cursor-wait disabled:opacity-50" onClick={() => void output('csv')}>{busy === 'csv' ? 'Saving…' : 'Save as CSV'}</button>
            <button type="button" className="rounded bg-amber-700 px-3 py-1 text-sm text-white" onClick={() => studio.getState().set({ cutListOpen: false })}>Close</button>
          </div>
        </div>
        {message && <p role="status" className="print-message mb-2 text-xs text-green-700 print:hidden">{message}</p>}
        {error && <p role="alert" className="print-message mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800 print:hidden">{error}</p>}
        {!kidsMode && (
          <nav role="tablist" aria-label="Fabrication outputs" className="mb-3 flex flex-wrap gap-1 border-b border-stone-300 print:hidden">
            {([['cut', 'Cut list'], ['layout', 'Layout'], ['buy', 'Buy'], ['labels', 'Labels']] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} disabled={busy !== null} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm disabled:opacity-50 ${tab === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>
            ))}
          </nav>
        )}
        {tab === 'layout' && <LayoutTab />}
        {tab === 'buy' && <BuyTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'cut' && <>
          {rows.length === 0 ? <p className="text-stone-500">No parts yet.</p> : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-stone-400 text-left">
                    {['Qty', 'Part', 'Thickness', 'Width', 'Length', 'Wood', 'Grain', 'Notes'].map(h => <th key={h} scope="col" className="px-2 py-1">{h}</th>)}
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
            </div>
          )}
          <section aria-label="Totals" className="mt-4 flex flex-wrap gap-6 text-sm">
            {Object.entries(totals.boardFeetByWood).map(([w, n]) => <span key={w}><strong>{w}:</strong> {bf(n)}</span>)}
            {Object.entries(totals.sheetsByWood).map(([w, n]) => <span key={w}><strong>{w}:</strong> {n} sheet{n === 1 ? '' : 's'} (estimate)</span>)}
            {totals.cost !== undefined && <span><strong>Estimated cost:</strong> ${totals.cost.toFixed(2)}</span>}
          </section>
          {!kidsMode && <HardwareList />}
        </>}
      </div>
    </div>
  )
}
