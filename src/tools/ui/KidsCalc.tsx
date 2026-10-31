// The kids' math helpers: board feet, tape-measure sums and even spacing, big and simple.
import { useState } from 'react'
import { kids } from '../../kids/kidsStore'
import { Calculator, KID_CALCS } from './Calculators'

const NAMES = { bf: 'How much wood?', fraction: 'Add and take away', spacing: 'Space them evenly' } as Record<string, string>

export function KidsCalc() {
  const [id, setId] = useState(KID_CALCS[0])
  return (
    <main className="flex h-full flex-col items-center overflow-auto bg-violet-50 p-8 text-violet-950">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <button onClick={() => kids.getState().go({ name: 'home' })} className="rounded-xl bg-white px-5 py-2 text-lg font-semibold shadow">← Back</button>
        <h1 className="text-4xl font-bold">Math Helpers</h1>
        <span />
      </div>
      <nav role="tablist" className="mt-6 flex gap-3">
        {KID_CALCS.map(k => <button key={k} role="tab" aria-selected={id === k} onClick={() => setId(k)} className={`rounded-2xl px-5 py-3 text-xl font-semibold ${id === k ? 'bg-violet-600 text-white' : 'bg-white'}`}>{NAMES[k]}</button>)}
      </nav>
      <div className="mt-6 w-full max-w-4xl"><Calculator key={id} id={id} kids /></div>
    </main>
  )
}
