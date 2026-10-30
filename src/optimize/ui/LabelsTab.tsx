// The Labels tab: part labels on Avery sheets, each with a QR code, ready to print.
import { useMemo, useState } from 'react'
import { useStudio } from '../../ui/store'
import { labelPositions, labelsFor, LABEL_SHEETS, qrModules, type Label, type LabelSheet } from '../labels'

function Qr({ text, size }: { text: string; size: number }) {
  const { size: n, dark } = useMemo(() => qrModules(text), [text])
  return (
    <svg width={`${size}in`} height={`${size}in`} viewBox={`-4 -4 ${n + 8} ${n + 8}`} aria-label="QR code" shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="#fff" />
      <path d={dark.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('')} fill="#000" />
    </svg>
  )
}

function LabelBox({ l, sheet }: { l: Label; sheet: LabelSheet }) {
  const big = sheet.h >= 2
  const qr = Math.min(sheet.h - 0.1, big ? 1.6 : 0.85)
  return (
    <div className="flex items-center gap-[0.06in] overflow-hidden" style={{ width: `${sheet.w}in`, height: `${sheet.h}in`, padding: '0.05in 0.08in', fontSize: big ? '10pt' : '6.5pt', lineHeight: 1.15 }}>
      <Qr text={l.qr} size={qr} />
      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ fontSize: big ? '8pt' : '5.5pt' }}>{l.project}</div>
        <div className="truncate font-bold" style={{ fontSize: big ? '13pt' : '8pt' }}>P{l.no} {l.name}</div>
        <div>{l.size}</div>
        <div className="truncate">{l.wood} · grain {l.grain === 'length' ? '↕ along' : '↔ across'}</div>
        {l.banding && <div className="truncate">{l.banding}</div>}
      </div>
    </div>
  )
}

export function LabelsTab() {
  const project = useStudio(s => s.project)
  const [kind, setKind] = useState<LabelSheet['id']>('5160')
  const [skip, setSkip] = useState(0)
  const sheet = LABEL_SHEETS[kind]
  const labels = useMemo(() => labelsFor(project), [project])
  const pos = labelPositions(labels.length, sheet, skip)
  const pages = Math.max(1, ...pos.map(p => p.page + 1))
  return (
    <section aria-label="Labels" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 text-sm print:hidden">
        <label className="flex flex-col text-xs">Label sheet
          <select aria-label="Label sheet" value={kind} onChange={e => setKind(e.target.value as LabelSheet['id'])} className="rounded border border-stone-300 px-1 py-0.5">
            {Object.values(LABEL_SHEETS).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs">Start at label (skip used ones)
          <input aria-label="Start at label" type="number" min={1} max={sheet.cols * sheet.rows} value={skip + 1} onChange={e => setSkip(Math.max(0, Math.min(sheet.cols * sheet.rows - 1, (Number(e.target.value) || 1) - 1)))} className="w-20 rounded border border-stone-300 px-1" />
        </label>
        <span className="text-xs text-stone-500">{labels.length} label{labels.length === 1 ? '' : 's'} on {pages} page{pages === 1 ? '' : 's'}. Print at 100% (no scaling).</span>
      </div>
      {Array.from({ length: pages }, (_, pg) => (
        <div key={pg} data-testid="label-page" className="label-page relative mx-auto overflow-hidden bg-white shadow print:mx-0 print:shadow-none" style={{ width: '8.5in', height: '11in', breakAfter: 'page' }}>
          {labels.map((l, i) => (pos[i].page === pg ? <div key={i} className="absolute" style={{ left: `${pos[i].x}in`, top: `${pos[i].y}in` }}><LabelBox l={l} sheet={sheet} /></div> : null))}
        </div>
      ))}
    </section>
  )
}
