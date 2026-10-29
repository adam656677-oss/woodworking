// The kids' drawing board: draw with a finger or the mouse, add a ready-made shape, set the size, make it a part.
import { useEffect, useRef, useState } from 'react'
import { formatInches } from '../../model/units'
import { draw, useDraw } from '../drawStore'
import { connectedGroup, mergeSketch, movePoints, presetShape, roundEighth, scaleSketchTo, sketchBounds, type PresetKind } from '../freehand'
import { tessellateEntity, pointOf } from '../geometry'
import { hitTest } from '../hit'
import type { Pt } from '../types'
import { fitView, parseIn, type View } from './Canvas'
import { Outputs } from './Outputs'
import { backTo, leaveDrawing } from './session'

const SHAPES: [PresetKind, string, string][] = [['circle', '⚪', 'Circle'], ['heart', '❤️', 'Heart'], ['star', '⭐', 'Star'], ['letters', '🔤', 'Letters']]

export function FreehandBoard() {
  const sketch = useDraw(s => s.sketch)
  const selection = useDraw(s => s.selection)
  const canUndo = useDraw(s => s.past.length > 0)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ scale: 30, ox: 60, oy: 400 })
  const [stroke, setStroke] = useState<Pt[] | null>(null)
  const moving = useRef<{ last: Pt; points: string[]; start: import('../types').Sketch; moved: boolean } | null>(null)
  const [letters, setLetters] = useState<string | null>(null)
  const b = sketchBounds(sketch)
  const width = sketch.entities.length && Number.isFinite(b.minX) ? b.maxX - b.minX : 0
  const height = sketch.entities.length && Number.isFinite(b.minY) ? b.maxY - b.minY : 0
  const [sizeText, setSizeText] = useState('')
  useEffect(() => { setSizeText(width ? formatInches(roundEighth(width)).replace('"', '') : '') }, [width])

  const fit = () => {
    const el = svgRef.current
    if (!el) return
    const w = el.clientWidth || 900, h = el.clientHeight || 600
    // An empty sheet shows about 24" × 12": room to draw something a kid can cut.
    setView(fitView(draw.getState().sketch, w, h))
  }
  useEffect(() => { fit() }, [])

  const toDrawing = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.ox) / view.scale, y: (view.oy - (e.clientY - r.top)) / view.scale }
  }
  const S = (p: Pt) => ({ x: view.ox + p.x * view.scale, y: view.oy - p.y * view.scale })

  const onDown = (e: React.PointerEvent) => {
    const q = toDrawing(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const h = hitTest(sketch, q, 12 / view.scale, { points: false })
    if (h) {
      const g = connectedGroup(sketch, h.id)
      draw.getState().select(g.entities)
      moving.current = { last: q, points: g.points, start: sketch, moved: false }
      return
    }
    draw.getState().select([])
    setStroke([q])
  }
  const onMove = (e: React.PointerEvent) => {
    const q = toDrawing(e)
    if (moving.current) {
      const m = moving.current
      const dx = q.x - m.last.x, dy = q.y - m.last.y
      m.last = q
      m.moved = true
      draw.setState(s => ({ sketch: movePoints(s.sketch, m.points, dx, dy) }))
      return
    }
    if (stroke) setStroke(s => (s ? [...s, q] : s))
  }
  const onUp = () => {
    if (moving.current) {
      // One undo step for the whole move.
      const m = moving.current
      moving.current = null
      if (!m.moved) return
      const now = draw.getState().sketch
      draw.setState({ sketch: m.start })
      draw.getState().replace(now)
      return
    }
    if (stroke && stroke.length > 1) draw.getState().addStroke(stroke)
    setStroke(null)
  }

  const addShape = (kind: PresetKind, text?: string) => {
    const s = draw.getState()
    const sk = s.sketch
    const bb = sketchBounds(sk)
    const at = sk.entities.length && Number.isFinite(bb.maxX) ? { x: bb.maxX + 1, y: bb.minY } : { x: 0, y: 0 }
    s.replace(mergeSketch(sk, presetShape(kind, kind === 'letters' ? Math.max(2, (text ?? '').length * 2) : 6, text), at))
    setTimeout(fit)
  }
  const applySize = () => {
    const w = parseIn(sizeText)
    if (w === null || w <= 0 || !sketch.entities.length) return
    draw.getState().replace(scaleSketchTo(sketch, w))
    setTimeout(fit)
  }

  const selected = new Set(selection)
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-violet-100 to-sky-50 text-sky-950">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={() => leaveDrawing()} className="rounded-xl bg-white px-5 py-2 text-lg font-semibold shadow hover:bg-sky-100">
          ← {backTo() === 'kids' ? 'Kids’ Workshop' : 'Back to the design'}
        </button>
        <h1 className="text-3xl font-bold">Draw It!</h1>
        <span className="flex-1" />
        <Outputs kids />
      </header>
      <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
        {SHAPES.map(([k, icon, label]) => (
          <button key={k} onClick={() => (k === 'letters' ? setLetters('') : addShape(k))} className="flex items-center gap-2 rounded-2xl border-4 border-violet-300 bg-white px-4 py-2 text-xl font-bold shadow hover:scale-105">
            <span aria-hidden>{icon}</span>{label}
          </button>
        ))}
        <button disabled={!canUndo} onClick={() => draw.getState().undo()} className="rounded-2xl border-4 border-stone-300 bg-white px-4 py-2 text-xl font-bold shadow disabled:opacity-40">↶ Undo</button>
        <button disabled={!selection.length} onClick={() => draw.getState().remove(selection)} className="rounded-2xl border-4 border-rose-300 bg-white px-4 py-2 text-xl font-bold shadow disabled:opacity-40">🗑 Remove</button>
        <form onSubmit={e => { e.preventDefault(); applySize() }} className="ml-auto flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-lg shadow">
          <label htmlFor="kid-size" className="font-bold">How wide?</label>
          <input id="kid-size" aria-label="Width in inches" value={sizeText} onChange={e => setSizeText(e.target.value)} onBlur={applySize} className="w-20 rounded-lg border-2 border-violet-300 px-2 py-1 text-center text-xl" />
          <span>inches</span>
          {height > 0 && <span className="text-base text-stone-500" data-testid="kid-size-tall">({formatInches(height)} tall)</span>}
        </form>
      </div>
      {letters !== null && (
        <form onSubmit={e => { e.preventDefault(); if (letters.trim()) addShape('letters', letters.trim().toUpperCase()); setLetters(null) }} className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-white p-3 text-xl shadow">
          <label htmlFor="kid-letters" className="font-bold">Your letters:</label>
          <input id="kid-letters" autoFocus value={letters} onChange={e => setLetters(e.target.value.slice(0, 12))} className="rounded-lg border-2 border-violet-300 px-2 py-1 text-xl uppercase" />
          <button type="submit" className="rounded-xl bg-violet-600 px-4 py-1 font-bold text-white">Add</button>
          <button type="button" onClick={() => setLetters(null)} className="rounded-xl px-3 py-1">Cancel</button>
        </form>
      )}
      <div className="relative mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-inner">
        <svg ref={svgRef} data-testid="drawing-sheet" className="h-full w-full touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <defs>
            <pattern id="kid-grid" width={view.scale} height={view.scale} patternUnits="userSpaceOnUse" x={view.ox} y={view.oy}>
              <path d={`M ${view.scale} 0 L 0 0 0 ${view.scale}`} fill="none" stroke="#e0e7ff" strokeWidth={1} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kid-grid)" />
          {sketch.entities.map(e => {
            const sel = selected.has(e.id)
            if (e.kind === 'text') {
              const p = S(pointOf(sketch, e.at))
              return <text key={e.id} data-entity={e.id} x={p.x} y={p.y} fontSize={e.height * view.scale} fontFamily="Arial" fontWeight="bold" fill="none" stroke={sel ? '#ea580c' : '#6d28d9'} strokeWidth={3}>{e.text}</text>
            }
            const d = tessellateEntity(sketch, e, 2 / view.scale).map((p, i) => { const s = S(p); return `${i ? 'L' : 'M'}${s.x} ${s.y}` }).join(' ') + (e.kind === 'circle' ? ' Z' : '')
            return <path key={e.id} data-entity={e.id} data-kind={e.kind} d={d} fill="none" stroke={sel ? '#ea580c' : '#6d28d9'} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          })}
          {stroke && stroke.length > 1 && (
            <path d={stroke.map((p, i) => { const s = S(p); return `${i ? 'L' : 'M'}${s.x} ${s.y}` }).join(' ')} fill="none" stroke="#a78bfa" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
        {sketch.entities.length === 0 && !stroke && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl font-bold text-violet-300">Draw here — or pick a shape above!</p>
        )}
      </div>
    </div>
  )
}
