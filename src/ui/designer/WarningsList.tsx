import { studio, useStudio } from '../store'

export function WarningsList() {
  const warnings = useStudio(s => s.warnings)
  if (warnings.length === 0) return null
  return (
    <section aria-label="Warnings" className="max-h-48 overflow-y-auto border-t border-red-200 bg-red-50">
      <h2 className="px-3 py-1 text-xs font-bold uppercase text-red-700">Warnings ({warnings.length})</h2>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>
            <button className="w-full px-3 py-1 text-left text-xs text-red-800 hover:bg-red-100" onClick={() => studio.getState().select(w.boardIds)}>
              ⚠ {w.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
