import { Art } from '../art'
import { PROJECTS } from '../content'
import { projectUnlocked } from '../logic'
import { kids, useKids } from '../kidsStore'
import { KidsPageFrame, Stars } from './kit'

export function ProjectsView() {
  const progress = useKids(s => s.progress)
  return (
    <KidsPageFrame title="Projects">
      <ul className="mx-auto grid max-w-5xl grid-cols-3 gap-6">
        {PROJECTS.map(p => {
          const open = projectUnlocked(p, progress)
          const built = p.id in progress.builtProjects
          return (
            <li key={p.id}>
              <button onClick={() => kids.getState().go({ name: 'project', id: p.id })} className="flex w-full flex-col items-center gap-2 rounded-3xl border-4 border-amber-300 bg-white p-5 shadow hover:scale-105">
                <Art name={p.picture} className={`block h-28 w-28 ${open ? '' : 'opacity-50 grayscale'}`} />
                <span className="text-2xl font-bold">{p.name}</span>
                <Stars n={p.stars} />
                <span className="text-lg text-stone-600">About {p.minutes >= 60 ? `${p.minutes / 60} hour${p.minutes > 60 ? 's' : ''}` : `${p.minutes} minutes`}</span>
                {built ? <span className="text-lg font-semibold text-green-700">Built! ✓</span> : !open && <span className="text-lg text-stone-500">🔒 Level {p.level}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </KidsPageFrame>
  )
}
