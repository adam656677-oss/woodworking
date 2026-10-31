// The Deep Library: species, wood movement and shelf sag calculators, glues, techniques and safety, lumber
// grades and sizes, drill-press speeds and the glossary.
import { openHelper } from '../../smart/ui/SmartDialogs'
import { useMemo, useState } from 'react'
import { formatInches, parseInches } from '../../model/units'
import { studio, type Screen } from '../../ui/store'
import { LOADS, movement, moveCoef, sag, SAG_LIMIT_PER_FT, type Cut } from '../calc'
import { GLOSSARY } from '../glossary'
import { MOVE_LIMIT } from '../advice'
import { ARTICLES, DRILL_SPEEDS, GLUES, HARDWOOD_GRADES, NOMINAL, SOFTWOOD_GRADES } from '../reference'
import { SHEET_MOE, SPECIES, speciesById, type Species } from '../species'

export type LibPage = 'species' | 'movement' | 'sag' | 'glues' | 'techniques' | 'lumber' | 'drill' | 'glossary'
export type LibParams = { speciesId?: string; width?: number; span?: number; depth?: number; thickness?: number; moe?: number; material?: string; term?: string }

let backTo: Screen = 'master'
let start: { page: LibPage; params: LibParams } = { page: 'species', params: {} }
/** Opens the library at a page (with values for a calculator); Back returns to where it was opened from. */
export function openLibrary(from: Screen, page: LibPage = 'species', params: LibParams = {}) {
  backTo = from
  start = { page, params }
  studio.getState().goto('library')
}

const TABS: [LibPage, string][] = [['species', 'Species'], ['movement', 'Wood movement'], ['sag', 'Shelf sag'], ['glues', 'Glues'], ['techniques', 'Techniques & safety'], ['lumber', 'Grades & sizes'], ['drill', 'Drill speeds'], ['glossary', 'Glossary']]

export function Library() {
  const [page, setPage] = useState<LibPage>(start.page)
  const [params] = useState<LibParams>(start.params)
  return (
    <main className="flex h-full flex-col bg-stone-50">
      <header className="flex flex-wrap items-center gap-4 border-b border-stone-300 bg-white px-4 py-2">
        <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => studio.getState().goto(backTo)}>← Back</button>
        <h1 className="text-xl font-bold text-stone-800">Library</h1>
        <button className="rounded border px-3 py-1 text-sm hover:bg-stone-100" onClick={() => openHelper('woodId')}>✨ What wood is this?</button>
        <nav role="tablist" className="flex flex-wrap gap-1">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={page === k} onClick={() => setPage(k)} className={`px-3 py-1 text-sm ${page === k ? 'border-b-2 border-amber-700 font-semibold' : 'text-stone-600'}`}>{l}</button>)}
        </nav>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {page === 'species' && <SpeciesPage first={params.speciesId} />}
        {page === 'movement' && <Movement init={params} />}
        {page === 'sag' && <Sag init={params} />}
        {page === 'glues' && <Glues />}
        {page === 'techniques' && <Articles />}
        {page === 'lumber' && <Lumber />}
        {page === 'drill' && <Drill />}
        {page === 'glossary' && <Glossary first={params.term} />}
      </div>
    </main>
  )
}

