import { useEffect, useState } from 'react'
import { Art } from '../art'
import { findProject } from '../content'
import { badges } from '../logic'
import { kids, useKids } from '../kidsStore'
import { KidsPageFrame } from './kit'

function Photo({ name }: { name: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void window.aa.kidsPhotoUrl(name).then(setUrl)
  }, [name])
  return url ? <img src={url} alt="Finished project" className="mt-2 h-32 rounded-xl object-cover" /> : null
}

export function BadgesView() {
  const progress = useKids(s => s.progress)
  const list = badges(progress)
  return (
    <KidsPageFrame title="My Badges">
      {list.length === 0 ? (
        <p className="mx-auto max-w-2xl text-center text-2xl">No badges yet. Pass a level quiz or build a project with your grown-up to earn one!</p>
      ) : (
        <ul className="mx-auto grid max-w-5xl grid-cols-3 gap-6">
          {list.map(b => {
            const proj = b.kind === 'project' ? findProject(b.id.replace(/^project-/, '')) : undefined
            const photo = proj ? progress.builtProjects[proj.id]?.photo : undefined
            return (
              <li key={b.id} className="flex flex-col items-center rounded-3xl border-4 border-amber-300 bg-white p-5 text-center shadow">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-100">
                  <Art name={proj?.picture ?? 'rules'} className="block h-16 w-16" />
                </div>
                <h2 className="mt-2 text-2xl font-bold">{b.name}</h2>
                <p className="text-lg text-stone-600">{b.kind === 'level' ? 'Level badge' : 'Built it!'} · {b.date}</p>
                {photo && <Photo name={photo} />}
                <button onClick={() => kids.getState().go({ name: 'certificate', badgeId: b.id })} className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-lg font-semibold text-white">Print certificate</button>
              </li>
            )
          })}
        </ul>
      )}
    </KidsPageFrame>
  )
}
