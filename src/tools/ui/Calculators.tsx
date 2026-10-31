// The shop calculators, each with its working shown. Kids get board feet, tape math and even spacing.
import { useState, type ReactNode } from 'react'
import { boxSize, type SlideKind } from '../../cabinet/drawers'
import { formatInches, parseInches } from '../../model/units'
import { boardFeet, compoundMiter, crownFlat, epoxy, evenSpacing, fibonacciHeights, GOLDEN, graduated, nearest, shellacFlakes, shellacThin, tapeMath } from '../calc'

export type CalcId = 'bf' | 'fraction' | 'spacing' | 'miter' | 'drawer' | 'golden' | 'shellac' | 'epoxy'
export const CALCS: [CalcId, string][] = [['bf', 'Board feet'], ['fraction', 'Tape math & fractions'], ['spacing', 'Even spacing'], ['miter', 'Compound miter & crown'], ['drawer', 'Drawer sizing'], ['golden', 'Proportions'], ['shellac', 'Shellac'], ['epoxy', 'Epoxy pour']]
export const KID_CALCS: CalcId[] = ['bf', 'fraction', 'spacing']

const inch = (t: string) => { const r = parseInches(t, { allowZero: true }); return r.ok ? r.value : NaN }
const ok = (...xs: number[]) => xs.every(x => Number.isFinite(x) && x >= 0)
const fmt = (n: number) => formatInches(n, { sixtyFourths: true })
const deg = (n: number) => `${n.toFixed(1)}°`

function Field({ label, value, onChange, kids, wide }: { label: string; value: string; onChange(v: string): void; kids?: boolean; wide?: boolean }) {
  return <label className={`flex flex-col ${kids ? 'text-lg' : 'text-xs'}`}>{label}<input aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={`rounded border border-stone-300 px-2 py-1 ${kids ? 'text-2xl' : 'text-sm'} ${wide ? 'w-72' : 'w-28'}`} /></label>
}
function Answer({ children, kids, label }: { children: ReactNode; kids?: boolean; label: string }) {
  return <section role="status" aria-label={label} className={`rounded-lg bg-white p-4 shadow-sm ${kids ? 'text-2xl' : 'text-sm'}`}>{children}</section>
}

export function Calculator({ id, kids }: { id: CalcId; kids?: boolean }) {
  switch (id) {
    case 'bf': return <BoardFeet kids={kids} />
    case 'fraction': return <Fractions kids={kids} />
    case 'spacing': return <Spacing kids={kids} />
    case 'miter': return <Miter />
    case 'drawer': return <Drawer />
    case 'golden': return <Golden />
    case 'shellac': return <Shellac />
    case 'epoxy': return <Epoxy />
  }
}

function BoardFeet({ kids }: { kids?: boolean }) {
  const [rows, setRows] = useState([{ t: '1', w: '6', l: '96', q: '1' }])
  const [price, setPrice] = useState('')
  const vals = rows.map(r => ({ t: inch(r.t), w: inch(r.w), l: inch(r.l), q: Number(r.q) }))
  const total = vals.reduce((s, v) => s + (ok(v.t, v.w, v.l, v.q) ? boardFeet(v.t, v.w, v.l, v.q) : 0), 0)
  const p = Number(price)
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <Field kids={kids} label={`Thickness ${i + 1}`} value={r.t} onChange={v => setRows(rows.map((x, k) => (k === i ? { ...x, t: v } : x)))} />
          <Field kids={kids} label={`Width ${i + 1}`} value={r.w} onChange={v => setRows(rows.map((x, k) => (k === i ? { ...x, w: v } : x)))} />
          <Field kids={kids} label={`Length ${i + 1}`} value={r.l} onChange={v => setRows(rows.map((x, k) => (k === i ? { ...x, l: v } : x)))} />
          {!kids && <Field label={`How many ${i + 1}`} value={r.q} onChange={v => setRows(rows.map((x, k) => (k === i ? { ...x, q: v } : x)))} />}
        </div>
      ))}
      <div className="flex gap-2">
        <button className="rounded border px-2 py-0.5 text-sm" onClick={() => setRows([...rows, { t: '1', w: '6', l: '96', q: '1' }])}>Add a board</button>
        {!kids && <Field label="Price per board foot ($)" value={price} onChange={setPrice} />}
      </div>
      <Answer kids={kids} label="Board feet">
        <div className="font-bold">{Number(total.toFixed(2))} board feet{price && Number.isFinite(p) ? ` — $${(total * p).toFixed(2)}` : ''}</div>
        <div className={kids ? 'text-lg' : 'text-xs text-stone-600'}>Thickness × width × length (all in inches) ÷ 144. One board foot is a piece 1" thick, 12" wide and 12" long.</div>
      </Answer>
    </div>
  )
}

