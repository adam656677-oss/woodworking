// The drawing sheet: grid, rulers, what's drawn, dimensions and rules, and the pointer tools.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'
import { draw, isDimension, useDraw, type At } from '../drawStore'
import { arcAngles, outlineFromSketch, pointOf, tessellateEntity } from '../geometry'
import { sketchBounds } from '../freehand'
import { cornerPoints, hitTest } from '../hit'
import { extend, mirror, trim } from '../modify'
import type { Snap } from '../snap'
import type { Pt, Sketch, SketchConstraint } from '../types'

export type View = { scale: number; ox: number; oy: number }
export type Ask =
  | { kind: 'dimension'; refs: string[]; options: ('distance' | 'hdistance' | 'vdistance' | 'radius' | 'diameter' | 'angle')[]; at: Pt; editId?: string }
  | { kind: 'text'; at: At }
  | { kind: 'fillet' | 'chamfer'; point: string; at: Pt }

const SNAP_PX = 10
const HIT_PX = 8

const COLOR = { free: '#1d4ed8', fixed: '#1c1917', conflict: '#dc2626', construction: '#64748b', selected: '#ea580c', preview: '#0891b2' }

const GLYPH: Partial<Record<SketchConstraint['kind'], string>> = {
  horizontal: '━', vertical: '┃', perpendicular: '⊥', parallel: '∥', equal: '=', tangent: 'T', concentric: '◎',
  coincident: '•', fixed: '⚓', symmetric: '⇋'
}

