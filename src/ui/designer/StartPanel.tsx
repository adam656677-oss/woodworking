import { TEMPLATES } from '../../templates'
import { studio } from '../store'

/** Shown in an empty project: start from a template, an empty board, or open a file. */
export function StartPanel() {
  const s = studio.getState()
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
      <p className="text-sm text-stone-500">…or use Add board in the toolbar to start from scratch, or Open a saved project.</p>
    </div>
  )
}
