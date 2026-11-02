import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** Dropdown foundation; toolbar integration is a separate change. */
export function ToolbarMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const lastFirst = useRef(false)
  const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])
  const close = () => { setOpen(false); trigger.current?.focus() }

  useEffect(() => {
    if (!open) return
    const available = items()
    const first = lastFirst.current ? available[available.length - 1] : available[0]
    if (first) first.focus()
    else menu.current?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <div ref={root} className="relative" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }} onKeyDown={event => {
      if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <button ref={trigger} type="button" id={`${id}-trigger`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        className="rounded px-2 py-1 text-sm hover:bg-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
        onClick={() => { lastFirst.current = false; setOpen(value => !value) }}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          event.stopPropagation()
          lastFirst.current = event.key === 'ArrowUp'
          if (open) {
            const available = items()
            available[lastFirst.current ? available.length - 1 : 0]?.focus()
          } else setOpen(true)
        }}>{label} <span aria-hidden="true">▾</span></button>
      {open && <div ref={menu} id={id} role="menu" aria-labelledby={`${id}-trigger`} tabIndex={-1}
        className="absolute left-0 top-full z-20 flex max-h-[70vh] min-w-40 flex-col overflow-y-auto rounded border border-stone-300 bg-white py-1 shadow-lg"
        onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          event.stopPropagation()
          const available = items()
          if (!available.length) return
          const current = available.indexOf(document.activeElement as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : event.key === 'ArrowDown' ? (current + 1) % available.length : (current - 1 + available.length) % available.length
          available[next]?.focus()
        }}>{children(close)}</div>}
    </div>
  )
}
