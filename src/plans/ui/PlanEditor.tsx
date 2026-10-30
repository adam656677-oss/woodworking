import { useEffect, useState } from 'react'
import { TOOLS } from '../../kids/content'
import { CutSheet } from '../../kids/ui/CutSheet'
import { cutList } from '../../model/cutlist'
import { deserialize, serialize } from '../../model/fileFormat'
import { newId } from '../../model/ids'
import type { Project } from '../../model/types'
import { InchInput } from '../../ui/designer/InchInput'
import { studio } from '../../ui/store'
import { plans, usePlans } from '../plansStore'
import type { CutRow, Plan, PlanStep } from '../types'
import { PlanPicture } from './PlanPicture'
import { useNearView } from './useNearView'
import { openPlanShop } from '../../shop/open'

type Tab = 'overview' | 'steps' | 'cut' | 'pages'
const field = 'rounded border border-stone-300 px-2 py-1 text-sm'
const TOOL_LIST = Object.values(TOOLS)

/** The plan's attached design, read from its folder ('missing' when the file is gone or damaged). */
export function usePlanDesign(folder: string | undefined, plan: Plan | undefined): Project | null | 'missing' {
  const [design, setDesign] = useState<Project | null | 'missing'>(null)
  useEffect(() => {
    let live = true
    setDesign(null)
    if (folder && plan?.design) {
      void window.aa.plansReadDesign(folder).then(text => {
        if (!live) return
        if (!text) return setDesign('missing')
        try {
          setDesign(deserialize(text))
        } catch {
          setDesign('missing')
        }
      })
    }
    return () => {
      live = false
    }
  }, [folder, plan?.design])
  return design
}

/** The design's cut list as the plan's own rows, so the plan still has a cut list if the design is lost. */
function rowsFrom(project: Project): CutRow[] {
  return cutList(project).rows.map(r => ({ id: newId('r'), qty: r.qty, part: r.part, thickness: r.thickness, width: r.width, length: r.length, wood: r.woodName, notes: r.notes.join('; ') }))
}

