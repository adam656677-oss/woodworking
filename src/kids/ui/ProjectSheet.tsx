import { useState } from 'react'
import { designFor, findProject, TOOLS } from '../content'
import { adultDoes } from '../logic'
import { kidFinish } from '../../finish/kids'
import { kids, useKids } from '../kidsStore'
import { CutSheet } from './CutSheet'
import { Stars } from './kit'
import { ProjectViewer } from './ProjectViewer'

/** The printable project sheet (letter, portrait): picture, tools, steps to check off, cut sheet. */
export function ProjectSheet({ projectId }: { projectId: string }) {
  const proj = findProject(projectId)!
  const progress = useKids(s => s.progress)
  const [picture, setPicture] = useState<string | null>(null)
  const design = designFor(projectId)
  const finish = kidFinish(proj)
  return (
    <main className="h-full overflow-y-auto bg-stone-200 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[8.5in] gap-3 print:hidden">
        <button onClick={() => kids.getState().go({ name: 'project', id: projectId })} className="rounded-xl bg-sky-600 px-5 py-2 text-lg font-semibold text-white">← Back</button>
        <button onClick={() => void window.aa.print({ landscape: false })} className="rounded-xl bg-amber-600 px-5 py-2 text-lg font-semibold text-white">🖨 Print</button>
      </div>
      <article aria-label="Project sheet" className="print-area mx-auto max-w-[8.5in] bg-white p-8 text-stone-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b-4 border-amber-500 pb-3">
          <div>
            <h1 className="text-4xl font-bold">{proj.name}</h1>
            <p className="text-lg">{proj.blurb}</p>
          </div>
          <div className="text-right text-lg">
            <Stars n={proj.stars} />
            <div>About {proj.minutes} minutes</div>
            <div className="text-sm text-stone-500">A&amp;A Woodworking · Kids&apos; Workshop</div>
          </div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <ProjectViewer project={design} onSnapshot={setPicture} className="h-56 overflow-hidden rounded-xl border print:hidden" />
            {picture && <img src={picture} alt={`${proj.name} picture`} className="hidden h-56 w-full rounded-xl border object-contain print:block" />}
          </div>
          <section>
            <h2 className="text-2xl font-bold">Tools</h2>
            <ul className="mt-1 text-base">
              {proj.tools.map(t => (
                <li key={t}>☐ {TOOLS[t].name}{adultDoes(t, progress.tier) && <strong className="text-red-700"> — Adult does this</strong>}</li>
              ))}
            </ul>
          </section>
        </div>
        <section className="mt-4">
          <h2 className="text-2xl font-bold">Steps</h2>
          <ol className="mt-1 flex flex-col gap-1 text-lg">
            {proj.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" aria-label={`Step ${i + 1} done`} className="mt-1 h-5 w-5" />
                <span><strong>{i + 1}.</strong> {s.text}{adultDoes(s.tool, progress.tier) && <strong className="text-red-700"> (Adult does this)</strong>}</span>
              </li>
            ))}
          </ol>
        </section>
        {finish && (
          <section className="mt-4" aria-label="Finishing">
            <h2 className="text-2xl font-bold">Finishing: {finish.name}</h2>
            <ol className="mt-1 flex flex-col gap-1 text-lg">
              {finish.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input type="checkbox" aria-label={`Finishing step ${i + 1} done`} className="mt-1 h-5 w-5" />
                  <span><strong>{i + 1}.</strong> {s.text}{adultDoes(s.tool, progress.tier) && <strong className="text-red-700"> (Adult does this)</strong>}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="mt-4">
          <h2 className="text-2xl font-bold">Cut sheet</h2>
          <CutSheet project={design} />
        </section>
        <section className="mt-6 grid grid-cols-2 gap-6 text-lg">
          <div className="flex flex-col gap-6">
            <p>Time spent: ______________________</p>
            <p>Cost: ___________________________</p>
            <p>Built by: ________________________</p>
          </div>
          <div className="flex h-40 items-center justify-center rounded-xl border-4 border-dashed border-stone-400 text-stone-500">Glue your photo here</div>
        </section>
      </article>
    </main>
  )
}
