import { useEffect } from 'react'
import { UnsavedDialog } from './common/UnsavedDialog'
import { Designer } from './designer/Designer'
import { Home } from './Home'
import { KidsShell } from '../kids/ui/KidsShell'
import { PlansShell } from '../plans/ui/PlansShell'
import { APP_NAME, studio, useStudio } from './store'

const AUTOSAVE_MS = 30_000

export default function App() {
  const screen = useStudio(s => s.screen)
  const name = useStudio(s => s.project.name)
  const dirty = useStudio(s => s.dirty)

  useEffect(() => {
    const s = studio.getState()
    void s.loadUserWoods()
    window.aa?.onSaveRequest(async () => {
      const ok = await studio.getState().save()
      window.aa.closeAfterSave(ok)
    })
    const timer = setInterval(() => void studio.getState().autosaveNow(), AUTOSAVE_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const title = screen === 'master' ? `${APP_NAME} — ${name}${dirty ? ' *' : ''}` : APP_NAME
    document.title = title
    window.aa?.setTitle(title)
  }, [screen, name, dirty])

  return (
    <>
      {screen === 'kids' ? <KidsShell /> : screen === 'master' ? <Designer /> : screen === 'plans' ? <PlansShell /> : <Home />}
      <UnsavedDialog />
    </>
  )
}
