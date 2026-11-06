// The drawing board screen: tools on the left, the sheet in the middle, rules and dimensions on the right.
import { useEffect, useRef, useState } from 'react'
import { formatInches } from '../../model/units'
import { currentValue, draw, useDraw } from '../drawStore'
import { chamfer, fillet, offset } from '../modify'
import { Canvas, fitView, parseIn, type Ask, type View } from './Canvas'
import { ConstraintBar } from './ConstraintBar'
import { FreehandBoard } from './FreehandBoard'
import { Outputs } from './Outputs'
import { HINTS, SHORTCUTS, ToolBar } from './ToolBar'
import { backTo, leaveDrawing } from './session'
import { TracingPicture } from './TracingPicture'
import { ProfileReview } from '../../ui/designer/ProfileReview'

const KIND_LABEL = { distance: 'Length', hdistance: 'Width (across)', vdistance: 'Height (up)', radius: 'Radius', diameter: 'Diameter', angle: 'Angle' } as const

type Dialog = Ask | { kind: 'offset' }

function AskDialog({ ask, onClose }: { ask: Dialog; onClose(): void }) {
  const sketch = draw.getState().sketch
  const editing = ask.kind === 'dimension' && ask.editId ? sketch.constraints.find(c => c.id === ask.editId) : undefined
  const [kind, setKind] = useState(ask.kind === 'dimension' ? (editing?.kind as typeof ask.options[number]) ?? ask.options[0] : null)
  const initial = () => {
    if (ask.kind === 'dimension' && kind) {
      const v = editing?.value ?? currentValue(sketch, kind, ask.refs)
      if (v === null || v === undefined) return ''
      return kind === 'angle' ? String(Math.round(v * 100) / 100) : formatInches(v).replace('"', '')
    }
    if (ask.kind === 'fillet' || ask.kind === 'chamfer' || ask.kind === 'offset') return '1/2'
    return ''
  }
  const [value, setValue] = useState(initial)
  const [text, setText] = useState('')
  const [inward, setInward] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setValue(initial()) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind])

  const submit = () => {
    const s = draw.getState()
    if (ask.kind === 'text') {
      const h = parseIn(value || '1')
      if (!text.trim()) return setError('Type some text')
      if (h === null || h <= 0) return setError('Type a height like 1-1/2')
      s.addText(ask.at, text, h)
      return onClose()
    }
    if (ask.kind === 'dimension' && kind) {
      const v = kind === 'angle' ? Number(value) : parseIn(value)
      if (v === null || !Number.isFinite(v) || v <= 0) return setError(kind === 'angle' ? 'Type an angle in degrees' : 'Type a size like 11-3/4')
      if (editing) {
        if (!s.setDimension(editing.id, v)) return onClose()
      } else s.addConstraint(kind, ask.refs, v)
      return onClose()
    }
    const v = parseIn(value)
    if (v === null || v <= 0) return setError('Type a size like 1/2')
    if (ask.kind === 'fillet') s.modify(sk => fillet(sk, ask.point, v))
    else if (ask.kind === 'chamfer') s.modify(sk => chamfer(sk, ask.point, v))
    else if (ask.kind === 'offset') { s.modify(sk => offset(sk, s.selection, inward ? -v : v)); s.select([]) }
    onClose()
  }
  const title = ask.kind === 'dimension' ? (editing ? 'Change the dimension' : 'Add a dimension')
    : ask.kind === 'text' ? 'Add text' : ask.kind === 'fillet' ? 'Round the corner' : ask.kind === 'chamfer' ? 'Chamfer the corner' : 'Offset'
  return (
    <div role="dialog" aria-label={title} className="absolute left-1/2 top-16 z-30 w-80 -translate-x-1/2 rounded-lg border border-stone-300 bg-white p-4 shadow-xl">
      <form onSubmit={e => { e.preventDefault(); submit() }} className="flex flex-col gap-2">
        <h2 className="font-bold">{title}</h2>
        {ask.kind === 'dimension' && !editing && ask.options.length > 1 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {ask.options.map(o => (
              <label key={o} className="flex items-center gap-1"><input type="radio" name="dimkind" checked={kind === o} onChange={() => setKind(o)} />{KIND_LABEL[o]}</label>
            ))}
          </div>
        )}
        {ask.kind === 'text' && (
          <label className="flex flex-col text-sm">Text<input autoFocus aria-label="Text" value={text} onChange={e => setText(e.target.value)} className="rounded border border-stone-300 px-2 py-1" /></label>
        )}
        <label className="flex flex-col text-sm">
          {ask.kind === 'dimension' && kind ? `${KIND_LABEL[kind]}${kind === 'angle' ? ' (degrees)' : ' (inches)'}`
            : ask.kind === 'text' ? 'Letter height (inches)' : ask.kind === 'fillet' ? 'Radius (inches)' : ask.kind === 'chamfer' ? 'Size (inches)' : 'Distance (inches)'}
          <input autoFocus={ask.kind !== 'text'} aria-label="Size" value={value} onChange={e => { setValue(e.target.value); setError(null) }} className="rounded border border-stone-300 px-2 py-1" />
        </label>
        {ask.kind === 'offset' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inward} onChange={e => setInward(e.target.checked)} />Inward</label>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1 hover:bg-stone-100">Cancel</button>
          <button type="submit" className="rounded bg-amber-700 px-3 py-1 font-semibold text-white">OK</button>
        </div>
      </form>
    </div>
  )
}