const T = ({ label, rows, head }: { label: string; head: string[]; rows: (string | number)[][] }) => (
  <table aria-label={label} className="w-full border-collapse rounded bg-white text-sm shadow-sm">
    <thead><tr className="border-b-2 border-stone-400 text-left">{head.map(h => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-stone-200 align-top">{r.map((c, k) => <td key={k} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
  </table>
)

type Hard = 'any' | 'soft' | 'medium' | 'hard'
function SpeciesPage({ first }: { first?: string }) {
  const [q, setQ] = useState('')
  const [hard, setHard] = useState<Hard>('any')
  const [maxPrice, setMaxPrice] = useState('')
  const [outdoor, setOutdoor] = useState(false)
  const [food, setFood] = useState(false)
  const [id, setId] = useState(first ?? 'red-oak')
  const list = SPECIES.filter(s => {
    const t = q.trim().toLowerCase()
    if (t && !s.name.toLowerCase().includes(t) && !s.aka.some(a => a.includes(t))) return false
    if (hard === 'soft' && s.janka >= 700) return false
    if (hard === 'medium' && (s.janka < 700 || s.janka > 1200)) return false
    if (hard === 'hard' && s.janka <= 1200) return false
    const mp = Number(maxPrice)
    if (maxPrice.trim() && Number.isFinite(mp) && s.price[0] > mp) return false
    if (outdoor && !s.outdoor) return false
    if (food && !s.food) return false
    return true
  })
  const s = speciesById(id) ?? SPECIES[0]
  return (
    <div className="flex gap-6">
      <aside className="w-72 shrink-0">
        <input aria-label="Search species" placeholder="Search (oak, cedar…)" value={q} onChange={e => setQ(e.target.value)} className="mb-2 w-full rounded border border-stone-300 px-2 py-1" />
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <select aria-label="Hardness" value={hard} onChange={e => setHard(e.target.value as Hard)} className="rounded border px-1">
            <option value="any">Any hardness</option><option value="soft">Soft (under 700 lbf)</option><option value="medium">Medium (700–1200)</option><option value="hard">Hard (over 1200)</option>
          </select>
          <label className="flex items-center gap-1">Max $/bd ft<input aria-label="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-12 rounded border px-1" inputMode="decimal" /></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={outdoor} onChange={e => setOutdoor(e.target.checked)} />Outdoors</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={food} onChange={e => setFood(e.target.checked)} />Food-safe</label>
        </div>
        <ul aria-label="Species list" className="max-h-[70vh] overflow-auto">
          {list.map(x => (
            <li key={x.id}><button onClick={() => setId(x.id)} className={`flex w-full items-center gap-2 rounded px-2 py-0.5 text-left text-sm ${x.id === s.id ? 'bg-amber-100 font-semibold' : 'hover:bg-stone-100'}`}>
              <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: x.colour }} />{x.name}<span className="ml-auto text-xs text-stone-500">{x.janka}</span>
            </button></li>
          ))}
          {list.length === 0 && <li className="text-sm text-stone-500">Nothing matches.</li>}
        </ul>
      </aside>
      <SpeciesInfo s={s} />
    </div>
  )
}

function SpeciesInfo({ s }: { s: Species }) {
  const m = movement(12, s, 6, 12, 'flat')
  return (
    <article aria-label={s.name} className="max-w-3xl flex-1 rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-block h-10 w-16 rounded border" style={{ background: s.colour }} aria-hidden />
        <div>
          <h2 className="text-2xl font-bold">{s.name}</h2>
          {s.aka.length > 0 && <p className="text-sm text-stone-600">Also called {s.aka.join(', ')}</p>}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
        <dt className="text-stone-500">Weight</dt><dd className="col-span-2">{s.density} lb per cubic foot (at 12% moisture)</dd>
        <dt className="text-stone-500">Hardness (Janka)</dt><dd className="col-span-2">{s.janka} lbf</dd>
        <dt className="text-stone-500">Shrinkage, green to dry</dt><dd className="col-span-2">{s.shrinkT}% tangential (along the rings — flat-sawn width), {s.shrinkR}% radial (across the rings — quartersawn width)</dd>
        <dt className="text-stone-500">Stiffness</dt><dd className="col-span-2">{s.moe} million psi</dd>
        <dt className="text-stone-500">Movement</dt><dd className="col-span-2">A 12" flat-sawn board moves about {formatInches(m.inches)} from 6% to 12% moisture</dd>
        <dt className="text-stone-500">Price (estimate)</dt><dd className="col-span-2">${s.price[0]}–${s.price[1]} per board foot</dd>
        <dt className="text-stone-500">Outdoors</dt><dd className="col-span-2">{s.outdoor ? 'Resists decay — good outdoors' : 'Not for outdoor use unless finished and kept dry'}</dd>
      </dl>
      <h3 className="mt-3 font-semibold">Working it</h3><p className="text-sm">{s.work}</p>
      <h3 className="mt-2 font-semibold">Finishing</h3><p className="text-sm">{s.finish}</p>
      <h3 className="mt-2 font-semibold">Used for</h3><p className="text-sm">{s.uses}</p>
      {s.caution && <p role="note" className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Health: {s.caution} If you react, stop and see a doctor.</p>}
      <p className="mt-4 text-xs text-stone-500">{s.source === 'handbook' ? 'Figures: USDA Forest Products Laboratory, Wood Handbook (FPL-GTR-282, 2021), chapters 4 (shrinkage) and 5 (density, hardness, stiffness).' : 'Figures: typical published values for this imported wood; they vary from board to board.'} Prices are rough US estimates — edit prices in your wood library.</p>
    </article>
  )
}

function Num({ label, value, onChange, unit }: { label: string; value: string; onChange(v: string): void; unit?: string }) {
  return <label className="flex flex-col text-xs">{label}<span className="flex items-center gap-1"><input aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="w-24 rounded border border-stone-300 px-2 py-1 text-sm" />{unit}</span></label>
}
const inch = (t: string) => { const r = parseInches(t); return r.ok ? r.value : NaN }

