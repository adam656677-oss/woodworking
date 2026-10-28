import { useEffect, useMemo, useState } from 'react'
import { TOOLS } from '../../kids/content'
import { useKids } from '../../kids/kidsStore'
import { adultDoes } from '../../kids/logic'
import { ProjectViewer } from '../../kids/ui/ProjectViewer'
import { cutList } from '../../model/cutlist'
import { formatInches } from '../../model/units'
import { plans, usePlans } from '../plansStore'
import type { PlanStep } from '../types'
import { PlanPicture } from './PlanPicture'
import { usePlanDesign } from './PlanEditor'

function StepPicture({ folder, step }: { folder: string; step: PlanStep }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (step.photo) void window.aa.plansFileUrl(folder, step.photo).then(setUrl)
  }, [folder, step.photo])
  return url ? <img src={url} alt="" className="mt-1 max-h-48 rounded border object-contain" /> : null
}

/** The printable step-by-step build guide (letter, portrait). The kids' version is bigger and marks grown-up steps. */
export function BuildGuide() {
  const current = usePlans(s => s.current)
  const kidsView = usePlans(s => s.kidsView)
  const tier = useKids(s => s.progress.tier)
  const loaded = usePlanDesign(current?.folder, current?.plan)
  const design = loaded && loaded !== 'missing' ? loaded : null
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const rows = useMemo(() => {
    if (design) return cutList(design).rows.map(r => ({ qty: r.qty, part: r.part, t: r.thickness, w: r.width, l: r.length, wood: r.woodName }))
    return (current?.plan.cutRows ?? []).map(r => ({ qty: r.qty, part: r.part, t: r.thickness, w: r.width, l: r.length, wood: r.wood }))
  }, [design, current?.plan.cutRows])
  if (!current) return null
  const { folder, plan } = current
  const adult = (tool?: string) => kidsView && adultDoes(tool, tier)
  const text = kidsView ? 'text-lg' : 'text-sm'

  return (
    <main className="h-full overflow-y-auto bg-stone-200 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[8.5in] gap-3 print:hidden">
        <button onClick={() => plans.getState().back()} className="rounded bg-stone-700 px-4 py-2 font-semibold text-white">← Back</button>
        <button onClick={() => void window.aa.print({ landscape: false })} className="rounded bg-amber-700 px-4 py-2 font-semibold text-white">🖨 Print build guide</button>
      </div>
      <article aria-label="Build guide" className={`print-area mx-auto max-w-[8.5in] bg-white p-8 text-stone-900 shadow print:max-w-none print:p-0 print:shadow-none ${text}`}>
        <header className="flex gap-6 border-b-4 border-amber-600 pb-4">
          <div className="flex-1">
            <h1 className={`${kidsView ? 'text-5xl' : 'text-4xl'} font-bold`}>{plan.name}</h1>
            <p className="mt-1">{'★'.repeat(plan.stars)}<span className="text-stone-300">{'★'.repeat(3 - plan.stars)}</span> · about {plan.minutes} minutes</p>
            {plan.description && <p className="mt-2">{plan.description}</p>}
            <p className="mt-2 text-xs text-stone-500">A&amp;A Woodworking · My Plans</p>
          </div>
          {design ? (
            <div className="w-56">
              <ProjectViewer project={design} onSnapshot={setSnapshot} className="h-44 overflow-hidden rounded border print:hidden" />
              {snapshot && <img src={snapshot} alt="" className="hidden h-44 w-full rounded border object-contain print:block" />}
            </div>
          ) : (
            <PlanPicture folder={folder} plan={plan} className="h-44 w-56 rounded border" />
          )}
        </header>

        <section className="mt-4 grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold">Tools</h2>
            <ul className="mt-1">
              {plan.tools.length === 0 && <li className="text-stone-500">None listed.</li>}
              {plan.tools.map(t => (
                <li key={t}>☐ {TOOLS[t]?.name ?? t}{adult(t) && <strong className="text-red-700"> — Adult does this</strong>}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Materials</h2>
            <ul className="mt-1">
              {plan.materials.length === 0 && <li className="text-stone-500">None listed.</li>}
              {plan.materials.map((m, i) => <li key={i}>☐ {m.text}{m.amount && ` — ${m.amount}`}</li>)}
            </ul>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="text-2xl font-bold">Cut list</h2>
          <table aria-label="Cut list" className="mt-1 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-400 text-left">{['Qty', 'Part', 'Thick', 'Wide', 'Long', 'Wood'].map(h => <th key={h} className="px-2 py-1">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-stone-200">
                  <td className="px-2 py-1 font-bold">{r.qty}</td><td className="px-2 py-1">{r.part}</td>
                  <td className="px-2 py-1">{formatInches(r.t)}</td><td className="px-2 py-1">{formatInches(r.w)}</td><td className="px-2 py-1">{formatInches(r.l)}</td>
                  <td className="px-2 py-1">{r.wood}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4">
          <h2 className="text-2xl font-bold">Steps</h2>
          <ol className="mt-2 flex flex-col gap-3">
            {plan.steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3 break-inside-avoid">
                <input type="checkbox" aria-label={`Step ${i + 1} done`} className="mt-1 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p><strong>{i + 1}.</strong> {s.text}{adult(s.tool) && <strong className="text-red-700"> (Adult does this)</strong>}</p>
                  {s.tip && <p className="mt-1 rounded border-l-4 border-red-500 bg-red-50 px-2 py-1"><span aria-hidden>⚠️ </span><span>{s.tip}</span></p>}
                  <StepPicture folder={folder} step={s} />
                  {s.showDesign && snapshot && <img src={snapshot} alt="" className="mt-1 max-h-48 rounded border object-contain" />}
                </div>
              </li>
            ))}
          </ol>
        </section>
        {plan.notes && (
          <section className="mt-4">
            <h2 className="text-2xl font-bold">Notes</h2>
            <p className="whitespace-pre-wrap">{plan.notes}</p>
          </section>
        )}
      </article>
    </main>
  )
}
