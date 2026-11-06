import { TEMPLATES } from '../../templates'
import { studio, useStudio } from '../store'
import { openHelper } from '../../smart/ui/SmartDialogs'
import { startCustomDesign } from './customDesign'

/** Start a custom sketch, use a live template, or open an existing project. */
export function StartPanel() {
  const s = studio.getState()
  const kidsMode = useStudio(x => x.kidsMode)
  const pending = useStudio(x => x.pendingReplace)
  const recovery = useStudio(x => x.recovery)
  if (kidsMode) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl font-bold text-violet-800">Design your own project!</h2>
        <p className="max-w-md text-lg text-stone-600">Press <strong>Add board</strong> to start. Pick a board, type how long it is, and drag it into place.</p>
      </div>
    )
  }
  return (
    // m-auto (not justify-center) keeps the top reachable when the panel is taller than a small window.
    <div className="flex h-full overflow-y-auto p-6">
      <div className="m-auto flex flex-col items-center gap-6">
        <h2 className="text-2xl font-semibold text-stone-700">Start a design</h2>
        <div className="flex max-w-4xl flex-wrap justify-center gap-4">
          <button type="button" disabled={pending || !!recovery} onClick={() => startCustomDesign()} className="h-28 w-36 rounded-xl border-2 border-amber-800 bg-amber-800 text-lg font-semibold text-white hover:bg-amber-900 disabled:opacity-50">Custom</button>
          {TEMPLATES.map(t => (
            <button key={t.id} disabled={pending || !!recovery} onClick={() => s.newFromTemplate(t.id)} className="h-28 w-36 rounded-xl border-2 border-amber-700 bg-amber-50 text-lg font-semibold hover:bg-amber-100 disabled:opacity-50">
              {t.name}
            </button>
          ))}
        </div>
        <p className="max-w-xl text-center text-sm text-stone-600">Choose Custom for a blank sketch. Draw a profile, set dimensions, and turn it into a woodworking part. Templates provide a dimension-driven starting point.</p>
        <button onClick={() => openHelper('describe')} className="rounded border border-amber-700 px-3 py-1 text-sm hover:bg-amber-50">✨ Describe what you want to make…</button>
        <p className="text-sm text-stone-500">You can also use Add board in the toolbar or Open a saved project.</p>
      </div>
    </div>
  )
}
