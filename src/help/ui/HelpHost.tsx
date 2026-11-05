// Mounted once in App: listens for F1 and shows the Help window when it is open.
import { useEffect } from 'react'
import { shop } from '../../shop/shopStore'
import { currentHelp } from '../current'
import { closeHelp, help, openHelp, useHelp } from '../helpStore'
import { HelpDialog } from './HelpDialog'

export function HelpHost() {
  const open = useHelp(s => s.open)
  useEffect(() => {
    // Listens first (capture) so Esc closes Help alone, and F1 is never mistaken for a command elsewhere.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && help.getState().open) {
        e.preventDefault()
        e.stopImmediatePropagation()
        closeHelp()
        return
      }
      if (e.key !== 'F1' || e.ctrlKey || e.altKey || e.metaKey) return
      e.preventDefault()
      // Shop Mode owns the keyboard; a menu or command box that is open comes first.
      if (help.getState().open || shop.getState().session || document.querySelector('dialog[open]')) return
      openHelp(currentHelp())
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return open ? <HelpDialog /> : null
}
