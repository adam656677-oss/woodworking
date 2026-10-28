import { useMemo } from 'react'
import { cutList } from '../../model/cutlist'
import type { Project } from '../../model/types'
import { formatInches } from '../../model/units'

/** The project's cut list in kid-sized type (same numbers as the Master Shop cut list). */
export function CutSheet({ project }: { project: Project }) {
  const rows = useMemo(() => cutList(project).rows, [project])
  return (
    <table aria-label="Cut sheet" className="w-full border-collapse text-lg">
      <thead>
        <tr className="border-b-2 border-stone-400 text-left">
          {['How many', 'Part', 'Thick', 'Wide', 'Long', 'Wood'].map(h => <th key={h} className="px-2 py-1">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-stone-200">
            <td className="px-2 py-1 font-bold">{r.qty}</td>
            <td className="px-2 py-1">{r.part}</td>
            <td className="px-2 py-1">{formatInches(r.thickness)}</td>
            <td className="px-2 py-1">{formatInches(r.width)}</td>
            <td className="px-2 py-1">{formatInches(r.length)}</td>
            <td className="px-2 py-1">{r.woodName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
