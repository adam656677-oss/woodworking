import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const TABS = ['properties', 'template', 'references', 'checks'] as const
type Tab = typeof TABS[number]
const LABELS: Record<Tab, string> = { properties: 'Properties', template: 'Template', references: 'References', checks: 'Checks' }
type Props = Record<Tab, ReactNode> & {
  checksRequest: string | null
  referencesRequest: boolean
  onReferences(): void
}

export function InspectorTabs(props: Props) {
  const [active, setActive] = useState<Tab>('properties')
  const id = useId()
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => { if (props.checksRequest) setActive('checks') }, [props.checksRequest])
  useEffect(() => { if (props.referencesRequest) setActive('references') }, [props.referencesRequest])
  const activate = (tab: Tab) => {
    setActive(tab)
    if (tab === 'references') props.onReferences()
  }

  return <div className="flex min-h-0 flex-col">
    <div role="tablist" aria-label="Inspector sections" className="sticky top-0 z-10 grid grid-cols-2 border-b border-stone-200 bg-stone-50 p-1">
      {TABS.map((tab, index) => <button key={tab} type="button" role="tab"
        ref={el => { buttons.current[index] = el }}
        id={`${id}-${tab}-tab`} aria-controls={`${id}-${tab}-panel`} aria-selected={active === tab}
        tabIndex={active === tab ? 0 : -1}
        className={`rounded px-2 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${active === tab ? 'bg-white text-amber-900 shadow-sm' : 'text-stone-600 hover:bg-stone-200'}`}
        onClick={() => activate(tab)}
        onKeyDown={e => {
          let next: number
          if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
          else if (e.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length
          else if (e.key === 'Home') next = 0
          else if (e.key === 'End') next = TABS.length - 1
          else return
          e.preventDefault()
          e.stopPropagation()
          activate(TABS[next])
          buttons.current[next]?.focus()
        }}>{LABELS[tab]}</button>)}
    </div>
    {TABS.map(tab => <div key={tab} role="tabpanel" id={`${id}-${tab}-panel`}
      aria-labelledby={`${id}-${tab}-tab`} hidden={active !== tab} tabIndex={0}
      className="p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{props[tab]}</div>)}
  </div>
}
