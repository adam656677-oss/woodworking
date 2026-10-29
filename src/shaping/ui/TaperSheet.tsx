// The taper sheet: what to mark and how to set the jig, face by face, and the cutting order.
import type { Board } from '../../model/types'
import { formatInches } from '../../model/units'
import { cuttingOrder, FACE_NAMES, jigAt12, removedPerFace, taperAngle, taperLength } from '../taper'

export function TaperSheet({ board, onClose }: { board: Board; onClose(): void }) {
  const t = board.taper!
  const removed = removedPerFace(board, t)
  const in64 = (v: number) => formatInches(v, { sixtyFourths: true })
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-stone-200 print:static print:bg-white" role="dialog" aria-label="Taper sheet">
      <header className="flex items-center gap-3 border-b border-stone-300 bg-white px-4 py-2 print:hidden">
        <button onClick={onClose} className="rounded px-3 py-1 font-semibold hover:bg-stone-200">← Back to the design</button>
        <h1 className="text-lg font-bold">Taper sheet — {board.name}</h1>
        <span className="flex-1" />
        <button onClick={() => void window.aa?.print({ landscape: false })} className="rounded bg-amber-700 px-4 py-1.5 font-semibold text-white">Print</button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
        <section aria-label="Taper summary" className="print-area mx-auto bg-white p-[0.4in] text-[10pt] text-gray-900 shadow print:shadow-none" style={{ width: '7.5in', minHeight: '10in' }}>
          <h2 className="text-[18pt] font-bold">{board.name} — taper sheet</h2>
          <p>Blank {formatInches(board.width)} × {formatInches(board.thickness)} × {formatInches(board.length)} · tapers to {formatInches(t.foot)} at the foot over {formatInches(taperLength(board, t))}</p>
          <table className="mt-3 w-full border-collapse text-left" aria-label="Faces">
            <thead>
              <tr className="border-b-2 border-gray-500"><th className="py-0.5">Face</th><th>Start mark (from the top)</th><th>Off at the foot</th><th>Angle</th><th>Jig opening at 12&quot;</th></tr>
            </thead>
            <tbody>
              {t.faces.map(f => (
                <tr key={f} className="border-b border-gray-200">
                  <td className="py-0.5 capitalize">{FACE_NAMES[f]}</td>
                  <td>{formatInches(t.start)}</td>
                  <td>{in64(removed[f])}</td>
                  <td>{taperAngle(board, t, f).toFixed(1)}°</td>
                  <td>{in64(jigAt12(board, t, f))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 font-bold">Mark it</h3>
          <ul className="list-disc pl-5">
            <li>Square a line round the leg {formatInches(t.start)} from the top: the taper starts there.</li>
            <li>On the foot end, mark the finished size ({formatInches(t.foot)}) so you can see the line you are cutting to.</li>
          </ul>
          <h3 className="mt-4 font-bold">Cutting order</h3>
          <ol className="list-decimal pl-5">{cuttingOrder(t).map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="mt-4 text-[9pt] text-gray-600">Jig opening: the gap between the jig&apos;s arms measured 12&quot; from the hinge. Cut a little proud and plane or sand to the line.</p>
        </section>
      </div>
    </div>
  )
}
