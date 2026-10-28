import { kidMessage } from '../../kids/kidWords'
import { studio, useStudio } from '../store'

export function WarningsList() {
  const warnings = useStudio(s => s.warnings)
  const kidsMode = useStudio(s => s.kidsMode)
  const project = useStudio(s => s.project)
  if (warnings.length === 0) return null
  return (
    <section aria-label="Warnings" className="max-h-48 overflow-y-auto border-t border-red-200 bg-red-50">
      <h2 className="px-3 py-1 text-xs font-bold uppercase text-red-700">Warnings ({warnings.length})</h2>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>
            <button className="w-full px-3 py-1 text-left text-xs text-red-800 hover:bg-red-100" onClick={() => studio.getState().select(w.boardIds)}>
              ⚠ {kidsMode ? kidMessage(w, project) : w.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
