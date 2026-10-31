// Shop Tools: the calculators, the shop journal and the inventory.
import { useEffect, useState } from 'react'
import { HARDWARE } from '../../cabinet/hardware'
import { FINISHES } from '../../finish/finishes'
import { StockPanel } from '../../optimize/ui/LayoutTab'
import { studio, useStudio, type Screen } from '../../ui/store'
import { journalTotals, lowStock, newItemId, thumbnail, tools, useTools, type Cost, type FinishStock } from '../store'
import { Calculator, CALCS, type CalcId } from './Calculators'

type Tab = 'calc' | 'journal' | 'inventory'
let backTo: Screen = 'home'
let startTab: Tab = 'calc'
export function openShopTools(from: Screen, tab: Tab = 'calc') { backTo = from; startTab = tab; studio.getState().goto('tools') }

export function ShopTools() {
  const [tab, setTab] = useState<Tab>(startTab)
  const loaded = useTools(s => s.loaded)
  useEffect(() => { if (!loaded) void tools.getState().load() }, [loaded])
  return (
    <main className="flex h-full flex-col bg-stone-50">
      <header className="flex items-center gap-4 border-b border-stone-300 bg-white px-4 py-2">
        <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => studio.getState().goto(backTo)}>← Back</button>
        <h1 className="text-xl font-bold">Shop Tools</h1>
        <nav role="tablist" className="flex gap-1">
          {([['calc', 'Calculators'], ['journal', 'Shop journal'], ['inventory', 'Inventory']] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1 text-sm ${tab === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>)}
        </nav>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'calc' && <Calcs />}
        {tab === 'journal' && (loaded ? <Journal /> : <p>Loading…</p>)}
        {tab === 'inventory' && (loaded ? <InventoryView /> : <p>Loading…</p>)}
      </div>
    </main>
  )
}

