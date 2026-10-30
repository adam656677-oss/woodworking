import { kidMessage } from '../../kids/kidWords'
import { studio, useStudio } from '../store'
import { openLibrary } from '../../library/ui/Library'

export function WarningsList() {
  const all = useStudio(s => s.warnings)
  const kidsMode = useStudio(s => s.kidsMode)
  const project = useStudio(s => s.project)
  // Kids see the problems that stop a build; the library's advice is for the Master Shop.
  const warnings = kidsMode ? all.filter(w => w.kind !== 'crossGrain' && w.kind !== 'sag') : all
  if (warnings.length === 0) return null
  return (
    <section aria-label="Warnings" className="max-h-48 overflow-y-auto border-t border-red-200 bg-red-50">
      <h2 className="px-3 py-1 text-xs font-bold uppercase text-red-700">Warnings ({warnings.length})</h2>
      <ul>
        {warnings.map((w, i) => (
          <li key={i} className="flex items-start">
            <button className="flex-1 px-3 py-1 text-left text-xs text-red-800 hover:bg-red-100" onClick={() => studio.getState().select(w.boardIds)}>
              ⚠ {kidsMode ? kidMessage(w, project) : w.message}
            </button>
            {w.link && !kidsMode && (
              <button className="shrink-0 px-2 py-1 text-xs text-amber-800 underline" onClick={() => {
                const l = w.link!
                openLibrary('master', l.page, l.page === 'movement' ? { width: l.width, speciesId: l.speciesId } : { span: l.span, depth: l.depth, thickness: l.thickness, moe: l.moe, material: l.material })
              }}>{w.link.page === 'sag' ? 'Shelf sag calculator →' : 'Wood movement →'}</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
