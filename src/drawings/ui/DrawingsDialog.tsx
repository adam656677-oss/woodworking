// Drawings and printing: views, part sheets, full-size templates and extras the build plan does not cover; print or save as PDF.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cutList } from '../../model/cutlist'
import { formatInches } from '../../model/units'
import type { Project } from '../../model/types'
import { entryFor, journalTotals, tools, useTools } from '../../tools/store'
import { stepsFromDesign } from '../../shop/steps'
import { finishById } from '../../finish/finishes'
import { scheduleTime, stepText } from '../../finish/schedule'
import { studio, useStudio } from '../../ui/store'
import { useRender, type RenderedView } from '../../render/renderStore'
import { PAPERS, SCALES, type Paper, type ScaleChoice } from '../sheet'
import { shapedParts, templatesFor } from '../tiles'
import { drawingSheets, partList, pictureSvg, type Sheet } from '../views'

type Tab = 'views' | 'parts' | 'templates' | 'extras'
type PageSpec = { key: string; kind: 'sheet'; paper: Paper; svg: string } | { key: string; kind: 'tile'; svg: string } | { key: string; kind: 'html'; node: ReactNode }

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const shaped = (p: Project) => shapedParts(p).map(q => q.boardId)

export function DrawingsDialog() {
  const project = useStudio(s => s.project)
  const kids = useStudio(s => s.kidsMode)
  const [tab, setTab] = useState<Tab>('views')
  const [paper, setPaper] = useState<Paper>('letter')
  const [scale, setScale] = useState<ScaleChoice>('auto')
  const [hidden, setHidden] = useState(true)
  const [views, setViews] = useState({ views: true, exploded: true, section: true })
  const parts = useMemo(() => partList(project), [project])
  const [chosen, setChosen] = useState<string[]>(() => parts.map(q => q.boardId))
  const [tmpl, setTmpl] = useState<string[]>(() => shaped(project))
  // The drawings, cut list, shopping list, hardware, steps and templates of a whole plan now come from Create Build Plan; these are what it doesn't cover.
  const [extras, setExtras] = useState({ finish: true, journal: true, renders: true })
  const [pages, setPages] = useState<PageSpec[] | null>(null)
  const [message, setMessage] = useState<{ text: string; bad?: boolean } | null>(null)
  const journal = useTools(s => s.journal)
  useEffect(() => { if (!tools.getState().loaded) void tools.getState().load() }, [])
  const filePath = useStudio(s => s.filePath)
  const renders = useRender(s => s.views)
  const hasJournal = journal.some(e => entryFor(e, { name: project.name, file: filePath }))

  const close = () => studio.getState().set({ drawingsOpen: false })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    // Printing shows only this dialog, laid out as plain pages (named pages need normal flow, not a fixed overlay).
    document.body.classList.add('printing-drawings')
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('printing-drawings') }
  }, [])

  // The pages are drawn a moment after the choice changes, so "Drawing…" shows first.
  const key = JSON.stringify([tab, paper, scale, hidden, views, chosen, tmpl, extras, kids])
  useEffect(() => {
    setPages(null)
    setMessage(null)
    const t = window.setTimeout(() => {
      try { setPages(buildPages()) } catch (err) { setMessage({ text: `Couldn't draw this: ${(err as Error).message}`, bad: true }); setPages([]) }
    }, 30)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, project])

  function buildPages(): PageSpec[] {
    const opts = { paper, scale, hidden, date: today() }
    const sheetPages = (s: Sheet[], tag: string): PageSpec[] => s.map((x, i) => ({ key: `${tag}${i}`, kind: 'sheet', paper: x.paper, svg: x.svg }))
    const tiles = (ids: string[]): PageSpec[] => {
      const picked = parts.filter(q => ids.includes(q.boardId))
      if (!picked.length) return []
      return templatesFor(project, picked).flatMap(t => t.pages.map((svg, i) => ({ key: `t${t.boardId}${i}`, kind: 'tile' as const, svg })))
    }
    if (kids) return kidsPages(project)
    if (tab === 'views') return sheetPages(drawingSheets(project, views, opts), 'v')
    if (tab === 'parts') return sheetPages(drawingSheets(project, { parts: chosen }, opts), 'p')
    if (tab === 'templates') return tiles(tmpl)
    // Extras: what Create Build Plan doesn't cover.
    const out: PageSpec[] = []
    if (extras.renders && renders.length) out.push({ key: 'renders', kind: 'html', node: <RendersPage p={project} views={renders} /> })
    if (extras.finish && project.finish) out.push({ key: 'finish', kind: 'html', node: <FinishPage p={project} /> })
    if (extras.journal && hasJournal) out.push({ key: 'journal', kind: 'html', node: <JournalPage p={project} /> })
    return out
  }

  const fileName = () => `${project.name || 'Untitled'} ${kids ? 'plan' : tab === 'extras' ? 'extras' : tab === 'templates' ? 'templates' : 'drawings'}`
  const savePdf = async () => {
    const path = await window.aa.savePdf(fileName())
    if (path) setMessage({ text: `Saved ${path}` })
  }

  // Printing goes through a PDF so every page keeps its own size and full-size templates stay full size.
  const printIt = async () => {
    const ok = await window.aa.printPdf(fileName())
    setMessage(ok ? { text: 'Opened in your PDF viewer — print it at 100% ("Actual size"), not "Fit".' } : { text: 'Couldn\'t open the PDF to print. Use Save as PDF instead.', bad: true })
  }
  const tabs: [Tab, string][] = [['views', 'Views'], ['parts', 'Part sheets'], ['templates', 'Templates'], ['extras', 'Extras']]
  const box = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={on} onChange={e => set(e.target.checked)} />{label}</label>
  )

  return createPortal(
    <div role="dialog" aria-label="Drawings" className="drawings-print fixed inset-0 z-30 flex flex-col bg-stone-200 print:bg-white">
      <header className="no-print flex flex-wrap items-center gap-3 border-b border-stone-300 bg-white px-4 py-2 print:hidden">
        <h2 className="mr-2 text-lg font-bold">{kids ? 'Print my plan' : 'Drawings'}</h2>
        {!kids && (
          <nav role="tablist" className="flex gap-1">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1 text-sm ${tab === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>
            ))}
          </nav>
        )}
        <div className="ml-auto flex gap-2">
          <button disabled={!pages?.length} className="rounded border px-3 py-1 text-sm hover:bg-stone-100 disabled:opacity-40" onClick={() => void printIt()}>Print</button>
          <button disabled={!pages?.length} className="rounded border px-3 py-1 text-sm hover:bg-stone-100 disabled:opacity-40" onClick={() => void savePdf()}>Save as PDF</button>
          <button className="rounded bg-amber-700 px-3 py-1 text-sm text-white" onClick={close}>Close</button>
        </div>
      </header>
      {!kids && (
        <div className="no-print flex flex-wrap items-center gap-4 border-b border-stone-300 bg-stone-50 px-4 py-2 print:hidden">
          {tab !== 'templates' && tab !== 'extras' && <>
            <label className="flex items-center gap-1 text-sm">Paper
              <select aria-label="Paper" value={paper} onChange={e => setPaper(e.target.value as Paper)} className="rounded border border-stone-300 px-1">
                {(Object.keys(PAPERS) as Paper[]).map(k => <option key={k} value={k}>{PAPERS[k].label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1 text-sm">Scale
              <select aria-label="Scale" value={String(scale)} onChange={e => setScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))} className="rounded border border-stone-300 px-1">
                <option value="auto">Fit the page</option>
                {SCALES.map(s => <option key={s} value={s}>{s === 1 ? 'Full size (1:1)' : `1:${s}`}</option>)}
              </select>
            </label>
            {box(hidden, setHidden, 'Show hidden lines')}
          </>}
          {tab === 'views' && <>
            {box(views.views, v => setViews({ ...views, views: v }), 'Front, top and side')}
            {box(views.exploded, v => setViews({ ...views, exploded: v }), 'Exploded view')}
            {box(views.section, v => setViews({ ...views, section: v }), 'Section')}
          </>}
          {(tab === 'parts' || tab === 'templates') && (
            <PartPicker parts={parts} chosen={tab === 'parts' ? chosen : tmpl} onChange={tab === 'parts' ? setChosen : setTmpl} />
          )}
          {tab === 'extras' && <>
            {project.finish && box(extras.finish, v => setExtras({ ...extras, finish: v }), 'Finishing schedule')}
            {hasJournal && box(extras.journal, v => setExtras({ ...extras, journal: v }), 'Shop journal')}
            {renders.length > 0 && box(extras.renders, v => setExtras({ ...extras, renders: v }), 'Rendered pictures')}
          </>}
          {tab !== 'extras' && <span className="text-xs text-stone-600">For the whole plan in one go (drawings, cut list, shopping list, hardware, steps, templates), close this and use Create Build Plan.</span>}
        </div>
      )}
      {message && <p role={message.bad ? 'alert' : 'status'} className={`no-print bg-white px-4 py-1 text-xs print:hidden ${message.bad ? 'text-red-700' : 'text-green-800'}`}>{message.text}</p>}
      <div className="packet-inner flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
        {pages === null ? <p className="text-stone-600">Drawing…</p> : pages.length === 0 ? (
          <p className="text-stone-600">{project.boards.length ? (tab === 'templates' ? 'Pick the parts to make full-size templates of. Shaped parts are picked for you.' : tab === 'extras' ? 'Nothing extra to print yet. The finishing schedule, shop journal and rendered pictures show up here when this project has them.' : 'Nothing picked.') : 'Add some parts first.'}</p>
        ) : (
          <div className="flex flex-col items-center gap-6 print:block">
            {pages.map(pg => <Page key={pg.key} spec={pg} />)}
          </div>
        )}
      </div>
    </div>
  , document.body)
}

