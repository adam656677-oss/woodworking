import { openHelp } from '../helpStore'
import { currentHelp } from '../current'

/** A "Help" button that opens the help for the screen it is on. `className` styles it to suit the page around it. */
export function HelpButton({ className = '', label = 'Help' }: { className?: string; label?: string }) {
  return (
    <button type="button" title="Help (F1)" aria-keyshortcuts="F1" onClick={() => openHelp(currentHelp())}
      className={className || 'rounded border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600'}>{label}</button>
  )
}