/** Where a rule or dimension's label sits (drawing inches). */
function anchorOf(sk: Sketch, c: SketchConstraint): Pt | null {
  const at = (id: string): Pt | null => {
    const p = sk.points.find(q => q.id === id)
    if (p) return p
    const e = sk.entities.find(x => x.id === id)
    if (!e) return null
    if (e.kind === 'line') { const a = pointOf(sk, e.a), b = pointOf(sk, e.b); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    if (e.kind === 'arc') {
      const ctr = pointOf(sk, e.center)
      const { a0, sweep, r } = arcAngles(ctr, pointOf(sk, e.start), pointOf(sk, e.end))
      return { x: ctr.x + r * Math.cos(a0 + sweep / 2), y: ctr.y + r * Math.sin(a0 + sweep / 2) }
    }
    if (e.kind === 'circle') { const ctr = pointOf(sk, e.center); return { x: ctr.x + e.r * Math.SQRT1_2, y: ctr.y + e.r * Math.SQRT1_2 } }
    if (e.kind === 'spline') return pointOf(sk, e.points[Math.floor(e.points.length / 2)])
    return pointOf(sk, e.at)
  }
  const pts = c.refs.slice(0, 2).map(at).filter((p): p is Pt => !!p)
  if (!pts.length) return null
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
}

export function Canvas({ onAsk, view, setView }: { onAsk(a: Ask): void; view: View; setView(v: View | ((v: View) => View)): void }) {
  const sketch = useDraw(s => s.sketch)
  const tool = useDraw(s => s.tool)
  const selection = useDraw(s => s.selection)
  const solve = useDraw(s => s.solve)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [hover, setHover] = useState<Snap | null>(null)
  const [pending, setPending] = useState<At[]>([])
  const [typed, setTyped] = useState<string | null>(null)
  const drag = useRef<{ kind: 'pan'; x: number; y: number; ox: number; oy: number } | { kind: 'point'; id: string } | null>(null)
  const [extendFrom, setExtendFrom] = useState<string | null>(null)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // A new tool starts fresh.
  useEffect(() => { setPending([]); setTyped(null); setExtendFrom(null) }, [tool])

  const toScreen = useCallback((p: Pt) => ({ x: view.ox + p.x * view.scale, y: view.oy - p.y * view.scale }), [view])
  const toDrawing = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - view.ox) / view.scale, y: (view.oy - (e.clientY - r.top)) / view.scale }
  }
  const grid = view.scale >= 40 ? 1 / 8 : view.scale >= 12 ? 1 / 2 : 1
  const snapAt = (q: Pt): Snap => {
    const from = pending.length ? pending[pending.length - 1] : undefined
    return draw.getState().snap(q, SNAP_PX / view.scale, { grid, from })
  }
  const asAt = (s: Snap): At => ({ ...s.pt, ref: s.kind === 'endpoint' || s.kind === 'center' ? s.ref : undefined })

  const conflictRefs = useMemo(() => {
    const ids = new Set<string>()
    for (const id of solve.conflicting) {
      const c = sketch.constraints.find(x => x.id === id)
      c?.refs.forEach(r => ids.add(r))
    }
    return ids
  }, [solve.conflicting, sketch.constraints])
  const outline = useMemo(() => outlineFromSketch(sketch), [sketch])
  const corners = useMemo(() => new Set(cornerPoints(sketch)), [sketch])
  const baseColor = solve.status === 'ok' && solve.dof === 0 && sketch.constraints.length > 0 ? COLOR.fixed : COLOR.free

  // ---- typed sizes while drawing: "11-3/4", "@45", "11-3/4@45"; for a rectangle "10 x 4" ----
  const applyTyped = (text: string) => {
    const d = draw.getState()
    const last = pending[pending.length - 1]
    if (!last) return
    const q = hover?.pt ?? last
    if (tool === 'rect') {
      const m = /^\s*([^x×]+)\s*[x×]\s*(.+)$/.exec(text)
      if (!m) { d.setMessage('Type a size like 10 x 4'); return }
      const w = parseIn(m[1]), h = parseIn(m[2])
      if (w === null || h === null) { d.setMessage('Type a size like 10 x 4'); return }
      const sx = q.x >= last.x ? 1 : -1, sy = q.y >= last.y ? 1 : -1
      d.addRect(last, { x: last.x + sx * w, y: last.y + sy * h })
      setPending([])
      return
    }
    if (tool === 'circle') {
      const r = parseIn(text)
      if (r === null) { d.setMessage('Type the radius, like 1-1/2'); return }
      d.addCircle(last, r)
      setPending([])
      return
    }
    const [lenText, angText] = text.split('@')
    let ang = Math.atan2(q.y - last.y, q.x - last.x)
    if (angText !== undefined && angText.trim() !== '') {
      const a = Number(angText)
      if (!Number.isFinite(a)) { d.setMessage('Type an angle in degrees after @, like @45'); return }
      ang = (a * Math.PI) / 180
    }
    const len = lenText.trim() === '' ? Math.hypot(q.x - last.x, q.y - last.y) : parseIn(lenText)
    if (len === null || !(len > 0)) { d.setMessage('Type a length like 11-3/4'); return }
    const end = { x: last.x + len * Math.cos(ang), y: last.y + len * Math.sin(ang) }
    if (tool === 'line' || tool === 'construction') {
      d.addLine(last, end, tool === 'construction')
      const pts = draw.getState().sketch.points
      setPending([{ ...end, ref: pts[pts.length - 1]?.id }])
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Escape') {
        if (tool === 'spline' && pending.length >= 2) draw.getState().addSpline(pending)
        setPending([]); setTyped(null); setExtendFrom(null)
        return
      }
      if (e.key === 'Enter' && tool === 'spline' && pending.length >= 2) {
        draw.getState().addSpline(pending)
        setPending([])
        return
      }
      if (pending.length && ['line', 'construction', 'rect', 'circle'].includes(tool) && /^[0-9.@\-/ x]$/.test(e.key) && typed === null) {
        e.preventDefault()
        setTyped(e.key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, pending, typed])

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const k = Math.exp(-e.deltaY * 0.0015)
    setView(v => {
      const scale = Math.min(400, Math.max(2, v.scale * k))
      const f = scale / v.scale
      return { scale, ox: mx - (mx - v.ox) * f, oy: my - (my - v.oy) * f }
    })
  }

  const onDown = (e: React.PointerEvent) => {
    const q = toDrawing(e)
    if (e.button === 1 || e.button === 2) {
      drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
    if (tool === 'select') {
      const h = hitTest(sketch, q, HIT_PX / view.scale)
      const s = draw.getState()
      if (!h) {
        if (!e.shiftKey) s.select([])
        drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        return
      }
      s.select(e.shiftKey ? (s.selection.includes(h.id) ? s.selection.filter(x => x !== h.id) : [...s.selection, h.id]) : s.selection.includes(h.id) ? s.selection : [h.id])
      if (h.kind === 'point') {
        drag.current = { kind: 'point', id: h.id }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const q = toDrawing(e)
    const d = drag.current
    if (d?.kind === 'pan') {
      setView(v => ({ ...v, ox: d.ox + e.clientX - d.x, oy: d.oy + e.clientY - d.y }))
      return
    }
    if (d?.kind === 'point') {
      draw.getState().dragPoint(d.id, q)
      return
    }
    setHover(tool === 'select' ? null : snapAt(q))
  }
  const onUp = () => {
    if (drag.current?.kind === 'point') draw.getState().endDrag()
    drag.current = null
  }

  const onClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || tool === 'select') return
    const q = toDrawing(e)
    const s = draw.getState()
    const sn = snapAt(q)
    const at = asAt(sn)
    const tol = HIT_PX / view.scale
    switch (tool) {
      case 'line':
      case 'construction': {
        if (!pending.length) { setPending([at]); return }
        const last = pending[pending.length - 1]
        s.addLine(last, at, tool === 'construction')
        // Keep going from the end just drawn (it is now a real point).
        const sk = draw.getState().sketch
        const end = at.ref ?? sk.points[sk.points.length - 1]?.id
        // Clicking back on the start closes the shape and stops.
        if (at.ref && pending[0].ref === at.ref) { setPending([]); return }
        setPending([{ ...at, ref: end }])
        return
      }
      case 'rect':
        if (!pending.length) { setPending([at]); return }
        s.addRect(pending[0], at)
        setPending([])
        return
      case 'circle':
        if (!pending.length) { setPending([at]); return }
        s.addCircle(pending[0], Math.hypot(at.x - pending[0].x, at.y - pending[0].y))
        setPending([])
        return
      case 'arc3':
        if (pending.length < 2) { setPending([...pending, at]); return }
        s.addArc3(pending[0], pending[1], at)
        setPending([])
        return
      case 'arcCenter':
        if (pending.length < 2) { setPending([...pending, at]); return }
        s.addArcCenter(pending[0], pending[1], at)
        setPending([])
        return
      case 'spline':
        if (e.detail >= 2 && pending.length >= 2) { s.addSpline(pending); setPending([]); return }
        setPending([...pending, at])
        return
      case 'text':
        onAsk({ kind: 'text', at })
        return
      case 'dimension': {
        const h = hitTest(sketch, q, tol)
        if (!h) return
        if (h.kind === 'point') {
          if (!pending.length) { setPending([{ ...q, ref: h.id }]); return }
          const first = pending[0].ref!
          setPending([])
          if (first !== h.id) onAsk({ kind: 'dimension', refs: [first, h.id], options: ['distance', 'hdistance', 'vdistance'], at: q })
          return
        }
        const ent = sketch.entities.find(x => x.id === h.id)!
        if (ent.kind === 'line') {
          // A second line (picked with Shift) makes an angle.
          if (e.shiftKey && s.selection.length === 1 && sketch.entities.find(x => x.id === s.selection[0])?.kind === 'line') {
            onAsk({ kind: 'dimension', refs: [s.selection[0], h.id], options: ['angle'], at: q })
            s.select([])
            return
          }
          s.select([h.id])
          onAsk({ kind: 'dimension', refs: [h.id], options: ['distance', 'hdistance', 'vdistance'], at: q })
        } else if (ent.kind === 'circle') onAsk({ kind: 'dimension', refs: [h.id], options: ['diameter', 'radius'], at: q })
        else if (ent.kind === 'arc') onAsk({ kind: 'dimension', refs: [h.id], options: ['radius', 'diameter'], at: q })
        return
      }
      case 'trim': {
        const h = hitTest(sketch, q, tol, { points: false })
        if (h) s.modify(sk => trim(sk, h.id, q))
        return
      }
      case 'extend': {
        const h = hitTest(sketch, q, tol, { points: false })
        if (!h) return
        if (!extendFrom) {
          if (sketch.entities.find(x => x.id === h.id)?.kind !== 'line') { s.setMessage('Pick a straight line to extend'); return }
          setExtendFrom(h.id)
          s.select([h.id])
          return
        }
        s.modify(sk => extend(sk, extendFrom, h.id))
        setExtendFrom(null)
        s.select([])
        return
      }
      case 'fillet':
      case 'chamfer': {
        const h = hitTest(sketch, q, tol, { entities: false })
        if (!h || !corners.has(h.id)) { s.setMessage('Click a corner where two straight lines meet'); return }
        onAsk({ kind: tool, point: h.id, at: q })
        return
      }
      case 'mirror': {
        const h = hitTest(sketch, q, tol, { points: false })
        if (!h || sketch.entities.find(x => x.id === h.id)?.kind !== 'line') { s.setMessage('Click the straight line to mirror across'); return }
        const chosen = s.selection.filter(id => id !== h.id && sketch.entities.some(x => x.id === id))
        if (!chosen.length) { s.setMessage('First select what to mirror (Select tool), then pick Mirror'); return }
        s.modify(sk => mirror(sk, chosen, h.id))
        s.select([])
        return
      }
    }
  }

  // ---- drawing ----
  const pathOf = (pts: Pt[], close = false) => pts.map((p, i) => { const s = toScreen(p); return `${i ? 'L' : 'M'}${s.x.toFixed(2)} ${s.y.toFixed(2)}` }).join(' ') + (close ? ' Z' : '')

  const gridLines = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; w: number }[] = []
    const x0 = Math.floor(-view.ox / view.scale), x1 = Math.ceil((size.w - view.ox) / view.scale)
    const y0 = Math.floor((view.oy - size.h) / view.scale), y1 = Math.ceil(view.oy / view.scale)
    const fine = view.scale >= 40 ? 1 / 8 : null
    const step = view.scale >= 8 ? 1 : view.scale >= 2.5 ? 6 : 12
    const push = (vertical: boolean, v: number, w: number) => {
      const s = vertical ? view.ox + v * view.scale : view.oy - v * view.scale
      out.push(vertical ? { x1: s, y1: 0, x2: s, y2: size.h, w } : { x1: 0, y1: s, x2: size.w, y2: s, w })
    }
    if (fine) {
      for (let v = x0; v <= x1; v += fine) if (Math.abs(v - Math.round(v)) > 1e-9) push(true, v, 0)
      for (let v = y0; v <= y1; v += fine) if (Math.abs(v - Math.round(v)) > 1e-9) push(false, v, 0)
    }
    for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) push(true, v, v % 12 === 0 ? 2 : 1)
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) push(false, v, v % 12 === 0 ? 2 : 1)
    return out
  }, [view, size])

  const rulerTicks = useMemo(() => {
    const every = view.scale >= 30 ? 1 : view.scale >= 10 ? 2 : view.scale >= 4 ? 6 : 12
    const xs: number[] = [], ys: number[] = []
    for (let v = Math.ceil(-view.ox / view.scale / every) * every; v <= (size.w - view.ox) / view.scale; v += every) xs.push(v)
    for (let v = Math.ceil((view.oy - size.h) / view.scale / every) * every; v <= view.oy / view.scale; v += every) ys.push(v)
    return { xs, ys }
  }, [view, size])

  const preview: Pt[][] = []
  const h = hover?.pt
  if (h && pending.length) {
    const p0 = pending[0], last = pending[pending.length - 1]
    if (tool === 'line' || tool === 'construction') preview.push([last, h])
    if (tool === 'rect') preview.push([p0, { x: h.x, y: p0.y }, h, { x: p0.x, y: h.y }, p0])
    if (tool === 'circle') {
      const r = Math.hypot(h.x - p0.x, h.y - p0.y)
      preview.push(Array.from({ length: 65 }, (_, i) => ({ x: p0.x + r * Math.cos((i / 64) * 2 * Math.PI), y: p0.y + r * Math.sin((i / 64) * 2 * Math.PI) })))
    }
    if (tool === 'spline' || tool === 'arc3' || tool === 'arcCenter') preview.push([...pending, h])
  }

  const selected = new Set(selection)
  const gapAt = 'error' in outline && outline.at && sketch.entities.length > 1 ? outline.at : null

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <svg
        ref={svgRef}
        data-testid="drawing-sheet"
        className={`h-full w-full select-none ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onClick={onClick}
        onContextMenu={e => { e.preventDefault(); if (tool === 'spline' && pending.length >= 2) draw.getState().addSpline(pending); setPending([]) }}
      >
        <g aria-hidden>
          {gridLines.map((l, i) => (
            <line key={i} {...l} stroke={l.w === 2 ? '#d6d3d1' : l.w === 1 ? '#e7e5e4' : '#f5f5f4'} strokeWidth={l.w === 2 ? 1.5 : 1} />
          ))}
          <line x1={view.ox} y1={0} x2={view.ox} y2={size.h} stroke="#fca5a5" strokeWidth={1} />
          <line x1={0} y1={view.oy} x2={size.w} y2={view.oy} stroke="#fca5a5" strokeWidth={1} />
        </g>

        {sketch.entities.map(e => {
          const sel = selected.has(e.id)
          const conflict = conflictRefs.has(e.id)
          const construction = 'construction' in e && e.construction
          const stroke = sel ? COLOR.selected : conflict ? COLOR.conflict : construction ? COLOR.construction : baseColor
          if (e.kind === 'text') {
            const p = toScreen(pointOf(sketch, e.at))
            return <text key={e.id} data-entity={e.id} x={p.x} y={p.y} fontSize={e.height * view.scale} fill={stroke} fontFamily="Arial">{e.text}</text>
          }
          const pts = tessellateEntity(sketch, e, Math.max(1 / 64, 2 / view.scale))
          return (
            <path key={e.id} data-entity={e.id} data-kind={e.kind} d={pathOf(pts, e.kind === 'circle')} fill="none" stroke={stroke}
              strokeWidth={sel ? 3 : 2} strokeDasharray={construction ? '6 4' : undefined} />
          )
        })}

        {sketch.points.map(p => {
          const s = toScreen(p)
          const sel = selected.has(p.id)
          const isCorner = (tool === 'fillet' || tool === 'chamfer') && corners.has(p.id)
          return <circle key={p.id} data-point={p.id} cx={s.x} cy={s.y} r={sel || isCorner ? 5 : 3} fill={sel ? COLOR.selected : conflictRefs.has(p.id) ? COLOR.conflict : isCorner ? '#f59e0b' : baseColor} />
        })}

        {sketch.constraints.map((c, i) => {
          const a = anchorOf(sketch, c)
          if (!a) return null
          const s = toScreen(a)
          const conflict = solve.conflicting.includes(c.id)
          const sel = selected.has(c.id)
          if (isDimension(c.kind) && c.value !== undefined) {
            const label = c.kind === 'angle' ? `${Math.round(c.value * 10) / 10}°` : `${c.kind === 'radius' ? 'R' : c.kind === 'diameter' ? 'Ø' : ''}${formatInches(c.value)}`
            return (
              <g key={c.id} data-dimension={c.id} className="cursor-pointer"
                onPointerDown={ev => { ev.stopPropagation(); draw.getState().select([c.id]) }}
                onDoubleClick={ev => { ev.stopPropagation(); onAsk({ kind: 'dimension', refs: c.refs, options: [c.kind as 'distance'], at: a, editId: c.id }) }}>
                <rect x={s.x - 4 * label.length - 6} y={s.y - 22} width={8 * label.length + 12} height={18} rx={3}
                  fill={conflict ? '#fee2e2' : sel ? '#ffedd5' : '#ffffff'} stroke={conflict ? COLOR.conflict : '#a8a29e'} />
                <text x={s.x} y={s.y - 9} textAnchor="middle" fontSize={12} fill={conflict ? COLOR.conflict : '#1c1917'}>{label}</text>
              </g>
            )
          }
          const g = GLYPH[c.kind]
          if (!g) return null
          const dx = 10 + (i % 3) * 12
          return (
            <text key={c.id} data-rule={c.id} x={s.x + dx} y={s.y + 14} fontSize={12} className="cursor-pointer"
              fill={conflict ? COLOR.conflict : sel ? COLOR.selected : '#78716c'}
              onPointerDown={ev => { ev.stopPropagation(); draw.getState().select([c.id]) }}>{g}</text>
          )
        })}

        {preview.map((pts, i) => <path key={i} d={pathOf(pts)} fill="none" stroke={COLOR.preview} strokeDasharray="5 4" strokeWidth={1.5} />)}

        {hover && hover.kind !== 'none' && (() => {
          const s = toScreen(hover.pt)
          return (
            <g pointerEvents="none">
              <rect x={s.x - 5} y={s.y - 5} width={10} height={10} fill="none" stroke={hover.kind === 'grid' ? '#a8a29e' : '#16a34a'} strokeWidth={1.5} />
              {hover.kind !== 'grid' && <text x={s.x + 8} y={s.y - 8} fontSize={11} fill="#16a34a">{hover.kind}</text>}
            </g>
          )
        })()}

        {gapAt && (() => {
          const s = toScreen(gapAt)
          return <circle data-testid="gap-marker" cx={s.x} cy={s.y} r={7} fill="none" stroke={COLOR.conflict} strokeWidth={2.5}><title>{'error' in outline ? outline.error : ''}</title></circle>
        })()}

        {/* Rulers, in inches */}
        <g aria-hidden>
          <rect x={0} y={0} width={size.w} height={18} fill="#f5f5f4" />
          <rect x={0} y={0} width={24} height={size.h} fill="#f5f5f4" />
          {rulerTicks.xs.map(v => { const x = view.ox + v * view.scale; return <g key={`x${v}`}><line x1={x} y1={12} x2={x} y2={18} stroke="#78716c" /><text x={x + 2} y={11} fontSize={9} fill="#57534e">{v}&quot;</text></g> })}
          {rulerTicks.ys.map(v => { const y = view.oy - v * view.scale; return <g key={`y${v}`}><line x1={18} y1={y} x2={24} y2={y} stroke="#78716c" /><text x={1} y={y - 2} fontSize={9} fill="#57534e">{v}&quot;</text></g> })}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-1 left-8 rounded bg-white/80 px-2 text-xs text-stone-600" data-testid="pointer-at">
        {hover ? `${formatInches(hover.pt.x)}, ${formatInches(hover.pt.y)}` : ''}
      </div>
      {typed !== null && (
        <form
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 shadow"
          onSubmit={e => { e.preventDefault(); applyTyped(typed); setTyped(null) }}
        >
          <label className="text-sm text-stone-600" htmlFor="typed-size">{tool === 'rect' ? 'Size (W x H)' : tool === 'circle' ? 'Radius' : 'Length @angle'}</label>
          <input id="typed-size" autoFocus value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setTyped(null) }} className="w-36 rounded border border-stone-300 px-2 py-0.5" />
        </form>
      )}
    </div>
  )
}

/** A typed size in inches (11-3/4, 11.75, 1' 2"), or null. */
export function parseIn(t: string): number | null {
  const r = parseInches(t)
  return r.ok ? r.value : null
}

/** A view that shows the whole drawing (or a 24" × 12" sheet when it's empty). */
export function fitView(sk: Sketch, w: number, h: number): View {
  const has = sk.entities.length > 0
  const b = has ? sketchBounds(sk) : { minX: 0, minY: 0, maxX: 24, maxY: 12 }
  const bw = Math.max(1, b.maxX - b.minX), bh = Math.max(1, b.maxY - b.minY)
  const scale = Math.max(2, Math.min(200, Math.min((w - 120) / bw, (h - 120) / bh)))
  return { scale, ox: (w - bw * scale) / 2 - b.minX * scale, oy: (h + bh * scale) / 2 + b.minY * scale }
}
