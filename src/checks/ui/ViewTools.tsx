// The view strip over the 3D view: explode, section, overall size and dimensions (display only).
import { formatInches } from '../../model/units'
import { designBox } from '../explode'
import { studio, useStudio } from '../../ui/store'
import { RenderControls } from '../../render/ui/RenderControls'

export function ViewTools() {
  const explode = useStudio(s => s.explode)
  const section = useStudio(s => s.section)
  const showDims = useStudio(s => s.showDims)
  const overall = useStudio(s => s.overallSize)
  const set = studio.getState().setView
  const openable = useStudio(s => (s.project.groups ?? []).some(g => g.motion))
  const open = useStudio(s => s.openAmount)
  return (
    <div role="toolbar" aria-label="View tools" className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-3 rounded border border-stone-300 bg-white/90 px-2 py-1 text-xs shadow">
      <label className="flex items-center gap-1">Explode
        <input type="range" aria-label="Explode" min={0} max={100} value={Math.round(explode * 100)} onChange={e => set({ explode: Number(e.target.value) / 100 })} className="w-24" />
        <span className="w-8 text-right">{Math.round(explode * 100)}%</span>
      </label>
      {openable && (
        <label className="flex items-center gap-1">Open doors &amp; drawers
          <input type="range" aria-label="Open doors and drawers" min={0} max={100} value={Math.round(open * 100)} onChange={e => set({ openAmount: Number(e.target.value) / 100 })} className="w-24" />
          <span className="w-8 text-right">{Math.round(open * 100)}%</span>
        </label>
      )}
      <label className="flex items-center gap-1">Section
        <select aria-label="Section" value={section?.axis ?? 'off'} onChange={e => set({ section: e.target.value === 'off' ? null : { axis: e.target.value as 'x' | 'y' | 'z', at: section?.at ?? 0.5, flip: section?.flip ?? false } })} className="rounded border border-stone-300">
          <option value="off">Off</option>
          <option value="x">Across (X)</option>
          <option value="y">Front to back (Y)</option>
          <option value="z">Up (Z)</option>
        </select>
      </label>
      {section && (
        <>
          <input type="range" aria-label="Section position" min={0} max={1000} value={Math.round(section.at * 1000)} onChange={e => set({ section: { ...section, at: Number(e.target.value) / 1000 } })} className="w-28" />
          <SectionAt />
          <label className="flex items-center gap-1"><input type="checkbox" checked={section.flip} onChange={e => set({ section: { ...section, flip: e.target.checked } })} />Flip</label>
        </>
      )}
      <label className="flex items-center gap-1"><input type="checkbox" checked={overall} onChange={e => set({ overallSize: e.target.checked })} />Overall size</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={showDims} onChange={e => set({ showDims: e.target.checked })} />Dimensions &amp; notes</label>
      <span className="h-4 w-px bg-stone-300" />
      <RenderControls />
    </div>
  )
}

/** Where the section plane is, in inches from the design's low side. */
function SectionAt() {
  const section = useStudio(s => s.section)
  const boards = useStudio(s => s.project.boards)
  const box = designBox(boards)
  if (!section || !box) return null
  return <span data-testid="section-at" className="w-14">{formatInches(section.at * (box.max[section.axis] - box.min[section.axis]))}</span>
}
