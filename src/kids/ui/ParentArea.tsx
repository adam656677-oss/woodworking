import { useEffect, useState } from 'react'
import { LEVELS, PROJECTS } from '../content'
import { projectUnlocked } from '../logic'
import { kids, useKids } from '../kidsStore'
import type { ChildTier } from '../progress'
import { KidsPageFrame } from './kit'

const TIERS: { id: ChildTier; label: string; tools: string }[] = [
  { id: 'beginner', label: 'Beginner', tools: 'Hand tools only' },
  { id: 'intermediate', label: 'Intermediate', tools: 'Adds drill/driver, jigsaw, scroll saw, random-orbit sander' },
  { id: 'advanced', label: 'Advanced', tools: 'Adds brad nailer, block plane, rotary tool' }
]

const field = 'rounded border-2 border-stone-300 px-3 py-2 text-lg'

function ForgotPin() {
  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    void window.aa.kidsPinPath().then(setPath)
  }, [])
  return (
    <details className="mt-6 text-base text-stone-600">
      <summary className="cursor-pointer">Forgot the PIN?</summary>
      <p className="mt-2">Close the app and delete the file <code>kids-pin.json</code>, then set a new PIN here. Badges and progress are kept.</p>
      {path && <p className="mt-1 break-all"><code>{path}</code></p>}
    </details>
  )
}

/** First-time setup: the child's first name (for certificates) and a 4-digit PIN. */
function Setup({ onDone, title = 'Set up the parent PIN' }: { onDone(pin: string): void; title?: string }) {
  const current = useKids(s => s.progress.childName)
  const [name, setName] = useState(current)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    if (!name.trim()) return setError("Please enter your child's first name.")
    if (!/^\d{4}$/.test(a)) return setError('The PIN must be 4 numbers.')
    if (a !== b) return setError("The two PINs don't match.")
    await kids.getState().setNameAndPin(name, a)
    onDone(a)
  }
  return (
    <form onSubmit={e => { e.preventDefault(); void save() }} className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-lg text-stone-600">The PIN guards tool levels, finished-project badges and these settings.</p>
      <label className="flex flex-col gap-1 text-lg">Child&apos;s first name<input aria-label="Child's first name" value={name} onChange={e => setName(e.target.value)} className={field} /></label>
      <label className="flex flex-col gap-1 text-lg">New PIN (4 numbers)<input aria-label="New PIN" type="password" inputMode="numeric" maxLength={4} value={a} onChange={e => setA(e.target.value)} className={field} /></label>
      <label className="flex flex-col gap-1 text-lg">PIN again<input aria-label="PIN again" type="password" inputMode="numeric" maxLength={4} value={b} onChange={e => setB(e.target.value)} className={field} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="submit" className="self-start rounded-xl bg-amber-700 px-5 py-2 text-lg font-semibold text-white">Save PIN</button>
    </form>
  )
}

function Unlock({ onOpen }: { onOpen(pin: string): void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const open = async () => {
    if (await window.aa.kidsCheckPin(pin)) onOpen(pin)
    else {
      setWrong(true)
      setPin('')
    }
  }
  return (
    <form onSubmit={e => { e.preventDefault(); void open() }} className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold">Grown-ups only</h2>
      <label className="flex flex-col gap-1 text-lg">Parent PIN<input autoFocus aria-label="PIN" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} className={`${field} w-40 text-2xl tracking-widest`} /></label>
      {wrong && <p role="alert" className="text-red-700">That PIN isn&apos;t right.</p>}
      <button type="submit" className="self-start rounded-xl bg-amber-700 px-5 py-2 text-lg font-semibold text-white">Open</button>
    </form>
  )
}

