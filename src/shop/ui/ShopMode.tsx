// Shop Mode: one step at a time in very large type, for the bench.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { hasVoice, speak, stop } from '../../kids/speech'
import { addMinutes, toggleDone } from '../steps'
import { shop, useShop } from '../shopStore'
import { HandsFree } from '../../smart/ui/HandsFree'

const StepPicture = lazy(() => import('./StepPicture'))

export function ShopMode() {
  const session = useShop(s => s.session)
  const [i, setI] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [started, setStarted] = useState<number | null>(null)
  const startedRef = useRef<number | null>(null)
  startedRef.current = started
  useEffect(() => { setI(0); setStarted(null) }, [session?.title])

  const steps = session?.steps ?? []
  const step = steps[Math.min(i, steps.length - 1)]
  /** Stops the timer, logging its minutes to the step it was running on. */
  const stopTimer = () => {
    const t = startedRef.current
    if (t !== null && session && step) shop.getState().setProgress(addMinutes(shop.getState().session!.progress, step.key, (Date.now() - t) / 60000))
    setStarted(null)
  }
  const go = (n: number) => { if (n < 0 || n >= steps.length) return; stopTimer(); stop(); setI(n) }
  const exit = () => { stopTimer(); stop(); shop.getState().close() }

  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      // Shop Mode covers everything: keys never reach the screen underneath (Delete, Ctrl+Z…), except saving.
      const save = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'
      if (!save) e.stopImmediatePropagation()
      if (e.repeat) { if (!save) e.preventDefault(); return }
      // Space on a focused button or the Done box presses it, as usual.
      const t = e.target as HTMLElement | null
      if (e.key === ' ' && t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT')) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(i + 1) }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(i - 1) }
      else if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey) { const s = shop.getState().session; if (s && step) shop.getState().setProgress(toggleDone(s.progress, step.key)) }
      else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  })

  if (!session || !step) return null
  const done = session.progress.done.includes(step.key)
  const minutes = session.progress.minutes[step.key]
  const big = session.kid ? 1.15 : 1
  const fs = (px: number) => ({ fontSize: px * zoom * big })
  return (
    <div role="dialog" aria-label="Shop Mode" className="fixed inset-0 z-[70] flex flex-col bg-white text-stone-950">
      <header className="flex items-center gap-3 border-b-4 border-stone-900 px-6 py-3">
        <span className="text-2xl font-black">{session.title}</span>
        <span className="flex-1 text-right text-2xl font-bold" data-testid="step-count">Step {i + 1} of {steps.length}</span>
        <button aria-label="Smaller text" onClick={() => setZoom(z => Math.max(0.6, z - 0.15))} className="rounded-lg border-2 border-stone-900 px-4 py-2 text-2xl font-bold">A–</button>
        <button aria-label="Bigger text" onClick={() => setZoom(z => Math.min(1.8, z + 0.15))} className="rounded-lg border-2 border-stone-900 px-4 py-2 text-2xl font-bold">A+</button>
        {hasVoice() && <button onClick={() => speak(`${step.title}. ${step.text}`)} className="rounded-lg border-2 border-stone-900 px-4 py-2 text-xl font-bold">🔊 Read</button>}
        <HandsFree onNext={() => go(i + 1)} />
        <button onClick={exit} className="rounded-lg bg-stone-900 px-5 py-2 text-xl font-bold text-white">Exit (Esc)</button>
      </header>
      <main className="flex min-h-0 flex-1 gap-6 overflow-hidden p-6">
        <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <h2 style={fs(48)} className="font-black leading-tight" data-testid="step-title">{step.title}</h2>
          {step.adult && <p style={fs(28)} className="rounded-lg bg-red-100 px-3 py-1 font-black text-red-800">⚠ Adult does this</p>}
          <p style={fs(32)} className="leading-snug" data-testid="step-text">{step.text}</p>
          {step.parts.length > 0 && (
            <table style={fs(24)} className="mt-2 w-full border-collapse">
              <tbody>
                {step.parts.map((p, k) => (
                  <tr key={k} className="border-b-2 border-stone-200"><td className="py-1 pr-4 font-black">{p.qty}×</td><td className="pr-4 font-bold">{p.name}</td><td className="tabular-nums">{p.size}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {step.tools.length > 0 && <p style={fs(24)} className="text-stone-700"><b>Tools:</b> {step.tools.join(', ')}</p>}
        </section>
        {(step.photo || (session.picture && step.boardIds?.length)) && (
          <aside className="flex w-[42%] shrink-0 items-center justify-center rounded-xl border-2 border-stone-300 bg-stone-50">
            {step.photo ? <img src={step.photo} alt="" className="max-h-full max-w-full object-contain" /> : (
              <Suspense fallback={null}><StepPicture boardIds={step.boardIds!} /></Suspense>
            )}
          </aside>
        )}
      </main>
      <footer className="flex items-center gap-4 border-t-4 border-stone-900 px-6 py-4">
        <button onClick={() => go(i - 1)} disabled={i === 0} className="rounded-xl border-4 border-stone-900 px-10 py-5 text-3xl font-black disabled:opacity-30">◀ Back</button>
        <label className="flex flex-1 items-center justify-center gap-3 text-3xl font-bold">
          <input type="checkbox" checked={done} onChange={() => shop.getState().setProgress(toggleDone(session.progress, step.key))} className="h-10 w-10 accent-green-700" />
          Done <span className="text-lg font-normal text-stone-500">(D)</span>
        </label>
        <div className="flex items-center gap-2 text-xl">
          <button onClick={() => (started === null ? setStarted(Date.now()) : stopTimer())} className={`rounded-lg px-4 py-3 text-xl font-bold ${started === null ? 'border-2 border-stone-900' : 'bg-amber-600 text-white'}`}>
            {started === null ? '⏱ Start timer' : '⏹ Stop timer'}
          </button>
          {minutes !== undefined && <span data-testid="step-minutes">{minutes} min</span>}
        </div>
        <button onClick={() => (i === steps.length - 1 ? exit() : go(i + 1))} className="rounded-xl bg-green-700 px-10 py-5 text-3xl font-black text-white">{i === steps.length - 1 ? 'Finish ✓' : 'Next ▶'}</button>
      </footer>
    </div>
  )
}