function Movement({ init }: { init: LibParams }) {
  const [id, setId] = useState(init.speciesId ?? 'red-oak')
  const [width, setWidth] = useState(init.width ? formatInches(init.width) : '12"')
  const [from, setFrom] = useState('6')
  const [to, setTo] = useState('12')
  const [cut, setCut] = useState<Cut>('flat')
  const s = speciesById(id) ?? SPECIES[0]
  const w = inch(width), a = from.trim() ? Number(from) : NaN, b = to.trim() ? Number(to) : NaN
  const ok = Number.isFinite(w) && w > 0 && a >= 0 && b >= 0
  const r = ok ? movement(w, s, a, b, cut) : null
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p>Wood swells and shrinks across its width as the air gets more or less humid. Indoors it usually swings between about 6% moisture (heated winter) and 12% (humid summer).</p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-xs">Species
          <select aria-label="Species" value={s.id} onChange={e => setId(e.target.value)} className="rounded border border-stone-300 px-1 py-1 text-sm">{SPECIES.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </label>
        <Num label="Width" value={width} onChange={setWidth} />
        <Num label="From moisture" value={from} onChange={setFrom} unit="%" />
        <Num label="To moisture" value={to} onChange={setTo} unit="%" />
        <label className="flex flex-col text-xs">Cut
          <select aria-label="Cut" value={cut} onChange={e => setCut(e.target.value as Cut)} className="rounded border border-stone-300 px-1 py-1 text-sm"><option value="flat">Flat-sawn</option><option value="quarter">Quartersawn</option></select>
        </label>
      </div>
      <section role="status" aria-label="Movement" className="rounded-lg bg-white p-4 shadow-sm">
        {r ? <>
          <div className="text-2xl font-bold">{r.inches >= 0 ? 'Grows' : 'Shrinks'} about {formatInches(Math.abs(r.inches), { sixtyFourths: true })}</div>
          <p className="text-sm text-stone-600">{formatInches(w)} × {moveCoef(s, cut).coef.toFixed(5)} per 1% × {Math.abs(Math.min(b, 28) - Math.min(a, 28))}% change{Math.max(a, b) > 28 ? ' (wood stops swelling above about 28%)' : ''}{r.estimated ? ' (coefficient estimated from the Handbook\'s shrinkage)' : ' (coefficient from the Wood Handbook)'}.</p>
          {Math.abs(r.inches) >= MOVE_LIMIT && <p className="mt-2 text-sm text-amber-900">That's enough to crack a rigid cross-grain joint: use tabletop buttons, figure-8s, slotted screw holes, or let panels float in grooves.</p>}
        </> : <p>Give a width and two moisture contents.</p>}
      </section>
    </div>
  )
}

function Sag({ init }: { init: LibParams }) {
  const materials = useMemo(() => {
    const all = [...SHEET_MOE.map(m => ({ key: `sheet:${m.label}`, label: m.label, moe: m.moe })), ...SPECIES.map(s => ({ key: s.id, label: s.name, moe: s.moe }))]
    // A wood from the design that isn't in the list keeps the stiffness the warning used.
    if (init.moe && !all.some(m => m.label === init.material)) all.unshift({ key: 'design', label: init.material ?? 'From your design', moe: init.moe })
    return all
  }, [init.moe, init.material])
  const startKey = init.moe ? materials.find(m => m.label === init.material)?.key ?? 'design' : undefined
  const [mat, setMat] = useState(startKey ?? 'eastern-white-pine')
  const [span, setSpan] = useState(formatInches(init.span ?? 36))
  const [depth, setDepth] = useState(formatInches(init.depth ?? 11.25))
  const [thick, setThick] = useState(formatInches(init.thickness ?? 0.75))
  const [load, setLoad] = useState(String(LOADS[0].lbPerFt))
  const m = materials.find(x => x.key === mat) ?? materials[0]
  const moe = m.moe
  const v = { span: inch(span), depth: inch(depth), thickness: inch(thick), lb: Number(load) }
  const ok = [v.span, v.depth, v.thickness, v.lb].every(x => Number.isFinite(x) && x > 0)
  const r = ok ? sag({ span: v.span, depth: v.depth, thickness: v.thickness, moe, lbPerFt: v.lb }) : null
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p>How much a shelf bends in the middle under an even load, with its ends resting on supports (a dado holds a little better, so this errs on the safe side). Most people notice sag of more than {SAG_LIMIT_PER_FT}" per foot of span.</p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-xs">Material
          <select aria-label="Material" value={mat} onChange={e => setMat(e.target.value)} className="rounded border border-stone-300 px-1 py-1 text-sm">{materials.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
        </label>
        <Num label="Span" value={span} onChange={setSpan} />
        <Num label="Depth" value={depth} onChange={setDepth} />
        <Num label="Thickness" value={thick} onChange={setThick} />
        <label className="flex flex-col text-xs">Load
          <span className="flex items-center gap-1">
            <select aria-label="Load preset" value={LOADS.find(l => String(l.lbPerFt) === load)?.id ?? ''} onChange={e => setLoad(String(LOADS.find(l => l.id === e.target.value)?.lbPerFt ?? load))} className="rounded border border-stone-300 px-1 py-1 text-sm">
              <option value="">Custom</option>{LOADS.map(l => <option key={l.id} value={l.id}>{l.label} ({l.lbPerFt} lb/ft)</option>)}
            </select>
            <input aria-label="Load per foot" value={load} onChange={e => setLoad(e.target.value)} className="w-14 rounded border border-stone-300 px-1 py-1 text-sm" />lb/ft
          </span>
        </label>
      </div>
      <section role="status" aria-label="Sag" className={`rounded-lg p-4 shadow-sm ${r ? (r.ok ? 'bg-green-50' : 'bg-red-50') : 'bg-white'}`}>
        {r ? <>
          <div className="text-2xl font-bold">{r.ok ? 'OK' : 'Too much sag'}: about {formatInches(r.inches, { sixtyFourths: true })}</div>
          <p className="text-sm">Limit for this span: {formatInches(r.limit, { sixtyFourths: true })}. Stiffness {moe} million psi.</p>
          {!r.ok && <p className="mt-1 text-sm">Fixes: thicker stock (sag drops with the cube of the thickness), a stiffer material, a hardwood strip glued on the front edge, or a shorter span with a centre support.</p>}
        </> : <p>Fill in the sizes and the load.</p>}
      </section>
    </div>
  )
}

const Glues = () => <T label="Glues" head={['Glue', 'Open time', 'Clamp', 'Full cure', 'Water', 'Gaps', 'Clean-up', 'Best for']} rows={GLUES.map(g => [g.name, g.open, g.clamp, g.cure, g.water, g.gaps, g.cleanup, g.best])} />

function Articles() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {(['Techniques', 'Joinery', 'Sharpening', 'Japanese tools', 'Safety'] as const).map(g => (
        <section key={g} aria-label={g}>
          <h2 className="mb-2 text-xl font-bold">{g}</h2>
          {ARTICLES.filter(a => a.group === g).map(a => (
            <article key={a.id} className="mb-2 rounded-lg bg-white p-3 shadow-sm"><h3 className="font-semibold">{a.title}</h3>{a.paras.map((p, i) => <p key={i} className="text-sm">{p}</p>)}</article>
          ))}
        </section>
      ))}
    </div>
  )
}

