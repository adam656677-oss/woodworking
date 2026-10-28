import { studio } from './store'

export function KidsPlaceholder() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-sky-50">
      <h1 className="text-3xl font-bold text-sky-900">Kids&apos; Workshop</h1>
      <p className="text-xl text-sky-800">Coming soon — the Kids&apos; Workshop is being built.</p>
      <button onClick={() => studio.getState().goto('home')} className="rounded-lg bg-sky-600 px-6 py-2 text-lg text-white hover:bg-sky-700">
        Back
      </button>
    </main>
  )
}
