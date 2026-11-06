// The Smart Helpers: settings (the API key), Photo → plan, What wood is this?, Describe a project, and the
// panel with the build steps a photo plan came with.
import { useEffect, useRef, useState } from 'react'
import { serialize } from '../../model/fileFormat'
import { newId } from '../../model/ids'
import { parseInches } from '../../model/units'
import { emptyProject } from '../../model/woods'
import { openLibrary } from '../../library/ui/Library'
import { plans } from '../../plans/plansStore'
import { applyTemplate } from '../../templates'
import { thumbnail } from '../../tools/store'
import { studio, useStudio } from '../../ui/store'
import { validate } from '../../model/validate'
import { addReference } from '../../shop/references'
import { checkDescribeAnswer, matchTemplate, templateMenu } from '../describe'
import { checkPlan, checkScaled, planToProject, scalePlan, type DraftPlan, type Known } from '../plan'
import { cleanError, smart, useSmart, type HelperKind, type HelperNote } from '../smartStore'
import { checkWoodAnswer, type WoodGuess } from '../wood'

const PRIVACY = 'Pressing the button sends only this picture or text to Anthropic’s Claude service, using your API key (a few cents a request). Nothing is sent otherwise.'

function Frame({ title, children, onClose }: { title: string; children: React.ReactNode; onClose(): void }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { panel.current?.focus() }, [])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div ref={panel} tabIndex={-1} className="flex max-h-[90vh] w-[34rem] flex-col gap-3 overflow-y-auto rounded-lg bg-white p-5 shadow-xl outline-none">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">✨ {title}</h2><button onClick={onClose} className="rounded border px-2 text-sm">Close</button></div>
        {children}
      </div>
    </div>
  )
}

const NoKey = () => (
  <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">This helper uses the online Claude service and needs an Anthropic API key. <button className="underline" onClick={() => smart.getState().set({ open: 'settings' })}>Add a key in Smart Helpers settings</button>.</p>
)

/** Opens a design the helper made, as a new unsaved project, with its steps (and any warning) beside it. */
function openDesign(text: string, note?: Omit<HelperNote, 'projectKey'>) {
  studio.getState().enterMasterShop()
  studio.getState().openDesignText(text, { dirty: true, onOpened: note ? () => smart.getState().set({ steps: { ...note, projectKey: studio.getState().projectKey } }) : undefined })
}

/** Snapping to stock thicknesses can leave parts overlapping: say so, rather than leave it to be found. */
function overlapNote(p: ReturnType<typeof planToProject>): string | undefined {
  const n = validate(p).filter(w => w.kind === 'overlap').length
  return n ? `Each part was changed to the nearest stock thickness, so ${n === 1 ? 'one place has' : `${n} places have`} parts overlapping (or small gaps). Checks ▾ shows where.` : undefined
}

/** The woods a new design starts with: the only ones a helper may pick. */
const startWoods = () => emptyProject('x').woods

