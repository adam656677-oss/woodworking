import { useEffect } from 'react'
import { kids, useKids } from '../kidsStore'
import { KidsHome } from './KidsHome'

/** Shows the current kids' page. Progress loads the first time the Kids' Workshop opens. */
export function KidsShell() {
  const loaded = useKids(s => s.loaded)
  const page = useKids(s => s.page)
  useEffect(() => {
    void kids.getState().load()
  }, [])
  if (!loaded) return <main className="flex h-full items-center justify-center bg-sky-50 text-2xl text-sky-900">Opening the workshop…</main>
  switch (page.name) {
    default:
      return <KidsHome />
  }
}
