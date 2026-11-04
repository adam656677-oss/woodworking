import { useEffect, useRef, useState } from 'react'
import { stock, useStock } from '../../optimize/stockStore'
import { tools, useTools } from '../../tools/store'
import { BuildPlanAction } from './BuildPlanAction'
import './buildPlanPrint.css'

/** Do not mount the generator until both inventory sources are available. */
export function LiveBuildPlanAction({ disabled = false }: { disabled?: boolean }) {
  const stockReady = useStock(state => state.loaded)
  const inventoryReady = useTools(state => state.loaded)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState(false)
  const pending = useRef<Promise<PromiseSettledResult<void>[]> | null>(null)
  useEffect(() => {
    let active = true
    setError(false)
    if (!pending.current) {
      pending.current = Promise.allSettled([
        Promise.resolve().then(() => { if (!stock.getState().loaded) return stock.getState().load() }),
        Promise.resolve().then(() => { if (!tools.getState().loaded) return tools.getState().load() })
      ])
    }
    const work = pending.current
    void work.then(results => {
      if (!active) return
      pending.current = null
      setError(results.some(result => result.status === 'rejected') || !stock.getState().loaded || !tools.getState().loaded)
    })
    return () => { active = false }
  }, [attempt])
  if (stockReady && inventoryReady) return <BuildPlanAction disabled={disabled} />
  return <div className="ml-auto flex items-center gap-2 text-sm">
    {error ? <>
      <p role="alert">Shop inventory could not be loaded. Your design has not changed.</p>
      <button type="button" disabled={disabled} onClick={() => { setError(false); setAttempt(value => value + 1) }} className="rounded border px-3 py-2">Retry shop inventory</button>
    </> : <p role="status">Loading shop inventory…</p>}
  </div>
}