function Page({ spec }: { spec: PageSpec }) {
  if (spec.kind === 'html') return <div data-testid="drawing-page" className="drawing-page flow-page bg-white shadow">{spec.node}</div>
  const size = spec.kind === 'tile' ? { w: 8.5, h: 11, page: 'portrait-letter' } : { ...PAPERS[spec.paper], page: `sheet-${spec.paper}` }
  return <div data-testid="drawing-page" className="drawing-page bg-white shadow" style={{ width: `${size.w}in`, height: `${size.h}in`, page: size.page } as React.CSSProperties} dangerouslySetInnerHTML={{ __html: spec.svg }} />
}

function PartPicker({ parts, chosen, onChange }: { parts: ReturnType<typeof partList>; chosen: string[]; onChange(v: string[]): void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button className="rounded border px-2 text-xs" onClick={() => onChange(parts.map(q => q.boardId))}>All</button>
      <button className="rounded border px-2 text-xs" onClick={() => onChange([])}>None</button>
      {parts.map(q => (
        <label key={q.boardId} className="flex items-center gap-1">
          <input type="checkbox" aria-label={`P${q.no} ${q.name}`} checked={chosen.includes(q.boardId)} onChange={e => onChange(e.target.checked ? [...chosen, q.boardId] : chosen.filter(x => x !== q.boardId))} />P{q.no} {q.name}
        </label>
      ))}
    </div>
  )
}

