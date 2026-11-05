// Finishing School: lessons, the finish selector, the "can I put X over Y?" checker, the project's finishing
// schedule, and the Mohawk section.
import { useMemo, useState } from 'react'
import type { FinishStep } from '../../model/types'
import { studio, useStudio, type Screen } from '../../ui/store'
import { canGoOver, EXAMPLES } from '../compat'
import { FINISHES, finishById, hoursText, SHELLAC_CUTS, type Method } from '../finishes'
import { GROUPS, LESSONS } from '../lessons'
import { MOHAWK_ABOUT, MOHAWK_FAMILIES, MOHAWK_LINKS, MOHAWK_NOTE } from '../mohawk'
import { checkSchedule, fromTemplate, newStep, scheduleTime, setSchedule, TEMPLATES } from '../schedule'
import { rankFinishes, WANTS, type Want } from '../select'

type Tab = 'lessons' | 'select' | 'check' | 'schedule' | 'mohawk'
let backTo: Screen = 'home'
/** Opens Finishing School; Back returns to where it was opened from. */
export function openFinishing(from: Screen, tab?: Tab) {
  backTo = from
  startTab = tab ?? 'lessons'
  studio.getState().goto('finish')
}
let startTab: Tab = 'lessons'

const openLink = (url: string) => void window.aa.openLink?.(url)

export function FinishingSchool() {
  const [tab, setTab] = useState<Tab>(startTab)
  const tabs: [Tab, string][] = [['lessons', 'Lessons'], ['select', 'Choose a finish'], ['check', 'Can I put…?'], ['schedule', 'My finishing schedule'], ['mohawk', 'Mohawk products']]
  return (
    <main className="flex h-full flex-col bg-stone-50">
      <header className="flex items-center gap-4 border-b border-stone-300 bg-white px-4 py-2">
        <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => studio.getState().goto(backTo)}>← Back</button>
        <h1 className="text-xl font-bold text-stone-800">Finishing School</h1>
        <nav role="tablist" className="flex gap-1">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1 text-sm ${tab === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>
          ))}
        </nav>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'lessons' && <Lessons />}
        {tab === 'select' && <Selector />}
        {tab === 'check' && <Checker />}
        {tab === 'schedule' && <ScheduleBuilder />}
        {tab === 'mohawk' && <Mohawk />}
      </div>
    </main>
  )
}

