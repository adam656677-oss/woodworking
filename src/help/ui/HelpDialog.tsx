// The Help window: "How do I…" topics you can search, the keyboard shortcuts, and a bigger, simpler version for the
// Kids' Workshop. Opened by openHelp(); shown by HelpHost.
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { closeHelp, help, useHelp, type HelpView } from '../helpStore'
import { KIDS_TOPICS } from '../kidsTopics'
import { searchTopics } from '../search'
import { SHORTCUTS, searchShortcuts, shortcutsByArea, type Shortcut } from '../shortcuts'
import { MASTER_TOPICS } from '../topics'
import type { HelpTopic } from '../types'

/** Text with **names** of buttons shown in bold. */
export function Rich({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>
}

function Keys({ keys, big }: { keys: string[]; big?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((k, i) => (
        <Fragment key={k}>
          {i > 0 && <span className="text-stone-500">or</span>}
          <kbd className={`rounded border border-stone-400 bg-stone-100 px-1.5 py-0.5 font-mono ${big ? 'text-lg' : 'text-xs'}`}>{k}</kbd>
        </Fragment>
      ))}
    </span>
  )
}

function ShortcutRows({ items, big }: { items: Shortcut[]; big?: boolean }) {
  return (
    <ul className="flex flex-col divide-y divide-stone-200">
      {items.map(s => (
        <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
          <span className="w-56 shrink-0"><Keys keys={s.keys} big={big} /></span>
          <span className="min-w-0 flex-1">{s.does}</span>
        </li>
      ))}
    </ul>
  )
}

function TopicBody({ topic, big }: { topic: HelpTopic; big?: boolean }) {
  const related = (topic.shortcuts ?? []).map(id => SHORTCUTS.find(s => s.id === id)).filter((s): s is Shortcut => !!s)
  return (
    <article>
      <h3 className={`${big ? 'text-4xl' : 'text-xl'} font-bold`}>{topic.title}</h3>
      <p className={`mt-1 ${big ? 'text-2xl' : 'text-stone-600'}`}>{topic.summary}</p>
      <ol aria-label="Steps" className={`mt-4 flex list-decimal flex-col pl-6 ${big ? 'gap-4 text-2xl leading-relaxed' : 'gap-2'}`}>
        {topic.steps.map((step, i) => <li key={i} className="pl-1"><Rich text={step} /></li>)}
      </ol>
      {topic.tip && <p className={`mt-4 rounded border-l-4 ${big ? 'border-green-500 bg-green-50 p-4 text-2xl' : 'border-amber-500 bg-amber-50 p-3'}`}><strong>Tip: </strong><Rich text={topic.tip} /></p>}
      {related.length > 0 && <div className="mt-4"><h4 className={`mb-1 font-semibold ${big ? 'text-2xl' : ''}`}>Keys for this</h4><ShortcutRows items={related} big={big} /></div>}
    </article>
  )
}

function useFocusTrap() {
  const box = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys typed in Help belong to Help: the design screen underneath must not see Delete, Ctrl+Z and the rest.
    e.stopPropagation()
    if (e.key !== 'Tab' || !box.current) return
    const items = Array.from(box.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, [href], [tabindex]:not([tabindex="-1"])'))
    if (!items.length) return
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && (document.activeElement === last || !box.current.contains(document.activeElement))) { e.preventDefault(); first.focus() }
  }
  return { box, onKeyDown }
}