function Calcs() {
  const [id, setId] = useState<CalcId>('bf')
  return (
    <div className="flex gap-6">
      <ul aria-label="Calculators" className="w-56 shrink-0">
        {CALCS.map(([k, l]) => <li key={k}><button onClick={() => setId(k)} className={`w-full rounded px-2 py-1 text-left text-sm ${k === id ? 'bg-amber-100 font-semibold' : 'hover:bg-stone-100'}`}>{l}</button></li>)}
      </ul>
      <section aria-label={CALCS.find(c => c[0] === id)![1]} className="max-w-3xl flex-1"><h2 className="mb-3 text-xl font-bold">{CALCS.find(c => c[0] === id)![1]}</h2><Calculator key={id} id={id} /></section>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const hm = (m: number) => `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`

function Journal() {
  const project = useStudio(s => s.project)
  const journal = useTools(s => s.journal)
  const shopMinutes = Object.values(project.shopProgress?.minutes ?? {}).reduce((a, b) => a + b, 0)
  const totals = journalTotals(journal, project.name, shopMinutes)
  const [notes, setNotes] = useState('')
  const [minutes, setMinutes] = useState('')
  const [started, setStarted] = useState<number | null>(null)
  const [costs, setCosts] = useState<Cost[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [costWhat, setCostWhat] = useState(''), [costAmt, setCostAmt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const add = () => {
    const m = started !== null ? (Date.now() - started) / 60000 : Number(minutes) || 0
    tools.getState().addEntry({ date: today(), project: project.name, notes: notes.trim(), minutes: Math.round(m), photos, costs })
    setNotes(''); setMinutes(''); setCosts([]); setPhotos([]); setStarted(null)
  }
  const mine = journal.filter(e => e.project === project.name).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <section aria-label="Totals" className="rounded-lg bg-white p-3 shadow-sm">
        <h2 className="font-bold">{project.name}</h2>
        <p className="text-sm">Time: {hm(totals.minutes)} (journal {hm(totals.minutes - shopMinutes)}, Shop Mode {hm(shopMinutes)}) · Spent: ${totals.cost.toFixed(2)} · {totals.entries} entr{totals.entries === 1 ? 'y' : 'ies'}</p>
      </section>
      <section aria-label="New entry" className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm">
        <textarea aria-label="Notes" placeholder="What did you do today?" value={notes} onChange={e => setNotes(e.target.value)} className="h-20 rounded border px-2 py-1 text-sm" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">Minutes <input aria-label="Minutes" value={minutes} onChange={e => setMinutes(e.target.value)} disabled={started !== null} className="w-16 rounded border px-1" /></label>
          <button className="rounded border px-2" onClick={() => setStarted(started === null ? Date.now() : null)}>{started === null ? 'Start timer' : 'Stop timer'}</button>
          <input aria-label="Cost item" placeholder="Bought…" value={costWhat} onChange={e => setCostWhat(e.target.value)} className="w-40 rounded border px-1" />
          <input aria-label="Cost amount" placeholder="$" value={costAmt} onChange={e => setCostAmt(e.target.value)} className="w-16 rounded border px-1" />
          <button className="rounded border px-2" onClick={() => { const a = Number(costAmt); if (costWhat.trim() && a >= 0) { setCosts([...costs, { what: costWhat.trim(), amount: a }]); setCostWhat(''); setCostAmt('') } }}>Add cost</button>
          <label className="cursor-pointer rounded border px-2">Add photo<input aria-label="Photo" type="file" accept="image/*" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]
            if (!f) return
            try { setPhotos([...photos, await thumbnail(f)]) } catch (err) { setError((err as Error).message) }
          }} /></label>
        </div>
        {costs.length > 0 && <p className="text-xs">Costs: {costs.map(c => `${c.what} $${c.amount.toFixed(2)}`).join(', ')}</p>}
        {photos.length > 0 && <div className="flex gap-2">{photos.map((p, i) => <img key={i} src={p} alt={`New photo ${i + 1}`} className="h-16 rounded border" />)}</div>}
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <button disabled={!notes.trim() && !costs.length && !photos.length && !minutes && started === null} onClick={add} className="self-start rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-40">Add to the journal</button>
      </section>
      <ol aria-label="Journal entries" className="flex flex-col gap-2">
        {mine.map(e => (
          <li key={e.id} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm"><b>{e.date}</b><span>{e.minutes ? hm(e.minutes) : ''}{e.costs.length ? ` · $${e.costs.reduce((s, c) => s + c.amount, 0).toFixed(2)}` : ''}<button aria-label="Delete entry" className="ml-3 text-red-700" onClick={() => tools.getState().removeEntry(e.id)}>✕</button></span></div>
            {e.notes && <p className="text-sm">{e.notes}</p>}
            {e.photos.length > 0 && <div className="mt-1 flex gap-2">{e.photos.map((p, i) => <img key={i} src={p} alt={`Photo ${i + 1} from ${e.date}`} className="h-24 rounded border" />)}</div>}
          </li>
        ))}
        {mine.length === 0 && <li className="text-sm text-stone-500">No entries for this project yet.</li>}
      </ol>
    </div>
  )
}

