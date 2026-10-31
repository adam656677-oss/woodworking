// Lathe Turning: hold the gouge against the spinning blank to shape it to the dashed outline.
import { useEffect, useRef, useState } from 'react'
import { cut, LATHE_TARGETS, newBlank, SAMPLES, score, TOOL_REACH, type Blank } from '../lathe'
import { GamePage } from './common'

const W = 720, H = 300, L = 60, R = W - 60, MID = H / 2, MAXR = 110

export function LatheGame() {
  const [tid, setTid] = useState(LATHE_TARGETS[0].id)
  const target = LATHE_TARGETS.find(t => t.id === tid)!
  const [blank, setBlank] = useState<Blank>(() => newBlank())
  const [spin, setSpin] = useState(0)
  const [done, setDone] = useState(false)
  const tool = useRef<{ at: number; depth: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  // The blank spins and the tool cuts while it's held down.
  useEffect(() => {
    if (done) return
    let raf = 0
    const tick = () => {
      setSpin(s => (s + 1) % 12)
      const t = tool.current
      if (t) setBlank(b => {
        const i = Math.round(t.at * (SAMPLES - 1))
        // The gouge cuts only where it's touching the wood; pressing nearer the centre cuts harder.
        return t.depth < b.radii[i] ? cut(b, t.at, Math.min(1, (b.radii[i] - t.depth) * 4 + 0.3)) : b
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done])
  const where = (e: React.PointerEvent) => {
    const box = svg.current!.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * W, y = ((e.clientY - box.top) / box.height) * H
    return { at: Math.max(0, Math.min(1, (x - L) / (R - L))), depth: Math.max(TOOL_REACH, Math.min(1.2, Math.abs(y - MID) / MAXR)) }
  }
  const profile = (radii: number[], sign: 1 | -1) => radii.map((r, i) => `${L + (i / (SAMPLES - 1)) * (R - L)},${MID - sign * r * MAXR}`).join(' ')
  const res = score(blank, target)
  return (
    <GamePage title="Lathe Turning" how="Press and hold on the spinning wood to cut it with the gouge. Shape it to the dashed line — slowly! Don't go past the line. On a real lathe, a grown-up runs the machine, and the tool always rests on the tool rest.">
      <div className="mb-3 flex flex-wrap gap-2">
        {LATHE_TARGETS.map(t => <button key={t.id} aria-pressed={tid === t.id} onClick={() => { setTid(t.id); setBlank(newBlank()); setDone(false) }} className={`rounded-xl px-4 py-2 text-lg font-semibold ${tid === t.id ? 'bg-sky-600 text-white' : 'bg-white'}`}>{t.name}</button>)}
      </div>
      <svg ref={svg} role="img" aria-label="Lathe" viewBox={`0 0 ${W} ${H}`} className="w-full max-w-4xl touch-none select-none rounded-2xl bg-stone-100 shadow"
        onPointerDown={e => { if (done) return; (e.target as Element).setPointerCapture?.(e.pointerId); tool.current = where(e) }}
        onPointerMove={e => { if (tool.current) tool.current = where(e) }}
        onPointerUp={() => { tool.current = null }} onPointerLeave={() => { tool.current = null }}>
        {/* Headstock, tailstock, bed */}
        <rect x={0} y={MID - 70} width={L - 6} height={140} rx={8} fill="#2f80c9" />
        <rect x={R + 6} y={MID - 40} width={W - R - 6} height={80} rx={8} fill="#2f80c9" />
        <rect x={0} y={H - 30} width={W} height={18} fill="#556270" />
        {/* The wood, with streaks that move as it spins */}
        <polygon points={`${profile(blank.radii, 1)} ${profile(blank.radii, -1).split(' ').reverse().join(' ')}`} fill="#e2b878" stroke="#8a5a2b" strokeWidth={2} />
        {[0, 1, 2].map(k => <line key={k} x1={L} x2={R} y1={MID + ((spin * 6 + k * 24) % 72) - 36} y2={MID + ((spin * 6 + k * 24) % 72) - 36} stroke="#8a5a2b" opacity={0.25} />)}
        {/* The target shape */}
        <polyline points={profile(target.radii, 1)} fill="none" stroke="#1f6fd1" strokeWidth={2.5} strokeDasharray="8 6" />
        <polyline points={profile(target.radii, -1)} fill="none" stroke="#1f6fd1" strokeWidth={2.5} strokeDasharray="8 6" />
        {res.tooDeep.map((t, i) => <circle key={i} cx={L + t * (R - L)} cy={MID - MAXR - 12} r={5} fill="#d6453d" />)}
      </svg>
      <div className="mt-3 flex items-center gap-4 text-2xl">
        <span role="status" aria-label="Score">Shape match: {res.percent}%</span>
        {res.tooDeep.length > 0 && <span className="text-lg text-red-700">Red dots: too deep there.</span>}
        <button onClick={() => setDone(true)} disabled={done} className="rounded-xl bg-green-600 px-5 py-2 text-xl font-semibold text-white disabled:opacity-40">I'm done</button>
        <button onClick={() => { setBlank(newBlank()); setDone(false) }} className="rounded-xl bg-white px-5 py-2 text-xl shadow">New blank</button>
      </div>
      {done && <p role="alert" className="mt-3 max-w-3xl rounded-2xl bg-green-100 p-4 text-xl text-green-900">{res.percent >= 85 ? 'Beautiful turning!' : res.percent >= 60 ? 'Nice shape — take light cuts to get closer to the line.' : 'Good start. Real turners take lots of light cuts, not a few deep ones.'} You matched {res.percent}% of the shape.</p>}
    </GamePage>
  )
}