export function SmartSettings() {
  const hasKey = useSmart(s => s.hasKey)
  const model = useSmart(s => s.model)
  const [key, setKey] = useState('')
  const [m, setM] = useState(model)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  useEffect(() => { setM(model) }, [model])
  const save = async () => {
    setMsg(null)
    try {
      // Saving just the model keeps the key that's already there.
      if (key.trim()) await window.aa.smartSetKey(key)
      await window.aa.smartSetModel(m)
      setKey('')
      await smart.getState().refresh()
      setMsg({ text: key.trim() || hasKey ? 'Saved. The online helpers are on.' : 'Saved.' })
    } catch (e) { setMsg({ text: cleanError(e), bad: true }) }
  }
  const remove = async () => { await window.aa.smartSetKey(null); await smart.getState().refresh(); setMsg({ text: 'Key removed. The online helpers are off.' }) }
  return (
    <Frame title="Smart Helpers settings" onClose={() => smart.getState().set({ open: null })}>
      <p className="text-sm">Photo → plan, What wood is this? and Describe a project can use Anthropic’s Claude service. You need your own API key from console.anthropic.com; you pay Anthropic directly, a few cents a request, nothing when unused.</p>
      <p className="text-sm text-stone-600">The key is stored on this computer, encrypted with Windows’ own protection, and only used to call the service. A picture or text is sent only when you press a helper’s button. Kids’ Workshop has no online helpers.</p>
      <p role="status" aria-label="Helper status" className="text-sm font-semibold">{hasKey ? '✅ A key is set — the online helpers are on.' : 'No key — the online helpers are off. Describe a project still works offline.'}</p>
      <label className="flex flex-col text-sm">Anthropic API key<input aria-label="API key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={hasKey ? '(saved — type a new one to replace it)' : 'sk-ant-…'} className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col text-sm">Model<input aria-label="Model" value={m} onChange={e => setM(e.target.value)} className="rounded border px-2 py-1" /></label>
      <div className="flex gap-2">
        <button disabled={!key.trim() && m === model} onClick={() => void save()} className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40">Save</button>
        {hasKey && <button onClick={() => void remove()} className="rounded border px-3 py-1 text-sm">Remove the key</button>}
      </div>
      {msg && <p role={msg.bad ? 'alert' : 'status'} className={`text-sm ${msg.bad ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}
    </Frame>
  )
}

function PhotoPick({ photo, setPhoto }: { photo: string | null; setPhoto(p: string | null): void }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer rounded border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-amber-600">Choose a photo…<input aria-label="Photo" type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={async e => {
        const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''
        if (!f) return
        try { setPhoto(await thumbnail(f, 1568)); setErr(null) } catch (x) { setErr(cleanError(x)) }
      }} /></label>
      {photo && <img src={photo} alt="Chosen photo" className="h-20 rounded border" />}
      {err && <span role="alert" className="text-sm text-red-700">{err}</span>}
    </div>
  )
}

export function PhotoPlanDialog() {
  const hasKey = useSmart(s => s.hasKey)
  const [photo, setPhoto] = useState<string | null>(null)
  const [dim, setDim] = useState<Known['dim']>('height')
  const [size, setSize] = useState('30')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const close = () => smart.getState().set({ open: null })
  const known = parseInches(size)
  const go = async () => {
    if (!photo || !known.ok) return
    setBusy(true); setMsg(null)
    try {
      const raw = await window.aa.smartAsk({ task: 'photoPlan', image: photo, known: `overall ${dim} ${known.value} inches` })
      const plan = checkPlan(raw)
      if ('error' in plan) return setMsg(plan.error)
      const scaled = scalePlan(plan, { dim, value: known.value })
      const bad = checkScaled(scaled)
      if (bad) return setMsg(bad)
      const p = planToProject(scaled)
      close()
      openDesign(serialize(p), { kind: 'plan', name: plan.name, steps: plan.steps, note: overlapNote(p) })
    } catch (e) { setMsg(cleanError(e)) } finally { setBusy(false) }
  }
  const trace = async () => {
    close()
    const st = studio.getState()
    st.enterMasterShop()
    if (photo) {
      // The chosen photo goes straight in as a tracing picture, on the plane that shows the known measurement.
      const aspect = await new Promise<number>(r => { const im = new Image(); im.onload = () => r(im.naturalWidth / Math.max(1, im.naturalHeight) || 1); im.onerror = () => r(1); im.src = photo })
      st.apply(p => addReference(p, { name: 'Photo to trace', dataUrl: photo, aspect, plane: dim === 'depth' ? 'side' : 'front' }).project)
      const v = known.ok ? `${known.value}"` : 'the size you know'
      smart.getState().set({ steps: { kind: 'trace', name: 'Trace your photo', projectKey: studio.getState().projectKey, steps: [
        `In 🖼 Pictures, press "Scale from two points" on the photo.`,
        `Click the ${dim === 'height' ? 'top and the bottom' : dim === 'width' ? 'left and right sides' : 'front and back'} of the piece in the photo, and type ${v}.`,
        'Lock the picture, then draw boards over it.'
      ] } })
    }
    st.setView({ picturesOpen: true })
  }
  return (
    <Frame title="Photo → plan" onClose={close}>
      <p className="text-sm">Take a straight-on photo of the piece, and give one measurement you know. The helper breaks it into parts and drafts a design and build steps for you to check and correct.</p>
      <PhotoPick photo={photo} setPhoto={setPhoto} />
      <div className="flex items-end gap-2 text-sm">
        <label className="flex flex-col">Known measurement<select aria-label="Which measurement" value={dim} onChange={e => setDim(e.target.value as Known['dim'])} className="rounded border px-1"><option value="height">Overall height</option><option value="width">Overall width</option><option value="depth">Overall depth</option></select></label>
        <label className="flex flex-col">Inches<input aria-label="Known size" value={size} onChange={e => setSize(e.target.value)} className="w-24 rounded border px-1" /></label>
      </div>
      {hasKey ? <>
        <button disabled={!photo || !known.ok || busy} onClick={() => void go()} className="self-start rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Working… (up to a minute)' : 'Make a plan'}</button>
        <p className="text-xs text-stone-500">{PRIVACY}</p>
      </> : <NoKey />}
      <p className="text-sm">Or <button className="underline" onClick={() => void trace()}>trace it instead</button>: put {photo ? 'this photo' : 'a photo'} in the 3D view as a tracing picture (🖼 Pictures), scale it from the measurement you know, and draw boards over it — no internet needed.</p>
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </Frame>
  )
}

export function WoodIdDialog() {
  const hasKey = useSmart(s => s.hasKey)
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [guesses, setGuesses] = useState<WoodGuess[] | null>(null)
  const close = () => smart.getState().set({ open: null })
  const go = async () => {
    if (!photo) return
    setBusy(true); setMsg(null); setGuesses(null)
    try {
      const r = checkWoodAnswer(await window.aa.smartAsk({ task: 'woodId', image: photo }))
      if ('error' in r) setMsg(r.error); else setGuesses(r)
    } catch (e) { setMsg(cleanError(e)) } finally { setBusy(false) }
  }
  return (
    <Frame title="What wood is this?" onClose={close}>
      <p className="text-sm">A close photo of a freshly sanded face (and the end grain, if you can) in daylight works best. A photo can only narrow it down — check the Library page for each guess.</p>
      <PhotoPick photo={photo} setPhoto={setPhoto} />
      {hasKey ? <>
        <button disabled={!photo || busy} onClick={() => void go()} className="self-start rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Looking…' : 'What wood is it?'}</button>
        <p className="text-xs text-stone-500">{PRIVACY}</p>
      </> : <NoKey />}
      {guesses && (
        <ol aria-label="Wood guesses" className="flex flex-col gap-2">
          {guesses.map(g => (
            <li key={g.species.id} className="rounded border p-2 text-sm">
              <div className="flex items-center gap-2"><span className="h-4 w-4 rounded" style={{ background: g.species.colour }} /><b>{g.species.name}</b><span className="text-stone-500">({g.sure})</span>
                <button className="ml-auto underline" onClick={() => { close(); openLibrary(studio.getState().screen === 'master' ? 'master' : 'home', 'species', { speciesId: g.species.id }) }}>Library page</button></div>
              {g.look && <p className="mt-1 text-stone-700">{g.look}</p>}
            </li>
          ))}
        </ol>
      )}
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </Frame>
  )
}

export function DescribeDialog() {
  const hasKey = useSmart(s => s.hasKey)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const close = () => smart.getState().set({ open: null })
  const offline = text.trim() ? matchTemplate(text) : null
  const useTemplate = (id: string, params: Record<string, unknown>) => {
    // Built first, so a problem shows here instead of closing the dialog on nothing.
    try {
      const p = applyTemplate(emptyProject(text.trim().slice(0, 40) || 'Project'), id, params as never)
      close()
      openDesign(serialize(p))
    } catch (e) { setMsg(cleanError(e)) }
  }
  const online = async () => {
    setBusy(true); setMsg(null)
    try {
      const woods = startWoods()
      const r = checkDescribeAnswer(await window.aa.smartAsk({ task: 'describe', text, templates: templateMenu(woods) }), woods)
      if ('error' in r) return setMsg(r.error)
      if ('template' in r) return useTemplate(r.template, r.params)
      const p = planToProject(r.plan as DraftPlan)
      close()
      openDesign(serialize(p), { kind: 'plan', name: r.plan.name, steps: r.plan.steps, note: overlapNote(p) })
    } catch (e) { setMsg(cleanError(e)) } finally { setBusy(false) }
  }
  return (
    <Frame title="Describe a project" onClose={close}>
      <label className="flex flex-col text-sm">What do you want to make?<textarea aria-label="Description" value={text} onChange={e => setText(e.target.value)} placeholder="A bookshelf 30 inches wide and 4 feet tall with three shelves" className="h-20 rounded border px-2 py-1" /></label>
      <div className="rounded bg-stone-50 p-2 text-sm">
        <b>Offline:</b> {offline ? <>closest template — <b>{offline.def.name}</b>{offline.read.length ? ` (${offline.read.join(', ')})` : ''}. <button onClick={() => useTemplate(offline.def.id, offline.params)} className="ml-1 rounded border bg-white px-2">Start from it</button></> : text.trim() ? 'no template matches those words — try a bookshelf, wall shelf, box, side table, workbench, base cabinet, cutting board, step stool or birdhouse, with sizes like "30 wide, 4 feet tall" or "30 x 48 x 12" (width × height × depth).' : 'type a description.'}
      </div>
      {hasKey ? <>
        <button disabled={!text.trim() || busy} onClick={() => void online()} className="self-start rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Working…' : 'Ask the online helper'}</button>
        <p className="text-xs text-stone-500">{PRIVACY}</p>
      </> : <p className="text-xs text-stone-500">With an API key, the online helper can also draft designs no template covers.</p>}
      {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
    </Frame>
  )
}

/** The build steps that came with a photo or described plan (or how to trace a photo), beside the new design. */
export function HelperSteps() {
  const steps = useSmart(s => s.steps)
  const key = useStudio(s => s.projectKey)
  const kids = useStudio(s => s.kidsMode)
  const [err, setErr] = useState<string | null>(null)
  // They belong to one design: put away when another opens, or in Kids' Workshop.
  useEffect(() => { if (steps && (steps.projectKey !== key || kids)) smart.getState().set({ steps: null }) }, [steps, key, kids])
  if (!steps || steps.projectKey !== key || kids) return null
  const toPlan = async () => {
    try {
      studio.getState().goto('plans')
      await plans.getState().openLibrary(false, () => studio.getState().goto('master'))
      await plans.getState().create()
      await plans.getState().update(p => ({ ...p, name: steps.name, steps: steps.steps.map(text => ({ id: newId('s'), text })) }))
      smart.getState().set({ steps: null })
    } catch (e) { setErr(cleanError(e)) }
  }
  const heading = steps.kind === 'trace' ? '🖼 Trace your photo' : '✨ Check these — a first draft from the helper'
  return (
    <aside aria-label="Helper build steps" className="fixed bottom-4 right-4 z-30 flex max-h-[50vh] w-96 flex-col gap-2 overflow-y-auto rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm shadow-lg">
      <div className="flex items-center justify-between"><b>{heading}</b><button aria-label="Close steps" onClick={() => smart.getState().set({ steps: null })}>✕</button></div>
      {steps.kind === 'plan' && <p>Sizes and parts are a first guess: measure what you can and fix them in the design.</p>}
      {steps.note && <p role="note" className="rounded bg-amber-100 p-1">⚠ {steps.note}</p>}
      {steps.steps.length > 0 && <ol className="ml-5 list-decimal">{steps.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>}
      {steps.kind === 'plan' && steps.steps.length > 0 && <button onClick={() => void toPlan()} className="self-start rounded bg-amber-700 px-3 py-1 font-semibold text-white">Start a plan with these steps</button>}
      {err && <p role="alert" className="text-red-700">{err}</p>}
    </aside>
  )
}

/** Whichever helper is open (mounted once, at the top of the app). */
export function SmartHelpers() {
  const open = useSmart(s => s.open)
  useEffect(() => { void smart.getState().refresh() }, [open])
  return (
    <>
      {open === 'settings' && <SmartSettings />}
      {open === 'photoPlan' && <PhotoPlanDialog />}
      {open === 'woodId' && <WoodIdDialog />}
      {open === 'describe' && <DescribeDialog />}
      <HelperSteps />
    </>
  )
}
export const openHelper = (k: HelperKind | 'settings') => smart.getState().set({ open: k })
