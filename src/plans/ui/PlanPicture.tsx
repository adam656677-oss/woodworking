import { useEffect, useState } from 'react'
import type { Plan } from '../types'

/** The plan's picture (a page, a photo, or nothing yet). */
export function PlanPicture({ folder, plan, className }: { folder: string; plan: Plan; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const ref = plan.picture && plan.picture.kind !== 'design' ? plan.picture.ref : null
    if (ref) void window.aa.plansFileUrl(folder, ref).then(u => live && setUrl(u))
    else setUrl(null)
    return () => {
      live = false
    }
  }, [folder, plan.picture])
  return url ? <img src={url} alt="" className={`object-cover object-top ${className ?? ''}`} /> : <div className={`flex items-center justify-center bg-amber-50 text-5xl ${className ?? ''}`} aria-hidden>📐</div>
}
