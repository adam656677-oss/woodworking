// Shared pieces for the kids' screens: page frame with a Back button, and big friendly buttons.
import type { ReactNode } from 'react'
import { kids, type KidsPage } from '../kidsStore'

export function KidsPageFrame({ title, back, children, actions }: { title: string; back?: KidsPage; children: ReactNode; actions?: ReactNode }) {
  return (
    <main className="flex h-full flex-col bg-sky-50 text-sky-950">
      <header className="flex items-center gap-4 border-b-4 border-sky-200 bg-white px-6 py-3 print:hidden">
        <button onClick={() => kids.getState().go(back ?? { name: 'home' })} className="rounded-xl bg-sky-600 px-5 py-2 text-lg font-semibold text-white hover:bg-sky-700">
          ← Back
        </button>
        <h1 className="flex-1 text-3xl font-bold">{title}</h1>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
    </main>
  )
}

export function BigButton({ children, onClick, disabled, color = 'sky', label }: { children: ReactNode; onClick(): void; disabled?: boolean; color?: 'sky' | 'amber' | 'green'; label?: string }) {
  const colors = {
    sky: 'bg-sky-600 hover:bg-sky-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    green: 'bg-green-600 hover:bg-green-700'
  }
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className={`rounded-xl px-6 py-3 text-xl font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-40 ${colors[color]}`}>
      {children}
    </button>
  )
}

export function Stars({ n }: { n: number }) {
  return <span aria-label={`${n} of 3 stars`} className="text-amber-500">{'★'.repeat(n)}<span className="text-stone-300">{'★'.repeat(3 - n)}</span></span>
}