const Lumber = () => (
  <div className="flex max-w-4xl flex-col gap-4">
    <h2 className="text-xl font-bold">Hardwood grades</h2>
    <T label="Hardwood grades" head={['Grade', 'What it means', 'Use it for']} rows={HARDWOOD_GRADES.map(g => [g.grade, g.what, g.use])} />
    <h2 className="text-xl font-bold">Softwood grades</h2>
    <T label="Softwood grades" head={['Grade', 'What it means', 'Use it for']} rows={SOFTWOOD_GRADES.map(g => [g.grade, g.what, g.use])} />
    <h2 className="text-xl font-bold">Nominal and actual sizes</h2>
    <T label="Nominal sizes" head={['Called', 'Really is']} rows={NOMINAL.map(n => [n.nominal, n.actual])} />
  </div>
)

const Drill = () => (
  <div className="flex max-w-5xl flex-col gap-2">
    <p className="text-sm">Typical drill-press speeds (rpm). Slow down for bigger bits, harder material and deep holes; clear chips often.</p>
    <T label="Drill speeds" head={['Bit', 'Size', 'Softwood', 'Hardwood', 'Plastic', 'Metal']} rows={DRILL_SPEEDS.map(d => [d.bit, d.size, d.softwood, d.hardwood, d.plastic, d.metal])} />
  </div>
)

function Glossary({ first }: { first?: string }) {
  const [q, setQ] = useState(first ?? '')
  const t = q.trim().toLowerCase()
  const list = GLOSSARY.filter(g => !t || g.term.toLowerCase().includes(t) || g.slug === t)
  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <input aria-label="Search the glossary" placeholder="Search words" value={q} onChange={e => setQ(e.target.value)} className="w-72 rounded border border-stone-300 px-2 py-1" />
      <dl aria-label="Glossary">{list.map(g => <div key={g.slug} id={`g-${g.slug}`} className="border-b border-stone-200 py-1"><dt className="font-semibold">{g.term}</dt><dd className="text-sm">{g.meaning}</dd></div>)}</dl>
    </div>
  )
}
