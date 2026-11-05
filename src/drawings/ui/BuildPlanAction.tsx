import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { studio, useStudio } from '../../ui/store'
import { formatInches } from '../../model/units'
import { stock, useStock } from '../../optimize/stockStore'
import { tools, useTools } from '../../tools/store'
import { createBuildPlan, isBuildPlanCurrent, type Plan } from '../buildPlan'
import type { ShoppingInputs } from '../shoppingSnapshot'
import { PAPERS } from '../sheet'
import { BuildPlanShopping } from './BuildPlanShopping'
import { BuildPlanHardware } from './BuildPlanHardware'
import { BuildPlanTemplates } from './BuildPlanTemplates'

function liveInputs(): ShoppingInputs | undefined {
  const s = stock.getState(), t = tools.getState()
  return s.loaded && t.loaded ? { stock: s.items, inventory: t.inventory } : undefined
}
export function BuildPlanAction({ disabled = false }: { disabled?: boolean }) {
  const project = useStudio(s => s.project)
  const projectKey = useStudio(s => s.projectKey)
  const items = useStock(s => s.items)
  const stockLoaded = useStock(s => s.loaded)
  const inventory = useTools(s => s.inventory)
  const inventoryLoaded = useTools(s => s.loaded)
  const ready = stockLoaded && inventoryLoaded
  const [plan, setPlan] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stale = !!plan && (!ready || !isBuildPlanCurrent(plan, project, { stock: items, inventory }))
  useEffect(() => {
    let active = true
    Promise.all([
      stock.getState().loaded ? Promise.resolve() : stock.getState().load(),
      tools.getState().loaded ? Promise.resolve() : tools.getState().load()
    ]).catch(() => { if (active) setMessage('Shop inventory could not be loaded. Reopen the workspace to retry; no plan was generated.') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setBusy(false); setPlan(null); setOpen(false); setMessage(null)
  }, [projectKey])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!open) return
    document.body.classList.add('printing-drawings')
    closeButton.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false) }
    }
    window.addEventListener('keydown', key, true)
    return () => {
      document.body.classList.remove('printing-drawings')
      window.removeEventListener('keydown', key, true)
      trigger.current?.focus()
    }
  }, [open])
  const generate = () => {
    if (busy || disabled || !liveInputs()) return
    if (!open && document.querySelector('dialog[open], [role="dialog"]')) return
    setBusy(true); setMessage(null); setOpen(true)
    timer.current = setTimeout(() => {
      try {
        const state = studio.getState()
        const inputs = liveInputs()
        if (!inputs) throw new Error('Wait for shop inventory to load before generating a plan.')
        const errors = Object.values(state.formulaErrors)
        if (errors.length) throw new Error(`Resolve formula errors first: ${errors.join('; ')}`)
        const result = createBuildPlan(state.project, { paper: 'letter', scale: 'auto', hidden: true, date: new Date().toISOString().slice(0, 10) }, inputs)
        if (!result.ok) { setPlan(null); setMessage(result.issues.join(' ')); return }
        setPlan(result.plan)
      } catch (error) { setPlan(null); setMessage(error instanceof Error ? error.message : 'The plan could not be generated.') }
      finally { setBusy(false); timer.current = null }
    }, 30)
  }
  const exportPlan = async (print: boolean) => {
    const inputs = liveInputs()
    if (!plan || busy || !inputs || !isBuildPlanCurrent(plan, studio.getState().project, inputs)) return
    setBusy(true); setMessage(null)
    try {
      if (print) {
        const ok = await window.aa.printPdf(`${plan.name} build plan`)
        setMessage(ok ? 'Opened in your PDF viewer. Print at Actual size.' : 'The PDF viewer could not be opened. Try Save as PDF.')
      } else {
        const path = await window.aa.savePdf(`${plan.name} build plan`)
        if (path) setMessage('Build plan saved as PDF.')
      }
    } catch { setMessage('Export failed. Your design has not been changed.') }
    finally { setBusy(false) }
  }
  return <>
    <button ref={trigger} type="button" disabled={disabled || busy || !ready} onClick={() => plan && !stale ? setOpen(true) : generate()}
      className="ml-auto shrink-0 rounded bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50">{!ready ? 'Loading shop inventory…' : busy ? 'Generating…' : plan ? stale ? 'Update Build Plan' : 'View Build Plan' : 'Create Build Plan'}</button>
    {!open && message && <p role="status">{message}</p>}
    {open && createPortal(<div role="dialog" aria-label="Build plan preview" className="drawings-print fixed inset-0 z-50 flex flex-col bg-stone-200"
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      } }}>
      <header className="no-print flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
        <h2 className="mr-auto text-lg font-semibold">Build plan — {plan?.name ?? project.name}</h2>
        <button type="button" disabled={busy || !ready} onClick={generate} className="rounded border px-3 py-2">Update Plan</button>
        <button type="button" disabled={!plan || stale || busy} onClick={() => void exportPlan(false)} className="rounded border px-3 py-2">Save as PDF</button>
        <button type="button" disabled={!plan || stale || busy} onClick={() => void exportPlan(true)} className="rounded border px-3 py-2">Print</button>
        <button ref={closeButton} type="button" onClick={() => setOpen(false)} className="rounded bg-amber-800 px-3 py-2 text-white">Back to Design</button>
      </header>
      {stale && <p role="alert" className="no-print bg-amber-100 px-4 py-2">The design or shop inventory changed. Update Plan before printing or exporting.</p>}
      {message && <p role="status" className="no-print bg-white px-4 py-2">{message}</p>}
      <div className="packet-inner flex-1 overflow-auto p-6">
        {busy && !plan ? <p role="status">Generating the plan from your design…</p> : plan && <div className="flex flex-col items-center gap-6 print:block">
          {plan.sheets.map((sheet, index) => <div key={index} data-testid="build-plan-sheet" className="drawing-page bg-white shadow"
            style={{ width: `${PAPERS[sheet.paper].w}in`, height: `${PAPERS[sheet.paper].h}in`, page: `sheet-${sheet.paper}` }} dangerouslySetInnerHTML={{ __html: sheet.svg }} />)}
          <section aria-label="Build plan cut list" className="drawing-page flow-page w-[8.5in] bg-white p-[0.5in] shadow">
            <h2 className="mb-3 text-xl font-semibold">Cut list — {plan.name}</h2>
            <table className="w-full text-sm"><thead><tr>{['Part', 'Qty', 'Name', 'Thickness', 'Width', 'Length'].map(label => <th key={label} className="border-b px-1 text-left">{label}</th>)}</tr></thead>
              <tbody>{plan.cutList.rows.map((row, index) => <tr key={index}><td>P{index + 1}</td><td>{row.qty}</td><td>{row.part}</td><td>{formatInches(row.thickness, { sixtyFourths: true })}</td><td>{formatInches(row.cutWidth ?? row.width, { sixtyFourths: true })}</td><td>{formatInches(row.cutLength ?? row.length, { sixtyFourths: true })}</td></tr>)}</tbody></table>
          </section>
          <BuildPlanShopping name={plan.name} snapshot={plan.shoppingSnapshot} />
          <BuildPlanHardware name={plan.name} hardware={plan.hardware} />
          <section aria-label="Build plan assembly guidance" className="drawing-page flow-page w-[8.5in] bg-white p-[0.5in] shadow">
            <h2 className="mb-3 text-xl font-semibold">Assembly guidance</h2>
            {plan.reviewNotes.map(note => <p key={note} className="mb-3 text-sm">{note}</p>)}
            <ol className="list-inside list-decimal space-y-3">{plan.steps.map(step => <li key={step.key} className="break-inside-avoid"><span className="font-semibold">{step.title}</span><p>{step.text}</p>{step.tools.length > 0 && <p className="text-sm">Tools: {step.tools.join(', ')}</p>}</li>)}</ol>
          </section>
          <BuildPlanTemplates templates={plan.templates} />
        </div>}
      </div>
    </div>, document.body)}
  </>
}