function Fractions({ kids }: { kids?: boolean }) {
  const [expr, setExpr] = useState('3-1/2 + 7/8')
  const [den, setDen] = useState<16 | 32 | 64>(16)
  const r = tapeMath(expr)
  return (
    <div className="flex flex-col gap-3">
      <Field kids={kids} wide label="Sum (use + − × ÷, feet with ')" value={expr} onChange={setExpr} />
      {!kids && <label className="text-xs">Round to <select aria-label="Round to" value={den} onChange={e => setDen(Number(e.target.value) as 16 | 32 | 64)} className="rounded border px-1"><option value={16}>1/16"</option><option value={32}>1/32"</option><option value={64}>1/64"</option></select></label>}
      <Answer kids={kids} label="Answer">
        {'error' in r ? <span className="text-red-700">{r.error}</span> : <>
          <div className="font-bold">{nearest(r.value, kids ? 16 : den)}</div>
          <div className={kids ? 'text-lg' : 'text-xs text-stone-600'}>{Number(r.value.toFixed(4))}" as a decimal{Math.abs(r.value) >= 12 ? ` · ${Math.floor(r.value / 12)}' ${nearest(r.value % 12, 16)}` : ''}</div>
        </>}
      </Answer>
    </div>
  )
}

function Spacing({ kids }: { kids?: boolean }) {
  const [space, setSpace] = useState('36')
  const [n, setN] = useState('8')
  const [w, setW] = useState('1-1/2')
  const [ends, setEnds] = useState<'gaps' | 'flush'>('gaps')
  const r = ok(inch(space), inch(w)) ? evenSpacing(inch(space), Number(n), inch(w), ends) : { error: 'Give the space and the width' }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field kids={kids} label="Space" value={space} onChange={setSpace} />
        <Field kids={kids} label="How many pieces" value={n} onChange={setN} />
        <Field kids={kids} label="Width of each" value={w} onChange={setW} />
        <label className={kids ? 'text-lg' : 'text-xs'}>Ends <select aria-label="Ends" value={ends} onChange={e => setEnds(e.target.value as 'gaps' | 'flush')} className="rounded border px-1"><option value="gaps">Gaps at both ends (balusters)</option><option value="flush">Pieces at both ends</option></select></label>
      </div>
      <Answer kids={kids} label="Spacing">
        {'error' in r ? <span className="text-red-700">{r.error}</span> : <>
          <div className="font-bold">Gap: {nearest(r.gap, 32)}</div>
          <div className={kids ? 'text-lg' : 'text-xs'}>Marks from the left (each piece's left edge): {r.positions.map(x => nearest(x, 32)).join(', ')}</div>
          <div className={kids ? 'text-lg' : 'text-xs text-stone-600'}>(space − pieces × width) ÷ {ends === 'gaps' ? 'pieces + 1' : 'pieces − 1'} gaps.</div>
        </>}
      </Answer>
    </div>
  )
}

function Miter() {
  const [sides, setSides] = useState('4')
  const [tilt, setTilt] = useState('30')
  const [spring, setSpring] = useState('38')
  const [corner, setCorner] = useState('90')
  const c = compoundMiter(Number(sides), Number(tilt)), cr = crownFlat(Number(spring), Number(corner))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2"><Field label="Sides" value={sides} onChange={setSides} /><Field label="Sides lean out (°)" value={tilt} onChange={setTilt} /></div>
      <Answer label="Compound miter"><div className="font-bold">Miter {deg(c.miter)}, bevel {deg(c.bevel)}</div><div className="text-xs text-stone-600">miter = atan(sin lean × tan(180°/sides)); bevel = asin(cos lean × sin(180°/sides)). Saw settings measured from square.</div></Answer>
      <div className="flex flex-wrap items-end gap-2"><Field label="Crown spring angle (°)" value={spring} onChange={setSpring} /><Field label="Wall corner (°)" value={corner} onChange={setCorner} /></div>
      <Answer label="Crown"><div className="font-bold">Crown laid flat: miter {deg(cr.miter)}, bevel {deg(cr.bevel)}</div><div className="text-xs text-stone-600">Common crowns: 52/38 (spring 38°) → 31.6° / 33.9°; 45/45 → 35.3° / 30.0°.</div></Answer>
    </div>
  )
}

