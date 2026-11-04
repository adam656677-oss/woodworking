import { kidMessage } from '../../kids/kidWords'
import { studio, useStudio } from '../store'
import { openLibrary } from '../../library/ui/Library'

export function WarningsList() {
  const all = useStudio(s => s.warnings)
  const kidsMode = useStudio(s => s.kidsMode)
  const project = useStudio(s => s.project)
  // Keep educational advice separate from blocking problems in Kids' Workshop.
  const warnings = kidsMode ? all.filter(w => w.kind !== 'crossGrain' && w.kind !== 'sag') : all
  if (warnings.length === 0) return null
  return (
    <section aria-label="Warnings" className="max-h-64 overflow-y-auto border-t border-red-200 bg-red-50">
      <header className="border-b border-red-100 px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-red-700">{kidsMode ? 'Warnings' : 'Project checks'} ({warnings.length})</h2>
        {!kidsMode && <p className="mt-1 text-xs text-red-800">Select an issue to highlight its affected parts. These checks do not certify structural safety.</p>}
      </header>
      <ul className="divide-y divide-red-100">
        {warnings.map((w, i) => {
          const affected = project.boards.filter(b => w.boardIds.includes(b.id)).map(b => b.name)
          const message = kidsMode ? kidMessage(w, project) : w.message
          return (
            <li key={i} className="py-1">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs text-red-800 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700"
                onClick={() => studio.getState().select(w.boardIds)}
                aria-label={kidsMode ? message : `${message}. Select affected parts${affected.length ? `: ${affected.join(', ')}` : ''}`}
              >
                <span className="flex items-start gap-2"><span aria-hidden="true">⚠</span><span>{message}</span></span>
                {!kidsMode && affected.length > 0 && <span className="mt-1 block pl-5 text-stone-700">Parts: {affected.join(', ')}</span>}
              </button>
              {w.link && !kidsMode && (
                <button type="button" className="mx-3 mb-1 rounded px-2 py-1 text-xs text-amber-900 underline hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700" onClick={() => {
                  const l = w.link!
                  openLibrary('master', l.page, l.page === 'movement' ? { width: l.width, speciesId: l.speciesId } : { span: l.span, depth: l.depth, thickness: l.thickness, moe: l.moe, material: l.material })
                }}>{w.link.page === 'sag' ? 'Shelf sag calculator →' : 'Wood movement →'}</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
