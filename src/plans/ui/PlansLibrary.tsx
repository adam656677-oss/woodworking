import { useMemo, useState } from 'react'
import { plans, usePlans, visiblePlans } from '../plansStore'
import { PlanPicture } from './PlanPicture'

/** The My Plans library: every plan as a card, plus New plan and Bring in a plan. */
export function PlansLibrary() {
  const list = usePlans(s => s.list)
  const kidsView = usePlans(s => s.kidsView)
  const notice = usePlans(s => s.notice)
  const importing = usePlans(s => s.importing)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'recent'>('name')
  const [bringing, setBringing] = useState(false)
  const [url, setUrl] = useState('')
  const p = plans.getState()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const v = visiblePlans(list, kidsView).filter(e => !q || (e.plan?.name ?? e.folder).toLowerCase().includes(q))
    return sort === 'name' ? [...v].sort((a, b) => (a.plan?.name ?? a.folder).localeCompare(b.plan?.name ?? b.folder)) : v
  }, [list, kidsView, query, sort])

  const big = kidsView ? 'text-xl' : 'text-sm'
  return (
    <main className={`flex h-full flex-col ${kidsView ? 'bg-sky-50 text-sky-950' : 'bg-stone-100 text-stone-900'}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-white px-4 py-2">
        <button onClick={() => p.back()} className={`rounded px-3 py-1 font-semibold ${kidsView ? 'bg-sky-600 text-lg text-white' : 'hover:bg-stone-200'}`}>← Back</button>
        <h1 className={`${kidsView ? 'text-3xl' : 'text-xl'} font-bold`}>My Plans</h1>
        <input aria-label="Search plans" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} className={`ml-4 rounded border border-stone-300 px-2 py-1 ${big}`} />
        <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as 'name' | 'recent')} className={`rounded border border-stone-300 px-1 py-1 ${big}`}>
          <option value="name">By name</option>
          <option value="recent">By folder order</option>
        </select>
        {!kidsView && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => void p.create()} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white">New plan</button>
            <button onClick={() => setBringing(b => !b)} aria-expanded={bringing} className="rounded border border-amber-700 px-3 py-1 text-sm font-semibold">Bring in a plan ▾</button>
          </div>
        )}
      </header>
      {bringing && !kidsView && (
        <section aria-label="Bring in a plan" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          <button onClick={() => { setBringing(false); void p.startImport('pdf') }} className="rounded bg-white px-3 py-1 shadow hover:bg-amber-100">PDF…</button>
          <button onClick={() => { setBringing(false); void p.startImport('photos') }} className="rounded bg-white px-3 py-1 shadow hover:bg-amber-100">Photos or scans…</button>
          <span className="ml-2">or a web page:</span>
          <input aria-label="Web address" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} className="w-80 rounded border border-stone-300 px-2 py-1" />
          <button onClick={() => { setBringing(false); void p.startImport('web', url) }} className="rounded bg-white px-3 py-1 shadow hover:bg-amber-100">Bring in page</button>
        </section>
      )}
      {notice && (
        <p role="alert" className="flex items-center gap-3 bg-red-100 px-4 py-2 text-sm text-red-800">
          <span className="flex-1">{notice}</span>
          <button aria-label="Dismiss" onClick={() => plans.setState({ notice: null })} className="font-bold">✕</button>
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {shown.length === 0 ? (
          <p className={`mt-16 text-center ${kidsView ? 'text-2xl' : 'text-lg'} text-stone-500`}>
            {kidsView ? 'No plans yet. Ask your grown-up to mark one as kid-friendly.' : 'No plans yet. Start one with New plan, or Bring in a plan you already have.'}
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
            {shown.map(e => (
              <li key={e.folder}>
                {e.plan ? (
                  <button aria-label={e.plan.name} onClick={() => void p.open(e.folder)} className="flex w-full flex-col overflow-hidden rounded-xl border border-stone-300 bg-white text-left shadow hover:shadow-md">
                    <PlanPicture folder={e.folder} plan={e.plan} className="h-36 w-full" />
                    <div className="p-3">
                      <div className={`font-bold ${kidsView ? 'text-xl' : ''}`}>{e.plan.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className={`rounded px-1.5 py-0.5 ${e.plan.kidFriendly ? 'bg-sky-100 text-sky-800' : 'bg-stone-200 text-stone-700'}`}>{e.plan.kidFriendly ? 'Kid-friendly' : 'Adult'}</span>
                        <span className="text-amber-500">{'★'.repeat(e.plan.stars)}</span>
                        <span className="text-stone-500">{e.plan.minutes} min</span>
                        {e.plan.unchecked.length > 0 && !kidsView && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{e.plan.unchecked.length} to check</span>}
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    <div className="font-bold">{e.folder}</div>
                    <div className="mt-1 break-all">{e.error}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div role="dialog" aria-label="Bringing in a plan" className="w-96 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Bringing in a plan…</h2>
            <p className="mt-2 text-sm">{importing.stage}{importing.pages ? ` — page ${importing.page} of ${importing.pages}` : ''}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded bg-stone-200">
              <div className="h-full bg-amber-600 transition-all" style={{ width: `${importing.pages ? (100 * importing.page) / importing.pages : 10}%` }} />
            </div>
            <button onClick={() => p.cancelImport()} className="mt-4 rounded border border-stone-400 px-3 py-1 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}
