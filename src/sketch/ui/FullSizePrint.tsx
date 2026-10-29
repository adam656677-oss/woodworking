// Printing a shape at true size (1:1) across letter pages, with overlap, labels, tape-up marks and a 1" check square.
import { sketchBounds } from '../freehand'
import { pointOf, tessellateEntity } from '../geometry'
import { OVERLAP, PRINTABLE, tilePages, type Tile } from '../tiling'
import type { Sketch } from '../types'

const ink = '#111827'

function PageSvg({ sk, t }: { sk: Sketch; t: Tile }) {
  const top = t.y + t.h
  return (
    <svg width={`${t.w}in`} height={`${t.h}in`} viewBox={`${t.x} ${-top} ${t.w} ${t.h}`} className="absolute left-0 top-0">
      <g transform="scale(1,-1)">
        {sk.entities.map(e => {
          if ('construction' in e && e.construction) return null
          if (e.kind === 'text') {
            const a = pointOf(sk, e.at)
            return <text key={e.id} transform={`translate(${a.x} ${a.y}) scale(1,-1)`} fontSize={e.height} fontFamily="Arial" fill="none" stroke={ink} strokeWidth={0.012}>{e.text}</text>
          }
          const pts = tessellateEntity(sk, e, 1 / 64)
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') + (e.kind === 'circle' ? ' Z' : '')
          return <path key={e.id} d={d} fill="none" stroke={ink} strokeWidth={0.014} />
        })}
        {/* Where the page before overlaps this one: dashed, with + marks to line up when taping. */}
        {t.col > 0 && <line x1={t.x + OVERLAP} y1={t.y} x2={t.x + OVERLAP} y2={top} stroke="#9ca3af" strokeWidth={0.01} strokeDasharray="0.1 0.08" />}
        {t.row > 0 && <line x1={t.x} y1={top - OVERLAP} x2={t.x + t.w} y2={top - OVERLAP} stroke="#9ca3af" strokeWidth={0.01} strokeDasharray="0.1 0.08" />}
        {[[t.x + OVERLAP / 2, top - OVERLAP / 2], [t.x + t.w - OVERLAP / 2, top - OVERLAP / 2], [t.x + OVERLAP / 2, t.y + OVERLAP / 2], [t.x + t.w - OVERLAP / 2, t.y + OVERLAP / 2]].map(([x, y], i) => (
          <g key={i} stroke="#6b7280" strokeWidth={0.01}>
            <line x1={x - 0.15} y1={y} x2={x + 0.15} y2={y} />
            <line x1={x} y1={y - 0.15} x2={x} y2={y + 0.15} />
          </g>
        ))}
      </g>
    </svg>
  )
}

/** A small map of how the pages fit together (on page A1). */
function PageMap({ tiles, cols, rows }: { tiles: Tile[]; cols: number; rows: number }) {
  return (
    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 0.32in)` }} aria-label="Page layout">
      {tiles.map(t => <div key={t.id} className="flex h-[0.42in] items-center justify-center border border-gray-500 text-[8pt]" style={{ gridRow: rows ? t.row + 1 : undefined }}>{t.id}</div>)}
    </div>
  )
}

/** The true-size pages of a drawing (letter, tiled), each with its label and a 1" check square. */
export function FullSizePages({ sketch, breakLast = false }: { sketch: Sketch; breakLast?: boolean }) {
  const b = sketchBounds(sketch)
  const tiles = Number.isFinite(b.minX) ? tilePages(b) : []
  const cols = Math.max(0, ...tiles.map(t => t.col + 1)), rows = Math.max(0, ...tiles.map(t => t.row + 1))
  return (
    <>
      {tiles.map((t, i) => (
        <section key={t.id} aria-label={`Page ${t.id}`} className="relative shrink-0 overflow-hidden bg-white shadow print:shadow-none"
          style={{ width: `${PRINTABLE.w}in`, height: `${PRINTABLE.h}in`, breakAfter: i < tiles.length - 1 || breakLast ? 'page' : 'auto' }}>
          <PageSvg sk={sketch} t={t} />
          <div className="absolute right-[0.6in] top-[0.6in] text-right text-[9pt] leading-tight text-gray-700">
            <div className="text-[16pt] font-bold text-gray-900">{t.id}</div>
            <div>{sketch.name}</div>
            <div>Page {i + 1} of {tiles.length} · full size</div>
          </div>
          <div className="absolute bottom-[0.6in] left-[0.6in] flex items-end gap-1 text-[8pt] text-gray-700">
            <div data-testid="check-square" className="border border-gray-900" style={{ width: '1in', height: '1in' }} />
            <span>1&quot; check square</span>
          </div>
          {i === 0 && (
            <div className="absolute bottom-[0.6in] right-[0.6in] max-w-[3.2in] rounded border border-gray-400 bg-white/90 p-2 text-[8pt] leading-snug text-gray-800">
              <p className="mb-1 font-bold">How to put it together</p>
              <p>Printed at Actual size the square is exactly 1&quot;. Lay the pages out like the map, overlap each one up to its dashed line, line up the + marks, and tape.</p>
              <div className="mt-1"><PageMap tiles={tiles} cols={cols} rows={rows} /></div>
            </div>
          )}
        </section>
      ))}
    </>
  )
}


export function FullSizePrint({ sketch, onBack }: { sketch: Sketch; onBack(): void }) {
  const b = sketchBounds(sketch)
  const tiles = Number.isFinite(b.minX) ? tilePages(b) : []
  const cols = Math.max(0, ...tiles.map(t => t.col + 1)), rows = Math.max(0, ...tiles.map(t => t.row + 1))
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-stone-200 print:static print:bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-white px-4 py-2 print:hidden">
        <button onClick={onBack} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">← Back to the drawing</button>
        <h1 className="text-lg font-bold">Print full size</h1>
        <span className="text-sm text-stone-600">{tiles.length} page{tiles.length === 1 ? '' : 's'} ({cols} across × {rows} down)</span>
        <span className="flex-1" />
        <button onClick={() => void window.aa?.print({ landscape: false })} className="rounded bg-amber-700 px-4 py-1.5 font-semibold text-white">Print</button>
      </header>
      <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
        In the print box choose <strong>Actual size</strong> (or <strong>100%</strong>), not &ldquo;Fit&rdquo;. Then measure the check square on a page: it must be exactly 1 inch.
      </p>
      <div className="min-h-0 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
        <div className="print-area flex flex-col items-center gap-6 print:gap-0" data-testid="full-size-pages">
          <FullSizePages sketch={sketch} />
        </div>
      </div>
    </div>
  )
}