function Drawer() {
  const [w, setW] = useState('16'), [h, setH] = useState('6'), [d, setD] = useState('22')
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2"><Field label="Opening width" value={w} onChange={setW} /><Field label="Opening height" value={h} onChange={setH} /><Field label="Depth" value={d} onChange={setD} /></div>
      <Answer label="Drawer boxes">
        <table className="text-sm"><thead><tr className="text-left"><th className="pr-4">Slides</th><th className="pr-4">Box (W × H × D)</th><th>Slide</th></tr></thead>
          <tbody>{(['side', 'under', 'runners'] as SlideKind[]).map(k => {
            const r = ok(inch(w), inch(h), inch(d)) ? boxSize({ width: inch(w), height: inch(h), depth: inch(d) }, k) : { error: '—' }
            return <tr key={k}><td className="pr-4">{k === 'side' ? 'Side-mount' : k === 'under' ? 'Undermount' : 'Wood runners'}</td>{'error' in r ? <td colSpan={2}>{r.error}</td> : <><td className="pr-4">{fmt(r.width)} × {fmt(r.height)} × {fmt(r.depth)}</td><td>{r.slide ? `${r.slide}"` : '—'}</td></>}</tr>
          })}</tbody></table>
        <div className="text-xs text-stone-600">The same rules the Drawer maker uses: 1/2" each side for side-mount slides, the undermount maker's allowance, a small clearance for runners.</div>
      </Answer>
    </div>
  )
}

function Golden() {
  const [total, setTotal] = useState('30'), [n, setN] = useState('4'), [ratio, setRatio] = useState('golden')
  const T = inch(total), N = Math.max(1, Math.min(10, Math.round(Number(n) || 1)))
  const hs = ok(T) ? (ratio === 'fib' ? fibonacciHeights(T, N) : graduated(T, N, ratio === 'golden' ? GOLDEN : Number(ratio))) : []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2"><Field label="Total height" value={total} onChange={setTotal} /><Field label="Drawers" value={n} onChange={setN} />
        <label className="text-xs">Steps <select aria-label="Steps" value={ratio} onChange={e => setRatio(e.target.value)} className="rounded border px-1"><option value="golden">Golden ratio (1.618)</option><option value="fib">Fibonacci</option><option value="1.2">1.2 (gentle)</option><option value="1">Equal</option></select></label></div>
      <Answer label="Proportions"><div className="font-bold">Top to bottom: {hs.map(x => nearest(x, 16)).join(', ')}</div>
        <div className="text-xs text-stone-600">Golden rectangle: long side = short × 1.618. Rule of thirds: put the strongest line about a third of the way in. For {nearest(T, 16)} that's at {nearest(T / 3, 16)} and {nearest((2 * T) / 3, 16)}.</div></Answer>
    </div>
  )
}

function Shellac() {
  const [cut, setCut] = useState('2'), [oz, setOz] = useState('16'), [from, setFrom] = useState('3'), [to, setTo] = useState('1'), [have, setHave] = useState('8')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2"><Field label="Pound cut" value={cut} onChange={setCut} /><Field label="Alcohol (fl oz)" value={oz} onChange={setOz} /></div>
      <Answer label="Mix shellac"><div className="font-bold">{Number(shellacFlakes(Number(cut), Number(oz)).toFixed(2))} oz of flakes</div><div className="text-xs text-stone-600">A 1-lb cut is 1 lb of flakes per gallon (128 fl oz) of alcohol: 2 oz per pint.</div></Answer>
      <div className="flex flex-wrap items-end gap-2"><Field label="Thin from (lb cut)" value={from} onChange={setFrom} /><Field label="To (lb cut)" value={to} onChange={setTo} /><Field label="You have (fl oz)" value={have} onChange={setHave} /></div>
      <Answer label="Thin shellac"><div className="font-bold">Add {Number(shellacThin(Number(from), Number(to), Number(have)).toFixed(1))} fl oz of alcohol</div></Answer>
    </div>
  )
}

function Epoxy() {
  const [l, setL] = useState('24'), [w, setW] = useState('12'), [dp, setDp] = useState('1/4'), [ra, setRa] = useState('1'), [rb, setRb] = useState('1')
  const r = ok(inch(l), inch(w), inch(dp)) ? epoxy(inch(l), inch(w), inch(dp), Number(ra) || 1, Number(rb) || 1) : null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2"><Field label="Length" value={l} onChange={setL} /><Field label="Width" value={w} onChange={setW} /><Field label="Depth" value={dp} onChange={setDp} /><Field label="Resin parts" value={ra} onChange={setRa} /><Field label="Hardener parts" value={rb} onChange={setRb} /></div>
      <Answer label="Epoxy">{r ? <><div className="font-bold">{r.flOz.toFixed(1)} fl oz in all ({(r.flOz / 128).toFixed(2)} gal)</div><div>Resin {r.resinOz.toFixed(1)} fl oz + hardener {r.hardenerOz.toFixed(1)} fl oz</div><div className="text-xs text-stone-600">L × W × depth + 10% for waste and soak-in; 1 fl oz = 1.805 cubic inches. Pour deep pours in layers if the maker says so.</div></> : 'Give the sizes'}</Answer>
    </div>
  )
}