function Overview({ folder, plan }: { folder: string; plan: Plan }) {
  const up = plans.getState().update
  const [msg, setMsg] = useState<string | null>(null)
  const attachOpen = async () => {
    const p = studio.getState().project
    if (p.boards.length === 0) return setMsg('The Master Shop has no design open. Open or build one there first.')
    await window.aa.plansAttachDesign(folder, serialize(p))
    await up(x => ({ ...x, design: 'design.aaw', cutRows: rowsFrom(p) }))
    setMsg(`Attached "${p.name}".`)
  }
  const attachFile = async () => {
    const text = await window.aa.plansPickDesign()
    if (!text) return
    let project: Project
    try {
      project = deserialize(text)
    } catch {
      return setMsg("That file isn't an A&A project.")
    }
    await window.aa.plansAttachDesign(folder, text)
    await up(x => ({ ...x, design: 'design.aaw', cutRows: rowsFrom(project) }))
    setMsg('Design attached.')
  }
  const openDesign = async () => {
    const text = await window.aa.plansReadDesign(folder)
    if (text) studio.getState().openDesignText(text)
  }
  return (
    <div className="grid grid-cols-[1fr_16rem] gap-6">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-stone-600">Name
          <input aria-label="Plan name" value={plan.name} onChange={e => void up(x => ({ ...x, name: e.target.value }))} className={`${field} text-lg font-semibold`} />
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={plan.kidFriendly} disabled={plan.unchecked.length > 0 && !plan.kidFriendly} onChange={e => void up(x => ({ ...x, kidFriendly: e.target.checked }))} />
            Kid-friendly (shows in the Kids&apos; Workshop)
          </label>
          {plan.unchecked.length > 0 && !plan.kidFriendly && <span className="text-xs text-amber-800">Check the drafted items first — kids only see plans a grown-up has checked.</span>}
          <label className="flex items-center gap-1">Difficulty
            <select aria-label="Difficulty" value={plan.stars} onChange={e => void up(x => ({ ...x, stars: Number(e.target.value) as 1 | 2 | 3 }))} className={field}>
              <option value={1}>★</option><option value={2}>★★</option><option value={3}>★★★</option>
            </select>
          </label>
          <label className="flex items-center gap-1">Time (minutes)
            <input aria-label="Time in minutes" type="number" min={5} step={5} value={plan.minutes} onChange={e => Number(e.target.value) > 0 && void up(x => ({ ...x, minutes: Number(e.target.value) }))} className={`${field} w-20`} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-stone-600">Description
          <textarea aria-label="Description" rows={3} value={plan.description} onChange={e => void up(x => ({ ...x, description: e.target.value }))} className={field} />
        </label>
        <fieldset className="rounded border border-stone-200 p-2">
          <legend className="px-1 text-xs text-stone-600">Tools</legend>
          <div className="grid grid-cols-3 gap-1 text-sm">
            {TOOL_LIST.map(t => (
              <label key={t.id} className="flex items-center gap-1">
                <input type="checkbox" checked={plan.tools.includes(t.id)} onChange={e => void up(x => ({ ...x, tools: e.target.checked ? [...x.tools, t.id] : x.tools.filter(i => i !== t.id) }))} />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="rounded border border-stone-200 p-2">
          <legend className="px-1 text-xs text-stone-600">Materials and hardware</legend>
          {plan.materials.map((m, i) => (
            <div key={i} className="mb-1 flex gap-2">
              <input aria-label={`Material ${i + 1}`} value={m.text} onChange={e => void up(x => ({ ...x, materials: x.materials.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)) }))} className={`${field} flex-1`} />
              <input aria-label={`Material ${i + 1} amount`} placeholder="Amount" value={m.amount} onChange={e => void up(x => ({ ...x, materials: x.materials.map((y, k) => (k === i ? { ...y, amount: e.target.value } : y)) }))} className={`${field} w-24`} />
              <button aria-label={`Remove material ${i + 1}`} onClick={() => void up(x => ({ ...x, materials: x.materials.filter((_, k) => k !== i) }))} className="px-2 text-red-700">✕</button>
            </div>
          ))}
          <button onClick={() => void up(x => ({ ...x, materials: [...x.materials, { text: '', amount: '' }] }))} className="text-sm text-amber-800 underline">Add material</button>
        </fieldset>
        <label className="flex flex-col gap-1 text-xs text-stone-600">Notes
          <textarea aria-label="Notes" rows={3} value={plan.notes} onChange={e => void up(x => ({ ...x, notes: e.target.value }))} className={field} />
        </label>
      </div>
      <aside className="flex flex-col gap-3">
        <PlanPicture folder={folder} plan={plan} className="h-40 w-full rounded" />
        <div className="rounded border border-stone-200 p-2 text-sm">
          <div className="mb-1 font-semibold">Design</div>
          <p className="mb-2 text-stone-600">{plan.design ? 'A design is attached; the cut list comes from it.' : 'No design attached — the cut list is typed.'}</p>
          <div className="flex flex-col gap-1">
            <button onClick={() => void attachOpen()} className="rounded bg-stone-100 px-2 py-1 text-left hover:bg-stone-200">Attach the open Master Shop design</button>
            <button onClick={() => void attachFile()} className="rounded bg-stone-100 px-2 py-1 text-left hover:bg-stone-200">Attach a design file…</button>
            {plan.design && <button onClick={() => void openDesign()} className="rounded bg-stone-100 px-2 py-1 text-left hover:bg-stone-200">Open the design in the Master Shop</button>}
          </div>
          {msg && <p role="status" className="mt-2 text-xs text-stone-700">{msg}</p>}
        </div>
      </aside>
    </div>
  )
}

function StepPhoto({ folder, step }: { folder: string; step: PlanStep }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (step.photo) void window.aa.plansFileUrl(folder, step.photo).then(setUrl)
    else setUrl(null)
  }, [folder, step.photo])
  return url ? <img src={url} alt={`Step photo`} className="h-20 rounded object-cover" /> : null
}