export function HelpDialog() {
  const audience = useHelp(s => s.audience)
  const view = useHelp(s => s.view)
  const topicId = useHelp(s => s.topicId)
  const kid = audience === 'kids'
  const titleId = useId()
  const { box, onKeyDown } = useFocusTrap()
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const topics = kid ? KIDS_TOPICS : MASTER_TOPICS
  const results = useMemo(() => searchTopics(topics, query), [topics, query])
  const shown = results.find(t => t.id === topicId) ?? (kid ? undefined : results[0])
  const pick = (id: string | null) => help.setState({ topicId: id })
  const setView = (v: HelpView) => { help.setState({ view: v }); setQuery('') }

  useEffect(() => { (kid ? close.current : search.current ?? close.current)?.focus() }, [kid])

  const tab = (v: HelpView, label: string) => (
    <button type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
      className={`px-4 py-2 text-sm ${view === v ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600 hover:text-stone-900'}`}>{label}</button>
  )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget) closeHelp() }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} data-audience={audience} onKeyDown={onKeyDown}
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-stone-900 shadow-2xl ${kid ? 'max-w-4xl border-4 border-sky-300 text-xl' : 'max-w-5xl text-sm'}`}>
        <header className={`flex flex-wrap items-center gap-3 border-b px-5 py-3 ${kid ? 'border-sky-200 bg-sky-50' : 'border-stone-200 bg-stone-50'}`}>
          <h2 id={titleId} className={`mr-2 font-bold ${kid ? 'text-4xl text-sky-900' : 'text-lg'}`}>Help</h2>
          {!kid && <div role="tablist" aria-label="Help sections" className="flex">{tab('topics', 'How do I…')}{tab('shortcuts', 'Keyboard shortcuts')}</div>}
          <button ref={close} type="button" aria-label="Close help" onClick={closeHelp}
            className={`ml-auto rounded-lg font-semibold ${kid ? 'bg-sky-600 px-6 py-3 text-2xl text-white hover:bg-sky-700' : 'border border-stone-300 bg-white px-3 py-1 hover:bg-stone-100'}`}>
            {kid ? 'Close' : 'Close (Esc)'}
          </button>
        </header>

        {!kid && (
          <div className="border-b border-stone-200 px-5 py-2">
            <input ref={search} type="search" aria-label="Search help" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={view === 'topics' ? 'Search, for example: cut list, joints, autosave' : 'Search keys, for example: undo, Ctrl+S, drawing'}
              className="w-full rounded border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" />
          </div>
        )}

        {view === 'shortcuts' && !kid ? (
          <div role="tabpanel" aria-label="Keyboard shortcuts" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {(() => {
              const groups = shortcutsByArea(searchShortcuts(query))
              if (!groups.length) return <p role="status">No shortcuts match &ldquo;{query}&rdquo;.</p>
              return groups.map(g => (
                <section key={g.area} aria-label={g.area} className="mb-5">
                  <h3 className="mb-1 text-base font-bold">{g.area}</h3>
                  <ShortcutRows items={g.items} />
                </section>
              ))
            })()}
          </div>
        ) : kid ? (
          <div role="tabpanel" aria-label="Help topics" className="min-h-0 flex-1 overflow-y-auto p-6">
            {shown ? (
              <>
                <button type="button" onClick={() => pick(null)} className="mb-4 rounded-xl bg-sky-100 px-5 py-2 text-xl font-semibold text-sky-900 hover:bg-sky-200">← All help</button>
                <TopicBody topic={shown} big />
              </>
            ) : (
              <>
                <p className="mb-4 text-2xl">What do you want help with?</p>
                <ul aria-label="Help topics" className="grid grid-cols-2 gap-4">
                  {topics.map(t => (
                    <li key={t.id}>
                      <button type="button" onClick={() => pick(t.id)} className="w-full rounded-2xl border-4 border-sky-200 bg-sky-50 p-4 text-left text-2xl font-bold hover:bg-sky-100">{t.title}</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div role="tabpanel" aria-label="How do I…" className="flex min-h-0 flex-1">
            <nav aria-label="Topics" className="w-72 shrink-0 overflow-y-auto border-r border-stone-200 p-2">
              {results.length === 0 ? (
                <p role="status" className="p-3 text-stone-600">No help topics match &ldquo;{query}&rdquo;. Try fewer or different words.</p>
              ) : (
                <ul aria-label="Help topics">
                  {results.map((t, i) => (
                    <li key={t.id}>
                      {(!query.trim() && (i === 0 || results[i - 1].group !== t.group)) && <p className="mt-2 px-2 pt-1 text-xs font-bold uppercase tracking-wide text-stone-500">{t.group}</p>}
                      <button type="button" aria-current={shown?.id === t.id ? 'true' : undefined} onClick={() => pick(t.id)}
                        className={`w-full rounded px-2 py-1.5 text-left hover:bg-stone-100 ${shown?.id === t.id ? 'bg-amber-100 font-semibold' : ''}`}>{t.title}</button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto p-5">{shown && <TopicBody topic={shown} />}</div>
          </div>
        )}
      </div>
    </div>
  )
}
