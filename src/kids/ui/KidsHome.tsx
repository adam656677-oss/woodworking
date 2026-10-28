import { studio } from '../../ui/store'
import { Art } from '../art'
import { kids, useKids } from '../kidsStore'

const TILES = [
  { page: 'path', label: 'My Path', art: 'rules', color: 'border-green-500 bg-green-100' },
  { page: 'projects', label: 'Projects', art: 'birdhouse', color: 'border-amber-500 bg-amber-100' },
  { page: 'learn', label: 'Learn', art: 'tree', color: 'border-sky-500 bg-sky-100' },
  { page: 'badges', label: 'My Badges', art: 'first-aid', color: 'border-rose-400 bg-rose-100' }
] as const

/** The Kids' Workshop front door: five big tiles and the parent gear. */
export function KidsHome() {
  const name = useKids(s => s.progress.childName)
  const k = kids.getState()
  return (
    <main className="flex h-full flex-col items-center bg-gradient-to-b from-sky-100 to-sky-50 p-8 text-sky-950">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <button onClick={() => studio.getState().goto('home')} className="rounded-xl bg-white px-5 py-2 text-lg font-semibold shadow hover:bg-sky-100">← Home</button>
        <button aria-label="Parent" title="Parent settings" onClick={() => k.go({ name: 'parent' })} className="rounded-full bg-white p-3 text-2xl shadow hover:bg-sky-100">⚙️</button>
      </div>
      <h1 className="mt-4 text-5xl font-bold">Kids&apos; Workshop</h1>
      <p className="mt-2 text-2xl">{name ? `Hi, ${name}! What are we making today?` : 'What are we making today?'}</p>
      <div className="mt-10 grid grid-cols-3 gap-6">
        {TILES.map(t => (
          <button key={t.page} onClick={() => k.go({ name: t.page })} className={`flex h-48 w-60 flex-col items-center justify-center gap-3 rounded-3xl border-4 shadow-lg hover:scale-105 ${t.color}`}>
            <Art name={t.art} className="block h-20 w-20" />
            <span className="text-2xl font-bold">{t.label}</span>
          </button>
        ))}
        <button onClick={() => studio.getState().enterKidsDesigner()} className="flex h-48 w-60 flex-col items-center justify-center gap-3 rounded-3xl border-4 border-violet-400 bg-violet-100 shadow-lg hover:scale-105">
          <Art name="pencil" className="block h-20 w-20" />
          <span className="text-2xl font-bold">Simple Designer</span>
        </button>
      </div>
    </main>
  )
}
