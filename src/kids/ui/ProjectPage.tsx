import { useState } from 'react'
import { designFor, findProject, TOOLS } from '../content'
import { adultDoes, projectUnlocked } from '../logic'
import { kids, useKids } from '../kidsStore'
import type { Tier } from '../types'
import { CutSheet } from './CutSheet'
import { BigButton, KidsPageFrame, Stars } from './kit'
import { PinPrompt } from './PinPrompt'
import { ProjectViewer } from './ProjectViewer'
import { ReadAloud } from './ReadAloud'

const TIER_LABEL: Record<Tier, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', adult: 'Grown-ups only' }

export function ProjectPage({ id }: { id: string }) {
  const proj = findProject(id)
  const progress = useKids(s => s.progress)
  const [asking, setAsking] = useState(false)
  if (!proj) return <KidsPageFrame title="Not found" back={{ name: 'projects' }}>That project is missing.</KidsPageFrame>
  const design = designFor(id)
  const open = projectUnlocked(proj, progress)
  const built = progress.builtProjects[id]
  const k = kids.getState()

  return (
    <KidsPageFrame title={proj.name} back={{ name: 'projects' }} actions={<Stars n={proj.stars} />}>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6">
        <section className="flex flex-col gap-4">
          <ProjectViewer project={design} className="h-80 overflow-hidden rounded-3xl border-4 border-amber-200" />
          <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-xl shadow">
            <p className="flex-1">{proj.blurb} About {proj.minutes} minutes.</p>
            <ReadAloud text={`${proj.name}. ${proj.blurb}`} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BigButton disabled={!open} onClick={() => k.go({ name: 'sheet', id })}>Print project sheet</BigButton>
            <BigButton color="green" disabled={!open || !!built} onClick={() => setAsking(true)}>Mark as built</BigButton>
          </div>
          {!open && <p className="text-xl font-semibold text-amber-800">Pass the Level {proj.level} quiz to unlock</p>}
          {built && <p className="text-xl font-semibold text-green-700">Built on {built.date} — badge earned! ✓</p>}
          <section className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-2 text-2xl font-bold">Cut sheet</h2>
            <CutSheet project={design} />
          </section>
        </section>
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-2 text-2xl font-bold">Tools</h2>
            <ul className="grid grid-cols-2 gap-1 text-lg">
              {proj.tools.map(t => (
                <li key={t}>
                  {TOOLS[t].name} <span className="text-sm text-stone-500">({TIER_LABEL[TOOLS[t].tier]})</span>
                  {adultDoes(t, progress.tier) && <span className="ml-1 text-sm font-semibold text-red-700">Adult does this</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="mb-2 text-2xl font-bold">Steps</h2>
            <ol className="flex flex-col gap-2">
              {proj.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-xl">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 font-bold text-white">{i + 1}</span>
                  <span className="flex-1">{s.text}</span>
                  {adultDoes(s.tool, progress.tier) && <span className="shrink-0 rounded-lg bg-red-100 px-2 py-1 text-base font-semibold text-red-800">Adult does this</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      {asking && (
        <PinPrompt
          title={`Grown-up: did you build the ${proj.name.toLowerCase()} together?`}
          onSubmit={pin => k.confirmBuilt(id, pin)}
          onDone={() => setAsking(false)}
        />
      )}
    </KidsPageFrame>
  )
}
