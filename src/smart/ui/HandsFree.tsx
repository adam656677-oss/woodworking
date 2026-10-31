// Shop Mode's hands-free "next": listens to the microphone's loudness (nothing recorded or sent) and moves on at a
// clap, a knock on the bench or a short loud "next".
import { useEffect, useRef, useState } from 'react'
import { ClapDetector, rms } from '../listen'

export function HandsFree({ onNext }: { onNext(): void }) {
  const [on, setOn] = useState(false)
  const [sens, setSens] = useState(5)
  const [level, setLevel] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const next = useRef(onNext)
  next.current = onNext
  const det = useRef(new ClapDetector({ sensitivity: 5, pauseMs: 1500 }))
  det.current.opts.sensitivity = sens
  useEffect(() => {
    if (!on) return
    let stream: MediaStream | null = null, ctx: AudioContext | null = null, timer = 0, stopped = false
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        ctx = new AudioContext()
        const an = ctx.createAnalyser()
        an.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Float32Array(an.fftSize)
        timer = window.setInterval(() => {
          an.getFloatTimeDomainData(buf)
          const l = rms(buf)
          setLevel(l)
          if (det.current.feed(l, performance.now())) next.current()
        }, 30)
      } catch {
        setErr("The microphone couldn't be used. Check that one is plugged in and allowed in Windows' privacy settings.")
        setOn(false)
      }
    })()
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); void ctx?.close() }
  }, [on])
  return (
    <div className="flex items-center gap-2">
      <button aria-pressed={on} onClick={() => { setErr(null); setOn(o => !o) }} title="Clap, knock on the bench, or say a short loud “next” to go to the next step"
        className={`rounded-lg border-2 border-stone-900 px-4 py-2 text-xl font-bold ${on ? 'bg-green-700 text-white' : ''}`}>🎤 {on ? 'Listening' : 'Hands-free'}</button>
      {on && <>
        <span aria-label="Sound level" className="h-6 w-3 overflow-hidden rounded bg-stone-200"><span className="block w-full bg-green-600" style={{ height: `${Math.min(100, level * 400)}%`, marginTop: `${100 - Math.min(100, level * 400)}%` }} /></span>
        <label className="flex items-center gap-1 text-base">Sensitivity<input aria-label="Sensitivity" type="range" min={1} max={10} value={sens} onChange={e => setSens(Number(e.target.value))} /></label>
      </>}
      {err && <span role="alert" className="text-base text-red-700">{err}</span>}
    </div>
  )
}