function Settings({ pin, onPinChanged }: { pin: string; onPinChanged(pin: string): void }) {
  const progress = useKids(s => s.progress)
  const notice = useKids(s => s.notice)
  const [changing, setChanging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const k = kids.getState()
  const ready = PROJECTS.filter(p => projectUnlocked(p, progress) && !(p.id in progress.builtProjects))
  const built = PROJECTS.filter(p => p.id in progress.builtProjects)
  const passed = LEVELS.filter(l => l.quiz in progress.passedQuizzes)

  const addPhoto = async (projectId: string) => {
    try {
      const name = await window.aa.kidsAddPhoto(projectId)
      if (name) await k.setPhoto(projectId, name)
    } catch (e) {
      setMessage((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  if (changing) return <Setup title="Change name or PIN" onDone={p => { onPinChanged(p); setChanging(false) }} />

  return (
    <div className="flex flex-col gap-6">
      {notice && <p role="status" className="rounded-xl bg-amber-100 p-3 text-lg text-amber-900">{notice}</p>}
      {message && <p role="alert" className="rounded-xl bg-red-100 p-3 text-lg text-red-800">{message}</p>}
      <section>
        <h2 className="mb-2 text-2xl font-bold">Tool level for {progress.childName || 'your child'}</h2>
        <div role="radiogroup" aria-label="Tool level" className="flex flex-col gap-2">
          {TIERS.map(t => (
            <label key={t.id} className="flex items-center gap-3 text-lg">
              <input type="radio" name="tier" aria-label={t.label} checked={progress.tier === t.id} onChange={() => void k.setTier(t.id, pin)} className="h-5 w-5" />
              <span><strong>{t.label}</strong> — {t.tools}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-base text-stone-600">Table saw, miter saw, router, lathe, band saw and planer are always grown-up only.</p>
      </section>
      <section>
        <h2 className="mb-2 text-2xl font-bold">Finished projects</h2>
        {ready.length === 0 && built.length === 0 && <p className="text-lg text-stone-600">Nothing to confirm yet. Projects unlock as level quizzes are passed.</p>}
        <ul className="flex flex-col gap-2">
          {ready.map(p => (
            <li key={p.id} className="flex items-center gap-3 text-lg">
              <span className="flex-1">{p.name}</span>
              <button onClick={() => void k.confirmBuilt(p.id, pin)} className="rounded-lg bg-green-600 px-4 py-1 font-semibold text-white">Mark as built</button>
            </li>
          ))}
          {built.map(p => (
            <li key={p.id} className="flex items-center gap-3 text-lg">
              <span className="flex-1">{p.name} — built {progress.builtProjects[p.id].date} ✓</span>
              <button onClick={() => void addPhoto(p.id)} className="rounded-lg border border-stone-400 px-4 py-1">{progress.builtProjects[p.id].photo ? 'Change photo' : 'Add photo'}</button>
            </li>
          ))}
        </ul>
      </section>
      {passed.length > 0 && (
        <section>
          <h2 className="mb-2 text-2xl font-bold">Quizzes passed</h2>
          <ul className="flex flex-col gap-2">
            {passed.map(l => (
              <li key={l.id} className="flex items-center gap-3 text-lg">
                <span className="flex-1">Level {l.id}: {l.name} — {progress.passedQuizzes[l.quiz]}</span>
                <button onClick={() => void k.resetQuiz(l.quiz, pin)} className="rounded-lg border border-stone-400 px-4 py-1">Reset</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button onClick={() => setChanging(true)} className="self-start rounded-xl border-2 border-amber-700 px-5 py-2 text-lg">Change name or PIN</button>
    </div>
  )
}

/** Parent settings behind the PIN: tool level, confirming finished projects, photos, quiz resets. */
export function ParentArea() {
  const [pinSet, setPinSet] = useState<boolean | null>(null)
  const [pin, setPin] = useState<string | null>(null)
  useEffect(() => {
    void window.aa.kidsPinIsSet().then(setPinSet)
  }, [])
  return (
    <KidsPageFrame title="Parent settings">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow">
        {pinSet === null ? null : !pinSet ? (
          <Setup onDone={p => { setPinSet(true); setPin(p) }} />
        ) : pin ? (
          <Settings pin={pin} onPinChanged={setPin} />
        ) : (
          <Unlock onOpen={setPin} />
        )}
        <ForgotPin />
      </div>
    </KidsPageFrame>
  )
}