const pageStyle = 'w-[8.5in] p-[0.5in] text-[11pt] leading-snug print:w-auto print:p-0'

/** The rendered pictures (3D Picture… → Render views): the big 3D view, then front and exploded side by side. */
function RendersPage({ p, views }: { p: Project; views: RenderedView[] }) {
  const [first, ...rest] = views
  return (
    <section className={pageStyle} aria-label="Rendered pictures">
      <h2 className="mb-2 text-xl font-bold">{p.name}</h2>
      <figure className="mb-3"><img src={first.dataUrl} alt={`Rendered ${first.label}`} className="max-h-[5.5in] w-full rounded object-contain" /><figcaption className="text-xs text-stone-600">{first.label}</figcaption></figure>
      <div className="grid grid-cols-2 gap-3">
        {rest.map(v => <figure key={v.key}><img src={v.dataUrl} alt={`Rendered ${v.label}`} className="max-h-[3in] w-full rounded object-contain" /><figcaption className="text-xs text-stone-600">{v.label}</figcaption></figure>)}
      </div>
    </section>
  )
}

function FinishPage({ p }: { p: Project }) {
  const s = p.finish!
  return (
    <section className={pageStyle}>
      <h2 className="mb-1 text-xl font-bold">Finishing schedule — {p.name}</h2>
      <p className="mb-3 text-[10pt] text-stone-600">{s.name} · {scheduleTime(s).text}</p>
      <ol className="flex flex-col gap-2">
        {s.steps.map((st, i) => (
          <li key={st.id} className="break-inside-avoid">
            <div className="font-semibold">☐ {i + 1}. {st.title}{st.finishId ? ` — ${finishById(st.finishId)?.name ?? ''}` : ''}</div>
            <div className="text-[10pt]">{stepText(st)}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function JournalPage({ p }: { p: Project }) {
  const ref = { name: p.name, file: studio.getState().filePath }
  const entries = tools.getState().journal.filter(e => entryFor(e, ref)).sort((a, b) => a.date.localeCompare(b.date))
  const t = journalTotals(tools.getState().journal, ref, Object.values(p.shopProgress?.minutes ?? {}).reduce((a, b) => a + b, 0))
  return (
    <section className={pageStyle}>
      <h2 className="mb-1 text-xl font-bold">Shop journal — {p.name}</h2>
      <p className="mb-3 text-[10pt] text-stone-600">{Math.round(t.minutes / 6) / 10} hours · ${t.cost.toFixed(2)} spent</p>
      {entries.map(e => (
        <div key={e.id} className="mb-3 break-inside-avoid">
          <div className="font-semibold">{e.date}{e.minutes ? ` · ${e.minutes} min` : ''}{e.costs.length ? ` · ${e.costs.map(c => `${c.what} $${c.amount.toFixed(2)}`).join(', ')}` : ''}</div>
          {e.notes && <div>{e.notes}</div>}
          {e.photos.length > 0 && <div className="mt-1 flex gap-2">{e.photos.map((ph, i) => <img key={i} src={ph} alt="" className="h-28" />)}</div>}
        </div>
      ))}
    </section>
  )
}

/** The kids' packet: a big picture, the parts in plain words, and big steps to tick off. */
function kidsPages(p: Project): PageSpec[] {
  const rows = cutList(p).rows
  const steps = stepsFromDesign(p)
  return [
    {
      key: 'k1', kind: 'html', node: (
        <section className={`${pageStyle} text-[16pt]`}>
          <h1 className="text-4xl font-bold">{p.name}</h1>
          <p className="text-lg">My plan from A&amp;A Woodworking Studio</p>
          <div className="my-4 flex justify-center" dangerouslySetInnerHTML={{ __html: pictureSvg(p, 7, 5) }} />
          <h2 className="text-2xl font-bold">The pieces</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {rows.map((r, i) => <li key={i}>☐ <b>{r.qty} × {r.part}</b> — {formatInches(r.length)} long, {formatInches(r.width)} wide</li>)}
          </ul>
        </section>
      )
    },
    {
      key: 'k2', kind: 'html', node: (
        <section className={`${pageStyle} text-[16pt]`}>
          <h2 className="text-3xl font-bold">How to build it</h2>
          <ol className="mt-3 flex flex-col gap-4">
            {steps.map((s, i) => (
              <li key={s.key} className="break-inside-avoid">
                <div className="text-2xl font-bold">☐ Step {i + 1}: {s.title}</div>
                <div>{s.text}</div>
                {s.adult && <div className="font-semibold text-red-700">A grown-up does this step.</div>}
              </li>
            ))}
          </ol>
        </section>
      )
    }
  ]
}
