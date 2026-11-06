import { useMemo } from 'react'
import { formatInches } from '../../model/units'
import { useDraw } from '../../sketch/drawStore'
import { reviewProfile } from '../../sketch/profileReview'

export function ProfileReview() {
  const sketch = useDraw(s => s.sketch)
  const solve = useDraw(s => s.solve)
  const review = useMemo(() => reviewProfile(sketch), [sketch])
  const constraints = solve.status === 'conflict' ? 'Conflicting constraints: resolve them before fabrication.'
    : solve.status === 'failed' ? 'Constraint solving failed: review the dimensions.'
    : solve.dof < 0 ? 'Constraint status not verified. Confirm dimensions before fabrication.'
    : solve.dof === 0 ? 'Fully constrained sketch.'
    : `${solve.dof} degrees of freedom remain. Add dimensions or constraints to lock the shape.`
  // Lives in the Drawing Board's side panel, so it never takes height or header room from the sheet.
  return <details className="rounded border border-stone-300 bg-stone-50 px-2 py-1 text-xs">
    <summary className="cursor-pointer text-sm font-semibold">Review custom profile</summary>
    <div className="mt-2 space-y-2">
      <p className="text-xs text-stone-600">Custom starts a new project; New sketch adds to this project. Draw and dimension a closed profile, make a part, then generate drawings and cut lists in 3D.</p>
      {review.ok ? <>
        <p>Closed profile detected. Across: {formatInches(review.across)}; up: {formatInches(review.up)}; internal cutouts: {review.cutouts}.</p>
        <p>Use “Cut a board to this shape” to select material and create a part. The material determines its thickness; the part’s grain orientation may rotate these sketch dimensions.</p>
      </> : <p role="status">{review.problem}</p>}
      <p>{constraints}</p>
      <p className="text-xs text-stone-600">This review checks one part profile, not an entire furniture assembly. Confirm dimensions, material, joinery, clearances, and construction before using generated plans. Geometric readiness is not structural certification.</p>
    </div>
  </details>
}
