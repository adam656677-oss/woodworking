import { Art } from '../art'
import { findProject } from '../content'
import { badges } from '../logic'
import { kids, useKids } from '../kidsStore'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 2026-10-28 → October 28, 2026 */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** A landscape certificate for one badge, with a line for the grown-up's signature. */
export function Certificate({ badgeId }: { badgeId: string }) {
  const progress = useKids(s => s.progress)
  const badge = badges(progress).find(b => b.id === badgeId)
  if (!badge) return null
  const proj = badge.kind === 'project' ? findProject(badgeId.replace(/^project-/, '')) : undefined
  return (
    <main className="h-full overflow-y-auto bg-stone-200 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[11in] gap-3 print:hidden">
        <button onClick={() => kids.getState().go({ name: 'badges' })} className="rounded-xl bg-sky-600 px-5 py-2 text-lg font-semibold text-white">← Back</button>
        <button onClick={() => void window.aa.print({ landscape: true })} className="rounded-xl bg-amber-600 px-5 py-2 text-lg font-semibold text-white">🖨 Print</button>
      </div>
      <article aria-label="Certificate" className="print-area mx-auto flex aspect-[11/8.5] max-w-[11in] flex-col items-center justify-center border-[16px] border-double border-amber-600 bg-amber-50 p-10 text-center text-stone-900 print:max-w-none">
        <p className="text-2xl uppercase tracking-[0.3em] text-amber-800">A&amp;A Woodworking · Kids&apos; Workshop</p>
        <h1 className="mt-4 font-serif text-6xl font-bold">Certificate of Achievement</h1>
        <p className="mt-6 text-2xl">This certifies that</p>
        <p className="mt-2 font-serif text-5xl font-bold text-sky-900">{progress.childName || '________________'}</p>
        <p className="mt-4 text-2xl">{badge.kind === 'level' ? 'passed the level and earned the badge' : 'built the project'}</p>
        <div className="mt-3 flex items-center gap-4">
          <Art name={proj?.picture ?? 'rules'} className="block h-20 w-20" />
          <p className="font-serif text-4xl font-bold">{badge.name}</p>
        </div>
        <div className="mt-10 flex w-full justify-around text-xl">
          <div><p>{longDate(badge.date)}</p><p className="border-t-2 border-stone-700 px-10 text-base">Date</p></div>
          <div><p>&nbsp;</p><p className="border-t-2 border-stone-700 px-16 text-base">Signed</p></div>
        </div>
      </article>
    </main>
  )
}
