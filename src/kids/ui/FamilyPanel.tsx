// The parent's family page: every child's progress at a glance; add or remove a child.
import { useEffect, useState } from 'react'
import { LEVELS, PROJECTS } from '../content'
import { badges, levelOpen } from '../logic'
import { kids, useKids } from '../kidsStore'
import type { Progress } from '../progress'

type Row = { id: string; name: string; progress: Progress }

/** The highest level open to this child (1 when only the first is). */
export const levelReached = (p: Progress) => Math.max(1, ...LEVELS.filter(l => levelOpen(l.id, p)).map(l => l.id))

export function FamilyPanel({ pin }: { pin: string }) {
  const active = useKids(s => s.profiles.active)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const reload = async () => { setRows(await window.aa.kidsFamily(pin)); await kids.getState().refreshProfiles() }
  useEffect(() => { void reload() }, [pin])
  const add = async () => {
    const id = await window.aa.kidsAddProfile(name, pin)
    if (!id) return setMsg("Couldn't add that child.")
    setMsg(`${name.trim()} is added. Pick them on the workshop's front page.`)
    setName('')
    await reload()
  }
  const remove = async (id: string) => {
    setRemoving(null)
    try { await window.aa.kidsRemoveProfile(id, pin) } catch (e) { return setMsg((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')) }
    if (id === active) await kids.getState().switchChild((await window.aa.kidsProfiles()).active)
    await reload()
  }
  return (
    <section aria-label="Family">
      <h2 className="mb-2 text-2xl font-bold">Family</h2>
      {rows && (
        <table className="w-full max-w-3xl text-left text-lg">
          <thead><tr className="border-b-2 border-stone-300"><th>Child</th><th>Level</th><th>Quizzes</th><th>Lessons</th><th>Built</th><th>Badges</th><th>Tools</th><th /></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-stone-200">
                <td className="py-1 font-semibold">{r.name || '(no name yet)'}{r.id === active && <span className="ml-2 rounded bg-sky-100 px-2 text-sm">working now</span>}</td>
                <td>{levelReached(r.progress)} of {LEVELS.length}</td>
                <td>{Object.keys(r.progress.passedQuizzes).length}</td>
                <td>{r.progress.openedLessons.length}</td>
                <td>{Object.keys(r.progress.builtProjects).length} of {PROJECTS.length}</td>
                <td>{badges(r.progress).length}</td>
                <td className="capitalize">{r.progress.tier}</td>
                <td>{rows.length > 1 && (removing === r.id
                  ? <span className="flex gap-1 text-base"><button onClick={() => void remove(r.id)} className="rounded bg-red-600 px-2 text-white">Remove {r.name}</button><button onClick={() => setRemoving(null)} className="rounded border px-2">Keep</button></span>
                  : <button aria-label={`Remove ${r.name}`} onClick={() => setRemoving(r.id)} className="text-base text-red-700 underline">Remove</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input aria-label="New child's first name" placeholder="First name" value={name} onChange={e => setName(e.target.value)} className="rounded border-2 border-stone-300 px-3 py-2 text-lg" />
        <button disabled={!name.trim()} onClick={() => void add()} className="rounded-lg bg-sky-600 px-4 py-2 text-lg font-semibold text-white disabled:opacity-40">Add a child</button>
      </div>
      <p className="mt-1 text-base text-stone-600">Each child has their own path, badges and tool level. The PIN is shared. A removed child's record is kept in the app's folder, renamed.</p>
      {msg && <p role="status" className="mt-2 text-lg">{msg}</p>}
    </section>
  )
}

/** On the workshop's front page when there's more than one child: who's working? */
export function WhoIsWorking() {
  const profiles = useKids(s => s.profiles)
  if (profiles.profiles.length < 2) return null
  return (
    <div role="radiogroup" aria-label="Who's working?" className="mt-3 flex items-center gap-2 text-xl">
      <span className="font-semibold">Who&apos;s working?</span>
      {profiles.profiles.map(p => (
        <button key={p.id} role="radio" aria-checked={p.id === profiles.active} onClick={() => p.id !== profiles.active && void kids.getState().switchChild(p.id)}
          className={`rounded-full px-4 py-1 ${p.id === profiles.active ? 'bg-sky-600 text-white' : 'bg-white shadow hover:bg-sky-100'}`}>{p.name || 'Child'}</button>
      ))}
    </div>
  )
}
