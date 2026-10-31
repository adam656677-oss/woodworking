// Spot the Hazard: tap the dangers in the shop picture.
import { useState } from 'react'
import { HAZARD_SCENE, hazardAt, type Hazard } from '../hazards'
import { GamePage } from './common'

const INK = '#3b3226', STEEL = '#9aa5b1', WOOD = '#e2b878', DARK = '#8a5a2b'

/** The shop, drawn for this game. Each hazard is drawn at its spot in HAZARD_SCENE. */
function ShopPicture() {
  return (
    <g>
      <rect x={0} y={0} width={800} height={330} fill="#e9eef3" />
      <rect x={0} y={330} width={800} height={170} fill="#cbbfae" />
      {/* Pegboard with tools */}
      <rect x={560} y={40} width={210} height={130} fill="#d9c49f" stroke={DARK} strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={580 + i * 34} cy={60} r={3} fill={DARK} />)}
      <path d="M590 80 v60 M585 80 h10" stroke={INK} strokeWidth={5} />
      <path d="M640 80 l30 60 M640 80 h20" stroke={STEEL} strokeWidth={6} />
      <rect x={700} y={80} width={40} height={14} fill={STEEL} stroke={INK} />
      {/* Table saw, guard off: bare blade */}
      <rect x={60} y={200} width={230} height={26} fill={STEEL} stroke={INK} strokeWidth={2} />
      <rect x={90} y={226} width={170} height={120} fill="#6c7a89" stroke={INK} strokeWidth={2} />
      <path d="M180 200 a26 26 0 0 1 52 0 z" fill="#c9d1d9" stroke={INK} strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} d={`M${182 + i * 7} ${200 - Math.sin((i / 6) * Math.PI) * 24} l4 -4`} stroke={INK} strokeWidth={2} />)}
      {/* Clutter: scraps and a coffee mug on the saw table */}
      <rect x={98} y={178} width={36} height={14} fill={WOOD} stroke={DARK} transform="rotate(-12 116 185)" />
      <rect x={118} y={186} width={30} height={10} fill={WOOD} stroke={DARK} transform="rotate(18 133 191)" />
      <rect x={140} y={170} width={18} height={24} rx={3} fill="#c0392b" stroke={INK} />
      {/* Drill press with a person in loose sleeves */}
      <rect x={400} y={300} width={110} height={20} fill="#556270" stroke={INK} />
      <rect x={445} y={110} width={14} height={190} fill="#556270" stroke={INK} />
      <rect x={420} y={95} width={90} height={45} rx={8} fill="#2f80c9" stroke={INK} strokeWidth={2} />
      <path d="M470 140 v40" stroke={STEEL} strokeWidth={5} />
      <circle cx={360} cy={130} r={22} fill="#f3c9a0" stroke={INK} strokeWidth={2} />
      <path d="M340 156 q20 -6 40 0 v90 h-40 z" fill="#3a9d4f" stroke={INK} strokeWidth={2} />
      <path d="M378 170 q50 10 80 35 q12 14 -4 20 q-30 -10 -78 -30" fill="#3a9d4f" stroke={INK} strokeWidth={2} />
      <path d="M455 205 q10 8 2 18 q-8 -6 -14 -2" fill="#3a9d4f" stroke={INK} strokeWidth={2} />
      {/* Workbench with safety glasses lying on it */}
      <rect x={560} y={275} width={220} height={18} fill={WOOD} stroke={DARK} strokeWidth={2} />
      <rect x={570} y={293} width={14} height={60} fill={DARK} /><rect x={756} y={293} width={14} height={60} fill={DARK} />
      <g transform="translate(615 252)">
        <circle cx={10} cy={10} r={11} fill="#bfe3ff" stroke={INK} strokeWidth={2} /><circle cx={40} cy={10} r={11} fill="#bfe3ff" stroke={INK} strokeWidth={2} />
        <path d="M21 10 h8 M-1 8 l-10 -4 M51 8 l10 -4" stroke={INK} strokeWidth={2} />
      </g>
      {/* Cord across the floor to the drill press */}
      <path d="M0 470 C 150 430, 250 480, 330 455 S 430 420, 455 320" fill="none" stroke="#222" strokeWidth={5} />
      {/* Spill */}
      <ellipse cx={520} cy={465} rx={34} ry={12} fill="#7fb3d5" opacity={0.85} />
      {/* Oily rags in a pile */}
      <path d="M705 450 q10 -30 30 -36 q20 4 30 30 q-30 14 -60 6 z" fill="#b5651d" stroke={INK} strokeWidth={2} />
      <path d="M715 438 q15 -10 30 0 M720 428 q12 -6 24 2" stroke={INK} strokeWidth={1.5} fill="none" />
      {/* Heater and an open finish can */}
      <rect x={30} y={385} width={60} height={70} rx={6} fill="#999" stroke={INK} strokeWidth={2} />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M38 ${398 + i * 14} h44`} stroke="#e74c3c" strokeWidth={4} />)}
      <rect x={100} y={415} width={34} height={40} rx={3} fill="#f39c12" stroke={INK} strokeWidth={2} />
      <ellipse cx={117} cy={415} rx={17} ry={5} fill="#7a4a1a" stroke={INK} />
      <path d="M110 405 q4 -10 0 -18 M122 403 q4 -10 0 -16" stroke="#999" strokeWidth={2} fill="none" />
    </g>
  )
}

export function HazardGame() {
  const s = HAZARD_SCENE
  const [found, setFound] = useState<string[]>([])
  const [shown, setShown] = useState<Hazard | null>(null)
  const [misses, setMisses] = useState(0)
  const done = found.length === s.hazards.length
  const tap = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * s.width, y = ((e.clientY - box.top) / box.height) * s.height
    const h = hazardAt(s, x, y)
    if (!h) { setMisses(m => m + 1); return }
    if (!found.includes(h.id)) setFound([...found, h.id])
    setShown(h)
  }
  const hint = () => { const h = s.hazards.find(x => !found.includes(x.id)); if (h) { setFound([...found, h.id]); setShown(h) } }
  return (
    <GamePage title="Spot the Hazard" how="This shop has 8 dangers hiding in it. Tap each one you find to learn why it's dangerous and how to fix it.">
      <div className="mb-3 flex items-center gap-4 text-xl">
        <span role="status" aria-label="Found">{found.length} of {s.hazards.length} found</span>
        {!done && <button onClick={hint} className="rounded-xl bg-white px-4 py-2 shadow">Show me one</button>}
        {(done || found.length > 0) && <button onClick={() => { setFound([]); setShown(null); setMisses(0) }} className="rounded-xl bg-white px-4 py-2 shadow">Start over</button>}
        {misses > 2 && !done && <span className="text-lg text-sky-700">Look at the floor, the tools and the people.</span>}
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <svg role="img" aria-label="Workshop picture" viewBox={`0 0 ${s.width} ${s.height}`} onClick={tap} className="w-full max-w-4xl cursor-pointer rounded-2xl border-4 border-white shadow">
          <ShopPicture />
          {s.hazards.filter(h => found.includes(h.id)).map(h => (
            <circle key={h.id} cx={h.x} cy={h.y} r={h.r} fill="none" stroke="#d6453d" strokeWidth={5} strokeDasharray="10 6" />
          ))}
        </svg>
        <div className="flex w-80 flex-col gap-3">
          {shown && (
            <section aria-label="Hazard" className="rounded-2xl bg-white p-4 text-lg shadow">
              <h2 className="text-2xl font-bold text-red-700">{shown.name}</h2>
              <p className="mt-2"><b>Why:</b> {shown.why}</p>
              <p className="mt-2"><b>Fix it:</b> {shown.fix}</p>
            </section>
          )}
          {done && <p role="alert" className="rounded-2xl bg-green-100 p-4 text-xl font-semibold text-green-900">You found all 8! A safe shop is a tidy shop with the guards on and safety gear worn.</p>}
        </div>
      </div>
    </GamePage>
  )
}
