// The Layout tab: how to cut each material — sheet drawings with numbered cuts, lumber boards to buy and cut.
import { useEffect, useMemo, useState } from 'react'
import type { StockSettings, Wood } from '../../model/types'
import { formatInches, parseInches } from '../../model/units'
import { studio, useStudio } from '../../ui/store'
import { layoutAll, type LumberResult, type PackResult, type SheetLayout, type WoodLayout } from '../layout'
import { setCutOption, setSettings, settingsFor } from '../settings'
import { stock, useStock } from '../stockStore'

const PX = 6

function SheetDrawing({ s, index, total }: { s: SheetLayout; index: number; total: number }) {
  const W = s.stock.w, L = s.stock.l, et = s.stock.edgeTrim, nt = s.stock.endTrim
  const used = s.usedArea / ((W - 2 * et) * (L - 2 * nt))
  // Drawn with the sheet's length across the page.
  const R = (x: number, y: number, w: number, l: number) => ({ x: (nt + y) * PX, y: (et + x) * PX, width: l * PX, height: w * PX })
  return (
    <figure className="flex flex-col gap-1 break-inside-avoid" aria-label={`${s.stock.label}`}>
      <figcaption className="text-sm font-semibold">{s.stock.fromShop ? s.stock.label : `Sheet ${index + 1} of ${total}`} — {formatInches(W)} × {formatInches(L)} · {Math.round(used * 100)}% used</figcaption>
      <svg width={L * PX} height={W * PX} viewBox={`0 0 ${L * PX} ${W * PX}`} className="max-w-full rounded border border-stone-400 bg-stone-50">
        <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#d6d3d1" strokeWidth="2" /></pattern></defs>
        {s.offcuts.map((o, i) => (
          <g key={`o${i}`}>
            <rect {...R(o.x, o.y, o.w, o.l)} fill="url(#hatch)" stroke="#a8a29e" strokeDasharray="3 3" />
            {o.w * PX > 14 && o.l * PX > 60 && <text x={R(o.x, o.y, o.w, o.l).x + 4} y={R(o.x, o.y, o.w, o.l).y + 12} fontSize={10} fill="#78716c">offcut {formatInches(o.w)} × {formatInches(o.l)}</text>}
          </g>
        ))}
        {s.strips.flatMap(st => st.parts.map((q, i) => {
          const r = R(q.x, q.y, q.w, q.l)
          return (
            <g key={`${q.piece.boardId}-${i}`}>
              <rect {...r} fill="#fde68a" stroke="#92400e" />
              <text x={r.x + 4} y={r.y + 13} fontSize={11} fontWeight={700} fill="#78350f">P{q.piece.no}</text>
              {r.height > 26 && r.width > 70 && <text x={r.x + 4} y={r.y + 26} fontSize={10} fill="#78350f">{q.piece.name} {formatInches(q.l)} × {formatInches(q.w)}</text>}
            </g>
          )
        }))}
      </svg>
      <ol className="ml-5 list-decimal text-xs">{s.cuts.map((c, i) => <li key={i}>{c}</li>)}</ol>
    </figure>
  )
}

function LumberDrawing({ r, wood }: { r: LumberResult; wood: Wood }) {
  return (
    <div className="flex flex-col gap-2">
      {r.boards.map((b, i) => (
        <figure key={i} className="flex flex-col gap-1 break-inside-avoid" aria-label={`Board ${i + 1}`}>
          <figcaption className="text-sm font-semibold">Board {i + 1}: {wood.name} × {b.length / 12}&apos;</figcaption>
          <svg width={b.length * PX} height={wood.width * PX} className="max-w-full rounded border border-stone-400 bg-stone-50">
            {b.strips.flatMap((st, k) => st.parts.map((q, j) => (
              <g key={`${k}-${j}`}>
                <rect x={q.y * PX} y={k * st.width * PX} width={q.l * PX} height={st.width * PX} fill="#fde68a" stroke="#92400e" />
                <text x={q.y * PX + 4} y={k * st.width * PX + 12} fontSize={10} fontWeight={700} fill="#78350f">P{q.piece.no}</text>
              </g>
            )))}
          </svg>
          <ol className="ml-5 list-decimal text-xs">{b.cuts.map((c, k) => <li key={k}>{c}</li>)}</ol>
        </figure>
      ))}
    </div>
  )
}

