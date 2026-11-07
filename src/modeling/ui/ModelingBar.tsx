// The Custom modeling bar over the 3D view: where to sketch, the tools, the wood, a box for typed sizes, and the hint.
import { useEffect, useRef, useState } from 'react'
import { studio, useStudio } from '../../ui/store'
import { isBlock } from '../core'
import { modeling, useModeling, type ModelTool, type PlaneKind } from '../modelStore'

const TOOLS: { id: ModelTool; label: string; title: string }[] = [
  { id: 'rect', label: 'Rectangle', title: 'Draw a rectangle on the plane, then pull it into a solid' },
  { id: 'circle', label: 'Circle', title: 'Draw a circle on the plane, then pull it into a solid' },
  { id: 'outline', label: 'Outline', title: 'Click corners of any straight-sided shape, then pull it into a solid' },
  { id: 'pushpull', label: 'Push/Pull', title: 'Click a face of a part and move it in or out' }
]
const PLANES: { id: PlaneKind; label: string; view: 'top' | 'front' | 'side' | null }[] = [
  { id: 'floor', label: 'Floor', view: 'top' },
  { id: 'front', label: 'Front', view: 'front' },
  { id: 'side', label: 'Side', view: 'side' },
  { id: 'face', label: 'Part face', view: null }
]

export function ModelingBar() {
  const s = useModeling(x => x)
  const woods = useStudio(x => x.project.woods)
  const selection = useStudio(x => x.selection)
  const boards = useStudio(x => x.project.boards)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const block = selection.length === 1 && boards.some(b => b.id === selection[0] && isBlock(b))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { modeling.getState().cancelStep(); setText('') }
      // Typing a number anywhere goes into the size box.
      if (/^[0-9.\-@,/x]$/.test(e.key) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const btn = 'rounded border border-stone-300 bg-white px-2 py-1 text-sm hover:bg-stone-100 aria-pressed:border-amber-800 aria-pressed:bg-amber-100 disabled:opacity-40'
  const sizeLabel = s.profile || s.face ? 'Distance' : s.tool === 'rect' ? 'Size (W x H)' : s.tool === 'circle' ? 'Radius' : s.tool === 'outline' ? (s.pts.length ? 'Length@angle or X,Y' : 'First corner X,Y') : 'Size'
  const pickPlane = (p: (typeof PLANES)[number]) => {
    if (p.id === 'face') { modeling.getState().setTool('face'); return }
    modeling.getState().setPlane(p.id)
    if (p.view) studio.getState().set({ view: p.view })
  }
  return (
    <div role="toolbar" aria-label="Custom modeling" className="absolute left-2 right-2 top-2 z-20 flex flex-col gap-1 rounded-lg border border-amber-700/40 bg-white/95 p-2 shadow">
      <div className="flex flex-wrap items-center gap-2">
        <span role="group" aria-label="Sketch on" className="flex items-center gap-1">
          <span className="text-xs font-semibold text-stone-600">Sketch on</span>
          {PLANES.map(p => (
            <button key={p.id} type="button" className={btn} aria-pressed={p.id === 'face' ? s.tool === 'face' || s.planeKind === 'face' : s.planeKind === p.id && s.tool !== 'face'} onClick={() => pickPlane(p)}>{p.label}</button>
          ))}
        </span>
        <span role="group" aria-label="Tools" className="flex items-center gap-1 border-l border-stone-300 pl-2">
          {TOOLS.map(t => <button key={t.id} type="button" className={btn} title={t.title} aria-pressed={s.tool === t.id} onClick={() => modeling.getState().setTool(t.id)}>{t.label}</button>)}
          {s.tool === 'outline' && s.pts.length >= 3 && !s.profile && <button type="button" className={btn} onClick={() => modeling.getState().closeOutline()}>Close</button>}
          <button type="button" className={btn} disabled={!block} title="Turn the selected block into sides, top, bottom, back and shelves" onClick={() => modeling.getState().splitSelected()}>Split into panels…</button>
        </span>
        <label className="flex items-center gap-1 border-l border-stone-300 pl-2 text-xs font-semibold text-stone-600">Wood
          <select aria-label="Wood" className="rounded border border-stone-300 px-1 py-1 text-sm font-normal" value={s.woodId} onChange={e => modeling.getState().setWood(e.target.value)}>
            {woods.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <form className="flex items-center gap-1 border-l border-stone-300 pl-2" onSubmit={e => {
          e.preventDefault()
          if (modeling.getState().type(text)) setText('')
          else if (!text.trim() && (modeling.getState().profile || modeling.getState().face)) modeling.getState().finishPull()
        }}>
          <label className="flex items-center gap-1 text-xs font-semibold text-stone-600">{sizeLabel}
            <input ref={input} aria-label={sizeLabel} value={text} onChange={e => setText(e.target.value)} className="w-32 rounded border border-stone-300 px-1 py-1 text-sm font-normal" placeholder={s.profile ? 'e.g. 3/4' : ''} />
          </label>
          <button type="submit" className={btn}>Enter</button>
        </form>
        <span className="flex-1" />
        <button type="button" className={btn} onClick={() => { modeling.getState().cancelStep(); setText('') }} disabled={!s.pts.length && !s.profile && !s.face}>Cancel step</button>
        <button type="button" className="rounded bg-amber-700 px-3 py-1 text-sm font-semibold text-white" onClick={() => { modeling.getState().stop(); studio.getState().set({ view: '3d' }) }}>Done</button>
      </div>
      <p role="status" aria-label="Modeling hint" className={`text-xs ${s.error ? 'text-red-700' : 'text-stone-600'}`}>
        <span className="font-semibold">{s.planeKind === 'face' ? s.plane.label : `${s.plane.label} plane`}:</span> {s.message}
      </p>
    </div>
  )
}