function Steps({ folder, plan, hasDesign }: { folder: string; plan: Plan; hasDesign: boolean }) {
  const up = plans.getState().update
  const setStep = (id: string, patch: Partial<PlanStep>) => void up(x => ({ ...x, steps: x.steps.map(s => (s.id === id ? { ...s, ...patch } : s)) }))
  const move = (i: number, d: -1 | 1) =>
    void up(x => {
      const steps = [...x.steps]
      ;[steps[i], steps[i + d]] = [steps[i + d], steps[i]]
      return { ...x, steps }
    })
  const addPhoto = async (s: PlanStep) => {
    const rel = await window.aa.plansAddPhoto(folder, s.id)
    if (rel) setStep(s.id, { photo: rel })
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {plan.steps.map((s, i) => (
          <li key={s.id} className={`rounded border bg-white p-3 ${plan.unchecked.includes(s.id) ? 'border-amber-400' : 'border-stone-200'}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-700 text-sm font-bold text-white">{i + 1}</span>
              <textarea aria-label={`Step ${i + 1} text`} rows={2} value={s.text} onChange={e => setStep(s.id, { text: e.target.value })} className={`${field} flex-1`} />
              <div className="flex flex-col gap-1 text-xs">
                <button aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded bg-stone-100 px-2 disabled:opacity-30">▲</button>
                <button aria-label={`Move step ${i + 1} down`} disabled={i === plan.steps.length - 1} onClick={() => move(i, 1)} className="rounded bg-stone-100 px-2 disabled:opacity-30">▼</button>
                <button aria-label={`Delete step ${i + 1}`} onClick={() => void up(x => ({ ...x, steps: x.steps.filter(y => y.id !== s.id), unchecked: x.unchecked.filter(u => u !== s.id) }))} className="rounded bg-red-50 px-2 text-red-700">✕</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 pl-10 text-sm">
              <label className="flex items-center gap-1">Tool
                <select aria-label={`Step ${i + 1} tool`} value={s.tool ?? ''} onChange={e => setStep(s.id, { tool: e.target.value || undefined })} className={field}>
                  <option value="">—</option>
                  {TOOL_LIST.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <input aria-label={`Step ${i + 1} safety tip`} placeholder="Safety tip (optional)" value={s.tip ?? ''} onChange={e => setStep(s.id, { tip: e.target.value || undefined })} className={`${field} w-72`} />
              {hasDesign && <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.showDesign} onChange={e => setStep(s.id, { showDesign: e.target.checked || undefined })} /> Show 3D view</label>}
              <button onClick={() => void addPhoto(s)} className="rounded bg-stone-100 px-2 py-0.5 hover:bg-stone-200">{s.photo ? 'Change photo' : 'Add photo'}</button>
              <StepPhoto folder={folder} step={s} />
            </div>
          </li>
        ))}
      </ol>
      <button onClick={() => void up(x => ({ ...x, steps: [...x.steps, { id: newId('s'), text: '' }] }))} className="self-start rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Add step</button>
    </div>
  )
}

function CutRows({ plan }: { plan: Plan }) {
  const up = plans.getState().update
  const setRow = (id: string, patch: Partial<CutRow>) => void up(x => ({ ...x, cutRows: x.cutRows.map(r => (r.id === id ? { ...r, ...patch } : r)) }))
  return (
    <div className="flex flex-col gap-2">
      <table aria-label="Typed cut list" className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-stone-600"><th>Qty</th><th>Part</th><th>Thickness</th><th>Width</th><th>Length</th><th>Wood</th><th /></tr>
        </thead>
        <tbody>
          {plan.cutRows.map((r, i) => (
            <tr key={r.id} className={plan.unchecked.includes(r.id) ? 'bg-amber-50' : ''}>
              <td><input aria-label={`Row ${i + 1} quantity`} type="number" min={1} value={r.qty} onChange={e => Number(e.target.value) >= 1 && setRow(r.id, { qty: Math.round(Number(e.target.value)) })} className={`${field} w-16`} /></td>
              <td><input aria-label={`Row ${i + 1} part`} value={r.part} onChange={e => setRow(r.id, { part: e.target.value })} className={field} /></td>
              <td><InchInput label={`Row ${i + 1} thickness`} value={r.thickness} onChange={v => setRow(r.id, { thickness: v })} /></td>
              <td><InchInput label={`Row ${i + 1} width`} value={r.width} onChange={v => setRow(r.id, { width: v })} /></td>
              <td><InchInput label={`Row ${i + 1} length`} value={r.length} onChange={v => setRow(r.id, { length: v })} /></td>
              <td><input aria-label={`Row ${i + 1} wood`} value={r.wood} onChange={e => setRow(r.id, { wood: e.target.value })} className={`${field} w-28`} /></td>
              <td><button aria-label={`Delete row ${i + 1}`} onClick={() => void up(x => ({ ...x, cutRows: x.cutRows.filter(y => y.id !== r.id), unchecked: x.unchecked.filter(u => u !== r.id) }))} className="px-2 text-red-700">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => void up(x => ({ ...x, cutRows: [...x.cutRows, { id: newId('r'), qty: 1, part: '', thickness: 0.75, width: 3.5, length: 12, wood: '', notes: '' }] }))} className="self-start rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Add row</button>
    </div>
  )
}

function LazyPage({ folder, n }: { folder: string; n: number }) {
  const [ref, visible] = useNearView<HTMLDivElement>(n === 1)
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (visible && url === undefined) void window.aa.plansFileUrl(folder, `pages/page-${String(n).padStart(3, '0')}.png`).then(setUrl)
  }, [folder, n, visible, url])
  return (
    <div ref={ref} className="min-h-[300px] w-full max-w-3xl">
      {url ? <img src={url} alt={`Page ${n}`} className="w-full border shadow" /> : url === null ? <p>Page {n} is missing.</p> : <p className="text-stone-400">Page {n}…</p>}
    </div>
  )
}

function Pages({ folder, plan }: { folder: string; plan: Plan }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {Array.from({ length: plan.source?.pages ?? 0 }, (_, i) => <LazyPage key={i} folder={folder} n={i + 1} />)}
    </div>
  )
}

/** Editing one plan: Overview, Steps, Cut list, and the original Pages of an imported plan. */
export function PlanEditor() {
  const current = usePlans(s => s.current)
  const notice = usePlans(s => s.notice)
  const [tab, setTab] = useState<Tab>('overview')
  const design = usePlanDesign(current?.folder, current?.plan)
  if (!current) return null
  const { folder, plan } = current
  const p = plans.getState()
  const tabs: [Tab, string][] = [['overview', 'Overview'], ['steps', 'Steps'], ['cut', 'Cut list'], ...(plan.source ? [['pages', 'Pages'] as [Tab, string]] : [])]
  return (
    <main className="flex h-full flex-col bg-stone-100 text-stone-900">
      <header className="flex items-center gap-3 border-b border-stone-300 bg-white px-4 py-2">
        <button onClick={() => p.back()} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">← My Plans</button>
        <h1 className="flex-1 truncate text-xl font-bold">{plan.name || 'Untitled plan'}</h1>
        {plan.unchecked.length > 0 && <button onClick={() => plans.setState({ view: 'import' })} className="rounded bg-amber-100 px-3 py-1 text-sm text-amber-900">{plan.unchecked.length} drafted items to check</button>}
        {plan.steps.length > 0 && <button onClick={() => void openPlanShop(folder, plan, p.kidsView)} className="rounded bg-stone-800 px-3 py-1 text-sm font-semibold text-white">🪚 Shop Mode</button>}
        <button onClick={() => p.showGuide()} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Print build guide</button>
      </header>
      {notice && <p role="alert" className="bg-amber-100 px-4 py-1 text-sm text-amber-900">{notice}</p>}
      <nav role="tablist" className="flex gap-1 border-b border-stone-300 bg-white px-4">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm ${tab === id ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{label}</button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'overview' && <Overview folder={folder} plan={plan} />}
        {tab === 'steps' && <Steps folder={folder} plan={plan} hasDesign={!!design && design !== 'missing'} />}
        {tab === 'cut' && (plan.design && design !== 'missing' ? (
          design ? (
            <div className="rounded bg-white p-3">
              <p className="mb-2 text-sm text-stone-600">From the attached design. To change it: Overview → Open the design, change it in the Master Shop, then come back and use Attach the open Master Shop design.</p>
              <CutSheet project={design} />
            </div>
          ) : <p className="text-sm text-stone-600">Loading the attached design…</p>
        ) : (
          <>
            {design === 'missing' && <p role="status" className="mb-2 text-sm text-amber-800">The attached design couldn&apos;t be found, so the typed cut list is shown. Attach the design again on the Overview tab.</p>}
            <CutRows plan={plan} />
          </>
        ))}
        {tab === 'pages' && <Pages folder={folder} plan={plan} />}
      </div>
    </main>
  )
}