function Num({ label, value, onSet }: { label: string; value: number; onSet(v: number): void }) {
  const [t, setT] = useState(formatInches(value))
  useEffect(() => setT(formatInches(value)), [value])
  return (
    <label className="flex flex-col text-xs text-stone-600">{label}
      <input aria-label={label} value={t} onChange={e => setT(e.target.value)} onBlur={() => { const r = parseInches(t, { allowZero: true }); if (r.ok) { if (Math.abs(r.value - value) > 1e-9) onSet(r.value) } else setT(formatInches(value)) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="w-20 rounded border border-stone-300 px-1 print:border-0" />
    </label>
  )
}

function WoodSection({ l }: { l: WoodLayout }) {
  const project = useStudio(s => s.project)
  const s = settingsFor(project, l.wood)
  const set = (patch: Partial<StockSettings>) => studio.getState().apply(p => setSettings(p, l.wood.id, patch))
  const groups = project.groups ?? []
  const items = useStock(x => x.items)
  const count = l.kind === 'lumber' ? l.result.boards.length : l.result.sheets.length
  const tooBig = l.kind === 'lumber' ? l.result.tooBig : l.result.tooBig
  const usedShop = l.kind !== 'lumber' ? (l.result as PackResult).sheets.filter(x => x.stock.fromShop) : []
  return (
    <section aria-label={`Layout for ${l.wood.name}`} className="flex flex-col gap-2 border-b border-stone-200 pb-4">
      <h3 className="text-lg font-bold">{l.wood.name} — {count} {l.kind === 'sheet' ? (count === 1 ? 'sheet' : 'sheets') : l.kind === 'lumber' ? (count === 1 ? 'board' : 'boards') : `board${count === 1 ? '' : 's'} (planned at ${formatInches(project.cutSettings?.hardwoodBoard?.width ?? 6)} wide)`}</h3>
      <div className="flex flex-wrap gap-3 print:hidden">
        <Num label="Saw kerf" value={s.kerf} onSet={kerf => set({ kerf })} />
        <Num label="Edge trim" value={s.edgeTrim} onSet={edgeTrim => set({ edgeTrim })} />
        <Num label="End trim" value={s.endTrim} onSet={endTrim => set({ endTrim })} />
        <Num label="Extra length" value={s.allowance} onSet={allowance => set({ allowance })} />
      </div>
      {tooBig.length > 0 && <p role="alert" className="text-sm text-red-700">Too big for this stock: {tooBig.map(q => `P${q.no} ${q.name} (${formatInches(q.w)} × ${formatInches(q.l)})`).join(', ')}</p>}
      {l.kind === 'hardwood' && l.glued.length > 0 && <p className="text-sm text-amber-800">Glued up from narrower boards: {l.glued.map(q => `P${q.no} ${q.name}`).join(', ')}</p>}
      {l.kind !== 'lumber' && l.result.apart.length > 0 && <p className="text-sm text-amber-800">Couldn&apos;t keep these on one sheet: {l.result.apart.map(id => groups.find(g => g.id === id)?.name ?? id).join(', ')}</p>}
      {l.kind === 'lumber' ? <LumberDrawing r={l.result} wood={l.wood} /> : (
        <div className="flex flex-col gap-4">
          {l.result.sheets.map((sh, i) => <SheetDrawing key={sh.stock.id} s={sh} index={i - usedShop.length} total={l.result.sheets.length - usedShop.length} />)}
        </div>
      )}
      {usedShop.length > 0 && (
        <button className="self-start rounded bg-stone-700 px-3 py-1 text-xs font-semibold text-white print:hidden" onClick={() => {
          // Each used stock piece goes; its biggest offcut stays as a new offcut.
          stock.getState().markUsed(usedShop.map(sh => {
            const big = [...sh.offcuts].sort((a, b) => b.w * b.l - a.w * a.l)[0]
            return { stockId: sh.stock.id, ...(big && items.some(i => i.id === sh.stock.fromShop) ? { left: { width: big.w, length: big.l } } : {}) }
          }))
        }}>Mark my stock as used (keep the biggest offcuts)</button>
      )}
    </section>
  )
}

export function StockPanel() {
  const project = useStudio(s => s.project)
  const items = useStock(s => s.items)
  // Load the stock list before showing it, so an add can't overwrite a list that hasn't been read yet.
  const loaded = useStock(s => s.loaded)
  useEffect(() => { if (!loaded) void stock.getState().load() }, [loaded])
  const [draft, setDraft] = useState({ woodId: project.woods[0]?.id ?? '', kind: 'offcut' as 'sheet' | 'offcut' | 'board', width: '24', length: '48', defects: '' })
  const add = () => {
    const w = parseInches(draft.width), l = parseInches(draft.length)
    if (!w.ok || !l.ok) return
    const defects = draft.defects.split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(/\s*-\s*|\s+to\s+/).map(Number)).filter(d => d.length === 2 && d[1] > d[0]).map(([from, to]) => ({ from, to }))
    stock.getState().add({ woodId: draft.woodId, kind: draft.kind, width: w.value, length: l.value, ...(defects.length ? { defects } : {}) })
  }
  return (
    <details className="rounded border border-stone-300 p-2 print:hidden">
      <summary className="cursor-pointer text-sm font-semibold">My shop stock ({items.length})</summary>
      <ul aria-label="Shop stock" className="mt-2 flex flex-col gap-1 text-xs">
        {items.map(i => (
          <li key={i.id} className="flex items-center gap-2">
            <span className="flex-1">{project.woods.find(w => w.id === i.woodId)?.name ?? i.woodId} — {i.kind} {formatInches(i.width)} × {formatInches(i.length)}{i.defects?.length ? `, defects at ${i.defects.map(d => `${d.from}–${d.to}"`).join(', ')}` : ''}</span>
            <button aria-label={`Remove stock ${i.id}`} onClick={() => stock.getState().remove(i.id)} className="px-1 text-stone-400 hover:text-red-700">✕</button>
          </li>
        ))}
      </ul>
      {!loaded ? <p className="mt-2 text-xs text-stone-500">Loading…</p> : <div className="mt-2 flex flex-wrap items-end gap-1 text-xs">
        <select aria-label="Stock wood" value={draft.woodId} onChange={e => setDraft({ ...draft, woodId: e.target.value })} className="rounded border border-stone-300 px-1 py-0.5">{project.woods.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select aria-label="Stock kind" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as typeof draft.kind })} className="rounded border border-stone-300 px-1 py-0.5"><option value="sheet">Sheet</option><option value="offcut">Offcut</option><option value="board">Board</option></select>
        <input aria-label="Stock width" value={draft.width} onChange={e => setDraft({ ...draft, width: e.target.value })} className="w-14 rounded border border-stone-300 px-1 py-0.5" />
        <span>×</span>
        <input aria-label="Stock length" value={draft.length} onChange={e => setDraft({ ...draft, length: e.target.value })} className="w-14 rounded border border-stone-300 px-1 py-0.5" />
        {draft.kind === 'board' && <input aria-label="Defects" placeholder="knots at 40-44, 60-62" value={draft.defects} onChange={e => setDraft({ ...draft, defects: e.target.value })} className="w-40 rounded border border-stone-300 px-1 py-0.5" />}
        <button onClick={add} className="rounded bg-amber-700 px-2 py-0.5 font-semibold text-white">Add to my stock</button>
      </div>}
    </details>
  )
}

export function LayoutTab() {
  const project = useStudio(s => s.project)
  const items = useStock(s => s.items)
  const loaded = useStock(s => s.loaded)
  useEffect(() => { if (!loaded) void stock.getState().load() }, [loaded])
  const layouts = useMemo(() => layoutAll(project, items), [project, items])
  const useStockFirst = project.cutSettings?.useStock ?? false
  if (!layouts.length) return <p className="text-stone-500">No parts yet.</p>
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm print:hidden">
        <label className="flex items-center gap-1"><input type="checkbox" checked={useStockFirst} onChange={e => studio.getState().apply(p => setCutOption(p, { useStock: e.target.checked }))} />Use my shop stock first</label>
        <span className="text-xs text-stone-500">Parts are numbered as in the cut list (P1, P2…). Rip strips first, then crosscut each strip.</span>
      </div>
      <StockPanel />
      {layouts.map(l => <WoodSection key={l.wood.id} l={l} />)}
    </div>
  )
}
