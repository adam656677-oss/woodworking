import { kids } from '../kids/kidsStore'
import { studio } from '../ui/store'
import { helpFor } from './context'

/** The help for the screen on show right now. */
export function currentHelp() {
  const s = studio.getState()
  return helpFor({ screen: s.screen, kidsMode: s.kidsMode, kidsPage: kids.getState().page.name })
}
