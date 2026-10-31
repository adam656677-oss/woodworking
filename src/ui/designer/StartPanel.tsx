import { TEMPLATES } from '../../templates'
import { studio, useStudio } from '../store'
import { openHelper } from '../../smart/ui/SmartDialogs'

/** Shown in an empty project: start from a template, an empty board, or open a file. */
export function StartPanel() {
  const s = studio.getState()
  const kidsMode = useStudio(x => x.kidsMode)
  if (kidsMode) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl font-bold text-violet-800">Design your own project!</h2>
        <p className="max-w-md text-lg text-stone-600">Press <strong>Add board</strong> to start. Pick a board, type how long it is, and drag it into place.</p>
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <h2 className="text-2xl font-semibold text-stone-700">Start a project</h2>
      <div className="flex gap-4">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => s.newFromTemplate(t.id)} className="h-28 w-36 rounded-xl border-2 border-amber-700 bg-amber-50 text-lg font-semibold hover:bg-amber-100">
            {t.name}
          </button>
        ))}
      </div>
      <button onClick={() => openHelper('describe')} className="rounded border border-amber-700 px-3 py-1 text-sm hover:bg-amber-50">✨ Describe what you want to make…</button>
      <p className="text-sm text-stone-500">…or use Add board in the toolbar to start from scratch, or Open a saved project.</p>
    </div>
  )
}