export function DrawingBoard() {
  const mode = useDraw(s => s.sketch.mode)
  return mode === 'freehand' ? <FreehandBoard /> : <PreciseBoard />
}

function PreciseBoard() {
  const name = useDraw(s => s.sketch.name)
  const tool = useDraw(s => s.tool)
  const message = useDraw(s => s.message)
  const kidsDraw = useDraw(s => s.context.kids)
  const [ask, setAsk] = useState<Dialog | null>(null)
  const [view, setView] = useState<View>({ scale: 24, ox: 80, oy: 500 })
  const box = useRef<HTMLDivElement>(null)
  const fit = () => {
    const el = box.current
    if (el) setView(fitView(draw.getState().sketch, el.clientWidth || 900, el.clientHeight || 600))
  }
  useEffect(() => { fit() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const s = draw.getState()
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); s.undo() }
      else if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length) { e.preventDefault(); s.remove(s.selection) }
      else if (e.key === 'Escape' && !ask) { if (s.tool !== 'select') s.setTool('select'); else s.select([]) }
      else if (!ctrl && !e.altKey && SHORTCUTS[e.key.toLowerCase()] && !ask) {
        // Letters only switch tools when nothing is being typed into the sheet.
        if (!/^[0-9]$/.test(e.key)) s.setTool(SHORTCUTS[e.key.toLowerCase()])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])

  const onOffset = () => {
    const s = draw.getState()
    if (!s.selection.some(id => s.sketch.entities.some(e => e.id === id))) {
      s.setMessage('Select the shapes to offset first (Select tool), then choose Offset')
      return
    }
    setAsk({ kind: 'offset' })
  }

  return (
    <div className="flex h-full flex-col bg-stone-100 text-stone-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-300 bg-white px-3 py-2">
        <button onClick={() => leaveDrawing()} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">
          ← {backTo() === 'kids' ? 'Kids’ Workshop' : 'Back to the design'}
        </button>
        <input aria-label="Drawing name" value={name} onChange={e => draw.getState().rename(e.target.value)}
          className="w-56 rounded border border-transparent px-2 py-1 text-lg font-bold hover:border-stone-300" />
        <button onClick={fit} className="rounded px-2 py-1 text-sm hover:bg-stone-200">Fit</button>
        <span className="flex-1" />
        <Outputs />
      </header>
      {message && (
        <div role="status" className="flex items-center justify-between bg-amber-100 px-4 py-1.5 text-sm text-amber-900">
          <span>{message}</span>
          <button aria-label="Dismiss" onClick={() => draw.getState().setMessage(null)} className="font-bold">✕</button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <ToolBar onOffset={onOffset} />
        <div ref={box} className="relative min-w-0 flex-1">
          <Canvas onAsk={setAsk} view={view} setView={setView} />
          {ask && <AskDialog ask={ask} onClose={() => setAsk(null)} />}
          {!kidsDraw && <TracingPicture />}
        </div>
        <ConstraintBar
          onDistance={refs => setAsk({ kind: 'dimension', refs, options: ['distance'], at: { x: 0, y: 0 } })}
          onAngle={refs => setAsk({ kind: 'dimension', refs, options: ['angle'], at: { x: 0, y: 0 } })}
          review={kidsDraw ? undefined : <ProfileReview />}
        />
      </div>
      <footer className="border-t border-stone-300 bg-white px-3 py-1 text-xs text-stone-600" data-testid="tool-hint">{HINTS[tool]}</footer>
    </div>
  )
}