function Lessons() {
  const [id, setId] = useState(LESSONS[0].id)
  const l = LESSONS.find(x => x.id === id)!
  return (
    <div className="flex gap-6">
      <aside aria-label="Lessons" className="w-64 shrink-0">
        {GROUPS.map(g => (
          <div key={g} className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">{g}</h3>
            <ul>
              {LESSONS.filter(x => x.group === g).map(x => (
                <li key={x.id}><button onClick={() => setId(x.id)} className={`w-full rounded px-2 py-0.5 text-left text-sm ${x.id === id ? 'bg-amber-100 font-semibold' : 'hover:bg-stone-100'}`}>{x.title}</button></li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
      <article aria-label={l.title} className="max-w-3xl flex-1">
        <h2 className="mb-3 text-2xl font-bold">{l.title}</h2>
        <div className="flex flex-col gap-3">
          {l.cards.map((c, i) => (
            <section key={i} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <h3 className="mb-1 font-semibold">{c.title}</h3>
              {c.text.map((t, k) => <p key={k} className="mb-1 text-[15px] leading-relaxed text-stone-800">{t}</p>)}
              {c.tip && <p className="mt-2 rounded bg-amber-50 px-3 py-1 text-sm text-amber-900">Tip: {c.tip}</p>}
            </section>
          ))}
          {l.id === 'shellac' && (
            <table aria-label="Shellac cuts" className="w-full max-w-xl border-collapse rounded bg-white text-sm">
              <thead><tr className="border-b-2 border-stone-400 text-left">{['Cut', 'Flakes per gallon', 'Per pint', 'For'].map(h => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
              <tbody>{SHELLAC_CUTS.map(c => <tr key={c.cut} className="border-b border-stone-200"><td className="px-2 py-1">{c.cut}-lb</td><td className="px-2 py-1">{c.perGallon}</td><td className="px-2 py-1">{c.perPint}</td><td className="px-2 py-1">{c.use}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </article>
    </div>
  )
}

const stars = (n: number) => (n ? '●'.repeat(n) + '○'.repeat(5 - n) : '—')

function Selector() {
  const [wants, setWants] = useState<Want[]>(['durable', 'easy'])
  const [methods, setMethods] = useState<Method[]>(['wipe', 'brush'])
  const [compare, setCompare] = useState<string[]>([])
  const ranked = useMemo(() => rankFinishes(wants, methods), [wants, methods])
  // Only finishes still in the list can be compared (a new choice can drop one).
  const visible = ranked.slice(0, 8).map(r => r.finish.id)
  const shown = compare.filter(id => visible.includes(id))
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x])
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="What matters" className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-white p-4 shadow-sm">
        <div className="w-full text-sm font-semibold">What matters for this piece?</div>
        {WANTS.map(w => <label key={w.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={wants.includes(w.id)} onChange={() => setWants(toggle(wants, w.id))} />{w.label}</label>)}
        <div className="w-full text-sm font-semibold">How can you put it on?</div>
        {(['wipe', 'brush', 'spray'] as Method[]).map(m => <label key={m} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={methods.includes(m)} onChange={() => setMethods(toggle(methods, m))} />{m === 'wipe' ? 'Wipe on' : m === 'brush' ? 'Brush' : 'Spray (I have a spray setup)'}</label>)}
      </section>
      <ol aria-label="Best finishes" className="flex flex-col gap-2">
        {ranked.slice(0, 8).map((r, i) => (
          <li key={r.finish.id} className="flex items-start gap-3 rounded-lg bg-white p-3 shadow-sm">
            <span className="w-6 text-lg font-bold text-amber-800">{i + 1}</span>
            <div className="flex-1">
              <div className="font-semibold">{r.finish.name}</div>
              <div className="text-sm text-stone-700">{r.finish.about}</div>
              {r.reasons.length > 0 && <div className="text-sm text-green-800">✓ {r.reasons.join(' · ')}</div>}
              {r.warnings.length > 0 && <div className="text-sm text-amber-800">! {r.warnings.join(' · ')}</div>}
            </div>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" aria-label={`Compare ${r.finish.name}`} checked={shown.includes(r.finish.id)} disabled={!shown.includes(r.finish.id) && shown.length >= 3} onChange={() => setCompare(toggle(shown, r.finish.id))} />Compare</label>
          </li>
        ))}
        {ranked.length === 0 && <li className="text-stone-600">Nothing fits — try allowing another way of putting it on.</li>}
      </ol>
      {shown.length >= 2 && <Compare ids={shown} />}
    </div>
  )
}

function Compare({ ids }: { ids: string[] }) {
  const fs = ids.map(id => finishById(id)!)
  const rows: [string, (f: (typeof fs)[number]) => string][] = [
    ['Toughness', f => stars(f.durability)], ['Water', f => stars(f.water)], ['Heat', f => stars(f.heat)], ['Solvents', f => stars(f.solvent)],
    ['Easy to repair', f => stars(f.repair)], ['Easy to apply', f => stars(f.ease)], ['Food-safe', f => (f.food === 'yes' ? 'Yes' : f.food === 'cured' ? `Once cured (${f.cure} days)` : 'No')],
    ['Put on by', f => f.methods.join(', ')], ['Dry to touch', f => hoursText(f.touch)], ['Recoat after', f => hoursText(f.recoat)], ['Coats', f => String(f.coats)],
    ['Yellows', f => (f.ambers ? 'Yes, ambers' : 'No')], ['Smell', f => stars(f.smell)], ['Sheens', f => f.sheens.join(', ')]
  ]
  return (
    <table aria-label="Compare finishes" className="w-full border-collapse rounded-lg bg-white text-sm shadow-sm">
      <thead><tr className="border-b-2 border-stone-400 text-left"><th className="px-2 py-1" />{fs.map(f => <th key={f.id} className="px-2 py-1">{f.name}</th>)}</tr></thead>
      <tbody>{rows.map(([label, get]) => <tr key={label} className="border-b border-stone-200"><td className="px-2 py-1 font-semibold">{label}</td>{fs.map(f => <td key={f.id} className="px-2 py-1">{get(f)}</td>)}</tr>)}</tbody>
    </table>
  )
}

function Checker() {
  const [top, setTop] = useState(EXAMPLES[0][0])
  const [under, setUnder] = useState(EXAMPLES[0][1])
  const a = canGoOver(top, under)
  const pick = (label: string, v: string, set: (v: string) => void) => (
    <select aria-label={label} value={v} onChange={e => set(e.target.value)} className="rounded border border-stone-300 px-2 py-1">
      {FINISHES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
    </select>
  )
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-lg">Can I put {pick('Top finish', top, setTop)} over {pick('Under finish', under, setUnder)}?</div>
      <section role="status" aria-label="Answer" className={`rounded-lg p-4 shadow-sm ${a.answer === 'yes' ? 'bg-green-50' : a.answer === 'barrier' ? 'bg-amber-50' : 'bg-red-50'}`}>
        <div className="text-2xl font-bold">{a.answer === 'yes' ? 'Yes' : a.answer === 'barrier' ? 'Yes, with a barrier coat' : 'No'}</div>
        <p className="mt-1">{a.why}</p>
        {a.barrier && <p className="mt-1 font-semibold">Put {a.barrier} between them.</p>}
        {a.wait && a.answer === 'yes' && <p className="mt-1 text-sm text-stone-700">When: {a.wait}.</p>}
      </section>
      <div className="text-sm text-stone-600">Try: {EXAMPLES.map(([t, u]) => (
        <button key={t + u} className="mr-2 underline" onClick={() => { setTop(t); setUnder(u) }}>{finishById(t)!.name} over {finishById(u)!.name.toLowerCase()}</button>
      ))}</div>
    </div>
  )
}

function ScheduleBuilder() {
  const project = useStudio(s => s.project)
  const s = project.finish
  const apply = (f: (sc: NonNullable<typeof s>) => NonNullable<typeof s> | null) => studio.getState().apply(p => setSchedule(p, p.finish ? f(p.finish) : null))
  const problems = s ? checkSchedule(s) : []
  const edit = (id: string, patch: Partial<FinishStep>) => apply(sc => ({ ...sc, steps: sc.steps.map(st => (st.id === id ? { ...st, ...patch } : st)) }))
  if (!s) {
    return (
      <div className="flex max-w-4xl flex-col gap-3">
        <p>Start the finishing schedule for <b>{project.name}</b> from one of these. You can change every step after.</p>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map(t => (
            <button key={t.id} className="rounded-lg border border-stone-300 bg-white p-3 text-left shadow-sm hover:bg-amber-50" onClick={() => studio.getState().apply(p => setSchedule(p, fromTemplate(t.id)))}>
              <div className="font-semibold">{t.name}</div><div className="text-sm text-stone-600">{t.about}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }
  const time = scheduleTime(s)
  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{s.name} — {project.name}</h2>
        <span className="text-sm text-stone-600">{time.text}</span>
        <button className="ml-auto rounded border px-2 py-0.5 text-sm" onClick={() => apply(() => null)}>Start over</button>
      </div>
      <ol aria-label="Finishing steps" className="flex flex-col gap-2">
        {s.steps.map((st, i) => {
          const issue = problems.filter(q => q.stepId === st.id)
          return (
            <li key={st.id} aria-label={`Step ${i + 1}`} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 font-bold">{i + 1}</span>
                <input aria-label="Step" value={st.title} onChange={e => edit(st.id, { title: e.target.value })} className="min-w-64 flex-1 rounded border border-stone-300 px-2 py-0.5" />
                <select aria-label="Finish" value={st.finishId ?? ''} onChange={e => {
                  // A new finish brings its own way of putting it on and its recoat time.
                  const f = finishById(e.target.value)
                  edit(st.id, f ? { finishId: f.id, method: f.methods[0], dryHours: f.recoat, sheen: f.sheens.includes(st.sheen ?? '') ? st.sheen : undefined } : { finishId: undefined, method: undefined, sheen: undefined })
                }} className="rounded border border-stone-300 px-1">
                  <option value="">(no finish — prep or other)</option>
                  {FINISHES.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {st.finishId && (
                  <select aria-label="Method" value={st.method ?? ''} onChange={e => edit(st.id, { method: (e.target.value || undefined) as FinishStep['method'] })} className="rounded border border-stone-300 px-1 text-xs">
                    {finishById(st.finishId)?.methods.map(m => <option key={m} value={m}>{m === 'wipe' ? 'Wipe' : m === 'brush' ? 'Brush' : 'Spray'}</option>)}
                  </select>
                )}
                {st.finishId && (finishById(st.finishId)?.sheens.length ?? 0) > 0 && (
                  <select aria-label="Sheen" value={st.sheen ?? ''} onChange={e => edit(st.id, { sheen: e.target.value || undefined })} className="rounded border border-stone-300 px-1 text-xs">
                    <option value="">Sheen…</option>
                    {finishById(st.finishId)!.sheens.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
                <label className="text-xs">Coats <input aria-label="Coats" type="number" min={1} max={50} value={st.coats} onChange={e => edit(st.id, { coats: Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))) })} className="w-12 rounded border border-stone-300 px-1" /></label>
                <label className="text-xs">Dry (hours) <input aria-label="Dry hours" type="number" min={0} step={0.5} value={st.dryHours} onChange={e => edit(st.id, { dryHours: Math.max(0, Number(e.target.value) || 0) })} className="w-16 rounded border border-stone-300 px-1" /></label>
                <button aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => apply(sc => { const xs = [...sc.steps]; [xs[i - 1], xs[i]] = [xs[i], xs[i - 1]]; return { ...sc, steps: xs } })} className="px-1 disabled:opacity-30">↑</button>
                <button aria-label={`Remove step ${i + 1}`} onClick={() => apply(sc => ({ ...sc, steps: sc.steps.filter(x => x.id !== st.id) }))} className="px-1 text-red-700">✕</button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 pl-8 text-sm">
                <input aria-label="Product" placeholder="Product (optional — generic or a brand)" value={st.product ?? ''} onChange={e => edit(st.id, { product: e.target.value || undefined })} className="w-72 rounded border border-stone-200 px-2 py-0.5" />
                <input aria-label="Notes" placeholder="Notes" value={st.notes ?? ''} onChange={e => edit(st.id, { notes: e.target.value || undefined })} className="flex-1 rounded border border-stone-200 px-2 py-0.5" />
              </div>
              {issue.map((q, k) => <p key={k} role="alert" className={`mt-1 pl-8 text-sm ${q.level === 'error' ? 'text-red-700' : 'text-amber-800'}`}>{q.level === 'error' ? '✕' : '!'} {q.text}</p>)}
            </li>
          )
        })}
      </ol>
      <button className="self-start rounded border border-stone-400 px-3 py-1 text-sm" onClick={() => apply(sc => ({ ...sc, steps: [...sc.steps, newStep({ kind: 'topcoat', title: 'Another coat', coats: 1, dryHours: 2 })] }))}>Add a step</button>
      <p className="text-sm text-stone-600">These steps show up in Shop Mode and can be printed from Drawings → Extras.</p>
    </div>
  )
}

function Mohawk() {
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <h2 className="text-2xl font-bold">Mohawk Finishing Products</h2>
      {MOHAWK_ABOUT.map((t, i) => <p key={i}>{t}</p>)}
      <ul aria-label="Mohawk product families" className="flex flex-col gap-2">
        {MOHAWK_FAMILIES.map(f => (
          <li key={f.name} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="font-semibold">{f.name}</div>
            <div className="text-sm">{f.what} <span className="text-stone-600">Use: {f.use}</span></div>
            <div className="text-xs text-stone-500">Generic option: {f.generic} · <button className="underline" onClick={() => openLink(f.url)}>See on Mohawk&apos;s site ↗</button></div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {MOHAWK_LINKS.map(l => <button key={l.url} className="rounded border border-stone-400 bg-white px-3 py-1 text-sm hover:bg-stone-100" onClick={() => openLink(l.url)}>{l.label} ↗</button>)}
      </div>
      <p className="text-xs text-stone-500">{MOHAWK_NOTE}</p>
    </div>
  )
}