function InventoryView() {
  const inv = useTools(s => s.inventory)
  const set = tools.getState().setInventory
  const low = lowStock(inv)
  const [tool, setTool] = useState(''), [kind, setKind] = useState('Hand tool')
  const [hw, setHw] = useState(HARDWARE[0]?.id ?? ''), [hwQty, setHwQty] = useState('1')
  const [fin, setFin] = useState(FINISHES[0].id), [finAmt, setFinAmt] = useState('1'), [finUnit, setFinUnit] = useState<FinishStock['unit']>('qt')
  const num = (v: string) => Math.max(0, Number(v) || 0)
  return (
    <div className="flex max-w-5xl flex-col gap-5">
      {low.length > 0 && <p role="alert" className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Running low: {low.join('; ')}</p>}
      <section aria-label="Hardware on hand">
        <h2 className="mb-1 font-bold">Hardware</h2>
        <table className="w-full text-sm"><tbody>
          {inv.hardware.map(h => (
            <tr key={h.id} className="border-b">
              <td className="py-1">{h.name}</td>
              <td><input aria-label={`Quantity of ${h.name}`} value={h.qty} onChange={e => set(i => ({ ...i, hardware: i.hardware.map(x => (x.id === h.id ? { ...x, qty: num(e.target.value) } : x)) }))} className="w-16 rounded border px-1" /></td>
              <td>Warn at <input aria-label={`Low mark for ${h.name}`} value={h.min ?? ''} onChange={e => set(i => ({ ...i, hardware: i.hardware.map(x => (x.id === h.id ? { ...x, min: e.target.value === '' ? undefined : num(e.target.value) } : x)) }))} className="w-12 rounded border px-1" /></td>
              <td><button aria-label={`Remove ${h.name}`} className="text-red-700" onClick={() => set(i => ({ ...i, hardware: i.hardware.filter(x => x.id !== h.id) }))}>✕</button></td>
            </tr>
          ))}
        </tbody></table>
        <div className="mt-1 flex gap-2 text-sm">
          <select aria-label="Hardware item" value={hw} onChange={e => setHw(e.target.value)} className="rounded border px-1">{HARDWARE.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          <input aria-label="Hardware quantity" value={hwQty} onChange={e => setHwQty(e.target.value)} className="w-14 rounded border px-1" />
          <button className="rounded border px-2" onClick={() => { const it = HARDWARE.find(h => h.id === hw); if (it) set(i => ({ ...i, hardware: [...i.hardware, { id: newItemId(), itemId: it.id, name: it.name, qty: num(hwQty) }] })) }}>Add hardware</button>
        </div>
      </section>
      <section aria-label="Finishes on hand">
        <h2 className="mb-1 font-bold">Finishes</h2>
        <ul className="text-sm">{inv.finishes.map(f => <li key={f.id} className="flex gap-2 border-b py-1"><span className="flex-1">{f.product}</span><span>{f.amount} {f.unit}</span><button aria-label={`Remove ${f.product}`} className="text-red-700" onClick={() => set(i => ({ ...i, finishes: i.finishes.filter(x => x.id !== f.id) }))}>✕</button></li>)}</ul>
        <div className="mt-1 flex gap-2 text-sm">
          <select aria-label="Finish product" value={fin} onChange={e => setFin(e.target.value)} className="rounded border px-1">{FINISHES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <input aria-label="Finish amount" value={finAmt} onChange={e => setFinAmt(e.target.value)} className="w-14 rounded border px-1" />
          <select aria-label="Finish unit" value={finUnit} onChange={e => setFinUnit(e.target.value as FinishStock['unit'])} className="rounded border px-1"><option value="oz">oz</option><option value="qt">qt</option><option value="gal">gal</option><option value="can">can</option></select>
          <button className="rounded border px-2" onClick={() => set(i => ({ ...i, finishes: [...i.finishes, { id: newItemId(), finishId: fin, product: FINISHES.find(f => f.id === fin)!.name, amount: num(finAmt), unit: finUnit }] }))}>Add finish</button>
        </div>
      </section>
      <section aria-label="Tools">
        <h2 className="mb-1 font-bold">Tools</h2>
        <ul className="text-sm">{inv.tools.map(t => <li key={t.id} className="flex gap-2 border-b py-1"><span className="flex-1">{t.name}</span><span className="text-stone-500">{t.kind}</span><button aria-label={`Remove ${t.name}`} className="text-red-700" onClick={() => set(i => ({ ...i, tools: i.tools.filter(x => x.id !== t.id) }))}>✕</button></li>)}</ul>
        <div className="mt-1 flex gap-2 text-sm">
          <input aria-label="Tool name" placeholder="Tool" value={tool} onChange={e => setTool(e.target.value)} className="w-48 rounded border px-1" />
          <select aria-label="Tool kind" value={kind} onChange={e => setKind(e.target.value)} className="rounded border px-1">{['Hand tool', 'Power tool', 'Stationary machine', 'Jig', 'Measuring', 'Safety'].map(k => <option key={k}>{k}</option>)}</select>
          <button className="rounded border px-2" disabled={!tool.trim()} onClick={() => { set(i => ({ ...i, tools: [...i.tools, { id: newItemId(), name: tool.trim(), kind }] })); setTool('') }}>Add tool</button>
        </div>
      </section>
      <section aria-label="Lumber and sheets">
        <h2 className="mb-1 font-bold">Lumber, sheets and offcuts</h2>
        <p className="mb-1 text-xs text-stone-500">The cut optimizer places parts on these first when "Use my stock" is on.</p>
        <StockPanel />
      </section>
    </div>
  )
}
