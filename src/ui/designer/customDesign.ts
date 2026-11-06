import { serialize } from '../../model/fileFormat'
import { emptyProject } from '../../model/woods'
import { newDrawing, saveDrawing } from '../../sketch/ui/session'
import { studio } from '../store'

/** Replace only after the existing unsaved-work dialog has been resolved. */
export function startCustomDesign(): boolean {
  const s = studio.getState()
  if (s.pendingReplace || s.recovery) return false
  if (s.screen === 'draw' && !saveDrawing()) return false
  const text = serialize(emptyProject('Custom design', s.userWoods))
  s.openDesignText(text, { onOpened: () => {
    void newDrawing('precise').catch(() => studio.getState().setError('The blank sketch could not be opened. Your new design is still available in 3D.'))
  } })
  return true
}
