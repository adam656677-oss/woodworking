import { useEffect, useState } from 'react'
import { TOOLS } from '../../kids/content'
import { formatInches } from '../../model/units'
import { plans, usePlans } from '../plansStore'
import type { Plan, ReviewRef } from '../types'

/** Page pictures: PDF text positions are in points (72 per inch); pages were drawn at 150 dpi. Photos are in picture pixels. */
const scaleFor = (plan: Plan) => (plan.source?.kind === 'photos' ? 1 : 150 / 72)

function PageWithBox({ folder, plan, page, focus }: { folder: string; plan: Plan; page: number; focus: ReviewRef | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    void window.aa.plansFileUrl(folder, `pages/page-${String(page).padStart(3, '0')}.png`).then(setUrl)
  }, [folder, page])
  const box = focus && focus.page === page ? focus.box : null
  const k = scaleFor(plan)
  return (
    <figure className="relative mb-4 border bg-white shadow" id={`page-${page}`}>
      {url ? <img src={url} alt={`Page ${page}`} className="block w-full" onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} /> : <div className="p-6 text-sm text-stone-500">Page {page}</div>}
      {box && (
        <div
          data-testid="source-box"
          className="pointer-events-none absolute rounded border-4 border-amber-500 bg-amber-300/20"
          style={natural ? {
            left: `${((box[0] * k - 6) / natural.w) * 100}%`,
            top: `${((box[1] * k - 6) / natural.h) * 100}%`,
            width: `${((box[2] * k + 12) / natural.w) * 100}%`,
            height: `${((box[3] * k + 12) / natural.h) * 100}%`
          } : { left: 0, top: 0, width: '100%', height: 8 }}
        />
      )}
      <figcaption className="absolute right-1 top-1 rounded bg-black/50 px-1 text-xs text-white">Page {page}</figcaption>
    </figure>
  )
}

function CheckMe({ plan, id }: { plan: Plan; id: string }) {
  if (!plan.unchecked.includes(id)) return <span className="text-xs text-green-700">✓</span>
  return <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900">check me</span>
}

/** Checking a brought-in plan: the original pages on the left, what was drafted from them on the right. */
export function ImportReview() {
  const current = usePlans(s => s.current)
  const reviewNotes = usePlans(s => s.reviewNotes)
  const [focus, setFocus] = useState<ReviewRef | null>(null)
  if (!current) return null
  const { folder, plan } = current
  const p = plans.getState()
  const up = p.update
  const pages = plan.source?.pages ?? 0
  const show = (id: string) => {
    const r = plan.review?.find(x => x.itemId === id) ?? null
    setFocus(r)
    if (r) document.getElementById(`page-${r.page}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }
  const actions = (id: string, label: string) => (
    <div className="flex shrink-0 gap-1 text-xs">
      <button aria-label={`Show ${label} on the page`} onClick={() => show(id)} className="rounded bg-stone-100 px-2 py-0.5 hover:bg-stone-200">Show</button>
      {plan.unchecked.includes(id) && <button aria-label={`Accept ${label}`} onClick={() => void p.acceptItem(id)} className="rounded bg-green-600 px-2 py-0.5 text-white">Accept</button>}
      <button aria-label={`Delete ${label}`} onClick={() => void p.deleteItem(id)} className="rounded bg-red-50 px-2 py-0.5 text-red-700">Delete</button>
    </div>
  )
  return (
    <main className="flex h-full flex-col bg-stone-100 text-stone-900">
      <header className="flex items-center gap-3 border-b border-stone-300 bg-white px-4 py-2">
        <button onClick={() => p.back()} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">← My Plans</button>
        <h1 className="flex-1 text-xl font-bold">Check the brought-in plan</h1>
        <span className="text-sm text-stone-600">{plan.unchecked.length} to check</span>
        <button onClick={() => void p.acceptAll()} className="rounded bg-green-600 px-3 py-1 text-sm font-semibold text-white">Accept all</button>
        <button onClick={() => plans.setState({ view: 'edit' })} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">Done — open the plan</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 p-4">
        <section aria-label="Original pages" className="overflow-y-auto pr-2">
          {Array.from({ length: pages }, (_, i) => <PageWithBox key={i} folder={folder} plan={plan} page={i + 1} focus={focus} />)}
        </section>
        <section aria-label="Drafted plan" className="flex flex-col gap-4 overflow-y-auto">
          {reviewNotes.length > 0 && (
            <ul className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              {reviewNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <label className="flex flex-col gap-1 text-xs text-stone-600">Name
            <input aria-label="Plan name" value={plan.name} onChange={e => void up(x => ({ ...x, name: e.target.value }))} className="rounded border border-stone-300 px-2 py-1 text-lg font-semibold" />
          </label>
          <div className="rounded bg-white p-3">
            <h2 className="mb-2 font-bold">Cut list ({plan.cutRows.length})</h2>
            {plan.cutRows.length === 0 && <p className="text-sm text-stone-500">No cut list found — add rows in the plan&apos;s Cut list tab.</p>}
            <ul className="flex flex-col gap-2">
              {plan.cutRows.map(r => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <div className="flex-1">
                    <div><strong>{r.qty}</strong> × {r.part || '(no name)'} — {formatInches(r.thickness)} × {formatInches(r.width)} × {formatInches(r.length)}{r.wood && ` (${r.wood})`} <CheckMe plan={plan} id={r.id} /></div>
                    {plan.checkNotes?.[r.id] && plan.unchecked.includes(r.id) && <div className="text-xs text-amber-800">{plan.checkNotes[r.id]}</div>}
                  </div>
                  {actions(r.id, r.part || 'row')}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded bg-white p-3">
            <h2 className="mb-2 font-bold">Steps ({plan.steps.length})</h2>
            {plan.steps.length === 0 && <p className="text-sm text-stone-500">No numbered steps found — add them in the plan&apos;s Steps tab.</p>}
            <ol className="flex flex-col gap-2">
              {plan.steps.map((s, i) => (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <span className="font-bold">{i + 1}.</span>
                  <div className="flex-1">
                    <textarea aria-label={`Drafted step ${i + 1}`} rows={2} value={s.text} onChange={e => void up(x => ({ ...x, steps: x.steps.map(y => (y.id === s.id ? { ...y, text: e.target.value } : y)) }))} className="w-full rounded border border-stone-300 px-2 py-1" />
                    <CheckMe plan={plan} id={s.id} />
                    {plan.checkNotes?.[s.id] && plan.unchecked.includes(s.id) && <div className="text-xs text-amber-800">{plan.checkNotes[s.id]}</div>}
                  </div>
                  {actions(s.id, `step ${i + 1}`)}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded bg-white p-3 text-sm">
            <h2 className="mb-1 font-bold">Tools and materials</h2>
            <p>{plan.tools.map(t => TOOLS[t]?.name ?? t).join(', ') || 'No tools found.'}</p>
            <ul className="mt-1 list-disc pl-5">{plan.materials.map((m, i) => <li key={i}>{m.text}{m.amount && ` — ${m.amount}`}</li>)}</ul>
          </div>
        </section>
      </div>
    </main>
  )
}
